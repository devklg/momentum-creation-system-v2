import { randomUUID } from 'node:crypto';
import type {
  McsResourceCatalogEntry,
  McsResourceUsageEvent,
  McsResourceUsageRow,
  McsResourceUsageSummaryResponse,
} from '@momentum/shared';
import {
  MCS_RESOURCE_STALE_REVIEW_DAYS,
  MCS_RESOURCE_USAGE_SCHEMA_VERSION,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { RESOURCE_CATALOG_MONGO_COLLECTION } from './resourceCatalogSchema.js';
import { verifyResourcePublishingGate } from './resourcePublishingGate.js';

export const RESOURCE_USAGE_MONGO_COLLECTION = 'tmag_resource_usage_events';
export const RESOURCE_USAGE_CHROMA_COLLECTION = 'mcs_resource_usage_events';

type Persistence = typeof persistenceCall;
type VerifyGate = typeof verifyResourcePublishingGate;
type TripleWrite = typeof tripleStackWrite;

interface UsageAggregate {
  _id: string;
  openCount: number;
  memberIds?: string[];
  lastOpenedAt: string | null;
}

interface RecentAggregate {
  _id: string;
  opensLast30Days: number;
}

function teamAudience(entry: McsResourceCatalogEntry): boolean {
  return entry.audience.surfaces.includes('team') &&
    entry.audience.roles.some((role) => role === 'brand_ambassador' || role === 'leader');
}

export async function recordVerifiedResourceOpen(
  resourceVersionId: string,
  actorTmagId: string,
  options: { persistence?: Persistence; verifyGate?: VerifyGate; write?: TripleWrite; now?: Date } = {},
): Promise<McsResourceUsageEvent | null> {
  const persistence = options.persistence ?? persistenceCall;
  const verifyGate = options.verifyGate ?? verifyResourcePublishingGate;
  const write = options.write ?? tripleStackWrite;
  const result = await persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: RESOURCE_CATALOG_MONGO_COLLECTION,
    filter: { resourceVersionId, lifecycle: 'active' },
    limit: 1,
  });
  const entry = result.documents?.[0];
  if (!entry || !teamAudience(entry)) return null;
  if (!(await verifyGate(resourceVersionId, 'retrieve', persistence)).allowed) return null;

  const occurredAt = (options.now ?? new Date()).toISOString();
  const usageEventId = `resource_usage:${randomUUID()}`;
  const event: McsResourceUsageEvent = {
    schemaVersion: MCS_RESOURCE_USAGE_SCHEMA_VERSION,
    usageEventId,
    resourceId: entry.resourceId,
    resourceVersionId,
    actorTmagId,
    eventType: 'opened',
    occurredAt,
  };
  await write({
    id: usageEventId,
    mongoCollection: RESOURCE_USAGE_MONGO_COLLECTION,
    mongoDoc: event as unknown as Record<string, unknown>,
    neo4j: {
      cypher: [
        'MERGE (e:TmagResourceUsageEvent {usageEventId:$id})',
        'SET e.schemaVersion=$schemaVersion, e.eventType=$eventType, e.occurredAt=$occurredAt',
        'MERGE (b:TeamMagnificentMember {tmagId:$actorTmagId})',
        'MATCH (v:TmagResourceVersion {resourceVersionId:$resourceVersionId})',
        'MERGE (b)-[:OPENED_RESOURCE]->(e)',
        'MERGE (e)-[:OPENED_VERSION]->(v)',
      ].join('\n'),
      params: event as unknown as Record<string, unknown>,
    },
    chroma: {
      collection: RESOURCE_USAGE_CHROMA_COLLECTION,
      document: `Resource opened: ${entry.title}`,
      metadata: {
        schemaVersion: event.schemaVersion,
        resourceVersionId,
        resourceId: entry.resourceId,
        actorTmagId,
        eventType: event.eventType,
        occurredAt,
      },
    },
  });
  return event;
}

function staleAgeDays(updatedAt: string, now: Date): number | null {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

export async function buildResourceUsageSummary(
  options: { persistence?: Persistence; now?: Date } = {},
): Promise<McsResourceUsageSummaryResponse> {
  const persistence = options.persistence ?? persistenceCall;
  const now = options.now ?? new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [catalog, allTime, recent] = await Promise.all([
    persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
      database: 'momentum', collection: RESOURCE_CATALOG_MONGO_COLLECTION,
      filter: { lifecycle: 'active', 'audience.surfaces': 'team' }, sort: { title: 1 }, limit: 500,
    }),
    persistence<{ results?: UsageAggregate[] }>('mongodb', 'aggregate', {
      database: 'momentum', collection: RESOURCE_USAGE_MONGO_COLLECTION,
      pipeline: [
        { $match: { eventType: 'opened' } },
        { $group: { _id: '$resourceVersionId', openCount: { $sum: 1 }, memberIds: { $addToSet: '$actorTmagId' }, lastOpenedAt: { $max: '$occurredAt' } } },
      ],
    }),
    persistence<{ results?: RecentAggregate[] }>('mongodb', 'aggregate', {
      database: 'momentum', collection: RESOURCE_USAGE_MONGO_COLLECTION,
      pipeline: [
        { $match: { eventType: 'opened', occurredAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$resourceVersionId', opensLast30Days: { $sum: 1 } } },
      ],
    }),
  ]);
  const allTimeByVersion = new Map((allTime.results ?? []).map((row) => [row._id, row]));
  const recentByVersion = new Map((recent.results ?? []).map((row) => [row._id, row.opensLast30Days]));
  const resources: McsResourceUsageRow[] = (catalog.documents ?? [])
    .filter(teamAudience)
    .map((entry) => {
      const usage = allTimeByVersion.get(entry.resourceVersionId);
      const ageDays = staleAgeDays(entry.updatedAt, now);
      return {
        resourceId: entry.resourceId,
        resourceVersionId: entry.resourceVersionId,
        title: entry.title,
        kind: entry.kind,
        version: entry.version,
        updatedAt: entry.updatedAt,
        openCount: usage?.openCount ?? 0,
        uniqueMemberCount: usage?.memberIds?.length ?? 0,
        opensLast30Days: recentByVersion.get(entry.resourceVersionId) ?? 0,
        lastOpenedAt: usage?.lastOpenedAt ?? null,
        staleReviewWarning: ageDays === null || ageDays >= MCS_RESOURCE_STALE_REVIEW_DAYS,
        staleReviewAgeDays: ageDays,
      };
    })
    .sort((left, right) => right.openCount - left.openCount || left.title.localeCompare(right.title));

  return {
    ok: true,
    schemaVersion: MCS_RESOURCE_USAGE_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    policy: { staleReviewDays: MCS_RESOURCE_STALE_REVIEW_DAYS, warningOnly: true, changesPublishingState: false },
    totals: {
      activeResources: resources.length,
      totalOpens: resources.reduce((sum, row) => sum + row.openCount, 0),
      opensLast30Days: resources.reduce((sum, row) => sum + row.opensLast30Days, 0),
      neverOpened: resources.filter((row) => row.openCount === 0).length,
      staleReviewWarnings: resources.filter((row) => row.staleReviewWarning).length,
    },
    resources,
  };
}
