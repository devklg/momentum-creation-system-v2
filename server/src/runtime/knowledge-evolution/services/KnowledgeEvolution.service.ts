/**
 * Knowledge Evolution Service (spec §26.1) — the Lane B orchestrator.
 *
 * Composes the policies and sub-services into the ratified `KnowledgeEvolutionService` contract:
 * validate → create record → create plan → execute (version/supersede/archive coordination) →
 * mark retrieval ready → rollback. It enforces the runtime's core rules:
 *
 *   - reject evolution without an approval reference (spec §12.1)
 *   - reject non-Team-Magnificent BA-derived knowledge (spec §5)
 *   - reject missing language metadata / unreviewed machine translation (spec §22)
 *   - reject unapproved candidates and missing sources (spec §15.3)
 *   - create an evolution plan BEFORE modifying Knowledge Core state (spec §13)
 *   - create version records for material changes (spec §16)
 *   - preserve source/candidate/outcome/signal/event lineage (spec §11, §23)
 *   - keep retrieval BLOCKED until every readiness check passes (spec §21)
 *
 * Pure business logic: it depends only on repository/service ports, never on routes, workers,
 * Chroma, Neo4j, Telnyx, or external communication.
 */

import type {
  KnowledgeEvolutionAction,
  KnowledgeEvolutionChangeType,
  KnowledgeEvolutionCoordinationStatus,
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionRetrievalStatus,
  KnowledgeEvolutionService,
  KnowledgeEvolutionStartResult,
  KnowledgeRetrievalRollout,
  MarkRetrievalReadyInput,
  RollbackKnowledgeEvolutionRequest,
  StartKnowledgeEvolutionRequest,
} from '@momentum/shared/runtime';
import {
  KNOWLEDGE_EVOLUTION_TEAM_KEY,
  KNOWLEDGE_EVOLUTION_TEAM_NAME,
} from '@momentum/shared/runtime';
import { KnowledgeEvolutionRuntimeError, policyFail, policyOk, type PolicyResult } from '../errors.js';
import type { EvolutionRuntimeDeps } from '../deps.js';
import { evaluateTeamScope } from '../policies/EvolutionTeamScopePolicy.js';
import { evaluatePrivacy } from '../policies/EvolutionPrivacyPolicy.js';
import { evaluateBilingual } from '../policies/EvolutionBilingualPolicy.js';
import { hasApprovalReference } from '../policies/EvolutionApprovalPolicy.js';
import type { RetrievalReadinessInput } from '../policies/EvolutionRetrievalReadinessPolicy.js';
import type { EvolutionApprovalService } from './EvolutionApproval.service.js';
import type { EvolutionPlanService } from './EvolutionPlan.service.js';
import type { EvolutionVersionService } from './EvolutionVersion.service.js';
import type { SupersessionService } from './Supersession.service.js';
import type { ArchiveService } from './Archive.service.js';
import type { RetrievalRolloutService } from './RetrievalRollout.service.js';
import type { EvolutionRollbackService } from './EvolutionRollback.service.js';
import type { EvolutionErrorRepository, EvolutionRecordRepository } from './ports.js';

/** Actions that operate on an EXISTING knowledge object and therefore require a source. */
const REQUIRES_EXISTING_SOURCE: readonly KnowledgeEvolutionAction[] = [
  'update_existing_knowledge',
  'supersede_existing_knowledge',
  'archive_existing_knowledge',
  'restore_prior_version',
  'reindex_only',
  'graph_sync_only',
];

const ACTION_CHANGE_TYPE: Partial<Record<KnowledgeEvolutionAction, KnowledgeEvolutionChangeType>> = {
  create_new_knowledge: 'created',
  update_existing_knowledge: 'updated',
  create_language_variant: 'translated',
  supersede_existing_knowledge: 'superseded',
  archive_existing_knowledge: 'archived',
  restore_prior_version: 'restored',
};

export interface KnowledgeEvolutionServiceDeps {
  recordRepository: EvolutionRecordRepository;
  errorRepository: EvolutionErrorRepository;
  approvalService: EvolutionApprovalService;
  planService: EvolutionPlanService;
  versionService: EvolutionVersionService;
  supersessionService: SupersessionService;
  archiveService: ArchiveService;
  rolloutService: RetrievalRolloutService;
  rollbackService: EvolutionRollbackService;
  runtime: EvolutionRuntimeDeps;
}

interface TranslationMetadata {
  status?: import('@momentum/shared/runtime').KnowledgeLanguageTranslationStatus;
  machineTranslated?: boolean;
}

function readTranslationMetadata(
  metadata: Record<string, unknown> | undefined,
): TranslationMetadata | undefined {
  const raw = metadata?.['translation'];
  if (raw && typeof raw === 'object') {
    return raw as TranslationMetadata;
  }
  return undefined;
}

function readPrivatePromotion(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.['privatePromotionApproved'] === true;
}

export function createKnowledgeEvolutionService(
  deps: KnowledgeEvolutionServiceDeps,
): KnowledgeEvolutionService {
  const { runtime } = deps;

  function normalizeSources(request: StartKnowledgeEvolutionRequest) {
    return {
      sourceKnowledgeObjectIds: request.sourceKnowledgeObjectIds ?? [],
      sourceCandidateIds: request.sourceCandidateIds ?? [],
      sourceOutcomeIds: request.sourceOutcomeIds ?? [],
      sourceLearningSignalIds: request.sourceLearningSignalIds ?? [],
      sourceEventIds: request.sourceEventIds ?? [],
    };
  }

  function validateSources(request: StartKnowledgeEvolutionRequest): PolicyResult {
    if (!REQUIRES_EXISTING_SOURCE.includes(request.evolutionAction)) {
      return policyOk;
    }
    const hasTarget =
      typeof request.targetKnowledgeObjectId === 'string' &&
      request.targetKnowledgeObjectId.trim().length > 0;
    const hasSourceKnowledge = (request.sourceKnowledgeObjectIds ?? []).length > 0;
    if (hasTarget || hasSourceKnowledge) {
      return policyOk;
    }
    return policyFail({
      errorType: 'source_missing',
      reason: `Action ${request.evolutionAction} operates on existing knowledge but names no target or source knowledge object.`,
      safeMessage: 'Knowledge evolution rejected: a source knowledge object is required for this action.',
    });
  }

  function validateRequest(request: StartKnowledgeEvolutionRequest): PolicyResult {
    const scope = evaluateTeamScope({
      teamId: request.teamId,
      teamKey: request.teamKey,
      teamName: request.teamName,
      ...(request.baId ? { baId: request.baId } : {}),
    });
    if (!scope.ok) return scope;

    const approval = deps.approvalService.validate({
      approvalReference: request.approvalReference,
      inputType: request.inputType,
      sourceCandidateIds: request.sourceCandidateIds ?? [],
    });
    if (!approval.ok) return approval;

    const sources = validateSources(request);
    if (!sources.ok) return sources;

    const privacy = evaluatePrivacy({
      domain: request.domain,
      evolutionAction: request.evolutionAction,
      approvalReference: request.approvalReference,
      privatePromotionApproved: readPrivatePromotion(request.metadata),
    });
    if (!privacy.ok) return privacy;

    const bilingual = evaluateBilingual({
      language: request.language,
      evolutionAction: request.evolutionAction,
      inputType: request.inputType,
      ...(readTranslationMetadata(request.metadata)
        ? { translation: readTranslationMetadata(request.metadata) }
        : {}),
    });
    if (!bilingual.ok) return bilingual;

    return policyOk;
  }

  async function persistViolation(
    violation: Extract<PolicyResult, { ok: false }>,
    request: StartKnowledgeEvolutionRequest,
  ): Promise<void> {
    await deps.errorRepository.insert({
      errorId: runtime.ids.newId('keverr'),
      errorType: violation.errorType,
      tenantId: request.tenantId,
      teamId: request.teamId,
      message: violation.reason,
      safeMessage: violation.safeMessage,
      retryable: violation.retryable ?? false,
      occurredAt: runtime.clock.now(),
      metadata: { inputType: request.inputType, inputId: request.inputId },
    });
  }

  function buildRecord(
    request: StartKnowledgeEvolutionRequest,
  ): KnowledgeEvolutionRecord {
    const now = runtime.clock.now();
    const sources = normalizeSources(request);
    return {
      evolutionId: runtime.ids.newId('kev'),
      tenantId: request.tenantId,
      teamId: request.teamId,
      teamKey: KNOWLEDGE_EVOLUTION_TEAM_KEY,
      teamName: KNOWLEDGE_EVOLUTION_TEAM_NAME,
      ...(request.baId ? { baId: request.baId } : {}),
      inputType: request.inputType,
      inputId: request.inputId,
      status: 'received',
      domain: request.domain,
      language: request.language,
      ...(request.targetKnowledgeObjectId
        ? { targetKnowledgeObjectId: request.targetKnowledgeObjectId }
        : {}),
      sourceKnowledgeObjectIds: [...sources.sourceKnowledgeObjectIds],
      sourceCandidateIds: [...sources.sourceCandidateIds],
      sourceOutcomeIds: [...sources.sourceOutcomeIds],
      sourceLearningSignalIds: [...sources.sourceLearningSignalIds],
      sourceEventIds: [...sources.sourceEventIds],
      evolutionAction: request.evolutionAction,
      approvalReference: request.approvalReference,
      indexingStatus: 'not_required',
      graphStatus: 'not_required',
      retrievalStatus: 'not_ready',
      createdAt: now,
      updatedAt: now,
      ...(request.metadata ? { metadata: request.metadata } : {}),
    };
  }

  async function startEvolution(
    request: StartKnowledgeEvolutionRequest,
  ): Promise<KnowledgeEvolutionStartResult> {
    const validation = validateRequest(request);
    if (!validation.ok) {
      await persistViolation(validation, request);
      throw new KnowledgeEvolutionRuntimeError(validation);
    }
    const canonicalApproval = await deps.approvalService.verifyCanonical({
      approvalReference: request.approvalReference,
      inputType: request.inputType,
      sourceCandidateIds: request.sourceCandidateIds ?? [],
    });
    if (!canonicalApproval.ok) {
      await persistViolation(canonicalApproval, request);
      throw new KnowledgeEvolutionRuntimeError(canonicalApproval);
    }

    const record = await deps.recordRepository.insert(buildRecord(request));

    // Plan is created BEFORE any Knowledge Core state changes (spec §13).
    const plan = await deps.planService.createPlan({
      evolutionId: record.evolutionId,
      tenantId: record.tenantId,
      teamId: record.teamId,
      teamKey: record.teamKey,
      teamName: record.teamName,
      evolutionAction: record.evolutionAction,
      language: record.language,
      ...(record.targetKnowledgeObjectId
        ? { targetKnowledgeObjectId: record.targetKnowledgeObjectId }
        : {}),
      sourceKnowledgeObjectIds: [...record.sourceKnowledgeObjectIds],
      sourceCandidateIds: [...record.sourceCandidateIds],
    });

    const indexingStatus: KnowledgeEvolutionCoordinationStatus = plan.requiresReindex
      ? 'pending'
      : 'not_required';
    const graphStatus: KnowledgeEvolutionCoordinationStatus = plan.requiresGraphSync
      ? 'pending'
      : 'not_required';
    const retrievalStatus: KnowledgeEvolutionRetrievalStatus = plan.affectsRetrieval
      ? 'blocked'
      : 'not_ready';

    const evolution = await deps.recordRepository.patch(record.evolutionId, {
      status: 'planning',
      indexingStatus,
      graphStatus,
      retrievalStatus,
      updatedAt: runtime.clock.now(),
      metadata: { ...(record.metadata ?? {}), planId: plan.planId },
    });

    return { evolution, plan };
  }

  async function executeEvolutionPlan(planId: string): Promise<KnowledgeEvolutionRecord> {
    const plan = await deps.planService.getByPlanId(planId);
    if (!plan) {
      throw new KnowledgeEvolutionRuntimeError({
        errorType: 'knowledge_core_write_failed',
        reason: `No plan for planId=${planId}.`,
        safeMessage: 'Knowledge evolution failed: plan not found.',
      });
    }
    const record = await deps.recordRepository.findByEvolutionId(plan.evolutionId);
    if (!record) {
      throw new KnowledgeEvolutionRuntimeError({
        errorType: 'knowledge_core_write_failed',
        reason: `No evolution record for evolutionId=${plan.evolutionId}.`,
        safeMessage: 'Knowledge evolution failed: evolution not found.',
      });
    }

    const stepKeys = plan.requiredSteps.map((step) => step.stepKey);
    const knowledgeObjectId =
      record.targetKnowledgeObjectId ?? runtime.ids.newId('kobj');
    const approvedBy = record.approvalReference.approvedBy;

    const patch: Partial<KnowledgeEvolutionRecord> = {
      status: 'versioning',
      targetKnowledgeObjectId: knowledgeObjectId,
    };

    if (stepKeys.includes('create_version')) {
      const changeType = ACTION_CHANGE_TYPE[record.evolutionAction] ?? 'updated';
      const version = await deps.versionService.createVersion({
        knowledgeObjectId,
        evolutionId: record.evolutionId,
        changeType,
        snapshotAfter: {
          domain: record.domain,
          language: record.language,
          evolutionAction: record.evolutionAction,
        },
        reason: `evolution ${record.evolutionAction}`,
        approvedBy,
      });
      patch.versionCreated = version.version;
    }

    if (plan.action === 'supersede') {
      const oldKnowledgeObjectId = record.sourceKnowledgeObjectIds[0];
      if (oldKnowledgeObjectId) {
        await deps.supersessionService.recordSupersession({
          tenantId: record.tenantId,
          teamId: record.teamId,
          oldKnowledgeObjectId,
          newKnowledgeObjectId: knowledgeObjectId,
          reason: `supersession via evolution ${record.evolutionId}`,
          approvalReference: record.approvalReference,
          supersededBy: approvedBy,
        });
      }
    }

    if (plan.action === 'archive') {
      await deps.archiveService.archive({
        knowledgeObjectId,
        evolutionId: record.evolutionId,
        reason: `archival via evolution ${record.evolutionId}`,
        approvedBy,
      });
    }

    patch.indexingStatus = plan.requiresReindex ? 'pending' : 'not_required';
    patch.graphStatus = plan.requiresGraphSync ? 'pending' : 'not_required';
    patch.status = 'writing_to_knowledge_core';
    patch.retrievalStatus = plan.affectsRetrieval ? 'blocked' : record.retrievalStatus;
    patch.updatedAt = runtime.clock.now();

    return deps.recordRepository.patch(record.evolutionId, patch);
  }

  function buildReadinessInput(record: KnowledgeEvolutionRecord): RetrievalReadinessInput {
    const scopeValid = evaluateTeamScope({
      teamId: record.teamId,
      teamKey: record.teamKey,
      teamName: record.teamName,
      ...(record.baId ? { baId: record.baId } : {}),
    }).ok;
    const lineagePresent =
      record.sourceKnowledgeObjectIds.length > 0 ||
      record.sourceCandidateIds.length > 0 ||
      record.sourceOutcomeIds.length > 0 ||
      record.sourceLearningSignalIds.length > 0 ||
      record.sourceEventIds.length > 0;

    return {
      knowledgeObjectExists:
        typeof record.targetKnowledgeObjectId === 'string' &&
        record.targetKnowledgeObjectId.length > 0,
      lifecycleActive: record.status !== 'failed' && record.status !== 'rolled_back',
      governancePermitsUse: hasApprovalReference(record.approvalReference),
      approvalReferencePresent: hasApprovalReference(record.approvalReference),
      versionRecordExists: record.versionCreated !== undefined,
      sourceTraceabilityExists: lineagePresent,
      indexingStatus: record.indexingStatus,
      graphStatus: record.graphStatus,
      languageMetadataPresent: record.language === 'en' || record.language === 'es',
      permissionScopePresent: scopeValid,
      teamScopeValid: scopeValid,
    };
  }

  async function markRetrievalReady(
    input: MarkRetrievalReadyInput,
  ): Promise<KnowledgeRetrievalRollout> {
    const record = await deps.recordRepository.findByEvolutionId(input.evolutionId);
    if (!record) {
      throw new KnowledgeEvolutionRuntimeError({
        errorType: 'retrieval_rollout_failed',
        reason: `No evolution record for evolutionId=${input.evolutionId}.`,
        safeMessage: 'Knowledge evolution failed: evolution not found.',
      });
    }

    const rollout = await deps.rolloutService.markRetrievalReady(input, {
      domain: record.domain,
      language: record.language,
      readiness: buildReadinessInput(record),
    });

    if (rollout.retrievalReady) {
      await deps.recordRepository.patch(input.evolutionId, {
        status: 'retrieval_ready',
        retrievalStatus: 'ready',
        updatedAt: runtime.clock.now(),
      });
    } else {
      await deps.recordRepository.patch(input.evolutionId, {
        retrievalStatus: 'blocked',
        updatedAt: runtime.clock.now(),
      });
    }

    return rollout;
  }

  return {
    startEvolution,

    async createEvolutionPlan(request) {
      const validation = validateRequest(request);
      if (!validation.ok) {
        await persistViolation(validation, request);
        throw new KnowledgeEvolutionRuntimeError(validation);
      }
      const canonicalApproval = await deps.approvalService.verifyCanonical({
        approvalReference: request.approvalReference,
        inputType: request.inputType,
        sourceCandidateIds: request.sourceCandidateIds ?? [],
      });
      if (!canonicalApproval.ok) {
        await persistViolation(canonicalApproval, request);
        throw new KnowledgeEvolutionRuntimeError(canonicalApproval);
      }
      return deps.planService.createPlan({
        evolutionId: runtime.ids.newId('kev'),
        tenantId: request.tenantId,
        teamId: request.teamId,
        teamKey: KNOWLEDGE_EVOLUTION_TEAM_KEY,
        teamName: KNOWLEDGE_EVOLUTION_TEAM_NAME,
        evolutionAction: request.evolutionAction,
        language: request.language,
        ...(request.targetKnowledgeObjectId
          ? { targetKnowledgeObjectId: request.targetKnowledgeObjectId }
          : {}),
        sourceKnowledgeObjectIds: request.sourceKnowledgeObjectIds ?? [],
        sourceCandidateIds: request.sourceCandidateIds ?? [],
      });
    },

    executeEvolutionPlan,

    markRetrievalReady,

    rollbackEvolution(input: RollbackKnowledgeEvolutionRequest) {
      return deps.rollbackService.rollback(input);
    },

    getEvolutionById(evolutionId: string) {
      return deps.recordRepository.findByEvolutionId(evolutionId);
    },
  };
}
