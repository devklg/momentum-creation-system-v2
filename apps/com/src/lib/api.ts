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
  ComProspectCopy,
  EnrolledResponse,
  ExpiredResponse,
  ProspectLoginRedeemPayload,
  ProspectLoginRedeemResponse,
  ProspectLoginStartPayload,
  ProspectLoginStartResponse,
  TeamStatsResponse,
  TokenState,
  VideoEventKind,
  VideoEventPayload,
  VideoEventResponse,
  WebinarReservationPayload,
  WebinarReservationResponse,
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
  tmagId: string;
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
  /**
   * Next upcoming webinar event resolved server-side at /api/p/:token,
   * or null when no upcoming event is seeded. Threaded through to the
   * dashboard so Section 6's Countdown can render a real ticking
   * countdown to scheduledFor. Chat #115.
   */
  nextEvent: {
    eventId: string;
    scheduledFor: string;
    hosts: string[];
  } | null;
  /**
   * Master-content-resolved copy for the .com prospect surfaces (TASK-147
   * inherit-com). Resolved + interpolated server-side through the
   * inheritance chain (code default → master override) and carried here so
   * the presentation hero + dashboard sections render Kevin's overrides.
   * Optional/null-tolerant: an older server or a master-content read failure
   * leaves it absent, and every consumer falls back to its built-in copy.
   */
  copy?: ComProspectCopy | null;
}

/**
 * Resolve-token error union per locked-spec Part 4.9 payload contracts.
 *
 *   F.1 invalid_token (404)  — no BA contact, we don't know who they are
 *   F.2 expired      (410)   — carries BA firstName, lastInitial, phoneE164
 *                              for the tap-to-text helper view; phoneE164
 *                              is E.164 raw (e.g. "+13235551234") or null
 *                              if the BA has no phone on record. Client
 *                              formats for display and uses the same string
 *                              in `tel:` links + clipboard SMS helpers.
 *   E.2 enrolled     (409)   — carries BA firstName, lastName, fullName.
 *                              No phone (prospect already has BA's number
 *                              from the original invitation).
 *   F.4-F.6 network          — no payload; client shows soft degrade.
 */
export type ResolveTokenError =
  | { kind: 'invalid_token' }
  | { kind: 'expired'; expiredAt: string; ba: ExpiredResponse['ba'] }
  | { kind: 'enrolled'; ba: EnrolledResponse['ba'] }
  | { kind: 'network' };

export type VideoEventError =
  | { kind: 'invalid_token' }
  | { kind: 'expired'; expiredAt: string; ba: ExpiredResponse['ba'] }
  | { kind: 'enrolled'; ba: EnrolledResponse['ba'] }
  | { kind: 'network' };

export async function resolveToken(
  token: string,
): Promise<{ ok: true; data: ResolveTokenResponse } | { ok: false; error: ResolveTokenError }> {
  return resolveTokenAt('/api/p', token);
}

export async function resolveRvmToken(
  token: string,
): Promise<{ ok: true; data: ResolveTokenResponse } | { ok: false; error: ResolveTokenError }> {
  return resolveTokenAt('/api/rvm', token);
}

async function resolveTokenAt(
  apiBase: '/api/p' | '/api/rvm',
  token: string,
): Promise<{ ok: true; data: ResolveTokenResponse } | { ok: false; error: ResolveTokenError }> {
  try {
    const res = await fetch(`${apiBase}/${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) return { ok: false, error: { kind: 'invalid_token' } };
    if (res.status === 410) {
      const body = (await res.json().catch(() => ({}))) as Partial<ExpiredResponse>;
      return {
        ok: false,
        error: {
          kind: 'expired',
          expiredAt: body.expiredAt ?? '',
          ba: body.ba ?? { firstName: '', lastInitial: '', phoneE164: null },
        },
      };
    }
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as Partial<EnrolledResponse>;
      return {
        ok: false,
        error: {
          kind: 'enrolled',
          ba: body.ba ?? { firstName: '', lastName: '', fullName: '' },
        },
      };
    }
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
  return postVideoEventAt('/api/p', token, kind);
}

export async function postRvmVideoEvent(
  token: string,
  kind: VideoEventKind,
): Promise<{ ok: true; data: VideoEventResponse } | { ok: false; error: VideoEventError }> {
  return postVideoEventAt('/api/rvm', token, kind);
}

async function postVideoEventAt(
  apiBase: '/api/p' | '/api/rvm',
  token: string,
  kind: VideoEventKind,
): Promise<{ ok: true; data: VideoEventResponse } | { ok: false; error: VideoEventError }> {
  try {
    const payload: VideoEventPayload = { kind };
    const res = await fetch(`${apiBase}/${encodeURIComponent(token)}/video-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 404) return { ok: false, error: { kind: 'invalid_token' } };
    if (res.status === 410) {
      const body = (await res.json().catch(() => ({}))) as Partial<ExpiredResponse>;
      return {
        ok: false,
        error: {
          kind: 'expired',
          expiredAt: body.expiredAt ?? '',
          ba: body.ba ?? { firstName: '', lastInitial: '', phoneE164: null },
        },
      };
    }
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as Partial<EnrolledResponse>;
      return {
        ok: false,
        error: {
          kind: 'enrolled',
          ba: body.ba ?? { firstName: '', lastName: '', fullName: '' },
        },
      };
    }
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
  | { kind: 'expired'; expiredAt: string; ba: ExpiredResponse['ba'] }
  | { kind: 'enrolled'; ba: EnrolledResponse['ba'] }
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
  return postCallbackRequestAt('/api/p', token, intent);
}

export async function postRvmCallbackRequest(
  token: string,
  intent: CallbackIntent,
): Promise<
  { ok: true; data: CallbackRequestResponse } | { ok: false; error: CallbackRequestError }
> {
  return postCallbackRequestAt('/api/rvm', token, intent);
}

async function postCallbackRequestAt(
  apiBase: '/api/p' | '/api/rvm',
  token: string,
  intent: CallbackIntent,
): Promise<
  { ok: true; data: CallbackRequestResponse } | { ok: false; error: CallbackRequestError }
> {
  try {
    const payload: CallbackRequestPayload = { intent };
    const res = await fetch(`${apiBase}/${encodeURIComponent(token)}/callback-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 400) return { ok: false, error: { kind: 'invalid_intent' } };
    if (res.status === 404) return { ok: false, error: { kind: 'invalid_token' } };
    if (res.status === 410) {
      const body = (await res.json().catch(() => ({}))) as Partial<ExpiredResponse>;
      return {
        ok: false,
        error: {
          kind: 'expired',
          expiredAt: body.expiredAt ?? '',
          ba: body.ba ?? { firstName: '', lastInitial: '', phoneE164: null },
        },
      };
    }
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as Partial<EnrolledResponse>;
      return {
        ok: false,
        error: {
          kind: 'enrolled',
          ba: body.ba ?? { firstName: '', lastName: '', fullName: '' },
        },
      };
    }
    if (!res.ok) return { ok: false, error: { kind: 'network' } };

    const data = (await res.json()) as CallbackRequestResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

// ============================================================================
// Webinar reservation (Chat #114 — Section 6 of tm-prospect-dashboard)
// ============================================================================

export type WebinarReservationError =
  | { kind: 'invalid_name' }
  | { kind: 'invalid_email' }
  | { kind: 'no_upcoming_event' }
  | { kind: 'invalid_token' }
  | { kind: 'expired'; expiredAt: string; ba: ExpiredResponse['ba'] }
  | { kind: 'enrolled'; ba: EnrolledResponse['ba'] }
  | { kind: 'network' };

export type { WebinarReservationResponse };

/**
 * Submit a webinar reservation for the next upcoming Team Magnificent
 * live event. Server resolves the event from `webinar_events`; the
 * client never picks which event.
 *
 * Email delivery to the prospect waits on locked-spec Part 5 (email
 * provider TBD). The response's `emailSent` flag tells the client which
 * confirmation copy to render. The BA always gets a Telnyx SMS alert
 * regardless.
 */
export async function postWebinarReservation(
  token: string,
  payload: WebinarReservationPayload,
): Promise<
  { ok: true; data: WebinarReservationResponse } | { ok: false; error: WebinarReservationError }
> {
  return postWebinarReservationAt('/api/p', token, payload);
}

export async function postRvmWebinarReservation(
  token: string,
  payload: WebinarReservationPayload,
): Promise<
  { ok: true; data: WebinarReservationResponse } | { ok: false; error: WebinarReservationError }
> {
  return postWebinarReservationAt('/api/rvm', token, payload);
}

async function postWebinarReservationAt(
  apiBase: '/api/p' | '/api/rvm',
  token: string,
  payload: WebinarReservationPayload,
): Promise<
  { ok: true; data: WebinarReservationResponse } | { ok: false; error: WebinarReservationError }
> {
  try {
    const res = await fetch(`${apiBase}/${encodeURIComponent(token)}/webinar-reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 400) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === 'invalid_email') return { ok: false, error: { kind: 'invalid_email' } };
      return { ok: false, error: { kind: 'invalid_name' } };
    }
    if (res.status === 404) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === 'no_upcoming_event') {
        return { ok: false, error: { kind: 'no_upcoming_event' } };
      }
      return { ok: false, error: { kind: 'invalid_token' } };
    }
    if (res.status === 410) {
      const body = (await res.json().catch(() => ({}))) as Partial<ExpiredResponse>;
      return {
        ok: false,
        error: {
          kind: 'expired',
          expiredAt: body.expiredAt ?? '',
          ba: body.ba ?? { firstName: '', lastInitial: '', phoneE164: null },
        },
      };
    }
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as Partial<EnrolledResponse>;
      return {
        ok: false,
        error: {
          kind: 'enrolled',
          ba: body.ba ?? { firstName: '', lastName: '', fullName: '' },
        },
      };
    }
    if (!res.ok) return { ok: false, error: { kind: 'network' } };

    const data = (await res.json()) as WebinarReservationResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

// ============================================================================
// Team stats (Chat #115 — Section 5 of tm-prospect-dashboard)
// ============================================================================

export type TeamStatsError =
  | { kind: 'invalid_token' }
  | { kind: 'expired'; expiredAt: string; ba: ExpiredResponse['ba'] }
  | { kind: 'enrolled'; ba: EnrolledResponse['ba'] }
  | { kind: 'network' };

export type { TeamStatsResponse };

/**
 * Fetch live team activity counts for the dashboard Section 5 grid.
 * Replaces the four seeded constants with real, server-computed metrics.
 * On error, the section falls back to em-dash placeholders — a missing
 * live-counter on a marketing surface is a non-event.
 *
 * No retry, no polling — v1 fetches once on mount. When the prospect
 * returns to the dashboard, a fresh mount triggers a fresh fetch.
 */
export async function fetchTeamStats(
  token: string,
): Promise<{ ok: true; data: TeamStatsResponse } | { ok: false; error: TeamStatsError }> {
  return fetchTeamStatsAt('/api/p', token);
}

export async function fetchRvmTeamStats(
  token: string,
): Promise<{ ok: true; data: TeamStatsResponse } | { ok: false; error: TeamStatsError }> {
  return fetchTeamStatsAt('/api/rvm', token);
}

async function fetchTeamStatsAt(
  apiBase: '/api/p' | '/api/rvm',
  token: string,
): Promise<{ ok: true; data: TeamStatsResponse } | { ok: false; error: TeamStatsError }> {
  try {
    const res = await fetch(`${apiBase}/${encodeURIComponent(token)}/team-stats`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) return { ok: false, error: { kind: 'invalid_token' } };
    if (res.status === 410) {
      const body = (await res.json().catch(() => ({}))) as Partial<ExpiredResponse>;
      return {
        ok: false,
        error: {
          kind: 'expired',
          expiredAt: body.expiredAt ?? '',
          ba: body.ba ?? { firstName: '', lastInitial: '', phoneE164: null },
        },
      };
    }
    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as Partial<EnrolledResponse>;
      return {
        ok: false,
        error: {
          kind: 'enrolled',
          ba: body.ba ?? { firstName: '', lastName: '', fullName: '' },
        },
      };
    }
    if (!res.ok) return { ok: false, error: { kind: 'network' } };

    const data = (await res.json()) as TeamStatsResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
}

// ============================================================================
// Prospect re-entry (Chat #131 — locked-spec 3.17)
// ============================================================================
//
// SMS magic-link login for returning prospects. Phone is the only
// identifier. The server returns the same opaque success body
// regardless of whether the phone matched any account — the page
// copy mirrors this to prevent probing.
//
// Cookie scope: .teammagnificent.com (set server-side on /redeem).
// Distinct from the BA .team JWT cookie.

export type ProspectLoginStartResult =
  | { ok: true }
  | { ok: false; error: 'rate_limited' | 'network' };

/**
 * Submit the phone-entry form on /p/login. The server fans out one
 * SMS per matched active account (multi-token edge case per 3.17).
 *
 * Opaque-by-design: the response NEVER reveals whether the phone
 * matched. The page copy is identical for "no match" and "N matches,
 * SMS sent": "If that phone is on file, you'll receive a text
 * shortly." Do not branch the UI on match count — there is no count.
 *
 * The only non-success response is rate_limited (429), which the UI
 * may surface as a soft "try again in a bit" hint.
 */
export async function postLoginStart(
  phone: string,
): Promise<ProspectLoginStartResult> {
  try {
    const payload: ProspectLoginStartPayload = { phone };
    const res = await fetch('/api/p/login/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    if (!res.ok) return { ok: false, error: 'network' };
    const data = (await res.json()) as ProspectLoginStartResponse;
    if (data.ok) return { ok: true };
    return { ok: false, error: 'network' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export type ProspectLoginRedeemResult =
  | { ok: true; tokenId: string }
  | { ok: false; error: 'invalid_link' | 'rate_limited' | 'network' };

/**
 * Redeem the magic link the prospect tapped from their SMS.
 *
 * Server collapses invalid_link / expired_link / already_used into
 * a single 'invalid_link' shape — the redeem page renders one view
 * for all three (locked-spec 3.17 anti-leak rule).
 *
 * On success the server has already set the mcs_prospect_session
 * cookie scoped to .teammagnificent.com. The client follows up with
 * a redirect to /p/{tokenId}.
 */
export async function postLoginRedeem(
  linkToken: string,
): Promise<ProspectLoginRedeemResult> {
  try {
    const payload: ProspectLoginRedeemPayload = { linkToken };
    const res = await fetch('/api/p/login/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    if (res.status === 400) return { ok: false, error: 'invalid_link' };
    if (!res.ok) return { ok: false, error: 'network' };
    const data = (await res.json()) as ProspectLoginRedeemResponse;
    if (data.ok) return { ok: true, tokenId: data.tokenId };
    return { ok: false, error: 'invalid_link' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

