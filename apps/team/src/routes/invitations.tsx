/**
 * /invitations — the BA-facing invitation production line (Chat #120).
 *
 * Spec: locked-spec 1.8 ("the invitation generator is the production line"),
 * TEAM Design Section G, Chat #119 spine, Chat #120 message-storage decision.
 *
 * This is the PLAIN-FORM front door into the shared invitation spine. The BA
 * fills the prospect's details and writes the invitation message in their own
 * words, then mints the /p/{token} link. Two more front doors feed the same
 * spine later — Ivory (who-do-you-know agent) and ScriptMaker (product-video
 * agent); both will PRE-FILL this same form (name + a drafted message) and
 * stamp source='ivory' / 'scriptmaker' instead of 'self'. See the Ivory seam
 * marked below. Per the Chat #118 lock, Ivory is its OWN surface — it is not a
 * panel embedded in this page; it hands a prospect here.
 *
 * Message storage (Chat #120): the message is STORED on the prospect record
 * for reuse + history. Storing is NOT sending — the BA copies the link and
 * message and sends from their OWN phone (locked-spec 1.13 channel protection,
 * 3.6 BA-to-BA off-app). The system never auto-sends to a prospect.
 *
 * Flow (server-truth, mirrors michael-schedule.tsx state discipline):
 *   COMPOSE  — prospect fields + message box → POST /api/invitations
 *   MINTED   — show the link + the stored message, copy buttons,
 *              "I sent this" (POST /:prospectId/sent), "Invite someone else"
 */

import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Local mirrors of the spine's wire contract. Per .team convention
// (register.tsx, michael-schedule.tsx), pages declare their own API shapes
// rather than importing @momentum/shared — the shared package's `src` alias
// is outside this app's rootDir, so importing it pulls source into the
// compile and trips TS6059. The server is the source of truth for these
// shapes (packages/shared/src/types.ts: CreateInvitationPayload /
// CreateInvitationResponse / MarkInvitationSentResponse / InvitationSource).
type InvitationSource = 'self' | 'ivory' | 'scriptmaker';

interface CreateInvitationPayload {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string;
  stateOrRegion: string;
  country?: string;
  message?: string | null;
  source?: InvitationSource;
}

interface CreateInvitationResponse {
  ok: true;
  prospectId: string;
  token: string;
  inviteUrl: string;
  createdAt: string;
  expiresAt: string;
  message: string | null;
  source: InvitationSource;
}

interface MarkInvitationSentResponse {
  ok: true;
  prospectId: string;
  sentAt: string;
  alreadySent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface ProspectForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  stateOrRegion: string;
  message: string;
}

const EMPTY_FORM: ProspectForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  city: '',
  stateOrRegion: '',
  message: '',
};

interface Minted {
  prospectId: string;
  inviteUrl: string;
  message: string | null;
  source: InvitationSource;
  prospectFirstName: string;
  expiresAt: string;
  sentAt: string | null;
}

type View =
  | { kind: 'compose' }
  | { kind: 'minted'; minted: Minted };

/**
 * Optional seed handed in by another front door (Ivory / ScriptMaker) when
 * it routes a chosen prospect into this form. When present, the form opens
 * pre-filled and the mint stamps the given source. The plain nav entry
 * passes nothing, so source falls back to 'self'. This is the Ivory seam:
 * Ivory builds its own roster UI, lets the BA pick a name + generates a
 * draft, then navigates here with this prop. No Ivory logic lives in this
 * file (Chat #118 lock — Ivory is a separate surface, not a panel here).
 */
export interface InvitationsPageProps {
  seed?: Partial<ProspectForm>;
  source?: InvitationSource;
}

// ─────────────────────────────────────────────────────────────────────────
// Field error map
// ─────────────────────────────────────────────────────────────────────────

const FIELD_ERROR_COPY: Record<string, string> = {
  invalid_first_name: 'Enter a first name (up to 80 characters).',
  invalid_last_name: 'Enter a last name (up to 80 characters).',
  invalid_city: 'Enter a city (up to 120 characters).',
  invalid_state: 'Enter a state or region (up to 120 characters).',
  phone_required: 'Add a mobile number \u2014 you\u2019ll text the invite to it.',
  message_too_long: 'That message is a little long \u2014 trim it down a touch.',
  server_error: 'Something went wrong minting the link. Try again.',
};

function errorCopy(code: string | undefined): string {
  if (!code) return 'Could not create the invitation. Try again.';
  return FIELD_ERROR_COPY[code] ?? 'Could not create the invitation. Try again.';
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

export function InvitationsPage({ seed, source = 'self' }: InvitationsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // ScriptMaker / Ivory seam (Chat #123). A front door routes a chosen
  // prospect here via navigate('/invitations', { state: { seed, source } }).
  // Router state takes precedence over props because that is how the agent
  // front doors actually arrive; the plain nav entry passes neither, so
  // source falls back to 'self'. Read once on mount — location.state is a
  // snapshot, not reactive, which is exactly what we want (a later edit by
  // the BA must not be clobbered by a re-render).
  const navState = location.state as
    | { seed?: Partial<ProspectForm>; source?: InvitationSource }
    | null;
  const initialSeed = navState?.seed ?? seed;
  const initialSource = navState?.source ?? source;

  const [form, setForm] = useState<ProspectForm>({ ...EMPTY_FORM, ...initialSeed });
  const [view, setView] = useState<View>({ kind: 'compose' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(
    (key: keyof ProspectForm) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    [],
  );

  const ready = useMemo(
    () =>
      form.firstName.trim() !== '' &&
      form.lastName.trim() !== '' &&
      form.city.trim() !== '' &&
      form.stateOrRegion.trim() !== '' &&
      form.phone.trim() !== '' &&
      !submitting,
    [form, submitting],
  );

  const handleMint = useCallback(async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    const payload: CreateInvitationPayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      city: form.city.trim(),
      stateOrRegion: form.stateOrRegion.trim(),
      message: form.message.trim() || null,
      source: initialSource,
    };
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as
        | CreateInvitationResponse
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError(errorCopy('error' in data ? data.error : undefined));
        return;
      }
      setView({
        kind: 'minted',
        minted: {
          prospectId: data.prospectId,
          inviteUrl: data.inviteUrl,
          message: data.message,
          source: data.source,
          prospectFirstName: payload.firstName,
          expiresAt: data.expiresAt,
          sentAt: null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setError(`Network error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }, [ready, form, initialSource]);

  const handleInviteAnother = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setError(null);
    setView({ kind: 'compose' });
  }, []);

  const handleMarkSent = useCallback(async (prospectId: string) => {
    const res = await fetch(`/api/invitations/${prospectId}/sent`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = (await res.json()) as
      | MarkInvitationSentResponse
      | { ok: false; error?: string };
    if (res.ok && data.ok) {
      setView((prev) =>
        prev.kind === 'minted'
          ? { kind: 'minted', minted: { ...prev.minted, sentAt: data.sentAt } }
          : prev,
      );
      return true;
    }
    return false;
  }, []);

  if (view.kind === 'minted') {
    return (
      <MintedView
        minted={view.minted}
        onInviteAnother={handleInviteAnother}
        onMarkSent={handleMarkSent}
        onDone={() => navigate('/cockpit')}
      />
    );
  }

  return (
    <ComposeView
      form={form}
      set={set}
      onMint={handleMint}
      ready={ready}
      submitting={submitting}
      error={error}
      source={initialSource}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Compose view
// ─────────────────────────────────────────────────────────────────────────

function ComposeView({
  form,
  set,
  onMint,
  ready,
  submitting,
  error,
  source,
}: {
  form: ProspectForm;
  set: (
    key: keyof ProspectForm,
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onMint: () => void;
  ready: boolean;
  submitting: boolean;
  error: string | null;
  source: InvitationSource;
}) {
  const fromAgent = source !== 'self';
  return (
    <div className="min-h-screen bg-ink text-cream py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <p className="font-display tracking-eyebrow text-[13px] text-gold mb-5">
          TEAM MAGNIFICENT · INVITE
        </p>
        <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] text-cream mb-5">
          Share it with someone.
        </h1>
        <p className="text-cream-mute text-[16px] leading-[1.6] mb-2 max-w-xl">
          Add someone you know, write them a quick note, and we&rsquo;ll mint a
          personal link. You send it from your own phone &mdash; the way a real
          recommendation travels.
        </p>
        <p className="text-cream-faint text-[13px] leading-[1.55] mb-10 max-w-xl">
          First name, last name, city, state and a mobile phone are required
          &mdash; you&rsquo;ll text the invite to that number. Email is optional.
        </p>

        {fromAgent && (
          <div className="mb-8 bg-teal/5 border border-teal/30 rounded-md py-3 px-3.5">
            <p className="font-display text-[11px] tracking-[0.18em] text-teal">
              {source === 'ivory'
                ? 'PREPARED WITH IVORY'
                : 'PREPARED FROM A PRODUCT VIDEO'}
            </p>
            <p className="text-cream-mute text-[13px] leading-[1.5] mt-1">
              Review the details and the message below, edit anything you like,
              then mint the link.
            </p>
          </div>
        )}

        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={set('firstName')}
                autoComplete="off"
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={set('lastName')}
                autoComplete="off"
                maxLength={80}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={set('city')}
                autoComplete="off"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="stateOrRegion">State / region</Label>
              <Input
                id="stateOrRegion"
                value={form.stateOrRegion}
                onChange={set('stateOrRegion')}
                autoComplete="off"
                maxLength={120}
                placeholder="e.g. CA"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">
                Email <span className="text-cream-faint normal-case">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="off"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                autoComplete="off"
                placeholder="+1 (555) 555-5555"
              />
            </div>
          </div>

          {/* The message box — the shared field all three front doors fill.
              The BA writes here by hand; Ivory / ScriptMaker pre-fill it. */}
          <div>
            <Label htmlFor="message">
              Your invitation{' '}
              <span className="text-cream-faint normal-case">(optional, saved for you)</span>
            </Label>
            <textarea
              id="message"
              value={form.message}
              onChange={set('message')}
              rows={5}
              maxLength={1200}
              placeholder={
                'Hey ' +
                (form.firstName.trim() || '[name]') +
                ", I\u2019ve been using something I think you\u2019d want to see. " +
                'Two minutes \u2014 watch this and tell me what you think.'
              }
              className={
                'w-full bg-ink-2 border border-line text-cream rounded-md ' +
                'px-3.5 py-3 text-sm font-body leading-[1.55] ' +
                'placeholder:text-cream/30 ' +
                'focus:outline-none focus:border-gold transition-colors ' +
                'disabled:cursor-not-allowed disabled:opacity-50 resize-y'
              }
            />
            <p className="mt-1.5 text-[11px] font-mono tracking-[0.06em] text-cream-faint">
              SAVED FOR REUSE · NOT SENT FOR YOU · {form.message.length}/1200
            </p>
          </div>

          {error && (
            <div className="text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-2.5">
              {error}
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={onMint}
              disabled={!ready}
              className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-8 py-6"
            >
              {submitting ? 'Minting your link\u2026' : 'Mint the link'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Minted view
// ─────────────────────────────────────────────────────────────────────────

function MintedView({
  minted,
  onInviteAnother,
  onMarkSent,
  onDone,
}: {
  minted: Minted;
  onInviteAnother: () => void;
  onMarkSent: (prospectId: string) => Promise<boolean>;
  onDone: () => void;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [sentErr, setSentErr] = useState<string | null>(null);

  const bothText = useMemo(() => {
    const msg = (minted.message ?? '').trim();
    return msg ? `${msg}\n\n${minted.inviteUrl}` : minted.inviteUrl;
  }, [minted.message, minted.inviteUrl]);

  const copy = useCallback(
    async (text: string, which: 'link' | 'both') => {
      try {
        await navigator.clipboard.writeText(text);
        if (which === 'link') {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2200);
        } else {
          setCopiedBoth(true);
          setTimeout(() => setCopiedBoth(false), 2200);
        }
      } catch {
        /* clipboard blocked — the BA can still select the text manually */
      }
    },
    [],
  );

  const handleSent = useCallback(async () => {
    setMarkingSent(true);
    setSentErr(null);
    const ok = await onMarkSent(minted.prospectId);
    if (!ok) setSentErr('Could not record that. Try once more.');
    setMarkingSent(false);
  }, [minted.prospectId, onMarkSent]);

  const alreadySent = minted.sentAt !== null;

  return (
    <div className="min-h-screen bg-ink text-cream py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <p className="font-display tracking-eyebrow text-[13px] text-gold mb-5">
          TEAM MAGNIFICENT · LINK READY
        </p>
        <h1 className="font-display text-[clamp(36px,6vw,64px)] leading-[0.96] text-cream mb-6">
          Ready for {minted.prospectFirstName}.
        </h1>

        {/* The link */}
        <div className="bg-cream/[0.025] border border-gold/30 rounded-md py-5 px-5 mb-4">
          <p className="font-mono tracking-[0.18em] text-[11px] text-gold mb-2 uppercase">
            Their personal link
          </p>
          <p className="font-mono text-[14px] text-cream break-all leading-[1.5] mb-4">
            {minted.inviteUrl}
          </p>
          <Button
            onClick={() => copy(minted.inviteUrl, 'link')}
            className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[13px] px-5 py-4"
          >
            {copiedLink ? 'Copied' : 'Copy link'}
          </Button>
        </div>

        {/* The stored message (Chat #120) */}
        {minted.message ? (
          <div className="bg-cream/[0.025] border border-cream/10 rounded-md py-5 px-5 mb-4">
            <p className="font-mono tracking-[0.18em] text-[11px] text-cream-mute mb-2 uppercase">
              Your saved message
            </p>
            <p className="text-cream text-[15px] leading-[1.6] whitespace-pre-wrap mb-4">
              {minted.message}
            </p>
            <Button
              onClick={() => copy(bothText, 'both')}
              className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-6 py-5"
            >
              {copiedBoth ? 'Copied message + link' : 'Copy message + link'}
            </Button>
          </div>
        ) : (
          <p className="text-cream-faint text-[13px] leading-[1.55] mb-4">
            No message saved — just send the link with a personal note from you.
          </p>
        )}

        <p className="text-cream-mute text-[14px] leading-[1.6] mb-8">
          Send it from your own phone, in your own words. When you have, mark it
          below so it shows up in your cockpit.
        </p>

        {sentErr && (
          <p className="text-[12px] font-mono tracking-[0.04em] text-red-400 mb-4">
            {sentErr}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {alreadySent ? (
            <span className="inline-flex items-center gap-2 font-mono tracking-[0.1em] text-[12px] text-teal uppercase px-2">
              <span className="h-2 w-2 rounded-full bg-teal" />
              Marked sent
            </span>
          ) : (
            <Button
              onClick={handleSent}
              disabled={markingSent}
              className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-6 py-5"
            >
              {markingSent ? 'Saving\u2026' : 'I sent this'}
            </Button>
          )}
          <Button
            onClick={onInviteAnother}
            className="bg-transparent text-cream border border-cream/20 hover:bg-cream/[0.05] font-mono tracking-[0.04em] text-[13px] px-6 py-5"
          >
            Invite someone else
          </Button>
          <Button
            onClick={onDone}
            className="bg-transparent text-cream-mute hover:text-gold font-mono tracking-[0.04em] text-[13px] px-6 py-5"
          >
            Back to cockpit
          </Button>
        </div>
      </div>
    </div>
  );
}
