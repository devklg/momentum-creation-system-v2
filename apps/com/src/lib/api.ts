/**
 * Minimal API client for apps/com.
 *
 * Endpoints consumed:
 *   GET  /api/p/:token                  — resolve token to BA + prospect + state
 *   POST /api/p/:token/video-event      — report video milestone; on 'complete'
 *                                          the server places the prospect in the
 *                                          team-wide holding tank (Chat #105)
 *   POST /api/p/:token/callback-request — submit Section 10 soft CTA (Chat #109)
 *
 * Per COM Design A.1–A.3, the token is the entire identity surface. The URL
 * carries nothing else. Sponsor immutability (locked-spec 3.5) is enforced
 * server-side; no field this client sends can influence it.
 */

import type {
  CallbackIntent,
  CallbackRequestPayload,
  CallbackRequestResponse,
  TokenState,
  VideoEventKind,
  VideoEventPayload,
  VideoEventResponse,
} from '@momentum/shared';

export interface ResolvedProspect {
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  country: string;
  positionNumber: number | null;
  placedAt: string | null;
  expiresAt: string;
}

export interface ResolvedBA {
  baId: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  fullName: string;
}

export interface ResolveTokenResponse {
  token: string;
  state: TokenState;
  prospect: ResolvedProspect;
  ba: ResolvedBA;
  videoUrl: string;
  webinar: { dayOfWeek: string; timeOfDay: string; timezone: string };
}

export type ResolveTokenError =
  | { kind: 'invalid_token' }
  | { kind: 'expired'; expiredAt: string }
  | { kind: 'enrolled' }
  | { kind: 'network' };

export type VideoEventError =
  | { kind: 'invalid_token' }
  | { kind: 'expired' }
  | { kind: 'enrolled' }
  | { kind: 'network' };

export async function resolveToken(
  token: string,
): Promise<{ ok: true; data: ResolveTokenResponse } | { ok: false; error: ResolveTokenError }> {
  try {
    const res = await fetch(`/api/p/${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) return { ok: false, error: { kind: 'invalid_token' } };
    if (res.status === 410) {
      const body = (await res.json().catch(() => ({}))) as { expiredAt?: string };
      return { ok: false, error: { kind: 'expired', expiredAt: body.expiredAt ?? '' } };
    }
    if (res.status === 409) return { ok: false, error: { kind: 'enrolled' } };
    if (!res.ok) return { ok: false, error: { kind: 'network' } };

    const data = (await res.json()) as ResolveTokenResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

/**
 * Report a video milestone to the server. Idempotent on the server side
 * — replaying the same kind is safe, replaying an earlier kind after a
 * later one is a no-op (Chat #105 transitionTokenState). On 'complete' the
 * response carries the assigned positionNumber + placedAt.
 */
export async function postVideoEvent(
  token: string,
  kind: VideoEventKind,
): Promise<{ ok: true; data: VideoEventResponse } | { ok: false; error: VideoEventError }> {
  try {
    const payload: VideoEventPayload = { kind };
    const res = await fetch(`/api/p/${encodeURIComponent(token)}/video-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 404) return { ok: false, error: { kind: 'invalid_token' } };
    if (res.status === 410) return { ok: false, error: { kind: 'expired' } };
    if (res.status === 409) return { ok: false, error: { kind: 'enrolled' } };
    if (!res.ok) return { ok: false, error: { kind: 'network' } };

    const data = (await res.json()) as VideoEventResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

// ============================================================================
// Callback request (Chat #109 — Section 10 of tm-video-presentation)
// ============================================================================

export type CallbackRequestError =
  | { kind: 'invalid_intent' }
  | { kind: 'invalid_token' }
  | { kind: 'expired' }
  | { kind: 'enrolled' }
  | { kind: 'network' };

export type { CallbackIntent, CallbackRequestResponse };

/**
 * Submit the Section 10 callback request. Two intents only:
 *   - 'interested_tell_me_more'
 *   - 'have_questions'
 *
 * The harder "I'm ready to join" lives on the post-video dashboard
 * (Chat #109 lock). No phone field — the BA already has the prospect's
 * contact info; the token resolves who the BA is.
 *
 * Server is best-effort idempotent at the SMS layer but the record
 * itself is created once per call. A user double-clicking submit will
 * land two records; the client should disable the submit button while
 * the request is in flight.
 */
export async function postCallbackRequest(
  token: string,
  intent: CallbackIntent,
): Promise<
  { ok: true; data: CallbackRequestResponse } | { ok: false; error: CallbackRequestError }
> {
  try {
    const payload: CallbackRequestPayload = { intent };
    const res = await fetch(`/api/p/${encodeURIComponent(token)}/callback-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 400) return { ok: false, error: { kind: 'invalid_intent' } };
    if (res.status === 404) return { ok: false, error: { kind: 'invalid_token' } };
    if (res.status === 410) return { ok: false, error: { kind: 'expired' } };
    if (res.status === 409) return { ok: false, error: { kind: 'enrolled' } };
    if (!res.ok) return { ok: false, error: { kind: 'network' } };

    const data = (await res.json()) as CallbackRequestResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}
