/**
 * /api/admin/michael-runtime/observability — admin-only, in-memory aggregate read
 * (Sprint 3 S3.6).
 *
 * Exposes the in-process Michael runtime observability snapshot: evaluated
 * feature-flag booleans plus monotonic process-lifetime counters. This is a
 * PURE in-memory read — it does NOT persist, does NOT audit-log, and does NOT
 * touch the triple-stack. It must never call appendAuditEntry.
 *
 * The snapshot exposes only evaluated booleans and aggregate counts — no PII,
 * no tokens, no IDs, no raw env strings. Kevin-only via requireAdmin
 * (ADMIN_TMAG_IDS). Not BA-facing, never on `.com`.
 *
 *   GET /observability   { ok: true, michaelRuntime: <snapshot> }
 */

import express, { type Router } from 'express';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { getMichaelRuntimeObservabilitySnapshot } from '../../services/michaelRuntimeObservability.js';

export const adminMichaelRuntimeObservabilityRoutes: Router = express.Router();

adminMichaelRuntimeObservabilityRoutes.get('/observability', requireAdmin, (_req, res) => {
  res.status(200).json({ ok: true, michaelRuntime: getMichaelRuntimeObservabilitySnapshot() });
});
