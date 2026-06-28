import type { AgentKey, RuntimeMode, RuntimeTaskType } from './agents.js';
import type {
  CausationId,
  ContextPacketId,
  CorrelationId,
  IdempotencyKey,
  RuntimeEventId,
  RuntimeResponseId,
  RuntimeTurnId,
  SessionId,
} from './ids.js';
import type { RuntimeScope } from './identity.js';
import type { RuntimeLanguage } from './language.js';

export type AgentEventSchemaVersion = 'agent_event.v1';

export type BrowserVoiceEventType =
  | 'browser_voice.capability_checked'
  | 'browser_voice.permission_requested'
  | 'browser_voice.permission_granted'
  | 'browser_voice.permission_denied'
  | 'browser_voice.listening_started'
  | 'browser_voice.interim_transcript'
  | 'browser_voice.final_transcript'
  | 'browser_voice.transcript_corrected'
  | 'browser_voice.language_changed'
  | 'browser_voice.speech_started'
  | 'browser_voice.speech_completed'
  | 'browser_voice.fallback_to_text'
  | 'browser_voice.error';

export type BrowserTextEventType =
  | 'browser_text.session.started'
  | 'browser_text.message.created'
  | 'browser_text.message.submitted'
  | 'browser_text.message.corrected'
  | 'browser_text.fallback_from_voice'
  | 'browser_text.error';

export type AgentRuntimeEventType =
  | 'agent.session.created'
  | 'agent.session.started'
  | 'agent.session.paused'
  | 'agent.session.resumed'
  | 'agent.session.completed'
  | 'agent.session.failed'
  | 'agent.session.cancelled'
  | 'agent.context.requested'
  | 'agent.context.received'
  | 'agent.turn.received'
  | 'agent.turn.responded'
  | 'agent.state.advanced'
  | 'agent.guided_action.created'
  | 'agent.journal_entry.created'
  | 'agent.knowledge_candidate.proposed'
  | 'agent.relationship_context.created'
  | 'agent.invitation_draft.created'
  | 'agent.invitation_link.requested'
  | 'agent.invitation_link.created'
  | 'agent.output_guardrail.blocked';

export type ContextManagerEventType =
  | 'context.requested'
  | 'context.validation.completed'
  | 'context.retrieval.started'
  | 'context.retrieval.completed'
  | 'context.packet.created'
  | 'context.packet.delivered'
  | 'context.packet.degraded'
  | 'context.packet.failed'
  | 'context.private_journal.included'
  | 'context.relationship_context.included'
  | 'context.candidate.excluded'
  | 'context.language.fallback_used'
  | 'context.audit.recorded';

export type KnowledgeEventType =
  | `knowledge.${string}`
  | `knowledge_core.${string}`
  | `knowledge_ingestion.${string}`;

export type JournalEventType = `journal.${string}`;
export type GuidedActionEventType = `guided_action.${string}`;
export type LearningEventType = `learning.${string}`;
export type ExternalRuntimeEventType = `external.${string}`;
export type SystemEventType = `system.${string}`;

export type AgentEventType =
  | BrowserVoiceEventType
  | BrowserTextEventType
  | AgentRuntimeEventType
  | ContextManagerEventType
  | KnowledgeEventType
  | JournalEventType
  | GuidedActionEventType
  | LearningEventType
  | ExternalRuntimeEventType
  | SystemEventType;

export type AgentEventSource =
  | 'browser_voice_runtime'
  | 'browser_text_runtime'
  | 'agent_runtime'
  | 'context_manager'
  | 'knowledge_core'
  | 'knowledge_ingestion'
  | 'learning_pipeline'
  | 'journal_runtime'
  | 'guided_action_runtime'
  | 'external_runtime'
  | 'implementation_test'
  | 'system';

export type AgentEventEnvelope<TPayload = Record<string, unknown>> = RuntimeScope & {
  eventId: RuntimeEventId;
  eventType: AgentEventType;
  schemaVersion: AgentEventSchemaVersion;
  agentKey?: AgentKey;
  sessionId?: SessionId;
  correlationId: CorrelationId;
  causationId?: CausationId;
  idempotencyKey: IdempotencyKey;
  source: AgentEventSource;
  payload: TPayload;
  occurredAt: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
};

export type EmitRuntimeEventRequest<TPayload = Record<string, unknown>> = RuntimeScope & {
  eventType: AgentEventType;
  agentKey?: AgentKey;
  sessionId?: SessionId;
  correlationId?: CorrelationId;
  causationId?: CausationId;
  idempotencyKey: IdempotencyKey;
  source: AgentEventSource;
  payload: TPayload;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export interface EmitRuntimeEventResponse<TPayload = Record<string, unknown>> {
  event: AgentEventEnvelope<TPayload>;
  idempotentReplay: boolean;
}

export interface AgentSessionCreatedPayload {
  sessionId: SessionId;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  mode: RuntimeMode;
  taskType: RuntimeTaskType;
}

export interface AgentTurnReceivedPayload {
  sessionId: SessionId;
  turnId: RuntimeTurnId;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  mode: RuntimeMode;
  turnSequence: number;
  stateKey: string;
}

export interface AgentTurnRespondedPayload {
  sessionId: SessionId;
  responseId: RuntimeResponseId;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  stateKey: string;
  outputMode: 'text' | 'voice_text';
  contextPacketId: ContextPacketId;
  suggestedActionIds?: string[];
}
