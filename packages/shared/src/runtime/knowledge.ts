import type { McsRuntimeLanguage, McsRuntimeTranslationStatus } from './language.js';
import type { McsKnowledgeCandidateId, McsKnowledgeId, McsSourceId } from './ids.js';
import type { McsKnowledgeFreshness } from './knowledge-freshness.js';

export type McsKnowledgeDomain =
  | 'success'
  | 'training'
  | 'relationship'
  | 'performance'
  | 'organizational'
  | 'system'
  | 'governance';

export type McsKnowledgeLifecycleStatus =
  | 'candidate'
  | 'queued_for_review'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'superseded'
  | 'archived';

export interface McsKnowledgeReference {
  knowledgeId: McsKnowledgeId;
  domain: McsKnowledgeDomain;
  status: Extract<McsKnowledgeLifecycleStatus, 'approved' | 'active'>;
  language: McsRuntimeLanguage;
  translationStatus: McsRuntimeTranslationStatus;
  sourceId: McsSourceId;
  // P4.7 — optional freshness/deprecation descriptor. Absent ⇒ treated as current (a reference
  // without this field behaves exactly as pre-P4.7).
  freshness?: McsKnowledgeFreshness;
}

export interface McsKnowledgeCandidateReference {
  candidateId: McsKnowledgeCandidateId;
  domain: McsKnowledgeDomain;
  status: Extract<McsKnowledgeLifecycleStatus, 'candidate' | 'queued_for_review'>;
  language: McsRuntimeLanguage;
  sourceId: McsSourceId;
  riskFlags: string[];
}
