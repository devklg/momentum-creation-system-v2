import type { AgentKey, RuntimeTaskType } from './agents.js';
import type { ContextPacketId, GuidedActionId, OutcomeId, SessionId } from './ids.js';
import type { BaRuntimeScope } from './identity.js';
import type { RuntimeLanguage } from './language.js';

export type RuntimeOutcomeStatus =
  | 'created'
  | 'observed'
  | 'ba_accepted'
  | 'ba_completed'
  | 'ba_dismissed'
  | 'failed'
  | 'not_applicable';

export type LearningSignalStrength = 'weak' | 'moderate' | 'strong';

export interface RuntimeOutcomeReference extends BaRuntimeScope {
  outcomeId: OutcomeId;
  sessionId: SessionId;
  agentKey: AgentKey;
  taskType: RuntimeTaskType;
  language: RuntimeLanguage;
  contextPacketId?: ContextPacketId;
  guidedActionId?: GuidedActionId;
  status: RuntimeOutcomeStatus;
  observedAt: string;
}

export interface LearningSignalReference {
  outcomeId: OutcomeId;
  signalStrength: LearningSignalStrength;
  reasonCodes: string[];
  capturedAt: string;
}
