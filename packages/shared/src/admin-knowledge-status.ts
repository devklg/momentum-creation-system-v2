export type McsAdminKnowledgeReadiness = 'ready' | 'partial' | 'empty' | 'degraded';

export type McsAdminKnowledgeIntegrityState = 'clear' | 'conflicts' | 'degraded' | 'truncated';

export type McsKnowledgeSourceConflictClass =
  | 'active_source_ref_divergence'
  | 'active_source_identity_divergence'
  | 'resource_projection_digest_mismatch'
  | 'active_authority_state_mismatch'
  | 'active_exact_duplicate';

export type McsKnowledgeSourceConflictSeverity = 'critical' | 'high' | 'medium' | 'advisory';

export interface McsKnowledgeSourceConflictFingerprint {
  conflictClass: McsKnowledgeSourceConflictClass;
  severity: McsKnowledgeSourceConflictSeverity;
  fingerprint: string;
}

export interface McsAdminKnowledgeIntegrityStatus {
  status: McsAdminKnowledgeIntegrityState;
  computedAt: string;
  conflictCount: number;
  highestSeverity: McsKnowledgeSourceConflictSeverity | null;
  counts: Record<McsKnowledgeSourceConflictClass, number>;
  scan: {
    sourceLimit: number;
    resourceLimit: number;
    sourcesObserved: number;
    resourcesObserved: number;
    complete: boolean;
  };
  degradedReasons: Array<{ reason: string; count: number }>;
  samples: McsKnowledgeSourceConflictFingerprint[];
  mutationAuthorized: false;
}

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
  integrity: McsAdminKnowledgeIntegrityStatus;
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
