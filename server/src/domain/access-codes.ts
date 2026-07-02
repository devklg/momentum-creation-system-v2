/**
 * Auth domain: access-code resolution + new BA registration.
 * Per Signup Architecture Section B.2 (10-step register transaction).
 * Per STANDING_RULE_SPONSOR_IMMUTABLE: sponsor derived from code, never from input.
 */

import { persistenceCall } from '../services/persistence/dispatch.js';

export interface AccessCodeRecord {
  _id: string; // the code itself, e.g. "TMAG-01"
  code: string;
  sponsorTmagId: string; // Team Magnificent BA ID of the sponsor
  sponsorThreeBaId: string; // sponsor's THREE International BA ID
  sponsorFirstName: string;
  sponsorLastName: string;
  active: boolean;
  createdAt: string;
}

export async function findAccessCode(code: string): Promise<AccessCodeRecord | null> {
  const result = await persistenceCall<{ documents: AccessCodeRecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'tmag_access_codes',
    filter: { code, active: true },
    limit: 1,
  });
  return result.documents.length > 0 ? result.documents[0] ?? null : null;
}
