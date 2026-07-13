/**
 * Pilot cockpit reads — the two screens Kevin and Paul actually use:
 *
 *   1. The raised-hand list ("Called back — call them now"): every UNWORKED
 *      inbound callback joined to its lead + campaign, newest first, plus
 *      unattributed inbound calls (someone heard the voicemail and dialed
 *      but the caller ID matched no lead). A raised hand never quietly
 *      disappears — it leaves the list only when the lead is dispositioned
 *      (or an unattributed call is explicitly dismissed).
 *
 *   2. The per-campaign readout: dropped / voicemails left / live transfers
 *      / callbacks / callback rate. Callback rate = callbacks ÷ voicemails
 *      left. The four LeadPower campaigns are age cohorts, so this table is
 *      the pilot's entire output: what lead age is worth.
 *
 * Reads are owner-scoped from the session. No client payload can widen them.
 */

import { persistenceCall } from '../services/persistence/dispatch.js';
import type {
  McsCrmDisposition,
  McsVmPilotReadoutRow,
  McsVmRaisedHandRow,
  McsVmUnattributedInboundRow,
} from '@momentum/shared';
import { vmAudit, type VmBulkLeadRecord } from './vmProviderQueue.js';

const MONGO_DB = 'momentum';
const LEADS_COLLECTION = 'tmag_vm_bulk_leads';
const CAMPAIGNS_COLLECTION = 'tmag_vm_campaigns';
const CALLBACK_REQUESTS_COLLECTION = 'tmag_prospect_callback_requests';
const DISPOSITIONS_COLLECTION = 'tmag_prospect_crm_dispositions';
const INBOUND_CALLS_COLLECTION = 'tmag_vm_inbound_calls';
const DELIVERY_EVENTS_COLLECTION = 'tmag_vm_delivery_events';

/** Delivery-event statuses meaning "a dial left the building". */
const DROPPED_STATUSES = ['voicemail_drop_queued', 'sent'] as const;
/** Statuses meaning "a voicemail was actually left" (machine drop or human fallback). */
const VOICEMAIL_LEFT_STATUSES = ['voicemail_drop_delivered', 'voicemail_left', 'delivered'] as const;
const LIVE_TRANSFER_STATUSES = ['live_transfer_connected'] as const;
const CALLBACK_STATUSES = ['inbound_callback_received'] as const;

interface CallbackRequestDoc {
  callbackRequestId: string;
  leadId: string | null;
  vmCampaignId: string | null;
  ownerTmagId: string | null;
  createdAt: string;
}

interface InboundCallDoc {
  inboundCallId: string;
  matched: boolean;
  fromNumber: string | null;
  normalizedFromNumber: string | null;
  toNumber: string | null;
  createdAt: string;
  dismissedAt?: string | null;
}

export async function listRaisedHands(ownerTmagId: string): Promise<{
  raisedHands: McsVmRaisedHandRow[];
  unattributed: McsVmUnattributedInboundRow[];
}> {
  const callbacksResult = await persistenceCall<{ documents: CallbackRequestDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CALLBACK_REQUESTS_COLLECTION,
      filter: { ownerTmagId, leadId: { $ne: null } },
      sort: { createdAt: -1 },
      limit: 500,
    },
  );
  const callbacks = (callbacksResult.documents ?? []).filter(
    (doc): doc is CallbackRequestDoc & { leadId: string } => typeof doc.leadId === 'string',
  );

  const leadIds = [...new Set(callbacks.map((c) => c.leadId))];
  const [leadsResult, dispositionsResult] = await Promise.all([
    leadIds.length > 0
      ? persistenceCall<{ documents: VmBulkLeadRecord[] }>('mongodb', 'query', {
          database: MONGO_DB,
          collection: LEADS_COLLECTION,
          filter: { leadId: { $in: leadIds }, ownerTmagId },
          limit: leadIds.length,
        })
      : Promise.resolve({ documents: [] as VmBulkLeadRecord[] }),
    leadIds.length > 0
      ? persistenceCall<{ documents: Array<{ leadId: string; disposition: McsCrmDisposition | null }> }>(
          'mongodb',
          'query',
          {
            database: MONGO_DB,
            collection: DISPOSITIONS_COLLECTION,
            filter: { leadId: { $in: leadIds }, ownerTmagId },
            limit: leadIds.length,
          },
        )
      : Promise.resolve({ documents: [] as Array<{ leadId: string; disposition: McsCrmDisposition | null }> }),
  ]);

  const leadById = new Map((leadsResult.documents ?? []).map((l) => [l.leadId, l]));
  const dispositionByLeadId = new Map(
    (dispositionsResult.documents ?? []).map((d) => [d.leadId, d.disposition ?? null]),
  );

  const campaignIds = [
    ...new Set(
      (leadsResult.documents ?? []).map((l) => l.vmCampaignId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const campaignsResult =
    campaignIds.length > 0
      ? await persistenceCall<{ documents: Array<{ vmCampaignId: string; name: string }> }>(
          'mongodb',
          'query',
          {
            database: MONGO_DB,
            collection: CAMPAIGNS_COLLECTION,
            filter: { vmCampaignId: { $in: campaignIds } },
            limit: campaignIds.length,
          },
        )
      : { documents: [] as Array<{ vmCampaignId: string; name: string }> };
  const campaignNameById = new Map(
    (campaignsResult.documents ?? []).map((c) => [c.vmCampaignId, c.name]),
  );

  const raisedHands: McsVmRaisedHandRow[] = [];
  for (const callback of callbacks) {
    const lead = leadById.get(callback.leadId);
    // Ownership flows from the LEAD; a callback whose lead is not this
    // owner's is not shown.
    if (!lead) continue;
    const disposition = dispositionByLeadId.get(callback.leadId) ?? null;
    // Worked (dispositioned) raised hands leave the list; unresolved ones
    // stay visible no matter how old they are.
    if (disposition !== null) continue;
    raisedHands.push({
      callbackRequestId: callback.callbackRequestId,
      leadId: lead.leadId,
      vmCampaignId: lead.vmCampaignId,
      campaignName: campaignNameById.get(lead.vmCampaignId) ?? null,
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.normalizedPhone ?? lead.phone,
      city: lead.city,
      stateOrRegion: lead.stateOrRegion,
      calledBackAt: callback.createdAt,
      leadCreatedAt: lead.createdAt ?? null,
      leadStatus: lead.status ?? null,
      disposition,
    });
  }

  const unattributedResult = await persistenceCall<{ documents: InboundCallDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: INBOUND_CALLS_COLLECTION,
      // {dismissedAt: null} matches both missing and explicit null.
      filter: { matched: false, dismissedAt: null },
      sort: { createdAt: -1 },
      limit: 200,
    },
  );
  const unattributed: McsVmUnattributedInboundRow[] = (unattributedResult.documents ?? []).map(
    (doc) => ({
      inboundCallId: doc.inboundCallId,
      fromNumber: doc.fromNumber,
      normalizedFromNumber: doc.normalizedFromNumber,
      toNumber: doc.toNumber,
      calledAt: doc.createdAt,
    }),
  );

  return { raisedHands, unattributed };
}

export class VmPilotCockpitError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VmPilotCockpitError';
  }
}

/**
 * Dismiss an unattributed inbound call once Kevin has dealt with it (called
 * the number back, identified it as spam, …). Audited; never deleted.
 */
export async function dismissUnattributedInbound(
  inboundCallId: string,
  ownerTmagId: string,
): Promise<void> {
  const existing = await persistenceCall<{ documents: InboundCallDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: INBOUND_CALLS_COLLECTION,
    filter: { inboundCallId, matched: false },
    limit: 1,
  });
  if (!existing.documents?.[0]) throw new VmPilotCockpitError('inbound_call_not_found');

  const dismissedAt = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: INBOUND_CALLS_COLLECTION,
    filter: { inboundCallId },
    update: { $set: { dismissedAt, dismissedBy: ownerTmagId } },
  });
  // Read back.
  const readBack = await persistenceCall<{ documents: Array<{ dismissedAt?: string | null }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: INBOUND_CALLS_COLLECTION,
      filter: { inboundCallId },
      limit: 1,
    },
  );
  if (!readBack.documents?.[0]?.dismissedAt) {
    throw new VmPilotCockpitError('inbound_dismiss_readback_failed');
  }
  await vmAudit({
    action: 'vm.inbound.unattributed_dismissed',
    entityId: inboundCallId,
    ownerTmagId,
    summary: `Unattributed inbound call ${inboundCallId} dismissed by ${ownerTmagId}.`,
    payload: { dismissedAt },
  });
}

// ── The readout ─────────────────────────────────────────────────────────────

interface DeliveryEventLite {
  leadId: string;
  status: string;
  createdAt: string;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  if (lo === undefined || hi === undefined) return null;
  return Math.round((lo + hi) / 2);
}

/**
 * Compute one readout row from a campaign's delivery events. Exported for
 * direct unit testing of the metric math.
 */
export function computeReadoutRow(
  campaign: { vmCampaignId: string; name: string },
  events: DeliveryEventLite[],
): McsVmPilotReadoutRow {
  const droppedSet = new Set<string>(DROPPED_STATUSES);
  const vmLeftSet = new Set<string>(VOICEMAIL_LEFT_STATUSES);
  const transferSet = new Set<string>(LIVE_TRANSFER_STATUSES);
  const callbackSet = new Set<string>(CALLBACK_STATUSES);

  let dropped = 0;
  let voicemailsLeft = 0;
  let liveTransfers = 0;
  let callbacks = 0;

  // For median time-to-callback: last delivered-at per lead before its callback.
  const deliveredAtByLead = new Map<string, number[]>();
  const callbackEvents: DeliveryEventLite[] = [];

  for (const event of events) {
    if (droppedSet.has(event.status)) dropped += 1;
    if (vmLeftSet.has(event.status)) {
      voicemailsLeft += 1;
      const at = Date.parse(event.createdAt);
      if (Number.isFinite(at)) {
        const list = deliveredAtByLead.get(event.leadId) ?? [];
        list.push(at);
        deliveredAtByLead.set(event.leadId, list);
      }
    }
    if (transferSet.has(event.status)) liveTransfers += 1;
    if (callbackSet.has(event.status)) {
      callbacks += 1;
      callbackEvents.push(event);
    }
  }

  const deltas: number[] = [];
  for (const callback of callbackEvents) {
    const callbackAt = Date.parse(callback.createdAt);
    if (!Number.isFinite(callbackAt)) continue;
    const delivered = deliveredAtByLead.get(callback.leadId);
    if (!delivered || delivered.length === 0) continue;
    // Latest drop delivered BEFORE the callback.
    const priors = delivered.filter((at) => at <= callbackAt);
    if (priors.length === 0) continue;
    deltas.push(callbackAt - Math.max(...priors));
  }

  return {
    vmCampaignId: campaign.vmCampaignId,
    campaignName: campaign.name,
    dropped,
    voicemailsLeft,
    liveTransfers,
    callbacks,
    callbackRate: voicemailsLeft > 0 ? callbacks / voicemailsLeft : null,
    medianTimeToCallbackMs: median(deltas),
  };
}

export async function buildPilotReadout(ownerTmagId: string): Promise<McsVmPilotReadoutRow[]> {
  const campaignsResult = await persistenceCall<{
    documents: Array<{ vmCampaignId: string; name: string; createdAt: string }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: CAMPAIGNS_COLLECTION,
    filter: { ownerTmagId },
    sort: { createdAt: -1 },
    limit: 100,
  });
  const campaigns = campaignsResult.documents ?? [];

  const rows: McsVmPilotReadoutRow[] = [];
  for (const campaign of campaigns) {
    const eventsResult = await persistenceCall<{ documents: DeliveryEventLite[] }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: DELIVERY_EVENTS_COLLECTION,
        filter: {
          vmCampaignId: campaign.vmCampaignId,
          ownerTmagId,
          status: {
            $in: [
              ...DROPPED_STATUSES,
              ...VOICEMAIL_LEFT_STATUSES,
              ...LIVE_TRANSFER_STATUSES,
              ...CALLBACK_STATUSES,
            ],
          },
          // Dry-run rehearsals never pollute the pilot's number.
          dryRun: { $ne: true },
        },
        sort: { createdAt: 1 },
        limit: 10_000,
      },
    );
    rows.push(computeReadoutRow(campaign, eventsResult.documents ?? []));
  }
  return rows;
}
