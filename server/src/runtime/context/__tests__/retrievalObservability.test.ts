import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  ApprovedKnowledgeQueryRequest,
  BaId,
  KnowledgeFreshness,
  KnowledgeId,
  KnowledgeReference,
  RuntimeLanguage,
  RuntimeRequestScope,
  RuntimeTranslationStatus,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  KNOWLEDGE_RETRIEVAL_OBSERVABILITY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
  type ApprovedKnowledgeProvider,
  type RetrievalObservabilityRecord,
} from '../index.js';

const NOW = new Date('2026-06-30T12:00:00.000Z');
const PAST = '2026-01-01T00:00:00.000Z';

const EXPECTED_KEYS = new Set([
  'schemaVersion',
  'observedAt',
  'scope',
  'objective',
  'domains',
  'requestedLanguage',
  'allowLanguageFallback',
  'outcome',
  'degradeReasons',
  'stageCounts',
  'freshnessExclusions',
  'language',
  'fallbackUsed',
  'machineTranslationUsed',
  'selectedKnowledgeIds',
  'candidateExcludedSourceIds',
]);

function scope(): RuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    baId: 'TMBA-P48-001' as BaId,
    requestId: 'req_p48_001' as ApprovedKnowledgeQueryRequest['scope']['requestId'],
  };
}

interface KOpts {
  language?: RuntimeLanguage;
  translationStatus?: RuntimeTranslationStatus;
  freshness?: KnowledgeFreshness;
}

function knowledge(id: string, opts: KOpts = {}): KnowledgeReference {
  return {
    knowledgeId: `knowledge_p48_${id}` as KnowledgeId,
    domain: 'training',
    status: 'approved',
    language: opts.language ?? 'en',
    translationStatus: opts.translationStatus ?? 'same_language',
    sourceId: `source_p48_${id}` as SourceId,
    ...(opts.freshness ? { freshness: opts.freshness } : {}),
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

function providerReturning(references: readonly KnowledgeReference[]): ApprovedKnowledgeProvider {
  return { async listApprovedKnowledge() { return references; } };
}

function providerThrowing(): ApprovedKnowledgeProvider {
  return { async listApprovedKnowledge() { throw new Error('boundary down'); } };
}

function capturing() {
  const records: RetrievalObservabilityRecord[] = [];
  return { records, sink: (record: RetrievalObservabilityRecord) => { records.push(record); } };
}

describe('P4.8 retrieval observability — emission through the adapter', () => {
  it('emits a content-free ok record with the stage funnel and selected ids', async () => {
    const { records, sink } = capturing();
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('a'), knowledge('b')]),
      { now: () => NOW, onRetrievalObservability: sink },
    );
    await adapter.retrieveApprovedKnowledge(request());

    expect(records).toHaveLength(1);
    const record = records[0]!;
    expect(record.schemaVersion).toBe(KNOWLEDGE_RETRIEVAL_OBSERVABILITY_SCHEMA_VERSION);
    expect(record.observedAt).toBe(NOW.toISOString());
    expect(record.outcome).toBe('ok');
    expect(record.scope).toEqual({ tenantId: 'tenant_team_magnificent', teamId: 'team_magnificent', baId: 'TMBA-P48-001', requestId: 'req_p48_001' });
    expect(record.stageCounts).toEqual({ raw: 2, candidateExcluded: 0, statusDomainKept: 2, freshKept: 2, selected: 2 });
    expect(record.selectedKnowledgeIds).toEqual(['knowledge_p48_a', 'knowledge_p48_b']);
    // Content-free by construction: only the sanctioned keys, no summary/text/body/content.
    for (const key of Object.keys(record)) expect(EXPECTED_KEYS.has(key), key).toBe(true);
    expect(JSON.stringify(record)).not.toMatch(/summary|"text"|body|content/i);
  });

  it('tallies freshness exclusions and reflects them in the funnel', async () => {
    const { records, sink } = capturing();
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([
        knowledge('fresh'),
        knowledge('dep', { freshness: { lifecycle: 'deprecated' } }),
        knowledge('exp', { freshness: { expiresAt: PAST } }),
      ]),
      { now: () => NOW, onRetrievalObservability: sink },
    );
    await adapter.retrieveApprovedKnowledge(request());

    const record = records[0]!;
    expect(record.outcome).toBe('ok');
    expect(record.stageCounts).toMatchObject({ raw: 3, statusDomainKept: 3, freshKept: 1, selected: 1 });
    expect(record.freshnessExclusions).toEqual({ deprecated: 1, expired: 1 });
  });

  it('surfaces fallback + machine-translation marking in the record', async () => {
    const { records, sink } = capturing();
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('es', { language: 'es', translationStatus: 'machine_translation_marked' })]),
      { now: () => NOW, onRetrievalObservability: sink },
    );
    await adapter.retrieveApprovedKnowledge(request({ allowLanguageFallback: true }));

    const record = records[0]!;
    expect(record.outcome).toBe('ok');
    expect(record.fallbackUsed).toBe(true);
    expect(record.machineTranslationUsed).toBe(true);
    expect(record.language.fallbackLanguage).toBe('es');
    expect(record.language.translationStatus).toBe('machine_translation_marked');
  });

  it('emits a degraded record when everything is guarded out (no fresh approved match)', async () => {
    const { records, sink } = capturing();
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('dep', { freshness: { lifecycle: 'deprecated' } })]),
      { now: () => NOW, onRetrievalObservability: sink },
    );
    const result = await adapter.retrieveApprovedKnowledge(request());

    expect(result.status).toBe('degraded');
    expect(records).toHaveLength(1);
    const record = records[0]!;
    expect(record.outcome).toBe('degraded');
    expect(record.degradeReasons).toContain('no_approved_match');
    expect(record.stageCounts).toMatchObject({ raw: 1, statusDomainKept: 1, freshKept: 0, selected: 0 });
    expect(record.freshnessExclusions).toEqual({ deprecated: 1 });
  });

  it('emits a degraded record with zeroed counts when the provider fails', async () => {
    const { records, sink } = capturing();
    const adapter = createContextManagerRetrievalAdapter(providerThrowing(), {
      now: () => NOW,
      onRetrievalObservability: sink,
    });
    const result = await adapter.retrieveApprovedKnowledge(request());

    expect(result.status).toBe('degraded');
    expect(records).toHaveLength(1);
    const record = records[0]!;
    expect(record.outcome).toBe('degraded');
    expect(record.degradeReasons).toContain('knowledge_unavailable');
    expect(record.stageCounts).toEqual({ raw: 0, candidateExcluded: 0, statusDomainKept: 0, freshKept: 0, selected: 0 });
  });

  it('emits nothing and behaves identically when no sink is provided', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([knowledge('a')]), { now: () => NOW });
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(result.status).toBe('ok');
    expect(result.references.map((r) => r.knowledgeId)).toEqual(['knowledge_p48_a']);
  });

  it('isolates a throwing sink from the returned result', async () => {
    const adapter = createContextManagerRetrievalAdapter(providerReturning([knowledge('a')]), {
      now: () => NOW,
      onRetrievalObservability: () => { throw new Error('sink blew up'); },
    });
    const result = await adapter.retrieveApprovedKnowledge(request());
    expect(result.status).toBe('ok');
    expect(result.references).toHaveLength(1);
  });

  it('a mutating sink cannot corrupt the returned result (record is defensively copied)', async () => {
    const adapter = createContextManagerRetrievalAdapter(
      providerReturning([knowledge('es', { language: 'es', translationStatus: 'machine_translation_marked' })]),
      {
        now: () => NOW,
        onRetrievalObservability: (record) => {
          // A hostile/buggy sink mutates the handed record; the defensive copy means it cannot
          // reach the returned result's (compliance-critical) language marking.
          record.language.machineTranslationUsed = false;
          record.language.translationStatus = 'same_language';
        },
      },
    );
    const result = await adapter.retrieveApprovedKnowledge(request({ allowLanguageFallback: true }));
    expect(result.status).toBe('ok');
    // The returned result's marking is intact — the machine translation is still marked.
    expect(result.metadata.language.machineTranslationUsed).toBe(true);
    expect(result.metadata.language.translationStatus).toBe('machine_translation_marked');
  });
});

describe('P4.8 static observability governance boundary', () => {
  const modulePath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'retrievalObservability.ts');
  const source = readFileSync(modulePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('imports no store, Gateway, or LLM client and reads no ambient clock', () => {
    expect(/from\s+['"][^'"]*(?:mongoose|mongodb|neo4j-driver|chromadb|\/services\/gateway|anthropic|openai)/i.test(source)).toBe(false);
    expect(/\bDate\.now\s*\(/.test(source)).toBe(false);
    expect(/\bnew\s+Date\s*\(/.test(source)).toBe(false);
  });

  it('assembles no context packet and performs no I/O', () => {
    expect(/buildContextPacket\s*\(/.test(source)).toBe(false);
    expect(/\bfetch\s*\(|\brequire\s*\(|writeFile|readFile/.test(source)).toBe(false);
  });
});
