/**
 * Group orientation scheduler domain (Chat #147 — wireframe §3.6,
 * dec_orientation_scheduling seq 21).
 *
 * New-member orientation runs as scheduled GROUP sessions of up to 10 BAs
 * each, hosted by founders (Kevin + Paul today; hosts are ASSIGNABLE so
 * trained leaders can host later — never hardcoded here). This REUSES the
 * webinar Event + reservation architecture (domain/webinarEvent.ts +
 * domain/webinarReservation.ts, §2.6) rather than building new scheduling
 * infra: a session is an event with a hard capacity cap; a BA reserves a seat.
 *
 * Key difference from the webinar (which is prospect-facing, uncapped, and
 * reserved via /api/p/:token): orientation reservations are BA-facing. The
 * reserving party is the authed BA, capacity is capped at 10, and tmagId is read
 * from the session — never from a request body (mirrors the cockpit's
 * sponsor-immutability discipline, locked-spec 3.5).
 *
 * Triple-stack per write (Rule 1):
 *   - Mongo `orientation_sessions` / `orientation_reservations`
 *   - Neo4j (:OrientationSession) / (:BA)-[:RESERVED_ORIENTATION]->(session)
 *   - ChromaDB `mcs_orientation` semantic log (collection bootstrapped lazily)
 *
 * Gateway quirks respected (see services/tripleStack.ts): Mongo query param is
 * `filter:` not `query:`; `update` does not honor upsert; Chroma add() needs
 * the collection to exist first.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { sendSms, TelnyxConfigError, TelnyxError } from '../services/telnyx.js';
import {
  ORIENTATION_SESSION_CAPACITY,
  type OrientationReservationRecord,
  type OrientationSession,
  type OrientationSessionAvailability,
  type OrientationSessionWithRoster,
  type OrientationRosterSeat,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const SESSIONS_COLLECTION = 'orientation_sessions';
const RESERVATIONS_COLLECTION = 'orientation_reservations';
const CHROMA_COLLECTION = 'mcs_orientation';

/** Default hosts when none are assigned (founders today; extensible later). */
export const ORIENTATION_DEFAULT_HOSTS = ['Kevin Gardner', 'Paul Barrios'];
const ORIENTATION_DURATION_MINUTES = 60;

/* ──────────────────────────────────────────────────────────────────
 * Lazy Chroma bootstrap — fires once per process, idempotent. Avoids
 * touching server/src/index.ts boot (worktree append-only hard rule).
 * ────────────────────────────────────────────────────────────────── */
let collectionBootstrap: Promise<void> | null = null;

function isAlreadyExistsError(err: unknown): boolean {
  const s = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    s.includes('already exists') ||
    s.includes('uniqueconstraint') ||
    s.includes('exists') ||
    s.includes('duplicate')
  );
}

export async function ensureOrientationCollection(): Promise<void> {
  if (collectionBootstrap) return collectionBootstrap;
  collectionBootstrap = (async () => {
    try {
      await gatewayCall('chromadb', 'create_collection', {
        name: CHROMA_COLLECTION,
        metadata: {
          chat_number: 147,
          wireframe_leaf: '3.6',
          purpose: 'Team Magnificent group orientation sessions + reservations',
        },
      });
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err;
    }
  })();
  return collectionBootstrap;
}

/* ──────────────────────────────────────────────────────────────────
 * Reads
 * ────────────────────────────────────────────────────────────────── */

/** A single upcoming session by id, or null if missing/cancelled/past. */
export async function findSessionById(
  sessionId: string,
): Promise<OrientationSession | null> {
  const result = await gatewayCall<{ documents: OrientationSession[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: SESSIONS_COLLECTION,
      filter: { sessionId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

/** All upcoming sessions (status upcoming, in the future), soonest first. */
export async function listUpcomingSessions(): Promise<OrientationSession[]> {
  const now = new Date().toISOString();
  const result = await gatewayCall<{ documents: OrientationSession[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: SESSIONS_COLLECTION,
      filter: { status: 'upcoming', scheduledFor: { $gt: now } },
      sort: { scheduledFor: 1 },
      limit: 200,
    },
  );
  return result.documents ?? [];
}

/** All sessions (any status), newest-scheduled first — for the founder view. */
export async function listAllSessions(): Promise<OrientationSession[]> {
  const result = await gatewayCall<{ documents: OrientationSession[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: SESSIONS_COLLECTION,
      filter: {},
      sort: { scheduledFor: -1 },
      limit: 500,
    },
  );
  return result.documents ?? [];
}

/** Active (status:'reserved') reservations for a set of session ids. */
async function reservedForSessions(
  sessionIds: string[],
): Promise<OrientationReservationRecord[]> {
  if (sessionIds.length === 0) return [];
  const result = await gatewayCall<{ documents: OrientationReservationRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: RESERVATIONS_COLLECTION,
      filter: { sessionId: { $in: sessionIds }, status: 'reserved' },
      sort: { createdAt: 1 },
      limit: 5000,
    },
  );
  return result.documents ?? [];
}

/** The BA's own active reservations (status:'reserved'), newest first. */
async function myReservedReservations(
  tmagId: string,
): Promise<OrientationReservationRecord[]> {
  const result = await gatewayCall<{ documents: OrientationReservationRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: RESERVATIONS_COLLECTION,
      filter: { tmagId, status: 'reserved' },
      sort: { createdAt: -1 },
      limit: 100,
    },
  );
  return result.documents ?? [];
}

/**
 * Build the cockpit scheduling-card payload: every upcoming session with live
 * seat math and whether THIS BA already holds a seat. Also returns the single
 * session id the BA currently holds (a BA holds at most one active seat).
 */
export async function getSessionAvailabilityForBA(tmagId: string): Promise<{
  sessions: OrientationSessionAvailability[];
  myReservationSessionId: string | null;
}> {
  const sessions = await listUpcomingSessions();
  const sessionIds = sessions.map((s) => s.sessionId);

  const reserved = await reservedForSessions(sessionIds);
  const takenBySession = new Map<string, number>();
  const mineBySession = new Set<string>();
  for (const r of reserved) {
    takenBySession.set(r.sessionId, (takenBySession.get(r.sessionId) ?? 0) + 1);
    if (r.tmagId === tmagId) mineBySession.add(r.sessionId);
  }

  // A BA's single active seat may sit in a session that is upcoming; the card
  // surfaces it so the BA sees where they're booked. If their only reservation
  // is in a session no longer in the upcoming window, it simply won't show.
  const myReservationSessionId =
    sessions.find((s) => mineBySession.has(s.sessionId))?.sessionId ?? null;

  const availability: OrientationSessionAvailability[] = sessions.map((s) => {
    const seatsTaken = takenBySession.get(s.sessionId) ?? 0;
    const capacity = s.capacity ?? ORIENTATION_SESSION_CAPACITY;
    return {
      sessionId: s.sessionId,
      scheduledFor: s.scheduledFor,
      hosts: s.hosts,
      capacity,
      seatsTaken,
      seatsRemaining: Math.max(0, capacity - seatsTaken),
      durationMinutes: s.durationMinutes,
      reservedByMe: mineBySession.has(s.sessionId),
    };
  });

  return { sessions: availability, myReservationSessionId };
}

/**
 * Founder roster view: every session (any status) with its full roster of
 * reserved BAs. One reservation read covers all sessions.
 */
export async function listSessionsWithRosters(): Promise<
  OrientationSessionWithRoster[]
> {
  const sessions = await listAllSessions();
  const reserved = await reservedForSessions(sessions.map((s) => s.sessionId));

  const rosterBySession = new Map<string, OrientationRosterSeat[]>();
  for (const r of reserved) {
    (rosterBySession.get(r.sessionId) ?? rosterBySession.set(r.sessionId, []).get(r.sessionId)!).push({
      reservationId: r.reservationId,
      tmagId: r.tmagId,
      baName: r.baName,
      reservedAt: r.createdAt,
    });
  }

  return sessions.map((s) => {
    const roster = rosterBySession.get(s.sessionId) ?? [];
    const capacity = s.capacity ?? ORIENTATION_SESSION_CAPACITY;
    return {
      sessionId: s.sessionId,
      scheduledFor: s.scheduledFor,
      hosts: s.hosts,
      capacity,
      durationMinutes: s.durationMinutes,
      joinUrl: s.joinUrl ?? null,
      status: s.status,
      seatsTaken: roster.length,
      seatsRemaining: Math.max(0, capacity - roster.length),
      roster,
    };
  });
}

/** Project one session into the founder roster shape (post-create echo). */
export async function getSessionWithRoster(
  sessionId: string,
): Promise<OrientationSessionWithRoster | null> {
  const session = await findSessionById(sessionId);
  if (!session) return null;
  const reserved = await reservedForSessions([sessionId]);
  const capacity = session.capacity ?? ORIENTATION_SESSION_CAPACITY;
  const roster: OrientationRosterSeat[] = reserved.map((r) => ({
    reservationId: r.reservationId,
    tmagId: r.tmagId,
    baName: r.baName,
    reservedAt: r.createdAt,
  }));
  return {
    sessionId: session.sessionId,
    scheduledFor: session.scheduledFor,
    hosts: session.hosts,
    capacity,
    durationMinutes: session.durationMinutes,
    joinUrl: session.joinUrl ?? null,
    status: session.status,
    seatsTaken: roster.length,
    seatsRemaining: Math.max(0, capacity - roster.length),
    roster,
  };
}

/* ──────────────────────────────────────────────────────────────────
 * Writes
 * ────────────────────────────────────────────────────────────────── */

export interface CreateOrientationSessionInput {
  scheduledFor: string;
  hosts?: string[];
  capacity?: number;
  durationMinutes?: number;
  joinUrl?: string | null;
}

/**
 * Seed a new orientation session (founder /admin action; also used by the
 * seeder). Hosts are assignable — defaults to the founders when omitted.
 */
export async function createOrientationSession(
  input: CreateOrientationSessionInput,
): Promise<OrientationSession> {
  await ensureOrientationCollection();

  const createdAt = new Date().toISOString();
  // Stable, readable id derived from the slot — keeps re-seeds idempotent at
  // the call site (the caller can skip an id that already exists).
  const sessionId = `orientation_${randomUUID()}`;
  const hosts =
    input.hosts && input.hosts.length > 0 ? input.hosts : ORIENTATION_DEFAULT_HOSTS;
  const capacity = input.capacity ?? ORIENTATION_SESSION_CAPACITY;
  const durationMinutes = input.durationMinutes ?? ORIENTATION_DURATION_MINUTES;
  const joinUrl = input.joinUrl ?? null;

  const session: OrientationSession = {
    sessionId,
    scheduledFor: input.scheduledFor,
    hosts,
    capacity,
    durationMinutes,
    joinUrl,
    status: 'upcoming',
    createdAt,
  };

  await tripleStackWrite({
    id: sessionId,
    mongoCollection: SESSIONS_COLLECTION,
    mongoDoc: { ...session },
    neo4j: {
      cypher:
        'MERGE (e:OrientationSession {sessionId: $sessionId}) ' +
        'SET e.scheduledFor = $scheduledFor, e.status = $status, ' +
        '    e.capacity = $capacity, e.durationMinutes = $durationMinutes, ' +
        '    e.hosts = $hosts',
      params: {
        sessionId,
        scheduledFor: session.scheduledFor,
        status: 'upcoming',
        capacity,
        durationMinutes,
        hosts,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `Team Magnificent group orientation session on ${session.scheduledFor} ` +
        `(${durationMinutes} min, cap ${capacity}), hosted by ${hosts.join(' and ')}.`,
      metadata: {
        kind: 'orientation_session',
        sessionId,
        scheduledFor: session.scheduledFor,
        capacity,
        status: 'upcoming',
      },
    },
  });

  return session;
}

export type ReserveSeatError =
  | { kind: 'session_not_found' }
  | { kind: 'session_not_bookable' }
  | { kind: 'session_full' }
  | { kind: 'already_reserved_elsewhere'; sessionId: string };

export interface ReserveSeatInput {
  sessionId: string;
  tmagId: string;
  baName: string;
  /** BA phone for the best-effort confirmation SMS; null skips the send. */
  baPhone: string | null;
}

export interface ReserveSeatSuccess {
  ok: true;
  reservationId: string;
  sessionId: string;
  scheduledFor: string;
  seatsRemaining: number;
  createdAt: string;
}

export type ReserveSeatResult =
  | ReserveSeatSuccess
  | { ok: false; error: ReserveSeatError };

/**
 * Reserve a seat for the authed BA. Enforces: session exists + upcoming, the
 * BA holds no other active orientation seat, and the cap (default 10) is not
 * full. Idempotent — if the BA already holds THIS session's seat, returns it.
 */
export async function reserveSeat(
  input: ReserveSeatInput,
): Promise<ReserveSeatResult> {
  await ensureOrientationCollection();

  const session = await findSessionById(input.sessionId);
  if (!session) return { ok: false, error: { kind: 'session_not_found' } };
  if (session.status !== 'upcoming' || session.scheduledFor <= new Date().toISOString()) {
    return { ok: false, error: { kind: 'session_not_bookable' } };
  }

  const capacity = session.capacity ?? ORIENTATION_SESSION_CAPACITY;

  // The BA's existing active seats. If they already hold THIS session, return
  // it idempotently; if they hold a DIFFERENT one, make them cancel first.
  const mine = await myReservedReservations(input.tmagId);
  const here = mine.find((r) => r.sessionId === input.sessionId);
  if (here) {
    const seatsTaken = (await reservedForSessions([input.sessionId])).length;
    return {
      ok: true,
      reservationId: here.reservationId,
      sessionId: input.sessionId,
      scheduledFor: session.scheduledFor,
      seatsRemaining: Math.max(0, capacity - seatsTaken),
      createdAt: here.createdAt,
    };
  }
  const elsewhere = mine[0];
  if (elsewhere) {
    return {
      ok: false,
      error: { kind: 'already_reserved_elsewhere', sessionId: elsewhere.sessionId },
    };
  }

  // Capacity check (read current reserved seats just before writing). v1 scale
  // is single-host group sessions of 10 — a final count here is sufficient; no
  // distributed lock is warranted (mirrors the holding-tank read-then-write).
  const existing = await reservedForSessions([input.sessionId]);
  if (existing.length >= capacity) {
    return { ok: false, error: { kind: 'session_full' } };
  }

  const reservationId = `orientresv_${randomUUID()}`;
  const createdAt = new Date().toISOString();

  await tripleStackWrite({
    id: reservationId,
    mongoCollection: RESERVATIONS_COLLECTION,
    mongoDoc: {
      reservationId,
      sessionId: input.sessionId,
      tmagId: input.tmagId,
      baName: input.baName,
      scheduledFor: session.scheduledFor,
      status: 'reserved',
      createdAt,
      cancelledAt: null,
      smsDeliveryStatus: 'queued',
      smsDeliveryError: null,
    },
    neo4j: {
      cypher:
        'MERGE (b:BA {tmagId: $tmagId}) ' +
        'MERGE (e:OrientationSession {sessionId: $sessionId}) ' +
        'CREATE (b)-[r:RESERVED_ORIENTATION {' +
        '  reservationId: $reservationId, createdAt: $createdAt' +
        '}]->(e)',
      params: {
        tmagId: input.tmagId,
        sessionId: input.sessionId,
        reservationId,
        createdAt,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `${input.baName} (${input.tmagId}) reserved an orientation seat for ` +
        `session ${input.sessionId} scheduled ${session.scheduledFor} at ${createdAt}.`,
      metadata: {
        kind: 'orientation_reservation',
        reservationId,
        sessionId: input.sessionId,
        tmagId: input.tmagId,
        scheduledFor: session.scheduledFor,
        createdAt,
      },
    },
  });

  // Best-effort confirmation SMS to the BA (reuses the §2.6 mechanic). Dormant
  // when Telnyx is unconfigured — recorded 'skipped', never blocks the booking.
  let smsDeliveryStatus: OrientationReservationRecord['smsDeliveryStatus'] = 'queued';
  let smsDeliveryError: string | null = null;
  if (!input.baPhone) {
    smsDeliveryStatus = 'skipped';
    smsDeliveryError = 'ba_phone_missing';
  } else {
    try {
      await sendSms({
        to: input.baPhone,
        text:
          `You're booked for Team Magnificent orientation on ` +
          `${formatPacific(session.scheduledFor)}. Hosted by ${session.hosts.join(' & ')}.`,
      });
      smsDeliveryStatus = 'sent';
    } catch (err) {
      if (err instanceof TelnyxConfigError) {
        smsDeliveryStatus = 'skipped';
        smsDeliveryError = 'telnyx_not_configured';
      } else {
        smsDeliveryStatus = 'failed';
        smsDeliveryError =
          err instanceof TelnyxError || err instanceof Error
            ? err.message
            : 'unknown_sms_failure';
        // eslint-disable-next-line no-console
        console.error(
          `[orientation-reservation ${reservationId}] SMS to BA failed:`,
          smsDeliveryError,
        );
      }
    }
  }

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: RESERVATIONS_COLLECTION,
    filter: { _id: reservationId },
    update: {
      $set: {
        smsDeliveryStatus,
        smsDeliveryError,
        smsDeliveredAt: smsDeliveryStatus === 'sent' ? new Date().toISOString() : null,
      },
    },
  });

  return {
    ok: true,
    reservationId,
    sessionId: input.sessionId,
    scheduledFor: session.scheduledFor,
    seatsRemaining: Math.max(0, capacity - (existing.length + 1)),
    createdAt,
  };
}

export type CancelSeatResult =
  | { ok: true; sessionId: string; cancelledAt: string }
  | { ok: false; error: 'not_reserved' };

/**
 * Cancel the BA's active seat in a session. The row is retained with
 * status:'cancelled' (roster/audit history), not deleted, mirroring the
 * append-only posture used elsewhere.
 */
export async function cancelSeat(
  sessionId: string,
  tmagId: string,
): Promise<CancelSeatResult> {
  const mine = await myReservedReservations(tmagId);
  const here = mine.find((r) => r.sessionId === sessionId);
  if (!here) return { ok: false, error: 'not_reserved' };

  const cancelledAt = new Date().toISOString();
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: RESERVATIONS_COLLECTION,
    filter: { _id: here.reservationId },
    update: { $set: { status: 'cancelled', cancelledAt } },
  });

  // Mirror the cancellation into Neo4j so the graph roster stays truthful.
  try {
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MATCH (:BA {tmagId: $tmagId})-[r:RESERVED_ORIENTATION {reservationId: $reservationId}]->(:OrientationSession) ' +
        'SET r.status = "cancelled", r.cancelledAt = $cancelledAt',
      params: { tmagId, reservationId: here.reservationId, cancelledAt },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[orientation-cancel ${here.reservationId}] neo4j mirror failed (best-effort):`,
      err,
    );
  }

  return { ok: true, sessionId, cancelledAt };
}

/**
 * Format a UTC ISO timestamp as a human Pacific-time string, e.g.
 * "Monday, June 2 at 5:00 PM PT" (mirrors webinarReservation.formatPacific).
 */
function formatPacific(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${date} at ${time} PT`;
}
