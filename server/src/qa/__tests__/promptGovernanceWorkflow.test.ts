import { describe, expect, it } from 'vitest';
import { transitionPromptVersion, validatePromptVersionRecord, type McsPromptVersionRecord } from '@momentum/shared';

const draft = (): McsPromptVersionRecord => ({
  promptId: 'prompt_scriptmaker_wdyk', promptSlot: 'scriptmaker.wdyk.product', version: '1.0.0',
  ownerAgentKey: 'scriptmaker', status: 'draft', authorId: 'author_1', reviewerId: null,
  approvedBy: null, approvedAt: null, activatedAt: null, immutable: false,
  sourceRef: 'server/prompts/scriptmaker-wdyk.ts', allowedInputs: ['approved_product_context'],
  forbiddenOutputs: ['qualification', 'automatic_send', 'income_projection'],
  degradationBehavior: 'Return to approved product training.', testIds: ['scriptmaker-wdyk.test.ts'],
  rollbackVersion: null,
});
const now = '2026-07-12T08:00:00.000Z';

describe('P1-63 prompt governance workflow', () => {
  it('runs draft through independent review, approval, and activation', () => {
    const review = transitionPromptVersion(draft(), 'request_review', { actor: { actorId: 'author_1', role: 'author' }, now, reason: 'ready' });
    expect(review.ok).toBe(true);
    const approved = transitionPromptVersion((review as any).record, 'approve', { actor: { actorId: 'reviewer_1', role: 'governance_reviewer' }, now, reason: 'tests and review passed', testsPassed: true });
    expect(approved).toMatchObject({ ok: true, record: { status: 'approved', immutable: true, approvedBy: 'reviewer_1' } });
    const active = transitionPromptVersion((approved as any).record, 'activate', { actor: { actorId: 'runtime_1', role: 'runtime_owner' }, now, reason: 'approved deployment', activeVersion: null });
    expect(active).toMatchObject({ ok: true, record: { status: 'active' }, event: { eventType: 'prompt_activated' } });
  });

  it('blocks self-review, approval without tests, and a second active version', () => {
    const inReview = { ...draft(), status: 'in_review' as const };
    expect(transitionPromptVersion(inReview, 'approve', { actor: { actorId: 'author_1', role: 'governance_reviewer' }, now, reason: 'self', testsPassed: true })).toMatchObject({ ok: false, errors: expect.arrayContaining(['author_cannot_review_own_version']) });
    expect(transitionPromptVersion(inReview, 'approve', { actor: { actorId: 'reviewer_1', role: 'governance_reviewer' }, now, reason: 'no tests', testsPassed: false })).toMatchObject({ ok: false, errors: expect.arrayContaining(['passing_tests_required']) });
    const approved = { ...draft(), status: 'approved' as const, reviewerId: 'r', approvedBy: 'r', approvedAt: now, immutable: true };
    expect(transitionPromptVersion(approved, 'activate', { actor: { actorId: 'runtime', role: 'runtime_owner' }, now, reason: 'deploy', activeVersion: { ...approved, version: '0.9.0', status: 'active' } })).toMatchObject({ ok: false, errors: expect.arrayContaining(['prompt_slot_already_has_active_version']) });
  });

  it('rolls back only to an immutable approved version in the same slot', () => {
    const current = { ...draft(), version: '2.0.0', status: 'active' as const, reviewerId: 'r', approvedBy: 'r', approvedAt: now, activatedAt: now, immutable: true };
    const target = { ...current, version: '1.0.0', status: 'deprecated' as const, activatedAt: null };
    const result = transitionPromptVersion(current, 'rollback', { actor: { actorId: 'kevin', role: 'leadership_approver' }, now, reason: 'restore known good', rollbackTarget: target });
    expect(result).toMatchObject({ ok: true, record: { version: '1.0.0', status: 'active' }, event: { eventType: 'prompt_rollback_executed', restoredVersion: '1.0.0' } });
  });

  it('requires complete governance metadata', () => {
    expect(validatePromptVersionRecord({ ...draft(), testIds: [], forbiddenOutputs: [] })).toEqual(expect.arrayContaining(['forbidden_outputs_required', 'tests_required']));
  });
});
