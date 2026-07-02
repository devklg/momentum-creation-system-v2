import type { McsRuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';
import { runMichaelRuntimeAdapterContract } from '../michaelRuntimeAdapterContract.js';
import {
  MICHAEL_RESPONSE_FORBIDDEN_FIELDS,
  validateMichaelResponseContract,
} from '../michaelResponseContract.js';
import type {
  MichaelRuntimeAdapterContractResult,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

type ContractCase = {
  readonly scenario: RuntimeTurnFixtureScenarioType;
  readonly agentKey?: unknown;
  readonly taskType?: McsRuntimeTaskType;
  readonly language?: unknown;
  readonly intent?: 'clear_training_support' | 'ambiguous_training_support';
  readonly mutateRuntimeTurn?: (
    runtimeTurn: RuntimeTurnFixtureHarnessResult,
  ) => RuntimeTurnFixtureHarnessResult;
};

const wrongTaskTypes = [
  'success_interview',
  'relationship_coaching',
  'invitation_drafting',
  'journal_teaching',
  'session_resume',
  'guided_action_review',
] as const satisfies readonly McsRuntimeTaskType[];

const adapterContractCases: readonly ContractCase[] = [
  { scenario: 'accepted_complete', intent: 'clear_training_support' },
  { scenario: 'accepted_complete', intent: 'ambiguous_training_support' },
  { scenario: 'accepted_degraded' },
  { scenario: 'missing_context_manager' },
  { scenario: 'failed_context' },
  { scenario: 'candidate_review_only_rejected' },
  { scenario: 'accepted_complete', agentKey: 'steve_success' },
  { scenario: 'accepted_complete', agentKey: 'ivory' },
  { scenario: 'unknown_agent', agentKey: 'unknown_agent' },
  { scenario: 'accepted_complete', language: 'fr' },
  { scenario: 'accepted_complete', mutateRuntimeTurn: withNonContextManagerAssembly },
  ...wrongTaskTypes.map((taskType) => ({
    scenario: 'accepted_complete' as const,
    taskType,
  })),
];

const forbiddenReturnedKeys = [
  'agentResponse',
  'responseText',
  'generatedText',
  'llmOutput',
  'rawContextPacket',
  'contextPacket',
  'contextPacketPayload',
  'packet',
  'contextRequestResult',
  'contextCalls',
  'input',
  'consumption',
  'approvedKnowledge',
  'retrievalAudit',
  'rawRetrievalResults',
  'retrievalResults',
  'rawStoreResults',
  'storeResults',
  'mongoResult',
  'neo4jResult',
  'chromaResult',
  'surrealResult',
  'rawGraphRagResults',
  'graphRagResults',
  'rawPERSISTENCEFallbackResponse',
  'PERSISTENCEFallbackResponse',
  'sendMessage',
  'callProspect',
  'scheduleCall',
  'autoSend',
  'autoCall',
  'automaticProspecting',
] as const;

const forbiddenReturnedText = [
  'context_packet.v1',
  'approvedKnowledge',
  'retrievalAudit',
  'rawStoreResults',
  'rawGraphRagResults',
  'rawPERSISTENCEFallbackResponse',
  'rawRetrieval',
  'MongoDB',
  'Neo4j',
  'ChromaDB',
  'GraphRAG',
  'legacy fallback',
] as const;

async function runContract(input: ContractCase): Promise<MichaelRuntimeAdapterContractResult> {
  const taskType = input.taskType ?? 'training_support';
  const runtimeTurn = await runRuntimeTurnFixtureScenario({
    scenario: input.scenario,
    agentKey: input.agentKey ?? 'michael_magnificent',
    taskType,
  });
  const fixtureTurn = input.mutateRuntimeTurn
    ? input.mutateRuntimeTurn(runtimeTurn)
    : runtimeTurn;
  if (input.language !== undefined && fixtureTurn.input.identity) {
    fixtureTurn.input.identity.language = input.language as never;
  }
  const identity = fixtureTurn.input.identity;
  const turnId = fixtureTurn.input.turnId;

  expect(identity).toBeDefined();
  expect(turnId).toBeDefined();

  return runMichaelRuntimeAdapterContract({
    identity: identity!,
    turnId: turnId!,
    taskType,
    runtimeTurn: fixtureTurn,
    intent: input.intent,
    language: input.language,
  });
}

function withNonContextManagerAssembly(
  runtimeTurn: RuntimeTurnFixtureHarnessResult,
): RuntimeTurnFixtureHarnessResult {
  const result = runtimeTurn.result;
  if ('contextRequestResult' in result && result.contextRequestResult.consumption.packet) {
    result.contextRequestResult.consumption.packet.metadata = {
      ...result.contextRequestResult.consumption.packet.metadata,
      generatedBy: 'agent_runtime',
    } as never;
  }
  return runtimeTurn;
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (typeof value !== 'object' || value === null) return [];

  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}

function collectForbiddenKeys(value: unknown): string[] {
  const keys = collectKeys(value);
  return keys.filter((key) =>
    (forbiddenReturnedKeys as readonly string[]).includes(key),
  );
}

function collectForbiddenContractFields(value: unknown): string[] {
  const keys = collectKeys(value);
  return keys.filter((key) =>
    (MICHAEL_RESPONSE_FORBIDDEN_FIELDS as readonly string[]).includes(key),
  );
}

function expectNoRawBoundaryOutput(value: unknown): void {
  expect(collectForbiddenKeys(value)).toEqual([]);

  const serialized = JSON.stringify(value);
  for (const forbiddenText of forbiddenReturnedText) {
    expect(serialized).not.toContain(forbiddenText);
  }
}

function expectSafeDisabled(result: MichaelRuntimeAdapterContractResult): void {
  expect(result.behavior).toBe('not_implemented');
  expect(result.agentResponseGenerated).toBe(false);
  expect(result.eventPersistence).toBe('disabled');
  expect(result.outcomePersistence).toBe('disabled');
  expect(result.guidedActionPersistence).toBe('disabled');
  expect(result.envelopePersistence).toBe('disabled');
  expect(result.responsePersistence).toBe('disabled');
  expect(result.michaelResponse.persistence).toBe('disabled');
  expect(result.michaelResponse.agentResponseGenerated).toBe(false);
}

describe('S2.15 Michael runtime adapter contract boundary', () => {
  it('validates every returned Michael response and keeps persistence disabled', async () => {
    for (const input of adapterContractCases) {
      const result = await runContract(input);

      expect(validateMichaelResponseContract(result.michaelResponse).ok).toBe(true);
      expectSafeDisabled(result);
    }
  });

  it('never returns raw Context Packet, store, GraphRAG, PERSISTENCE, or retrieval output', async () => {
    for (const input of adapterContractCases) {
      const result = await runContract(input);

      expectNoRawBoundaryOutput(result);
      expectNoRawBoundaryOutput(result.michaelResponse);
    }
  });

  it('never returns forbidden response-contract fields', async () => {
    for (const input of adapterContractCases) {
      const result = await runContract(input);

      expect(collectForbiddenContractFields(result.michaelResponse)).toEqual([]);
    }
  });

  it('safe-close and safe-fallback paths never include nextStep', async () => {
    for (const input of adapterContractCases) {
      const result = await runContract(input);

      if (result.michaelResponse.responseType === 'next_training_step') {
        expect(result.michaelResponse.nextStep).toBeDefined();
        continue;
      }

      expect(result.michaelResponse.nextStep).toBeUndefined();
    }
  });

  it('rejected, candidate/review-only, wrong-agent, wrong-task, unsupported-language, and non-Context-Manager paths safe-close only', async () => {
    const rejectionCases = adapterContractCases.filter(
      (input) =>
        input.scenario === 'candidate_review_only_rejected' ||
        input.agentKey !== undefined ||
        input.taskType !== undefined ||
        input.language === 'fr' ||
        input.mutateRuntimeTurn !== undefined,
    );

    for (const input of rejectionCases) {
      const result = await runContract(input);

      expect(result.michaelResponse.responseType).toBe('safe_close');
      expect(result.michaelResponse.contextPacketStatus).toBe('rejected');
    }
  });
});
