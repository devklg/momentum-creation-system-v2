/**
 * Callback-request domain. The prospect's soft-CTA submission from
 * Section 10 of tm-video-presentation (Chat #109).
 *
 * Architecture:
 *   - Mongo `callback_requests` stores each request with a stable
 *     callbackRequestId. Multiple requests per prospect over time are
 *     allowed (Chat #105 spec amendment) — these are independent intent
 *     records, not lifecycle states.
 *   - Neo4j writes (:TmagProspect)-[:REQUESTED_CALLBACK {intent, at}]->(:TeamMagnificentMember)
 *     so the BA cockpit can walk the graph for raised hands.
 *   - ChromaDB `mcs_callback_requests` records a semantically searchable
 *     event for /admin live operations.
 *   - Telnyx SMS to the BA is fired AFTER the triple-stack write commits.
 *     SMS failure is captured on the record (smsDeliveryStatus) but does
 *     NOT fail the request — the prospect's submission landed, and the
 *     BA cockpit alert is the canonical surface anyway.
 *
 * Sponsor immutability (locked-spec Part 3.5):
 *   - sponsorTmagId is read from the token record only. The request body
 *     carries no BA fields; it cannot influence routing.
 *
 * Compliance (locked-spec Part 3.10):
 *   - The .com response confirms with the BA's first name, never makes
 *     income/placement claims, never echoes the prospect's intent in a
 *     way that implies the BA's response.
 */

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeOperational } from '../services/tieredWrite.js';
import { sendSms, TelnyxConfigError, TelnyxError } from '../services/telnyx.js';
import type {
  McsCallbackIntent,
  McsCallbackRequestRecord,
  McsIsoTimestamp,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const MONGO_COLLECTION = 'tmag_prospect_callback_requests';
const CHROMA_COLLECTION = 'mcs_prospect_callback_requests';

export interface CreateCallbackRequestInput {
  token: string;
  prospectId: string;
  prospectFirstName: string;
  prospectLastInitial: string;
  sponsorTmagId: string;
  baFirstName: string;
  baPhone: string | null;
  intent: McsCallbackIntent;
}

export interface CreateCallbackRequestResult {
  callbackRequestId: string;
  createdAt: McsIsoTimestamp;
  smsDeliveryStatus: McsCallbackRequestRecord['smsDeliveryStatus'];
  smsDeliveryError: string | null;
}

/**
 * Map the intent discriminator to BA-facing copy used in the SMS and
 * the activity timeline. Keep this in lockstep with the radio labels
 * rendered in Section 10 of tm-video-presentation; if a label changes,
 * change it here too.
 */
export function intentLabel(intent: McsCallbackIntent): string {
  switch (intent) {
    case 'interested_tell_me_more':
      return "interested \u2014 tell me more";
    case 'have_questions':
      return 'have questions';
    case 'ready_to_join':
      return 'ready to join';
  }
}

function buildSmsBody(input: CreateCallbackRequestInput): string {
  // Pattern: "[Prospect first + last initial] picked '[intent]' on your
  // Team Magnificent page. Reach out when you can."
  // Compliance: factual, no income claims, no urgency theater. The BA
  // already knows who they invited; this confirms which intent landed.
  const name = `${input.prospectFirstName} ${input.prospectLastInitial}.`;
  const label = intentLabel(input.intent);
  return (
    `${name} picked "${label}" on your Team Magnificent page. ` +
    `Reach out when you can.`
  );
}

/**
 * Create a callback-request record and fire the BA SMS.
 *
 * Sequence:
 *   1. Triple-stack write of the record (Mongo + Neo4j edge + Chroma event)
 *   2. Fire Telnyx SMS (best-effort; record the outcome)
 *   3. Patch the record with the SMS outcome and return
 *
 * Returns the persisted record metadata regardless of SMS success.
 */
export async function createCallbackRequest(
  input: CreateCallbackRequestInput,
): Promise<CreateCallbackRequestResult> {
  const callbackRequestId = `cbreq_${randomUUID()}`;
  const createdAt = new Date().toISOString();

  // 1. Triple-stack write.
  const baseRecord: Omit<
    McsCallbackRequestRecord,
    'smsDeliveryStatus' | 'smsDeliveryError'
  > = {
    callbackRequestId,
    token: input.token,
    prospectId: input.prospectId,
    sponsorTmagId: input.sponsorTmagId,
    intent: input.intent,
    createdAt,
  };

  await writeOperational({
    id: callbackRequestId,
    mongoCollection: MONGO_COLLECTION,
    mongoDoc: {
      ...baseRecord,
      smsDeliveryStatus: 'queued',
      smsDeliveryError: null,
    },
    neo4j: {
      cypher:
        'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
        'MERGE (b:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
        'CREATE (p)-[r:REQUESTED_CALLBACK {' +
        '  callbackRequestId: $id, ' +
        '  intent: $intent, ' +
        '  createdAt: $createdAt' +
        '}]->(b)',
      params: {
        prospectId: input.prospectId,
        sponsorTmagId: input.sponsorTmagId,
        intent: input.intent,
        createdAt,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `${input.prospectFirstName} ${input.prospectLastInitial}. ` +
        `requested callback (${intentLabel(input.intent)}) · ` +
        `invited by ${input.sponsorTmagId} at ${createdAt}`,
      metadata: {
        kind: 'callback_request',
        callbackRequestId,
        prospectId: input.prospectId,
        sponsorTmagId: input.sponsorTmagId,
        intent: input.intent,
        createdAt,
      },
    },
  });

  // 2. Telnyx SMS. Best-effort. We always return success to the prospect.
  let smsDeliveryStatus: McsCallbackRequestRecord['smsDeliveryStatus'] = 'queued';
  let smsDeliveryError: string | null = null;

  if (!input.baPhone) {
    smsDeliveryStatus = 'skipped';
    smsDeliveryError = 'ba_phone_missing';
  } else {
    try {
      await sendSms({ to: input.baPhone, text: buildSmsBody(input) });
      smsDeliveryStatus = 'sent';
    } catch (err) {
      smsDeliveryStatus = 'failed';
      if (err instanceof TelnyxConfigError || err instanceof TelnyxError) {
        smsDeliveryError = err.message;
      } else if (err instanceof Error) {
        smsDeliveryError = err.message;
      } else {
        smsDeliveryError = 'unknown_sms_failure';
      }
      // eslint-disable-next-line no-console
      console.error(
        `[callback-request ${callbackRequestId}] SMS to BA failed:`,
        smsDeliveryError,
      );
    }
  }

  // 3. Patch the SMS outcome onto the record so /admin and the BA cockpit
  //    can surface delivery state.
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: MONGO_COLLECTION,
    filter: { _id: callbackRequestId },
    update: {
      $set: {
        smsDeliveryStatus,
        smsDeliveryError,
        smsDeliveredAt: smsDeliveryStatus === 'sent' ? new Date().toISOString() : null,
      },
    },
  });

  return {
    callbackRequestId,
    createdAt,
    smsDeliveryStatus,
    smsDeliveryError,
  };
}
