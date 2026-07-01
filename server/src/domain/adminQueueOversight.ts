/**
 * Admin Queue / Recruitment Leg Oversight (locked-spec / ADMIN Design
 * Section E, project-wireframe 4.E). The /admin Section E surface; Kevin
 * only.
 *
 * Mirrors the team-wide holding tank (domain/holdingTank.ts) — never
 * overrides it. Monotonic position numbers are SACRED: flushes vacate
 * slots but never renumber (locked-spec 3.2). This module is read-side
 * for E.1/E.2/E.4/E.5 plus the audited rule-change writes for E.3/E.6.
 *
 * Reuse, do not invent:
 *   • Pool counter + pool_placements + pool_events live in holdingTank.
 *   • Placement event bus lives in services/poolEvents (the .com ticker
 *     source — admin ticker mirrors it).
 *   • Audit substrate lives in domain/auditLog (4.J built).
 *
 * Storage owned by this module:
 *   • momentum.admin_settings — single-row docs keyed by `_id`. Today:
 *       _id='queue_visible_window'   (E.3: 5 | 10 | 20, default 10)
 *       _id='queue_flush_weeks'      (E.6: positive integer, default 8)
 *     Persisted server-side per the TASK brief so admin can set without
 *     touching shared .com files. The .com surface reads the same doc
 *     at integration time (see claude-notes-admin-e.md for contract).
 */

import { gatewayCall } from '../services/gateway.js';
import type {
  AdminTickerEntry,
  IsoTimestamp,
  QueueDepthMovement,
  QueueGrowthBucket,
  QueueGrowthSparkline,
  QueueLookupProspect,
  QueueLookupResult,
  QueueNumbers,
  QueueOversightSummary,
  QueueRule,
  QueueVisibleWindow,
  TokenState,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PLACEMENTS_COLLECTION = 'pool_placements';
const COUNTERS_COLLECTION = 'pool_counters';
const PROSPECTS_COLLECTION = 'prospects';
const ADMIN_SETTINGS_COLLECTION = 'admin_settings';
const TEAM_POOL_ID = 'tm_team_pool';

/** Cross-section deep-link locked with Agent D — see TASK-admin-e.md. */
export function buildProspectDeepLink(prospectId: string): string {
  return `/prospects?prospectId=${encodeURIComponent(prospectId)}`;
}

/* ─── settings: visible window (E.3) ──────────────────────────────── */

export const VISIBLE_WINDOW_VALUES: ReadonlyArray<QueueVisibleWindow> = [5, 10, 20];
export const VISIBLE_WINDOW_DEFAULT: QueueVisibleWindow = 10;
const VISIBLE_WINDOW_DOC_ID = 'queue_visible_window';

export interface VisibleWindowSetting {
  value: QueueVisibleWindow;
  defaultValue: QueueVisibleWindow;
  lastChangedAt: IsoTimestamp | null;
  lastChangedBy: string | null;
}

interface AdminSettingDoc {
  _id?: string;
  value: number;
  updatedAt?: string;
  updatedBy?: string;
}

function isQueueVisibleWindow(v: unknown): v is QueueVisibleWindow {
  return v === 5 || v === 10 || v === 20;
}

export async function getVisibleWindow(): Promise<VisibleWindowSetting> {
  const doc = await readAdminSetting(VISIBLE_WINDOW_DOC_ID);
  if (!doc) {
    return {
      value: VISIBLE_WINDOW_DEFAULT,
      defaultValue: VISIBLE_WINDOW_DEFAULT,
      lastChangedAt: null,
      lastChangedBy: null,
    };
  }
  const value = isQueueVisibleWindow(doc.value) ? doc.value : VISIBLE_WINDOW_DEFAULT;
  return {
    value,
    defaultValue: VISIBLE_WINDOW_DEFAULT,
    lastChangedAt: doc.updatedAt ?? null,
    lastChangedBy: doc.updatedBy ?? null,
  };
}

export interface SetVisibleWindowInput {
  value: QueueVisibleWindow;
  actorTmagId: string;
}

/**
 * Write the new visible-window setting. Returns the prior value so the
 * caller (route layer) can append an audit entry with before/after.
 * Read-back: this function re-queries after writing to confirm.
 */
export async function setVisibleWindow(
  input: SetVisibleWindowInput,
): Promise<{ before: QueueVisibleWindow; after: QueueVisibleWindow }> {
  const before = (await getVisibleWindow()).value;
  await upsertAdminSetting(VISIBLE_WINDOW_DOC_ID, {
    value: input.value,
    updatedAt: new Date().toISOString(),
    updatedBy: input.actorTmagId,
  });
  const after = (await getVisibleWindow()).value;
  if (after !== input.value) {
    throw new Error(
      `visible_window_readback_mismatch: wrote ${input.value} read ${after}`,
    );
  }
  return { before, after };
}

/* ─── settings: queue rules (E.6) ─────────────────────────────────── */

const FLUSH_WEEKS_DOC_ID = 'queue_flush_weeks';
export const FLUSH_WEEKS_DEFAULT = 8;

interface QueueRuleSpec {
  key: string;
  docId: string;
  label: string;
  description: string;
  defaultValue: number;
  unit: string | null;
  validate: (v: number) => boolean;
}

const QUEUE_RULE_REGISTRY: ReadonlyArray<QueueRuleSpec> = [
  {
    key: 'flush_weeks',
    docId: FLUSH_WEEKS_DOC_ID,
    label: 'Holding-tank flush window',
    description:
      'Weeks a placement may sit in the tank before TTL expiration. Resolved to 8 (locked-spec J.5.2). Changes apply to future placements.',
    defaultValue: FLUSH_WEEKS_DEFAULT,
    unit: 'weeks',
    validate: (v) => Number.isInteger(v) && v >= 1 && v <= 52,
  },
];

export async function listQueueRules(): Promise<QueueRule[]> {
  const rules: QueueRule[] = [];
  for (const spec of QUEUE_RULE_REGISTRY) {
    const doc = await readAdminSetting(spec.docId);
    const currentValue =
      typeof doc?.value === 'number' && spec.validate(doc.value)
        ? doc.value
        : spec.defaultValue;
    rules.push({
      key: spec.key,
      label: spec.label,
      description: spec.description,
      currentValue,
      defaultValue: spec.defaultValue,
      unit: spec.unit,
      lastChangedAt: doc?.updatedAt ?? null,
      lastChangedBy: doc?.updatedBy ?? null,
    });
  }
  return rules;
}

export interface SetQueueRuleInput {
  key: string;
  value: number;
  actorTmagId: string;
}

export interface SetQueueRuleResult {
  rule: QueueRule;
  before: number;
  after: number;
}

export async function setQueueRule(
  input: SetQueueRuleInput,
): Promise<SetQueueRuleResult> {
  const spec = QUEUE_RULE_REGISTRY.find((r) => r.key === input.key);
  if (!spec) {
    throw new Error(`unknown_queue_rule_key: ${input.key}`);
  }
  if (!spec.validate(input.value)) {
    throw new Error(`invalid_queue_rule_value: ${input.value}`);
  }

  const beforeRules = await listQueueRules();
  const beforeEntry = beforeRules.find((r) => r.key === input.key);
  const before = typeof beforeEntry?.currentValue === 'number'
    ? beforeEntry.currentValue
    : spec.defaultValue;

  await upsertAdminSetting(spec.docId, {
    value: input.value,
    updatedAt: new Date().toISOString(),
    updatedBy: input.actorTmagId,
  });

  const afterRules = await listQueueRules();
  const afterEntry = afterRules.find((r) => r.key === input.key);
  if (!afterEntry || afterEntry.currentValue !== input.value) {
    throw new Error(
      `queue_rule_readback_mismatch: wrote ${input.value} read ${afterEntry?.currentValue ?? '<missing>'}`,
    );
  }
  const after = afterEntry.currentValue as number;
  return { rule: afterEntry, before, after };
}

/* ─── admin_settings storage primitives ───────────────────────────── */

async function readAdminSetting(docId: string): Promise<AdminSettingDoc | null> {
  const result = await gatewayCall<{ documents: AdminSettingDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: ADMIN_SETTINGS_COLLECTION,
      filter: { _id: docId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

async function upsertAdminSetting(
  docId: string,
  fields: AdminSettingDoc,
): Promise<void> {
  // The gateway's mongo.update does NOT honor upsert:true (preserved at
  // top of tripleStack.ts). Branch on existence.
  const existing = await readAdminSetting(docId);
  if (existing) {
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: ADMIN_SETTINGS_COLLECTION,
      filter: { _id: docId },
      update: { $set: { ...fields } },
    });
    return;
  }
  await gatewayCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: ADMIN_SETTINGS_COLLECTION,
    documents: [{ _id: docId, ...fields }],
  });
}

/* ─── E.1  depth and movement ─────────────────────────────────────── */

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

interface PlacementRow {
  prospectId: string;
  positionNumber: number;
  placedAt: string;
  flushedAt: string | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
  sponsorTmagId: string;
}

async function countPlacements(filter: Record<string, unknown>): Promise<number> {
  const result = await gatewayCall<{ count: number; documents: PlacementRow[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PLACEMENTS_COLLECTION,
      filter,
      // We rely on count returned by the gateway; large filters cap docs
      // server-side but the count is authoritative. Limit 1 to keep the
      // round-trip small.
      limit: 1,
    },
  );
  return typeof result.count === 'number' ? result.count : result.documents.length;
}

export async function computeQueueDepthMovement(): Promise<QueueDepthMovement> {
  const now = new Date();
  const todayStartIso = utcDayStart(now).toISOString();

  const [
    currentDepth,
    todaysPlacements,
    todaysExpirations,
    todaysManualFlushes,
    todaysEnrollments,
  ] = await Promise.all([
    countPlacements({ flushedAt: null }),
    countPlacements({ placedAt: { $gte: todayStartIso } }),
    countPlacements({
      flushedAt: { $gte: todayStartIso },
      flushReason: 'expired',
    }),
    countPlacements({
      flushedAt: { $gte: todayStartIso },
      flushReason: 'archived',
    }),
    countPlacements({
      flushedAt: { $gte: todayStartIso },
      flushReason: 'enrolled',
    }),
  ]);

  const netMovement =
    todaysPlacements - todaysExpirations - todaysManualFlushes - todaysEnrollments;

  return {
    currentDepth,
    todaysPlacements,
    todaysExpirations,
    todaysManualFlushes,
    todaysEnrollments,
    netMovement,
    computedAt: now.toISOString(),
  };
}

/* ─── E.2  fixed assigned queue numbers ───────────────────────────── */

export async function computeQueueNumbers(): Promise<QueueNumbers> {
  const now = new Date();
  const todayStartIso = utcDayStart(now).toISOString();

  const [highestEver, highestTodayRows, vacantSlots] = await Promise.all([
    readPoolCounter(),
    gatewayCall<{ documents: Array<{ positionNumber: number }> }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: PLACEMENTS_COLLECTION,
        filter: { placedAt: { $gte: todayStartIso } },
        sort: { positionNumber: -1 },
        limit: 1,
      },
    ),
    countPlacements({ flushedAt: { $ne: null } }),
  ]);

  const highestToday = highestTodayRows.documents[0]?.positionNumber ?? 0;

  return {
    highestToday,
    highestEver,
    vacantSlots,
    computedAt: now.toISOString(),
  };
}

async function readPoolCounter(): Promise<number> {
  const result = await gatewayCall<{ documents: Array<{ current: number }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COUNTERS_COLLECTION,
      filter: { _id: TEAM_POOL_ID },
      limit: 1,
    },
  );
  return result.documents[0]?.current ?? 0;
}

/* ─── E.2  position lookup ────────────────────────────────────────── */

export async function lookupByPosition(
  position: number,
): Promise<QueueLookupResult> {
  if (!Number.isInteger(position) || position < 1) {
    return { position, found: false, vacant: false, prospect: null };
  }

  const placementRes = await gatewayCall<{
    documents: Array<PlacementRow & { expiresAt?: string }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PLACEMENTS_COLLECTION,
    filter: { positionNumber: position },
    limit: 1,
  });

  const placement = placementRes.documents[0];
  if (!placement) {
    // Position not minted yet.
    return { position, found: false, vacant: false, prospect: null };
  }

  if (placement.flushedAt) {
    // The slot is vacant — visible line shows an empty position number per
    // the monotonic contract. We still return found:false (no live prospect)
    // but vacant:true so the UI can render "vacant — flushed (reason)".
    const prospect = await loadProspect(placement.prospectId);
    return {
      position,
      found: false,
      vacant: true,
      prospect: prospect
        ? {
            ...prospect,
            placedAt: placement.placedAt,
            sponsorTmagId: placement.sponsorTmagId,
            flushedAt: placement.flushedAt,
            flushReason: placement.flushReason,
            deepLink: buildProspectDeepLink(placement.prospectId),
          }
        : null,
    };
  }

  const prospect = await loadProspect(placement.prospectId);
  if (!prospect) {
    return { position, found: false, vacant: false, prospect: null };
  }

  return {
    position,
    found: true,
    vacant: false,
    prospect: {
      ...prospect,
      placedAt: placement.placedAt,
      sponsorTmagId: placement.sponsorTmagId,
      flushedAt: null,
      flushReason: null,
      deepLink: buildProspectDeepLink(placement.prospectId),
    },
  };
}

interface ProspectRow {
  prospectId: string;
  firstName?: string;
  lastName?: string;
  lastInitial?: string;
  state?: TokenState;
  location?: { city?: string; stateOrRegion?: string };
}

async function loadProspect(prospectId: string): Promise<Omit<
  QueueLookupProspect,
  'placedAt' | 'sponsorTmagId' | 'flushedAt' | 'flushReason' | 'deepLink'
> | null> {
  const result = await gatewayCall<{ documents: ProspectRow[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { prospectId },
      limit: 1,
    },
  );
  const row = result.documents[0];
  if (!row) return null;
  return {
    prospectId: row.prospectId,
    firstName: row.firstName ?? '',
    lastName: row.lastName ?? '',
    state: row.state ?? 'video_complete',
    city: row.location?.city ?? '',
    stateOrRegion: row.location?.stateOrRegion ?? '',
  };
}

/* ─── E.4  growth sparkline ───────────────────────────────────────── */

export async function computeGrowthSparkline(): Promise<QueueGrowthSparkline> {
  const now = new Date();
  const todayStart = utcDayStart(now);
  const days30Start = new Date(todayStart);
  days30Start.setUTCDate(days30Start.getUTCDate() - 29);
  const days7Start = new Date(todayStart);
  days7Start.setUTCDate(days7Start.getUTCDate() - 6);

  const [rolling30, rolling7, lifetime, daily30] = await Promise.all([
    countPlacements({ placedAt: { $gte: days30Start.toISOString() } }),
    countPlacements({ placedAt: { $gte: days7Start.toISOString() } }),
    readPoolCounter(),
    buildDailyBuckets(days30Start, todayStart),
  ]);

  return { rolling7, rolling30, lifetime, daily30 };
}

async function buildDailyBuckets(
  startUtcDay: Date,
  endUtcDay: Date,
): Promise<QueueGrowthBucket[]> {
  // Pull all placedAt timestamps in the window in one query. At v1 volumes
  // (well under 10k/30d) this is well-bounded; if it grows we move to an
  // aggregation pipeline. For now the simplest read is fastest to verify.
  const upperExclusive = new Date(endUtcDay);
  upperExclusive.setUTCDate(upperExclusive.getUTCDate() + 1);

  const result = await gatewayCall<{
    documents: Array<{ placedAt: string }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PLACEMENTS_COLLECTION,
    filter: {
      placedAt: {
        $gte: startUtcDay.toISOString(),
        $lt: upperExclusive.toISOString(),
      },
    },
    sort: { placedAt: 1 },
    // 30 days × max throughput is the cap; 5000 is generous.
    limit: 5000,
  });

  const bucketByDate = new Map<string, number>();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(startUtcDay);
    d.setUTCDate(d.getUTCDate() + i);
    bucketByDate.set(toDateKey(d), 0);
  }
  for (const doc of result.documents) {
    const key = toDateKey(new Date(doc.placedAt));
    const prev = bucketByDate.get(key);
    if (typeof prev === 'number') bucketByDate.set(key, prev + 1);
  }

  return Array.from(bucketByDate.entries()).map(([date, count]) => ({
    date,
    count,
  }));
}

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ─── E.5  admin ticker (real names) ──────────────────────────────── */

export async function listAdminTicker(limit: number): Promise<{
  entries: AdminTickerEntry[];
  globalMaxPosition: number;
}> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const [globalMaxPosition, placements] = await Promise.all([
    readPoolCounter(),
    gatewayCall<{ documents: Array<PlacementRow & { _id?: string }> }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: PLACEMENTS_COLLECTION,
        filter: { flushedAt: null },
        sort: { placedAt: -1 },
        limit: safeLimit,
      },
    ),
  ]);

  const entries: AdminTickerEntry[] = [];
  for (const p of placements.documents) {
    const prospect = await loadProspect(p.prospectId);
    if (!prospect) continue;
    entries.push({
      positionNumber: p.positionNumber,
      prospectId: p.prospectId,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      city: prospect.city,
      stateOrRegion: prospect.stateOrRegion,
      placedAt: p.placedAt,
      sponsorTmagId: p.sponsorTmagId,
      deepLink: buildProspectDeepLink(p.prospectId),
    });
  }

  return { entries, globalMaxPosition };
}

/**
 * Enrich a single placement event (from the in-process bus) into an admin
 * ticker entry with the real lastName. Reuses the prospect row.
 *
 * Used by the SSE handler: subscribes to subscribePlacements(), then
 * upgrades the anonymized event into an AdminTickerEntry for Kevin.
 */
export async function enrichPlacementForAdmin(
  prospectId: string,
  positionNumber: number,
  placedAt: IsoTimestamp,
  sponsorTmagId: string,
): Promise<AdminTickerEntry | null> {
  const prospect = await loadProspect(prospectId);
  if (!prospect) return null;
  return {
    positionNumber,
    prospectId,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    city: prospect.city,
    stateOrRegion: prospect.stateOrRegion,
    placedAt,
    sponsorTmagId,
    deepLink: buildProspectDeepLink(prospectId),
  };
}

/* ─── composite summary (page bootstrap) ──────────────────────────── */

export async function computeQueueOversightSummary(): Promise<QueueOversightSummary> {
  const [depthMovement, numbers, growth, visibleWindow] = await Promise.all([
    computeQueueDepthMovement(),
    computeQueueNumbers(),
    computeGrowthSparkline(),
    getVisibleWindow(),
  ]);
  return {
    depthMovement,
    numbers,
    growth,
    visibleWindow: visibleWindow.value,
    computedAt: new Date().toISOString(),
  };
}
