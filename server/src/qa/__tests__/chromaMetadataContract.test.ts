import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface ChromaCatalogRow {
  collection: string;
  domain: string;
  language: string;
  source: string;
  metadataContract: {
    observedMetadataKeys: string[];
    observedFilterKeys: string[];
    inferredRequiredKeys: string[];
    embeddingDimension: number;
    embeddingModel: string;
  };
}

interface ChromaCatalog {
  summary: {
    collections: number;
    metadataContractRows: number;
    observedUnregisteredTargets: number;
  };
  collections: ChromaCatalogRow[];
  observedUnregisteredTargets: Array<{
    target: string;
    resolved: boolean;
    actions: string[];
  }>;
}

const repoRoot = path.resolve(process.cwd(), '..');
const catalogPath = path.join(
  repoRoot,
  'engineering/sprints/platform-audit-p1/chroma-collection-catalog.json',
);

function catalog(): ChromaCatalog {
  return JSON.parse(readFileSync(catalogPath, 'utf8')) as ChromaCatalog;
}

function row(name: string): ChromaCatalogRow {
  const found = catalog().collections.find((item) => item.collection === name);
  if (!found) throw new Error(`Missing Chroma catalog row: ${name}`);
  return found;
}

function expectRequiredKeys(collection: string, keys: string[]): void {
  const required = row(collection).metadataContract.inferredRequiredKeys;
  for (const key of keys) expect(required).toContain(key);
}

describe('P1 Chroma metadata contracts', () => {
  it('covers every registered collection with the canonical embedding contract', () => {
    const data = catalog();
    expect(data.summary.collections).toBe(51);
    expect(data.summary.metadataContractRows).toBe(data.summary.collections);

    for (const collection of data.collections) {
      expect(collection.source).toBe('server/src/services/chromaCollections.ts');
      expect(collection.metadataContract.embeddingDimension).toBe(384);
      expect(collection.metadataContract.embeddingModel).toBe('all-MiniLM-L6-v2');
    }
  });

  it('requires canonical ids and source lineage for approved knowledge chunks', () => {
    expectRequiredKeys('mcs_knowledge_chunks', [
      'sourceId',
      'chunkId',
      'documentId',
      'domain',
      'language',
      'status',
      'retrievalEligible',
      'scope.tenantId',
      'scope.teamId',
    ]);
    expect(row('mcs_knowledge_chunks').metadataContract.observedFilterKeys).toEqual([
      'retrievalEligible',
      'status',
    ]);
  });

  it('requires tenant, domain, language, source id, and readiness on active GraphRAG collections', () => {
    const activeRows = catalog().collections.filter((item) =>
      /^mcs_(success|training|relationship|performance|organizational)_knowledge_(en|es)$/.test(item.collection),
    );
    expect(activeRows).toHaveLength(10);

    for (const collection of activeRows) {
      expect(['en', 'es']).toContain(collection.language);
      for (const key of ['tenantId', 'domain', 'language', 'knowledgeObjectId', 'retrievalReady']) {
        expect(collection.metadataContract.inferredRequiredKeys).toContain(key);
      }
    }
  });

  it('keeps review-only learning candidates separate from active retrieval readiness', () => {
    const review = row('mcs_learning_candidates_review');
    expect(review.domain).toBe('knowledge_review');
    expect(review.language).toBe('metadata.language');
    expect(review.metadataContract.observedMetadataKeys).toEqual([
      'createdAt',
      'domain',
      'kind',
      'language',
      'status',
      'tenantId',
    ]);
    expect(review.metadataContract.inferredRequiredKeys).toContain('tenantId');
    expect(review.metadataContract.inferredRequiredKeys).not.toContain('retrievalReady');
  });

  it('surfaces unregistered literal and dynamic Chroma targets as contract follow-up evidence', () => {
    const targets = catalog().observedUnregisteredTargets;
    expect(targets.length).toBeGreaterThanOrEqual(2);
    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'mcs_questionnaires', resolved: true }),
        expect.objectContaining({ target: 'tmag_workbooks', resolved: true }),
        expect.objectContaining({ target: 'agentEventsCollection', resolved: false }),
      ]),
    );
  });
});
