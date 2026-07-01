/**
 * Preview token synthesis (Chat #134 — wireframe 3.7).
 *
 * Synthesizes a PreviewResolvedTokenPayload for an authenticated BA's
 * preview of their own replicated .com surface. ZERO persistence:
 *   - No prospect record. No invite token. No pool placement.
 *   - No alert SMS. No SSE event. No counter increment.
 *
 * The token field is a deterministic sentinel `PREVIEW-<tmagId>` that no
 * real minted token will ever collide with. Real invite tokens are 12
 * chars from a 31-char alphabet excluding 0/1/I/O/L (per access-codes
 * format); this sentinel is upper+digit+dash, prefixed `PREVIEW-`, and
 * longer than 12. Downstream /api/p/<sentinel>/* writes from the .com
 * components (video-event / callback-request / webinar-reserve / stream)
 * 404 against this sentinel — which is exactly what the sandbox demands.
 *
 * Reads from MongoDB are limited to pure-read look-ups:
 *   - findBAByTmagId(session.tmagId)       the inviting BA on the rendered page
 *   - findNextUpcomingEvent()           the dashboard's countdown target
 *   - readPoolCounter() (best-effort)   so the dashboard position card
 *                                       shows a believable "next position"
 *
 * Sponsor immutability (locked-spec 3.5) is moot here — there is no
 * prospect to bind. The synthesized ba block is the session BA themselves
 * (the BA previewing their OWN replicated page sees themselves listed as
 * the inviting BA, with a sample prospect).
 */

import { gatewayCall } from '../services/gateway.js';
import { findBAByTmagId } from './ba.js';
import { findNextUpcomingEvent } from './webinarEvent.js';
import { TEAM_POOL_ID } from './holdingTank.js';
import type { McsPreviewResolvedTokenPayload } from '@momentum/shared';

const PREVIEW_TOKEN_PREFIX = 'PREVIEW-';

/** Dr. Dan video — same constant as server/src/routes/p.ts (locked-spec 4.8). */
const DR_DAN_VIDEO_URL = 'https://www.youtube.com/embed/1IZiV7RXdCY';

/** Webinar slot copy — same constant as server/src/routes/p.ts (Chat #116). */
const WEBINAR = {
  dayOfWeek: 'Mondays & Thursdays',
  timeOfDay: '5:00 PM',
  timezone: 'America/Los_Angeles',
};

/** 8 weeks in ms — matches locked-spec 3.7 consideration window. */
const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000;

/**
 * Sample prospect baked into every preview. Chosen to be obviously
 * representative ("Sample P.") so a BA scanning the preview never
 * mistakes it for a real invite. City/state are illustrative.
 */
const SAMPLE_PROSPECT = {
  firstName: 'Sample',
  lastInitial: 'P',
  city: 'Los Angeles',
  stateOrRegion: 'CA',
  country: 'US',
} as const;

/**
 * Pure-read of the team pool counter. Returns 0 when the counter doc
 * hasn't been seeded (no placements have ever happened on this env).
 * Inlined here rather than exported from holdingTank.ts to keep the
 * private reader private and the sandbox dependency-free.
 */
async function readPoolCounterForPreview(): Promise<number> {
  try {
    const result = await gatewayCall<{ documents: Array<{ current: number }> }>(
      'mongodb',
      'query',
      {
        database: 'momentum',
        collection: 'pool_counters',
        filter: { _id: TEAM_POOL_ID },
        limit: 1,
      },
    );
    return result.documents[0]?.current ?? 0;
  } catch {
    // Best-effort. A degraded preview that shows position 1 is fine.
    return 0;
  }
}

/**
 * Synthesize the preview payload from the authed BA's id.
 *
 * Returns null only when the BA record itself is missing (the session
 * tmagId points at a deleted/never-existed record). The route layer maps
 * that to a 404 — callers must already be authed past requireAuth +
 * requireSteveComplete to reach here.
 */
export async function synthesizePreviewPayload(
  sessionTmagId: string,
): Promise<McsPreviewResolvedTokenPayload | null> {
  const ba = await findBAByTmagId(sessionTmagId);
  if (!ba) return null;

  const [nextEvent, currentMax] = await Promise.all([
    findNextUpcomingEvent(),
    readPoolCounterForPreview(),
  ]);

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAtIso = new Date(now.getTime() + EIGHT_WEEKS_MS).toISOString();

  // Show the next position the BA's prospect would land on — current
  // max + 1 — so the dashboard card reads believably. This is a READ,
  // not a write; the real counter does NOT advance.
  const previewPosition = currentMax + 1;

  return {
    token: `${PREVIEW_TOKEN_PREFIX}${ba.tmagId}`,
    state: 'video_complete',
    prospect: {
      firstName: SAMPLE_PROSPECT.firstName,
      lastInitial: SAMPLE_PROSPECT.lastInitial,
      city: SAMPLE_PROSPECT.city,
      stateOrRegion: SAMPLE_PROSPECT.stateOrRegion,
      country: SAMPLE_PROSPECT.country,
      positionNumber: previewPosition,
      placedAt: nowIso,
      expiresAt: expiresAtIso,
    },
    ba: {
      tmagId: ba.tmagId,
      firstName: ba.firstName,
      lastName: ba.lastName,
      lastInitial: ba.lastName.charAt(0).toUpperCase(),
      fullName: `${ba.firstName} ${ba.lastName}`,
    },
    videoUrl: DR_DAN_VIDEO_URL,
    webinar: WEBINAR,
    nextEvent: nextEvent
      ? {
          eventId: nextEvent.eventId,
          scheduledFor: nextEvent.scheduledFor,
          hosts: nextEvent.hosts,
        }
      : null,
    preview: true,
  };
}

/** Test-only helper: does a token string look like a preview sentinel? */
export function isPreviewToken(token: string): boolean {
  return token.startsWith(PREVIEW_TOKEN_PREFIX);
}
