import {
  MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
  type McsRuntimeRequestScope,
} from '@momentum/shared/runtime';
import { persistenceCall } from '../persistence/dispatch.js';

type Persistence = typeof persistenceCall;

/**
 * Chroma supplies semantic ranking, never final lifecycle authority. A staged
 * or partially cut-over vector hit must also be active and eligible in
 * canonical Mongo before Context Manager may receive it.
 */
export async function filterCanonicalActiveKnowledgeChunkIds(
  candidateIds: readonly string[],
  scope: McsRuntimeRequestScope,
  persistence: Persistence = persistenceCall,
): Promise<Set<string>> {
  const ids = [...new Set(candidateIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const result = await persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
    collection: MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
    filter: {
      chunkId: { $in: ids },
      status: 'active',
      retrievalEligible: true,
      'scope.tenantId': scope.tenantId,
      ...(scope.teamId ? { 'scope.teamId': scope.teamId } : {}),
      ...(scope.teamKey ? { 'scope.teamKey': scope.teamKey } : {}),
      ...(scope.teamName ? { 'scope.teamName': scope.teamName } : {}),
    },
    projection: { chunkId: 1 },
    limit: ids.length,
  });
  return new Set((result.documents ?? []).flatMap((document) =>
    typeof document.chunkId === 'string' ? [document.chunkId] : []));
}
