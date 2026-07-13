import type { McsAdminKnowledgeStatusResponse } from '@momentum/shared';
import {
  MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
  MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
} from '@momentum/shared/runtime';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { getContextManagerDiagnosticsSnapshot } from '../services/contextManagerDiagnostics.js';
import { env } from '../env.js';
import { steveContextManagerLiveEnabled } from '../runtime/context/steveRuntimeContextFoundation.js';

const OUTBOX_COLLECTION = 'tmag_projection_outbox';
const TEAM_SCOPE = {
  'scope.tenantId': 'tenant_team_magnificent',
  'scope.teamId': 'team_magnificent',
  'scope.teamKey': 'team_magnificent',
  'scope.teamName': 'Team Magnificent',
} as const;

interface QueryResult { count?: number; documents?: unknown[] }

async function count(collection: string, filter: Record<string, unknown>): Promise<number> {
  const result = await persistenceCall<QueryResult>('mongodb', 'query', {
    database: 'momentum', collection, filter, projection: { _id: 1 }, limit: 1,
  });
  return result.count ?? result.documents?.length ?? 0;
}

export async function buildAdminKnowledgeStatus(): Promise<McsAdminKnowledgeStatusResponse> {
  const warnings: string[] = [];
  let degraded = false;
  const safeCount = async (label: string, collection: string, filter: Record<string, unknown>) => {
    try { return await count(collection, filter); }
    catch (error) {
      degraded = true;
      warnings.push(`${label} unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  };

  const activeSourceFilter = { status: 'active', 'authority.authorityStatus': 'active_authority', ...TEAM_SCOPE };
  const activeChunkFilter = { status: 'active', ...TEAM_SCOPE };
  const retrievalReadyFilter = { ...activeChunkFilter, retrievalEligible: true };
  const outboxBase = { tier: 'knowledge', mongoCollection: MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION };

  const [activeSources, activeChunks, retrievalEligibleChunks, pendingChromaProjections,
    failedChromaProjections, pendingNeo4jProjections, failedNeo4jProjections] = await Promise.all([
    safeCount('Active knowledge sources', MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION, activeSourceFilter),
    safeCount('Active knowledge chunks', MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION, activeChunkFilter),
    safeCount('Retrieval-eligible knowledge chunks', MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION, retrievalReadyFilter),
    safeCount('Pending Chroma projections', OUTBOX_COLLECTION, { ...outboxBase, target: 'chroma', status: 'pending' }),
    safeCount('Failed Chroma projections', OUTBOX_COLLECTION, { ...outboxBase, target: 'chroma', status: 'failed' }),
    safeCount('Pending Neo4j projections', OUTBOX_COLLECTION, { ...outboxBase, target: 'neo4j', status: 'pending' }),
    safeCount('Failed Neo4j projections', OUTBOX_COLLECTION, { ...outboxBase, target: 'neo4j', status: 'failed' }),
  ]);

  const unresolvedChroma = pendingChromaProjections + failedChromaProjections;
  const retrievalReadyChunks = Math.max(0, retrievalEligibleChunks - unresolvedChroma);
  if (unresolvedChroma > 0) warnings.push('Some eligible chunks have unresolved Chroma projections and are not counted as retrieval-ready.');
  if (pendingNeo4jProjections + failedNeo4jProjections > 0) warnings.push('Knowledge graph projections are not fully synchronized.');

  const status = degraded ? 'degraded'
    : activeSources === 0 || activeChunks === 0 || retrievalEligibleChunks === 0 ? 'empty'
      : retrievalReadyChunks === retrievalEligibleChunks ? 'ready' : 'partial';

  const contextManager = getContextManagerDiagnosticsSnapshot();
  return {
    ok: true, generatedAt: new Date().toISOString(), status,
    statusBasis: 'mongo_provider_eligibility_plus_projection_queue',
    activeSources, activeChunks, retrievalReadyChunks,
    pendingChromaProjections, failedChromaProjections,
    pendingNeo4jProjections, failedNeo4jProjections, warnings,
    contextManager: {
      ...contextManager,
      liveSurfaces: {
        michael: env.MCS_CONTEXT_MANAGER_LIVE_ENABLED,
        steve: steveContextManagerLiveEnabled(),
      },
    },
  };
}
