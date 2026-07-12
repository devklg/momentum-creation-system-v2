import type { McsResourceCatalogEntry } from '@momentum/shared';

export const RESOURCE_CATALOG_MONGO_COLLECTION = 'tmag_resource_catalog';
export const RESOURCE_CATALOG_CHROMA_COLLECTION = 'mcs_resource_catalog';
export const RESOURCE_CATALOG_GRAPH_LABELS = ['TmagResource', 'TmagResourceVersion'] as const;

export interface ResourceCatalogIndexDefinition {
  name: string;
  keys: Record<string, 1 | -1>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

export const RESOURCE_CATALOG_INDEXES: readonly ResourceCatalogIndexDefinition[] = [
  { name: 'unique_resourceVersionId', keys: { resourceVersionId: 1 }, unique: true },
  { name: 'unique_resource_version', keys: { tenantId: 1, teamId: 1, resourceId: 1, version: 1 }, unique: true },
  { name: 'unique_active_resource_language', keys: { tenantId: 1, teamId: 1, resourceId: 1, 'language.code': 1, lifecycle: 1 }, unique: true, partialFilterExpression: { lifecycle: 'active' } },
  { name: 'catalog_browse', keys: { tenantId: 1, teamId: 1, lifecycle: 1, kind: 1, 'language.code': 1, updatedAt: -1 } },
  { name: 'readiness_queue', keys: { lifecycle: 1, 'readiness.state': 1, 'readiness.checks.neo4j': 1, 'readiness.checks.chroma': 1, updatedAt: 1 } },
  { name: 'source_record', keys: { 'lineage.sourceCollection': 1, 'lineage.sourceRecordId': 1 } },
  { name: 'parent_version', keys: { 'lineage.parentResourceVersionId': 1 } },
] as const;

export const RESOURCE_CATALOG_GRAPH_RELATIONSHIPS = [
  'HAS_VERSION', 'SUPERSEDES', 'DERIVED_FROM', 'AUTHORED_BY', 'APPROVED_BY',
] as const;

export const RESOURCE_CATALOG_REQUIRED_FIELDS: readonly (keyof McsResourceCatalogEntry)[] = [
  'schemaVersion', 'resourceId', 'resourceVersionId', 'tenantId', 'teamId', 'kind', 'title', 'summary',
  'version', 'lifecycle', 'audience', 'language', 'authority', 'readiness', 'lineage', 'contentLocator',
  'contentDigestSha256', 'tags', 'categories', 'migration', 'authorTmagId', 'createdAt', 'updatedAt',
] as const;
