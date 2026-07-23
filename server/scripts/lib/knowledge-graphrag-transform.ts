/**
 * Pure Chroma-metadata → canonical-record transforms for the knowledge GraphRAG
 * backfill (LANE 0). NO persistence, NO env, NO clock beyond the caller-supplied
 * `createdAt` — safe to unit-test in isolation.
 *
 * The production `mcs_knowledge_chunks` Chroma collection is the ONLY surviving
 * copy of the 3,395-chunk / 209-source Kevin-approved knowledge base (the Mongo
 * source/chunk collections and Neo4j knowledge nodes are empty). Each chunk
 * carries the full ingestion metadata; these functions reconstruct the canonical
 * `McsKnowledgeBaseChunkRecord` / `McsKnowledgeBaseSourceRecord` shapes EXACTLY as
 * `createKevinApprovedKnowledgeSource` (services/knowledge/approvedKnowledgeStore.ts)
 * emits them, preserving the original `sourceId`, `chunkId`, `documentId`,
 * `sourceVersion`, offsets, tags, and scope. No field names are invented: the
 * richer `taxonomy*` metadata that lives on the Chroma chunks is intentionally
 * NOT lifted onto the canonical records (that would diverge from the intake
 * shape); it stays on the Chroma twin where the intake pipeline put it.
 */

import {
  MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
} from '@momentum/shared/runtime';
import type {
  McsAgentKey,
  McsKnowledgeAuthorityKind,
  McsKnowledgeAuthorityStatus,
  McsKnowledgeBaseChunkRecord,
  McsKnowledgeBaseSourceRecord,
  McsKnowledgeChunkStatus,
  McsKnowledgeDomain,
  McsKnowledgeId,
  McsKnowledgeSurfaceScope,
  McsRuntimeLanguage,
  McsRuntimeScope,
  McsSourceId,
} from '@momentum/shared/runtime';
import {
  deriveDocumentId,
  deriveKnowledgeId,
} from '../../src/runtime/knowledge/intake/ids.js';

/** One row read out of the Chroma `mcs_knowledge_chunks` collection. */
export interface ChromaKnowledgeRow {
  id: string;
  document: string;
  metadata: Record<string, unknown>;
}

export interface ChunkTransformResult {
  record: McsKnowledgeBaseChunkRecord;
  /** True when `domain` was absent/invalid and defaulted to `training`. */
  domainDefaulted: boolean;
}

export interface SourceTransformResult {
  record: McsKnowledgeBaseSourceRecord;
  /** True when no `taxonomyPrimaryCategory` was present on any chunk. */
  unsetPrimaryCategory: boolean;
  /** Whether `createdBy` came from chunk metadata or fell back to the default. */
  createdByOrigin: 'metadata' | 'default';
}

export const DEFAULT_DOMAIN: McsKnowledgeDomain = 'training';
export const DEFAULT_CREATED_BY = 'TMAG-01';

const KNOWLEDGE_DOMAINS: readonly McsKnowledgeDomain[] = [
  'success',
  'training',
  'relationship',
  'performance',
  'organizational',
  'system',
  'governance',
];
const AGENT_KEYS: readonly McsAgentKey[] = ['steve_success', 'michael_magnificent', 'ivory'];
const SURFACE_SCOPES: readonly McsKnowledgeSurfaceScope[] = ['team', 'admin'];
const CHUNK_STATUSES: readonly McsKnowledgeChunkStatus[] = [
  'approved',
  'active',
  'superseded',
  'deprecated',
  'archived',
  'rejected',
  'parse_failed',
];
const AUTHORITY_KINDS: readonly McsKnowledgeAuthorityKind[] = [
  'kevin_authored',
  'kevin_approved',
  'agent_captured',
  'system_captured',
  'third_party_reference',
];
const AUTHORITY_STATUSES: readonly McsKnowledgeAuthorityStatus[] = [
  'active_authority',
  'candidate_only',
  'rejected',
  'superseded',
];

// ── small pure coercers ─────────────────────────────────────────────────────

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function bool(value: unknown): boolean {
  return value === true || value === 'true';
}

/** Split a pipe/comma-delimited metadata string (or array) into trimmed tokens. */
export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[|,]/g).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function isDomain(value: string | undefined): value is McsKnowledgeDomain {
  return value !== undefined && (KNOWLEDGE_DOMAINS as readonly string[]).includes(value);
}

function language(value: unknown): McsRuntimeLanguage {
  return str(value) === 'es' ? 'es' : 'en';
}

function agentScopes(value: unknown): McsAgentKey[] {
  return splitList(value).filter((item): item is McsAgentKey =>
    (AGENT_KEYS as readonly string[]).includes(item),
  );
}

function surfaceScopes(value: unknown): McsKnowledgeSurfaceScope[] {
  const scopes = splitList(value).filter((item): item is McsKnowledgeSurfaceScope =>
    (SURFACE_SCOPES as readonly string[]).includes(item),
  );
  return scopes.length > 0 ? scopes : ['team'];
}

function chunkStatus(value: unknown): McsKnowledgeChunkStatus {
  const candidate = str(value);
  return candidate !== undefined && (CHUNK_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as McsKnowledgeChunkStatus)
    : 'active';
}

function authorityKind(value: unknown): McsKnowledgeAuthorityKind {
  const candidate = str(value);
  if (candidate !== undefined && (AUTHORITY_KINDS as readonly string[]).includes(candidate)) {
    return candidate as McsKnowledgeAuthorityKind;
  }
  // Production metadata uses `authority: kevin_approved`; a bare legacy `kevin`
  // marker maps to the approved-author lane.
  return 'kevin_approved';
}

function authorityStatus(value: unknown): McsKnowledgeAuthorityStatus {
  const candidate = str(value);
  return candidate !== undefined && (AUTHORITY_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as McsKnowledgeAuthorityStatus)
    : 'active_authority';
}

/** Team Magnificent scope, taking metadata `scope.*` when present. */
function scopeFromMetadata(m: Record<string, unknown>): McsRuntimeScope {
  const tenantId = str(m['scope.tenantId']) ?? 'tenant_team_magnificent';
  const teamId = str(m['scope.teamId']) ?? 'team_magnificent';
  const teamKey = str(m['scope.teamKey']) ?? 'team_magnificent';
  const teamName = str(m['scope.teamName']) ?? 'Team Magnificent';
  return { tenantId, teamId, teamKey, teamName } as unknown as McsRuntimeScope;
}

// ── chunk transform ─────────────────────────────────────────────────────────

/**
 * Reconstruct a canonical `McsKnowledgeBaseChunkRecord` from one Chroma row,
 * preserving every original identifier. Mirrors the chunk-record shape built in
 * `createKevinApprovedKnowledgeSource`.
 */
export function chromaRowToChunkRecord(row: ChromaKnowledgeRow): ChunkTransformResult {
  const m = row.metadata ?? {};
  const chunkId = str(m.chunkId) ?? row.id;
  const sourceId = (str(m.sourceId) ?? row.id) as McsSourceId;
  const sourceVersion = num(m.sourceVersion) ?? 1;
  const chunkIndex = num(m.chunkIndex) ?? 0;

  const rawDomain = str(m.domain);
  const domainDefaulted = !isDomain(rawDomain);
  const domain: McsKnowledgeDomain = domainDefaulted ? DEFAULT_DOMAIN : rawDomain;

  const lang = language(m.language);
  const heading = str(m.heading) ?? null;
  const text = typeof row.document === 'string' ? row.document : '';
  const documentId = str(m.documentId) ?? deriveDocumentId(sourceId, sourceVersion);
  const sourceTitle = str(m.sourceTitle) ?? str(m.title) ?? heading ?? String(sourceId);
  const startOffset = num(m.startOffset) ?? 0;
  const endOffset = num(m.endOffset) ?? text.length;
  const kind = authorityKind(m.authority);
  const status = authorityStatus(m.authorityStatus);

  const record: McsKnowledgeBaseChunkRecord = {
    // McsKnowledgeChunk base — original ids preserved.
    chunkId,
    sourceId,
    documentId,
    sourceVersion,
    heading,
    text,
    chunkIndex,
    language: lang,
    domain,
    scope: scopeFromMetadata(m),
    topicTags: splitList(m.topicTags),
    agentScopes: agentScopes(m.agentScopes),
    surfaceScopes: surfaceScopes(m.surfaceScopes),
    sourceOffsets: { startOffset, endOffset },
    status: chunkStatus(m.status),
    retrievalEligible: bool(m.retrievalEligible),
    // McsKnowledgeBaseChunkRecord envelope.
    schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
    title: heading ?? sourceTitle,
    summary: text,
    knowledgeId: deriveKnowledgeId(chunkId) as McsKnowledgeId,
    authorityKind: kind,
    authorityStatus: status,
    sourceTitle,
    citation: {
      label: sourceTitle,
      sourceRef: str(m.citationSourceRef) ?? str(m.sourceRef) ?? null,
      documentId,
      chunkId,
      sourceVersion,
      chunkIndex,
      startOffset,
      endOffset,
    },
  };

  return { record, domainDefaulted };
}

// ── source reconstruction ───────────────────────────────────────────────────

/** A transformed chunk paired with its originating Chroma metadata. */
export interface ChunkEntry {
  record: McsKnowledgeBaseChunkRecord;
  metadata: Record<string, unknown>;
}

/**
 * Reconstruct the canonical `McsKnowledgeBaseSourceRecord` for one source from
 * its chunk records + metadata. `originalContent` is reconstructed by joining
 * chunk text in `chunkIndex` order (the true verbatim upload is not recoverable
 * from chunks alone — see PR body); every id/version/scope is preserved.
 */
export function reconstructSourceRecord(
  sourceId: string,
  entries: readonly ChunkEntry[],
  opts: { createdAt: string },
): SourceTransformResult {
  if (entries.length === 0) {
    throw new Error(`reconstructSourceRecord: no chunks for source ${sourceId}`);
  }
  const ordered = [...entries].sort((a, b) => a.record.chunkIndex - b.record.chunkIndex);
  const first = ordered[0]!.record;
  const originalContent = ordered.map((entry) => entry.record.text).join('\n\n');

  const createdByMeta = ordered
    .map((entry) =>
      str(entry.metadata.createdBy) ??
      str(entry.metadata.author) ??
      str(entry.metadata.authorTmagId) ??
      str(entry.metadata.authorityBy),
    )
    .find((value): value is string => value !== undefined);
  const createdBy = createdByMeta ?? DEFAULT_CREATED_BY;

  const unsetPrimaryCategory = !ordered.some((entry) => str(entry.metadata.taxonomyPrimaryCategory));

  const record: McsKnowledgeBaseSourceRecord = {
    // McsRawKnowledgeSource — original identity preserved.
    sourceId: sourceId as McsSourceId,
    title: first.sourceTitle,
    sourceType: 'owned_text',
    format: 'markdown',
    originalContent,
    createdBy,
    authority: {
      authorityKind: first.authorityKind ?? 'kevin_approved',
      authorityStatus: 'active_authority',
      authorityBy: createdBy,
      authorityAt: opts.createdAt,
    },
    createdAt: opts.createdAt,
    language: first.language,
    domain: first.domain,
    scope: first.scope,
    version: first.sourceVersion,
    status: 'active',
    // McsKnowledgeBaseSourceRecord envelope — mirrors createKevinApprovedKnowledgeSource.
    schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
    authorityDecision: 'active_authority',
    chunkCount: ordered.length,
    indexRecordCount: ordered.length,
  };

  return {
    record,
    unsetPrimaryCategory,
    createdByOrigin: createdByMeta ? 'metadata' : 'default',
  };
}

/** Domain routing used by GraphRAG active-knowledge collections (mirror only). */
export function graphRagDomainFor(domain: McsKnowledgeDomain): McsKnowledgeDomain {
  return domain === 'governance' || domain === 'system' ? 'organizational' : domain;
}
