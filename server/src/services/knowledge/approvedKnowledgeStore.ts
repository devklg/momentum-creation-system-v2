/**
 * Store-backed approved knowledge foundation.
 *
 * Kevin/admin-authored knowledge enters through `createKevinApprovedKnowledgeSource`,
 * is parsed/chunked through the governed intake pipeline, and is triple-stacked.
 * `createStoredApprovedKnowledgeProvider` is the Knowledge Core boundary adapter
 * the Context Manager can use in real time.
 */

import { randomUUID } from 'node:crypto';
import {
  MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
  MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
  MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
} from '@momentum/shared/runtime';
import type {
  McsAgentKey,
  McsKnowledgeBaseChunkRecord,
  McsKnowledgeBaseSourceRecord,
  McsKnowledgeDomain,
  McsKnowledgeId,
  McsKnowledgeReference,
  McsRawKnowledgeSource,
  McsRuntimeLanguage,
  McsRuntimeRequestScope,
  McsSourceId,
} from '@momentum/shared/runtime';
import { persistenceCall } from '../persistence/dispatch.js';
import { tripleStackWrite } from '../tripleStack.js';
import type { KnowledgeCoreBoundaryPort } from '../../runtime/knowledge/knowledgeCore.js';
import {
  ingestRawKnowledgeSource,
  chunksToKnowledgeReferences,
  deriveKnowledgeId,
  type ChunkOptions,
} from '../../runtime/knowledge/intake/index.js';

export const KNOWLEDGE_SOURCE_COLLECTION = MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION;
export const KNOWLEDGE_CHUNK_COLLECTION = MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION;

export interface CreateKevinApprovedKnowledgeSourceInput {
  title: string;
  content: string;
  createdBy: string;
  domain: McsKnowledgeDomain;
  language: McsRuntimeLanguage;
  sourceType?: McsRawKnowledgeSource['sourceType'];
  format?: McsRawKnowledgeSource['format'];
  sourceRef?: string;
  upload?: McsKnowledgeBaseSourceRecord['upload'];
  topicTags?: readonly string[];
  agentScopes?: readonly McsAgentKey[];
  createdAt?: string;
}

export interface CreateKevinApprovedKnowledgeSourceResult {
  source: McsKnowledgeBaseSourceRecord;
  chunks: McsKnowledgeBaseChunkRecord[];
  references: McsKnowledgeReference[];
  chunkCount: number;
  indexRecordCount: number;
}

interface MongoQueryResult {
  documents?: Array<Record<string, unknown>>;
  count?: number;
}

export async function createKevinApprovedKnowledgeSource(
  input: CreateKevinApprovedKnowledgeSourceInput,
): Promise<CreateKevinApprovedKnowledgeSourceResult> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const sourceId = `knowledge_source_${randomUUID()}` as McsSourceId;
  const source: McsRawKnowledgeSource = {
    sourceId,
    title: input.title.trim(),
    sourceType: input.sourceType ?? 'owned_text',
    format: input.format ?? 'markdown',
    originalContent: input.content,
    ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    createdBy: input.createdBy,
    authority: {
      authorityKind: 'kevin_authored',
      authorityStatus: 'active_authority',
      authorityBy: input.createdBy,
      authorityAt: createdAt,
      ...(input.sourceRef ? { authorityRef: input.sourceRef } : {}),
    },
    createdAt,
    language: input.language,
    domain: input.domain,
    scope: teamMagnificentScope(),
    version: 1,
    status: 'active',
  };

  const chunkOptions: ChunkOptions = {
    classification: {
      topicTags: input.topicTags ?? [],
      ...(input.agentScopes ? { agentScopes: input.agentScopes } : {}),
      surfaceScopes: ['team', 'admin'],
    },
  };
  const intake = ingestRawKnowledgeSource(source, chunkOptions);
  const references = chunksToKnowledgeReferences(intake.chunks);
  const collection = knowledgeChromaCollection(input.domain, input.language);
  const sourceRecord: McsKnowledgeBaseSourceRecord = {
    ...source,
    schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
    authority: intake.authority.authority,
    authorityDecision: intake.authority.decision,
    ...(input.upload ? { upload: input.upload } : {}),
    chunkCount: intake.chunks.length,
    indexRecordCount: intake.indexRecords.length,
  };

  await tripleStackWrite({
    id: String(source.sourceId),
    mongoCollection: KNOWLEDGE_SOURCE_COLLECTION,
    mongoDoc: { ...sourceRecord },
    neo4j: {
      cypher: [
        'MERGE (s:KnowledgeSource {id:$id})',
        'SET s += $props',
      ].join(' '),
      params: {
        props: {
          title: source.title,
          domain: source.domain,
          language: source.language,
          status: source.status,
          authorityKind: source.authority?.authorityKind,
          authorityStatus: source.authority?.authorityStatus,
          createdBy: source.createdBy,
          createdAt: source.createdAt,
        },
      },
    },
    chroma: {
      collection,
      document: `${source.title}\n\n${source.originalContent}`,
      metadata: {
        kind: 'knowledge_source',
        sourceId: String(source.sourceId),
        domain: source.domain,
        language: source.language,
        authority: 'kevin',
      },
    },
  });

  const chunkRecords: McsKnowledgeBaseChunkRecord[] = intake.chunks.map((chunk) => ({
    ...chunk,
    schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
    title: chunk.heading ?? source.title,
    summary: chunk.text,
    knowledgeId: deriveKnowledgeId(chunk.chunkId) as McsKnowledgeId,
    authorityKind: source.authority?.authorityKind,
    authorityStatus: source.authority?.authorityStatus,
    sourceTitle: source.title,
  }));

  for (const chunkRecord of chunkRecords) {
    await tripleStackWrite({
      id: chunkRecord.chunkId,
      mongoCollection: KNOWLEDGE_CHUNK_COLLECTION,
      mongoDoc: { ...chunkRecord },
      neo4j: {
        cypher: [
          'MERGE (c:KnowledgeChunk {id:$id})',
          'SET c += $props',
          'WITH c',
          'MATCH (s:KnowledgeSource {id:$sourceId})',
          'MERGE (s)-[:HAS_CHUNK]->(c)',
        ].join(' '),
        params: {
          sourceId: String(source.sourceId),
          props: {
            sourceId: String(chunkRecord.sourceId),
            title: chunkRecord.title,
            domain: chunkRecord.domain,
            language: chunkRecord.language,
            status: chunkRecord.status,
            retrievalEligible: chunkRecord.retrievalEligible,
            sourceVersion: chunkRecord.sourceVersion,
          },
        },
      },
      chroma: {
        collection,
        document: chunkRecord.text || chunkRecord.heading || source.title,
        metadata: {
          kind: 'knowledge_chunk',
          sourceId: String(chunkRecord.sourceId),
          chunkId: chunkRecord.chunkId,
          domain: chunkRecord.domain,
          language: chunkRecord.language,
          status: chunkRecord.status,
          retrievalEligible: chunkRecord.retrievalEligible,
          authority: 'kevin',
        },
      },
    });
  }

  return {
    source: sourceRecord,
    chunks: chunkRecords,
    references,
    chunkCount: intake.chunks.length,
    indexRecordCount: intake.indexRecords.length,
  };
}

export function createStoredApprovedKnowledgeProvider(): Pick<KnowledgeCoreBoundaryPort, 'listApprovedKnowledge'> {
  return {
    async listApprovedKnowledge(scope) {
      const data = await persistenceCall<MongoQueryResult>('mongodb', 'query', {
        collection: KNOWLEDGE_CHUNK_COLLECTION,
        filter: {
          status: 'active',
          retrievalEligible: true,
          'scope.tenantId': scope.tenantId,
          'scope.teamId': scope.teamId,
          'scope.teamKey': scope.teamKey,
          'scope.teamName': scope.teamName,
        },
        limit: 200,
      });

      return (data.documents ?? []).flatMap(documentToKnowledgeReference);
    },
  };
}

export function knowledgeChromaCollection(
  domain: McsKnowledgeDomain,
  language: McsRuntimeLanguage,
): string {
  const collectionDomain =
    domain === 'governance' || domain === 'system' ? 'organizational' : domain;
  return `mcs_${collectionDomain}_knowledge_${language}`;
}

function documentToKnowledgeReference(doc: Record<string, unknown>): McsKnowledgeReference[] {
  const knowledgeId = typeof doc.knowledgeId === 'string' ? doc.knowledgeId : undefined;
  const sourceId = typeof doc.sourceId === 'string' ? doc.sourceId : undefined;
  const domain = doc.domain;
  const language = doc.language;
  const status = doc.status;
  if (
    !knowledgeId ||
    !sourceId ||
    !isDomain(domain) ||
    (language !== 'en' && language !== 'es') ||
    status !== 'active'
  ) {
    return [];
  }

  const title = typeof doc.title === 'string' ? doc.title : undefined;
  const summary = typeof doc.summary === 'string' ? doc.summary : undefined;

  return [{
    knowledgeId: knowledgeId as McsKnowledgeReference['knowledgeId'],
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    domain,
    status,
    language,
    translationStatus: 'same_language',
    sourceId: sourceId as McsKnowledgeReference['sourceId'],
  }];
}

function teamMagnificentScope(): McsRuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as McsRuntimeRequestScope['tenantId'],
    teamId: 'team_magnificent' as NonNullable<McsRuntimeRequestScope['teamId']>,
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
  };
}

function isDomain(value: unknown): value is McsKnowledgeDomain {
  return value === 'success' ||
    value === 'training' ||
    value === 'relationship' ||
    value === 'performance' ||
    value === 'organizational' ||
    value === 'system' ||
    value === 'governance';
}
