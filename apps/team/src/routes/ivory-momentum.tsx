/**
 * /ivory/momentum — Ivory Prospect Momentum Agent.
 *
 * The post-mint companion to /ivory (the Invitation Agent). Once a BA mints
 * a `source: 'ivory'` invitation, this page is where they watch lifecycle
 * progress, see what to do next, and (on demand) get a short coached
 * follow-up suggestion they can copy, adapt, and send themselves.
 *
 * Read model: GET /api/ivory/momentum returns the BA's Ivory-sourced cohort
 * enriched with each prospect's warm-market context (categories, angle,
 * memory note). Suggestion: POST /api/ivory/momentum/:prospectId/suggest.
 * Both endpoints degrade safely when the LLM is unavailable.
 *
 * `.team` TS6059 convention: wire types are declared locally so this app
 * does not compile packages/shared source through its rootDir. Matches the
 * pattern in ivory.tsx, cockpit.tsx, etc.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// ─── Local wire types (mirror @momentum/shared shapes) ────────────────────

type IvoryCategory =
  | 'family' | 'close_friend' | 'work' | 'church' | 'school'
  | 'neighbor' | 'gym' | 'social' | 'past_colleague' | 'other';

type IvoryAngle =
  | 'do_the_business' | 'make_money' | 'lose_fat' | 'unspecified';

type InvitationSource = 'self' | 'ivory' | 'scriptmaker';

type TokenState =
  | 'minted' | 'clicked'
  | 'video_started' | 'video_quarter' | 'video_half' | 'video_three_quarter'
  | 'video_complete' | 'enrolled' | 'expired';

type ProspectLifecycleStage =
  | 'draft' | 'sent_unopened' | 'clicked'
  | 'video_started' | 'video_25' | 'video_50' | 'video_75'
  | 'watched' | 'callback_requested'
  | 'customer' | 'enrolled' | 'expired' | 'archived';

type ProspectNextActionKind =
  | 'send_invite' | 'call_now' | 'reply_to_callback' | 'follow_up_due'
  | 'send_soft_nudge' | 'ask_if_video_played' | 'reinvite'
  | 'schedule_followup' | 'wait' | 'none';

type CrmDisposition = 'hot' | 'warm' | 'cool' | 'cold' | 'not_interested' | null;

type CallbackIntent = 'callback_now' | 'callback_later' | 'has_questions' | null;

type IvoryMomentumPriorityReason =
  | 'callback_raised' | 'video_watched' | 'follow_up_due'
  | 'video_partial' | 'clicked_no_watch' | 'sent_no_open'
  | 'draft_unsent' | 'expiring_soon' | 'expired_consider_reinvite';

interface ProspectNextAction {
  kind: ProspectNextActionKind;
  label: string;
  reason: string;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  dueAt: string | null;
  scriptKind: string | null;
}

interface ProspectLastSignal {
  kind: string;
  label: string;
  at: string;
}

interface ProspectMomentumCrmSummary {
  disposition: CrmDisposition;
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
  relationshipReason?: string | null;
  lifecycle: ProspectLifecycleStage;
  tokenState: TokenState;
  videoProgressPct: 0 | 25 | 50 | 75 | 100 | null;
  clickedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  expiresAt: string;
  positionNumber: number | null;
  placedAt: string | null;
  latestCallbackIntent: CallbackIntent;
  crm: ProspectMomentumCrmSummary;
  lastSignal: ProspectLastSignal;
  nextAction: ProspectNextAction;
}

interface IvoryMomentumContext {
  ivoryId: string | null;
  categories: IvoryCategory[];
  preferredAngle: IvoryAngle | null;
  memoryNote: string | null;
  relationshipReason: string | null;
}

interface IvoryMomentumRow {
  prospectId: string;
  pmv: ProspectMomentumRow;
  ivory: IvoryMomentumContext;
  priorityReason: IvoryMomentumPriorityReason | null;
}

interface IvoryMomentumCohortCounts {
  total: number;
  draft: number;
  sentUnopened: number;
  clicked: number;
  videoInProgress: number;
  watched: number;
  callbackRaised: number;
  enrolled: number;
  customer: number;
  expired: number;
  archived: number;
}

interface IvoryMomentumViewResponse {
  ok: true;
  generatedAt: string;
  counts: IvoryMomentumCohortCounts;
  focusQueue: IvoryMomentumRow[];
  rows: IvoryMomentumRow[];
}

interface SuggestionResponse {
  ok: true;
  prospectId: string;
  lifecycle: ProspectLifecycleStage;
  coaching: string;
  suggestion: string;
  degraded: boolean;
}

// ─── Display helpers ──────────────────────────────────────────────────────

const LIFECYCLE_LABEL: Record<ProspectLifecycleStage, string> = {
  draft: 'Draft',
  sent_unopened: 'Sent',
  clicked: 'Opened',
  video_started: 'Video started',
  video_25: 'Video 25%',
  video_50: 'Video 50%',
  video_75: 'Video 75%',
  watched: 'Watched',
  callback_requested: 'Callback',
  customer: 'Customer',
  enrolled: 'Enrolled',
  expired: 'Expired',
  archived: 'Archived',
};

const PRIORITY_LABEL: Record<IvoryMomentumPriorityReason, string> = {
  callback_raised: 'Raised a hand',
  video_watched: 'Watched the video',
  follow_up_due: 'Follow-up due',
  video_partial: 'Watching now',
  clicked_no_watch: 'Opened, not watching',
  sent_no_open: 'Sent, not opened',
  draft_unsent: 'Draft, not sent',
  expiring_soon: 'Expiring soon',
  expired_consider_reinvite: 'Expired',
};

const CATEGORY_LABEL: Record<IvoryCategory, string> = {
  family: 'Family',
  close_friend: 'Close friend',
  work: 'Work',
  church: 'Church',
  school: 'School',
  neighbor: 'Neighbor',
  gym: 'Gym',
  social: 'Social',
  past_colleague: 'Past colleague',
  other: 'Other',
};

const ANGLE_LABEL: Record<IvoryAngle, string> = {
  do_the_business: 'Do the business',
  make_money: 'Make money',
  lose_fat: 'Lose fat',
  unspecified: 'Unspecified angle',
};

function fullName(row: IvoryMomentumRow): string {
  return `${row.pmv.firstName} ${row.pmv.lastInitial}.`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function IvoryMomentumPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<IvoryMomentumViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openProspectId, setOpenProspectId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [ask, setAsk] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ivory/momentum', { credentials: 'include' });
      const data = (await res.json()) as
        | IvoryMomentumViewResponse
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError('Could not load Ivory momentum.');
        return;
      }
      setView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const openRow = useCallback((row: IvoryMomentumRow) => {
    setOpenProspectId(row.prospectId);
    setSuggestion(null);
    setAsk('');
  }, []);

  const closeDrawer = useCallback(() => {
    setOpenProspectId(null);
    setSuggestion(null);
    setAsk('');
  }, []);

  const fetchSuggestion = useCallback(async () => {
    if (!openProspectId) return;
    setSuggestionBusy(true);
    try {
      const res = await fetch(
        `/api/ivory/momentum/${encodeURIComponent(openProspectId)}/suggest`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ask: ask.trim() }),
        },
      );
      const data = (await res.json()) as SuggestionResponse | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError('Could not generate a suggestion.');
        return;
      }
      setSuggestion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setSuggestionBusy(false);
    }
  }, [ask, openProspectId]);

  const openRowData = useMemo(
    () => view?.rows.find((row) => row.prospectId === openProspectId) ?? null,
    [openProspectId, view],
  );

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="border-b border-line px-5 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
              Team Magnificent
            </p>
            <h1 className="font-display text-[clamp(32px,5.5vw,56px)] leading-[0.95] text-cream">
              Ivory Momentum Agent
            </h1>
            <p className="mt-2 max-w-xl text-[14px] leading-[1.55] text-cream-mute">
              Every person you invited through Ivory, in one place. The agent
              watches lifecycle signals and surfaces what to do next — you send
              every message manually.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/ivory')}
              className="bg-transparent px-4 py-3 font-mono text-[12px] uppercase tracking-[0.06em] text-cream-mute hover:text-gold"
            >
              Invite someone
            </Button>
            <Button
              onClick={() => navigate('/cockpit')}
              className="bg-transparent px-4 py-3 font-mono text-[12px] uppercase tracking-[0.06em] text-cream-mute hover:text-gold"
            >
              Cockpit
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {error && (
          <div className="mb-5 border border-red-500/30 bg-red-500/5 p-3 font-mono text-[12px] tracking-[0.04em] text-red-300">
            {error}
          </div>
        )}

        {loading && !view && (
          <p className="text-[14px] text-cream-faint">Loading momentum…</p>
        )}

        {view && view.counts.total === 0 && (
          <div className="border border-line bg-cream/[0.025] p-7">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
              Nothing to track yet
            </p>
            <h2 className="mb-3 font-display text-[28px] leading-[1] text-cream">
              Mint your first Ivory invitation
            </h2>
            <p className="mb-5 max-w-xl text-[14px] leading-[1.6] text-cream-mute">
              Once you mint an invitation through Ivory, this page will start
              showing momentum signals — opens, video progress, callbacks — and
              suggest one warm follow-up at a time.
            </p>
            <Button
              onClick={() => navigate('/ivory')}
              className="bg-gold px-6 py-5 font-display text-[15px] tracking-[0.06em] text-ink hover:bg-gold-bright"
            >
              Open Ivory
            </Button>
          </div>
        )}

        {view && view.counts.total > 0 && (
          <>
            <CountsStrip counts={view.counts} />

            <section className="mt-8">
              <SectionHeader
                eyebrow="Focus queue"
                title="Who to call back today"
                intro="Sorted by momentum signal, not by when you sent it. Skip a row if you already worked it."
              />
              {view.focusQueue.length === 0 ? (
                <p className="border border-line bg-cream/[0.025] p-5 text-[14px] text-cream-mute">
                  No live signals right now. Keep sending invitations from /ivory.
                </p>
              ) : (
                <div className="border border-line">
                  {view.focusQueue.map((row) => (
                    <FocusRow key={row.prospectId} row={row} onOpen={openRow} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <SectionHeader
                eyebrow="Full cohort"
                title="Everyone you invited through Ivory"
                intro="Newest first. Click a row to see context and ask the agent for a suggested follow-up."
              />
              <div className="border border-line">
                {view.rows.map((row) => (
                  <CohortRow key={row.prospectId} row={row} onOpen={openRow} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {openRowData && (
        <Drawer
          row={openRowData}
          ask={ask}
          onAskChange={setAsk}
          suggestion={suggestion}
          suggestionBusy={suggestionBusy}
          onFetchSuggestion={fetchSuggestion}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow, title, intro,
}: { eyebrow: string; title: string; intro: string }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-[clamp(24px,3.5vw,36px)] leading-[1] text-cream">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-[1.55] text-cream-mute">
        {intro}
      </p>
    </div>
  );
}

function CountsStrip({ counts }: { counts: IvoryMomentumCohortCounts }) {
  const cells: Array<{ label: string; value: number; tone: 'teal' | 'gold' | 'cream' }> = [
    { label: 'Cohort', value: counts.total, tone: 'cream' },
    { label: 'Callback', value: counts.callbackRaised, tone: 'teal' },
    { label: 'Watched', value: counts.watched, tone: 'gold' },
    { label: 'Watching', value: counts.videoInProgress, tone: 'cream' },
    { label: 'Opened', value: counts.clicked, tone: 'cream' },
    { label: 'Sent', value: counts.sentUnopened, tone: 'cream' },
    { label: 'Draft', value: counts.draft, tone: 'cream' },
    { label: 'Expired', value: counts.expired, tone: 'cream' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="border border-line bg-cream/[0.025] px-4 py-3"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-cream-faint">
            {cell.label}
          </p>
          <p
            className={
              'mt-1 font-display text-[28px] leading-[1] ' +
              (cell.tone === 'teal'
                ? 'text-teal'
                : cell.tone === 'gold'
                  ? 'text-gold'
                  : 'text-cream')
            }
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PriorityChip({ reason }: { reason: IvoryMomentumPriorityReason }) {
  const tone =
    reason === 'callback_raised'
      ? 'border-gold/40 bg-gold/10 text-gold'
      : reason === 'video_watched'
        ? 'border-teal/40 bg-teal/10 text-teal'
        : 'border-line bg-cream/[0.04] text-cream-mute';
  return (
    <span
      className={
        'inline-block border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ' +
        tone
      }
    >
      {PRIORITY_LABEL[reason]}
    </span>
  );
}

function FocusRow({
  row, onOpen,
}: { row: IvoryMomentumRow; onOpen: (r: IvoryMomentumRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="grid w-full grid-cols-[1fr_auto] items-start gap-4 border-b border-line px-5 py-4 text-left last:border-b-0 hover:bg-cream/[0.03]"
    >
      <div>
        <p className="font-display text-[20px] leading-[1.1] text-cream">
          {fullName(row)}
        </p>
        <p className="mt-1 text-[13px] leading-[1.5] text-cream-mute">
          {row.pmv.nextAction.reason}
        </p>
        <p className="mt-2 font-mono text-[11px] tracking-[0.04em] text-cream-faint">
          {row.pmv.lastSignal.label} · {formatRelative(row.pmv.lastSignal.at)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        {row.priorityReason && <PriorityChip reason={row.priorityReason} />}
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
          {row.pmv.nextAction.label}
        </span>
      </div>
    </button>
  );
}

function CohortRow({
  row, onOpen,
}: { row: IvoryMomentumRow; onOpen: (r: IvoryMomentumRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="grid w-full grid-cols-[1fr_120px_140px] items-center gap-4 border-b border-line px-5 py-3 text-left last:border-b-0 hover:bg-cream/[0.03]"
    >
      <div>
        <p className="text-[15px] leading-[1.2] text-cream">{fullName(row)}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
          {row.pmv.lastSignal.label} · {formatRelative(row.pmv.lastSignal.at)}
        </p>
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-teal">
        {LIFECYCLE_LABEL[row.pmv.lifecycle]}
      </span>
      <span className="text-right font-mono text-[11px] uppercase tracking-[0.06em] text-cream-mute">
        {row.pmv.nextAction.label}
      </span>
    </button>
  );
}

function Drawer({
  row, ask, onAskChange,
  suggestion, suggestionBusy, onFetchSuggestion, onClose,
}: {
  row: IvoryMomentumRow;
  ask: string;
  onAskChange: (next: string) => void;
  suggestion: SuggestionResponse | null;
  suggestionBusy: boolean;
  onFetchSuggestion: () => Promise<void>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the suggestion text stays visible.
    }
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-ink/70 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-ink p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
              {LIFECYCLE_LABEL[row.pmv.lifecycle]} · {row.pmv.nextAction.label}
            </p>
            <h2 className="mt-1 font-display text-[28px] leading-[1] text-cream">
              {fullName(row)}
            </h2>
          </div>
          <Button
            onClick={onClose}
            className="bg-transparent px-3 py-2 font-mono text-[12px] uppercase tracking-[0.06em] text-cream-mute hover:text-gold"
          >
            Close
          </Button>
        </div>

        <DrawerSection label="Why this row is up">
          <p className="text-[14px] leading-[1.55] text-cream-mute">
            {row.pmv.nextAction.reason}
          </p>
          <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-cream-faint">
            Last signal: {row.pmv.lastSignal.label} · {formatRelative(row.pmv.lastSignal.at)}
          </p>
        </DrawerSection>

        <DrawerSection label="Relationship context">
          {row.ivory.relationshipReason ? (
            <p className="text-[14px] leading-[1.55] text-cream">
              {row.ivory.relationshipReason}
            </p>
          ) : row.ivory.memoryNote ? (
            <p className="text-[14px] leading-[1.55] text-cream">
              {row.ivory.memoryNote}
            </p>
          ) : (
            <p className="text-[13px] leading-[1.5] text-cream-faint">
              No relationship context was captured for this invite.
            </p>
          )}
          {(row.ivory.categories.length > 0 || row.ivory.preferredAngle) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {row.ivory.preferredAngle && (
                <span className="border border-line bg-cream/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-cream-mute">
                  {ANGLE_LABEL[row.ivory.preferredAngle]}
                </span>
              )}
              {row.ivory.categories.map((cat) => (
                <span
                  key={cat}
                  className="border border-line bg-cream/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-cream-mute"
                >
                  {CATEGORY_LABEL[cat]}
                </span>
              ))}
            </div>
          )}
        </DrawerSection>

        <DrawerSection label="Suggested follow-up">
          <p className="mb-3 text-[13px] leading-[1.5] text-cream-mute">
            Optional — give the agent extra context first (something they said,
            something you remembered). Then ask for a suggestion.
          </p>
          <textarea
            value={ask}
            onChange={(event) => onAskChange(event.target.value)}
            rows={3}
            maxLength={600}
            placeholder="They said they'd watch this weekend…"
            className="w-full resize-y border border-line bg-ink-2 px-3 py-2 text-[13px] leading-[1.5] text-cream placeholder:text-cream/30 focus:border-gold focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void onFetchSuggestion()}
              disabled={suggestionBusy}
              className="bg-gold px-5 py-4 font-display text-[14px] tracking-[0.06em] text-ink hover:bg-gold-bright"
            >
              {suggestionBusy ? 'Thinking…' : suggestion ? 'New suggestion' : 'Suggest a follow-up'}
            </Button>
            {suggestion?.degraded && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-teal">
                Fallback in use
              </span>
            )}
          </div>

          {suggestion && (
            <div className="mt-5 space-y-3">
              <div className="border border-line bg-cream/[0.02] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-teal">
                  Coaching
                </p>
                <p className="mt-1 text-[13px] leading-[1.55] text-cream-mute">
                  {suggestion.coaching}
                </p>
              </div>
              <div className="border border-gold/30 bg-gold/[0.04] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  Suggested message
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.6] text-cream">
                  {suggestion.suggestion}
                </p>
                <Button
                  onClick={() => copy(suggestion.suggestion)}
                  className="mt-3 bg-cream/[0.05] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.06em] text-cream hover:bg-cream/[0.1]"
                >
                  {copied ? 'Copied' : 'Copy message'}
                </Button>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
                Edit before sending. The agent never sends for you.
              </p>
            </div>
          )}
        </DrawerSection>
      </div>
    </div>
  );
}

function DrawerSection({
  label, children,
}: { label: string; children: ReactNode }) {
  return (
    <div className="mb-6 border-t border-line pt-4">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cream-faint">
        {label}
      </p>
      {children}
    </div>
  );
}

export default IvoryMomentumPage;
