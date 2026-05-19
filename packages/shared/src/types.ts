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
