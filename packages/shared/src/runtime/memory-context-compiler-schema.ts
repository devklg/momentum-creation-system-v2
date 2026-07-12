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

// ---------------------------------------------------------------------------
// ACR-0013 appendix — context retrieval standard (guard + ladder).
// APPEND-ONLY EXTENSION of memory_context_compiler.schema.v1 (CDX-001).
// Nothing above this line may be edited; these types finish the schema, they
// do not replace it (ACR-0013 header). Graph questions, graph verbs, and
// store functions defined above remain the vocabulary for expansion.
// ---------------------------------------------------------------------------

/** Who originally stated a remembered claim. An agent's prior suggestion is
 * NOT Kevin's decision, even if he reacted well to it (ACR-0013 §4.4). */
export type McsMemoryStatedBy = 'kevin' | 'agent' | 'unknown';

/** Which physical stack a store lives on. Both host a `momentum` database;
 * naming the stack is mandatory before any verifying operation (ACR-0012 §2.2). */
export type McsMemoryStackName = 'memory' | 'app';

/** The stores an index must cover — an index of one is a fragment (ACR-0013 §3). */
export type McsMemoryStoreKey =
  | 'memory_index'
  | 'memory_decisions'
  | 'kevin_milestone_chats'
  | 'session_handoffs'
  | 'chat_registry'
  | 'governance_decisions'
  | 'claude_learning_notes'
  | 'kevin_library'
  | 'mcs_memory_context_index';

/** Provenance carried on every retrieval claim (ACR-0013 §4.4). */
export interface McsMemoryProvenance {
  stack: McsMemoryStackName;
  storeKey: McsMemoryStoreKey;
  /** e.g. `universal_gateway.memory_index` */
  storePath: string;
  recordId: string;
  date: string | null;
  statedBy: McsMemoryStatedBy;
}

/** A single guard/retrieval hit, with the instructions that travel with it. */
export interface McsContextGuardHit {
  provenance: McsMemoryProvenance;
  title: string;
  summary: string;
  /** 0–10 human-assigned meaning gradient, when the record carries one. */
  weight?: number;
  /** Chroma distance when the hit came from semantic search. */
  distance?: number;
  matchKind: 'exact_handle' | 'exact_alias' | 'use_when' | 'lexical' | 'semantic';
  useWhen?: string;
  nextAgentInstruction?: string;
  superseded: boolean;
  supersededBy?: string;
}

/** checkExisting() output — retrieval before invention (ACR-0014 §3.1). */
export interface McsContextGuardReport {
  schemaVersion: McsMemoryContextCompilerSchemaVersion;
  topic: string;
  checkedAt: string;
  /** Every store searched, whether or not it hit. Absence discipline: "I don't
   * have that" is sayable only when this covers all stores (ACR-0013 §4.6). */
  storesSearched: readonly string[];
  storesUnreachable: readonly string[];
  hits: readonly McsContextGuardHit[];
  /** true only when every store was reachable AND no hit was found. */
  verifiedAbsent: boolean;
}

/** The rung of the retrieval ladder that produced a packet (ACR-0013 §4). */
export type McsRetrievalLadderRung = 'invocation' | 'compiled' | 'semantic_fallback';

/** An implementation brief pointer, in the stated order (never re-ranked). */
export interface McsContextPacketBrief {
  key: string;
  path: string;
  role: string;
  action: string;
}

/** compileContextPacket() output. Server compiles; runtime agents never query
 * stores directly (ACR-0013 §6). Token-budgeted and ranked internally. */
export interface McsContextPacket {
  schemaVersion: McsMemoryContextCompilerSchemaVersion;
  query: string;
  ladderRung: McsRetrievalLadderRung;
  compiledAt: string;
  /** The deterministic handle match, when rung = invocation. */
  invokedHandle?: {
    recordId: string;
    humanHandle: string;
    matchedPhrase: string;
    weight?: number;
  };
  canonicalRecord?: McsContextGuardHit;
  /** Neo4j expansion along requires_context/grounds/supports/hands_off_to/supersedes. */
  graphExpansion: readonly McsMemoryContextGraphEdge[];
  /** Capped semantic neighbours. */
  semanticNeighbours: readonly McsContextGuardHit[];
  implementationBriefs: readonly McsContextPacketBrief[];
  /** Superseded records surfaced AS superseded, never silently (ACR-0013 §4.5). */
  supersededRecords: readonly McsContextGuardHit[];
  tokenBudget: { maxChars: number; usedChars: number; truncated: boolean };
  warnings: readonly string[];
}

/** Context-agent candidate kinds (ACR-0014 §3.2). */
export type McsLearningCandidateKind =
  | 'decision'
  | 'correction'
  | 'reversal'
  | 'open_question'
  | 'front_of_line';

/** A parsed candidate. Evidence or it didn't happen: Kevin's actual words. */
export interface McsLearningCandidate {
  candidateId: string;
  kind: McsLearningCandidateKind;
  proposedSummary: string;
  /** Kevin's exact words, verbatim. */
  evidenceQuote: string;
  /** Turn reference within the session transcript. */
  evidenceTurn: number;
  statedBy: McsMemoryStatedBy;
  sessionRef: string;
  /** Always `proposed` at parse time — the agent never self-confirms. */
  status: 'proposed';
}
