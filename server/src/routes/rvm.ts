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
  CallbackIntent,
  CallbackRequestResponse,
  RvmInfoRequestResponse,
  RvmResolvedTokenPayload,
  VideoEventKind,
  VideoEventResponse,
} from '@momentum/shared';
import {
  findTokenRecord,
  isTokenExpired,
  transitionTokenState,
} from '../domain/tokens.js';
import { findProspectById, lastInitialOf } from '../domain/prospects.js';
import { findBAByBaId } from '../domain/ba.js';
import { findBulkLeadByToken } from '../domain/bulkLeads.js';
import { createCallbackRequest } from '../domain/callbackRequest.js';
import {
  applyCrmLifecycleEvent,
} from '../domain/prospectCrm.js';
import {
  RvmTokenError,
  activateRvmLeadByToken,
  recordRvmVideoEvent,
  resolveRvmToken,
} from '../domain/rvmTokens.js';

export const rvmRoutes: Router = Router();

const VideoEventSchema = z.object({
  kind: z.enum(['started', 'quarter', 'half', 'three_quarter', 'complete']),
});

const CallbackSchema = z.object({
  intent: z.enum(['interested_tell_me_more', 'have_questions', 'ready_to_join']),
});

const InfoSchema = z.object({
  note: z.string().max(600).optional(),
});

interface RvmRequestContext {
  tokenRecord: NonNullable<Awaited<ReturnType<typeof findTokenRecord>>>;
  bulkLead: NonNullable<Awaited<ReturnType<typeof findBulkLeadByToken>>>;
  prospect: NonNullable<Awaited<ReturnType<typeof findProspectById>>>;
  ba: NonNullable<Awaited<ReturnType<typeof findBAByBaId>>>;
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
    findBAByBaId(tokenRecord.sponsorBaId),
  ]);
  if (!prospect || !ba) throw new RvmTokenError('invalid_token');
  return { tokenRecord, bulkLead, prospect, ba };
}

rvmRoutes.get('/:token', async (req, res) => {
  const token = req.params.token ?? '';
  if (token.length < 4) return res.status(404).json({ error: 'invalid_token' });
  try {
    const payload: RvmResolvedTokenPayload = await resolveRvmToken(token);
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
    const result: VideoEventResponse = await recordRvmVideoEvent(
      token,
      parsed.data.kind as VideoEventKind,
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
      sponsorBaId: ctx.tokenRecord.sponsorBaId,
      baFirstName: ctx.ba.firstName,
      baPhone: ctx.ba.phone || null,
      intent: parsed.data.intent as CallbackIntent,
    });

    await applyCrmLifecycleEvent(
      ctx.prospect.prospectId,
      'callback_requested',
      'RVM prospect requested a callback.',
      { token, leadId: ctx.bulkLead.leadId, intent: parsed.data.intent },
    );

    const body: CallbackRequestResponse = {
      ok: true,
      intent: parsed.data.intent as CallbackIntent,
      baFirstName: ctx.ba.firstName,
      createdAt: result.createdAt,
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
    const body: RvmInfoRequestResponse = {
      ok: true,
      prospectId: ctx.prospect.prospectId,
      createdAt,
    };
    return res.status(200).json(body);
  } catch (err) {
    return sendRvmError(res, err);
  }
});

