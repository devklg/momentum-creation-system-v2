/**
 * Context Manager request service.
 *
 * This is the production-shaped Planner / Executor / Tracer slice for MCS v2:
 *  - Planner: derive an approved-knowledge query from agent, task, scope, and language.
 *  - Executor: retrieve only through the injected Knowledge Core boundary.
 *  - Tracer: return a content-free execution trace with decisions and degradation.
 *
 * The service assembles `context_packet.v1` through the Context Manager builder,
 * imports no store clients, persists nothing, calls no LLM, and gives agents no
 * direct retrieval edge.
 */

import { randomUUID } from 'node:crypto';
import type {
  McsAgentKey,
  McsApprovedKnowledgeQueryRequest,
  McsApprovedKnowledgeQueryResult,
  McsBaContext,
  McsContextPacketId,
  McsContextPacketRequest,
  McsContextPacketV1,
  McsContextManagerExecutionTraceV1,
  McsContextRequestId,
  McsKnowledgeDomain,
  McsRuntimeLanguage,
  McsRuntimeMode,
  McsRuntimeRequestScope,
  McsRuntimeTaskType,
  McsSessionContext,
  McsTeamContext,
  McsTeamId,
  McsTenantContext,
  McsTenantId,
} from '@momentum/shared/runtime';
import type { ContextManagerRequestPort } from '../orchestration/types.js';
import type { KnowledgeCoreBoundaryPort } from '../knowledge/knowledgeCore.js';
import {
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
} from '../events/index.js';
import { buildContextPacket } from './contextManager.js';
import {
  createContextManagerRetrievalAdapter,
  toContextReferences,
} from './contextManagerRetrievalAdapter.js';
import type {
  ContextManagerRetrievalAdapter,
  ContextManagerRetrievalAdapterOptions,
} from './contextManagerRetrievalAdapter.js';
import { safeFallbackFromResult } from './safeFallback.js';
import { assertValidContextManagerExecutionTraceV1 } from './contextManagerTraceContract.js';

const APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION = 'approved_knowledge_query.v1' as const;
const CONTEXT_MANAGER_COMPONENT_VERSION = 's1.5' as const;
const DEFAULT_TENANT_ID = 'tenant_team_magnificent' as McsTenantId;
const DEFAULT_TEAM_ID = 'team_magnificent' as McsTeamId;
const DEFAULT_TENANT_NAME = 'Team Magnificent Tenant';

const AGENT_PRIMARY_DOMAIN: Record<McsAgentKey, McsKnowledgeDomain> = {
  steve_success: 'success',
  michael_magnificent: 'training',
  ivory: 'relationship',
};

const TASK_DOMAIN_HINTS: Record<McsRuntimeTaskType, readonly McsKnowledgeDomain[]> = {
  success_interview: ['success', 'training', 'relationship', 'governance'],
  training_support: ['training', 'success', 'governance'],
  journal_teaching: ['training', 'success', 'governance'],
  relationship_coaching: ['relationship', 'training', 'governance'],
  invitation_drafting: ['relationship', 'governance'],
  session_resume: ['system', 'training', 'relationship', 'success'],
  guided_action_review: ['system', 'training', 'relationship', 'success'],
};

export interface ContextManagerServiceInput {
  scope: McsRuntimeRequestScope;
  request: McsContextPacketRequest;
}

export interface ContextManagerServiceOptions {
  tenant?: Partial<McsTenantContext>;
  team?: Partial<McsTeamContext>;
  ba?: Partial<McsBaContext>;
  mode?: McsRuntimeMode;
  sessionStatus?: McsSessionContext['status'];
  componentVersion?: typeof CONTEXT_MANAGER_COMPONENT_VERSION;
  maxApprovedKnowledgeResults?: number;
  allowLanguageFallback?: boolean;
  createdAt?: string;
  expiresAt?: string;
  retrieval?: ContextManagerRetrievalAdapterOptions;
}

export interface ContextManagerPlan {
  schemaVersion: 'context_manager_plan.v1';
  requestId: McsContextRequestId;
  agentKey: McsAgentKey;
  taskType: McsRuntimeTaskType;
  language: McsRuntimeLanguage;
  domains: readonly McsKnowledgeDomain[];
  approvedKnowledgeQuery: McsApprovedKnowledgeQueryRequest;
}

export type ContextManagerExecutionTrace = McsContextManagerExecutionTraceV1;

export interface ContextManagerServiceResult {
  packet: McsContextPacketV1;
  plan: ContextManagerPlan;
  retrieval: McsApprovedKnowledgeQueryResult;
  trace: ContextManagerExecutionTrace;
}

export class ContextManagerServiceError extends Error {
  constructor(
    public readonly code:
      | 'invalid_scope'
      | 'agent_task_mismatch'
      | 'unsupported_language',
    message: string,
  ) {
    super(`[context-manager] ${message}`);
    this.name = 'ContextManagerServiceError';
  }
}

export interface ContextManagerService {
  buildContext(input: ContextManagerServiceInput): Promise<ContextManagerServiceResult>;
  requestPort(): ContextManagerRequestPort;
}

export function createContextManagerService(
  knowledgeCore: Pick<KnowledgeCoreBoundaryPort, 'listApprovedKnowledge'>,
  options: ContextManagerServiceOptions = {},
): ContextManagerService {
  const retrievalAdapter = createContextManagerRetrievalAdapter(
    knowledgeCore,
    options.retrieval,
  );

  return createContextManagerServiceFromRetrieval(retrievalAdapter, options);
}

export function createContextManagerServiceFromRetrieval(
  retrievalAdapter: ContextManagerRetrievalAdapter,
  options: ContextManagerServiceOptions = {},
): ContextManagerService {
  return {
    async buildContext(input) {
      return buildContextWithRetrieval(retrievalAdapter, input, options);
    },
    requestPort() {
      return {
        assembledBy: 'context_manager',
        async requestContextPacket(scope, request) {
          const result = await buildContextWithRetrieval(
            retrievalAdapter,
            { scope, request },
            options,
          );
          return result.packet;
        },
      };
    },
  };
}

export function planContextRequest(
  input: ContextManagerServiceInput,
  options: ContextManagerServiceOptions = {},
): ContextManagerPlan {
  validateRequest(input);

  const requestId = input.request.requestId as unknown as McsContextRequestId;
  const domains = domainsFor(input.request.agentKey, input.request.taskType);
  const approvedKnowledgeQuery: McsApprovedKnowledgeQueryRequest = {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    scope: input.scope,
    objective: input.request.taskType,
    domains,
    language: input.request.language,
    allowLanguageFallback: options.allowLanguageFallback ?? true,
    ...(options.maxApprovedKnowledgeResults !== undefined
      ? { maxResults: options.maxApprovedKnowledgeResults }
      : {}),
  };

  return {
    schemaVersion: 'context_manager_plan.v1',
    requestId,
    agentKey: input.request.agentKey,
    taskType: input.request.taskType,
    language: input.request.language,
    domains,
    approvedKnowledgeQuery,
  };
}

async function buildContextWithRetrieval(
  retrievalAdapter: ContextManagerRetrievalAdapter,
  input: ContextManagerServiceInput,
  options: ContextManagerServiceOptions,
): Promise<ContextManagerServiceResult> {
  const startedAt = Date.now();
  const createdAt = options.createdAt ?? new Date().toISOString();
  const plan = planContextRequest(input, options);
  const retrieval = await retrievalAdapter.retrieveApprovedKnowledge(plan.approvedKnowledgeQuery);
  const packetId = `ctx_packet_${randomUUID()}` as McsContextPacketId;
  const safeFallback = safeFallbackFromResult(retrieval);
  const knowledgeReferences = toContextReferences(retrieval);
  const packetStatus = safeFallback?.packetStatus ?? 'complete';
  const tenant = buildTenantContext(options);
  const team = buildTeamContext(input.scope, options);
  const ba = buildBaContext(input.scope, input.request.language, options);
  const mode = options.mode ?? 'browser_text';

  const packet = buildContextPacket({
    packetId,
    requestId: plan.requestId,
    tenant,
    team,
    ba,
    session: {
      sessionId: input.request.sessionId,
      mode,
      status: options.sessionStatus ?? 'active',
      taskType: input.request.taskType,
      startedAt: createdAt,
    },
    agentKey: input.request.agentKey,
    objective: input.request.taskType,
    language: {
      primary: input.request.language,
      userPreference: input.request.language,
      translationAllowed: options.allowLanguageFallback ?? true,
      translationStatus: retrieval.metadata.language.translationStatus,
      machineTranslationUsed: retrieval.metadata.language.machineTranslationUsed,
      humanReviewed: retrieval.metadata.language.humanReviewed,
      ...(retrieval.metadata.language.fallbackLanguage
        ? { fallback: retrieval.metadata.language.fallbackLanguage }
        : {}),
    },
    knowledgeReferences,
    excludedKnowledge: retrieval.excluded.map((item) => ({
      sourceId: item.sourceId,
      reason: item.reason === 'queued_for_review' ? 'not_review_workflow' : item.reason,
    })),
    provenance: {
      assembledBy: 'context_manager',
      requestId: input.request.requestId,
      componentVersion: options.componentVersion ?? CONTEXT_MANAGER_COMPONENT_VERSION,
    },
    packetStatus,
    ...(safeFallback ? { degraded: safeFallback.degraded } : {}),
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
    createdAt,
  });

  packet.metadata = {
    ...(packet.metadata ?? {
      generatedBy: 'context_manager',
      environment: tenant.environment,
    }),
    buildDurationMs: Date.now() - startedAt,
    tokenEstimate: packet.retrievalAudit.tokenEstimate,
    notes: [
      ...(packet.metadata?.notes ?? []),
      'planner:approved_knowledge_query',
      `executor:${retrieval.status}`,
      `tracer:included=${packet.retrievalAudit.includedKnowledgeIds.length}:excluded=${packet.retrievalAudit.excludedSourceIds.length}`,
    ],
  };

  const trace = buildTrace({ packet, plan, retrieval });
  assertValidContextManagerExecutionTraceV1(trace, { packet, retrieval });
  return { packet, plan, retrieval, trace };
}

function validateRequest(input: ContextManagerServiceInput): void {
  if (input.request.language !== 'en' && input.request.language !== 'es') {
    throw new ContextManagerServiceError(
      'unsupported_language',
      `Unsupported runtime language ${String(input.request.language)}.`,
    );
  }

  if (!isTaskAllowedForAgent(input.request.agentKey, input.request.taskType)) {
    throw new ContextManagerServiceError(
      'agent_task_mismatch',
      `Task ${input.request.taskType} is not allowed for ${input.request.agentKey}.`,
    );
  }

  if (
    input.scope.teamKey !== TEAM_MAGNIFICENT_KEY ||
    input.scope.teamName !== TEAM_MAGNIFICENT_NAME ||
    typeof input.scope.teamId !== 'string' ||
    typeof input.scope.tmagId !== 'string'
  ) {
    throw new ContextManagerServiceError(
      'invalid_scope',
      'Context Manager requires Team Magnificent BA-scoped runtime scope.',
    );
  }
}

function domainsFor(
  agentKey: McsAgentKey,
  taskType: McsRuntimeTaskType,
): readonly McsKnowledgeDomain[] {
  const ordered = [AGENT_PRIMARY_DOMAIN[agentKey], ...TASK_DOMAIN_HINTS[taskType]];
  return [...new Set(ordered)];
}

function isTaskAllowedForAgent(agentKey: McsAgentKey, taskType: McsRuntimeTaskType): boolean {
  switch (agentKey) {
    case 'steve_success':
      return taskType === 'success_interview' ||
        taskType === 'session_resume' ||
        taskType === 'guided_action_review';
    case 'michael_magnificent':
      return taskType === 'training_support' ||
        taskType === 'journal_teaching' ||
        taskType === 'session_resume' ||
        taskType === 'guided_action_review';
    case 'ivory':
      return taskType === 'relationship_coaching' ||
        taskType === 'invitation_drafting' ||
        taskType === 'session_resume' ||
        taskType === 'guided_action_review';
  }
}

function buildTenantContext(options: ContextManagerServiceOptions): McsTenantContext {
  return {
    tenantId: (options.tenant?.tenantId ?? DEFAULT_TENANT_ID) as McsTenantId,
    tenantName: options.tenant?.tenantName ?? DEFAULT_TENANT_NAME,
    brandName: options.tenant?.brandName ?? TEAM_MAGNIFICENT_NAME,
    environment: options.tenant?.environment ?? resolveEnvironment(),
  };
}

function buildTeamContext(
  scope: McsRuntimeRequestScope,
  options: ContextManagerServiceOptions,
): McsTeamContext {
  return {
    teamId: (options.team?.teamId ?? scope.teamId ?? DEFAULT_TEAM_ID) as McsTeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
  };
}

function buildBaContext(
  scope: McsRuntimeRequestScope,
  language: McsRuntimeLanguage,
  options: ContextManagerServiceOptions,
): McsBaContext {
  const mode = options.mode ?? 'browser_text';
  return {
    tenantId: (options.ba?.tenantId ?? scope.tenantId) as McsTenantId,
    teamId: (options.ba?.teamId ?? scope.teamId ?? DEFAULT_TEAM_ID) as McsTeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: options.ba?.tmagId ?? (scope.tmagId as McsBaContext['tmagId']),
    ...(options.ba?.displayName ? { displayName: options.ba.displayName } : {}),
    ...(options.ba?.preferredName ? { preferredName: options.ba.preferredName } : {}),
    ...(options.ba?.timezone ? { timezone: options.ba.timezone } : {}),
    ...(options.ba?.onboardingState ? { onboardingState: options.ba.onboardingState } : {}),
    journalEnabled: options.ba?.journalEnabled ?? false,
    languagePreference: options.ba?.languagePreference ?? language,
    permissions: {
      canUsePrivateJournal: options.ba?.permissions?.canUsePrivateJournal ?? false,
      canSelectJournalForReview: options.ba?.permissions?.canSelectJournalForReview ?? false,
      canCreateKnowledgeCandidate: options.ba?.permissions?.canCreateKnowledgeCandidate ?? false,
      canAccessRelationshipContext: options.ba?.permissions?.canAccessRelationshipContext ?? false,
      canUseBrowserVoice: options.ba?.permissions?.canUseBrowserVoice ?? mode !== 'browser_text',
      canUseBrowserText: options.ba?.permissions?.canUseBrowserText ?? true,
    },
    ...(options.ba?.profileSummary ? { profileSummary: options.ba.profileSummary } : {}),
    ...(options.ba?.successProfileAvailable !== undefined
      ? { successProfileAvailable: options.ba.successProfileAvailable }
      : {}),
    ...(options.ba?.trainingProfileAvailable !== undefined
      ? { trainingProfileAvailable: options.ba.trainingProfileAvailable }
      : {}),
    ...(options.ba?.relationshipProfileAvailable !== undefined
      ? { relationshipProfileAvailable: options.ba.relationshipProfileAvailable }
      : {}),
  };
}

function buildTrace(input: {
  packet: McsContextPacketV1;
  plan: ContextManagerPlan;
  retrieval: McsApprovedKnowledgeQueryResult;
}): ContextManagerExecutionTrace {
  const { packet, plan, retrieval } = input;
  return {
    schemaVersion: 'context_manager_trace.v1',
    requestId: plan.requestId,
    packetId: packet.packetId,
    agentKey: plan.agentKey,
    taskType: plan.taskType,
    planner: {
      domains: plan.domains,
      language: plan.language,
      allowLanguageFallback: plan.approvedKnowledgeQuery.allowLanguageFallback ?? false,
      ...(plan.approvedKnowledgeQuery.maxResults !== undefined
        ? { maxResults: plan.approvedKnowledgeQuery.maxResults }
        : {}),
    },
    executor: {
      retrievalStatus: retrieval.status,
      approvedCount: retrieval.metadata.approvedCount,
      candidateExcludedCount: retrieval.metadata.candidateExcludedCount,
      degradeReasons: retrieval.metadata.degradeReasons ?? [],
    },
    tracer: {
      packetStatus: packet.packetStatus,
      includedKnowledgeIds: packet.retrievalAudit.includedKnowledgeIds.map(String),
      excludedSourceIds: packet.retrievalAudit.excludedSourceIds.map(String),
      notes: packet.metadata?.notes ?? [],
    },
  };
}

function resolveEnvironment(): McsTenantContext['environment'] {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}
