/**
 * ACR-0012 §3.1 / ACR-0013 — writeHandle(): mint a memory_index_entry into
 * the MCS-v2 context index (`momentum.mcs_memory_context_index`).
 *
 * The context index lives on the APP stack BY DESIGN (CDX-001) — connectors
 * `mongodb2`/`chromadb2`/`neo4j2`. That is the ONE deliberate exception to
 * "agent memory goes to the memory stack": handles here are the MCS-v2
 * projection of Kevin's meaning, keyed for the compiler. Agent corrections
 * (learning notes) still go through writeAgentNote() on the memory stack.
 *
 * HANDLES ARE KEVIN'S TO MINT (ACR-0012 §3.1). Agents never self-declare
 * one. This function requires `named_by` and refuses anything that doesn't
 * carry Kevin's name — the caller must be operating on Kevin's explicit
 * naming, with his exact words in `human_handle`.
 *
 * Envelope: Mongo → Chroma (delete-then-add; `add()` does not overwrite) →
 * Neo4j → read back all three legs → RETRIEVAL TEST. The call phrase OPENS
 * the Chroma document (measured 0.878 → 0.576, ACR-0012 §3.1). A handle that
 * does not retrieve as the top hit is a failure, not a warning.
 */

import type { McsMemoryAudience } from '@momentum/shared/runtime';
import { MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION } from '@momentum/shared/runtime';
import { callGateway, DEFAULT_GATEWAY_URL } from './gatewayClient.js';
import { AgentMemoryValidationError, AgentMemoryWriteError, MEMORY_AUDIENCES } from './agentMemory.js';

/** App-stack connectors and containers for the context index. */
export const CONTEXT_INDEX_STACK = {
  gatewayUrl: process.env.AGENT_MEMORY_GATEWAY_URL || DEFAULT_GATEWAY_URL,
  mongoConnector: 'mongodb2',
  chromaConnector: 'chromadb2',
  neo4jConnector: 'neo4j2',
  database: 'momentum',
  collection: 'mcs_memory_context_index',
  chromaCollection: 'mcs_memory_context_index',
  neo4jLabel: 'MemoryContextIndex',
} as const;

/** CDX-001's graph vocabulary — preserved, never re-invented. */
export const CONTEXT_INDEX_GRAPH_QUESTIONS = [
  'what_created_this_memory',
  'what_does_this_memory_mean',
  'what_does_this_memory_support',
  'what_context_does_this_memory_require',
  'what_agent_action_does_this_memory_guide',
  'what_should_this_memory_retrieve',
  'what_does_this_memory_protect_or_exclude',
  'what_does_this_memory_handoff_to',
] as const;

export const CONTEXT_INDEX_GRAPH_VERBS = [
  'captures',
  'expresses',
  'supports',
  'requires_context',
  'guides',
  'retrieves',
  'grounds',
  'protects',
  'excludes',
  'hands_off_to',
  'relates_to',
  'supersedes',
  'contradicts',
] as const;

/** A memory_index_entry conforming to the existing cdx-001 record shape. */
export interface MemoryHandleInput {
  /** Stable id in the context index (also memoryContextId). */
  entryId: string;
  /** Kevin's exact words. The handle IS the meaning (ACR-0013 §2). */
  human_handle: string;
  /** The phrase Kevin says to invoke it. Usually equals human_handle. */
  call_phrase: string;
  /** Short invocation aliases (e.g. krtp-mem). */
  aliases: string[];
  /** 0–10. Weight, not severity, is the gradient for meaning. */
  weight: number;
  /** Who named it. MUST contain "Kevin". */
  named_by: string;
  title: string;
  category: string;
  tags: string[];
  /** id of the canonical source record this handle points at. */
  memory_id: string;
  /** Canonical source location, e.g. `universal_gateway.kevin_milestone_chats`. */
  source_store: string;
  /** Which stack the SOURCE record lives on. */
  source_stack: 'memory' | 'app';
  /** One-line meaning. Read from the source record, never invented. */
  meaning: string;
  /** Full body. Read from the source record, never invented. */
  content: string;
  useWhen: string;
  nextAgentInstruction?: string;
  created_at?: string;
  /** Who this handle is for (compile-time boundary). Absent = `dev_agents`
   * (fail closed). Only `app_agents`/`both` when III-Intl-scoped. */
  audience?: McsMemoryAudience;
}

export interface HandleReceipt {
  entryId: string;
  legs: { mongo: 'confirmed'; chroma: 'confirmed'; neo4j: 'confirmed' };
  retrieval: {
    phrase: string;
    topHitId: string;
    distance: number;
    runnerUpId: string | null;
    runnerUpDistance: number | null;
    separation: number | null;
  }[];
}

const ID_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export function validateHandle(input: MemoryHandleInput): string[] {
  const problems: string[] = [];
  if (!ID_PATTERN.test(input.entryId)) problems.push(`entryId must be slug-case (got ${JSON.stringify(input.entryId)})`);
  for (const field of ['human_handle', 'call_phrase', 'title', 'category', 'memory_id', 'source_store', 'meaning', 'content', 'useWhen'] as const) {
    if (typeof input[field] !== 'string' || input[field].trim() === '') problems.push(`${field} is required`);
  }
  if (!/kevin/i.test(input.named_by ?? '')) {
    problems.push('named_by must be Kevin — only Kevin mints handles (ACR-0012 §3.1); agents never self-declare one');
  }
  if (!Number.isFinite(input.weight) || input.weight < 0 || input.weight > 10) {
    problems.push('weight must be 0–10 (weight is the gradient for meaning; severity is only for corrections)');
  }
  if (!Array.isArray(input.aliases) || input.aliases.some((a) => typeof a !== 'string' || a.trim() === '')) {
    problems.push('aliases must be an array of non-empty strings (may be empty)');
  }
  if (input.audience !== undefined && !MEMORY_AUDIENCES.includes(input.audience)) {
    problems.push(`audience must be one of ${MEMORY_AUDIENCES.join('|')} when present (absent fails closed to dev_agents)`);
  }
  return problems;
}

/** The Chroma document. The call phrase OPENS the document — that placement
 * is the retrieval mechanism. */
export function buildHandleDocument(input: MemoryHandleInput): string {
  return [
    `${input.call_phrase.toUpperCase()} — Kevin's handle. Say '${input.call_phrase}'${
      input.aliases.length > 0 ? ` (aliases: ${input.aliases.join(', ')})` : ''
    } to recall this chain.`,
    input.title,
    input.meaning,
    input.content,
    `Use when: ${input.useWhen}`,
    input.tags.length > 0 ? `Tags: ${input.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildEntryDocument(input: MemoryHandleInput, created_at: string): Record<string, unknown> {
  return {
    _id: input.entryId,
    id: input.entryId,
    memoryContextId: input.entryId,
    type: 'memory_index_entry',
    schemaVersion: MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION,
    title: input.title,
    human_handle: input.human_handle,
    call_phrase: input.call_phrase,
    aliases: input.aliases,
    weight: input.weight,
    weightScale: '0-10',
    named_by: input.named_by,
    status: 'active',
    // Fail closed: an unmarked handle is a dev handle. Never app_agents.
    audience: input.audience ?? 'dev_agents',
    category: input.category,
    tags: input.tags,
    memory_id: input.memory_id,
    source: input.source_store,
    sourceStack: input.source_stack === 'memory' ? 'universal_gateway' : 'mcs_v2',
    appStack: 'mcs_v2',
    meaning: input.meaning,
    content: input.content,
    useWhen: input.useWhen,
    ...(input.nextAgentInstruction ? { nextAgentInstruction: input.nextAgentInstruction } : {}),
    storeFunctions: {
      mongo: `canonical memory/index record in momentum.${CONTEXT_INDEX_STACK.collection}`,
      neo4j: 'relationship graph in MemoryContextIndex / MemoryContextMap nodes and typed edges',
      chroma: `semantic recall document in ${CONTEXT_INDEX_STACK.chromaCollection}`,
    },
    graphQuestions: [...CONTEXT_INDEX_GRAPH_QUESTIONS],
    graphVerbs: [...CONTEXT_INDEX_GRAPH_VERBS],
    printable: true,
    context_packet_ready: true,
    created_at,
    createdAt: created_at,
    updated_at: created_at,
  };
}

async function leg<T>(name: 'mongo' | 'chroma' | 'neo4j', stage: 'write' | 'read_back', run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new AgentMemoryWriteError(name, stage, error instanceof Error ? error.message : String(error));
  }
}

export interface WriteHandleOptions {
  gatewayUrl?: string;
  /** Skip the live retrieval test (populate scripts run it separately). */
  skipRetrievalTest?: boolean;
}

/**
 * Write a Kevin-named handle through the full envelope and retrieval-test
 * every call phrase and alias. Throws on the first failed leg or the first
 * phrase that does not return this entry as the TOP hit.
 */
export async function writeHandle(input: MemoryHandleInput, options: WriteHandleOptions = {}): Promise<HandleReceipt> {
  const problems = validateHandle(input);
  if (problems.length > 0) throw new AgentMemoryValidationError(problems);

  const gatewayUrl = options.gatewayUrl ?? CONTEXT_INDEX_STACK.gatewayUrl;
  const { mongoConnector, chromaConnector, neo4jConnector, database, collection, chromaCollection, neo4jLabel } =
    CONTEXT_INDEX_STACK;
  const created_at = input.created_at ?? new Date().toISOString();
  const doc = buildEntryDocument(input, created_at);

  // 1. Mongo — canonical. Gateway update does not honor upsert; branch.
  await leg('mongo', 'write', async () => {
    const existing = await callGateway<{ documents?: unknown[] }>(gatewayUrl, mongoConnector, 'query', {
      database,
      collection,
      filter: { _id: input.entryId },
      limit: 1,
    });
    if ((existing.documents ?? []).length > 0) {
      await callGateway(gatewayUrl, mongoConnector, 'update', {
        database,
        collection,
        filter: { _id: input.entryId },
        update: { $set: { ...doc, _id: undefined } },
      });
    } else {
      await callGateway(gatewayUrl, mongoConnector, 'insert', { database, collection, documents: [doc] });
    }
  });

  // 2. Chroma — delete-then-add; the phrase opens the document.
  await leg('chroma', 'write', async () => {
    await callGateway(gatewayUrl, chromaConnector, 'delete', { collection: chromaCollection, ids: [input.entryId] });
    await callGateway(gatewayUrl, chromaConnector, 'add', {
      collection: chromaCollection,
      ids: [input.entryId],
      documents: [buildHandleDocument(input)],
      metadatas: [
        {
          type: 'memory_index_entry',
          human_handle: input.human_handle,
          call_phrase: input.call_phrase,
          aliases: input.aliases.join(','),
          weight: input.weight,
          named_by: input.named_by,
          audience: input.audience ?? 'dev_agents',
          memory_id: input.memory_id,
          source: input.source_store,
          created_at,
        },
      ],
    });
  });

  // 3. Neo4j — MemoryContextIndex node + retrieves-edge to the source id.
  await leg('neo4j', 'write', async () => {
    await callGateway(gatewayUrl, neo4jConnector, 'cypher', {
      query:
        `MERGE (n:${neo4jLabel} {memoryContextId: $id}) SET n += $props ` +
        `MERGE (s:MemorySourceRecord {sourceId: $memoryId}) SET s.store = $sourceStore ` +
        `MERGE (n)-[:retrieves]->(s) RETURN n.memoryContextId AS id`,
      params: {
        id: input.entryId,
        memoryId: input.memory_id,
        sourceStore: input.source_store,
        props: {
          memoryContextId: input.entryId,
          id: input.entryId,
          type: 'memory_index_entry',
          title: input.title,
          human_handle: input.human_handle,
          call_phrase: input.call_phrase,
          aliases: input.aliases,
          weight: input.weight,
          named_by: input.named_by,
          audience: input.audience ?? 'dev_agents',
          created_at,
        },
      },
    });
  });

  // 4. Read back — never report a write landed without re-querying.
  await leg('mongo', 'read_back', async () => {
    const found = await callGateway<{ documents?: Array<Record<string, unknown>> }>(gatewayUrl, mongoConnector, 'query', {
      database,
      collection,
      filter: { _id: input.entryId },
      limit: 1,
    });
    const readBack = (found.documents ?? [])[0];
    if (!readBack || readBack.human_handle !== input.human_handle) {
      throw new Error(`read-back did not return the written entry (got ${JSON.stringify(readBack ?? null).slice(0, 200)})`);
    }
  });
  await leg('chroma', 'read_back', async () => {
    const found = await callGateway<{ results?: { ids?: string[] | string[][] } }>(gatewayUrl, chromaConnector, 'search', {
      collection: chromaCollection,
      query: input.call_phrase,
      n_results: 10,
    });
    const ids = found.results?.ids ?? [];
    const flatIds = Array.isArray(ids[0]) ? (ids as string[][])[0] ?? [] : (ids as string[]);
    if (!flatIds.includes(input.entryId)) throw new Error('read-back search did not return the written vector');
  });
  await leg('neo4j', 'read_back', async () => {
    const found = await callGateway<{ records?: unknown[]; results?: unknown[] }>(gatewayUrl, neo4jConnector, 'cypher', {
      query: `MATCH (n:${neo4jLabel} {memoryContextId: $id}) RETURN n.memoryContextId AS id`,
      params: { id: input.entryId },
    });
    const rows = found.records ?? found.results ?? [];
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('read-back matched no node');
  });

  // 5. Retrieval test — every phrase must return this entry as the TOP hit.
  const retrieval: HandleReceipt['retrieval'] = [];
  if (!options.skipRetrievalTest) {
    for (const phrase of [input.call_phrase, ...input.aliases]) {
      const result = await testHandleRetrieval(input.entryId, phrase, gatewayUrl);
      retrieval.push(result);
    }
  }

  return { entryId: input.entryId, legs: { mongo: 'confirmed', chroma: 'confirmed', neo4j: 'confirmed' }, retrieval };
}

export class HandleRetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandleRetrievalError';
  }
}

/** ACR-0013 §5 — a handle that does not retrieve is a broken handle. */
export async function testHandleRetrieval(
  expectedTopId: string,
  phrase: string,
  gatewayUrl: string = CONTEXT_INDEX_STACK.gatewayUrl,
  connector: string = CONTEXT_INDEX_STACK.chromaConnector,
  collection: string = CONTEXT_INDEX_STACK.chromaCollection,
): Promise<HandleReceipt['retrieval'][number]> {
  const search = await callGateway<{
    results?: { ids?: string[] | string[][]; distances?: number[] | number[][] };
  }>(gatewayUrl, connector, 'search', { collection, query: phrase, n_results: 5 });
  const rawIds = search.results?.ids ?? [];
  const rawDistances = search.results?.distances ?? [];
  const ids = Array.isArray(rawIds[0]) ? (rawIds as string[][])[0] ?? [] : (rawIds as string[]);
  const distances = Array.isArray(rawDistances[0]) ? (rawDistances as number[][])[0] ?? [] : (rawDistances as number[]);

  const topHitId = ids[0] ?? '(no results)';
  const distance = distances[0] ?? Number.NaN;
  const runnerUpId = ids[1] ?? null;
  const runnerUpDistance = distances[1] ?? null;
  const separation = runnerUpDistance != null && Number.isFinite(distance) ? runnerUpDistance - distance : null;

  if (topHitId !== expectedTopId) {
    throw new HandleRetrievalError(
      `'${phrase}' does not retrieve ${expectedTopId}: top hit was ${topHitId} (distance ${distance}` +
        (runnerUpDistance != null ? `, runner-up ${runnerUpDistance}` : '') +
        `). A handle that does not retrieve is not a handle (ACR-0013 §5).`,
    );
  }
  return { phrase, topHitId, distance, runnerUpId, runnerUpDistance, separation };
}
