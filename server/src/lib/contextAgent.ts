/**
 * ACR-0014 — the Context Agent: guard → parse → propose → confirm → close.
 *
 * The agent PROPOSES; Kevin DISPOSES. It never self-confirms, never
 * self-weights, never mints a handle. Every candidate carries Kevin's exact
 * words and a turn reference — evidence or it didn't happen. Silence is a
 * valid output: a chat with no durable learning produces no candidates.
 *
 * PROPOSE writes to the queue that already exists and was never wired:
 * `momentum.mcs_learning_candidates` (app stack), whose Mongo validator
 * requires `status`, `domain`, `language`, `proposedSummary`.
 *
 * CONFIRM is the load-bearing step: Kevin ratifies, weights (0–10), and
 * names what deserves a handle. Only then does the item go through the
 * ACR-0012 envelope — writeAgentNote() for corrections (memory stack) or
 * writeHandle() for Kevin-named handles (context index) — each with
 * read-back and, for handles, a retrieval test.
 *
 * CLOSE writes the handoff per docs/handoff-contract.md: `_id`,
 * `chat_number`, title, and `chat_registry_id` must all agree, and the
 * packet carries `front_of_line`.
 *
 * AGENT TOOLING ONLY — talks to the Universal Gateway.
 */

import type { McsLearningCandidate, McsLearningCandidateKind } from '@momentum/shared/runtime';
import { callGateway, DEFAULT_GATEWAY_URL } from './gatewayClient.js';
import { writeAgentNote, type AgentNoteInput, type AgentNoteReceipt } from './agentMemory.js';
import { writeHandle, type HandleReceipt, type MemoryHandleInput } from './memoryContextIndex.js';

// ------- PARSE (ACR-0014 §3.2) -------

export interface SessionTurn {
  turn: number;
  speaker: 'kevin' | 'agent';
  text: string;
}

interface KindPattern {
  kind: McsLearningCandidateKind;
  patterns: RegExp[];
}

/** Cue patterns for Kevin-authored durable signals. Reversals first — they
 * are the expensive ones (e.g. "10DLC is not on the critical path"). */
const KIND_PATTERNS: readonly KindPattern[] = [
  {
    kind: 'reversal',
    patterns: [
      /\bis (?:not|no longer) (?:on|in|part of)\b/i,
      /\b(?:actually|instead|scratch that|never mind|forget)\b.*\b(?:not|don't|stop)\b/i,
      /\bwe (?:are|'re) (?:not|no longer) (?:doing|building|using)\b/i,
      /\bchange of (?:plan|direction)\b/i,
      /\breverse\b|\bback out\b|\bundo that\b/i,
    ],
  },
  {
    kind: 'correction',
    patterns: [
      /\bno[,.]? (?:that's|that is|not)\b/i,
      /\bdon't\b|\bdo not\b|\bstop (?:doing|using|writing)\b/i,
      /\bwrong\b|\bthat's incorrect\b/i,
      /\bnever (?:do|write|use|put)\b/i,
    ],
  },
  {
    kind: 'front_of_line',
    patterns: [/\bfront of (?:the )?line\b/i, /\bnext (?:move|thing|priority) is\b/i, /\bfirst thing (?:tomorrow|next session)\b/i],
  },
  {
    kind: 'decision',
    patterns: [
      /\bwe (?:will|'ll|are going to|should) (?:use|go with|build|do|keep|adopt)\b/i,
      /\b(?:i|we) (?:decided?|choose|chose|ruled?)\b/i,
      /\bgo with\b|\bapproved?\b|\bratif(?:y|ied)\b|\block(?:ing)? (?:this|that|it) in\b/i,
      /\bthe answer is\b|\bfinal(?:ized)?\b/i,
    ],
  },
  {
    kind: 'open_question',
    patterns: [/\bstill (?:need to|have to) (?:decide|figure out)\b/i, /\bopen question\b/i, /\bnot sure (?:yet|whether|if)\b/i, /\btbd\b/i],
  },
];

function summarize(text: string, maxChars = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}…` : clean;
}

/**
 * Extract candidates from a session transcript. Pure function — no I/O.
 * Only Kevin's turns produce candidates: an agent's prior suggestion is NOT
 * Kevin's decision, even if he reacted well to it (ACR-0014 §3.3).
 */
export function parseSessionCandidates(sessionRef: string, turns: readonly SessionTurn[]): McsLearningCandidate[] {
  const candidates: McsLearningCandidate[] = [];
  for (const turn of turns) {
    if (turn.speaker !== 'kevin') continue;
    const matched = new Set<McsLearningCandidateKind>();
    for (const { kind, patterns } of KIND_PATTERNS) {
      if (matched.size > 0 && kind !== 'front_of_line') continue; // first (most severe) kind wins, except front_of_line which stacks
      if (patterns.some((p) => p.test(turn.text))) {
        matched.add(kind);
        candidates.push({
          candidateId: `${sessionRef}-t${turn.turn}-${kind}`,
          kind,
          proposedSummary: summarize(turn.text),
          evidenceQuote: turn.text.trim(),
          evidenceTurn: turn.turn,
          statedBy: 'kevin',
          sessionRef,
          status: 'proposed',
        });
      }
    }
  }
  return candidates;
}

// ------- PROPOSE (ACR-0014 §3.3) -------

export const LEARNING_CANDIDATES_STORE = {
  mongoConnector: 'mongodb2',
  database: 'momentum',
  collection: 'mcs_learning_candidates',
} as const;

export interface ProposeReceipt {
  proposed: string[];
  skippedExisting: string[];
}

/**
 * Write candidates to `mcs_learning_candidates` as `status: proposed` — with
 * evidence, never as fact. Satisfies the collection's existing validator
 * (`status`, `domain`, `language`, `proposedSummary`). Idempotent by
 * candidateId. Never self-confirms.
 */
export async function proposeCandidates(
  candidates: readonly McsLearningCandidate[],
  options: { gatewayUrl?: string } = {},
): Promise<ProposeReceipt> {
  const gatewayUrl = options.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const { mongoConnector, database, collection } = LEARNING_CANDIDATES_STORE;
  const proposed: string[] = [];
  const skippedExisting: string[] = [];

  for (const candidate of candidates) {
    if (candidate.status !== 'proposed') {
      throw new Error(`candidate ${candidate.candidateId} is '${candidate.status}' — the agent only writes 'proposed' (ACR-0014 §3.3)`);
    }
    const existing = await callGateway<{ documents?: unknown[] }>(gatewayUrl, mongoConnector, 'query', {
      database,
      collection,
      filter: { _id: candidate.candidateId },
      limit: 1,
    });
    if ((existing.documents ?? []).length > 0) {
      skippedExisting.push(candidate.candidateId);
      continue;
    }
    await callGateway(gatewayUrl, mongoConnector, 'insert', {
      database,
      collection,
      documents: [
        {
          _id: candidate.candidateId,
          // validator-required fields:
          status: 'proposed',
          domain: 'organizational',
          language: 'en',
          proposedSummary: candidate.proposedSummary,
          // ACR-0014 evidence fields:
          kind: candidate.kind,
          evidenceQuote: candidate.evidenceQuote,
          evidenceTurn: candidate.evidenceTurn,
          statedBy: candidate.statedBy,
          sessionRef: candidate.sessionRef,
          created_at: new Date().toISOString(),
          created_by: 'context_agent',
        },
      ],
    });
    // Read back — never report a write landed without re-querying.
    const readBack = await callGateway<{ documents?: unknown[] }>(gatewayUrl, mongoConnector, 'query', {
      database,
      collection,
      filter: { _id: candidate.candidateId },
      limit: 1,
    });
    if ((readBack.documents ?? []).length === 0) {
      throw new Error(`proposed candidate ${candidate.candidateId} did not read back from ${database}.${collection}`);
    }
    proposed.push(candidate.candidateId);
  }
  return { proposed, skippedExisting };
}

// ------- CONFIRM (ACR-0014 §3.4 — the load-bearing step) -------

export interface KevinConfirmation {
  candidateId: string;
  /** Kevin's disposition. Only 'confirmed' triggers a write. */
  disposition: 'confirmed' | 'rejected';
  /** Kevin's weight (0–10) — required for handles. */
  weight?: number;
  /** Present ONLY when Kevin names a handle. His exact words. */
  handle?: Omit<MemoryHandleInput, 'named_by'> & { named_by?: string };
  /** Present when the confirmed item is an agent correction (learning note). */
  note?: AgentNoteInput;
}

export interface ConfirmReceipt {
  candidateId: string;
  disposition: 'confirmed' | 'rejected';
  noteReceipt?: AgentNoteReceipt;
  handleReceipt?: HandleReceipt;
}

/**
 * Apply Kevin's ruling on a proposed candidate. Marks the queue row, then —
 * for confirmations — routes through the ACR-0012 envelope. The confirmation
 * itself must come from Kevin; this function only executes it.
 */
export async function confirmCandidate(
  confirmation: KevinConfirmation,
  options: { gatewayUrl?: string } = {},
): Promise<ConfirmReceipt> {
  const gatewayUrl = options.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  const { mongoConnector, database, collection } = LEARNING_CANDIDATES_STORE;

  const existing = await callGateway<{ documents?: Array<Record<string, unknown>> }>(gatewayUrl, mongoConnector, 'query', {
    database,
    collection,
    filter: { _id: confirmation.candidateId },
    limit: 1,
  });
  const row = (existing.documents ?? [])[0];
  if (!row) throw new Error(`candidate ${confirmation.candidateId} not found in ${database}.${collection}`);
  if (row.status !== 'proposed') {
    throw new Error(`candidate ${confirmation.candidateId} is '${String(row.status)}' — only 'proposed' candidates can be ruled on`);
  }

  const receipt: ConfirmReceipt = { candidateId: confirmation.candidateId, disposition: confirmation.disposition };

  if (confirmation.disposition === 'confirmed') {
    if (confirmation.handle) {
      const namedBy = confirmation.handle.named_by ?? 'Kevin L. Gardner';
      receipt.handleReceipt = await writeHandle(
        { ...confirmation.handle, named_by: namedBy, weight: confirmation.weight ?? confirmation.handle.weight },
        { gatewayUrl },
      );
    }
    if (confirmation.note) {
      receipt.noteReceipt = await writeAgentNote(confirmation.note);
    }
    if (!confirmation.handle && !confirmation.note) {
      throw new Error('a confirmation must carry a note (correction) or a handle (Kevin-named) — otherwise nothing durable was ratified');
    }
  }

  await callGateway(gatewayUrl, mongoConnector, 'update', {
    database,
    collection,
    filter: { _id: confirmation.candidateId },
    update: {
      $set: {
        status: confirmation.disposition,
        ruled_at: new Date().toISOString(),
        ruled_by: 'kevin',
        ...(confirmation.weight !== undefined ? { weight: confirmation.weight } : {}),
      },
    },
  });

  return receipt;
}

// ------- CLOSE (ACR-0014 §3.6) -------

export interface SessionHandoffInput {
  chatNumber: number;
  chatRegistryId: string;
  title: string;
  summary: string;
  nextPriorities: string[];
  frontOfLine: string;
  createdBy: string;
}

export interface HandoffReceipt {
  handoffId: string;
  chatNumber: number;
}

const HANDOFF_STORE = {
  mongoConnector: 'mongodb',
  database: 'universal_gateway',
  registryCollection: 'chat_registry',
  handoffCollection: 'session_handoffs',
} as const;

/**
 * Write the session handoff per docs/handoff-contract.md. The invariant that
 * was broken (Chat #132): `_id`, `chat_number`, title, and
 * `chat_registry_id` must all agree — this function makes disagreement
 * unrepresentable, and verifies the registry row exists before writing.
 */
export async function closeSession(input: SessionHandoffInput, options: { gatewayUrl?: string } = {}): Promise<HandoffReceipt> {
  const gatewayUrl = options.gatewayUrl ?? DEFAULT_GATEWAY_URL;
  if (!Number.isInteger(input.chatNumber)) {
    throw new Error('chat_number is integer-only (registry numbering rule) — no slugs, dates, or provider titles');
  }
  if (!input.frontOfLine || input.frontOfLine.trim() === '') {
    throw new Error('front_of_line is required — the next session opens on truth, not triangulation');
  }
  if (!new RegExp(`^Chat #${input.chatNumber}\\b`).test(input.title)) {
    throw new Error(`title must open with "Chat #${input.chatNumber}" so _id, chat_number, and title agree`);
  }

  const { mongoConnector, database, registryCollection, handoffCollection } = HANDOFF_STORE;

  // The registry is the identity authority: verify the row before writing.
  const registry = await callGateway<{ documents?: Array<Record<string, unknown>> }>(gatewayUrl, mongoConnector, 'query', {
    database,
    collection: registryCollection,
    filter: { id: input.chatRegistryId },
    limit: 1,
  });
  const registryRow = (registry.documents ?? [])[0];
  if (!registryRow) {
    throw new Error(`chat_registry row '${input.chatRegistryId}' not found — register the chat before closing (handoff-contract.md)`);
  }
  if (registryRow.chat_number !== input.chatNumber) {
    throw new Error(
      `registry row '${input.chatRegistryId}' carries chat_number ${String(registryRow.chat_number)}, not ${input.chatNumber} — the registry wins; reconcile before writing`,
    );
  }

  const handoffId = `handoff_chat_${input.chatNumber}`;
  const now = new Date().toISOString();
  const doc = {
    _id: handoffId,
    chat_number: input.chatNumber,
    chat_registry_id: input.chatRegistryId,
    created_at: now,
    updated_at: now,
    title: input.title,
    summary: input.summary,
    next_priorities: input.nextPriorities,
    front_of_line: input.frontOfLine,
    created_by: input.createdBy,
  };

  const existing = await callGateway<{ documents?: unknown[] }>(gatewayUrl, mongoConnector, 'query', {
    database,
    collection: handoffCollection,
    filter: { _id: handoffId },
    limit: 1,
  });
  if ((existing.documents ?? []).length > 0) {
    await callGateway(gatewayUrl, mongoConnector, 'update', {
      database,
      collection: handoffCollection,
      filter: { _id: handoffId },
      update: { $set: { ...doc, _id: undefined, created_at: undefined } },
    });
  } else {
    await callGateway(gatewayUrl, mongoConnector, 'insert', { database, collection: handoffCollection, documents: [doc] });
  }

  // Read back before claiming it landed (handoff-contract session-end rule 3).
  const readBack = await callGateway<{ documents?: Array<Record<string, unknown>> }>(gatewayUrl, mongoConnector, 'query', {
    database,
    collection: handoffCollection,
    filter: { _id: handoffId },
    limit: 1,
  });
  const written = (readBack.documents ?? [])[0];
  if (!written || written.chat_number !== input.chatNumber || written.chat_registry_id !== input.chatRegistryId) {
    throw new Error(`handoff ${handoffId} did not read back consistently — never close green on a partial`);
  }

  return { handoffId, chatNumber: input.chatNumber };
}
