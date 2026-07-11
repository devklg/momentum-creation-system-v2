/**
 * Three-way call scheduling v1 (BRIEF 5, 2026-07-04).
 *
 * Routing rule: UPLINE-CHAIN. A member can book any member in their immutable
 * sponsor/upline chain who has recurring availability set. No role gates here:
 * being bookable is purely a function of availability.
 *
 * Time rule: availability windows are owner-local weekly windows; bookings are
 * persisted as UTC ISO timestamps and rendered member-local by clients.
 */

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeOperational } from '../services/tieredWrite.js';
import { findBAByTmagId, type BARecord } from './ba.js';
import type {
  McsThreeWayAvailabilityResponse,
  McsThreeWayAvailabilitySlot,
  McsThreeWayAvailabilityWindow,
  McsThreeWayBookableUpline,
  McsThreeWayBookingRecord,
  McsThreeWayBookingsResponse,
  McsThreeWaySetAvailabilityPayload,
  McsThreeWaySponsorAvailabilityRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const AVAILABILITY_COLLECTION = 'tmag_sponsor_availability';
const BOOKINGS_COLLECTION = 'tmag_three_way_bookings';
const AVAILABILITY_CHROMA = 'mcs_sponsor_availability';
const BOOKINGS_CHROMA = 'mcs_three_way_bookings';
const SLOT_MINUTES = 30;
const HORIZON_DAYS = 14;
const MAX_UPLINE_DEPTH = 50;
const MAX_NOTE_LENGTH = 400;

type Clock = { hour: number; minute: number };
type PlainDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

interface ZonedParts extends PlainDateTime {
  second: number;
}

function fullName(ba: BARecord): string {
  return `${ba.firstName} ${ba.lastName}`.trim();
}

function availabilityIdFor(ownerTmagId: string): string {
  return `threeway_availability_${ownerTmagId}`;
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseClock(value: string): Clock | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

function clockToMinutes(clock: Clock): number {
  return clock.hour * 60 + clock.minute;
}

function minutesToClock(total: number): Clock {
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

function clockString(clock: Clock): string {
  return `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map = new Map(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.get('year')),
    month: Number(map.get('month')),
    day: Number(map.get('day')),
    hour: Number(map.get('hour')),
    minute: Number(map.get('minute')),
    second: Number(map.get('second')),
  };
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/**
 * Convert a timezone-local wall clock into UTC. Returns null for nonexistent
 * wall-clock instants such as 02:30 during a spring-forward DST jump.
 */
export function zonedLocalToUtc(input: PlainDateTime, timeZone: string): Date | null {
  const localAsUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    0,
    0,
  );
  let utcMs = localAsUtc;
  for (let i = 0; i < 5; i += 1) {
    const next = localAsUtc - timezoneOffsetMs(new Date(utcMs), timeZone);
    if (Math.abs(next - utcMs) < 1) {
      utcMs = next;
      break;
    }
    utcMs = next;
  }

  const roundTrip = getZonedParts(new Date(utcMs), timeZone);
  if (
    roundTrip.year !== input.year ||
    roundTrip.month !== input.month ||
    roundTrip.day !== input.day ||
    roundTrip.hour !== input.hour ||
    roundTrip.minute !== input.minute
  ) {
    return null;
  }
  return new Date(utcMs);
}

function addDays(date: { year: number; month: number; day: number }, days: number): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
} {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dayOfWeek: d.getUTCDay(),
  };
}

function isoPlusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime()
    && new Date(bStart).getTime() < new Date(aEnd).getTime();
}

function validateWindow(
  input: Partial<McsThreeWayAvailabilityWindow>,
  index: number,
): McsThreeWayAvailabilityWindow | null {
  const dayOfWeek = Number(input.dayOfWeek);
  const start = typeof input.startTime === 'string' ? parseClock(input.startTime) : null;
  const end = typeof input.endTime === 'string' ? parseClock(input.endTime) : null;
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !start || !end) {
    return null;
  }
  const startMinutes = clockToMinutes(start);
  const endMinutes = clockToMinutes(end);
  if (endMinutes - startMinutes < SLOT_MINUTES) return null;
  return {
    windowId:
      typeof input.windowId === 'string' && input.windowId.trim()
        ? input.windowId.trim().slice(0, 80)
        : `window_${index + 1}`,
    dayOfWeek: dayOfWeek as McsThreeWayAvailabilityWindow['dayOfWeek'],
    startTime: clockString(start),
    endTime: clockString(end),
    active: input.active !== false,
  };
}

export function normalizeAvailabilityPayload(
  payload: McsThreeWaySetAvailabilityPayload,
  fallbackTimezone: string,
): { timezone: string; windows: McsThreeWayAvailabilityWindow[] } | null {
  const timezone =
    typeof payload.timezone === 'string' && payload.timezone.trim()
      ? payload.timezone.trim()
      : fallbackTimezone;
  if (!isValidTimeZone(timezone)) return null;

  const rawWindows = Array.isArray(payload.windows) ? payload.windows : [];
  const windows = rawWindows
    .map((w, i) => validateWindow(w, i))
    .filter((w): w is McsThreeWayAvailabilityWindow => w !== null);
  return { timezone, windows };
}

async function readAvailability(
  ownerTmagId: string,
): Promise<McsThreeWaySponsorAvailabilityRecord | null> {
  const result = await persistenceCall<{ documents: McsThreeWaySponsorAvailabilityRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: AVAILABILITY_COLLECTION,
      filter: { ownerTmagId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

async function readAvailabilityById(
  availabilityId: string,
): Promise<McsThreeWaySponsorAvailabilityRecord | null> {
  const result = await persistenceCall<{ documents: McsThreeWaySponsorAvailabilityRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: AVAILABILITY_COLLECTION,
      filter: { _id: availabilityId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

async function readAvailabilities(
  ownerTmagIds: string[],
): Promise<McsThreeWaySponsorAvailabilityRecord[]> {
  if (ownerTmagIds.length === 0) return [];
  const result = await persistenceCall<{ documents: McsThreeWaySponsorAvailabilityRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: AVAILABILITY_COLLECTION,
      filter: { ownerTmagId: { $in: ownerTmagIds } },
      limit: ownerTmagIds.length,
    },
  );
  return result.documents ?? [];
}

async function readBookingById(bookingId: string): Promise<McsThreeWayBookingRecord | null> {
  const result = await persistenceCall<{ documents: McsThreeWayBookingRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: BOOKINGS_COLLECTION,
      filter: { _id: bookingId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

async function activeBookingsForSponsors(
  sponsorTmagIds: string[],
  now: Date,
  horizon: Date,
): Promise<McsThreeWayBookingRecord[]> {
  if (sponsorTmagIds.length === 0) return [];
  const result = await persistenceCall<{ documents: McsThreeWayBookingRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: BOOKINGS_COLLECTION,
      filter: {
        sponsorTmagId: { $in: sponsorTmagIds },
        status: 'booked',
        startAt: { $gte: now.toISOString(), $lte: horizon.toISOString() },
      },
      sort: { startAt: 1 },
      limit: 5000,
    },
  );
  return result.documents ?? [];
}

function generateOpenSlots(input: {
  availability: McsThreeWaySponsorAvailabilityRecord;
  booked: McsThreeWayBookingRecord[];
  now: Date;
  horizonDays?: number;
}): McsThreeWayAvailabilitySlot[] {
  const { availability, booked, now } = input;
  const horizon = new Date(now.getTime() + (input.horizonDays ?? HORIZON_DAYS) * 24 * 60 * 60 * 1000);
  const nowParts = getZonedParts(now, availability.timezone);
  const slots: McsThreeWayAvailabilitySlot[] = [];

  for (let offset = 0; offset <= (input.horizonDays ?? HORIZON_DAYS); offset += 1) {
    const day = addDays(nowParts, offset);
    const windows = availability.windows.filter(
      (w) => w.active !== false && w.dayOfWeek === day.dayOfWeek,
    );
    for (const window of windows) {
      const start = parseClock(window.startTime);
      const end = parseClock(window.endTime);
      if (!start || !end) continue;
      const startMinutes = clockToMinutes(start);
      const endMinutes = clockToMinutes(end);
      for (let minute = startMinutes; minute + SLOT_MINUTES <= endMinutes; minute += SLOT_MINUTES) {
        const localStart = minutesToClock(minute);
        const utcStart = zonedLocalToUtc(
          {
            year: day.year,
            month: day.month,
            day: day.day,
            hour: localStart.hour,
            minute: localStart.minute,
          },
          availability.timezone,
        );
        if (!utcStart) continue;
        const startAt = utcStart.toISOString();
        const endAt = isoPlusMinutes(startAt, SLOT_MINUTES);
        if (utcStart < now || utcStart > horizon) continue;
        const alreadyBooked = booked.some(
          (b) => b.status === 'booked' && overlaps(startAt, endAt, b.startAt, b.endAt),
        );
        if (alreadyBooked) continue;
        slots.push({
          startAt,
          endAt,
          ownerTimezone: availability.timezone,
          localDate: `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`,
          localStartTime: clockString(localStart),
        });
      }
    }
  }

  return slots.sort((a, b) => (a.startAt > b.startAt ? 1 : -1));
}

export function generateThreeWaySlotsForTest(input: {
  availability: McsThreeWaySponsorAvailabilityRecord;
  booked?: McsThreeWayBookingRecord[];
  now: Date;
  horizonDays?: number;
}): McsThreeWayAvailabilitySlot[] {
  return generateOpenSlots({
    availability: input.availability,
    booked: input.booked ?? [],
    now: input.now,
    horizonDays: input.horizonDays,
  });
}

export async function getUplineChain(tmagId: string): Promise<BARecord[]> {
  const chain: BARecord[] = [];
  const seen = new Set<string>([tmagId]);
  let current = await findBAByTmagId(tmagId);

  for (let depth = 0; depth < MAX_UPLINE_DEPTH; depth += 1) {
    const sponsorId = current?.sponsorTmagId;
    if (!sponsorId || seen.has(sponsorId)) break;
    seen.add(sponsorId);
    const sponsor = await findBAByTmagId(sponsorId);
    if (!sponsor) break;
    chain.push(sponsor);
    current = sponsor;
  }

  return chain;
}

export async function setMyThreeWayAvailability(
  ownerTmagId: string,
  payload: McsThreeWaySetAvailabilityPayload,
): Promise<McsThreeWaySponsorAvailabilityRecord> {
  const owner = await findBAByTmagId(ownerTmagId);
  if (!owner) throw new Error('member_not_found');
  const normalized = normalizeAvailabilityPayload(payload, owner.timezone || 'America/Los_Angeles');
  if (!normalized) throw new Error('invalid_availability');

  const now = new Date().toISOString();
  const availabilityId = availabilityIdFor(ownerTmagId);
  const existing = await readAvailabilityById(availabilityId);
  if (existing) {
    await persistenceCall('mongodb', 'delete', {
      database: MONGO_DB,
      collection: AVAILABILITY_COLLECTION,
      filter: { _id: availabilityId },
    });
  }

  const record: McsThreeWaySponsorAvailabilityRecord = {
    availabilityId,
    ownerTmagId,
    ownerName: fullName(owner),
    timezone: normalized.timezone,
    windows: normalized.windows,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await writeOperational({
    id: availabilityId,
    mongoCollection: AVAILABILITY_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (m:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'MERGE (a:TmagSponsorAvailability {availabilityId: $id}) ' +
        'SET a.ownerTmagId = $ownerTmagId, a.ownerName = $ownerName, ' +
        '    a.timezone = $timezone, a.windowCount = $windowCount, a.updatedAt = datetime($updatedAt) ' +
        'MERGE (m)-[:HAS_THREE_WAY_AVAILABILITY]->(a)',
      params: {
        ownerTmagId,
        ownerName: record.ownerName,
        timezone: record.timezone,
        windowCount: record.windows.length,
        updatedAt: record.updatedAt,
      },
    },
    chroma: {
      collection: AVAILABILITY_CHROMA,
      document:
        `${record.ownerName} (${ownerTmagId}) set ${record.windows.length} recurring weekly ` +
        `three-way call availability window(s) in ${record.timezone}.`,
      metadata: {
        kind: 'three_way_availability',
        availabilityId,
        ownerTmagId,
        timezone: record.timezone,
        windowCount: record.windows.length,
        updatedAt: record.updatedAt,
      },
    },
  });

  const readback = await readAvailabilityById(availabilityId);
  if (!readback) throw new Error('availability_readback_failed');
  return readback;
}

export async function getThreeWayAvailability(
  bookerTmagId: string,
  now = new Date(),
): Promise<McsThreeWayAvailabilityResponse> {
  const [myAvailability, upline] = await Promise.all([
    readAvailability(bookerTmagId),
    getUplineChain(bookerTmagId),
  ]);
  const uplineIds = upline.map((u) => u.tmagId);
  const [availabilityRecords, activeBookings] = await Promise.all([
    readAvailabilities(uplineIds),
    activeBookingsForSponsors(
      uplineIds,
      now,
      new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000),
    ),
  ]);

  const availabilityByOwner = new Map(availabilityRecords.map((a) => [a.ownerTmagId, a]));
  const bookingsBySponsor = new Map<string, McsThreeWayBookingRecord[]>();
  for (const booking of activeBookings) {
    (bookingsBySponsor.get(booking.sponsorTmagId)
      ?? bookingsBySponsor.set(booking.sponsorTmagId, []).get(booking.sponsorTmagId)!).push(booking);
  }

  const bookableUplines: McsThreeWayBookableUpline[] = [];
  for (const member of upline) {
    const availability = availabilityByOwner.get(member.tmagId);
    if (!availability || availability.windows.filter((w) => w.active !== false).length === 0) {
      continue;
    }
    bookableUplines.push({
      tmagId: member.tmagId,
      fullName: fullName(member),
      firstName: member.firstName,
      phone: member.phone ?? null,
      timezone: availability.timezone,
      windows: availability.windows,
      slots: generateOpenSlots({
        availability,
        booked: bookingsBySponsor.get(member.tmagId) ?? [],
        now,
      }),
    });
  }

  return {
    ok: true,
    generatedAt: now.toISOString(),
    horizonDays: HORIZON_DAYS,
    myAvailability,
    bookableUplines,
  };
}

export type CreateThreeWayBookingResult =
  | { ok: true; booking: McsThreeWayBookingRecord }
  | { ok: false; error: 'sponsor_not_bookable' | 'slot_not_available' | 'double_booked' };

export async function createThreeWayBooking(input: {
  bookerTmagId: string;
  sponsorTmagId: string;
  startAt: string;
  prospectNote?: string | null;
}): Promise<CreateThreeWayBookingResult> {
  const start = new Date(input.startAt);
  if (!Number.isFinite(start.getTime())) {
    return { ok: false, error: 'slot_not_available' };
  }
  const now = new Date();
  const availability = await getThreeWayAvailability(input.bookerTmagId, now);
  const bookable = availability.bookableUplines.find((u) => u.tmagId === input.sponsorTmagId);
  if (!bookable) return { ok: false, error: 'sponsor_not_bookable' };
  const slot = bookable.slots.find((s) => s.startAt === start.toISOString());
  if (!slot) return { ok: false, error: 'slot_not_available' };

  const existing = await activeBookingsForSponsors(
    [input.sponsorTmagId],
    new Date(start.getTime() - SLOT_MINUTES * 60_000),
    new Date(start.getTime() + SLOT_MINUTES * 60_000),
  );
  if (existing.some((b) => overlaps(slot.startAt, slot.endAt, b.startAt, b.endAt))) {
    return { ok: false, error: 'double_booked' };
  }

  const [booker, sponsor] = await Promise.all([
    findBAByTmagId(input.bookerTmagId),
    findBAByTmagId(input.sponsorTmagId),
  ]);
  if (!booker || !sponsor) return { ok: false, error: 'sponsor_not_bookable' };

  const createdAt = new Date().toISOString();
  const bookingId = `threeway_${randomUUID()}`;
  const prospectNote =
    typeof input.prospectNote === 'string' && input.prospectNote.trim()
      ? input.prospectNote.trim().slice(0, MAX_NOTE_LENGTH)
      : null;
  const record: McsThreeWayBookingRecord = {
    bookingId,
    bookerTmagId: booker.tmagId,
    bookerName: fullName(booker),
    sponsorTmagId: sponsor.tmagId,
    sponsorName: fullName(sponsor),
    startAt: slot.startAt,
    endAt: slot.endAt,
    ownerTimezone: bookable.timezone,
    bookerTimezone: booker.timezone || null,
    prospectNote,
    status: 'booked',
    createdAt,
    cancelledAt: null,
    cancelledByTmagId: null,
    notificationChannel: 'in_app',
  };

  await writeOperational({
    id: bookingId,
    mongoCollection: BOOKINGS_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (booker:TeamMagnificentMember {tmagId: $bookerTmagId}) ' +
        'MERGE (sponsor:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
        'MERGE (b:TmagThreeWayBooking {bookingId: $id}) ' +
        'SET b.startAt = datetime($startAt), b.endAt = datetime($endAt), ' +
        '    b.status = $status, b.notificationChannel = $notificationChannel ' +
        'MERGE (booker)-[:BOOKED_THREE_WAY_CALL]->(b) ' +
        'MERGE (b)-[:WITH_UPLINE]->(sponsor)',
      params: {
        bookerTmagId: record.bookerTmagId,
        sponsorTmagId: record.sponsorTmagId,
        startAt: record.startAt,
        endAt: record.endAt,
        status: record.status,
        notificationChannel: record.notificationChannel,
      },
    },
    chroma: {
      collection: BOOKINGS_CHROMA,
      document:
        `${record.bookerName} booked a three-way call with ${record.sponsorName} ` +
        `for ${record.startAt}. Prospect note present: ${prospectNote ? 'yes' : 'no'}.`,
      metadata: {
        kind: 'three_way_booking',
        bookingId,
        bookerTmagId: record.bookerTmagId,
        sponsorTmagId: record.sponsorTmagId,
        startAt: record.startAt,
        status: record.status,
        notificationChannel: record.notificationChannel,
      },
    },
  });

  const readback = await readBookingById(bookingId);
  if (!readback) throw new Error('booking_readback_failed');
  return { ok: true, booking: readback };
}

export async function listThreeWayBookings(
  tmagId: string,
): Promise<McsThreeWayBookingsResponse> {
  const result = await persistenceCall<{ documents: McsThreeWayBookingRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: BOOKINGS_COLLECTION,
      filter: { $or: [{ bookerTmagId: tmagId }, { sponsorTmagId: tmagId }] },
      sort: { startAt: 1 },
      limit: 500,
    },
  );
  const bookings = (result.documents ?? []).map((booking) => ({
    ...booking,
    myRole:
      booking.bookerTmagId === tmagId && booking.sponsorTmagId === tmagId
        ? ('both' as const)
        : booking.sponsorTmagId === tmagId
          ? ('sponsor' as const)
          : ('booker' as const),
  }));
  return { ok: true, generatedAt: new Date().toISOString(), bookings };
}

export type CancelThreeWayBookingResult =
  | { ok: true; booking: McsThreeWayBookingRecord }
  | { ok: false; error: 'not_found' | 'not_allowed' };

export async function cancelThreeWayBooking(
  bookingId: string,
  actorTmagId: string,
): Promise<CancelThreeWayBookingResult> {
  const booking = await readBookingById(bookingId);
  if (!booking) return { ok: false, error: 'not_found' };
  if (booking.bookerTmagId !== actorTmagId && booking.sponsorTmagId !== actorTmagId) {
    return { ok: false, error: 'not_allowed' };
  }

  if (booking.status === 'cancelled') return { ok: true, booking };

  const cancelledAt = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BOOKINGS_COLLECTION,
    filter: { _id: bookingId },
    update: {
      $set: {
        status: 'cancelled',
        cancelledAt,
        cancelledByTmagId: actorTmagId,
      },
    },
  });

  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (b:TmagThreeWayBooking {bookingId: $bookingId}) ' +
      'SET b.status = "cancelled", b.cancelledAt = datetime($cancelledAt), ' +
      '    b.cancelledByTmagId = $cancelledByTmagId',
    params: { bookingId, cancelledAt, cancelledByTmagId: actorTmagId },
  });

  await persistenceCall('chromadb', 'add', {
    collection: BOOKINGS_CHROMA,
    ids: [bookingId],
    documents: [
      `${booking.bookerName} cancelled the three-way call with ${booking.sponsorName} ` +
        `scheduled ${booking.startAt}. Cancelled at ${cancelledAt}.`,
    ],
    metadatas: [
      {
        kind: 'three_way_booking',
        bookingId,
        bookerTmagId: booking.bookerTmagId,
        sponsorTmagId: booking.sponsorTmagId,
        startAt: booking.startAt,
        status: 'cancelled',
        cancelledAt,
        cancelledByTmagId: actorTmagId,
      },
    ],
  });

  const readback = await readBookingById(bookingId);
  if (!readback) throw new Error('booking_cancel_readback_failed');
  return { ok: true, booking: readback };
}
