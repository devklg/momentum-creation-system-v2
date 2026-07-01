import { describe, expect, it } from 'vitest';
import type {
  ApprovedKnowledgeQueryRequest,
  ApprovedKnowledgeQueryResult,
  BaId,
  KnowledgeId,
  RuntimeRequestScope,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  ApprovedKnowledgeQueryValidationError,
  assertApprovedKnowledgeQueryResult,
  validateApprovedKnowledgeQueryRequest,
  validateApprovedKnowledgeQueryResult,
} from '../approvedKnowledgeQueryContract.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../validation.js';

function baScope(): RuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as TenantId,
    teamId: 'team_magnificent' as TeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    baId: 'TMBA-20260101-ABC123' as BaId,
  };
}

function validRequest(): ApprovedKnowledgeQueryRequest {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    scope: baScope(),
    objective: 'training_support',
    domains: ['training'],
    language: 'en',
    allowLanguageFallback: false,
    maxResults: 5,
  };
}

function approvedReference(id: string) {
  return {
    knowledgeId: `k_${id}` as KnowledgeId,
    domain: 'training' as const,
    status: 'approved' as const,
    language: 'en' as const,
    translationStatus: 'same_language' as const,
    sourceId: `src_${id}` as SourceId,
  };
}

function okResult(): ApprovedKnowledgeQueryResult {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    status: 'ok',
    scope: baScope(),
    references: [approvedReference('1'), approvedReference('2')],
    excluded: [{ sourceId: 'src_cand_1' as SourceId, reason: 'candidate_not_approved' }],
    metadata: {
      approvedCount: 2,
      candidateExcludedCount: 1,
      candidateExcluded: true,
      language: {
        language: 'en',
        translationStatus: 'same_language',
        machineTranslationUsed: false,
        humanReviewed: true,
      },
    },
  };
}

function degradedResult(): ApprovedKnowledgeQueryResult {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    status: 'degraded',
    scope: baScope(),
    references: [],
    excluded: [],
    metadata: {
      approvedCount: 0,
      candidateExcludedCount: 0,
      candidateExcluded: true,
      language: {
        language: 'en',
        translationStatus: 'same_language',
        machineTranslationUsed: false,
        humanReviewed: true,
      },
      degradeReasons: ['knowledge_unavailable'],
    },
  };
}

describe('ApprovedKnowledgeQueryRequest validation', () => {
  it('accepts a well-formed request', () => {
    const result = validateApprovedKnowledgeQueryRequest(validRequest());
    expect(result.ok).toBe(true);
  });

  it('accepts an empty domains array (no domain filter)', () => {
    const result = validateApprovedKnowledgeQueryRequest({ ...validRequest(), domains: [] });
    expect(result.ok).toBe(true);
  });

  it('rejects a wrong schema version', () => {
    const result = validateApprovedKnowledgeQueryRequest({ ...validRequest(), schemaVersion: 'nope' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'schema_version_invalid')).toBe(true);
    }
  });

  it('rejects a non-Team-Magnificent scope', () => {
    const bad = { ...validRequest(), scope: { ...baScope(), teamKey: 'other_team' } };
    const result = validateApprovedKnowledgeQueryRequest(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'team_scope_invalid')).toBe(true);
    }
  });

  it('rejects an unsupported language', () => {
    const result = validateApprovedKnowledgeQueryRequest({ ...validRequest(), language: 'fr' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'language_invalid')).toBe(true);
  });

  it('rejects an unknown knowledge domain', () => {
    const result = validateApprovedKnowledgeQueryRequest({ ...validRequest(), domains: ['marketing'] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'domains_invalid')).toBe(true);
  });

  it('rejects a non-positive maxResults', () => {
    const result = validateApprovedKnowledgeQueryRequest({ ...validRequest(), maxResults: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'max_results_invalid')).toBe(true);
  });
});

describe('ApprovedKnowledgeQueryResult validation', () => {
  it('accepts a well-formed ok result', () => {
    const result = validateApprovedKnowledgeQueryResult(okResult());
    expect(result.ok).toBe(true);
  });

  it('accepts a well-formed degraded result', () => {
    const result = validateApprovedKnowledgeQueryResult(degradedResult());
    expect(result.ok).toBe(true);
  });

  it('REJECTS a candidate status in references (load-bearing governance check)', () => {
    const bad = okResult();
    // @ts-expect-error — deliberately injecting a forbidden status to prove the guard.
    bad.references = [{ ...approvedReference('x'), status: 'candidate' }];
    bad.metadata.approvedCount = 1;
    const result = validateApprovedKnowledgeQueryResult(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'candidate_in_result')).toBe(true);
    }
  });

  it('REJECTS a queued_for_review status in references', () => {
    const bad = okResult();
    // @ts-expect-error — forbidden status injected on purpose.
    bad.references = [{ ...approvedReference('x'), status: 'queued_for_review' }];
    bad.metadata.approvedCount = 1;
    const result = validateApprovedKnowledgeQueryResult(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'candidate_in_result')).toBe(true);
  });

  it('requires candidateExcluded to be true', () => {
    const bad = okResult();
    // @ts-expect-error — must be the literal true.
    bad.metadata.candidateExcluded = false;
    const result = validateApprovedKnowledgeQueryResult(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'metadata_invalid')).toBe(true);
  });

  it('rejects an approvedCount that does not match references.length', () => {
    const bad = okResult();
    bad.metadata.approvedCount = 99;
    const result = validateApprovedKnowledgeQueryResult(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'count_mismatch')).toBe(true);
  });

  it('rejects a candidateExcludedCount that does not match excluded.length', () => {
    const bad = okResult();
    bad.metadata.candidateExcludedCount = 99;
    const result = validateApprovedKnowledgeQueryResult(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'count_mismatch')).toBe(true);
  });

  it('rejects a degraded result with no degradeReasons', () => {
    const bad = degradedResult();
    delete bad.metadata.degradeReasons;
    const result = validateApprovedKnowledgeQueryResult(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'degrade_reason_required')).toBe(true);
  });

  it('rejects a degraded result that still carries approved references (fail-closed)', () => {
    const bad = degradedResult();
    bad.references = [approvedReference('1')];
    bad.metadata.approvedCount = 1;
    const result = validateApprovedKnowledgeQueryResult(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'references_invalid')).toBe(true);
  });

  it('rejects an unknown exclusion reason', () => {
    const bad = okResult();
    // @ts-expect-error — forbidden reason injected on purpose.
    bad.excluded = [{ sourceId: 'src_x' as SourceId, reason: 'just_because' }];
    const result = validateApprovedKnowledgeQueryResult(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'excluded_invalid')).toBe(true);
  });

  it('assertApprovedKnowledgeQueryResult throws on an invalid result', () => {
    const bad = okResult();
    bad.metadata.approvedCount = 99;
    expect(() => assertApprovedKnowledgeQueryResult(bad)).toThrow(ApprovedKnowledgeQueryValidationError);
  });

  it('assertApprovedKnowledgeQueryResult passes a valid result through', () => {
    expect(() => assertApprovedKnowledgeQueryResult(okResult())).not.toThrow();
  });
});
