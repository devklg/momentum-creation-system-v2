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
}
