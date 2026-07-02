/**
 * VM Lead Campaign schema registry.
 *
 * This repo does not currently have a migration-runner pattern. Agent 1 keeps
 * the data foundation migration-ready by centralizing collection names,
 * required fields, indexes, graph labels/edges, and Chroma targets in one
 * declarative registry for later domain/API agents to consume.
 */

import type {
  McsBulkLeadRecord,
  McsLeadOwnerRecord,
  McsProspectCRMRecord,
  McsProspectTimelineEventRecord,
  McsVMCampaignRecord,
  McsVMDeliveryEventRecord,
} from '@momentum/shared';

export const VM_SCHEMA_VERSION = 'vm-lead-campaign.v1';
export const VM_MONGO_DB = 'momentum';

export const VM_COLLECTIONS = {
  leadOwners: 'tmag_vm_lead_owners',
  bulkLeads: 'tmag_vm_bulk_leads',
  campaigns: 'tmag_vm_campaigns',
  deliveryEvents: 'tmag_vm_delivery_events',
  prospectCrm: 'tmag_prospect_crm_records',
  prospectTimeline: 'tmag_prospect_timeline_events',
  ownershipCorrections: 'tmag_prospect_ownership_corrections',
} as const;

export const VM_CHROMA_COLLECTIONS = {
  leadOwners: 'mcs_vm_lead_owners',
  bulkLeads: 'mcs_vm_bulk_leads',
  campaigns: 'mcs_vm_campaigns',
  deliveryEvents: 'mcs_vm_delivery_events',
  prospectCrm: 'mcs_prospect_crm_records',
  prospectTimeline: 'mcs_prospect_timeline_events',
} as const;

export type VmCollectionKey = keyof typeof VM_COLLECTIONS;

export interface VmMongoIndexDefinition {
  name: string;
  keys: Record<string, 1 | -1>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

export interface VmGraphDefinition {
  nodeLabels: string[];
  relationshipTypes: string[];
}

export interface VmCollectionSchemaDefinition<TRecord> {
  key: VmCollectionKey;
  collection: (typeof VM_COLLECTIONS)[VmCollectionKey];
  chromaCollection: string | null;
  recordExample: TRecord | null;
  requiredFields: readonly string[];
  indexes: readonly VmMongoIndexDefinition[];
  graph: VmGraphDefinition;
  notes: readonly string[];
}

const OWNERSHIP_FIELDS = ['ownerTmagId', 'sponsorTmagId'] as const;
const VM_LEAD_FIELDS = [...OWNERSHIP_FIELDS, 'leadOwnerId', 'vmCampaignId'] as const;

export const VM_SCHEMA_DEFINITIONS = {
  leadOwners: {
    key: 'leadOwners',
    collection: VM_COLLECTIONS.leadOwners,
    chromaCollection: VM_CHROMA_COLLECTIONS.leadOwners,
    recordExample: null,
    requiredFields: [
      'leadOwnerId',
      ...OWNERSHIP_FIELDS,
      'name',
      'source',
      'country',
      'leadType',
      'quantityExpected',
      'quantityImported',
      'status',
      'createdAt',
      'updatedAt',
    ],
    indexes: [
      { name: 'unique_leadOwnerId', keys: { leadOwnerId: 1 }, unique: true },
      { name: 'owner_status_createdAt', keys: { ownerTmagId: 1, status: 1, createdAt: -1 } },
      { name: 'sponsor_createdAt', keys: { sponsorTmagId: 1, createdAt: -1 } },
    ],
    graph: {
      nodeLabels: ['TmagVmLeadOwner', 'TeamMagnificentMember'],
      relationshipTypes: ['OWNS_VM_LEAD_OWNER', 'SPONSORS_VM_LEAD_OWNER'],
    },
    notes: [
      'A lead-owner record is owned by exactly one member by TMAG ID.',
      'Lead-owner import does not create Holding Tank visibility.',
    ],
  } satisfies VmCollectionSchemaDefinition<McsLeadOwnerRecord>,
  bulkLeads: {
    key: 'bulkLeads',
    collection: VM_COLLECTIONS.bulkLeads,
    chromaCollection: VM_CHROMA_COLLECTIONS.bulkLeads,
    recordExample: null,
    requiredFields: [
      'leadId',
      ...VM_LEAD_FIELDS,
      'source',
      'status',
      'createdAt',
      'updatedAt',
    ],
    indexes: [
      { name: 'unique_leadId', keys: { leadId: 1 }, unique: true },
      { name: 'lead_owner_status', keys: { leadOwnerId: 1, status: 1 } },
      { name: 'campaign_status', keys: { vmCampaignId: 1, status: 1 } },
      { name: 'owner_createdAt', keys: { ownerTmagId: 1, createdAt: -1 } },
      { name: 'phone_owner', keys: { phone: 1, ownerTmagId: 1 } },
      { name: 'email_owner', keys: { email: 1, ownerTmagId: 1 } },
    ],
    graph: {
      nodeLabels: ['TmagVmBulkLead', 'TmagVmLeadOwner', 'TmagVmCampaign', 'TeamMagnificentMember'],
      relationshipTypes: ['CONTAINS_LEAD', 'TARGETS_LEAD', 'OWNS_LEAD'],
    },
    notes: [
      'VM leads require leadOwnerId and vmCampaignId in addition to ownership fields.',
      'Imported leads are acquisition records until engagement activates them.',
    ],
  } satisfies VmCollectionSchemaDefinition<McsBulkLeadRecord>,
  campaigns: {
    key: 'campaigns',
    collection: VM_COLLECTIONS.campaigns,
    chromaCollection: VM_CHROMA_COLLECTIONS.campaigns,
    recordExample: null,
    requiredFields: [
      'vmCampaignId',
      ...OWNERSHIP_FIELDS,
      'leadOwnerId',
      'name',
      'provider',
      'status',
      'createdAt',
      'updatedAt',
    ],
    indexes: [
      { name: 'unique_vmCampaignId', keys: { vmCampaignId: 1 }, unique: true },
      { name: 'owner_status_createdAt', keys: { ownerTmagId: 1, status: 1, createdAt: -1 } },
      { name: 'lead_owner_createdAt', keys: { leadOwnerId: 1, createdAt: -1 } },
    ],
    graph: {
      nodeLabels: ['TmagVmCampaign', 'TmagVmLeadOwner', 'TeamMagnificentMember'],
      relationshipTypes: ['USES_VM_LEAD_OWNER', 'OWNS_VM_CAMPAIGN'],
    },
    notes: [
      'Provider is abstract; live sending remains gated by later provider/queue code.',
    ],
  } satisfies VmCollectionSchemaDefinition<McsVMCampaignRecord>,
  deliveryEvents: {
    key: 'deliveryEvents',
    collection: VM_COLLECTIONS.deliveryEvents,
    chromaCollection: VM_CHROMA_COLLECTIONS.deliveryEvents,
    recordExample: null,
    requiredFields: [
      'deliveryEventId',
      ...VM_LEAD_FIELDS,
      'leadId',
      'channel',
      'provider',
      'status',
      'occurredAt',
    ],
    indexes: [
      { name: 'unique_deliveryEventId', keys: { deliveryEventId: 1 }, unique: true },
      { name: 'lead_occurredAt', keys: { leadId: 1, occurredAt: -1 } },
      { name: 'campaign_status', keys: { vmCampaignId: 1, status: 1 } },
      { name: 'provider_message', keys: { providerMessageId: 1, provider: 1 } },
    ],
    graph: {
      nodeLabels: ['TmagVmDeliveryEvent', 'TmagVmBulkLead', 'TmagVmCampaign'],
      relationshipTypes: ['DELIVERED_TO_LEAD', 'BELONGS_TO_CAMPAIGN'],
    },
    notes: [
      'Delivery events are audit/history. Terminal provider events must be idempotent.',
    ],
  } satisfies VmCollectionSchemaDefinition<McsVMDeliveryEventRecord>,
  prospectCrm: {
    key: 'prospectCrm',
    collection: VM_COLLECTIONS.prospectCrm,
    chromaCollection: VM_CHROMA_COLLECTIONS.prospectCrm,
    recordExample: null,
    requiredFields: [
      'crmRecordId',
      ...OWNERSHIP_FIELDS,
      'prospectId',
      'source',
      'status',
      'createdAt',
      'updatedAt',
    ],
    indexes: [
      { name: 'unique_crmRecordId', keys: { crmRecordId: 1 }, unique: true },
      { name: 'unique_owner_prospect', keys: { ownerTmagId: 1, prospectId: 1 }, unique: true },
      { name: 'owner_status_followup', keys: { ownerTmagId: 1, status: 1, followUpDueAt: 1 } },
      { name: 'campaign_status', keys: { vmCampaignId: 1, status: 1 } },
      { name: 'lead_owner_status', keys: { leadOwnerId: 1, status: 1 } },
    ],
    graph: {
      nodeLabels: ['TmagProspectCrmRecord', 'TmagProspect', 'TeamMagnificentMember'],
      relationshipTypes: ['OWNS_CRM_RECORD', 'CRM_RECORD_FOR'],
    },
    notes: [
      'Token creation creates or updates this BA-scoped CRM row immediately.',
      'Closed BA/customer outcomes are historical only, not active back-office management.',
    ],
  } satisfies VmCollectionSchemaDefinition<McsProspectCRMRecord>,
  prospectTimeline: {
    key: 'prospectTimeline',
    collection: VM_COLLECTIONS.prospectTimeline,
    chromaCollection: VM_CHROMA_COLLECTIONS.prospectTimeline,
    recordExample: null,
    requiredFields: [
      'eventId',
      ...OWNERSHIP_FIELDS,
      'prospectId',
      'kind',
      'title',
      'occurredAt',
    ],
    indexes: [
      { name: 'unique_eventId', keys: { eventId: 1 }, unique: true },
      { name: 'prospect_occurredAt', keys: { prospectId: 1, occurredAt: -1 } },
      { name: 'owner_kind_occurredAt', keys: { ownerTmagId: 1, kind: 1, occurredAt: -1 } },
      { name: 'campaign_kind', keys: { vmCampaignId: 1, kind: 1 } },
    ],
    graph: {
      nodeLabels: ['TmagProspectTimelineEvent', 'TmagProspect', 'TeamMagnificentMember'],
      relationshipTypes: ['HAS_TIMELINE_EVENT', 'TRIGGERED_BY_BA'],
    },
    notes: [
      'Presentation milestones mirror the PMV rail; only presentation_completed/video_complete places.',
    ],
  } satisfies VmCollectionSchemaDefinition<McsProspectTimelineEventRecord>,
  ownershipCorrections: {
    key: 'ownershipCorrections',
    collection: VM_COLLECTIONS.ownershipCorrections,
    chromaCollection: null,
    recordExample: null,
    requiredFields: [
      'auditId',
      'oldOwnerTmagId',
      'newOwnerTmagId',
      'oldSponsorTmagId',
      'newSponsorTmagId',
      'reason',
      'adminUserId',
      'changedAt',
    ],
    indexes: [
      { name: 'unique_auditId', keys: { auditId: 1 }, unique: true },
      { name: 'prospect_changedAt', keys: { prospectId: 1, changedAt: -1 } },
      { name: 'lead_changedAt', keys: { leadId: 1, changedAt: -1 } },
      { name: 'admin_changedAt', keys: { adminUserId: 1, changedAt: -1 } },
    ],
    graph: {
      nodeLabels: ['TmagOwnershipCorrection', 'TeamMagnificentMember', 'TmagProspect', 'TmagVmBulkLead'],
      relationshipTypes: ['CORRECTED_OWNERSHIP', 'FROM_OWNER', 'TO_OWNER'],
    },
    notes: [
      'Only Kevin/Admin may perform ownership correction and must provide a reason.',
    ],
  } satisfies VmCollectionSchemaDefinition<Record<string, unknown>>,
} as const;

export function getVmSchemaDefinition(
  key: VmCollectionKey,
): (typeof VM_SCHEMA_DEFINITIONS)[VmCollectionKey] {
  return VM_SCHEMA_DEFINITIONS[key];
}
