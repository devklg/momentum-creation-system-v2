/**
 * /api/admin/content/videos — Kevin-only Product Gallery content control.
 */

import express, { type Request, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import {
  createContentVideo,
  listContentVideos,
  reorderContentVideos,
  updateContentVideo,
  type ContentVideoActor,
} from '../../domain/contentVideos.js';
import type {
  McsAuditActor,
  McsContentVideoAudience,
  McsContentVideoMutationResponse,
  McsContentVideoReorderResponse,
  McsContentVideosAdminListResponse,
} from '@momentum/shared';

export const adminContentVideoRoutes: Router = express.Router();

const AudienceSchema = z.enum(['member', 'prospect', 'both']);

const VideoBody = z.object({
  section: z.string().min(1).max(120),
  title: z.string().min(1).max(220),
  youtubeId: z.string().max(200).nullable().optional(),
  url: z.string().max(500).nullable().optional(),
  description: z.string().min(1).max(1200),
  sortOrder: z.number().int().min(0).max(100000),
  audience: AudienceSchema,
  active: z.boolean().optional(),
});

const ReorderBody = z.object({
  items: z
    .array(
      z.object({
        contentVideoId: z.string().min(1),
        sortOrder: z.number().int().min(0).max(100000),
      }),
    )
    .min(1)
    .max(250),
});

function adminActorFromRequest(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

function contentActor(req: Request): ContentVideoActor {
  return { tmagId: req.session?.tmagId ?? null };
}

function baseContext(req: Request, route: string, method: string) {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    route,
    method,
    requestId: null,
  };
}

adminContentVideoRoutes.get('/', requireAdmin, async (_req, res) => {
  try {
    const sections = await listContentVideos({ includeInactive: true });
    const body: McsContentVideosAdminListResponse = { ok: true, sections };
    res.status(200).json(body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/admin/content/videos] failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

adminContentVideoRoutes.post('/', requireAdmin, async (req, res) => {
  const parsed = VideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
    return;
  }

  const actor = adminActorFromRequest(req);
  const result = await createContentVideo({
    input: {
      ...parsed.data,
      audience: parsed.data.audience as McsContentVideoAudience,
      source: 'admin',
    },
    actor: contentActor(req),
  });

  if (!result.ok) {
    res.status(result.error.kind === 'not_found' ? 404 : 400).json({ ok: false, error: result.error });
    return;
  }

  await appendAuditEntry({
    actor,
    action: 'admin.content_video.created',
    entity: {
      kind: 'master_content',
      id: result.value.contentVideoId,
      displayLabel: result.value.title,
    },
    severity: 'info',
    before: null,
    after: result.value as unknown as Record<string, unknown>,
    reason: 'Product Gallery video added from admin.',
    context: baseContext(req, '/api/admin/content/videos', 'POST'),
  });

  const body: McsContentVideoMutationResponse = { ok: true, video: result.value };
  res.status(201).json(body);
});

adminContentVideoRoutes.patch('/:contentVideoId', requireAdmin, async (req, res) => {
  const params = z.object({ contentVideoId: z.string().min(1) }).safeParse(req.params);
  const parsed = VideoBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      ok: false,
      error: 'invalid_payload',
      details: {
        params: params.success ? null : params.error.flatten(),
        body: parsed.success ? null : parsed.error.flatten(),
      },
    });
    return;
  }

  const actor = adminActorFromRequest(req);
  const result = await updateContentVideo({
    contentVideoId: params.data.contentVideoId,
    input: {
      ...parsed.data,
      audience: parsed.data.audience as McsContentVideoAudience,
      source: 'admin',
    },
    actor: contentActor(req),
  });

  if (!result.ok) {
    res.status(result.error.kind === 'not_found' ? 404 : 400).json({ ok: false, error: result.error });
    return;
  }

  await appendAuditEntry({
    actor,
    action: 'admin.content_video.edited',
    entity: {
      kind: 'master_content',
      id: result.value.contentVideoId,
      displayLabel: result.value.title,
    },
    severity: 'info',
    before: null,
    after: result.value as unknown as Record<string, unknown>,
    reason: 'Product Gallery video edited from admin.',
    context: baseContext(
      req,
      `/api/admin/content/videos/${params.data.contentVideoId}`,
      'PATCH',
    ),
  });

  const body: McsContentVideoMutationResponse = { ok: true, video: result.value };
  res.status(200).json(body);
});

adminContentVideoRoutes.post('/reorder', requireAdmin, async (req, res) => {
  const parsed = ReorderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() });
    return;
  }

  const actor = adminActorFromRequest(req);
  const result = await reorderContentVideos({
    items: parsed.data.items,
    actor: contentActor(req),
  });

  if (!result.ok) {
    res.status(result.error.kind === 'not_found' ? 404 : 400).json({ ok: false, error: result.error });
    return;
  }

  await appendAuditEntry({
    actor,
    action: 'admin.content_video.reordered',
    entity: {
      kind: 'master_content',
      id: 'product_gallery',
      displayLabel: 'Product Gallery ordering',
    },
    severity: 'info',
    before: null,
    after: { items: parsed.data.items },
    reason: 'Product Gallery videos reordered from admin.',
    context: baseContext(req, '/api/admin/content/videos/reorder', 'POST'),
  });

  const body: McsContentVideoReorderResponse = { ok: true, videos: result.value };
  res.status(200).json(body);
});
