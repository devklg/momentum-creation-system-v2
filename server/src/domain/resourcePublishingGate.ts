import { createHash } from 'node:crypto';
import type { McsResourceCatalogEntry } from '@momentum/shared';
import { validateResourceCatalogEntry } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { RESOURCE_CATALOG_CHROMA_COLLECTION, RESOURCE_CATALOG_MONGO_COLLECTION } from './resourceCatalogSchema.js';

export type ResourcePublishingGateMode = 'publish' | 'retrieve';

export interface ResourcePublishingGateEvidence {
  evidenceId: string;
  resourceVersionId: string;
  contentDigestSha256: string;
  catalogUpdatedAt: string;
  neo4jProjectedAt: string;
  chromaProjectedAt: string;
  verifiedAt: string;
}

export interface ResourcePublishingGateDecision {
  allowed: boolean;
  mode: ResourcePublishingGateMode;
  resourceVersionId: string;
  reasons: string[];
  evidence: ResourcePublishingGateEvidence | null;
}

type Persistence = typeof persistenceCall;

function neoRecord(result: unknown): Record<string, unknown> | null {
  const records = (result as { records?: Array<Record<string, unknown>> })?.records ?? [];
  return records.length === 1 ? records[0] ?? null : null;
}

function chromaRecord(result: unknown, id: string): { metadata: Record<string, unknown>; id: string } | null {
  const data = result as { ids?: string[]; metadatas?: Array<Record<string, unknown> | null> };
  const index = (data.ids ?? []).indexOf(id);
  const metadata = index >= 0 ? data.metadatas?.[index] : null;
  return index >= 0 && metadata ? { id, metadata } : null;
}

function exact(value: unknown, expected: string | number): boolean {
  return value === expected;
}

export async function verifyResourcePublishingGate(
  resourceVersionId: string,
  mode: ResourcePublishingGateMode,
  persistence: Persistence = persistenceCall,
  now = new Date(),
): Promise<ResourcePublishingGateDecision> {
  const reasons: string[] = [];
  const blocked = (): ResourcePublishingGateDecision => ({ allowed: false, mode, resourceVersionId, reasons, evidence: null });
  let entry: McsResourceCatalogEntry | null = null;
  try {
    const mongo = await persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
      database: 'momentum', collection: RESOURCE_CATALOG_MONGO_COLLECTION, filter: { resourceVersionId }, limit: 1,
    });
    entry = mongo.documents?.[0] ?? null;
  } catch { reasons.push('catalog_unavailable'); return blocked(); }
  if (!entry) { reasons.push('catalog_missing'); return blocked(); }
  const validation = validateResourceCatalogEntry(entry);
  if (validation.length) { reasons.push(...validation.map((error) => `catalog_${error}`)); return blocked(); }
  const requiredLifecycle = mode === 'publish' ? 'approved' : 'active';
  if (entry.lifecycle !== requiredLifecycle) reasons.push(`lifecycle_${requiredLifecycle}_required`);
  if (entry.authority.status !== 'active_authority' || !entry.authority.decidedByTmagId) reasons.push('active_human_authority_required');
  if (entry.readiness.retrievalMode !== 'required') reasons.push('retrieval_mode_required');
  if (reasons.length) return blocked();

  let neo: Record<string, unknown> | null = null;
  try {
    const result = await persistence('neo4j', 'cypher', {
      query: 'MATCH (r:TmagResource {tenantId:$tenantId, teamId:$teamId, resourceId:$resourceId})-[:HAS_VERSION]->(v:TmagResourceVersion {resourceVersionId:$resourceVersionId}) MATCH (v)-[:APPROVED_BY]->(a:TeamMagnificentMember {tmagId:$approverTmagId}) WHERE v.version=$version AND v.contentDigestSha256=$digest AND v.lifecycle=$lifecycle AND v.authorityStatus="active_authority" RETURN r.resourceId AS resourceId, v.resourceVersionId AS resourceVersionId, v.version AS version, v.contentDigestSha256 AS contentDigestSha256, v.lifecycle AS lifecycle, v.updatedAt AS projectedAt, a.tmagId AS approvedByTmagId',
      params: { tenantId: entry.tenantId, teamId: entry.teamId, resourceId: entry.resourceId, resourceVersionId, version: entry.version, digest: entry.contentDigestSha256, lifecycle: entry.lifecycle, approverTmagId: entry.authority.decidedByTmagId },
    });
    neo = neoRecord(result);
  } catch { reasons.push('neo4j_unavailable'); return blocked(); }
  if (!neo) reasons.push('neo4j_exact_version_missing_or_duplicate');
  else {
    if (!exact(neo.resourceId, entry.resourceId) || !exact(neo.resourceVersionId, resourceVersionId) || !exact(neo.version, entry.version) || !exact(neo.contentDigestSha256, entry.contentDigestSha256) || !exact(neo.lifecycle, entry.lifecycle) || !exact(neo.approvedByTmagId, entry.authority.decidedByTmagId ?? '')) reasons.push('neo4j_identity_or_digest_mismatch');
    if (typeof neo.projectedAt !== 'string' || neo.projectedAt < entry.updatedAt) reasons.push('neo4j_projection_stale');
  }

  let chroma: { metadata: Record<string, unknown>; id: string } | null = null;
  try {
    const result = await persistence('chromadb', 'get', { collection: RESOURCE_CATALOG_CHROMA_COLLECTION, ids: [resourceVersionId] });
    chroma = chromaRecord(result, resourceVersionId);
  } catch { reasons.push('chroma_unavailable'); return blocked(); }
  if (!chroma) reasons.push('chroma_exact_version_missing');
  else {
    const meta = chroma.metadata;
    if (!exact(meta.resourceVersionId, resourceVersionId) || !exact(meta.resourceId, entry.resourceId) || !exact(meta.tenantId, entry.tenantId) || !exact(meta.teamId, entry.teamId) || !exact(meta.contentDigestSha256, entry.contentDigestSha256) || !exact(meta.lifecycle, entry.lifecycle)) reasons.push('chroma_identity_or_digest_mismatch');
    if (typeof meta.updatedAt !== 'string' || meta.updatedAt < entry.updatedAt) reasons.push('chroma_projection_stale');
  }
  if (reasons.length || !neo || !chroma) return blocked();

  const verifiedAt = now.toISOString();
  const evidenceId = `resource_ready_${createHash('sha256').update([resourceVersionId, entry.contentDigestSha256, entry.updatedAt, neo.projectedAt, chroma.metadata.updatedAt].join('|')).digest('hex')}`;
  return { allowed: true, mode, resourceVersionId, reasons: [], evidence: { evidenceId, resourceVersionId, contentDigestSha256: entry.contentDigestSha256, catalogUpdatedAt: entry.updatedAt, neo4jProjectedAt: String(neo.projectedAt), chromaProjectedAt: String(chroma.metadata.updatedAt), verifiedAt } };
}
