import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  McsApprovedKnowledgeQueryRequest,
  TmagId,
  McsKnowledgeFreshness,
  McsKnowledgeFreshnessPolicy,
  McsKnowledgeId,
  McsKnowledgeReference,
  McsRuntimeRequestScope,
  McsSourceId,
  McsTeamId,
  McsTenantId,
} from '@momentum/shared/runtime';
import {
  evaluateFreshness,
  filterFresh,
  isFresh,
} from '../freshnessGuard.js';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
  type ApprovedKnowledgeProvider,
} from '../index.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../validation.js';

const NOW = new Date('2026-06-30T12:00:00.000Z');
const PAST = '2026-01-01T00:00:00.000Z';
const FUTURE = '2026-12-31T00:00:00.000Z';

function scope(): McsRuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as McsTenantId,
    teamId: 'team_magnificent' as McsTeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: 'TMAG-P47-001' as TmagId,
  };
}

function knowledge(id: string, freshness?: McsKnowledgeFreshness): McsKnowledgeReference {
  return {
    knowledgeId: `knowledge_p47_${id}` as McsKnowledgeId,
    domain: 'training',
    status: 'approved',
    language: 'en',
    translationStatus: 'same_language',
    sourceId: `source_p47_${id}` as McsSourceId,
    ...(freshness ? { freshness } : {}),
  };
}

function request(overrides: Partial<McsApprovedKnowledgeQueryRequest> = {}): McsApprovedKnowledgeQueryRequest {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    scope: scope(),
    objective: 'training_support',
    domains: ['training'],
    language: 'en',
    ...overrides,
  };
}

function providerReturning(references: readonly McsKnowledgeReference[]): ApprovedKnowledgeProvider {
  return {
    async listApprovedKnowledge() {
      return references;
    },
  };
}

describe('P4.7 evaluateFreshness — pure guard', () => {
  it('treats a reference with no freshness metadata as fresh (backward compatible)', () => {
    expect(evaluateFreshness(knowledge('none'), undefined, NOW)).toBe('fresh');
  });

  it('excludes deprecated and superseded by default, keeps them when policy opts out', () => {
    expect(evaluateFreshness(knowledge('d', { lifecycle: 'deprecated' }), undefined, NOW)).toBe('deprecated');
    expect(evaluateFreshness(knowledge('s', { lifecycle: 'superseded' }), undefined, NOW)).toBe('superseded');
    expect(evaluateFreshness(knowledge('d', { lifecycle: 'deprecated' }), { excludeDeprecated: false }, NOW)).toBe('fresh');
    expect(evaluateFreshness(knowledge('s', { lifecycle: 'superseded' }), { excludeSuperseded: false }, NOW)).toBe('fresh');
  });

  it('excludes expired items and keeps not-yet-expired items', () => {
    expect(evaluateFreshness(knowledge('e', { expiresAt: PAST }), undefined, NOW)).toBe('expired');
    expect(evaluateFreshness(knowledge('e', { expiresAt: FUTURE }), undefined, NOW)).toBe('fresh');
  });

  it('excludes not-yet-effective items and keeps already-effective items', () => {
    expect(evaluateFreshness(knowledge('n', { effectiveAt: FUTURE }), undefined, NOW)).toBe('not_yet_effective');
    expect(evaluateFreshness(knowledge('n', { effectiveAt: PAST }), undefined, NOW)).toBe('fresh');
  });

  it('applies maxAgeDays staleness only when the policy sets it', () => {
    const ref = knowledge('u', { updatedAt: '2026-06-01T12:00:00.000Z' }); // 29 days before NOW
    expect(evaluateFreshness(ref, { maxAgeDays: 10 }, NOW)).toBe('stale');
    expect(evaluateFreshness(ref, { maxAgeDays: 60 }, NOW)).toBe('fresh');
    expect(evaluateFreshness(ref, undefined, NOW)).toBe('fresh'); // no maxAgeDays → not evaluated
  });

  it('fails closed on an unparseable or empty timestamp when the check is enabled', () => {
    expect(evaluateFreshness(knowledge('bad', { expiresAt: 'not-a-date' }), undefined, NOW)).toBe('expired');
    expect(evaluateFreshness(knowledge('empty', { expiresAt: '   ' }), undefined, NOW)).toBe('expired');
  });

  it('treats the exact boundary instant as fresh (now == expiresAt / now == effectiveAt)', () => {
    const nowIso = NOW.toISOString();
    expect(evaluateFreshness(knowledge('exp', { expiresAt: nowIso }), undefined, NOW)).toBe('fresh');
    expect(evaluateFreshness(knowledge('eff', { effectiveAt: nowIso }), undefined, NOW)).toBe('fresh');
  });

  it('fails closed on a present-but-unrecognized lifecycle (corrupt data)', () => {
    const corrupt = { ...knowledge('x'), freshness: { lifecycle: 'Deprecated' } } as unknown as Parameters<typeof evaluateFreshness>[0];
    expect(evaluateFreshness(corrupt, undefined, NOW)).toBe('deprecated');
    // ...but honored as current if the caller opts out of deprecation exclusion.
    expect(evaluateFreshness(corrupt, { excludeDeprecated: false }, NOW)).toBe('fresh');
  });

  it('treats a non-positive or non-finite maxAgeDays as inert (never corpus-emptying)', () => {
    const old = knowledge('old', { updatedAt: '2020-01-01T00:00:00.000Z' });
    expect(evaluateFreshness(old, { maxAgeDays: -5 }, NOW)).toBe('fresh');
    expect(evaluateFreshness(old, { maxAgeDays: 0 }, NOW)).toBe('fresh');
    expect(evaluateFreshness(old, { maxAgeDays: Number.NaN }, NOW)).toBe('fresh');
  });

  it('honors a valid policy.asOf over the injected clock', () => {
    const ref = knowledge('e', { expiresAt: '2026-06-15T00:00:00.000Z' });
    expect(evaluateFreshness(ref, { asOf: '2026-06-10T00:00:00.000Z' }, NOW)).toBe('fresh');
    expect(evaluateFreshness(ref, { asOf: '2026-06-20T00:00:00.000Z' }, NOW)).toBe('expired');
    // An invalid asOf falls back to the injected clock (NOW → after expiry → expired).
    expect(evaluateFreshness(ref, { asOf: 'not-a-date' }, NOW)).toBe('expired');
  });

  it('applies exclusions in priority order (deprecated before expired)', () => {
    const ref = knowledge('both', { lifecycle: 'deprecated', expiresAt: PAST });
    expect(evaluateFreshness(ref, undefined, NOW)).toBe('deprecated');
  });

  it('isFresh and filterFresh reflect the verdict', () => {
    expect(isFresh(knowledge('ok'), undefined, NOW)).toBe(true);
    const refs = [knowledge('a'), knowledge('b', { lifecycle: 'deprecated' }), knowledge('c', { expiresAt: PAST })];
    expect(filterFresh(refs, undefined, NOW).map((r) => r.knowledgeId)).toEqual(['knowledge_p47_a']);
  });
});

describe('P4.7 through the retrieval adapter', () => {
  function adapter(references: readonly McsKnowledgeReference[]) {
    return createContextManagerRetrievalAdapter(providerReturning(references), { now: () => NOW });
  }

  it('drops deprecated/expired references and keeps fresh ones', async () => {
    const result = await adapter([
      knowledge('fresh'),
      knowledge('dep', { lifecycle: 'deprecated' }),
      knowledge('exp', { expiresAt: PAST }),
    ]).retrieveApprovedKnowledge(request());
    expect(result.status).toBe('ok');
    expect(result.references.map((r) => r.knowledgeId)).toEqual(['knowledge_p47_fresh']);
  });

  it('degrades to no_approved_match when every approved reference is guarded out', async () => {
    const result = await adapter([
      knowledge('dep', { lifecycle: 'deprecated' }),
      knowledge('sup', { lifecycle: 'superseded' }),
    ]).retrieveApprovedKnowledge(request());
    expect(result.status).toBe('degraded');
    expect(result.metadata.degradeReasons).toContain('no_approved_match');
  });

  it('references without freshness metadata are unaffected (backward compatible)', async () => {
    const result = await adapter([knowledge('a'), knowledge('b')]).retrieveApprovedKnowledge(request());
    expect(result.references.map((r) => r.knowledgeId)).toEqual(['knowledge_p47_a', 'knowledge_p47_b']);
  });

  it('honors an explicit policy that opts out of deprecation exclusion', async () => {
    const result = await adapter([knowledge('dep', { lifecycle: 'deprecated' })]).retrieveApprovedKnowledge(
      request({ freshness: { excludeDeprecated: false } as McsKnowledgeFreshnessPolicy }),
    );
    expect(result.status).toBe('ok');
    expect(result.references.map((r) => r.knowledgeId)).toEqual(['knowledge_p47_dep']);
  });

  it('uses request.freshness.asOf to evaluate expiry deterministically', async () => {
    const ref = knowledge('e', { expiresAt: '2026-06-15T00:00:00.000Z' });
    // asOf before expiry → fresh
    const before = await adapter([ref]).retrieveApprovedKnowledge(
      request({ freshness: { asOf: '2026-06-10T00:00:00.000Z' } }),
    );
    expect(before.status).toBe('ok');
    // asOf after expiry → expired → degraded
    const after = await adapter([ref]).retrieveApprovedKnowledge(
      request({ freshness: { asOf: '2026-06-20T00:00:00.000Z' } }),
    );
    expect(after.status).toBe('degraded');
    expect(after.metadata.degradeReasons).toContain('no_approved_match');
  });

  it('falls back to the injected clock when request.freshness.asOf is invalid', async () => {
    // expiresAt is before NOW; an unparseable asOf must fall back to NOW → expired → degraded.
    const ref = knowledge('e', { expiresAt: PAST });
    const result = await adapter([ref]).retrieveApprovedKnowledge(
      request({ freshness: { asOf: 'not-a-date' } }),
    );
    expect(result.status).toBe('degraded');
    expect(result.metadata.degradeReasons).toContain('no_approved_match');
  });
});

describe('P4.7 static freshness-guard governance boundary', () => {
  const guardPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'freshnessGuard.ts');
  const source = readFileSync(guardPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('imports no store, Gateway, or LLM client and reads no ambient clock', () => {
    expect(/from\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|\/services\/gateway|anthropic|openai)/i.test(source)).toBe(false);
    expect(/\bDate\.now\s*\(/.test(source)).toBe(false);
    expect(/\bnew\s+Date\s*\(\s*\)/.test(source)).toBe(false);
  });

  it('never mutates a reference (guard is a pure predicate)', () => {
    expect(/reference\.\w+\s*=[^=]/.test(source)).toBe(false);
  });
});
