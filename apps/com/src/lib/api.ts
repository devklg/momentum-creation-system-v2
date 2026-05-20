/**
 * Minimal API client for apps/com.
 *
 * The single endpoint this scaffold consumes is `GET /api/p/:token` — resolves
 * an opaque token to the inviting BA, the prospect, and the current funnel
 * state. Per COM Design Sections A.1 – A.3, the token is the entire identity
 * surface; the URL carries nothing else.
 *
 * Phase 1 will add: POST /api/p/:token/video-event, POST .../callback-request,
 * POST .../webinar-reserve, and GET .../stream (SSE for live counter + ticker).
 */

import type { TokenState } from '@momentum/shared';

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

export async function resolveToken(token: string): Promise<
  { ok: true; data: ResolveTokenResponse } | { ok: false; error: ResolveTokenError }
> {
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
