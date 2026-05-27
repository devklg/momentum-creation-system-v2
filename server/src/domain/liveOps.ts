/**
 * /admin Live Operations — domain layer (Chat #144, leaves H.1–H.4).
 *
 * Four read-only producers, one per H leaf:
 *
 *   getUsageSample()             H.1 — usage strip snapshot (SSE feeds this)
 *   getGrowthCards(filter)       H.2 — 24h / 7d / 30d growth cards + deltas
 *   getLiveGrid(filter)          H.3 — every active placement slot, age-bucketed
 *   getFunnel(kind, filter)      H.4 — prospect funnel | BA-activation funnel
 *
 * Wire shapes come from `@momentum/shared` (`admin-live-ops.ts`). H-UI
 * and this file share that contract; nothing else.
 *
 * Filter parsing identical to the rest of /admin — `resolveScopedBaIds`
 * yields the scoped BA set; null means "no narrowing." Filter targets:
 *   - brand_ambassadors  → `baId` field
 *   - pool_placements    → `sponsorBaId` field
 *
 * Compliance: H is /admin-only, so the prospect-facing prohibitions
 * (locked-spec 3.10) do not bind here. We surface per-prospect identity
 * on the live grid by design (admin-design H.3). Every request audits
 * via the route layer (J.4 substrate).
 *
 * Performance: at v1 team size every aggregate is sub-millisecond; the
 * usage strip ticks at 1s and reads tiny in-memory structures (zero
 * gateway hits). Growth/grid/funnel each issue 3–4 parallel gateway
 * queries; cheap enough for the foreseeable future. When the team
 * scales we may add a 5–10s cache on the JSON endpoints.
 */

import { resolveScopedBaIds } from './adminMetrics.js';
import {
  activeAdminSessionCount,
  activePlacementSubscriberCount,
  eventsInLastMinute,
} from '../services/poolEvents.js';
import { instrumentedGatewayCall, latencyPercentiles } from '../services/gatewayLatency.js';
import type {
  AdminDashboardFilter,
  AdminFunnelKind,
  AdminFunnelResponse,
  AdminFunnelStage,
  AdminGrowthCard,
  AdminGrowthCardsResponse,
  AdminLiveGridResponse,
  AdminLiveGridSlot,
  AdminLiveUsageSample,
  TokenState,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'brand_ambassadors';
const COLL_PLACEMENTS = 'pool_placements';
const COLL_PROSPECTS = 'prospects';
const COLL_MICHAEL = 'michael_schedules';
const COLL_ACTIVITY = 'invitation_activity';

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * MS_24H;
const MS_30D = 30 * MS_24H;
const GRID_LIMIT = 5000;

interface BaDoc {
  baId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  welcomedAt?: string | null;
  deleted?: boolean;
}

interface PlacementDoc {
  prospectId: string;
  sponsorBaId: string;
  positionNumber: number;
  placedAt: string;
  flushedAt: string | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}

interface ProspectDoc {
  prospectId: string;
  firstName: string;
  lastName: string;
  lastInitial?: string;
  location?: { city?: string; stateOrRegion?: string };
  sponsorBaId: string;
  state: TokenState;
}

interface MichaelDoc {
  baId: string;
  completedAt: string | null;
  status?: string;
}

interface ActivityDoc {
  sponsorBaId: string;
  kind: string;
  at: string;
}

/* ─── H.1 · Usage sample ──────────────────────────────────────────── */

/**
 * Build one usage-strip snapshot. Synchronous in spirit — reads only the
 * in-memory ring buffers in `poolEvents` and `gatewayLatency`. No gateway
 * hits here; called at 1s cadence by the SSE handler.
 *
 * `eventsPerMinute` is the count of placements published in the last 60s.
 * Until a broader event firehose exists (locked-spec doesn't call one
 * out today), placements are the only event stream we have — surfacing
 * them under the contract's `eventsPerMinute` field is the honest call.
 */
export function getUsageSample(): AdminLiveUsageSample {
  const { p50, p95 } = latencyPercentiles();
  return {
    sampledAt: new Date().toISOString(),
    activeDashboardViewers: activePlacementSubscriberCount(),
    activeAdminSessions: activeAdminSessionCount(),
    eventsPerMinute: eventsInLastMinute(),
    gatewayLatencyMsP50: p50,
    gatewayLatencyMsP95: p95,
  };
}

/* ─── H.2 · Growth stat cards ─────────────────────────────────────── */

interface WindowCount {
  basAdded: number;
  prospectsPlaced: number;
  enrollments: number;
}

/**
 * Count one window's worth of activity (BAs created, placements made,
 * enrollments). All three counts are scoped by the filter:
 *   - BAs:           `baId` ∈ scopedBaIds
 *   - placements:    `sponsorBaId` ∈ scopedBaIds
 *   - enrollments:   `sponsorBaId` ∈ scopedBaIds, flushReason='enrolled'
 */
async function countWindow(
  scopedBaIds: string[] | null,
  fromIso: string,
  toIso: string,
): Promise<WindowCount> {
  const baScope = scopedBaIds === null ? {} : { baId: { $in: scopedBaIds } };
  const sponsorScope =
    scopedBaIds === null ? {} : { sponsorBaId: { $in: scopedBaIds } };

  const [basAdded, prospectsPlaced, enrollments] = await Promise.all([
    aggregateCount(COLL_BAS, {
      ...baScope,
      deleted: { $ne: true },
      createdAt: { $gte: fromIso, $lt: toIso },
    }),
    aggregateCount(COLL_PLACEMENTS, {
      ...sponsorScope,
      placedAt: { $gte: fromIso, $lt: toIso },
    }),
    aggregateCount(COLL_PLACEMENTS, {
      ...sponsorScope,
      flushReason: 'enrolled',
      flushedAt: { $gte: fromIso, $lt: toIso },
    }),
  ]);

  return { basAdded, prospectsPlaced, enrollments };
}

async function aggregateCount(
  collection: string,
  match: Record<string, unknown>,
): Promise<number> {
  const result = await instrumentedGatewayCall<{ results?: Array<{ total?: number }> }>(
    'mongodb',
    'aggregate',
    {
      database: MONGO_DB,
      collection,
      pipeline: [{ $match: match }, { $count: 'total' }],
    },
  );
  return result.results?.[0]?.total ?? 0;
}

async function buildCard(
  window: AdminGrowthCard['window'],
  scopedBaIds: string[] | null,
  windowMs: number,
  now: number,
): Promise<AdminGrowthCard> {
  const currentFrom = new Date(now - windowMs).toISOString();
  const currentTo = new Date(now).toISOString();
  const previousFrom = new Date(now - 2 * windowMs).toISOString();
  const previousTo = currentFrom;

  const [current, previous] = await Promise.all([
    countWindow(scopedBaIds, currentFrom, currentTo),
    countWindow(scopedBaIds, previousFrom, previousTo),
  ]);

  return {
    window,
    basAdded: current.basAdded,
    prospectsPlaced: current.prospectsPlaced,
    enrollments: current.enrollments,
    basAddedDelta: current.basAdded - previous.basAdded,
    prospectsPlacedDelta: current.prospectsPlaced - previous.prospectsPlaced,
    enrollmentsDelta: current.enrollments - previous.enrollments,
  };
}

export async function getGrowthCards(
  filter: AdminDashboardFilter,
): Promise<AdminGrowthCardsResponse> {
  const scopedBaIds = await resolveScopedBaIds(filter);
  const now = Date.now();

  const [card24h, card7d, card30d] = await Promise.all([
    buildCard('24h', scopedBaIds, MS_24H, now),
    buildCard('7d', scopedBaIds, MS_7D, now),
    buildCard('30d', scopedBaIds, MS_30D, now),
  ]);

  return {
    appliedFilter: filter,
    generatedAt: new Date(now).toISOString(),
    cards: [card24h, card7d, card30d],
  };
}

/* ─── H.3 · Live grid ─────────────────────────────────────────────── */

function ageBucketOf(ageDays: number): AdminLiveGridSlot['ageBucket'] {
  // Thresholds from the contract: 0–6 fresh, 7–20 warming, 21–41 aging,
  // 42–56 stale. Anything past 56 still buckets as 'stale' (placements
  // older than the 56-day cap should have been flushed already; if one
  // slips through, the strongest color is the right signal).
  if (ageDays <= 6) return 'fresh';
  if (ageDays <= 20) return 'warming';
  if (ageDays <= 41) return 'aging';
  return 'stale';
}

export async function getLiveGrid(
  filter: AdminDashboardFilter,
): Promise<AdminLiveGridResponse> {
  const scopedBaIds = await resolveScopedBaIds(filter);
  const sponsorScope =
    scopedBaIds === null ? {} : { sponsorBaId: { $in: scopedBaIds } };

  const placementsRes = await instrumentedGatewayCall<{ documents: PlacementDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: { ...sponsorScope, flushedAt: null },
      sort: { placedAt: -1 },
      limit: GRID_LIMIT,
    },
  );
  const placements = placementsRes.documents ?? [];

  if (placements.length === 0) {
    return {
      appliedFilter: filter,
      generatedAt: new Date().toISOString(),
      totalActive: 0,
      slots: [],
    };
  }

  const prospectIds = placements.map((p) => p.prospectId);
  const sponsorIds = Array.from(new Set(placements.map((p) => p.sponsorBaId)));

  const [prospectsRes, sponsorsRes] = await Promise.all([
    instrumentedGatewayCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PROSPECTS,
      filter: { prospectId: { $in: prospectIds } },
      limit: prospectIds.length,
    }),
    instrumentedGatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: { baId: { $in: sponsorIds } },
      limit: sponsorIds.length,
    }),
  ]);

  const prospectById = new Map(
    (prospectsRes.documents ?? []).map((p) => [p.prospectId, p]),
  );
  const sponsorById = new Map(
    (sponsorsRes.documents ?? []).map((b) => [b.baId, b]),
  );

  const now = Date.now();
  const slots: AdminLiveGridSlot[] = placements.map((p) => {
    const prospect = prospectById.get(p.prospectId);
    const sponsor = sponsorById.get(p.sponsorBaId);
    const ageDays = Math.max(
      0,
      Math.floor((now - new Date(p.placedAt).getTime()) / MS_24H),
    );
    const lastInitial =
      prospect?.lastInitial ?? prospect?.lastName?.[0] ?? '·';

    return {
      prospectId: p.prospectId,
      positionNumber: p.positionNumber,
      prospectFirstName: prospect?.firstName ?? '—',
      prospectLastInitial: lastInitial,
      prospectCity: prospect?.location?.city ?? '—',
      prospectStateOrRegion: prospect?.location?.stateOrRegion ?? '—',
      sponsorBaId: p.sponsorBaId,
      sponsorFullName: sponsor
        ? `${sponsor.firstName} ${sponsor.lastName}`.trim()
        : p.sponsorBaId,
      placedAt: p.placedAt,
      ageDays,
      ageBucket: ageBucketOf(ageDays),
    };
  });

  return {
    appliedFilter: filter,
    generatedAt: new Date().toISOString(),
    totalActive: slots.length,
    slots,
  };
}

/* ─── H.4 · Conversion funnels ────────────────────────────────────── */

/**
 * Prospect funnel — minted → clicked → video_started → video_complete →
 * enrolled. Each stage is "prospects whose furthest state reached ≥ stage."
 * Since TokenState transitions forward only (and 'expired' is off-rail
 * terminal), counts collapse to "prospects whose current state is in the
 * forward set from stage onward."
 *
 * The 'expired' state is intentionally excluded — a prospect who expired
 * still touched every stage up to where they stopped, but bucketing them
 * cleanly requires their last in-rail state, which prospects.state
 * doesn't preserve. For honest reporting we count only prospects whose
 * current state remains in the funnel rail (matching the same approach
 * the dashboard takes).
 */
const PROSPECT_STAGES: ReadonlyArray<{ key: TokenState; label: string }> = [
  { key: 'minted', label: 'Minted' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'video_started', label: 'Video started' },
  { key: 'video_complete', label: 'Video complete' },
  { key: 'enrolled', label: 'Enrolled' },
];

const PROSPECT_STAGE_ORDER: ReadonlyArray<TokenState> = [
  'minted',
  'clicked',
  'video_started',
  'video_quarter',
  'video_half',
  'video_three_quarter',
  'video_complete',
  'enrolled',
];

function stateOrdinal(state: TokenState): number {
  const idx = PROSPECT_STAGE_ORDER.indexOf(state);
  return idx === -1 ? -1 : idx;
}

/** Index into PROSPECT_STAGE_ORDER for each funnel stage's threshold. */
const PROSPECT_STAGE_THRESHOLDS = PROSPECT_STAGES.map((s) =>
  PROSPECT_STAGE_ORDER.indexOf(s.key),
);

async function buildProspectFunnel(
  filter: AdminDashboardFilter,
): Promise<AdminFunnelResponse> {
  const scopedBaIds = await resolveScopedBaIds(filter);
  const sponsorScope =
    scopedBaIds === null ? {} : { sponsorBaId: { $in: scopedBaIds } };

  const res = await instrumentedGatewayCall<{ documents: Array<{ state: TokenState }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLL_PROSPECTS,
      filter: {
        ...sponsorScope,
        state: { $in: PROSPECT_STAGE_ORDER },
      },
      limit: 200_000,
    },
  );
  const docs = res.documents ?? [];

  const counts = PROSPECT_STAGES.map(() => 0);
  for (const doc of docs) {
    const ord = stateOrdinal(doc.state);
    if (ord < 0) continue;
    // A prospect at state ord contributes to every funnel stage whose
    // threshold ≤ ord (they reached at least that far).
    for (let i = 0; i < PROSPECT_STAGES.length; i++) {
      if (ord >= PROSPECT_STAGE_THRESHOLDS[i]!) counts[i]! += 1;
    }
  }

  const first = counts[0] ?? 0;
  const stages: AdminFunnelStage[] = PROSPECT_STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: counts[i] ?? 0,
    conversionFromStart: first === 0 ? null : (counts[i] ?? 0) / first,
  }));

  return {
    kind: 'prospect',
    appliedFilter: filter,
    generatedAt: new Date().toISOString(),
    stages,
  };
}

/**
 * BA-activation funnel — signed_up → welcomed → michael_done →
 * first_invite_sent → first_video_complete → first_enrollment.
 *
 * Reuses the same source set as `buildBaActivationReport`:
 *   brand_ambassadors  (signup, welcomedAt)
 *   michael_schedules  (status='completed' rows)
 *   invitation_activity (kind 'invitation_sent' / 'video_completed', per-sponsor)
 *   pool_placements    (flushReason='enrolled', per-sponsor)
 *
 * The funnel is a snapshot of the CURRENT BA roster (filtered) — every
 * BA who has reached at least stage X counts toward stage X.
 */
const BA_STAGES = [
  { key: 'signed_up', label: 'Signed up' },
  { key: 'welcomed', label: 'Welcomed' },
  { key: 'michael_done', label: 'Michael done' },
  { key: 'first_invite_sent', label: 'First invite sent' },
  { key: 'first_video_complete', label: 'First video complete' },
  { key: 'first_enrollment', label: 'First enrollment' },
] as const;

async function buildBaActivationFunnel(
  filter: AdminDashboardFilter,
): Promise<AdminFunnelResponse> {
  const scopedBaIds = await resolveScopedBaIds(filter);

  const baFilter: Record<string, unknown> = { deleted: { $ne: true } };
  if (scopedBaIds !== null) baFilter.baId = { $in: scopedBaIds };

  const basRes = await instrumentedGatewayCall<{ documents: BaDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: baFilter,
      limit: 50_000,
    },
  );
  const bas = basRes.documents ?? [];
  const baIds = bas.map((b) => b.baId);

  if (baIds.length === 0) {
    return {
      kind: 'ba_activation',
      appliedFilter: filter,
      generatedAt: new Date().toISOString(),
      stages: BA_STAGES.map((s) => ({
        key: s.key,
        label: s.label,
        count: 0,
        conversionFromStart: null,
      })),
    };
  }

  const [michaelRes, activityRes, enrollRes] = await Promise.all([
    instrumentedGatewayCall<{ documents: MichaelDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_MICHAEL,
      filter: { baId: { $in: baIds }, status: 'completed' },
      limit: baIds.length,
    }),
    instrumentedGatewayCall<{ documents: ActivityDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_ACTIVITY,
      filter: {
        sponsorBaId: { $in: baIds },
        kind: { $in: ['invitation_sent', 'video_completed'] },
      },
      limit: 200_000,
    }),
    instrumentedGatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: { sponsorBaId: { $in: baIds }, flushReason: 'enrolled' },
      limit: 200_000,
    }),
  ]);

  const michaelDone = new Set(
    (michaelRes.documents ?? [])
      .filter((m) => m.completedAt)
      .map((m) => m.baId),
  );

  const firstInvite = new Set<string>();
  const firstVideo = new Set<string>();
  for (const a of activityRes.documents ?? []) {
    if (a.kind === 'invitation_sent') firstInvite.add(a.sponsorBaId);
    else if (a.kind === 'video_completed') firstVideo.add(a.sponsorBaId);
  }

  const firstEnroll = new Set(
    (enrollRes.documents ?? [])
      .filter((p) => p.flushedAt)
      .map((p) => p.sponsorBaId),
  );

  let signedUp = 0;
  let welcomed = 0;
  let michael = 0;
  let invited = 0;
  let videoComplete = 0;
  let enrolled = 0;
  for (const ba of bas) {
    signedUp += 1;
    if (ba.welcomedAt) welcomed += 1;
    if (michaelDone.has(ba.baId)) michael += 1;
    if (firstInvite.has(ba.baId)) invited += 1;
    if (firstVideo.has(ba.baId)) videoComplete += 1;
    if (firstEnroll.has(ba.baId)) enrolled += 1;
  }

  const counts = [signedUp, welcomed, michael, invited, videoComplete, enrolled];
  const first = counts[0] ?? 0;
  const stages: AdminFunnelStage[] = BA_STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: counts[i] ?? 0,
    conversionFromStart: first === 0 ? null : (counts[i] ?? 0) / first,
  }));

  return {
    kind: 'ba_activation',
    appliedFilter: filter,
    generatedAt: new Date().toISOString(),
    stages,
  };
}

export async function getFunnel(
  kind: AdminFunnelKind,
  filter: AdminDashboardFilter,
): Promise<AdminFunnelResponse> {
  return kind === 'prospect'
    ? buildProspectFunnel(filter)
    : buildBaActivationFunnel(filter);
}
