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
];
