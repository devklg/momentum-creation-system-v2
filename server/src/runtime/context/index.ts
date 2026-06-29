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
