/**
 * /api/ivory — BA-private warm-market roster + LLM coach + Generator runs.
 *
 * Chat #131 — wireframe §3.4 invitation engine (the Generator + Ivory pair
 * that ScriptMaker is the per-name complement to).
 *
 * Mount point in server/src/index.ts:
 *   app.use('/api/ivory', ivoryRoutes);   // BA-FACING GATED block
 *
 * Every route applies (requireAuth, requireSteveComplete) per the
 * canonical pattern. tmagId comes from the session, never from the body or
 * the URL — Ivory is BA-private and the spine enforces it.
 *
 * Endpoints:
 *   GET    /                              → list current BA's roster
 *   POST   /                              → add a name
 *   PATCH  /:ivoryId                      → edit name/notes/categories/angle
 *   PATCH  /:ivoryId/status               → change disposition
 *   DELETE /:ivoryId                      → remove
 *   POST   /coach                         → WDYK coaching prompts (LLM, degrades)
 *   POST   /generator/run                 → open a Generator run
 *   GET    /generator/run/:runId          → fetch a run (UI restore)
 *   POST   /generator/run/:runId/invite   → mint one /p/{token} for one name
 *
 * Validation is shallow at the route layer (presence, lengths, allowed-set
 * membership). Deep validation + ownership checks live in the domain.
 */

import { Router } from 'express';
import type {
  McsCreateGeneratorRunPayload,
  McsCreateGeneratorRunResponse,
  McsCreateIvoryNamePayload,
  McsGeneratorInvitePayload,
  McsGeneratorInviteResponse,
  McsGeneratorRunResponse,
  McsIvoryCategory,
  McsIvoryCoachPayload,
  McsIvoryCoachResponse,
  McsIvoryInvitationDraftPayload,
  McsIvoryInvitationDraftResponse,
  McsIvoryInvitationMintPayload,
  McsIvoryInvitationMintResponse,
  McsIvoryNameResponse,
  McsIvoryStatus,
  McsListIvoryNamesResponse,
  McsUpdateIvoryNamePayload,
  McsUpdateIvoryStatusPayload,
} from '@momentum/shared';
import { appendGeneratedOutputAudit } from '../domain/generatedOutputAudit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  createIvoryName,
  deleteIvoryName,
  draftIvoryInvitation,
  ivoryCoach,
  IvoryNotFoundError,
  IvoryOwnershipError,
  IvoryValidationError,
  listIvoryNamesForBA,
  mintIvoryInvitation,
  updateIvoryName,
  updateIvoryStatus,
} from '../domain/ivory.js';
import {
  createGeneratorRun,
  getGeneratorRun,
  mintInvitationForRun,
  GeneratorNotFoundError,
  GeneratorOwnershipError,
  GeneratorValidationError,
} from '../domain/generator.js';
import {
  getIvoryMomentumView,
  suggestIvoryMomentumFollowUp,
  IvoryMomentumNotFoundError,
  IvoryMomentumOwnershipError,
  IvoryMomentumValidationError,
} from '../domain/ivory-momentum.js';
import type {
  McsIvoryMomentumSuggestionPayload,
  McsIvoryMomentumSuggestionResponse,
  McsIvoryMomentumViewResponse,
} from '@momentum/shared';

export const ivoryRoutes: Router = Router();

const NAME_MAX = 80;
const NOTES_MAX = 1200;
const ASK_MAX = 600;
const PRODUCT_NAME_MAX = 120;
const RELATIONSHIP_REASON_MAX = 600;
const MESSAGE_MAX = 1200;

function requiredStr(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}
function optionalStr(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}
/** Express params can be string|string[]; flatten safely. */
function paramStr(p: string | string[] | undefined): string {
  if (Array.isArray(p)) return typeof p[0] === 'string' ? p[0] : '';
  return typeof p === 'string' ? p : '';
}

// ───────────────────────────────────────────────────────────────────────
// Roster
// ───────────────────────────────────────────────────────────────────────

ivoryRoutes.get(
  '/',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    try {
      const names = await listIvoryNamesForBA(tmagId);
      const body: McsListIvoryNamesResponse = { ok: true, names };
      return res.status(200).json(body);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/ivory] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

ivoryRoutes.post(
  '/',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = req.body as Partial<McsCreateIvoryNamePayload>;
    const firstName = requiredStr(body?.firstName);
    const lastName = requiredStr(body?.lastName);
    if (!firstName || firstName.length > NAME_MAX) {
      return res.status(400).json({ ok: false, error: 'invalid_first_name' });
    }
    if (!lastName || lastName.length > NAME_MAX) {
      return res.status(400).json({ ok: false, error: 'invalid_last_name' });
    }
    const notes = typeof body?.notes === 'string' ? body.notes : '';
    if (notes.length > NOTES_MAX) {
      return res.status(400).json({ ok: false, error: 'notes_too_long' });
    }
    const categories = Array.isArray(body?.categories)
      ? (body.categories.filter((c) => typeof c === 'string') as McsIvoryCategory[])
      : undefined;

    try {
      const name = await createIvoryName(tmagId, {
        firstName,
        lastName,
        notes,
        categories,
        preferredAngle: body?.preferredAngle,
      });
      const out: McsIvoryNameResponse = { ok: true, name };
      return res.status(201).json(out);
    } catch (err) {
      if (err instanceof IvoryValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/ivory] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

ivoryRoutes.patch(
  '/:ivoryId',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const ivoryId = paramStr(req.params.ivoryId);
    if (!ivoryId) return res.status(400).json({ ok: false, error: 'missing_ivory_id' });

    const body = req.body as Partial<McsUpdateIvoryNamePayload>;
    if (typeof body?.firstName === 'string' && body.firstName.length > NAME_MAX) {
      return res.status(400).json({ ok: false, error: 'invalid_first_name' });
    }
    if (typeof body?.lastName === 'string' && body.lastName.length > NAME_MAX) {
      return res.status(400).json({ ok: false, error: 'invalid_last_name' });
    }
    if (typeof body?.notes === 'string' && body.notes.length > NOTES_MAX) {
      return res.status(400).json({ ok: false, error: 'notes_too_long' });
    }

    try {
      const name = await updateIvoryName(ivoryId, tmagId, {
        firstName: body?.firstName,
        lastName: body?.lastName,
        notes: body?.notes,
        categories: body?.categories,
        preferredAngle: body?.preferredAngle,
      });
      const out: McsIvoryNameResponse = { ok: true, name };
      return res.status(200).json(out);
    } catch (err) {
      if (err instanceof IvoryNotFoundError) {
        return res.status(404).json({ ok: false, error: 'ivory_not_found' });
      }
      if (err instanceof IvoryOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      if (err instanceof IvoryValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[PATCH /api/ivory/:ivoryId] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

ivoryRoutes.patch(
  '/:ivoryId/status',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const ivoryId = paramStr(req.params.ivoryId);
    if (!ivoryId) return res.status(400).json({ ok: false, error: 'missing_ivory_id' });

    const body = req.body as Partial<McsUpdateIvoryStatusPayload>;
    const status = body?.status;
    if (typeof status !== 'string') {
      return res.status(400).json({ ok: false, error: 'invalid_status' });
    }

    try {
      const name = await updateIvoryStatus(ivoryId, tmagId, status as McsIvoryStatus);
      const out: McsIvoryNameResponse = { ok: true, name };
      return res.status(200).json(out);
    } catch (err) {
      if (err instanceof IvoryNotFoundError) {
        return res.status(404).json({ ok: false, error: 'ivory_not_found' });
      }
      if (err instanceof IvoryOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      if (err instanceof IvoryValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[PATCH /api/ivory/:ivoryId/status] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

ivoryRoutes.delete(
  '/:ivoryId',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const ivoryId = paramStr(req.params.ivoryId);
    if (!ivoryId) return res.status(400).json({ ok: false, error: 'missing_ivory_id' });

    try {
      await deleteIvoryName(ivoryId, tmagId);
      return res.status(200).json({ ok: true });
    } catch (err) {
      if (err instanceof IvoryNotFoundError) {
        return res.status(404).json({ ok: false, error: 'ivory_not_found' });
      }
      if (err instanceof IvoryOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      // eslint-disable-next-line no-console
      console.error('[DELETE /api/ivory/:ivoryId] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// Coach
// ───────────────────────────────────────────────────────────────────────

ivoryRoutes.post(
  '/coach',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = req.body as Partial<McsIvoryCoachPayload>;
    const angle = body?.angle ?? 'unspecified';
    const ask = typeof body?.ask === 'string' ? body.ask : '';
    if (ask.length > ASK_MAX) {
      return res.status(400).json({ ok: false, error: 'ask_too_long' });
    }
    const productNameRaw = optionalStr(body?.productName);
    if (productNameRaw && productNameRaw.length > PRODUCT_NAME_MAX) {
      return res.status(400).json({ ok: false, error: 'invalid_product_name' });
    }
    const rosterSize =
      typeof body?.rosterSize === 'number' && body.rosterSize >= 0
        ? Math.floor(body.rosterSize)
        : 0;

    try {
      const result = await ivoryCoach({
        angle,
        productName: productNameRaw,
        rosterSize,
        ask,
      });
      await appendGeneratedOutputAudit({
        templateId: 'ivory_wdyk_coach',
        tmagId,
        input: {
          classification: 'ivory_wdyk_coach',
          angle,
          rosterSize,
          productNameProvided: productNameRaw !== null,
          askProvided: ask.trim().length > 0,
          askLength: ask.length,
        },
        output: [result.coaching, ...result.prompts],
        degraded: result.degraded,
        context: {
          ip: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
          route: '/api/ivory/coach',
          method: 'POST',
          requestId: null,
        },
      });
      const out: McsIvoryCoachResponse = result;
      return res.status(200).json(out);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[POST /api/ivory/coach] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// Invitation Agent
// ───────────────────────────────────────────────────────────────────────

ivoryRoutes.post(
  '/invitation-agent/draft',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = req.body as Partial<McsIvoryInvitationDraftPayload>;
    const ivoryId = requiredStr(body?.ivoryId);
    const relationshipReason = requiredStr(body?.relationshipReason);
    if (!ivoryId) return res.status(400).json({ ok: false, error: 'invalid_ivory_id' });
    if (!relationshipReason) {
      return res.status(400).json({ ok: false, error: 'missing_relationship_reason' });
    }
    if (relationshipReason.length > RELATIONSHIP_REASON_MAX) {
      return res.status(400).json({ ok: false, error: 'relationship_reason_too_long' });
    }
    const productName = optionalStr(body?.productName);
    if (productName && productName.length > PRODUCT_NAME_MAX) {
      return res.status(400).json({ ok: false, error: 'invalid_product_name' });
    }

    try {
      const result = await draftIvoryInvitation(tmagId, {
        ivoryId,
        relationshipReason,
        productName,
      });
      await appendGeneratedOutputAudit({
        templateId: 'ivory_personal_invitation',
        tmagId,
        input: {
          classification: 'ivory_personal_invitation',
          ivoryRecordProvided: true,
          relationshipReasonProvided: true,
          relationshipReasonLength: relationshipReason.length,
          productNameProvided: productName !== null,
        },
        output: result.draft,
        degraded: result.degraded,
        context: {
          ip: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
          route: '/api/ivory/invitation-agent/draft',
          method: 'POST',
          requestId: null,
        },
      });
      const out: McsIvoryInvitationDraftResponse = result;
      return res.status(200).json(out);
    } catch (err) {
      if (err instanceof IvoryNotFoundError) {
        return res.status(404).json({ ok: false, error: 'ivory_not_found' });
      }
      if (err instanceof IvoryOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      if (err instanceof IvoryValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/ivory/invitation-agent/draft] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

ivoryRoutes.post(
  '/invitation-agent/mint',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = req.body as Partial<McsIvoryInvitationMintPayload>;
    const ivoryId = requiredStr(body?.ivoryId);
    const relationshipReason = requiredStr(body?.relationshipReason);
    const message = requiredStr(body?.message);
    const city = requiredStr(body?.city);
    const stateOrRegion = requiredStr(body?.stateOrRegion);
    const phone = requiredStr(body?.phone);
    const email = optionalStr(body?.email);

    if (!ivoryId) return res.status(400).json({ ok: false, error: 'invalid_ivory_id' });
    if (!relationshipReason) {
      return res.status(400).json({ ok: false, error: 'missing_relationship_reason' });
    }
    if (relationshipReason.length > RELATIONSHIP_REASON_MAX) {
      return res.status(400).json({ ok: false, error: 'relationship_reason_too_long' });
    }
    if (!message) return res.status(400).json({ ok: false, error: 'missing_message' });
    if (message.length > MESSAGE_MAX) {
      return res.status(400).json({ ok: false, error: 'message_too_long' });
    }
    if (!city || city.length > 120) {
      return res.status(400).json({ ok: false, error: 'invalid_city' });
    }
    if (!stateOrRegion || stateOrRegion.length > 120) {
      return res.status(400).json({ ok: false, error: 'invalid_state' });
    }
    if (!phone) return res.status(400).json({ ok: false, error: 'phone_required' });

    try {
      const result = await mintIvoryInvitation(tmagId, {
        ivoryId,
        relationshipReason,
        message,
        city,
        stateOrRegion,
        phone,
        email,
      });
      const out: McsIvoryInvitationMintResponse = result;
      return res.status(201).json(out);
    } catch (err) {
      if (err instanceof IvoryNotFoundError) {
        return res.status(404).json({ ok: false, error: 'ivory_not_found' });
      }
      if (err instanceof IvoryOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      if (err instanceof IvoryValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/ivory/invitation-agent/mint] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// Generator
// ───────────────────────────────────────────────────────────────────────

ivoryRoutes.post(
  '/generator/run',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = req.body as Partial<McsCreateGeneratorRunPayload>;
    const productKey = requiredStr(body?.productKey);
    const angle = body?.angle ?? 'unspecified';
    if (!productKey) {
      return res.status(400).json({ ok: false, error: 'invalid_product_key' });
    }
    const selectedIvoryIds = Array.isArray(body?.selectedIvoryIds)
      ? body.selectedIvoryIds.filter((s): s is string => typeof s === 'string')
      : [];

    try {
      const run = await createGeneratorRun(tmagId, {
        productKey,
        angle,
        selectedIvoryIds,
      });
      const out: McsCreateGeneratorRunResponse = { ok: true, run };
      return res.status(201).json(out);
    } catch (err) {
      if (err instanceof GeneratorValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/ivory/generator/run] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

ivoryRoutes.get(
  '/generator/run/:runId',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const runId = paramStr(req.params.runId);
    if (!runId) return res.status(400).json({ ok: false, error: 'missing_run_id' });

    try {
      const run = await getGeneratorRun(runId, tmagId);
      const out: McsGeneratorRunResponse = { ok: true, run };
      return res.status(200).json(out);
    } catch (err) {
      if (err instanceof GeneratorNotFoundError) {
        return res.status(404).json({ ok: false, error: 'run_not_found' });
      }
      if (err instanceof GeneratorOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      // eslint-disable-next-line no-console
      console.error('[GET /api/ivory/generator/run/:runId] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

ivoryRoutes.post(
  '/generator/run/:runId/invite',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const runId = paramStr(req.params.runId);
    if (!runId) return res.status(400).json({ ok: false, error: 'missing_run_id' });

    const body = req.body as Partial<McsGeneratorInvitePayload>;
    const ivoryId = requiredStr(body?.ivoryId);
    if (!ivoryId) {
      return res.status(400).json({ ok: false, error: 'invalid_ivory_id' });
    }
    const message = typeof body?.message === 'string' ? body.message : null;
    const city = typeof body?.city === 'string' ? body.city : '';
    const stateOrRegion =
      typeof body?.stateOrRegion === 'string' ? body.stateOrRegion : '';
    const phone = typeof body?.phone === 'string' ? body.phone : null;
    const email = typeof body?.email === 'string' ? body.email : null;

    try {
      const result = await mintInvitationForRun({
        runId,
        tmagId,
        ivoryId,
        message,
        city,
        stateOrRegion,
        phone,
        email,
      });
      const out: McsGeneratorInviteResponse = {
        ok: true,
        run: result.run,
        invitation: {
          ivoryId,
          prospectId: result.prospectId,
          token: result.token,
          inviteUrl: result.inviteUrl,
          createdAt: result.createdAt,
          expiresAt: result.expiresAt,
        },
      };
      return res.status(201).json(out);
    } catch (err) {
      if (err instanceof GeneratorNotFoundError) {
        return res.status(404).json({ ok: false, error: 'run_not_found' });
      }
      if (err instanceof GeneratorOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      if (err instanceof IvoryNotFoundError) {
        return res.status(404).json({ ok: false, error: 'ivory_not_found' });
      }
      if (err instanceof IvoryOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      if (err instanceof GeneratorValidationError || err instanceof IvoryValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/ivory/generator/run/:runId/invite] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

// ───────────────────────────────────────────────────────────────────────
// Prospect Momentum Agent (feature/ivory-momentum-agent)
//
// Post-mint cohort view + per-prospect follow-up suggestion. Reuses the
// canonical PMV projection (cockpit domain) so lifecycle/nextAction can
// never disagree with what /cockpit shows; enriches each Ivory-sourced row
// with the BA's warm-market context (categories, angle, memory note).
// All handlers apply (requireAuth, requireSteveComplete) per the
// canonical pattern. tmagId is read from the session, never the body.
// ───────────────────────────────────────────────────────────────────────

ivoryRoutes.get(
  '/momentum',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    try {
      const view = await getIvoryMomentumView(tmagId);
      const out: McsIvoryMomentumViewResponse = view;
      return res.status(200).json(out);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/ivory/momentum] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

ivoryRoutes.post(
  '/momentum/:prospectId/suggest',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const prospectId = paramStr(req.params.prospectId);
    if (!prospectId) {
      return res.status(400).json({ ok: false, error: 'missing_prospect_id' });
    }

    const body = req.body as Partial<McsIvoryMomentumSuggestionPayload>;
    const ask = typeof body?.ask === 'string' ? body.ask : '';
    if (ask.length > ASK_MAX) {
      return res.status(400).json({ ok: false, error: 'ask_too_long' });
    }

    try {
      const result = await suggestIvoryMomentumFollowUp(tmagId, prospectId, { ask });
      await appendGeneratedOutputAudit({
        templateId: 'ivory_momentum_followup',
        tmagId,
        input: {
          classification: 'ivory_momentum_followup',
          ownedProspectProvided: true,
          askProvided: ask.trim().length > 0,
          askLength: ask.length,
        },
        output: [result.coaching, result.suggestion],
        degraded: result.degraded,
        context: {
          ip: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
          route: '/api/ivory/momentum/:prospectId/suggest',
          method: 'POST',
          requestId: null,
        },
      });
      const out: McsIvoryMomentumSuggestionResponse = result;
      return res.status(200).json(out);
    } catch (err) {
      if (err instanceof IvoryMomentumNotFoundError) {
        return res.status(404).json({ ok: false, error: 'prospect_not_found' });
      }
      if (err instanceof IvoryMomentumOwnershipError) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      if (err instanceof IvoryMomentumValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/ivory/momentum/:prospectId/suggest] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);
