/**
 * Admin Core Dashboard — domain layer (locked-spec 4.B, wireframe 4.B,
 * leaves wf_0077–wf_0080).
 *
 * Reads-only against the gateway-backed Mongo collections; this surface
 * never writes (other than the audit-entry the route handler appends per
 * /admin request via the 4.J substrate). The companion route file
 * `routes/admin/dashboard.ts` is the thin Express layer over these.
 *
 * Locked-spec Part 5 — leader detection rule (literal):
 *   leader = (binary-qualified) AND (>= 5 personally enrolled)
 *
 * Binary qualification lives upstream in THREE and is NOT mirrored into
 * `team_magnificent_members` today. Until it is, the system-detected leader set
 * is the empty set — see `LEADER_DETECTION_NOTE`. We intentionally do NOT
 * substitute a heuristic (e.g. "≥5 personally enrolled alone") because the
 * locked rule is AND, not OR, and TASK-134 explicitly forbids inventing
 * one. Kevin-curated leaders will land alongside wireframe 4.C's leader
 * toggle on `team_magnificent_members.kevinTaggedLeader`; until then that set is
 * also empty. The two sets union into `leaders_only`.
 *
 * Compliance: regulated surface (inside .team, Kevin-only via
 * ADMIN_TMAG_IDS), so the locked-spec 3.10 prospect-facing prohibitions do
 * not bind here — CV / cycle / rank math is technically permitted on /admin.
 * The dashboard scope, however, is OPERATIONAL (activity, funnel, queue),
 * not earnings, per TASK-134.
 *
 * Performance: at v1 team size (~41 BAs growing) every aggregate is
 * sub-millisecond. The metrics path issues 6 parallel counts. When the
 * team scales we may want a 30–60s cache; flagged for future.
 */

import { gatewayCall } from '../services/gateway.js';
import type {
  AdminActiveBaRow,
  AdminDashboardFilter,
  AdminDashboardMetrics,
  AdminDrilldownPayload,
  AdminEnrollmentRow,
  AdminLeaderGroupOption,
  AdminProspectInFlowRow,
  AdminQueueMovementRow,
  AdminTrainingRow,
  AdminBaFilterOption,
  TokenState,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'team_magnificent_members';
const COLL_PLACEMENTS = 'pool_placements';
const COLL_FAST_START = 'fast_start_progress';

const MS_24H = 24 * 60 * 60 * 1000;

/**
 * Surfaced verbatim in both the metrics and filter-options responses so
 * Kevin always knows what `leaders_only` currently selects. When binary
 * qualification mirroring lands and/or 4.C ships the curated toggle, this
 * note is updated in lockstep.
 */
export const LEADER_DETECTION_NOTE =
  'Leader = binary-qualified AND ≥5 personally enrolled (locked-spec Part 5). ' +
  'Binary qualification is upstream in THREE and not yet mirrored locally, ' +
  'so the system-detected leader set is currently empty. Kevin-curated ' +
  'leaders are pending wireframe 4.C (leader-tag toggle).';

interface BaDoc {
  tmagId: string;
  firstName: string;
  lastName: string;
  sponsorTmagId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  /** Future field — written by 4.C leader-tag toggle. Treated as false when absent. */
  kevinTaggedLeader?: boolean;
  /** Future field — mirrored from THREE. Treated as false when absent. */
  binaryQualified?: boolean;
}

interface PlacementDoc {
  prospectId: string;
  sponsorTmagId: string;
  positionNumber: number;
  placedAt: string;
  expiresAt: string;
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
  state: TokenState;
  positionNumber: number | null;
  placedAt: string | null;
  expiresAt: string;
}

interface FastStartDoc {
  tmagId: string;
  moduleId: 1 | 2 | 3 | 4 | 5;
  state: 'not_started' | 'in_progress' | 'completed';
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

/**
 * Resolve the set of BA IDs the filter narrows to. Returns null when the
 * filter is unrestricted (matches every BA) so downstream queries can skip
 * adding a `tmagId IN […]` clause.
 *
 * Honors the locked leader rule (Part 5). When binary-qualified mirroring
 * and/or 4.C curated tags land, this function changes shape; callers don't.
 */
export async function resolveScopedTmagIds(filter: AdminDashboardFilter): Promise<string[] | null> {
  if (filter.tmagId) {
    return [filter.tmagId];
  }
  if (filter.leaderGroup === 'all') {
    return null;
  }

  const leaders = await listLeaderTmagIds();
  if (filter.leaderGroup === 'leaders_only') {
    return leaders;
  }
  // non_leaders: complement against the full roster.
  const allBas = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: {},
    limit: 50_000,
  });
  const leaderSet = new Set(leaders);
  return (allBas.documents ?? []).map((b) => b.tmagId).filter((id) => !leaderSet.has(id));
}

/**
 * The current leader set per locked-spec Part 5. Empty until binary
 * qualification is mirrored and/or curated tags ship.
 */
export async function listLeaderTmagIds(): Promise<string[]> {
  const result = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: {
      $or: [
        { kevinTaggedLeader: true },
        { binaryQualified: true },
      ],
    },
    limit: 50_000,
  });
  const candidates = result.documents ?? [];
  if (candidates.length === 0) return [];

  // For the AND half (system-detected): count personally-enrolled BAs per
  // candidate. We don't compute it for kevinTaggedLeader-only rows because
  // the curated tag is a one-sided override per 4.C — Kevin's call stands
  // regardless of personal-enrollment count.
  const out: string[] = [];
  for (const ba of candidates) {
    if (ba.kevinTaggedLeader) {
      out.push(ba.tmagId);
      continue;
    }
    if (ba.binaryQualified) {
      const personalCount = await countMatch(COLL_BAS, { sponsorTmagId: ba.tmagId });
      if (personalCount >= 5) out.push(ba.tmagId);
    }
  }
  return out;
}

/** Aggregate $match + $count helper. Returns 0 on empty pipelines. */
async function countMatch(collection: string, match: Record<string, unknown>): Promise<number> {
  const result = await gatewayCall<{ results?: Array<{ total?: number }> }>(
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

/** wf_0077 — Master metrics row. */
export async function computeAdminDashboardMetrics(
  filter: AdminDashboardFilter,
): Promise<AdminDashboardMetrics> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);
  const baScope = scopedTmagIds === null ? {} : { tmagId: { $in: scopedTmagIds } };
  const sponsorScope = scopedTmagIds === null ? {} : { sponsorTmagId: { $in: scopedTmagIds } };

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - MS_24H).toISOString();

  const [
    totalBaCount,
    activeBaCount,
    prospectsInFlow,
    placements24h,
    flushes24h,
    enrollments24h,
    fastStartCompleteCount,
  ] = await Promise.all([
    countMatch(COLL_BAS, baScope),
    countMatch(COLL_BAS, { ...baScope, lastLoginAt: { $gte: twentyFourHoursAgo } }),
    countMatch(COLL_PLACEMENTS, { ...sponsorScope, flushedAt: null }),
    countMatch(COLL_PLACEMENTS, {
      ...sponsorScope,
      placedAt: { $gte: twentyFourHoursAgo },
    }),
    countMatch(COLL_PLACEMENTS, {
      ...sponsorScope,
      flushedAt: { $gte: twentyFourHoursAgo },
    }),
    countMatch(COLL_PLACEMENTS, {
      ...sponsorScope,
      flushedAt: { $gte: twentyFourHoursAgo },
      flushReason: 'enrolled',
    }),
    countBasWithCompleteFastStart(scopedTmagIds),
  ]);

  const trainingCompletionPct =
    totalBaCount === 0
      ? null
      : Math.round((fastStartCompleteCount / totalBaCount) * 100);

  return {
    activeBaCount,
    totalBaCount,
    prospectsInFlow,
    queueMovement24h: {
      placements: placements24h,
      flushes: flushes24h,
      net: placements24h - flushes24h,
    },
    enrollments24h,
    trainingCompletionPct,
    computedAt: now.toISOString(),
  };
}

/**
 * Count of BAs (scoped) with all five Fast Start modules in `completed`.
 * Pipeline: $match → $group tmagId → $match (count===5) → $count.
 */
async function countBasWithCompleteFastStart(scopedTmagIds: string[] | null): Promise<number> {
  const match: Record<string, unknown> = { state: 'completed' };
  if (scopedTmagIds !== null) {
    match.tmagId = { $in: scopedTmagIds };
  }
  const result = await gatewayCall<{ results?: Array<{ total?: number }> }>(
    'mongodb',
    'aggregate',
    {
      database: MONGO_DB,
      collection: COLL_FAST_START,
      pipeline: [
        { $match: match },
        { $group: { _id: '$tmagId', completed: { $sum: 1 } } },
        { $match: { completed: 5 } },
        { $count: 'total' },
      ],
    },
  );
  return result.results?.[0]?.total ?? 0;
}

/** Populates the wf_0079 filter bar — BAs + leader groups + the honest note. */
export async function getFilterOptions(): Promise<{
  bas: AdminBaFilterOption[];
  leaderGroups: AdminLeaderGroupOption[];
}> {
  const all = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: {},
    sort: { createdAt: -1 },
    limit: 5000,
  });
  const docs = all.documents ?? [];

  const leaderIds = await listLeaderTmagIds();
  const leaderSet = new Set(leaderIds);

  const bas: AdminBaFilterOption[] = docs.map((b) => ({
    tmagId: b.tmagId,
    fullName: `${b.firstName} ${b.lastName}`.trim(),
    isLeader: leaderSet.has(b.tmagId),
  }));

  const totalBas = docs.length;
  const leaderCount = leaderIds.length;
  const leaderGroups: AdminLeaderGroupOption[] = [
    { value: 'all', label: 'All BAs', count: totalBas },
    { value: 'leaders_only', label: 'Leaders only', count: leaderCount },
    { value: 'non_leaders', label: 'Non-leaders', count: totalBas - leaderCount },
  ];

  return { bas, leaderGroups };
}

/* ── wf_0078 — Drilldown ─────────────────────────────────────────── */

const DRILLDOWN_LIMIT = 100;

export async function buildDrilldown(
  tile: AdminDrilldownPayload['tile'],
  filter: AdminDashboardFilter,
): Promise<AdminDrilldownPayload> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);

  switch (tile) {
    case 'active_bas':
      return { tile, rows: await drilldownActiveBas(scopedTmagIds) };
    case 'prospects_in_flow':
      return { tile, rows: await drilldownProspectsInFlow(scopedTmagIds) };
    case 'queue_movement':
      return { tile, rows: await drilldownQueueMovement(scopedTmagIds) };
    case 'enrollments':
      return { tile, rows: await drilldownEnrollments(scopedTmagIds) };
    case 'training':
      return { tile, rows: await drilldownTraining(scopedTmagIds) };
  }
}

async function drilldownActiveBas(scopedTmagIds: string[] | null): Promise<AdminActiveBaRow[]> {
  const twentyFourHoursAgo = new Date(Date.now() - MS_24H).toISOString();
  const filter: Record<string, unknown> = { lastLoginAt: { $gte: twentyFourHoursAgo } };
  if (scopedTmagIds !== null) filter.tmagId = { $in: scopedTmagIds };

  const res = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter,
    sort: { lastLoginAt: -1 },
    limit: DRILLDOWN_LIMIT,
  });
  const bas = res.documents ?? [];

  // For each BA, count their in-flow prospects. Parallel one-shots — cheap
  // at v1 size, easy to swap for a single $group when we cross the line.
  const counts = await Promise.all(
    bas.map((b) =>
      countMatch(COLL_PLACEMENTS, { sponsorTmagId: b.tmagId, flushedAt: null }),
    ),
  );

  return bas.map((b, i) => ({
    tmagId: b.tmagId,
    fullName: `${b.firstName} ${b.lastName}`.trim(),
    lastLoginAt: b.lastLoginAt ?? '',
    prospectsInFlow: counts[i] ?? 0,
  }));
}

async function drilldownProspectsInFlow(
  scopedTmagIds: string[] | null,
): Promise<AdminProspectInFlowRow[]> {
  // In-flow = a placement exists AND it hasn't flushed.
  const placeFilter: Record<string, unknown> = { flushedAt: null };
  if (scopedTmagIds !== null) placeFilter.sponsorTmagId = { $in: scopedTmagIds };

  const placements = await gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_PLACEMENTS,
    filter: placeFilter,
    sort: { placedAt: -1 },
    limit: DRILLDOWN_LIMIT,
  });
  const docs = placements.documents ?? [];
  if (docs.length === 0) return [];

  const prospectIds = docs.map((p) => p.prospectId);
  const sponsorIds = Array.from(new Set(docs.map((p) => p.sponsorTmagId)));

  const [prospects, sponsors] = await Promise.all([
    gatewayCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: 'prospects',
      filter: { prospectId: { $in: prospectIds } },
      limit: prospectIds.length,
    }),
    gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: { tmagId: { $in: sponsorIds } },
      limit: sponsorIds.length,
    }),
  ]);

  const prospectById = new Map((prospects.documents ?? []).map((p) => [p.prospectId, p]));
  const sponsorName = new Map(
    (sponsors.documents ?? []).map((b) => [b.tmagId, `${b.firstName} ${b.lastName}`.trim()]),
  );

  return docs.map((p): AdminProspectInFlowRow => {
    const prospect = prospectById.get(p.prospectId);
    return {
      prospectId: p.prospectId,
      firstName: prospect?.firstName ?? '—',
      lastInitial: prospect?.lastInitial ?? (prospect?.lastName?.[0] ?? '·'),
      city: prospect?.location?.city ?? '—',
      stateOrRegion: prospect?.location?.stateOrRegion ?? '—',
      state: prospect?.state ?? 'minted',
      positionNumber: p.positionNumber,
      sponsorTmagId: p.sponsorTmagId,
      sponsorName: sponsorName.get(p.sponsorTmagId) ?? p.sponsorTmagId,
      placedAt: p.placedAt,
      expiresAt: p.expiresAt,
    };
  });
}

async function drilldownQueueMovement(
  scopedTmagIds: string[] | null,
): Promise<AdminQueueMovementRow[]> {
  const twentyFourHoursAgo = new Date(Date.now() - MS_24H).toISOString();

  const scope: Record<string, unknown> = scopedTmagIds === null
    ? {}
    : { sponsorTmagId: { $in: scopedTmagIds } };

  const [placements, flushes] = await Promise.all([
    gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: { ...scope, placedAt: { $gte: twentyFourHoursAgo } },
      sort: { placedAt: -1 },
      limit: DRILLDOWN_LIMIT,
    }),
    gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PLACEMENTS,
      filter: { ...scope, flushedAt: { $gte: twentyFourHoursAgo } },
      sort: { flushedAt: -1 },
      limit: DRILLDOWN_LIMIT,
    }),
  ]);

  const allDocs = [...(placements.documents ?? []), ...(flushes.documents ?? [])];
  if (allDocs.length === 0) return [];

  const prospectIds = Array.from(new Set(allDocs.map((p) => p.prospectId)));
  const sponsorIds = Array.from(new Set(allDocs.map((p) => p.sponsorTmagId)));

  const [prospects, sponsors] = await Promise.all([
    gatewayCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: 'prospects',
      filter: { prospectId: { $in: prospectIds } },
      limit: prospectIds.length,
    }),
    gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: { tmagId: { $in: sponsorIds } },
      limit: sponsorIds.length,
    }),
  ]);

  const prospectById = new Map((prospects.documents ?? []).map((p) => [p.prospectId, p]));
  const sponsorName = new Map(
    (sponsors.documents ?? []).map((b) => [b.tmagId, `${b.firstName} ${b.lastName}`.trim()]),
  );

  const placementRows: AdminQueueMovementRow[] = (placements.documents ?? []).map((p) => {
    const prospect = prospectById.get(p.prospectId);
    return {
      kind: 'placement',
      prospectId: p.prospectId,
      firstName: prospect?.firstName ?? '—',
      lastInitial: prospect?.lastInitial ?? (prospect?.lastName?.[0] ?? '·'),
      positionNumber: p.positionNumber,
      sponsorTmagId: p.sponsorTmagId,
      sponsorName: sponsorName.get(p.sponsorTmagId) ?? p.sponsorTmagId,
      at: p.placedAt,
      flushReason: null,
    };
  });

  const flushRows: AdminQueueMovementRow[] = (flushes.documents ?? []).map((p) => {
    const prospect = prospectById.get(p.prospectId);
    return {
      kind: 'flush',
      prospectId: p.prospectId,
      firstName: prospect?.firstName ?? '—',
      lastInitial: prospect?.lastInitial ?? (prospect?.lastName?.[0] ?? '·'),
      positionNumber: p.positionNumber,
      sponsorTmagId: p.sponsorTmagId,
      sponsorName: sponsorName.get(p.sponsorTmagId) ?? p.sponsorTmagId,
      at: p.flushedAt ?? p.placedAt,
      flushReason: p.flushReason,
    };
  });

  return [...placementRows, ...flushRows]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, DRILLDOWN_LIMIT);
}

async function drilldownEnrollments(
  scopedTmagIds: string[] | null,
): Promise<AdminEnrollmentRow[]> {
  const twentyFourHoursAgo = new Date(Date.now() - MS_24H).toISOString();
  const filter: Record<string, unknown> = {
    flushedAt: { $gte: twentyFourHoursAgo },
    flushReason: 'enrolled',
  };
  if (scopedTmagIds !== null) filter.sponsorTmagId = { $in: scopedTmagIds };

  const res = await gatewayCall<{ documents: PlacementDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_PLACEMENTS,
    filter,
    sort: { flushedAt: -1 },
    limit: DRILLDOWN_LIMIT,
  });
  const docs = res.documents ?? [];
  if (docs.length === 0) return [];

  const prospectIds = docs.map((p) => p.prospectId);
  const sponsorIds = Array.from(new Set(docs.map((p) => p.sponsorTmagId)));

  const [prospects, sponsors] = await Promise.all([
    gatewayCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: 'prospects',
      filter: { prospectId: { $in: prospectIds } },
      limit: prospectIds.length,
    }),
    gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: { tmagId: { $in: sponsorIds } },
      limit: sponsorIds.length,
    }),
  ]);

  const prospectById = new Map((prospects.documents ?? []).map((p) => [p.prospectId, p]));
  const sponsorName = new Map(
    (sponsors.documents ?? []).map((b) => [b.tmagId, `${b.firstName} ${b.lastName}`.trim()]),
  );

  return docs.map((p): AdminEnrollmentRow => {
    const prospect = prospectById.get(p.prospectId);
    return {
      prospectId: p.prospectId,
      firstName: prospect?.firstName ?? '—',
      lastInitial: prospect?.lastInitial ?? (prospect?.lastName?.[0] ?? '·'),
      positionNumber: p.positionNumber,
      sponsorTmagId: p.sponsorTmagId,
      sponsorName: sponsorName.get(p.sponsorTmagId) ?? p.sponsorTmagId,
      enrolledAt: p.flushedAt ?? p.placedAt,
    };
  });
}

async function drilldownTraining(scopedTmagIds: string[] | null): Promise<AdminTrainingRow[]> {
  const baFilter: Record<string, unknown> = {};
  if (scopedTmagIds !== null) baFilter.tmagId = { $in: scopedTmagIds };

  const bas = await gatewayCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: baFilter,
    sort: { createdAt: -1 },
    limit: DRILLDOWN_LIMIT,
  });
  const baDocs = bas.documents ?? [];
  if (baDocs.length === 0) return [];

  const baIds = baDocs.map((b) => b.tmagId);
  const progress = await gatewayCall<{ documents: FastStartDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_FAST_START,
    filter: { tmagId: { $in: baIds } },
    limit: baIds.length * 5,
  });

  // Reduce progress docs to (modulesCompleted, lastTouchedAt) per BA.
  const stats = new Map<string, { completed: number; lastTouchedAt: string | null }>();
  for (const p of progress.documents ?? []) {
    const cur = stats.get(p.tmagId) ?? { completed: 0, lastTouchedAt: null };
    if (p.state === 'completed') cur.completed += 1;
    const touch = p.updatedAt;
    if (touch && (!cur.lastTouchedAt || touch > cur.lastTouchedAt)) {
      cur.lastTouchedAt = touch;
    }
    stats.set(p.tmagId, cur);
  }

  return baDocs.map((b): AdminTrainingRow => {
    const s = stats.get(b.tmagId) ?? { completed: 0, lastTouchedAt: null };
    return {
      tmagId: b.tmagId,
      fullName: `${b.firstName} ${b.lastName}`.trim(),
      modulesCompleted: s.completed,
      fastStartComplete: s.completed === 5,
      lastTouchedAt: s.lastTouchedAt,
    };
  });
}
