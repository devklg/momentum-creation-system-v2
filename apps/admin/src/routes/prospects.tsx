/**
 * /prospects — /admin Section D · Prospect Oversight.
 *
 * Composes:
 *   • FilterBar  (reused from B.2 — same response shape)
 *   • DirectoryTable (D.1 · 10-column sortable directory)
 *   • DetailPanel    (D.2 · opens on row click or via `?prospectId=<id>`)
 *
 * Deep-link contract (LOCKED with Agent E): the detail panel opens on
 *   /prospects?prospectId=<id>
 * — Agent E's queue position-lookup (E.2) and ticker (E.5) link here
 * using exactly this query parameter. Do not rename.
 *
 * Filter contract: reuses B.2's AdminDashboardFilter shape, so the
 * existing FilterBar component renders unchanged. The server route
 * `/api/admin/prospects/filters` returns an identically-shaped response
 * to `/api/admin/dashboard/filters`.
 *
 * Compliance discipline visible on this surface (D.3 negation):
 *   - No score column. No qualification ranking. No AI coaching.
 *   - "Follow-up needed" is surfaced as a date, never a system flag.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  AdminDashboardFilter,
  AdminDashboardFiltersResponse,
  AdminProspectDirectoryResponse,
  AdminProspectDirectoryRow,
} from '@momentum/shared';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { DirectoryTable } from '@/components/prospect-oversight/DirectoryTable';
import { DetailPanel } from '@/components/prospect-oversight/DetailPanel';
import { Button } from '@/components/ui/button';
import {
  ProspectCrudModal,
  type ProspectCrudResponse,
} from '@/components/prospect-oversight/ProspectCrudModal';

const DEFAULT_FILTER: AdminDashboardFilter = { tmagId: null, leaderGroup: 'all' };

function readProspectIdParam(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('prospectId');
}

function writeProspectIdParam(prospectId: string | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (prospectId) {
    url.searchParams.set('prospectId', prospectId);
  } else {
    url.searchParams.delete('prospectId');
  }
  window.history.replaceState(null, '', url.toString());
}

export function ProspectsPage() {
  const [filter, setFilter] = useState<AdminDashboardFilter>(DEFAULT_FILTER);
  const [options, setOptions] = useState<AdminDashboardFiltersResponse | null>(null);
  const [rows, setRows] = useState<AdminProspectDirectoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(
    readProspectIdParam(),
  );
  const [createOpen, setCreateOpen] = useState(false);

  // Filter options — load once.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/prospects/filters', {
          credentials: 'include',
        });
        const data = (await res.json()) as AdminDashboardFiltersResponse & {
          error?: string;
        };
        if (!data.ok) {
          setErr(data.error ?? 'Could not load filter options.');
          return;
        }
        setOptions(data);
      } catch (e) {
        setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
      }
    })();
  }, []);

  const loadRows = useCallback(async (f: AdminDashboardFilter) => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (f.tmagId) params.set('tmagId', f.tmagId);
      if (f.leaderGroup) params.set('leaderGroup', f.leaderGroup);
      const res = await fetch(`/api/admin/prospects?${params.toString()}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as AdminProspectDirectoryResponse & {
        error?: string;
      };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load prospects.');
        return;
      }
      setRows(data.rows);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows(filter);
  }, [filter, loadRows]);

  const handleSelectProspect = useCallback((prospectId: string | null) => {
    setSelectedProspectId(prospectId);
    writeProspectIdParam(prospectId);
  }, []);

  // Apply a single refreshed row in-place after an intervention; avoids
  // a full directory refetch.
  const handleRowRefreshed = useCallback((updated: AdminProspectDirectoryRow) => {
    setRows((prev) =>
      prev ? prev.map((r) => (r.prospectId === updated.prospectId ? updated : r)) : prev,
    );
  }, []);

  // A freshly minted prospect may not match the active filter; refetch the
  // directory so it appears (or correctly doesn't) under current filters.
  const handleCreateDone = useCallback(
    (_resp: ProspectCrudResponse) => {
      setCreateOpen(false);
      void loadRows(filter);
    },
    [filter, loadRows],
  );

  return (
    <div className="max-w-[1600px]">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section D · Prospect Oversight
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Prospect Oversight</h1>
      <p className="text-cream-mute text-sm mb-8 max-w-3xl">
        Cross-team directory of every prospect in every BA's pipeline. The
        activity history is the activity history — the system does not score,
        rank, or coach. Intervention powers (move, reassign sponsor, manual
        flush, force enroll) are BA-requested emergency levers only; every
        intervention writes an audit entry with before, after, requesting BA,
        and reason.
      </p>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">
          {err}
        </p>
      )}

      <div className="mb-4">
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          + New prospect
        </Button>
      </div>

      <FilterBar filter={filter} options={options} onChange={setFilter} />

      <DirectoryTable
        rows={rows}
        loading={loading}
        onSelectProspect={handleSelectProspect}
      />

      {selectedProspectId && (
        <DetailPanel
          prospectId={selectedProspectId}
          onClose={() => handleSelectProspect(null)}
          onRowRefreshed={handleRowRefreshed}
        />
      )}

      {createOpen && (
        <ProspectCrudModal
          mode="create"
          detail={null}
          onClose={() => setCreateOpen(false)}
          onDone={handleCreateDone}
        />
      )}
    </div>
  );
}
