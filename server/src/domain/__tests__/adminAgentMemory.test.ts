import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

type AnyRec = Record<string, unknown>;

beforeEach(() => {
  mocks.persistenceCall.mockReset();
});

function mongoResult(collection: string): { documents: AnyRec[] } {
  if (collection === 'tmag_projection_outbox') {
    return {
      documents: [
        {
          outboxId: 'obx_failed',
          tier: 'knowledge',
          target: 'neo4j',
          status: 'failed',
          entityId: 'knowledge_1',
          mongoCollection: 'mcs_learning_candidates',
          attempts: 8,
          maxAttempts: 8,
          lastError: 'graph read-back returned 0',
          nextAttemptAt: '2026-07-11T12:00:00.000Z',
          updatedAt: '2026-07-11T12:05:00.000Z',
        },
        {
          outboxId: 'obx_pending',
          tier: 'knowledge',
          target: 'chroma',
          status: 'pending',
          entityId: 'knowledge_2',
          mongoCollection: 'mcs_learning_candidates',
          attempts: 2,
          maxAttempts: 8,
          lastError: 'collection missing',
          updatedAt: '2026-07-11T12:00:00.000Z',
        },
      ],
    };
  }
  return { documents: [] };
}

describe('buildAdminAgentOversight projection outbox visibility', () => {
  it('exposes failed projection outbox rows as admin dead letters', async () => {
    mocks.persistenceCall.mockImplementation(async (tool: string, action: string, params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        return mongoResult(String(params.collection));
      }
      if (tool === 'chromadb' && action === 'list_collections') {
        return { collections: [] };
      }
      return {};
    });
    const { buildAdminAgentOversight } = await import('../adminAgentMemory.js');

    const result = await buildAdminAgentOversight();

    expect(result.projectionOutboxDeadLetters).toEqual([
      {
        outboxId: 'obx_failed',
        tier: 'knowledge',
        target: 'neo4j',
        entityId: 'knowledge_1',
        mongoCollection: 'mcs_learning_candidates',
        attempts: 8,
        maxAttempts: 8,
        lastError: 'graph read-back returned 0',
        nextAttemptAt: '2026-07-11T12:00:00.000Z',
        updatedAt: '2026-07-11T12:05:00.000Z',
      },
    ]);
    expect(result.memoryStatus.find((row) => row.collection === 'tmag_projection_outbox')).toMatchObject({
      recordCount: 2,
      note: '1 pending knowledge projection(s); 1 dead-letter projection(s).',
    });
  });

  it('uses minimal Mongo projections and blocks semantic bridge materialization', async () => {
    mocks.persistenceCall.mockImplementation(async (tool: string, action: string, params: AnyRec) => {
      if (tool === 'mongodb' && action === 'query') {
        if (params.collection === 'tmag_steve_success_interview') {
          return {
            documents: [{
              _id: 'SD-TMAG-1',
              tmagId: 'TMAG-1',
              sponsorTmagId: 'TMAG-0',
              completedAt: '2026-07-16T00:00:00.000Z',
              successProfile: {
                generatedAt: '2026-07-16T00:00:00.000Z',
                primaryWhy: { statement: 'private why' },
                learningStyle: { modalities: ['doing'] },
                supportNeeds: { areas: ['technology'] },
                signedBy: 'Steve · Success Profile',
              },
            }],
          };
        }
        return mongoResult(String(params.collection));
      }
      if (tool === 'chromadb' && action === 'list_collections') return { collections: [] };
      return {};
    });
    const { buildAdminAgentOversight } = await import('../adminAgentMemory.js');

    const result = await buildAdminAgentOversight();

    const discoveryRead = mocks.persistenceCall.mock.calls.find(
      ([tool, action, params]) =>
        tool === 'mongodb' &&
        action === 'query' &&
        (params as AnyRec).collection === 'tmag_steve_success_interview',
    );
    expect(discoveryRead?.[2]).toMatchObject({
      projection: {
        _id: 1,
        tmagId: 1,
        sponsorTmagId: 1,
        completedAt: 1,
        'successProfile.generatedAt': 1,
        'successProfile.primaryWhy.statement': 1,
        'successProfile.learningStyle.modalities': 1,
        'successProfile.supportNeeds.areas': 1,
        'successProfile.signedBy': 1,
      },
    });
    expect(discoveryRead?.[2]).not.toHaveProperty('projection.transcript');
    expect(discoveryRead?.[2]).not.toHaveProperty('projection.answers');
    expect(discoveryRead?.[2]).not.toHaveProperty('projection.audioUrl');
    expect(discoveryRead?.[2]).not.toHaveProperty('projection.successProfile');
    expect(discoveryRead?.[2]).not.toHaveProperty(
      'projection.successProfile.successVision',
    );
    expect(result.bridgeDrafts[0]).toMatchObject({
      ready: false,
      semanticDocument:
        'Private Success Profile content omitted pending approved retention and retrieval-scope policy.',
    });
    expect(JSON.stringify(result.bridgeDrafts[0])).not.toContain('private why');
  });
});
