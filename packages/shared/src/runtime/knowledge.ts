import type { RuntimeLanguage, RuntimeTranslationStatus } from './language.js';
import type { KnowledgeCandidateId, KnowledgeId, SourceId } from './ids.js';

export type KnowledgeDomain =
  | 'success'
  | 'training'
  | 'relationship'
  | 'performance'
  | 'organizational'
  | 'system'
  | 'governance';

export type KnowledgeLifecycleStatus =
  | 'candidate'
  | 'queued_for_review'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'superseded'
  | 'archived';

export interface KnowledgeReference {
  knowledgeId: KnowledgeId;
  domain: KnowledgeDomain;
  status: Extract<KnowledgeLifecycleStatus, 'approved' | 'active'>;
  language: RuntimeLanguage;
  translationStatus: RuntimeTranslationStatus;
  sourceId: SourceId;
}

export interface KnowledgeCandidateReference {
  candidateId: KnowledgeCandidateId;
  domain: KnowledgeDomain;
  status: Extract<KnowledgeLifecycleStatus, 'candidate' | 'queued_for_review'>;
  language: RuntimeLanguage;
  sourceId: SourceId;
  riskFlags: string[];
}
