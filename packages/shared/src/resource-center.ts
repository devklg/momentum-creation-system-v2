import type { McsResourceKind } from './resource-catalog.js';
import type { McsAdminPageInfo, McsAdminStableSort } from './admin-pagination.js';

export const MCS_RESOURCE_CENTER_RESPONSE_SCHEMA_VERSION = 'resource_center.v1' as const;

export interface McsResourceCenterItem {
  resourceId: string;
  resourceVersionId: string;
  title: string;
  summary: string;
  kind: McsResourceKind;
  categories: string[];
  tags: string[];
  languageCode: 'en' | 'es' | null;
  version: number;
  sourceSystem: string;
  openTarget: string | null;
  updatedAt: string;
}

export interface McsResourceCenterResponse {
  ok: true;
  schemaVersion: typeof MCS_RESOURCE_CENTER_RESPONSE_SCHEMA_VERSION;
  items: McsResourceCenterItem[];
  categories: string[];
  kinds: McsResourceKind[];
}

export interface McsResourceCenterDetailResponse {
  ok: true;
  schemaVersion: typeof MCS_RESOURCE_CENTER_RESPONSE_SCHEMA_VERSION;
  item: McsResourceCenterItem;
  content: string;
}

export const MCS_RESOURCE_USAGE_SCHEMA_VERSION = 'resource_usage.v1' as const;
export const MCS_RESOURCE_STALE_REVIEW_DAYS = 90 as const;

export interface McsResourceUsageEvent {
  schemaVersion: typeof MCS_RESOURCE_USAGE_SCHEMA_VERSION;
  usageEventId: string;
  resourceId: string;
  resourceVersionId: string;
  actorTmagId: string;
  eventType: 'opened';
  occurredAt: string;
}

export interface McsResourceUsageRow {
  resourceId: string;
  resourceVersionId: string;
  title: string;
  kind: McsResourceKind;
  version: number;
  updatedAt: string;
  openCount: number;
  uniqueMemberCount: number;
  opensLast30Days: number;
  lastOpenedAt: string | null;
  staleReviewWarning: boolean;
  staleReviewAgeDays: number | null;
}

export interface McsResourceUsageSummaryResponse {
  ok: true;
  schemaVersion: typeof MCS_RESOURCE_USAGE_SCHEMA_VERSION;
  generatedAt: string;
  policy: {
    staleReviewDays: typeof MCS_RESOURCE_STALE_REVIEW_DAYS;
    warningOnly: true;
    changesPublishingState: false;
  };
  totals: {
    activeResources: number;
    totalOpens: number;
    opensLast30Days: number;
    neverOpened: number;
    staleReviewWarnings: number;
  };
  resources: McsResourceUsageRow[];
  pageInfo: McsAdminPageInfo;
  appliedFilters: {
    lifecycle: 'active';
    surface: 'team';
    roles: Array<'brand_ambassador' | 'leader'>;
  };
  appliedSort: Extract<McsAdminStableSort, 'updatedAt_desc_resourceVersionId_desc'>;
  computedAt: string;
}
