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
import {
  AdminCursorError,
  combineMongoFilters,
  decodeAdminCursor,
  descendingKeysetFilter,
  encodeAdminCursor,
  type AdminPageInfo,
} from './adminPagination.js';

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

interface PageUsageAggregate extends UsageAggregate {
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

const RESOURCE_ANALYTICS_SCOPE = 'admin_resource_analytics.v1';

export async function buildResourceUsageSummaryPage(
  options: {
    persistence?: Persistence;
    now?: Date;
    pageSize?: number;
    cursor?: string;
  } = {},
): Promise<McsResourceUsageSummaryResponse & { pageInfo: AdminPageInfo }> {
  const persistence = options.persistence ?? persistenceCall;
  const now = options.now ?? new Date();
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 50));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const staleCutoff = new Date(now.getTime() - MCS_RESOURCE_STALE_REVIEW_DAYS * 86_400_000).toISOString();
  const baseFilter: Record<string, unknown> = {
    lifecycle: 'active',
    'audience.surfaces': 'team',
    'audience.roles': { $in: ['brand_ambassador', 'leader'] },
  };
  const contract = { sort: 'updatedAt_desc_resourceVersionId_desc' };
  let keyset: Record<string, unknown> = {};
  if (options.cursor) {
    const keys = decodeAdminCursor({
      token: options.cursor,
      scope: RESOURCE_ANALYTICS_SCOPE,
      contract,
      requiredKeys: ['updatedAt', 'resourceVersionId'],
    });
    const cursorMatch = await persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: RESOURCE_CATALOG_MONGO_COLLECTION,
      filter: combineMongoFilters(baseFilter, {
        updatedAt: keys.updatedAt,
        resourceVersionId: keys.resourceVersionId,
      }),
      limit: 1,
    });
    if (!cursorMatch.documents?.[0]) throw new AdminCursorError();
    keyset = descendingKeysetFilter(
      'updatedAt',
      'resourceVersionId',
      keys.updatedAt!,
      keys.resourceVersionId!,
    );
  }

  const [catalog, totalsResult] = await Promise.all([
    persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: RESOURCE_CATALOG_MONGO_COLLECTION,
      filter: combineMongoFilters(baseFilter, keyset),
      sort: { updatedAt: -1, resourceVersionId: -1 },
      limit: pageSize + 1,
    }),
    persistence<{ results?: Array<{
      activeResources: number;
      totalOpens: number;
      opensLast30Days: number;
      neverOpened: number;
      staleReviewWarnings: number;
    }> }>('mongodb', 'aggregate', {
      database: 'momentum',
      collection: RESOURCE_CATALOG_MONGO_COLLECTION,
      pipeline: [
        { $match: baseFilter },
        {
          $lookup: {
            from: RESOURCE_USAGE_MONGO_COLLECTION,
            let: { versionId: '$resourceVersionId' },
            pipeline: [
              { $match: { $expr: { $and: [
                { $eq: ['$resourceVersionId', '$$versionId'] },
                { $eq: ['$eventType', 'opened'] },
              ] } } },
              { $group: {
                _id: null,
                openCount: { $sum: 1 },
                recentCount: { $sum: { $cond: [{ $gte: ['$occurredAt', thirtyDaysAgo] }, 1, 0] } },
              } },
            ],
            as: 'usage',
          },
        },
        { $set: { usage: { $first: '$usage' } } },
        { $group: {
          _id: null,
          activeResources: { $sum: 1 },
          totalOpens: { $sum: { $ifNull: ['$usage.openCount', 0] } },
          opensLast30Days: { $sum: { $ifNull: ['$usage.recentCount', 0] } },
          neverOpened: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$usage.openCount', 0] }, 0] }, 0, 1] } },
          staleReviewWarnings: { $sum: { $cond: [{ $lt: ['$updatedAt', staleCutoff] }, 1, 0] } },
        } },
      ],
    }),
  ]);

  const docs = catalog.documents ?? [];
  const hasMore = docs.length > pageSize;
  const selected = hasMore ? docs.slice(0, pageSize) : docs;
  const versionIds = selected.map((entry) => entry.resourceVersionId);
  const usage: { results?: PageUsageAggregate[] } = versionIds.length === 0
    ? { results: [] }
    : await persistence<{ results?: PageUsageAggregate[] }>('mongodb', 'aggregate', {
        database: 'momentum',
        collection: RESOURCE_USAGE_MONGO_COLLECTION,
        pipeline: [
          { $match: { resourceVersionId: { $in: versionIds }, eventType: 'opened' } },
          { $group: {
            _id: '$resourceVersionId',
            openCount: { $sum: 1 },
            memberIds: { $addToSet: '$actorTmagId' },
            lastOpenedAt: { $max: '$occurredAt' },
            opensLast30Days: { $sum: { $cond: [{ $gte: ['$occurredAt', thirtyDaysAgo] }, 1, 0] } },
          } },
        ],
      });
  const usageByVersion = new Map((usage.results ?? []).map((row) => [row._id, row]));
  const resources: McsResourceUsageRow[] = selected.map((entry) => {
    const aggregate = usageByVersion.get(entry.resourceVersionId);
    const ageDays = staleAgeDays(entry.updatedAt, now);
    return {
      resourceId: entry.resourceId,
      resourceVersionId: entry.resourceVersionId,
      title: entry.title,
      kind: entry.kind,
      version: entry.version,
      updatedAt: entry.updatedAt,
      openCount: aggregate?.openCount ?? 0,
      uniqueMemberCount: aggregate?.memberIds?.length ?? 0,
      opensLast30Days: aggregate?.opensLast30Days ?? 0,
      lastOpenedAt: aggregate?.lastOpenedAt ?? null,
      staleReviewWarning: ageDays === null || ageDays >= MCS_RESOURCE_STALE_REVIEW_DAYS,
      staleReviewAgeDays: ageDays,
    };
  });
  const totals = totalsResult.results?.[0] ?? {
    activeResources: 0,
    totalOpens: 0,
    opensLast30Days: 0,
    neverOpened: 0,
    staleReviewWarnings: 0,
  };
  const last = selected[selected.length - 1];
  return {
    ok: true,
    schemaVersion: MCS_RESOURCE_USAGE_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    policy: {
      staleReviewDays: MCS_RESOURCE_STALE_REVIEW_DAYS,
      warningOnly: true,
      changesPublishingState: false,
    },
    totals,
    resources,
    pageInfo: {
      pageSize,
      hasMore,
      nextCursor: hasMore && last
        ? encodeAdminCursor({
            scope: RESOURCE_ANALYTICS_SCOPE,
            contract,
            keys: { updatedAt: last.updatedAt, resourceVersionId: last.resourceVersionId },
          })
        : null,
    },
  };
}
