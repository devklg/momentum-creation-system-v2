export type McsAdminKnowledgeReadiness = 'ready' | 'partial' | 'empty' | 'degraded';

export interface McsAdminKnowledgeStatusResponse {
  ok: true;
  generatedAt: string;
  status: McsAdminKnowledgeReadiness;
  statusBasis: 'mongo_provider_eligibility_plus_projection_queue';
  activeSources: number;
  activeChunks: number;
  retrievalReadyChunks: number;
  pendingChromaProjections: number;
  failedChromaProjections: number;
  pendingNeo4jProjections: number;
  failedNeo4jProjections: number;
  warnings: string[];
  contextManager: {
    retention: 'in_process_since_restart';
    liveSurfaces: { michael: boolean; steve: boolean };
    total: number;
    successful: number;
    degraded: number;
    lastObservedAt: string | null;
    degradedReasons: Array<{ reason: string; count: number }>;
  };
  retrievalPerformance: {
    retention: 'in_process_since_restart';
    approvedReferenceCache: {
      ttlMs: number;
      maxEntries: number;
      hits: number;
      misses: number;
      coalesced: number;
      evictions: number;
      size: number;
      inFlight: number;
      invalidations: number;
      generation: number;
    };
    graphRagReadiness: {
      maxUniqueIds: number;
      batches: number;
      requestedIds: number;
      storeCalls: {
        mongoCanonical: number;
        mongoOutbox: number;
        neo4j: number;
        chroma: number;
      };
    };
  };
}
