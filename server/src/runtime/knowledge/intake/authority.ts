/**
 * Knowledge authority foundation.
 *
 * Kevin-authored / Kevin-approved knowledge is the app's authoritative base.
 * Agent/system-captured material is never active guidance by default; it remains
 * candidate-only until Kevin approves it. Pure only: no persistence, no LLM, no
 * store access.
 */

import type {
  McsKnowledgeAuthorityEnvelope,
  McsRawKnowledgeSource,
} from '@momentum/shared/runtime';

export type KnowledgeAuthorityDecision =
  | 'active_authority'
  | 'candidate_only'
  | 'not_authorized';

export interface KnowledgeAuthorityResolution {
  decision: KnowledgeAuthorityDecision;
  authority: McsKnowledgeAuthorityEnvelope;
  canBecomeActiveGuidance: boolean;
  candidateOnly: boolean;
  reason:
    | 'kevin_authored'
    | 'kevin_approved'
    | 'legacy_kevin_created'
    | 'agent_or_system_capture_requires_kevin'
    | 'source_not_active'
    | 'authority_rejected_or_superseded'
    | 'missing_kevin_authority';
}

const LEGACY_KEVIN_CREATED_BY = new Set([
  'kevin',
  'kevin gardner',
  'kevin l. gardner',
  'tmag-01',
  'tm-01',
]);

export function resolveKnowledgeAuthority(source: McsRawKnowledgeSource): KnowledgeAuthorityResolution {
  if (source.status !== 'active') {
    return resolution(source, 'not_authorized', fallbackAuthority(source, 'system_captured', 'rejected'), 'source_not_active');
  }

  const explicit = source.authority;
  if (explicit) {
    if (
      (explicit.authorityKind === 'kevin_authored' || explicit.authorityKind === 'kevin_approved') &&
      explicit.authorityStatus === 'active_authority'
    ) {
      return resolution(source, 'active_authority', explicit, explicit.authorityKind);
    }

    if (
      explicit.authorityKind === 'agent_captured' ||
      explicit.authorityKind === 'system_captured' ||
      explicit.authorityKind === 'third_party_reference'
    ) {
      return resolution(
        source,
        'candidate_only',
        { ...explicit, authorityStatus: 'candidate_only' },
        'agent_or_system_capture_requires_kevin',
      );
    }

    return resolution(
      source,
      'not_authorized',
      explicit,
      'authority_rejected_or_superseded',
    );
  }

  if (LEGACY_KEVIN_CREATED_BY.has(source.createdBy.trim().toLowerCase())) {
    return resolution(
      source,
      'active_authority',
      fallbackAuthority(source, 'kevin_authored', 'active_authority'),
      'legacy_kevin_created',
    );
  }

  return resolution(
    source,
    'candidate_only',
    fallbackAuthority(source, 'system_captured', 'candidate_only'),
    'missing_kevin_authority',
  );
}

function fallbackAuthority(
  source: McsRawKnowledgeSource,
  authorityKind: McsKnowledgeAuthorityEnvelope['authorityKind'],
  authorityStatus: McsKnowledgeAuthorityEnvelope['authorityStatus'],
): McsKnowledgeAuthorityEnvelope {
  return {
    authorityKind,
    authorityStatus,
    authorityBy: source.createdBy,
    authorityAt: source.createdAt,
    authorityRef: source.sourceRef ?? String(source.sourceId),
  };
}

function resolution(
  _source: McsRawKnowledgeSource,
  decision: KnowledgeAuthorityDecision,
  authority: McsKnowledgeAuthorityEnvelope,
  reason: KnowledgeAuthorityResolution['reason'],
): KnowledgeAuthorityResolution {
  return {
    decision,
    authority,
    canBecomeActiveGuidance: decision === 'active_authority',
    candidateOnly: decision === 'candidate_only',
    reason,
  };
}
