/**
 * /api/admin/broadcast — ADMIN Section G (Chat #144 fan-out).
 *
 * Kevin-only composer surface. All routes go through `requireAdmin` (which
 * already 403s a non-admin with a generic "Not found." per ADMIN A.2 — no
 * indication that /admin exists). Every send is audited via the 4.J
 * substrate inside the domain layer.
 *
 * Routes:
 *   GET    /audience        G.2 — live audience count + STOP exclusion preview
 *   GET    /list            recent broadcasts (composer landing)
 *   GET    /:broadcastId    G.5 — status snapshot (counts + recent rows)
 *   POST   /test            G.4 — send-test-to-Kevin (one recipient, inline)
 *   POST   /                G.5 — enqueue master broadcast
 *
 * Route order matters: /audience, /list, and /test must mount BEFORE
 * /:broadcastId or Express resolves them as a broadcastId.
 *
 * Compliance: BA-facing only. The audience domain layer NEVER returns
 * prospects. STOP exclusion is enforced server-side at audience
 * resolution (G.6), never client-side.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import {
  BroadcastValidationError,
  enqueueBroadcast,
  getBroadcastById,
  getBroadcastCounts,
  listRecentBroadcasts,
  listRecentRecipientRows,
  prepareSendTest,
  resolveAudience,
} from '../../domain/broadcast.js';
import { dispatchOne } from '../../services/broadcastQueue.js';
import { findBAByBaId } from '../../domain/ba.js';
import type {
  AuditActor,
  BroadcastAudiencePreviewResponse,
  BroadcastEnqueueResponse,
  BroadcastSendTestResponse,
  BroadcastStatusResponse,
} from '@momentum/shared';

export const adminBroadcastRoutes: Router = express.Router();

/* ─── shared parsing ─────────────────────────────────────────────── */

const PresetSchema = z.enum(['all', 'first_72h', 'leaders', 'at_risk', 'custom']);
const ChannelSchema = z.enum(['sms', 'email', 'both']);

const TemplateSchema = z.object({
  smsText: z.string().max(2000).nullable(),
  emailSubject: z.string().max(300).nullable(),
  emailText: z.string().max(50_000).nullable(),
});

const EnqueueBodySchema = z.object({
  audiencePreset: PresetSchema,
  customAudienceBaIds: z.array(z.string().min(2).max(80)).optional(),
  channel: ChannelSchema,
  template: TemplateSchema,
});

const SendTestBodySchema = z.object({
  channel: ChannelSchema,
  template: TemplateSchema,
});

async function adminActorFromRequest(
  req: Request,
): Promise<{ actor: AuditActor & { kind: 'admin' }; displayName: string }> {
  const session = req.session!;
  // Resolve a friendly display name. The session may carry `fullName`;
  // fall back to looking up the BA record.
  let displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.baId;
  if (displayName === session.baId) {
    const ba = await findBAByBaId(session.baId);
    if (ba) displayName = `${ba.firstName} ${ba.lastName}`.trim() || session.baId;
  }
  return {
    actor: { kind: 'admin', baId: session.baId, displayName },
    displayName,
  };
}

/* ─── GET /audience — G.2 audience preview ────────────────────── */

adminBroadcastRoutes.get('/audience', requireAdmin, async (req: Request, res: Response) => {
  const presetParse = PresetSchema.safeParse(req.query.preset);
  const channelParse = ChannelSchema.safeParse(req.query.channel);
  if (!presetParse.success || !channelParse.success) {
    res.status(400).json({ ok: false, error: 'Invalid preset or channel.' });
    return;
  }
  const customRaw = req.query.customBaIds;
  let customAudienceBaIds: string[] | null = null;
  if (typeof customRaw === 'string' && customRaw.length > 0) {
    customAudienceBaIds = customRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(customRaw)) {
    customAudienceBaIds = customRaw
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);
  }

  try {
    const { preview } = await resolveAudience(
      presetParse.data,
      channelParse.data,
      customAudienceBaIds,
    );
    const body: BroadcastAudiencePreviewResponse = { ok: true, preview };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Audience preview failed: ${msg}` });
  }
});

/* ─── GET /list — recent broadcasts (landing) ─────────────────── */

adminBroadcastRoutes.get('/list', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const broadcasts = await listRecentBroadcasts(20);
    res.json({ ok: true, broadcasts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `List failed: ${msg}` });
  }
});

/* ─── GET /:broadcastId — G.5 status snapshot ─────────────────── */

const StatusParams = z.object({ broadcastId: z.string().min(8).max(120) });

adminBroadcastRoutes.get('/:broadcastId', requireAdmin, async (req: Request, res: Response) => {
  const params = StatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: 'Invalid broadcastId.' });
    return;
  }
  try {
    const broadcast = await getBroadcastById(params.data.broadcastId);
    if (!broadcast) {
      res.status(404).json({ ok: false, error: 'Broadcast not found.' });
      return;
    }
    const [counts, recentRows] = await Promise.all([
      getBroadcastCounts(broadcast.broadcastId),
      listRecentRecipientRows(broadcast.broadcastId, 50),
    ]);
    const body: BroadcastStatusResponse = {
      ok: true,
      broadcast,
      counts,
      recentRows,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Status failed: ${msg}` });
  }
});

/* ─── POST /test — G.4 send-test-to-Kevin ─────────────────────── */

adminBroadcastRoutes.post('/test', requireAdmin, async (req: Request, res: Response) => {
  const body = SendTestBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'Invalid send-test payload.', issues: body.error.issues });
    return;
  }
  const { actor, displayName } = await adminActorFromRequest(req);
  try {
    const { broadcast, row } = await prepareSendTest(
      { channel: body.data.channel, template: body.data.template },
      actor,
      displayName,
    );
    // Send inline — Kevin is waiting; do not detour through the queue.
    const result = await dispatchOne(row);
    const response: BroadcastSendTestResponse = {
      ok: true,
      broadcastId: broadcast.broadcastId,
      recipient: result,
    };
    res.json(response);
  } catch (err) {
    if (err instanceof BroadcastValidationError) {
      res.status(400).json({ ok: false, error: err.message, issues: err.issues });
      return;
    }
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Send-test failed: ${msg}` });
  }
});

/* ─── POST / — G.5 enqueue master broadcast ───────────────────── */

adminBroadcastRoutes.post('/', requireAdmin, async (req: Request, res: Response) => {
  const body = EnqueueBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'Invalid enqueue payload.', issues: body.error.issues });
    return;
  }
  const { actor, displayName } = await adminActorFromRequest(req);
  try {
    const { broadcast, recipientCount, excludedBySTOP } = await enqueueBroadcast(
      {
        audiencePreset: body.data.audiencePreset,
        customAudienceBaIds: body.data.customAudienceBaIds,
        channel: body.data.channel,
        template: body.data.template,
      },
      actor,
      displayName,
    );
    const response: BroadcastEnqueueResponse = {
      ok: true,
      broadcastId: broadcast.broadcastId,
      recipientCount,
      excludedBySTOP,
    };
    res.status(202).json(response);
  } catch (err) {
    if (err instanceof BroadcastValidationError) {
      res.status(400).json({ ok: false, error: err.message, issues: err.issues });
      return;
    }
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Enqueue failed: ${msg}` });
  }
});
