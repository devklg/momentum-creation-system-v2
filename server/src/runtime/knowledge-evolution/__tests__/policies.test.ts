/**
 * Unit tests for every Lane B policy (spec §§5, 12, 14, 21, 22, 29).
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateApproval,
  evaluateBilingual,
  evaluatePrivacy,
  evaluateRetrievalReadiness,
  assertRetrievalReadiness,
  evaluateRollbackRequirement,
  validateRollbackPlanShape,
  evaluateTeamScope,
} from '../policies/index.js';
import { makeApprovalReference } from './fakes.js';
import type { KnowledgeRollbackPlan } from '@momentum/shared/runtime';
import type { RetrievalReadinessInput as ReadinessInput } from '../policies/EvolutionRetrievalReadinessPolicy.js';

describe('EvolutionTeamScopePolicy (§5)', () => {
  it('accepts Team Magnificent scope', () => {
    const result = evaluateTeamScope({
      teamId: 'team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects foreign team scope with invalid_team_scope', () => {
    const result = evaluateTeamScope({
      teamId: 'team_other',
      teamKey: 'team_other',
      teamName: 'Other Team',
    });
    expect(result).toMatchObject({ ok: false, errorType: 'invalid_team_scope' });
  });

  it('rejects BA-derived knowledge that is not Team Magnificent scoped with invalid_ba_scope', () => {
    const result = evaluateTeamScope({
      teamId: '',
      teamKey: 'team_other',
      teamName: 'Other',
      baId: 'TMBA-20260101-000001',
    });
    expect(result).toMatchObject({ ok: false, errorType: 'invalid_ba_scope' });
  });

  it('rejects empty teamId', () => {
    const result = evaluateTeamScope({
      teamId: '   ',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
    });
    expect(result.ok).toBe(false);
  });
});

describe('EvolutionApprovalPolicy (§12, §15)', () => {
  it('accepts a valid approval reference with a source candidate', () => {
    const result = evaluateApproval({
      approvalReference: makeApprovalReference(),
      inputType: 'approved_candidate',
      sourceCandidateIds: ['cand_1'],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a missing approval reference with approval_missing', () => {
    const result = evaluateApproval({
      approvalReference: null,
      inputType: 'approved_governance_decision',
      sourceCandidateIds: [],
    });
    expect(result).toMatchObject({ ok: false, errorType: 'approval_missing' });
  });

  it('rejects a malformed approval reference (missing approvedBy)', () => {
    const result = evaluateApproval({
      approvalReference: makeApprovalReference({ approvedBy: '' }),
      inputType: 'approved_governance_decision',
      sourceCandidateIds: [],
    });
    expect(result).toMatchObject({ ok: false, errorType: 'approval_missing' });
  });

  it('rejects a candidate input without a source candidate id with candidate_not_approved', () => {
    const result = evaluateApproval({
      approvalReference: makeApprovalReference(),
      inputType: 'approved_candidate',
      sourceCandidateIds: [],
    });
    expect(result).toMatchObject({ ok: false, errorType: 'candidate_not_approved' });
  });
});

describe('EvolutionPrivacyPolicy (§5.4, §29.2)', () => {
  it('accepts non-personal domains without promotion', () => {
    const result = evaluatePrivacy({
      domain: 'training',
      evolutionAction: 'create_new_knowledge',
      approvalReference: makeApprovalReference(),
    });
    expect(result.ok).toBe(true);
  });

  it('rejects activating personal-domain knowledge without approved promotion', () => {
    const result = evaluatePrivacy({
      domain: 'personal',
      evolutionAction: 'create_new_knowledge',
      approvalReference: makeApprovalReference(),
    });
    expect(result).toMatchObject({ ok: false, errorType: 'permission_denied' });
  });

  it('accepts personal-domain activation when explicitly promoted and reviewed', () => {
    const result = evaluatePrivacy({
      domain: 'personal',
      evolutionAction: 'create_new_knowledge',
      approvalReference: makeApprovalReference({ sourceReviewRecordId: 'review_1' }),
      privatePromotionApproved: true,
    });
    expect(result.ok).toBe(true);
  });

  it('allows archival of personal-domain knowledge (removes from retrieval)', () => {
    const result = evaluatePrivacy({
      domain: 'personal',
      evolutionAction: 'archive_existing_knowledge',
      approvalReference: makeApprovalReference(),
    });
    expect(result.ok).toBe(true);
  });
});

describe('EvolutionBilingualPolicy (§22, §29.4)', () => {
  it('accepts a supported language for a non-translation action', () => {
    const result = evaluateBilingual({
      language: 'es',
      evolutionAction: 'create_new_knowledge',
      inputType: 'approved_candidate',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects missing/unsupported language with invalid_language', () => {
    const result = evaluateBilingual({
      language: 'fr',
      evolutionAction: 'create_new_knowledge',
      inputType: 'approved_candidate',
    });
    expect(result).toMatchObject({ ok: false, errorType: 'invalid_language' });
  });

  it('rejects unreviewed machine translation activation', () => {
    const result = evaluateBilingual({
      language: 'es',
      evolutionAction: 'create_language_variant',
      inputType: 'approved_translation',
      translation: { status: 'rejected', machineTranslated: true },
    });
    expect(result).toMatchObject({ ok: false, errorType: 'invalid_language' });
  });

  it('rejects a translation evolution missing review metadata', () => {
    const result = evaluateBilingual({
      language: 'es',
      evolutionAction: 'create_language_variant',
      inputType: 'approved_translation',
    });
    expect(result).toMatchObject({ ok: false, errorType: 'invalid_language' });
  });

  it('accepts a human-reviewed translation variant', () => {
    const result = evaluateBilingual({
      language: 'es',
      evolutionAction: 'create_language_variant',
      inputType: 'approved_translation',
      translation: { status: 'human_reviewed', machineTranslated: true },
    });
    expect(result.ok).toBe(true);
  });
});

describe('EvolutionRetrievalReadinessPolicy (§21)', () => {
  const readyInput: ReadinessInput = {
    knowledgeObjectExists: true,
    lifecycleActive: true,
    governancePermitsUse: true,
    approvalReferencePresent: true,
    versionRecordExists: true,
    sourceTraceabilityExists: true,
    indexingStatus: 'completed',
    graphStatus: 'completed',
    languageMetadataPresent: true,
    permissionScopePresent: true,
    teamScopeValid: true,
  };

  it('is ready only when every check passes', () => {
    const decision = evaluateRetrievalReadiness(readyInput);
    expect(decision.ready).toBe(true);
    expect(decision.blockedReasons).toEqual([]);
  });

  it('blocks while indexing is pending', () => {
    const decision = evaluateRetrievalReadiness({ ...readyInput, indexingStatus: 'pending' });
    expect(decision.ready).toBe(false);
    expect(decision.blockedReasons).toContain('chroma_indexing_pending');
  });

  it('treats not_required coordination as satisfied', () => {
    const decision = evaluateRetrievalReadiness({
      ...readyInput,
      indexingStatus: 'not_required',
      graphStatus: 'not_required',
    });
    expect(decision.ready).toBe(true);
  });

  it('accumulates every blocking reason (fail-closed, evaluate-all)', () => {
    const decision = evaluateRetrievalReadiness({
      ...readyInput,
      approvalReferencePresent: false,
      versionRecordExists: false,
      graphStatus: 'failed',
      teamScopeValid: false,
    });
    expect(decision.ready).toBe(false);
    expect(decision.blockedReasons).toEqual(
      expect.arrayContaining([
        'approval_reference_missing',
        'version_record_missing',
        'neo4j_graph_sync_failed',
        'team_scope_invalid',
      ]),
    );
  });

  it('assertRetrievalReadiness fails with retrieval_rollout_failed when not ready', () => {
    const result = assertRetrievalReadiness({ ...readyInput, lifecycleActive: false });
    expect(result).toMatchObject({ ok: false, errorType: 'retrieval_rollout_failed' });
  });
});

describe('EvolutionRollbackPolicy (§14)', () => {
  const validPlan: KnowledgeRollbackPlan = {
    rollbackPlanId: 'kevrbk_1',
    evolutionId: 'kev_1',
    rollbackType: 'mark_not_retrieval_ready',
    previousKnowledgeObjectIds: [],
    previousVersionNumbers: [],
    createdAt: new Date('2026-07-10T12:00:00.000Z'),
  };

  it('does not require a rollback plan when retrieval is unaffected', () => {
    const result = evaluateRollbackRequirement({ affectsRetrieval: false });
    expect(result.ok).toBe(true);
  });

  it('requires a rollback plan for retrieval-affecting evolution', () => {
    const result = evaluateRollbackRequirement({ affectsRetrieval: true });
    expect(result).toMatchObject({ ok: false, errorType: 'rollback_failed' });
  });

  it('accepts a valid rollback plan for retrieval-affecting evolution', () => {
    const result = evaluateRollbackRequirement({
      affectsRetrieval: true,
      rollbackPlan: validPlan,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a restore rollback that names no prior version lineage', () => {
    const result = validateRollbackPlanShape({
      ...validPlan,
      rollbackType: 'restore_previous_version',
    });
    expect(result).toMatchObject({ ok: false, errorType: 'rollback_failed' });
  });

  it('accepts a restore rollback that names prior versions', () => {
    const result = validateRollbackPlanShape({
      ...validPlan,
      rollbackType: 'restore_previous_version',
      previousVersionNumbers: [2],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown rollback type', () => {
    const result = validateRollbackPlanShape({
      ...validPlan,
      rollbackType: 'delete_everything' as KnowledgeRollbackPlan['rollbackType'],
    });
    expect(result).toMatchObject({ ok: false, errorType: 'rollback_failed' });
  });
});
