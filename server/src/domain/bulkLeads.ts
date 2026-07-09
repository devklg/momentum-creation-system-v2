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

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { mintUniqueToken, TOKEN_TTL_MS } from './tokens.js';
import { lastInitialOf } from './prospects.js';
import {
  appendProspectTimelineEvent,
  createOrUpdateCrmRecordForToken,
} from './prospectCrm.js';
import { findVMCampaignForOwner } from './vmCampaigns.js';
import { markLeadOwnerImported } from './vmLeadOwners.js';
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
const TOKENS_COLLECTION = 'tmag_prospect_invite_tokens';
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

  await tripleStackWrite({
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
    },
    neo4j: {
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'CREATE (p:TmagProspect {prospectId: $id, firstName: $firstName, lastInitial: $lastInitial, ' +
        '  city: $city, stateOrRegion: $stateOrRegion, country: $country, state: $state, ' +
        '  ownerTmagId: $ownerTmagId, sponsorTmagId: $sponsorTmagId, source: $source, createdAt: $createdAt}) ' +
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
        token,
        ownerTmagId: input.ownerTmagId,
        sponsorTmagId: input.sponsorTmagId,
        leadOwnerId: input.leadOwnerId,
        vmCampaignId: input.vmCampaignId,
        createdAt: now,
      },
    },
  });

  const tokenRecord: McsInviteTokenRecord = {
    token,
    prospectId,
    sponsorTmagId: input.sponsorTmagId,
    state: 'minted',
    createdAt: now,
    clickedAt: null,
    expiresAt,
  };
  await persistenceCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    documents: [
      {
        _id: token,
        ...tokenRecord,
        ownerTmagId: input.ownerTmagId,
        sponsorTmagId: input.sponsorTmagId,
        source: 'rvm',
        leadId,
        leadOwnerId: input.leadOwnerId,
        vmCampaignId: input.vmCampaignId,
      },
    ],
  });
  await persistenceCall('neo4j', 'cypher', {
    query:
      'MERGE (t:TmagInviteToken {token: $token}) ' +
      'SET t.prospectId = $prospectId, t.sponsorTmagId = $sponsorTmagId, ' +
      '    t.ownerTmagId = $ownerTmagId, t.state = $state, t.source = $source, ' +
      '    t.createdAt = $createdAt, t.expiresAt = $expiresAt ' +
      'WITH t ' +
      'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
      'MERGE (t)-[:FOR_PROSPECT]->(p)',
    params: {
      token,
      prospectId,
      ownerTmagId: input.ownerTmagId,
      sponsorTmagId: input.sponsorTmagId,
      state: 'minted',
      source: 'rvm',
      createdAt: now,
      expiresAt,
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

  await tripleStackWrite({
    id: leadId,
    mongoCollection: BULK_LEADS_COLLECTION,
    mongoDoc: { ...bulkLead },
    neo4j: {
      cypher:
        'MERGE (lb:TmagVmLeadOwner {leadOwnerId: $leadOwnerId}) ' +
        'MERGE (vm:TmagVmCampaign {vmCampaignId: $vmCampaignId}) ' +
        'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
        'CREATE (lead:TmagVmBulkLead {leadId: $id, token: $token, status: $status, ' +
        '  ownerTmagId: $ownerTmagId, sponsorTmagId: $sponsorTmagId, createdAt: $createdAt}) ' +
        'CREATE (lb)-[:CONTAINS_LEAD]->(lead) ' +
        'CREATE (vm)-[:TARGETS_LEAD]->(lead) ' +
        'CREATE (lead)-[:BECAME_PROSPECT_RECORD]->(p)',
      params: {
        leadOwnerId: bulkLead.leadOwnerId,
        vmCampaignId: bulkLead.vmCampaignId,
        prospectId: bulkLead.prospectId,
        token: bulkLead.token,
        status: bulkLead.status,
        ownerTmagId: bulkLead.ownerTmagId,
        sponsorTmagId: bulkLead.sponsorTmagId,
        createdAt: now,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `Bulk RVM lead ${firstName} ${lastInitial}. imported with token ${token}; ` +
        `owner ${input.ownerTmagId}; campaign ${input.vmCampaignId}.`,
      metadata: {
        kind: 'bulk_lead_imported',
        leadId,
        prospectId,
        token,
        ownerTmagId: input.ownerTmagId,
        leadOwnerId: input.leadOwnerId,
        vmCampaignId: input.vmCampaignId,
        createdAt: now,
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
  });

  await appendProspectTimelineEvent({
    prospectId,
    crmRecordId: crm.crmRecordId,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    kind: 'token_created',
    note: 'RVM lead imported as an inactive acquisition record.',
    metadata: { leadId, leadOwnerId: input.leadOwnerId, vmCampaignId: input.vmCampaignId },
    createdAt: now,
  });
  await appendProspectTimelineEvent({
    prospectId,
    crmRecordId: crm.crmRecordId,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    kind: 'token_created',
    note: 'RVM token created. CRM-visible; not placed in the holding tank.',
    metadata: { leadId, token },
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
