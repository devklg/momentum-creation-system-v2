/**
 * /api/crm-hub — dedicated ProspectCRMRecord reads/writes.
 *
 * This is additive to the existing /api/crm note/follow-up/disposition API.
 * Every BA read/write is scoped by req.session.tmagId.
 */

import { Router } from 'express';
import { z } from 'zod';
import type {
  CloseAsNewBaResponse,
  ProspectCrmListResponse,
  ProspectCrmRecordResponse,
} from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { findBAByTmagId } from '../domain/ba.js';
import {
  ProspectCrmError,
  closeCrmAsNewBa,
  getOwnerScopedCrmRecord,
  listCrmRecordsForOwner,
  listTimelineForProspect,
} from '../domain/prospectCrm.js';

export const crmHubRoutes: Router = Router();

const CloseSchema = z.object({
  reason: z.string().min(8).max(1000),
});

function sessionTmagId(req: import('express').Request): string | null {
  return req.session?.tmagId ?? null;
}

function includeClosed(req: import('express').Request): boolean {
  return req.query.includeClosed === 'true' || req.query.status === 'closed';
}

function routeParam(req: import('express').Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function sendCrmHubError(res: import('express').Response, err: unknown) {
  if (err instanceof ProspectCrmError) {
    if (err.code === 'owner_mismatch') {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    if (err.code.endsWith('_not_found')) {
      return res.status(404).json({ ok: false, error: err.code });
    }
    return res.status(400).json({ ok: false, error: err.code });
  }
  // eslint-disable-next-line no-console
  console.error('[crm-hub route] unexpected error', err);
  return res.status(500).json({ ok: false, error: 'server_error' });
}

crmHubRoutes.get('/prospects', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const records = await listCrmRecordsForOwner(tmagId, includeClosed(req));
    const body: ProspectCrmListResponse = { ok: true, records };
    return res.status(200).json(body);
  } catch (err) {
    return sendCrmHubError(res, err);
  }
});

crmHubRoutes.get('/prospects/:prospectId', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const prospectId = routeParam(req, 'prospectId');
    const record = await getOwnerScopedCrmRecord(prospectId, tmagId);
    const timeline = await listTimelineForProspect(prospectId, tmagId);
    const body: ProspectCrmRecordResponse = { ok: true, record, timeline };
    return res.status(200).json(body);
  } catch (err) {
    return sendCrmHubError(res, err);
  }
});

crmHubRoutes.post(
  '/prospects/:prospectId/close-as-ba',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = sessionTmagId(req);
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const parsed = CloseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
    }

    try {
      const ba = await findBAByTmagId(tmagId);
      const displayName = ba
        ? `${ba.firstName ?? ''} ${ba.lastName ?? ''}`.trim() || tmagId
        : tmagId;
      const record = await closeCrmAsNewBa({
        prospectId: routeParam(req, 'prospectId'),
        ownerTmagId: tmagId,
        actor: { kind: 'ba', tmagId, displayName },
        reason: parsed.data.reason,
      });
      const body: CloseAsNewBaResponse = {
        ok: true,
        record,
        closedAt: record.closedAt ?? new Date().toISOString(),
      };
      return res.status(200).json(body);
    } catch (err) {
      return sendCrmHubError(res, err);
    }
  },
);
