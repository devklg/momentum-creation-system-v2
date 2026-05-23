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

      {/* Two-column: My Invites (main) + side rail (My Sponsor, CRM stub) */}
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
                Notes, follow-up reminders, and tags for each prospect are
                coming here. For now, your invites above are your working list.
              </p>
              <p className="text-cream-faint text-[11px] font-mono tracking-[0.1em] mt-3 uppercase">
                Coming soon
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
}: {
  invite: InviteSummary;
  activity: InvitationActivityEntry[];
  onMarkedSent: (prospectId: string, sentAt: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markErr, setMarkErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    <li className="bg-cream/[0.02] border border-cream/10 rounded-md overflow-hidden">
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
        </div>
      )}
    </li>
  );
}
