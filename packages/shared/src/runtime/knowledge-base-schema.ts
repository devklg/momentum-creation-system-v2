/**
 * Canonical Knowledge Base schema contract.
 *
 * This file names the app-level Knowledge Base shape Kevin owns: uploads become
 * source records, source records become chunks/index records, and only approved
 * chunks become context-manager references. The lower-level parser/chunker types
 * remain in `knowledge-intake.ts`; this contract is the stable boundary for UI,
 * API, persistence projection, and future docs.
 */

import type { McsAgentKey } from './agents.js';
import type { McsRuntimeRequestScope } from './identity.js';
import type { McsKnowledgeId } from './ids.js';
import type {
  McsKnowledgeAuthorityEnvelope,
  McsKnowledgeAuthorityKind,
  McsKnowledgeAuthorityStatus,
  McsKnowledgeChunk,
  McsKnowledgeIndexRecord,
  McsKnowledgeIntakeFormat,
  McsRawKnowledgeSource,
} from './knowledge-intake.js';
import type { McsKnowledgeDomain } from './knowledge.js';
import type { McsRuntimeLanguage } from './language.js';

export const MCS_KNOWLEDGE_BASE_SCHEMA_VERSION = 'knowledge_base.schema.v1' as const;
export type McsKnowledgeBaseSchemaVersion = typeof MCS_KNOWLEDGE_BASE_SCHEMA_VERSION;

export const MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION = 'mcs_knowledge_sources' as const;
export const MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION = 'mcs_knowledge_chunks' as const;
export const MCS_KNOWLEDGE_BASE_SOURCE_NODE_LABEL = 'KnowledgeSource' as const;
export const MCS_KNOWLEDGE_BASE_CHUNK_NODE_LABEL = 'KnowledgeChunk' as const;
export const MCS_KNOWLEDGE_BASE_SOURCE_CHUNK_RELATIONSHIP = 'HAS_CHUNK' as const;

export type McsKnowledgeBaseCollection =
  | typeof MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION
  | typeof MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION;

export type McsKnowledgeBaseNodeLabel =
  | typeof MCS_KNOWLEDGE_BASE_SOURCE_NODE_LABEL
  | typeof MCS_KNOWLEDGE_BASE_CHUNK_NODE_LABEL;

export type McsKnowledgeBaseRelationship =
  typeof MCS_KNOWLEDGE_BASE_SOURCE_CHUNK_RELATIONSHIP;

export type McsKnowledgeBaseAuthorityDecision =
  | 'active_authority'
  | 'candidate_only'
  | 'not_authorized';

export interface McsKnowledgeBaseAuthorityResolution {
  decision: McsKnowledgeBaseAuthorityDecision;
  authority: McsKnowledgeAuthorityEnvelope;
  canBecomeActiveGuidance: boolean;
  candidateOnly: boolean;
  reason:
    | 'kevin_authored'
    | 'kevin_approved'
    | 'legacy_kevin_created'
    | 'agent_or_system_capture_requires_kevin'
    | 'source_not_active'
    | 'authority_rejected_or_superseded'
    | 'missing_kevin_authority';
}

export type McsKnowledgeBaseUploadFormat = McsKnowledgeIntakeFormat;

export interface McsKnowledgeBaseUploadMetadata {
  filename?: string;
  mimeType?: string;
  originalBytes?: number;
  extractedCharacters?: number;
  sourceRef?: string;
}

export interface McsKnowledgeBaseTextUploadRequest {
  schemaVersion?: McsKnowledgeBaseSchemaVersion;
  title: string;
  content: string;
  domain: McsKnowledgeDomain;
  language: McsRuntimeLanguage;
  sourceRef?: string;
  topicTags?: readonly string[];
  agentScopes?: readonly McsAgentKey[];
}

export interface McsKnowledgeBaseFileUploadRequest {
  schemaVersion?: McsKnowledgeBaseSchemaVersion;
  title?: string;
  filename: string;
  mimeType?: string;
  base64: string;
  domain: McsKnowledgeDomain;
  language: McsRuntimeLanguage;
  topicTags?: readonly string[];
  agentScopes?: readonly McsAgentKey[];
}

export interface McsKnowledgeBaseSourceRecord extends McsRawKnowledgeSource {
  schemaVersion: McsKnowledgeBaseSchemaVersion;
  authority: McsKnowledgeAuthorityEnvelope;
  authorityDecision: McsKnowledgeBaseAuthorityDecision;
  upload?: McsKnowledgeBaseUploadMetadata;
  chunkCount: number;
  indexRecordCount: number;
}

export interface McsKnowledgeBaseChunkRecord extends McsKnowledgeChunk {
  schemaVersion: McsKnowledgeBaseSchemaVersion;
  title: string;
  summary: string;
  knowledgeId: McsKnowledgeId;
  authorityKind?: McsKnowledgeAuthorityKind;
  authorityStatus?: McsKnowledgeAuthorityStatus;
  sourceTitle: string;
}

export interface McsKnowledgeBaseIndexProjection extends McsKnowledgeIndexRecord {
  schemaVersion: McsKnowledgeBaseSchemaVersion;
  sourceTitle: string;
}

export interface McsKnowledgeBaseCreateResult {
  schemaVersion: McsKnowledgeBaseSchemaVersion;
  source: McsKnowledgeBaseSourceRecord;
  chunks: readonly McsKnowledgeBaseChunkRecord[];
  indexRecords: readonly McsKnowledgeBaseIndexProjection[];
}

export interface McsKnowledgeBaseQueryScope {
  scope: McsRuntimeRequestScope;
  domain?: McsKnowledgeDomain;
  language?: McsRuntimeLanguage;
  agentKey?: McsAgentKey;
}

export interface McsKnowledgeBasePersistenceProjection {
  mongo: {
    sourceCollection: typeof MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION;
    chunkCollection: typeof MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION;
  };
  neo4j: {
    sourceLabel: typeof MCS_KNOWLEDGE_BASE_SOURCE_NODE_LABEL;
    chunkLabel: typeof MCS_KNOWLEDGE_BASE_CHUNK_NODE_LABEL;
    sourceToChunkRelationship: typeof MCS_KNOWLEDGE_BASE_SOURCE_CHUNK_RELATIONSHIP;
  };
  chroma: {
    collectionPattern: 'mcs_{domain}_knowledge_{language}';
    domainAlias: {
      system: 'organizational';
      governance: 'organizational';
    };
  };
}

export const MCS_KNOWLEDGE_BASE_PERSISTENCE_PROJECTION: McsKnowledgeBasePersistenceProjection = {
  mongo: {
    sourceCollection: MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
    chunkCollection: MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
  },
  neo4j: {
    sourceLabel: MCS_KNOWLEDGE_BASE_SOURCE_NODE_LABEL,
    chunkLabel: MCS_KNOWLEDGE_BASE_CHUNK_NODE_LABEL,
    sourceToChunkRelationship: MCS_KNOWLEDGE_BASE_SOURCE_CHUNK_RELATIONSHIP,
  },
  chroma: {
    collectionPattern: 'mcs_{domain}_knowledge_{language}',
    domainAlias: {
      system: 'organizational',
      governance: 'organizational',
    },
  },
} as const;
