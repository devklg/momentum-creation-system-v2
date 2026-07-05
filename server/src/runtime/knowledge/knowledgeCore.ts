import type {
  McsKnowledgeCandidateReference,
  McsKnowledgeReference,
  McsRuntimeRequestScope,
} from '@momentum/shared/runtime';
import { defineRuntimeBoundary } from '../common.js';
import type { BackendRuntimeBoundaryDescriptor } from '../common.js';

export interface KnowledgeCoreBoundaryPort {
  listApprovedKnowledge(scope: McsRuntimeRequestScope): Promise<readonly McsKnowledgeReference[]>;
  searchApprovedKnowledge(
    scope: McsRuntimeRequestScope,
    query: string,
    k?: number,
  ): Promise<readonly McsKnowledgeReference[]>;
  listCandidateKnowledgeForReview(
    scope: McsRuntimeRequestScope,
  ): Promise<readonly McsKnowledgeCandidateReference[]>;
}

export const knowledgeCoreBoundary = defineRuntimeBoundary({
  key: 'knowledge_core',
  label: 'Knowledge Core',
  status: 'skeleton_only',
  activated: false,
  apiMounted: false,
  behaviorEnabled: false,
  persistenceAccess: 'service_boundary_only',
  sharedContractImport: '@momentum/shared/runtime',
  notes: [
    'Approved knowledge access boundary only; no database, adapter, or PERSISTENCE import is allowed here.',
    'Future implementations must return scoped shared runtime knowledge contracts through service-owned persistence.',
  ],
} satisfies BackendRuntimeBoundaryDescriptor<'knowledge_core'>);
