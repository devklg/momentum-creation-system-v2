import type { AgentKey } from './agents.js';
import type { AgentEventEnvelope } from './events.js';
import type { ContextPacketV1 } from './context-packets.js';
import type { BaRuntimeScope } from './identity.js';

export type RuntimeQaStatus = 'PASS' | 'LIMITED' | 'FAIL';

export type RuntimeQaCategory =
  | 'team_magnificent_scope'
  | 'runtime_event_envelope'
  | 'context_packet_schema'
  | 'telnyx_exclusion'
  | 'agent_store_access_boundary'
  | 'gateway_fallback_preservation'
  | 'direct_persistence_adapter_health'
  | 'rollback_flags'
  | 'language_support';

export interface RuntimeQaAssertion {
  assertionId: string;
  category: RuntimeQaCategory;
  status: RuntimeQaStatus;
  summary: string;
  evidence?: string[];
  limitations?: string[];
}

export interface RuntimeQaFixtureScope extends BaRuntimeScope {
  agentKey?: AgentKey;
}

export interface RuntimeEventEnvelopeFixture<TPayload = Record<string, unknown>> {
  fixtureId: string;
  event: AgentEventEnvelope<TPayload>;
}

export interface ContextPacketFixture {
  fixtureId: string;
  packet: ContextPacketV1;
}

export interface RuntimeVerificationReportShape {
  reportId: string;
  status: RuntimeQaStatus;
  commandsRun: string[];
  environmentFlags: Record<string, string>;
  assertions: RuntimeQaAssertion[];
  failures: string[];
  limitations: string[];
  recommendation: string;
}
