/**
 * ACR-0012 — agent-memory writer tests.
 *
 * Validation and Chroma-document shaping are pure and tested directly. The
 * write protocol (Mongo → Chroma delete-then-add → Neo4j → read-back, anchor
 * retrieval test) is tested against a stubbed global fetch standing in for
 * the Universal Gateway — no live stack required.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AGENT_MEMORY_STACK,
  AGENT_NOTE_SEVERITIES,
  AgentMemoryAnchorError,
  AgentMemoryValidationError,
  AgentMemoryWriteError,
  APP_STACK_CONNECTORS,
  buildChromaDocument,
  validateAgentNote,
  writeAgentNote,
  writeAnchor,
  type AgentNoteInput,
} from '../agentMemory.js';

function baseNote(overrides: Partial<AgentNoteInput> = {}): AgentNoteInput {
  return {
    note_id: 'test-note-acr-0012',
    subject: 'Test note',
    note: 'Body of the test note.',
    trigger: 'test acr-0012 canonical schema',
    severity: 'medium',
    tags: ['test'],
    project: 'momentum-creation-system-v2',
    created_at: '2026-07-11T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canonical stores', () => {
  it('names the memory stack, canonical home, and forbidden app-stack connectors', () => {
    expect(AGENT_MEMORY_STACK.mongoConnector).toBe('mongodb');
    expect(AGENT_MEMORY_STACK.chromaConnector).toBe('chromadb');
    expect(AGENT_MEMORY_STACK.neo4jConnector).toBe('neo4j');
    expect(AGENT_MEMORY_STACK.canonicalCollection).toBe('universal_gateway.claude_learning_notes');
    expect(APP_STACK_CONNECTORS).toEqual(['mongodb2', 'chromadb2', 'neo4j2']);
  });
});

describe('validateAgentNote', () => {
  it('accepts a canonical note and defaults created_at + canonical_collection', () => {
    const note = validateAgentNote(baseNote({ created_at: undefined }));
    expect(note.canonical_collection).toBe(AGENT_MEMORY_STACK.canonicalCollection);
    expect(Number.isNaN(new Date(note.created_at).getTime())).toBe(false);
  });

  it('rejects non-canonical severity, including case drift', () => {
    expect(() => validateAgentNote(baseNote({ severity: 'HIGH' as never }))).toThrow(AgentMemoryValidationError);
    expect(() => validateAgentNote(baseNote({ severity: 'urgent' as never }))).toThrow(/severity/);
    for (const severity of AGENT_NOTE_SEVERITIES) {
      expect(() => validateAgentNote(baseNote({ severity }))).not.toThrow();
    }
  });

  it('rejects project "unassigned" and missing project', () => {
    expect(() => validateAgentNote(baseNote({ project: 'unassigned' }))).toThrow(/defect/);
    expect(() => validateAgentNote(baseNote({ project: '' }))).toThrow(AgentMemoryValidationError);
  });

  it('rejects dialect-shaped ids and absent tags', () => {
    expect(() => validateAgentNote(baseNote({ note_id: 'Not A Slug!' }))).toThrow(/slug-case/);
    expect(() => validateAgentNote(baseNote({ tags: undefined as never }))).toThrow(/tags/);
    expect(() => validateAgentNote(baseNote({ tags: [] }))).not.toThrow();
  });

  it('rejects non-integer chat_number (registry numbering rule)', () => {
    expect(() => validateAgentNote(baseNote({ chat_number: 136.5 }))).toThrow(/integer-only/);
    expect(() => validateAgentNote(baseNote({ chat_number: '136' as never }))).toThrow(/integer-only/);
    expect(() => validateAgentNote(baseNote({ chat_number: 136 }))).not.toThrow();
  });

  it('keeps anchor fields paired', () => {
    expect(() => validateAgentNote(baseNote({ priority_anchor: true }))).toThrow(/anchor_phrase/);
    expect(() => validateAgentNote(baseNote({ anchor_phrase: 'voice mailer reality' }))).toThrow(/priority_anchor/);
    expect(() =>
      validateAgentNote(baseNote({ anchor_phrase: 'voice mailer reality', priority_anchor: true })),
    ).not.toThrow();
  });

  it('collects every problem in one rejection', () => {
    try {
      validateAgentNote(baseNote({ severity: 'HIGH' as never, project: 'unassigned', trigger: '' }));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AgentMemoryValidationError);
      expect((error as AgentMemoryValidationError).problems).toHaveLength(3);
    }
  });
});

describe('buildChromaDocument', () => {
  it('opens with the anchor phrase for anchors — the retrieval mechanism', () => {
    const note = validateAgentNote(
      baseNote({ anchor_phrase: 'voice mailer reality', priority_anchor: true }),
    );
    const doc = buildChromaDocument(note);
    expect(doc.startsWith('VOICE MAILER REALITY — the named anchor for')).toBe(true);
    expect(doc).toContain("Say 'voice mailer reality' to recall this chain.");
    expect(doc).toContain(note.note);
  });

  it('does not fabricate an anchor header for regular notes', () => {
    const doc = buildChromaDocument(validateAgentNote(baseNote()));
    expect(doc.startsWith('Test note')).toBe(true);
    expect(doc).toContain('Trigger keywords: test acr-0012 canonical schema');
  });
});

// ------- gateway fetch stub -------

type Call = { tool: string; action: string; params: Record<string, unknown> };

function stubGateway(respond: (call: Call) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const call = JSON.parse(init.body) as Call;
    calls.push(call);
    const data = respond(call);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data }),
    };
  });
  return calls;
}

function happyGateway(noteId: string, overrides: (call: Call) => unknown | undefined = () => undefined) {
  return stubGateway((call) => {
    const overridden = overrides(call);
    if (overridden !== undefined) return overridden;
    if (call.tool === 'mongodb' && call.action === 'query') {
      // first existence check + read-back both return the doc
      return { count: 1, documents: [{ _id: noteId, severity: 'medium' }] };
    }
    if (call.tool === 'chromadb' && call.action === 'query_with_filter') {
      return { results: { ids: [noteId], distances: [0.1] } };
    }
    if (call.tool === 'chromadb' && call.action === 'search') {
      return { results: { ids: [noteId, 'runner-up'], distances: [0.31, 0.62] } };
    }
    if (call.tool === 'neo4j') {
      return { records: [{ note_id: noteId }] };
    }
    return {};
  });
}

describe('writeAgentNote protocol', () => {
  it('writes Mongo → Chroma (delete then add) → Neo4j, then reads back all three', async () => {
    const calls = happyGateway('test-note-acr-0012');
    const receipt = await writeAgentNote(baseNote());
    expect(receipt.legs).toEqual({ mongo: 'confirmed', chroma: 'confirmed', neo4j: 'confirmed' });

    const sequence = calls.map((c) => `${c.tool}.${c.action}`);
    expect(sequence).toEqual([
      'mongodb.query', // existence check
      'mongodb.update', // doc exists in the stub → update, not insert
      'chromadb.delete', // add() does not overwrite — delete first
      'chromadb.add',
      'neo4j.cypher',
      'mongodb.query', // read-backs
      'chromadb.query_with_filter',
      'neo4j.cypher',
    ]);
    const add = calls.find((c) => c.action === 'add');
    expect(add?.params.collection).toBe(AGENT_MEMORY_STACK.chromaCollection);
    expect((add?.params.metadatas as Array<Record<string, unknown>>)[0]?.note_id).toBe('test-note-acr-0012');
    // every call went to a MEMORY-stack connector, never mongodb2/chromadb2/neo4j2
    expect(calls.every((c) => !(APP_STACK_CONNECTORS as readonly string[]).includes(c.tool))).toBe(true);
  });

  it('inserts when the note does not exist yet', async () => {
    let firstQuery = true;
    const calls = happyGateway('test-note-acr-0012', (call) => {
      if (call.tool === 'mongodb' && call.action === 'query' && firstQuery) {
        firstQuery = false;
        return { count: 0, documents: [] };
      }
      return undefined;
    });
    await writeAgentNote(baseNote());
    expect(calls.map((c) => c.action)).toContain('insert');
    expect(calls.map((c) => c.action)).not.toContain('update');
  });

  it('fails loudly when a leg errors — never a silent skip', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const call = JSON.parse(init.body) as Call;
      if (call.tool === 'chromadb' && call.action === 'add') {
        return { ok: false, status: 500, text: async () => JSON.stringify({ success: false, error: 'add exploded' }) };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { count: 1, documents: [{ severity: 'medium' }] } }),
      };
    });
    await expect(writeAgentNote(baseNote())).rejects.toThrowError(AgentMemoryWriteError);
    await expect(writeAgentNote(baseNote())).rejects.toThrow(/chroma leg failed at write/);
  });

  it('fails when the Mongo read-back does not return the written note', async () => {
    let queries = 0;
    happyGateway('test-note-acr-0012', (call) => {
      if (call.tool === 'mongodb' && call.action === 'query') {
        queries += 1;
        if (queries > 1) return { count: 0, documents: [] }; // read-back comes up empty
      }
      return undefined;
    });
    await expect(writeAgentNote(baseNote())).rejects.toThrow(/mongo leg failed at read_back/);
  });
});

describe('writeAnchor retrieval test', () => {
  const anchorInput = () =>
    baseNote({
      note_id: 'voice-mailer-reality-test',
      anchor_phrase: 'voice mailer reality',
      priority_anchor: true,
    });

  it('requires anchor_phrase', async () => {
    await expect(writeAnchor(baseNote())).rejects.toThrow(AgentMemoryValidationError);
  });

  it('confirms the anchor phrase returns the note as top hit and reports distances', async () => {
    happyGateway('voice-mailer-reality-test', (call) => {
      if (call.tool === 'mongodb' && call.action === 'query') {
        return { count: 1, documents: [{ _id: 'voice-mailer-reality-test', severity: 'medium' }] };
      }
      if (call.tool === 'chromadb' && call.action === 'query_with_filter') {
        return { results: { ids: ['voice-mailer-reality-test'], distances: [0.1] } };
      }
      if (call.tool === 'chromadb' && call.action === 'search') {
        return { results: { ids: ['voice-mailer-reality-test', 'other'], distances: [0.42, 0.8] } };
      }
      return undefined;
    });
    const receipt = await writeAnchor(anchorInput());
    expect(receipt.retrieval.topHitId).toBe('voice-mailer-reality-test');
    expect(receipt.retrieval.distance).toBe(0.42);
    expect(receipt.retrieval.runnerUpDistance).toBe(0.8);
  });

  it('treats a non-retrieving anchor as a failure, not a warning', async () => {
    happyGateway('voice-mailer-reality-test', (call) => {
      if (call.tool === 'mongodb' && call.action === 'query') {
        return { count: 1, documents: [{ _id: 'voice-mailer-reality-test', severity: 'medium' }] };
      }
      if (call.tool === 'chromadb' && call.action === 'query_with_filter') {
        return { results: { ids: ['voice-mailer-reality-test'], distances: [0.1] } };
      }
      if (call.tool === 'chromadb' && call.action === 'search') {
        return { results: { ids: ['some-unrelated-note'], distances: [0.9] } };
      }
      return undefined;
    });
    await expect(writeAnchor(anchorInput())).rejects.toThrowError(AgentMemoryAnchorError);
  });
});
