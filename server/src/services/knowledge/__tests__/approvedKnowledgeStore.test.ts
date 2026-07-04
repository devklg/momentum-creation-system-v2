import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
  MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
  MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
} from '@momentum/shared/runtime';
import { createKevinApprovedKnowledgeSource } from '../approvedKnowledgeStore.js';

const tripleStackMock = vi.hoisted(() => {
  const writes: Array<{
    mongoCollection: string;
    mongoDoc: Record<string, unknown>;
    chroma?: { collection: string };
  }> = [];

  return {
    writes,
    write: vi.fn(async (input: {
      mongoCollection: string;
      mongoDoc: Record<string, unknown>;
      chroma?: { collection: string };
    }) => {
      writes.push(input);
    }),
  };
});

vi.mock('../../tripleStack.js', () => ({
  tripleStackWrite: tripleStackMock.write,
}));

describe('approved knowledge store schema projection', () => {
  beforeEach(() => {
    tripleStackMock.write.mockClear();
    tripleStackMock.writes.length = 0;
  });

  it('creates canonical Knowledge Base source and chunk records for uploaded files', async () => {
    const result = await createKevinApprovedKnowledgeSource({
      title: 'PDF Training Source',
      content: '# First Section\n\nUse curiosity and service.',
      createdBy: 'TMAG-01',
      domain: 'training',
      language: 'en',
      format: 'pdf',
      sourceRef: 'upload:training.pdf',
      upload: {
        filename: 'training.pdf',
        mimeType: 'application/pdf',
        originalBytes: 1024,
        extractedCharacters: 38,
        sourceRef: 'upload:training.pdf',
      },
      topicTags: ['training'],
      agentScopes: ['michael_magnificent'],
      createdAt: '2026-07-04T12:00:00.000Z',
    });

    expect(result.source).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      title: 'PDF Training Source',
      format: 'pdf',
      authorityDecision: 'active_authority',
      chunkCount: result.chunks.length,
      upload: {
        filename: 'training.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      sourceTitle: 'PDF Training Source',
      authorityKind: 'kevin_authored',
      authorityStatus: 'active_authority',
      domain: 'training',
      language: 'en',
      retrievalEligible: true,
    });

    const sourceWrite = tripleStackMock.writes[0];
    const firstChunkWrite = tripleStackMock.writes[1];
    expect(sourceWrite).toBeDefined();
    expect(firstChunkWrite).toBeDefined();
    expect(sourceWrite).toMatchObject({
      mongoCollection: MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
      chroma: {
        collection: 'mcs_training_knowledge_en',
      },
    });
    expect(sourceWrite?.mongoDoc).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      format: 'pdf',
    });
    expect(
      tripleStackMock.writes
        .slice(1)
        .every((write) => write.mongoCollection === MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION),
    ).toBe(true);
    expect(firstChunkWrite?.mongoDoc).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      sourceTitle: 'PDF Training Source',
    });
  });
});
