export const MCS_RESOURCE_LIFECYCLE_STATES = [
  'draft',
  'review',
  'approved',
  'active',
  'archived',
  'superseded',
] as const;

export type McsResourceLifecycleState = (typeof MCS_RESOURCE_LIFECYCLE_STATES)[number];

export type McsResourceLifecycleAction =
  | 'submit_for_review'
  | 'request_changes'
  | 'approve'
  | 'activate'
  | 'archive'
  | 'supersede';

export interface McsResourceLifecycleTransitionContext {
  actorTmagId: string;
  authorTmagId?: string | null;
  reason?: string | null;
  approvalEvidenceId?: string | null;
  readinessEvidenceId?: string | null;
  replacementResourceVersionId?: string | null;
}

export interface McsResourceLifecycleDecision {
  ok: boolean;
  from: McsResourceLifecycleState;
  action: McsResourceLifecycleAction;
  to: McsResourceLifecycleState | null;
  errors: string[];
}

export const MCS_RESOURCE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<McsResourceLifecycleState, Partial<Record<McsResourceLifecycleAction, McsResourceLifecycleState>>>
> = {
  draft: { submit_for_review: 'review' },
  review: { request_changes: 'draft', approve: 'approved' },
  approved: { activate: 'active', archive: 'archived' },
  active: { archive: 'archived', supersede: 'superseded' },
  archived: {},
  superseded: {},
};

export const MCS_RESOURCE_RETRIEVAL_ELIGIBLE_STATES: readonly McsResourceLifecycleState[] = ['active'];

export function evaluateResourceLifecycleTransition(
  from: McsResourceLifecycleState,
  action: McsResourceLifecycleAction,
  context: McsResourceLifecycleTransitionContext,
): McsResourceLifecycleDecision {
  const to = MCS_RESOURCE_LIFECYCLE_TRANSITIONS[from][action] ?? null;
  const errors: string[] = [];
  if (!to) errors.push('transition_not_allowed');
  if (!context.actorTmagId.trim()) errors.push('human_actor_required');

  if (action === 'approve') {
    if (!context.approvalEvidenceId?.trim()) errors.push('approval_evidence_required');
    if (context.authorTmagId && context.authorTmagId === context.actorTmagId) {
      errors.push('author_cannot_self_approve');
    }
  }
  if (action === 'activate' && !context.readinessEvidenceId?.trim()) {
    errors.push('readiness_evidence_required');
  }
  if ((action === 'archive' || action === 'supersede') && !context.reason?.trim()) {
    errors.push('reason_required');
  }
  if (action === 'supersede' && !context.replacementResourceVersionId?.trim()) {
    errors.push('replacement_resource_version_required');
  }

  return { ok: errors.length === 0, from, action, to, errors };
}

export function legacyActiveBooleanLifecycle(active: boolean): {
  state: Extract<McsResourceLifecycleState, 'active' | 'archived'>;
  ambiguous: boolean;
  note: string;
} {
  return active
    ? { state: 'active', ambiguous: false, note: 'Legacy active=true maps to active.' }
    : {
        state: 'archived',
        ambiguous: true,
        note: 'Legacy active=false is provisionally archived; it may represent draft, hidden, or retired content and requires migration review.',
      };
}
