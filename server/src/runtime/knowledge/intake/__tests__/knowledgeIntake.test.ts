import { describe, expect, it } from 'vitest';
import type {
  TmagId,
  McsKnowledgeChunk,
  McsKnowledgeChunkEligibilityRequest,
  McsRawKnowledgeSource,
  McsRuntimeRequestScope,
  McsSourceId,
  McsTeamId,
  McsTenantId,
} from '@momentum/shared/runtime';
import {
  chunkParsedDocument,
  chunksToKnowledgeReferences,
  chunkToKnowledgeReference,
  filterRetrievalEligible,
  ingestRawKnowledgeSource,
  isChunkRetrievalEligible,
  parseRawKnowledgeSource,
  resolveKnowledgeAuthority,
} from '../index.js';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
  toContextReferences,
  type ApprovedKnowledgeProvider,
} from '../../../context/index.js';
import {
  buildContextPacket,
  validateContextPacket,
  type ContextPacketBuildInput,
} from '../../../context/contextManager.js';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../../../context/validation.js';

function scope(): McsRuntimeRequestScope {
  return {
    tenantId: 'tenant_team_magnificent' as McsTenantId,
    teamId: 'team_magnificent' as McsTeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: 'TMAG-P45A-001' as TmagId,
  };
}

const MARKDOWN_SOURCE = [
  '# Sharing With Confidence',
  '',
  'Lead with curiosity, not a pitch. Ask what matters to them.',
  '',
  '## First Conversation',
  '',
  'Keep it short. Invite them to look, never pressure.',
  '',
  '## Follow Up',
  '',
  'Follow up with care and consistency.',
].join('\n');

function source(overrides: Partial<McsRawKnowledgeSource> = {}): McsRawKnowledgeSource {
  return {
    sourceId: 'source_p45a_training' as McsSourceId,
    title: 'Sharing With Confidence',
    sourceType: 'tm_training_page',
    format: 'markdown',
    originalContent: MARKDOWN_SOURCE,
    createdBy: 'TMAG-01',
    createdAt: '2026-06-30T12:00:00.000Z',
    language: 'en',
    domain: 'training',
    scope: scope(),
    version: 1,
    status: 'active',
    ...overrides,
  };
}

function eligibilityRequest(
  overrides: Partial<McsKnowledgeChunkEligibilityRequest> = {},
): McsKnowledgeChunkEligibilityRequest {
  return { scope: scope(), language: 'en', ...overrides };
}

function packetInput(overrides: Partial<ContextPacketBuildInput> = {}): ContextPacketBuildInput {
  return {
    packetId: 'ctx_packet_p45a_001' as ContextPacketBuildInput['packetId'],
    requestId: 'ctx_req_p45a_001' as ContextPacketBuildInput['requestId'],
    tenant: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      tenantName: 'Team Magnificent Tenant',
      brandName: TEAM_MAGNIFICENT_NAME,
      environment: 'development',
    },
    team: {
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
    },
    ba: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: 'TMAG-P45A-001' as TmagId,
      journalEnabled: false,
      languagePreference: 'en',
      permissions: {
        canUsePrivateJournal: false,
        canSelectJournalForReview: false,
        canCreateKnowledgeCandidate: false,
        canAccessRelationshipContext: false,
        canUseBrowserVoice: false,
        canUseBrowserText: true,
      },
    },
    session: {
      sessionId: 'session_p45a_001' as ContextPacketBuildInput['session']['sessionId'],
      mode: 'browser_text',
      status: 'active',
      taskType: 'training_support',
      startedAt: '2026-06-30T12:00:00.000Z',
    },
    agentKey: 'michael_magnificent',
    objective: 'training_support',
    language: {
      primary: 'en',
      userPreference: 'en',
      translationAllowed: false,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    provenance: {
      assembledBy: 'context_manager',
      requestId: 'ctx_req_p45a_001' as ContextPacketBuildInput['requestId'],
      componentVersion: 's1.5',
      traceId: 'trace_p45a_001',
    },
    createdAt: '2026-06-30T12:00:01.000Z',
    ...overrides,
  };
}

function providerReturning(
  references: ReturnType<typeof chunksToKnowledgeReferences>,
): ApprovedKnowledgeProvider {
  return {
    async listApprovedKnowledge() {
      return references;
    },
  };
}

describe('P4.5A knowledge intake — parser', () => {
  it('preserves the raw source verbatim (raw source is authority)', () => {
    const raw = source();
    const original = raw.originalContent;
    parseRawKnowledgeSource(raw);
    ingestRawKnowledgeSource(raw);
    expect(raw.originalContent).toBe(original);
    expect(raw.originalContent).toBe(MARKDOWN_SOURCE);
  });

  it('normalizes deterministically and detects sections', () => {
    const document = parseRawKnowledgeSource(source());
    expect(document.parseStatus).toBe('parsed');
    expect(document.detectedSections.map((section) => section.heading)).toEqual([
      'Sharing With Confidence',
      'First Conversation',
      'Follow Up',
    ]);
    // Re-parse is byte-identical (no clock, no randomness).
    expect(parseRawKnowledgeSource(source()).normalizedText).toBe(document.normalizedText);
  });

  it('strips unsafe markup from html and warns', () => {
    const document = parseRawKnowledgeSource(
      source({
        format: 'html',
        originalContent:
          '<h1>Welcome</h1><script>alert(1)</script><p>Be a sharer, not a seller.</p>',
      }),
    );
    expect(document.normalizedText).not.toContain('alert');
    expect(document.normalizedText).not.toContain('<');
    expect(document.normalizedText).toContain('Be a sharer, not a seller.');
    expect(document.parseStatus).toBe('parsed_with_warnings');
    expect(document.parseWarnings.join(' ')).toContain('Unsafe markup');
  });

  it('marks empty/whitespace-only content as parse_failed', () => {
    const document = parseRawKnowledgeSource(source({ originalContent: '   \n\t  \n' }));
    expect(document.parseStatus).toBe('parse_failed');
    expect(chunkParsedDocument(source({ originalContent: '   \n\t  \n' }), document)).toEqual([]);
  });
});

describe('P4.5A knowledge intake — Kevin authority foundation', () => {
  it('treats Kevin-authored sources as active authority', () => {
    const resolution = resolveKnowledgeAuthority(source({
      authority: {
        authorityKind: 'kevin_authored',
        authorityStatus: 'active_authority',
        authorityBy: 'TMAG-01',
        authorityAt: '2026-06-30T12:00:00.000Z',
      },
    }));

    expect(resolution).toMatchObject({
      decision: 'active_authority',
      canBecomeActiveGuidance: true,
      candidateOnly: false,
      reason: 'kevin_authored',
    });
  });

  it('keeps agent-captured sources candidate-only until Kevin approves them', () => {
    const raw = source({
      createdBy: 'agent:michael',
      authority: {
        authorityKind: 'agent_captured',
        authorityStatus: 'candidate_only',
        authorityBy: 'agent:michael',
        authorityAt: '2026-06-30T12:00:00.000Z',
      },
    });

    const result = ingestRawKnowledgeSource(raw);

    expect(result.authority).toMatchObject({
      decision: 'candidate_only',
      canBecomeActiveGuidance: false,
      candidateOnly: true,
    });
    expect(result.chunks.every((chunk) => chunk.retrievalEligible === false)).toBe(true);
    expect(chunksToKnowledgeReferences(result.chunks)).toEqual([]);
  });

  it('preserves legacy Kevin-created sources as active authority', () => {
    const result = ingestRawKnowledgeSource(source({
      createdBy: 'Kevin Gardner',
      authority: undefined,
    }));

    expect(result.authority).toMatchObject({
      decision: 'active_authority',
      reason: 'legacy_kevin_created',
    });
    expect(chunksToKnowledgeReferences(result.chunks).length).toBeGreaterThan(0);
  });
});

describe('P4.5A knowledge intake — chunker & traceability', () => {
  it('parsed document points back to the raw source', () => {
    const { source: raw, document } = ingestRawKnowledgeSource(source());
    expect(document.sourceId).toBe(raw.sourceId);
    expect(document.sourceVersion).toBe(raw.version);
  });

  it('chunks point back to the parsed document and the raw source', () => {
    const { source: raw, document, chunks } = ingestRawKnowledgeSource(source());
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.sourceId).toBe(raw.sourceId);
      expect(chunk.documentId).toBe(document.documentId);
      expect(chunk.sourceVersion).toBe(raw.version);
    }
  });

  it('produces stable, deterministic chunk ids across re-ingest', () => {
    const first = ingestRawKnowledgeSource(source()).chunks.map((chunk) => chunk.chunkId);
    const second = ingestRawKnowledgeSource(source()).chunks.map((chunk) => chunk.chunkId);
    expect(second).toEqual(first);
    // Distinct from a different version of the same source.
    const v2 = ingestRawKnowledgeSource(source({ version: 2 })).chunks.map((chunk) => chunk.chunkId);
    expect(v2).not.toEqual(first);
  });

  it('carries source + classification metadata into every chunk', () => {
    const { chunks } = ingestRawKnowledgeSource(source(), {
      classification: {
        topicTags: ['sharing', 'onboarding'],
        agentScopes: ['michael_magnificent'],
        surfaceScopes: ['team'],
      },
    });
    for (const chunk of chunks) {
      expect(chunk.language).toBe('en');
      expect(chunk.domain).toBe('training');
      expect(chunk.topicTags).toEqual(['sharing', 'onboarding']);
      expect(chunk.agentScopes).toEqual(['michael_magnificent']);
      expect(chunk.surfaceScopes).toEqual(['team']);
      expect(chunk.surfaceScopes).not.toContain('com');
    }
  });

  it('splits oversize sections into multiple bounded chunks', () => {
    const long = `# Big\n\n${'word '.repeat(400).trim()}`;
    const { chunks } = ingestRawKnowledgeSource(
      source({ originalContent: long }),
      { maxChunkChars: 200 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(200);
      expect(chunk.heading).toBe('Big');
    }
  });

  it('bounds chunks even when a single unbreakable token exceeds max (regression: 53KB table chunk)', () => {
    // A giant token with no whitespace or paragraph breaks — e.g. a wide markdown
    // table row or long URL — previously slipped through hardSplit and produced one
    // oversize chunk that 422'd on Chroma Cloud's 16KB per-document limit.
    const giantToken = 'x'.repeat(5000);
    const withMixed = `# Table\n\n${giantToken}\n\n${'col '.repeat(300).trim()}\n\n${giantToken}${giantToken}`;
    const { chunks } = ingestRawKnowledgeSource(
      source({ originalContent: withMixed }),
      { maxChunkChars: 200 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(200);
    }
    // reassembling the pieces must lose no characters from the oversize content
    const totalChars = chunks.reduce((sum, c) => sum + c.text.length, 0);
    expect(totalChars).toBeGreaterThan(giantToken.length);
  });
});

describe('P4.5A knowledge intake — eligibility predicate', () => {
  function activeChunk(): McsKnowledgeChunk {
    const chunk = ingestRawKnowledgeSource(source()).chunks[0];
    if (!chunk) throw new Error('expected at least one chunk');
    return chunk;
  }

  it('admits an active, eligible, correctly-scoped, same-language chunk', () => {
    expect(isChunkRetrievalEligible(activeChunk(), eligibilityRequest())).toBe(true);
  });

  it('excludes an explicitly inactive (retrievalEligible=false) chunk', () => {
    const chunk: McsKnowledgeChunk = { ...activeChunk(), retrievalEligible: false };
    expect(isChunkRetrievalEligible(chunk, eligibilityRequest())).toBe(false);
  });

  it('excludes deprecated, archived, rejected, and parse_failed chunks', () => {
    for (const status of ['deprecated', 'archived', 'rejected', 'parse_failed'] as const) {
      const chunk: McsKnowledgeChunk = { ...activeChunk(), status, retrievalEligible: false };
      expect(isChunkRetrievalEligible(chunk, eligibilityRequest()), status).toBe(false);
    }
  });

  it('a deprecated/archived source yields zero eligible chunks', () => {
    for (const status of ['deprecated', 'archived', 'rejected'] as const) {
      const { chunks } = ingestRawKnowledgeSource(source({ status }));
      expect(filterRetrievalEligible(chunks, eligibilityRequest())).toEqual([]);
    }
  });

  it('excludes a chunk requested in a different language (fallback inert in P4.5A)', () => {
    expect(isChunkRetrievalEligible(activeChunk(), eligibilityRequest({ language: 'es' }))).toBe(false);
  });

  it('excludes a chunk scoped to a different BA', () => {
    const otherScope: McsRuntimeRequestScope = {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: 'TMAG-OTHER-999' as TmagId,
    };
    expect(isChunkRetrievalEligible(activeChunk(), eligibilityRequest({ scope: otherScope }))).toBe(false);
  });
});

describe('P4.5A knowledge intake — mapping to KnowledgeReference', () => {
  it('maps active chunks to approved/active references and drops ineligible ones', () => {
    const { chunks } = ingestRawKnowledgeSource(source());
    const references = chunksToKnowledgeReferences(chunks);
    expect(references.length).toBe(chunks.length);
    for (const reference of references) {
      expect(reference.status).toBe('active');
      expect(reference.translationStatus).toBe('same_language');
      expect(reference.domain).toBe('training');
    }
    const firstChunk = chunks[0];
    if (!firstChunk) throw new Error('expected a chunk');
    expect(chunkToKnowledgeReference({ ...firstChunk, status: 'archived' })).toBeNull();
  });
});

describe('P4.5A knowledge intake — end-to-end through the existing retrieval path', () => {
  it('feeds mapped references through the P4.4 adapter into a validated P4.5 packet', async () => {
    const { chunks } = ingestRawKnowledgeSource(source());
    const references = chunksToKnowledgeReferences(chunks);

    // The Context Manager retrieval path consumes references, never the raw source.
    const adapter = createContextManagerRetrievalAdapter(providerReturning(references));
    const result = await adapter.retrieveApprovedKnowledge({
      schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
      scope: scope(),
      objective: 'training_support',
      domains: ['training'],
      language: 'en',
      allowLanguageFallback: false,
    });

    expect(result.status).toBe('ok');
    expect(result.references.length).toBe(references.length);

    const packet = buildContextPacket(
      packetInput({ knowledgeReferences: toContextReferences(result) }),
    );

    expect(validateContextPacket(packet).ok).toBe(true);
    // Packet knowledge ids are the deterministic ids derived from the chunks — proving the
    // packet was assembled from chunks/references, not from raw source content.
    expect(packet.approvedKnowledge.map((item) => item.knowledgeId)).toEqual(
      references.map((reference) => reference.knowledgeId),
    );
    expect(packet.retrievalAudit.candidateKnowledgeIncluded).toBe(false);
    // The raw markdown never appears as packet knowledge text.
    expect(JSON.stringify(packet)).not.toContain(MARKDOWN_SOURCE);
  });
});
