/**
 * /api/admin/live-ops — ADMIN Section H · Live Operations (Chat #144).
 *
 * Thin Express layer mirroring `routes/admin/reporting.ts`:
 *   - requireAdmin on every handler (founders bypass Michael; H is /admin-
 *     only and never reachable for non-admin BAs).
 *   - parseFilter narrows-only — tmagId + leaderGroup.
 *   - appendAuditEntry once per request (J.4 substrate).
 *
 * Four leaves:
 *   GET  /usage/stream     H.1 — SSE: snapshot every ~1s + heartbeat every 30s
 *   GET  /growth           H.2 — JSON: 24h / 7d / 30d growth cards
 *   GET  /grid             H.3 — JSON: every active placement slot
 *   GET  /funnel?kind=...  H.4 — JSON: prospect | ba_activation funnel
 *
 * Paths are sourced from the contract's `ADMIN_LIVE_OPS_PATHS` constant
 * (which prefixes them with `/api/admin/live-ops`); the router mounts at
 * that root in index.ts.
 */

import express, {
  type Request,
  type Response,
  type Router,
} from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import {
  getFunnel,
  getGrowthCards,
  getLiveGrid,
  getUsageSample,
} from '../../domain/liveOps.js';
import {
  decrementAdminSessions,
  incrementAdminSessions,
} from '../../services/poolEvents.js';
import type {
  McsAdminDashboardFilter,
  McsAdminFunnelKind,
  McsAdminLiveUsageSample,
  McsAdminLiveUsageStreamEvent,
  McsAuditActor,
} from '@momentum/shared';

export const adminLiveOpsRoutes: Router = express.Router();

const FilterSchema = z.object({
  tmagId: z.string().min(2).max(80).optional(),
  leaderGroup: z.enum(['all', 'leaders_only', 'non_leaders']).optional(),
});

function parseFilter(req: Request): McsAdminDashboardFilter {
  const parsed = FilterSchema.parse({
    tmagId: typeof req.query.tmagId === 'string' ? req.query.tmagId : undefined,
    leaderGroup:
      typeof req.query.leaderGroup === 'string' ? req.query.leaderGroup : undefined,
  });
  return {
    tmagId: parsed.tmagId ?? null,
    leaderGroup: parsed.leaderGroup ?? 'all',
  };
}

function adminActorFromRequest(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

function badFilter(res: Response, err: z.ZodError): void {
  res
    .status(400)
    .json({ ok: false, error: 'Invalid filter.', issues: err.issues });
}

/* ─── H.2 · GET /growth ───────────────────────────────────────────── */

adminLiveOpsRoutes.get('/growth', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    badFilter(res, err as z.ZodError);
    return;
  }

  try {
    const payload = await getGrowthCards(filter);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.live_ops.growth.read',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        filter,
        generatedAt: payload.generatedAt,
        card24h: payload.cards[0],
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/live-ops/growth',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Growth cards failed: ${msg}` });
  }
});

/* ─── H.3 · GET /grid ─────────────────────────────────────────────── */

adminLiveOpsRoutes.get('/grid', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    badFilter(res, err as z.ZodError);
    return;
  }

  try {
    const payload = await getLiveGrid(filter);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.live_ops.grid.read',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        filter,
        generatedAt: payload.generatedAt,
        totalActive: payload.totalActive,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/live-ops/grid',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Live grid failed: ${msg}` });
  }
});

/* ─── H.4 · GET /funnel?kind=... ──────────────────────────────────── */

adminLiveOpsRoutes.get('/funnel', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    badFilter(res, err as z.ZodError);
    return;
  }

  const rawKind = typeof req.query.kind === 'string' ? req.query.kind : '';
  const kind: McsAdminFunnelKind =
    rawKind === 'ba_activation' ? 'ba_activation' : 'prospect';

  try {
    const payload = await getFunnel(kind, filter);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.live_ops.funnel.read',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        filter,
        kind,
        generatedAt: payload.generatedAt,
        firstStageCount: payload.stages[0]?.count ?? 0,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/live-ops/funnel',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Funnel failed: ${msg}` });
  }
});

/* ─── H.1 · GET /usage/stream ─────────────────────────────────────── */

const USAGE_TICK_INTERVAL_MS = 1_000;
const USAGE_HEARTBEAT_INTERVAL_MS = 30_000;

function sseFrame(event: string, data: unknown, id?: string): string {
  const lines: string[] = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

/**
 * Two snapshots are "the same" (no push needed) when every numeric field
 * matches. `sampledAt` is excluded since it changes every tick.
 */
function sampleEquals(
  a: McsAdminLiveUsageSample | null,
  b: McsAdminLiveUsageSample,
): boolean {
  if (!a) return false;
  return (
    a.activeDashboardViewers === b.activeDashboardViewers &&
    a.activeAdminSessions === b.activeAdminSessions &&
    a.eventsPerMinute === b.eventsPerMinute &&
    a.persistenceLatencyMsP50 === b.persistenceLatencyMsP50 &&
    a.persistenceLatencyMsP95 === b.persistenceLatencyMsP95
  );
}

adminLiveOpsRoutes.get('/usage/stream', requireAdmin, async (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Bump the active-admin-session counter for the lifetime of this stream.
  // The first sample we push below is computed AFTER this increment so the
  // strip shows at least one session as soon as Kevin opens it.
  incrementAdminSessions();

  // Initial snapshot — always pushed, satisfies the H.1 acceptance criterion
  // that a snapshot lands within 35s of connection.
  let lastSample: McsAdminLiveUsageSample | null = null;
  const pushSnapshot = (force = false): void => {
    const sample = getUsageSample();
    if (!force && sampleEquals(lastSample, sample)) return;
    const event: McsAdminLiveUsageStreamEvent = { kind: 'snapshot', sample };
    try {
      res.write(sseFrame('snapshot', event));
      lastSample = sample;
    } catch {
      // closed socket — teardown will detach.
    }
  };

  pushSnapshot(true);

  // Audit the stream open. Captures who connected and when; the close
  // event is implicit (no row written) since SSE close is the norm and
  // logging both halves doubles the audit volume for no information gain.
  try {
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.live_ops.usage_stream.opened',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { initialSample: lastSample },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/live-ops/usage/stream',
        method: 'GET',
        requestId: null,
      },
    });
  } catch (err) {
    // Audit must not block the stream — write a comment line and continue.
    res.write(`: audit_error ${(err as Error).message}\n\n`);
  }

  const tick = setInterval(() => pushSnapshot(false), USAGE_TICK_INTERVAL_MS);
  const heartbeat = setInterval(() => {
    const event: McsAdminLiveUsageStreamEvent = {
      kind: 'heartbeat',
      at: new Date().toISOString(),
    };
    try {
      res.write(sseFrame('heartbeat', event));
    } catch {
      // closed socket — teardown will detach.
    }
  }, USAGE_HEARTBEAT_INTERVAL_MS);

  const streamId = `admin-live-ops-${randomBytes(4).toString('hex')}`;

  let torn = false;
  const teardown = (): void => {
    if (torn) return;
    torn = true;
    clearInterval(tick);
    clearInterval(heartbeat);
    decrementAdminSessions();
    // eslint-disable-next-line no-console
    console.log(
      `[admin-live-ops-stream] closed ${streamId} tmagId=${req.session!.tmagId}`,
    );
  };
  req.on('close', teardown);
  req.on('aborted', teardown);

  // eslint-disable-next-line no-console
  console.log(
    `[admin-live-ops-stream] opened ${streamId} tmagId=${req.session!.tmagId}`,
  );
});
