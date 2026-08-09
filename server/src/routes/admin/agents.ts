/**
 * /api/admin/agents — Agent 6 admin oversight for Success Profiles and memory.
 *
 * Read-only Kevin/Admin shell for Steve/Michael/Ivory support context. This
 * does not expose Success Profile fields to the BA editable profile and does
 * not perform GraphRAG writes from the repo server. Bridge rows are drafts that
 * name the required schema-enforced external MCP tool server quadstack path.
 */

import express, { type Request, type Router } from 'express';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import { buildAdminAgentOversight } from '../../domain/adminAgentMemory.js';
import { buildAdminAgentHealth } from '../../domain/adminAgentHealth.js';
import { buildAdminOutboxHealth } from '../../domain/adminOutboxHealth.js';
import {
  ingestChatTranscripts,
  getChatTranscriptDetail,
  listChatTranscripts,
} from '../../domain/adminChatTranscripts.js';
import {
  getAutoTranscriptHarvesterStatus,
  runAutoTranscriptHarvesterNow,
} from '../../workers/autoTranscriptHarvester.js';
import type {
  McsAdminChatTranscriptHarvestInput,
  McsAdminChatTranscriptHarvestResponse,
  McsAdminChatTranscriptResponse,
  McsAdminChatTranscriptsResponse,
  McsAuditActor,
} from '@momentum/shared';

export const adminAgentsRoutes: Router = express.Router();

function adminActorFromRequest(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

function positiveInteger(value: unknown, fallback: number, max = 200): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  if (parsed < 1) return fallback;
  if (parsed > max) return max;
  return parsed;
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

interface HarvesterRunResponse {
  ok: true;
  source: string;
  requested: number;
  written: number;
  skipped: number;
  sourceSessionCount: number;
  sourceSessionIds: string[];
  initiatedBy: 'manual' | 'scheduled';
  runWindow: string | null;
  errors: string[];
}

adminAgentsRoutes.get('/transcripts', requireAdmin, async (req, res) => {
  try {
    const payload = await listChatTranscripts({
      limit: positiveInteger(req.query.limit, 25, 100),
      ...(toStringOrUndefined(req.query.model) ? { model: toStringOrUndefined(req.query.model) } : {}),
      ...(toStringOrUndefined(req.query.keyword) ? { keyword: toStringOrUndefined(req.query.keyword) } : {}),
      ...(toStringOrUndefined(req.query.cursor) ? { cursor: toStringOrUndefined(req.query.cursor) } : {}),
    });

    const response: McsAdminChatTranscriptsResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      transcripts: payload.transcripts,
      total: payload.total,
      nextCursor: payload.nextCursor,
    };

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.agents.transcripts.listed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        limit: payload.total,
        count: payload.transcripts.length,
        model: toStringOrUndefined(req.query.model),
        keyword: toStringOrUndefined(req.query.keyword),
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/agents/transcripts',
        method: 'GET',
        requestId: null,
      },
    });

    return res.status(200).json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ ok: false, error: `Transcripts list failed: ${msg}` });
  }
});

adminAgentsRoutes.get('/transcripts/harvest/status', requireAdmin, async (_req, res) => {
  const status = getAutoTranscriptHarvesterStatus();
  return res.status(200).json({ ok: true, status });
});

adminAgentsRoutes.post('/transcripts/harvest/run', requireAdmin, async (req, res) => {
  try {
    const result = await runAutoTranscriptHarvesterNow();
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.agents.transcripts.auto_harvested',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: result.written > 0 ? 'info' : 'warn',
      after: {
        source: result.source,
        requested: result.requested,
        written: result.written,
        skipped: result.skipped,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/agents/transcripts/harvest/run',
        method: 'POST',
        requestId: null,
      },
    });

    const response: HarvesterRunResponse = {
      ok: true,
      source: result.source,
      requested: result.requested,
      written: result.written,
      skipped: result.skipped,
      sourceSessionCount: result.sourceSessionCount,
      sourceSessionIds: result.sourceSessionIds,
      initiatedBy: result.initiatedBy,
      runWindow: result.runWindow,
      errors: result.errors,
    };
    return res.status(200).json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ ok: false, error: `Auto-harvest failed: ${msg}` });
  }
});

adminAgentsRoutes.get('/transcripts/:transcriptId', requireAdmin, async (req, res) => {
  const transcriptId = toStringOrUndefined(req.params.transcriptId);
  if (!transcriptId) {
    return res.status(400).json({ ok: false, error: 'invalid transcript id' });
  }
  try {
    const transcript = await getChatTranscriptDetail(transcriptId);
    if (!transcript) {
      return res.status(404).json({ ok: false, error: 'not found' });
    }

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.agents.transcripts.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { transcriptId },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: `/api/admin/agents/transcripts/${encodeURIComponent(transcriptId)}`,
        method: 'GET',
        requestId: null,
      },
    });

    const response: McsAdminChatTranscriptResponse = { ok: true, transcript };
    return res.status(200).json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ ok: false, error: `Transcript detail failed: ${msg}` });
  }
});

adminAgentsRoutes.post('/transcripts/harvest', requireAdmin, async (req, res) => {
  const input = req.body as Record<string, unknown>;
  const source = toStringOrUndefined(input.source);
  if (!source) {
    return res.status(400).json({ ok: false, error: 'invalid_source' });
  }
  if (!Array.isArray(input.transcripts)) {
    return res.status(400).json({ ok: false, error: 'invalid_transcripts' });
  }

  const payload: McsAdminChatTranscriptHarvestInput = {
    source,
    transcripts: input.transcripts as McsAdminChatTranscriptHarvestInput['transcripts'],
  };

  try {
    const result = await ingestChatTranscripts(payload);
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.agents.transcripts.harvested',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: result.written > 0 ? 'info' : 'warn',
      after: {
        source: result.source,
        requested: result.requested,
        written: result.written,
        skipped: result.skipped,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/agents/transcripts/harvest',
        method: 'POST',
        requestId: null,
      },
    });

    const response: McsAdminChatTranscriptHarvestResponse = {
      ok: true,
      source: result.source,
      requested: result.requested,
      written: result.written,
      skipped: result.skipped,
      errors: result.errors,
    };
    return res.status(200).json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ ok: false, error: `Transcript ingest failed: ${msg}` });
  }
});

adminAgentsRoutes.get('/overview', requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('Pragma', 'no-cache');
  try {
    const payload = await buildAdminAgentOversight();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.agents.overview.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        generatedAt: payload.generatedAt,
        successProfiles: payload.successProfiles.length,
        bridgeDrafts: payload.bridgeDrafts.length,
        warnings: payload.warnings.length,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/agents/overview',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Agent oversight failed.' });
  }
});

adminAgentsRoutes.get('/health', requireAdmin, async (_req, res) => {
  try {
    res.status(200).json(await buildAdminAgentHealth());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Agent health failed: ${msg}` });
  }
});

adminAgentsRoutes.get('/outbox-health', requireAdmin, async (_req, res) => {
  try {
    res.status(200).json(await buildAdminOutboxHealth());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Outbox health failed: ${msg}` });
  }
});
