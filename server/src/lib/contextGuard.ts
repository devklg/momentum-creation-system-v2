/**
 * ACR-0014 §3.1 — THE GUARD. Retrieval before invention.
 *
 * `checkExisting(topic)` searches EVERY store in ACR-0013 §3 — handles and
 * aliases, the context index, milestones, session handoffs, decisions,
 * learning notes, the library — and returns hits with provenance: which
 * store, which record, when, and WHO stated it (Kevin or an agent). Any
 * `useWhen` / `nextAgentInstruction` on a hit travels with it.
 *
 * This is the function that would have prevented 2026-07-11: an agent asked
 * to build "anchors" would have been shown `human_handle` / `call_phrase` /
 * `memory_index_alias` and cdx-001's "do not rediscover the concept" before
 * writing a line.
 *
 * Absence discipline (ACR-0013 §4.6): `verifiedAbsent` is true ONLY when
 * every store was reachable and none hit. A miss with unreachable stores is
 * reported as exactly that — never as "it doesn't exist."
 *
 * AGENT TOOLING ONLY — talks to the Universal Gateway. Never import from app
 * runtime (routes/, domain/, services/).
 */

import type {
  McsContextGuardHit,
  McsContextGuardReport,
} from '@momentum/shared/runtime';
import { MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION } from '@momentum/shared/runtime';
import { callGateway, DEFAULT_GATEWAY_URL } from './gatewayClient.js';
import {
  MEMORY_STORES,
  recordDate,
  recordSummary,
  recordTitle,
  statedBy,
  storePath,
  type MemoryStoreDef,
} from './memoryStores.js';

const SEMANTIC_RESULTS_PER_STORE = 3;
const LEXICAL_RESULTS_PER_STORE = 8;

interface MongoQueryResult {
  documents?: Array<Record<string, unknown>>;
}

interface ChromaSearchResult {
  results?: {
    ids?: string[] | string[][];
    distances?: number[] | number[][];
    metadatas?: Array<Record<string, unknown>> | Array<Array<Record<string, unknown>>>;
    documents?: string[] | string[][];
  };
}

function flat<T>(value: T[] | T[][] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value[0]) ? (value as T[][])[0] ?? [] : (value as T[]);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive token regex: every word of the topic, any order. */
function lexicalFilter(store: MemoryStoreDef, topic: string): Record<string, unknown> {
  const tokens = topic
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 6);
  const pattern = tokens.length > 0 ? tokens.map(escapeRegex).join('|') : escapeRegex(topic);
  return {
    $or: store.searchFields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } })),
  };
}

function exactPhraseFields(doc: Record<string, unknown>, topic: string): 'exact_handle' | 'exact_alias' | 'use_when' | null {
  const needle = topic.trim().toLowerCase();
  if (needle === '') return null;
  const eq = (v: unknown) => typeof v === 'string' && v.trim().toLowerCase() === needle;
  const has = (v: unknown) => Array.isArray(v) && v.some((x) => typeof x === 'string' && x.trim().toLowerCase() === needle);
  if (eq(doc.human_handle) || eq(doc.call_phrase) || eq(doc.anchor_phrase) || eq(doc.title)) return 'exact_handle';
  if (eq(doc.alias) || has(doc.aliases) || has(doc.alias_candidates)) return 'exact_alias';
  if (typeof doc.useWhen === 'string' && doc.useWhen.toLowerCase().includes(needle)) return 'use_when';
  return null;
}

function toHit(
  store: MemoryStoreDef,
  doc: Record<string, unknown>,
  matchKind: McsContextGuardHit['matchKind'],
  distance?: number,
): McsContextGuardHit {
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
    summary: recordSummary(doc),
    matchKind,
    superseded: status === 'superseded' || supersededBy != null,
  };
  if (typeof doc.weight === 'number') hit.weight = doc.weight;
  if (distance !== undefined) hit.distance = distance;
  if (typeof doc.useWhen === 'string') hit.useWhen = doc.useWhen;
  if (typeof doc.nextAgentInstruction === 'string') hit.nextAgentInstruction = doc.nextAgentInstruction;
  if (supersededBy) hit.supersededBy = supersededBy;
  return hit;
}

export interface ContextGuardOptions {
  gatewayUrl?: string;
  /** Skip Chroma semantic legs (Mongo lexical only). Default false. */
  lexicalOnly?: boolean;
}

/**
 * Search all ACR-0013 §3 stores for prior context on a topic.
 * Call this BEFORE proposing new work. Cheap, lazy, no session-start ritual —
 * it fires on the work, not on the greeting (ACR-0014 §4).
 */
export async function checkExisting(topic: string, options: ContextGuardOptions = {}): Promise<McsContextGuardReport> {
  const gatewayUrl = options.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const hits = new Map<string, McsContextGuardHit>();
  const storesSearched: string[] = [];
  const storesUnreachable: string[] = [];

  const rank: Record<McsContextGuardHit['matchKind'], number> = {
    exact_handle: 0,
    exact_alias: 1,
    use_when: 2,
    lexical: 3,
    semantic: 4,
  };

  const record = (hit: McsContextGuardHit) => {
    const key = `${hit.provenance.storePath}:${hit.provenance.recordId}`;
    const existing = hits.get(key);
    if (!existing || rank[hit.matchKind] < rank[existing.matchKind]) hits.set(key, hit);
  };

  await Promise.all(
    MEMORY_STORES.map(async (store) => {
      const path = `${store.mongoConnector}:${storePath(store)}`;
      try {
        const result = await callGateway<MongoQueryResult>(gatewayUrl, store.mongoConnector, 'query', {
          database: store.database,
          collection: store.collection,
          filter: lexicalFilter(store, topic),
          limit: LEXICAL_RESULTS_PER_STORE,
        });
        for (const doc of result.documents ?? []) {
          record(toHit(store, doc, exactPhraseFields(doc, topic) ?? 'lexical'));
        }
        storesSearched.push(path);
      } catch {
        storesUnreachable.push(path);
      }

      if (!options.lexicalOnly && store.chroma) {
        const chromaPath = `${store.chroma.connector}:${store.chroma.collection}`;
        try {
          const search = await callGateway<ChromaSearchResult>(gatewayUrl, store.chroma.connector, 'search', {
            collection: store.chroma.collection,
            query: topic,
            n_results: SEMANTIC_RESULTS_PER_STORE,
          });
          const ids = flat(search.results?.ids);
          const distances = flat(search.results?.distances);
          const metadatas = flat(search.results?.metadatas);
          for (let i = 0; i < ids.length; i += 1) {
            const meta = (metadatas[i] ?? {}) as Record<string, unknown>;
            record(toHit(store, { _id: ids[i], ...meta }, 'semantic', distances[i]));
          }
          storesSearched.push(chromaPath);
        } catch {
          storesUnreachable.push(chromaPath);
        }
      }
    }),
  );

  const sorted = [...hits.values()].sort((a, b) => {
    const byKind = rank[a.matchKind] - rank[b.matchKind];
    if (byKind !== 0) return byKind;
    const byWeight = (b.weight ?? 0) - (a.weight ?? 0);
    if (byWeight !== 0) return byWeight;
    return (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY);
  });

  return {
    schemaVersion: MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION,
    topic,
    checkedAt: new Date().toISOString(),
    storesSearched,
    storesUnreachable,
    hits: sorted,
    verifiedAbsent: sorted.length === 0 && storesUnreachable.length === 0,
  };
}

/** One-paragraph rendering for agents: surface prior context before work begins. */
export function renderGuardReport(report: McsContextGuardReport, maxHits = 10): string {
  const lines: string[] = [];
  if (report.hits.length === 0) {
    lines.push(
      report.verifiedAbsent
        ? `No prior context found for "${report.topic}" — all ${report.storesSearched.length} stores searched. Absence is verified.`
        : `No hits for "${report.topic}", but ${report.storesUnreachable.length} store(s) were unreachable (${report.storesUnreachable.join(', ')}). This is NOT evidence of absence.`,
    );
    return lines.join('\n');
  }
  lines.push(`Prior context exists for "${report.topic}" — ${report.hits.length} hit(s). Surface before inventing:`);
  for (const hit of report.hits.slice(0, maxHits)) {
    const p = hit.provenance;
    const parts = [
      `- [${hit.matchKind}] ${hit.title}`,
      `  ${p.storePath} · ${p.recordId} · ${p.date ?? 'undated'} · stated by ${p.statedBy}` +
        (hit.weight !== undefined ? ` · weight ${hit.weight}` : '') +
        (hit.distance !== undefined ? ` · distance ${hit.distance.toFixed(3)}` : '') +
        (hit.superseded ? ` · SUPERSEDED${hit.supersededBy ? ` by ${hit.supersededBy}` : ''}` : ''),
    ];
    if (hit.useWhen) parts.push(`  useWhen: ${hit.useWhen}`);
    if (hit.nextAgentInstruction) parts.push(`  nextAgentInstruction: ${hit.nextAgentInstruction}`);
    hit.summary && parts.push(`  ${hit.summary.slice(0, 240)}`);
    lines.push(...parts);
  }
  if (report.storesUnreachable.length > 0) {
    lines.push(`Unreachable stores (results incomplete): ${report.storesUnreachable.join(', ')}`);
  }
  return lines.join('\n');
}
