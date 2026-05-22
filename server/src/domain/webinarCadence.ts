/**
 * Webinar cadence generator (Chat #116).
 *
 * Decision (Chat #116, Kevin): live webinars run **Mondays and Thursdays
 * at 5:00pm Pacific wall-clock time, year-round**, 60 minutes, hosted by
 * Kevin + Paul, on one recurring Zoom registration link. This closes the
 * locked-spec Part 5 webinar-cadence open question (which had been framed
 * as "weekly Tuesday 7pm PT vs every 72h" — the real answer is neither).
 *
 * This module is PURE: it computes the upcoming Mon/Thu 5pm-Pacific slots
 * over a horizon and returns them as UTC ISO timestamps. No I/O. The
 * seeder (`scripts/seed-webinar-events.ts`) consumes these and performs
 * the triple-stack writes.
 *
 * DST correctness (the whole reason this is not a one-liner):
 *   "5pm Pacific wall-clock" is NOT a fixed UTC offset. During PDT it is
 *   UTC-7; during PST it is UTC-8. Adding a hardcoded offset would drift
 *   an hour for any slot that lands on the far side of a DST transition.
 *   We resolve each date's actual America/Los_Angeles offset via
 *   Intl.DateTimeFormat and build the UTC instant from that. Over an
 *   8-week horizon seeded in May every slot is PDT, but the math is
 *   correct in every season so re-seeds across the November flip are
 *   right without code changes.
 */

const ZONE = 'America/Los_Angeles';

/** 5:00pm in 24h Pacific wall-clock terms. */
export const WEBINAR_HOUR_PACIFIC = 17;
export const WEBINAR_MINUTE_PACIFIC = 0;

/** Monday = 1, Thursday = 4 (JS getUTCDay/getDay: Sun=0..Sat=6). */
const WEBINAR_WEEKDAYS = [1, 4] as const;

/** Default seeding horizon (Chat #116: 8 weeks). */
export const DEFAULT_HORIZON_WEEKS = 8;

/** Default session length (Chat #116: Zoom set up for 1 hour maximum). */
export const WEBINAR_DURATION_MINUTES = 60;

/**
 * Find the UTC-offset (in minutes, e.g. PDT = -420, PST = -480) that the
 * America/Los_Angeles zone is observing at a given UTC instant.
 *
 * Technique: format the instant in the target zone, read back the
 * wall-clock components, treat them as if they were UTC, and the
 * difference from the real instant is the zone offset. This is the
 * standard Intl-only way to get a zone offset without a tz library.
 */
function zoneOffsetMinutes(instant: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value);
  let hour = get('hour');
  // Intl can emit '24' for midnight under hour12:false; normalize to 0.
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Build the UTC instant for a given Pacific calendar date at the webinar
 * wall-clock time (5pm). Resolves the zone offset for that specific date
 * so PDT/PST is handled correctly.
 *
 * @param y full year (e.g. 2026)
 * @param m month index 0-11
 * @param d day of month 1-31
 */
function pacificWallClockToUtc(y: number, m: number, d: number): Date {
  // First approximation: treat the wall-clock time as if it were UTC.
  const naiveUtc = Date.UTC(y, m, d, WEBINAR_HOUR_PACIFIC, WEBINAR_MINUTE_PACIFIC, 0);
  // Discover the zone offset at that approximate instant.
  const offsetMin = zoneOffsetMinutes(new Date(naiveUtc));
  // The real UTC instant is the wall-clock time minus the zone offset.
  // offsetMin is negative for Pacific (e.g. -420), so subtracting it adds
  // the hours back: 5pm PDT -> midnight UTC (00:00 next day).
  return new Date(naiveUtc - offsetMin * 60000);
}

export interface WebinarSlot {
  /** UTC instant of the session start, ISO-8601. */
  scheduledFor: string;
  /** Stable id derived from the slot date so re-seeds are idempotent. */
  eventId: string;
}

/**
 * Generate every Mon/Thu 5pm-Pacific slot strictly after `from`, up to
 * `weeks` weeks ahead. Slots already in the past relative to `from` are
 * excluded so the seeder never creates a stale "upcoming" event.
 *
 * The eventId is derived from the Pacific calendar date + weekday so the
 * same slot always produces the same id — this is what makes seeding
 * idempotent (the seeder skips an eventId that already exists).
 *
 * @param from   lower bound (exclusive). Defaults to now.
 * @param weeks  horizon length in weeks. Defaults to 8.
 */
export function generateUpcomingSlots(
  from: Date = new Date(),
  weeks: number = DEFAULT_HORIZON_WEEKS,
): WebinarSlot[] {
  const horizonEnd = new Date(from.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  const slots: WebinarSlot[] = [];

  // Walk day by day in Pacific calendar terms. Start a couple of days
  // before `from` to be safe against offset edge cases, and stop at the
  // horizon end. For each day that is a webinar weekday, compute the 5pm
  // Pacific instant and keep it if it falls in (from, horizonEnd].
  const cursor = new Date(from.getTime() - 2 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < weeks * 7 + 4; i++) {
    const dayInstant = new Date(cursor.getTime() + i * 24 * 60 * 60 * 1000);

    // Determine the Pacific calendar date for this instant.
    const pacificParts = new Intl.DateTimeFormat('en-US', {
      timeZone: ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(dayInstant);
    const py = Number(pacificParts.find((p) => p.type === 'year')?.value);
    const pm = Number(pacificParts.find((p) => p.type === 'month')?.value);
    const pd = Number(pacificParts.find((p) => p.type === 'day')?.value);
    const weekdayShort = pacificParts.find((p) => p.type === 'weekday')?.value;
    const weekdayNum =
      { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekdayShort ?? ''] ??
      -1;

    if (!WEBINAR_WEEKDAYS.includes(weekdayNum as 1 | 4)) continue;

    const startUtc = pacificWallClockToUtc(py, pm - 1, pd);
    if (startUtc.getTime() <= from.getTime()) continue;
    if (startUtc.getTime() > horizonEnd.getTime()) continue;

    const iso = startUtc.toISOString();
    const eventId = `webinar_${py}-${String(pm).padStart(2, '0')}-${String(pd).padStart(2, '0')}_1700PT`;

    // De-dup within the generated set (a slot can only appear once).
    if (!slots.some((s) => s.eventId === eventId)) {
      slots.push({ scheduledFor: iso, eventId });
    }
  }

  // Sort ascending by time so the seeder writes oldest-first.
  slots.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  return slots;
}
