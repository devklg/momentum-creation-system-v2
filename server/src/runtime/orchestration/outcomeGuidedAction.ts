import type {
  McsGuidedActionId,
  McsOutcomeId,
} from '@momentum/shared/runtime';
import { getAgentDescriptor } from './registry.js';
import type {
  DraftOutcomeGuidedActionInput,
  OrchestrationDraftContentScope,
  OrchestrationGuidedActionDraftEnvelope,
  OrchestrationOutcomeDraftEnvelope,
  OutcomeGuidedActionDraftResult,
} from './types.js';

/**
 * S2.3 inert Outcome / Guided Action envelope wiring.
 *
 * Converts accepted Context Packet consumption metadata into returned-only
 * draft envelopes. It does not generate agent responses, persist records,
 * mount routes, or invoke agent behavior.
 */

export function draftOutcomeGuidedActionEnvelopes(
  input: DraftOutcomeGuidedActionInput,
): OutcomeGuidedActionDraftResult {
  const { identity, turnId, consumption } = input;
  const notes: string[] = [
    'Outcome and Guided Action envelopes are draft-only and returned in memory.',
    'Agent behavior is not implemented; no agent response was generated.',
  ];

  if (!consumption.packet || consumption.decision === 'reject' || consumption.decision === 'block_substantive') {
    notes.push('Context Packet was not accepted for draft envelope creation.');
    return {
      decision: consumption.decision,
      agentKey: identity.agentKey,
      behavior: 'not_implemented',
      outcomeDrafts: [],
      guidedActionDrafts: [],
      notes,
      envelopePersistence: 'disabled',
      agentResponseGenerated: false,
    };
  }

  const packet = consumption.packet;
  const descriptor = getAgentDescriptor(identity.agentKey);
  const createdAt = input.createdAt ?? packet.createdAt;
  const contentScope: OrchestrationDraftContentScope =
    consumption.decision === 'degraded' ? 'limited' : 'substantive';
  const outcomeCategory =
    contentScope === 'limited'
      ? preferredCategory(descriptor.outcomeCategories, 'session_degraded')
      : preferredCategory(descriptor.outcomeCategories, 'review_required');
  const guidedActionCategory =
    contentScope === 'limited'
      ? preferredCategory(descriptor.guidedActionCategories, 'record_private_note')
      : preferredCategory(descriptor.guidedActionCategories, 'review_required');

  const outcomeDraft: OrchestrationOutcomeDraftEnvelope = {
    ...identity.scope,
    schemaVersion: 'orchestration_outcome_draft.v1',
    envelopeKind: 'outcome_draft',
    outcomeId: `outcome_draft_${identity.sessionId}_${turnId}` as McsOutcomeId,
    sessionId: identity.sessionId,
    agentKey: identity.agentKey,
    taskType: packet.session.taskType,
    language: packet.language.primary,
    contextPacketId: packet.packetId,
    status: contentScope === 'limited' ? 'not_applicable' : 'created',
    observedAt: createdAt,
    turnId,
    category: outcomeCategory,
    contentScope,
    summary:
      contentScope === 'limited'
        ? 'Limited draft outcome envelope from degraded Context Packet; no substantive guidance is available.'
        : 'Draft outcome envelope from accepted Context Packet consumption metadata.',
    draftStatus: 'draft_only',
    source: 'agent_runtime_orchestrator',
    persistence: 'disabled',
    agentResponseGenerated: false,
  };

  const guidedActionDraft: OrchestrationGuidedActionDraftEnvelope = {
    ...identity.scope,
    schemaVersion: 'orchestration_guided_action_draft.v1',
    envelopeKind: 'guided_action_draft',
    guidedActionId: `guided_action_draft_${identity.sessionId}_${turnId}` as McsGuidedActionId,
    sessionId: identity.sessionId,
    agentKey: identity.agentKey,
    taskType: packet.session.taskType,
    language: packet.language.primary,
    contextPacketId: packet.packetId,
    turnId,
    category: guidedActionCategory,
    title:
      contentScope === 'limited'
        ? 'Review limited context before action'
        : 'Review Context Packet-backed action draft',
    instruction:
      contentScope === 'limited'
        ? 'BA review required. Degraded context allows only safe fallback review, not substantive action.'
        : 'BA review required before any action. This draft does not send, call, or contact anyone.',
    contentScope,
    draftStatus: 'draft_only',
    actionOwner: 'brand_ambassador',
    requiresBaApproval: true,
    automaticSending: false,
    automaticCalling: false,
    persistence: 'disabled',
    agentResponseGenerated: false,
    createdAt,
  };

  notes.push(`Created ${contentScope} outcome/action draft envelopes from accepted Context Packet metadata.`);

  return {
    decision: consumption.decision,
    agentKey: identity.agentKey,
    behavior: 'not_implemented',
    outcomeDrafts: [outcomeDraft],
    guidedActionDrafts: [guidedActionDraft],
    notes,
    envelopePersistence: 'disabled',
    agentResponseGenerated: false,
  };
}

function preferredCategory(categories: readonly string[], preferred: string): string {
  return categories.includes(preferred) ? preferred : categories[0] ?? 'review_required';
}
