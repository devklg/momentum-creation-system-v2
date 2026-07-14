import type {
  McsAdminKnowledgeCorrectionRecord,
  McsAdminKnowledgeCorrectionPreview,
  McsAdminKnowledgeSourceVersionDetail,
  McsAdminKnowledgeSourceVersionListResponse,
  McsAdminKnowledgeSourceVersionSummary,
  McsKnowledgeCorrectionStageEvidence,
  McsKnowledgeCorrectionDecisionBinding,
  McsResourceCatalogEntry,
} from '@momentum/shared';
import type {
  McsKnowledgeBaseChunkRecord,
  McsKnowledgeBaseSourceRecord,
  McsRawKnowledgeSource,
  McsKnowledgeId,
} from '@momentum/shared/runtime';
import { ingestRawKnowledgeSource, deriveKnowledgeId } from '../../runtime/knowledge/intake/index.js';
import { getKnowledgeEvolutionRuntime } from '../../runtime/knowledge-evolution/container.js';
import { verifyGraphRagRetrievalReadinessBatch } from '../../domain/graphragReadiness.js';
import { graphRagPersistenceEnabled } from '../../domain/graphrag.js';
import { canonicalApprovalAuthority } from '../../runtime/knowledge-evolution/persistence/canonicalApprovalAuthority.js';
import { persistenceCall } from '../persistence/dispatch.js';
import { tripleStackWrite } from '../tripleStack.js';
import { writeKnowledge } from '../tieredWrite.js';
import {
  KNOWLEDGE_CHUNK_COLLECTION,
  KNOWLEDGE_SOURCE_COLLECTION,
  invalidateApprovedKnowledgeRetrievalCache,
  knowledgeChromaCollection,
  projectApprovedChunkToGraphRag,
} from './approvedKnowledgeStore.js';
import {
  buildKnowledgeResourceCatalogEntry,
  knowledgeSourceContentDigest,
  writeKnowledgeResourceCatalogProjection,
} from './knowledgeResourceProjection.js';
import {
  RESOURCE_CATALOG_MONGO_COLLECTION,
} from '../../domain/resourceCatalogSchema.js';
import type {
  KnowledgeCorrectionExecutionContext,
  KnowledgeCorrectionListOptions,
  KnowledgeCorrectionStore,
} from './knowledgeCorrectionWorkflow.js';
import { sha256 } from './knowledgeCorrectionWorkflow.js';
import { KNOWLEDGE_CORRECTION_COLLECTION } from './knowledgeCorrectionSchema.js';

const MONGO_DATABASE = 'momentum';
const CORRECTION_COLLECTION = KNOWLEDGE_CORRECTION_COLLECTION;
const DECISION_COLLECTION = 'decisions';
const SYSTEM_EVENT_COLLECTION = 'mcs_agent_system_events';
const OUTBOX_COLLECTION = 'tmag_projection_outbox';
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 50;

type SourceDocument = McsKnowledgeBaseSourceRecord & { _id?: unknown };
type ChunkDocument = McsKnowledgeBaseChunkRecord & { _id?: unknown };

interface MongoDocuments<T> {
  documents?: T[];
  count?: number;
}

interface ChromaGetResult {
  ids?: string[];
  documents?: string[];
  metadatas?: Array<Record<string, unknown> | null>;
}

export class DirectKnowledgeCorrectionStore implements KnowledgeCorrectionStore {
  async listSourceVersions(options: KnowledgeCorrectionListOptions): Promise<McsAdminKnowledgeSourceVersionListResponse> {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, options.limit || DEFAULT_LIST_LIMIT));
    const cursor = decodeCursor(options.cursor);
    const clauses: Record<string, unknown>[] = [];
    if (options.status) clauses.push({ status: options.status });
    if (cursor) {
      clauses.push({
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
        ],
      });
    }
    const filter = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };
    const result = await persistenceCall<MongoDocuments<SourceDocument>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_SOURCE_COLLECTION,
      filter,
      sort: { createdAt: -1, _id: -1 },
      limit: limit + 1,
    });
    const rows = result.documents ?? [];
    const page = rows.slice(0, limit);
    const items = page.map(toSourceSummary);
    const last = page.at(-1);
    return {
      ok: true,
      items,
      nextCursor: rows.length > limit && last
        ? encodeCursor({ createdAt: last.createdAt, id: storageId(last) })
        : null,
    };
  }

  async getSourceVersion(sourceVersionId: string): Promise<McsAdminKnowledgeSourceVersionDetail | null> {
    const source = await this.readSource(sourceVersionId);
    return source ? toSourceDetail(source) : null;
  }

  async findCorrectionById(correctionId: string): Promise<McsAdminKnowledgeCorrectionRecord | null> {
    const result = await persistenceCall<MongoDocuments<McsAdminKnowledgeCorrectionRecord>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: CORRECTION_COLLECTION,
      filter: { _id: correctionId },
      limit: 1,
    });
    return result.documents?.[0] ?? null;
  }

  async findCorrectionByIdempotencyKey(idempotencyKey: string): Promise<McsAdminKnowledgeCorrectionRecord | null> {
    const result = await persistenceCall<MongoDocuments<McsAdminKnowledgeCorrectionRecord>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: CORRECTION_COLLECTION,
      filter: { idempotencyKey },
      limit: 1,
    });
    return result.documents?.[0] ?? null;
  }

  async insertCorrection(record: McsAdminKnowledgeCorrectionRecord): Promise<McsAdminKnowledgeCorrectionRecord> {
    await tripleStackWrite({
      id: record.correctionId,
      mongoCollection: CORRECTION_COLLECTION,
      mongoDoc: { ...record },
      neo4j: {
        cypher: [
          'MERGE (c:KnowledgeCorrection {id:$id})',
          'SET c.sourceId=$sourceId, c.currentSourceVersionId=$currentSourceVersionId,',
          'c.replacementSourceVersionId=$replacementSourceVersionId, c.state=$state,',
          'c.approvalDecisionId=$approvalDecisionId, c.idempotencyKey=$idempotencyKey,',
          'c.cutoverPhase=$cutoverPhase, c.recordRevision=$recordRevision,',
          'c.createdAt=$createdAt, c.updatedAt=$updatedAt',
        ].join(' '),
        params: correctionGraphParams(record),
      },
      chroma: correctionChroma(record),
    });
    const readback = await this.findCorrectionById(record.correctionId);
    if (!readback) throw new Error('correction_mongo_readback_failed');
    if (!(await verifyCorrectionProjection(readback))) throw new Error('correction_projection_readback_failed');
    return readback;
  }

  async patchCorrection(
    correctionId: string,
    expectedRecordRevision: number,
    patch: Partial<McsAdminKnowledgeCorrectionRecord>,
  ): Promise<McsAdminKnowledgeCorrectionRecord> {
    const current = await this.findCorrectionById(correctionId);
    if (!current || current.recordRevision !== expectedRecordRevision) {
      throw new Error('correction_optimistic_concurrency_conflict');
    }
    const record: McsAdminKnowledgeCorrectionRecord = { ...current, ...patch };
    await persistenceCall('neo4j', 'cypher', {
      query: [
        'MATCH (c:KnowledgeCorrection {id:$id})',
        'SET c.state=$state, c.failureStage=$failureStage, c.failureCode=$failureCode,',
        'c.cutoverPhase=$cutoverPhase, c.recordRevision=$recordRevision,',
        'c.updatedAt=$updatedAt, c.verifiedAt=$verifiedAt',
      ].join(' '),
      params: {
        id: correctionId,
        state: record.state,
        failureStage: record.failureStage,
        failureCode: record.failureCode,
        cutoverPhase: record.cutoverPhase,
        recordRevision: record.recordRevision,
        updatedAt: record.updatedAt,
        verifiedAt: record.verifiedAt,
      },
    });
    await upsertCorrectionChroma(record);
    if (!(await verifyCorrectionProjection(record))) throw new Error('correction_projection_readback_failed');
    const update = await persistenceCall<{ matchedCount?: number }>('mongodb', 'update', {
      database: MONGO_DATABASE,
      collection: CORRECTION_COLLECTION,
      filter: { _id: correctionId, recordRevision: expectedRecordRevision },
      update: { $set: patch },
    });
    if ((update.matchedCount ?? 0) !== 1) throw new Error('correction_optimistic_concurrency_conflict');
    const readback = await this.findCorrectionById(correctionId);
    if (!readback || readback.recordRevision !== record.recordRevision) throw new Error('correction_patch_readback_failed');
    return readback;
  }

  async createAndVerifyApprovalDecision(input: {
    correctionId: string;
    approvalDecisionId: string;
    preview: McsAdminKnowledgeCorrectionPreview;
    actorTmagId: string;
    idempotencyKey: string;
  }): Promise<McsKnowledgeCorrectionDecisionBinding | null> {
    const { preview } = input;
    const binding: McsKnowledgeCorrectionDecisionBinding = {
      decisionId: input.approvalDecisionId,
      status: 'active',
      decidedBy: 'kevin_gardner',
      decidedAt: preview.createdAt,
      sourceVersionId: preview.currentSourceVersionId,
      expectedVersion: preview.currentVersion,
      expectedLifecycle: preview.expectedCurrentLifecycle,
      expectedReplacementSourceVersionId: preview.expectedReplacementSourceVersionId,
      currentDigestSha256: preview.currentDigestSha256,
      replacementDigestSha256: preview.replacementDigestSha256,
      reason: preview.reason,
      previewDigestSha256: preview.previewDigestSha256,
      actorTmagId: input.actorTmagId,
      idempotencyKey: input.idempotencyKey,
    };
    const existing = await this.readDecision(input.approvalDecisionId);
    if (!existing.mongo) {
      const decision = {
        id: input.approvalDecisionId,
        type: 'knowledge_correction_decision',
        schema_version: '1.0',
        namespace: 'momentum',
        source: 'admin_knowledge_correction',
        created_at: preview.createdAt,
        title: `Approve governed correction for ${preview.currentSourceVersionId}`,
        origin_kind: 'admin_action',
        chat_number: null,
        registration_status: 'registered',
        decision_id: input.approvalDecisionId,
        topic: 'knowledge_source_correction',
        status: 'active',
        decided_by: 'kevin_gardner',
        decided_at: preview.createdAt,
        approval_type: 'admin_decision',
        source_id: preview.sourceId,
        current_source_version_id: preview.currentSourceVersionId,
        expected_version: preview.currentVersion,
        expected_lifecycle: preview.expectedCurrentLifecycle,
        expected_replacement_source_version_id: preview.expectedReplacementSourceVersionId,
        replacement_source_version_id: preview.replacementSourceVersionId,
        current_digest_sha256: preview.currentDigestSha256,
        replacement_digest_sha256: preview.replacementDigestSha256,
        preview_digest_sha256: preview.previewDigestSha256,
        actor_tmag_id: input.actorTmagId,
        idempotency_key: input.idempotencyKey,
        reason: preview.reason,
        reason_digest_sha256: sha256(preview.reason),
        correction_id: input.correctionId,
      };
      await tripleStackWrite({
        id: input.approvalDecisionId,
        mongoCollection: DECISION_COLLECTION,
        mongoDoc: decision,
        neo4j: {
          cypher: [
            'MERGE (d:Decision {id:$id})',
            'SET d.type=$type, d.status=$status, d.decidedBy=$decidedBy, d.decidedAt=$decidedAt,',
            'd.sourceId=$sourceId, d.currentSourceVersionId=$currentSourceVersionId,',
            'd.expectedVersion=$expectedVersion, d.expectedLifecycle=$expectedLifecycle,',
            'd.expectedReplacementSourceVersionId=$expectedReplacementSourceVersionId,',
            'd.replacementSourceVersionId=$replacementSourceVersionId, d.actorTmagId=$actorTmagId,',
            'd.currentDigestSha256=$currentDigestSha256,',
            'd.replacementDigestSha256=$replacementDigestSha256,',
            'd.previewDigestSha256=$previewDigestSha256, d.reasonDigestSha256=$reasonDigestSha256,',
            'd.idempotencyKey=$idempotencyKey,',
            'd.correctionId=$correctionId',
          ].join(' '),
          params: {
            type: decision.type,
            status: decision.status,
            decidedBy: decision.decided_by,
            decidedAt: decision.decided_at,
            sourceId: decision.source_id,
            currentSourceVersionId: decision.current_source_version_id,
            expectedVersion: decision.expected_version,
            expectedLifecycle: decision.expected_lifecycle,
            expectedReplacementSourceVersionId: decision.expected_replacement_source_version_id,
            replacementSourceVersionId: decision.replacement_source_version_id,
            actorTmagId: decision.actor_tmag_id,
            currentDigestSha256: decision.current_digest_sha256,
            replacementDigestSha256: decision.replacement_digest_sha256,
            previewDigestSha256: decision.preview_digest_sha256,
            reasonDigestSha256: sha256(decision.reason),
            idempotencyKey: decision.idempotency_key,
            correctionId: decision.correction_id,
          },
        },
        chroma: {
          collection: SYSTEM_EVENT_COLLECTION,
          document: `Governed knowledge correction decision ${decision.decision_id}. Content omitted.`,
          metadata: {
            type: decision.type,
            status: decision.status,
            decision_id: decision.decision_id,
            decided_by: decision.decided_by,
            source_id: decision.source_id,
            current_source_version_id: decision.current_source_version_id,
            expected_version: decision.expected_version,
            expected_lifecycle: decision.expected_lifecycle,
            expected_replacement_source_version_id: decision.expected_replacement_source_version_id ?? '',
            replacement_source_version_id: decision.replacement_source_version_id,
            actor_tmag_id: decision.actor_tmag_id,
            current_digest_sha256: decision.current_digest_sha256,
            replacement_digest_sha256: decision.replacement_digest_sha256,
            preview_digest_sha256: decision.preview_digest_sha256,
            reason_digest_sha256: sha256(decision.reason),
            idempotency_key: decision.idempotency_key,
            correction_id: decision.correction_id,
          },
        },
      });
    }
    const verified = await this.readDecision(input.approvalDecisionId, binding);
    return verified.mongo && verified.neo4j && verified.chroma ? binding : null;
  }

  async stageReplacement(context: KnowledgeCorrectionExecutionContext): Promise<McsKnowledgeCorrectionStageEvidence> {
    const { correction, replacementContent } = context;
    const existing = await this.readSource(correction.replacementSourceVersionId);
    if (existing) {
      if (knowledgeSourceContentDigest(existing) !== correction.replacementDigestSha256) {
        throw new Error('immutable_replacement_digest_conflict');
      }
      if (existing.status !== 'approved') throw new Error('immutable_replacement_lifecycle_conflict');
    }
    const current = await this.readSource(correction.currentSourceVersionId);
    if (!current) throw new Error('current_source_version_missing');
    const currentChunks = await this.readChunks(correction.sourceId, correction.currentVersion);
    const createdAt = existing?.createdAt ?? new Date().toISOString();
    const stagedRaw: McsRawKnowledgeSource = {
      sourceId: current.sourceId,
      title: current.title,
      sourceType: current.sourceType,
      format: current.format,
      originalContent: replacementContent,
      ...(current.sourceRef ? { sourceRef: current.sourceRef } : {}),
      createdBy: correction.actorTmagId,
      authority: {
        authorityKind: 'kevin_approved',
        authorityStatus: 'active_authority',
        authorityBy: correction.actorTmagId,
        authorityAt: createdAt,
        authorityRef: correction.approvalDecisionId,
      },
      createdAt,
      language: current.language,
      domain: current.domain,
      scope: current.scope,
      version: correction.replacementVersion,
      status: 'approved',
    };
    const intake = ingestRawKnowledgeSource(stagedRaw, {
      classification: {
        topicTags: [...new Set(currentChunks.flatMap((chunk) => chunk.topicTags))],
        agentScopes: [...new Set(currentChunks.flatMap((chunk) => chunk.agentScopes))],
        surfaceScopes: ['team', 'admin'],
      },
    });
    const sourceRecord: McsKnowledgeBaseSourceRecord = {
      ...stagedRaw,
      schemaVersion: current.schemaVersion,
      authority: stagedRaw.authority!,
      authorityDecision: 'active_authority',
      ...(current.upload ? { upload: current.upload } : {}),
      chunkCount: intake.chunks.length,
      indexRecordCount: intake.indexRecords.length,
      sourceVersionId: correction.replacementSourceVersionId,
      supersedesSourceVersionId: correction.currentSourceVersionId,
      replacementSourceVersionId: null,
      correctionDecisionId: correction.approvalDecisionId,
      contentDigestSha256: correction.replacementDigestSha256,
      supersededAt: null,
      supersededBy: null,
      supersessionReason: null,
    };
    const sourceWrite = existing
      ? await reprojectStagedSource(sourceRecord)
      : await writeKnowledge({
          id: correction.replacementSourceVersionId,
          mongoCollection: KNOWLEDGE_SOURCE_COLLECTION,
          mongoDoc: { ...sourceRecord },
          neo4j: stagedSourceNeo4j(sourceRecord),
          chroma: {
            collection: knowledgeChromaCollection(current.domain, current.language),
            document: `${current.title}\n\n${replacementContent}`,
            metadata: sourceChromaMetadata(sourceRecord, false),
          },
        });
    const chunkRecords = intake.chunks.map((chunk): McsKnowledgeBaseChunkRecord => ({
      ...chunk,
      status: 'approved',
      retrievalEligible: false,
      schemaVersion: current.schemaVersion,
      title: chunk.heading ?? current.title,
      summary: chunk.text,
      knowledgeId: deriveKnowledgeId(chunk.chunkId) as McsKnowledgeId,
      authorityKind: 'kevin_approved',
      authorityStatus: 'active_authority',
      sourceTitle: current.title,
      citation: {
        label: current.title,
        sourceRef: current.sourceRef ?? null,
        documentId: chunk.documentId,
        chunkId: chunk.chunkId,
        sourceVersion: chunk.sourceVersion,
        chunkIndex: chunk.chunkIndex,
        startOffset: chunk.sourceOffsets.startOffset,
        endOffset: chunk.sourceOffsets.endOffset,
      },
      sourceVersionId: correction.replacementSourceVersionId,
      correctionDecisionId: correction.approvalDecisionId,
      contentDigestSha256: sha256(chunk.text),
    }));
    const previouslyStoredChunks = existing
      ? new Map((await this.readChunks(correction.sourceId, correction.replacementVersion)).map((chunk) => [chunk.chunkId, chunk]))
      : new Map<string, ChunkDocument>();
    let queuedProjectionCount = sourceWrite.neo4j?.queued || sourceWrite.chroma?.queued ? 1 : 0;
    for (const chunk of chunkRecords) {
      const stored = previouslyStoredChunks.get(chunk.chunkId);
      if (stored && (stored.contentDigestSha256 ?? sha256(stored.text)) !== chunk.contentDigestSha256) {
        throw new Error('immutable_replacement_chunk_digest_conflict');
      }
      const result = stored
        ? await reprojectStagedChunk(chunk, correction.replacementSourceVersionId)
        : await writeKnowledge({
            id: chunk.chunkId,
            mongoCollection: KNOWLEDGE_CHUNK_COLLECTION,
            mongoDoc: { ...chunk },
            neo4j: stagedChunkNeo4j(chunk, correction.replacementSourceVersionId),
            chroma: {
              collection: KNOWLEDGE_CHUNK_COLLECTION,
              document: chunk.text || chunk.title,
              metadata: chunkChromaMetadata(chunk, false),
            },
          });
      if (result.neo4j?.queued || result.chroma?.queued) queuedProjectionCount += 1;
    }
    let graphRagProjectionCount = 0;
    if (graphRagPersistenceEnabled()) {
      const graphRagExisting = await verifyGraphRagBatches(chunkRecords.map(graphRagRecordId));
      const graphRagById = new Map(graphRagExisting.map((item) => [item.id, item]));
      for (const chunk of chunkRecords) {
        const prior = graphRagById.get(graphRagRecordId(chunk));
        if (prior?.record) {
          if (prior.record.retrievalReady) throw new Error('staged_graphrag_retrieval_ready_conflict');
          graphRagProjectionCount += 1;
        } else {
          const projected = await projectApprovedChunkToGraphRag(chunk, { allowStaged: true });
          if (projected) graphRagProjectionCount += 1;
        }
      }
    }
    const stagedResource = buildKnowledgeResourceCatalogEntry({
      source: sourceRecord,
      chunks: chunkRecords,
      lifecycle: 'approved',
      updatedAt: createdAt,
    });
    await writeKnowledgeResourceCatalogProjection(stagedResource);
    return evidence('requested', 'not_started', [
      { key: 'replacement_mongo_staged', passed: sourceWrite.mongo.verified, observedCount: 1 + chunkRecords.length },
      {
        key: 'replacement_graphrag_ready',
        passed: !graphRagPersistenceEnabled() || graphRagProjectionCount === chunkRecords.length,
        observedCount: graphRagProjectionCount,
      },
      { key: 'projection_outbox_clear', passed: queuedProjectionCount === 0, observedCount: queuedProjectionCount },
    ]);
  }

  async verifyStagedReplacement(context: KnowledgeCorrectionExecutionContext): Promise<McsKnowledgeCorrectionStageEvidence> {
    const { correction } = context;
    const source = await this.readSource(correction.replacementSourceVersionId);
    const chunks = await this.readChunks(correction.sourceId, correction.replacementVersion);
    const sourceChroma = source
      ? await chromaGet(knowledgeChromaCollection(source.domain, source.language), [correction.replacementSourceVersionId])
      : null;
    const chunkChroma = chunks.length > 0
      ? await chromaGet(KNOWLEDGE_CHUNK_COLLECTION, chunks.map((chunk) => chunk.chunkId))
      : null;
    const neo = await persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: [
        'OPTIONAL MATCH (v:KnowledgeSourceVersion {id:$sourceVersionId})',
        'OPTIONAL MATCH (v)-[:HAS_CHUNK]->(c:KnowledgeChunk)',
        'RETURN count(DISTINCT v) AS versions, count(DISTINCT c) AS chunks',
      ].join(' '),
      params: { sourceVersionId: correction.replacementSourceVersionId },
    });
    const neoRow = neo.records?.[0] ?? {};
    const resourceId = `knowledge:${correction.sourceId}:v${correction.replacementVersion}`;
    const resource = await persistenceCall<MongoDocuments<McsResourceCatalogEntry>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: RESOURCE_CATALOG_MONGO_COLLECTION,
      filter: { resourceVersionId: resourceId },
      limit: 1,
    });
    const outbox = await persistenceCall<MongoDocuments<Record<string, unknown>>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: OUTBOX_COLLECTION,
      filter: {
        entityId: { $in: [correction.replacementSourceVersionId, ...chunks.map((chunk) => chunk.chunkId)] },
        status: { $in: ['pending', 'failed'] },
      },
      limit: 1,
    });
    const stagedGraphRag = graphRagPersistenceEnabled()
      ? await verifyGraphRagBatches(chunks.map(graphRagRecordId))
      : [];
    return evidence('staged', 'replacement_projections_ready', [
      {
        key: 'replacement_mongo_staged',
        passed: source?.status === 'approved' && !!source && knowledgeSourceContentDigest(source) === correction.replacementDigestSha256 &&
          chunks.length > 0 && chunks.every((chunk) => chunk.status === 'approved' && !chunk.retrievalEligible),
        observedCount: chunks.length,
        fingerprintSha256: correction.replacementDigestSha256,
      },
      { key: 'replacement_neo4j_ready', passed: Number(neoRow.versions ?? 0) === 1 && Number(neoRow.chunks ?? 0) === chunks.length, observedCount: Number(neoRow.chunks ?? 0) },
      { key: 'replacement_chroma_ready', passed: sourceChroma?.ids?.includes(correction.replacementSourceVersionId) === true && sourceChroma.metadatas?.every((metadata) => metadata?.retrievalEligible === false) === true && chunkChroma?.ids?.length === chunks.length && chunkChroma.metadatas?.every((metadata) => metadata?.retrievalEligible === false) === true, observedCount: chunkChroma?.ids?.length ?? 0 },
      { key: 'replacement_resource_ready', passed: resource.documents?.[0]?.lifecycle === 'approved', observedCount: resource.documents?.length ?? 0 },
      {
        key: 'replacement_graphrag_ready',
        passed: !graphRagPersistenceEnabled() || (
          stagedGraphRag.length === chunks.length &&
          stagedGraphRag.every((item) => item.status === 'blocked' && item.record?.retrievalReady === false)
        ),
        observedCount: stagedGraphRag.length,
      },
      { key: 'projection_outbox_clear', passed: (outbox.documents?.length ?? 0) === 0, observedCount: outbox.documents?.length ?? 0 },
    ]);
  }

  async cutoverExclusive(context: KnowledgeCorrectionExecutionContext): Promise<McsKnowledgeCorrectionStageEvidence> {
    const { correction } = context;
    const canonicalApproval = await canonicalApprovalAuthority.verify({
      approvalId: correction.approvalDecisionId,
      approvedBy: 'kevin_gardner',
      approvalType: 'admin_decision',
      approvedAt: new Date(correction.decisionBinding.decidedAt),
    });
    if (!canonicalApproval) throw new Error('canonical_knowledge_evolution_approval_missing');
    const current = await this.readSource(correction.currentSourceVersionId);
    const replacement = await this.readSource(correction.replacementSourceVersionId);
    if (!current || !replacement) throw new Error('cutover_source_version_missing');
    const currentChunks = await this.readChunks(correction.sourceId, correction.currentVersion);
    const replacementChunks = await this.readChunks(correction.sourceId, correction.replacementVersion);
    const supersededAt = new Date().toISOString();

    await persistenceCall('mongodb', 'update', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_SOURCE_COLLECTION,
      filter: { _id: storageId(current), version: correction.currentVersion },
      update: { $set: {
        status: 'superseded',
        authorityDecision: 'superseded_authority',
        'authority.authorityStatus': 'superseded',
        sourceVersionId: correction.currentSourceVersionId,
        replacementSourceVersionId: correction.replacementSourceVersionId,
        correctionDecisionId: correction.approvalDecisionId,
        contentDigestSha256: correction.currentDigestSha256,
        supersededAt,
        supersededBy: correction.actorTmagId,
        supersessionReason: correction.reason,
      } },
    });
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_CHUNK_COLLECTION,
      filter: { sourceId: correction.sourceId, sourceVersion: correction.currentVersion },
      update: { $set: { status: 'superseded', retrievalEligible: false, sourceVersionId: correction.currentSourceVersionId } },
    });
    await persistenceCall('neo4j', 'cypher', {
      query: [
        'MERGE (source:KnowledgeSource {id:$sourceId})',
        'MERGE (old:KnowledgeSourceVersion {id:$oldId})',
        'SET old.status="superseded", old.retrievalEligible=false, old.supersededAt=$at',
        'MERGE (source)-[:HAS_VERSION]->(old)',
        'WITH old',
        'OPTIONAL MATCH (legacyChunk:KnowledgeChunk {sourceId:$sourceId, sourceVersion:$oldVersion})',
        'SET legacyChunk.status="superseded", legacyChunk.retrievalEligible=false',
        'FOREACH (_ IN CASE WHEN legacyChunk IS NULL THEN [] ELSE [1] END | MERGE (old)-[:HAS_CHUNK]->(legacyChunk))',
        'WITH old',
        'MATCH (new:KnowledgeSourceVersion {id:$newId})',
        'MERGE (new)-[:SUPERSEDES {decisionId:$decisionId, at:$at}]->(old)',
        'WITH old',
        'OPTIONAL MATCH (old)-[:HAS_CHUNK]->(c:KnowledgeChunk)',
        'SET c.status="superseded", c.retrievalEligible=false',
      ].join(' '),
      params: {
        oldId: correction.currentSourceVersionId,
        sourceId: correction.sourceId,
        oldVersion: correction.currentVersion,
        newId: correction.replacementSourceVersionId,
        decisionId: correction.approvalDecisionId,
        at: supersededAt,
      },
    });
    await upsertSourceChroma(current, false, 'superseded');
    for (const chunk of currentChunks) {
      await upsertChunkChroma({ ...chunk, status: 'superseded', retrievalEligible: false }, false);
    }
    const oldResourceId = `knowledge:${correction.sourceId}:v${correction.currentVersion}`;
    const oldResource = await readResource(oldResourceId);
    if (oldResource) {
      await writeKnowledgeResourceCatalogProjection({
        ...oldResource,
        lifecycle: 'superseded',
        authority: { ...oldResource.authority, status: 'superseded' },
        readiness: {
          ...oldResource.readiness,
          state: 'blocked',
          checks: { ...oldResource.readiness.checks, authority: 'failed' },
          blockedReasons: ['superseded_by_approved_replacement'],
          evaluatedAt: supersededAt,
          evaluatedByTmagId: correction.actorTmagId,
        },
        lineage: {
          ...oldResource.lineage,
          replacementResourceVersionId: `knowledge:${correction.sourceId}:v${correction.replacementVersion}`,
        },
        updatedAt: supersededAt,
      });
    }

    await persistenceCall('neo4j', 'cypher', {
      query: [
        'MATCH (v:KnowledgeSourceVersion {id:$id})',
        'SET v.status="active", v.retrievalEligible=true, v.activatedAt=$at',
        'WITH v OPTIONAL MATCH (v)-[:HAS_CHUNK]->(c:KnowledgeChunk)',
        'SET c.status="active", c.retrievalEligible=true',
      ].join(' '),
      params: { id: correction.replacementSourceVersionId, at: supersededAt },
    });
    await upsertSourceChroma({ ...replacement, status: 'active' }, true, 'active');
    for (const chunk of replacementChunks) {
      await upsertChunkChroma({ ...chunk, status: 'active', retrievalEligible: true }, true);
    }
    const activeSource: McsKnowledgeBaseSourceRecord = { ...replacement, status: 'active' };
    const activeChunks = replacementChunks.map((chunk) => ({ ...chunk, status: 'active' as const, retrievalEligible: true }));
    const activeResource = buildKnowledgeResourceCatalogEntry({
      source: activeSource,
      chunks: activeChunks,
      lifecycle: 'active',
      updatedAt: supersededAt,
      readinessEvidenceId: correction.correctionId,
    });
    await writeKnowledgeResourceCatalogProjection(activeResource);

    await persistenceCall('mongodb', 'update', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_SOURCE_COLLECTION,
      filter: { _id: correction.replacementSourceVersionId, status: 'approved' },
      update: { $set: { status: 'active', activatedAt: supersededAt } },
    });
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_CHUNK_COLLECTION,
      filter: { sourceId: correction.sourceId, sourceVersion: correction.replacementVersion, status: 'approved' },
      update: { $set: { status: 'active', retrievalEligible: true, activatedAt: supersededAt } },
    });

    const existingSupersession = await persistenceCall<MongoDocuments<Record<string, unknown>>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: 'knowledge_supersession_records',
      filter: {
        oldKnowledgeObjectId: correction.currentSourceVersionId,
        newKnowledgeObjectId: correction.replacementSourceVersionId,
        'approvalReference.approvalId': correction.approvalDecisionId,
      },
      limit: 1,
    });
    if ((existingSupersession.documents?.length ?? 0) === 0) {
      await getKnowledgeEvolutionRuntime().services.supersessionService.recordSupersession({
        tenantId: replacement.scope.tenantId,
        teamId: replacement.scope.teamId ?? 'team_magnificent',
        oldKnowledgeObjectId: correction.currentSourceVersionId,
        newKnowledgeObjectId: correction.replacementSourceVersionId,
        reason: correction.reason,
        approvalReference: {
          approvalId: correction.approvalDecisionId,
          approvedBy: 'kevin_gardner',
          approvalType: 'admin_decision',
          approvedAt: new Date(correction.createdAt),
        },
        supersededBy: correction.actorTmagId,
      });
    }
    invalidateApprovedKnowledgeRetrievalCache();
    return evidence('cutover_pending', 'replacement_canonical_activated', [
      { key: 'old_canonical_ineligible', passed: true },
      { key: 'old_neo4j_ineligible', passed: true },
      { key: 'old_chroma_ineligible', passed: true },
      { key: 'old_resource_ineligible', passed: true },
      { key: 'replacement_mongo_staged', passed: true },
      { key: 'cache_generation_invalidated', passed: true },
    ]);
  }

  async verifyExclusiveCutover(context: KnowledgeCorrectionExecutionContext): Promise<McsKnowledgeCorrectionStageEvidence> {
    const { correction } = context;
    const sources = await persistenceCall<MongoDocuments<SourceDocument>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_SOURCE_COLLECTION,
      filter: { sourceId: correction.sourceId },
      limit: 100,
    });
    const activeSources = (sources.documents ?? []).filter((source) => source.status === 'active');
    const oldSource = (sources.documents ?? []).find((source) => source.version === correction.currentVersion);
    const newSource = (sources.documents ?? []).find((source) => source.version === correction.replacementVersion);
    const chunks = await persistenceCall<MongoDocuments<ChunkDocument>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_CHUNK_COLLECTION,
      filter: { sourceId: correction.sourceId },
      limit: 2_000,
    });
    const oldChunks = (chunks.documents ?? []).filter((chunk) => chunk.sourceVersion === correction.currentVersion);
    const newChunks = (chunks.documents ?? []).filter((chunk) => chunk.sourceVersion === correction.replacementVersion);
    const graph = await persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: [
        'OPTIONAL MATCH (new:KnowledgeSourceVersion {id:$newId})-[r:SUPERSEDES]->(old:KnowledgeSourceVersion {id:$oldId})',
        'RETURN count(r) AS lineage, new.status AS newStatus, old.status AS oldStatus',
      ].join(' '),
      params: { oldId: correction.currentSourceVersionId, newId: correction.replacementSourceVersionId },
    });
    const graphRow = graph.records?.[0] ?? {};
    const newChroma = newSource
      ? await chromaGet(knowledgeChromaCollection(newSource.domain, newSource.language), [correction.replacementSourceVersionId])
      : null;
    const oldChroma = oldSource
      ? await chromaGet(knowledgeChromaCollection(oldSource.domain, oldSource.language), [storageId(oldSource)])
      : null;
    const newResource = await readResource(`knowledge:${correction.sourceId}:v${correction.replacementVersion}`);
    const oldResource = await readResource(`knowledge:${correction.sourceId}:v${correction.currentVersion}`);
    const outbox = await persistenceCall<MongoDocuments<Record<string, unknown>>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: OUTBOX_COLLECTION,
      filter: { status: { $in: ['pending', 'failed'] }, entityId: { $in: [
        correction.currentSourceVersionId,
        correction.replacementSourceVersionId,
        ...oldChunks.map((chunk) => chunk.chunkId),
        ...newChunks.map((chunk) => chunk.chunkId),
      ] } },
      limit: 1,
    });
    const [oldGraphRag, replacementGraphRag] = graphRagPersistenceEnabled()
      ? await Promise.all([
          verifyGraphRagBatches(oldChunks.map(graphRagRecordId)),
          verifyGraphRagBatches(newChunks.map(graphRagRecordId)),
        ])
      : [[], []];
    return evidence('cutover_pending', 'verified', [
      { key: 'exclusive_active_version', passed: activeSources.length === 1 && newSource?.status === 'active' && knowledgeSourceContentDigest(newSource) === correction.replacementDigestSha256, observedCount: activeSources.length },
      { key: 'old_canonical_ineligible', passed: oldSource?.status === 'superseded' && oldSource.authorityDecision === 'superseded_authority' },
      { key: 'old_mongo_chunks_ineligible', passed: oldChunks.length > 0 && oldChunks.every((chunk) => chunk.status === 'superseded' && !chunk.retrievalEligible), observedCount: oldChunks.length },
      { key: 'replacement_mongo_staged', passed: newChunks.length > 0 && newChunks.every((chunk) => chunk.status === 'active' && chunk.retrievalEligible), observedCount: newChunks.length },
      { key: 'old_neo4j_ineligible', passed: Number(graphRow.lineage ?? 0) === 1 && graphRow.newStatus === 'active' && graphRow.oldStatus === 'superseded' },
      { key: 'old_chroma_ineligible', passed: oldChroma?.metadatas?.every((metadata) => metadata?.retrievalEligible === false) === true },
      { key: 'replacement_chroma_ready', passed: newChroma?.metadatas?.every((metadata) => metadata?.retrievalEligible === true) === true },
      { key: 'old_resource_ineligible', passed: oldResource?.lifecycle === 'superseded' },
      { key: 'replacement_resource_ready', passed: newResource?.lifecycle === 'active' },
      { key: 'old_graphrag_ineligible', passed: !graphRagPersistenceEnabled() || (oldGraphRag.length === oldChunks.length && oldGraphRag.every((item) => item.status === 'blocked')), observedCount: oldGraphRag.length },
      { key: 'replacement_graphrag_ready', passed: !graphRagPersistenceEnabled() || (replacementGraphRag.length === newChunks.length && replacementGraphRag.every((item) => item.status === 'blocked' && item.record?.retrievalReady === false)), observedCount: replacementGraphRag.length },
      { key: 'projection_outbox_clear', passed: (outbox.documents?.length ?? 0) === 0, observedCount: outbox.documents?.length ?? 0 },
    ]);
  }

  private async readSource(sourceVersionId: string): Promise<SourceDocument | null> {
    const parsed = parseSourceVersionId(sourceVersionId);
    const filter = parsed
      ? { sourceId: parsed.sourceId, version: parsed.version }
      : { $or: [{ _id: sourceVersionId }, { sourceVersionId }] };
    const result = await persistenceCall<MongoDocuments<SourceDocument>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_SOURCE_COLLECTION,
      filter,
      limit: 2,
    });
    if ((result.documents?.length ?? 0) !== 1) return null;
    return result.documents![0]!;
  }

  private async readChunks(sourceId: string, version: number): Promise<ChunkDocument[]> {
    const result = await persistenceCall<MongoDocuments<ChunkDocument>>('mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: KNOWLEDGE_CHUNK_COLLECTION,
      filter: { sourceId, sourceVersion: version },
      sort: { chunkIndex: 1 },
      limit: 2_000,
    });
    return result.documents ?? [];
  }

  private async readDecision(
    decisionId: string,
    expected?: McsKnowledgeCorrectionDecisionBinding,
  ): Promise<{ mongo: boolean; neo4j: boolean; chroma: boolean }> {
    const [mongo, neo4j, chroma] = await Promise.all([
      persistenceCall<MongoDocuments<Record<string, unknown>>>('mongodb', 'query', {
        database: MONGO_DATABASE,
        collection: DECISION_COLLECTION,
        filter: { _id: decisionId, status: 'active' },
        limit: 1,
      }),
      persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
        query: [
          'MATCH (d:Decision {id:$id, status:"active"})',
          'RETURN d.id AS decision_id, d.status AS status, d.decidedBy AS decided_by,',
          'd.decidedAt AS decided_at, d.currentSourceVersionId AS current_source_version_id,',
          'd.expectedVersion AS expected_version, d.expectedLifecycle AS expected_lifecycle,',
          'd.expectedReplacementSourceVersionId AS expected_replacement_source_version_id,',
          'd.currentDigestSha256 AS current_digest_sha256, d.replacementDigestSha256 AS replacement_digest_sha256,',
          'd.previewDigestSha256 AS preview_digest_sha256, d.reasonDigestSha256 AS reason_digest_sha256,',
          'd.actorTmagId AS actor_tmag_id, d.idempotencyKey AS idempotency_key',
        ].join(' '),
        params: { id: decisionId },
      }),
      chromaGet(SYSTEM_EVENT_COLLECTION, [decisionId]),
    ]);
    const mongoRow = mongo.documents?.[0];
    const neoRow = neo4j.records?.[0];
    const chromaIndex = chroma.ids?.indexOf(decisionId) ?? -1;
    const chromaRow = chromaIndex >= 0 ? chroma.metadatas?.[chromaIndex] : undefined;
    return expected
      ? {
          mongo: decisionProjectionMatches(mongoRow, expected),
          neo4j: decisionProjectionMatches(neoRow, expected),
          chroma: decisionProjectionMatches(chromaRow ?? undefined, expected),
        }
      : {
          mongo: mongoRow?.decision_id === decisionId,
          neo4j: neoRow?.decision_id === decisionId,
          chroma: chromaIndex >= 0,
        };
  }
}

export const knowledgeCorrectionStore = new DirectKnowledgeCorrectionStore();

function toSourceSummary(source: SourceDocument): McsAdminKnowledgeSourceVersionSummary {
  const version = source.version;
  return {
    sourceId: String(source.sourceId),
    sourceVersionId: source.sourceVersionId ?? `${source.sourceId}:v${version}`,
    title: source.title,
    domain: source.domain,
    language: source.language,
    version,
    status: source.status,
    authorityStatus: source.authority.authorityStatus,
    contentDigestSha256: source.contentDigestSha256 ?? knowledgeSourceContentDigest(source),
    createdAt: source.createdAt,
    supersedesSourceVersionId: source.supersedesSourceVersionId ?? null,
    replacementSourceVersionId: source.replacementSourceVersionId ?? null,
  };
}

function toSourceDetail(source: SourceDocument): McsAdminKnowledgeSourceVersionDetail {
  return {
    ...toSourceSummary(source),
    originalContent: source.originalContent,
    sourceRef: source.sourceRef ?? null,
    createdBy: source.createdBy,
    chunkCount: source.chunkCount,
  };
}

function storageId(source: SourceDocument): string {
  return typeof source._id === 'string'
    ? source._id
    : source.sourceVersionId ?? (source.version === 1 ? String(source.sourceId) : `${source.sourceId}:v${source.version}`);
}

function parseSourceVersionId(value: string): { sourceId: string; version: number } | null {
  const match = /^(.*):v([1-9]\d*)$/.exec(value);
  if (!match?.[1] || !match[2]) return null;
  return { sourceId: match[1], version: Number(match[2]) };
}

function graphRagRecordId(chunk: ChunkDocument): string {
  return `mcsgraph_${String(chunk.knowledgeId)}_v${chunk.sourceVersion}_${chunk.language}`;
}

function stagedSourceNeo4j(source: SourceDocument) {
  return {
    cypher: [
      'MERGE (s:KnowledgeSource {id:$sourceId})',
      'MERGE (v:KnowledgeSourceVersion {id:$id})',
      'SET v.sourceId=$sourceId, v.version=$version, v.status="approved",',
      'v.retrievalEligible=false, v.contentDigestSha256=$digest,',
      'v.correctionDecisionId=$decisionId, v.createdAt=$createdAt',
      'MERGE (s)-[:HAS_VERSION]->(v)',
    ].join(' '),
    params: {
      sourceId: String(source.sourceId),
      version: source.version,
      digest: source.contentDigestSha256 ?? knowledgeSourceContentDigest(source),
      decisionId: source.correctionDecisionId ?? '',
      createdAt: source.createdAt,
    },
  };
}

function stagedChunkNeo4j(chunk: ChunkDocument, sourceVersionId: string) {
  return {
    cypher: [
      'MATCH (v:KnowledgeSourceVersion {id:$sourceVersionId})',
      'MERGE (c:KnowledgeChunk {id:$id})',
      'SET c.sourceId=$sourceId, c.sourceVersionId=$sourceVersionId,',
      'c.sourceVersion=$sourceVersion, c.status="approved", c.retrievalEligible=false,',
      'c.contentDigestSha256=$digest',
      'MERGE (v)-[:HAS_CHUNK]->(c)',
    ].join(' '),
    params: {
      sourceId: String(chunk.sourceId),
      sourceVersionId,
      sourceVersion: chunk.sourceVersion,
      digest: chunk.contentDigestSha256,
    },
  };
}

async function reprojectStagedSource(source: SourceDocument) {
  const graph = stagedSourceNeo4j(source);
  await persistenceCall('neo4j', 'cypher', { query: graph.cypher, params: { id: storageId(source), ...graph.params } });
  await upsertSourceChroma(source, false, 'approved');
  return { mongo: { ok: true, verified: true }, neo4j: { ok: true }, chroma: { ok: true } };
}

async function reprojectStagedChunk(chunk: ChunkDocument, sourceVersionId: string) {
  const graph = stagedChunkNeo4j(chunk, sourceVersionId);
  await persistenceCall('neo4j', 'cypher', { query: graph.cypher, params: { id: chunk.chunkId, ...graph.params } });
  await upsertChunkChroma(chunk, false);
  return { mongo: { ok: true, verified: true }, neo4j: { ok: true }, chroma: { ok: true } };
}

async function verifyGraphRagBatches(ids: readonly string[]) {
  const results = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    results.push(...await verifyGraphRagRetrievalReadinessBatch(ids.slice(offset, offset + 50)));
  }
  return results;
}

function evidence(
  stage: McsKnowledgeCorrectionStageEvidence['stage'],
  cutoverPhase: McsKnowledgeCorrectionStageEvidence['cutoverPhase'],
  checks: McsKnowledgeCorrectionStageEvidence['checks'],
): McsKnowledgeCorrectionStageEvidence {
  return { stage, cutoverPhase, recordedAt: new Date().toISOString(), checks };
}

function decisionProjectionMatches(
  row: Record<string, unknown> | null | undefined,
  expected: McsKnowledgeCorrectionDecisionBinding,
): boolean {
  if (!row) return false;
  return row.decision_id === expected.decisionId
    && row.status === expected.status
    && row.decided_by === expected.decidedBy
    && row.decided_at === expected.decidedAt
    && row.current_source_version_id === expected.sourceVersionId
    && Number(row.expected_version) === expected.expectedVersion
    && row.expected_lifecycle === expected.expectedLifecycle
    && String(row.expected_replacement_source_version_id ?? '') === String(expected.expectedReplacementSourceVersionId ?? '')
    && row.current_digest_sha256 === expected.currentDigestSha256
    && row.replacement_digest_sha256 === expected.replacementDigestSha256
    && row.preview_digest_sha256 === expected.previewDigestSha256
    && row.reason_digest_sha256 === sha256(expected.reason)
    && row.actor_tmag_id === expected.actorTmagId
    && row.idempotency_key === expected.idempotencyKey;
}

function correctionGraphParams(record: McsAdminKnowledgeCorrectionRecord): Record<string, unknown> {
  return {
    sourceId: record.sourceId,
    currentSourceVersionId: record.currentSourceVersionId,
    replacementSourceVersionId: record.replacementSourceVersionId,
    state: record.state,
    approvalDecisionId: record.approvalDecisionId,
    idempotencyKey: record.idempotencyKey,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    cutoverPhase: record.cutoverPhase,
    recordRevision: record.recordRevision,
  };
}

function correctionChroma(record: McsAdminKnowledgeCorrectionRecord) {
  return {
    collection: SYSTEM_EVENT_COLLECTION,
    document: `Knowledge correction ${record.correctionId} for ${record.sourceId}. State ${record.state}.`,
    metadata: correctionChromaMetadata(record),
  };
}

function correctionChromaMetadata(record: McsAdminKnowledgeCorrectionRecord): Record<string, unknown> {
  return {
    type: 'knowledge_correction',
    correction_id: record.correctionId,
    source_id: record.sourceId,
    current_source_version_id: record.currentSourceVersionId,
    replacement_source_version_id: record.replacementSourceVersionId,
    state: record.state,
    approval_decision_id: record.approvalDecisionId,
    failure_stage: record.failureStage ?? '',
    failure_code: record.failureCode ?? '',
    cutover_phase: record.cutoverPhase,
    record_revision: record.recordRevision,
    updated_at: record.updatedAt,
  };
}

async function upsertCorrectionChroma(record: McsAdminKnowledgeCorrectionRecord): Promise<void> {
  await persistenceCall('chromadb', 'add', {
    collection: SYSTEM_EVENT_COLLECTION,
    ids: [record.correctionId],
    documents: [`Knowledge correction ${record.correctionId} for ${record.sourceId}. State ${record.state}.`],
    metadatas: [correctionChromaMetadata(record)],
  });
}

async function verifyCorrectionProjection(record: McsAdminKnowledgeCorrectionRecord): Promise<boolean> {
  const [neo4j, chroma] = await Promise.all([
    persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: [
        'MATCH (c:KnowledgeCorrection {id:$id})',
        'RETURN c.state AS state, c.cutoverPhase AS cutoverPhase,',
        'c.recordRevision AS recordRevision, c.approvalDecisionId AS approvalDecisionId',
      ].join(' '),
      params: { id: record.correctionId },
    }),
    chromaGet(SYSTEM_EVENT_COLLECTION, [record.correctionId]),
  ]);
  const graph = neo4j.records?.[0];
  const index = chroma.ids?.indexOf(record.correctionId) ?? -1;
  const metadata = index >= 0 ? chroma.metadatas?.[index] : null;
  return graph?.state === record.state
    && graph.cutoverPhase === record.cutoverPhase
    && Number(graph.recordRevision) === record.recordRevision
    && graph.approvalDecisionId === record.approvalDecisionId
    && metadata?.state === record.state
    && metadata.cutover_phase === record.cutoverPhase
    && Number(metadata.record_revision) === record.recordRevision
    && metadata.approval_decision_id === record.approvalDecisionId;
}

function sourceChromaMetadata(source: SourceDocument, retrievalEligible: boolean): Record<string, unknown> {
  return {
    kind: 'knowledge_source',
    sourceId: String(source.sourceId),
    sourceVersionId: source.sourceVersionId ?? `${source.sourceId}:v${source.version}`,
    version: source.version,
    domain: source.domain,
    language: source.language,
    status: source.status,
    retrievalEligible,
    authority: source.authority.authorityKind,
    authorityStatus: source.authority.authorityStatus,
    contentDigestSha256: source.contentDigestSha256 ?? knowledgeSourceContentDigest(source),
    correctionDecisionId: source.correctionDecisionId ?? '',
  };
}

function chunkChromaMetadata(chunk: ChunkDocument, retrievalEligible: boolean): Record<string, unknown> {
  return {
    kind: 'knowledge_chunk',
    sourceId: String(chunk.sourceId),
    sourceVersionId: chunk.sourceVersionId ?? `${chunk.sourceId}:v${chunk.sourceVersion}`,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    sourceVersion: chunk.sourceVersion,
    chunkIndex: chunk.chunkIndex,
    title: chunk.title,
    heading: chunk.heading ?? '',
    domain: chunk.domain,
    language: chunk.language,
    status: chunk.status,
    retrievalEligible,
    authority: chunk.authorityKind ?? 'kevin_approved',
    authorityStatus: chunk.authorityStatus ?? 'active_authority',
    sourceTitle: chunk.sourceTitle,
    contentDigestSha256: chunk.contentDigestSha256 ?? sha256(chunk.text),
    correctionDecisionId: chunk.correctionDecisionId ?? '',
    'scope.tenantId': chunk.scope.tenantId,
    'scope.teamId': chunk.scope.teamId ?? '',
    'scope.teamKey': chunk.scope.teamKey ?? '',
    'scope.teamName': chunk.scope.teamName ?? '',
  };
}

async function upsertSourceChroma(source: SourceDocument, retrievalEligible: boolean, status: string): Promise<void> {
  await persistenceCall('chromadb', 'add', {
    collection: knowledgeChromaCollection(source.domain, source.language),
    ids: [storageId(source)],
    documents: [`${source.title}\n\n${source.originalContent}`],
    metadatas: [{ ...sourceChromaMetadata({ ...source, status: status as SourceDocument['status'] }, retrievalEligible), status }],
  });
}

async function upsertChunkChroma(chunk: ChunkDocument, retrievalEligible: boolean): Promise<void> {
  await persistenceCall('chromadb', 'add', {
    collection: KNOWLEDGE_CHUNK_COLLECTION,
    ids: [chunk.chunkId],
    documents: [chunk.text || chunk.title],
    metadatas: [chunkChromaMetadata(chunk, retrievalEligible)],
  });
}

async function chromaGet(collection: string, ids: string[]): Promise<ChromaGetResult> {
  return persistenceCall<ChromaGetResult>('chromadb', 'get', { collection, ids });
}

async function readResource(resourceVersionId: string): Promise<McsResourceCatalogEntry | null> {
  const result = await persistenceCall<MongoDocuments<McsResourceCatalogEntry>>('mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: RESOURCE_CATALOG_MONGO_COLLECTION,
    filter: { resourceVersionId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

function encodeCursor(value: { createdAt: string; id: string }): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursor(value: string | undefined): { createdAt: string; id: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.createdAt === 'string' && typeof parsed.id === 'string') {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}
