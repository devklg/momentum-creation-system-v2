/**
 * Knowledge Evolution — canonical Mongo index specifications (Lane A, spec §27).
 *
 * Declarative index catalog per collection plus `ensureKnowledgeEvolutionIndexes`,
 * which applies them against the dedicated app Mongo (:30000) via the same
 * connection the direct persistence layer owns. Idempotent: `createIndex` is a
 * no-op when the index already exists.
 *
 * The brief mandates indexes for: evolutionId, tenantId, teamId, teamKey, baId,
 * inputType, inputId, status, domain, language, targetKnowledgeObjectId,
 * createdAt, approval-reference ids, and retrieval/indexing/graph statuses —
 * every one appears below as the leading key of an index on the collection(s)
 * where the field exists.
 */

import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import { getMongoConnection } from '../../../services/persistence/mongo/connection.js';
import { KNOWLEDGE_EVOLUTION_MONGO_DB } from './mongoRepository.js';

export interface KnowledgeEvolutionIndexSpec {
  key: Record<string, 1 | -1>;
  options: { name: string; unique?: boolean };
}

const C = KNOWLEDGE_EVOLUTION_COLLECTIONS;

/**
 * Per-collection index specifications. The map key is the canonical collection
 * name; the value is the ordered list of indexes to ensure.
 */
export const KNOWLEDGE_EVOLUTION_INDEX_SPECS: Record<string, KnowledgeEvolutionIndexSpec[]> = {
  [C.records]: [
    { key: { evolutionId: 1 }, options: { name: 'ke_records_evolutionId', unique: true } },
    { key: { tenantId: 1 }, options: { name: 'ke_records_tenantId' } },
    { key: { teamId: 1 }, options: { name: 'ke_records_teamId' } },
    { key: { teamKey: 1 }, options: { name: 'ke_records_teamKey' } },
    { key: { baId: 1 }, options: { name: 'ke_records_baId' } },
    { key: { inputType: 1 }, options: { name: 'ke_records_inputType' } },
    { key: { inputId: 1 }, options: { name: 'ke_records_inputId' } },
    { key: { status: 1 }, options: { name: 'ke_records_status' } },
    { key: { domain: 1 }, options: { name: 'ke_records_domain' } },
    { key: { language: 1 }, options: { name: 'ke_records_language' } },
    {
      key: { targetKnowledgeObjectId: 1 },
      options: { name: 'ke_records_targetKnowledgeObjectId' },
    },
    { key: { createdAt: -1 }, options: { name: 'ke_records_createdAt' } },
    {
      key: { 'approvalReference.approvalId': 1 },
      options: { name: 'ke_records_approvalId' },
    },
    { key: { indexingStatus: 1 }, options: { name: 'ke_records_indexingStatus' } },
    { key: { graphStatus: 1 }, options: { name: 'ke_records_graphStatus' } },
    { key: { retrievalStatus: 1 }, options: { name: 'ke_records_retrievalStatus' } },
    {
      key: { tenantId: 1, teamId: 1, status: 1 },
      options: { name: 'ke_records_tenant_team_status' },
    },
  ],
  [C.plans]: [
    { key: { planId: 1 }, options: { name: 'ke_plans_planId', unique: true } },
    { key: { evolutionId: 1 }, options: { name: 'ke_plans_evolutionId' } },
    { key: { tenantId: 1 }, options: { name: 'ke_plans_tenantId' } },
    { key: { teamId: 1 }, options: { name: 'ke_plans_teamId' } },
    { key: { teamKey: 1 }, options: { name: 'ke_plans_teamKey' } },
    { key: { action: 1 }, options: { name: 'ke_plans_action' } },
    { key: { language: 1 }, options: { name: 'ke_plans_language' } },
    {
      key: { targetKnowledgeObjectId: 1 },
      options: { name: 'ke_plans_targetKnowledgeObjectId' },
    },
    { key: { createdAt: -1 }, options: { name: 'ke_plans_createdAt' } },
  ],
  [C.versions]: [
    {
      key: { versionRecordId: 1 },
      options: { name: 'ke_versions_versionRecordId', unique: true },
    },
    { key: { knowledgeObjectId: 1 }, options: { name: 'ke_versions_knowledgeObjectId' } },
    {
      key: { knowledgeObjectId: 1, version: 1 },
      options: { name: 'ke_versions_object_version', unique: true },
    },
    { key: { evolutionId: 1 }, options: { name: 'ke_versions_evolutionId' } },
    { key: { changeType: 1 }, options: { name: 'ke_versions_changeType' } },
    { key: { createdAt: -1 }, options: { name: 'ke_versions_createdAt' } },
  ],
  [C.supersessionRecords]: [
    {
      key: { supersessionId: 1 },
      options: { name: 'ke_supersession_supersessionId', unique: true },
    },
    { key: { tenantId: 1 }, options: { name: 'ke_supersession_tenantId' } },
    { key: { teamId: 1 }, options: { name: 'ke_supersession_teamId' } },
    { key: { teamKey: 1 }, options: { name: 'ke_supersession_teamKey' } },
    {
      key: { oldKnowledgeObjectId: 1 },
      options: { name: 'ke_supersession_oldKnowledgeObjectId' },
    },
    {
      key: { newKnowledgeObjectId: 1 },
      options: { name: 'ke_supersession_newKnowledgeObjectId' },
    },
    {
      key: { 'approvalReference.approvalId': 1 },
      options: { name: 'ke_supersession_approvalId' },
    },
    { key: { supersededAt: -1 }, options: { name: 'ke_supersession_supersededAt' } },
  ],
  [C.retrievalRollouts]: [
    { key: { rolloutId: 1 }, options: { name: 'ke_rollouts_rolloutId', unique: true } },
    { key: { evolutionId: 1 }, options: { name: 'ke_rollouts_evolutionId' } },
    { key: { knowledgeObjectId: 1 }, options: { name: 'ke_rollouts_knowledgeObjectId' } },
    { key: { tenantId: 1 }, options: { name: 'ke_rollouts_tenantId' } },
    { key: { teamId: 1 }, options: { name: 'ke_rollouts_teamId' } },
    { key: { language: 1 }, options: { name: 'ke_rollouts_language' } },
    { key: { retrievalReady: 1 }, options: { name: 'ke_rollouts_retrievalReady' } },
    { key: { readyAt: -1 }, options: { name: 'ke_rollouts_readyAt' } },
  ],
  [C.languageEvolutionRecords]: [
    {
      key: { languageEvolutionId: 1 },
      options: { name: 'ke_language_languageEvolutionId', unique: true },
    },
    { key: { tenantId: 1 }, options: { name: 'ke_language_tenantId' } },
    { key: { teamId: 1 }, options: { name: 'ke_language_teamId' } },
    {
      key: { sourceKnowledgeObjectId: 1 },
      options: { name: 'ke_language_sourceKnowledgeObjectId' },
    },
    {
      key: { variantKnowledgeObjectId: 1 },
      options: { name: 'ke_language_variantKnowledgeObjectId' },
    },
    { key: { targetLanguage: 1 }, options: { name: 'ke_language_targetLanguage' } },
    { key: { translationStatus: 1 }, options: { name: 'ke_language_translationStatus' } },
    {
      key: { 'approvalReference.approvalId': 1 },
      options: { name: 'ke_language_approvalId' },
    },
    { key: { createdAt: -1 }, options: { name: 'ke_language_createdAt' } },
  ],
  [C.rollbackPlans]: [
    {
      key: { rollbackPlanId: 1 },
      options: { name: 'ke_rollback_rollbackPlanId', unique: true },
    },
    { key: { evolutionId: 1 }, options: { name: 'ke_rollback_evolutionId' } },
    { key: { rollbackType: 1 }, options: { name: 'ke_rollback_rollbackType' } },
    { key: { createdAt: -1 }, options: { name: 'ke_rollback_createdAt' } },
  ],
  [C.errors]: [
    { key: { errorId: 1 }, options: { name: 'ke_errors_errorId', unique: true } },
    { key: { errorType: 1 }, options: { name: 'ke_errors_errorType' } },
    { key: { tenantId: 1 }, options: { name: 'ke_errors_tenantId' } },
    { key: { teamId: 1 }, options: { name: 'ke_errors_teamId' } },
    { key: { evolutionId: 1 }, options: { name: 'ke_errors_evolutionId' } },
    { key: { retryable: 1 }, options: { name: 'ke_errors_retryable' } },
    { key: { occurredAt: -1 }, options: { name: 'ke_errors_occurredAt' } },
  ],
  [C.metrics]: [
    {
      key: { metricsSnapshotId: 1 },
      options: { name: 'ke_metrics_metricsSnapshotId', unique: true },
    },
    { key: { tenantId: 1 }, options: { name: 'ke_metrics_tenantId' } },
    { key: { teamId: 1 }, options: { name: 'ke_metrics_teamId' } },
    {
      key: { periodStart: 1, periodEnd: 1 },
      options: { name: 'ke_metrics_period' },
    },
    { key: { createdAt: -1 }, options: { name: 'ke_metrics_createdAt' } },
  ],
};

export interface EnsuredIndex {
  collection: string;
  name: string;
}

/**
 * Ensure every Knowledge Evolution index exists on the dedicated app Mongo.
 * Idempotent; safe to run at boot or from a one-shot. Uses the direct
 * connection — no Universal Gateway, no route handler.
 */
export async function ensureKnowledgeEvolutionIndexes(
  database = KNOWLEDGE_EVOLUTION_MONGO_DB,
): Promise<EnsuredIndex[]> {
  const connection = getMongoConnection(database);
  const db = connection.db;
  if (!db) {
    throw new Error(`[knowledge-evolution] database ${database} is not connected`);
  }

  const ensured: EnsuredIndex[] = [];
  for (const [collection, specs] of Object.entries(KNOWLEDGE_EVOLUTION_INDEX_SPECS)) {
    for (const spec of specs) {
      await db.collection(collection).createIndex(spec.key, spec.options);
      ensured.push({ collection, name: spec.options.name });
    }
  }
  return ensured;
}
