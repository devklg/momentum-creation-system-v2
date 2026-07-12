/**
 * ACR-0013 §4 — the retrieval ladder. In order; do not skip.
 *
 *   1. INVOCATION (exact). Kevin says a call_phrase or alias → deterministic
 *      lookup against handles / aliases / useWhen. No semantic guessing.
 *   2. COMPILE. Canonical Mongo record + Neo4j graph expansion + capped
 *      Chroma neighbours + implementationBriefs in their STATED order.
 *   3. SEMANTIC FALLBACK. No handle match → union search across ALL stores
 *      (never a single collection), ranked weight × recency × distance.
 *
 * THE VERBS ARE THE OPERATORS (ACR-0013 §4.3). The 13 graph verbs are not
 * schema decoration — they are Kevin's operators at speak-time. Handle (noun)
 * + verb (operator) = a packet compiled for that moment. A verb selects the
 * Neo4j traversal (multi-hop — follow the chain); no verb → the full chain.
 * Edges are RELATIONSHIPS, not properties: typed, directional, first-class,
 * traversable, carrying their own provenance (asserted_by / asserted_at /
 * source_chat). Verb coverage is a first-class metric: a hollow operator
 * (zero edges) is reported explicitly — it must never masquerade as an
 * empty answer.
 *
 * THE AUDIENCE BOUNDARY IS AT COMPILE TIME (ACR-0013 §4.7). One shared
 * library, two audiences. Packets compiled for app agents (Steve / Michael /
 * Ivory) include ONLY records marked `app_agents` / `both`; absent or unknown
 * audience FAILS CLOSED to `dev_agents`. Dev agents get everything.
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
  McsMemoryAudience,
  McsMemoryContextGraphEdge,
  McsMemoryContextGraphQuestionKey,
  McsMemoryContextGraphVerb,
  McsVerbCoverageEntry,
  McsVerbCoverageReport,
} from '@momentum/shared/runtime';
import { MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION } from '@momentum/shared/runtime';
import { callGateway, DEFAULT_GATEWAY_URL } from './gatewayClient.js';
import { checkExisting } from './contextGuard.js';
import { CONTEXT_INDEX_GRAPH_VERBS, CONTEXT_INDEX_STACK } from './memoryContextIndex.js';
import {
  MEMORY_STORES,
  audienceOf,
  isVisibleToAudience,
  recordDate,
  recordSummary,
  recordTitle,
  statedBy,
  storePath,
  type MemoryStoreDef,
} from './memoryStores.js';

/** All 13 operators. No verb given → the FULL chain is followed. */
export const EXPANSION_VERBS: readonly McsMemoryContextGraphVerb[] = CONTEXT_INDEX_GRAPH_VERBS;

/** Which graph question each operator answers. */
export const VERB_QUESTION_KEYS: Record<McsMemoryContextGraphVerb, McsMemoryContextGraphQuestionKey> = {
  captures: 'what_created_this_memory',
  expresses: 'what_does_this_memory_mean',
  grounds: 'what_does_this_memory_mean',
  supports: 'what_does_this_memory_support',
  relates_to: 'what_does_this_memory_support',
  requires_context: 'what_context_does_this_memory_require',
  guides: 'what_agent_action_does_this_memory_guide',
  retrieves: 'what_should_this_memory_retrieve',
  protects: 'what_does_this_memory_protect_or_exclude',
  excludes: 'what_does_this_memory_protect_or_exclude',
  hands_off_to: 'what_does_this_memory_handoff_to',
  supersedes: 'what_does_this_memory_mean',
  contradicts: 'what_does_this_memory_mean',
};

const MAX_PACKET_CHARS = 24_000;
const MAX_SEMANTIC_NEIGHBOURS = 5;
const MAX_FALLBACK_HITS = 12;
const MAX_GRAPH_HOPS = 3;
const MAX_GRAPH_EDGES = 50;

interface MongoQueryResult {
  documents?: Array<Record<string, unknown>>;
}

export interface CompilePacketOptions {
  gatewayUrl?: string;
  maxChars?: number;
  /** Who the packet is FOR. Fail closed: default `dev_agents`. */
  audience?: McsMemoryAudience;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** Edge types on disk: memory-stack edges are UPPERCASE, app-stack lowercase.
 * Traversal matches both; the packet reports the canonical lowercase verb. */
function verbTypeUnion(verbs: readonly McsMemoryContextGraphVerb[]): string {
  return verbs.flatMap((v) => [v, v.toUpperCase()]).join('|');
}

function toCanonicalVerb(edgeType: string): McsMemoryContextGraphVerb | null {
  const lower = edgeType.toLowerCase() as McsMemoryContextGraphVerb;
  return (EXPANSION_VERBS as readonly string[]).includes(lower) ? lower : null;
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
    audience: audienceOf(doc),
  };
  if (typeof doc.weight === 'number') hit.weight = doc.weight;
  if (typeof doc.useWhen === 'string') hit.useWhen = doc.useWhen;
  if (typeof doc.nextAgentInstruction === 'string') hit.nextAgentInstruction = doc.nextAgentInstruction;
  if (supersededBy) hit.supersededBy = supersededBy;
  return hit;
}

export interface HandleMatch {
  store: MemoryStoreDef;
  doc: Record<string, unknown>;
  matchedPhrase: string;
  matchKind: 'exact_handle' | 'exact_alias' | 'use_when';
}

/**
 * The PURE rung-1 matching rule, shared by the live path and the
 * deterministic CI manifest test: exact call_phrase / human_handle /
 * anchor_phrase / title match, then exact alias, then useWhen substring.
 * No network, no semantic guessing.
 */
export function matchHandleDoc(
  doc: Record<string, unknown>,
  query: string,
): 'exact_handle' | 'exact_alias' | 'use_when' | null {
  const needle = normalize(query);
  if (needle === '') return null;
  const eq = (v: unknown) => typeof v === 'string' && normalize(v) === needle;
  const inList = (v: unknown) => Array.isArray(v) && v.some((x) => typeof x === 'string' && normalize(x) === needle);
  if (eq(doc.call_phrase) || eq(doc.human_handle) || eq(doc.anchor_phrase) || eq(doc.title)) return 'exact_handle';
  if (eq(doc.alias) || inList(doc.aliases) || inList(doc.alias_candidates)) return 'exact_alias';
  if (typeof doc.useWhen === 'string' && normalize(doc.useWhen).includes(needle)) return 'use_when';
  return null;
}

/** Rung 1 — deterministic invocation lookup. No semantic guessing. */
async function findExactHandle(query: string, gatewayUrl: string): Promise<HandleMatch | null> {
  if (normalize(query) === '') return null;

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

    // Rank within the store: an exact handle beats an exact alias beats a
    // useWhen substring, regardless of document order on disk.
    const rank = { exact_handle: 0, exact_alias: 1, use_when: 2 } as const;
    let best: HandleMatch | null = null;
    for (const doc of docs) {
      const matchKind = matchHandleDoc(doc, query);
      if (matchKind && (!best || rank[matchKind] < rank[best.matchKind])) {
        best = { store, doc, matchedPhrase: query, matchKind };
      }
    }
    if (best) return best;
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

interface GraphExpansionResult {
  edges: McsMemoryContextGraphEdge[];
  /** Edge count per canonical verb reachable from this handle. */
  handleVerbCounts: Partial<Record<McsMemoryContextGraphVerb, number>>;
}

/**
 * Rung 2 — Neo4j expansion on the stack the handle lives on. The verb is the
 * operator: it selects the traversal. Multi-hop (follow the chain, up to
 * MAX_GRAPH_HOPS); no verb → all 13. Edge provenance (asserted_by /
 * asserted_at / source_chat) travels on the edge as evidence.
 */
async function expandGraph(
  match: HandleMatch,
  verbs: readonly McsMemoryContextGraphVerb[],
  audience: McsMemoryAudience,
  gatewayUrl: string,
  warnings: string[],
): Promise<GraphExpansionResult> {
  const connector = match.store.stack === 'app' ? CONTEXT_INDEX_STACK.neo4jConnector : 'neo4j';
  // Same id rule as provenance.recordId: slug ids (note_id/noteId) beat Mongo
  // ObjectIds — graph nodes are keyed by the slug, not the ObjectId.
  const id = String(match.doc.note_id ?? match.doc.noteId ?? match.doc._id ?? match.doc.id ?? '');
  const handleVerbCounts: Partial<Record<McsMemoryContextGraphVerb, number>> = {};
  try {
    const result = await callGateway<{ records?: Array<Record<string, unknown>> }>(gatewayUrl, connector, 'cypher', {
      query:
        `MATCH (n) WHERE n.memoryContextId = $id OR n.id = $id OR n.note_id = $id ` +
        `MATCH p = (n)-[:${verbTypeUnion(verbs)}*1..${MAX_GRAPH_HOPS}]-(m) ` +
        `UNWIND relationships(p) AS r ` +
        `WITH DISTINCT r, startNode(r) AS a, endNode(r) AS b ` +
        `RETURN type(r) AS verb, ` +
        `coalesce(a.memoryContextId, a.id, a.note_id, a.sourceId) AS fromId, ` +
        `coalesce(b.memoryContextId, b.id, b.note_id, b.sourceId) AS toId, ` +
        `coalesce(a.title, a.human_handle, a.subject, '') AS fromTitle, ` +
        `coalesce(b.title, b.human_handle, b.subject, '') AS toTitle, ` +
        `coalesce(b.audience, 'dev_agents') AS toAudience, ` +
        `coalesce(a.audience, 'dev_agents') AS fromAudience, ` +
        `r.asserted_by AS assertedBy, r.asserted_at AS assertedAt, ` +
        `coalesce(r.source_chat, r.source) AS sourceChat, r.note AS note ` +
        `LIMIT ${MAX_GRAPH_EDGES}`,
      params: { id },
    });
    const rows = result.records ?? [];
    const edges: McsMemoryContextGraphEdge[] = [];
    for (const [i, row] of rows.entries()) {
      const verb = toCanonicalVerb(String(row.verb ?? ''));
      if (!verb) continue;
      const fromAudience = (String(row.fromAudience) as McsMemoryAudience) || 'dev_agents';
      const toAudience = (String(row.toAudience) as McsMemoryAudience) || 'dev_agents';
      if (!isVisibleToAudience(fromAudience, audience) || !isVisibleToAudience(toAudience, audience)) continue;
      handleVerbCounts[verb] = (handleVerbCounts[verb] ?? 0) + 1;
      const evidence: string[] = [];
      if (row.assertedBy != null) evidence.push(`asserted_by: ${String(row.assertedBy)}`);
      if (row.assertedAt != null) evidence.push(`asserted_at: ${String(row.assertedAt)}`);
      if (row.sourceChat != null) evidence.push(`source: ${String(row.sourceChat)}`);
      if (row.note != null) evidence.push(String(row.note));
      edges.push({
        edgeId: `${id}-edge-${i}`,
        questionKey: VERB_QUESTION_KEYS[verb],
        fromIngredientId: String(row.fromId ?? id),
        verb,
        toIngredientId: row.toId == null ? undefined : String(row.toId),
        summary:
          `${String(row.fromId ?? '?')} ${verb} ${String(row.toId ?? '?')}` +
          (row.toTitle ? ` — ${String(row.toTitle)}` : ''),
        ...(evidence.length > 0 ? { evidence } : {}),
      });
    }
    return { edges, handleVerbCounts };
  } catch (error) {
    warnings.push(`graph expansion degraded (${connector}): ${error instanceof Error ? error.message : String(error)}`);
    return { edges: [], handleVerbCounts };
  }
}

/**
 * Verb coverage — a FIRST-CLASS metric. Counts edges per operator on the
 * given stack so a dead verb is visible as dead, never as an empty answer.
 */
export async function measureVerbCoverage(
  stack: 'memory' | 'app',
  gatewayUrl: string = DEFAULT_GATEWAY_URL,
  handleVerbCounts?: Partial<Record<McsMemoryContextGraphVerb, number>>,
): Promise<McsVerbCoverageReport> {
  const connector = stack === 'app' ? CONTEXT_INDEX_STACK.neo4jConnector : 'neo4j';
  const counts = new Map<McsMemoryContextGraphVerb, number>();
  const result = await callGateway<{ records?: Array<Record<string, unknown>> }>(gatewayUrl, connector, 'cypher', {
    query:
      `MATCH ()-[r]->() WITH type(r) AS t, count(r) AS c ` +
      `WHERE toLower(t) IN $verbs RETURN toLower(t) AS verb, sum(c) AS edges`,
    params: { verbs: [...EXPANSION_VERBS] },
  });
  for (const row of result.records ?? []) {
    const verb = toCanonicalVerb(String(row.verb ?? ''));
    if (verb) counts.set(verb, (counts.get(verb) ?? 0) + Number(row.edges ?? 0));
  }
  const verbs: McsVerbCoverageEntry[] = EXPANSION_VERBS.map((verb) => ({
    verb,
    edgeCount: counts.get(verb) ?? 0,
    ...(handleVerbCounts ? { handleEdgeCount: handleVerbCounts[verb] ?? 0 } : {}),
  }));
  return {
    stack,
    measuredAt: new Date().toISOString(),
    verbs,
    hollowVerbs: verbs.filter((v) => v.edgeCount === 0).map((v) => v.verb),
  };
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
    const rawMetadatas = search.results?.metadatas ?? [];
    const ids = Array.isArray(rawIds[0]) ? (rawIds as string[][])[0] ?? [] : (rawIds as string[]);
    const distances = Array.isArray(rawDistances[0]) ? (rawDistances as number[][])[0] ?? [] : (rawDistances as number[]);
    const metadatas = Array.isArray(rawMetadatas[0]) ? (rawMetadatas as unknown[][])[0] ?? [] : rawMetadatas;
    const selfId = String(match.doc._id ?? match.doc.id ?? '');
    const hits: McsContextGuardHit[] = [];
    for (let i = 0; i < ids.length && hits.length < MAX_SEMANTIC_NEIGHBOURS; i += 1) {
      const idValue = ids[i];
      if (idValue === undefined || idValue === selfId) continue;
      const meta = (metadatas[i] ?? {}) as Record<string, unknown>;
      hits.push({ ...toGuardHit(match.store, { _id: idValue, ...meta }, 'semantic'), distance: distances[i] });
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

/** Apply the compile-time audience boundary to a hit list. Fail closed. */
function filterByAudience(hits: readonly McsContextGuardHit[], audience: McsMemoryAudience, excludedCounter: { count: number }): McsContextGuardHit[] {
  const visible: McsContextGuardHit[] = [];
  for (const hit of hits) {
    if (isVisibleToAudience(hit.audience ?? 'dev_agents', audience)) visible.push(hit);
    else excludedCounter.count += 1;
  }
  return visible;
}

/**
 * Compile a Context Packet: handle (noun) + optional verb (operator) +
 * audience, per the ladder. The verb selects the graph traversal; no verb →
 * the full 13-verb chain. Packets for `app_agents` contain ONLY records
 * explicitly marked `app_agents`/`both` — unmarked records fail closed to
 * `dev_agents` and never reach an app agent.
 */
export async function compileContextPacket(
  callPhraseOrQuery: string,
  verb?: McsMemoryContextGraphVerb | null,
  options: CompilePacketOptions = {},
): Promise<McsContextPacket> {
  const gatewayUrl = options.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const maxChars = options.maxChars ?? MAX_PACKET_CHARS;
  const audience = options.audience ?? 'dev_agents';
  const warnings: string[] = [];
  const compiledAt = new Date().toISOString();
  const excluded = { count: 0 };
  const verbs: readonly McsMemoryContextGraphVerb[] = verb ? [verb] : EXPANSION_VERBS;

  // Rung 1: invocation.
  let match = await findExactHandle(callPhraseOrQuery, gatewayUrl);
  if (match && !isVisibleToAudience(audienceOf(match.doc), audience)) {
    // The handle exists but is not for this audience — the boundary is at
    // compile time. Fall through to (audience-filtered) semantic fallback.
    excluded.count += 1;
    match = null;
  }
  if (match) {
    match = await resolveAliasTarget(match, gatewayUrl);
    const canonical = toGuardHit(match.store, match.doc, match.matchKind);
    const [expansion, neighboursRaw] = await Promise.all([
      expandGraph(match, verbs, audience, gatewayUrl, warnings),
      semanticNeighbours(match, callPhraseOrQuery, gatewayUrl, warnings),
    ]);
    const neighbours = filterByAudience(neighboursRaw, audience, excluded);
    const superseded = [canonical, ...neighbours].filter((h) => h.superseded);

    // Verb coverage — never let a hollow operator masquerade as an answer.
    let verbCoverage: McsVerbCoverageReport | undefined;
    try {
      verbCoverage = await measureVerbCoverage(match.store.stack, gatewayUrl, expansion.handleVerbCounts);
    } catch (error) {
      warnings.push(`verb coverage unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (verb) {
      const handleEdges = expansion.handleVerbCounts[verb] ?? 0;
      if (handleEdges === 0) {
        const stackEdges = verbCoverage?.verbs.find((v) => v.verb === verb)?.edgeCount ?? 0;
        warnings.push(
          `HOLLOW OPERATOR: verb '${verb}' has ${handleEdges} edges from '${canonical.provenance.recordId}'` +
            (verbCoverage ? ` and ${stackEdges} edges on the ${verbCoverage.stack} stack overall` : '') +
            `. This packet is empty because the edges were never written, NOT because the answer is empty.`,
        );
      }
    }
    if (excluded.count > 0) {
      warnings.push(`${excluded.count} record(s) excluded by the ${audience} audience boundary (compile-time, fail closed).`);
    }

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
      graphExpansion: expansion.edges,
      semanticNeighbours: neighbours.filter((h) => !h.superseded),
      implementationBriefs: extractBriefs(match.doc),
      supersededRecords: superseded,
      tokenBudget: { maxChars, usedChars: 0, truncated: false },
      warnings,
      audience,
      ...(verb ? { verb } : {}),
      ...(verbCoverage ? { verbCoverage } : {}),
    };
    return applyBudget(packet, maxChars);
  }

  // Rung 3: semantic fallback — union across ALL stores, never one collection.
  const guard = await checkExisting(callPhraseOrQuery, { gatewayUrl });
  warnings.push(...guard.storesUnreachable.map((s) => `store unreachable during fallback: ${s}`));
  const now = Date.now();
  const visible = filterByAudience(guard.hits, audience, excluded);
  const ranked = [...visible].sort((a, b) => fallbackScore(b, now) - fallbackScore(a, now));
  const current = ranked.filter((h) => !h.superseded).slice(0, MAX_FALLBACK_HITS);
  const superseded = ranked.filter((h) => h.superseded).slice(0, MAX_FALLBACK_HITS);
  if (excluded.count > 0) {
    warnings.push(`${excluded.count} record(s) excluded by the ${audience} audience boundary (compile-time, fail closed).`);
  }

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
    audience,
    ...(verb ? { verb } : {}),
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
