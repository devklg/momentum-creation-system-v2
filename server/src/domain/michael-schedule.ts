/**
 * Michael's outbound voice interview — scheduling domain.
 *
 * Locked decisions (Chat #97):
 *   - Slot generator window: 18 hours from BA signup.
 *   - Business hours: 8:00 AM – 9:45 PM in the BA's local timezone (continuous,
 *     no lunch break).
 *   - Slot length: 15 minutes. Last slot starts at 9:45 PM (call ends 10:00 PM).
 *   - Timezone source: stored on the BA record at signup (`timezone` field,
 *     IANA name e.g. "America/Los_Angeles"). Server-side resolution.
 *   - Hard gate: until the BA's interview is `completed`, .team locks every
 *     route EXCEPT /training/day-1, /profile, sign-out, and /michael/schedule.
 *
 * Per TEAM Design Section D (Locked Chat #82+#84+#96).
 *
 * States, in order:
 *   AWAITING_SCHEDULE → SCHEDULED → IN_PROGRESS → COMPLETED
 *                                              ↘ MISSED  (one reschedule allowed)
 */

import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { placeCall, TelnyxError } from '../services/telnyx.js';

export type MichaelInterviewStatus =
  | 'awaiting_schedule'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'missed';

export interface MichaelSchedule {
  /** Stable ID — one record per BA. */
  _id: string;
  baId: string;
  status: MichaelInterviewStatus;
  /** ISO timestamp of the chosen slot start (UTC). null until scheduled. */
  slotStartUtc: string | null;
  /** Slot end (start + 15 min). */
  slotEndUtc: string | null;
  /** BA's IANA timezone (snapshot at booking). */
  timezone: string | null;
  /** Number of times this BA has rescheduled. Capped at 1. */
  rescheduleCount: number;
  signupAt: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** Free-form notes from the Telnyx webhook side. */
  callSid: string | null;
}

const SLOT_LEN_MIN = 15;
const WINDOW_HOURS = 18;
const BUSINESS_START_HOUR = 8;   // 08:00
const BUSINESS_END_HOUR = 21;    // 21:00 (last slot starts 21:45 = 9:45 PM)
const BUSINESS_END_MIN = 45;
const MAX_RESCHEDULES = 1;

export interface SlotOffer {
  /** ISO UTC timestamp the slot starts. */
  startUtc: string;
  /** ISO UTC timestamp the slot ends (startUtc + 15 min). */
  endUtc: string;
  /** Human-readable label in the BA's timezone, e.g. "Tue 8:15 PM". */
  label: string;
  /** True if the slot is in the future and within the 18h window. */
  available: boolean;
}

/**
 * Generate slot offers for a BA.
 *
 * Window: max(now, signupAt) to signupAt + 18h.
 * Filters to slots where the BA's local clock reads 08:00 ≤ HH:MM ≤ 21:45.
 * Returns slots in chronological order.
 *
 * Pure function (no I/O). Easy to unit-test by passing `now`.
 */
export function generateSlots(args: {
  signupAt: Date;
  timezone: string;
  now?: Date;
}): SlotOffer[] {
  const now = args.now ?? new Date();
  const signup = args.signupAt;
  const windowEnd = new Date(signup.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  // Start at the next 15-min boundary from max(now, signup).
  let cursor = new Date(Math.max(now.getTime(), signup.getTime()));
  cursor = ceilToQuarter(cursor);

  const slots: SlotOffer[] = [];
  while (cursor < windowEnd) {
    const local = partsInZone(cursor, args.timezone);
    const hm = local.hour * 100 + local.minute;
    const startHM = BUSINESS_START_HOUR * 100;
    const endHM = BUSINESS_END_HOUR * 100 + BUSINESS_END_MIN;
    if (hm >= startHM && hm <= endHM) {
      const endUtc = new Date(cursor.getTime() + SLOT_LEN_MIN * 60 * 1000);
      slots.push({
        startUtc: cursor.toISOString(),
        endUtc: endUtc.toISOString(),
        label: formatSlotLabel(cursor, args.timezone),
        available: true,
      });
    }
    cursor = new Date(cursor.getTime() + SLOT_LEN_MIN * 60 * 1000);
  }
  return slots;
}

function ceilToQuarter(d: Date): Date {
  const m = d.getUTCMinutes();
  const remainder = m % 15;
  if (remainder === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    return new Date(d.getTime());
  }
  const add = 15 - remainder;
  const next = new Date(d.getTime() + add * 60 * 1000);
  next.setUTCSeconds(0, 0);
  return next;
}

interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
}

function partsInZone(d: Date, tz: string): ZoneParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  let hour = parseInt(map.hour ?? '0', 10);
  if (hour === 24) hour = 0;
  return {
    year: parseInt(map.year ?? '0', 10),
    month: parseInt(map.month ?? '0', 10),
    day: parseInt(map.day ?? '0', 10),
    hour,
    minute: parseInt(map.minute ?? '0', 10),
    weekday: map.weekday ?? '',
  };
}

function formatSlotLabel(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────────────

export async function getMichaelSchedule(baId: string): Promise<MichaelSchedule | null> {
  const result = await gatewayCall<{ documents: MichaelSchedule[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { baId },
    limit: 1,
  });
  return result.documents.length > 0 ? result.documents[0] ?? null : null;
}

/**
 * Initialize a Michael schedule row for a brand-new BA. Called at signup,
 * after the BA record is written. Idempotent — if a row already exists for
 * this BA, returns the existing one.
 */
export async function initMichaelSchedule(args: {
  baId: string;
  signupAt: Date;
  timezone: string;
}): Promise<MichaelSchedule> {
  const existing = await getMichaelSchedule(args.baId);
  if (existing) return existing;

  const id = `MS-${args.baId}`;
  const record: MichaelSchedule = {
    _id: id,
    baId: args.baId,
    status: 'awaiting_schedule',
    slotStartUtc: null,
    slotEndUtc: null,
    timezone: args.timezone,
    rescheduleCount: 0,
    signupAt: args.signupAt.toISOString(),
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    callSid: null,
  };

  await tripleStackWrite({
    id,
    mongoCollection: 'michael_schedules',
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (b:BA {baId: $baId}) ' +
        'MERGE (m:MichaelSchedule {scheduleId: $id}) ' +
        'SET m.status = $status, m.signupAt = $signupAt, m.timezone = $timezone ' +
        'MERGE (b)-[:HAS_MICHAEL_SCHEDULE]->(m)',
      params: {
        baId: args.baId,
        status: record.status,
        signupAt: record.signupAt,
        timezone: args.timezone,
      },
    },
    chroma: {
      collection: 'mcs_michael_schedules',
      document: `Michael schedule for BA ${args.baId} initialized at signup ${record.signupAt}. Status: awaiting_schedule.`,
      metadata: {
        scheduleId: id,
        baId: args.baId,
        status: record.status,
        kind: 'michael_schedule',
      },
    },
  });

  return record;
}

export class BookingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

/**
 * Book a slot. Validates the slot is within the 18h window and inside business
 * hours in the BA's timezone. Updates the schedule row's status to 'scheduled'.
 */
export async function bookMichaelSlot(args: {
  baId: string;
  slotStartUtc: string;
}): Promise<MichaelSchedule> {
  const schedule = await getMichaelSchedule(args.baId);
  if (!schedule) {
    throw new BookingError('NO_SCHEDULE', 'No Michael schedule record exists for this BA.');
  }
  if (schedule.status === 'in_progress' || schedule.status === 'completed') {
    throw new BookingError(
      'ALREADY_BOOKED',
      `Cannot re-book — status is ${schedule.status}.`,
    );
  }
  if (schedule.status === 'scheduled' && schedule.rescheduleCount >= MAX_RESCHEDULES) {
    throw new BookingError(
      'NO_RESCHEDULES_LEFT',
      'Reschedule limit reached. Contact your sponsor.',
    );
  }
  if (!schedule.timezone) {
    throw new BookingError('NO_TIMEZONE', 'BA timezone is not set. Update profile first.');
  }

  // Re-validate the chosen slot against the live offer set.
  const offers = generateSlots({
    signupAt: new Date(schedule.signupAt),
    timezone: schedule.timezone,
  });
  const match = offers.find((o) => o.startUtc === args.slotStartUtc);
  if (!match) {
    throw new BookingError(
      'SLOT_INVALID',
      'That slot is no longer available. Choose a different time.',
    );
  }

  const nowIso = new Date().toISOString();
  const newRescheduleCount =
    schedule.status === 'scheduled' ? schedule.rescheduleCount + 1 : schedule.rescheduleCount;

  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { _id: schedule._id },
    update: {
      $set: {
        status: 'scheduled',
        slotStartUtc: match.startUtc,
        slotEndUtc: match.endUtc,
        scheduledAt: nowIso,
        rescheduleCount: newRescheduleCount,
      },
    },
  });

  await gatewayCall('neo4j', 'cypher', {
    query:
      "MATCH (m:MichaelSchedule {scheduleId: $id}) " +
      "SET m.status = 'scheduled', m.slotStartUtc = $slotStartUtc, m.slotEndUtc = $slotEndUtc, " +
      "m.scheduledAt = $scheduledAt, m.rescheduleCount = $rescheduleCount",
    params: {
      id: schedule._id,
      slotStartUtc: match.startUtc,
      slotEndUtc: match.endUtc,
      scheduledAt: nowIso,
      rescheduleCount: newRescheduleCount,
    },
  });

  return {
    ...schedule,
    status: 'scheduled',
    slotStartUtc: match.startUtc,
    slotEndUtc: match.endUtc,
    scheduledAt: nowIso,
    rescheduleCount: newRescheduleCount,
  };
}

/** Hard-gate predicate. True if this BA's interview is `completed`. */
export async function isInterviewComplete(baId: string): Promise<boolean> {
  const s = await getMichaelSchedule(baId);
  return s?.status === 'completed';
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Call origination (Chat #102)
//
// A separate concern from booking: booking writes status=scheduled and an
// intended slot time. Origination is what actually places the outbound call
// to the BA — either fired by a scheduler at the slot time or triggered
// manually for testing.
//
// The scheduler/cron loop (find scheduled rows where slotStartUtc<=now and
// callSid is null, originate each) is intentionally NOT built here. The
// origination function below is its building block. A future tick can call
// originateCall(baId) for each row it finds.
// ─────────────────────────────────────────────────────────────────────────────────────

export type OriginateResult =
  | { kind: 'placed'; callControlId: string; schedule: MichaelSchedule }
  | { kind: 'skipped'; reason: string; schedule: MichaelSchedule };

export class OriginateError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OriginateError';
  }
}

/**
 * Place Michael's outbound call for a scheduled BA.
 *
 * Preconditions (enforced):
 *  - schedule exists
 *  - schedule.status === 'scheduled'
 *  - schedule.callSid is null (idempotency: if a callSid is already there,
 *    a previous origination succeeded; skip rather than double-dial)
 *  - BA record has a non-empty phone
 *
 * On success: writes the Telnyx call_control_id to schedule.callSid so the
 * webhook can bind events back via callSid fallback even if client_state is
 * ever stripped. Returns kind:'placed'.
 *
 * On precondition violation: returns kind:'skipped' with a reason. Does NOT
 * throw — this is the safe path for a scheduler that loops over rows.
 *
 * On dial failure (Telnyx 4xx/5xx): throws OriginateError. The scheduler
 * decides whether to retry or mark the schedule as missed.
 */
export async function originateCall(baId: string): Promise<OriginateResult> {
  const schedule = await getMichaelSchedule(baId);
  if (!schedule) {
    throw new OriginateError(
      'NO_SCHEDULE',
      `No Michael schedule for baId=${baId}`,
    );
  }

  if (schedule.status !== 'scheduled') {
    return {
      kind: 'skipped',
      reason: `status=${schedule.status} (only 'scheduled' is dialable)`,
      schedule,
    };
  }
  if (schedule.callSid) {
    return {
      kind: 'skipped',
      reason: `callSid already set: ${schedule.callSid}`,
      schedule,
    };
  }

  // Fetch the BA's phone. Avoid a dependency on the full BA record reader so
  // this function stays a single-purpose unit — inline gateway query.
  const baLookup = await gatewayCall<{ documents: { phone?: string }[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'brand_ambassadors',
      filter: { baId },
      limit: 1,
    },
  );
  const phone = baLookup.documents[0]?.phone?.trim();
  if (!phone) {
    throw new OriginateError(
      'NO_PHONE',
      `BA ${baId} has no phone on file; cannot originate call.`,
    );
  }

  // Place the call. Errors bubble as TelnyxError; we wrap them so the
  // scheduler doesn't have to import telnyx types.
  let dialResult;
  try {
    dialResult = await placeCall({
      to: phone,
      clientState: { baId, scheduleId: schedule._id },
    });
  } catch (err) {
    if (err instanceof TelnyxError) {
      throw new OriginateError(
        'DIAL_FAILED',
        `Telnyx dial failed (HTTP ${err.status}): ${err.message}`,
      );
    }
    throw err;
  }

  // Persist callSid on the schedule. Status stays 'scheduled' — it flips to
  // 'in_progress' on the call.answered webhook.
  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { _id: schedule._id },
    update: { $set: { callSid: dialResult.callControlId } },
  });

  await gatewayCall('neo4j', 'cypher', {
    query:
      "MATCH (m:MichaelSchedule {scheduleId: $id}) SET m.callSid = $callSid",
    params: { id: schedule._id, callSid: dialResult.callControlId },
  });

  return {
    kind: 'placed',
    callControlId: dialResult.callControlId,
    schedule: { ...schedule, callSid: dialResult.callControlId },
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// Webhook-driven state transitions (Chat #102)
//
// Telnyx fires these via the /api/telnyx/webhook route. Each transition is
// idempotent — re-delivery of the same event is a no-op. Each writes to all
// three stores: Mongo (authoritative status), Neo4j (graph mirror for upline
// cockpit), Chroma (audit trail with the event details for semantic search).
// ────────────────────────────────────────────────────────────────────────────────

export type WebhookTransition =
  | { kind: 'noop'; reason: string; schedule: MichaelSchedule }
  | { kind: 'transitioned'; from: MichaelInterviewStatus; to: MichaelInterviewStatus; schedule: MichaelSchedule };

/**
 * Mark a Michael call as in-progress. Fires on Telnyx call.answered.
 * Idempotent: if already in_progress or completed, returns noop.
 * Only transitions from 'scheduled'.
 */
export async function markCallStarted(args: {
  baId: string;
  callSid: string;
  occurredAt: string;
}): Promise<WebhookTransition> {
  const s = await getMichaelSchedule(args.baId);
  if (!s) throw new Error(`No Michael schedule for baId=${args.baId}`);

  if (s.status === 'in_progress' || s.status === 'completed') {
    return { kind: 'noop', reason: `already ${s.status}`, schedule: s };
  }
  if (s.status !== 'scheduled') {
    return {
      kind: 'noop',
      reason: `cannot start from status=${s.status}`,
      schedule: s,
    };
  }

  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { _id: s._id },
    update: {
      $set: {
        status: 'in_progress',
        startedAt: args.occurredAt,
        callSid: args.callSid,
      },
    },
  });

  await gatewayCall('neo4j', 'cypher', {
    query:
      "MATCH (m:MichaelSchedule {scheduleId: $id}) " +
      "SET m.status = 'in_progress', m.startedAt = $startedAt, m.callSid = $callSid",
    params: { id: s._id, startedAt: args.occurredAt, callSid: args.callSid },
  });

  const updated: MichaelSchedule = {
    ...s,
    status: 'in_progress',
    startedAt: args.occurredAt,
    callSid: args.callSid,
  };
  return { kind: 'transitioned', from: s.status, to: 'in_progress', schedule: updated };
}

/**
 * Mark a Michael call as completed. Fires on Telnyx call.hangup AFTER call.answered
 * (i.e. the prior state is in_progress). The hard gate opens here.
 * Idempotent: if already completed, returns noop.
 */
export async function markCallCompleted(args: {
  baId: string;
  occurredAt: string;
}): Promise<WebhookTransition> {
  const s = await getMichaelSchedule(args.baId);
  if (!s) throw new Error(`No Michael schedule for baId=${args.baId}`);

  if (s.status === 'completed') {
    return { kind: 'noop', reason: 'already completed', schedule: s };
  }
  if (s.status !== 'in_progress') {
    return {
      kind: 'noop',
      reason: `cannot complete from status=${s.status}`,
      schedule: s,
    };
  }

  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { _id: s._id },
    update: {
      $set: { status: 'completed', completedAt: args.occurredAt },
    },
  });

  await gatewayCall('neo4j', 'cypher', {
    query:
      "MATCH (m:MichaelSchedule {scheduleId: $id}) " +
      "SET m.status = 'completed', m.completedAt = $completedAt",
    params: { id: s._id, completedAt: args.occurredAt },
  });

  const updated: MichaelSchedule = {
    ...s,
    status: 'completed',
    completedAt: args.occurredAt,
  };
  return { kind: 'transitioned', from: s.status, to: 'completed', schedule: updated };
}

/**
 * Mark a Michael call as missed. Fires on Telnyx call.hangup BEFORE call.answered
 * (no answer, busy, declined). BA can still reschedule once if rescheduleCount<1.
 * Idempotent: if already missed or completed, returns noop.
 */
export async function markCallMissed(args: {
  baId: string;
  occurredAt: string;
  reason: string;
}): Promise<WebhookTransition> {
  const s = await getMichaelSchedule(args.baId);
  if (!s) throw new Error(`No Michael schedule for baId=${args.baId}`);

  if (s.status === 'missed' || s.status === 'completed') {
    return { kind: 'noop', reason: `already ${s.status}`, schedule: s };
  }
  if (s.status !== 'scheduled') {
    return {
      kind: 'noop',
      reason: `cannot mark-missed from status=${s.status}`,
      schedule: s,
    };
  }

  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { _id: s._id },
    update: {
      $set: { status: 'missed' },
    },
  });

  await gatewayCall('neo4j', 'cypher', {
    query:
      "MATCH (m:MichaelSchedule {scheduleId: $id}) SET m.status = 'missed', m.missedReason = $reason",
    params: { id: s._id, reason: args.reason },
  });

  const updated: MichaelSchedule = { ...s, status: 'missed' };
  return { kind: 'transitioned', from: s.status, to: 'missed', schedule: updated };
}

/** Paths that remain accessible while the gate is closed. */
export const MICHAEL_GATE_WHITELIST: readonly string[] = [
  '/api/michael/slots',
  '/api/michael/book',
  '/api/michael/status',
  '/api/training/day-1',
  '/api/profile',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/health',
  // Fast Start (feat/fast-start-training, wireframe 3.5): the hub
  // render + Module 1 progress writes are pre-Michael accessible so a
  // brand-new BA can build belief in the product before the interview.
  // Modules 2-5 stay gated (no whitelist entry).
  '/api/training/fast-start/progress',
  '/api/training/fast-start/modules/1',
];
