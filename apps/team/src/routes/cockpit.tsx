/**
 * /cockpit - Prospect Momentum Viewer.
 *
 * Task 5 rebuilds the first viewport around the Task 4 PMV projection:
 * Focus Queue, Prospect Momentum Table, lifecycle filters, next action, and
 * a CRM-safe row drawer. Existing CRM controls remain BA-scoped server calls.
 *
 * Data:
 *   GET /api/cockpit/summary  -> counts + sponsor card
 *   GET /api/cockpit/pmv      -> focusQueue + PMV rows
 *   GET /api/cockpit/invites  -> invites[] + activityByProspect{}
 *   POST /api/invitations/:id/sent -> "I sent this" for a draft row (reuses
 *                       the spine route; the cockpit just calls it).
 *
 * Compliance (locked-spec 3.10): BA-facing .team surface. Shows funnel
 * status + saved message + CRM controls. No income/placement claims - status
 * is prospect momentum, never earnings. All outreach remains manual BA action.
 *
 * Per .team convention (register.tsx, invitations.tsx):
 * API wire shapes are declared locally rather than imported from
 * @momentum/shared — the shared `src` alias is outside this app's rootDir and
 * importing it trips TS6059 (lesson_team_app_cannot_import_shared_types_ts6059
 * _chat120). Source of truth for these shapes is
 * packages/shared/src/types.ts (InviteSummary / MyInvitesResponse /
 * CockpitSummaryResponse / InviteDisplayStatus / InvitationActivityEntry).
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Megaphone,
  MessageSquareText,
  PlayCircle,
  RefreshCw,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrackRecordCard } from '@/components/cockpit/TrackRecordCard';
import { FollowUpQueue } from '@/components/cockpit/FollowUpQueue';
import { PmvDashboard } from '@/components/cockpit/PmvDashboard';
import { OrientationCard } from '@/components/cockpit/OrientationCard';
import { MichaelRuntimeSupportCard } from '@/components/cockpit/MichaelRuntimeSupportCard';
import { ThreeWayCallWorkspace } from '@/components/cockpit/ThreeWayCallWorkspace';
import {
  SponsorQuickCard,
  type SponsorQuickAccessCard,
  type CockpitSponsorFallback,
} from '@/components/SponsorQuickAccess';
import {
  LaunchCenter,
  type TeamLaunchCenter,
} from '@/components/launch/LaunchCenter';

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
  sponsorTmagId: string;
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
  // Chat #147, seq 23: founder fallback when the immutable sponsor is inactive.
  sponsorFallback: CockpitSponsorFallback | null;
  counts: {
    total: number;
    sent: number;
    watched: number;
    callbacks: number;
    enrolled: number;
  };
}

interface TeamCalendarEvent {
  eventId: string;
  kind: 'webinar';
  title: string;
  scheduledFor: string;
  durationMinutes: number;
  joinUrl: string | null;
}

interface TeamCalendarResponse {
  ok: true;
  generatedAt: string;
  timezone: string | null;
  events: TeamCalendarEvent[];
  threeWayBookings: Array<{
    kind: 'three_way_bookings_pending';
    title: string;
  }>;
}

interface MarkInvitationSentResponse {
  ok: true;
  prospectId: string;
  sentAt: string;
  alreadySent: boolean;
}

interface AuthMeResponse {
  ok: true;
  me: {
    entitlements?: string[];
  };
}

// ── CRM write-side wire shapes (mirror packages/shared/src/types.ts) ─────
// Per .team TS6059 convention: API shapes redeclared locally; the shared
// package remains source-of-truth (see lesson_team_app_cannot_import_shared
// _types_ts6059_chat120). Keep in sync with shared CRM types added Chat #132.

type CrmDisposition =
  | 'new_brand_ambassador'
  | 'new_customer'
  | 'interested'
  | 'not_interested'
  | 'later';

const CRM_DISPOSITIONS: readonly CrmDisposition[] = [
  'new_brand_ambassador',
  'new_customer',
  'interested',
  'later',
  'not_interested',
];

const DISPOSITION_LABEL: Record<CrmDisposition, string> = {
  'new_brand_ambassador': 'New BA',
  'new_customer': 'New customer',
  interested: 'Interested',
  later: 'Later',
  'not_interested': 'Not interested',
};

interface CrmNoteRecord {
  noteId: string;
  prospectId: string;
  sponsorTmagId: string;
  text: string;
  createdAt: string;
}

interface CrmFollowUpRecord {
  prospectId: string;
  sponsorTmagId: string;
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
  editable: {
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    city: string;
    stateOrRegion: string;
    country: string;
  };
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

interface ReinviteScriptResponse {
  ok: true;
  prospectId: string;
  script: string;
}

// ── PMV wire shapes (mirror packages/shared/src/types.ts Task 4 block) ──

type ProspectLifecycleStage =
  | 'draft'
  | 'sent_unopened'
  | 'clicked'
  | 'video_started'
  | 'video_25'
  | 'video_50'
  | 'video_75'
  | 'watched'
  | 'callback_requested'
  | 'customer'
  | 'enrolled'
  | 'expired'
  | 'archived';

type ProspectNextActionKind =
  | 'send_invite'
  | 'call_now'
  | 'reply_to_callback'
  | 'follow_up_due'
  | 'send_soft_nudge'
  | 'ask_if_video_played'
  | 'reinvite'
  | 'schedule_followup'
  | 'wait'
  | 'none';

type ProspectNextActionScriptKind =
  | 'initial_send'
  | 'callback_reply'
  | 'clicked_no_watch'
  | 'partial_watch'
  | 'watched_no_callback'
  | 'reinvite'
  | 'later_reconnect';

interface ProspectNextAction {
  kind: ProspectNextActionKind;
  label: string;
  reason: string;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  dueAt: string | null;
  scriptKind: ProspectNextActionScriptKind | null;
}

type ProspectLastSignalKind =
  | 'created'
  | 'sent'
  | 'opened'
  | 'video_started'
  | 'video_25'
  | 'video_50'
  | 'video_75'
  | 'watched'
  | 'callback_requested'
  | 'customer'
  | 'enrolled'
  | 'expired'
  | 'archived';

interface ProspectLastSignal {
  kind: ProspectLastSignalKind;
  label: string;
  at: string;
}

interface ProspectMomentumCrmSummary {
  disposition: CrmDisposition | null;
  followUpDueAt: string | null;
  followUpIsDue: boolean;
  noteCount: number;
  latestNoteAt: string | null;
}

interface ProspectMomentumRow {
  prospectId: string;
  token: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  source: InvitationSource;
  lifecycle: ProspectLifecycleStage;
  tokenState: TokenState;
  videoProgressPct: 0 | 25 | 50 | 75 | 100 | null;
  clickedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  expiresAt: string;
  positionNumber: number | null;
  placedAt: string | null;
  latestCallbackIntent: CallbackIntent | null;
  crm: ProspectMomentumCrmSummary;
  lastSignal: ProspectLastSignal;
  nextAction: ProspectNextAction;
}

interface ProspectFocusQueueItem {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  lifecycle: ProspectLifecycleStage;
  source: InvitationSource;
  lastSignal: ProspectLastSignal;
  nextAction: ProspectNextAction;
}

interface ProspectMomentumViewerResponse {
  ok: true;
  generatedAt: string;
  focusQueue: ProspectFocusQueueItem[];
  rows: ProspectMomentumRow[];
  lifecycleGaps: string[];
}

// ── Status display config ────────────────────────────────────────────────

const LIFECYCLE_META: Record<
  ProspectLifecycleStage,
  { label: string; tone: 'gold' | 'teal' | 'mute' | 'dim'; group: PmvFilter }
> = {
  draft: { label: 'Draft', tone: 'dim', group: 'needs_action' },
  sent_unopened: { label: 'Sent, unopened', tone: 'mute', group: 'sent' },
  clicked: { label: 'Clicked', tone: 'mute', group: 'watching' },
  video_started: { label: 'Started video', tone: 'teal', group: 'watching' },
  video_25: { label: 'Video 25%', tone: 'teal', group: 'watching' },
  video_50: { label: 'Video 50%', tone: 'teal', group: 'watching' },
  video_75: { label: 'Video 75%', tone: 'teal', group: 'watching' },
  watched: { label: 'Watched', tone: 'teal', group: 'watched' },
  callback_requested: { label: 'Callback', tone: 'gold', group: 'needs_action' },
  customer: { label: 'Customer', tone: 'teal', group: 'closed' },
  enrolled: { label: 'Enrolled', tone: 'teal', group: 'closed' },
  expired: { label: 'Expired', tone: 'dim', group: 'closed' },
  archived: { label: 'Archived', tone: 'dim', group: 'closed' },
};

type PmvFilter =
  | 'all'
  | 'needs_action'
  | 'sent'
  | 'watching'
  | 'watched'
  | 'closed';

const PMV_FILTERS: Array<{ key: PmvFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'needs_action', label: 'Needs action' },
  { key: 'sent', label: 'Sent' },
  { key: 'watching', label: 'Watching' },
  { key: 'watched', label: 'Watched' },
  { key: 'closed', label: 'Closed' },
];

const SOURCE_LABEL: Record<InvitationSource, string> = {
  self: 'You wrote this',
  ivory: 'Prepared with Ivory',
  scriptmaker: 'Prepared from a product video',
};

const SOURCE_SHORT: Record<InvitationSource, string> = {
  self: 'Self',
  ivory: 'Ivory',
  scriptmaker: 'ScriptMaker',
};

const PMV_INTRO_STORAGE_KEY = 'tm_pmv_intro_dismissed_v1';

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

function formatCalendarTime(iso: string, timezone: string | null): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      timeZone: timezone ?? undefined,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── View state ─────────────────────────────────────────────────────────

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      launch: TeamLaunchCenter;
      summary: CockpitSummaryResponse | null;
      pmv: ProspectMomentumViewerResponse | null;
      invites: InviteSummary[];
      activityByProspect: Record<string, InvitationActivityEntry[]>;
      entitlements: string[];
    };

export function CockpitPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [filter, setFilter] = useState<PmvFilter>('all');
  const [threeWayOpen, setThreeWayOpen] = useState(false);
  // When the BA clicks an item in Today's Actions, we record the target
  // prospectId here; InviteRow watches for matches and self-expands. We
  // bump a tick so re-clicking the same id (after a manual collapse) still
  // re-opens — the prop change is what triggers the effect inside the row.
  const [forceExpandedId, setForceExpandedId] = useState<string | null>(null);
  const [showPmvIntro, setShowPmvIntro] = useState(true);

  const load = useCallback(async () => {
    try {
      const [launchRes, meRes] = await Promise.all([
        fetch('/api/cockpit/launch', { credentials: 'include' }),
        fetch('/api/auth/me', { credentials: 'include' }),
      ]);
      if (launchRes.status === 401) {
        navigate('/register');
        return;
      }
      if (!launchRes.ok) {
        setView({ kind: 'error', message: 'Could not load your Launch Center. Try again.' });
        return;
      }
      const launch = (await launchRes.json()) as TeamLaunchCenter;
      const me = meRes.ok ? ((await meRes.json()) as AuthMeResponse) : null;
      const entitlements = me?.me.entitlements ?? [];

      if (launch.steve.phase !== 'complete') {
        setView({
          kind: 'ready',
          launch,
          summary: null,
          pmv: null,
          invites: [],
          activityByProspect: {},
          entitlements,
        });
        return;
      }

      const [summaryRes, pmvRes, invitesRes] = await Promise.all([
        fetch('/api/cockpit/summary', { credentials: 'include' }),
        fetch('/api/cockpit/pmv', { credentials: 'include' }),
        fetch('/api/cockpit/invites', { credentials: 'include' }),
      ]);
      if (
        summaryRes.status === 401 ||
        pmvRes.status === 401 ||
        invitesRes.status === 401
      ) {
        navigate('/register');
        return;
      }
      if (!summaryRes.ok || !pmvRes.ok || !invitesRes.ok) {
        setView({ kind: 'error', message: 'Could not load your PMV. Try again.' });
        return;
      }
      const summary = (await summaryRes.json()) as CockpitSummaryResponse;
      const pmv = (await pmvRes.json()) as ProspectMomentumViewerResponse;
      const invites = (await invitesRes.json()) as MyInvitesResponse;
      setView({
        kind: 'ready',
        launch,
        summary,
        pmv,
        invites: invites.invites,
        activityByProspect: invites.activityByProspect,
        entitlements,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setView({ kind: 'error', message: `Network error: ${msg}` });
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      setShowPmvIntro(localStorage.getItem(PMV_INTRO_STORAGE_KEY) !== 'dismissed');
    } catch {
      setShowPmvIntro(true);
    }
  }, []);

  // Today's Actions click → record target prospectId; InviteRow self-expands
  // on match. Declared here with the other hooks (ABOVE the early returns)
  // so the hook count is stable across loading/error/ready renders — a hook
  // after the early returns changes the count on the ready transition and
  // trips "rendered more hooks than during the previous render" (#141 fix).
  const handlePmvJump = useCallback((prospectId: string) => {
    setForceExpandedId(prospectId);
    // Scroll to the row. The <li> carries id={`invite-${prospectId}`}.
    const el = document.getElementById(`invite-${prospectId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleLaunchNavigate = useCallback((href: string) => {
    navigate(href);
    const hash = href.split('#')[1];
    if (hash) {
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, [navigate]);

  const dismissPmvIntro = useCallback(() => {
    setShowPmvIntro(false);
    try {
      localStorage.setItem(PMV_INTRO_STORAGE_KEY, 'dismissed');
    } catch {
      /* Browser storage may be unavailable; the panel can simply reappear. */
    }
  }, []);

  // Optimistic patch when "I sent this" succeeds, so the row updates without
  // a full reload. The server is the source of truth; this just mirrors it.
  const patchSent = useCallback((prospectId: string, sentAt: string) => {
    setView((prev) => {
      if (prev.kind !== 'ready') return prev;
      if (!prev.summary || !prev.pmv) return prev;
      const nextInvites = prev.invites.map((i) =>
        i.prospectId === prospectId
          ? {
              ...i,
              sentAt,
              status: (i.status === 'draft' ? 'sent' : i.status) as InviteDisplayStatus,
            }
          : i,
      );
      const nextRows = prev.pmv.rows.map((row) =>
        row.prospectId === prospectId
          ? {
              ...row,
              sentAt,
              lifecycle:
                row.lifecycle === 'draft'
                  ? ('sent_unopened' as ProspectLifecycleStage)
                  : row.lifecycle,
            }
          : row,
      );
      return {
        ...prev,
        invites: nextInvites,
        pmv: {
          ...prev.pmv,
          rows: nextRows,
          focusQueue: prev.pmv.focusQueue.filter((q) => q.prospectId !== prospectId),
        },
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
          Loading your Prospect Momentum Viewer...
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
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      </Shell>
    );
  }

  const { launch, summary, pmv, invites, activityByProspect, entitlements } = view;
  if (!summary || !pmv) {
    return (
      <Shell>
        <LaunchCenter launch={launch} onNavigate={handleLaunchNavigate} defaultExpanded />
        <OperationalPmvLocked onNavigate={handleLaunchNavigate} />
      </Shell>
    );
  }

  const inviteByProspect = new Map(invites.map((i) => [i.prospectId, i]));
  const visibleRows = pmv.rows.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'needs_action') return row.nextAction.priority > 0;
    return LIFECYCLE_META[row.lifecycle].group === filter;
  });

  return (
    <Shell>
      {/* PMV owns the top of the cockpit (locked spec E.2: launch guidance is
          a rail, not the hero). Header first, launch rail beneath it. */}
      <div id="pmv" className="tm-command-ribbon mb-6 scroll-mt-8">
        <div>
          <p className="font-mono tracking-[0.22em] text-[11px] text-gold uppercase mb-2">
            Operational PMV
          </p>
          <h2 className="font-display text-[clamp(32px,5vw,54px)] leading-[0.98] text-cream">
            {summary.baFirstName
              ? `${summary.baFirstName}'s Prospect Momentum Viewer`
              : 'Prospect Momentum Viewer'}
          </h2>
        </div>
        <Button
          onClick={() => navigate('/invitations')}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-6 py-5"
        >
          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
          Invite someone
        </Button>
      </div>

      <LaunchCenter launch={launch} onNavigate={handleLaunchNavigate} />

      {showPmvIntro && <PmvIntroPanel onDismiss={dismissPmvIntro} />}

      <PmvDashboard rows={pmv.rows} />

      <FollowUpQueue
        onProspect={handlePmvJump}
        onVmLead={() => navigate('/vm-campaigns')}
      />

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6 items-start">
        <FocusQueue
          queue={pmv.focusQueue}
          onJump={handlePmvJump}
          onInvite={() => navigate('/invitations')}
        />
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <SectionLabel>Prospect Momentum Table</SectionLabel>
              <p className="text-cream-faint text-[13px] leading-[1.5]">
                {visibleRows.length} of {pmv.rows.length} prospects shown.
              </p>
            </div>
            <PmvFilters value={filter} onChange={setFilter} rows={pmv.rows} />
          </div>
          {pmv.rows.length === 0 ? (
            <EmptyInvites onInvite={() => navigate('/invitations')} />
          ) : (
            <div className="space-y-3">
              {visibleRows.map((row) => (
                <InviteRow
                  key={row.prospectId}
                  row={row}
                  invite={inviteByProspect.get(row.prospectId) ?? null}
                  activity={activityByProspect[row.prospectId] ?? []}
                  onMarkedSent={patchSent}
                  forceExpandedId={forceExpandedId}
                  onReinvited={() => {
                    setView({ kind: 'loading' });
                    void load();
                  }}
                />
              ))}
              {visibleRows.length === 0 && (
                <div className="border border-cream/10 rounded-md p-6 text-cream-faint text-[14px]">
                  No prospects match this filter.
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Secondary cockpit surfaces stay below the PMV first viewport. */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">
        <section className="space-y-8">
          <TrackRecordCard invites={invites} />

          <div>
            <SectionLabel>Cockpit modules</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CockpitModuleCard
                icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Prospect CRM"
                title="Open the hub"
                body="All active and historical prospect records in one BA-scoped view."
                action="Open CRM"
                onClick={() => navigate('/crm')}
              />
              <CockpitModuleCard
                icon={<PlayCircle className="h-4 w-4" aria-hidden="true" />}
                eyebrow="PMV"
                title="Work the table"
                body="Focus queue, video progress, callbacks, notes, follow-ups, and row drawers."
                action="Jump to PMV"
                onClick={() => {
                  document.getElementById('pmv')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
              />
              {entitlements.includes('vm_dialer') && (
                <CockpitModuleCard
                  icon={<Megaphone className="h-4 w-4" aria-hidden="true" />}
                  eyebrow="VM Campaigns"
                  title="Prepare a campaign"
                  body="Lead-owner lists, approved message drafts, dry-run status, and engagement counts."
                  action="Open campaigns"
                  onClick={() => navigate('/vm-campaigns')}
                />
              )}
              <CockpitModuleCard
                icon={<MessageSquareText className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Ivory"
                title="Write the next message"
                body="Warm invitation and follow-up language stays editable before you send it."
                action="Open Ivory"
                onClick={() => navigate('/ivory')}
              />
              <CockpitModuleCard
                icon={<PlayCircle className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Product Gallery"
                title="Train the product"
                body="Kevin's editable video gallery for product knowledge and shareable product stories."
                action="Open gallery"
                onClick={() => navigate('/video-library')}
              />
            </div>
          </div>
        </section>

        <aside className="space-y-8">
          <AgentSupportPanel
            onOpenCrm={() => navigate('/crm')}
            onOpenIvory={() => navigate('/ivory')}
            onOpenTraining={() => navigate('/training/fast-start')}
          />
          <div id="michael" className="scroll-mt-8">
            <MichaelRuntimeSupportCard />
          </div>
          <div id="sponsor" className="scroll-mt-8">
            <SectionLabel>My Sponsor</SectionLabel>
            <SponsorCard
              sponsor={summary.sponsor}
              fallback={summary.sponsorFallback}
              onBookThreeWay={() => setThreeWayOpen(true)}
            />
          </div>
          <ThreeWayCallWorkspace open={threeWayOpen} onOpenChange={setThreeWayOpen} />
          <TeamCalendarCard />
          {/* Group orientation scheduler (Chat #147, wireframe §3.6). Self-
              contained: fetches its own data, books/cancels a seat. */}
          <OrientationCard />
          {/* Leader credibility — who leads the system (Chat #147, surface #1) */}
          <div>
            <SectionLabel>Leadership</SectionLabel>
            <button
              type="button"
              onClick={() => navigate('/leadership')}
              className="w-full text-left bg-cream/[0.02] border border-gold/25 rounded-md p-5 hover:border-gold/50 transition-colors"
            >
              <p className="text-cream text-[14px] leading-[1.6]">
                The people leading this team — Kevin &amp; Paul, and why you can
                trust the path.
              </p>
              <p className="font-mono tracking-[0.14em] text-[11px] text-gold uppercase mt-3">
                Meet your leaders →
              </p>
            </button>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function OperationalPmvLocked({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <section
      id="pmv"
      className="scroll-mt-8 border border-cream/10 bg-cream/[0.02] rounded-md p-6 sm:p-8"
    >
      <p className="font-mono tracking-[0.18em] text-[11px] text-cream-mute uppercase mb-3">
        Operational PMV
      </p>
      <h2 className="font-display text-[30px] leading-[1.05] text-cream mb-3">
        Prospect Momentum Viewer unlocks after Steve.
      </h2>
      <p className="text-cream-mute text-[14px] leading-[1.6] max-w-2xl mb-5">
        Your launch steps stay available here. The full PMV, CRM notes, follow-ups,
        and invite activity remain behind the Steve discovery gate.
      </p>
      <Button
        onClick={() => onNavigate('/steve/discovery')}
        className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-6 py-5"
      >
        Open Steve
      </Button>
    </section>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-cream py-14 px-6">
      <div className="max-w-7xl mx-auto">{children}</div>
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

function CockpitModuleCard({
  icon,
  eyebrow,
  title,
  body,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[172px] text-left bg-cream/[0.02] border border-cream/10 rounded-md p-5 hover:border-gold/40 transition-colors"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-gold/30 bg-gold/[0.06] text-gold">
        {icon}
      </span>
      <span className="block font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mt-4">
        {eyebrow}
      </span>
      <span className="block text-cream text-[18px] leading-[1.2] mt-1">
        {title}
      </span>
      <span className="block text-cream-mute text-[13px] leading-[1.5] mt-2">
        {body}
      </span>
      <span className="block font-mono tracking-[0.12em] text-[10px] text-gold uppercase mt-4">
        {action} -&gt;
      </span>
    </button>
  );
}

function AgentSupportPanel({
  onOpenCrm,
  onOpenIvory,
  onOpenTraining,
}: {
  onOpenCrm: () => void;
  onOpenIvory: () => void;
  onOpenTraining: () => void;
}) {
  const actions = [
    {
      label: 'Follow up with the warmest prospect in your CRM.',
      cta: 'Open CRM',
      onClick: onOpenCrm,
    },
    {
      label: 'Prepare one personal invitation with Ivory.',
      cta: 'Open Ivory',
      onClick: onOpenIvory,
    },
    {
      label: 'Keep your Fast Start path moving.',
      cta: 'Open training',
      onClick: onOpenTraining,
    },
  ];

  return (
    <div>
      <SectionLabel>Agent Support</SectionLabel>
      <div className="bg-cream/[0.02] border border-gold/25 rounded-md p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-gold/30 bg-gold/[0.06] text-gold">
            <Bot className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-[24px] leading-none text-cream">
              What should I do next?
            </p>
            <p className="font-mono tracking-[0.08em] text-[10px] text-cream-faint uppercase mt-1">
              Steve + Ivory + Michael
            </p>
          </div>
        </div>
        <ul className="space-y-3">
          {actions.map((action, index) => (
            <li key={action.cta} className="border-t border-cream/10 pt-3 first:border-0 first:pt-0">
              <p className="text-cream-mute text-[13px] leading-[1.5]">
                <span className="text-gold font-mono text-[11px] mr-2">
                  {index + 1}.
                </span>
                {action.label}
              </p>
              <button
                type="button"
                onClick={action.onClick}
                className="font-mono tracking-[0.1em] text-[10px] text-gold uppercase mt-2 hover:underline"
              >
                {action.cta} -&gt;
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PmvIntroPanel({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="mb-8 border border-gold/30 bg-gold/[0.045] rounded-md p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="max-w-3xl">
          <p className="font-mono tracking-[0.2em] text-[10px] text-gold uppercase mb-2">
            PMV orientation
          </p>
          <p className="text-cream text-[16px] leading-[1.65]">
            Your Prospect Momentum Viewer — every person you've invited, exactly
            where they are in their journey, in real time… You own every
            relationship; this keeps the next move in front of you.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="font-mono tracking-[0.12em] text-[10px] text-cream-faint hover:text-gold uppercase shrink-0"
        >
          Collapse
        </button>
      </div>
    </section>
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
        that matters is sending the next one. Everything else follows.
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

function FocusQueue({
  queue,
  onJump,
  onInvite,
}: {
  queue: ProspectFocusQueueItem[];
  onJump: (prospectId: string) => void;
  onInvite: () => void;
}) {
  return (
    <section className="border border-gold/25 bg-gold/[0.04] rounded-md p-5">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <SectionLabel>Focus Queue</SectionLabel>
          <p className="text-cream-faint text-[13px] leading-[1.5]">
            Highest-priority manual actions from the PMV projection.
          </p>
        </div>
        <span className="font-display text-[34px] leading-none text-gold">
          {queue.length}
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="space-y-4">
          <div>
            <p className="font-display text-[24px] leading-[1.1] text-cream">
              Nothing pressing.
            </p>
            <p className="text-gold text-[14px] mt-1">
              Who are you sharing with today?
            </p>
          </div>
          <Button
            onClick={onInvite}
            className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-5 py-4"
          >
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            Invite someone
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {queue.slice(0, 6).map((item) => (
            <li key={item.prospectId}>
              <button
                type="button"
                onClick={() => onJump(item.prospectId)}
                className="w-full text-left border border-cream/10 bg-ink/40 rounded-md px-3 py-3 hover:border-gold/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-cream text-[15px] leading-[1.3] truncate">
                      {item.firstName} {item.lastInitial}.
                    </p>
                    <p className="text-cream-faint text-[12px] leading-[1.4] mt-1">
                      {item.nextAction.label}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.08em] text-gold shrink-0">
                    P{item.nextAction.priority}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LifecycleBadge stage={item.lifecycle} />
                  <span className="font-mono text-[10px] tracking-[0.06em] text-cream-faint">
                    {formatDate(item.lastSignal.at)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PmvFilters({
  value,
  onChange,
  rows,
}: {
  value: PmvFilter;
  onChange: (next: PmvFilter) => void;
  rows: ProspectMomentumRow[];
}) {
  const countFor = (key: PmvFilter) => {
    if (key === 'all') return rows.length;
    if (key === 'needs_action') {
      return rows.filter((row) => row.nextAction.priority > 0).length;
    }
    return rows.filter((row) => LIFECYCLE_META[row.lifecycle].group === key).length;
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Prospect status filters"
    >
      <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.12em] text-cream-faint uppercase">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Filter
      </span>
      {PMV_FILTERS.map((f) => {
        const active = value === f.key;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={
              'min-h-8 rounded border px-3 py-1 font-mono text-[11px] tracking-[0.04em] transition-colors ' +
              (active
                ? 'border-gold/60 bg-gold/[0.1] text-gold'
                : 'border-cream/10 bg-cream/[0.02] text-cream-mute hover:border-gold/35')
            }
          >
            {f.label} <span className="text-cream-faint">{countFor(f.key)}</span>
          </button>
        );
      })}
    </div>
  );
}

function LifecycleBadge({ stage }: { stage: ProspectLifecycleStage }) {
  const meta = LIFECYCLE_META[stage];
  return (
    <span
      className={
        'inline-block font-mono tracking-[0.06em] text-[10px] px-2 py-0.5 rounded border ' +
        toneClass(meta.tone)
      }
    >
      {meta.label}
    </span>
  );
}

function SourcePill({ source }: { source: InvitationSource }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.08em] text-cream-faint uppercase">
      {SOURCE_SHORT[source]}
    </span>
  );
}

function ProgressMeter({ value }: { value: ProspectMomentumRow['videoProgressPct'] }) {
  const pct = value ?? 0;
  return (
    <div className="min-w-[92px]">
      <div className="h-1.5 w-full rounded-full bg-cream/10 overflow-hidden">
        <div
          className="h-full bg-teal transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-cream-faint">
        {value === null ? 'No video' : `${value}%`}
      </p>
    </div>
  );
}

function quickCardFromSummary(
  sponsor: CockpitSummaryResponse['sponsor'],
): SponsorQuickAccessCard | null {
  if (!sponsor) return null;
  return {
    fullName: sponsor.fullName,
    firstName: sponsor.firstName,
    lastInitial: sponsor.lastInitial,
    phone: sponsor.phone,
    bestContactNote: sponsor.phone
      ? 'Best contact: call or text the number on file.'
      : 'Best contact: connect through your next Team Magnificent touchpoint.',
    whenToCall:
      'Call when you are stuck, ready to send your first invitation, or need a quick read before a follow-up.',
  };
}

function SponsorCard({
  sponsor,
  fallback,
  onBookThreeWay,
}: {
  sponsor: CockpitSummaryResponse['sponsor'];
  fallback: CockpitSponsorFallback | null;
  onBookThreeWay: () => void;
}) {
  return (
    <div>
      <SponsorQuickCard
        sponsor={quickCardFromSummary(sponsor)}
        fallback={fallback}
      />
      <Button
        type="button"
        onClick={onBookThreeWay}
        className="mt-4 w-full bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-4 py-4"
      >
        <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
        {sponsor ? 'Book a 3-Way Call' : 'My Availability'}
      </Button>
    </div>
  );
}

function TeamCalendarCard() {
  const [view, setView] = useState<
    | { kind: 'loading' }
    | { kind: 'error' }
    | { kind: 'ready'; data: TeamCalendarResponse }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cockpit/team-calendar', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setView({ kind: 'error' });
          return;
        }
        const data = (await res.json()) as TeamCalendarResponse;
        if (!cancelled) setView({ kind: 'ready', data });
      } catch {
        if (!cancelled) setView({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <SectionLabel>Team Calendar</SectionLabel>
      <div className="bg-cream/[0.02] border border-cream/10 rounded-md p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-teal/30 bg-teal/[0.06] text-teal">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-[24px] leading-none text-cream">
              Upcoming Events
            </p>
            <p className="font-mono tracking-[0.08em] text-[10px] text-cream-faint uppercase mt-1">
              Next 14 days
            </p>
          </div>
        </div>

        {view.kind === 'loading' && (
          <p className="text-cream-faint font-mono text-[12px] tracking-[0.04em]">
            Loading calendar...
          </p>
        )}
        {view.kind === 'error' && (
          <p className="text-red-400 font-mono text-[12px] tracking-[0.04em]">
            Could not load the calendar.
          </p>
        )}
        {view.kind === 'ready' && view.data.events.length === 0 && (
          <p className="text-cream-faint text-[13px] leading-[1.55]">
            No team events are scheduled in the next 14 days.
          </p>
        )}
        {view.kind === 'ready' && view.data.events.length > 0 && (
          <ul className="space-y-3">
            {view.data.events.map((event) => (
              <li
                key={event.eventId}
                className="border border-cream/10 bg-cream/[0.02] rounded p-3"
              >
                <p className="text-cream text-[14px] leading-[1.35]">
                  {event.title}
                </p>
                <p className="font-mono text-[11px] text-cream-faint tracking-[0.04em] mt-1">
                  {formatCalendarTime(event.scheduledFor, view.data.timezone)}
                  {' · '}
                  {event.durationMinutes} min
                </p>
                {event.joinUrl && (
                  <a
                    href={event.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 font-mono tracking-[0.1em] text-[10px] text-teal uppercase hover:underline"
                  >
                    Join link
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        {view.kind === 'ready' && view.data.threeWayBookings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-cream/10">
            <p className="font-mono tracking-[0.12em] text-[10px] text-gold uppercase mb-2">
              3-way calls
            </p>
            <p className="text-cream-faint text-[12px] leading-[1.5]">
              {view.data.threeWayBookings[0]?.title}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InviteRow({
  row,
  invite,
  activity,
  onMarkedSent,
  forceExpandedId,
  onReinvited,
}: {
  row: ProspectMomentumRow;
  invite: InviteSummary | null;
  activity: InvitationActivityEntry[];
  onMarkedSent: (prospectId: string, sentAt: string) => void;
  forceExpandedId: string | null;
  onReinvited: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markErr, setMarkErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Focus Queue click -> parent sets forceExpandedId; we open inline.
  useEffect(() => {
    if (forceExpandedId === row.prospectId) setExpanded(true);
  }, [forceExpandedId, row.prospectId]);

  const inviteUrl = row.token
    ? `https://teammagnificent.com/p/${row.token}`
    : '';

  const handleMarkSent = useCallback(async () => {
    setMarking(true);
    setMarkErr(null);
    try {
      const res = await fetch(`/api/invitations/${row.prospectId}/sent`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as
        | MarkInvitationSentResponse
        | { ok: false; error?: string };
      if (res.ok && data.ok) {
        onMarkedSent(row.prospectId, data.sentAt);
      } else {
        setMarkErr('Could not record that. Try once more.');
      }
    } catch {
      setMarkErr('Network error. Try once more.');
    } finally {
      setMarking(false);
    }
  }, [row.prospectId, onMarkedSent]);

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
    <article
      id={`invite-${row.prospectId}`}
      className="bg-cream/[0.02] border border-cream/10 rounded-md overflow-hidden scroll-mt-6"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-4 hover:bg-cream/[0.025] transition-colors"
        aria-expanded={expanded}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.8fr_0.95fr_1.25fr_40px] gap-4 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-gold shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 text-cream-faint shrink-0" aria-hidden="true" />
              )}
              <p className="text-cream text-[16px] leading-[1.3] truncate">
                {row.firstName} {row.lastInitial}.
                {row.city && (
                  <span className="text-cream-faint text-[14px]">
                    {' '}
                    · {row.city}, {row.stateOrRegion}
                  </span>
                )}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
              <SourcePill source={row.source} />
              {row.positionNumber !== null && (
                <span className="font-mono text-[10px] text-cream-faint tracking-[0.06em]">
                  Position #{row.positionNumber}
                </span>
              )}
              {row.crm.followUpDueAt && (
                <span
                  className={
                    'font-mono text-[10px] tracking-[0.06em] ' +
                    (row.crm.followUpIsDue ? 'text-gold' : 'text-cream-faint')
                  }
                >
                  Follow-up {row.crm.followUpIsDue ? 'due ' : ''}
                  {formatDate(row.crm.followUpDueAt)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LifecycleBadge stage={row.lifecycle} />
            <ProgressMeter value={row.videoProgressPct} />
          </div>

          <div>
            <p className="font-mono text-[10px] tracking-[0.12em] text-cream-faint uppercase">
              Last signal
            </p>
            <p className="text-cream text-[13px] leading-[1.4] mt-1">
              {row.lastSignal.label}
            </p>
            <p className="font-mono text-[10px] tracking-[0.06em] text-cream-faint mt-1">
              {formatDate(row.lastSignal.at)}
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] tracking-[0.12em] text-cream-faint uppercase">
              Next action
            </p>
            <p className="text-cream text-[13px] leading-[1.4] mt-1">
              {row.nextAction.label}
            </p>
            <p className="text-cream-faint text-[12px] leading-[1.4] mt-1 line-clamp-2">
              {row.nextAction.reason}
            </p>
          </div>

          <span className="font-mono text-[10px] tracking-[0.08em] text-gold justify-self-start lg:justify-self-end">
            P{row.nextAction.priority}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-cream/10 px-4 py-4 space-y-4">
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

          {invite?.message && (
            <div>
              <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-1.5">
                Saved message · {SOURCE_LABEL[invite.source]}
              </p>
              <p className="text-cream text-[14px] leading-[1.6] whitespace-pre-wrap">
                {invite.message}
              </p>
            </div>
          )}

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

          {row.sentAt === null && (
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
                {marking ? 'Saving...' : 'I sent this'}
              </Button>
            </div>
          )}

          <CrmPanel
            prospectId={row.prospectId}
            isDraft={row.sentAt === null}
            isTerminal={
              row.lifecycle === 'enrolled' ||
              row.lifecycle === 'customer' ||
              row.lifecycle === 'archived'
            }
            onReinvited={onReinvited}
          />
        </div>
      )}
    </article>
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
        onReinvited={onReinvited}
      />

      <EditRow
        prospectId={prospectId}
        editable={bundle.editable}
        onSaved={onReinvited}
      />

      <DeleteRow prospectId={prospectId} onDeleted={onReinvited} />
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

// Re-invite (Chat #147, seq 23): NO cooldown — the BA decides when to
// re-invite. Disabled only for unsent drafts (use "I sent this" instead) and
// for enrolled prospects (terminal). A "Re-invite script" button surfaces
// ready-to-send copy; it never gates the re-invite.
function ReinviteRow({
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
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Script state.
  const [script, setScript] = useState<string | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptErr, setScriptErr] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);

  // Disabled reasons in priority order (no cooldown — seq 23).
  let disabledReason: string | null = null;
  if (isTerminal) disabledReason = 'This prospect is enrolled — no re-invite needed.';
  else if (isDraft) disabledReason = 'Mark this draft sent first (button above), then you can re-invite.';

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
            : 'Marked re-sent.',
        );
        onReinvited();
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

  const loadScript = useCallback(async () => {
    setScriptLoading(true);
    setScriptErr(null);
    setScriptCopied(false);
    try {
      const res = await fetch(`/api/crm/${prospectId}/reinvite-script`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as
        | ReinviteScriptResponse
        | { ok: false; error?: string };
      if (res.ok && data.ok) {
        setScript(data.script);
      } else {
        setScriptErr('Could not build a script. Try once more.');
      }
    } catch {
      setScriptErr('Network error.');
    } finally {
      setScriptLoading(false);
    }
  }, [prospectId]);

  const copyScript = useCallback(async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    } catch {
      /* clipboard blocked; the BA can select manually */
    }
  }, [script]);

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
        <Button
          onClick={loadScript}
          disabled={scriptLoading}
          className="bg-transparent text-gold border border-gold/40 hover:bg-gold/[0.08] font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto disabled:opacity-50"
        >
          {scriptLoading ? 'Writing…' : script ? 'Refresh script' : 'Re-invite script'}
        </Button>
        {disabledReason && (
          <p className="text-cream-faint text-[12px]">{disabledReason}</p>
        )}
      </div>

      {script && (
        <div className="mt-3 bg-cream/[0.03] border border-gold/20 rounded px-3 py-2.5">
          <p className="text-cream text-[13px] leading-[1.6] whitespace-pre-wrap">
            {script}
          </p>
          <button
            type="button"
            onClick={copyScript}
            className="mt-2 font-mono text-[11px] tracking-[0.06em] text-teal hover:underline"
          >
            {scriptCopied ? 'Copied' : 'Copy script'}
          </button>
        </div>
      )}

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
      {scriptErr && (
        <p className="text-red-400 font-mono text-[11px] tracking-[0.04em] mt-2">
          {scriptErr}
        </p>
      )}
    </div>
  );
}

// Edit: correct a prospect's identity fields (Chat #141). Prefilled from the
// CRM bundle's `editable` block. Sponsor is NOT editable here (locked-spec
// 3.5) and is intentionally absent. A reason (min 8 chars) is required for
// the audit trail; on save the parent reloads so the row shows the new name.
function EditRow({
  prospectId,
  editable,
  onSaved,
}: {
  prospectId: string;
  editable: ProspectCrmBundle['editable'];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(editable.firstName);
  const [lastName, setLastName] = useState(editable.lastName);
  const [phone, setPhone] = useState(editable.phone ?? '');
  const [email, setEmail] = useState(editable.email ?? '');
  const [city, setCity] = useState(editable.city);
  const [stateOrRegion, setStateOrRegion] = useState(editable.stateOrRegion);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reasonOk = reason.trim().length >= 8;

  const save = useCallback(async () => {
    if (!reasonOk) {
      setErr('A short reason (8+ chars) keeps the audit trail honest.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/crm/${prospectId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          city: city.trim(),
          stateOrRegion: stateOrRegion.trim(),
          reason: reason.trim(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (res.ok && data.ok) {
        setOpen(false);
        onSaved();
      } else {
        setErr(
          data.error === 'no_fields'
            ? 'Nothing changed.'
            : 'Could not save. Try once more.',
        );
      }
    } catch {
      setErr('Network error.');
    } finally {
      setSaving(false);
    }
  }, [prospectId, firstName, lastName, phone, email, city, stateOrRegion, reason, reasonOk, onSaved]);

  return (
    <div>
      <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mb-2">
        Edit details
      </p>
      {!open ? (
        <Button
          onClick={() => setOpen(true)}
          className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto"
        >
          Edit
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-label="First name"
              placeholder="First name"
              className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              aria-label="Last name"
              placeholder="Last name"
              className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label="City"
              placeholder="City"
              className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
            />
            <input
              value={stateOrRegion}
              onChange={(e) => setStateOrRegion(e.target.value)}
              aria-label="State or region"
              placeholder="State / region"
              className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-label="Phone"
              placeholder="Phone"
              className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
              placeholder="Email (optional)"
              className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
            />
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for the change"
            placeholder="Reason for the change (min 8 chars)"
            className="w-full bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
          />
          {reason.trim().length > 0 && !reasonOk && (
            <p className="text-cream-faint font-mono text-[11px] tracking-[0.04em]">
              {reason.trim().length}/8 — a few more characters needed before you can save.
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              onClick={save}
              disabled={saving || !reasonOk}
              className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="font-mono tracking-[0.06em] text-[11px] text-cream-faint hover:text-cream disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
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

// Delete: soft-remove a prospect from the BA's pipeline (Chat #141). Two-step
// confirm + required reason. Reversible — only Kevin can restore from /admin
// (restore is admin-only, Chat #141), and the holding-tank position is left
// untouched. On success the parent reloads and the row drops out of the list.
function DeleteRow({
  prospectId,
  onDeleted,
}: {
  prospectId: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reasonOk = reason.trim().length >= 8;

  const remove = useCallback(async () => {
    if (!reasonOk) {
      setErr('A short reason (8+ chars) is required.');
      return;
    }
    setDeleting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/crm/${prospectId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (res.ok && data.ok) {
        onDeleted();
      } else {
        setErr('Could not remove. Try once more.');
      }
    } catch {
      setErr('Network error.');
    } finally {
      setDeleting(false);
    }
  }, [prospectId, reason, reasonOk, onDeleted]);

  return (
    <div className="border-t border-cream/10 pt-4">
      <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mb-2">
        Remove prospect
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="font-mono tracking-[0.06em] text-[11px] text-cream-faint hover:text-red-400"
        >
          Remove from my list
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-cream-mute text-[12px] leading-[1.5]">
            This removes the prospect from your list. It&rsquo;s reversible —
            ask Kevin if you need it back — and their place in the team line
            is left untouched.
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for removing"
            placeholder="Reason (min 8 chars)"
            className="w-full bg-cream/[0.04] border border-cream/15 rounded px-2 py-1 text-cream font-mono text-[13px]"
          />
          {reason.trim().length > 0 && !reasonOk && (
            <p className="text-cream-faint font-mono text-[11px] tracking-[0.04em]">
              {reason.trim().length}/8 — a few more characters needed before you can confirm.
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              onClick={remove}
              disabled={deleting || !reasonOk}
              className="bg-red-500/10 text-red-300 border border-red-400/40 hover:bg-red-500/20 font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto disabled:opacity-50"
            >
              {deleting ? 'Removing…' : 'Confirm remove'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setReason('');
                setErr(null);
              }}
              disabled={deleting}
              className="font-mono tracking-[0.06em] text-[11px] text-cream-faint hover:text-cream disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
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
