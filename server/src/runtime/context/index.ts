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

// Steve runtime Context Packet foundation — keeps the already-operational Steve
// discovery runtime behind a server-assembled Context Manager / approved knowledge path.
export {
  createSteveRuntimeContextManagerPort,
  requestSteveRuntimeContextPacket,
  steveContextManagerLiveEnabled,
} from './steveRuntimeContextFoundation.js';
export type { SteveRuntimeContextFoundationInput } from './steveRuntimeContextFoundation.js';

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
// for buildContextPacket(). Fail-closed; constructs no store/persistence dispatch client.
export {
  createContextManagerRetrievalAdapter,
  toContextReferences,
} from './contextManagerRetrievalAdapter.js';
export type {
  ApprovedKnowledgeProvider,
  ContextManagerRetrievalAdapter,
  ContextManagerRetrievalAdapterOptions,
  RetrievalObservabilitySink,
} from './contextManagerRetrievalAdapter.js';

// P4.8 — Knowledge Retrieval Observability: a content-free record emitted per retrieval call via
// an opt-in sink. Pure builder; no persistence, no PERSISTENCE, no LLM.
export {
  KNOWLEDGE_RETRIEVAL_OBSERVABILITY_SCHEMA_VERSION,
  buildRetrievalObservabilityRecord,
} from './retrievalObservability.js';
export type {
  RetrievalObservabilityRecord,
  RetrievalObservabilityInput,
  RetrievalStageCounts,
  RetrievalObservabilityScope,
} from './retrievalObservability.js';

// P4.9 — Approved-Knowledge Safe Fallback Upgrade: map a fail-closed retrieval degrade into a
// reason-specific, safe, compliant DegradedContextState for the packet. Pure; assembles no packet.
export {
  SAFE_FALLBACK_BASE_DIRECTIVE,
  resolveSafeFallbackState,
  safeFallbackFromResult,
} from './safeFallback.js';
export type { SafeFallbackInput, SafeFallbackPacketInput } from './safeFallback.js';

// P4.10 — Next Training Step Resolution: deterministically select the agent's next step over the
// approved-knowledge retrieval result; fail-closed to the P4.9 safe fallback. Pure; selects,
// never generates; assembles no packet.
export { resolveNextTrainingStep } from './nextTrainingStep.js';
export type {
  NextTrainingStep,
  NextTrainingStepInput,
  NextTrainingStepResolution,
  NextTrainingStepStatus,
  NextTrainingStepReasonCode,
} from './nextTrainingStep.js';

// Context Manager request service — the Planner / Executor / Tracer boundary that turns a
// runtime context request into a Context Packet through the injected Knowledge Core boundary.
export {
  ContextManagerServiceError,
  createContextManagerService,
  createContextManagerServiceFromRetrieval,
  planContextRequest,
} from './contextManagerService.js';
export type {
  ContextManagerExecutionTrace,
  ContextManagerPlan,
  ContextManagerService,
  ContextManagerServiceInput,
  ContextManagerServiceOptions,
  ContextManagerServiceResult,
} from './contextManagerService.js';
