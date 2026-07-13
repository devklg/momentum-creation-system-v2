import { describe, expect, it } from 'vitest';
import {
  MCS_RESOURCE_LIFECYCLE_STATES,
  MCS_RESOURCE_RETRIEVAL_ELIGIBLE_STATES,
  evaluateResourceLifecycleTransition,
  legacyActiveBooleanLifecycle,
  type McsResourceLifecycleAction,
  type McsResourceLifecycleState,
} from '@momentum/shared';

const actor = { actorTmagId: 'TMBA-REVIEWER', authorTmagId: 'TMBA-AUTHOR' };

describe('P1 resource and content lifecycle', () => {
  it('defines the exact normalized lifecycle and only active retrieval eligibility', () => {
    expect(MCS_RESOURCE_LIFECYCLE_STATES).toEqual(['draft', 'review', 'approved', 'active', 'archived', 'superseded']);
    expect(MCS_RESOURCE_RETRIEVAL_ELIGIBLE_STATES).toEqual(['active']);
  });

  it.each([
    ['draft', 'submit_for_review', 'review', {}],
    ['review', 'request_changes', 'draft', {}],
    ['review', 'approve', 'approved', { approvalEvidenceId: 'approval_1' }],
    ['approved', 'activate', 'active', { readinessEvidenceId: 'ready_1' }],
    ['approved', 'archive', 'archived', { reason: 'withdrawn before publication' }],
    ['active', 'archive', 'archived', { reason: 'retired' }],
    ['active', 'supersede', 'superseded', { reason: 'new version', replacementResourceVersionId: 'resource_v2' }],
  ] as Array<[McsResourceLifecycleState, McsResourceLifecycleAction, McsResourceLifecycleState, Record<string, string>]>)('%s + %s -> %s', (from, action, to, context) => {
    expect(evaluateResourceLifecycleTransition(from, action, { ...actor, ...context })).toMatchObject({ ok: true, to, errors: [] });
  });

  it('rejects skips, reverse promotion, and all terminal-state transitions', () => {
    expect(evaluateResourceLifecycleTransition('draft', 'approve', { ...actor, approvalEvidenceId: 'a' }).ok).toBe(false);
    expect(evaluateResourceLifecycleTransition('active', 'activate', { ...actor, readinessEvidenceId: 'r' }).ok).toBe(false);
    expect(evaluateResourceLifecycleTransition('archived', 'submit_for_review', actor).ok).toBe(false);
    expect(evaluateResourceLifecycleTransition('superseded', 'activate', { ...actor, readinessEvidenceId: 'r' }).ok).toBe(false);
  });

  it('requires human separation, evidence, reasons, and successor lineage', () => {
    expect(evaluateResourceLifecycleTransition('review', 'approve', { ...actor, approvalEvidenceId: null }).errors).toContain('approval_evidence_required');
    expect(evaluateResourceLifecycleTransition('review', 'approve', { actorTmagId: 'TMBA-1', authorTmagId: 'TMBA-1', approvalEvidenceId: 'a' }).errors).toContain('author_cannot_self_approve');
    expect(evaluateResourceLifecycleTransition('approved', 'activate', actor).errors).toContain('readiness_evidence_required');
    expect(evaluateResourceLifecycleTransition('active', 'archive', actor).errors).toContain('reason_required');
    expect(evaluateResourceLifecycleTransition('active', 'supersede', { ...actor, reason: 'replacement' }).errors).toContain('replacement_resource_version_required');
  });

  it('marks legacy inactive content as an ambiguous migration finding', () => {
    expect(legacyActiveBooleanLifecycle(true)).toMatchObject({ state: 'active', ambiguous: false });
    expect(legacyActiveBooleanLifecycle(false)).toMatchObject({ state: 'archived', ambiguous: true });
  });
});
