import type {
  McsHoldingTankSnapshot,
  McsKongaInviterLeaderboardEntry,
  McsKongaLaunchProgress,
  McsKongaTeamGenesisNode,
  McsKongaTeamLeaderboardResponse,
  McsKongaTeamSnapshotResponse,
} from '@momentum/shared';
import { MCS_KONGA_CONTRACT_VERSION } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { buildHoldingTankSnapshot } from './holdingTank.js';
import {
  addKongaAttributionToRecent,
  readKongaTelemetry,
} from './kongaTelemetry.js';

const MONGO_DB = 'momentum';
const MEMBERS_COLLECTION = 'team_magnificent_members';
const ACTIVITY_COLLECTION = 'tmag_prospect_invitation_activity';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const ATTESTATIONS_COLLECTION = 'tmag_konga_enrollment_attestations';
const PLACEMENTS_COLLECTION = 'tmag_prospect_htank_placements';
const H72_MS = 72 * 60 * 60 * 1000;
const TEAM_SNAPSHOT_RECENT_LIMIT = 40;
const LEADERBOARD_PLACEMENT_PAGE_SIZE = 1_000;

type Persistence = typeof persistenceCall;

interface MemberFact {
  tmagId: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  deleted?: boolean;
}

interface InviteFact {
  prospectId: string;
  sponsorTmagId: string;
  kind: string;
  at: string;
}

interface ProspectFact {
  prospectId: string;
  firstName: string;
  lastName?: string;
  lastInitial?: string;
  location?: {
    city?: string;
    stateOrRegion?: string;
  };
}

export interface KongaTeamEnrollmentFact {
  sponsorTmagId: string;
  enrolleeTmagId: string;
  joinedAt: string;
  humanAttested: boolean;
  status: string;
}

export interface KongaTeamPlacementAddFact {
  _id?: unknown;
  placementId?: string;
  prospectId?: string;
  sponsorTmagId?: string;
  placedAt?: string;
}

export interface KongaTeamLeaderboardMemberFact {
  tmagId: string;
  firstName: string;
  lastName: string;
  deleted?: boolean;
}

export interface KongaTeamDeps {
  persistence?: Persistence;
  buildPlacementSnapshot?: typeof buildHoldingTankSnapshot;
  addAttribution?: typeof addKongaAttributionToRecent;
  readTelemetry?: typeof readKongaTelemetry;
}

export class KongaTeamError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function validTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lastInitial(lastName: string): string {
  return lastName.trim().charAt(0).toUpperCase();
}

/**
 * Truthful 0/2 -> 1/2 -> 2/2 projection. The upper boundary is inclusive,
 * matching the approved mission-funnel authority. Duplicate attestations for
 * the same enrolled member count once.
 */
export function projectKongaLaunchProgress(
  sponsorTmagId: string,
  signupAt: string,
  enrollments: readonly KongaTeamEnrollmentFact[],
): McsKongaLaunchProgress {
  const signupMs = validTimestamp(signupAt);
  if (signupMs === null) throw new KongaTeamError('invalid_member_created_at');
  const deadlineMs = signupMs + H72_MS;
  const qualifying = enrollments
    .filter((fact) => {
      const joinedMs = validTimestamp(fact.joinedAt);
      return (
        fact.sponsorTmagId === sponsorTmagId &&
        fact.humanAttested === true &&
        fact.status === 'completed' &&
        fact.enrolleeTmagId.trim().length > 0 &&
        joinedMs !== null &&
        joinedMs >= signupMs &&
        joinedMs <= deadlineMs
      );
    })
    .sort((a, b) =>
      a.joinedAt === b.joinedAt
        ? a.enrolleeTmagId.localeCompare(b.enrolleeTmagId)
        : a.joinedAt.localeCompare(b.joinedAt),
    );
  const distinct = new Map<string, KongaTeamEnrollmentFact>();
  for (const fact of qualifying) {
    if (!distinct.has(fact.enrolleeTmagId)) distinct.set(fact.enrolleeTmagId, fact);
  }
  const firstTwo = [...distinct.values()].slice(0, 2);
  const completedCount = Math.min(2, firstTwo.length) as 0 | 1 | 2;
  return {
    signupAt,
    deadlineAt: new Date(deadlineMs).toISOString(),
    completedCount,
    achievedAt: completedCount === 2 ? firstTwo[1]!.joinedAt : null,
    effortBased: true,
  };
}

function normalizedMongoId(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { $oid?: unknown; toString?: () => string };
  if (typeof value.$oid === 'string' && value.$oid.trim()) return value.$oid.trim();
  const rendered = value.toString?.();
  return rendered && rendered !== '[object Object]' ? rendered : null;
}

function placementEventId(fact: KongaTeamPlacementAddFact): string | null {
  const placementId = fact.placementId?.trim();
  return placementId || normalizedMongoId(fact._id);
}

function cursorFingerprint(raw: unknown): string | null {
  const normalized = normalizedMongoId(raw);
  if (!normalized) return null;
  const constructorName =
    raw && typeof raw === 'object'
      ? (raw as { constructor?: { name?: string } }).constructor?.name ?? 'Object'
      : typeof raw;
  return `${constructorName}:${normalized}`;
}

/**
 * Read every canonical placement row with `_id` keyset pagination. The page
 * size bounds one query, never the lifetime result. The initial count is a
 * completeness fence: concurrent mutation or a broken/non-advancing adapter
 * fails closed instead of returning a silently partial leaderboard.
 */
async function readAllLifetimePlacementAdds(
  persistence: Persistence,
): Promise<KongaTeamPlacementAddFact[]> {
  const baseFilter = {
    sponsorTmagId: { $exists: true },
    placedAt: { $exists: true },
  };
  const rows: KongaTeamPlacementAddFact[] = [];
  const seenCursors = new Set<string>();
  let cursor: unknown;
  let hasCursor = false;
  let expectedTotal: number | null = null;

  while (true) {
    const filter = hasCursor
      ? { $and: [baseFilter, { _id: { $gt: cursor } }] }
      : baseFilter;
    const result = await persistence<{
      documents?: KongaTeamPlacementAddFact[];
      count?: number;
    }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: PLACEMENTS_COLLECTION,
      filter,
      projection: {
        _id: 1,
        placementId: 1,
        prospectId: 1,
        sponsorTmagId: 1,
        placedAt: 1,
      },
      sort: { _id: 1 },
      limit: LEADERBOARD_PLACEMENT_PAGE_SIZE,
    });
    if (expectedTotal === null) {
      if (!Number.isSafeInteger(result.count) || result.count! < 0) {
        throw new KongaTeamError('konga_leaderboard_count_missing');
      }
      expectedTotal = result.count!;
    }
    const page = result.documents ?? [];
    if (page.length > LEADERBOARD_PLACEMENT_PAGE_SIZE) {
      throw new KongaTeamError('konga_leaderboard_page_overflow');
    }
    if (page.length === 0) break;

    for (const row of page) {
      const fingerprint = cursorFingerprint(row._id);
      if (!fingerprint) throw new KongaTeamError('konga_leaderboard_cursor_missing');
      if (seenCursors.has(fingerprint)) {
        throw new KongaTeamError('konga_leaderboard_cursor_duplicate');
      }
      seenCursors.add(fingerprint);
      rows.push(row);
    }
    const nextCursor = page.at(-1)!._id;
    const nextFingerprint = cursorFingerprint(nextCursor);
    if (!nextFingerprint || (hasCursor && nextFingerprint === cursorFingerprint(cursor))) {
      throw new KongaTeamError('konga_leaderboard_cursor_not_advanced');
    }
    cursor = nextCursor;
    hasCursor = true;
    if (page.length < LEADERBOARD_PLACEMENT_PAGE_SIZE) break;
  }

  if (rows.length !== expectedTotal) {
    throw new KongaTeamError('konga_leaderboard_incomplete_read');
  }
  return rows;
}

/**
 * Lifetime means every provable persisted placement event, including a real
 * re-entry that received a new placement identity. Duplicate storage rows and
 * conflicted identities are ignored; display names are never grouping keys.
 */
export function projectKongaLifetimeLeaderboard(
  placements: readonly KongaTeamPlacementAddFact[],
  members: readonly KongaTeamLeaderboardMemberFact[],
): McsKongaInviterLeaderboardEntry[] {
  const memberById = new Map(
    members
      .filter((member) => member.deleted !== true)
      .map((member) => [member.tmagId, member]),
  );
  const sponsorByPlacement = new Map<string, string | null>();
  for (const placement of placements) {
    const id = placementEventId(placement);
    const sponsorTmagId = placement.sponsorTmagId?.trim();
    if (!id || !sponsorTmagId || validTimestamp(placement.placedAt ?? '') === null) continue;
    if (!sponsorByPlacement.has(id)) {
      sponsorByPlacement.set(id, sponsorTmagId);
    } else if (sponsorByPlacement.get(id) !== sponsorTmagId) {
      sponsorByPlacement.set(id, null);
    }
  }
  const countBySponsor = new Map<string, number>();
  for (const sponsorTmagId of sponsorByPlacement.values()) {
    if (!sponsorTmagId || !memberById.has(sponsorTmagId)) continue;
    countBySponsor.set(sponsorTmagId, (countBySponsor.get(sponsorTmagId) ?? 0) + 1);
  }
  return [...countBySponsor.entries()]
    .map(([tmagId, addsCount]) => {
      const member = memberById.get(tmagId)!;
      return {
        firstName: member.firstName,
        lastInitial: lastInitial(member.lastName),
        addsCount,
      };
    })
    .sort((a, b) =>
      b.addsCount - a.addsCount ||
      a.firstName.localeCompare(b.firstName) ||
      a.lastInitial.localeCompare(b.lastInitial),
    );
}

async function readMember(tmagId: string, persistence: Persistence): Promise<MemberFact> {
  const result = await persistence<{ documents?: MemberFact[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: MEMBERS_COLLECTION,
    filter: { tmagId, deleted: { $ne: true } },
    limit: 1,
  });
  const member = result.documents?.[0];
  if (!member) throw new KongaTeamError('konga_team_member_not_found');
  return member;
}

async function readGenesis(
  tmagId: string,
  persistence: Persistence,
): Promise<McsKongaTeamGenesisNode | null> {
  const activity = await persistence<{ documents?: InviteFact[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: ACTIVITY_COLLECTION,
    filter: { sponsorTmagId: tmagId, kind: 'invitation_sent' },
    sort: { at: 1 },
    limit: 1,
  });
  const firstInvite = activity.documents?.[0];
  if (!firstInvite) return null;
  if (validTimestamp(firstInvite.at) === null) {
    throw new KongaTeamError('invalid_first_invitation_timestamp');
  }
  const prospectResult = await persistence<{ documents?: ProspectFact[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId: firstInvite.prospectId, sponsorTmagId: tmagId },
    limit: 1,
  });
  const prospect = prospectResult.documents?.[0];
  if (!prospect) throw new KongaTeamError('konga_genesis_prospect_missing');
  return {
    prospectId: prospect.prospectId,
    firstName: prospect.firstName,
    lastInitial:
      prospect.lastInitial?.trim().charAt(0).toUpperCase() ||
      lastInitial(prospect.lastName ?? ''),
    city: prospect.location?.city ?? '',
    stateOrRegion: prospect.location?.stateOrRegion ?? '',
    invitedAt: firstInvite.at,
    positionNumber: null,
    sourceAuthority: 'invitation_activity.invitation_sent',
  };
}

export async function getKongaTeamSnapshot(
  tmagId: string,
  deps: KongaTeamDeps = {},
): Promise<McsKongaTeamSnapshotResponse> {
  const persistence = deps.persistence ?? persistenceCall;
  const member = await readMember(tmagId, persistence);
  const signupMs = validTimestamp(member.createdAt);
  if (signupMs === null) throw new KongaTeamError('invalid_member_created_at');
  const deadlineAt = new Date(signupMs + H72_MS).toISOString();
  const [genesis, enrollments, legacySnapshot, telemetry] = await Promise.all([
    readGenesis(tmagId, persistence),
    persistence<{ documents?: KongaTeamEnrollmentFact[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: ATTESTATIONS_COLLECTION,
      filter: {
        sponsorTmagId: tmagId,
        humanAttested: true,
        status: 'completed',
        joinedAt: { $gte: member.createdAt, $lte: deadlineAt },
      },
      sort: { joinedAt: 1 },
      limit: 10_000,
    }),
    (deps.buildPlacementSnapshot ?? buildHoldingTankSnapshot)(TEAM_SNAPSHOT_RECENT_LIMIT),
    (deps.readTelemetry ?? readKongaTelemetry)(),
  ]);
  const recent = await (deps.addAttribution ?? addKongaAttributionToRecent)(
    (legacySnapshot as McsHoldingTankSnapshot).recent,
  );
  return {
    ok: true,
    contractVersion: MCS_KONGA_CONTRACT_VERSION,
    lens: { head: 'self' },
    head: {
      firstName: member.firstName,
      lastInitial: lastInitial(member.lastName),
    },
    hasFirstInvite: genesis !== null,
    genesis,
    launchProgress: projectKongaLaunchProgress(
      tmagId,
      member.createdAt,
      enrollments.documents ?? [],
    ),
    placementSnapshot: {
      globalMaxPosition: legacySnapshot.globalMaxPosition,
      recent,
      placementsThisWeek: telemetry.placementsThisWeek,
      geoSpreadCount: telemetry.geoSpreadCount,
    },
  };
}

export async function getKongaTeamLeaderboard(
  viewerTmagId: string,
  deps: Pick<KongaTeamDeps, 'persistence'> = {},
): Promise<McsKongaTeamLeaderboardResponse> {
  const persistence = deps.persistence ?? persistenceCall;
  await readMember(viewerTmagId, persistence);
  const placements = await readAllLifetimePlacementAdds(persistence);
  const sponsorIds = [
    ...new Set(
      placements
        .map((placement) => placement.sponsorTmagId?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  let members: KongaTeamLeaderboardMemberFact[] = [];
  if (sponsorIds.length > 0) {
    const memberResult = await persistence<{ documents?: KongaTeamLeaderboardMemberFact[] }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: MEMBERS_COLLECTION,
        filter: { tmagId: { $in: sponsorIds }, deleted: { $ne: true } },
        limit: sponsorIds.length,
      },
    );
    members = memberResult.documents ?? [];
  }
  return {
    ok: true,
    contractVersion: MCS_KONGA_CONTRACT_VERSION,
    visibility: 'members_only',
    period: 'lifetime',
    sourceAuthority: 'tmag_prospect_htank_placements',
    entries: projectKongaLifetimeLeaderboard(placements, members),
  };
}
