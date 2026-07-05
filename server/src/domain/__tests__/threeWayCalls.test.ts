import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BARecord } from '../ba.js';
import type {
  McsThreeWayBookingRecord,
  McsThreeWaySponsorAvailabilityRecord,
} from '@momentum/shared';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  tripleStackWrite: vi.fn(),
  findBAByTmagId: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: mocks.tripleStackWrite,
}));

vi.mock('../ba.js', () => ({
  findBAByTmagId: mocks.findBAByTmagId,
}));

import {
  cancelThreeWayBooking,
  createThreeWayBooking,
  generateThreeWaySlotsForTest,
  getThreeWayAvailability,
} from '../threeWayCalls.js';

const AVAILABILITY_COLLECTION = 'tmag_sponsor_availability';
const BOOKINGS_COLLECTION = 'tmag_three_way_bookings';

function ba(input: {
  tmagId: string;
  firstName: string;
  lastName: string;
  sponsorTmagId?: string;
  timezone?: string;
}): BARecord {
  return {
    tmagId: input.tmagId,
    firstName: input.firstName,
    lastName: input.lastName,
    sponsorTmagId: input.sponsorTmagId ?? '',
    timezone: input.timezone ?? 'America/Los_Angeles',
    phone: '+13235550123',
    email: `${input.tmagId.toLowerCase()}@example.com`,
    threeBaId: `three-${input.tmagId}`,
    threeUsername: input.firstName.toLowerCase(),
    passwordHash: 'hash',
    sponsorThreeBaId: '',
    accessCodeUsed: 'TM-TEST',
    entitlements: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    lastLoginAt: null,
  };
}

function availability(input: {
  ownerTmagId: string;
  ownerName?: string;
  timezone?: string;
  dayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime?: string;
  endTime?: string;
}): McsThreeWaySponsorAvailabilityRecord {
  return {
    availabilityId: `threeway_availability_${input.ownerTmagId}`,
    ownerTmagId: input.ownerTmagId,
    ownerName: input.ownerName ?? input.ownerTmagId,
    timezone: input.timezone ?? 'America/Los_Angeles',
    windows: [
      {
        windowId: 'window_1',
        dayOfWeek: input.dayOfWeek ?? 1,
        startTime: input.startTime ?? '08:00',
        endTime: input.endTime ?? '10:00',
        active: true,
      },
    ],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function booking(input: {
  bookingId?: string;
  bookerTmagId?: string;
  sponsorTmagId: string;
  startAt: string;
  endAt?: string;
  status?: 'booked' | 'cancelled';
}): McsThreeWayBookingRecord {
  return {
    bookingId: input.bookingId ?? 'threeway_existing',
    bookerTmagId: input.bookerTmagId ?? 'TM-03',
    bookerName: 'Member Three',
    sponsorTmagId: input.sponsorTmagId,
    sponsorName: 'Sponsor Two',
    startAt: input.startAt,
    endAt: input.endAt ?? new Date(new Date(input.startAt).getTime() + 30 * 60_000).toISOString(),
    ownerTimezone: 'America/Los_Angeles',
    bookerTimezone: 'America/Los_Angeles',
    prospectNote: null,
    status: input.status ?? 'booked',
    createdAt: '2026-07-01T00:00:00.000Z',
    cancelledAt: null,
    cancelledByTmagId: null,
    notificationChannel: 'in_app',
  };
}

describe('three-way call scheduling domain', () => {
  const baStore = new Map<string, BARecord>();
  const availabilityStore = new Map<string, McsThreeWaySponsorAvailabilityRecord>();
  const bookingStore = new Map<string, McsThreeWayBookingRecord>();
  let sponsorBookingQueue: McsThreeWayBookingRecord[][] = [];

  beforeEach(() => {
    baStore.clear();
    availabilityStore.clear();
    bookingStore.clear();
    sponsorBookingQueue = [];
    vi.useRealTimers();

    mocks.findBAByTmagId.mockImplementation(async (tmagId: string) => baStore.get(tmagId) ?? null);

    mocks.tripleStackWrite.mockImplementation(async (input: {
      id: string;
      mongoCollection: string;
      mongoDoc: unknown;
    }) => {
      if (input.mongoCollection === BOOKINGS_COLLECTION) {
        bookingStore.set(input.id, input.mongoDoc as McsThreeWayBookingRecord);
      }
      if (input.mongoCollection === AVAILABILITY_COLLECTION) {
        availabilityStore.set(input.id, input.mongoDoc as McsThreeWaySponsorAvailabilityRecord);
      }
      return { ok: true };
    });

    mocks.persistenceCall.mockImplementation(async (tool: string, action: string, params: any) => {
      if (tool === 'mongodb' && action === 'query' && params.collection === AVAILABILITY_COLLECTION) {
        if (params.filter?._id) {
          const found = availabilityStore.get(params.filter._id);
          return { count: found ? 1 : 0, documents: found ? [found] : [] };
        }
        if (params.filter?.ownerTmagId?.$in) {
          const ids = new Set<string>(params.filter.ownerTmagId.$in);
          const documents = [...availabilityStore.values()].filter((row) =>
            ids.has(row.ownerTmagId),
          );
          return { count: documents.length, documents };
        }
        if (params.filter?.ownerTmagId) {
          const documents = [...availabilityStore.values()].filter(
            (row) => row.ownerTmagId === params.filter.ownerTmagId,
          );
          return { count: documents.length, documents };
        }
      }

      if (tool === 'mongodb' && action === 'query' && params.collection === BOOKINGS_COLLECTION) {
        if (params.filter?._id) {
          const found = bookingStore.get(params.filter._id);
          return { count: found ? 1 : 0, documents: found ? [found] : [] };
        }
        if (params.filter?.sponsorTmagId?.$in) {
          if (sponsorBookingQueue.length > 0) {
            const documents = sponsorBookingQueue.shift() ?? [];
            return { count: documents.length, documents };
          }
          const ids = new Set<string>(params.filter.sponsorTmagId.$in);
          const from = params.filter.startAt?.$gte ?? '0000';
          const to = params.filter.startAt?.$lte ?? '9999';
          const documents = [...bookingStore.values()].filter(
            (row) =>
              ids.has(row.sponsorTmagId) &&
              row.status === 'booked' &&
              row.startAt >= from &&
              row.startAt <= to,
          );
          return { count: documents.length, documents };
        }
        if (params.filter?.$or) {
          const documents = [...bookingStore.values()].filter(
            (row) =>
              row.bookerTmagId === params.filter.$or[0]?.bookerTmagId ||
              row.sponsorTmagId === params.filter.$or[1]?.sponsorTmagId,
          );
          return { count: documents.length, documents };
        }
      }

      if (tool === 'mongodb' && action === 'update' && params.collection === BOOKINGS_COLLECTION) {
        const found = bookingStore.get(params.filter._id);
        if (found) {
          bookingStore.set(params.filter._id, { ...found, ...params.update.$set });
        }
        return { matchedCount: found ? 1 : 0, modifiedCount: found ? 1 : 0 };
      }

      if (tool === 'mongodb' && action === 'delete' && params.collection === AVAILABILITY_COLLECTION) {
        return { deletedCount: availabilityStore.delete(params.filter._id) ? 1 : 0 };
      }

      return { ok: true, documents: [] };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('generates 30-minute slots across a spring DST jump without nonexistent local times', () => {
    const slots = generateThreeWaySlotsForTest({
      availability: availability({
        ownerTmagId: 'TM-02',
        timezone: 'America/Los_Angeles',
        dayOfWeek: 0,
        startTime: '01:00',
        endTime: '04:00',
      }),
      now: new Date('2026-03-08T08:30:00.000Z'),
      horizonDays: 1,
    });

    expect(slots.map((slot) => slot.localStartTime)).toEqual([
      '01:00',
      '01:30',
      '03:00',
      '03:30',
    ]);
  });

  it('rejects a booking when the slot is taken after availability was generated', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T14:30:00.000Z'));

    const member = ba({ tmagId: 'TM-03', firstName: 'Member', lastName: 'Three', sponsorTmagId: 'TM-02' });
    const sponsor = ba({ tmagId: 'TM-02', firstName: 'Sponsor', lastName: 'Two', sponsorTmagId: 'TM-01' });
    const founder = ba({ tmagId: 'TM-01', firstName: 'Kevin', lastName: 'Gardner' });
    for (const row of [member, sponsor, founder]) baStore.set(row.tmagId, row);
    availabilityStore.set('threeway_availability_TM-02', availability({ ownerTmagId: 'TM-02', ownerName: 'Sponsor Two' }));

    const startAt = '2026-07-06T15:00:00.000Z';
    sponsorBookingQueue = [[], [booking({ sponsorTmagId: 'TM-02', startAt })]];

    const result = await createThreeWayBooking({
      bookerTmagId: 'TM-03',
      sponsorTmagId: 'TM-02',
      startAt,
      prospectNote: 'Bring context.',
    });

    expect(result).toEqual({ ok: false, error: 'double_booked' });
    expect(mocks.tripleStackWrite).not.toHaveBeenCalled();
  });

  it('treats cancelled bookings as open when generating slots', () => {
    const startAt = '2026-07-06T15:00:00.000Z';
    const common = {
      availability: availability({ ownerTmagId: 'TM-02', startTime: '08:00', endTime: '09:00' }),
      now: new Date('2026-07-06T14:30:00.000Z'),
      horizonDays: 1,
    };

    const bookedSlots = generateThreeWaySlotsForTest({
      ...common,
      booked: [booking({ sponsorTmagId: 'TM-02', startAt, status: 'booked' })],
    });
    const cancelledSlots = generateThreeWaySlotsForTest({
      ...common,
      booked: [booking({ sponsorTmagId: 'TM-02', startAt, status: 'cancelled' })],
    });

    expect(bookedSlots.map((slot) => slot.startAt)).not.toContain(startAt);
    expect(cancelledSlots.map((slot) => slot.startAt)).toContain(startAt);
  });

  it('allows only available members in the booker upline chain', async () => {
    const member = ba({ tmagId: 'TM-04', firstName: 'Member', lastName: 'Four', sponsorTmagId: 'TM-03' });
    const sponsor = ba({ tmagId: 'TM-03', firstName: 'Sponsor', lastName: 'Three', sponsorTmagId: 'TM-01' });
    const founder = ba({ tmagId: 'TM-01', firstName: 'Kevin', lastName: 'Gardner' });
    const outsider = ba({ tmagId: 'TM-99', firstName: 'Outside', lastName: 'Member' });
    for (const row of [member, sponsor, founder, outsider]) baStore.set(row.tmagId, row);

    availabilityStore.set('threeway_availability_TM-03', availability({ ownerTmagId: 'TM-03', ownerName: 'Sponsor Three' }));
    availabilityStore.set('threeway_availability_TM-01', availability({ ownerTmagId: 'TM-01', ownerName: 'Kevin Gardner' }));
    availabilityStore.set('threeway_availability_TM-99', availability({ ownerTmagId: 'TM-99', ownerName: 'Outside Member' }));

    const response = await getThreeWayAvailability('TM-04', new Date('2026-07-06T14:30:00.000Z'));

    expect(response.bookableUplines.map((upline) => upline.tmagId)).toEqual(['TM-03', 'TM-01']);
  });

  it('lets either party cancel and frees the slot for the next availability read', async () => {
    const existing = booking({
      bookingId: 'threeway_cancel_me',
      bookerTmagId: 'TM-03',
      sponsorTmagId: 'TM-02',
      startAt: '2026-07-06T15:00:00.000Z',
    });
    bookingStore.set(existing.bookingId, existing);

    const cancelled = await cancelThreeWayBooking(existing.bookingId, 'TM-02');

    expect(cancelled.ok).toBe(true);
    expect(bookingStore.get(existing.bookingId)?.status).toBe('cancelled');
    expect(bookingStore.get(existing.bookingId)?.cancelledByTmagId).toBe('TM-02');
  });
});
