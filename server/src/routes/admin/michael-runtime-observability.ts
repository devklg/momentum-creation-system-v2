/**
 * /api/admin/michael-runtime/observability — admin-only runtime observability.
 *
 * Exposes the in-process Michael runtime counters plus the latest durable
 * Context Manager trace rows. Trace rows are content-free: ids/counts/statuses,
 * no raw Context Packet body, no prompt text, and no generated response text.
 *
 * Kevin-only via requireAdmin (ADMIN_TMAG_IDS). Not BA-facing, never on `.com`.
 *
 *   GET /observability   { ok: true, michaelRuntime: <snapshot>, contextTraces: [...] }
 */

import express, { type Router } from 'express';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { getMichaelRuntimeObservabilitySnapshot } from '../../services/michaelRuntimeObservability.js';
import { listRuntimeContextTraces } from '../../services/runtimeContextTrace.js';

export const adminMichaelRuntimeObservabilityRoutes: Router = express.Router();

adminMichaelRuntimeObservabilityRoutes.get('/observability', requireAdmin, async (_req, res) => {
  const contextTraces = await listRuntimeContextTraces({
    agentKey: 'michael_magnificent',
    limit: 10,
  });
  res.status(200).json({
    ok: true,
    michaelRuntime: getMichaelRuntimeObservabilitySnapshot(),
    contextTraces: contextTraces.map((trace) => ({
      traceId: trace.traceId,
      agentKey: trace.agentKey,
      taskType: trace.taskType,
      runtimeSurface: trace.runtimeSurface,
      packetStatus: trace.packetStatus,
      approvedKnowledgeCount: trace.approvedKnowledgeCount,
      approvedKnowledgeIds: trace.approvedKnowledgeIds,
      approvedSourceIds: trace.approvedSourceIds,
      excludedSourceIds: trace.excludedSourceIds,
      candidateKnowledgeExcluded: trace.candidateKnowledgeExcluded,
      retrievalMethods: trace.retrievalMethods,
      routeDecision: trace.routeDecision,
      catalogKey: trace.catalogKey,
      responseType: trace.responseType,
      createdAt: trace.createdAt,
    })),
  });
});
