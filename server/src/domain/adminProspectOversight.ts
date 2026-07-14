/**
 * /admin Section D · Prospect Oversight — domain layer.
 * (locked-spec 4.D · wireframe 4.D · brief: TASK-admin-d.md)
 *
 * Read-side: directory projection (D.1), detail panel (D.2),
 *   sandbox-preview snapshot (the sponsor-routed URL preview from D.1/D.2
 *   — pure-read synthesis, never fires a real /p/{token} click).
 *
 * Write-side: four BA-requested interventions (D.4):
 *   - move              — change inviting BA on the prospect; preserve position
 *   - reassign_sponsor  — change sponsor of record; preserve position
 *   - manual_flush      — vacate the holding-tank slot early; preserve position
 *   - force_enroll      — mark enrolled even if BA hasn't; preserve position
 *
 * Compliance spine (from TASK-admin-d.md):
 *   - NO prospect scoring, ranking, qualification rating, or AI coaching
 *     anywhere in this surface (D.3 negation).
 *   - Monotonic queue is sacred (locked-spec 3.2): every intervention
 *     preserves positionNumber. Flush sets flushedAt + flushReason on the
 *     placement row; neighboring positions are NEVER renumbered.
 *   - Sponsor immutability (locked-spec 3.5): only an admin reassign-
 *     sponsor / move intervention may change the prospect's sponsorTmagId,
 *     and every such change is audit-logged with before/after/reason.
 *   - Every mutation appends one AuditLogEntry via the 4.J substrate.
 *
 * Reads are read-only; the route layer is responsible for writing the
 * audit entry. Writes here append the audit entry inline (because the
 * mutation surface is what `before` / `after` describe).
 *
 * Ownership boundary: this domain file is owned by Agent D (TASK-admin-d.md
 * file list). It MUST NOT call into other domain files' private functions
 * — only the documented exports. Reuses listLeaderTmagIds from adminMetrics
 * (already exported) for leaderGroup scope resolution; replicates the
 * filter-resolution logic locally because adminMetrics.resolveScopedTmagIds
 * is private to that file.
 */

import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeOperational } from '../services/tieredWrite.js';
import { appendAuditEntry } from './auditLog.js';
import {
  AdminCursorError,
  combineMongoFilters,
  decodeAdminCursor,
  descendingKeysetFilter,
  encodeAdminCursor,
  type AdminPageInfo,
} from './adminPagination.js';
import { listLeaderTmagIds, LEADER_DETECTION_NOTE } from './adminMetrics.js';
import { findProspectById } from './prospects.js';
import { TOKEN_TTL_MS } from './tokens.js';
import { findPlacementByProspectId } from './holdingTank.js';
import { updatePoolPlacementOperational } from './poolPlacementPersistence.js';
import type {
  McsAdminBaFilterOption,
  McsAdminDashboardFilter,
  McsAdminProspectActivityEvent,
  McsAdminProspectActivityEventKind,
  McsAdminProspectAddNoteResponse,
  McsAdminProspectDetail,
  McsAdminProspectDirectoryRow,
  McsAdminProspectForceEnrollRequest,
  McsAdminProspectInterventionKind,
  McsAdminProspectInterventionResponse,
  McsAdminProspectKevinNote,
  McsAdminProspectManualFlushRequest,
  McsAdminProspectMoveRequest,
  McsAdminProspectPresentationStatus,
  McsAdminProspectReassignSponsorRequest,
  McsProspectStatus,
  McsAuditActor,
  McsAuditContext,
  McsCallbackRequestRecord,
  McsInviteTokenRecord,
  McsIsoTimestamp,
  McsPoolPlacement,
  McsProspectRecord,
  McsResolvedTokenPayload,
  McsTokenState,
  McsWebinarReservationRecord,
} from '@momentum/shared';
import { randomUUID } from 'node:crypto';

/* ─── constants ─────────────────────────────────────────────────── */

const MONGO_DB = 'momentum';
const COLL_PROSPECTS = 'tmag_prospects';
const COLL_PLACEMENTS = 'tmag_prospect_htank_placements';
const COLL_BAS = 'team_magnificent_members';
const COLL_TOKENS = 'tmag_prospect_invite_tokens';
const COLL_CALLBACKS = 'tmag_prospect_callback_requests';
const COLL_WEBINARS = 'tmag_prospect_webinar_reservations';
const COLL_NOTES = 'tmag_admin_prospect_notes';
const COLL_WEBINAR_EVENTS = 'tmag_prospect_webinar_events';
const CHROMA_NOTES_COLLECTION = 'mcs_admin_prospect_notes';

/** Follow-up-needed-by threshold (locked-spec follow-up cadence). */
const FOLLOW_UP_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Production-facing /p/{token} URL prefix. Surfaced verbatim in the
 * directory column 5; clicking it in the admin UI opens the sandbox-
 * preview panel rather than navigating to the URL (so no real link-click
 * event ever fires).
 */
const PROSPECT_URL_PREFIX = 'https://teammagnificent.com/p/';

/** Sample webinar copy mirror of preview/p.ts constants (Chat #116). */
const WEBINAR_COPY = {
  dayOfWeek: 'Mondays & Thursdays',
  timeOfDay: '5:00 PM',
  timezone: 'America/Los_Angeles',
};

const DR_DAN_VIDEO_URL = 'https://www.youtube.com/embed/1IZiV7RXdCY';

/* ─── document shapes (private; mirror PERSISTENCE result rows) ─────── */

interface BaDoc {
  tmagId: string;
  firstName: string;
  lastName: string;
  kevinTaggedLeader?: boolean;
  binaryQualified?: boolean;
}

interface ProspectDoc extends McsProspectRecord {
  /** Inviting BA at mint time (sponsorTmagIdAtMint). Optional because legacy
   *  rows predate the field — fall back to sponsorTmagId in projection. */
  sponsorTmagIdAtMint?: string;
  /** Soft-delete lifecycle (Chat #138/#141). Absent === not deleted. */
  deleted?: boolean;
  deletedAt?: string | null;
  deletedReason?: string | null;
}

interface NoteDoc extends McsAdminProspectKevinNote {
  _id?: unknown;
}

/* ─── filter scope ──────────────────────────────────────────────── */

/**
 * Resolve the set of BA IDs the filter narrows to. Mirrors
 * adminMetrics.resolveScopedTmagIds (which is private). Returns null when
 * the filter is unrestricted so downstream queries can omit the
 * sponsorTmagId-in clause.
 */
async function resolveScopedTmagIds(
  filter: McsAdminDashboardFilter,
): Promise<string[] | null> {
  if (filter.tmagId) return [filter.tmagId];
  if (filter.leaderGroup === 'all') return null;

  const leaders = await listLeaderTmagIds();
  if (filter.leaderGroup === 'leaders_only') return leaders;

  const allBas = await persistenceCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: {},
    limit: 50_000,
  });
  const leaderSet = new Set(leaders);
  return (allBas.documents ?? []).map((b) => b.tmagId).filter((id) => !leaderSet.has(id));
}

/* ─── BA name resolver ──────────────────────────────────────────── */

async function loadBaNameMap(): Promise<Map<string, string>> {
  const result = await persistenceCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: {},
    limit: 50_000,
  });
  const map = new Map<string, string>();
  for (const doc of result.documents ?? []) {
    map.set(doc.tmagId, `${doc.firstName} ${doc.lastName}`);
  }
  return map;
}

/* ─── status & derived-field helpers ────────────────────────────── */

export function deriveProspectStatus(
  placement: McsPoolPlacement | null,
): McsProspectStatus {
  if (!placement) return 'pending';
  if (!placement.flushedAt) return 'pending';
  switch (placement.flushReason) {
    case 'enrolled':
      return 'enrolled_iii';
    case 'expired':
      return 'declined';
    case 'archived':
      return 'declined';
    default:
      return 'pending';
  }
}

export function derivePresentationStatus(
  state: McsTokenState,
  hasCallback: boolean,
  hasWebinar: boolean,
): McsAdminProspectPresentationStatus {
  if (state === 'video_complete') {
    if (hasWebinar) return 'webinar_reserved';
    if (hasCallback) return 'callback_requested';
  }
  return state;
}

function daysBetween(fromIso: McsIsoTimestamp, toMs: number): number {
  const fromMs = new Date(fromIso).getTime();
  return Math.floor((toMs - fromMs) / ONE_DAY_MS);
}

function deriveDaysInHoldingTank(
  placement: McsPoolPlacement | null,
  nowMs: number,
): number | null {
  if (!placement) return null;
  if (placement.flushedAt) return null;
  return daysBetween(placement.placedAt, nowMs);
}

function deriveFollowUpNeededBy(
  prospect: McsProspectRecord,
  placement: McsPoolPlacement | null,
): McsIsoTimestamp | null {
  // Terminal states have no follow-up cadence.
  if (prospect.state === 'enrolled' || prospect.state === 'expired') return null;
  // If the placement is flushed, the prospect is off the active follow-up
  // cadence (enrolled / archived / expired).
  if (placement?.flushedAt) return null;
  const anchorIso = prospect.updatedAt || prospect.createdAt;
  const anchorMs = new Date(anchorIso).getTime();
  return new Date(anchorMs + FOLLOW_UP_THRESHOLD_MS).toISOString();
}

function eventKindForState(state: McsTokenState): McsAdminProspectActivityEventKind {
  switch (state) {
    case 'minted':
      return 'token_minted';
    case 'clicked':
      return 'link_clicked';
    case 'video_started':
      return 'video_started';
    case 'video_quarter':
      return 'video_quarter';
    case 'video_half':
      return 'video_half';
    case 'video_three_quarter':
      return 'video_three_quarter';
    case 'video_complete':
      return 'video_complete';
    case 'enrolled':
      return 'enrollment_marked';
    case 'expired':
      return 'flush';
  }
}

function labelForState(state: McsTokenState): string {
  switch (state) {
    case 'minted':
      return 'Token minted';
    case 'clicked':
      return 'Link clicked';
    case 'video_started':
      return 'Video started';
    case 'video_quarter':
      return 'Video 25%';
    case 'video_half':
      return 'Video 50%';
    case 'video_three_quarter':
      return 'Video 75%';
    case 'video_complete':
      return 'Video complete';
    case 'enrolled':
      return 'Enrolled';
    case 'expired':
      return 'Expired';
  }
}

function prospectUrlFor(token: string): string {
  return `${PROSPECT_URL_PREFIX}${token}`;
}

function truncatedToken(token: string): string {
  if (token.length <= 6) return token;
  return `${token.slice(0, 4)}…${token.slice(-2)}`;
}

/* ─── D.1 directory listing ─────────────────────────────────────── */

/**
 * Build the D.1 directory rows. Pure-read; the route handler appends an
 * `admin.prospects.directory.viewed` info-severity audit entry.
 *
 * Sorting: not applied here. The client sorts in-memory on column click
 * (Kevin-scale; rows are dozens to low thousands at v1).
 */
export async function listDirectoryRows(
  filter: McsAdminDashboardFilter,
  nowMs: number = Date.now(),
  selectedProspects?: ProspectDoc[],
): Promise<McsAdminProspectDirectoryRow[]> {
  const scopedTmagIds = await resolveScopedTmagIds(filter);
  const baNames = await loadBaNameMap();

  const prospectFilter: Record<string, unknown> = {};
  if (scopedTmagIds) {
    if (scopedTmagIds.length === 0) return [];
    prospectFilter.sponsorTmagId = { $in: scopedTmagIds };
  }
  const prospectsResult = selectedProspects
    ? { documents: selectedProspects }
    : await persistenceCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
        database: MONGO_DB,
        collection: COLL_PROSPECTS,
        filter: prospectFilter,
        sort: { createdAt: -1, prospectId: -1 },
        limit: 50_000,
      });
  const prospects = prospectsResult.documents ?? [];
  if (prospects.length === 0) return [];

  const prospectIds = prospects.map((p) => p.prospectId);

  const [placements, tokens, callbacks, webinars] = await Promise.all([
    queryByProspectIds<McsPoolPlacement>(COLL_PLACEMENTS, prospectIds),
    queryByProspectIds<McsInviteTokenRecord>(COLL_TOKENS, prospectIds),
    queryByProspectIds<McsCallbackRequestRecord>(COLL_CALLBACKS, prospectIds),
    queryByProspectIds<McsWebinarReservationRecord>(COLL_WEBINARS, prospectIds),
  ]);

  const placementByProspect = indexBy(placements, (p) => p.prospectId);
  const tokenByProspect = latestByProspect(tokens, (t) => t.createdAt);
  const callbackByProspect = latestByProspect(callbacks, (c) => c.createdAt);
  const webinarByProspect = latestByProspect(webinars, (w) => w.createdAt);

  return prospects.map<McsAdminProspectDirectoryRow>((p) => {
    const placement = placementByProspect.get(p.prospectId) ?? null;
    const token = tokenByProspect.get(p.prospectId) ?? null;
    const callback = callbackByProspect.get(p.prospectId) ?? null;
    const webinar = webinarByProspect.get(p.prospectId) ?? null;

    const tokenStr = token?.token ?? '';
    const url = tokenStr ? prospectUrlFor(tokenStr) : '';

    return {
      prospectId: p.prospectId,
      firstName: p.firstName,
      lastName: p.lastName,
      sponsorTmagId: p.sponsorTmagId,
      sponsorName: baNames.get(p.sponsorTmagId) ?? p.sponsorTmagId,
      presentationStatus: derivePresentationStatus(
        p.state,
        !!callback,
        !!webinar,
      ),
      positionNumber: p.positionNumber ?? null,
      prospectUrl: url,
      token: tokenStr,
      firstContactAt: token?.createdAt ?? p.createdAt,
      mostRecentActivity: {
        at: p.updatedAt,
        eventKind: eventKindForState(p.state),
        label: labelForState(p.state),
      },
      daysInHoldingTank: deriveDaysInHoldingTank(placement, nowMs),
      followUpNeededBy: deriveFollowUpNeededBy(p, placement),
      prospectStatus: deriveProspectStatus(placement),
      deleted: p.deleted === true,
    };
  });
}

const PROSPECT_DIRECTORY_SCOPE = 'admin_prospect_directory.v1';

export async function listProspectDirectoryPage(input: {
  filter: McsAdminDashboardFilter;
  pageSize: number;
  cursor?: string;
  nowMs?: number;
}): Promise<{ rows: McsAdminProspectDirectoryRow[]; pageInfo: AdminPageInfo }> {
  const pageSize = Math.max(1, Math.min(100, input.pageSize));
  const scopedTmagIds = await resolveScopedTmagIds(input.filter);
  const baseFilter: Record<string, unknown> = {};
  if (scopedTmagIds) {
    if (scopedTmagIds.length === 0) {
      return { rows: [], pageInfo: { pageSize, hasMore: false, nextCursor: null } };
    }
    baseFilter.sponsorTmagId = { $in: scopedTmagIds };
  }
  const contract = {
    filter: input.filter,
    sort: 'createdAt_desc_prospectId_desc',
  };
  let keyset: Record<string, unknown> = {};
  if (input.cursor) {
    const keys = decodeAdminCursor({
      token: input.cursor,
      scope: PROSPECT_DIRECTORY_SCOPE,
      contract,
      requiredKeys: ['createdAt', 'prospectId'],
    });
    const cursorMatch = await persistenceCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_PROSPECTS,
      filter: combineMongoFilters(baseFilter, {
        createdAt: keys.createdAt,
        prospectId: keys.prospectId,
      }),
      limit: 1,
    });
    if (!cursorMatch.documents?.[0]) throw new AdminCursorError();
    keyset = descendingKeysetFilter(
      'createdAt',
      'prospectId',
      keys.createdAt!,
      keys.prospectId!,
    );
  }

  const result = await persistenceCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_PROSPECTS,
    filter: combineMongoFilters(baseFilter, keyset),
    sort: { createdAt: -1, prospectId: -1 },
    limit: pageSize + 1,
  });
  const docs = result.documents ?? [];
  const hasMore = docs.length > pageSize;
  const selected = hasMore ? docs.slice(0, pageSize) : docs;
  const rows = await listDirectoryRows(input.filter, input.nowMs ?? Date.now(), selected);
  const last = selected[selected.length - 1];
  return {
    rows,
    pageInfo: {
      pageSize,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeAdminCursor({
              scope: PROSPECT_DIRECTORY_SCOPE,
              contract,
              keys: { createdAt: last.createdAt, prospectId: last.prospectId },
            })
          : null,
    },
  };
}

/**
 * The directory's filter-bar options + leader-detection note. Identical
 * shape to /api/admin/dashboard/filters so the same FilterBar component
 * can render either response unchanged.
 */
export async function getDirectoryFilterOptions(): Promise<{
  bas: McsAdminBaFilterOption[];
  leaderGroups: { value: McsAdminDashboardFilter['leaderGroup']; label: string; count: number }[];
  leaderDetectionNote: string;
}> {
  const [allBasResult, leaderIds] = await Promise.all([
    persistenceCall<{ documents: BaDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: COLL_BAS,
      filter: {},
      limit: 50_000,
    }),
    listLeaderTmagIds(),
  ]);
  const leaderSet = new Set(leaderIds);
  const docs = allBasResult.documents ?? [];

  const bas: McsAdminBaFilterOption[] = docs.map((d) => ({
    tmagId: d.tmagId,
    fullName: `${d.firstName} ${d.lastName}`,
    isLeader: leaderSet.has(d.tmagId),
  }));

  return {
    bas,
    leaderGroups: [
      { value: 'all', label: 'All BAs', count: docs.length },
      { value: 'leaders_only', label: 'Leaders only', count: leaderSet.size },
      { value: 'non_leaders', label: 'Non-leaders', count: docs.length - leaderSet.size },
    ],
    leaderDetectionNote: LEADER_DETECTION_NOTE,
  };
}

/* ─── D.2 detail projection ─────────────────────────────────────── */

/**
 * Build the D.2 detail payload. Pure-read; route handler audits.
 * Returns null if prospect not found.
 */
export async function buildDetailPayload(
  prospectId: string,
): Promise<McsAdminProspectDetail | null> {
  const prospect = (await findProspectById(prospectId)) as ProspectDoc | null;
  if (!prospect) return null;

  const [placement, callbacks, webinars, tokens, baNames, notes] = await Promise.all([
    findPlacementByProspectId(prospectId),
    listByProspectId<McsCallbackRequestRecord>(COLL_CALLBACKS, prospectId),
    listByProspectId<McsWebinarReservationRecord>(COLL_WEBINARS, prospectId),
    listByProspectId<McsInviteTokenRecord>(COLL_TOKENS, prospectId),
    loadBaNameMap(),
    listByProspectId<NoteDoc>(COLL_NOTES, prospectId, { createdAt: 1 }),
  ]);

  const callback = pickLatest(callbacks, (c) => c.createdAt);
  const webinar = pickLatest(webinars, (w) => w.createdAt);
  const token = pickLatest(tokens, (t) => t.createdAt);

  const sponsorTmagIdAtMint = prospect.sponsorTmagIdAtMint ?? token?.sponsorTmagId ?? prospect.sponsorTmagId;

  const activity: McsAdminProspectActivityEvent[] = buildActivityTimeline({
    prospect,
    token,
    placement,
    callbacks,
    webinars,
  });

  const enrollment =
    placement?.flushReason === 'enrolled' && placement.flushedAt
      ? {
          markedAt: placement.flushedAt,
          markedByTmagId: prospect.sponsorTmagId,
          // True when the admin issued force_enroll. Detected by looking
          // at the activity timeline for an admin_force_enroll event after
          // the flush. Cheap because activity is already built.
          forceEnrolledByAdmin: activity.some((e) => e.kind === 'admin_force_enroll'),
        }
      : null;

  return {
    prospectId: prospect.prospectId,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    deleted: prospect.deleted === true,
    phone: prospect.phone,
    email: prospect.email,
    location: prospect.location,
    sponsorTmagIdAtMint,
    sponsorTmagIdNow: prospect.sponsorTmagId,
    sponsorNameNow: baNames.get(prospect.sponsorTmagId) ?? prospect.sponsorTmagId,
    positionNumber: prospect.positionNumber ?? null,
    placedAt: prospect.placedAt ?? null,
    state: prospect.state,
    presentationStatus: derivePresentationStatus(
      prospect.state,
      !!callback,
      !!webinar,
    ),
    prospectStatus: deriveProspectStatus(placement),
    token: token
      ? {
          tokenTruncated: truncatedToken(token.token),
          prospectUrl: prospectUrlFor(token.token),
          mintedAt: token.createdAt,
          expiresAt: token.expiresAt,
          currentState: token.state,
        }
      : {
          tokenTruncated: '—',
          prospectUrl: '',
          mintedAt: prospect.createdAt,
          expiresAt: prospect.expiresAt,
          currentState: prospect.state,
        },
    callback: callback
      ? {
          callbackRequestId: callback.callbackRequestId,
          intent: callback.intent,
          submittedAt: callback.createdAt,
        }
      : null,
    webinar: webinar
      ? {
          reservationId: webinar.reservationId,
          eventId: webinar.eventId,
          scheduledFor: webinar.createdAt, // event's scheduledFor isn't denormalized on the reservation; route layer enriches if needed
          reservedAt: webinar.createdAt,
        }
      : null,
    enrollment,
    activity,
    kevinNotes: notes.map<McsAdminProspectKevinNote>((n) => ({
      noteId: n.noteId,
      prospectId: n.prospectId,
      body: n.body,
      createdAt: n.createdAt,
      createdByTmagId: n.createdByTmagId,
      createdByDisplayName: n.createdByDisplayName,
    })),
  };
}

/**
 * Build the activity timeline from canonical persisted artifacts.
 * The audit log is the source of truth for admin actions, but to keep
 * the route handler simple at v1 we surface admin actions by querying
 * audit_log scoped to this prospect — done in the route layer (not here)
 * so the route can audit-log its own read AND fold in the admin actions
 * in one place. This function returns the non-admin (system) timeline.
 *
 * The route layer merges in admin events from the audit log before
 * returning to the client.
 */
function buildActivityTimeline(input: {
  prospect: ProspectDoc;
  token: McsInviteTokenRecord | null;
  placement: McsPoolPlacement | null;
  callbacks: McsCallbackRequestRecord[];
  webinars: McsWebinarReservationRecord[];
}): McsAdminProspectActivityEvent[] {
  const events: McsAdminProspectActivityEvent[] = [];

  // 1. Token mint
  if (input.token) {
    events.push({
      eventId: `mint_${input.token.token}`,
      at: input.token.createdAt,
      kind: 'token_minted',
      label: 'Invite token minted',
      ip: null,
      referrer: null,
      details: { sponsorTmagIdAtMint: input.token.sponsorTmagId },
    });
  } else {
    events.push({
      eventId: `mint_${input.prospect.prospectId}`,
      at: input.prospect.createdAt,
      kind: 'token_minted',
      label: 'Prospect record created (token row missing)',
      ip: null,
      referrer: null,
      details: null,
    });
  }

  // 2. Link clicked (if token.clickedAt is set)
  if (input.token?.clickedAt) {
    events.push({
      eventId: `click_${input.token.token}`,
      at: input.token.clickedAt,
      kind: 'link_clicked',
      // IP and referrer are NOT persisted today; flagged in
      // claude-notes-admin-d.md as a known gap. Surface null so the
      // detail panel doesn't lie.
      label: 'Link clicked',
      ip: null,
      referrer: null,
      details: null,
    });
  }

  // 3. Video milestones — we don't store per-event video timestamps;
  //    only the highest reached state on the prospect. Surface a single
  //    consolidated event for the current state if it's a video state.
  if (
    input.prospect.state.startsWith('video_') &&
    input.prospect.state !== 'video_complete'
  ) {
    events.push({
      eventId: `videostate_${input.prospect.prospectId}_${input.prospect.state}`,
      at: input.prospect.updatedAt,
      kind: eventKindForState(input.prospect.state),
      label: labelForState(input.prospect.state),
      ip: null,
      referrer: null,
      details: null,
    });
  }

  // 4. Placement (only when placedAt is set)
  if (input.placement && input.placement.placedAt) {
    events.push({
      eventId: `placement_${input.placement.prospectId}`,
      at: input.placement.placedAt,
      kind: 'placement',
      label: `Placed at position #${input.placement.positionNumber}`,
      ip: null,
      referrer: null,
      details: {
        positionNumber: input.placement.positionNumber,
        sponsorTmagId: input.placement.sponsorTmagId,
      },
    });
  }

  // 5. Callback requests (multi)
  for (const cb of input.callbacks) {
    events.push({
      eventId: `callback_${cb.callbackRequestId}`,
      at: cb.createdAt,
      kind: 'callback_requested',
      label: `Callback request submitted (${cb.intent})`,
      ip: null,
      referrer: null,
      details: { intent: cb.intent, smsDeliveryStatus: cb.smsDeliveryStatus },
    });
  }

  // 6. Webinar reservations (multi)
  for (const w of input.webinars) {
    events.push({
      eventId: `webinar_${w.reservationId}`,
      at: w.createdAt,
      kind: 'webinar_reserved',
      label: `Webinar reservation submitted`,
      ip: null,
      referrer: null,
      details: { eventId: w.eventId, emailDeliveryStatus: w.emailDeliveryStatus },
    });
  }

  // 7. Flush (enrolled / expired / archived)
  if (input.placement?.flushedAt) {
    const reasonLabel =
      input.placement.flushReason === 'enrolled'
        ? 'Enrollment marked'
        : input.placement.flushReason === 'expired'
          ? 'Token expired (8-week window)'
          : 'Manual flush by admin';
    events.push({
      eventId: `flush_${input.placement.prospectId}`,
      at: input.placement.flushedAt,
      kind:
        input.placement.flushReason === 'enrolled'
          ? 'enrollment_marked'
          : 'flush',
      label: reasonLabel,
      ip: null,
      referrer: null,
      details: { flushReason: input.placement.flushReason },
    });
  }

  // Sort newest-last (chronological per brief D.2: "in chronological order").
  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return events;
}

/* ─── sandbox preview ───────────────────────────────────────────── */

/**
 * Synthesize a ResolvedTokenPayload-shaped snapshot for the admin
 * sandbox-preview panel. PURE READ — zero writes. The admin client
 * renders this in a non-interactive panel so the prospect-URL "click"
 * from the directory never fires a real /api/p/:token request.
 *
 * Returns null if prospect or token can't be resolved.
 */
export async function synthesizeAdminSandboxPreview(
  prospectId: string,
): Promise<(McsResolvedTokenPayload & { sandbox: true }) | null> {
  const prospect = await findProspectById(prospectId);
  if (!prospect) return null;

  const tokens = await listByProspectId<McsInviteTokenRecord>(COLL_TOKENS, prospectId);
  const token = pickLatest(tokens, (t) => t.createdAt);
  if (!token) return null;

  const baResult = await persistenceCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: { tmagId: prospect.sponsorTmagId },
    limit: 1,
  });
  const baDoc = baResult.documents?.[0];

  const eventResult = await persistenceCall<{
    documents: Array<{ eventId: string; scheduledFor: string; hosts?: string[] }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_WEBINAR_EVENTS,
    filter: { scheduledFor: { $gt: new Date().toISOString() }, status: 'scheduled' },
    sort: { scheduledFor: 1 },
    limit: 1,
  });
  const nextEvent = eventResult.documents?.[0] ?? null;

  return {
    token: token.token,
    state: token.state,
    prospect: {
      firstName: prospect.firstName,
      lastInitial: prospect.lastInitial,
      city: prospect.location.city,
      stateOrRegion: prospect.location.stateOrRegion,
      country: prospect.location.country,
      positionNumber: prospect.positionNumber,
      placedAt: prospect.placedAt,
      expiresAt: prospect.expiresAt,
    },
    ba: {
      tmagId: prospect.sponsorTmagId,
      firstName: baDoc?.firstName ?? '—',
      lastName: baDoc?.lastName ?? '',
      lastInitial: (baDoc?.lastName ?? '').charAt(0).toUpperCase(),
      fullName: baDoc ? `${baDoc.firstName} ${baDoc.lastName}` : prospect.sponsorTmagId,
    },
    videoUrl: DR_DAN_VIDEO_URL,
    webinar: WEBINAR_COPY,
    nextEvent: nextEvent
      ? {
          eventId: nextEvent.eventId,
          scheduledFor: nextEvent.scheduledFor,
          hosts: nextEvent.hosts ?? [],
        }
      : null,
    sandbox: true,
  };
}

/* ─── Kevin notes (append-only) ─────────────────────────────────── */

export async function listProspectNotes(
  prospectId: string,
): Promise<McsAdminProspectKevinNote[]> {
  const notes = await listByProspectId<NoteDoc>(
    COLL_NOTES,
    prospectId,
    { createdAt: 1 },
  );
  return notes.map<McsAdminProspectKevinNote>((n) => ({
    noteId: n.noteId,
    prospectId: n.prospectId,
    body: n.body,
    createdAt: n.createdAt,
    createdByTmagId: n.createdByTmagId,
    createdByDisplayName: n.createdByDisplayName,
  }));
}

export async function appendProspectNote(input: {
  prospectId: string;
  body: string;
  actor: McsAuditActor & { kind: 'admin' };
  context: McsAuditContext | null;
}): Promise<McsAdminProspectAddNoteResponse> {
  const noteId = `note_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const note: McsAdminProspectKevinNote = {
    noteId,
    prospectId: input.prospectId,
    body: input.body,
    createdAt,
    createdByTmagId: input.actor.tmagId,
    createdByDisplayName: input.actor.displayName,
  };

  await writeOperational({
    id: noteId,
    mongoCollection: COLL_NOTES,
    mongoDoc: { ...note },
    neo4j: {
      cypher:
        'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
        'MERGE (n:TmagAdminProspectNote {noteId: $noteId}) ' +
        'SET n.body = $body, n.createdAt = datetime($createdAt), ' +
        '    n.createdByTmagId = $createdByTmagId ' +
        'MERGE (n)-[:NOTE_ON]->(p)',
      params: {
        prospectId: input.prospectId,
        noteId,
        body: input.body,
        createdAt,
        createdByTmagId: input.actor.tmagId,
      },
    },
    chroma: {
      collection: CHROMA_NOTES_COLLECTION,
      document:
        `admin note on prospect ${input.prospectId} by ${input.actor.displayName}: ${input.body}`,
      metadata: {
        kind: 'admin_prospect_note',
        prospectId: input.prospectId,
        noteId,
        createdByTmagId: input.actor.tmagId,
        createdAt,
      },
    },
  });

  await appendAuditEntry({
    actor: input.actor,
    action: 'admin.prospect.note.appended',
    entity: { kind: 'prospect', id: input.prospectId, displayLabel: null },
    severity: 'info',
    after: { noteId, bodyPreview: input.body.slice(0, 200) },
    reason: null,
    context: input.context,
  });

  return { ok: true, note };
}

/* ─── D.4 interventions ─────────────────────────────────────────── */

/**
 * Pre-flight check shared by every intervention: the prospect must exist
 * AND the requestingTmagId must exist as a BA AND, where applicable, the
 * target BA must exist.
 *
 * Throws on validation failure with a stable code the route layer
 * translates to 4xx.
 */
async function loadInterventionContext(input: {
  prospectId: string;
  requestingTmagId: string;
  requireToTmagId?: string;
}): Promise<{
  prospect: McsProspectRecord;
  placement: McsPoolPlacement | null;
  requestingBa: BaDoc;
  toBa: BaDoc | null;
}> {
  const [prospect, placement, requestingBa, toBa] = await Promise.all([
    findProspectById(input.prospectId),
    findPlacementByProspectId(input.prospectId),
    findBaDoc(input.requestingTmagId),
    input.requireToTmagId ? findBaDoc(input.requireToTmagId) : Promise.resolve(null),
  ]);
  if (!prospect) throw new InterventionError('prospect_not_found', 404);
  if (!requestingBa)
    throw new InterventionError('requesting_ba_not_found', 400);
  if (input.requireToTmagId && !toBa)
    throw new InterventionError('target_ba_not_found', 400);
  return { prospect, placement, requestingBa, toBa };
}

async function findBaDoc(tmagId: string): Promise<BaDoc | null> {
  const r = await persistenceCall<{ documents: BaDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BAS,
    filter: { tmagId },
    limit: 1,
  });
  return r.documents?.[0] ?? null;
}

export class InterventionError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
    this.name = 'InterventionError';
  }
}

/**
 * After any intervention writes, build the refreshed directory row for
 * the prospect so the client can patch the table in place. Single-row
 * projection — reuses the directory derivation helpers.
 */
export async function refreshRowFor(prospectId: string): Promise<McsAdminProspectDirectoryRow> {
  const baNames = await loadBaNameMap();
  const [prospect, placement, tokens, callbacks, webinars] = await Promise.all([
    findProspectById(prospectId),
    findPlacementByProspectId(prospectId),
    listByProspectId<McsInviteTokenRecord>(COLL_TOKENS, prospectId),
    listByProspectId<McsCallbackRequestRecord>(COLL_CALLBACKS, prospectId),
    listByProspectId<McsWebinarReservationRecord>(COLL_WEBINARS, prospectId),
  ]);
  if (!prospect) {
    throw new InterventionError('prospect_not_found_after_write', 500);
  }
  const token = pickLatest(tokens, (t) => t.createdAt);
  const callback = pickLatest(callbacks, (c) => c.createdAt);
  const webinar = pickLatest(webinars, (w) => w.createdAt);
  const nowMs = Date.now();
  const tokenStr = token?.token ?? '';
  return {
    prospectId: prospect.prospectId,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    sponsorTmagId: prospect.sponsorTmagId,
    sponsorName: baNames.get(prospect.sponsorTmagId) ?? prospect.sponsorTmagId,
    presentationStatus: derivePresentationStatus(
      prospect.state,
      !!callback,
      !!webinar,
    ),
    positionNumber: prospect.positionNumber ?? null,
    prospectUrl: tokenStr ? prospectUrlFor(tokenStr) : '',
    token: tokenStr,
    firstContactAt: token?.createdAt ?? prospect.createdAt,
    mostRecentActivity: {
      at: prospect.updatedAt,
      eventKind: eventKindForState(prospect.state),
      label: labelForState(prospect.state),
    },
    daysInHoldingTank: deriveDaysInHoldingTank(placement, nowMs),
    followUpNeededBy: deriveFollowUpNeededBy(prospect, placement),
    prospectStatus: deriveProspectStatus(placement),
    deleted: (prospect as ProspectDoc).deleted === true,
  };
}

/**
 * D.4 · MOVE — change the inviting BA on the prospect record. Position
 * number preserved (monotonic). Pool placement's sponsorTmagId is also
 * updated so the placement's "owned by" matches the prospect. Token
 * row's sponsorTmagId is NOT changed — sponsorTmagIdAtMint (3.5) stays
 * pinned to whoever minted the original invite; the drift detector in
 * D.2 will surface the discrepancy as intended.
 */
export async function executeMoveIntervention(input: {
  prospectId: string;
  body: McsAdminProspectMoveRequest;
  actor: McsAuditActor & { kind: 'admin' };
  context: McsAuditContext | null;
}): Promise<McsAdminProspectInterventionResponse> {
  validateInterventionBase(input.body);
  if (!input.body.toTmagId || input.body.toTmagId.length < 2) {
    throw new InterventionError('invalid_toTmagId', 400);
  }
  const ctx = await loadInterventionContext({
    prospectId: input.prospectId,
    requestingTmagId: input.body.requestingTmagId,
    requireToTmagId: input.body.toTmagId,
  });

  if (ctx.prospect.sponsorTmagId === input.body.toTmagId) {
    throw new InterventionError('no_op_same_inviting_ba', 400);
  }

  const before = snapshotProspect(ctx.prospect, ctx.placement);

  const now = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLL_PROSPECTS,
    filter: { prospectId: input.prospectId },
    update: {
      $set: { sponsorTmagId: input.body.toTmagId, updatedAt: now },
    },
  });
  if (ctx.placement) {
    await updatePoolPlacementOperational({
      prospectId: input.prospectId,
      patch: { sponsorTmagId: input.body.toTmagId, updatedAt: now },
      relationshipPatch: { sponsorTmagId: input.body.toTmagId },
    });
  }
  await persistenceCall('neo4j', 'cypher', {
    query:
      'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
      'SET p.sponsorTmagId = $toTmagId ' +
      'WITH p ' +
      'MERGE (b:TeamMagnificentMember {tmagId: $toTmagId}) ' +
      'MERGE (p)-[:INVITED_BY]->(b)',
    params: { prospectId: input.prospectId, toTmagId: input.body.toTmagId },
  });

  const after = snapshotProspect(
    { ...ctx.prospect, sponsorTmagId: input.body.toTmagId, updatedAt: now },
    ctx.placement
      ? { ...ctx.placement, sponsorTmagId: input.body.toTmagId }
      : null,
  );

  const auditEntry = await appendAuditEntry({
    actor: input.actor,
    action: 'admin.prospect.move',
    entity: {
      kind: 'prospect',
      id: input.prospectId,
      displayLabel: `${ctx.prospect.firstName} ${ctx.prospect.lastName}`,
    },
    severity: 'critical',
    before,
    after,
    reason: input.body.reason,
    context: input.context,
  });

  const refreshedRow = await refreshRowFor(input.prospectId);

  return {
    ok: true,
    kind: 'move',
    prospectId: input.prospectId,
    auditEntryId: auditEntry.entryId,
    refreshedRow,
  };
}

/**
 * D.4 · REASSIGN-SPONSOR — change the prospect's sponsorTmagId. Same
 * field mutation as MOVE but a distinct audit-action so Kevin's intent
 * survives in the log (3.5 override vs. pipeline reshuffle). Position
 * preserved.
 */
export async function executeReassignSponsorIntervention(input: {
  prospectId: string;
  body: McsAdminProspectReassignSponsorRequest;
  actor: McsAuditActor & { kind: 'admin' };
  context: McsAuditContext | null;
}): Promise<McsAdminProspectInterventionResponse> {
  validateInterventionBase(input.body);
  if (!input.body.newSponsorTmagId || input.body.newSponsorTmagId.length < 2) {
    throw new InterventionError('invalid_newSponsorTmagId', 400);
  }
  const ctx = await loadInterventionContext({
    prospectId: input.prospectId,
    requestingTmagId: input.body.requestingTmagId,
    requireToTmagId: input.body.newSponsorTmagId,
  });
  if (ctx.prospect.sponsorTmagId === input.body.newSponsorTmagId) {
    throw new InterventionError('no_op_same_sponsor', 400);
  }

  const before = snapshotProspect(ctx.prospect, ctx.placement);

  const now = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLL_PROSPECTS,
    filter: { prospectId: input.prospectId },
    update: {
      $set: { sponsorTmagId: input.body.newSponsorTmagId, updatedAt: now },
    },
  });
  if (ctx.placement) {
    await updatePoolPlacementOperational({
      prospectId: input.prospectId,
      patch: { sponsorTmagId: input.body.newSponsorTmagId, updatedAt: now },
      relationshipPatch: { sponsorTmagId: input.body.newSponsorTmagId },
    });
  }
  await persistenceCall('neo4j', 'cypher', {
    query:
      'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
      'SET p.sponsorTmagId = $newSponsorTmagId ' +
      'WITH p ' +
      'MERGE (b:TeamMagnificentMember {tmagId: $newSponsorTmagId}) ' +
      'MERGE (p)-[:SPONSORED_BY]->(b)',
    params: {
      prospectId: input.prospectId,
      newSponsorTmagId: input.body.newSponsorTmagId,
    },
  });

  const after = snapshotProspect(
    {
      ...ctx.prospect,
      sponsorTmagId: input.body.newSponsorTmagId,
      updatedAt: now,
    },
    ctx.placement
      ? { ...ctx.placement, sponsorTmagId: input.body.newSponsorTmagId }
      : null,
  );

  const auditEntry = await appendAuditEntry({
    actor: input.actor,
    action: 'admin.prospect.sponsor.reassigned',
    entity: {
      kind: 'prospect',
      id: input.prospectId,
      displayLabel: `${ctx.prospect.firstName} ${ctx.prospect.lastName}`,
    },
    severity: 'critical',
    before,
    after,
    reason: input.body.reason,
    context: input.context,
  });

  const refreshedRow = await refreshRowFor(input.prospectId);
  return {
    ok: true,
    kind: 'reassign_sponsor',
    prospectId: input.prospectId,
    auditEntryId: auditEntry.entryId,
    refreshedRow,
  };
}

/**
 * D.4 · MANUAL FLUSH — vacate the holding-tank slot before the 8-week
 * window expires. Sets placement.flushedAt=now, flushReason='archived'.
 * Position number preserved. Prospect's state advanced to 'expired'
 * (terminal) — the BA may not re-invite under the same token after
 * this; a new token is required.
 */
export async function executeManualFlushIntervention(input: {
  prospectId: string;
  body: McsAdminProspectManualFlushRequest;
  actor: McsAuditActor & { kind: 'admin' };
  context: McsAuditContext | null;
}): Promise<McsAdminProspectInterventionResponse> {
  validateInterventionBase(input.body);
  const ctx = await loadInterventionContext({
    prospectId: input.prospectId,
    requestingTmagId: input.body.requestingTmagId,
  });
  if (ctx.placement?.flushedAt) {
    throw new InterventionError('placement_already_flushed', 400);
  }
  // Manual flush requires there to be a placement — pre-placement prospects
  // can be cleaned up via expiry / token-level operations, not this path.
  if (!ctx.placement) {
    throw new InterventionError('no_placement_to_flush', 400);
  }

  const before = snapshotProspect(ctx.prospect, ctx.placement);

  const now = new Date().toISOString();
  await updatePoolPlacementOperational({
    prospectId: input.prospectId,
    patch: {
      flushedAt: now,
      flushReason: 'archived',
      updatedAt: now,
    },
    relationshipPatch: {
      flushedAt: now,
      flushReason: 'archived',
    },
  });
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLL_PROSPECTS,
    filter: { prospectId: input.prospectId },
    update: {
      $set: { state: 'expired', updatedAt: now },
    },
  });

  const afterPlacement: McsPoolPlacement = {
    ...ctx.placement,
    flushedAt: now,
    flushReason: 'archived',
  };
  const after = snapshotProspect(
    { ...ctx.prospect, state: 'expired', updatedAt: now },
    afterPlacement,
  );

  const auditEntry = await appendAuditEntry({
    actor: input.actor,
    action: 'admin.prospect.manual_flush',
    entity: {
      kind: 'pool_placement',
      id: input.prospectId,
      displayLabel: `${ctx.prospect.firstName} ${ctx.prospect.lastName} · #${ctx.placement.positionNumber}`,
    },
    severity: 'critical',
    before,
    after,
    reason: input.body.reason,
    context: input.context,
  });

  const refreshedRow = await refreshRowFor(input.prospectId);
  return {
    ok: true,
    kind: 'manual_flush',
    prospectId: input.prospectId,
    auditEntryId: auditEntry.entryId,
    refreshedRow,
  };
}

/**
 * D.4 · FORCE ENROLL — mark the prospect enrolled even if the BA hasn't.
 * Sets placement.flushedAt=now, flushReason='enrolled'. Prospect state
 * advanced to 'enrolled'. Position preserved.
 */
export async function executeForceEnrollIntervention(input: {
  prospectId: string;
  body: McsAdminProspectForceEnrollRequest;
  actor: McsAuditActor & { kind: 'admin' };
  context: McsAuditContext | null;
}): Promise<McsAdminProspectInterventionResponse> {
  validateInterventionBase(input.body);
  const ctx = await loadInterventionContext({
    prospectId: input.prospectId,
    requestingTmagId: input.body.requestingTmagId,
  });
  if (ctx.prospect.state === 'enrolled') {
    throw new InterventionError('prospect_already_enrolled', 400);
  }
  if (ctx.placement?.flushedAt && ctx.placement.flushReason === 'enrolled') {
    throw new InterventionError('placement_already_enrolled', 400);
  }

  const before = snapshotProspect(ctx.prospect, ctx.placement);

  const now = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLL_PROSPECTS,
    filter: { prospectId: input.prospectId },
    update: {
      $set: { state: 'enrolled', updatedAt: now },
    },
  });

  if (ctx.placement) {
    await updatePoolPlacementOperational({
      prospectId: input.prospectId,
      patch: {
        flushedAt: now,
        flushReason: 'enrolled',
        updatedAt: now,
      },
      relationshipPatch: {
        flushedAt: now,
        flushReason: 'enrolled',
      },
    });
  }

  const afterPlacement: McsPoolPlacement | null = ctx.placement
    ? { ...ctx.placement, flushedAt: now, flushReason: 'enrolled' }
    : null;
  const after = snapshotProspect(
    { ...ctx.prospect, state: 'enrolled', updatedAt: now },
    afterPlacement,
  );

  const auditEntry = await appendAuditEntry({
    actor: input.actor,
    action: 'admin.prospect.force_enroll',
    entity: {
      kind: 'prospect',
      id: input.prospectId,
      displayLabel: `${ctx.prospect.firstName} ${ctx.prospect.lastName}`,
    },
    severity: 'critical',
    before,
    after,
    reason: input.body.reason,
    context: input.context,
  });

  const refreshedRow = await refreshRowFor(input.prospectId);
  return {
    ok: true,
    kind: 'force_enroll',
    prospectId: input.prospectId,
    auditEntryId: auditEntry.entryId,
    refreshedRow,
  };
}

/* ─── shared helpers ────────────────────────────────────────────── */

function validateInterventionBase(body: {
  requestingTmagId: string;
  reason: string;
}): void {
  if (!body.requestingTmagId || body.requestingTmagId.length < 2) {
    throw new InterventionError('invalid_requestingTmagId', 400);
  }
  if (!body.reason || body.reason.trim().length < 8) {
    throw new InterventionError('reason_required_min_8_chars', 400);
  }
}

function snapshotProspect(
  prospect: McsProspectRecord,
  placement: McsPoolPlacement | null,
): Record<string, unknown> {
  return {
    prospectId: prospect.prospectId,
    sponsorTmagId: prospect.sponsorTmagId,
    state: prospect.state,
    positionNumber: prospect.positionNumber,
    placedAt: prospect.placedAt,
    updatedAt: prospect.updatedAt,
    placement: placement
      ? {
          positionNumber: placement.positionNumber,
          sponsorTmagId: placement.sponsorTmagId,
          placedAt: placement.placedAt,
          flushedAt: placement.flushedAt,
          flushReason: placement.flushReason,
        }
      : null,
  };
}

async function queryByProspectIds<T>(
  collection: string,
  prospectIds: string[],
): Promise<T[]> {
  if (prospectIds.length === 0) return [];
  const result = await persistenceCall<{ documents: T[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection,
    filter: { prospectId: { $in: prospectIds } },
    limit: 50_000,
  });
  return result.documents ?? [];
}

async function listByProspectId<T>(
  collection: string,
  prospectId: string,
  sort: Record<string, 1 | -1> = { createdAt: -1 },
): Promise<T[]> {
  const result = await persistenceCall<{ documents: T[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection,
    filter: { prospectId },
    sort,
    limit: 1000,
  });
  return result.documents ?? [];
}

function indexBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of rows) map.set(keyOf(r), r);
  return map;
}

function latestByProspect<T extends { prospectId: string }>(
  rows: T[],
  whenOf: (row: T) => string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of rows) {
    const cur = map.get(r.prospectId);
    if (!cur || whenOf(r) > whenOf(cur)) map.set(r.prospectId, r);
  }
  return map;
}

function pickLatest<T>(rows: T[], whenOf: (row: T) => string): T | null {
  if (rows.length === 0) return null;
  let best = rows[0]!;
  for (let i = 1; i < rows.length; i++) {
    if (whenOf(rows[i]!) > whenOf(best)) best = rows[i]!;
  }
  return best;
}

/* ─── re-exports for the route layer ────────────────────────────── */

export type {
  McsAdminProspectInterventionKind,
};

// LEADER_DETECTION_NOTE re-export for the route layer (so it can stamp
// the directory response without importing adminMetrics directly).
export { LEADER_DETECTION_NOTE };

// Used by the route's audit context for token-lifecycle diagnostics.
export { TOKEN_TTL_MS };
