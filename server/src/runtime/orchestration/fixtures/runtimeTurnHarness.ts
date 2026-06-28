import type {
  AgentId,
  AgentKey,
  BaId,
  ContextPacketRequest,
  ContextRequestId,
  CorrelationId,
  KnowledgeId,
  RequestId,
  RuntimeRequestScope,
  RuntimeTaskType,
  RuntimeTurnId,
  SessionId,
  SourceId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import {
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
} from '../../events/index.js';
import { coordinateRuntimeTurn } from '../turnCoordinator.js';
import type {
  AgentRuntimeAdapterDispatchIdentity,
  ContextManagerRequestPort,
  RuntimeTurnCoordinatorInput,
  RuntimeTurnFixtureHarness,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioMetadata,
  RuntimeTurnFixtureScenarioOptions,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

type FixtureContextMode = 'complete' | 'degraded' | 'failed' | 'candidate_included';

const DEFAULT_CREATED_AT = '2026-06-28T12:00:02.000Z';
const DEFAULT_SESSION_ID = 'session_s2_8_fixture_001' as SessionId;
const DEFAULT_TURN_ID = 'turn_s2_8_fixture_001' as RuntimeTurnId;
const DEFAULT_CORRELATION_ID = 'corr_s2_8_fixture_001' as CorrelationId;

const AGENT_IDS: Record<AgentKey, AgentId> = {
  steve_success: 'agent_instance_steve_default' as AgentId,
  michael_magnificent: 'agent_instance_michael_default' as AgentId,
  ivory: 'agent_instance_ivory_default' as AgentId,
};

const AGENT_DISPLAY_NAMES: Record<AgentKey, string> = {
  steve_success: 'Steve Success',
  michael_magnificent: 'Michael Magnificent',
  ivory: 'Ivory',
};

const AGENT_DOMAINS: Record<AgentKey, string> = {
  steve_success: 'success',
  michael_magnificent: 'training',
  ivory: 'relationship',
};

const AGENT_RUNTIME_MODES: Record<AgentKey, string> = {
  steve_success: 'interview_specialist',
  michael_magnificent: 'training_specialist',
  ivory: 'relationship_specialist',
};

export function createRuntimeTurnFixtureHarness(): RuntimeTurnFixtureHarness {
  return {
    runScenario(options) {
      return runRuntimeTurnFixtureScenario(options);
    },
  };
}

export async function runRuntimeTurnFixtureScenario(
  options: RuntimeTurnFixtureScenarioOptions,
): Promise<RuntimeTurnFixtureHarnessResult> {
  const scenario = options.scenario;
  const contextMode = contextModeForScenario(scenario);
  const fixture = contextMode ? createFixtureContextManager(contextMode) : undefined;
  const input = coordinatorInputForScenario(options, fixture?.port);
  const result = await coordinateRuntimeTurn(input);

  return {
    scenario,
    metadata: metadataForScenario(scenario, fixture !== undefined),
    input,
    result,
    contextCalls: fixture?.calls ?? [],
    eventPersistence: 'disabled',
    outcomePersistence: 'disabled',
    guidedActionPersistence: 'disabled',
    envelopePersistence: 'disabled',
    behavior: 'not_implemented',
    agentResponseGenerated: false,
  };
}

function coordinatorInputForScenario(
  options: RuntimeTurnFixtureScenarioOptions,
  contextManager?: ContextManagerRequestPort,
): RuntimeTurnCoordinatorInput {
  const scenario = options.scenario;
  const identity =
    scenario === 'missing_identity'
      ? undefined
      : identityForScenario(options.agentKey ?? defaultAgentKeyForScenario(scenario));
  const turnId = scenario === 'missing_turn_id' ? undefined : DEFAULT_TURN_ID;
  const taskType =
    scenario === 'missing_task_type'
      ? undefined
      : options.taskType ?? defaultTaskTypeForScenario(scenario);

  return {
    identity,
    turnId,
    taskType,
    contextManager: scenario === 'missing_context_manager' ? undefined : contextManager,
    requireSubstantive: options.requireSubstantive,
    createdAt: options.createdAt ?? DEFAULT_CREATED_AT,
  };
}

function identityForScenario(agentKey: unknown): AgentRuntimeAdapterDispatchIdentity {
  return {
    scope: {
      tenantId: 'tenant_team_magnificent' as TenantId,
      teamId: 'team_magnificent' as TeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      baId: 'TMBA-S2-8-001' as BaId,
    },
    sessionId: DEFAULT_SESSION_ID,
    agentKey,
    mode: 'browser_text',
    language: 'en',
    correlationId: DEFAULT_CORRELATION_ID,
    requestId: 'request_s2_8_fixture_001' as RequestId,
  };
}

function defaultAgentKeyForScenario(scenario: RuntimeTurnFixtureScenarioType): unknown {
  if (scenario === 'unknown_agent') return 'unknown_agent';
  return 'michael_magnificent';
}

function defaultTaskTypeForScenario(
  scenario: RuntimeTurnFixtureScenarioType,
): RuntimeTaskType {
  if (scenario === 'invalid_objective') return 'success_interview';
  return 'training_support';
}

function contextModeForScenario(
  scenario: RuntimeTurnFixtureScenarioType,
): FixtureContextMode | undefined {
  switch (scenario) {
    case 'accepted_degraded':
      return 'degraded';
    case 'failed_context':
      return 'failed';
    case 'candidate_review_only_rejected':
      return 'candidate_included';
    case 'missing_context_manager':
      return undefined;
    default:
      return 'complete';
  }
}

function metadataForScenario(
  scenario: RuntimeTurnFixtureScenarioType,
  contextManagerInjected: boolean,
): RuntimeTurnFixtureScenarioMetadata {
  const expectedDecision: RuntimeTurnFixtureScenarioMetadata['expectedDecision'] =
    scenario === 'accepted_complete'
      ? 'proceed'
      : scenario === 'accepted_degraded'
        ? 'degraded'
        : scenario === 'failed_context'
          ? 'block_substantive'
          : 'reject';

  return {
    scenario,
    description: `S2.8 inert fixture harness scenario: ${scenario}.`,
    fixtureOnly: true,
    contextManagerInjected,
    expectedContextRequest:
      contextManagerInjected &&
      ![
        'invalid_objective',
        'unknown_agent',
        'missing_identity',
        'missing_turn_id',
        'missing_task_type',
      ].includes(scenario),
    expectedDecision,
    persistence: 'disabled',
    behavior: 'not_implemented',
    agentResponseGenerated: false,
  };
}

function createFixtureContextManager(mode: FixtureContextMode): {
  readonly port: ContextManagerRequestPort;
  readonly calls: Array<{
    scope: RuntimeRequestScope;
    request: ContextPacketRequest;
  }>;
} {
  const calls: Array<{
    scope: RuntimeRequestScope;
    request: ContextPacketRequest;
  }> = [];

  return {
    calls,
    port: {
      assembledBy: 'context_manager',
      async requestContextPacket(scope, request): Promise<unknown> {
        calls.push({ scope, request });
        const packetStatus = mode === 'degraded' || mode === 'failed' ? mode : 'complete';
        const packet = createFixtureContextPacket(request, packetStatus);

        if (mode !== 'candidate_included') return packet;

        return {
          ...packet,
          retrievalAudit: {
            ...packet.retrievalAudit,
            candidateKnowledgeIncluded: true,
            candidateKnowledgeExcluded: false,
          },
        };
      },
    },
  };
}

function createFixtureContextPacket(
  request: ContextPacketRequest,
  packetStatus: 'complete' | 'degraded' | 'failed',
) {
  const packetId = `ctx_s2_8_${request.requestId}` as string;
  const knowledgeId = 'knowledge_s2_8_approved_001' as KnowledgeId;
  const sourceId = 'knowledge_s2_8_approved_001' as SourceId;

  return {
    schemaVersion: 'context_packet.v1',
    packetId,
    requestId: request.requestId as unknown as ContextRequestId,
    createdAt: DEFAULT_CREATED_AT,
    packetStatus,
    tenant: {
      tenantId: 'tenant_team_magnificent' as TenantId,
      tenantName: 'Team Magnificent Tenant',
      brandName: 'Team Magnificent',
      environment: 'development',
    },
    team: {
      teamId: 'team_magnificent' as TeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
    },
    ba: {
      tenantId: 'tenant_team_magnificent' as TenantId,
      teamId: 'team_magnificent' as TeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      baId: 'TMBA-S2-8-001' as BaId,
      journalEnabled: true,
      languagePreference: request.language,
      permissions: {
        canUsePrivateJournal: true,
        canSelectJournalForReview: false,
        canCreateKnowledgeCandidate: false,
        canAccessRelationshipContext: false,
        canUseBrowserVoice: true,
        canUseBrowserText: true,
      },
    },
    session: {
      sessionId: request.sessionId,
      mode: 'browser_text',
      status: 'active',
      taskType: request.taskType,
      startedAt: '2026-06-28T12:00:00.000Z',
    },
    agent: {
      agentKey: request.agentKey,
      agentId: AGENT_IDS[request.agentKey],
      displayName: AGENT_DISPLAY_NAMES[request.agentKey],
      primaryDomain: AGENT_DOMAINS[request.agentKey],
      roleSummary: `${AGENT_DISPLAY_NAMES[request.agentKey]} consumes a validated fixture packet.`,
      allowedOutputs: [
        'clarifying_question',
        'teaching_explanation',
        'next_step_prompt',
        'reflection_prompt',
      ],
      prohibitedOutputs: [
        'Do not query stores directly.',
        'Do not include candidate or review-only knowledge.',
        'Do not persist fixture packets or runtime envelopes.',
      ],
      agentRuntimeMode: AGENT_RUNTIME_MODES[request.agentKey],
      contextUsageInstruction:
        'Use this packet as read-only context through the fixture harness only.',
    },
    language: {
      primary: request.language,
      userPreference: request.language,
      translationAllowed: false,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    runtimeRules: [
      {
        ruleId: 'context_manager_only_assembler',
        category: 'agent_boundary',
        instruction: 'Context Packet assembled by Context Manager only.',
        required: true,
        appliesTo: request.agentKey,
      },
      {
        ruleId: 'agent_store_access_forbidden',
        category: 'knowledge_boundary',
        instruction: 'Agents must not query underlying knowledge or gateway systems.',
        required: true,
        appliesTo: 'all_agents',
      },
      {
        ruleId: 'candidate_knowledge_excluded_by_default',
        category: 'candidate_boundary',
        instruction: 'Candidate and review-only knowledge is excluded by default.',
        required: true,
        appliesTo: 'all_agents',
      },
    ],
    guardrails: [
      {
        guardrailId: 'team_magnificent_scope_required',
        appliesTo: request.agentKey,
        instruction: 'Team Magnificent scope is required.',
        severity: 'critical',
        category: 'runtime_boundary',
      },
    ],
    approvedKnowledge: [
      {
        knowledgeId,
        title: 'Approved S2.8 fixture context',
        summary: 'Approved inert Context Packet fixture for runtime turn harness tests.',
        status: 'active',
        governanceStatus: 'approved',
        language: request.language,
        sourceTraceability: {
          sourceId,
          sourceType: 'approved_knowledge',
          title: 'Approved S2.8 fixture context',
        },
        retrieval: {
          retrievalMethod: 'direct_reference',
          reasonCodes: ['agent_task_match'],
          score: 0.96,
          language: request.language,
          translationStatus: 'same_language',
        },
      },
    ],
    privateContext: {
      included: false,
      items: [],
      reason: 'Private context retrieval is not active in this fixture.',
    },
    relationshipContext: {
      included: false,
      items: [],
    },
    journalContext: {
      included: false,
      entries: [],
      privateByDefault: true,
    },
    sessionHistory: {
      included: false,
      turns: [],
      omittedTurnCount: 0,
    },
    guidedActions: [],
    exclusions: [],
    retrievalAudit: {
      requestId: request.requestId as unknown as ContextRequestId,
      packetId,
      requestedScopes: ['team_magnificent', 'ba', 'agent_runtime'],
      includedKnowledgeIds: [knowledgeId],
      includedPrivateContextIds: [],
      includedJournalEntryIds: [],
      includedRelationshipContextIds: [],
      includedGuidedActionIds: [],
      excludedSourceIds: [],
      retrievalMethods: ['direct_reference', 'rule_inclusion'],
      tokenEstimate: 0,
      languageFallbackUsed: false,
      candidateKnowledgeIncluded: false,
      candidateKnowledgeExcluded: true,
      privateJournalIncluded: false,
      degraded: packetStatus === 'degraded',
      includedItems: [
        {
          sourceId,
          method: 'direct_reference',
          included: true,
          reasonCodes: ['agent_task_match'],
          score: 0.96,
        },
      ],
      exclusions: [],
    },
    metadata: {
      generatedBy: 'context_manager',
      environment: 'development',
      correlationId: DEFAULT_CORRELATION_ID,
      notes: [
        `objective:S2.8 fixture objective for ${request.taskType}`,
        'fixture_only:true',
      ],
    },
  };
}
