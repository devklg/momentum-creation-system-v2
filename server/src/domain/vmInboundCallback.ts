/**
 * Inbound callback capture — "the raised hand".
 *
 * The VM dialer is outbound-first, but the Apache Leads flow is
 * callback-driven: the prospect hears the voicemail and CALLS BACK the
 * caller-ID number. Those inbound Telnyx Call Control events carry NO
 * client_state (we did not originate the call), so before this module the
 * webhook processor silently dropped every callback.
 *
 * This module:
 *   - matches the inbound caller ID against `tmag_vm_bulk_leads` by
 *     normalizedPhone (same normalizer the importer uses),
 *   - writes the raised hand into the CANONICAL CRM model
 *     (packages/shared/src/crm-lifecycle.ts, p1-54): a
 *     `tmag_prospect_callback_requests` record with intent
 *     `interested_tell_me_more`, a `callback_requested` timeline event in
 *     `tmag_prospect_timeline_events`, CRM record status
 *     `needs_follow_up`, and VM lead status `callback_requested`,
 *   - records a delivery/interest event so callback RATE per campaign is
 *     computable,
 *   - records UNMATCHED inbound calls as unattributed rows in
 *     `tmag_vm_inbound_calls` so nothing is silently dropped.
 *
 * Ownership flows from the LEAD (ownerTmagId / sponsorTmagId) — never
 * from the webhook payload.
 */

import { createHash, randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeKnowledge, writeOperational } from '../services/tieredWrite.js';
import {
  normalizeVmPhone,
  recordDeliveryEvent,
  updateLeadStatus,
  vmAudit,
  type VmBulkLeadRecord,
} from './vmProviderQueue.js';

const MONGO_DB = 'momentum';
const LEADS_COLLECTION = 'tmag_vm_bulk_leads';
const DELIVERY_EVENTS_COLLECTION = 'tmag_vm_delivery_events';
const INBOUND_CALLS_COLLECTION = 'tmag_vm_inbound_calls';
const CALLBACK_REQUESTS_COLLECTION = 'tmag_prospect_callback_requests';
const CRM_COLLECTION = 'tmag_prospect_crm_records';
const TIMELINE_COLLECTION = 'tmag_prospect_timeline_events';
const CALLBACK_CHROMA_COLLECTION = 'mcs_prospect_callback_requests';
const TIMELINE_CHROMA_COLLECTION = 'mcs_prospect_timeline_events';
const VM_CHROMA_COLLECTION = 'mcs_vm_campaigns';

/** Canonical intent for a voicemail callback (CRM_CALLBACK_INTENTS, p1-54). */
const INBOUND_CALLBACK_INTENT = 'interested_tell_me_more' as const;

/** Recorded on `tmag_vm_inbound_calls` rows. */
export interface VmInboundCallRecord {
  inboundCallId: string;
  provider: 'telnyx_call_control';
  eventType: string;
  callSessionId: string | null;
  callControlId: string | null;
  fromNumber: string | null;
  normalizedFromNumber: string | null;
  toNumber: string | null;
  matched: boolean;
  leadId: string | null;
  vmCampaignId: string | null;
  ownerTmagId: string | null;
  sponsorTmagId: string | null;
  callbackRequestId: string | null;
  createdAt: string;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * True when a Telnyx Call Control payload describes an INBOUND call —
 * a call we did not originate, therefore the raised hand.
 */
export function isInboundTelnyxCallPayload(payload: Record<string, unknown>): boolean {
  const direction = asString(payload.direction)?.toLowerCase() ?? '';
  return direction === 'incoming' || direction === 'inbound';
}

function inboundCallIdFor(callSessionId: string): string {
  return `vminb_${createHash('sha256').update(callSessionId).digest('hex').slice(0, 24)}`;
}

async function findInboundCall(inboundCallId: string): Promise<VmInboundCallRecord | null> {
  const result = await persistenceCall<{ documents: VmInboundCallRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: INBOUND_CALLS_COLLECTION,
    filter: { inboundCallId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

/**
 * Resolve the lead the caller is responding to. If several leads share the
 * caller's normalizedPhone, prefer the one most recently delivered-to
 * (delivery-event evidence), then fall back to most recently updated.
 */
export async function resolveLeadByInboundPhone(
  normalizedPhone: string,
): Promise<VmBulkLeadRecord | null> {
  const result = await persistenceCall<{ documents: VmBulkLeadRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter: { normalizedPhone },
    sort: { updatedAt: -1 },
    limit: 25,
  });
  const leads = result.documents ?? [];
  if (leads.length === 0) return null;
  if (leads.length === 1) return leads[0] ?? null;

  const leadIds = leads.map((l) => l.leadId);
  const delivered = await persistenceCall<{ documents: Array<{ leadId: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: DELIVERY_EVENTS_COLLECTION,
      filter: {
        leadId: { $in: leadIds },
        status: { $in: ['voicemail_drop_delivered', 'delivered', 'sent'] },
      },
      sort: { createdAt: -1 },
      limit: 1,
    },
  );
  const deliveredLeadId = delivered.documents?.[0]?.leadId;
  if (deliveredLeadId) {
    const match = leads.find((l) => l.leadId === deliveredLeadId);
    if (match) return match;
  }
  return leads[0] ?? null;
}

async function writeInboundCallRecord(record: VmInboundCallRecord): Promise<void> {
  await writeOperational({
    id: record.inboundCallId,
    mongoCollection: INBOUND_CALLS_COLLECTION,
    mongoDoc: record as unknown as Record<string, unknown>,
    neo4j: {
      cypher:
        'MERGE (c:TmagVmInboundCall {inboundCallId: $id}) ' +
        'SET c.eventType = $eventType, c.matched = $matched, c.leadId = $leadId, ' +
        '    c.normalizedFromNumber = $normalizedFromNumber, c.createdAt = datetime($createdAt) ' +
        'WITH c ' +
        'OPTIONAL MATCH (l:TmagVmBulkLead {leadId: $leadId}) ' +
        'FOREACH (_ IN CASE WHEN l IS NULL THEN [] ELSE [1] END | MERGE (l)-[:HAS_INBOUND_CALL]->(c))',
      params: {
        eventType: record.eventType,
        matched: record.matched,
        leadId: record.leadId,
        normalizedFromNumber: record.normalizedFromNumber,
        createdAt: record.createdAt,
      },
    },
    chroma: {
      collection: VM_CHROMA_COLLECTION,
      document:
        `Inbound VM callback call ${record.matched ? `matched to lead ${record.leadId}` : 'UNMATCHED'} ` +
        `from ${record.normalizedFromNumber ?? 'unknown number'} at ${record.createdAt}.`,
      metadata: {
        kind: 'vm_inbound_call',
        inboundCallId: record.inboundCallId,
        matched: record.matched,
        leadId: record.leadId,
        ownerTmagId: record.ownerTmagId,
        createdAt: record.createdAt,
      },
    },
  });

  // Read back — the raised hand must be provably on disk.
  const readBack = await findInboundCall(record.inboundCallId);
  if (!readBack) throw new Error('vm_inbound_call_readback_failed');
}

async function createInboundCallbackRequest(
  lead: VmBulkLeadRecord,
  inboundCallId: string,
): Promise<string> {
  const callbackRequestId = `cbreq_${randomUUID()}`;
  const createdAt = new Date().toISOString();

  await writeOperational({
    id: callbackRequestId,
    mongoCollection: CALLBACK_REQUESTS_COLLECTION,
    mongoDoc: {
      callbackRequestId,
      token: lead.token,
      prospectId: null,
      leadId: lead.leadId,
      vmCampaignId: lead.vmCampaignId,
      ownerTmagId: lead.ownerTmagId,
      sponsorTmagId: lead.sponsorTmagId,
      intent: INBOUND_CALLBACK_INTENT,
      source: 'vm_inbound_call',
      inboundCallId,
      createdAt,
      // The prospect called the BA's line directly; there is no prospect-side
      // SMS to send from this path.
      smsDeliveryStatus: 'skipped',
      smsDeliveryError: 'vm_inbound_call_no_sms',
    },
    neo4j: {
      cypher:
        'MERGE (l:TmagVmBulkLead {leadId: $leadId}) ' +
        'MERGE (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'CREATE (l)-[r:REQUESTED_CALLBACK {' +
        '  callbackRequestId: $id, intent: $intent, source: $source, createdAt: $createdAt' +
        '}]->(b)',
      params: {
        leadId: lead.leadId,
        ownerTmagId: lead.ownerTmagId,
        intent: INBOUND_CALLBACK_INTENT,
        source: 'vm_inbound_call',
        createdAt,
      },
    },
    chroma: {
      collection: CALLBACK_CHROMA_COLLECTION,
      document:
        `VM lead ${lead.firstName ?? ''} ${lead.lastName ?? ''} called back after a voicemail drop ` +
        `(interested — tell me more) · owner ${lead.ownerTmagId} at ${createdAt}`,
      metadata: {
        kind: 'callback_request',
        callbackRequestId,
        leadId: lead.leadId,
        sponsorTmagId: lead.sponsorTmagId,
        intent: INBOUND_CALLBACK_INTENT,
        source: 'vm_inbound_call',
        createdAt,
      },
    },
  });

  // Read back.
  const readBack = await persistenceCall<{ documents: Array<{ callbackRequestId: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CALLBACK_REQUESTS_COLLECTION,
      filter: { callbackRequestId },
      limit: 1,
    },
  );
  if (!readBack.documents?.[0]) throw new Error('vm_inbound_callback_request_readback_failed');
  return callbackRequestId;
}

async function appendInboundCallbackTimelineEvent(
  lead: VmBulkLeadRecord,
  callbackRequestId: string,
): Promise<void> {
  const eventId = `ptl_${randomUUID()}`;
  const occurredAt = new Date().toISOString();
  await writeKnowledge({
    id: eventId,
    mongoCollection: TIMELINE_COLLECTION,
    mongoDoc: {
      eventId,
      prospectId: null,
      crmRecordId: lead.crmRecordId,
      leadId: lead.leadId,
      leadOwnerId: lead.leadOwnerId,
      vmCampaignId: lead.vmCampaignId,
      ownerTmagId: lead.ownerTmagId,
      sponsorTmagId: lead.sponsorTmagId,
      kind: 'callback_requested',
      title: 'Prospect called back after a voicemail drop.',
      occurredAt,
      payload: {
        callbackRequestId,
        intent: INBOUND_CALLBACK_INTENT,
        source: 'vm_inbound_call',
      },
    },
    neo4j: {
      cypher:
        'MERGE (l:TmagVmBulkLead {leadId: $leadId}) ' +
        'CREATE (e:TmagProspectTimelineEvent {' +
        '  eventId: $id, kind: $kind, title: $title, occurredAt: $occurredAt, ' +
        '  ownerTmagId: $ownerTmagId, sponsorTmagId: $sponsorTmagId' +
        '}) ' +
        'CREATE (l)-[:HAS_TIMELINE_EVENT]->(e)',
      params: {
        leadId: lead.leadId,
        kind: 'callback_requested',
        title: 'Prospect called back after a voicemail drop.',
        occurredAt,
        ownerTmagId: lead.ownerTmagId,
        sponsorTmagId: lead.sponsorTmagId,
      },
    },
    chroma: {
      collection: TIMELINE_CHROMA_COLLECTION,
      document:
        `callback_requested: VM lead ${lead.leadId} called back ` +
        `(owner ${lead.ownerTmagId}) at ${occurredAt}`,
      metadata: {
        kind: 'callback_requested',
        leadId: lead.leadId,
        ownerTmagId: lead.ownerTmagId,
        sponsorTmagId: lead.sponsorTmagId,
        createdAt: occurredAt,
      },
    },
  });
}

async function markCrmRecordNeedsFollowUp(lead: VmBulkLeadRecord): Promise<void> {
  if (!lead.crmRecordId) return;
  const now = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { crmRecordId: lead.crmRecordId, status: { $ne: 'closed' } },
    update: { $set: { status: 'needs_follow_up', updatedAt: now } },
  });
  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (c:TmagProspectCrmRecord {crmRecordId: $crmRecordId}) ' +
      'WHERE c.status <> "closed" ' +
      'SET c.status = $status, c.updatedAt = $updatedAt',
    params: { crmRecordId: lead.crmRecordId, status: 'needs_follow_up', updatedAt: now },
  });
  // Read back.
  const readBack = await persistenceCall<{ documents: Array<{ status: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CRM_COLLECTION,
      filter: { crmRecordId: lead.crmRecordId },
      limit: 1,
    },
  );
  if (!readBack.documents?.[0]) throw new Error('vm_inbound_crm_record_readback_failed');
}

/**
 * Handle an inbound Telnyx Call Control event. Called by
 * processTelnyxCallControlWebhook BEFORE the client_state early-return so
 * callbacks are never swallowed. Idempotent per call_session_id.
 */
export async function processInboundTelnyxCall(
  payload: Record<string, unknown>,
  attempt: number,
): Promise<void> {
  const eventType = asString(payload.eventType) ?? 'call.webhook';
  const callSessionId = asString(payload.call_session_id);
  const callControlId = asString(payload.call_control_id);
  const from = asString(payload.from);
  const to = asString(payload.to);

  // Only call.initiated marks the raised hand; answered/hangup legs of the
  // same inbound call are acknowledged (visible in the webhook store) but
  // must not double-create callback requests.
  if (eventType !== 'call.initiated') {
    await vmAudit({
      action: 'vm.inbound.event_acknowledged',
      entityId: callSessionId ?? callControlId ?? 'unknown_call',
      ownerTmagId: null,
      summary: `Inbound Telnyx ${eventType} acknowledged (no state change).`,
      payload: { eventType, from, to },
    });
    return;
  }

  const inboundCallId = inboundCallIdFor(callSessionId ?? callControlId ?? randomUUID());

  // Idempotency: Telnyx retries webhooks and the durable queue retries jobs.
  const existing = await findInboundCall(inboundCallId);
  if (existing) return;

  const normalizedFromNumber = normalizeVmPhone(from);
  const lead = normalizedFromNumber
    ? await resolveLeadByInboundPhone(normalizedFromNumber)
    : null;
  const createdAt = new Date().toISOString();

  if (!lead) {
    // Unattributed inbound — visible, never silently dropped, and NO
    // callback_request is created without a lead.
    await writeInboundCallRecord({
      inboundCallId,
      provider: 'telnyx_call_control',
      eventType,
      callSessionId,
      callControlId,
      fromNumber: from,
      normalizedFromNumber,
      toNumber: to,
      matched: false,
      leadId: null,
      vmCampaignId: null,
      ownerTmagId: null,
      sponsorTmagId: null,
      callbackRequestId: null,
      createdAt,
    });
    await vmAudit({
      action: 'vm.inbound.unattributed',
      entityId: inboundCallId,
      ownerTmagId: null,
      summary: `Unattributed inbound call from ${normalizedFromNumber ?? from ?? 'unknown number'} recorded.`,
      payload: { from, normalizedFromNumber, to, callSessionId },
    });
    return;
  }

  // Ownership flows from the LEAD — never from the payload.
  const callbackRequestId = await createInboundCallbackRequest(lead, inboundCallId);

  await writeInboundCallRecord({
    inboundCallId,
    provider: 'telnyx_call_control',
    eventType,
    callSessionId,
    callControlId,
    fromNumber: from,
    normalizedFromNumber,
    toNumber: to,
    matched: true,
    leadId: lead.leadId,
    vmCampaignId: lead.vmCampaignId,
    ownerTmagId: lead.ownerTmagId,
    sponsorTmagId: lead.sponsorTmagId,
    callbackRequestId,
    createdAt,
  });

  await appendInboundCallbackTimelineEvent(lead, callbackRequestId);
  await markCrmRecordNeedsFollowUp(lead);

  // Canonical VM lead status for the raised hand (CRM_VM_LEAD_STATUSES).
  await updateLeadStatus(lead.leadId, 'callback_requested', {
    ownerTmagId: lead.ownerTmagId,
    callbackRequestId,
    inboundCallId,
  });
  // Read back the lead status.
  const leadReadBack = await persistenceCall<{ documents: Array<{ status: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: LEADS_COLLECTION,
      filter: { leadId: lead.leadId },
      limit: 1,
    },
  );
  if (!leadReadBack.documents?.[0]) throw new Error('vm_inbound_lead_readback_failed');

  // Attribution: campaign-scoped interest event so callback rate per
  // campaign/script is computable.
  await recordDeliveryEvent({
    provider: 'telnyx_call_control',
    leadId: lead.leadId,
    vmCampaignId: lead.vmCampaignId,
    ownerTmagId: lead.ownerTmagId,
    status: 'inbound_callback_received',
    providerMessageId: callControlId,
    providerStatus: eventType,
    dryRun: false,
    attempt,
    details: {
      inboundCallId,
      callbackRequestId,
      from,
      normalizedFromNumber,
      to,
      callSessionId,
    },
  });

  await vmAudit({
    action: 'vm.inbound.callback_captured',
    entityId: lead.leadId,
    ownerTmagId: lead.ownerTmagId,
    summary:
      `Inbound callback from ${normalizedFromNumber} matched VM lead ${lead.leadId}; ` +
      `callback request ${callbackRequestId} created with intent ${INBOUND_CALLBACK_INTENT}.`,
    payload: {
      inboundCallId,
      callbackRequestId,
      vmCampaignId: lead.vmCampaignId,
      intent: INBOUND_CALLBACK_INTENT,
    },
  });
}
