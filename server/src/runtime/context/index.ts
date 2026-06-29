export type {
  ContextPacketFoundationBoundary,
  ContextPacketFoundationRequest,
  ContextPacketValidationCode,
  ContextPacketValidationIssue,
  ContextPacketValidationResult,
} from './types.js';

export {
  CONTEXT_MANAGER_ASSEMBLER,
  CONTEXT_PACKET_AGENT_KEYS,
  CONTEXT_PACKET_SUPPORTED_LANGUAGES,
  CONTEXT_PACKET_V1_SCHEMA_VERSION,
  REQUIRED_CONTEXT_RUNTIME_RULE_IDS,
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
  ContextPacketValidationError,
  assertValidContextPacketV1,
  contextPacketFoundationBoundary,
  prepareContextPacketFoundation,
  validateContextPacketV1,
} from './validation.js';

// S3.10 remediation — sanctioned CONTEXT-LAYER home for Michael runtime packet
// assembly. The orchestration turn source injects this port; it never assembles.
export { createMichaelRuntimeContextManagerPort } from './michaelRuntimeContextFoundation.js';
export type { MichaelRuntimeContextFoundationInput } from './michaelRuntimeContextFoundation.js';

// P4.2 — Approved Knowledge Query Contract: context-layer guards for the store-agnostic
// approved_knowledge_query.v1 contract (shared types live in @momentum/shared/runtime).
export {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  APPROVED_KNOWLEDGE_SUPPORTED_LANGUAGES,
  APPROVED_KNOWLEDGE_EXCLUSION_REASONS,
  APPROVED_KNOWLEDGE_DEGRADE_REASONS,
  APPROVED_REFERENCE_STATUSES,
  KNOWLEDGE_DOMAINS,
  ApprovedKnowledgeQueryValidationError,
  assertApprovedKnowledgeQueryResult,
  validateApprovedKnowledgeQueryRequest,
  validateApprovedKnowledgeQueryResult,
} from './approvedKnowledgeQueryContract.js';
export type {
  ApprovedKnowledgeQueryRequestValidationResult,
  ApprovedKnowledgeQueryResultValidationResult,
  ApprovedKnowledgeQueryValidationCode,
  ApprovedKnowledgeQueryValidationIssue,
} from './approvedKnowledgeQueryContract.js';

// P4.4 — Context Manager Retrieval Adapter: the sole runtime edge that obtains approved
// knowledge through the injected Knowledge Core boundary and maps it to ContextReferences
// for buildContextPacket(). Fail-closed; constructs no store/Gateway client.
export {
  createContextManagerRetrievalAdapter,
  toContextReferences,
} from './contextManagerRetrievalAdapter.js';
export type {
  ApprovedKnowledgeProvider,
  ContextManagerRetrievalAdapter,
} from './contextManagerRetrievalAdapter.js';
