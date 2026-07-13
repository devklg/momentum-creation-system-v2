/**
 * P2-107 unified BA follow-up queue.
 *
 * One read model over the canonical callback + CRM reminder collections.
 * Both prospect records and VM/RVM leads are owner-scoped from the session.
 * This module never sends, calls, scores, or writes persistent state.
 */

import type {
  McsCallbackIntent,
  McsUnifiedFollowUpItem,
  McsUnifiedFollowUpQueueResponse,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';

const MONGO_DB = 'momentum';
const CALLBACKS_COLLECTION = 'tmag_prospect_callback_requests';
const FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const VM_LEADS_COLLECTION = 'tmag_vm_bulk_leads';
const CALLBACK_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

interface CallbackRow {
  callbackRequestId?: string;
  prospectId?: string | null;
  leadId?: string | null;
  sponsorTmagId?: string;
  ownerTmagId?: string;
  intent: McsCallbackIntent;
  createdAt: string;
}

interface FollowUpRow {
  followUpId?: string;
  prospectId?: string | null;
  leadId?: string | null;
  sponsorTmagId?: string;
  ownerTmagId?: string;
  dueAt: string;
  clearedAt: string | null;
}

interface PersonRow {
  prospectId: string;
  firstName: string;
  lastName?: string;
  lastInitial?: string;
}

interface VmLeadRow {
  leadId: string;
  firstName: string | null;
  lastName: string | null;
}

function lastInitial(lastName: string | null | undefined, stored?: string): string {
  return stored ?? lastName?.trim().charAt(0).toUpperCase() ?? '';
}

function entityKey(row: Pick<CallbackRow, 'prospectId' | 'leadId'>): string | null {
  if (row.prospectId) return `prospect:${row.prospectId}`;
  if (row.leadId) return `vm_lead:${row.leadId}`;
  return null;
}

function priority(item: McsUnifiedFollowUpItem): number {
  if (item.status === 'raised_hand') return 0;
  if (item.status === 'overdue') return 1;
  return 2;
}

export async function getUnifiedFollowUpQueue(
  ownerTmagId: string,
  now = new Date(),
): Promise<McsUnifiedFollowUpQueueResponse> {
  const nowIso = now.toISOString();
  const callbackLookbackIso = new Date(now.getTime() - CALLBACK_LOOKBACK_MS).toISOString();

  const [callbacksResult, followUpsResult, prospectsResult, leadsResult] = await Promise.all([
    persistenceCall<{ documents: CallbackRow[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: CALLBACKS_COLLECTION,
      filter: {
        $or: [{ sponsorTmagId: ownerTmagId }, { ownerTmagId }],
        createdAt: { $gte: callbackLookbackIso },
      },
      sort: { createdAt: -1 },
      limit: 1000,
    }),
    persistenceCall<{ documents: FollowUpRow[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: {
        $or: [{ sponsorTmagId: ownerTmagId }, { ownerTmagId }],
        clearedAt: null,
      },
      sort: { dueAt: 1 },
      limit: 1000,
    }),
    persistenceCall<{ documents: PersonRow[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { sponsorTmagId: ownerTmagId, deleted: { $ne: true } },
      projection: { prospectId: 1, firstName: 1, lastName: 1, lastInitial: 1 },
      limit: 2000,
    }),
    persistenceCall<{ documents: VmLeadRow[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: VM_LEADS_COLLECTION,
      filter: { ownerTmagId },
      projection: { leadId: 1, firstName: 1, lastName: 1 },
      limit: 5000,
    }),
  ]);

  const prospects = new Map((prospectsResult.documents ?? []).map((row) => [row.prospectId, row]));
  const leads = new Map((leadsResult.documents ?? []).map((row) => [row.leadId, row]));
  const items = new Map<string, McsUnifiedFollowUpItem>();

  for (const callback of callbacksResult.documents ?? []) {
    const key = entityKey(callback);
    if (!key || items.has(key)) continue;
    const prospect = callback.prospectId ? prospects.get(callback.prospectId) : undefined;
    const lead = callback.leadId ? leads.get(callback.leadId) : undefined;
    if (!prospect && !lead) continue;
    const entityKind = prospect ? 'prospect' as const : 'vm_lead' as const;
    const entityId = prospect?.prospectId ?? lead!.leadId;
    items.set(key, {
      id: callback.callbackRequestId ?? `callback:${entityId}:${callback.createdAt}`,
      entityKind,
      entityId,
      firstName: prospect?.firstName ?? lead?.firstName ?? 'Unknown',
      lastInitial: lastInitial(prospect?.lastName ?? lead?.lastName, prospect?.lastInitial),
      reason: 'callback_request',
      status: 'raised_hand',
      source: prospect ? 'prospect_crm' : 'vm_rvm',
      intent: callback.intent,
      signaledAt: callback.createdAt,
      dueAt: null,
      href: prospect ? `/cockpit#invite-${entityId}` : '/vm-campaigns',
    });
  }

  for (const followUp of followUpsResult.documents ?? []) {
    const key = entityKey(followUp);
    if (!key || items.has(key)) continue;
    const prospect = followUp.prospectId ? prospects.get(followUp.prospectId) : undefined;
    const lead = followUp.leadId ? leads.get(followUp.leadId) : undefined;
    if (!prospect && !lead) continue;
    const entityKind = prospect ? 'prospect' as const : 'vm_lead' as const;
    const entityId = prospect?.prospectId ?? lead!.leadId;
    items.set(key, {
      id: followUp.followUpId ?? `followup:${entityId}:${followUp.dueAt}`,
      entityKind,
      entityId,
      firstName: prospect?.firstName ?? lead?.firstName ?? 'Unknown',
      lastInitial: lastInitial(prospect?.lastName ?? lead?.lastName, prospect?.lastInitial),
      reason: 'crm_reminder',
      status: followUp.dueAt <= nowIso ? 'overdue' : 'upcoming',
      source: prospect ? 'prospect_crm' : 'vm_rvm',
      intent: null,
      signaledAt: null,
      dueAt: followUp.dueAt,
      href: prospect ? `/cockpit#invite-${entityId}` : '/vm-campaigns',
    });
  }

  const ordered = [...items.values()].sort((a, b) => {
    const tier = priority(a) - priority(b);
    if (tier !== 0) return tier;
    if (a.status === 'raised_hand') return (b.signaledAt ?? '').localeCompare(a.signaledAt ?? '');
    return (a.dueAt ?? '').localeCompare(b.dueAt ?? '');
  });

  return {
    ok: true,
    generatedAt: nowIso,
    manualOnly: true,
    counts: {
      total: ordered.length,
      raisedHands: ordered.filter((item) => item.status === 'raised_hand').length,
      overdue: ordered.filter((item) => item.status === 'overdue').length,
      upcoming: ordered.filter((item) => item.status === 'upcoming').length,
    },
    items: ordered,
  };
}
