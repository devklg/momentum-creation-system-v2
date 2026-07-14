import type { KnowledgeApprovalReference } from '@momentum/shared/runtime';
import { persistenceCall } from '../../../services/persistence/dispatch.js';
import type { EvolutionApprovalAuthorityPort } from '../services/EvolutionApproval.service.js';

const DECISION_COLLECTION = 'decisions';
const DECISION_CHROMA_COLLECTION = 'mcs_agent_system_events';

export const canonicalApprovalAuthority: EvolutionApprovalAuthorityPort = {
  async verify(reference: KnowledgeApprovalReference): Promise<boolean> {
    const [mongo, neo4j, chroma] = await Promise.all([
      persistenceCall<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
        database: 'momentum',
        collection: DECISION_COLLECTION,
        filter: { _id: reference.approvalId, status: 'active' },
        limit: 1,
      }),
      persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
        query: 'MATCH (d:Decision {id:$id, status:"active"}) RETURN d.id AS id, d.decidedBy AS decidedBy',
        params: { id: reference.approvalId },
      }),
      persistenceCall<{ ids?: string[]; metadatas?: Array<Record<string, unknown> | null> }>('chromadb', 'get', {
        collection: DECISION_CHROMA_COLLECTION,
        ids: [reference.approvalId],
      }),
    ]);
    const mongoDecision = mongo.documents?.[0];
    const graphDecision = neo4j.records?.[0];
    const chromaIndex = chroma.ids?.indexOf(reference.approvalId) ?? -1;
    const chromaDecision = chromaIndex >= 0 ? chroma.metadatas?.[chromaIndex] : null;
    return mongoDecision?.decision_id === reference.approvalId
      && mongoDecision.status === 'active'
      && graphDecision?.id === reference.approvalId
      && graphDecision.decidedBy === reference.approvedBy
      && chromaIndex >= 0
      && chromaDecision?.status === 'active';
  },
};
