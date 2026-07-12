import type { McsPlatformAgentKey } from './agent-registry.js';

export type McsPromptVersionStatus =
  | 'draft' | 'in_review' | 'approved' | 'active' | 'deprecated' | 'retired' | 'rejected';
export type McsPromptGovernanceRole = 'author' | 'governance_reviewer' | 'runtime_owner' | 'leadership_approver';
export type McsPromptGovernanceAction =
  | 'request_review' | 'approve' | 'reject' | 'activate' | 'deprecate' | 'retire' | 'rollback';

export interface McsPromptVersionRecord {
  promptId: string;
  promptSlot: string;
  version: string;
  ownerAgentKey: McsPlatformAgentKey;
  status: McsPromptVersionStatus;
  authorId: string;
  reviewerId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
  immutable: boolean;
  sourceRef: string;
  allowedInputs: readonly string[];
  forbiddenOutputs: readonly string[];
  degradationBehavior: string;
  testIds: readonly string[];
  rollbackVersion: string | null;
}

export interface McsPromptGovernanceActor {
  actorId: string;
  role: McsPromptGovernanceRole;
}

export interface McsPromptGovernanceEvent {
  eventType:
    | 'prompt_review_requested' | 'prompt_approved' | 'prompt_rejected'
    | 'prompt_activated' | 'prompt_deprecated' | 'prompt_retired' | 'prompt_rollback_executed';
  promptId: string;
  promptSlot: string;
  version: string;
  actorId: string;
  occurredAt: string;
  fromStatus: McsPromptVersionStatus;
  toStatus: McsPromptVersionStatus;
  reason: string;
  restoredVersion: string | null;
}

export interface McsPromptTransitionContext {
  actor: McsPromptGovernanceActor;
  now: string;
  reason: string;
  testsPassed?: boolean;
  activeVersion?: McsPromptVersionRecord | null;
  rollbackTarget?: McsPromptVersionRecord | null;
}

export type McsPromptTransitionResult =
  | { ok: true; record: McsPromptVersionRecord; event: McsPromptGovernanceEvent }
  | { ok: false; errors: string[] };

const EVENT_BY_ACTION: Record<McsPromptGovernanceAction, McsPromptGovernanceEvent['eventType']> = {
  request_review: 'prompt_review_requested', approve: 'prompt_approved', reject: 'prompt_rejected',
  activate: 'prompt_activated', deprecate: 'prompt_deprecated', retire: 'prompt_retired',
  rollback: 'prompt_rollback_executed',
};

const ALLOWED_FROM: Record<McsPromptGovernanceAction, readonly McsPromptVersionStatus[]> = {
  request_review: ['draft'], approve: ['in_review'], reject: ['in_review'], activate: ['approved'],
  deprecate: ['active'], retire: ['deprecated', 'rejected'], rollback: ['active'],
};

const TO_STATUS: Record<Exclude<McsPromptGovernanceAction, 'rollback'>, McsPromptVersionStatus> = {
  request_review: 'in_review', approve: 'approved', reject: 'rejected', activate: 'active',
  deprecate: 'deprecated', retire: 'retired',
};

export function validatePromptVersionRecord(record: McsPromptVersionRecord): string[] {
  const errors: string[] = [];
  if (!record.promptId.trim() || !record.promptSlot.trim()) errors.push('prompt_identity_required');
  if (!/^\d+\.\d+\.\d+$/.test(record.version)) errors.push('semantic_version_required');
  if (!record.sourceRef.trim()) errors.push('source_ref_required');
  if (!record.allowedInputs.length) errors.push('allowed_inputs_required');
  if (!record.forbiddenOutputs.length) errors.push('forbidden_outputs_required');
  if (!record.degradationBehavior.trim()) errors.push('degradation_behavior_required');
  if (!record.testIds.length) errors.push('tests_required');
  if (['approved', 'active', 'deprecated', 'retired'].includes(record.status)) {
    if (!record.reviewerId || !record.approvedBy || !record.approvedAt) errors.push('approval_record_required');
    if (!record.immutable) errors.push('approved_version_must_be_immutable');
  }
  return errors;
}

export function transitionPromptVersion(
  record: McsPromptVersionRecord,
  action: McsPromptGovernanceAction,
  context: McsPromptTransitionContext,
): McsPromptTransitionResult {
  const errors = validatePromptVersionRecord(record);
  if (!ALLOWED_FROM[action].includes(record.status)) errors.push(`invalid_transition:${record.status}:${action}`);
  if (!context.reason.trim()) errors.push('reason_required');
  if (action === 'request_review' && context.actor.actorId !== record.authorId) errors.push('author_required');
  if (['approve', 'reject'].includes(action)) {
    if (context.actor.role !== 'governance_reviewer' && context.actor.role !== 'leadership_approver') errors.push('reviewer_role_required');
    if (context.actor.actorId === record.authorId) errors.push('author_cannot_review_own_version');
    if (action === 'approve' && context.testsPassed !== true) errors.push('passing_tests_required');
  }
  if (action === 'activate') {
    if (!['runtime_owner', 'leadership_approver'].includes(context.actor.role)) errors.push('runtime_or_leadership_approval_required');
    if (context.activeVersion && context.activeVersion.version !== record.version) errors.push('prompt_slot_already_has_active_version');
  }
  if (['deprecate', 'retire', 'rollback'].includes(action) && context.actor.role !== 'leadership_approver') errors.push('leadership_approval_required');
  if (action === 'rollback') {
    const target = context.rollbackTarget;
    if (!target || target.promptSlot !== record.promptSlot || !target.immutable || !['approved', 'deprecated'].includes(target.status)) {
      errors.push('approved_rollback_target_required');
    }
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  const fromStatus = record.status;
  const rollbackTarget = action === 'rollback' ? context.rollbackTarget! : null;
  const toStatus = action === 'rollback' ? 'active' : TO_STATUS[action];
  const next: McsPromptVersionRecord = action === 'rollback'
    ? { ...(rollbackTarget as McsPromptVersionRecord), status: 'active', activatedAt: context.now, immutable: true }
    : {
        ...record, status: toStatus,
        reviewerId: ['approve', 'reject'].includes(action) ? context.actor.actorId : record.reviewerId,
        approvedBy: action === 'approve' ? context.actor.actorId : record.approvedBy,
        approvedAt: action === 'approve' ? context.now : record.approvedAt,
        activatedAt: action === 'activate' ? context.now : record.activatedAt,
        immutable: action === 'approve' ? true : record.immutable,
      };
  return {
    ok: true,
    record: next,
    event: {
      eventType: EVENT_BY_ACTION[action], promptId: next.promptId, promptSlot: next.promptSlot,
      version: next.version, actorId: context.actor.actorId, occurredAt: context.now,
      fromStatus, toStatus, reason: context.reason,
      restoredVersion: rollbackTarget?.version ?? null,
    },
  };
}
