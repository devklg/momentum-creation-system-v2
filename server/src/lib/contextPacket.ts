/**
 * ACR-0013 §4 — the retrieval ladder. In order; do not skip.
 *
 *   1. INVOCATION (exact). Kevin says a call_phrase or alias → deterministic
 *      lookup against handles / aliases / useWhen. No semantic guessing.
 *   2. COMPILE. Canonical Mongo record + Neo4j graph expansion (follow
 *      requires_context, grounds, supports, hands_off_to, supersedes) +
 *      capped Chroma neighbours + implementationBriefs in their STATED order.
 *   3. SEMANTIC FALLBACK. No handle match → union search across ALL stores
 *      (never a single collection), ranked weight × recency × distance.
 *
 * Provenance on every claim; superseded records surfaced AS superseded;
 * token-budgeted and ranked internally. The server compiles — runtime agents
 * never query stores directly (ACR-0013 §6).
 *
 * AGENT TOOLING ONLY — talks to the Universal Gateway.
 */

import type {
  McsContextGuardHit,
  McsContextPacket,
  McsContextPacketBrief,
  McsMemoryContextGraphEdge,
  McsMemoryContextGraphVerb,
} from '@momentum/shared/runtime';
import { MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION } from '@momentum/shared/runtime';
import { callGateway, DEFAULT_GATEWAY_URL } from './gatewayClient.js';
import { checkExisting } from './contextGuard.js';
import { CONTEXT_INDEX_STACK } from './memoryContextIndex.js';
import { MEMORY_STORES, recordDate, recordSummary, recordTitle, statedBy, storePath, type MemoryStoreDef } from './memoryStores.js';

/** Graph verbs the compile rung follows outward from the canonical record. */
export const EXPANSION_VERBS: readonly McsMemoryContextGraphVerb[] = [
  'requires_context',
  'grounds',
  'supports',
  'hands_off_to',
  'supersedes',
];

const MAX_PACKET_CHARS = 24_000;
const MAX_SEMANTIC_NEIGHBOURS = 5;
const MAX_FALLBACK_HITS = 12;

interface MongoQueryResult {
  documents?: Array<Record<string, unknown>>;
}

export interface CompilePacketOptions {
  gatewayUrl?: string;
  maxChars?: number;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function toGuardHit(store: MemoryStoreDef, doc: Record<string, unknown>, matchKind: McsContextGuardHit['matchKind']): McsContextGuardHit {
  const supersededBy =
    typeof doc.superseded_by === 'string' ? doc.superseded_by : typeof doc.supersededBy === 'string' ? doc.supersededBy : undefined;
  const status = typeof doc.status === 'string' ? doc.status.toLowerCase() : undefined;
  const hit: McsContextGuardHit = {
    provenance: {
      stack: store.stack,
      storeKey: store.key,
      storePath: storePath(store),
      recordId: String(doc.note_id ?? doc.noteId ?? doc._id ?? doc.id ?? '(unknown)'),
      date: recordDate(doc),
      statedBy: statedBy(doc),
    },
    title: recordTitle(doc),
    summary: recordSummary(doc, 1200),
    matchKind,
    superseded: status === 'superseded' || supersededBy != null,
  };
  if (typeof doc.weight === 'number') hit.weight = doc.weight;
  if (typeof doc.useWhen === 'string') hit.useWhen = doc.useWhen;
  if (typeof doc.nextAgentInstruction === 'string') hit.nextAgentInstruction = doc.nextAgentInstruction;
  if (supersededBy) hit.supersededBy = supersededBy;
  return hit;
}

interface HandleMatch {
  store: MemoryStoreDef;
  doc: Record<string, unknown>;
  matchedPhrase: string;
  matchKind: 'exact_handle' | 'exact_alias' | 'use_when';
}

/** Rung 1 — deterministic invocation lookup. No semantic guessing. */
async function findExactHandle(query: string, gatewayUrl: string): Promise<HandleMatch | null> {
  const needle = normalize(query);
  if (needle === '') return null;

  const handleStores = MEMORY_STORES.filter((s) => s.key === 'mcs_memory_context_index' || s.key === 'memory_index' || s.key === 'claude_learning_notes');

  for (const store of handleStores) {
    let docs: Array<Record<string, unknown>> = [];
    try {
      const result = await callGateway<MongoQueryResult>(gatewayUrl, store.mongoConnector, 'query', {
        database: store.database,
        collection: store.collection,
        filter:
          store.key === 'claude_learning_notes'
            ? { anchor_phrase: { $exists: true } }
            : { $or: [{ type: { $in: ['memory_index_entry', 'memory_index_alias'] } }, { aliases: { $exists: true } }] },
        limit: 200,
      });
      docs = result.documents ?? [];
    } catch {
      continue; // an unreachable store cannot veto invocation on the others
    }

    for (const doc of docs) {
      const eq = (v: unknown) => typeof v === 'string' && normalize(v) === needle;
      const inList = (v: unknown) => Array.isArray(v) && v.some((x) => typeof x === 'string' && normalize(x) === needle);
      if (eq(doc.call_phrase) || eq(doc.human_handle) || eq(doc.anchor_phrase) || eq(doc.title)) {
        return { store, doc, matchedPhrase: query, matchKind: 'exact_handle' };
      }
      if (eq(doc.alias) || inList(doc.aliases) || inList(doc.alias_candidates)) {
        return { store, doc, matchedPhrase: query, matchKind: 'exact_alias' };
      }
      if (typeof doc.useWhen === 'string' && normalize(doc.useWhen).includes(needle)) {
        return { store, doc, matchedPhrase: query, matchKind: 'use_when' };
      }
    }
  }
  return null;
}

/** Resolve a memory-stack index entry or alias to the context-index
 * projection it points at (via `memory_id`), when one exists. The projection
 * carries the compiler fields (weight, useWhen, implementationBriefs). */
async function resolveAliasTarget(match: HandleMatch, gatewayUrl: string): Promise<HandleMatch> {
  const memoryId = typeof match.doc.memory_id === 'string' ? match.doc.memory_id : null;
  const resolvable = match.doc.type === 'memory_index_alias' || (match.doc.type === 'memory_index_entry' && match.store.stack === 'memory');
  if (!resolvable || !memoryId) return match;
  // Prefer a context-index entry whose memory_id matches; else the source record.
  const indexStore = MEMORY_STORES.find((s) => s.key === 'mcs_memory_context_index');
  if (indexStore) {
    try {
      const result = await callGateway<MongoQueryResult>(gatewayUrl, indexStore.mongoConnector, 'query', {
        database: indexStore.database,
        collection: indexStore.collection,
        filter: { memory_id: memoryId },
        limit: 1,
      });
      const entry = (result.documents ?? [])[0];
      if (entry) return { ...match, store: indexStore, doc: entry };
    } catch {
      /* fall through to the alias record itself */
    }
  }
  return match;
}

/** Rung 2 — Neo4j expansion on the stack the handle lives on. */
async function expandGraph(match: HandleMatch, gatewayUrl: string, warnings: string[]): Promise<McsMemoryContextGraphEdge[]> {
  const connector = match.store.stack === 'app' ? CONTEXT_INDEX_STACK.neo4jConnector : 'neo4j';
  const id = String(match.doc._id ?? match.doc.id ?? '');
  const verbList = EXPANSION_VERBS.map((v) => `'${v}'`).join(', ');
  try {
    const result = await callGateway<{ records?: Array<Record<string, unknown>> }>(gatewayUrl, connector, 'cypher', {
      query:
        `MATCH (n) WHERE n.memoryContextId = $id OR n.id = $id OR n.note_id = $id ` +
        `MATCH (n)-[r]-(m) WHERE type(r) IN [${verbList}] ` +
        `RETURN type(r) AS verb, startNode(r) = n AS outgoing, ` +
        `coalesce(m.memoryContextId, m.id, m.note_id, m.sourceId) AS otherId, ` +
        `coalesce(m.title, m.human_handle, m.subject, '') AS otherTitle LIMIT 25`,
      params: { id },
    });
    const rows = result.records ?? [];
    return rows.map((row, i) => ({
      edgeId: `${id}-edge-${i}`,
      questionKey: 'what_context_does_this_memory_require' as const,
      fromIngredientId: id,
      verb: row.verb as McsMemoryContextGraphVerb,
      toIngredientId: row.otherId == null ? undefined : String(row.otherId),
      summary: `${row.outgoing ? id : String(row.otherId ?? '?')} ${String(row.verb)} ${row.outgoing ? String(row.otherId ?? '?') : id}${
        row.otherTitle ? ` — ${String(row.otherTitle)}` : ''
      }`,
    }));
  } catch (error) {
    warnings.push(`graph expansion degraded (${connector}): ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/** Rung 2 — capped Chroma neighbours from the handle's own collection. */
async function semanticNeighbours(match: HandleMatch, query: string, gatewayUrl: string, warnings: string[]): Promise<McsContextGuardHit[]> {
  const chroma = match.store.chroma;
  if (!chroma) return [];
  try {
    const search = await callGateway<{
      results?: { ids?: string[] | string[][]; distances?: number[] | number[][]; metadatas?: unknown[] };
    }>(gatewayUrl, chroma.connector, 'search', {
      collection: chroma.collection,
      query,
      n_results: MAX_SEMANTIC_NEIGHBOURS + 1,
    });
    const rawIds = search.results?.ids ?? [];
    const rawDistances = search.results?.distances ?? [];
    const ids = Array.isArray(rawIds[0]) ? (rawIds as string[][])[0] ?? [] : (rawIds as string[]);
    const distances = Array.isArray(rawDistances[0]) ? (rawDistances as number[][])[0] ?? [] : (rawDistances as number[]);
    const selfId = String(match.doc._id ?? match.doc.id ?? '');
    const hits: McsContextGuardHit[] = [];
    for (let i = 0; i < ids.length && hits.length < MAX_SEMANTIC_NEIGHBOURS; i += 1) {
      const idValue = ids[i];
      if (idValue === undefined || idValue === selfId) continue;
      hits.push({ ...toGuardHit(match.store, { _id: idValue }, 'semantic'), distance: distances[i] });
    }
    return hits;
  } catch (error) {
    warnings.push(`semantic neighbours degraded: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function extractBriefs(doc: Record<string, unknown>): McsContextPacketBrief[] {
  const raw = doc.implementationBriefs;
  if (!Array.isArray(raw)) return [];
  // STATED order — never re-ranked.
  return raw
    .filter((b): b is Record<string, unknown> => typeof b === 'object' && b != null)
    .map((b) => ({
      key: String(b.key ?? ''),
      path: String(b.path ?? ''),
      role: String(b.role ?? ''),
      action: String(b.action ?? ''),
    }));
}

/** Rung 3 ranking: weight × recency × distance. */
function fallbackScore(hit: McsContextGuardHit, now: number): number {
  const weight = (hit.weight ?? 5) / 10; // unweighted records sit mid-gradient
  const date = hit.provenance.date ? Date.parse(hit.provenance.date) : Number.NaN;
  const ageDays = Number.isFinite(date) ? Math.max(0, (now - date) / 86_400_000) : 365;
  const recency = 1 / (1 + ageDays / 90);
  const distance = hit.distance ?? 1.0;
  const closeness = 1 / (1 + distance);
  return weight * recency * closeness;
}

function packetChars(packet: McsContextPacket): number {
  return JSON.stringify(packet).length;
}

/**
 * Compile a Context Packet for a call phrase or free query, per the ladder.
 */
export async function compileContextPacket(
  callPhraseOrQuery: string,
  options: CompilePacketOptions = {},
): Promise<McsContextPacket> {
  const gatewayUrl = options.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const maxChars = options.maxChars ?? MAX_PACKET_CHARS;
  const warnings: string[] = [];
  const compiledAt = new Date().toISOString();

  // Rung 1: invocation.
  let match = await findExactHandle(callPhraseOrQuery, gatewayUrl);
  if (match) {
    match = await resolveAliasTarget(match, gatewayUrl);
    const canonical = toGuardHit(match.store, match.doc, match.matchKind);
    const [graphExpansion, neighbours] = await Promise.all([
      expandGraph(match, gatewayUrl, warnings),
      semanticNeighbours(match, callPhraseOrQuery, gatewayUrl, warnings),
    ]);
    const superseded = [canonical, ...neighbours].filter((h) => h.superseded);

    const packet: McsContextPacket = {
      schemaVersion: MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION,
      query: callPhraseOrQuery,
      ladderRung: 'invocation',
      compiledAt,
      invokedHandle: {
        recordId: canonical.provenance.recordId,
        humanHandle: typeof match.doc.human_handle === 'string' ? match.doc.human_handle : canonical.title,
        matchedPhrase: match.matchedPhrase,
        ...(typeof match.doc.weight === 'number' ? { weight: match.doc.weight } : {}),
      },
      canonicalRecord: canonical,
      graphExpansion,
      semanticNeighbours: neighbours.filter((h) => !h.superseded),
      implementationBriefs: extractBriefs(match.doc),
      supersededRecords: superseded,
      tokenBudget: { maxChars, usedChars: 0, truncated: false },
      warnings,
    };
    return applyBudget(packet, maxChars);
  }

  // Rung 3: semantic fallback — union across ALL stores, never one collection.
  const guard = await checkExisting(callPhraseOrQuery, { gatewayUrl });
  warnings.push(...guard.storesUnreachable.map((s) => `store unreachable during fallback: ${s}`));
  const now = Date.now();
  const ranked = [...guard.hits].sort((a, b) => fallbackScore(b, now) - fallbackScore(a, now));
  const current = ranked.filter((h) => !h.superseded).slice(0, MAX_FALLBACK_HITS);
  const superseded = ranked.filter((h) => h.superseded).slice(0, MAX_FALLBACK_HITS);

  const packet: McsContextPacket = {
    schemaVersion: MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION,
    query: callPhraseOrQuery,
    ladderRung: 'semantic_fallback',
    compiledAt,
    graphExpansion: [],
    semanticNeighbours: current,
    implementationBriefs: [],
    supersededRecords: superseded,
    tokenBudget: { maxChars, usedChars: 0, truncated: false },
    warnings,
  };
  return applyBudget(packet, maxChars);
}

/** Trim lowest-value ingredients until the packet fits its budget. */
function applyBudget(packet: McsContextPacket, maxChars: number): McsContextPacket {
  let current = packet;
  let used = packetChars(current);
  let truncated = false;
  while (used > maxChars && (current.semanticNeighbours.length > 0 || current.graphExpansion.length > 5)) {
    truncated = true;
    current = {
      ...current,
      semanticNeighbours: current.semanticNeighbours.slice(0, Math.max(0, current.semanticNeighbours.length - 1)),
      graphExpansion: current.graphExpansion.length > 5 ? current.graphExpansion.slice(0, current.graphExpansion.length - 1) : current.graphExpansion,
    };
    used = packetChars(current);
  }
  return { ...current, tokenBudget: { maxChars, usedChars: used, truncated } };
}
