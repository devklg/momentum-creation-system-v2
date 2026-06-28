export type {
  BackendRuntimeBoundaryDescriptor,
  BackendRuntimeBoundaryKey,
} from './common.js';

export {
  agentRuntimeBoundary,
} from './agents/agentRuntime.js';
export type {
  AgentRuntimeBoundaryPort,
} from './agents/agentRuntime.js';
export {
  browserVoiceTextRuntimeBoundary,
} from './browser/voiceTextRuntime.js';
export type {
  BrowserVoiceTextRuntimeBoundaryPort,
} from './browser/voiceTextRuntime.js';
export {
  contextManagerBoundary,
} from './context/contextManager.js';
export type {
  ContextManagerBoundaryPort,
} from './context/contextManager.js';
export {
  eventRuntimeBoundary,
} from './events/eventRuntime.js';
export type {
  EventRuntimeBoundaryPort,
} from './events/eventRuntime.js';
export {
  knowledgeCoreBoundary,
} from './knowledge/knowledgeCore.js';
export type {
  KnowledgeCoreBoundaryPort,
} from './knowledge/knowledgeCore.js';

import { agentRuntimeBoundary } from './agents/agentRuntime.js';
import { browserVoiceTextRuntimeBoundary } from './browser/voiceTextRuntime.js';
import { contextManagerBoundary } from './context/contextManager.js';
import { eventRuntimeBoundary } from './events/eventRuntime.js';
import { knowledgeCoreBoundary } from './knowledge/knowledgeCore.js';

export const backendRuntimeBoundaries = [
  knowledgeCoreBoundary,
  contextManagerBoundary,
  agentRuntimeBoundary,
  eventRuntimeBoundary,
  browserVoiceTextRuntimeBoundary,
] as const;
