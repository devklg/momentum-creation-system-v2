/**
 * /api/rvm — prospect-facing RVM token API.
 *
 * Separate from /api/p because voicemail leads have a different acquisition
 * context. Mechanics remain PMV-aligned: activation on engagement, video
 * milestones, and holding-tank placement only at video_complete.
 */

import { Router } from 'express';
import { z } from 'zod';
import type {
  McsCallbackIntent,
  McsCallbackRequestResponse,
  McsHoldingTankSnapshot,
  McsPlacementEvent,
  McsRvmInfoRequestResponse,
  McsRvmResolvedTokenPayload,
  McsTeamStatsResponse,
  McsVideoEventKind,
  McsVideoEventResponse,
  McsWebinarReservationResponse,
} from '@momentum/shared';
import {
  findTokenRecord,
  isTokenExpired,
  transitionTokenState,
} from '../domain/tokens.js';
import { findProspectById, lastInitialOf } from '../domain/prospects.js';
import { findBAByTmagId } from '../domain/ba.js';
import { findBulkLeadByToken } from '../domain/bulkLeads.js';
import { buildHoldingTankSnapshot } from '../domain/holdingTank.js';
import { createCallbackRequest } from '../domain/callbackRequest.js';
import { findNextUpcomingEvent } from '../domain/webinarEvent.js';
import { createWebinarReservation } from '../domain/webinarReservation.js';
import { computeTeamStats } from '../domain/teamStats.js';
import {
  applyCrmLifecycleEvent,
} from '../domain/prospectCrm.js';
import { subscribePlacements } from '../services/poolEvents.js';
import {
  RvmTokenError,
  activateRvmLeadByToken,
  recordRvmVideoEvent,
  resolveRvmToken,
} from '../domain/rvmTokens.js';

export const rvmRoutes: Router = Router();

const SSE_SNAPSHOT_RECENT_LIMIT = 40;
const SSE_PING_INTERVAL_MS = 30_000;

const VideoEventSchema = z.object({
  kind: z.enum(['started', 'quarter', 'half', 'three_quarter', 'complete']),
});

const CallbackSchema = z.object({
  intent: z.enum(['interested_tell_me_more', 'have_questions', 'ready_to_join']),
});

const InfoSchema = z.object({
  note: z.string().max(600).optional(),
});

const WebinarReservationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().min(5).max(254).email(),
});

interface RvmRequestContext {
  tokenRecord: NonNullable<Awaited<ReturnType<typeof findTokenRecord>>>;
  bulkLead: NonNullable<Awaited<ReturnType<typeof findBulkLeadByToken>>>;
  prospect: NonNullable<Awaited<ReturnType<typeof findProspectById>>>;
  ba: NonNullable<Awaited<ReturnType<typeof findBAByTmagId>>>;
}

function sendRvmError(res: import('express').Response, err: unknown) {
  if (err instanceof RvmTokenError) {
    if (err.code === 'enrolled') return res.status(409).json({ error: 'enrolled' });
    if (err.code === 'expired') return res.status(410).json({ error: 'expired' });
    if (err.code === 'invalid_token') return res.status(404).json({ error: 'invalid_token' });
    return res.status(400).json({ error: err.code });
  }
  // eslint-disable-next-line no-console
  console.error('[rvm route] unexpected error', err);
  return res.status(500).json({ error: 'server_error' });
}

function sseFrame(event: string, data: unknown, id?: string): string {
  const lines: string[] = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

async function resolveRvmRequestContext(token: string): Promise<RvmRequestContext> {
  const bulkLead = await findBulkLeadByToken(token);
  if (!bulkLead) throw new RvmTokenError('invalid_token');
  const tokenRecord = await findTokenRecord(token);
  if (!tokenRecord) throw new RvmTokenError('invalid_token');
  if (tokenRecord.state === 'enrolled') throw new RvmTokenError('enrolled');
  if (tokenRecord.state === 'expired') throw new RvmTokenError('expired');
  if (isTokenExpired(tokenRecord)) {
    await transitionTokenState(token, 'expired');
    throw new RvmTokenError('expired');
  }
  const [prospect, ba] = await Promise.all([
    findProspectById(tokenRecord.prospectId),
    findBAByTmagId(tokenRecord.sponsorTmagId),
  ]);
  if (!prospect || !ba) throw new RvmTokenError('invalid_token');
  return { tokenRecord, bulkLead, prospect, ba };
}

rvmRoutes.get('/:token', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });
  try {
    const payload: McsRvmResolvedTokenPayload = await resolveRvmToken(token);
    return res.status(200).json(payload);
  } catch (err) {
    return sendRvmError(res, err);
  }
});

rvmRoutes.post('/:token/activate', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });
  try {
    const result = await activateRvmLeadByToken(token, 'RVM lead activated by prospect action.');
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return sendRvmError(res, err);
  }
});

rvmRoutes.post('/:token/video-event', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });
  const parsed = VideoEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_kind', issues: parsed.error.issues });
  }
  try {
    const result: McsVideoEventResponse = await recordRvmVideoEvent(
      token,
      parsed.data.kind as McsVideoEventKind,
    );
    return res.status(200).json(result);
  } catch (err) {
    return sendRvmError(res, err);
  }
});

rvmRoutes.post('/:token/callback-request', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });
  const parsed = CallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_intent', issues: parsed.error.issues });
  }
  try {
    const ctx = await resolveRvmRequestContext(token);
    const result = await createCallbackRequest({
      token: ctx.tokenRecord.token,
      prospectId: ctx.prospect.prospectId,
      prospectFirstName: ctx.prospect.firstName,
      prospectLastInitial: ctx.prospect.lastInitial || lastInitialOf(ctx.prospect.lastName),
      sponsorTmagId: ctx.tokenRecord.sponsorTmagId,
      baFirstName: ctx.ba.firstName,
      baPhone: ctx.ba.phone || null,
      intent: parsed.data.intent as McsCallbackIntent,
    });

    await applyCrmLifecycleEvent(
      ctx.prospect.prospectId,
      'callback_requested',
      'RVM prospect requested a callback.',
      { token, leadId: ctx.bulkLead.leadId, intent: parsed.data.intent },
    );

    const body: McsCallbackRequestResponse = {
      ok: true,
      intent: parsed.data.intent as McsCallbackIntent,
      baFirstName: ctx.ba.firstName,
      createdAt: result.createdAt,
    };
    return res.status(200).json(body);
  } catch (err) {
    return sendRvmError(res, err);
  }
});

rvmRoutes.get('/:token/stream', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });

  try {
    await resolveRvmRequestContext(token);
  } catch (err) {
    return sendRvmError(res, err);
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  try {
    const snapshot: McsHoldingTankSnapshot = await buildHoldingTankSnapshot(
      SSE_SNAPSHOT_RECENT_LIMIT,
    );
    res.write(sseFrame('snapshot', snapshot));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/rvm/:token/stream] snapshot failed', err);
    res.write(`: snapshot_error ${(err as Error).message}\n\n`);
    res.end();
    return;
  }

  const sub = subscribePlacements((event: McsPlacementEvent) => {
    try {
      res.write(sseFrame('placement', event, event.eventId));
    } catch {
      // close handlers below clean up the subscription
    }
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      // close handlers below clean up the subscription
    }
  }, SSE_PING_INTERVAL_MS);

  const teardown = () => {
    clearInterval(heartbeat);
    sub.unsubscribe();
  };
  req.on('close', teardown);
  req.on('aborted', teardown);
  res.on('close', teardown);
  return;
});

rvmRoutes.post('/:token/webinar-reserve', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });
  const parsed = WebinarReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    const invalidEmail = parsed.error.issues.some((issue) => issue.path.join('.') === 'email');
    return res.status(400).json({ error: invalidEmail ? 'invalid_email' : 'invalid_name' });
  }

  try {
    const ctx = await resolveRvmRequestContext(token);
    const nextEvent = await findNextUpcomingEvent();
    if (!nextEvent) return res.status(404).json({ error: 'no_upcoming_event' });

    const result = await createWebinarReservation({
      token: ctx.tokenRecord.token,
      prospectId: ctx.prospect.prospectId,
      prospectFirstName: ctx.prospect.firstName,
      prospectLastInitial: ctx.prospect.lastInitial || lastInitialOf(ctx.prospect.lastName),
      sponsorTmagId: ctx.tokenRecord.sponsorTmagId,
      baFirstName: ctx.ba.firstName,
      baPhone: ctx.ba.phone || null,
      eventId: nextEvent.eventId,
      scheduledFor: nextEvent.scheduledFor,
      zoomUrl: nextEvent.zoomUrl ?? null,
      name: parsed.data.name,
      email: parsed.data.email,
    });

    const body: McsWebinarReservationResponse = {
      ok: true,
      reservationId: result.reservationId,
      eventId: nextEvent.eventId,
      scheduledFor: nextEvent.scheduledFor,
      baFirstName: ctx.ba.firstName,
      emailSent: result.emailDeliveryStatus === 'sent',
      createdAt: result.createdAt,
    };
    return res.status(200).json(body);
  } catch (err) {
    return sendRvmError(res, err);
  }
});

rvmRoutes.get('/:token/team-stats', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });

  try {
    await resolveRvmRequestContext(token);
    const stats = await computeTeamStats();
    const body: McsTeamStatsResponse = {
      basActive24h: stats.basActive24h,
      invitationsSentToday: stats.invitationsSentToday,
      newPlacements24h: stats.newPlacements24h,
      recruitmentVelocityPct: stats.recruitmentVelocityPct,
      computedAt: stats.computedAt,
    };
    return res.status(200).json(body);
  } catch (err) {
    return sendRvmError(res, err);
  }
});

rvmRoutes.post('/:token/info-request', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });
  const parsed = InfoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const ctx = await resolveRvmRequestContext(token);
    const createdAt = new Date().toISOString();
    await applyCrmLifecycleEvent(
      ctx.prospect.prospectId,
      'info_requested',
      'RVM prospect requested more information.',
      { token, leadId: ctx.bulkLead.leadId, note: parsed.data.note ?? null },
    );
    const body: McsRvmInfoRequestResponse = {
      ok: true,
      prospectId: ctx.prospect.prospectId,
      createdAt,
    };
    return res.status(200).json(body);
  } catch (err) {
    return sendRvmError(res, err);
  }
});

