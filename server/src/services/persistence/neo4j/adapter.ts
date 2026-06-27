/**
 * Neo4j direct adapter (S1.3 Phase 1, ACR-0007 / Option C).
 *
 * Behavioral parity with the gateway's `neo4j` tool: action `cypher` with
 * `{ query, params }` returns `{ records, summary: { counters } }`. Neo4j
 * Integer values are normalized to JS numbers (or strings when out of safe
 * range) so callers see the same plain shapes the gateway returned.
 *
 * Errors are surfaced through GatewayError(tool, action, message) so caller
 * error guards keep working unchanged.
 */
import neo4j from 'neo4j-driver';
import { getNeo4jDriver } from './connection.js';
import { GatewayError } from '../../gateway.js';

/** Normalize Neo4j driver values (Integer, Node/Relationship, arrays, maps) to plain JS. */
function normalizeValue(value: unknown): unknown {
  if (neo4j.isInt(value)) {
    const i = value as neo4j.Integer;
    return i.inSafeRange() ? i.toNumber() : i.toString();
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown> & { properties?: Record<string, unknown> };
    // Node / Relationship expose their data under `properties`.
    if (obj.properties && typeof obj.properties === 'object') {
      return normalizeValue(obj.properties);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = normalizeValue(v);
    return out;
  }
  return value;
}

function normalizeCounters(counters: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counters)) {
    out[k] = typeof v === 'number' ? v : Number(v);
  }
  return out;
}

export interface Neo4jCypherParams {
  query: string;
  params?: Record<string, unknown>;
}

export interface Neo4jCypherResult {
  records: Array<Record<string, unknown>>;
  summary: { counters: Record<string, number> };
}

export async function neo4jCypher(input: Neo4jCypherParams): Promise<Neo4jCypherResult> {
  if (!input || typeof input.query !== 'string') {
    throw new GatewayError('neo4j', 'cypher', 'cypher requires a string `query`');
  }
  const session = getNeo4jDriver().session();
  try {
    const result = await session.run(input.query, input.params ?? {});
    const records = result.records.map(
      (r) => normalizeValue(r.toObject()) as Record<string, unknown>,
    );
    const rawCounters = result.summary.counters as unknown as {
      updates?: () => Record<string, unknown>;
    };
    const counters =
      typeof rawCounters.updates === 'function'
        ? normalizeCounters(rawCounters.updates())
        : {};
    return { records, summary: { counters } };
  } catch (err) {
    throw new GatewayError('neo4j', 'cypher', err instanceof Error ? err.message : String(err));
  } finally {
    await session.close();
  }
}

/** Dispatch by action, mirroring the gateway's `neo4j` tool surface. */
export async function neo4jAdapter(
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (action) {
    case 'cypher':
      return neo4jCypher(params as unknown as Neo4jCypherParams);
    default:
      throw new GatewayError('neo4j', action, `unsupported neo4j action: ${action}`);
  }
}
