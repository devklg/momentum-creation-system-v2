import { createHash } from 'node:crypto';
import {
  MCS_CONTENT_VERSION_BINDING_SCHEMA_VERSION,
  MCS_ORIENTATION_CURRICULUM_RESOURCE_VERSION,
  validateContentVersionBinding,
  type McsContentVersionBinding,
  type McsResourceCatalogEntry,
} from '@momentum/shared';
import { verifyResourcePublishingGate } from '../domain/resourcePublishingGate.js';
import {
  RESOURCE_CATALOG_CHROMA_COLLECTION,
  RESOURCE_CATALOG_MONGO_COLLECTION,
} from '../domain/resourceCatalogSchema.js';
import { persistenceCall } from './persistence/dispatch.js';
import { tripleStackWrite } from './tripleStack.js';

const MONGO_DATABASE = 'momentum';
const TEAM_ID = 'team_magnificent';
const TENANT_ID = 'tenant_team_magnificent';
const KEVIN_TMAG_ID = 'TMAG-01';

type Persistence = typeof persistenceCall;
type TripleWriter = typeof tripleStackWrite;
type VerifyGate = typeof verifyResourcePublishingGate;

export class ContentVersioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentVersioningError';
  }
}

export function buildOrientationCurriculumCatalogEntry(now = new Date()): McsResourceCatalogEntry {
  const version = MCS_ORIENTATION_CURRICULUM_RESOURCE_VERSION;
  const timestamp = now.toISOString();
  return {
    schemaVersion: 'resource_catalog.v1',
    resourceId: version.resourceId,
    resourceVersionId: version.resourceVersionId,
    tenantId: TENANT_ID,
    teamId: TEAM_ID,
    kind: 'static_resource',
    title: version.title,
    summary: version.summary,
    version: version.version,
    lifecycle: 'active',
    audience: {
      surfaces: ['team', 'admin'],
      roles: ['brand_ambassador', 'leader', 'founder_admin'],
      agentScopes: [],
    },
    language: {
      mode: 'localized',
      code: 'en',
      translationOfResourceVersionId: null,
      translationStatus: 'approved',
    },
    authority: {
      kind: 'code_owned',
      status: 'active_authority',
      decidedByTmagId: KEVIN_TMAG_ID,
      decidedAt: '2026-07-16T00:00:00.000Z',
      evidenceId: version.authorityEvidenceId,
    },
    readiness: {
      retrievalMode: 'required',
      state: 'ready',
      checks: {
        content: 'passed',
        compliance: 'passed',
        authority: 'passed',
        translation: 'passed',
        mongo: 'passed',
        neo4j: 'passed',
        chroma: 'passed',
      },
      evidenceIds: [version.authorityEvidenceId],
      blockedReasons: [],
      evaluatedAt: timestamp,
      evaluatedByTmagId: KEVIN_TMAG_ID,
    },
    lineage: {
      originKind: 'code_default',
      sourceSystem: 'mcs_v2_repository',
      sourceCollection: null,
      sourceRecordId: version.sourcePath,
      parentResourceVersionId: null,
      supersedesResourceVersionId: null,
      replacementResourceVersionId: null,
    },
    contentLocator: {
      type: 'repo_file',
      locator: version.sourcePath,
      field: null,
    },
    contentDigestSha256: version.contentDigestSha256,
    tags: [...version.contextTags],
    categories: ['training', 'orientation', 'new_member'],
    migration: { source: 'native', ambiguities: [] },
    authorTmagId: KEVIN_TMAG_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Ensure the immutable code-owned orientation curriculum version is present
 * and retrievable in all three resource-catalog stores. Existing v1 content
 * with a different digest fails closed; it is never updated in place.
 */
export async function ensureOrientationCurriculumResourceVersion(
  persistence: Persistence = persistenceCall,
  writer: TripleWriter = tripleStackWrite,
  verifyGate: VerifyGate = verifyResourcePublishingGate,
  now: () => Date = () => new Date(),
): Promise<McsResourceCatalogEntry> {
  const version = MCS_ORIENTATION_CURRICULUM_RESOURCE_VERSION;
  const existing = await persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: RESOURCE_CATALOG_MONGO_COLLECTION,
    filter: { resourceVersionId: version.resourceVersionId },
    limit: 2,
  });
  const matches = existing.documents ?? [];
  if (matches.length > 1) throw new ContentVersioningError('orientation_curriculum_version_duplicate');

  let entry = matches[0];
  if (entry) {
    if (
      entry.resourceId !== version.resourceId ||
      entry.version !== version.version ||
      entry.contentDigestSha256 !== version.contentDigestSha256
    ) {
      throw new ContentVersioningError('orientation_curriculum_immutable_version_conflict');
    }
  } else {
    entry = buildOrientationCurriculumCatalogEntry(now());
    await writer({
      id: entry.resourceVersionId,
      mongoCollection: RESOURCE_CATALOG_MONGO_COLLECTION,
      mongoDoc: entry as unknown as Record<string, unknown>,
      neo4j: {
        cypher: [
          'MERGE (r:TmagResource {tenantId:$tenantId, teamId:$teamId, resourceId:$resourceId})',
          'SET r.kind=$kind, r.title=$title',
          'MERGE (v:TmagResourceVersion {resourceVersionId:$resourceVersionId})',
          'SET v.version=$version, v.contentDigestSha256=$digest, v.lifecycle=$lifecycle,',
          'v.authorityStatus=$authorityStatus, v.updatedAt=$updatedAt',
          'MERGE (r)-[:HAS_VERSION]->(v)',
          'MERGE (a:TeamMagnificentMember {tmagId:$approverTmagId})',
          'ON CREATE SET a.identityProjection="content_authority"',
          'MERGE (v)-[:APPROVED_BY]->(a)',
          'MERGE (m:TmagTrainingModule {moduleId:"10-steps"})',
          'SET m.label="10-Step Orientation", m.route="/training/10-steps"',
          'MERGE (v)-[:SUPPORTS_TRAINING_MODULE]->(m)',
          'MERGE (e:TmagEventMaterialContext {eventContextId:"orientation"})',
          'SET e.label="New-member orientation"',
          'MERGE (v)-[:SUPPORTS_EVENT_MATERIAL]->(e)',
        ].join(' '),
        params: {
          tenantId: entry.tenantId,
          teamId: entry.teamId,
          resourceId: entry.resourceId,
          resourceVersionId: entry.resourceVersionId,
          kind: entry.kind,
          title: entry.title,
          version: entry.version,
          digest: entry.contentDigestSha256,
          lifecycle: entry.lifecycle,
          authorityStatus: entry.authority.status,
          updatedAt: entry.updatedAt,
          approverTmagId: entry.authority.decidedByTmagId,
        },
      },
      chroma: {
        collection: RESOURCE_CATALOG_CHROMA_COLLECTION,
        document: `${entry.title}\n\n${entry.summary}\n\n${entry.tags.join(' ')}`,
        metadata: {
          resourceVersionId: entry.resourceVersionId,
          resourceId: entry.resourceId,
          tenantId: entry.tenantId,
          teamId: entry.teamId,
          kind: entry.kind,
          contentDigestSha256: entry.contentDigestSha256,
          lifecycle: entry.lifecycle,
          authorityStatus: entry.authority.status,
          language: entry.language.code ?? 'neutral',
          updatedAt: entry.updatedAt,
        },
      },
    });
  }

  const gate = await verifyGate(entry.resourceVersionId, 'retrieve', persistence);
  if (!gate.allowed) {
    throw new ContentVersioningError(`orientation_curriculum_not_ready:${gate.reasons.join(',')}`);
  }
  return entry;
}

/** Snapshot every active, verified catalog version explicitly linked to orientation. */
export async function resolveOrientationContentBinding(
  persistence: Persistence = persistenceCall,
  writer: TripleWriter = tripleStackWrite,
  verifyGate: VerifyGate = verifyResourcePublishingGate,
  now: () => Date = () => new Date(),
): Promise<McsContentVersionBinding> {
  const primary = await ensureOrientationCurriculumResourceVersion(persistence, writer, verifyGate, now);
  const result = await persistence<{ documents?: McsResourceCatalogEntry[] }>('mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: RESOURCE_CATALOG_MONGO_COLLECTION,
    filter: { lifecycle: 'active', tags: 'context:training:10-steps' },
    sort: { resourceVersionId: 1 },
    limit: 500,
  });
  const byId = new Map<string, McsResourceCatalogEntry>();
  byId.set(primary.resourceVersionId, primary);
  for (const entry of result.documents ?? []) byId.set(entry.resourceVersionId, entry);

  const entries = [...byId.values()].sort((a, b) => a.resourceVersionId.localeCompare(b.resourceVersionId));
  for (const entry of entries) {
    const gate = await verifyGate(entry.resourceVersionId, 'retrieve', persistence);
    if (!gate.allowed) {
      throw new ContentVersioningError(
        `orientation_supporting_resource_not_ready:${entry.resourceVersionId}:${gate.reasons.join(',')}`,
      );
    }
  }
  const resources = entries.map((entry) => ({
    resourceVersionId: entry.resourceVersionId,
    contentDigestSha256: entry.contentDigestSha256,
  }));
  const bindingDigestSha256 = createHash('sha256').update(JSON.stringify(resources), 'utf8').digest('hex');
  const binding: McsContentVersionBinding = {
    schemaVersion: MCS_CONTENT_VERSION_BINDING_SCHEMA_VERSION,
    catalogSchemaVersion: 'resource_catalog.v1',
    contextTag: 'context:training:10-steps',
    primaryResourceVersionId: primary.resourceVersionId,
    resources,
    bindingDigestSha256,
    boundAt: now().toISOString(),
  };
  const errors = validateContentVersionBinding(binding);
  if (errors.length > 0) throw new ContentVersioningError(`orientation_binding_invalid:${errors.join(',')}`);
  return binding;
}

/** Verify the just-created orientation session preserved its binding in all stores. */
export async function verifyOrientationSessionContentBinding(
  sessionId: string,
  binding: McsContentVersionBinding,
  persistence: Persistence = persistenceCall,
): Promise<void> {
  const expectedIds = binding.resources.map((resource) => resource.resourceVersionId);
  const expectedIdsJson = JSON.stringify(expectedIds);
  const mongo = await persistence<{ documents?: Array<{ contentBinding?: McsContentVersionBinding }> }>('mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: 'tmag_new_member_orientation_sessions',
    filter: { sessionId },
    limit: 1,
  });
  const stored = mongo.documents?.[0]?.contentBinding;
  if (
    !stored ||
    stored.primaryResourceVersionId !== binding.primaryResourceVersionId ||
    stored.bindingDigestSha256 !== binding.bindingDigestSha256 ||
    JSON.stringify(stored.resources.map((resource) => resource.resourceVersionId)) !== expectedIdsJson
  ) {
    throw new ContentVersioningError('orientation_session_mongo_binding_readback_failed');
  }

  const neo = await persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
    query: [
      'MATCH (s:TmagOrientationSession {sessionId:$sessionId})',
      'OPTIONAL MATCH (s)-[:DELIVERS_RESOURCE_VERSION]->(v:TmagResourceVersion)',
      'RETURN s.primaryResourceVersionId AS primaryResourceVersionId,',
      's.contentBindingDigestSha256 AS bindingDigestSha256,',
      's.resourceVersionIds AS resourceVersionIds,',
      'collect(v.resourceVersionId) AS deliveredResourceVersionIds',
    ].join(' '),
    params: { sessionId },
  });
  const graph = neo.records?.[0];
  if (
    !graph ||
    graph.primaryResourceVersionId !== binding.primaryResourceVersionId ||
    graph.bindingDigestSha256 !== binding.bindingDigestSha256 ||
    JSON.stringify(graph.resourceVersionIds) !== expectedIdsJson ||
    JSON.stringify([...(graph.deliveredResourceVersionIds as string[] ?? [])].sort()) !==
      JSON.stringify([...expectedIds].sort())
  ) {
    throw new ContentVersioningError('orientation_session_neo4j_binding_readback_failed');
  }

  const chroma = await persistence<{ ids?: string[]; metadatas?: Array<Record<string, unknown> | null> }>(
    'chromadb',
    'get',
    { collection: 'mcs_new_member_orientation_reservations', ids: [sessionId] },
  );
  const index = (chroma.ids ?? []).indexOf(sessionId);
  const metadata = index >= 0 ? chroma.metadatas?.[index] : null;
  if (
    !metadata ||
    metadata.primaryResourceVersionId !== binding.primaryResourceVersionId ||
    metadata.contentBindingDigestSha256 !== binding.bindingDigestSha256 ||
    metadata.resourceVersionIdsJson !== expectedIdsJson
  ) {
    throw new ContentVersioningError('orientation_session_chroma_binding_readback_failed');
  }
}
