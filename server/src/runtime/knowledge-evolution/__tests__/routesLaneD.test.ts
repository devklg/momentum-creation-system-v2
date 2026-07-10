/**
 * Lane D route tests — auth/authorization + boundary behavior for the five internal endpoints.
 * Handlers are exercised directly (supertest is not installed); auth middleware is mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../middleware/requireAuth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (
    req: { header(name: string): string | undefined; session?: unknown },
    res: { status(code: number): { json(body: unknown): unknown } },
    next: () => void,
  ) => {
    if (req.header('x-admin') === 'true') {
      req.session = { tmagId: 'TMBA-ADMIN', threeBaId: 'THREE-ADMIN', email: 'k@x' };
      next();
      return;
    }
    res.status(403).json({ ok: false, error: 'Not found.' });
  },
}));

import {
  resetKnowledgeEvolutionRuntimeForTest,
  setKnowledgeEvolutionRuntimeForTest,
} from '../container.js';
import {
  handleGetEvolution,
  handleMarkRetrievalReady,
  handleMetrics,
  handleRollback,
  handleStartEvolution,
  requireRuntimeInternal,
} from '../routes.js';
import { makeTestRuntime, mockReq, mockRes, startBody } from './laneDTestKit.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = (res: { body: unknown }): any => res.body;

describe('Lane D routes', () => {
  beforeEach(() => {
    setKnowledgeEvolutionRuntimeForTest(makeTestRuntime().runtime);
  });
  afterEach(() => {
    resetKnowledgeEvolutionRuntimeForTest();
    delete process.env.KNOWLEDGE_EVOLUTION_RUNTIME_SECRET;
    vi.restoreAllMocks();
  });

  describe('requireRuntimeInternal', () => {
    it('allows a system caller presenting the shared secret', () => {
      process.env.KNOWLEDGE_EVOLUTION_RUNTIME_SECRET = 's3cret';
      const req = mockReq({ headers: { 'x-mcs-runtime-secret': 's3cret' } });
      const res = mockRes();
      let nexted = false;
      requireRuntimeInternal(req, res, () => {
        nexted = true;
      });
      expect(nexted).toBe(true);
    });

    it('falls back to an admin session and 403s a non-admin caller', () => {
      const req = mockReq({ headers: {} });
      const res = mockRes();
      let nexted = false;
      requireRuntimeInternal(req, res, () => {
        nexted = true;
      });
      expect(nexted).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it('allows an admin session (no secret configured)', () => {
      const req = mockReq({ headers: { 'x-admin': 'true' } });
      const res = mockRes();
      let nexted = false;
      requireRuntimeInternal(req, res, () => {
        nexted = true;
      });
      expect(nexted).toBe(true);
    });

    it('rejects a wrong secret and no admin', () => {
      process.env.KNOWLEDGE_EVOLUTION_RUNTIME_SECRET = 's3cret';
      const req = mockReq({ headers: { 'x-mcs-runtime-secret': 'nope' } });
      const res = mockRes();
      requireRuntimeInternal(req, res, () => undefined);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /', () => {
    it('creates an evolution + plan (201) scoped to Team Magnificent', async () => {
      const res = mockRes();
      await handleStartEvolution(mockReq({ body: startBody() }), res);
      expect(res.statusCode).toBe(201);
      expect(body(res).evolution.evolutionId).toMatch(/^kev_/);
      expect(body(res).evolution.teamKey).toBe('team_magnificent');
      expect(body(res).plan.planId).toMatch(/^kevplan_/);
    });

    it('rejects a malformed body (400)', async () => {
      const res = mockRes();
      await handleStartEvolution(mockReq({ body: { tenantId: 'x' } }), res);
      expect(res.statusCode).toBe(400);
      expect(body(res).error).toBe('invalid_request');
    });

    it('maps a guardrail violation to 422 with a safe message', async () => {
      const res = mockRes();
      // Non-Team-Magnificent scope → team-scope policy rejects (spec §5).
      await handleStartEvolution(
        mockReq({ body: { ...startBody(), teamName: 'Wrong Team' } }),
        res,
      );
      expect(res.statusCode).toBe(422);
      expect(typeof body(res).error).toBe('string');
      expect(body(res).errorType).toBe('invalid_team_scope');
    });
  });

  describe('GET /:evolutionId', () => {
    it('returns a stored evolution (200) and 404 for an unknown id', async () => {
      const create = mockRes();
      await handleStartEvolution(mockReq({ body: startBody() }), create);
      const evolutionId = body(create).evolution.evolutionId as string;

      const found = mockRes();
      await handleGetEvolution(mockReq({ params: { evolutionId } }), found);
      expect(found.statusCode).toBe(200);
      expect(body(found).evolution.evolutionId).toBe(evolutionId);

      const missing = mockRes();
      await handleGetEvolution(mockReq({ params: { evolutionId: 'kev_missing' } }), missing);
      expect(missing.statusCode).toBe(404);
    });
  });

  describe('POST /:evolutionId/retrieval-ready', () => {
    it('returns a rollout for the evolution (200)', async () => {
      const create = mockRes();
      await handleStartEvolution(mockReq({ body: startBody() }), create);
      const evolutionId = body(create).evolution.evolutionId as string;

      const res = mockRes();
      await handleMarkRetrievalReady(
        mockReq({
          params: { evolutionId },
          body: {
            tenantId: 'tenant_team_magnificent',
            teamId: 'team_magnificent',
            knowledgeObjectId: 'ko_1',
            version: 1,
          },
        }),
        res,
      );
      expect(res.statusCode).toBe(200);
      expect(body(res).rollout.evolutionId).toBe(evolutionId);
      expect(typeof body(res).rollout.retrievalReady).toBe('boolean');
    });
  });

  describe('POST /:evolutionId/rollback', () => {
    it('rolls back an evolution and preserves it as rolled_back (200)', async () => {
      const create = mockRes();
      await handleStartEvolution(mockReq({ body: startBody() }), create);
      const evolutionId = body(create).evolution.evolutionId as string;

      const res = mockRes();
      await handleRollback(
        mockReq({
          params: { evolutionId },
          body: {
            tenantId: 'tenant_team_magnificent',
            teamId: 'team_magnificent',
            rollbackReason: 'bad activation',
            requestedBy: 'TMBA-20260101-000001',
          },
        }),
        res,
      );
      expect(res.statusCode).toBe(200);
      expect(body(res).evolution.status).toBe('rolled_back');
      expect(body(res).evolution.retrievalStatus).toBe('rolled_back');
    });
  });

  describe('GET /metrics', () => {
    it('returns a snapshot + operational health (200)', async () => {
      const res = mockRes();
      await handleMetrics(
        mockReq({
          query: {
            tenantId: 'tenant_team_magnificent',
            teamId: 'team_magnificent',
            periodStart: '2026-07-01T00:00:00.000Z',
            periodEnd: '2026-07-31T00:00:00.000Z',
          },
        }),
        res,
      );
      expect(res.statusCode).toBe(200);
      expect(body(res).snapshot.teamKey).toBe('team_magnificent');
      expect(typeof body(res).health.backlog).toBe('number');
      expect(Array.isArray(body(res).health.blockedRolloutReasons)).toBe(true);
    });

    it('rejects a missing window (400)', async () => {
      const res = mockRes();
      await handleMetrics(mockReq({ query: { tenantId: 'x', teamId: 'y' } }), res);
      expect(res.statusCode).toBe(400);
    });
  });
});
