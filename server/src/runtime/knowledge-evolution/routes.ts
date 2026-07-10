/**
 * Knowledge Evolution Runtime — internal API routes (Lane D · spec §25).
 *
 * INTERNAL-ONLY surface (no prospect/`.com`, no BA-facing behavior). Exactly five endpoints:
 *   POST   /api/runtime/knowledge-evolution                      → start an evolution
 *   GET    /api/runtime/knowledge-evolution/:evolutionId         → read one evolution record
 *   POST   /api/runtime/knowledge-evolution/:evolutionId/retrieval-ready → mark retrieval rollout
 *   POST   /api/runtime/knowledge-evolution/:evolutionId/rollback        → rollback an evolution
 *   GET    /api/runtime/knowledge-evolution/metrics             → metrics snapshot + health
 *
 * Handlers call SERVICES (Lane B) via the container — they NEVER touch a store, Chroma, or Neo4j
 * directly. Marking retrieval-ready is the sanctioned rollout gate; nothing here flips a Context
 * Manager live flag or activates GraphRAG.
 *
 * Auth: internal-only. A system caller presents the `x-mcs-runtime-secret` shared secret; an
 * interactive caller must be a Kevin-only admin session. Anything else is refused (mirrors the
 * `admin/health` "admin cookie OR shared secret" pattern).
 */

import express, { type Request, type Response, type Router, type NextFunction } from 'express';
import { z } from 'zod';
import type {
  MarkRetrievalReadyInput,
  RollbackKnowledgeEvolutionRequest,
  StartKnowledgeEvolutionRequest,
} from '@momentum/shared/runtime';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { KnowledgeEvolutionRuntimeError } from './errors.js';
import { KnowledgeEvolutionValidationError } from './models/index.js';
import { getKnowledgeEvolutionRuntime } from './container.js';

// ---------------------------------------------------------------------------
// Internal-only auth guard
// ---------------------------------------------------------------------------

/**
 * Allow either (a) a system caller with the runtime shared secret, or (b) a Kevin-only admin
 * session. The secret is read straight from `process.env` (mirrors the Steve-worker pattern) so no
 * shared env schema change is required; when unset, only an admin session can reach the runtime.
 */
export function requireRuntimeInternal(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.KNOWLEDGE_EVOLUTION_RUNTIME_SECRET;
  const presented = req.header('x-mcs-runtime-secret');
  if (secret && presented && presented === secret) {
    next();
    return;
  }
  void requireAdmin(req, res, next);
}

// ---------------------------------------------------------------------------
// Request schemas (coerce JSON date strings → Date; enum membership is enforced
// downstream by the Lane A models / Lane B policies)
// ---------------------------------------------------------------------------

const approvalReferenceSchema = z.object({
  approvalId: z.string().min(1),
  approvedBy: z.string().min(1),
  approvalType: z.string().min(1),
  approvedAt: z.coerce.date(),
  approvalNotes: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  sourceReviewRecordId: z.string().optional(),
});

const startRequestSchema = z.object({
  tenantId: z.string().min(1),
  teamId: z.string().min(1),
  teamKey: z.string().min(1),
  teamName: z.string().min(1),
  baId: z.string().optional(),
  inputType: z.string().min(1),
  inputId: z.string().min(1),
  domain: z.string().min(1),
  language: z.string().min(1),
  evolutionAction: z.string().min(1),
  targetKnowledgeObjectId: z.string().optional(),
  sourceKnowledgeObjectIds: z.array(z.string()).optional(),
  sourceCandidateIds: z.array(z.string()).optional(),
  sourceOutcomeIds: z.array(z.string()).optional(),
  sourceLearningSignalIds: z.array(z.string()).optional(),
  sourceEventIds: z.array(z.string()).optional(),
  approvalReference: approvalReferenceSchema,
  metadata: z.record(z.unknown()).optional(),
});

const markRetrievalReadySchema = z.object({
  tenantId: z.string().min(1),
  teamId: z.string().min(1),
  knowledgeObjectId: z.string().min(1),
  version: z.number(),
});

const rollbackSchema = z.object({
  tenantId: z.string().min(1),
  teamId: z.string().min(1),
  rollbackReason: z.string().min(1),
  requestedBy: z.string().min(1),
});

const metricsQuerySchema = z.object({
  tenantId: z.string().min(1),
  teamId: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  domain: z.string().optional(),
  language: z.string().optional(),
  evolutionAction: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function handleServiceError(res: Response, err: unknown): Response {
  if (err instanceof KnowledgeEvolutionRuntimeError) {
    // A guardrail rejected the operation — externally-safe message only.
    return res.status(422).json({
      ok: false,
      error: err.safeMessage,
      errorType: err.errorType,
      retryable: err.retryable,
    });
  }
  if (err instanceof KnowledgeEvolutionValidationError) {
    return res.status(400).json({ ok: false, error: 'invalid_document', details: err.errors });
  }
  // eslint-disable-next-line no-console
  console.error('[knowledge-evolution:routes] unexpected error', err);
  return res.status(500).json({ ok: false, error: 'internal_error' });
}

// ---------------------------------------------------------------------------
// Handlers (exported for direct unit testing)
// ---------------------------------------------------------------------------

export async function handleStartEvolution(req: Request, res: Response): Promise<Response> {
  const parsed = startRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
  }
  try {
    const request = parsed.data as unknown as StartKnowledgeEvolutionRequest;
    const { evolution, plan } = await getKnowledgeEvolutionRuntime().services.knowledgeEvolutionService.startEvolution(
      request,
    );
    return res.status(201).json({ evolution, plan });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

export async function handleGetEvolution(req: Request, res: Response): Promise<Response> {
  const evolutionId = req.params.evolutionId;
  if (typeof evolutionId !== 'string' || !evolutionId) {
    return res.status(400).json({ ok: false, error: 'missing_evolution_id' });
  }
  try {
    const evolution = await getKnowledgeEvolutionRuntime().services.knowledgeEvolutionService.getEvolutionById(
      evolutionId,
    );
    if (!evolution) {
      return res.status(404).json({ ok: false, error: 'not_found', evolution: null });
    }
    return res.status(200).json({ evolution });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

export async function handleMarkRetrievalReady(req: Request, res: Response): Promise<Response> {
  const evolutionId = req.params.evolutionId;
  if (typeof evolutionId !== 'string' || !evolutionId) {
    return res.status(400).json({ ok: false, error: 'missing_evolution_id' });
  }
  const parsed = markRetrievalReadySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
  }
  try {
    const input: MarkRetrievalReadyInput = { ...parsed.data, evolutionId };
    const rollout = await getKnowledgeEvolutionRuntime().services.knowledgeEvolutionService.markRetrievalReady(
      input,
    );
    return res.status(200).json({ rollout });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

export async function handleRollback(req: Request, res: Response): Promise<Response> {
  const evolutionId = req.params.evolutionId;
  if (typeof evolutionId !== 'string' || !evolutionId) {
    return res.status(400).json({ ok: false, error: 'missing_evolution_id' });
  }
  const parsed = rollbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_request', details: parsed.error.flatten() });
  }
  try {
    const request: RollbackKnowledgeEvolutionRequest = { ...parsed.data, evolutionId };
    const evolution = await getKnowledgeEvolutionRuntime().services.knowledgeEvolutionService.rollbackEvolution(
      request,
    );
    return res.status(200).json({ evolution });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

export async function handleMetrics(req: Request, res: Response): Promise<Response> {
  const parsed = metricsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_query', details: parsed.error.flatten() });
  }
  try {
    const runtime = getKnowledgeEvolutionRuntime();
    const query = parsed.data as unknown as Parameters<typeof runtime.operationalHealth>[0];
    const [snapshot, health] = await Promise.all([
      runtime.services.metricsService.buildSnapshot(query),
      runtime.operationalHealth(query),
    ]);
    return res.status(200).json({ snapshot, health });
  } catch (err) {
    return handleServiceError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const knowledgeEvolutionRoutes: Router = express.Router();

// `/metrics` is registered BEFORE `/:evolutionId` so it is not captured as an id.
knowledgeEvolutionRoutes.get('/metrics', requireRuntimeInternal, (req, res) => {
  void handleMetrics(req, res);
});
knowledgeEvolutionRoutes.post('/', requireRuntimeInternal, (req, res) => {
  void handleStartEvolution(req, res);
});
knowledgeEvolutionRoutes.get('/:evolutionId', requireRuntimeInternal, (req, res) => {
  void handleGetEvolution(req, res);
});
knowledgeEvolutionRoutes.post('/:evolutionId/retrieval-ready', requireRuntimeInternal, (req, res) => {
  void handleMarkRetrievalReady(req, res);
});
knowledgeEvolutionRoutes.post('/:evolutionId/rollback', requireRuntimeInternal, (req, res) => {
  void handleRollback(req, res);
});
