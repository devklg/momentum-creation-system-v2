/**
 * /api/admin/dashboard — Core Dashboard server surface
 * (locked-spec 4.B · wireframe 4.B · leaves wf_0077–wf_0080).
 *
 * Thin Express layer over `domain/adminMetrics.ts`. Every handler appends
 * one audit entry through the 4.J substrate (`appendAuditEntry`) per the
 * TASK-134 hard rule: "every /admin request writes an audit entry."
 *
 *   GET  /metrics      master metrics row (wf_0077)
 *   GET  /filters      filter-bar options: BAs + leader groups (wf_0079)
 *   GET  /drilldown    per-tile detail rows (wf_0078)
 *   GET  /stream       SSE live event stream (wf_0080)
 *
 * Filter contract — server-enforced, narrowing only. The client passes
 * tmagId and leaderGroup in the query string; the server resolves the
 * scoped BA set and applies it identically to metrics + drilldown.
 *
 * SSE shape mirrors `/api/p/:token/stream` (the dashboard SSE) — same
 * frame format, same heartbeat cadence, same teardown discipline — so
 * a Live Operations surface can swap in additional channels later.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { requireAdmin } from '../../middleware/requireAuth.js';
import {
  LEADER_DETECTION_NOTE,
  buildDrilldown,
  computeAdminDashboardMetrics,
  getFilterOptions,
} from '../../domain/adminMetrics.js';
import { appendAuditEntry, queryAuditEntries } from '../../domain/auditLog.js';
import {
  subscribePlacements,
} from '../../services/poolEvents.js';
import type {
  McsAdminDashboardFilter,
  McsAdminDashboardFiltersResponse,
  McsAdminDashboardMetricsResponse,
  McsAdminDrilldownResponse,
  McsAdminLiveAuditEvent,
  McsAdminLiveEvent,
  McsAdminLivePlacementEvent,
  McsAdminLiveSnapshot,
  McsAuditActor,
  McsAuditLogEntry,
  McsPlacementEvent,
} from '@momentum/shared';

export const adminDashboardRoutes: Router = express.Router();

/* ─── shared filter parsing ───────────────────────────────────────── */

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

function adminActorFromRequest(req: Request): McsAuditActor {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

/* ─── GET /metrics ────────────────────────────────────────────────── */

adminDashboardRoutes.get('/metrics', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }

  try {
    const metrics = await computeAdminDashboardMetrics(filter);

    // Audit the view. Severity 'info'; entity is the admin session (a view,
    // not a mutation). Snapshot the applied filter as `after` so the audit
    // trail captures *what slice Kevin looked at*, not just that he looked.
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.dashboard.metrics.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { filter, metrics: { computedAt: metrics.computedAt } },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/dashboard/metrics',
        method: 'GET',
        requestId: null,
      },
    });

    const body: McsAdminDashboardMetricsResponse = {
      ok: true,
      metrics,
      appliedFilter: filter,
      leaderDetectionNote: LEADER_DETECTION_NOTE,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Metrics failed: ${msg}` });
  }
});

/* ─── GET /filters ────────────────────────────────────────────────── */

adminDashboardRoutes.get('/filters', requireAdmin, async (req, res) => {
  try {
    const { bas, leaderGroups } = await getFilterOptions();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.dashboard.filters.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/dashboard/filters',
        method: 'GET',
        requestId: null,
      },
    });

    const body: McsAdminDashboardFiltersResponse = {
      ok: true,
      bas,
      leaderGroups,
      leaderDetectionNote: LEADER_DETECTION_NOTE,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Filters failed: ${msg}` });
  }
});

/* ─── GET /drilldown ──────────────────────────────────────────────── */

const TILE_VALUES = [
  'active_bas',
  'prospects_in_flow',
  'queue_movement',
  'enrollments',
  'training',
] as const;

const DrilldownSchema = z.object({
  tile: z.enum(TILE_VALUES),
});

adminDashboardRoutes.get('/drilldown', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  let tile: (typeof TILE_VALUES)[number];
  try {
    filter = parseFilter(req);
    tile = DrilldownSchema.parse({
      tile: typeof req.query.tile === 'string' ? req.query.tile : undefined,
    }).tile;
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid drilldown query.', issues: (err as z.ZodError).issues });
    return;
  }

  try {
    const payload = await buildDrilldown(tile, filter);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: `admin.dashboard.drilldown.${tile}.viewed`,
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { filter, tile, rowCount: rowCountOf(payload) },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/dashboard/drilldown',
        method: 'GET',
        requestId: null,
      },
    });

    const body: McsAdminDrilldownResponse = {
      ok: true,
      payload,
      appliedFilter: filter,
      computedAt: new Date().toISOString(),
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Drilldown failed: ${msg}` });
  }
});

function rowCountOf(payload: Awaited<ReturnType<typeof buildDrilldown>>): number {
  return payload.rows.length;
}

/* ─── GET /stream — SSE live event stream (wf_0080) ───────────────── */

const SSE_PING_INTERVAL_MS = 30_000;
const AUDIT_TAIL_INTERVAL_MS = 5_000;
const SSE_SNAPSHOT_LIMIT = 25;

function sseFrame(event: string, data: unknown, id?: string): string {
  const lines: string[] = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

function placementToLiveEvent(p: McsPlacementEvent): McsAdminLivePlacementEvent {
  return {
    kind: 'placement',
    eventId: p.eventId,
    at: p.placedAt,
    positionNumber: p.positionNumber,
    firstName: p.firstName,
    lastInitial: p.lastInitial,
    city: p.city,
    stateOrRegion: p.stateOrRegion,
  };
}

function auditEntryToLiveEvent(e: McsAuditLogEntry): McsAdminLiveAuditEvent {
  const actor = e.actor;
  let actorLabel: string;
  switch (actor.kind) {
    case 'admin':
    case 'ba':
      actorLabel = `${actor.displayName} · ${actor.tmagId}`;
      break;
    case 'prospect':
      actorLabel = `${actor.displayName} · ${actor.prospectId}`;
      break;
    case 'system':
      actorLabel = `system · ${actor.label}`;
      break;
    case 'anonymous':
      actorLabel = actor.ip ? `anonymous · ${actor.ip}` : 'anonymous';
      break;
  }
  const entityLabel =
    e.entity.kind === 'none'
      ? '—'
      : e.entity.displayLabel
        ? `${e.entity.kind} · ${e.entity.displayLabel}`
        : `${e.entity.kind} · ${e.entity.id}`;

  return {
    kind: 'audit_entry',
    eventId: e.entryId,
    at: e.timestamp,
    action: e.action,
    role: e.role,
    actorLabel,
    entityLabel,
    severity: e.severity,
  };
}

adminDashboardRoutes.get('/stream', requireAdmin, async (req: Request, res: Response) => {
  // Audit the stream open — once, not per event.
  await appendAuditEntry({
    actor: adminActorFromRequest(req),
    action: 'admin.dashboard.stream.opened',
    entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
    severity: 'info',
    reason: null,
    context: {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      route: '/api/admin/dashboard/stream',
      method: 'GET',
      requestId: null,
    },
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Initial snapshot: most-recent audit entries (the stream's chief content).
  // Placements are real-time only — they show up via the subscription below.
  try {
    const { entries } = await queryAuditEntries({ limit: SSE_SNAPSHOT_LIMIT });
    const snapshot: McsAdminLiveSnapshot = {
      events: entries.map(auditEntryToLiveEvent),
    };
    res.write(sseFrame('snapshot', snapshot));
  } catch (err) {
    res.write(`: snapshot_error ${(err as Error).message}\n\n`);
  }

  // Live placement fan-out — already a process-wide EventEmitter.
  const placementSub = subscribePlacements((event: McsPlacementEvent) => {
    try {
      const liveEvent: McsAdminLiveEvent = placementToLiveEvent(event);
      res.write(sseFrame(liveEvent.kind, liveEvent, liveEvent.eventId));
    } catch {
      // closed socket — teardown handler will catch and detach.
    }
  });

  // Audit-log tail. The audit substrate has no in-process emitter today;
  // polling every 5s is cheap (Kevin is the only viewer) and avoids
  // instrumenting the writer paths (out of scope for this branch).
  let lastSeenAt = new Date().toISOString();
  const auditTail = setInterval(() => {
    void (async () => {
      try {
        const { entries } = await queryAuditEntries({ from: lastSeenAt, limit: 50 });
        if (entries.length === 0) return;
        // Entries come back newest-first; flip so the wire order matches
        // wall-clock chronology.
        for (const entry of [...entries].reverse()) {
          if (entry.timestamp <= lastSeenAt) continue;
          const liveEvent = auditEntryToLiveEvent(entry);
          res.write(sseFrame(liveEvent.kind, liveEvent, liveEvent.eventId));
          if (entry.timestamp > lastSeenAt) lastSeenAt = entry.timestamp;
        }
      } catch {
        // ignore — next tick will retry.
      }
    })();
  }, AUDIT_TAIL_INTERVAL_MS);

  // Heartbeat — SSE comments are ignored by the EventSource client but keep
  // reverse proxies from closing idle connections.
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      // ignore — teardown will fire on `close`.
    }
  }, SSE_PING_INTERVAL_MS);

  // Generate a stream-instance id used only for log lines / debug.
  const streamId = `admin-stream-${randomBytes(4).toString('hex')}`;

  const teardown = () => {
    clearInterval(heartbeat);
    clearInterval(auditTail);
    placementSub.unsubscribe();
    // eslint-disable-next-line no-console
    console.log(`[admin-dashboard-stream] closed ${streamId} tmagId=${req.session!.tmagId}`);
  };
  req.on('close', teardown);
  req.on('aborted', teardown);

  // eslint-disable-next-line no-console
  console.log(`[admin-dashboard-stream] opened ${streamId} tmagId=${req.session!.tmagId}`);
});
