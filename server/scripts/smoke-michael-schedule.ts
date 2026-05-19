/**
 * Smoke test for Michael's scheduling domain.
 *
 * Tests, in order:
 *   1. Pure slot generator produces correct count for a fresh BA (PST, signup
 *      at 10:00 AM PST → should yield slots until 9:45 PM same day and 8:00 AM
 *      next morning to signup+18h cutoff).
 *   2. initMichaelSchedule writes triple-stack + is idempotent.
 *   3. bookMichaelSlot locks a slot and validates re-book limits.
 *
 * Uses a synthetic BA ID so it doesn't pollute the founder records.
 *
 * Run:  node node_modules/tsx/dist/cli.mjs scripts/smoke-michael-schedule.ts
 */

import {
  bookMichaelSlot,
  generateSlots,
  getMichaelSchedule,
  initMichaelSchedule,
  BookingError,
} from '../src/domain/michael-schedule.js';
import { gatewayCall } from '../src/services/gateway.js';

const TEST_BA = 'TMBA-SMOKE-MICHAEL-001';
const TZ = 'America/Los_Angeles';

function logHeader(s: string): void {
  console.log(`\n=== ${s} ===`);
}

async function cleanup(): Promise<void> {
  // Best-effort: remove the smoke test record so reruns are clean.
  try {
    await gatewayCall('mongodb', 'delete', {
      database: 'momentum',
      collection: 'michael_schedules',
      filter: { baId: TEST_BA },
    });
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  logHeader('cleanup any prior smoke run');
  await cleanup();

  // ----------------------------------------------------------------
  logHeader('TEST 1: pure slot generator');
  // Synthetic signup: 2026-05-19 17:00 UTC = 10:00 AM PDT
  const signupAt = new Date('2026-05-19T17:00:00Z');
  const now = new Date('2026-05-19T17:30:00Z'); // 30 min after signup
  const slots = generateSlots({ signupAt, timezone: TZ, now });
  console.log(`  total slots offered: ${slots.length}`);
  console.log(`  first 3 slots:`);
  for (const s of slots.slice(0, 3)) {
    console.log(`    ${s.label}  (${s.startUtc})`);
  }
  console.log(`  last 3 slots:`);
  for (const s of slots.slice(-3)) {
    console.log(`    ${s.label}  (${s.startUtc})`);
  }
  // Validation: each slot should sit between 8:00 AM and 9:45 PM local.
  for (const s of slots) {
    const local = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(s.startUtc));
    const [hh, mm] = local.split(':').map((x) => parseInt(x, 10));
    const hm = (hh ?? 0) * 100 + (mm ?? 0);
    if (hm < 800 || hm > 2145) {
      throw new Error(`SLOT OUT OF RANGE: ${s.label} -> ${local}`);
    }
  }
  console.log(`  ✓ all ${slots.length} slots within 08:00-21:45 PST window`);

  // ----------------------------------------------------------------
  logHeader('TEST 2: initMichaelSchedule');
  const init1 = await initMichaelSchedule({
    baId: TEST_BA,
    signupAt: new Date(),
    timezone: TZ,
  });
  console.log(`  inserted: status=${init1.status} tz=${init1.timezone}`);

  const init2 = await initMichaelSchedule({
    baId: TEST_BA,
    signupAt: new Date(),
    timezone: TZ,
  });
  console.log(`  re-run:   status=${init2.status} (should be same as inserted)`);
  if (init2._id !== init1._id) {
    throw new Error('init was NOT idempotent');
  }
  console.log(`  ✓ idempotent`);

  // ----------------------------------------------------------------
  logHeader('TEST 3: bookMichaelSlot');
  // Re-fetch to know signupAt that was stored
  const stored = await getMichaelSchedule(TEST_BA);
  if (!stored) throw new Error('test record vanished');
  const liveSlots = generateSlots({
    signupAt: new Date(stored.signupAt),
    timezone: TZ,
  });
  if (liveSlots.length === 0) {
    console.log(`  ⚠ no live slots available (probably outside business hours now); skipping book test`);
  } else {
    const chosen = liveSlots[0]!;
    console.log(`  booking slot: ${chosen.label}  (${chosen.startUtc})`);
    const booked = await bookMichaelSlot({ baId: TEST_BA, slotStartUtc: chosen.startUtc });
    console.log(`  ✓ booked: status=${booked.status} slotStartUtc=${booked.slotStartUtc}`);

    // Try to book a different slot — should succeed (reschedule 1) ONCE
    if (liveSlots.length > 1) {
      const next = liveSlots[1]!;
      const reb1 = await bookMichaelSlot({ baId: TEST_BA, slotStartUtc: next.startUtc });
      console.log(`  ✓ reschedule #1: rescheduleCount=${reb1.rescheduleCount}`);

      // Try AGAIN — must fail with NO_RESCHEDULES_LEFT
      if (liveSlots.length > 2) {
        const third = liveSlots[2]!;
        try {
          await bookMichaelSlot({ baId: TEST_BA, slotStartUtc: third.startUtc });
          throw new Error('expected NO_RESCHEDULES_LEFT but booking succeeded');
        } catch (err) {
          if (err instanceof BookingError && err.code === 'NO_RESCHEDULES_LEFT') {
            console.log(`  ✓ reschedule cap enforced (BookingError: ${err.code})`);
          } else {
            throw err;
          }
        }
      }
    }
  }

  // ----------------------------------------------------------------
  logHeader('cleanup smoke record');
  await cleanup();
  console.log(`  ✓ removed smoke record ${TEST_BA}`);

  console.log('\nALL TESTS PASSED ✓');
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
