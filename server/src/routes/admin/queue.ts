/**
 * /api/admin/queue — Section E · Queue / Recruitment Leg Oversight
 * (ADMIN Design E · project-wireframe 4.E).
 *
 * Kevin-only via requireAdmin. Every request appends one audit entry
 * through the 4.J substrate (`appendAuditEntry`) — same hard rule as
 * the dashboard route.
 *
 *   GET  /summary             E.1 + E.2 + E.4 + current visible window
 *   GET  /lookup?position=N   E.2 position lookup → D.2 deep-link
 *   GET  /visible-window      E.3 read setting
 *   PUT  /visible-window      E.3 write setting (audited)
 *   GET  /ticker?limit=N      E.5 snapshot of ticker entries (real names)
 *   GET  /ticker/stream       E.5 SSE — mirrors poolEvents bus, real names
 *   GET  /rules               E.6 list managed queue rules
 *   PUT  /rules/:key          E.6 write rule value (audited, body {value, reason})
 *
 * Reuse, do not invent:
 *   • Placement event source is `services/poolEvents` (same bus the .com
 *     prospect-dashboard SSE subscribes to). Admin un-anonymizes via a
 *     Mongo lookup per event (single viewer; latency acceptable).
 *   • Audit substrate is `domain/auditLog.appendAuditEntry`.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import {
  computeQueueOversightSummary,
  enrichPlacementForAdmin,
  getVisibleWindow,
  listAdminTicker,
  listQueueRules,
  lookupByPosition,
  setQueueRule,
  setVisibleWindow,
  VISIBLE_WINDOW_VALUES,
} from '../../domain/adminQueueOversight.js';
import { subscribePlacements } from '../../services/poolEvents.js';
import type {
  McsAdminQueueTickerSnapshot,
  McsAdminQueueTickerSseEvent,
  McsAdminTickerEntry,
  McsAuditActor,
  McsPlacementEvent,
  McsQueueAdminTickerResponse,
  McsQueueLookupResponse,
  McsQueueOversightSummaryResponse,
  McsQueueRulesResponse,
  McsQueueVisibleWindow,
  McsQueueVisibleWindowResponse,
} from '@momentum/shared';

export const adminQueueRoutes: Router = express.Router();

function adminActorFromRequest(req: Request): McsAuditActor {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
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

/* ─── GET /summary  (E.1 + E.2 + E.4) ─────────────────────────────── */

adminQueueRoutes.get('/summary', requireAdmin, async (req, res) => {
  try {
    const summary = await computeQueueOversightSummary();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.queue.summary.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { computedAt: summary.computedAt },
      reason: null,
      context: baseContext(req, '/api/admin/queue/summary', 'GET'),
    });

    const body: McsQueueOversightSummaryResponse = { ok: true, summary };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Summary failed: ${msg}` });
  }
});

/* ─── GET /lookup  (E.2 position lookup) ──────────────────────────── */

const LookupQuery = z.object({
  position: z.coerce.number().int().positive().max(10_000_000),
});

adminQueueRoutes.get('/lookup', requireAdmin, async (req, res) => {
  const parsed = LookupQuery.safeParse({
    position: typeof req.query.position === 'string' ? req.query.position : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid position.' });
    return;
  }

  try {
    const result = await lookupByPosition(parsed.data.position);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.queue.lookup.performed',
      entity: {
        kind: 'pool_placement',
        id: result.prospect?.prospectId ?? `position:${parsed.data.position}`,
        displayLabel: `#${parsed.data.position}`,
      },
      severity: 'info',
      after: {
        position: parsed.data.position,
        found: result.found,
        vacant: result.vacant,
        prospectId: result.prospect?.prospectId ?? null,
      },
      reason: null,
      context: baseContext(req, '/api/admin/queue/lookup', 'GET'),
    });

    const body: McsQueueLookupResponse = { ok: true, result };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Lookup failed: ${msg}` });
  }
});

/* ─── GET /visible-window  (E.3 read) ─────────────────────────────── */

adminQueueRoutes.get('/visible-window', requireAdmin, async (req, res) => {
  try {
    const setting = await getVisibleWindow();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.queue.visible_window.viewed',
      entity: {
        kind: 'queue_rule',
        id: 'queue_visible_window',
        displayLabel: 'visible window (.com position stack)',
      },
      severity: 'info',
      after: { value: setting.value },
      reason: null,
      context: baseContext(req, '/api/admin/queue/visible-window', 'GET'),
    });

    const body: McsQueueVisibleWindowResponse = {
      ok: true,
      value: setting.value,
      defaultValue: setting.defaultValue,
      lastChangedAt: setting.lastChangedAt,
      lastChangedBy: setting.lastChangedBy,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Read failed: ${msg}` });
  }
});

/* ─── PUT /visible-window  (E.3 write, audited) ───────────────────── */

const VisibleWindowBody = z.object({
  value: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  reason: z.string().min(1).max(500).optional(),
});

adminQueueRoutes.put('/visible-window', requireAdmin, async (req, res) => {
  const parsed = VisibleWindowBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ ok: false, error: 'Invalid body: value must be 5, 10, or 20.' });
    return;
  }
  const actor = adminActorFromRequest(req);

  try {
    const { before, after } = await setVisibleWindow({
      value: parsed.data.value as McsQueueVisibleWindow,
      actorTmagId: req.session!.tmagId,
    });

    await appendAuditEntry({
      actor,
      action: 'admin.queue.visible_window.changed',
      entity: {
        kind: 'queue_rule',
        id: 'queue_visible_window',
        displayLabel: 'visible window (.com position stack)',
      },
      severity: 'info',
      before: { value: before },
      after: { value: after },
      reason: parsed.data.reason ?? null,
      context: baseContext(req, '/api/admin/queue/visible-window', 'PUT'),
    });

    // Read-back: re-query before responding so the response reflects what
    // a subsequent GET will see. This is the "READ BACK your own writes
    // before claiming done" rule from the brief, enforced at the API edge.
    const verified = await getVisibleWindow();
    if (verified.value !== after) {
      throw new Error(
        `visible_window_route_readback_mismatch: persisted ${after} read ${verified.value}`,
      );
    }

    const body: McsQueueVisibleWindowResponse = {
      ok: true,
      value: verified.value,
      defaultValue: verified.defaultValue,
      lastChangedAt: verified.lastChangedAt,
      lastChangedBy: verified.lastChangedBy,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Update failed: ${msg}` });
  }
});

/* ─── GET /ticker  (E.5 snapshot, real names) ─────────────────────── */

const TickerQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

adminQueueRoutes.get('/ticker', requireAdmin, async (req, res) => {
  const parsed = TickerQuery.safeParse({
    limit: typeof req.query.limit === 'string' ? req.query.limit : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid limit.' });
    return;
  }
  const limit = parsed.data.limit ?? 40;

  try {
    const { entries, globalMaxPosition } = await listAdminTicker(limit);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.queue.ticker.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { limit, returned: entries.length, globalMaxPosition },
      reason: null,
      context: baseContext(req, '/api/admin/queue/ticker', 'GET'),
    });

    const body: McsQueueAdminTickerResponse = {
      ok: true,
      entries,
      globalMaxPosition,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Ticker failed: ${msg}` });
  }
});

/* ─── GET /ticker/stream  (E.5 SSE) ───────────────────────────────── */

const SSE_PING_INTERVAL_MS = 30_000;
const SSE_SNAPSHOT_LIMIT = 40;

function sseFrame(event: string, data: unknown, id?: string): string {
  const lines: string[] = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

function tickerEntryToSseEvent(entry: McsAdminTickerEntry): McsAdminQueueTickerSseEvent {
  return {
    kind: 'admin_queue_placement',
    eventId: `admin_queue_evt_${entry.prospectId}_${entry.placedAt}`,
    at: entry.placedAt,
    positionNumber: entry.positionNumber,
    prospectId: entry.prospectId,
    firstName: entry.firstName,
    lastName: entry.lastName,
    city: entry.city,
    stateOrRegion: entry.stateOrRegion,
    sponsorTmagId: entry.sponsorTmagId,
    deepLink: entry.deepLink,
  };
}

adminQueueRoutes.get('/ticker/stream', requireAdmin, async (req: Request, res: Response) => {
  await appendAuditEntry({
    actor: adminActorFromRequest(req),
    action: 'admin.queue.ticker.stream.opened',
    entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
    severity: 'info',
    reason: null,
    context: baseContext(req, '/api/admin/queue/ticker/stream', 'GET'),
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Initial snapshot — most-recent placements (real names).
  try {
    const { entries, globalMaxPosition } = await listAdminTicker(SSE_SNAPSHOT_LIMIT);
    const snapshot: McsAdminQueueTickerSnapshot = { globalMaxPosition, recent: entries };
    res.write(sseFrame('snapshot', snapshot));
  } catch (err) {
    res.write(`: snapshot_error ${(err as Error).message}\n\n`);
  }

  // Live fan-out — subscribe to the SAME process-wide placement bus the
  // .com ticker uses. On each event, async-enrich with the real lastName
  // and re-emit as an admin_queue_placement frame.
  const placementSub = subscribePlacements((event: McsPlacementEvent) => {
    void (async () => {
      try {
        // The placement event from the bus carries positionNumber, firstName,
        // lastInitial, city, stateOrRegion, placedAt — but NOT prospectId or
        // lastName (anonymized for the .com surface). Look up the placement
        // by positionNumber to recover prospectId + sponsorTmagId, then load
        // the prospect for the full lastName. Acceptable round-trip cost at
        // single-viewer admin scale.
        const placement = await lookupPlacementByPosition(event.positionNumber);
        if (!placement) return;
        const enriched = await enrichPlacementForAdmin(
          placement.prospectId,
          event.positionNumber,
          event.placedAt,
          placement.sponsorTmagId,
        );
        if (!enriched) return;
        const wire = tickerEntryToSseEvent(enriched);
        res.write(sseFrame(wire.kind, wire, wire.eventId));
      } catch {
        // closed socket or transient enrich failure — teardown handles cleanup.
      }
    })();
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      // teardown will fire on `close`.
    }
  }, SSE_PING_INTERVAL_MS);

  const streamId = `admin-queue-stream-${randomBytes(4).toString('hex')}`;
  const teardown = () => {
    clearInterval(heartbeat);
    placementSub.unsubscribe();
    // eslint-disable-next-line no-console
    console.log(`[admin-queue-stream] closed ${streamId} tmagId=${req.session!.tmagId}`);
  };
  req.on('close', teardown);
  req.on('aborted', teardown);
  // eslint-disable-next-line no-console
  console.log(`[admin-queue-stream] opened ${streamId} tmagId=${req.session!.tmagId}`);
});

// Small Mongo lookup colocated with the SSE handler (the only caller). Kept
// here to avoid widening adminQueueOversight's surface for a one-shot helper.
import { gatewayCall } from '../../services/gateway.js';

async function lookupPlacementByPosition(
  positionNumber: number,
): Promise<{ prospectId: string; sponsorTmagId: string } | null> {
  const result = await gatewayCall<{
    documents: Array<{ prospectId: string; sponsorTmagId: string }>;
  }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'pool_placements',
    filter: { positionNumber },
    limit: 1,
  });
  return result.documents[0] ?? null;
}

/* ─── GET /rules   (E.6 list) ─────────────────────────────────────── */

adminQueueRoutes.get('/rules', requireAdmin, async (req, res) => {
  try {
    const rules = await listQueueRules();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.queue.rules.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { count: rules.length },
      reason: null,
      context: baseContext(req, '/api/admin/queue/rules', 'GET'),
    });

    const body: McsQueueRulesResponse = { ok: true, rules };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Rules read failed: ${msg}` });
  }
});

/* ─── PUT /rules/:key  (E.6 write, audited) ───────────────────────── */

const RuleParams = z.object({
  key: z.string().min(1).max(80),
});

const RuleBody = z.object({
  value: z.number().finite(),
  reason: z.string().min(1).max(500),
});

adminQueueRoutes.put('/rules/:key', requireAdmin, async (req, res) => {
  const params = RuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: 'Invalid rule key.' });
    return;
  }
  const body = RuleBody.safeParse(req.body);
  if (!body.success) {
    res
      .status(400)
      .json({ ok: false, error: 'Body must include {value:number, reason:string}.' });
    return;
  }

  const actor = adminActorFromRequest(req);
  try {
    const { rule, before, after } = await setQueueRule({
      key: params.data.key,
      value: body.data.value,
      actorTmagId: req.session!.tmagId,
    });

    await appendAuditEntry({
      actor,
      action: 'admin.queue.rule.changed',
      entity: {
        kind: 'queue_rule',
        id: params.data.key,
        displayLabel: rule.label,
      },
      severity: 'info',
      before: { value: before },
      after: { value: after },
      reason: body.data.reason,
      context: baseContext(req, `/api/admin/queue/rules/${params.data.key}`, 'PUT'),
    });

    // Read-back verification (mirrors the visible-window path).
    const verified = await listQueueRules();
    const verifiedRule = verified.find((r) => r.key === params.data.key);
    if (!verifiedRule || verifiedRule.currentValue !== after) {
      throw new Error(
        `queue_rule_route_readback_mismatch: persisted ${after} read ${verifiedRule?.currentValue ?? '<missing>'}`,
      );
    }

    res.json({ ok: true, rule: verifiedRule });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg.startsWith('unknown_queue_rule_key')) {
      res.status(404).json({ ok: false, error: 'Unknown rule key.' });
      return;
    }
    if (msg.startsWith('invalid_queue_rule_value')) {
      res.status(400).json({ ok: false, error: msg });
      return;
    }
    res.status(500).json({ ok: false, error: `Rule update failed: ${msg}` });
  }
});

// Re-export for the route mounter — VISIBLE_WINDOW_VALUES is consumed by
// the admin client via shared types, but exporting it here lets a test
// (or a future API) check the canonical set without re-importing the domain.
export { VISIBLE_WINDOW_VALUES };
