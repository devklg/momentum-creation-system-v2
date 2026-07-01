import { describe, expect, it } from 'vitest';
import { computeLearningObservabilitySnapshot } from '../learningObservability.js';
import type {
  AuditLogEntry,
  McsLearningCandidateRecord,
  McsOutcomeRecord,
} from '@momentum/shared';

/** Phase 7 · P7.11 — learning observability pure-aggregation tests. */

const GEN_AT = '2026-07-01T12:00:00.000Z';

function auditEntry(action: string): AuditLogEntry {
  return {
    entryId: `audit_${action}`,
    timestamp: GEN_AT,
    createdAt: GEN_AT,
    role: 'system',
    actor: { kind: 'system', label: 'runtime:michael' },
    action,
    entity: { kind: 'none', id: 'turn', displayLabel: null },
    severity: 'info',
    before: null,
    after: null,
    reason: null,
    context: null,
    linkedTranscriptId: null,
  };
}

function outcome(kind: McsOutcomeRecord['kind']): McsOutcomeRecord {
  return {
    id: `o_${kind}`,
    type: 'outcome',
    schemaVersion: 1,
    namespace: 'momentum',
    source: 'mcs_outcome_capture',
    createdAt: GEN_AT,
    title: 't',
    originKind: 'system',
    serviceName: 'mcs_outcome_capture',
    tenantId: 'team_magnificent',
    teamKey: 'team_magnificent',
    kind,
    confirmedByTmagId: 'TMAG-1',
    outcomeAt: GEN_AT,
  };
}

function candidate(status: McsLearningCandidateRecord['status']): McsLearningCandidateRecord {
  return {
    id: `c_${status}`,
    type: 'learning_candidate',
    schemaVersion: 1,
    namespace: 'momentum',
    source: 'mcs_learning_pipeline',
    createdAt: GEN_AT,
    title: 't',
    originKind: 'system',
    serviceName: 'mcs_learning_pipeline',
    tenantId: 'team_magnificent',
    status,
    domain: 'performance',
    language: 'en',
    proposedSummary: 's',
    sourceOutcomeIds: ['o_declined'],
    sourceSignalIds: [],
    teamKey: 'team_magnificent',
  };
}

describe('Phase 7 P7.11 — learning observability aggregation', () => {
  it('returns a zeroed snapshot for empty inputs (no NaN rates)', () => {
    const snap = computeLearningObservabilitySnapshot({
      tenantId: 'team_magnificent',
      generatedAt: GEN_AT,
      runtimeAuditEntries: [],
      outcomes: [],
      candidates: [],
    });
    expect(snap.runtimeAudit).toEqual({ total: 0, gateAllowed: 0, gateDenied: 0, gateDenyRate: 0 });
    expect(snap.outcomes.total).toBe(0);
    expect(snap.outcomes.byKind.enrolled_iii).toBe(0);
    expect(snap.learningCandidates.approvalRate).toBe(0);
  });

  it('counts gate allow/deny and computes the deny rate', () => {
    const snap = computeLearningObservabilitySnapshot({
      tenantId: 'team_magnificent',
      generatedAt: GEN_AT,
      runtimeAuditEntries: [
        auditEntry('runtime.gate.allowed'),
        auditEntry('runtime.gate.allowed'),
        auditEntry('runtime.gate.allowed'),
        auditEntry('runtime.gate.denied'),
        auditEntry('runtime.turn.opened'),
      ],
      outcomes: [],
      candidates: [],
    });
    expect(snap.runtimeAudit.total).toBe(5);
    expect(snap.runtimeAudit.gateAllowed).toBe(3);
    expect(snap.runtimeAudit.gateDenied).toBe(1);
    expect(snap.runtimeAudit.gateDenyRate).toBeCloseTo(0.25);
  });

  it('distributes outcomes by kind', () => {
    const snap = computeLearningObservabilitySnapshot({
      tenantId: 'team_magnificent',
      generatedAt: GEN_AT,
      runtimeAuditEntries: [],
      outcomes: [outcome('became_customer'), outcome('became_customer'), outcome('enrolled_iii')],
      candidates: [],
    });
    expect(snap.outcomes.total).toBe(3);
    expect(snap.outcomes.byKind.became_customer).toBe(2);
    expect(snap.outcomes.byKind.enrolled_iii).toBe(1);
    expect(snap.outcomes.byKind.declined).toBe(0);
  });

  it('computes candidate lifecycle distribution + approval rate', () => {
    const snap = computeLearningObservabilitySnapshot({
      tenantId: 'team_magnificent',
      generatedAt: GEN_AT,
      runtimeAuditEntries: [],
      outcomes: [],
      candidates: [
        candidate('detected'),
        candidate('approved'),
        candidate('approved'),
        candidate('rejected'),
      ],
    });
    expect(snap.learningCandidates.total).toBe(4);
    expect(snap.learningCandidates.detected).toBe(1);
    expect(snap.learningCandidates.approved).toBe(2);
    expect(snap.learningCandidates.rejected).toBe(1);
    expect(snap.learningCandidates.approvalRate).toBeCloseTo(2 / 3);
  });

  it('preserves tenant + generatedAt passthrough', () => {
    const snap = computeLearningObservabilitySnapshot({
      tenantId: 'team_magnificent',
      generatedAt: GEN_AT,
      runtimeAuditEntries: [],
      outcomes: [],
      candidates: [],
    });
    expect(snap.tenantId).toBe('team_magnificent');
    expect(snap.generatedAt).toBe(GEN_AT);
  });
});
