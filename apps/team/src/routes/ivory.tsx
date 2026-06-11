/**
 * /ivory - relationship-first Invitation Agent.
 *
 * Task 6 converts Ivory from the old roster/coach/generator model into a
 * single-person invitation flow:
 *   1. Select or create one person.
 *   2. Capture why they came to mind.
 *   3. Draft one editable message.
 *   4. Mint through the existing invitation spine with source='ivory'.
 *   5. Copy the BA-sent message/link and confirm "I sent this".
 *
 * `.team` TS6059 convention: wire types live locally so this app does not
 * compile packages/shared source through its rootDir.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type IvoryCategory =
  | 'family' | 'close_friend' | 'work' | 'church' | 'school'
  | 'neighbor' | 'gym' | 'social' | 'past_colleague' | 'other';

type IvoryStatus =
  | 'new' | 'invited' | 'customer' | 'ba' | 'not_interested' | 'follow_up';

type IvoryAngle =
  | 'do_the_business' | 'make_money' | 'lose_fat' | 'unspecified';

interface IvoryName {
  ivoryId: string;
  baId: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  notes: string;
  categories: IvoryCategory[];
  preferredAngle: IvoryAngle;
  status: IvoryStatus;
  lastProspectId: string | null;
  lastTouchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DraftResponse {
  ok: true;
  draft: string;
  degraded: boolean;
}

interface MintResponse {
  ok: true;
  ivoryId: string;
  prospectId: string;
  token: string;
  inviteUrl: string;
  createdAt: string;
  expiresAt: string;
  message: string | null;
  source: 'ivory';
  relationshipReason: string;
}

interface MarkInvitationSentResponse {
  ok: true;
  prospectId: string;
  sentAt: string;
  alreadySent: boolean;
}

interface NewPersonForm {
  firstName: string;
  lastName: string;
  notes: string;
}

interface ContactForm {
  city: string;
  stateOrRegion: string;
  phone: string;
  email: string;
}

type Step = 'person' | 'reason' | 'draft' | 'ready';

const EMPTY_PERSON: NewPersonForm = {
  firstName: '',
  lastName: '',
  notes: '',
};

const EMPTY_CONTACT: ContactForm = {
  city: '',
  stateOrRegion: '',
  phone: '',
  email: '',
};

const PRODUCT_OPTIONS = [
  'GLP-THREE',
  'the THREE product line',
  'VISAGE',
  'Vitalite',
  'Revive',
  'Collagene',
  'Imune',
  'Purifi',
  'Eternel',
] as const;

const STATUS_LABEL: Record<IvoryStatus, string> = {
  new: 'New',
  invited: 'Invited',
  customer: 'Customer',
  ba: 'BA',
  not_interested: 'Not interested',
  follow_up: 'Follow up',
};

const FIELD_ERROR: Record<string, string> = {
  invalid_first_name: 'Add a first name.',
  invalid_last_name: 'Add a last name.',
  invalid_ivory_id: 'Choose one person.',
  missing_relationship_reason: 'Add why this person came to mind.',
  relationship_reason_too_long: 'Shorten the relationship note.',
  missing_message: 'Keep a message in the draft box before minting.',
  message_too_long: 'Shorten the message before minting.',
  invalid_city: 'Add a real city.',
  invalid_state: 'Add a real state or region.',
  phone_required: 'Add the phone number you will use to send this.',
  phone_invalid: 'Enter a phone number the prospect can use for re-entry.',
  server_error: 'Something went wrong. Try again.',
};

function errorText(code: string | undefined): string {
  if (!code) return 'Something went wrong. Try again.';
  return FIELD_ERROR[code] ?? 'Something went wrong. Try again.';
}

function fullName(name: IvoryName): string {
  return `${name.firstName} ${name.lastInitial}.`;
}

export function IvoryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('person');
  const [roster, setRoster] = useState<IvoryName[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [selectedIvoryId, setSelectedIvoryId] = useState('');
  const [newPerson, setNewPerson] = useState<NewPersonForm>(EMPTY_PERSON);
  const [relationshipReason, setRelationshipReason] = useState('');
  const [productName, setProductName] = useState('');
  const [draft, setDraft] = useState('');
  const [draftDegraded, setDraftDegraded] = useState(false);
  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT);
  const [minted, setMinted] = useState<MintResponse | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedName = useMemo(
    () => roster.find((name) => name.ivoryId === selectedIvoryId) ?? null,
    [roster, selectedIvoryId],
  );

  const refreshRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const res = await fetch('/api/ivory', { credentials: 'include' });
      const data = (await res.json()) as
        | { ok: true; names: IvoryName[] }
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError('Could not load Ivory names.');
        return;
      }
      setRoster(data.names);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => { void refreshRoster(); }, [refreshRoster]);

  const setNewPersonField = useCallback(
    (key: keyof NewPersonForm) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setNewPerson((form) => ({ ...form, [key]: event.target.value })),
    [],
  );

  const setContactField = useCallback(
    (key: keyof ContactForm) =>
      (event: ChangeEvent<HTMLInputElement>) =>
        setContact((form) => ({ ...form, [key]: event.target.value })),
    [],
  );

  const createPerson = useCallback(async () => {
    const firstName = newPerson.firstName.trim();
    const lastName = newPerson.lastName.trim();
    if (!firstName || !lastName) {
      setError('Add the first and last name before continuing.');
      return;
    }
    setBusy('person');
    setError(null);
    try {
      const res = await fetch('/api/ivory', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          notes: newPerson.notes.trim(),
          preferredAngle: 'unspecified',
        }),
      });
      const data = (await res.json()) as
        | { ok: true; name: IvoryName }
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError(errorText('error' in data ? data.error : undefined));
        return;
      }
      setRoster((items) => [data.name, ...items.filter((n) => n.ivoryId !== data.name.ivoryId)]);
      setSelectedIvoryId(data.name.ivoryId);
      setStep('reason');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(null);
    }
  }, [newPerson]);

  const continueWithSelected = useCallback(() => {
    if (!selectedName) {
      setError('Choose a person or add a new one.');
      return;
    }
    setError(null);
    setStep('reason');
  }, [selectedName]);

  const generateDraft = useCallback(async () => {
    if (!selectedIvoryId || !relationshipReason.trim()) {
      setError('Add the person and why they came to mind first.');
      return;
    }
    setBusy('draft');
    setError(null);
    try {
      const res = await fetch('/api/ivory/invitation-agent/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ivoryId: selectedIvoryId,
          relationshipReason: relationshipReason.trim(),
          productName: productName || null,
        }),
      });
      const data = (await res.json()) as DraftResponse | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError(errorText('error' in data ? data.error : undefined));
        return;
      }
      setDraft(data.draft);
      setDraftDegraded(data.degraded);
      setStep('draft');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(null);
    }
  }, [productName, relationshipReason, selectedIvoryId]);

  const mintInvite = useCallback(async () => {
    if (!selectedIvoryId) return;
    setBusy('mint');
    setError(null);
    try {
      const res = await fetch('/api/ivory/invitation-agent/mint', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ivoryId: selectedIvoryId,
          relationshipReason: relationshipReason.trim(),
          message: draft.trim(),
          city: contact.city.trim(),
          stateOrRegion: contact.stateOrRegion.trim(),
          phone: contact.phone.trim(),
          email: contact.email.trim() || null,
        }),
      });
      const data = (await res.json()) as MintResponse | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError(errorText('error' in data ? data.error : undefined));
        return;
      }
      setMinted(data);
      setSentAt(null);
      setStep('ready');
      void refreshRoster();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(null);
    }
  }, [contact, draft, refreshRoster, relationshipReason, selectedIvoryId]);

  const markSent = useCallback(async () => {
    if (!minted) return;
    setBusy('sent');
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${minted.prospectId}/sent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as
        | MarkInvitationSentResponse
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError(errorText('error' in data ? data.error : undefined));
        return;
      }
      setSentAt(data.sentAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setBusy(null);
    }
  }, [minted]);

  const resetFlow = useCallback(() => {
    setStep('person');
    setSelectedIvoryId('');
    setNewPerson(EMPTY_PERSON);
    setRelationshipReason('');
    setProductName('');
    setDraft('');
    setDraftDegraded(false);
    setContact(EMPTY_CONTACT);
    setMinted(null);
    setSentAt(null);
    setError(null);
  }, []);

  const contactReady =
    contact.city.trim() !== '' &&
    contact.stateOrRegion.trim() !== '' &&
    contact.phone.trim() !== '' &&
    draft.trim() !== '' &&
    busy !== 'mint';

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="border-b border-line px-5 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
              Team Magnificent
            </p>
            <h1 className="font-display text-[clamp(34px,6vw,64px)] leading-[0.95] text-cream">
              Ivory Invitation Agent
            </h1>
          </div>
          <Button
            onClick={() => navigate('/cockpit')}
            className="bg-transparent px-4 py-3 font-mono text-[12px] uppercase tracking-[0.06em] text-cream-mute hover:text-gold"
          >
            Cockpit
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 py-8 lg:grid-cols-[280px_1fr]">
        <aside className="border border-line bg-cream/[0.025] p-4">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-cream-faint">
            Current invite
          </p>
          <StepLine active={step === 'person'} done={step !== 'person'} label="One person" />
          <StepLine
            active={step === 'reason'}
            done={step === 'draft' || step === 'ready'}
            label="Why they came to mind"
          />
          <StepLine active={step === 'draft'} done={step === 'ready'} label="Editable draft" />
          <StepLine active={step === 'ready'} done={false} label="Copy and confirm" />

          <div className="mt-6 border-t border-line pt-4">
            <p className="font-display text-[22px] text-cream">
              {selectedName ? fullName(selectedName) : 'No person selected'}
            </p>
            {relationshipReason && (
              <p className="mt-2 text-[13px] leading-[1.5] text-cream-mute">
                {relationshipReason}
              </p>
            )}
          </div>
        </aside>

        <section>
          {error && (
            <div className="mb-5 border border-red-500/30 bg-red-500/5 p-3 font-mono text-[12px] tracking-[0.04em] text-red-300">
              {error}
            </div>
          )}

          {step === 'person' && (
            <Panel
              eyebrow="Start with memory"
              title="Who came to mind?"
              intro="Pick one person already in Ivory, or add the person before drafting anything."
            >
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div>
                  <PanelTitle>Existing names</PanelTitle>
                  {loadingRoster ? (
                    <p className="text-[13px] text-cream-faint">Loading names...</p>
                  ) : roster.length === 0 ? (
                    <p className="border border-line p-5 text-[14px] text-cream-mute">
                      No Ivory names yet.
                    </p>
                  ) : (
                    <div className="max-h-[440px] overflow-auto border border-line">
                      {roster.map((name) => {
                        const active = selectedIvoryId === name.ivoryId;
                        return (
                          <button
                            type="button"
                            key={name.ivoryId}
                            onClick={() => setSelectedIvoryId(name.ivoryId)}
                            className={
                              'grid w-full grid-cols-[1fr_auto] gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 ' +
                              (active ? 'bg-gold/[0.08]' : 'hover:bg-cream/[0.03]')
                            }
                          >
                            <span>
                              <span className="block text-[15px] text-cream">
                                {fullName(name)}
                              </span>
                              <span className="mt-1 block text-[12px] leading-[1.4] text-cream-faint">
                                {name.notes || 'No relationship note yet.'}
                              </span>
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-teal">
                              {STATUS_LABEL[name.status]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <Button
                    onClick={continueWithSelected}
                    disabled={!selectedIvoryId}
                    className="mt-4 bg-gold px-6 py-5 font-display text-[15px] tracking-[0.06em] text-ink hover:bg-gold-bright"
                  >
                    Continue with this person
                  </Button>
                </div>

                <div>
                  <PanelTitle>Add one person</PanelTitle>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="new-first">First name</Label>
                        <Input
                          id="new-first"
                          value={newPerson.firstName}
                          onChange={setNewPersonField('firstName')}
                          maxLength={80}
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-last">Last name</Label>
                        <Input
                          id="new-last"
                          value={newPerson.lastName}
                          onChange={setNewPersonField('lastName')}
                          maxLength={80}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="new-notes">Memory note</Label>
                      <textarea
                        id="new-notes"
                        value={newPerson.notes}
                        onChange={setNewPersonField('notes')}
                        rows={4}
                        maxLength={1200}
                        className="w-full resize-y border border-line bg-ink-2 px-3.5 py-3 text-sm leading-[1.55] text-cream placeholder:text-cream/30 focus:border-gold focus:outline-none"
                      />
                    </div>
                    <Button
                      onClick={createPerson}
                      disabled={busy === 'person'}
                      className="bg-teal/15 px-6 py-5 font-mono text-[12px] uppercase tracking-[0.06em] text-teal hover:bg-teal/25"
                    >
                      {busy === 'person' ? 'Saving...' : 'Add and continue'}
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {step === 'reason' && selectedName && (
            <Panel
              eyebrow="Relationship context"
              title={`Why ${selectedName.firstName}?`}
              intro="Capture the real reason first. Ivory uses this to draft one personal message."
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
                <div>
                  <Label htmlFor="relationship-reason">Why they came to mind</Label>
                  <textarea
                    id="relationship-reason"
                    value={relationshipReason}
                    onChange={(event) => setRelationshipReason(event.target.value)}
                    rows={6}
                    maxLength={600}
                    placeholder={`${selectedName.firstName} came to mind because...`}
                    className="w-full resize-y border border-line bg-ink-2 px-3.5 py-3 text-sm leading-[1.55] text-cream placeholder:text-cream/30 focus:border-gold focus:outline-none"
                  />
                  <p className="mt-1.5 font-mono text-[11px] tracking-[0.06em] text-cream-faint">
                    {relationshipReason.length}/600
                  </p>
                </div>
                <div>
                  <Label htmlFor="product-context">Context</Label>
                  <select
                    id="product-context"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    className="w-full border border-line bg-ink px-3.5 py-3 text-sm text-cream focus:border-gold focus:outline-none"
                  >
                    <option value="">No product anchor</option>
                    {PRODUCT_OPTIONS.map((product) => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  onClick={() => setStep('person')}
                  className="bg-transparent px-5 py-4 font-mono text-[12px] uppercase tracking-[0.06em] text-cream-mute hover:text-cream"
                >
                  Back
                </Button>
                <Button
                  onClick={generateDraft}
                  disabled={!relationshipReason.trim() || busy === 'draft'}
                  className="bg-gold px-7 py-5 font-display text-[15px] tracking-[0.06em] text-ink hover:bg-gold-bright"
                >
                  {busy === 'draft' ? 'Drafting...' : 'Draft the invitation'}
                </Button>
              </div>
            </Panel>
          )}

          {step === 'draft' && selectedName && (
            <Panel
              eyebrow="Review before mint"
              title={`Message for ${selectedName.firstName}`}
              intro="Edit the words and add real CRM fields before creating the link."
            >
              {draftDegraded && (
                <p className="mb-4 border border-teal/30 bg-teal/5 p-3 font-mono text-[11px] uppercase tracking-[0.08em] text-teal">
                  Draft fallback used
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="draft">Invitation draft</Label>
                  <textarea
                    id="draft"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={7}
                    maxLength={1200}
                    className="w-full resize-y border border-line bg-ink-2 px-3.5 py-3 text-sm leading-[1.6] text-cream focus:border-gold focus:outline-none"
                  />
                  <p className="mt-1.5 font-mono text-[11px] tracking-[0.06em] text-cream-faint">
                    Saved for reuse - not sent for you - {draft.length}/1200
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={contact.city}
                      onChange={setContactField('city')}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State / region</Label>
                    <Input
                      id="state"
                      value={contact.stateOrRegion}
                      onChange={setContactField('stateOrRegion')}
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={contact.phone}
                      onChange={setContactField('phone')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">
                      Email <span className="text-cream-faint normal-case">(optional)</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={contact.email}
                      onChange={setContactField('email')}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  onClick={() => setStep('reason')}
                  className="bg-transparent px-5 py-4 font-mono text-[12px] uppercase tracking-[0.06em] text-cream-mute hover:text-cream"
                >
                  Back
                </Button>
                <Button
                  onClick={mintInvite}
                  disabled={!contactReady}
                  className="bg-gold px-7 py-5 font-display text-[15px] tracking-[0.06em] text-ink hover:bg-gold-bright"
                >
                  {busy === 'mint' ? 'Minting...' : 'Mint personal link'}
                </Button>
              </div>
            </Panel>
          )}

          {step === 'ready' && minted && selectedName && (
            <ReadyPanel
              minted={minted}
              person={selectedName}
              sentAt={sentAt}
              busy={busy}
              onMarkSent={markSent}
              onReset={resetFlow}
              onCockpit={() => navigate('/cockpit')}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function StepLine({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span
        className={
          'h-3 w-3 border ' +
          (active
            ? 'border-gold bg-gold'
            : done
              ? 'border-teal bg-teal'
              : 'border-cream/25 bg-transparent')
        }
      />
      <span
        className={
          'font-mono text-[11px] uppercase tracking-[0.08em] ' +
          (active ? 'text-gold' : done ? 'text-teal' : 'text-cream-faint')
        }
      >
        {label}
      </span>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-line bg-cream/[0.025] p-5 md:p-7">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
        {eyebrow}
      </p>
      <h2 className="mb-3 font-display text-[clamp(30px,5vw,48px)] leading-[0.98] text-cream">
        {title}
      </h2>
      <p className="mb-7 max-w-2xl text-[15px] leading-[1.6] text-cream-mute">
        {intro}
      </p>
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 font-display text-[22px] leading-[1] text-cream">
      {children}
    </h3>
  );
}

function ReadyPanel({
  minted,
  person,
  sentAt,
  busy,
  onMarkSent,
  onReset,
  onCockpit,
}: {
  minted: MintResponse;
  person: IvoryName;
  sentAt: string | null;
  busy: string | null;
  onMarkSent: () => Promise<void>;
  onReset: () => void;
  onCockpit: () => void;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);
  const messageAndLink = useMemo(() => {
    const message = (minted.message ?? '').trim();
    return message ? `${message}\n\n${minted.inviteUrl}` : minted.inviteUrl;
  }, [minted.inviteUrl, minted.message]);

  const copy = useCallback(async (text: string, kind: 'link' | 'both') => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === 'link') {
        setCopiedLink(true);
        window.setTimeout(() => setCopiedLink(false), 2200);
      } else {
        setCopiedBoth(true);
        window.setTimeout(() => setCopiedBoth(false), 2200);
      }
    } catch {
      // Clipboard can be blocked; the text remains visible for manual copy.
    }
  }, []);

  return (
    <Panel
      eyebrow="Link ready"
      title={`Ready for ${person.firstName}`}
      intro="Copy the message and link, send it from your own phone, then mark it sent."
    >
      <div className="space-y-4">
        <div className="border border-gold/30 bg-gold/[0.04] p-5">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
            Personal link
          </p>
          <p className="mb-4 break-all font-mono text-[14px] leading-[1.5] text-cream">
            {minted.inviteUrl}
          </p>
          <Button
            onClick={() => copy(minted.inviteUrl, 'link')}
            className="bg-cream/[0.05] px-5 py-4 font-mono text-[12px] uppercase tracking-[0.06em] text-cream hover:border-gold/40"
          >
            {copiedLink ? 'Copied' : 'Copy link'}
          </Button>
        </div>

        <div className="border border-line bg-cream/[0.025] p-5">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-cream-mute">
            Message
          </p>
          <p className="mb-4 whitespace-pre-wrap text-[15px] leading-[1.6] text-cream">
            {minted.message}
          </p>
          <Button
            onClick={() => copy(messageAndLink, 'both')}
            className="bg-gold px-6 py-5 font-display text-[15px] tracking-[0.06em] text-ink hover:bg-gold-bright"
          >
            {copiedBoth ? 'Copied message + link' : 'Copy message + link'}
          </Button>
        </div>

        <div className="border border-teal/30 bg-teal/[0.04] p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-teal">
            Ivory source saved
          </p>
          <p className="mt-2 text-[13px] leading-[1.55] text-cream-mute">
            {minted.relationshipReason}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {sentAt ? (
          <span className="inline-flex items-center px-2 font-mono text-[12px] uppercase tracking-[0.1em] text-teal">
            Marked sent
          </span>
        ) : (
          <Button
            onClick={onMarkSent}
            disabled={busy === 'sent'}
            className="bg-gold px-7 py-5 font-display text-[15px] tracking-[0.06em] text-ink hover:bg-gold-bright"
          >
            {busy === 'sent' ? 'Saving...' : 'I sent this'}
          </Button>
        )}
        <Button
          onClick={onReset}
          className="bg-transparent px-5 py-4 font-mono text-[12px] uppercase tracking-[0.06em] text-cream hover:bg-cream/[0.05]"
        >
          Invite someone else
        </Button>
        <Button
          onClick={onCockpit}
          className="bg-transparent px-5 py-4 font-mono text-[12px] uppercase tracking-[0.06em] text-cream-mute hover:text-gold"
        >
          Back to cockpit
        </Button>
      </div>
    </Panel>
  );
}

export default IvoryPage;
