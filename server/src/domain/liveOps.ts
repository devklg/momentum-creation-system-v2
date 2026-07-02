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
 * Filter parsing identical to the rest of /admin — `resolveScopedTmagIds`
 * yields the scoped BA set; null means "no narrowing." Filter targets:
 *   - team_magnificent_members  → `tmagId` field
 *   - pool_placements    → `sponsorTmagId` field
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

import { resolveScopedTmagIds } from './adminMetrics.js';
import {
  activeAdminSessionCount,
  activePlacementSubscriberCount,
  eventsInLastMinute,
} from '../services/poolEvents.js';
import { instrumentedGatewayCall, latencyPercentiles } from '../services/gatewayLatency.js';
import type {
  McsAdminDashboardFilter,
  McsAdminFunnelKind,
  McsAdminFunnelResponse,
  McsAdminFunnelStage,
  McsAdminGrowthCard,
  McsAdminGrowthCardsResponse,
  McsAdminLiveGridResponse,
  McsAdminLiveGridSlot,
  McsAdminLiveUsageSample,
  McsTokenState,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'team_magnificent_members';
const COLL_PLACEMENTS = 'tmag_prospect_htank_placements';
const COLL_PROSPECTS = 'tmag_prospects';
const COLL_STEVE = 'tmag_steve_success_interview';
const COLL_ACTIVITY = 'tmag_prospect_invitation_activity';

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * MS_24H;
const MS_30D = 30 * MS_24H;
const GRID_LIMIT = 5000;

interface BaDoc {
  tmagId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  welcomedAt?: string | null;
  deleted?: boolean;
}

interface PlacementDoc {
  prospectId: string;
  sponsorTmagId: string;
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
  sponsorTmagId: string;
  state: McsTokenState;
}

interface MichaelDoc {
  tmagId: string;
  completedAt: string | null;
  status?: string;
}

interface ActivityDoc {
  sponsorTmagId: string;
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
export function getUsageSample(): McsAdminLiveUsageSample {
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
 *   - BAs:           `tmagId` ∈ scopedTmagIds
 *   - placements:    `sponsorTmagId` ∈ scopedTmagIds
 *   - enrollments:   `sponsorTmagId` ∈ scopedTmagIds, flushReason='enrolled'
 */
async function countWindow(
  scopedTmagIds: string[] | null,
  fromIso: string,
  toIso: string,
): Promise<WindowCount> {
  const baScope = scopedTmagIds === null ? {} : { tmagId: { $in: scopedTmagIds } };
  const sponsorScope =
    scopedTmagIds === null ? {} : { sponsorTmagId: { $in: scopedTmagIds } };

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
  window: McsAdminGrowthCard['window'],
  scopedTmagIds: string[] | null,
  windowMs: number,
  now: number,
): Promise<McsAdminGrowthCard> {
  const currentFrom = new Date(now - windowMs).toISOString();
  const currentTo = new Date(now).toISOString();
  const previousFrom = new Date(now - 2 * windowMs).toISOString();
  const previousTo = currentFrom;

  const [current, previous] = await Promise.all([
    countWindow(scopedTmagIds, currentFrom, currentTo),
    countWindow(scopedTmagIds, previousFrom, previousTo),
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
  filter: McsAdminDashboardFilter,
): Promise<McsAdminGrowthCardsResponse> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);
  const now = Date.now();

  const [card24h, card7d, card30d] = await Promise.all([
    buildCard('24h', scopedTmagIds, MS_24H, now),
    buildCard('7d', scopedTmagIds, MS_7D, now),
    buildCard('30d', scopedTmagIds, MS_30D, now),
  ]);

  return {
    appliedFilter: filter,
    generatedAt: new Date(now).toISOString(),
    cards: [card24h, card7d, card30d],
  };
}

/* ─── H.3 · Live grid ─────────────────────────────────────────────── */

function ageBucketOf(ageDays: number): McsAdminLiveGridSlot['ageBucket'] {
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
  filter: McsAdminDashboardFilter,
): Promise<McsAdminLiveGridResponse> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);
  const sponsorScope =
    scopedTmagIds === null ? {} : { sponsorTmagId: { $in: scopedTmagIds } };

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
  const sponsorIds = Array.from(new Set(placements.map((p) => p.sponsorTmagId)));

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
      filter: { tmagId: { $in: sponsorIds } },
      limit: sponsorIds.length,
    }),
  ]);

  const prospectById = new Map(
    (prospectsRes.documents ?? []).map((p) => [p.prospectId, p]),
  );
  const sponsorById = new Map(
    (sponsorsRes.documents ?? []).map((b) => [b.tmagId, b]),
  );

  const now = Date.now();
  const slots: McsAdminLiveGridSlot[] = placements.map((p) => {
    const prospect = prospectById.get(p.prospectId);
    const sponsor = sponsorById.get(p.sponsorTmagId);
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
      sponsorTmagId: p.sponsorTmagId,
      sponsorFullName: sponsor
        ? `${sponsor.firstName} ${sponsor.lastName}`.trim()
        : p.sponsorTmagId,
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
const PROSPECT_STAGES: ReadonlyArray<{ key: McsTokenState; label: string }> = [
  { key: 'minted', label: 'Minted' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'video_started', label: 'Video started' },
  { key: 'video_complete', label: 'Video complete' },
  { key: 'enrolled', label: 'Enrolled' },
];

const PROSPECT_STAGE_ORDER: ReadonlyArray<McsTokenState> = [
  'minted',
  'clicked',
  'video_started',
  'video_quarter',
  'video_half',
  'video_three_quarter',
  'video_complete',
  'enrolled',
];

function stateOrdinal(state: McsTokenState): number {
  const idx = PROSPECT_STAGE_ORDER.indexOf(state);
  return idx === -1 ? -1 : idx;
}

/** Index into PROSPECT_STAGE_ORDER for each funnel stage's threshold. */
const PROSPECT_STAGE_THRESHOLDS = PROSPECT_STAGES.map((s) =>
  PROSPECT_STAGE_ORDER.indexOf(s.key),
);

async function buildProspectFunnel(
  filter: McsAdminDashboardFilter,
): Promise<McsAdminFunnelResponse> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);
  const sponsorScope =
    scopedTmagIds === null ? {} : { sponsorTmagId: { $in: scopedTmagIds } };

  const res = await instrumentedGatewayCall<{ documents: Array<{ state: McsTokenState }> }>(
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
  const stages: McsAdminFunnelStage[] = PROSPECT_STAGES.map((s, i) => ({
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
 * BA-activation funnel — signed_up → welcomed → steve_discovery_done →
 * first_invite_sent → first_video_complete → first_enrollment.
 *
 * Reuses the same source set as `buildBaActivationReport`:
 *   team_magnificent_members  (signup, welcomedAt)
 *   steve_discoveries  (completedAt rows)
 *   invitation_activity (kind 'invitation_sent' / 'video_completed', per-sponsor)
 *   pool_placements    (flushReason='enrolled', per-sponsor)
 *
 * The funnel is a snapshot of the CURRENT BA roster (filtered) — every
 * BA who has reached at least stage X counts toward stage X.
 */
const BA_STAGES = [
  { key: 'signed_up', label: 'Signed up' },
  { key: 'welcomed', label: 'Welcomed' },
  { key: 'steve_discovery_done', label: 'Steve discovery done' },
  { key: 'first_invite_sent', label: 'First invite sent' },
  { key: 'first_video_complete', label: 'First video complete' },
  { key: 'first_enrollment', label: 'First enrollment' },
] as const;

async function buildBaActivationFunnel(
  filter: McsAdminDashboardFilter,
): Promise<McsAdminFunnelResponse> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);

  const baFilter: Record<string, unknown> = { deleted: { $ne: true } };
  if (scopedTmagIds !== null) baFilter.tmagId = { $in: scopedTmagIds };

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
  const baIds = bas.map((b) => b.tmagId);

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

  const [steveRes, activityRes, enrollRes] = await Promise.all([
    instrumentedGatewayCall<{ documents: MichaelDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_STEVE,
      filter: { tmagId: { $in: baIds }, completedAt: { $ne: null } },
      limit: baIds.length,
    }),
    instrumentedGatewayCall<{ documents: ActivityDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_ACTIVITY,
      filter: {
        sponsorTmagId: { $in: baIds },
        kind: { $in: ['invitation_sent', 'video_completed'] },
      },
      limit: 200_000,
    }),
    instrumentedGatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: { sponsorTmagId: { $in: baIds }, flushReason: 'enrolled' },
      limit: 200_000,
    }),
  ]);

  const steveDone = new Set(
    (steveRes.documents ?? [])
      .filter((m) => m.completedAt)
      .map((m) => m.tmagId),
  );

  const firstInvite = new Set<string>();
  const firstVideo = new Set<string>();
  for (const a of activityRes.documents ?? []) {
    if (a.kind === 'invitation_sent') firstInvite.add(a.sponsorTmagId);
    else if (a.kind === 'video_completed') firstVideo.add(a.sponsorTmagId);
  }

  const firstEnroll = new Set(
    (enrollRes.documents ?? [])
      .filter((p) => p.flushedAt)
      .map((p) => p.sponsorTmagId),
  );

  let signedUp = 0;
  let welcomed = 0;
  let steve = 0;
  let invited = 0;
  let videoComplete = 0;
  let enrolled = 0;
  for (const ba of bas) {
    signedUp += 1;
    if (ba.welcomedAt) welcomed += 1;
    if (steveDone.has(ba.tmagId)) steve += 1;
    if (firstInvite.has(ba.tmagId)) invited += 1;
    if (firstVideo.has(ba.tmagId)) videoComplete += 1;
    if (firstEnroll.has(ba.tmagId)) enrolled += 1;
  }

  const counts = [signedUp, welcomed, steve, invited, videoComplete, enrolled];
  const first = counts[0] ?? 0;
  const stages: McsAdminFunnelStage[] = BA_STAGES.map((s, i) => ({
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
  kind: McsAdminFunnelKind,
  filter: McsAdminDashboardFilter,
): Promise<McsAdminFunnelResponse> {
  return kind === 'prospect'
    ? buildProspectFunnel(filter)
    : buildBaActivationFunnel(filter);
}
