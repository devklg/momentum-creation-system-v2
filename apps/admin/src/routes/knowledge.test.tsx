import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KnowledgePage } from './knowledge';

afterEach(() => vi.unstubAllGlobals());

describe('Knowledge retrieval diagnostics', () => {
  it('renders content-free cache and GraphRAG counters with restart-retention copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
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
      }),
    })));

    render(<KnowledgePage />);

    expect(await screen.findByText('Retrieval Performance')).toBeInTheDocument();
    expect(screen.getByText(/Cache 7 hits · 2 misses · 1 coalesced/)).toBeInTheDocument();
    expect(screen.getByText(/GraphRAG 3 batches · 11 ids · 6 Mongo calls/)).toBeInTheDocument();
    expect(screen.getByText(/Content-free in-process counters · reset on server restart/)).toBeInTheDocument();
  });
});
