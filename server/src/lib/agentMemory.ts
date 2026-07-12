/**
 * ACR-0012 — canonical agent-memory writer.
 *
 * AGENT TOOLING ONLY. This module is for Codex / Claude Code / operator
 * scripts writing durable agent memory (learning notes, anchors). It talks to
 * the Universal Gateway's MEMORY-stack connectors and must NEVER be imported
 * by app runtime code (routes/, domain/, services/) — app persistence goes
 * through tripleStackWrite / the persistence adapters, on a different
 * database instance set.
 *
 * The whole point (ACR-0012 §1.2): two connector sets exist against two
 * different instance sets, and both host a database named `momentum`. Writing
 * memory through `mongodb2`/`chromadb2`/`neo4j2` succeeds silently and lies.
 * This module hardcodes the memory-stack connector names so no agent has to
 * guess again.
 *
 * Write protocol (§3.5): Mongo → Chroma (delete-then-add — Chroma `add()`
 * does NOT overwrite an existing id) → Neo4j, then read back all three legs.
 * Any leg that errors throws — never a silent skip.
 */

// ------- Canonical stores (ACR-0012 §3.1) -------

/** Memory-stack connectors and containers. Agent memory goes here, only here. */
export const AGENT_MEMORY_STACK = {
  /** Universal Gateway HTTP core. Override via AGENT_MEMORY_GATEWAY_URL. */
  gatewayUrl: process.env.AGENT_MEMORY_GATEWAY_URL || 'http://localhost:2526',
  /** Gateway connector names — the MEMORY instance set. */
  mongoConnector: 'mongodb',
  chromaConnector: 'chromadb',
  neo4jConnector: 'neo4j',
  /** Canonical home of agent memory. */
  database: 'universal_gateway',
  collection: 'claude_learning_notes',
  /** Memory-stack Chroma copy is canonical; the app-stack copy is legacy. */
  chromaCollection: 'claude_learning_notes',
  neo4jLabel: 'LearningNote',
  canonicalCollection: 'universal_gateway.claude_learning_notes',
} as const;

/**
 * The MCS-v2 APP-stack connectors. Named here so they can be refused, not
 * used: agent memory must never be written through these.
 */
export const APP_STACK_CONNECTORS = ['mongodb2', 'chromadb2', 'neo4j2'] as const;

// ------- Canonical note schema (ACR-0012 §3.2) -------

export const AGENT_NOTE_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type AgentNoteSeverity = (typeof AGENT_NOTE_SEVERITIES)[number];

/** Who a record is FOR (compile-time boundary). Absent/unknown FAILS CLOSED
 * to `dev_agents` at read time — never `app_agents`. */
export const MEMORY_AUDIENCES = ['dev_agents', 'app_agents', 'both'] as const;
export type MemoryAudience = (typeof MEMORY_AUDIENCES)[number];

/** Every agent writes this shape. No dialects. */
export interface AgentNote {
  /** slug-case, stable, unique. NOT `noteId`. */
  note_id: string;
  /** one line — what this note is. NOT `topic`/`category`. */
  subject: string;
  /** the body. NOT `learned`. */
  note: string;
  /** dense keyword string — the words a future agent would actually search. */
  trigger: string;
  /** ONLY for named anchors (§3.4) — Kevin's exact words. */
  anchor_phrase?: string;
  /** true only alongside anchor_phrase. */
  priority_anchor?: boolean;
  /** lowercase, exactly the canonical four. */
  severity: AgentNoteSeverity;
  /** may be empty, never absent. */
  tags: string[];
  /** e.g. `momentum-creation-system-v2`. `unassigned` is a defect, not a value. */
  project: string;
  /** integer-only when known (registry numbering rule). */
  chat_number?: number;
  /** Who this note is for. Absent = `dev_agents` (fail closed). Only mark
   * `app_agents`/`both` when the content is III-Intl-scoped. */
  audience?: MemoryAudience;
  /** ISO 8601. NOT `createdAt`. */
  created_at: string;
  canonical_collection: typeof AGENT_MEMORY_STACK.canonicalCollection;
}

/** created_at and canonical_collection are defaulted by the writer. */
export type AgentNoteInput = Omit<AgentNote, 'created_at' | 'canonical_collection'> &
  Partial<Pick<AgentNote, 'created_at' | 'canonical_collection'>>;

export class AgentMemoryValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`agent note rejected: ${problems.join('; ')}`);
    this.name = 'AgentMemoryValidationError';
  }
}

export class AgentMemoryWriteError extends Error {
  constructor(
    public readonly leg: 'mongo' | 'chroma' | 'neo4j',
    public readonly stage: 'write' | 'read_back',
    message: string,
  ) {
    super(`agent memory ${leg} leg failed at ${stage}: ${message}`);
    this.name = 'AgentMemoryWriteError';
  }
}

export class AgentMemoryAnchorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentMemoryAnchorError';
  }
}

const NOTE_ID_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/** Validates an input note; returns the completed canonical note or throws. */
export function validateAgentNote(input: AgentNoteInput): AgentNote {
  const problems: string[] = [];
  const created_at = input.created_at ?? new Date().toISOString();
  const canonical_collection = input.canonical_collection ?? AGENT_MEMORY_STACK.canonicalCollection;

  if (typeof input.note_id !== 'string' || !NOTE_ID_PATTERN.test(input.note_id)) {
    problems.push(`note_id must be slug-case (got ${JSON.stringify(input.note_id)})`);
  }
  for (const field of ['subject', 'note', 'trigger'] as const) {
    if (typeof input[field] !== 'string' || input[field].trim() === '') {
      problems.push(`${field} is required and must be a non-empty string`);
    }
  }
  if (!AGENT_NOTE_SEVERITIES.includes(input.severity)) {
    problems.push(
      `severity must be one of ${AGENT_NOTE_SEVERITIES.join('|')} — lowercase, exactly (got ${JSON.stringify(input.severity)})`,
    );
  }
  if (!Array.isArray(input.tags) || input.tags.some((t) => typeof t !== 'string')) {
    problems.push('tags must be an array of strings (may be empty, never absent)');
  }
  if (typeof input.project !== 'string' || input.project.trim() === '' || input.project.trim() === 'unassigned') {
    problems.push('project is required; "unassigned" is a defect, not a value');
  }
  if (input.chat_number !== undefined && !Number.isInteger(input.chat_number)) {
    problems.push('chat_number is integer-only when present');
  }
  if (input.audience !== undefined && !MEMORY_AUDIENCES.includes(input.audience)) {
    problems.push(`audience must be one of ${MEMORY_AUDIENCES.join('|')} when present (absent fails closed to dev_agents)`);
  }
  if (Number.isNaN(new Date(created_at).getTime())) {
    problems.push(`created_at must be ISO 8601 (got ${JSON.stringify(created_at)})`);
  }
  if (canonical_collection !== AGENT_MEMORY_STACK.canonicalCollection) {
    problems.push(`canonical_collection must be ${AGENT_MEMORY_STACK.canonicalCollection}`);
  }
  if (input.priority_anchor === true && (typeof input.anchor_phrase !== 'string' || input.anchor_phrase.trim() === '')) {
    problems.push('priority_anchor: true requires anchor_phrase');
  }
  if (input.anchor_phrase !== undefined && input.priority_anchor !== true) {
    problems.push('anchor_phrase requires priority_anchor: true (anchors are minted only when Kevin names something)');
  }
  if (problems.length > 0) throw new AgentMemoryValidationError(problems);

  return { ...input, created_at, canonical_collection } as AgentNote;
}

/**
 * The Chroma document body. For anchors the phrase OPENS the document — that
 * placement is the retrieval mechanism (measured 0.878 → 0.576, ACR-0012 §2).
 */
export function buildChromaDocument(note: AgentNote): string {
  const parts = [
    note.subject,
    note.note,
    `Trigger keywords: ${note.trigger}`,
    note.tags.length > 0 ? `Tags: ${note.tags.join(', ')}` : '',
  ];
  if (note.priority_anchor === true && note.anchor_phrase) {
    parts.unshift(
      `${note.anchor_phrase.toUpperCase()} — the named anchor for ${note.subject}. ` +
        `Say '${note.anchor_phrase}' to recall this chain.`,
    );
  }
  return parts.filter(Boolean).join('\n\n');
}

// ------- Gateway plumbing -------

interface GatewayEnvelope {
  success?: boolean;
  error?: string;
  data?: unknown;
}

async function gateway<T>(tool: string, action: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${AGENT_MEMORY_STACK.gatewayUrl}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, action, params }),
  });
  const raw = await res.text();
  let body: GatewayEnvelope;
  try {
    body = JSON.parse(raw) as GatewayEnvelope;
  } catch {
    throw new Error(`${tool}.${action} returned HTTP ${res.status}: ${raw.slice(0, 400)}`);
  }
  if (!res.ok || body.success === false) {
    throw new Error(`${tool}.${action} failed (HTTP ${res.status}): ${body.error ?? raw.slice(0, 400)}`);
  }
  return body.data as T;
}

function chromaMetadata(note: AgentNote): Record<string, string | number | boolean> {
  const metadata: Record<string, string | number | boolean> = {
    note_id: note.note_id,
    subject: note.subject,
    severity: note.severity,
    project: note.project,
    tags: note.tags.join(','),
    created_at: note.created_at,
    canonical_collection: note.canonical_collection,
  };
  if (note.chat_number !== undefined) metadata.chat_number = note.chat_number;
  if (note.audience !== undefined) metadata.audience = note.audience;
  if (note.priority_anchor === true) metadata.priority_anchor = true;
  if (note.anchor_phrase) metadata.anchor_phrase = note.anchor_phrase;
  return metadata;
}

async function leg<T>(
  name: 'mongo' | 'chroma' | 'neo4j',
  stage: 'write' | 'read_back',
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new AgentMemoryWriteError(name, stage, error instanceof Error ? error.message : String(error));
  }
}

export interface AgentNoteReceipt {
  note_id: string;
  legs: { mongo: 'confirmed'; chroma: 'confirmed'; neo4j: 'confirmed' };
}

export interface AnchorReceipt extends AgentNoteReceipt {
  anchor_phrase: string;
  retrieval: { topHitId: string; distance: number; runnerUpDistance: number | null };
}

// ------- writeAgentNote (§3.5) -------

/**
 * Validates, writes Mongo → Chroma → Neo4j on the MEMORY stack, then reads
 * every leg back. Throws on the first problem; never a silent skip.
 */
export async function writeAgentNote(input: AgentNoteInput): Promise<AgentNoteReceipt> {
  const note = validateAgentNote(input);
  const { database, collection, chromaCollection, neo4jLabel, mongoConnector, chromaConnector, neo4jConnector } =
    AGENT_MEMORY_STACK;
  const doc = { _id: note.note_id, ...note };

  // 1. Mongo — canonical record. Gateway update does not honor upsert; branch.
  await leg('mongo', 'write', async () => {
    const existing = await gateway<{ documents?: unknown[] }>(mongoConnector, 'query', {
      database,
      collection,
      filter: { _id: note.note_id },
      limit: 1,
    });
    if ((existing.documents ?? []).length > 0) {
      await gateway(mongoConnector, 'update', {
        database,
        collection,
        filter: { _id: note.note_id },
        update: { $set: note },
      });
    } else {
      await gateway(mongoConnector, 'insert', { database, collection, documents: [doc] });
    }
  });

  // 2. Chroma — semantic projection. add() does NOT overwrite: delete, then add.
  await leg('chroma', 'write', async () => {
    await gateway(chromaConnector, 'delete', { collection: chromaCollection, ids: [note.note_id] });
    await gateway(chromaConnector, 'add', {
      collection: chromaCollection,
      ids: [note.note_id],
      documents: [buildChromaDocument(note)],
      metadatas: [chromaMetadata(note)],
    });
  });

  // 3. Neo4j — node for graph traversal.
  await leg('neo4j', 'write', async () => {
    await gateway(neo4jConnector, 'cypher', {
      query: `MERGE (n:${neo4jLabel} {note_id: $note_id}) SET n += $props RETURN n.note_id AS note_id`,
      params: {
        note_id: note.note_id,
        props: {
          note_id: note.note_id,
          subject: note.subject,
          severity: note.severity,
          project: note.project,
          trigger: note.trigger,
          tags: note.tags,
          created_at: note.created_at,
          canonical_collection: note.canonical_collection,
          ...(note.chat_number !== undefined ? { chat_number: note.chat_number } : {}),
          ...(note.audience !== undefined ? { audience: note.audience } : {}),
          ...(note.priority_anchor === true ? { priority_anchor: true, anchor_phrase: note.anchor_phrase } : {}),
        },
      },
    });
  });

  // 4. Read back — never report a write landed without reading it back.
  await leg('mongo', 'read_back', async () => {
    const found = await gateway<{ documents?: Array<Record<string, unknown>> }>(mongoConnector, 'query', {
      database,
      collection,
      filter: { _id: note.note_id },
      limit: 1,
    });
    const readBack = (found.documents ?? [])[0];
    if (!readBack || readBack.severity !== note.severity) {
      throw new Error(`read-back did not return the written note (got ${JSON.stringify(readBack ?? null).slice(0, 200)})`);
    }
  });
  await leg('chroma', 'read_back', async () => {
    const found = await gateway<{ results?: { ids?: string[] } }>(chromaConnector, 'query_with_filter', {
      collection: chromaCollection,
      query: note.subject,
      where: { note_id: note.note_id },
      n_results: 1,
    });
    if (!(found.results?.ids ?? []).includes(note.note_id)) {
      throw new Error('read-back query did not return the written vector');
    }
  });
  await leg('neo4j', 'read_back', async () => {
    const found = await gateway<{ records?: unknown[]; results?: unknown[] }>(neo4jConnector, 'cypher', {
      query: `MATCH (n:${neo4jLabel} {note_id: $note_id}) RETURN n.note_id AS note_id`,
      params: { note_id: note.note_id },
    });
    const rows = found.records ?? found.results ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('read-back matched no node');
    }
  });

  return { note_id: note.note_id, legs: { mongo: 'confirmed', chroma: 'confirmed', neo4j: 'confirmed' } };
}

// ------- writeAnchor (§3.4) -------

/**
 * Writes a named anchor. Anchors are minted only when Kevin names something —
 * agents do not self-declare them. Requires anchor_phrase, forces
 * priority_anchor, prepends the phrase to the Chroma document, then
 * retrieval-tests it: the phrase must return this note as the TOP hit. An
 * anchor that does not retrieve is a failure, not a warning.
 */
export async function writeAnchor(input: AgentNoteInput): Promise<AnchorReceipt> {
  if (typeof input.anchor_phrase !== 'string' || input.anchor_phrase.trim() === '') {
    throw new AgentMemoryValidationError(['writeAnchor requires anchor_phrase — Kevin\'s exact words']);
  }
  const receipt = await writeAgentNote({ ...input, priority_anchor: true });

  const search = await leg('chroma', 'read_back', () =>
    gateway<{ results?: { ids?: string[]; distances?: number[] } }>(AGENT_MEMORY_STACK.chromaConnector, 'search', {
      collection: AGENT_MEMORY_STACK.chromaCollection,
      query: input.anchor_phrase,
      n_results: 5,
    }),
  );
  const ids = search.results?.ids ?? [];
  const distances = search.results?.distances ?? [];
  const topHitId = ids[0] ?? '(no results)';
  const distance = distances[0] ?? Number.NaN;
  const runnerUpDistance = distances.length > 1 ? (distances[1] ?? null) : null;

  if (topHitId !== input.note_id) {
    throw new AgentMemoryAnchorError(
      `anchor '${input.anchor_phrase}' does not retrieve: top hit was ${topHitId} (distance ${distance}), ` +
        `expected ${input.note_id}. An anchor that does not retrieve is not an anchor.`,
    );
  }
  console.log(
    `anchor '${input.anchor_phrase}' retrieves ${input.note_id} as top hit — distance ${distance}` +
      (runnerUpDistance != null ? `, runner-up ${runnerUpDistance} (separation ${(runnerUpDistance - distance).toFixed(3)})` : ''),
  );

  return { ...receipt, anchor_phrase: input.anchor_phrase, retrieval: { topHitId, distance, runnerUpDistance } };
}
