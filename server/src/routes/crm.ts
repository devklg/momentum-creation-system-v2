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
  ReinviteResponse,
  ReinviteScriptResponse,
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
  baCreateProspect,
  baEditProspect,
  baSoftDeleteProspect,
  clearFollowUp,
  getCrmBundle,
  getTodaysActions,
  reinvite,
  reinviteScript,
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
    if (err.code === 'row_unavailable') {
      // The mutation landed but the directory row couldn't be rebuilt —
      // a server-side read failure, not a client error.
      return res.status(500).json({ ok: false, error: 'row_unavailable' });
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
      // No cooldown gate (Chat #147, seq 23) — the BA decides timing.
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

// ── POST /api/crm/:prospectId/reinvite-script (Chat #147, seq 23) ──────────
//
// Surfaces a ready-to-send, compliance-clean re-invite message the BA can
// copy. This NEVER mints/sends/gates — re-invite has no cooldown (seq 23);
// this is just the SCRIPT BUTTON's copy source.

crmRoutes.post(
  '/:prospectId/reinvite-script',
  requireAuth,
  requireMichaelComplete,
  async (req, res) => {
    const sponsorBaId = req.session?.baId;
    if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const prospectId = getProspectId(req);
    if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

    try {
      const result: ReinviteScriptResponse = await reinviteScript(prospectId, sponsorBaId);
      return res.status(200).json(result);
    } catch (err) {
      return sendCrmError(res, err);
    }
  },
);

// ── BA-scoped prospect CRUD (Chat #141) ─────────────────────────────────────
//
// create / edit / soft-delete / restore for a BA's OWN prospects. The domain
// wrappers (crm.ts) force sponsorBaId from the session, run assertOwnership
// on edit/delete/restore, and delegate the real work to the shared
// adminProspectCrud engine with a { kind:'ba' } actor. These routes only
// validate input and map errors — same requireAuth + requireMichaelComplete
// gating as every other crm route.
//
// Reason is required on every mutation (min 8 chars), matching the admin
// CRUD paper-trail rule — the shared engine rejects reason_too_short, but we
// surface a clean 400 before delegating when the field is plainly missing.

const MIN_REASON_LEN = 8;

function trimmedString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function optionalString(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

function nullableString(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === 'string') return v.trim();
  return undefined;
}

// ── POST /api/crm  (create — mint only) ──────────────────────────────────

crmRoutes.post('/', requireAuth, requireMichaelComplete, async (req, res) => {
  const sponsorBaId = req.session?.baId;
  if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const firstName = trimmedString(body.firstName);
  const lastName = trimmedString(body.lastName);
  const city = trimmedString(body.city);
  const stateOrRegion = trimmedString(body.stateOrRegion);
  const reason = trimmedString(body.reason);

  if (!firstName || !lastName) {
    return res.status(400).json({ ok: false, error: 'missing_name' });
  }
  if (!city || !stateOrRegion) {
    return res.status(400).json({ ok: false, error: 'missing_location' });
  }
  if (reason.length < MIN_REASON_LEN) {
    return res.status(400).json({ ok: false, error: 'reason_too_short' });
  }

  try {
    const created = await baCreateProspect(sponsorBaId, {
      firstName,
      lastName,
      city,
      stateOrRegion,
      country: optionalString(body.country),
      phone: nullableString(body.phone),
      email: nullableString(body.email),
      reason,
    });
    return res.status(201).json({
      ok: true,
      prospectId: created.prospectId,
      token: created.token,
      inviteUrl: created.inviteUrl,
      row: created.row,
    });
  } catch (err) {
    return sendCrmError(res, err);
  }
});

// ── PUT /api/crm/:prospectId  (edit ordinary fields) ─────────────────────

crmRoutes.put('/:prospectId', requireAuth, requireMichaelComplete, async (req, res) => {
  const sponsorBaId = req.session?.baId;
  if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const prospectId = getProspectId(req);
  if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const reason = trimmedString(body.reason);
  if (reason.length < MIN_REASON_LEN) {
    return res.status(400).json({ ok: false, error: 'reason_too_short' });
  }

  try {
    const result = await baEditProspect(prospectId, sponsorBaId, {
      firstName: optionalString(body.firstName),
      lastName: optionalString(body.lastName),
      city: optionalString(body.city),
      stateOrRegion: optionalString(body.stateOrRegion),
      country: optionalString(body.country),
      phone: nullableString(body.phone),
      email: nullableString(body.email),
      reason,
    });
    return res.status(200).json({ ok: true, prospectId: result.prospectId, row: result.row });
  } catch (err) {
    return sendCrmError(res, err);
  }
});

// ── DELETE /api/crm/:prospectId  (soft delete — tank untouched) ────────────

crmRoutes.delete('/:prospectId', requireAuth, requireMichaelComplete, async (req, res) => {
  const sponsorBaId = req.session?.baId;
  if (!sponsorBaId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const prospectId = getProspectId(req);
  if (!prospectId) return res.status(400).json({ ok: false, error: 'missing_prospect_id' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const reason = trimmedString(body.reason);
  if (reason.length < MIN_REASON_LEN) {
    return res.status(400).json({ ok: false, error: 'reason_too_short' });
  }

  try {
    const result = await baSoftDeleteProspect(prospectId, sponsorBaId, reason);
    return res.status(200).json({
      ok: true,
      prospectId: result.prospectId,
      deletedAt: result.deletedAt,
    });
  } catch (err) {
    return sendCrmError(res, err);
  }
});

// ── POST /api/crm/:prospectId/restore — REMOVED (Chat #141) ─────────────────
//
// Restore is ADMIN-ONLY (Kevin, Chat #141). A BA can soft-delete their own
// prospect from the cockpit but cannot undo it — recovery is a Kevin lever
// from /admin (adminRestoreProspect + POST /api/admin/prospects/:id/restore).
// The BA-scoped restore wrapper and this route were removed deliberately;
// the admin engine restore stays intact.
