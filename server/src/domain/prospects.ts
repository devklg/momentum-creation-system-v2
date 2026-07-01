/**
 * Prospect domain.
 *
 * A prospect is one of the two kinds of people the system tracks (BAs are
 * the other) per locked-spec Part 1.17. A prospect record is created when
 * a BA mints an invite token on .team and the system writes both the
 * prospect record and the token record atomically (triple-stack).
 *
 * Sponsor immutability (locked-spec Part 3.5):
 *   - sponsorTmagId is stamped at creation and never recomputed.
 *   - Routes accepting prospect updates must reject any sponsorTmagId in the
 *     request body and use the existing record value.
 *
 * Customer conversion tags (locked-spec Part 1.17):
 *   - becameCustomer / becameCustomerAt / customerNote enable the metric
 *     without expanding the system into a customer pipeline.
 *
 * Position numbers (locked-spec Part 3.2, 3.7):
 *   - Assigned monotonically at video_complete.
 *   - Never reshuffle on flush — absence of position #347 is allowed; #348
 *     does not become #347.
 *   - Set in the holding-tank domain, not here.
 */

import { gatewayCall } from '../services/gateway.js';
import type { McsProspectRecord, McsProspectLocation } from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'prospects';

export interface NewProspectInput {
  prospectId: string;
  firstName: string;
  lastName: string;
  location: McsProspectLocation;
  sponsorTmagId: string;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
  expiresAt: string;
}

export function lastInitialOf(lastName: string): string {
  return lastName.trim().charAt(0).toUpperCase();
}

export async function findProspectById(prospectId: string): Promise<McsProspectRecord | null> {
  const result = await gatewayCall<{ documents: McsProspectRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId },
    limit: 1,
  });
  const doc = result.documents[0];
  return doc ?? null;
}
