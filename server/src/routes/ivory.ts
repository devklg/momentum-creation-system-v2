/**
 * /api/ivory — BA-private warm-market roster + LLM coach + Generator runs.
 *
 * Chat #131 — wireframe §3.4 invitation engine (the Generator + Ivory pair
 * that ScriptMaker is the per-name complement to).
 *
 * Mount point in server/src/index.ts:
 *   app.use('/api/ivory', ivoryRoutes);   // BA-FACING GATED block
 *
 * Every route applies (requireAuth, requireMichaelComplete) per the
 * canonical pattern. baId comes from the session, never from the body or
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
  CreateGeneratorRunPayload,
  CreateGeneratorRunResponse,
  CreateIvoryNamePayload,
  GeneratorInvitePayload,
  GeneratorInviteResponse,
  GeneratorRunResponse,
  IvoryCategory,
  IvoryCoachPayload,
  IvoryCoachResponse,
  IvoryNameResponse,
  IvoryStatus,
  ListIvoryNamesResponse,
  UpdateIvoryNamePayload,
  UpdateIvoryStatusPayload,
} from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
import {
  createIvoryName,
  deleteIvoryName,
  ivoryCoach,
  IvoryNotFoundError,
  IvoryOwnershipError,
  IvoryValidationError,
  listIvoryNamesForBA,
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

export const ivoryRoutes: Router = Router();

const NAME_MAX = 80;
const NOTES_MAX = 1200;
const ASK_MAX = 600;
const PRODUCT_NAME_MAX = 120;

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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    try {
      const names = await listIvoryNamesForBA(baId);
      const body: ListIvoryNamesResponse = { ok: true, names };
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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = req.body as Partial<CreateIvoryNamePayload>;
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
      ? (body.categories.filter((c) => typeof c === 'string') as IvoryCategory[])
      : undefined;

    try {
      const name = await createIvoryName(baId, {
        firstName,
        lastName,
        notes,
        categories,
        preferredAngle: body?.preferredAngle,
      });
      const out: IvoryNameResponse = { ok: true, name };
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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const ivoryId = paramStr(req.params.ivoryId);
    if (!ivoryId) return res.status(400).json({ ok: false, error: 'missing_ivory_id' });

    const body = req.body as Partial<UpdateIvoryNamePayload>;
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
      const name = await updateIvoryName(ivoryId, baId, {
        firstName: body?.firstName,
        lastName: body?.lastName,
        notes: body?.notes,
        categories: body?.categories,
        preferredAngle: body?.preferredAngle,
      });
      const out: IvoryNameResponse = { ok: true, name };
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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const ivoryId = paramStr(req.params.ivoryId);
    if (!ivoryId) return res.status(400).json({ ok: false, error: 'missing_ivory_id' });

    const body = req.body as Partial<UpdateIvoryStatusPayload>;
    const status = body?.status;
    if (typeof status !== 'string') {
      return res.status(400).json({ ok: false, error: 'invalid_status' });
    }

    try {
      const name = await updateIvoryStatus(ivoryId, baId, status as IvoryStatus);
      const out: IvoryNameResponse = { ok: true, name };
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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const ivoryId = paramStr(req.params.ivoryId);
    if (!ivoryId) return res.status(400).json({ ok: false, error: 'missing_ivory_id' });

    try {
      await deleteIvoryName(ivoryId, baId);
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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = req.body as Partial<IvoryCoachPayload>;
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
      const out: IvoryCoachResponse = result;
      return res.status(200).json(out);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[POST /api/ivory/coach] failed', err);
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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = req.body as Partial<CreateGeneratorRunPayload>;
    const productKey = requiredStr(body?.productKey);
    const angle = body?.angle ?? 'unspecified';
    if (!productKey) {
      return res.status(400).json({ ok: false, error: 'invalid_product_key' });
    }
    const selectedIvoryIds = Array.isArray(body?.selectedIvoryIds)
      ? body.selectedIvoryIds.filter((s): s is string => typeof s === 'string')
      : [];

    try {
      const run = await createGeneratorRun(baId, {
        productKey,
        angle,
        selectedIvoryIds,
      });
      const out: CreateGeneratorRunResponse = { ok: true, run };
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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const runId = paramStr(req.params.runId);
    if (!runId) return res.status(400).json({ ok: false, error: 'missing_run_id' });

    try {
      const run = await getGeneratorRun(runId, baId);
      const out: GeneratorRunResponse = { ok: true, run };
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
  requireMichaelComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const runId = paramStr(req.params.runId);
    if (!runId) return res.status(400).json({ ok: false, error: 'missing_run_id' });

    const body = req.body as Partial<GeneratorInvitePayload>;
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
        baId,
        ivoryId,
        message,
        city,
        stateOrRegion,
        phone,
        email,
      });
      const out: GeneratorInviteResponse = {
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
