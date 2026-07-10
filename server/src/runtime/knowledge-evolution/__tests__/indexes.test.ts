import { describe, expect, it, vi } from 'vitest';
import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';

const conn = vi.hoisted(() => {
  const createIndex = vi.fn(async () => 'ok');
  const collection = vi.fn(() => ({ createIndex }));
  return { createIndex, collection };
});

vi.mock('../../../services/persistence/mongo/connection.js', () => ({
  getMongoConnection: () => ({ db: { collection: conn.collection } }),
}));

import {
  ensureKnowledgeEvolutionIndexes,
  KNOWLEDGE_EVOLUTION_INDEX_SPECS,
} from '../persistence/indexes.js';

/** Every leading key across every index spec on a collection. */
function leadingKeys(collection: string): Set<string> {
  const specs = KNOWLEDGE_EVOLUTION_INDEX_SPECS[collection] ?? [];
  const keys = new Set<string>();
  for (const spec of specs) {
    const [first] = Object.keys(spec.key);
    if (first) keys.add(first);
  }
  return keys;
}

describe('knowledge evolution index specifications', () => {
  it('declares specs for all nine canonical collections', () => {
    for (const name of Object.values(KNOWLEDGE_EVOLUTION_COLLECTIONS)) {
      expect(KNOWLEDGE_EVOLUTION_INDEX_SPECS[name]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('indexes every brief-mandated field on the records collection', () => {
    const keys = leadingKeys(KNOWLEDGE_EVOLUTION_COLLECTIONS.records);
    for (const field of [
      'evolutionId',
      'tenantId',
      'teamId',
      'teamKey',
      'baId',
      'inputType',
      'inputId',
      'status',
      'domain',
      'language',
      'targetKnowledgeObjectId',
      'createdAt',
      'approvalReference.approvalId',
      'indexingStatus',
      'graphStatus',
      'retrievalStatus',
    ]) {
      expect(keys.has(field), `records missing index on ${field}`).toBe(true);
    }
  });

  it('makes each collection canonical id unique', () => {
    const uniqueLeadingKey: Record<string, string> = {
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.records]: 'evolutionId',
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.plans]: 'planId',
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.versions]: 'versionRecordId',
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.supersessionRecords]: 'supersessionId',
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.retrievalRollouts]: 'rolloutId',
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.languageEvolutionRecords]: 'languageEvolutionId',
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.rollbackPlans]: 'rollbackPlanId',
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.errors]: 'errorId',
      [KNOWLEDGE_EVOLUTION_COLLECTIONS.metrics]: 'metricsSnapshotId',
    };
    for (const [collection, idField] of Object.entries(uniqueLeadingKey)) {
      const spec = (KNOWLEDGE_EVOLUTION_INDEX_SPECS[collection] ?? []).find(
        (s) => Object.keys(s.key)[0] === idField && Object.keys(s.key).length === 1,
      );
      expect(spec?.options.unique, `${collection}.${idField} should be unique`).toBe(true);
    }
  });

  it('enforces a unique (knowledgeObjectId, version) compound on versions', () => {
    const specs = KNOWLEDGE_EVOLUTION_INDEX_SPECS[KNOWLEDGE_EVOLUTION_COLLECTIONS.versions] ?? [];
    const compound = specs.find(
      (s) =>
        Object.keys(s.key).join(',') === 'knowledgeObjectId,version' && s.options.unique === true,
    );
    expect(compound).toBeDefined();
  });

  it('gives every index a unique name (no collisions across the catalog)', () => {
    const names = Object.values(KNOWLEDGE_EVOLUTION_INDEX_SPECS)
      .flat()
      .map((s) => s.options.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('ensureKnowledgeEvolutionIndexes applies every spec via createIndex', async () => {
    conn.createIndex.mockClear();
    const totalSpecs = Object.values(KNOWLEDGE_EVOLUTION_INDEX_SPECS).flat().length;
    const ensured = await ensureKnowledgeEvolutionIndexes();
    expect(ensured).toHaveLength(totalSpecs);
    expect(conn.createIndex).toHaveBeenCalledTimes(totalSpecs);
  });
});
