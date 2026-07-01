/**
 * /api/admin/audit — append-only audit-log read surface
 * (locked-spec 4.J · project-wireframe 4.J).
 *
 * The /admin view that reads the substrate. Writes happen everywhere
 * else in the system via `appendAuditEntry()`; this file only reads.
 *
 *   GET /              filterable list, reverse-chronological, cursor paged
 *   GET /:entryId      single entry (for transcript drill-in)
 *
 * All routes gated by `requireAdmin`. Per ADMIN Design A.2 (Chat #85)
 * the gate denial itself is audit-logged elsewhere; this file just
 * makes sure denials never reach the read surface.
 *
 * No POST / PUT / DELETE. Writers don't go through HTTP — domain
 * code calls `appendAuditEntry()` directly. Exposing a write endpoint
 * would mean letting outside callers forge audit rows, which defeats
 * the substrate.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import {
  findAuditEntry,
  queryAuditEntries,
} from '../../domain/auditLog.js';
import type {
  McsAuditListResponse,
  McsAuditEntryResponse,
  McsAuditQueryFilters,
  McsAuditActorRole,
  McsAuditEntityKind,
  McsAuditSeverity,
} from '@momentum/shared';

export const adminAuditRoutes: Router = express.Router();

const ROLE_VALUES: readonly McsAuditActorRole[] = [
  'admin',
  'ba',
  'system',
  'prospect',
  'anonymous',
];
const SEVERITY_VALUES: readonly McsAuditSeverity[] = ['info', 'warn', 'critical'];
const ENTITY_KIND_VALUES: readonly McsAuditEntityKind[] = [
  'brand_ambassador',
  'invite_token',
  'prospect',
  'access_code',
  'callback_request',
  'webinar_reservation',
  'pool_placement',
  'admin_session',
  'master_content',
  'queue_rule',
  'compliance_rule',
  'michael_session',
  'audit_entry',
  'none',
];

const QuerySchema = z.object({
  actorTmagId: z.string().min(2).max(80).optional(),
  role: z.enum(ROLE_VALUES as [McsAuditActorRole, ...McsAuditActorRole[]]).optional(),
  action: z.string().min(1).max(120).optional(),
  actionPrefix: z.string().min(1).max(120).optional(),
  entityKind: z.enum(ENTITY_KIND_VALUES as [McsAuditEntityKind, ...McsAuditEntityKind[]]).optional(),
  entityId: z.string().min(1).max(200).optional(),
  severity: z.enum(SEVERITY_VALUES as [McsAuditSeverity, ...McsAuditSeverity[]]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  before: z.string().min(1).max(200).optional(),
  limit: z
    .preprocess((v) => (typeof v === 'string' ? Number.parseInt(v, 10) : v), z.number().int().min(1).max(250))
    .optional(),
});

adminAuditRoutes.get('/', requireAdmin, async (req: Request, res: Response) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid query parameters.', issues: parsed.error.issues });
    return;
  }
  const filters: McsAuditQueryFilters = parsed.data;

  try {
    const { entries, nextCursor } = await queryAuditEntries(filters);
    const body: McsAuditListResponse = {
      ok: true,
      entries,
      nextCursor,
      appliedFilters: filters,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Audit list failed: ${msg}` });
  }
});

const EntryParams = z.object({
  entryId: z.string().min(8).max(200),
});

adminAuditRoutes.get('/:entryId', requireAdmin, async (req: Request, res: Response) => {
  const parsed = EntryParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid entryId.' });
    return;
  }
  try {
    const entry = await findAuditEntry(parsed.data.entryId);
    if (!entry) {
      res.status(404).json({ ok: false, error: 'Audit entry not found.' });
      return;
    }
    const body: McsAuditEntryResponse = { ok: true, entry };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Audit lookup failed: ${msg}` });
  }
});
