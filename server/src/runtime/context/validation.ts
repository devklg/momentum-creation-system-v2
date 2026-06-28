import type {
  AgentKey,
  BaId,
  ContextPacketV1,
  RuntimeLanguage,
} from '@momentum/shared/runtime';
import type {
  ContextPacketFoundationBoundary,
  ContextPacketValidationCode,
  ContextPacketValidationIssue,
  ContextPacketValidationResult,
} from './types.js';

export const CONTEXT_PACKET_V1_SCHEMA_VERSION = 'context_packet.v1' as const;
export const CONTEXT_MANAGER_ASSEMBLER = 'context_manager' as const;
export const TEAM_MAGNIFICENT_KEY = 'team_magnificent' as const;
export const TEAM_MAGNIFICENT_NAME = 'Team Magnificent' as const;

export const CONTEXT_PACKET_SUPPORTED_LANGUAGES = ['en', 'es'] as const satisfies readonly RuntimeLanguage[];

export const CONTEXT_PACKET_AGENT_KEYS = [
  'steve_success',
  'michael_magnificent',
  'ivory',
] as const satisfies readonly AgentKey[];

export const REQUIRED_CONTEXT_RUNTIME_RULE_IDS = [
  'team_magnificent_scope',
  'agent_store_access_boundary',
  'context_manager_only_assembly',
  'candidate_knowledge_exclusion',
  'internal_browser_runtime_no_external_telephony',
  'ba_action_ownership',
  'bilingual_runtime',
] as const;

export const contextPacketFoundationBoundary = {
  assembledBy: CONTEXT_MANAGER_ASSEMBLER,
  agentsMayRetrieveDirectly: false,
  candidateKnowledgeIncludedByDefault: false,
  supportedLanguages: CONTEXT_PACKET_SUPPORTED_LANGUAGES,
  requiredRuntimeRuleIds: REQUIRED_CONTEXT_RUNTIME_RULE_IDS,
} as const satisfies ContextPacketFoundationBoundary;

export function assertValidContextPacketV1(candidate: unknown): asserts candidate is ContextPacketV1 {
  const result = validateContextPacketV1(candidate);
  if (!result.ok) {
    const detail = result.errors.map((error) => `${error.path}: ${error.message}`).join('; ');
    throw new ContextPacketValidationError(`Invalid context_packet.v1 packet: ${detail}`, result.errors);
  }
}

export function prepareContextPacketFoundation(packet: ContextPacketV1): ContextPacketV1 {
  assertValidContextPacketV1(packet);
  return packet;
}

export function validateContextPacketV1(candidate: unknown): ContextPacketValidationResult {
  const errors: ContextPacketValidationIssue[] = [];

  if (!isRecord(candidate)) {
    return {
      ok: false,
      errors: [
        {
          path: '$',
          code: 'invalid_packet',
          message: 'Context packet must be an object.',
        },
      ],
    };
  }

  const packet = candidate;

  validateSchemaVersion(packet.schemaVersion, errors);
  validateAssembler(packet, errors);
  requireString(packet, 'packetId', errors);
  requireString(packet, 'requestId', errors);
  validateIsoTimestamp(packet.createdAt, 'createdAt', errors);
  validatePacketStatus(packet, errors);
  validateTenant(packet.tenant, errors);
  validateTeam(packet.team, errors);
  validateBa(packet.ba, errors);
  validateAgent(packet.agent, errors);
  validateLanguage(packet.language, errors);
  validateRuntimeRules(packet.runtimeRules, errors);
  validateGuardrails(packet.guardrails, errors);
  validateApprovedKnowledge(packet.approvedKnowledge, errors);
  validatePrivateContext(packet, errors);
  validateRelationshipContext(packet, errors);
  validateJournalContext(packet, errors);
  validateRetrievalAudit(packet.retrievalAudit, errors);
  validateDegradedState(packet, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, packet: packet as unknown as ContextPacketV1, errors: [] };
}

export class ContextPacketValidationError extends Error {
  readonly errors: ContextPacketValidationIssue[];

  constructor(message: string, errors: ContextPacketValidationIssue[]) {
    super(message);
    this.name = 'ContextPacketValidationError';
    this.errors = errors;
  }
}

function validateSchemaVersion(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (value !== CONTEXT_PACKET_V1_SCHEMA_VERSION) {
    errors.push(error('schemaVersion', 'schema_version_invalid', 'schemaVersion must be context_packet.v1.'));
  }
}

function validateAssembler(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  const metadata = packet.metadata;
  if (!isRecord(metadata) || metadata.generatedBy !== CONTEXT_MANAGER_ASSEMBLER) {
    errors.push(error('metadata.generatedBy', 'context_manager_required', 'Context Manager must be the packet assembler.'));
  }
}

function validatePacketStatus(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  if (!['complete', 'degraded', 'failed'].includes(String(packet.packetStatus))) {
    errors.push(error('packetStatus', 'invalid_packet', 'packetStatus must be complete, degraded, or failed.'));
  }
}

function validateTenant(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(error('tenant', 'invalid_packet', 'tenant context is required.'));
    return;
  }

  requireString(value, 'tenantId', errors, 'tenant.tenantId');
  if (!['development', 'staging', 'production'].includes(String(value.environment))) {
    errors.push(error('tenant.environment', 'invalid_packet', 'tenant.environment must be development, staging, or production.'));
  }
}

function validateTeam(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(error('team', 'team_scope_invalid', 'Team Magnificent scope is required.'));
    return;
  }

  requireString(value, 'teamId', errors, 'team.teamId');
  if (value.teamKey !== TEAM_MAGNIFICENT_KEY) {
    errors.push(error('team.teamKey', 'team_scope_invalid', 'teamKey must be team_magnificent.'));
  }
  if (value.teamName !== TEAM_MAGNIFICENT_NAME) {
    errors.push(error('team.teamName', 'team_scope_invalid', 'teamName must be Team Magnificent.'));
  }
}

function validateBa(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(error('ba', 'ba_scope_invalid', 'BA context is required for Sprint 1 context packets.'));
    return;
  }

  requireString(value, 'tenantId', errors, 'ba.tenantId');
  requireString(value, 'teamId', errors, 'ba.teamId');
  requireString(value, 'baId', errors, 'ba.baId');
  if (value.teamKey !== TEAM_MAGNIFICENT_KEY) {
    errors.push(error('ba.teamKey', 'ba_scope_invalid', 'ba.teamKey must be team_magnificent.'));
  }
  if (value.teamName !== TEAM_MAGNIFICENT_NAME) {
    errors.push(error('ba.teamName', 'ba_scope_invalid', 'ba.teamName must be Team Magnificent.'));
  }
}

function validateAgent(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(error('agent', 'agent_identity_invalid', 'agent context is required.'));
    return;
  }

  if (!CONTEXT_PACKET_AGENT_KEYS.includes(value.agentKey as AgentKey)) {
    errors.push(error('agent.agentKey', 'agent_identity_invalid', 'agentKey must be a semantic runtime registry identity.'));
  }

  if (value.agentId !== undefined && CONTEXT_PACKET_AGENT_KEYS.includes(value.agentId as AgentKey)) {
    errors.push(error('agent.agentId', 'agent_identity_invalid', 'agentId must not be used as the semantic agent registry identity.'));
  }
}

function validateLanguage(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(error('language', 'language_invalid', 'language context is required.'));
    return;
  }

  if (!CONTEXT_PACKET_SUPPORTED_LANGUAGES.includes(value.primary as RuntimeLanguage)) {
    errors.push(error('language.primary', 'language_invalid', 'primary language must be en or es.'));
  }

  if (value.fallback !== undefined && !CONTEXT_PACKET_SUPPORTED_LANGUAGES.includes(value.fallback as RuntimeLanguage)) {
    errors.push(error('language.fallback', 'language_invalid', 'fallback language must be en or es when present.'));
  }

  if (typeof value.translationStatus !== 'string') {
    errors.push(error('language.translationStatus', 'language_invalid', 'translationStatus is required.'));
  }
}

function validateRuntimeRules(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!Array.isArray(value)) {
    errors.push(error('runtimeRules', 'runtime_rule_missing', 'runtimeRules must be present.'));
    return;
  }

  const ruleIds = new Set(
    value
      .filter(isRecord)
      .map((rule) => rule.ruleId)
      .filter((ruleId): ruleId is string => typeof ruleId === 'string'),
  );

  for (const requiredRuleId of REQUIRED_CONTEXT_RUNTIME_RULE_IDS) {
    if (!ruleIds.has(requiredRuleId)) {
      errors.push(error('runtimeRules', 'runtime_rule_missing', `Missing required runtime rule ${requiredRuleId}.`));
    }
  }
}

function validateGuardrails(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(error('guardrails', 'guardrail_missing', 'At least one guardrail is required.'));
  }
}

function validateApprovedKnowledge(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!Array.isArray(value)) {
    errors.push(error('approvedKnowledge', 'approved_knowledge_invalid', 'approvedKnowledge must be an array.'));
    return;
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(error(`approvedKnowledge.${index}`, 'approved_knowledge_invalid', 'Approved knowledge items must be objects.'));
      return;
    }

    if (item.status !== 'active') {
      errors.push(error(`approvedKnowledge.${index}.status`, 'approved_knowledge_invalid', 'Approved knowledge must be active.'));
    }

    if (item.governanceStatus !== 'approved' && item.governanceStatus !== 'approval_not_required') {
      errors.push(error(`approvedKnowledge.${index}.governanceStatus`, 'approved_knowledge_invalid', 'Approved knowledge requires approved governance status.'));
    }

    if (!isRecord(item.sourceTraceability) || typeof item.sourceTraceability.sourceId !== 'string') {
      errors.push(error(`approvedKnowledge.${index}.sourceTraceability`, 'approved_knowledge_invalid', 'Approved knowledge requires source traceability.'));
    }
  });
}

function validatePrivateContext(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  const baId = packetBaId(packet);
  const section = packet.privateContext;
  if (!isRecord(section) || !Array.isArray(section.items)) return;

  section.items.forEach((item, index) => {
    if (isRecord(item) && item.ownerBaId !== baId) {
      errors.push(error(`privateContext.items.${index}.ownerBaId`, 'private_context_scope_mismatch', 'Private context owner must match packet BA.'));
    }
  });
}

function validateRelationshipContext(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  const baId = packetBaId(packet);
  const section = packet.relationshipContext;
  if (!isRecord(section) || !Array.isArray(section.items)) return;

  section.items.forEach((item, index) => {
    if (isRecord(item) && item.ownerBaId !== baId) {
      errors.push(error(`relationshipContext.items.${index}.ownerBaId`, 'relationship_context_scope_mismatch', 'Relationship context owner must match packet BA.'));
    }
  });
}

function validateJournalContext(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  const baId = packetBaId(packet);
  const section = packet.journalContext;
  if (!isRecord(section) || !Array.isArray(section.entries)) return;

  if (section.privateByDefault !== true) {
    errors.push(error('journalContext.privateByDefault', 'journal_context_scope_mismatch', 'Journal context must be private by default.'));
  }

  section.entries.forEach((item, index) => {
    if (isRecord(item) && item.ownerBaId !== baId) {
      errors.push(error(`journalContext.entries.${index}.ownerBaId`, 'journal_context_scope_mismatch', 'Journal context owner must match packet BA.'));
    }
  });
}

function validateRetrievalAudit(value: unknown, errors: ContextPacketValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(error('retrievalAudit', 'retrieval_audit_invalid', 'retrievalAudit is required.'));
    return;
  }

  if (value.candidateKnowledgeIncluded !== false) {
    errors.push(error('retrievalAudit.candidateKnowledgeIncluded', 'candidate_knowledge_included', 'Candidate knowledge is excluded by default.'));
  }

  if (value.candidateKnowledgeExcluded !== true) {
    errors.push(error('retrievalAudit.candidateKnowledgeExcluded', 'candidate_knowledge_included', 'Candidate knowledge exclusion must be recorded.'));
  }

  if (!Array.isArray(value.exclusions)) {
    errors.push(error('retrievalAudit.exclusions', 'retrieval_audit_invalid', 'Retrieval audit exclusions are required.'));
  }
}

function validateDegradedState(packet: Record<string, unknown>, errors: ContextPacketValidationIssue[]): void {
  if ((packet.packetStatus === 'degraded' || packet.packetStatus === 'failed') && !isRecord(packet.degraded)) {
    errors.push(error('degraded', 'degraded_state_required', 'Degraded or failed packets require degraded state with safe fallback instruction.'));
    return;
  }

  if (isRecord(packet.degraded) && typeof packet.degraded.safeFallbackInstruction !== 'string') {
    errors.push(error('degraded.safeFallbackInstruction', 'degraded_state_required', 'safeFallbackInstruction is required when degraded state is present.'));
  }
}

function packetBaId(packet: Record<string, unknown>): BaId | undefined {
  return isRecord(packet.ba) ? (packet.ba.baId as BaId | undefined) : undefined;
}

function validateIsoTimestamp(value: unknown, path: string, errors: ContextPacketValidationIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(error(path, 'invalid_packet', `${path} is required.`));
    return;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    errors.push(error(path, 'invalid_packet', `${path} must be a valid ISO timestamp.`));
  }
}

function requireString(
  object: Record<string, unknown>,
  key: string,
  errors: ContextPacketValidationIssue[],
  path = key,
): void {
  if (typeof object[key] !== 'string' || object[key].trim().length === 0) {
    errors.push(error(path, 'invalid_packet', `${path} is required.`));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(
  path: string,
  code: ContextPacketValidationCode,
  message: string,
): ContextPacketValidationIssue {
  return { path, code, message };
}
