/**
 * /cockpit — the BA's home base (Chat #121).
 *
 * Replaces the Chat #94 "Cockpit coming soon" stub with the real cockpit
 * shell. Per TEAM Design Section H the cockpit is three things: My Sponsor,
 * My Invites, and a CRM view. This session ships:
 *   - My Invites      — WORKING. The read side of the invitation module:
 *                       every prospect the BA invited, their status, the
 *                       saved message, and an expandable activity timeline.
 *   - My Sponsor      — WORKING. Card from GET /api/cockpit/summary (founder
 *                       treatment when there's no upline, locked-spec 1.2).
 *   - CRM             — STUBBED. A later session; the My Invites list is the
 *                       interim CRM.
 *
 * Data:
 *   GET /api/cockpit/summary  -> counts + sponsor card
 *   GET /api/cockpit/invites  -> invites[] + activityByProspect{}
 *   POST /api/invitations/:id/sent -> "I sent this" for a draft row (reuses
 *                       the spine route; the cockpit just calls it).
 *
 * Compliance (locked-spec 3.10): BA-facing .team surface. Shows funnel
 * status + saved message + prospect contact. No income/placement claims —
 * status is progress, never earnings. The headline number a BA is nudged
 * toward is invitations sent (locked-spec 1.9), so the empty state and the
 * primary CTA both point at /invitations.
 *
 * Per .team convention (register.tsx, michael-schedule.tsx, invitations.tsx):
 * API wire shapes are declared locally rather than imported from
 * @momentum/shared — the shared `src` alias is outside this app's rootDir and
 * importing it trips TS6059 (lesson_team_app_cannot_import_shared_types_ts6059
 * _chat120). Source of truth for these shapes is
 * packages/shared/src/types.ts (InviteSummary / MyInvitesResponse /
 * CockpitSummaryResponse / InviteDisplayStatus / InvitationActivityEntry).
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TodaysActions } from '@/components/cockpit/TodaysActions';

// ── Local wire shapes (mirror packages/shared/src/types.ts) ──────────────

type InviteDisplayStatus =
  | 'draft'
  | 'sent'
  | 'opened'
  | 'watched'
  | 'callback'
  | 'enrolled'
  | 'expired';

type TokenState =
  | 'minted'
  | 'clicked'
  | 'video_started'
  | 'video_quarter'
  | 'video_half'
  | 'video_three_quarter'
  | 'video_complete'
  | 'enrolled'
  | 'expired';

type CallbackIntent =
  | 'interested_tell_me_more'
  | 'have_questions'
  | 'ready_to_join';

type InvitationSource = 'self' | 'ivory' | 'scriptmaker';

type InvitationActivityKind =
  | 'invitation_sent'
  | 'video_completed'
  | 'callback_requested';

interface InvitationActivityEntry {
  activityId: string;
  prospectId: string;
  sponsorBaId: string;
  kind: InvitationActivityKind;
  note: string;
  at: string;
}

interface InviteSummary {
  prospectId: string;
  token: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  tokenState: TokenState;
  status: InviteDisplayStatus;
  positionNumber: number | null;
  latestCallbackIntent: CallbackIntent | null;
  message: string | null;
  source: InvitationSource;
  sentAt: string | null;
  becameCustomer: boolean;
  createdAt: string;
  expiresAt: string;
}

interface MyInvitesResponse {
  ok: true;
  invites: InviteSummary[];
  activityByProspect: Record<string, InvitationActivityEntry[]>;
}

interface CockpitSummaryResponse {
  ok: true;
  baFirstName: string;
  sponsor: {
    fullName: string;
    firstName: string;
    lastInitial: string;
    phone: string | null;
  } | null;
  counts: {
    total: number;
    sent: number;
    watched: number;
    callbacks: number;
    enrolled: number;
  };
}

interface MarkInvitationSentResponse {
  ok: true;
  prospectId: string;
  sentAt: string;
  alreadySent: boolean;
}

// ── CRM write-side wire shapes (mirror packages/shared/src/types.ts) ─────
// Per .team TS6059 convention: API shapes redeclared locally; the shared
// package remains source-of-truth (see lesson_team_app_cannot_import_shared
// _types_ts6059_chat120). Keep in sync with shared CRM types added Chat #132.

type CrmDisposition =
  | 'new-ba'
  | 'new-customer'
  | 'interested'
  | 'not-interested'
  | 'later';

const CRM_DISPOSITIONS: readonly CrmDisposition[] = [
  'new-ba',
  'new-customer',
  'interested',
  'later',
  'not-interested',
];

const DISPOSITION_LABEL: Record<CrmDisposition, string> = {
  'new-ba': 'New BA',
  'new-customer': 'New customer',
  interested: 'Interested',
  later: 'Later',
  'not-interested': 'Not interested',
};

interface CrmNoteRecord {
  noteId: string;
  prospectId: string;
  sponsorBaId: string;
  text: string;
  createdAt: string;
}

interface CrmFollowUpRecord {
  prospectId: string;
  sponsorBaId: string;
  dueAt: string;
  createdAt: string;
  clearedAt: string | null;
}

interface ProspectCrmBundle {
  prospectId: string;
  notes: CrmNoteRecord[];
  followUp: CrmFollowUpRecord | null;
  disposition: CrmDisposition | null;
  reinviteAvailableAt: string | null;
}

interface CrmBundleResponse {
  ok: true;
  bundle: ProspectCrmBundle;
}

interface CreateNoteResponse {
  ok: true;
  note: CrmNoteRecord;
}

interface SetFollowUpResponse {
  ok: true;
  followUp: CrmFollowUpRecord;
}

interface SetDispositionResponse {
  ok: true;
  disposition: CrmDisposition | null;
}

interface ReinviteResponse {
  ok: true;
  prospectId: string;
  token: string;
  inviteUrl: string;
  sentAt: string;
  expiresAt: string;
  fresh: boolean;
}

// ── Status display config ────────────────────────────────────────────────

const STATUS_META: Record<
  InviteDisplayStatus,
  { label: string; tone: 'gold' | 'teal' | 'mute' | 'dim' }
> = {
  draft: { label: 'Draft — not sent', tone: 'dim' },
  sent: { label: 'Sent', tone: 'mute' },
  opened: { label: 'Opened the link', tone: 'mute' },
  watched: { label: 'Watched the video', tone: 'teal' },
  callback: { label: 'Asked for a callback', tone: 'gold' },
  enrolled: { label: 'Enrolled', tone: 'teal' },
  expired: { label: 'Expired', tone: 'dim' },
};

const INTENT_LABEL: Record<CallbackIntent, string> = {
  interested_tell_me_more: 'interested — tell me more',
  have_questions: 'has questions',
  ready_to_join: 'ready to join',
};

const SOURCE_LABEL: Record<InvitationSource, string> = {
  self: 'You wrote this',
  ivory: 'Prepared with Ivory',
  scriptmaker: 'Prepared from a product video',
};

function toneClass(tone: 'gold' | 'teal' | 'mute' | 'dim'): string {
  switch (tone) {
    case 'gold':
      return 'text-gold border-gold/40 bg-gold/[0.06]';
    case 'teal':
      return 'text-teal border-teal/40 bg-teal/[0.06]';
    case 'mute':
      return 'text-cream-mute border-cream/15 bg-cream/[0.03]';
    case 'dim':
      return 'text-cream-faint border-cream/10 bg-transparent';
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatActivity(kind: InvitationActivityKind): string {
  switch (kind) {
    case 'invitation_sent':
      return 'Link sent';
    case 'video_completed':
      return 'Finished the video';
    case 'callback_requested':
      return 'Requested a callback';
  }
}

// ── View state ─────────────────────────────────────────────────────────

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      summary: CockpitSummaryResponse;
      invites: InviteSummary[];
      activityByProspect: Record<string, InvitationActivityEntry[]>;
    };

export function CockpitPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: 'loading' });
  // When the BA clicks an item in Today's Actions, we record the target
  // prospectId here; InviteRow watches for matches and self-expands. We
  // bump a tick so re-clicking the same id (after a manual collapse) still
  // re-opens — the prop change is what triggers the effect inside the row.
  const [forceExpandedId, setForceExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [summaryRes, invitesRes] = await Promise.all([
        fetch('/api/cockpit/summary', { credentials: 'include' }),
        fetch('/api/cockpit/invites', { credentials: 'include' }),
      ]);
      if (summaryRes.status === 401 || invitesRes.status === 401) {
        navigate('/register');
        return;
      }
      if (!summaryRes.ok || !invitesRes.ok) {
        setView({ kind: 'error', message: 'Could not load your cockpit. Try again.' });
        return;
      }
      const summary = (await summaryRes.json()) as CockpitSummaryResponse;
      const invites = (await invitesRes.json()) as MyInvitesResponse;
      setView({
        kind: 'ready',
        summary,
        invites: invites.invites,
        activityByProspect: invites.activityByProspect,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setView({ kind: 'error', message: `Network error: ${msg}` });
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  // Optimistic patch when "I sent this" succeeds, so the row updates without
  // a full reload. The server is the source of truth; this just mirrors it.
  const patchSent = useCallback((prospectId: string, sentAt: string) => {
    setView((prev) => {
      if (prev.kind !== 'ready') return prev;
      const nextInvites = prev.invites.map((i) =>
        i.prospectId === prospectId
          ? {
              ...i,
              sentAt,
              status: (i.status === 'draft' ? 'sent' : i.status) as InviteDisplayStatus,
            }
          : i,
      );
      return {
        ...prev,
        invites: nextInvites,
        summary: {
          ...prev.summary,
          counts: {
            ...prev.summary.counts,
            sent: nextInvites.filter((i) => i.sentAt !== null).length,
          },
        },
      };
    });
  }, []);

  if (view.kind === 'loading') {
    return (
      <Shell>
        <p className="text-cream-faint font-mono text-[13px] tracking-[0.04em]">
          Loading your cockpit…
        </p>
      </Shell>
    );
  }

  if (view.kind === 'error') {
    return (
      <Shell>
        <p className="text-red-400 font-mono text-[13px] tracking-[0.04em] mb-5">
          {view.message}
        </p>
        <Button
          onClick={() => {
            setView({ kind: 'loading' });
            void load();
          }}
          className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[13px] px-5 py-4"
        >
          Try again
        </Button>
      </Shell>
    );
  }

  const { summary, invites, activityByProspect } = view;

  const handleTodayClick = useCallback((prospectId: string) => {
    setForceExpandedId(prospectId);
    // Scroll to the row. The <li> carries id={`invite-${prospectId}`}.
    const el = document.getElementById(`invite-${prospectId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <p className="font-display tracking-eyebrow text-[13px] text-gold mb-3">
            TEAM MAGNIFICENT · COCKPIT
          </p>
          <h1 className="font-display text-[clamp(40px,7vw,68px)] leading-[0.95] text-cream">
            {summary.baFirstName
              ? `Welcome back, ${summary.baFirstName}.`
              : 'Welcome back.'}
          </h1>
        </div>
        <Button
          onClick={() => navigate('/invitations')}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-7 py-6"
        >
          Invite someone
        </Button>
      </div>

      {/* Counts strip */}
      <CountsStrip counts={summary.counts} />

      {/* Today's Actions — derived from existing pipeline (callbacks, due
          follow-ups, expiring windows). Renders the locked-spec 1.9 bias
          prompt as its own empty state, so it's always present. */}
      <TodaysActions onJump={handleTodayClick} />

      {/* Two-column: My Invites (main) + side rail (My Sponsor, CRM hint) */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">
        <section>
          <SectionLabel>My Invites</SectionLabel>
          {invites.length === 0 ? (
            <EmptyInvites onInvite={() => navigate('/invitations')} />
          ) : (
            <ul className="space-y-3">
              {invites.map((inv) => (
                <InviteRow
                  key={inv.prospectId}
                  invite={inv}
                  activity={activityByProspect[inv.prospectId] ?? []}
                  onMarkedSent={patchSent}
                  forceExpandedId={forceExpandedId}
                  onReinvited={() => {
                    setView({ kind: 'loading' });
                    void load();
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-8">
          <div>
            <SectionLabel>My Sponsor</SectionLabel>
            <SponsorCard sponsor={summary.sponsor} />
          </div>
          <div>
            <SectionLabel>CRM</SectionLabel>
            <div className="bg-cream/[0.02] border border-cream/10 rounded-md p-5">
              <p className="text-cream-mute text-[14px] leading-[1.6]">
                Notes, follow-ups, and tags live inside each invite row.
                Expand any row to write a private note, set a reminder, tag
                where the conversation stands, or re-invite.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-cream py-14 px-6">
      <div className="max-w-5xl mx-auto">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono tracking-[0.18em] text-[11px] text-cream-mute uppercase mb-4">
      {children}
    </p>
  );
}

function CountsStrip({
  counts,
}: {
  counts: CockpitSummaryResponse['counts'];
}) {
  const items: Array<{ label: string; value: number; accent?: boolean }> = [
    { label: 'Invited', value: counts.total },
    { label: 'Sent', value: counts.sent },
    { label: 'Watched', value: counts.watched },
    { label: 'Callbacks', value: counts.callbacks, accent: true },
    { label: 'Enrolled', value: counts.enrolled },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-cream/[0.02] border border-cream/10 rounded-md py-4 px-4"
        >
          <p
            className={
              'font-display text-[34px] leading-none ' +
              (it.accent ? 'text-gold' : 'text-cream')
            }
          >
            {it.value}
          </p>
          <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mt-2">
            {it.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function EmptyInvites({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="bg-cream/[0.02] border border-cream/10 rounded-md py-12 px-8 text-center">
      <h3 className="font-display text-[28px] leading-[1.1] text-cream mb-3">
        Who are you sharing with today?
      </h3>
      <p className="text-cream-mute text-[15px] leading-[1.6] max-w-md mx-auto mb-6">
        Your invites show up here the moment you mint a link. The one thing
        that matters is sending the next one — everything else follows.
      </p>
      <Button
        onClick={onInvite}
        className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-7 py-6"
      >
        Mint your first link
      </Button>
    </div>
  );
}

function SponsorCard({
  sponsor,
}: {
  sponsor: CockpitSummaryResponse['sponsor'];
}) {
  if (!sponsor) {
    return (
      <div className="bg-cream/[0.02] border border-gold/20 rounded-md p-5">
        <p className="font-display text-[22px] text-gold leading-[1.1] mb-2">
          You&rsquo;re at the top.
        </p>
        <p className="text-cream-mute text-[13px] leading-[1.55]">
          As a founder of Team Magnificent, the line builds beneath you. Your
          team looks to you the way a downline looks to a sponsor.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-cream/[0.02] border border-cream/10 rounded-md p-5">
      <p className="font-display text-[22px] text-cream leading-[1.1] mb-1">
        {sponsor.fullName}
      </p>
      <p className="text-cream-faint text-[12px] font-mono tracking-[0.06em] mb-3">
        YOUR SPONSOR
      </p>
      {sponsor.phone ? (
        <a
          href={`tel:${sponsor.phone}`}
          className="inline-block text-teal text-[14px] font-mono tracking-[0.04em] hover:underline"
        >
          {sponsor.phone}
        </a>
      ) : (
        <p className="text-cream-faint text-[13px] leading-[1.5]">
          Reach out to {sponsor.firstName} anytime you&rsquo;re stuck — that&rsquo;s
          what your sponsor is for.
        </p>
      )}
    </div>
  );
}

function InviteRow({
  invite,
  activity,
  onMarkedSent,
  forceExpandedId,
  onReinvited,
}: {
  invite: InviteSummary;
  activity: InvitationActivityEntry[];
  onMarkedSent: (prospectId: string, sentAt: string) => void;
  forceExpandedId: string | null;
  onReinvited: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markErr, setMarkErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Today's Actions click → parent sets forceExpandedId; we open inline.
  useEffect(() => {
    if (forceExpandedId === invite.prospectId) setExpanded(true);
  }, [forceExpandedId, invite.prospectId]);

  const meta = STATUS_META[invite.status];
  const inviteUrl = invite.token
    ? `https://teammagnificent.com/p/${invite.token}`
    : '';

  const handleMarkSent = useCallback(async () => {
    setMarking(true);
    setMarkErr(null);
    try {
      const res = await fetch(`/api/invitations/${invite.prospectId}/sent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as
        | MarkInvitationSentResponse
        | { ok: false; error?: string };
      if (res.ok && data.ok) {
        onMarkedSent(invite.prospectId, data.sentAt);
      } else {
        setMarkErr('Could not record that. Try once more.');
      }
    } catch {
      setMarkErr('Network error. Try once more.');
    } finally {
      setMarking(false);
    }
  }, [invite.prospectId, onMarkedSent]);

  const copyLink = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the BA can select manually */
    }
  }, [inviteUrl]);

  return (
    <li
      id={`invite-${invite.prospectId}`}
      className="bg-cream/[0.02] border border-cream/10 rounded-md overflow-hidden scroll-mt-6"
    >
      {/* Row head */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-cream text-[16px] leading-[1.3]">
            {invite.firstName} {invite.lastInitial}.
            {invite.city && (
              <span className="text-cream-faint text-[14px]">
                {' '}
                · {invite.city}, {invite.stateOrRegion}
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={
                'inline-block font-mono tracking-[0.06em] text-[11px] px-2 py-0.5 rounded border ' +
                toneClass(meta.tone)
              }
            >
              {meta.label}
              {invite.status === 'callback' && invite.latestCallbackIntent
                ? ` · ${INTENT_LABEL[invite.latestCallbackIntent]}`
                : ''}
            </span>
            {invite.positionNumber !== null && (
              <span className="font-mono text-[11px] text-cream-faint tracking-[0.06em]">
                #{invite.positionNumber}
              </span>
            )}
            <span className="font-mono text-[11px] text-cream-faint tracking-[0.06em]">
              {formatDate(invite.createdAt)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-cream-mute hover:text-gold uppercase pt-1"
        >
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-cream/10 px-4 py-4 space-y-4">
          {/* The link */}
          {inviteUrl && (
            <div>
              <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-1.5">
                Their link
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[13px] text-cream break-all">
                  {inviteUrl}
                </span>
                <button
                  onClick={copyLink}
                  className="font-mono text-[11px] tracking-[0.06em] text-teal hover:underline"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Saved message + source */}
          {invite.message && (
            <div>
              <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-1.5">
                Saved message · {SOURCE_LABEL[invite.source]}
              </p>
              <p className="text-cream text-[14px] leading-[1.6] whitespace-pre-wrap">
                {invite.message}
              </p>
            </div>
          )}

          {/* Activity timeline */}
          <div>
            <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-2">
              Activity
            </p>
            {activity.length === 0 ? (
              <p className="text-cream-faint text-[13px]">
                Nothing yet — once you send the link and they engage, it shows
                up here.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {activity.map((a) => (
                  <li
                    key={a.activityId}
                    className="flex items-baseline gap-2 text-[13px]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-teal shrink-0 translate-y-1.5" />
                    <span className="text-cream">{formatActivity(a.kind)}</span>
                    <span className="text-cream-faint font-mono text-[11px] tracking-[0.04em]">
                      {formatDate(a.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* "I sent this" — only meaningful for an unsent draft */}
          {invite.sentAt === null && (
            <div className="pt-1">
              {markErr && (
                <p className="text-red-400 font-mono text-[11px] tracking-[0.04em] mb-2">
                  {markErr}
                </p>
              )}
              <Button
                onClick={handleMarkSent}
                disabled={marking}
                className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-5 py-4"
              >
                {marking ? 'Saving…' : 'I sent this'}
              </Button>
            </div>
          )}

          {/* CRM panel — notes, follow-up, disposition, re-invite. Loads on
              first expand; sponsor-scoped on the server (locked-spec 3.5). */}
          <CrmPanel
            prospectId={invite.prospectId}
            isDraft={invite.sentAt === null}
            isTerminal={invite.status === 'enrolled'}
            onReinvited={onReinvited}
          />
        </div>
      )}
    </li>
  );
}

// ── CRM panel (per-invite) ───────────────────────────────────────────────

function CrmPanel({
  prospectId,
  isDraft,
  isTerminal,
  onReinvited,
}: {
  prospectId: string;
  isDraft: boolean;
  isTerminal: boolean;
  onReinvited: () => void;
}) {
  const [bundle, setBundle] = useState<ProspectCrmBundle | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetch(`/api/crm/${prospectId}`, { credentials: 'include' });
      if (!res.ok) {
        setLoadErr('Could not load CRM for this row.');
        return;
      }
      const data = (await res.json()) as CrmBundleResponse;
      setBundle(data.bundle);
    } catch {
      setLoadErr('Network error loading CRM.');
    } finally {
      setLoading(false);
    }
  }, [prospectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading && !bundle) {
    return (
      <div className="border-t border-cream/10 pt-4">
        <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-2">
          CRM
        </p>
        <p className="text-cream-faint text-[13px]">Loading…</p>
      </div>
    );
  }

  if (loadErr || !bundle) {
    return (
      <div className="border-t border-cream/10 pt-4">
        <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-2">
          CRM
        </p>
        <p className="text-red-400 font-mono text-[11px] tracking-[0.04em]">
          {loadErr ?? 'CRM unavailable.'}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-cream/10 pt-4 space-y-5">
      <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase">
        CRM
      </p>

      <DispositionRow
        prospectId={prospectId}
        current={bundle.disposition}
        onChanged={(next) => setBundle({ ...bundle, disposition: next })}
      />

      <FollowUpRow
        prospectId={prospectId}
        current={bundle.followUp}
        onChanged={(next) => setBundle({ ...bundle, followUp: next })}
      />

      <NotesRow
        prospectId={prospectId}
        notes={bundle.notes}
        onAdded={(note) => setBundle({ ...bundle, notes: [note, ...bundle.notes] })}
      />

      <ReinviteRow
        prospectId={prospectId}
        isDraft={isDraft}
        isTerminal={isTerminal}
        availableAt={bundle.reinviteAvailableAt}
        onReinvited={onReinvited}
      />
    </div>
  );
}

// Disposition: five pills + clear.
function DispositionRow({
  prospectId,
  current,
  onChanged,
}: {
  prospectId: string;
  current: CrmDisposition | null;
  onChanged: (next: CrmDisposition | null) => void;
}) {
  const [saving, setSaving] = useState<CrmDisposition | 'clear' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const set = useCallback(
    async (disposition: CrmDisposition | null) => {
      setSaving(disposition ?? 'clear');
      setErr(null);
      try {
        const res = await fetch(`/api/crm/${prospectId}/disposition`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disposition }),
        });
        const data = (await res.json()) as
          | SetDispositionResponse
          | { ok: false; error?: string };
        if (res.ok && data.ok) {
          onChanged(data.disposition);
        } else {
          setErr('Could not save. Try once more.');
        }
      } catch {
        setErr('Network error.');
      } finally {
        setSaving(null);
      }
    },
    [prospectId, onChanged],
  );

  return (
    <div>
      <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mb-2">
        Where this stands
      </p>
      <div className="flex flex-wrap gap-2">
        {CRM_DISPOSITIONS.map((d) => {
          const active = current === d;
          return (
            <button
              key={d}
              type="button"
              disabled={saving !== null}
              onClick={() => set(active ? null : d)}
              className={
                'font-mono tracking-[0.06em] text-[11px] px-3 py-1 rounded border transition-colors disabled:opacity-50 ' +
                (active
                  ? 'text-gold border-gold/60 bg-gold/[0.1]'
                  : 'text-cream-mute border-cream/15 bg-cream/[0.02] hover:border-gold/30')
              }
            >
              {DISPOSITION_LABEL[d]}
            </button>
          );
        })}
        {current && (
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => set(null)}
            className="font-mono tracking-[0.06em] text-[11px] px-3 py-1 rounded border border-cream/10 text-cream-faint hover:text-red-400 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
      {err && (
        <p className="text-red-400 font-mono text-[11px] tracking-[0.04em] mt-2">
          {err}
        </p>
      )}
    </div>
  );
}

// Follow-up: date+time picker (datetime-local) and clear button.
function FollowUpRow({
  prospectId,
  current,
  onChanged,
}: {
  prospectId: string;
  current: CrmFollowUpRecord | null;
  onChanged: (next: CrmFollowUpRecord | null) => void;
}) {
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!draft) {
      setErr('Pick a date and time first.');
      return;
    }
    const dueAt = new Date(draft);
    if (Number.isNaN(dueAt.getTime())) {
      setErr('That date didn’t parse.');
      return;
    }
    if (dueAt.getTime() <= Date.now()) {
      setErr('Follow-up must be in the future.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/crm/${prospectId}/followup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueAt: dueAt.toISOString() }),
      });
      const data = (await res.json()) as
        | SetFollowUpResponse
        | { ok: false; error?: string };
      if (res.ok && data.ok) {
        onChanged(data.followUp);
        setDraft('');
      } else {
        setErr('Could not save. Try once more.');
      }
    } catch {
      setErr('Network error.');
    } finally {
      setSaving(false);
    }
  }, [prospectId, draft, onChanged]);

  const clear = useCallback(async () => {
    setClearing(true);
    setErr(null);
    try {
      const res = await fetch(`/api/crm/${prospectId}/followup`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        onChanged(null);
      } else {
        setErr('Could not clear. Try once more.');
      }
    } catch {
      setErr('Network error.');
    } finally {
      setClearing(false);
    }
  }, [prospectId, onChanged]);

  return (
    <div>
      <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mb-2">
        Follow-up reminder
      </p>
      {current ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-cream text-[14px]">
            Due {formatDueAt(current.dueAt)}
          </span>
          <button
            type="button"
            disabled={clearing}
            onClick={clear}
            className="font-mono tracking-[0.06em] text-[11px] text-cream-faint hover:text-red-400 disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Clear'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Follow-up date and time"
            title="Follow-up date and time"
            className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
          />
          <Button
            onClick={save}
            disabled={saving || !draft}
            className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto"
          >
            {saving ? 'Saving…' : 'Set reminder'}
          </Button>
        </div>
      )}
      {err && (
        <p className="text-red-400 font-mono text-[11px] tracking-[0.04em] mt-2">
          {err}
        </p>
      )}
    </div>
  );
}

function formatDueAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Notes: append-only textarea + chronological list.
function NotesRow({
  prospectId,
  notes,
  onAdded,
}: {
  prospectId: string;
  notes: CrmNoteRecord[];
  onAdded: (note: CrmNoteRecord) => void;
}) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/crm/${prospectId}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as
        | CreateNoteResponse
        | { ok: false; error?: string };
      if (res.ok && data.ok) {
        onAdded(data.note);
        setDraft('');
      } else {
        setErr('Could not save. Try once more.');
      }
    } catch {
      setErr('Network error.');
    } finally {
      setSaving(false);
    }
  }, [prospectId, draft, onAdded]);

  return (
    <div>
      <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mb-2">
        Private notes
      </p>
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Just for you — what's on your mind about this prospect?"
          className="w-full bg-cream/[0.04] border border-cream/15 rounded px-3 py-2 text-cream font-mono text-[13px] leading-[1.5] placeholder:text-cream-faint resize-y"
        />
        <div className="flex items-center gap-3">
          <Button
            onClick={save}
            disabled={saving || draft.trim().length === 0}
            className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto"
          >
            {saving ? 'Saving…' : 'Add note'}
          </Button>
          {err && (
            <p className="text-red-400 font-mono text-[11px] tracking-[0.04em]">
              {err}
            </p>
          )}
        </div>
      </div>
      {notes.length > 0 && (
        <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto">
          {notes.map((n) => (
            <li
              key={n.noteId}
              className="bg-cream/[0.02] border border-cream/10 rounded px-3 py-2"
            >
              <p className="text-cream text-[13px] leading-[1.55] whitespace-pre-wrap">
                {n.text}
              </p>
              <p className="font-mono text-[10px] text-cream-faint tracking-[0.06em] mt-1">
                {formatDueAt(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Re-invite: button + cooldown countdown. Disabled for unsent drafts (use
// "I sent this" instead) and for enrolled prospects (terminal).
function ReinviteRow({
  prospectId,
  isDraft,
  isTerminal,
  availableAt,
  onReinvited,
}: {
  prospectId: string;
  isDraft: boolean;
  isTerminal: boolean;
  availableAt: string | null;
  onReinvited: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Disabled reasons in priority order.
  let disabledReason: string | null = null;
  if (isTerminal) disabledReason = 'This prospect is enrolled — no re-invite needed.';
  else if (isDraft) disabledReason = 'Mark this draft sent first (button above), then you can re-invite.';
  else if (availableAt) disabledReason = `Available again on ${formatDueAt(availableAt)}.`;

  const send = useCallback(async () => {
    setSending(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch(`/api/crm/${prospectId}/reinvite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as
        | ReinviteResponse
        | { ok: false; error?: string };
      if (res.ok && data.ok) {
        setOk(
          data.fresh
            ? 'Fresh link minted — the previous one had expired.'
            : 'Marked re-sent. Cooldown restarts.',
        );
        onReinvited();
      } else if ('error' in data && data.error === 'cooldown') {
        setErr('Still in 7-day cooldown.');
      } else if ('error' in data && data.error === 'not_yet_sent') {
        setErr('Use "I sent this" first.');
      } else {
        setErr('Could not re-invite. Try once more.');
      }
    } catch {
      setErr('Network error.');
    } finally {
      setSending(false);
    }
  }, [prospectId, onReinvited]);

  return (
    <div>
      <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mb-2">
        Re-invite
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={send}
          disabled={sending || disabledReason !== null}
          className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Re-invite'}
        </Button>
        {disabledReason && (
          <p className="text-cream-faint text-[12px]">{disabledReason}</p>
        )}
      </div>
      {ok && (
        <p className="text-teal font-mono text-[11px] tracking-[0.04em] mt-2">
          {ok}
        </p>
      )}
      {err && (
        <p className="text-red-400 font-mono text-[11px] tracking-[0.04em] mt-2">
          {err}
        </p>
      )}
    </div>
  );
}
