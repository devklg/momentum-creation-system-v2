import { beforeEach, describe, expect, it } from 'vitest';
import type { RetrievalObservabilityRecord } from '../../runtime/context/retrievalObservability.js';
import {
  getContextManagerDiagnosticsSnapshot,
  recordContextManagerDiagnostic,
  resetContextManagerDiagnosticsForTests,
} from '../contextManagerDiagnostics.js';

function record(overrides: Partial<RetrievalObservabilityRecord> = {}): RetrievalObservabilityRecord {
  return {
    schemaVersion: 'knowledge_retrieval_observability.v1', observedAt: '2026-07-13T03:00:00.000Z',
    scope: { tenantId: 'tenant_team_magnificent' }, objective: 'training_support', domains: ['training'],
    requestedLanguage: 'en', allowLanguageFallback: true, outcome: 'ok', stageCounts: {
      raw: 0, candidateExcluded: 0, statusDomainKept: 0, freshKept: 0, selected: 0,
    }, freshnessExclusions: {}, language: {
      language: 'en', translationStatus: 'same_language', machineTranslationUsed: false, humanReviewed: true,
    }, fallbackUsed: false, machineTranslationUsed: false, selectedKnowledgeIds: [], candidateExcludedSourceIds: [],
    ...overrides,
  };
}

describe('Context Manager aggregate diagnostics', () => {
  beforeEach(resetContextManagerDiagnosticsForTests);

  it('counts only content-free outcomes and canonical degraded reasons', () => {
    recordContextManagerDiagnostic(record());
    recordContextManagerDiagnostic(record({ outcome: 'degraded', degradeReasons: ['knowledge_unavailable', 'retrieval_timeout'] }));
    recordContextManagerDiagnostic(record({ outcome: 'degraded', degradeReasons: ['knowledge_unavailable'] }));
    expect(getContextManagerDiagnosticsSnapshot()).toEqual({
      retention: 'in_process_since_restart', total: 3, successful: 1, degraded: 2,
      lastObservedAt: '2026-07-13T03:00:00.000Z',
      degradedReasons: [{ reason: 'knowledge_unavailable', count: 2 }, { reason: 'retrieval_timeout', count: 1 }],
    });
  });

  it('returns defensive aggregate state with no packet, BA, session, or source identifiers', () => {
    recordContextManagerDiagnostic(record({
      scope: { tenantId: 'tenant_team_magnificent', tmagId: 'DO_NOT_EXPOSE', sessionId: 'DO_NOT_EXPOSE' },
      selectedKnowledgeIds: ['DO_NOT_EXPOSE' as never], candidateExcludedSourceIds: ['DO_NOT_EXPOSE' as never],
      outcome: 'degraded', degradeReasons: ['no_approved_match'],
    }));
    const json = JSON.stringify(getContextManagerDiagnosticsSnapshot());
    expect(json).not.toContain('DO_NOT_EXPOSE');
    expect(json).not.toMatch(/tmagId|sessionId|sourceId|knowledgeId|summary|content|prompt/i);
  });
});
