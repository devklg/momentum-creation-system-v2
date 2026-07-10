import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  syncKnowledgeEvolutionGraph,
  type Neo4jGraphPort,
} from '../knowledgeEvolutionGraphSync.service.js';
import type { GraphMapperInput } from '../knowledgeEvolutionGraphMapper.js';
import type { KnowledgeEvolutionCoordinationStatus } from '@momentum/shared/runtime';

function mockNeo4j(counters: Record<string, number> = { relationshipsCreated: 1 }) {
  return {
    run: vi.fn(async (_statement: { cypher: string; params: Record<string, unknown> }) => ({
      counters,
    })),
  };
}

const input: GraphMapperInput = {
  evolutionId: 'evo_1',
  knowledgeObjectId: 'ko_1',
  version: 1,
  domain: 'success',
  language: 'en',
  tenantId: 'momentum',
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  baId: 'TMBA-20260101-ABCDEF',
  evolutionAction: 'create_new_knowledge',
  sourceCandidateIds: ['cand_1'],
};

describe('syncKnowledgeEvolutionGraph — success', () => {
  let statuses: KnowledgeEvolutionCoordinationStatus[];
  beforeEach(() => {
    statuses = [];
  });

  it('runs every mapped statement, aggregates created relationships, and marks completed', async () => {
    const neo4j = mockNeo4j({ relationshipsCreated: 1 });
    const result = await syncKnowledgeEvolutionGraph(input, {
      neo4j,
      markStatus: (_id, s) => void statuses.push(s),
    });

    expect(result.graphStatus).toBe('completed');
    expect(result.attempts).toBe(1);
    expect(result.retryable).toBe(false);
    expect(result.statementsPlanned).toBeGreaterThan(0);
    expect(result.statementsRun).toBe(result.statementsPlanned);
    expect(neo4j.run).toHaveBeenCalledTimes(result.statementsPlanned);
    // one relationship per statement in this mock
    expect(result.relationshipsCreated).toBe(result.statementsPlanned);
    expect(statuses).toEqual(['pending', 'completed']);

    // proves it ran real cypher (idempotent MERGE)
    expect(neo4j.run.mock.calls[0]![0].cypher).toContain('MERGE');
  });
});

describe('syncKnowledgeEvolutionGraph — failure + retry', () => {
  it('marks failed + retryable after exhausting attempts', async () => {
    const statuses: KnowledgeEvolutionCoordinationStatus[] = [];
    const neo4j = {
      run: vi.fn(async () => {
        throw new Error('neo4j unavailable');
      }),
    } satisfies Neo4jGraphPort;

    const result = await syncKnowledgeEvolutionGraph(input, {
      neo4j,
      maxAttempts: 2,
      markStatus: (_id, s) => void statuses.push(s),
    });

    expect(result.graphStatus).toBe('failed');
    expect(result.retryable).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.statementsRun).toBe(0);
    expect(result.error).toContain('neo4j unavailable');
    expect(statuses).toEqual(['pending', 'failed']);
  });

  it('recovers on a later attempt and marks completed (retryable job)', async () => {
    let calls = 0;
    const neo4j = {
      run: vi.fn(async () => {
        calls += 1;
        // fail the entire first pass on its first statement, then succeed
        if (calls === 1) throw new Error('transient');
        return { counters: { relationshipsCreated: 1 } };
      }),
    } satisfies Neo4jGraphPort;

    const result = await syncKnowledgeEvolutionGraph(input, { neo4j, maxAttempts: 3 });
    expect(result.graphStatus).toBe('completed');
    expect(result.attempts).toBe(2);
  });
});
