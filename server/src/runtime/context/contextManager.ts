import type {
  AgentAllowedOutput,
  AgentContext,
  AgentDisplayName,
  AgentDomain,
  AgentId,
  AgentKey,
  AgentRuntimeMode,
  ApprovedKnowledgeContextItem,
  BaContext,
  ContextExclusion,
  ContextPacketId,
  ContextPacketRequest,
  ContextPacketSchemaVersion,
  ContextPacketStatus,
  ContextPacketV1,
  ContextRequestId,
  Guardrail,
  KnowledgeId,
  RequestId,
  RuntimeRequestScope,
  RuntimeRule,
  SessionContext,
  SourceId,
  TeamContext,
  TenantContext,
} from '@momentum/shared/runtime';
import { defineRuntimeBoundary } from '../common.js';
import type { BackendRuntimeBoundaryDescriptor } from '../common.js';
import {
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
  validateRuntimeEventEnvelope,
} from '../events/index.js';
import type { RuntimeAgentEventEnvelope } from '../events/index.js';

export const CONTEXT_PACKET_V1_SCHEMA_VERSION = 'context_packet.v1' as const satisfies ContextPacketSchemaVersion;
export const CONTEXT_MANAGER_COMPONENT = 'context_manager' as const;

const AGENT_KEYS = ['steve_success', 'michael_magnificent', 'ivory'] as const satisfies readonly AgentKey[];
const AGENT_DISPLAY_NAMES: Record<AgentKey, AgentDisplayName> = {
  steve_success: 'Steve Success',
  michael_magnificent: 'Michael Magnificent',
  ivory: 'Ivory',
};
const AGENT_DOMAINS: Record<AgentKey, AgentDomain> = {
  steve_success: 'success',
  michael_magnificent: 'training',
  ivory: 'relationship',
};
const AGENT_RUNTIME_MODES: Record<AgentKey, AgentRuntimeMode> = {
  steve_success: 'interview_specialist',
  michael_magnificent: 'training_specialist',
  ivory: 'relationship_specialist',
};
const DEFAULT_ALLOWED_OUTPUTS: readonly AgentAllowedOutput[] = [
  'clarifying_question',
  'teaching_explanation',
  'next_step_prompt',
  'reflection_prompt',
];

export type ContextReferenceKind = 'approved_knowledge' | 'graph' | 'vector' | 'event';
export type ContextReferenceStatus = 'approved' | 'candidate' | 'review_only';

export interface ContextReference {
  sourceId: SourceId | string;
  kind: ContextReferenceKind;
  title?: string;
  summary: string;
  status: ContextReferenceStatus;
  knowledgeId?: KnowledgeId;
  score?: number;
}

export interface ContextConstraint {
  constraintId: string;
  instruction: string;
  severity: 'required' | 'critical';
}

export interface ContextPacketProvenance {
  assembledBy: typeof CONTEXT_MANAGER_COMPONENT;
  requestId: RequestId | ContextRequestId;
  componentVersion: 's1.5';
  traceId?: string;
}

export interface ContextPacketBuildInput {
  packetId: ContextPacketId;
  requestId: ContextRequestId;
  tenant: TenantContext;
  team: TeamContext;
  ba: BaContext;
  session: SessionContext;
  agentKey: AgentKey;
  agentId?: AgentId;
  objective: string;
  language: ContextPacketV1['language'];
  approvedKnowledge?: ApprovedKnowledgeContextItem[];
  knowledgeReferences?: ContextReference[];
  graphContextReferences?: ContextReference[];
  vectorContextReferences?: ContextReference[];
  eventContextReferences?: RuntimeAgentEventEnvelope[];
  constraints?: ContextConstraint[];
  excludedKnowledge?: ContextExclusion[];
  provenance: ContextPacketProvenance;
  packetStatus?: ContextPacketStatus;
  authorizeCandidateKnowledge?: boolean;
  createdAt?: string;
  expiresAt?: string;
}

export interface ContextPacketValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ContextPacketValidationResult =
  | {
      ok: true;
      packet: ContextPacketV1;
      errors: [];
    }
  | {
      ok: false;
      errors: ContextPacketValidationIssue[];
    };

export class ContextPacketValidationError extends Error {
  readonly errors: ContextPacketValidationIssue[];

  constructor(message: string, errors: ContextPacketValidationIssue[]) {
    super(message);
    this.name = 'ContextPacketValidationError';
    this.errors = errors;
  }
}

export interface ContextManagerBoundaryPort {
  buildContextPacket(
    scope: RuntimeRequestScope,
    request: ContextPacketRequest,
  ): Promise<ContextPacketV1>;
}

export const contextManagerBoundary = defineRuntimeBoundary({
  key: 'context_manager',
  label: 'Context Manager',
  status: 'skeleton_only',
  activated: false,
  apiMounted: false,
  behaviorEnabled: false,
  persistenceAccess: 'service_boundary_only',
  sharedContractImport: '@momentum/shared/runtime',
  notes: [
    'Only approved path from memory services into agents.',
    'Future implementations must apply Team Magnificent scope, BA scope, privacy filters, exclusions, and retrieval audit.',
  ],
} satisfies BackendRuntimeBoundaryDescriptor<'context_manager'>);

export function buildContextPacket(input: ContextPacketBuildInput): ContextPacketV1 {
  const buildValidation = validateContextPacketBuildInput(input);
  if (buildValidation.length > 0) {
    throw new ContextPacketValidationError(
      `Invalid context_packet.v1 build input: ${formatIssues(buildValidation)}`,
      buildValidation,
    );
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const excludedCandidateReferences = excludedReferencesFor([
    ...(input.knowledgeReferences ?? []),
    ...(input.graphContextReferences ?? []),
    ...(input.vectorContextReferences ?? []),
  ]);
  const explicitExclusions = input.excludedKnowledge ?? [];
  const exclusions = [
    ...explicitExclusions,
    ...excludedCandidateReferences,
  ];
  const approvedKnowledge = input.approvedKnowledge ?? approvedKnowledgeFromReferences(input.knowledgeReferences ?? []);
  const runtimeRules = buildRuntimeRules(input.agentKey, input.objective);
  const guardrails = buildGuardrails(input.agentKey);
  const retrievalMethods = [
    approvedKnowledge.length > 0 ? 'direct_reference' : undefined,
    (input.graphContextReferences?.length ?? 0) > 0 ? 'graph_expansion' : undefined,
    (input.vectorContextReferences?.length ?? 0) > 0 ? 'semantic_search' : undefined,
    (input.eventContextReferences?.length ?? 0) > 0 ? 'session_history' : undefined,
    'rule_inclusion',
  ].filter((value): value is ContextPacketV1['retrievalAudit']['retrievalMethods'][number] => Boolean(value));

  const packet: ContextPacketV1 = {
    schemaVersion: CONTEXT_PACKET_V1_SCHEMA_VERSION,
    packetId: input.packetId,
    requestId: input.requestId,
    createdAt,
    expiresAt: input.expiresAt,
    packetStatus: input.packetStatus ?? 'complete',
    tenant: input.tenant,
    team: input.team,
    ba: input.ba,
    session: input.session,
    agent: buildAgentContext(input.agentKey, input.agentId, input.objective),
    language: input.language,
    runtimeRules,
    guardrails,
    approvedKnowledge,
    privateContext: {
      included: false,
      items: [],
      reason: 'Private context retrieval is not active in S1.5.',
    },
    relationshipContext: {
      included: false,
      items: [],
    },
    journalContext: {
      included: false,
      entries: [],
      privateByDefault: true,
    },
    sessionHistory: {
      included: false,
      turns: [],
      omittedTurnCount: input.eventContextReferences?.length ?? 0,
    },
    guidedActions: [],
    exclusions,
    retrievalAudit: {
      requestId: input.requestId,
      packetId: input.packetId,
      requestedScopes: ['team_magnificent', 'ba', 'agent_runtime'],
      includedKnowledgeIds: approvedKnowledge.map((item) => item.knowledgeId),
      includedPrivateContextIds: [],
      includedJournalEntryIds: [],
      includedRelationshipContextIds: [],
      includedGuidedActionIds: [],
      excludedSourceIds: exclusions.map((item) => item.sourceId),
      retrievalMethods,
      tokenEstimate: 0,
      languageFallbackUsed: Boolean(input.language.fallback),
      candidateKnowledgeIncluded: false,
      candidateKnowledgeExcluded: true,
      privateJournalIncluded: false,
      degraded: input.packetStatus === 'degraded',
      includedItems: [
        ...retrievalItemsFromReferences(input.knowledgeReferences ?? [], 'direct_reference'),
        ...retrievalItemsFromReferences(input.graphContextReferences ?? [], 'graph_expansion'),
        ...retrievalItemsFromReferences(input.vectorContextReferences ?? [], 'semantic_search'),
        ...(input.eventContextReferences ?? []).map((event) => ({
          sourceId: event.eventId,
          method: 'session_history' as const,
          included: true,
          reasonCodes: ['session_relevance' as const],
        })),
      ],
      exclusions,
    },
    metadata: {
      generatedBy: CONTEXT_MANAGER_COMPONENT,
      environment: input.tenant.environment,
      correlationId: input.provenance.traceId,
      notes: [
        `objective:${input.objective}`,
        `provenance:${input.provenance.assembledBy}:${input.provenance.componentVersion}`,
        's1.5:no_active_retrieval',
      ],
    },
  };

  assertValidContextPacket(packet);
  return packet;
}

export function validateContextPacket(packet: unknown): ContextPacketValidationResult {
  const errors: ContextPacketValidationIssue[] = [];

  if (!isRecord(packet)) {
    return {
      ok: false,
      errors: [issue('$', 'invalid_packet', 'Context Packet must be an object.')],
    };
  }

  validatePacketCore(packet, errors);
  validateTenantTeamBaScope(packet, errors);
  validateAgentContext(packet.agent, errors);
  validateObjectiveMetadata(packet, errors);
  validateLanguageContext(packet.language, errors);
  validateKnowledge(packet.approvedKnowledge, errors);
  validateConstraints(packet, errors);
  validateExcludedKnowledge(packet.exclusions, errors);
  validateRetrievalAudit(packet.retrievalAudit, errors);
  validateContextManagerProvenance(packet, errors);

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    packet: packet as unknown as ContextPacketV1,
    errors: [],
  };
}

export function assertValidContextPacket(packet: unknown): asserts packet is ContextPacketV1 {
  const result = validateContextPacket(packet);
  if (!result.ok) {
    throw new ContextPacketValidationError(
      `Invalid context_packet.v1: ${formatIssues(result.errors)}`,
      result.errors,
    );
  }
}

function validateContextPacketBuildInput(input: ContextPacketBuildInput): ContextPacketValidationIssue[] {
  const errors: ContextPacketValidationIssue[] = [];

  requireString(input, 'packetId', errors);
  requireString(input, 'requestId', errors);
  requireString(input.tenant, 'tenantId', errors, 'tenant.tenantId');
  requireString(input.team, 'teamId', errors, 'team.teamId');
  requireString(input.ba, 'baId', errors, 'ba.baId');
  validateTeamMagnificentBaScope(input.ba, errors, 'ba');
  validateTeamMagnificentTeam(input.team, errors, 'team');
  validateAgentKey(input.agentKey, errors, 'agentKey');
  validateOptionalString(input, 'agentId', errors);
  requireString(input, 'objective', errors);
  validateLanguageContext(input.language, errors);
  validateReferences(input.knowledgeReferences ?? [], 'knowledgeReferences', errors);
  validateReferences(input.graphContextReferences ?? [], 'graphContextReferences', errors);
  validateReferences(input.vectorContextReferences ?? [], 'vectorContextReferences', errors);
  validateEventReferences(input.eventContextReferences ?? [], errors);
  validateBuildConstraints(input.constraints ?? [], errors);
  validateExcludedKnowledge(input.excludedKnowledge ?? [], errors);
  validateBuildProvenance(input.provenance, errors);

  if (input.authorizeCandidateKnowledge) {
    errors.push(issue('authorizeCandidateKnowledge', 'candidate_authorization_not_active', 'S1.5 does not activate candidate/review-only knowledge inclusion.'));
  }

  return errors;
}

function buildAgentContext(agentKey: AgentKey, agentId: AgentId | undefined, objective: string): AgentContext {
  return {
    agentKey,
    agentId,
    displayName: AGENT_DISPLAY_NAMES[agentKey],
    primaryDomain: AGENT_DOMAINS[agentKey],
    roleSummary: `${AGENT_DISPLAY_NAMES[agentKey]} consumes a validated Context Packet for ${objective}.`,
    allowedOutputs: [...DEFAULT_ALLOWED_OUTPUTS],
    prohibitedOutputs: [
      'Do not query MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, or Gateway clients directly.',
      'Do not include candidate or review-only knowledge unless a future approved workflow explicitly authorizes it.',
      'Do not persist context packets or emit events from the Context Manager builder.',
    ],
    agentRuntimeMode: AGENT_RUNTIME_MODES[agentKey],
    contextUsageInstruction: 'Use this packet as read-only context. Request additional context through the Context Manager boundary only.',
  };
}

function buildRuntimeRules(agentKey: AgentKey, objective: string): RuntimeRule[] {
  return [
    {
      ruleId: 'context_manager_only_assembler',
      category: 'agent_boundary',
      instruction: `Context Packet assembled by Context Manager only for objective: ${objective}.`,
      required: true,
      appliesTo: agentKey,
      reason: 'Agents consume packets and do not assemble context directly.',
    },
    {
      ruleId: 'agent_store_access_forbidden',
      category: 'knowledge_boundary',
      instruction: 'Agents must not query MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, or Gateway fallback clients directly.',
      required: true,
      appliesTo: 'all_agents',
      reason: 'Store access remains behind approved runtime service boundaries.',
    },
    {
      ruleId: 'candidate_knowledge_excluded_by_default',
      category: 'candidate_boundary',
      instruction: 'Candidate and review-only knowledge is excluded by default.',
      required: true,
      appliesTo: 'all_agents',
      reason: 'Only approved knowledge can enter agent context in this slice.',
    },
  ];
}

function buildGuardrails(agentKey: AgentKey): Guardrail[] {
  return [
    {
      guardrailId: 'team_magnificent_scope_required',
      appliesTo: agentKey,
      instruction: 'When baId is present, tenant/team/BA scope must remain Team Magnificent scoped.',
      severity: 'critical',
      category: 'runtime_boundary',
      reason: 'Cross-team context leakage is forbidden.',
    },
    {
      guardrailId: 'no_active_retrieval_s1_5',
      appliesTo: 'all_agents',
      instruction: 'This packet contains only caller-supplied references; active retrieval is not enabled in S1.5.',
      severity: 'required',
      category: 'knowledge_integrity',
    },
  ];
}

function approvedKnowledgeFromReferences(references: ContextReference[]): ApprovedKnowledgeContextItem[] {
  return references
    .filter((reference) => reference.kind === 'approved_knowledge')
    .filter((reference) => reference.status === 'approved')
    .map((reference) => ({
      knowledgeId: (reference.knowledgeId ?? reference.sourceId) as KnowledgeId,
      title: reference.title ?? String(reference.sourceId),
      summary: reference.summary,
      status: 'active',
      governanceStatus: 'approved',
      language: 'en',
      sourceTraceability: {
        sourceId: reference.sourceId as SourceId,
        sourceType: 'approved_knowledge',
        title: reference.title,
      },
      retrieval: {
        retrievalMethod: 'direct_reference',
        reasonCodes: ['agent_task_match'],
        score: reference.score,
        language: 'en',
        translationStatus: 'same_language',
      },
    }));
}

function excludedReferencesFor(references: ContextReference[]): ContextExclusion[] {
  return references
    .filter((reference) => reference.status === 'candidate' || reference.status === 'review_only')
    .map((reference) => ({
      sourceId: reference.sourceId,
      reason: reference.status === 'candidate' ? 'candidate_not_approved' : 'not_review_workflow',
      description: `${reference.kind} reference excluded by default in S1.5.`,
    }));
}

function retrievalItemsFromReferences(
  references: ContextReference[],
  method: ContextPacketV1['retrievalAudit']['retrievalMethods'][number],
): ContextPacketV1['retrievalAudit']['includedItems'] {
  return references.map((reference) => ({
    sourceId: reference.sourceId,
    method,
    included: reference.status === 'approved',
    reasonCodes: ['agent_task_match'],
    score: reference.score,
  }));
}

function validatePacketCore(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  validateSchemaVersion(packet.schemaVersion, errors);
  requireString(packet, 'packetId', errors);
  requireString(packet, 'requestId', errors);
  validateIsoTimestamp(packet.createdAt, errors, 'createdAt');
  if (packet.expiresAt !== undefined) validateIsoTimestamp(packet.expiresAt, errors, 'expiresAt');
  if (!['complete', 'degraded', 'failed'].includes(String(packet.packetStatus))) {
    errors.push(issue('packetStatus', 'invalid_status', 'packetStatus must be complete, degraded, or failed.'));
  }
}

function validateSchemaVersion(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (value !== CONTEXT_PACKET_V1_SCHEMA_VERSION) {
    errors.push(issue('schemaVersion', 'invalid_schema_version', 'schemaVersion must be context_packet.v1.'));
  }
}

function validateTenantTeamBaScope(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(packet.tenant)) {
    errors.push(issue('tenant', 'tenant_required', 'tenant is required.'));
  } else {
    requireString(packet.tenant, 'tenantId', errors, 'tenant.tenantId');
  }

  if (!isRecord(packet.team)) {
    errors.push(issue('team', 'team_required', 'team is required.'));
  } else {
    validateTeamMagnificentTeam(packet.team as unknown as TeamContext, errors, 'team');
  }

  if (!isRecord(packet.ba)) {
    errors.push(issue('ba', 'ba_required', 'ba is required.'));
    return;
  }

  validateTeamMagnificentBaScope(packet.ba as unknown as BaContext, errors, 'ba');
}

function validateTeamMagnificentTeam(team: Partial<TeamContext>, errors: ContextPacketValidationIssue[], path: string): void {
  requireString(team, 'teamId', errors, `${path}.teamId`);
  if (team.teamKey !== TEAM_MAGNIFICENT_KEY) {
    errors.push(issue(`${path}.teamKey`, 'team_magnificent_scope_required', 'teamKey must be team_magnificent.'));
  }
  if (team.teamName !== TEAM_MAGNIFICENT_NAME) {
    errors.push(issue(`${path}.teamName`, 'team_magnificent_scope_required', 'teamName must be Team Magnificent.'));
  }
}

function validateTeamMagnificentBaScope(ba: Partial<BaContext>, errors: ContextPacketValidationIssue[], path: string): void {
  requireString(ba, 'baId', errors, `${path}.baId`);
  requireString(ba, 'tenantId', errors, `${path}.tenantId`);
  requireString(ba, 'teamId', errors, `${path}.teamId`);
  if (ba.teamKey !== TEAM_MAGNIFICENT_KEY) {
    errors.push(issue(`${path}.teamKey`, 'team_magnificent_scope_required', 'BA context must include teamKey team_magnificent.'));
  }
  if (ba.teamName !== TEAM_MAGNIFICENT_NAME) {
    errors.push(issue(`${path}.teamName`, 'team_magnificent_scope_required', 'BA context must include teamName Team Magnificent.'));
  }
}

function validateAgentContext(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(issue('agent', 'agent_required', 'agent context is required.'));
    return;
  }

  validateAgentKey(value.agentKey, errors, 'agent.agentKey');
  validateOptionalString(value, 'agentId', errors, 'agent.agentId');
  if (value.agentId !== undefined && AGENT_KEYS.includes(value.agentId as AgentKey)) {
    errors.push(issue('agent.agentId', 'agent_id_must_not_be_semantic_key', 'agentId must be the configured runtime/database instance identity, not the semantic agentKey.'));
  }
}

function validateAgentKey(value: unknown, errors: ContextPacketValidationIssue[], path: string): void {
  if (!AGENT_KEYS.includes(value as AgentKey)) {
    errors.push(issue(path, 'invalid_agent_key', 'agentKey must be a semantic runtime registry identity.'));
  }
}

function validateObjectiveMetadata(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(packet.metadata) || packet.metadata.generatedBy !== CONTEXT_MANAGER_COMPONENT) {
    errors.push(issue('metadata.generatedBy', 'context_manager_required', 'Context Packets must be assembled by the Context Manager.'));
    return;
  }

  if (!Array.isArray(packet.metadata.notes) || !packet.metadata.notes.some((note) => typeof note === 'string' && note.startsWith('objective:'))) {
    errors.push(issue('metadata.notes', 'objective_required', 'Context Packet metadata must include an objective note.'));
  }
}

function validateLanguageContext(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(issue('language', 'language_required', 'language context is required.'));
    return;
  }

  if (value.primary !== 'en' && value.primary !== 'es') {
    errors.push(issue('language.primary', 'invalid_language', 'language.primary must be en or es.'));
  }
  if (typeof value.translationAllowed !== 'boolean') {
    errors.push(issue('language.translationAllowed', 'required_boolean', 'translationAllowed is required.'));
  }
  if (typeof value.machineTranslationUsed !== 'boolean') {
    errors.push(issue('language.machineTranslationUsed', 'required_boolean', 'machineTranslationUsed is required.'));
  }
  if (typeof value.humanReviewed !== 'boolean') {
    errors.push(issue('language.humanReviewed', 'required_boolean', 'humanReviewed is required.'));
  }
}

function validateKnowledge(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!Array.isArray(value)) {
    errors.push(issue('approvedKnowledge', 'invalid_knowledge', 'approvedKnowledge must be an array.'));
    return;
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue(`approvedKnowledge.${index}`, 'invalid_knowledge_item', 'Knowledge item must be an object.'));
      return;
    }
    requireString(item, 'knowledgeId', errors, `approvedKnowledge.${index}.knowledgeId`);
    if (item.status !== 'active') {
      errors.push(issue(`approvedKnowledge.${index}.status`, 'knowledge_not_active', 'Approved knowledge must be active.'));
    }
    if (item.governanceStatus !== 'approved' && item.governanceStatus !== 'approval_not_required') {
      errors.push(issue(`approvedKnowledge.${index}.governanceStatus`, 'knowledge_not_approved', 'Knowledge must be approved or approval_not_required.'));
    }
  });
}

function validateConstraints(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  if (!Array.isArray(packet.runtimeRules) || packet.runtimeRules.length === 0) {
    errors.push(issue('runtimeRules', 'constraints_required', 'runtimeRules constraints are required.'));
  }
  if (!Array.isArray(packet.guardrails) || packet.guardrails.length === 0) {
    errors.push(issue('guardrails', 'constraints_required', 'guardrails constraints are required.'));
  }
}

function validateRetrievalAudit(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(issue('retrievalAudit', 'retrieval_audit_required', 'retrievalAudit is required.'));
    return;
  }

  if (value.candidateKnowledgeIncluded !== false) {
    errors.push(issue('retrievalAudit.candidateKnowledgeIncluded', 'candidate_included_forbidden', 'Candidate knowledge is excluded by default in S1.5.'));
  }
  if (value.candidateKnowledgeExcluded !== true) {
    errors.push(issue('retrievalAudit.candidateKnowledgeExcluded', 'candidate_exclusion_required', 'candidateKnowledgeExcluded must be true.'));
  }
}

function validateReferences(
  references: ContextReference[],
  path: string,
  errors: ContextPacketValidationIssue[],
): void {
  references.forEach((reference, index) => {
    requireString(reference, 'sourceId', errors, `${path}.${index}.sourceId`);
    requireString(reference, 'summary', errors, `${path}.${index}.summary`);
    if (!['approved_knowledge', 'graph', 'vector', 'event'].includes(reference.kind)) {
      errors.push(issue(`${path}.${index}.kind`, 'invalid_reference_kind', 'Reference kind must be approved_knowledge, graph, vector, or event.'));
    }
    if (!['approved', 'candidate', 'review_only'].includes(reference.status)) {
      errors.push(issue(`${path}.${index}.status`, 'invalid_reference_status', 'Reference status must be approved, candidate, or review_only.'));
    }
  });
}

function validateEventReferences(
  references: RuntimeAgentEventEnvelope[],
  errors: ContextPacketValidationIssue[],
): void {
  references.forEach((event, index) => {
    const result = validateRuntimeEventEnvelope(event);
    if (!result.ok) {
      for (const eventError of result.errors) {
        errors.push(issue(`eventContextReferences.${index}.${eventError.path}`, eventError.code, eventError.message));
      }
    }
  });
}

function validateBuildConstraints(
  constraints: ContextConstraint[],
  errors: ContextPacketValidationIssue[],
): void {
  constraints.forEach((constraint, index) => {
    requireString(constraint, 'constraintId', errors, `constraints.${index}.constraintId`);
    requireString(constraint, 'instruction', errors, `constraints.${index}.instruction`);
    if (!['required', 'critical'].includes(constraint.severity)) {
      errors.push(issue(`constraints.${index}.severity`, 'invalid_constraint_severity', 'Constraint severity must be required or critical.'));
    }
  });
}

function validateExcludedKnowledge(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!Array.isArray(value)) {
    errors.push(issue('exclusions', 'invalid_exclusions', 'Excluded knowledge/exclusions must be an array.'));
    return;
  }

  value.forEach((exclusion, index) => {
    if (!isRecord(exclusion)) {
      errors.push(issue(`exclusions.${index}`, 'invalid_exclusion', 'Exclusion must be an object.'));
      return;
    }
    requireString(exclusion, 'sourceId', errors, `exclusions.${index}.sourceId`);
    requireString(exclusion, 'reason', errors, `exclusions.${index}.reason`);
  });
}

function validateBuildProvenance(provenance: ContextPacketProvenance, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(provenance)) {
    errors.push(issue('provenance', 'provenance_required', 'provenance is required.'));
    return;
  }
  if (provenance.assembledBy !== CONTEXT_MANAGER_COMPONENT) {
    errors.push(issue('provenance.assembledBy', 'context_manager_required', 'Context Packets must be assembled by context_manager.'));
  }
  requireString(provenance, 'requestId', errors, 'provenance.requestId');
  if (provenance.componentVersion !== 's1.5') {
    errors.push(issue('provenance.componentVersion', 'invalid_component_version', 'componentVersion must be s1.5.'));
  }
}

function validateContextManagerProvenance(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(packet.metadata) || packet.metadata.generatedBy !== CONTEXT_MANAGER_COMPONENT) {
    errors.push(issue('metadata.generatedBy', 'context_manager_required', 'Context Packet metadata.generatedBy must be context_manager.'));
  }
}

function requireString(
  object: object,
  key: string,
  errors: ContextPacketValidationIssue[],
  path = key,
): void {
  const record = object as Record<string, unknown>;
  if (typeof record[key] !== 'string' || record[key].trim().length === 0) {
    errors.push(issue(path, 'required', `${path} is required.`));
  }
}

function validateOptionalString(
  object: object,
  key: string,
  errors: ContextPacketValidationIssue[],
  path = key,
): void {
  const record = object as Record<string, unknown>;
  if (record[key] !== undefined && (typeof record[key] !== 'string' || record[key].trim().length === 0)) {
    errors.push(issue(path, 'invalid_string', `${path} must be a non-empty string when present.`));
  }
}

function validateIsoTimestamp(value: unknown, errors: ContextPacketValidationIssue[], path: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(issue(path, 'required_timestamp', `${path} is required.`));
    return;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    errors.push(issue(path, 'invalid_timestamp', `${path} must be a valid ISO timestamp.`));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, code: string, message: string): ContextPacketValidationIssue {
  return { path, code, message };
}

function formatIssues(errors: ContextPacketValidationIssue[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join('; ');
}
