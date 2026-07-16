import { createHash } from 'node:crypto';
import type {
  McsAdminGraphIntegrityFindingClass,
  McsAdminGraphIntegrityReport,
  McsAdminGraphIntegrityTraversal,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';

type Persistence = typeof persistenceCall;

const DEFAULT_SAMPLE_LIMIT = 25;
const MAX_SAMPLE_LIMIT = 25;

interface IdentityContract {
  key: string;
  label: string;
  identity: string;
  severity: 'warning' | 'critical';
}

interface StructuralContract {
  key: string;
  label: string;
  identity: string;
  relationship: string;
  direction: 'incoming' | 'outgoing';
  endpointLabel: string;
  endpointIdentity: string;
  maximum: number;
  severity: 'warning' | 'critical';
  eligibility?: string;
}

export interface GraphIntegrityTraversalSpec {
  key: string;
  label: string;
  findingClass: McsAdminGraphIntegrityFindingClass;
  severity: 'warning' | 'critical';
  identityField: string;
  relationship?: string;
  query: string;
}

export interface Neo4jGraphIntegrityOptions {
  persistence?: Persistence;
  sampleLimit?: number;
  now?: () => Date;
  specs?: readonly GraphIntegrityTraversalSpec[];
}

const IDENTITY_CONTRACTS: readonly IdentityContract[] = [
  { key: 'member', label: 'TeamMagnificentMember', identity: 'tmagId', severity: 'critical' },
  { key: 'prospect', label: 'TmagProspect', identity: 'prospectId', severity: 'critical' },
  { key: 'invite_token', label: 'TmagInviteToken', identity: 'token', severity: 'critical' },
  { key: 'steve_discovery', label: 'TmagSteveDiscovery', identity: 'discoveryId', severity: 'warning' },
  { key: 'crm_record', label: 'TmagProspectCrmRecord', identity: 'crmRecordId', severity: 'critical' },
  { key: 'content_video', label: 'TmagContentVideo', identity: 'contentVideoId', severity: 'warning' },
  { key: 'vm_bulk_lead', label: 'TmagVmBulkLead', identity: 'leadId', severity: 'critical' },
  { key: 'vm_campaign', label: 'TmagVmCampaign', identity: 'vmCampaignId', severity: 'warning' },
  { key: 'vm_lead_owner', label: 'TmagVmLeadOwner', identity: 'leadOwnerId', severity: 'critical' },
  { key: 'knowledge', label: 'TmagKnowledge', identity: 'id', severity: 'critical' },
  { key: 'learning_candidate', label: 'TmagLearningCandidate', identity: 'id', severity: 'warning' },
  { key: 'outcome', label: 'TmagOutcome', identity: 'id', severity: 'warning' },
] as const;

const STRUCTURAL_CONTRACTS: readonly StructuralContract[] = [
  {
    key: 'prospect_inviter',
    label: 'TmagProspect',
    identity: 'prospectId',
    relationship: 'INVITED',
    direction: 'incoming',
    endpointLabel: 'TeamMagnificentMember',
    endpointIdentity: 'tmagId',
    maximum: 1,
    severity: 'critical',
  },
  {
    key: 'invite_token_target',
    label: 'TmagInviteToken',
    identity: 'token',
    relationship: 'FOR_PROSPECT|FOR_VM_LEAD',
    direction: 'outgoing',
    endpointLabel: 'TmagProspect|TmagVmBulkLead',
    endpointIdentity: 'prospectId|leadId',
    maximum: 1,
    severity: 'critical',
  },
  {
    key: 'steve_discovery_owner',
    label: 'TmagSteveDiscovery',
    identity: 'discoveryId',
    relationship: 'HAD_STEVE_DISCOVERY',
    direction: 'incoming',
    endpointLabel: 'TeamMagnificentMember',
    endpointIdentity: 'tmagId',
    maximum: 1,
    severity: 'warning',
  },
  {
    key: 'crm_record_owner',
    label: 'TmagProspectCrmRecord',
    identity: 'crmRecordId',
    relationship: 'OWNS_CRM_RECORD',
    direction: 'incoming',
    endpointLabel: 'TeamMagnificentMember',
    endpointIdentity: 'tmagId',
    maximum: 1,
    severity: 'critical',
  },
  {
    key: 'resource_version_owner',
    label: 'TmagResourceVersion',
    identity: 'resourceVersionId',
    relationship: 'HAS_VERSION',
    direction: 'incoming',
    endpointLabel: 'TmagResource',
    endpointIdentity: 'resourceId',
    maximum: 1,
    severity: 'warning',
  },
  {
    key: 'knowledge_chunk_source',
    label: 'KnowledgeChunk',
    identity: 'id',
    relationship: 'HAS_CHUNK',
    direction: 'incoming',
    endpointLabel: 'KnowledgeSource|KnowledgeSourceVersion',
    endpointIdentity: 'id',
    maximum: 1,
    severity: 'critical',
  },
  {
    key: 'vm_queue_job_target',
    label: 'TmagVmQueueJob',
    identity: 'jobId',
    relationship: 'TARGETS_LEAD',
    direction: 'outgoing',
    endpointLabel: 'TmagVmBulkLead',
    endpointIdentity: 'leadId',
    maximum: 1,
    severity: 'warning',
    eligibility: 'n.leadId IS NOT NULL',
  },
  {
    key: 'vm_delivery_event_target',
    label: 'TmagVmDeliveryEvent',
    identity: 'eventId',
    relationship: 'HAS_VM_DELIVERY_EVENT',
    direction: 'incoming',
    endpointLabel: 'TmagVmBulkLead',
    endpointIdentity: 'leadId',
    maximum: 1,
    severity: 'warning',
  },
] as const;

function identityQuery(contract: IdentityContract, duplicate: boolean): string {
  if (duplicate) {
    return [
      `MATCH (n:${contract.label})`,
      `WHERE n.${contract.identity} IS NOT NULL AND trim(toString(n.${contract.identity})) <> ''`,
      `WITH toString(n.${contract.identity}) AS identity, count(n) AS copies`,
      'WHERE copies > 1',
      'WITH collect({identity: identity, copies: copies}) AS findings',
      'RETURN size(findings) AS total, [row IN findings[..$sampleLimit] | row.identity] AS samples',
    ].join(' ');
  }
  return [
    `MATCH (n:${contract.label})`,
    `WHERE n.${contract.identity} IS NULL OR trim(toString(n.${contract.identity})) = ''`,
    'WITH collect(coalesce(toString(elementId(n)), "missing")) AS findings',
    'RETURN size(findings) AS total, findings[..$sampleLimit] AS samples',
  ].join(' ');
}

function structuralPattern(contract: StructuralContract): string {
  const rel = contract.relationship.split('|').join('|');
  const labels = contract.endpointLabel.split('|');
  const endpointPredicate = labels.map((label) => `endpoint:${label}`).join(' OR ');
  const pattern =
    contract.direction === 'incoming'
      ? `(endpoint)-[r:${rel}]->(n)`
      : `(n)-[r:${rel}]->(endpoint)`;
  return `${pattern} WHERE (${endpointPredicate})`;
}

function structuralQuery(
  contract: StructuralContract,
  findingClass: 'missing_required_anchor' | 'ambiguous_required_anchor',
): string {
  const comparison = findingClass === 'missing_required_anchor' ? '= 0' : `> ${contract.maximum}`;
  return [
    `MATCH (n:${contract.label})`,
    ...(contract.eligibility ? [`WHERE ${contract.eligibility}`] : []),
    `OPTIONAL MATCH ${structuralPattern(contract)}`,
    `WITH n, count(DISTINCT r) AS anchors`,
    `WHERE anchors ${comparison}`,
    `WITH collect(coalesce(toString(n.${contract.identity}), toString(elementId(n)))) AS findings`,
    'RETURN size(findings) AS total, findings[..$sampleLimit] AS samples',
  ].join(' ');
}

function duplicateParallelEdgeQuery(): string {
  return [
    'MATCH (a)-[r]->(b)',
    'WITH elementId(a) AS fromId, type(r) AS relType, elementId(b) AS toId, count(r) AS copies',
    'WHERE copies > 1',
    'WITH collect(fromId + "|" + relType + "|" + toId) AS findings',
    'RETURN size(findings) AS total, findings[..$sampleLimit] AS samples',
  ].join(' ');
}

const TOPOLOGY_COUNT_QUERY = [
  'MATCH (n)',
  'WITH count(n) AS nodes',
  'OPTIONAL MATCH ()-[r]->()',
  'RETURN nodes, count(r) AS relationships',
].join(' ');

export const GRAPH_INTEGRITY_TRAVERSAL_CATALOG: readonly GraphIntegrityTraversalSpec[] = [
  ...IDENTITY_CONTRACTS.flatMap((contract) => [
    {
      key: `${contract.key}_missing_identity`,
      label: `${contract.label} missing ${contract.identity}`,
      findingClass: 'missing_identity' as const,
      severity: contract.severity,
      identityField: contract.identity,
      query: identityQuery(contract, false),
    },
    {
      key: `${contract.key}_duplicate_identity`,
      label: `${contract.label} duplicate ${contract.identity}`,
      findingClass: 'duplicate_identity' as const,
      severity: contract.severity,
      identityField: contract.identity,
      query: identityQuery(contract, true),
    },
  ]),
  ...STRUCTURAL_CONTRACTS.flatMap((contract) => [
    {
      key: `${contract.key}_missing_anchor`,
      label: `${contract.label} missing required ${contract.relationship} anchor`,
      findingClass: 'missing_required_anchor' as const,
      severity: contract.severity,
      identityField: contract.identity,
      relationship: contract.relationship,
      query: structuralQuery(contract, 'missing_required_anchor'),
    },
    {
      key: `${contract.key}_ambiguous_anchor`,
      label: `${contract.label} ambiguous ${contract.relationship} anchor`,
      findingClass: 'ambiguous_required_anchor' as const,
      severity: contract.severity,
      identityField: contract.identity,
      relationship: contract.relationship,
      query: structuralQuery(contract, 'ambiguous_required_anchor'),
    },
  ]),
  {
    key: 'duplicate_parallel_edge',
    label: 'Duplicate parallel relationships between the same graph endpoints',
    findingClass: 'duplicate_parallel_edge',
    severity: 'warning',
    identityField: 'elementId',
    query: duplicateParallelEdgeQuery(),
  },
] as const;

function fingerprint(specKey: string, identity: string): string {
  return createHash('sha256').update(`${specKey}|${identity}`, 'utf8').digest('hex');
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function stringSamples(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === 'string' && item.trim().length > 0)) return null;
  return value;
}

async function observeTopologyCounts(
  persistence: Persistence,
): Promise<{ nodes: number | null; relationships: number | null; error: string | null }> {
  try {
    const result = await persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: TOPOLOGY_COUNT_QUERY,
      params: {},
    });
    if (!Array.isArray(result.records) || result.records.length !== 1) {
      throw new Error('topology_count_record_required');
    }
    const row = result.records[0]!;
    const nodes = positiveInteger(row.nodes);
    const relationships = positiveInteger(row.relationships);
    if (nodes === null || relationships === null) throw new Error('malformed_topology_counts');
    return { nodes, relationships, error: null };
  } catch (error) {
    return {
      nodes: null,
      relationships: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function validateGraphIntegrityCatalog(
  specs: readonly GraphIntegrityTraversalSpec[] = GRAPH_INTEGRITY_TRAVERSAL_CATALOG,
): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const spec of specs) {
    if (!spec.key || keys.has(spec.key)) errors.push(`duplicate_or_missing_spec_key:${spec.key}`);
    keys.add(spec.key);
    if (!spec.identityField) errors.push(`missing_identity_contract:${spec.key}`);
    if (
      (spec.findingClass === 'missing_required_anchor' ||
        spec.findingClass === 'ambiguous_required_anchor') &&
      !spec.relationship
    ) {
      errors.push(`missing_relationship_contract:${spec.key}`);
    }
    if (!spec.query.includes('RETURN') || !spec.query.includes('$sampleLimit')) {
      errors.push(`unbounded_or_malformed_query:${spec.key}`);
    }
    if (/\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|CALL\s+db\.|LOAD\s+CSV)\b/i.test(spec.query)) {
      errors.push(`mutation_or_unsafe_query:${spec.key}`);
    }
  }
  return errors;
}

async function executeTraversal(
  spec: GraphIntegrityTraversalSpec,
  sampleLimit: number,
  persistence: Persistence,
): Promise<McsAdminGraphIntegrityTraversal> {
  try {
    const result = await persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: spec.query,
      params: { sampleLimit },
    });
    if (!Array.isArray(result.records) || result.records.length !== 1) {
      throw new Error('exactly_one_aggregate_record_required');
    }
    const row = result.records[0]!;
    const total = positiveInteger(row.total);
    const samples = stringSamples(row.samples);
    if (total === null || samples === null) throw new Error('malformed_aggregate_or_samples');
    if (samples.length > sampleLimit || samples.length > total) {
      throw new Error('sample_reconciliation_failed');
    }
    return {
      key: spec.key,
      label: spec.label,
      findingClass: spec.findingClass,
      severity: spec.severity,
      status: total > sampleLimit ? 'truncated' : total > 0 ? 'findings' : 'clear',
      exactCount: total,
      sampleLimit,
      sampleFingerprints: samples.map((identity) => fingerprint(spec.key, identity)),
      error: null,
    };
  } catch (error) {
    return {
      key: spec.key,
      label: spec.label,
      findingClass: spec.findingClass,
      severity: spec.severity,
      status: 'degraded',
      exactCount: 0,
      sampleLimit,
      sampleFingerprints: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function observeNeo4jGraphIntegrity(
  options: Neo4jGraphIntegrityOptions = {},
): Promise<McsAdminGraphIntegrityReport> {
  const persistence = options.persistence ?? persistenceCall;
  const sampleLimit = Math.min(
    MAX_SAMPLE_LIMIT,
    Math.max(1, Math.floor(options.sampleLimit ?? DEFAULT_SAMPLE_LIMIT)),
  );
  const specs = options.specs ?? GRAPH_INTEGRITY_TRAVERSAL_CATALOG;
  const catalogErrors = validateGraphIntegrityCatalog(specs);
  if (catalogErrors.length > 0) {
    return {
      generatedAt: (options.now?.() ?? new Date()).toISOString(),
      status: 'degraded',
      repairPolicy: 'report_only',
      sampleLimit,
      topology: { nodes: null, relationships: null },
      coverage: { expected: specs.length, completed: 0, degraded: specs.length },
      totals: {
        findings: 0,
        missingIdentity: 0,
        duplicateIdentity: 0,
        missingRequiredAnchor: 0,
        ambiguousRequiredAnchor: 0,
        duplicateParallelEdge: 0,
      },
      traversals: specs.map((spec, index) => ({
        key: spec.key || `invalid_${index}`,
        label: spec.label,
        findingClass: spec.findingClass,
        severity: spec.severity,
        status: 'degraded',
        exactCount: 0,
        sampleLimit,
        sampleFingerprints: [],
        error: catalogErrors.join(','),
      })),
      degradedReasons: catalogErrors,
    };
  }

  const topology = await observeTopologyCounts(persistence);
  const traversals: McsAdminGraphIntegrityTraversal[] = [];
  for (const spec of specs) {
    traversals.push(await executeTraversal(spec, sampleLimit, persistence));
  }
  const count = (findingClass: McsAdminGraphIntegrityFindingClass): number =>
    traversals
      .filter((traversal) => traversal.findingClass === findingClass)
      .reduce((sum, traversal) => sum + traversal.exactCount, 0);
  const degraded = traversals.filter((traversal) => traversal.status === 'degraded');
  const degradedReasons = degraded.map(
    (traversal) => `${traversal.key}:${traversal.error ?? 'unknown'}`,
  );
  if (topology.error) degradedReasons.unshift(`topology:${topology.error}`);
  const truncated = traversals.some((traversal) => traversal.status === 'truncated');
  const findings = traversals.reduce((sum, traversal) => sum + traversal.exactCount, 0);

  return {
    generatedAt: (options.now?.() ?? new Date()).toISOString(),
    status:
      degraded.length > 0 || topology.error
        ? 'degraded'
        : truncated
          ? 'truncated'
          : findings > 0
            ? 'findings'
            : 'clear',
    repairPolicy: 'report_only',
    sampleLimit,
    topology: { nodes: topology.nodes, relationships: topology.relationships },
    coverage: {
      expected: specs.length,
      completed: traversals.length - degraded.length,
      degraded: degraded.length,
    },
    totals: {
      findings,
      missingIdentity: count('missing_identity'),
      duplicateIdentity: count('duplicate_identity'),
      missingRequiredAnchor: count('missing_required_anchor'),
      ambiguousRequiredAnchor: count('ambiguous_required_anchor'),
      duplicateParallelEdge: count('duplicate_parallel_edge'),
    },
    traversals,
    degradedReasons,
  };
}
