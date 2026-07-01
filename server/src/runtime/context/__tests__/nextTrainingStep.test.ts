import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  ApprovedKnowledgeQueryRequest,
  TmagId,
  KnowledgeId,
  KnowledgeReference,
  RuntimeRequestScope,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
  resolveNextTrainingStep,
  type ApprovedKnowledgeProvider,
} from '../index.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../validation.js';

function scope(): RuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: 'TMAG-P410-001' as TmagId,
  };
}

function request(overrides: Partial<ApprovedKnowledgeQueryRequest> = {}): ApprovedKnowledgeQueryRequest {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    scope: scope(),
    objective: 'training_support',
    domains: ['training'],
    language: 'en',
    ...overrides,
  };
}

function knowledge(id: string): KnowledgeReference {
  return {
    knowledgeId: `knowledge_p410_${id}` as KnowledgeId,
    domain: 'training',
    status: 'approved',
    language: 'en',
    translationStatus: 'same_language',
    sourceId: `source_p410_${id}` as SourceId,
  };
}

function providerReturning(references: readonly KnowledgeReference[]): ApprovedKnowledgeProvider {
  return { async listApprovedKnowledge() { return references; } };
}
function providerThrowing(): ApprovedKnowledgeProvider {
  return { async listApprovedKnowledge() { throw new Error('down'); } };
}

async function okResult(references: readonly KnowledgeReference[]) {
  const adapter = createContextManagerRetrievalAdapter(providerReturning(references));
  return adapter.retrieveApprovedKnowledge(request());
}

const K = (id: string) => `knowledge_p410_${id}` as KnowledgeId;
const STEP_KEYS = new Set(['knowledgeId', 'sourceId', 'domain', 'language', 'stepIndex', 'totalSteps']);

describe('P4.10 resolveNextTrainingStep — selection over approved knowledge', () => {
  it('resolves the first step when nothing is completed', async () => {
    const result = await okResult([knowledge('a'), knowledge('b'), knowledge('c')]);
    const resolution = resolveNextTrainingStep({ result });
    expect(resolution.status).toBe('resolved');
    expect(resolution.reasonCode).toBe('next_uncompleted');
    expect(resolution.step?.knowledgeId).toBe(K('a'));
    expect(resolution.step?.stepIndex).toBe(0);
    expect(resolution.step?.totalSteps).toBe(3);
    expect(resolution).toMatchObject({ completedCount: 0, totalCount: 3 });
    expect(resolution.safeFallback).toBeUndefined();
  });

  it('advances past completed steps in retrieval (curator) order', async () => {
    const result = await okResult([knowledge('a'), knowledge('b'), knowledge('c')]);
    const resolution = resolveNextTrainingStep({ result, completedKnowledgeIds: [K('a'), K('b')] });
    expect(resolution.status).toBe('resolved');
    expect(resolution.step?.knowledgeId).toBe(K('c'));
    expect(resolution.step?.stepIndex).toBe(2);
    expect(resolution.completedCount).toBe(2);
  });

  it('returns all_completed when every approved step is done', async () => {
    const result = await okResult([knowledge('a'), knowledge('b')]);
    const resolution = resolveNextTrainingStep({ result, completedKnowledgeIds: [K('a'), K('b')] });
    expect(resolution.status).toBe('all_completed');
    expect(resolution.reasonCode).toBe('all_completed');
    expect(resolution.step).toBeUndefined();
    expect(resolution).toMatchObject({ completedCount: 2, totalCount: 2 });
  });

  it('ignores completed ids that are not in the approved sequence', async () => {
    const result = await okResult([knowledge('a')]);
    const resolution = resolveNextTrainingStep({ result, completedKnowledgeIds: ['knowledge_unknown' as KnowledgeId] });
    expect(resolution.status).toBe('resolved');
    expect(resolution.step?.knowledgeId).toBe(K('a'));
    expect(resolution.completedCount).toBe(0);
  });

  it('de-duplicates repeated knowledgeIds so counts/position are per distinct item', async () => {
    // A malformed boundary emitting [a, a, b] must not double-count.
    const result = await okResult([knowledge('a'), knowledge('a'), knowledge('b')]);
    const resolution = resolveNextTrainingStep({ result, completedKnowledgeIds: [K('a')] });
    expect(resolution.totalCount).toBe(2);
    expect(resolution.completedCount).toBe(1);
    expect(resolution.step?.knowledgeId).toBe(K('b'));
    expect(resolution.step?.stepIndex).toBe(1);
    expect(resolution.step?.totalSteps).toBe(2);
  });

  it('reports correct progress across a full (un-truncated) sequence — the required precondition', async () => {
    // Progress is computed over the complete sequence supplied to the resolver; callers must not
    // set maxResults on the training-resolution query (see module precondition).
    const result = await okResult([knowledge('a'), knowledge('b'), knowledge('c'), knowledge('d')]);
    const midway = resolveNextTrainingStep({ result, completedKnowledgeIds: [K('a'), K('b')] });
    expect(midway.status).toBe('resolved');
    expect(midway.step?.knowledgeId).toBe(K('c'));
    expect(midway).toMatchObject({ completedCount: 2, totalCount: 4 });
    expect(midway.step?.totalSteps).toBe(4);
  });

  it('the step is content-free (identifiers + position only)', async () => {
    const result = await okResult([knowledge('a')]);
    const step = resolveNextTrainingStep({ result }).step!;
    for (const key of Object.keys(step)) expect(STEP_KEYS.has(key), key).toBe(true);
    expect(JSON.stringify(step)).not.toMatch(/summary|"text"|body|content/i);
  });
});

describe('P4.10 resolveNextTrainingStep — fail-closed unavailable path', () => {
  it('is unavailable with a P4.9 safe fallback when retrieval degraded (provider failure)', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerThrowing());
    const result = await adapter.retrieveApprovedKnowledge(request());
    const resolution = resolveNextTrainingStep({ result });
    expect(resolution.status).toBe('unavailable');
    expect(resolution.reasonCode).toBe('no_approved_knowledge');
    expect(resolution.step).toBeUndefined();
    expect(resolution).toMatchObject({ completedCount: 0, totalCount: 0 });
    expect(resolution.safeFallback?.reasons).toEqual(['knowledge_unavailable']);
    expect(resolution.safeFallback?.safeFallbackInstruction).toContain('could not be reached');
    expect(resolution.safeFallback?.missingSections).toEqual(['approvedKnowledge']);
  });

  it('is unavailable with a translation_unavailable fallback on a language miss', async () => {
    // en request, only es content, no fallback → degraded language_unavailable.
    const esRef: KnowledgeReference = { ...knowledge('es'), language: 'es' };
    const adapter = createContextManagerRetrievalAdapter(providerReturning([esRef]));
    const result = await adapter.retrieveApprovedKnowledge(request({ allowLanguageFallback: false }));
    const resolution = resolveNextTrainingStep({ result });
    expect(resolution.status).toBe('unavailable');
    expect(resolution.safeFallback?.reasons).toEqual(['translation_unavailable']);
    expect(resolution.safeFallback?.safeFallbackInstruction).toContain('continue in Spanish');
  });
});

describe('P4.10 static next-training-step governance boundary', () => {
  const modulePath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'nextTrainingStep.ts');
  const source = readFileSync(modulePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('imports no store/Gateway/LLM, reads no clock, assembles no packet, generates nothing', () => {
    expect(/from\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|\/services\/gateway|anthropic|openai)/i.test(source)).toBe(false);
    expect(/\bDate\.now\s*\(|\bnew\s+Date\s*\(/.test(source)).toBe(false);
    expect(/buildContextPacket\s*\(/.test(source)).toBe(false);
    expect(/\b(?:generateText|createCompletion|chatCompletion|llm)\b/i.test(source)).toBe(false);
  });
});
