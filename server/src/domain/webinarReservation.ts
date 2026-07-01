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
 *   - sponsorTmagId is read from the token record only. The request body
 *     carries no BA fields.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { sendSms, TelnyxConfigError, TelnyxError } from '../services/telnyx.js';
import { sendEmail, ResendConfigError, ResendError } from '../services/resend.js';
import type {
  McsIsoTimestamp,
  McsWebinarReservationRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const MONGO_COLLECTION = 'webinar_reservations';
const CHROMA_COLLECTION = 'mcs_webinar_reservations';

export interface CreateWebinarReservationInput {
  token: string;
  prospectId: string;
  prospectFirstName: string;
  prospectLastInitial: string;
  sponsorTmagId: string;
  baFirstName: string;
  baPhone: string | null;
  eventId: string;
  scheduledFor: McsIsoTimestamp;
  /**
   * Zoom registration URL for this event (from webinar_events.zoomUrl).
   * Included in the prospect confirmation email. May be null if the event
   * was seeded before WEBINAR_REGISTER_URL was set — the email then omits
   * the link and the BA-follow-up fallback covers it.
   */
  zoomUrl: string | null;
  name: string;
  email: string;
}

export interface CreateWebinarReservationResult {
  reservationId: string;
  createdAt: McsIsoTimestamp;
  emailDeliveryStatus: McsWebinarReservationRecord['emailDeliveryStatus'];
  smsDeliveryStatus: McsWebinarReservationRecord['smsDeliveryStatus'];
  smsDeliveryError: string | null;
}

/**
 * Format an event's UTC ISO timestamp as a human Pacific-time string,
 * e.g. "Monday, May 25 at 5:00 PM PT". Used in both the prospect email
 * and (loosely) the BA SMS so the time is unambiguous. Cadence is Mon/Thu
 * 5pm Pacific (locked Chat #116); we render in America/Los_Angeles so the
 * prospect sees the wall-clock time the host actually means.
 */
function formatPacific(iso: McsIsoTimestamp): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${date} at ${time} PT`;
}

/**
 * Build the BA-facing SMS that fires when a prospect reserves a seat.
 * Compliance-clear: factual, names the prospect + the event time, no
 * income claims, no urgency theater. (Cadence is Mon/Thu 5pm Pacific
 * since Chat #116; the SMS now states the actual session time rather
 * than relying on a fixed weekly slot the BA had to remember.)
 */
function buildSmsBody(input: CreateWebinarReservationInput): string {
  const name = `${input.prospectFirstName} ${input.prospectLastInitial}.`;
  return (
    `${name} reserved a seat for the Team Magnificent live event on ` +
    `${formatPacific(input.scheduledFor)}. Reach out and confirm.`
  );
}

/**
 * Build the prospect-facing confirmation email (plain text + HTML).
 * Carries the Zoom registration link and the session time. Compliance:
 * .com-surface rules apply — no income claims, no placement promises;
 * this is a logistics email confirming a seat (locked-spec 3.10).
 *
 * If zoomUrl is null (event seeded before the URL was set), the email
 * omits the link line and tells the prospect their host will send it.
 */
function buildProspectEmail(input: CreateWebinarReservationInput): {
  subject: string;
  text: string;
  html: string;
} {
  const when = formatPacific(input.scheduledFor);
  const subject = `You're registered — Team Magnificent live, ${when}`;

  const linkLineText = input.zoomUrl
    ? `Register on Zoom to get your join link: ${input.zoomUrl}`
    : `Your host ${input.baFirstName} will send you the Zoom link shortly.`;

  const text =
    `Hi ${input.name},\n\n` +
    `You're set for the Team Magnificent live session on ${when}.\n\n` +
    `${linkLineText}\n\n` +
    `${input.baFirstName} invited you and will be there too. ` +
    `Bring your questions.\n\n` +
    `— Team Magnificent`;

  const linkLineHtml = input.zoomUrl
    ? `<p style="margin:0 0 16px"><a href="${input.zoomUrl}" ` +
      `style="color:#C9A84C;font-weight:600">Register on Zoom to get your join link →</a></p>`
    : `<p style="margin:0 0 16px">Your host ${input.baFirstName} will send you the Zoom link shortly.</p>`;

  const html =
    `<div style="font-family:'DM Sans',Arial,sans-serif;color:#0A0A0A;` +
    `max-width:520px;margin:0 auto;line-height:1.5">` +
    `<p style="margin:0 0 16px">Hi ${input.name},</p>` +
    `<p style="margin:0 0 16px">You're set for the <strong>Team Magnificent</strong> ` +
    `live session on <strong>${when}</strong>.</p>` +
    linkLineHtml +
    `<p style="margin:0 0 16px">${input.baFirstName} invited you and will be there too. ` +
    `Bring your questions.</p>` +
    `<p style="margin:0;color:#C9A84C;font-weight:600">— Team Magnificent</p>` +
    `</div>`;

  return { subject, text, html };
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
    McsWebinarReservationRecord,
    'emailDeliveryStatus'
    | 'emailDeliveryError'
    | 'smsDeliveryStatus'
    | 'smsDeliveryError'
  > = {
    reservationId,
    eventId: input.eventId,
    token: input.token,
    prospectId: input.prospectId,
    sponsorTmagId: input.sponsorTmagId,
    name: input.name,
    email: input.email,
    createdAt,
  };

  await tripleStackWrite({
    id: reservationId,
    mongoCollection: MONGO_COLLECTION,
    mongoDoc: {
      ...base,
      emailDeliveryStatus: 'queued',
      emailDeliveryError: null,
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
        `invited by ${input.sponsorTmagId} at ${createdAt}`,
      metadata: {
        kind: 'webinar_reservation',
        reservationId,
        eventId: input.eventId,
        prospectId: input.prospectId,
        sponsorTmagId: input.sponsorTmagId,
        scheduledFor: input.scheduledFor,
        createdAt,
      },
    },
  });

  // 2. Telnyx SMS to the BA. Best-effort.
  let smsDeliveryStatus: McsWebinarReservationRecord['smsDeliveryStatus'] = 'queued';
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

  // 3. Resend email to the PROSPECT. Best-effort (Chat #116). Dormant until
  //    EMAIL_API_KEY is set + EMAIL_FROM domain verified — ResendConfigError
  //    is caught and recorded as 'skipped', leaving the BA-follow-up SMS as
  //    the live fallback. Once the key + domain land, this begins sending
  //    with no code change and the .com response flips emailSent=true.
  let emailDeliveryStatus: McsWebinarReservationRecord['emailDeliveryStatus'] = 'queued';
  let emailDeliveryError: string | null = null;

  try {
    const mail = buildProspectEmail(input);
    await sendEmail({
      to: input.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    emailDeliveryStatus = 'sent';
  } catch (err) {
    if (err instanceof ResendConfigError) {
      // Dormant state: provider not configured yet. Not a failure — skipped.
      emailDeliveryStatus = 'skipped';
      emailDeliveryError = 'email_provider_not_configured';
    } else {
      emailDeliveryStatus = 'failed';
      if (err instanceof ResendError || err instanceof Error) {
        emailDeliveryError = err.message;
      } else {
        emailDeliveryError = 'unknown_email_failure';
      }
      // eslint-disable-next-line no-console
      console.error(
        `[webinar-reservation ${reservationId}] email to prospect failed:`,
        emailDeliveryError,
      );
    }
  }

  // 4. Patch SMS + email outcomes.
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
        emailDeliveryStatus,
        emailDeliveryError,
        emailDeliveredAt:
          emailDeliveryStatus === 'sent' ? new Date().toISOString() : null,
      },
    },
  });

  return {
    reservationId,
    createdAt,
    emailDeliveryStatus,
    smsDeliveryStatus,
    smsDeliveryError,
  };
}
