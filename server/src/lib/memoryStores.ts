/**
 * ACR-0013 §3 — the store registry. ALL of them.
 *
 * An index built from one collection is a fragment, not a library: the
 * 2026-07-11 index read only `claude_learning_notes` and omitted Kevin's Real
 * Turning Point and the Holding Tank context entirely. Every retrieval /
 * guard / index operation iterates THIS registry so that can never silently
 * happen again.
 *
 * Stack discipline: `mongodb`/`chromadb`/`neo4j` = memory stack (Mongo 28000,
 * Chroma 8100). `mongodb2`/`chromadb2`/`neo4j2` = MCS-v2 app stack (Mongo
 * 30000, Chroma 8200, Neo4j 7710). Both host a database named `momentum`.
 * The context compiler index lives on the APP stack by design (CDX-001);
 * agent corrections live on the MEMORY stack (ACR-0012 §3.1).
 *
 * Ground-truth note: docs/handoff-contract.md names the chat registry as
 * `agent_operations.chat_registry`; on the live memory stack the populated
 * collection is `universal_gateway.chat_registry` (agent_operations is empty
 * on both stacks as of 2026-07-11). We read where the rows actually are and
 * surface the discrepancy in the drift report — we do not move data.
 */

import type { McsMemoryStackName, McsMemoryStoreKey } from '@momentum/shared/runtime';

export interface MemoryStoreDef {
  key: McsMemoryStoreKey;
  stack: McsMemoryStackName;
  /** Gateway Mongo connector name for this stack. */
  mongoConnector: 'mongodb' | 'mongodb2';
  database: string;
  collection: string;
  /** Chroma projection, when one exists for this store. */
  chroma?: {
    connector: 'chromadb' | 'chromadb2';
    collection: string;
  };
  /** What this store holds (ACR-0013 §3 table). */
  holds: string;
  /** Fields to regex-search for lexical guard matches. */
  searchFields: readonly string[];
}

export const MEMORY_STORES: readonly MemoryStoreDef[] = [
  {
    key: 'memory_index',
    stack: 'memory',
    mongoConnector: 'mongodb',
    database: 'universal_gateway',
    collection: 'memory_index',
    holds: "memory-index entries and aliases — Kevin's handles and call phrases",
    searchFields: ['human_handle', 'call_phrase', 'alias', 'title', 'tags', 'meaning'],
  },
  {
    key: 'memory_decisions',
    stack: 'memory',
    mongoConnector: 'mongodb',
    database: 'universal_gateway',
    collection: 'memory_decisions',
    chroma: { connector: 'chromadb', collection: 'memory_decisions' },
    holds: "milestones, discoveries, and Kevin's decisions",
    searchFields: ['title', 'human_handle', 'topic', 'tags', 'summary'],
  },
  {
    key: 'kevin_milestone_chats',
    stack: 'memory',
    mongoConnector: 'mongodb',
    database: 'universal_gateway',
    collection: 'kevin_milestone_chats',
    holds: 'pinned milestone arcs, preserve-for-perpetuity (KRTP)',
    searchFields: ['title', 'chat_name_pinned_by_kevin', 'significance'],
  },
  {
    key: 'session_handoffs',
    stack: 'memory',
    mongoConnector: 'mongodb',
    database: 'universal_gateway',
    collection: 'session_handoffs',
    chroma: { connector: 'chromadb', collection: 'session_handoffs' },
    holds: 'the work chronicle (Holding Tank, orientation, spec closures)',
    searchFields: ['title', 'summary', 'front_of_line', 'next_priorities'],
  },
  {
    key: 'chat_registry',
    stack: 'memory',
    mongoConnector: 'mongodb',
    database: 'universal_gateway',
    collection: 'chat_registry',
    holds: 'canonical chat identity (per docs/handoff-contract.md)',
    searchFields: ['title', 'provider'],
  },
  {
    key: 'governance_decisions',
    stack: 'memory',
    mongoConnector: 'mongodb',
    database: 'momentum',
    collection: 'decisions',
    holds: 'governance & ACR ledger (dec_handoff_contract et al.)',
    searchFields: ['topic', 'title', 'decision', 'summary'],
  },
  {
    key: 'claude_learning_notes',
    stack: 'memory',
    mongoConnector: 'mongodb',
    database: 'universal_gateway',
    collection: 'claude_learning_notes',
    chroma: { connector: 'chromadb', collection: 'claude_learning_notes' },
    holds: 'agent corrections (606+)',
    searchFields: ['subject', 'topic', 'category', 'anchor_phrase', 'trigger', 'tags'],
  },
  {
    key: 'kevin_library',
    stack: 'memory',
    mongoConnector: 'mongodb',
    database: 'universal_gateway',
    collection: 'kevin_library',
    chroma: { connector: 'chromadb', collection: 'kevin_library' },
    holds: "Kevin's foundational library",
    searchFields: ['title', 'tags', 'summary'],
  },
  {
    key: 'mcs_memory_context_index',
    stack: 'app',
    mongoConnector: 'mongodb2',
    database: 'momentum',
    collection: 'mcs_memory_context_index',
    chroma: { connector: 'chromadb2', collection: 'mcs_memory_context_index' },
    holds: 'context-compiler entries, weights, aliases, graph verbs (CDX-001 home)',
    searchFields: ['title', 'human_handle', 'call_phrase', 'aliases', 'useWhen', 'tags', 'meaning', 'category'],
  },
] as const;

export function storePath(store: MemoryStoreDef): string {
  return `${store.database}.${store.collection}`;
}

/** Fields that mark a record as stated/named/pinned by Kevin himself. */
export function statedBy(doc: Record<string, unknown>): 'kevin' | 'agent' | 'unknown' {
  const namedBy = typeof doc.named_by === 'string' ? doc.named_by.toLowerCase() : '';
  const pinnedBy = typeof doc.pinned_by === 'string' ? doc.pinned_by.toLowerCase() : '';
  if (namedBy.includes('kevin') || pinnedBy.includes('kevin')) return 'kevin';
  if ('chat_name_pinned_by_kevin' in doc || doc.preserve_for_perpetuity === true) return 'kevin';
  const source = typeof doc.source === 'string' ? doc.source.toLowerCase() : '';
  if (/codex|claude|agent|gpt|session/.test(source)) return 'agent';
  const createdBy = typeof doc.created_by === 'string' ? doc.created_by.toLowerCase() : '';
  if (/codex|claude|agent/.test(createdBy)) return 'agent';
  if (createdBy.includes('kevin')) return 'kevin';
  return 'unknown';
}

/** Best-effort record date across the known field dialects — read-only. */
export function recordDate(doc: Record<string, unknown>): string | null {
  for (const field of ['created_at', 'createdAt', 'date', 'timestamp', 'updated_at']) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
      return value; // ranges like "2026-07-03 to 2026-07-05" stay verbatim
    }
    if (value instanceof Date) return value.toISOString();
  }
  return null;
}

export function recordTitle(doc: Record<string, unknown>): string {
  for (const field of ['human_handle', 'title', 'subject', 'topic', 'chat_name_pinned_by_kevin', 'proposedSummary']) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return String(doc._id ?? doc.id ?? '(untitled)');
}

export function recordSummary(doc: Record<string, unknown>, maxChars = 480): string {
  for (const field of ['meaning', 'summary', 'significance', 'note', 'learned', 'content', 'decision', 'excerpt']) {
    const value = doc[field];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
    }
  }
  return '';
}
