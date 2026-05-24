/**
 * /api/crm/* — BA CRM write-side routes (Chat #132, wireframe 3.3).
 *
 * The WRITE companion to /api/cockpit/*. The cockpit READS what the BA's
 * pipeline looks like; these endpoints let the BA ACT on it.
 *
 * Routes:
 *   GET    /api/crm/today                       Today's Actions card
 *   GET    /api/crm/:prospectId                 per-prospect CRM bundle
 *   POST   /api/crm/:prospectId/notes           { text }
 *   POST   /api/crm/:prospectId/followup        { dueAt }
 *   DELETE /api/crm/:prospectId/followup        clear active follow-up
 *   POST   /api/crm/:prospectId/disposition     { disposition: 5-tag | null }
 *   POST   /api/crm/:prospectId/reinvite        bump sentAt; mint fresh if expired
 *
 * Gating: requireAuth + requireMichaelComplete on every handler — BA-facing
 * gated routes per server/index.ts canonical pattern.
 *
 * Sponsor immutability (locked-spec 3.5): sponsorBaId comes from
 * req.session.baId ONLY; the domain's assertOwnership() verifies the
 * prospect belongs to that BA before any mutation. A sponsorBaId in the
 * body is ignored. Cross-BA writes are impossible by construction.
 */

import { Router } from 'express';
import type {
  ClearFollowUpResponse,
  CreateNotePayload,
  CreateNoteResponse,
  CrmBundleResponse,
  ReinviteCooldownError,
  ReinviteResponse,
  ReinviteTerminalError,
  ReinviteUnsentError,
  SetDispositionPayload,
  SetDispositionResponse,
  SetFollowUpPayload,
  SetFollowUpResponse,
  TodaysActionsResponse,
} from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
import {
  CrmError,
  addNote,
  clearFollowUp,
  getCrmBundle,
  getTodaysActions,
  reinvite,
  setDisposition,
  setFollowUp,
} from '../domain/crm.js';

export const crmRoutes: Router = Router();

/** Map a CrmError to the right HTTP status + payload. */
function sendCrmError(
  res: import('express').Response,
  err: unknown,
): import('express').Response {
  if (err instanceof CrmError) {
    if (err.code === 'prospect_not_found') {
      return res.status(404).json({ ok: false, error: 'prospect_not_found' });
    }
    if (err.code === 'sponsor_mismatch') {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    // 400-class validation errors
    return res.status(400).json({ ok: false, error: err.code });
  }
  // eslint-disable-next-line no-console
  console.error('[crm route] unexpected error', err);
  return res.status(500).json({ ok: false, error: 'server_error' });
}

function getProspectId(req: import('express').Request): string {
  const raw = req.params.prospectId;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

// ── GET /api/crm/today ────────────────────────────────────────────────────

crmRoutes.get('/today', requireAuth, requireMichaelComplete, async (req, res) => {
  const sponsorBaId = req.session?.baId;
  if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  try {
    const actions = await getTodaysActions(sponsorBaId);
    const payload: TodaysActionsResponse = { ok: true, actions };
    return res.status(200).json(payload);
  } catch (err) {
    return sendCrmError(res, err);
  }
});

// ── GET /api/crm/:prospectId ──────────────────────────────────────────────

crmRoutes.get('/:prospectId', requireAuth, requireMichaelComplete, async (req, res) => {
  const sponsorBaId = req.session?.baId;
  if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const prospectId = getProspectId(req);
  if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

  try {
    const bundle = await getCrmBundle(prospectId, sponsorBaId);
    const payload: CrmBundleResponse = { ok: true, bundle };
    return res.status(200).json(payload);
  } catch (err) {
    return sendCrmError(res, err);
  }
});

// ── POST /api/crm/:prospectId/notes ───────────────────────────────────────

crmRoutes.post(
  '/:prospectId/notes',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const sponsorBaId = req.session?.baId;
    if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const prospectId = getProspectId(req);
    if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

    const body = req.body as Partial<CreateNotePayload> | undefined;
    const text = typeof body?.text === 'string' ? body.text : '';

    try {
      const note = await addNote(prospectId, sponsorBaId, text);
      const payload: CreateNoteResponse = { ok: true, note };
      return res.status(201).json(payload);
    } catch (err) {
      return sendCrmError(res, err);
    }
  },
);

// ── POST /api/crm/:prospectId/followup ────────────────────────────────────

crmRoutes.post(
  '/:prospectId/followup',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const sponsorBaId = req.session?.baId;
    if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const prospectId = getProspectId(req);
    if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

    const body = req.body as Partial<SetFollowUpPayload> | undefined;
    const dueAt = typeof body?.dueAt === 'string' ? body.dueAt : '';
    if (!dueAt) return res.status(400).json({ ok: false, error: 'missing_due_at' });

    try {
      const followUp = await setFollowUp(prospectId, sponsorBaId, dueAt);
      const payload: SetFollowUpResponse = { ok: true, followUp };
      return res.status(200).json(payload);
    } catch (err) {
      return sendCrmError(res, err);
    }
  },
);

// ── DELETE /api/crm/:prospectId/followup ──────────────────────────────────

crmRoutes.delete(
  '/:prospectId/followup',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const sponsorBaId = req.session?.baId;
    if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const prospectId = getProspectId(req);
    if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

    try {
      await clearFollowUp(prospectId, sponsorBaId);
      const payload: ClearFollowUpResponse = { ok: true };
      return res.status(200).json(payload);
    } catch (err) {
      return sendCrmError(res, err);
    }
  },
);

// ── POST /api/crm/:prospectId/disposition ─────────────────────────────────

crmRoutes.post(
  '/:prospectId/disposition',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const sponsorBaId = req.session?.baId;
    if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const prospectId = getProspectId(req);
    if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

    const body = req.body as Partial<SetDispositionPayload> | undefined;
    // Distinguish "absent" from "explicitly null". The route treats undefined
    // as a missing field (400) and null as an explicit clear.
    if (body === undefined || !('disposition' in body)) {
      return res.status(400).json({ ok: false, error: 'missing_disposition' });
    }
    const dispo = body.disposition ?? null;

    try {
      const disposition = await setDisposition(prospectId, sponsorBaId, dispo);
      const payload: SetDispositionResponse = { ok: true, disposition };
      return res.status(200).json(payload);
    } catch (err) {
      return sendCrmError(res, err);
    }
  },
);

// ── POST /api/crm/:prospectId/reinvite ────────────────────────────────────

crmRoutes.post(
  '/:prospectId/reinvite',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const sponsorBaId = req.session?.baId;
    if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const prospectId = getProspectId(req);
    if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

    try {
      const result: ReinviteResponse = await reinvite(prospectId, sponsorBaId);
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof CrmError && err.code === 'cooldown') {
        // 429 — needs to wait. The bundle endpoint surfaces the exact time;
        // the client can re-fetch the bundle to render the countdown.
        const body: ReinviteCooldownError = {
          ok: false,
          error: 'cooldown',
          availableAt: new Date().toISOString(), // placeholder; UI re-fetches bundle for the real time
        };
        return res.status(429).json(body);
      }
      if (err instanceof CrmError && err.code === 'not_yet_sent') {
        const body: ReinviteUnsentError = { ok: false, error: 'not_yet_sent' };
        return res.status(409).json(body);
      }
      if (err instanceof CrmError && err.code === 'enrolled') {
        const body: ReinviteTerminalError = { ok: false, error: 'enrolled' };
        return res.status(409).json(body);
      }
      return sendCrmError(res, err);
    }
  },
);
