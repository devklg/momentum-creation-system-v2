/**
 * Team-stats domain. Powers the dashboard Section 5 (TM Advantage)
 * live activity grid. Replaces the four seeded constants (47/213/89/+38%)
 * with real counts queried from MongoDB at request time.
 *
 * Locked Chat #115 — metric definitions per Kevin's lock:
 *
 *   basActive24h
 *     count(team_magnificent_members WHERE lastLoginAt > now - 24h)
 *     Active = logged into .team in the last 24 hours.
 *     Soft caveat: this number will read low until the .team cockpit
 *     ships and BAs log in regularly. That's truth, not a bug.
 *
 *   invitationsSentToday
 *     count(invite_tokens WHERE createdAt >= today 00:00 UTC)
 *     UTC daily reset chosen because the pool is team-wide and
 *     timezone-agnostic. Resets at midnight UTC every day.
 *
 *   newPlacements24h
 *     count(pool_placements WHERE placedAt > now - 24h)
 *     Rolling 24-hour window, not calendar-day.
 *
 *   recruitmentVelocityPct
 *     this7d = count(team_magnificent_members WHERE createdAt > now - 7d)
 *     prior7d = count(team_magnificent_members WHERE createdAt BETWEEN now-14d AND now-7d)
 *     velocity = ((this7d - prior7d) / max(1, prior7d)) * 100
 *     Signed integer (rounded). Positive = team is accelerating;
 *     negative = team is decelerating. When prior7d = 0, we cap the
 *     denominator at 1 to avoid divide-by-zero — the resulting % is
 *     directionally honest (any growth from a zero baseline reads as
 *     a huge positive number, which is fine).
 *
 * Compliance (locked-spec 3.10):
 *   These four numbers describe TEAM ACTIVITY — they make no income
 *   claim, no rank claim, no placement promise. They demonstrate
 *   real recruiting activity in real time. Safe for .com surfaces.
 *
 * Performance notes:
 *   All four queries run in parallel via Promise.all. Aggregate with
 *   $match + $count is the cheap path — server-side count without
 *   transferring documents. At v1 team size (41 BAs, growing) every
 *   query is sub-millisecond. When the team is 10k+ BAs we may want
 *   to cache the result for 30-60 seconds; flagged for future.
 */

import { gatewayCall } from '../services/gateway.js';

export interface TeamStats {
  /** BAs who logged into .team in the last 24h. */
  basActive24h: number;
  /** Invite tokens minted since 00:00 UTC today. */
  invitationsSentToday: number;
  /** Pool placements in the last 24h. */
  newPlacements24h: number;
  /**
   * Week-over-week change in new BA registrations as a signed integer
   * percentage. +38 means "this week is 38% higher than last week";
   * -12 means "this week is 12% lower". Range can exceed ±100.
   */
  recruitmentVelocityPct: number;
  /** ISO timestamp when this stats snapshot was computed. */
  computedAt: string;
}

const MONGO_DB = 'momentum';

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const MS_14D = 14 * 24 * 60 * 60 * 1000;

/**
 * Helper — run an aggregate with $match + $count and return the integer
 * count. Returns 0 if the pipeline yields no documents.
 */
async function countByMatch(
  collection: string,
  matchFilter: Record<string, unknown>,
): Promise<number> {
  const result = await gatewayCall<{ results?: Array<{ total?: number }> }>(
    'mongodb',
    'aggregate',
    {
      database: MONGO_DB,
      collection,
      pipeline: [{ $match: matchFilter }, { $count: 'total' }],
    },
  );
  return result.results?.[0]?.total ?? 0;
}

export async function computeTeamStats(): Promise<TeamStats> {
  const now = new Date();
  const nowMs = now.getTime();

  // 24h rolling windows.
  const twentyFourHoursAgo = new Date(nowMs - MS_24H).toISOString();

  // Today reset — 00:00 UTC. Construct from Date.UTC to avoid local TZ.
  const todayUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();

  // Week-over-week BA registration windows.
  const sevenDaysAgo = new Date(nowMs - MS_7D).toISOString();
  const fourteenDaysAgo = new Date(nowMs - MS_14D).toISOString();

  const [basActive24h, invitationsSentToday, newPlacements24h, this7d, prior7d] =
    await Promise.all([
      countByMatch('team_magnificent_members', {
        lastLoginAt: { $gte: twentyFourHoursAgo },
      }),
      countByMatch('invite_tokens', {
        createdAt: { $gte: todayUtcMidnight },
      }),
      countByMatch('pool_placements', {
        placedAt: { $gte: twentyFourHoursAgo },
      }),
      countByMatch('team_magnificent_members', {
        createdAt: { $gte: sevenDaysAgo },
      }),
      countByMatch('team_magnificent_members', {
        createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
      }),
    ]);

  // Velocity calc — cap denominator at 1 to avoid divide-by-zero.
  // Result rounded to nearest integer percent.
  const denominator = Math.max(1, prior7d);
  const recruitmentVelocityPct = Math.round(
    ((this7d - prior7d) / denominator) * 100,
  );

  return {
    basActive24h,
    invitationsSentToday,
    newPlacements24h,
    recruitmentVelocityPct,
    computedAt: now.toISOString(),
  };
}
