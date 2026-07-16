import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsistencyPage } from './consistency';

afterEach(() => vi.unstubAllGlobals());

describe('Admin Neo4j topology integrity evidence', () => {
  it('renders report-only topology counts, coverage, and content-free fingerprints', async () => {
    const fingerprint = 'a'.repeat(64);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () =>
        String(input).includes('crm-integrity')
          ? {
              ok: true,
              totals: {
                stuck: 0,
                duplicate: 0,
                orphan: 0,
                inconsistent: 0,
                ambiguous: 0,
                cleanupCandidates: 0,
              },
              findings: [],
              policy: {},
            }
          : {
              ok: true,
              generatedAt: '2026-07-16T00:00:00.000Z',
              overall: 'red',
              totals: {
                halfWrites: 0,
                staleProjections: 0,
                failedProjections: 0,
                orphanRecords: 0,
                reconciliationIssues: 0,
                warnings: 0,
              },
              staleProjectionMinutes: 15,
              reconciliation: { limitPerSpec: 25, specs: [], issues: [] },
              halfWrites: [],
              staleProjections: [],
              orphanCategories: [],
              warnings: [],
              graphIntegrity: {
                generatedAt: '2026-07-16T00:00:00.000Z',
                status: 'findings',
                repairPolicy: 'report_only',
                sampleLimit: 25,
                topology: { nodes: 2527, relationships: 18057 },
                coverage: { expected: 41, completed: 41, degraded: 0 },
                totals: {
                  findings: 1,
                  missingIdentity: 1,
                  duplicateIdentity: 0,
                  missingRequiredAnchor: 0,
                  ambiguousRequiredAnchor: 0,
                  duplicateParallelEdge: 0,
                },
                traversals: [{
                  key: 'member_missing_identity',
                  label: 'Member missing identity',
                  findingClass: 'missing_identity',
                  severity: 'critical',
                  status: 'findings',
                  exactCount: 1,
                  sampleLimit: 25,
                  sampleFingerprints: [fingerprint],
                  error: null,
                }],
                degradedReasons: [],
              },
            },
    })));

    render(<ConsistencyPage />);

    expect(await screen.findByText('Neo4j Topology Integrity · Report Only')).toBeInTheDocument();
    expect(screen.getByText('2,527')).toBeInTheDocument();
    expect(screen.getByText('18,057')).toBeInTheDocument();
    expect(screen.getByText('41/41')).toBeInTheDocument();
    expect(screen.getByText(fingerprint)).toBeInTheDocument();
    expect(screen.getByText(/without repair, constraint application/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /repair|apply|delete|merge/i })).not.toBeInTheDocument();
  });
});
