/**
 * Lane D test kit — builds a runtime over the Lane B in-memory fakes with fake Chroma/Neo4j
 * coordinators, plus tiny Express req/res mocks (supertest is not installed in this repo).
 *
 * Not a test file (no `.test.ts`), so vitest imports it without running it. The runtime boundary
 * walker skips `__tests__` entirely, so this file is out of scope for that guard.
 */

import type { Request, Response } from 'express';
import type {
  KnowledgeEvolutionMetricsQuery,
  StartKnowledgeEvolutionRequest,
} from '@momentum/shared/runtime';
import { buildKnowledgeEvolutionRuntime, type KnowledgeEvolutionRuntime } from '../container.js';
import { createKnowledgeEvolutionEventBus } from '../events/bus.js';
import { computeOperationalHealth } from '../metricsHealth.js';
import type { GraphMapperInput, KnowledgeGraphSyncResult } from '../graph/index.js';
import type { KnowledgeReindexRequest, KnowledgeReindexResult } from '../indexing/index.js';
import type { EvolutionRuntimeDeps } from '../deps.js';
import {
  makeDeps,
  makeRepositories,
  type FakeEvolutionRecordRepository,
  type FakeRetrievalRolloutRepository,
} from './fakes.js';

export interface TestRuntimeOptions {
  reindex?: (request: KnowledgeReindexRequest) => Promise<KnowledgeReindexResult>;
  graphSync?: (input: GraphMapperInput) => Promise<KnowledgeGraphSyncResult>;
}

export interface TestRuntimeBundle {
  runtime: KnowledgeEvolutionRuntime;
  repositories: ReturnType<typeof makeRepositories>;
  runtimeDeps: EvolutionRuntimeDeps;
}

export function defaultReindex(request: KnowledgeReindexRequest): Promise<KnowledgeReindexResult> {
  return Promise.resolve({
    evolutionId: request.evolutionId,
    knowledgeObjectId: request.knowledgeObjectId,
    action: 'index_active',
    collection: 'mcs_test_knowledge_en',
    documentId: `doc_${request.knowledgeObjectId}`,
    status: 'completed',
    indexingStatus: 'completed',
    attempts: 1,
    retryable: false,
    reason: 'test index_active',
  });
}

export function defaultGraphSync(input: GraphMapperInput): Promise<KnowledgeGraphSyncResult> {
  return Promise.resolve({
    evolutionId: input.evolutionId,
    graphStatus: 'completed',
    statementsPlanned: 2,
    statementsRun: 2,
    relationshipsCreated: 1,
    attempts: 1,
    retryable: false,
  });
}

export function makeTestRuntime(options: TestRuntimeOptions = {}): TestRuntimeBundle {
  const repositories = makeRepositories();
  const runtimeDeps = makeDeps();
  const bus = createKnowledgeEvolutionEventBus();
  const recordStore = (repositories.recordRepository as FakeEvolutionRecordRepository).store;
  const rolloutStore = (repositories.rolloutRepository as FakeRetrievalRolloutRepository).store;

  const runtime = buildKnowledgeEvolutionRuntime({
    repositories,
    runtimeDeps,
    bus,
    autoStartWorkers: false,
    findRecordByInput: async (tenantId, inputType, inputId) => {
      for (const record of recordStore.values()) {
        if (
          record.tenantId === tenantId &&
          record.inputType === inputType &&
          record.inputId === inputId
        ) {
          return record;
        }
      }
      return null;
    },
    reindex: options.reindex ?? defaultReindex,
    graphSync: options.graphSync ?? defaultGraphSync,
    operationalHealth: async (query: KnowledgeEvolutionMetricsQuery) =>
      computeOperationalHealth(
        {
          tenantId: query.tenantId,
          teamId: query.teamId,
          periodStart: query.periodStart,
          periodEnd: query.periodEnd,
          generatedAt: runtimeDeps.clock.now(),
        },
        [...recordStore.values()],
        [...rolloutStore.values()],
      ),
  });

  return { runtime, repositories, runtimeDeps };
}

/** A JSON-shaped start-request body (dates as `Date`; the route zod coerces either form). */
export function startBody(
  overrides: Partial<StartKnowledgeEvolutionRequest> = {},
): Record<string, unknown> {
  return {
    tenantId: 'tenant_team_magnificent',
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    inputType: 'approved_candidate',
    inputId: 'cand_input_1',
    domain: 'success',
    language: 'en',
    evolutionAction: 'create_new_knowledge',
    sourceCandidateIds: ['cand_1'],
    approvalReference: {
      approvalId: 'appr_1',
      approvedBy: 'TMBA-20260101-000001',
      approvalType: 'review_workflow',
      approvedAt: '2026-07-09T00:00:00.000Z',
    },
    metadata: { document: 'A success principle worth activating.' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Minimal Express req/res mocks
// ---------------------------------------------------------------------------

export interface MockResponse {
  statusCode: number;
  body: unknown;
  status(code: number): MockResponse;
  json(payload: unknown): MockResponse;
}

export function mockRes(): MockResponse & Response {
  const res = { statusCode: 200, body: undefined } as unknown as MockResponse;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: unknown) => {
    res.body = payload;
    return res;
  };
  return res as MockResponse & Response;
}

export interface MockReqInit {
  params?: Record<string, string>;
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export function mockReq(init: MockReqInit = {}): Request {
  return {
    params: init.params ?? {},
    body: init.body ?? {},
    query: init.query ?? {},
    header: (name: string) => init.headers?.[name.toLowerCase()] ?? init.headers?.[name],
  } as unknown as Request;
}
