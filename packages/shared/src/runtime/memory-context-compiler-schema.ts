/**
 * Memory Context Compiler schema contract.
 *
 * The compiler combines the three memory functions of the app's separate
 * stores into one governed context shape an agent can operate from:
 *
 * - MongoDB: canonical memory/state/container function.
 * - Neo4j: relationship/edge/graph function.
 * - ChromaDB: semantic meaning/vector recall function.
 *
 * This contract is non-persistent by default. Persisting compiled shapes or
 * compiler traces requires an approved persistence projection.
 */

import type { McsAgentKey } from './agents.js';
import type { McsContextPacketId, McsKnowledgeId, McsSourceId, TmagId } from './ids.js';
import type { McsKnowledgeDomain } from './knowledge.js';

export const MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION =
  'memory_context_compiler.schema.v1' as const;

export type McsMemoryContextCompilerSchemaVersion =
  typeof MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION;

export type McsMemoryContextStore = 'mongo' | 'neo4j' | 'chroma';

export type McsMemoryContextStoreFunction =
  | 'canonical_memory'
  | 'relationship_graph'
  | 'semantic_meaning';

export type McsMemoryContextShapeStatus =
  | 'complete'
  | 'partial'
  | 'degraded'
  | 'failed';

export type McsMemoryContextIngredientKind =
  | 'canonical_record'
  | 'approved_knowledge'
  | 'semantic_match'
  | 'graph_relationship'
  | 'profile_signal'
  | 'session_signal'
  | 'guardrail'
  | 'exclusion';

export type McsMemoryContextPurpose =
  | 'success_interview'
  | 'training_support'
  | 'relationship_coaching'
  | 'invitation_drafting'
  | 'context_comparison'
  | 'session_resume'
  | 'guided_action_review';

export type McsMemoryContextPersistenceStatus =
  | 'not_persisted'
  | 'draft_only'
  | 'approved_for_persistence';

export interface McsMemoryContextCompilerIdentity {
  compilerName: 'memory_context_compiler';
  schemaVersion: McsMemoryContextCompilerSchemaVersion;
  compiledAt: string;
  purpose: McsMemoryContextPurpose;
  agentKeys: readonly McsAgentKey[];
}

export interface McsMemoryContextSubject {
  tmagId?: TmagId;
  discoveryId?: string;
  contextPacketId?: McsContextPacketId;
  sourceTitle?: string;
}

export interface McsMemoryContextStoreContribution {
  store: McsMemoryContextStore;
  function: McsMemoryContextStoreFunction;
  present: boolean;
  sourceIds: readonly string[];
  note: string;
}

export interface McsMemoryContextIngredient {
  ingredientId: string;
  kind: McsMemoryContextIngredientKind;
  sourceStore: McsMemoryContextStore;
  sourceId?: McsSourceId | string;
  knowledgeId?: McsKnowledgeId;
  domain?: McsKnowledgeDomain;
  title: string;
  summary: string;
  weight?: number;
  evidence?: readonly string[];
}

export interface McsCompiledMemoryContextShape {
  schemaVersion: McsMemoryContextCompilerSchemaVersion;
  compiler: McsMemoryContextCompilerIdentity;
  subject: McsMemoryContextSubject;
  status: McsMemoryContextShapeStatus;
  persistenceStatus: McsMemoryContextPersistenceStatus;
  storeContributions: readonly McsMemoryContextStoreContribution[];
  ingredients: readonly McsMemoryContextIngredient[];
  graphQuestions: readonly McsMemoryContextGraphQuestion[];
  graphEdges: readonly McsMemoryContextGraphEdge[];
  warnings: readonly string[];
}

export type McsMemoryContextSignalKey =
  | 'primary_why'
  | 'success_vision'
  | 'learning_style'
  | 'communication_preferences'
  | 'support_needs'
  | 'launch_recommendations'
  | 'training_recommendations'
  | 'michael_handoff'
  | 'discovery_answers';

export type McsMemoryContextComparisonMethod =
  | 'lexical_overlap'
  | 'semantic_similarity'
  | 'graph_relationship'
  | 'manual_review';

export type McsMemoryContextGraphQuestionKey =
  | 'what_created_this_memory'
  | 'what_does_this_memory_mean'
  | 'what_does_this_memory_support'
  | 'what_context_does_this_memory_require'
  | 'what_agent_action_does_this_memory_guide'
  | 'what_should_this_memory_retrieve'
  | 'what_does_this_memory_protect_or_exclude'
  | 'what_does_this_memory_handoff_to';

export type McsMemoryContextGraphVerb =
  | 'captures'
  | 'expresses'
  | 'supports'
  | 'requires_context'
  | 'guides'
  | 'retrieves'
  | 'grounds'
  | 'protects'
  | 'excludes'
  | 'hands_off_to'
  | 'relates_to'
  | 'supersedes'
  | 'contradicts';

export interface McsMemoryContextGraphQuestion {
  key: McsMemoryContextGraphQuestionKey;
  question: string;
  expectedVerbs: readonly McsMemoryContextGraphVerb[];
}

export interface McsMemoryContextGraphEdge {
  edgeId: string;
  questionKey: McsMemoryContextGraphQuestionKey;
  fromIngredientId: string;
  verb: McsMemoryContextGraphVerb;
  toIngredientId?: string;
  toKnowledgeId?: McsKnowledgeId;
  summary: string;
  confidence?: number;
  evidence?: readonly string[];
}

export type McsMemoryContextCoverageStatus =
  | 'covered'
  | 'partial'
  | 'missing'
  | 'not_evaluated';

export interface McsMemoryContextKnowledgeMatch {
  knowledgeId: McsKnowledgeId;
  title: string;
  domain?: McsKnowledgeDomain;
  method: McsMemoryContextComparisonMethod;
  score: number;
  sharedTerms?: readonly string[];
  reason: string;
}

export interface McsMemoryContextSignalCoverage {
  key: McsMemoryContextSignalKey;
  label: string;
  summary: string;
  tokenCount: number;
  status: McsMemoryContextCoverageStatus;
  matches: readonly McsMemoryContextKnowledgeMatch[];
  gapReason?: 'no_signal_text' | 'no_approved_knowledge' | 'below_threshold';
}

export interface McsMemoryContextComparisonSummary {
  approvedKnowledgeCount: number;
  coveredSignalCount: number;
  partialSignalCount: number;
  missingSignalCount: number;
  notEvaluatedSignalCount: number;
}

export interface McsMemoryContextComparisonReport {
  schemaVersion: McsMemoryContextCompilerSchemaVersion;
  compiledShape: McsCompiledMemoryContextShape;
  comparisonMethods: readonly McsMemoryContextComparisonMethod[];
  summary: McsMemoryContextComparisonSummary;
  signals: readonly McsMemoryContextSignalCoverage[];
  missingSignals: readonly McsMemoryContextSignalKey[];
  recommendedContextQuery: string;
  warnings: readonly string[];
}
