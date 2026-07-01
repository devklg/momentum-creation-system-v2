import type { McsAgentKey, McsRuntimeMode, McsRuntimeTaskType } from './agents.js';
import type {
  McsCausationId,
  McsContextPacketId,
  McsCorrelationId,
  McsIdempotencyKey,
  McsRuntimeEventId,
  McsRuntimeResponseId,
  McsRuntimeTurnId,
  McsSessionId,
} from './ids.js';
import type { McsRuntimeScope } from './identity.js';
import type { McsRuntimeLanguage } from './language.js';

export type McsAgentEventSchemaVersion = 'agent_event.v1';

export type McsBrowserVoiceEventType =
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

export type McsBrowserTextEventType =
  | 'browser_text.session.started'
  | 'browser_text.message.created'
  | 'browser_text.message.submitted'
  | 'browser_text.message.corrected'
  | 'browser_text.fallback_from_voice'
  | 'browser_text.error';

export type McsAgentRuntimeEventType =
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

export type McsContextManagerEventType =
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

export type McsKnowledgeEventType =
  | `knowledge.${string}`
  | `knowledge_core.${string}`
  | `knowledge_ingestion.${string}`;

export type McsJournalEventType = `journal.${string}`;
export type McsGuidedActionEventType = `guided_action.${string}`;
export type McsLearningEventType = `learning.${string}`;
export type McsExternalRuntimeEventType = `external.${string}`;
export type McsSystemEventType = `system.${string}`;

export type McsAgentEventType =
  | McsBrowserVoiceEventType
  | McsBrowserTextEventType
  | McsAgentRuntimeEventType
  | McsContextManagerEventType
  | McsKnowledgeEventType
  | McsJournalEventType
  | McsGuidedActionEventType
  | McsLearningEventType
  | McsExternalRuntimeEventType
  | McsSystemEventType;

export type McsAgentEventSource =
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

export type McsAgentEventEnvelope<TPayload = Record<string, unknown>> = McsRuntimeScope & {
  eventId: McsRuntimeEventId;
  eventType: McsAgentEventType;
  schemaVersion: McsAgentEventSchemaVersion;
  agentKey?: McsAgentKey;
  sessionId?: McsSessionId;
  correlationId: McsCorrelationId;
  causationId?: McsCausationId;
  idempotencyKey: McsIdempotencyKey;
  source: McsAgentEventSource;
  payload: TPayload;
  occurredAt: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
};

export type McsEmitRuntimeEventRequest<TPayload = Record<string, unknown>> = McsRuntimeScope & {
  eventType: McsAgentEventType;
  agentKey?: McsAgentKey;
  sessionId?: McsSessionId;
  correlationId?: McsCorrelationId;
  causationId?: McsCausationId;
  idempotencyKey: McsIdempotencyKey;
  source: McsAgentEventSource;
  payload: TPayload;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export interface McsEmitRuntimeEventResponse<TPayload = Record<string, unknown>> {
  event: McsAgentEventEnvelope<TPayload>;
  idempotentReplay: boolean;
}

export interface McsAgentSessionCreatedPayload {
  sessionId: McsSessionId;
  agentKey: McsAgentKey;
  language: McsRuntimeLanguage;
  mode: McsRuntimeMode;
  taskType: McsRuntimeTaskType;
}

export interface McsAgentTurnReceivedPayload {
  sessionId: McsSessionId;
  turnId: McsRuntimeTurnId;
  agentKey: McsAgentKey;
  language: McsRuntimeLanguage;
  mode: McsRuntimeMode;
  turnSequence: number;
  stateKey: string;
}

export interface McsAgentTurnRespondedPayload {
  sessionId: McsSessionId;
  responseId: McsRuntimeResponseId;
  agentKey: McsAgentKey;
  language: McsRuntimeLanguage;
  stateKey: string;
  outputMode: 'text' | 'voice_text';
  contextPacketId: McsContextPacketId;
  suggestedActionIds?: string[];
}
