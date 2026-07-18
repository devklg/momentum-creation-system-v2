/**
 * Bulk RVM lead import domain.
 *
 * @deprecated The BA import route now uses vmProviderQueue.createManualImportJobs.
 * This legacy synchronous writer remains only for governed data reconciliation
 * ownership; do not add new call sites.
 *
 * Imported leads are acquisition records only. This module mints RVM tokens
 * and creates BA-scoped CRM records immediately, but it never calls
 * placeProspect and never inserts holding-tank rows.
 */

import { createHash, randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeGraphCritical } from '../services/tieredWrite.js';
import { mintUniqueToken, TOKEN_TTL_MS } from './tokens.js';
import { lastInitialOf } from './prospects.js';
import {
  appendProspectTimelineEvent,
  createOrUpdateCrmRecordForToken,
} from './prospectCrm.js';
import { writeProspectTokenGraphCritical } from './tokenLifecyclePersistence.js';
import { findVMCampaignForOwner } from './vmCampaigns.js';
import { markLeadOwnerImported } from './vmLeadOwners.js';
import { createFlowCorrelation, withCrmCorrelation } from './flowCorrelation.js';
import type {
  McsBulkLeadRecord,
  McsImportBulkLeadPayload,
  McsInviteTokenRecord,
  McsLeadOwnerRecord,
  McsProspectLocation,
  McsProspectRecord,
  McsVmLeadOwnerSource,
  McsVMCampaignRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const BULK_LEADS_COLLECTION = 'tmag_vm_bulk_leads';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const CHROMA_COLLECTION = 'mcs_vm_bulk_leads';

export class BulkLeadError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'BulkLeadError';
  }
}

export interface ImportBulkLeadsInput {
  ownerTmagId: string;
  sponsorTmagId: string;
  leadOwnerId: string;
  vmCampaignId: string;
  leads: McsImportBulkLeadPayload[];
}

export interface ImportBulkLeadsResult {
  leadOwner: McsLeadOwnerRecord;
  campaign: McsVMCampaignRecord;
  leads: McsBulkLeadRecord[];
}

function nonEmpty(raw: string | undefined | null): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

function normalizedOptional(raw: string | undefined | null): string | null {
  const value = nonEmpty(raw);
  return value ? value : null;
}

async function createBulkLeadRecord(input: {
  ownerTmagId: string;
  sponsorTmagId: string;
  leadOwnerId: string;
  vmCampaignId: string;
  source: string;
  lead: McsImportBulkLeadPayload;
}): Promise<McsBulkLeadRecord> {
  const firstName = nonEmpty(input.lead.firstName);
  const lastName = nonEmpty(input.lead.lastName);
  const city = nonEmpty(input.lead.city);
  const stateOrRegion = nonEmpty(input.lead.stateOrRegion);
  const country = nonEmpty(input.lead.country) || 'US';
  if (!firstName || !lastName) throw new BulkLeadError('missing_name');
  if (!city || !stateOrRegion) throw new BulkLeadError('missing_location');

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const leadId = `lead_${randomUUID()}`;
  const prospectId = `prospect_${randomUUID()}`;
  const token = await mintUniqueToken();
  const invitationRecordId = `invite_${randomUUID()}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const correlation = createFlowCorrelation({ rootKind: 'vm_rvm', rootId: leadId, leadId, vmCampaignId: input.vmCampaignId, prospectId, tokenId: token });
  const location: McsProspectLocation = { city, stateOrRegion, country };
  const lastInitial = lastInitialOf(lastName);

  const prospect: McsProspectRecord = {
    prospectId,
    firstName,
    lastName,
    lastInitial,
    location,
    phone: normalizedOptional(input.lead.phone),
    email: normalizedOptional(input.lead.email),
    sponsorTmagId: input.sponsorTmagId,
    state: 'minted',
    positionNumber: null,
    placedAt: null,
    becameCustomer: false,
    becameCustomerAt: null,
    customerNote: null,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  await writeGraphCritical({
    id: prospectId,
    mongoCollection: PROSPECTS_COLLECTION,
    mongoDoc: {
      ...prospect,
      ownerTmagId: input.ownerTmagId,
      sponsorTmagId: input.sponsorTmagId,
      token,
      source: 'rvm',
      leadId,
      leadOwnerId: input.leadOwnerId,
      vmCampaignId: input.vmCampaignId,
      sentAt: null,
      message: null,
      correlation,
    },
    neo4j: {
      cypher:
        'MATCH (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'CREATE (p:TmagProspect {prospectId: $id, firstName: $firstName, lastInitial: $lastInitial, ' +
        '  city: $city, stateOrRegion: $stateOrRegion, country: $country, state: $state, ' +
        '  ownerTmagId: $ownerTmagId, sponsorTmagId: $sponsorTmagId, source: $source, correlationId: $correlationId, createdAt: $createdAt}) ' +
        'CREATE (b)-[:OWNS_RVM_PROSPECT]->(p)',
      params: {
        ownerTmagId: input.ownerTmagId,
        sponsorTmagId: input.sponsorTmagId,
        firstName,
        lastInitial,
        city,
        stateOrRegion,
        country,
        state: 'minted',
        source: 'rvm',
        createdAt: now,
        correlationId: correlation.correlationId,
      },
      verifyCypher:
        'MATCH (b:TeamMagnificentMember {tmagId: $ownerTmagId})-[:OWNS_RVM_PROSPECT]->' +
        '(p:TmagProspect {prospectId: $id}) RETURN count(p) AS n',
      verifyParams: {
        ownerTmagId: input.ownerTmagId,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `RVM prospect ${firstName} ${lastInitial}. from ${city}, ${stateOrRegion}; ` +
        `owner ${input.ownerTmagId}; lead owner ${input.leadOwnerId}; campaign ${input.vmCampaignId}.`,
      metadata: {
        kind: 'rvm_prospect_created',
        prospectId,
        leadId,
        invitationRecordId,
        tokenHash,
        ownerTmagId: input.ownerTmagId,
        sponsorTmagId: input.sponsorTmagId,
        leadOwnerId: input.leadOwnerId,
        vmCampaignId: input.vmCampaignId,
        createdAt: now,
        correlationId: correlation.correlationId,
      },
    },
  });

  const tokenRecord: McsInviteTokenRecord & { invitationRecordId: string } = {
    token,
    invitationRecordId,
    prospectId,
    sponsorTmagId: input.sponsorTmagId,
    state: 'minted',
    createdAt: now,
    clickedAt: null,
    expiresAt,
  };
  await writeProspectTokenGraphCritical({
    token,
    prospectId,
    sponsorTmagId: input.sponsorTmagId,
    mongoDoc: {
      ...tokenRecord,
      ownerTmagId: input.ownerTmagId,
      sponsorTmagId: input.sponsorTmagId,
      source: 'rvm',
      leadId,
      leadOwnerId: input.leadOwnerId,
      vmCampaignId: input.vmCampaignId,
      correlation,
    },
    tokenProps: {
      invitationRecordId,
      prospectId,
      ownerTmagId: input.ownerTmagId,
      sponsorTmagId: input.sponsorTmagId,
      state: 'minted',
      source: 'rvm',
      createdAt: now,
      expiresAt,
      correlationId: correlation.correlationId,
    },
  });

  const bulkLead: McsBulkLeadRecord = {
    leadId,
    leadOwnerId: input.leadOwnerId,
    vmCampaignId: input.vmCampaignId,
    prospectId,
    token,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    firstName,
    lastName,
    phone: prospect.phone,
    email: prospect.email,
    city,
    stateOrRegion,
    country,
    source: input.source as McsVmLeadOwnerSource,
    status: 'token_created',
    activatedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await writeGraphCritical({
    id: leadId,
    mongoCollection: BULK_LEADS_COLLECTION,
    mongoDoc: { ...bulkLead, correlation },
    neo4j: {
      cypher:
        'MATCH (lb:TmagVmLeadOwner {leadOwnerId: $leadOwnerId}) ' +
        'MATCH (vm:TmagVmCampaign {vmCampaignId: $vmCampaignId}) ' +
        'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
        'CREATE (lead:TmagVmBulkLead {leadId: $id, tokenHash: $tokenHash, invitationRecordId: $invitationRecordId, status: $status, ' +
        '  ownerTmagId: $ownerTmagId, sponsorTmagId: $sponsorTmagId, correlationId: $correlationId, createdAt: $createdAt}) ' +
        'CREATE (lb)-[:CONTAINS_LEAD]->(lead) ' +
        'CREATE (vm)-[:TARGETS_LEAD]->(lead) ' +
        'CREATE (lead)-[:BECAME_PROSPECT_RECORD]->(p)',
      params: {
        leadOwnerId: bulkLead.leadOwnerId,
        vmCampaignId: bulkLead.vmCampaignId,
        prospectId: bulkLead.prospectId,
        tokenHash,
        invitationRecordId,
        status: bulkLead.status,
        ownerTmagId: bulkLead.ownerTmagId,
        sponsorTmagId: bulkLead.sponsorTmagId,
        createdAt: now,
        correlationId: correlation.correlationId,
      },
      verifyCypher:
        'MATCH (lb:TmagVmLeadOwner {leadOwnerId: $leadOwnerId})-[:CONTAINS_LEAD]->' +
        '(lead:TmagVmBulkLead {leadId: $id})<-[:TARGETS_LEAD]-(vm:TmagVmCampaign {vmCampaignId: $vmCampaignId}) ' +
        'MATCH (lead)-[:BECAME_PROSPECT_RECORD]->(p:TmagProspect {prospectId: $prospectId}) ' +
        'RETURN count(lead) AS n',
      verifyParams: {
        leadOwnerId: bulkLead.leadOwnerId,
        vmCampaignId: bulkLead.vmCampaignId,
        prospectId: bulkLead.prospectId,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `Bulk RVM lead ${firstName} ${lastInitial}. imported with token ${tokenHash}; ` +
        `owner ${input.ownerTmagId}; campaign ${input.vmCampaignId}.`,
      metadata: {
        kind: 'bulk_lead_imported',
        leadId,
        prospectId,
        tokenHash,
        invitationRecordId,
        ownerTmagId: input.ownerTmagId,
        leadOwnerId: input.leadOwnerId,
        vmCampaignId: input.vmCampaignId,
        createdAt: now,
        correlationId: correlation.correlationId,
      },
    },
  });

  const crm = await createOrUpdateCrmRecordForToken({
    prospectId,
    token,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    source: 'rvm',
    leadId,
    leadOwnerId: input.leadOwnerId,
    vmCampaignId: input.vmCampaignId,
    createdAt: now,
    correlation: withCrmCorrelation(correlation, `crm_${prospectId}`),
  });

  await appendProspectTimelineEvent({
    prospectId,
    crmRecordId: crm.crmRecordId,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    kind: 'token_created',
    note: 'RVM lead imported as an inactive acquisition record.',
    metadata: { leadId, leadOwnerId: input.leadOwnerId, vmCampaignId: input.vmCampaignId, correlationId: correlation.correlationId },
    createdAt: now,
  });
  await appendProspectTimelineEvent({
    prospectId,
    crmRecordId: crm.crmRecordId,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    kind: 'token_created',
    note: 'RVM token created. CRM-visible; not placed in the holding tank.',
    metadata: { leadId, tokenHash, invitationRecordId, correlationId: correlation.correlationId },
    createdAt: now,
  });

  return bulkLead;
}

export async function importBulkLeads(
  input: ImportBulkLeadsInput,
): Promise<ImportBulkLeadsResult> {
  if (input.leads.length === 0) throw new BulkLeadError('no_leads');
  if (input.leads.length > 500) throw new BulkLeadError('too_many_leads');

  const campaign = await findVMCampaignForOwner(input.vmCampaignId, input.ownerTmagId);
  if (campaign.leadOwnerId !== input.leadOwnerId) {
    throw new BulkLeadError('campaign_lead_owner_mismatch');
  }

  const created: McsBulkLeadRecord[] = [];
  for (const lead of input.leads) {
    const record = await createBulkLeadRecord({
      ownerTmagId: input.ownerTmagId,
      sponsorTmagId: input.sponsorTmagId,
      leadOwnerId: input.leadOwnerId,
      vmCampaignId: input.vmCampaignId,
      source: campaign.provider,
      lead,
    });
    created.push(record);
  }

  const leadOwner = await markLeadOwnerImported(
    input.leadOwnerId,
    input.ownerTmagId,
    created.length,
  );
  return { leadOwner, campaign, leads: created };
}

export async function findBulkLeadByToken(token: string): Promise<McsBulkLeadRecord | null> {
  const result = await persistenceCall<{ documents: McsBulkLeadRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: BULK_LEADS_COLLECTION,
    filter: { token },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}
