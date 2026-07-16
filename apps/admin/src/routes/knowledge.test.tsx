import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MCS_KNOWLEDGE_CORRECTION_CONFIRMATION } from '@momentum/shared';
import { KnowledgePage } from './knowledge';

afterEach(() => vi.unstubAllGlobals());

describe('Knowledge retrieval diagnostics', () => {
  it('renders content-free cache and GraphRAG counters with restart-retention copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => statusResponse(),
    })));

    render(<KnowledgePage />);

    expect(await screen.findByText('Retrieval Performance')).toBeInTheDocument();
    expect(screen.getByText(/Cache 7 hits · 2 misses · 1 coalesced/)).toBeInTheDocument();
    expect(screen.getByText(/GraphRAG 3 batches · 11 ids · 6 Mongo calls/)).toBeInTheDocument();
    expect(screen.getByText(/Content-free in-process counters · reset on server restart/)).toBeInTheDocument();
    expect(screen.getByText(/bounded canonical scan found no deterministic source conflicts/i)).toBeInTheDocument();
    expect(screen.getByText(/no mutation authorized/i)).toBeInTheDocument();
  });

  it('renders conflict classes and only a shortened content-free fingerprint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => statusResponse({
        status: 'conflicts',
        conflictCount: 1,
        highestSeverity: 'high',
        counts: {
          active_source_ref_divergence: 1,
          active_source_identity_divergence: 0,
          resource_projection_digest_mismatch: 0,
          active_authority_state_mismatch: 0,
          active_exact_duplicate: 0,
        },
        samples: [{
          conflictClass: 'active_source_ref_divergence',
          severity: 'high',
          fingerprint: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        }],
      }),
    })));

    render(<KnowledgePage />);

    expect(await screen.findByText('Source reference divergence · 1')).toBeInTheDocument();
    expect(screen.getByText(/highest severity high/i)).toBeInTheDocument();
    expect(screen.getByText(/hash abcdef123456/)).toBeInTheDocument();
    expect(screen.queryByText(/7890abcdef1234567890/)).not.toBeInTheDocument();
  });

  it.each(['degraded', 'truncated'])('renders the %s fail-closed integrity state', async (state) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => statusResponse({
        status: state,
        scan: {
          sourceLimit: 1000, resourceLimit: 1000,
          sourcesObserved: 2, resourcesObserved: 1, complete: false,
        },
        degradedReasons: [{ reason: 'missing_resource_projection', count: 1 }],
      }),
    })));

    render(<KnowledgePage />);

    expect(await screen.findByText(new RegExp(`canonical scan was ${state}`, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/missing resource projection · 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/found no deterministic source conflicts/i)).not.toBeInTheDocument();
  });
});

describe('Governed knowledge correction UI', () => {
  it('lists metadata only, loads one selected version, previews, and sends exact bound evidence', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === '/api/admin/knowledge/status') return response(statusResponse());
      if (url.startsWith('/api/admin/knowledge/source-versions?')) return response({
        ok: true,
        items: [{
          sourceId: 'knowledge_alpha', sourceVersionId: 'knowledge_alpha:v1', title: 'Alpha source',
          domain: 'organizational', language: 'en', version: 1, status: 'active', authorityStatus: 'active_authority',
          contentDigestSha256: 'a'.repeat(64), createdAt: '2026-07-14T00:00:00.000Z',
          supersedesSourceVersionId: null, replacementSourceVersionId: null,
        }],
        nextCursor: null,
      });
      if (url === '/api/admin/knowledge/source-versions/knowledge_alpha%3Av1') return response({
        ok: true,
        source: {
          sourceId: 'knowledge_alpha', sourceVersionId: 'knowledge_alpha:v1', title: 'Alpha source',
          domain: 'organizational', language: 'en', version: 1, status: 'active', authorityStatus: 'active_authority',
          contentDigestSha256: 'a'.repeat(64), createdAt: '2026-07-14T00:00:00.000Z',
          supersedesSourceVersionId: null, replacementSourceVersionId: null,
          originalContent: 'Original content', sourceRef: null, createdBy: 'TMAG-01', chunkCount: 1,
        },
      });
      if (url.endsWith('/corrections/preview')) return response({
        ok: true,
        preview: {
          schemaVersion: 'knowledge_correction.v1', previewId: 'preview-1',
          createdAt: '2026-07-14T00:00:00.000Z', expiresAt: '2026-07-14T00:15:00.000Z',
          sourceId: 'knowledge_alpha', currentSourceVersionId: 'knowledge_alpha:v1', currentVersion: 1,
          expectedCurrentLifecycle: 'active', expectedReplacementSourceVersionId: null,
          replacementSourceVersionId: 'knowledge_alpha:v2', replacementVersion: 2,
          currentDigestSha256: 'a'.repeat(64), replacementDigestSha256: 'b'.repeat(64),
          previewDigestSha256: 'c'.repeat(64), reason: 'Correct the stale source statement.',
          projectionScope: ['mongo', 'neo4j', 'chroma', 'resource_catalog', 'graphrag'],
          rollbackTargetSourceVersionId: 'knowledge_alpha:v1', liveMutationAuthorized: false,
        },
      });
      if (url.endsWith('/corrections')) return response({ ok: true, correction: correctionRecord() }, 201);
      return response({ ok: false, error: 'unexpected_request' }, 500);
    }));

    render(<KnowledgePage />);
    fireEvent.click(await screen.findByRole('button', { name: /Alpha source/i }));
    expect(await screen.findByDisplayValue('Original content')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Replacement content'), { target: { value: 'Corrected content' } });
    fireEvent.change(screen.getByLabelText('Correction reason'), { target: { value: 'Correct the stale source statement.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create read-only preview' }));
    expect(await screen.findByText(/Preview · no live mutation yet/)).toBeInTheDocument();
    const apply = screen.getByRole('button', { name: 'Apply governed correction' });
    expect(apply).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Exact correction confirmation'), { target: { value: MCS_KNOWLEDGE_CORRECTION_CONFIRMATION } });
    fireEvent.click(apply);
    expect(await screen.findByText(/Correction verified across the governed cutover/)).toBeInTheDocument();

    const applyCall = calls.find((call) => call.url.endsWith('/corrections') && call.init?.method === 'POST');
    expect(JSON.parse(String(applyCall?.init?.body))).toMatchObject({
      previewId: 'preview-1',
      previewDigestSha256: 'c'.repeat(64),
      confirmation: MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
    });
    await waitFor(() => expect(calls.some((call) => call.url.includes('status=active'))).toBe(true));
  });
});

function statusResponse(integrityOverrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    generatedAt: '2026-07-14T00:00:00.000Z',
    status: 'ready',
    statusBasis: 'mongo_provider_eligibility_plus_projection_queue',
    activeSources: 2,
    activeChunks: 8,
    retrievalReadyChunks: 8,
    pendingChromaProjections: 0,
    failedChromaProjections: 0,
    pendingNeo4jProjections: 0,
    failedNeo4jProjections: 0,
    warnings: [],
    integrity: {
      status: 'clear',
      computedAt: '2026-07-14T00:00:00.000Z',
      conflictCount: 0,
      highestSeverity: null,
      counts: {
        active_source_ref_divergence: 0,
        active_source_identity_divergence: 0,
        resource_projection_digest_mismatch: 0,
        active_authority_state_mismatch: 0,
        active_exact_duplicate: 0,
      },
      scan: {
        sourceLimit: 1000, resourceLimit: 1000,
        sourcesObserved: 2, resourcesObserved: 2, complete: true,
      },
      degradedReasons: [],
      samples: [],
      mutationAuthorized: false,
      ...integrityOverrides,
    },
    contextManager: {
      retention: 'in_process_since_restart',
      liveSurfaces: { michael: true, steve: true },
      total: 3,
      successful: 3,
      degraded: 0,
      lastObservedAt: '2026-07-14T00:00:00.000Z',
      degradedReasons: [],
    },
    retrievalPerformance: {
      retention: 'in_process_since_restart',
      approvedReferenceCache: {
        ttlMs: 5000, maxEntries: 128, hits: 7, misses: 2, coalesced: 1,
        evictions: 0, size: 2, inFlight: 0, invalidations: 4, generation: 4,
      },
      graphRagReadiness: {
        maxUniqueIds: 50, batches: 3, requestedIds: 11,
        storeCalls: { mongoCanonical: 3, mongoOutbox: 3, neo4j: 3, chroma: 4 },
      },
    },
  };
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function correctionRecord() {
  return {
    correctionId: 'knowledge_correction_1', idempotencyKey: 'admin-preview-1', state: 'verified',
    sourceId: 'knowledge_alpha', currentSourceVersionId: 'knowledge_alpha:v1', replacementSourceVersionId: 'knowledge_alpha:v2',
    currentVersion: 1, replacementVersion: 2, currentDigestSha256: 'a'.repeat(64), replacementDigestSha256: 'b'.repeat(64),
    previewDigestSha256: 'c'.repeat(64), reason: 'Correct the stale source statement.', actorTmagId: 'TMAG-01',
    approvalDecisionId: 'dec_1', decisionBinding: {
      decisionId: 'dec_1', status: 'active', decidedBy: 'kevin_gardner', decidedAt: '2026-07-14T00:00:00.000Z',
      sourceVersionId: 'knowledge_alpha:v1', expectedVersion: 1, expectedLifecycle: 'active', expectedReplacementSourceVersionId: null,
      currentDigestSha256: 'a'.repeat(64), replacementDigestSha256: 'b'.repeat(64), reason: 'Correct the stale source statement.',
      previewDigestSha256: 'c'.repeat(64), actorTmagId: 'TMAG-01', idempotencyKey: 'admin-preview-1',
    },
    rollbackTargetSourceVersionId: 'knowledge_alpha:v1', rollbackOfCorrectionId: null,
    evidence: [{ stage: 'cutover_pending', cutoverPhase: 'verified', recordedAt: '2026-07-14T00:00:00.000Z', checks: [{ key: 'exclusive_active_version', passed: true }] }],
    cutoverPhase: 'verified', failureStage: null, failureCode: null, recordRevision: 6,
    requestFingerprintSha256: 'd'.repeat(64), attemptCount: 1, lastAttemptAt: '2026-07-14T00:00:00.000Z',
    createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z', verifiedAt: '2026-07-14T00:00:00.000Z', rolledBackAt: null,
  };
}
