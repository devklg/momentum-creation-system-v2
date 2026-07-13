export type McsKnowledgeWorkflowEdgeStatus = 'implemented' | 'test_only' | 'missing';

export interface McsKnowledgeWorkflowStage {
  id: string;
  lane: 'runtime_candidate' | 'context_agent' | 'knowledge_evolution' | 'kevin_admin_intake' | 'retrieval';
  label: string;
  sourceFile: string;
  sourceSymbol: string;
  inputState: string;
  outputState: string;
  persistence: string[];
  liveMount: boolean;
  proofTests: string[];
}

export interface McsKnowledgeWorkflowEdge {
  from: string;
  to: string;
  status: McsKnowledgeWorkflowEdgeStatus;
  reason: string;
  ownerTask: string;
}

export const MCS_KNOWLEDGE_WORKFLOW_STAGES: readonly McsKnowledgeWorkflowStage[] = [
  { id: 'runtime_detect', lane: 'runtime_candidate', label: 'Detect runtime learning candidate', sourceFile: 'server/src/domain/learningCandidates.ts', sourceSymbol: 'appendLearningCandidate', inputState: 'outcomes/signals', outputState: 'detected', persistence: ['momentum.mcs_learning_candidates', 'Neo4j:TmagLearningCandidate', 'Chroma:mcs_learning_candidates_review'], liveMount: false, proofTests: ['server/src/domain/__tests__/learningCandidates.test.ts'] },
  { id: 'runtime_review', lane: 'runtime_candidate', label: 'Record human candidate review', sourceFile: 'server/src/domain/learningCandidates.ts', sourceSymbol: 'reviewLearningCandidate', inputState: 'detected', outputState: 'approved|rejected', persistence: ['momentum.mcs_learning_candidates', 'Neo4j:TmagLearningCandidate'], liveMount: false, proofTests: ['server/src/domain/__tests__/learningCandidates.test.ts'] },
  { id: 'context_propose', lane: 'context_agent', label: 'Propose Kevin-authored context candidate', sourceFile: 'server/src/lib/contextAgent.ts', sourceSymbol: 'proposeCandidates', inputState: 'Kevin-authored session turns', outputState: 'proposed', persistence: ['momentum.mcs_learning_candidates (Mongo only)'], liveMount: false, proofTests: ['server/src/lib/__tests__/contextSystem.test.ts'] },
  { id: 'context_confirm', lane: 'context_agent', label: 'Confirm context candidate into note/handle memory', sourceFile: 'server/src/lib/contextAgent.ts', sourceSymbol: 'confirmCandidate', inputState: 'proposed', outputState: 'confirmed|rejected', persistence: ['agent note/handle stores', 'momentum.mcs_learning_candidates (Mongo only)'], liveMount: false, proofTests: ['server/src/lib/__tests__/contextSystem.test.ts'] },
  { id: 'evolution_start', lane: 'knowledge_evolution', label: 'Start approved-candidate evolution', sourceFile: 'server/src/runtime/knowledge-evolution/workers/approvedCandidateEvolution.worker.ts', sourceSymbol: 'createApprovedCandidateEvolutionWorker', inputState: 'knowledge.candidate.approved event', outputState: 'received|planning', persistence: ['knowledge_evolution_records', 'knowledge_evolution_plans'], liveMount: true, proofTests: ['server/src/runtime/knowledge-evolution/__tests__/acceptance.test.ts'] },
  { id: 'evolution_execute', lane: 'knowledge_evolution', label: 'Version, index, and graph-sync approved knowledge', sourceFile: 'server/src/runtime/knowledge-evolution/services/KnowledgeEvolution.service.ts', sourceSymbol: 'executeEvolutionPlan', inputState: 'planned', outputState: 'retrieval_ready|blocked|failed', persistence: ['knowledge evolution collections', 'per-domain Chroma active collections', 'Neo4j coordination'], liveMount: true, proofTests: ['server/src/runtime/knowledge-evolution/__tests__/services.test.ts'] },
  { id: 'resource_gate', lane: 'knowledge_evolution', label: 'Verify exact resource publishing readiness', sourceFile: 'server/src/domain/resourcePublishingGate.ts', sourceSymbol: 'verifyResourcePublishingGate', inputState: 'approved catalog version', outputState: 'allowed|blocked evidence', persistence: [], liveMount: false, proofTests: ['server/src/qa/__tests__/resourcePublishingGate.test.ts'] },
  { id: 'kevin_intake', lane: 'kevin_admin_intake', label: 'Create Kevin-authored active knowledge', sourceFile: 'server/src/services/knowledge/approvedKnowledgeStore.ts', sourceSymbol: 'createKevinApprovedKnowledgeSource', inputState: 'Kevin/admin-authored source', outputState: 'active source and chunks', persistence: ['mcs_knowledge_sources', 'mcs_knowledge_chunks', 'Neo4j:KnowledgeSource/KnowledgeChunk', 'Chroma:mcs_knowledge_chunks'], liveMount: true, proofTests: ['server/src/services/knowledge/__tests__/approvedKnowledgeStore.test.ts'] },
  { id: 'context_retrieval', lane: 'retrieval', label: 'Retrieve approved active knowledge for Context Packets', sourceFile: 'server/src/runtime/context/contextManagerRetrievalAdapter.ts', sourceSymbol: 'createContextManagerRetrievalAdapter', inputState: 'approved knowledge query', outputState: 'approved references|degraded empty', persistence: [], liveMount: true, proofTests: ['server/src/runtime/context/__tests__/contextManagerRetrievalAdapter.test.ts'] },
] as const;

export const MCS_KNOWLEDGE_WORKFLOW_EDGES: readonly McsKnowledgeWorkflowEdge[] = [
  { from: 'runtime_detect', to: 'runtime_review', status: 'implemented', reason: 'Domain functions share the app candidate record, but remain wired-dormant with no review route.', ownerTask: 'P1-85-map' },
  { from: 'runtime_review', to: 'evolution_start', status: 'missing', reason: 'reviewLearningCandidate emits no knowledge.candidate.approved event and builds no repository-bound evolution request.', ownerTask: 'future-candidate-evolution-bridge' },
  { from: 'context_propose', to: 'runtime_detect', status: 'missing', reason: 'Context Agent uses incompatible proposed/confirmed vocabulary and Mongo-only persistence in the same collection.', ownerTask: 'future-candidate-schema-reconciliation' },
  { from: 'context_confirm', to: 'evolution_start', status: 'missing', reason: 'Confirmation writes agent notes/handles and does not create approved knowledge or an evolution event.', ownerTask: 'future-context-knowledge-bridge' },
  { from: 'evolution_start', to: 'evolution_execute', status: 'test_only', reason: 'Acceptance fixtures drive the worker pipeline, but the candidate review path does not produce its trigger.', ownerTask: 'future-candidate-evolution-bridge' },
  { from: 'evolution_execute', to: 'resource_gate', status: 'missing', reason: 'Knowledge Evolution readiness is not bound to the P1-84 exact resource catalog gate.', ownerTask: 'future-evolution-resource-gate' },
  { from: 'resource_gate', to: 'context_retrieval', status: 'missing', reason: 'The current approved provider reads mcs_knowledge_chunks and does not authorize candidates through tmag_resource_catalog.', ownerTask: 'future-catalog-authorized-retrieval' },
  { from: 'kevin_intake', to: 'context_retrieval', status: 'implemented', reason: 'Kevin/admin-authored sources directly create active, governed chunks consumed by the approved provider.', ownerTask: 'existing-admin-fast-lane' },
] as const;

export function knowledgeWorkflowOpenGaps(): readonly McsKnowledgeWorkflowEdge[] {
  return MCS_KNOWLEDGE_WORKFLOW_EDGES.filter((edge) => edge.status !== 'implemented');
}
