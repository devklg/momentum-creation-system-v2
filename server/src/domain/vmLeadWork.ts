/**
 * Work-the-lead — the missing verb on the VM lead table (pilot cockpit).
 *
 * Kevin and Paul answer a raised hand, have the conversation, and need to
 * RECORD it: disposition (canonical CRM_DISPOSITIONS only — the CRM model is
 * owned by Codex and is consumed, never extended), timestamped notes, a
 * follow-up reminder (canonical scheduled/due/cleared states), the invite
 * link (human-send only — the system never texts a prospect from here), and
 * permanent do-not-call suppression.
 *
 * All writes are owner-scoped from the SESSION via the lead record —
 * ownership never comes from a payload — and go through the app persistence
 * door (tieredWrite/persistenceCall) with read-backs.
 */

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeKnowledge, writeOperational } from '../services/tieredWrite.js';
import { env } from '../env.js';
import { CRM_DISPOSITIONS } from '@momentum/shared';
import type {
  McsCrmDisposition,
  McsVmLeadFollowUpRecord,
  McsVmLeadNoteRecord,
} from '@momentum/shared';
import { updateLeadStatus, vmAudit, type VmBulkLeadRecord } from './vmProviderQueue.js';

const MONGO_DB = 'momentum';
const LEADS_COLLECTION = 'tmag_vm_bulk_leads';
const CRM_COLLECTION = 'tmag_prospect_crm_records';
const NOTES_COLLECTION = 'tmag_prospect_crm_notes';
const FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';
const DISPOSITIONS_COLLECTION = 'tmag_prospect_crm_dispositions';
const TIMELINE_COLLECTION = 'tmag_prospect_timeline_events';
const SUPPRESSION_COLLECTION = 'tmag_vm_suppression_list';
const TIMELINE_CHROMA_COLLECTION = 'mcs_prospect_timeline_events';
const ACTIVITY_CHROMA_COLLECTION = 'mcs_prospect_invitation_activity';
const VM_CHROMA_COLLECTION = 'mcs_vm_campaigns';

const NOTE_MAX = 2000;

export class VmLeadWorkError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VmLeadWorkError';
  }
}

/**
 * Owner guard: the lead must exist AND belong to the calling owner.
 * Both failures surface as lead_not_found so one BA cannot probe another
 * BA's lead ids.
 */
export async function findLeadForOwner(
  leadId: string,
  ownerTmagId: string,
): Promise<VmBulkLeadRecord> {
  const result = await persistenceCall<{ documents: VmBulkLeadRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter: { leadId },
    limit: 1,
  });
  const lead = result.documents?.[0];
  if (!lead || lead.ownerTmagId !== ownerTmagId) throw new VmLeadWorkError('lead_not_found');
  return lead;
}

export function leadInviteUrl(lead: Pick<VmBulkLeadRecord, 'token'>): string | null {
  if (!lead.token) return null;
  return `${env.PROSPECT_BASE_URL.replace(/\/$/, '')}/rvm/${lead.token}`;
}

async function appendLeadTimelineEvent(
  lead: VmBulkLeadRecord,
  kind: string,
  title: string,
  payload: Record<string, unknown>,
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
      kind,
      title,
      occurredAt,
      payload,
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
        kind,
        title,
        occurredAt,
        ownerTmagId: lead.ownerTmagId,
        sponsorTmagId: lead.sponsorTmagId,
      },
    },
    chroma: {
      collection: TIMELINE_CHROMA_COLLECTION,
      document: `${kind}: ${title} (VM lead ${lead.leadId}, owner ${lead.ownerTmagId}) at ${occurredAt}`,
      metadata: {
        kind,
        leadId: lead.leadId,
        ownerTmagId: lead.ownerTmagId,
        sponsorTmagId: lead.sponsorTmagId,
        createdAt: occurredAt,
      },
    },
  });
}

// ── Disposition ─────────────────────────────────────────────────────────────

export async function getLeadDisposition(
  leadId: string,
  ownerTmagId: string,
): Promise<McsCrmDisposition | null> {
  const result = await persistenceCall<{ documents: Array<{ disposition: McsCrmDisposition | null }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { leadId, ownerTmagId },
      limit: 1,
    },
  );
  return result.documents?.[0]?.disposition ?? null;
}

export async function setLeadDisposition(input: {
  leadId: string;
  ownerTmagId: string;
  disposition: McsCrmDisposition;
}): Promise<McsCrmDisposition> {
  if (!CRM_DISPOSITIONS.includes(input.disposition)) {
    throw new VmLeadWorkError('invalid_disposition');
  }
  const lead = await findLeadForOwner(input.leadId, input.ownerTmagId);
  const existing = await getLeadDisposition(input.leadId, input.ownerTmagId);
  const now = new Date().toISOString();
  const dispoId = `crmdispo_lead_${input.leadId}`;

  if (existing !== null || (await dispositionRowExists(input.leadId, input.ownerTmagId))) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { leadId: input.leadId, ownerTmagId: input.ownerTmagId },
      update: { $set: { disposition: input.disposition, updatedAt: now } },
    });
    await persistenceCall('neo4j', 'cypher', {
      query:
        'MERGE (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'MERGE (l:TmagVmBulkLead {leadId: $leadId}) ' +
        'MERGE (b)-[r:DISPOSED]->(l) ' +
        'SET r.disposition = $disposition, r.updatedAt = $now',
      params: {
        ownerTmagId: input.ownerTmagId,
        leadId: input.leadId,
        disposition: input.disposition,
        now,
      },
    });
  } else {
    await writeKnowledge({
      id: dispoId,
      mongoCollection: DISPOSITIONS_COLLECTION,
      mongoDoc: {
        prospectId: null,
        leadId: input.leadId,
        ownerTmagId: input.ownerTmagId,
        sponsorTmagId: lead.sponsorTmagId,
        disposition: input.disposition,
        updatedAt: now,
      },
      neo4j: {
        cypher:
          'MERGE (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
          'MERGE (l:TmagVmBulkLead {leadId: $leadId}) ' +
          'MERGE (b)-[r:DISPOSED]->(l) ' +
          'SET r.disposition = $disposition, r.updatedAt = $now',
        params: {
          ownerTmagId: input.ownerTmagId,
          leadId: input.leadId,
          disposition: input.disposition,
          now,
        },
      },
      chroma: {
        collection: ACTIVITY_CHROMA_COLLECTION,
        document: `vm lead disposition '${input.disposition}' (owner ${input.ownerTmagId} -> lead ${input.leadId})`,
        metadata: {
          kind: 'vm_lead_disposition_set',
          leadId: input.leadId,
          ownerTmagId: input.ownerTmagId,
          disposition: input.disposition,
          at: now,
        },
      },
    });
  }

  // Keep the lead's CRM record aligned with the canonical disposition value.
  if (lead.crmRecordId) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: CRM_COLLECTION,
      filter: { crmRecordId: lead.crmRecordId },
      update: { $set: { disposition: input.disposition, updatedAt: now } },
    });
  }

  await appendLeadTimelineEvent(lead, 'disposition_changed', `Disposition set to ${input.disposition}.`, {
    disposition: input.disposition,
    previousDisposition: existing,
  });

  await vmAudit({
    action: 'vm.lead.disposition_set',
    entityId: input.leadId,
    ownerTmagId: input.ownerTmagId,
    summary: `VM lead ${input.leadId} dispositioned as ${input.disposition}.`,
    payload: { disposition: input.disposition, previousDisposition: existing },
  });

  // Read back.
  const readBack = await getLeadDisposition(input.leadId, input.ownerTmagId);
  if (readBack !== input.disposition) throw new VmLeadWorkError('disposition_readback_failed');
  return input.disposition;
}

async function dispositionRowExists(leadId: string, ownerTmagId: string): Promise<boolean> {
  const result = await persistenceCall<{ count?: number; documents?: unknown[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: DISPOSITIONS_COLLECTION,
    filter: { leadId, ownerTmagId },
    limit: 1,
  });
  return (result.count ?? result.documents?.length ?? 0) > 0;
}

// ── Notes ───────────────────────────────────────────────────────────────────

export async function addLeadNote(input: {
  leadId: string;
  ownerTmagId: string;
  text: string;
}): Promise<McsVmLeadNoteRecord> {
  const trimmed = input.text.trim();
  if (!trimmed) throw new VmLeadWorkError('empty_note');
  if (trimmed.length > NOTE_MAX) throw new VmLeadWorkError('note_too_long');

  const lead = await findLeadForOwner(input.leadId, input.ownerTmagId);
  const noteId = `crmnote_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const record: McsVmLeadNoteRecord = {
    noteId,
    leadId: input.leadId,
    ownerTmagId: input.ownerTmagId,
    text: trimmed,
    createdAt,
  };

  await writeKnowledge({
    id: noteId,
    mongoCollection: NOTES_COLLECTION,
    mongoDoc: { ...record, prospectId: null, sponsorTmagId: lead.sponsorTmagId },
    neo4j: {
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'MERGE (l:TmagVmBulkLead {leadId: $leadId}) ' +
        'CREATE (n:TmagCrmNote {noteId: $id, text: $text, at: $createdAt, ownerTmagId: $ownerTmagId}) ' +
        'CREATE (b)-[:WROTE_NOTE]->(n) ' +
        'CREATE (n)-[:ABOUT]->(l)',
      params: { ownerTmagId: input.ownerTmagId, leadId: input.leadId, text: trimmed, createdAt },
    },
    chroma: {
      collection: ACTIVITY_CHROMA_COLLECTION,
      document: `vm lead note (owner ${input.ownerTmagId} about lead ${input.leadId}): ${trimmed}`,
      metadata: {
        kind: 'vm_lead_note',
        leadId: input.leadId,
        ownerTmagId: input.ownerTmagId,
        at: createdAt,
      },
    },
  });

  await appendLeadTimelineEvent(lead, 'note_added', 'Note added after a conversation.', { noteId });

  // Read back.
  const readBack = await persistenceCall<{ documents: Array<{ noteId: string }> }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: NOTES_COLLECTION,
    filter: { noteId },
    limit: 1,
  });
  if (!readBack.documents?.[0]) throw new VmLeadWorkError('note_readback_failed');
  return record;
}

export async function listLeadNotes(
  leadId: string,
  ownerTmagId: string,
): Promise<McsVmLeadNoteRecord[]> {
  const result = await persistenceCall<{ documents: McsVmLeadNoteRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: NOTES_COLLECTION,
    filter: { leadId, ownerTmagId },
    sort: { createdAt: -1 },
    limit: 200,
  });
  return result.documents ?? [];
}

// ── Follow-up (canonical scheduled / due / cleared) ────────────────────────

export async function getActiveLeadFollowUp(
  leadId: string,
  ownerTmagId: string,
): Promise<McsVmLeadFollowUpRecord | null> {
  const result = await persistenceCall<{ documents: McsVmLeadFollowUpRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: FOLLOWUPS_COLLECTION,
    filter: { leadId, ownerTmagId, clearedAt: null },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

export async function setLeadFollowUp(input: {
  leadId: string;
  ownerTmagId: string;
  dueAt: string;
}): Promise<McsVmLeadFollowUpRecord> {
  const dueMs = new Date(input.dueAt).getTime();
  if (Number.isNaN(dueMs)) throw new VmLeadWorkError('invalid_due_at');
  if (dueMs <= Date.now()) throw new VmLeadWorkError('due_at_in_past');

  const lead = await findLeadForOwner(input.leadId, input.ownerTmagId);
  const dueAtIso = new Date(dueMs).toISOString();
  const now = new Date().toISOString();
  const existing = await getActiveLeadFollowUp(input.leadId, input.ownerTmagId);

  let record: McsVmLeadFollowUpRecord;
  if (existing) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { leadId: input.leadId, ownerTmagId: input.ownerTmagId, clearedAt: null },
      update: { $set: { dueAt: dueAtIso, updatedAt: now } },
    });
    record = { ...existing, dueAt: dueAtIso };
  } else {
    const followUpId = `crmfup_${randomUUID()}`;
    record = {
      followUpId,
      leadId: input.leadId,
      ownerTmagId: input.ownerTmagId,
      dueAt: dueAtIso,
      createdAt: now,
      clearedAt: null,
    };
    await writeKnowledge({
      id: followUpId,
      mongoCollection: FOLLOWUPS_COLLECTION,
      mongoDoc: { ...record, prospectId: null, sponsorTmagId: lead.sponsorTmagId },
      neo4j: {
        cypher:
          'MERGE (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
          'MERGE (l:TmagVmBulkLead {leadId: $leadId}) ' +
          'MERGE (b)-[r:HAS_FOLLOWUP]->(l) ' +
          'SET r.dueAt = $dueAt, r.createdAt = $createdAt, r.followUpId = $id',
        params: { ownerTmagId: input.ownerTmagId, leadId: input.leadId, dueAt: dueAtIso, createdAt: now },
      },
      chroma: {
        collection: ACTIVITY_CHROMA_COLLECTION,
        document: `vm lead follow-up set (owner ${input.ownerTmagId} -> lead ${input.leadId}) due ${dueAtIso}`,
        metadata: {
          kind: 'vm_lead_followup_set',
          leadId: input.leadId,
          ownerTmagId: input.ownerTmagId,
          dueAt: dueAtIso,
          at: now,
        },
      },
    });
  }

  // Mirror onto the lead's CRM record so followUpDueAt is queryable there.
  if (lead.crmRecordId) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: CRM_COLLECTION,
      filter: { crmRecordId: lead.crmRecordId },
      update: { $set: { followUpDueAt: dueAtIso, updatedAt: now } },
    });
  }

  await appendLeadTimelineEvent(lead, 'follow_up_set', `Follow-up scheduled for ${dueAtIso}.`, {
    dueAt: dueAtIso,
  });
  await vmAudit({
    action: 'vm.lead.follow_up_set',
    entityId: input.leadId,
    ownerTmagId: input.ownerTmagId,
    summary: `Follow-up for VM lead ${input.leadId} due ${dueAtIso}.`,
    payload: { dueAt: dueAtIso, rescheduled: Boolean(existing) },
  });

  // Read back.
  const readBack = await getActiveLeadFollowUp(input.leadId, input.ownerTmagId);
  if (!readBack || readBack.dueAt !== dueAtIso) throw new VmLeadWorkError('follow_up_readback_failed');
  return record;
}

export async function clearLeadFollowUp(leadId: string, ownerTmagId: string): Promise<void> {
  const lead = await findLeadForOwner(leadId, ownerTmagId);
  const existing = await getActiveLeadFollowUp(leadId, ownerTmagId);
  if (!existing) return; // idempotent

  const clearedAt = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: FOLLOWUPS_COLLECTION,
    filter: { leadId, ownerTmagId, clearedAt: null },
    update: { $set: { clearedAt } },
  });
  if (lead.crmRecordId) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: CRM_COLLECTION,
      filter: { crmRecordId: lead.crmRecordId },
      update: { $set: { followUpDueAt: null, updatedAt: clearedAt } },
    });
  }
  await appendLeadTimelineEvent(lead, 'follow_up_cleared', 'Follow-up cleared.', {
    dueAt: existing.dueAt,
    clearedAt,
  });
  await vmAudit({
    action: 'vm.lead.follow_up_cleared',
    entityId: leadId,
    ownerTmagId,
    summary: `Follow-up for VM lead ${leadId} cleared.`,
    payload: { dueAt: existing.dueAt, clearedAt },
  });
}

// ── Invite (human-send only) ────────────────────────────────────────────────

/**
 * Surface the lead's existing rvm invite link so Kevin can send it HIMSELF.
 * This never sends anything to the prospect. markSent=true records the
 * BA-side "I sent this" confirmation (canonical `sms_sent` timeline kind).
 */
export async function getLeadInvite(input: {
  leadId: string;
  ownerTmagId: string;
  markSent: boolean;
}): Promise<{ inviteUrl: string; markedSent: boolean }> {
  const lead = await findLeadForOwner(input.leadId, input.ownerTmagId);
  const inviteUrl = leadInviteUrl(lead);
  if (!inviteUrl) throw new VmLeadWorkError('lead_token_missing');

  if (input.markSent) {
    await appendLeadTimelineEvent(lead, 'sms_sent', 'Invite link sent by the BA (human send).', {
      humanSend: true,
      token: lead.token,
    });
    await vmAudit({
      action: 'vm.lead.invite_marked_sent',
      entityId: input.leadId,
      ownerTmagId: input.ownerTmagId,
      summary: `Owner marked invite link sent for VM lead ${input.leadId} (human send).`,
      payload: { token: lead.token },
    });
  }
  return { inviteUrl, markedSent: input.markSent };
}

// ── Do not call (permanent suppression) ─────────────────────────────────────

export async function markLeadDoNotCall(input: {
  leadId: string;
  ownerTmagId: string;
}): Promise<void> {
  const lead = await findLeadForOwner(input.leadId, input.ownerTmagId);
  const createdAt = new Date().toISOString();
  const suppressionId = `vmsupp_${randomUUID()}`;

  // Global suppression row — honored by the existing isLeadSuppressed()
  // check ({ ownerTmagId: { $in: [owner, 'global'] } }) for every owner.
  await writeOperational({
    id: suppressionId,
    mongoCollection: SUPPRESSION_COLLECTION,
    mongoDoc: {
      suppressionId,
      ownerTmagId: 'global',
      requestedByTmagId: input.ownerTmagId,
      leadId: lead.leadId,
      normalizedPhone: lead.normalizedPhone,
      normalizedEmail: lead.normalizedEmail,
      reason: 'do_not_call',
      createdAt,
    },
    neo4j: {
      cypher:
        'MERGE (s:TmagVmSuppression {suppressionId: $id}) ' +
        'SET s.reason = "do_not_call", s.leadId = $leadId, s.normalizedPhone = $normalizedPhone, ' +
        '    s.createdAt = datetime($createdAt) ' +
        'WITH s ' +
        'OPTIONAL MATCH (l:TmagVmBulkLead {leadId: $leadId}) ' +
        'FOREACH (_ IN CASE WHEN l IS NULL THEN [] ELSE [1] END | MERGE (l)-[:SUPPRESSED_BY]->(s))',
      params: {
        leadId: lead.leadId,
        normalizedPhone: lead.normalizedPhone,
        createdAt,
      },
    },
    chroma: {
      collection: VM_CHROMA_COLLECTION,
      document:
        `Do-not-call suppression for VM lead ${lead.leadId} ` +
        `(${lead.normalizedPhone ?? 'no phone'}) requested by ${input.ownerTmagId}.`,
      metadata: {
        kind: 'vm_suppression',
        suppressionId,
        leadId: lead.leadId,
        ownerTmagId: 'global',
        createdAt,
      },
    },
  });

  // Hard delivery block on the lead itself + canonical statuses.
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter: { leadId: lead.leadId },
    update: {
      $set: {
        doNotDrop: true,
        consentStatus: 'do_not_contact',
        updatedAt: createdAt,
      },
    },
  });
  await updateLeadStatus(lead.leadId, 'suppressed', {
    ownerTmagId: lead.ownerTmagId,
    reason: 'do_not_call',
  });
  await setLeadDisposition({
    leadId: lead.leadId,
    ownerTmagId: input.ownerTmagId,
    disposition: 'do_not_contact',
  });

  await vmAudit({
    action: 'vm.lead.do_not_call',
    entityId: lead.leadId,
    ownerTmagId: input.ownerTmagId,
    summary: `VM lead ${lead.leadId} permanently suppressed (do not call).`,
    payload: { suppressionId, normalizedPhone: lead.normalizedPhone },
  });

  // Read back — suppression must be provably on disk.
  const readBack = await persistenceCall<{ documents: Array<{ suppressionId: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: SUPPRESSION_COLLECTION,
      filter: { suppressionId },
      limit: 1,
    },
  );
  if (!readBack.documents?.[0]) throw new VmLeadWorkError('suppression_readback_failed');
  const leadReadBack = await persistenceCall<{ documents: Array<{ doNotDrop?: boolean }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: LEADS_COLLECTION,
      filter: { leadId: lead.leadId },
      limit: 1,
    },
  );
  if (leadReadBack.documents?.[0]?.doNotDrop !== true) {
    throw new VmLeadWorkError('do_not_call_readback_failed');
  }
}
