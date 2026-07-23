import { describe, expect, it } from 'vitest';
import {
  chromaRowToChunkRecord,
  graphRagDomainFor,
  reconstructSourceRecord,
  splitList,
  DEFAULT_CREATED_BY,
  DEFAULT_DOMAIN,
  type ChromaKnowledgeRow,
  type ChunkEntry,
} from '../knowledge-graphrag-transform.js';
import { deriveKnowledgeId } from '../../../src/runtime/knowledge/intake/ids.js';

/**
 * Fixture mirrors the production `mcs_knowledge_chunks` metadata shape
 * (kb_taxonomy.v1) named in the LANE brief: pipe-delimited scope/agent fields,
 * `authority: kevin_approved`, `authorityStatus: active_authority`, taxonomy
 * fields, dotted `scope.*` keys, and the chunk text carried in the Chroma
 * `documents` field (here the row `document`).
 */
function fixtureRow(overrides: Partial<ChromaKnowledgeRow> = {}): ChromaKnowledgeRow {
  const baseMetadata: Record<string, unknown> = {
    chunkId: 'kchunk_abc12345',
    sourceId: 'knowledge_source_e0951cff-eeb0-45d2-b6c4-e491342c05ac',
    sourceTitle: 'Fast Start Playbook',
    sourceVersion: 2,
    chunkIndex: 0,
    startOffset: 0,
    endOffset: 65,
    heading: 'Daily Method of Operation',
    domain: 'training',
    language: 'en',
    authority: 'kevin_approved',
    authorityStatus: 'active_authority',
    retrievalEligible: true,
    status: 'active',
    documentId: 'kdoc_deadbeef',
    kind: 'knowledge_chunk',
    categoryTags: 'training|onboarding',
    topicTags: 'fast_start|dmo',
    taxonomyPrimaryCategory: 'training',
    taxonomyTopicTags: 'fast_start',
    taxonomyCategoryTags: 'training',
    taxonomyProductTags: '',
    taxonomyComplianceSensitivity: 'low',
    agentScopes: 'steve_success|michael_magnificent',
    surfaceScopes: 'team|admin',
    'scope.tenantId': 'tenant_team_magnificent',
    'scope.teamKey': 'team_magnificent',
    'scope.teamName': 'Team Magnificent',
  };
  return {
    id: overrides.id ?? 'kchunk_abc12345',
    document:
      overrides.document ??
      'The 90-day fast start is built on daily income-producing activity.',
    metadata: { ...baseMetadata, ...(overrides.metadata ?? {}) },
  };
}

describe('splitList', () => {
  it('splits pipe- and comma-delimited strings and trims', () => {
    expect(splitList('a|b , c')).toEqual(['a', 'b', 'c']);
    expect(splitList(['x', ' y '])).toEqual(['x', 'y']);
    expect(splitList(undefined)).toEqual([]);
    expect(splitList('')).toEqual([]);
  });
});

describe('chromaRowToChunkRecord', () => {
  it('reconstructs a canonical chunk record preserving original ids/offsets/tags', () => {
    const { record, domainDefaulted } = chromaRowToChunkRecord(fixtureRow());

    expect(domainDefaulted).toBe(false);
    // Original identifiers preserved verbatim.
    expect(record.chunkId).toBe('kchunk_abc12345');
    expect(record.sourceId).toBe('knowledge_source_e0951cff-eeb0-45d2-b6c4-e491342c05ac');
    expect(record.documentId).toBe('kdoc_deadbeef');
    expect(record.sourceVersion).toBe(2);
    expect(record.chunkIndex).toBe(0);
    expect(record.sourceOffsets).toEqual({ startOffset: 0, endOffset: 65 });

    // Text comes from the Chroma document; summary mirrors it.
    expect(record.text).toBe('The 90-day fast start is built on daily income-producing activity.');
    expect(record.summary).toBe(record.text);

    // Envelope + derived fields.
    expect(record.schemaVersion).toBe('knowledge_base.schema.v1');
    expect(record.domain).toBe('training');
    expect(record.language).toBe('en');
    expect(record.status).toBe('active');
    expect(record.retrievalEligible).toBe(true);
    expect(record.authorityKind).toBe('kevin_approved');
    expect(record.authorityStatus).toBe('active_authority');
    expect(record.title).toBe('Daily Method of Operation');
    expect(record.sourceTitle).toBe('Fast Start Playbook');
    expect(record.knowledgeId).toBe(deriveKnowledgeId('kchunk_abc12345'));

    // Pipe-delimited fields become arrays; scope reconstructed.
    expect(record.topicTags).toEqual(['fast_start', 'dmo']);
    expect(record.agentScopes).toEqual(['steve_success', 'michael_magnificent']);
    expect(record.surfaceScopes).toEqual(['team', 'admin']);
    expect(record.scope).toEqual({
      tenantId: 'tenant_team_magnificent',
      teamId: 'team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
    });

    // Citation carries the original coordinates.
    expect(record.citation).toEqual({
      label: 'Fast Start Playbook',
      sourceRef: null,
      documentId: 'kdoc_deadbeef',
      chunkId: 'kchunk_abc12345',
      sourceVersion: 2,
      chunkIndex: 0,
      startOffset: 0,
      endOffset: 65,
    });
  });

  it('defaults a missing/invalid domain to training and flags it', () => {
    const { record, domainDefaulted } = chromaRowToChunkRecord(
      fixtureRow({ metadata: { domain: undefined } }),
    );
    expect(domainDefaulted).toBe(true);
    expect(record.domain).toBe(DEFAULT_DOMAIN);
  });

  it('falls back to the row id when chunkId metadata is absent', () => {
    const { record } = chromaRowToChunkRecord(
      fixtureRow({ id: 'raw-id-42', metadata: { chunkId: undefined } }),
    );
    expect(record.chunkId).toBe('raw-id-42');
  });

  it('surfaceScopes defaults to [team] when none are valid', () => {
    const { record } = chromaRowToChunkRecord(fixtureRow({ metadata: { surfaceScopes: 'com' } }));
    expect(record.surfaceScopes).toEqual(['team']);
  });
});

describe('reconstructSourceRecord', () => {
  function entryFrom(row: ChromaKnowledgeRow): ChunkEntry {
    const { record } = chromaRowToChunkRecord(row);
    return { record, metadata: row.metadata };
  }

  it('reconstructs a canonical source record preserving id/version/scope', () => {
    const entries: ChunkEntry[] = [
      entryFrom(fixtureRow({ id: 'c1', document: 'Chunk one.', metadata: { chunkId: 'c1', chunkIndex: 1 } })),
      entryFrom(fixtureRow({ id: 'c0', document: 'Chunk zero.', metadata: { chunkId: 'c0', chunkIndex: 0 } })),
    ];
    const { record, unsetPrimaryCategory, createdByOrigin } = reconstructSourceRecord(
      'knowledge_source_e0951cff-eeb0-45d2-b6c4-e491342c05ac',
      entries,
      { createdAt: '2026-07-22T00:00:00.000Z' },
    );

    expect(record.sourceId).toBe('knowledge_source_e0951cff-eeb0-45d2-b6c4-e491342c05ac');
    expect(record.title).toBe('Fast Start Playbook');
    expect(record.version).toBe(2);
    expect(record.status).toBe('active');
    expect(record.authorityDecision).toBe('active_authority');
    expect(record.authority.authorityStatus).toBe('active_authority');
    expect(record.authority.authorityKind).toBe('kevin_approved');
    expect(record.chunkCount).toBe(2);
    expect(record.indexRecordCount).toBe(2);
    expect(record.schemaVersion).toBe('knowledge_base.schema.v1');
    expect(record.scope).toEqual({
      tenantId: 'tenant_team_magnificent',
      teamId: 'team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
    });

    // originalContent reconstructed in chunkIndex order.
    expect(record.originalContent).toBe('Chunk zero.\n\nChunk one.');

    // No author metadata ⇒ default createdBy.
    expect(createdByOrigin).toBe('default');
    expect(record.createdBy).toBe(DEFAULT_CREATED_BY);
    // taxonomyPrimaryCategory present ⇒ not flagged.
    expect(unsetPrimaryCategory).toBe(false);
  });

  it('flags unset primary category and honors author metadata', () => {
    const entries: ChunkEntry[] = [
      entryFrom(
        fixtureRow({
          metadata: { taxonomyPrimaryCategory: '', createdBy: 'TMAG-07' },
        }),
      ),
    ];
    const { record, unsetPrimaryCategory, createdByOrigin } = reconstructSourceRecord(
      'src-x',
      entries,
      { createdAt: '2026-07-22T00:00:00.000Z' },
    );
    expect(unsetPrimaryCategory).toBe(true);
    expect(createdByOrigin).toBe('metadata');
    expect(record.createdBy).toBe('TMAG-07');
  });

  it('throws when given no chunks', () => {
    expect(() => reconstructSourceRecord('src-empty', [], { createdAt: 'x' })).toThrow();
  });
});

describe('graphRagDomainFor', () => {
  it('maps governance/system to organizational, passes others through', () => {
    expect(graphRagDomainFor('governance')).toBe('organizational');
    expect(graphRagDomainFor('system')).toBe('organizational');
    expect(graphRagDomainFor('training')).toBe('training');
    expect(graphRagDomainFor('success')).toBe('success');
  });
});
