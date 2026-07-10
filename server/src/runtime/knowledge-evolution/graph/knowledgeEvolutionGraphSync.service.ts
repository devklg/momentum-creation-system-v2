/**
 * Neo4j graph sync coordination service (Knowledge Evolution Runtime · Lane C).
 *
 * Executes the idempotent Cypher produced by `knowledgeEvolutionGraphMapper.ts` against the
 * app's direct Neo4j adapter, marking graph status pending → completed / failed and making the
 * job retryable. Neo4j is graph/lineage only — it NEVER overrides Mongo canonical state.
 *
 * Ratified authority: `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` §8.7, §20.2.
 *
 * Persistence is injected via {@link Neo4jGraphPort} so this unit-tests against a mocked Neo4j
 * adapter without reimplementing Lane A/B. The default port routes through
 * `persistenceCall('neo4j', 'cypher', …)` — the same governed direct stack the app uses
 * (ACR-0007/0009). No Universal Gateway, no external MCP tool path.
 */

import { persistenceCall } from '../../../services/persistence/dispatch.js';
import type { KnowledgeEvolutionCoordinationStatus } from '@momentum/shared/runtime';
import {
  mapEvolutionToGraph,
  type GraphMapperInput,
  type GraphSyncStatement,
} from './knowledgeEvolutionGraphMapper.js';

/** The minimal Neo4j surface the graph-sync service needs. */
export interface Neo4jGraphPort {
  run(statement: {
    cypher: string;
    params: Record<string, unknown>;
  }): Promise<{ counters: Record<string, number> }>;
}

/** Default port — direct governed Neo4j stack via `persistenceCall` (no external tooling). */
export const defaultNeo4jGraphPort: Neo4jGraphPort = {
  async run({ cypher, params }) {
    const res = await persistenceCall<{ summary?: { counters?: Record<string, number> } }>(
      'neo4j',
      'cypher',
      { query: cypher, params },
    );
    return { counters: res.summary?.counters ?? {} };
  },
};

export interface GraphSyncServiceDeps {
  neo4j?: Neo4jGraphPort;
  /** Persist the coordination status transition (Lane A/D wire the real sink). */
  markStatus?: (
    evolutionId: string,
    status: KnowledgeEvolutionCoordinationStatus,
  ) => void | Promise<void>;
  /** Max attempts before giving up (default 3). MERGE is idempotent, so retry is safe. */
  maxAttempts?: number;
}

export interface KnowledgeGraphSyncResult {
  evolutionId: string;
  graphStatus: KnowledgeEvolutionCoordinationStatus;
  statementsPlanned: number;
  statementsRun: number;
  relationshipsCreated: number;
  attempts: number;
  retryable: boolean;
  error?: string;
}

function countRelationships(counters: Record<string, number>): number {
  return (
    (counters.relationshipsCreated ?? 0) +
    // driver sometimes reports the underscore-cased key
    (counters._relationshipsCreated ?? 0)
  );
}

async function runStatements(
  neo4j: Neo4jGraphPort,
  statements: GraphSyncStatement[],
): Promise<number> {
  let created = 0;
  for (const statement of statements) {
    const { counters } = await neo4j.run({
      cypher: statement.cypher,
      params: statement.params,
    });
    created += countRelationships(counters);
  }
  return created;
}

/**
 * Coordinate a single Neo4j graph sync for one evolution. Idempotent and retryable — the
 * whole statement set is re-run on retry; MERGE guarantees no duplicate nodes/relationships.
 *
 * When the mapper yields no statements (never happens for a real record, but guards empty
 * input) the sync is `not_required` and Neo4j is not touched.
 */
export async function syncKnowledgeEvolutionGraph(
  input: GraphMapperInput,
  deps: GraphSyncServiceDeps = {},
): Promise<KnowledgeGraphSyncResult> {
  const neo4j = deps.neo4j ?? defaultNeo4jGraphPort;
  const maxAttempts = Math.max(1, deps.maxAttempts ?? 3);
  const statements = mapEvolutionToGraph(input);

  if (statements.length === 0) {
    await deps.markStatus?.(input.evolutionId, 'not_required');
    return {
      evolutionId: input.evolutionId,
      graphStatus: 'not_required',
      statementsPlanned: 0,
      statementsRun: 0,
      relationshipsCreated: 0,
      attempts: 0,
      retryable: false,
    };
  }

  await deps.markStatus?.(input.evolutionId, 'pending');

  let attempts = 0;
  let lastError = '';
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const relationshipsCreated = await runStatements(neo4j, statements);
      await deps.markStatus?.(input.evolutionId, 'completed');
      return {
        evolutionId: input.evolutionId,
        graphStatus: 'completed',
        statementsPlanned: statements.length,
        statementsRun: statements.length,
        relationshipsCreated,
        attempts,
        retryable: false,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  await deps.markStatus?.(input.evolutionId, 'failed');
  return {
    evolutionId: input.evolutionId,
    graphStatus: 'failed',
    statementsPlanned: statements.length,
    statementsRun: 0,
    relationshipsCreated: 0,
    attempts,
    retryable: true,
    error: lastError,
  };
}
