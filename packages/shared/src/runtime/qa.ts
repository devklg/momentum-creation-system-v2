import type { McsAgentKey } from './agents.js';
import type { McsAgentEventEnvelope } from './events.js';
import type { McsContextPacketV1 } from './context-packets.js';
import type { McsBaRuntimeScope } from './identity.js';

export type McsRuntimeQaStatus = 'PASS' | 'LIMITED' | 'FAIL';

export type McsRuntimeQaCategory =
  | 'team_magnificent_scope'
  | 'runtime_event_envelope'
  | 'context_packet_schema'
  | 'telnyx_exclusion'
  | 'agent_store_access_boundary'
  | 'gateway_fallback_preservation'
  | 'direct_persistence_adapter_health'
  | 'rollback_flags'
  | 'language_support';

export interface McsRuntimeQaAssertion {
  assertionId: string;
  category: McsRuntimeQaCategory;
  status: McsRuntimeQaStatus;
  summary: string;
  evidence?: string[];
  limitations?: string[];
}

export interface McsRuntimeQaFixtureScope extends McsBaRuntimeScope {
  agentKey?: McsAgentKey;
}

export interface McsRuntimeEventEnvelopeFixture<TPayload = Record<string, unknown>> {
  fixtureId: string;
  event: McsAgentEventEnvelope<TPayload>;
}

export interface McsContextPacketFixture {
  fixtureId: string;
  packet: McsContextPacketV1;
}

export interface McsRuntimeVerificationReportShape {
  reportId: string;
  status: McsRuntimeQaStatus;
  commandsRun: string[];
  environmentFlags: Record<string, string>;
  assertions: McsRuntimeQaAssertion[];
  failures: string[];
  limitations: string[];
  recommendation: string;
}
