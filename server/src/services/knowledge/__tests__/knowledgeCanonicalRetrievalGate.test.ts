import { describe, expect, it, vi } from 'vitest';
import type { McsRuntimeRequestScope } from '@momentum/shared/runtime';
import { filterCanonicalActiveKnowledgeChunkIds } from '../knowledgeCanonicalRetrievalGate.js';

describe('canonical approved-knowledge retrieval gate', () => {
  it('returns only ids read back as active and retrieval eligible in canonical Mongo', async () => {
    const persistence = vi.fn(async <T = unknown>(
      _tool: string,
      _action: string,
      _params: Record<string, unknown>,
    ): Promise<T> => ({ documents: [{ chunkId: 'active_chunk' }] } as T));
    const scope = {
      tenantId: 'tenant_team_magnificent',
      teamId: 'team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
    } as McsRuntimeRequestScope;

    const allowed = await filterCanonicalActiveKnowledgeChunkIds(
      ['active_chunk', 'staged_chunk', 'superseded_chunk'],
      scope,
      persistence as never,
    );

    expect([...allowed]).toEqual(['active_chunk']);
    expect(persistence).toHaveBeenCalledWith('mongodb', 'query', {
      collection: 'mcs_knowledge_chunks',
      filter: {
        chunkId: { $in: ['active_chunk', 'staged_chunk', 'superseded_chunk'] },
        status: 'active',
        retrievalEligible: true,
        'scope.tenantId': 'tenant_team_magnificent',
        'scope.teamId': 'team_magnificent',
        'scope.teamKey': 'team_magnificent',
        'scope.teamName': 'Team Magnificent',
      },
      projection: { chunkId: 1 },
      limit: 3,
    });
  });

  it('fails closed when canonical storage returns no matching chunks', async () => {
    const persistence = vi.fn(async <T = unknown>(
      _tool: string,
      _action: string,
      _params: Record<string, unknown>,
    ): Promise<T> => ({ documents: [] } as T));
    const allowed = await filterCanonicalActiveKnowledgeChunkIds(
      ['vector_only_chunk'],
      { tenantId: 'tenant_team_magnificent' } as McsRuntimeRequestScope,
      persistence as never,
    );
    expect(allowed.size).toBe(0);
  });
});
