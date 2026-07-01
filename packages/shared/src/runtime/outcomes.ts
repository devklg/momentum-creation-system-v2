import type { McsAgentKey, McsRuntimeTaskType } from './agents.js';
import type { McsContextPacketId, McsGuidedActionId, McsOutcomeId, McsSessionId } from './ids.js';
import type { McsBaRuntimeScope } from './identity.js';
import type { McsRuntimeLanguage } from './language.js';

export type McsRuntimeOutcomeStatus =
  | 'created'
  | 'observed'
  | 'ba_accepted'
  | 'ba_completed'
  | 'ba_dismissed'
  | 'failed'
  | 'not_applicable';

export type McsLearningSignalStrength = 'weak' | 'moderate' | 'strong';

export interface McsRuntimeOutcomeReference extends McsBaRuntimeScope {
  outcomeId: McsOutcomeId;
  sessionId: McsSessionId;
  agentKey: McsAgentKey;
  taskType: McsRuntimeTaskType;
  language: McsRuntimeLanguage;
  contextPacketId?: McsContextPacketId;
  guidedActionId?: McsGuidedActionId;
  status: McsRuntimeOutcomeStatus;
  observedAt: string;
}

export interface McsLearningSignalReference {
  outcomeId: McsOutcomeId;
  signalStrength: McsLearningSignalStrength;
  reasonCodes: string[];
  capturedAt: string;
}
