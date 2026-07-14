import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
