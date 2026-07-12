import type { McsResourceLifecycleState } from './resource-lifecycle.js';

export const MCS_RESOURCE_CATALOG_SCHEMA_VERSION = 'resource_catalog.v1' as const;

export type McsResourceKind =
  | 'content_video'
  | 'master_template'
  | 'knowledge_source'
  | 'knowledge_chunk'
  | 'static_resource';

export type McsResourceReadinessCheck = 'pending' | 'passed' | 'failed' | 'not_applicable';

export interface McsResourceCatalogEntry {
  schemaVersion: typeof MCS_RESOURCE_CATALOG_SCHEMA_VERSION;
  resourceId: string;
  resourceVersionId: string;
  tenantId: string;
  teamId: string;
  kind: McsResourceKind;
  title: string;
  summary: string;
  version: number;
  lifecycle: McsResourceLifecycleState;
  audience: {
    surfaces: Array<'com' | 'team' | 'admin' | 'system'>;
    roles: Array<'prospect' | 'brand_ambassador' | 'leader' | 'founder_admin' | 'system'>;
    agentScopes: string[];
  };
  language: {
    mode: 'localized' | 'language_neutral';
    code: 'en' | 'es' | null;
    translationOfResourceVersionId: string | null;
    translationStatus: 'not_required' | 'pending' | 'review' | 'approved' | 'failed';
  };
  authority: {
    kind: 'kevin_authored' | 'kevin_approved' | 'agent_captured' | 'system_captured' | 'third_party_reference' | 'code_owned';
    status: 'active_authority' | 'candidate_only' | 'rejected' | 'superseded';
    decidedByTmagId: string | null;
    decidedAt: string | null;
    evidenceId: string | null;
  };
  readiness: {
    retrievalMode: 'required' | 'not_applicable';
    state: 'pending' | 'ready' | 'blocked' | 'failed' | 'not_applicable';
    checks: {
      content: McsResourceReadinessCheck;
      compliance: McsResourceReadinessCheck;
      authority: McsResourceReadinessCheck;
      translation: McsResourceReadinessCheck;
      mongo: McsResourceReadinessCheck;
      neo4j: McsResourceReadinessCheck;
      chroma: McsResourceReadinessCheck;
    };
    evidenceIds: string[];
    blockedReasons: string[];
    evaluatedAt: string | null;
    evaluatedByTmagId: string | null;
  };
  lineage: {
    originKind: 'code_default' | 'master_override' | 'admin_upload' | 'seed' | 'derived_chunk' | 'external_reference';
    sourceSystem: string;
    sourceCollection: string | null;
    sourceRecordId: string | null;
    parentResourceVersionId: string | null;
    supersedesResourceVersionId: string | null;
    replacementResourceVersionId: string | null;
  };
  contentLocator: {
    type: 'video' | 'inline_text' | 'code_symbol' | 'mongo_document' | 'external_ref' | 'repo_file' | 'route' | 'external_url';
    locator: string;
    field: string | null;
  };
  contentDigestSha256: string;
  tags: string[];
  categories: string[];
  migration: {
    source: 'native' | 'legacy_projection';
    ambiguities: string[];
  };
  authorTmagId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function resourceCatalogRetrievalEligible(entry: McsResourceCatalogEntry): boolean {
  if (entry.lifecycle !== 'active' || entry.readiness.retrievalMode !== 'required') return false;
  return entry.authority.status === 'active_authority' &&
    entry.readiness.state === 'ready' &&
    entry.readiness.checks.neo4j === 'passed' &&
    entry.readiness.checks.chroma === 'passed';
}

export function validateResourceCatalogEntry(entry: McsResourceCatalogEntry): string[] {
  const errors: string[] = [];
  for (const [field, value] of Object.entries({ resourceId: entry.resourceId, resourceVersionId: entry.resourceVersionId, tenantId: entry.tenantId, teamId: entry.teamId, title: entry.title, contentLocator: entry.contentLocator.locator })) {
    if (!value.trim()) errors.push(`${field}_required`);
  }
  if (!Number.isInteger(entry.version) || entry.version < 1) errors.push('positive_version_required');
  if (!/^[a-f0-9]{64}$/i.test(entry.contentDigestSha256)) errors.push('sha256_digest_required');
  if (entry.audience.surfaces.length === 0 || entry.audience.roles.length === 0) errors.push('explicit_audience_required');
  if (entry.language.mode === 'localized' && !entry.language.code) errors.push('localized_language_code_required');
  if (entry.language.mode === 'language_neutral' && entry.language.code !== null) errors.push('neutral_language_code_must_be_null');
  if (entry.kind === 'knowledge_chunk' && !entry.lineage.parentResourceVersionId) errors.push('knowledge_chunk_parent_required');
  if (entry.lifecycle === 'superseded' && !entry.lineage.replacementResourceVersionId) errors.push('superseded_replacement_required');
  if (entry.lifecycle === 'active' && entry.authority.status !== 'active_authority') errors.push('active_authority_required');
  if (entry.readiness.retrievalMode === 'required' && entry.lifecycle === 'active' && !resourceCatalogRetrievalEligible(entry)) errors.push('active_retrieval_readiness_required');
  if (entry.migration.source === 'legacy_projection' && entry.migration.ambiguities.length === 0) errors.push('legacy_ambiguity_or_native_source_required');
  return errors;
}
