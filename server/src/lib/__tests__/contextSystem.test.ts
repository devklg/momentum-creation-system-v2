/**
 * Unit coverage for the ACR-0013/0014 context system: handle validation and
 * document shape, guard absence discipline, context-agent parse/propose/close
 * guardrails. Live retrieval behavior is covered separately by
 * retrievalRegression.test.ts.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildHandleDocument, validateHandle, type MemoryHandleInput } from '../memoryContextIndex.js';
import { checkExisting } from '../contextGuard.js';
import { parseSessionCandidates, proposeCandidates, closeSession, type SessionTurn } from '../contextAgent.js';

const baseHandle: MemoryHandleInput = {
  entryId: 'test_handle_2026_07_11',
  human_handle: 'test handle',
  call_phrase: 'test handle',
  aliases: ['th-mem'],
  weight: 7,
  named_by: 'Kevin L. Gardner',
  title: 'Test Handle',
  category: 'test',
  tags: ['test'],
  memory_id: 'test_source_record',
  source_store: 'universal_gateway.memory_decisions',
  source_stack: 'memory',
  meaning: 'a test meaning',
  content: 'a test body',
  useWhen: 'Use when testing.',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

// ------- gateway stubbing -------

type Handler = (tool: string, action: string, params: Record<string, unknown>) => unknown;

function stubGateway(handler: Handler) {
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const { tool, action, params } = JSON.parse(init.body) as {
      tool: string;
      action: string;
      params: Record<string, unknown>;
    };
    const data = handler(tool, action, params);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data }),
    };
  });
}

function stubGatewayDown() {
  vi.stubGlobal('fetch', async () => {
    throw new Error('ECONNREFUSED');
  });
}

// ------- validateHandle (ACR-0012 §3.1) -------

describe('validateHandle', () => {
  it('accepts a Kevin-named handle', () => {
    expect(validateHandle(baseHandle)).toEqual([]);
  });

  it('rejects a handle not named by Kevin — agents never self-declare one', () => {
    const problems = validateHandle({ ...baseHandle, named_by: 'Claude Code' });
    expect(problems.some((p) => p.includes('only Kevin mints handles'))).toBe(true);
  });

  it('rejects weight outside 0–10', () => {
    expect(validateHandle({ ...baseHandle, weight: 11 }).length).toBeGreaterThan(0);
    expect(validateHandle({ ...baseHandle, weight: -1 }).length).toBeGreaterThan(0);
  });

  it('rejects a non-slug entryId and empty required fields', () => {
    expect(validateHandle({ ...baseHandle, entryId: 'Bad Id!' }).length).toBeGreaterThan(0);
    expect(validateHandle({ ...baseHandle, meaning: '' }).length).toBeGreaterThan(0);
  });
});

describe('buildHandleDocument', () => {
  it('OPENS with the call phrase — that placement is the retrieval mechanism', () => {
    const doc = buildHandleDocument(baseHandle);
    expect(doc.startsWith('TEST HANDLE — ')).toBe(true);
    expect(doc).toContain("Say 'test handle'");
    expect(doc).toContain('aliases: th-mem');
  });
});

// ------- guard absence discipline (ACR-0013 §4.6) -------

describe('checkExisting — absence discipline', () => {
  it('never claims verified absence when stores are unreachable', async () => {
    stubGatewayDown();
    const report = await checkExisting('anything at all');
    expect(report.hits).toHaveLength(0);
    expect(report.storesUnreachable.length).toBeGreaterThan(0);
    expect(report.verifiedAbsent).toBe(false);
  });

  it('reports verified absence only when every store answered empty', async () => {
    stubGateway((tool) => {
      if (tool.startsWith('mongodb')) return { documents: [] };
      return { results: { ids: [], distances: [], metadatas: [] } };
    });
    const report = await checkExisting('a topic nothing covers');
    expect(report.storesUnreachable).toHaveLength(0);
    expect(report.verifiedAbsent).toBe(true);
  });

  it('carries provenance — store, id, date, who stated it — and surfaces useWhen/nextAgentInstruction', async () => {
    stubGateway((tool, _action, params) => {
      if (tool === 'mongodb2' && params.collection === 'mcs_memory_context_index') {
        return {
          documents: [
            {
              _id: 'cdx-001',
              title: 'CDX-001',
              named_by: 'Kevin L. Gardner',
              created_at: '2026-07-06T02:38:42Z',
              weight: 10,
              useWhen: 'Use when Kevin says cdx-001.',
              nextAgentInstruction: 'do not rediscover the concept',
              meaning: 'the compiler handle',
            },
          ],
        };
      }
      if (tool.startsWith('mongodb')) return { documents: [] };
      return { results: { ids: [], distances: [], metadatas: [] } };
    });
    const report = await checkExisting('memory context compiler');
    expect(report.hits).toHaveLength(1);
    const hit = report.hits[0]!;
    expect(hit.provenance.storePath).toBe('momentum.mcs_memory_context_index');
    expect(hit.provenance.statedBy).toBe('kevin');
    expect(hit.nextAgentInstruction).toBe('do not rediscover the concept');
    expect(hit.weight).toBe(10);
  });
});

// ------- parse (ACR-0014 §3.2) -------

describe('parseSessionCandidates', () => {
  const turns: SessionTurn[] = [
    { turn: 1, speaker: 'agent', text: 'We should use approach X and I decided to build Y.' },
    { turn: 2, speaker: 'kevin', text: "10DLC is not on the critical path anymore." },
    { turn: 3, speaker: 'kevin', text: "no, that's wrong — don't write handoffs to chat_handoffs." },
    { turn: 4, speaker: 'kevin', text: 'we will go with the callback pivot for the dialer.' },
    { turn: 5, speaker: 'kevin', text: 'the front of the line is the Telnyx re-key.' },
    { turn: 6, speaker: 'kevin', text: 'thanks, looks good' },
  ];

  it('extracts decisions, corrections, reversals, and front_of_line with evidence', () => {
    const candidates = parseSessionCandidates('chat_136', turns);
    const kinds = candidates.map((c) => c.kind);
    expect(kinds).toContain('reversal');
    expect(kinds).toContain('correction');
    expect(kinds).toContain('decision');
    expect(kinds).toContain('front_of_line');
    for (const c of candidates) {
      expect(c.status).toBe('proposed');
      expect(c.statedBy).toBe('kevin');
      expect(c.evidenceQuote.length).toBeGreaterThan(0);
      expect(c.evidenceTurn).toBeGreaterThan(0);
    }
  });

  it("never turns an agent's words into a candidate — an agent's suggestion is not Kevin's decision", () => {
    const candidates = parseSessionCandidates('chat_136', turns);
    expect(candidates.some((c) => c.evidenceTurn === 1)).toBe(false);
  });

  it('silence is a valid output', () => {
    expect(parseSessionCandidates('chat_137', [{ turn: 1, speaker: 'kevin', text: 'hello' }])).toHaveLength(0);
  });
});

// ------- propose (ACR-0014 §3.3) -------

describe('proposeCandidates', () => {
  it('writes proposed rows satisfying the mcs_learning_candidates validator, with read-back', async () => {
    const inserted: Array<Record<string, unknown>> = [];
    stubGateway((_tool, action, params) => {
      if (action === 'insert') {
        const docs = params.documents as Array<Record<string, unknown>>;
        inserted.push(...docs);
        return { insertedCount: docs.length };
      }
      // query: found only after insert (read-back), not before.
      const filter = params.filter as { _id?: string };
      const found = inserted.filter((d) => d._id === filter._id);
      return { documents: found };
    });
    const [candidate] = parseSessionCandidates('chat_136', [
      { turn: 4, speaker: 'kevin', text: 'we will go with the callback pivot.' },
    ]);
    const receipt = await proposeCandidates([candidate!]);
    expect(receipt.proposed).toHaveLength(1);
    const row = inserted[0]!;
    expect(row.status).toBe('proposed');
    expect(row.domain).toBe('organizational');
    expect(row.language).toBe('en');
    expect(typeof row.proposedSummary).toBe('string');
    expect(row.evidenceQuote).toBe('we will go with the callback pivot.');
  });

  it('refuses to write any status other than proposed — the agent never self-confirms', async () => {
    stubGateway(() => ({ documents: [] }));
    const [candidate] = parseSessionCandidates('chat_136', [
      { turn: 4, speaker: 'kevin', text: 'we will go with the callback pivot.' },
    ]);
    const tampered = { ...candidate!, status: 'confirmed' as never };
    await expect(proposeCandidates([tampered])).rejects.toThrow(/only writes 'proposed'/);
  });
});

// ------- close (ACR-0014 §3.6 / handoff-contract) -------

describe('closeSession', () => {
  const validInput = {
    chatNumber: 136,
    chatRegistryId: 'chatreg_136',
    title: 'Chat #136 — memory system lane',
    summary: 'shipped the guard, ladder, and library',
    nextPriorities: ['review PR'],
    frontOfLine: 'Kevin reviews the PR',
    createdBy: 'claude-code',
  };

  function stubRegistry(chatNumber: number) {
    const store = new Map<string, Record<string, unknown>>();
    stubGateway((_tool, action, params) => {
      const collection = params.collection as string;
      if (collection === 'chat_registry') {
        return { documents: [{ id: 'chatreg_136', chat_number: chatNumber }] };
      }
      if (action === 'insert') {
        for (const doc of params.documents as Array<Record<string, unknown>>) store.set(String(doc._id), doc);
        return { insertedCount: 1 };
      }
      if (action === 'update') return { modifiedCount: 1 };
      const filter = params.filter as { _id?: string };
      const doc = store.get(filter._id ?? '');
      return { documents: doc ? [doc] : [] };
    });
  }

  it('writes handoff_chat_{N} with agreeing chat_number and registry id, and reads it back', async () => {
    stubRegistry(136);
    const receipt = await closeSession(validInput);
    expect(receipt.handoffId).toBe('handoff_chat_136');
  });

  it('rejects a title that disagrees with chat_number — the #132 bug made unrepresentable', async () => {
    stubRegistry(136);
    await expect(closeSession({ ...validInput, title: 'Chat #130 — wrong number' })).rejects.toThrow(/title must open/);
  });

  it('rejects when the registry row carries a different chat_number — the registry wins', async () => {
    stubRegistry(135);
    await expect(closeSession(validInput)).rejects.toThrow(/registry wins|reconcile/);
  });

  it('requires front_of_line and an integer chat_number', async () => {
    stubRegistry(136);
    await expect(closeSession({ ...validInput, frontOfLine: '' })).rejects.toThrow(/front_of_line/);
    await expect(closeSession({ ...validInput, chatNumber: 136.5 })).rejects.toThrow(/integer-only/);
  });
});
