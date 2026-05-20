/**
 * Shared domain types used across server and clients.
 * Kept thin in Phase 0 — expand as Phase 1+ surfaces ship.
 */

export type IsoTimestamp = string;

/** Token lifecycle states per COM Design Section E.1. */
export type TokenState =
  | 'minted'
  | 'clicked'
  | 'video_started'
  | 'video_quarter'
  | 'video_half'
  | 'video_three_quarter'
  | 'video_complete'
  | 'callback_requested'
  | 'webinar_reserved'
  | 'enrolled'
  | 'expired';

/** Prospect intent radio choice on the dashboard callback CTA. */
export type CallbackIntent =
  | 'interested_understand_more'
  | 'ready_to_join'
  | 'specific_questions';

/** Three-stack write result returned by the gateway. */
export interface TripleStackWriteResult {
  mongo: { ok: boolean; insertedCount?: number };
  neo4j: { ok: boolean; counters?: Record<string, number> };
  chroma: { ok: boolean; verified?: boolean };
}

/**
 * Geographic location of a prospect.
 * Country is captured from day one for international rollout per
 * locked-spec Part 4.4. Use ISO 3166-1 alpha-2 codes ('US', 'CA', 'GB').
 */
export interface ProspectLocation {
  city: string;
  stateOrRegion: string;
  country: string;
}

/**
 * Prospect record. The person a BA invited via /p/{token}.
 * Per locked-spec Part 1.17, prospects are one of the two kinds of people
 * the system tracks (BAs are the other). became_customer fields enable
 * the customer-conversion metric without expanding scope into customer
 * tracking; the actual customer relationship lives in THREE International.
 */
export interface ProspectRecord {
  prospectId: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  location: ProspectLocation;
  phone: string | null;
  email: string | null;
  sponsorBaId: string;
  state: TokenState;
  positionNumber: number | null;
  placedAt: IsoTimestamp | null;
  becameCustomer: boolean;
  becameCustomerAt: IsoTimestamp | null;
  customerNote: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
}

/**
 * Invite token. Opaque 12-character string from the access-code alphabet
 * (31 chars, no 0/1/I/O/L). One prospect can have multiple tokens over time
 * if a BA re-invites them (cooldown rule locked-spec Part 5, still open).
 */
export interface InviteTokenRecord {
  token: string;
  prospectId: string;
  sponsorBaId: string;
  state: TokenState;
  createdAt: IsoTimestamp;
  clickedAt: IsoTimestamp | null;
  expiresAt: IsoTimestamp;
}

/**
 * Resolved /p/{token} payload returned by GET /api/p/:token.
 * Both prospect and BA are always present — the .com surface is never
 * anonymous per locked-spec Part 3.9.
 */
export interface ResolvedTokenPayload {
  token: string;
  state: TokenState;
  prospect: {
    firstName: string;
    lastInitial: string;
    city: string;
    stateOrRegion: string;
    country: string;
    positionNumber: number | null;
    placedAt: IsoTimestamp | null;
    expiresAt: IsoTimestamp;
  };
  ba: {
    baId: string;
    firstName: string;
    lastName: string;
    lastInitial: string;
    fullName: string;
  };
  videoUrl: string;
  webinar: { dayOfWeek: string; timeOfDay: string; timezone: string };
}
