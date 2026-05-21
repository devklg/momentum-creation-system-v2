/**
 * Webinar reservation domain (Chat #114 dashboard port).
 *
 * Architecture (parallels callbackRequest.ts):
 *   - Mongo `webinar_reservations` stores each reservation with a
 *     stable reservationId. Multiple reservations per prospect over
 *     time are allowed (each reservation is for a specific event).
 *   - Neo4j writes (:Prospect)-[:RESERVED_WEBINAR {eventId, at}]->(:WebinarEvent)
 *     so the BA cockpit can walk the graph for raised hands.
 *   - ChromaDB `mcs_webinar_reservations` records a semantically
 *     searchable event for /admin live operations.
 *   - Telnyx SMS to the BA fires AFTER the triple-stack write commits.
 *   - Email to the prospect (with Zoom link) is gated on the open
 *     locked-spec Part 5 email provider decision. Until provider is
 *     wired, emailDeliveryStatus = 'skipped' on every record and the
 *     prospect is told their BA will follow up with the link.
 *
 * Sponsor immutability (locked-spec 3.5):
 *   - sponsorBaId is read from the token record only. The request body
 *     carries no BA fields.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { sendSms, TelnyxConfigError, TelnyxError } from '../services/telnyx.js';
import type {
  IsoTimestamp,
  WebinarReservationRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const MONGO_COLLECTION = 'webinar_reservations';
const CHROMA_COLLECTION = 'mcs_webinar_reservations';

export interface CreateWebinarReservationInput {
  token: string;
  prospectId: string;
  prospectFirstName: string;
  prospectLastInitial: string;
  sponsorBaId: string;
  baFirstName: string;
  baPhone: string | null;
  eventId: string;
  scheduledFor: IsoTimestamp;
  name: string;
  email: string;
}

export interface CreateWebinarReservationResult {
  reservationId: string;
  createdAt: IsoTimestamp;
  emailDeliveryStatus: WebinarReservationRecord['emailDeliveryStatus'];
  smsDeliveryStatus: WebinarReservationRecord['smsDeliveryStatus'];
  smsDeliveryError: string | null;
}

/**
 * Build the BA-facing SMS that fires when a prospect reserves a seat.
 * Compliance-clear: factual, names the prospect + the event time, no
 * income claims, no urgency theater.
 */
function buildSmsBody(input: CreateWebinarReservationInput): string {
  const name = `${input.prospectFirstName} ${input.prospectLastInitial}.`;
  // Render the event time in the BA's local time? We don't know it here.
  // Render in ISO; the BA's SMS app shows local time on the timestamp
  // itself, and Tuesday 7pm PT is the default cadence so the BA already
  // knows when the event is. Keep the SMS terse.
  return (
    `${name} reserved a seat for the next Team Magnificent live event. ` +
    `Reach out with the Zoom link.`
  );
}

/**
 * Create a reservation, fire BA SMS, return outcome.
 *
 * Sequence:
 *   1. Triple-stack write of the record
 *   2. Fire Telnyx SMS to the BA (best-effort)
 *   3. Patch the record with SMS outcome
 *
 * Email-to-prospect is intentionally NOT attempted here. Until
 * locked-spec Part 5 email provider is decided, emailDeliveryStatus
 * is recorded as 'skipped' and the response payload's emailSent=false
 * tells the client to render "your BA will follow up" copy.
 */
export async function createWebinarReservation(
  input: CreateWebinarReservationInput,
): Promise<CreateWebinarReservationResult> {
  const reservationId = `webresv_${randomUUID()}`;
  const createdAt = new Date().toISOString();

  // 1. Triple-stack write.
  const base: Omit<
    WebinarReservationRecord,
    'emailDeliveryStatus'
    | 'emailDeliveryError'
    | 'smsDeliveryStatus'
    | 'smsDeliveryError'
  > = {
    reservationId,
    eventId: input.eventId,
    token: input.token,
    prospectId: input.prospectId,
    sponsorBaId: input.sponsorBaId,
    name: input.name,
    email: input.email,
    createdAt,
  };

  await tripleStackWrite({
    id: reservationId,
    mongoCollection: MONGO_COLLECTION,
    mongoDoc: {
      ...base,
      emailDeliveryStatus: 'skipped',
      emailDeliveryError: 'email_provider_pending_locked_spec_part_5',
      smsDeliveryStatus: 'queued',
      smsDeliveryError: null,
    },
    neo4j: {
      cypher:
        'MERGE (p:Prospect {prospectId: $prospectId}) ' +
        'MERGE (e:WebinarEvent {eventId: $eventId}) ' +
        'CREATE (p)-[r:RESERVED_WEBINAR {' +
        '  reservationId: $reservationId, ' +
        '  createdAt: $createdAt' +
        '}]->(e)',
      params: {
        prospectId: input.prospectId,
        eventId: input.eventId,
        reservationId,
        createdAt,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `${input.prospectFirstName} ${input.prospectLastInitial}. ` +
        `reserved a seat for webinar ${input.eventId} ` +
        `scheduled ${input.scheduledFor} · ` +
        `invited by ${input.sponsorBaId} at ${createdAt}`,
      metadata: {
        kind: 'webinar_reservation',
        reservationId,
        eventId: input.eventId,
        prospectId: input.prospectId,
        sponsorBaId: input.sponsorBaId,
        scheduledFor: input.scheduledFor,
        createdAt,
      },
    },
  });

  // 2. Telnyx SMS to the BA. Best-effort.
  let smsDeliveryStatus: WebinarReservationRecord['smsDeliveryStatus'] = 'queued';
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
        `[webinar-reservation ${reservationId}] SMS to BA failed:`,
        smsDeliveryError,
      );
    }
  }

  // 3. Patch SMS outcome.
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: MONGO_COLLECTION,
    filter: { _id: reservationId },
    update: {
      $set: {
        smsDeliveryStatus,
        smsDeliveryError,
        smsDeliveredAt:
          smsDeliveryStatus === 'sent' ? new Date().toISOString() : null,
      },
    },
  });

  return {
    reservationId,
    createdAt,
    emailDeliveryStatus: 'skipped',
    smsDeliveryStatus,
    smsDeliveryError,
  };
}
