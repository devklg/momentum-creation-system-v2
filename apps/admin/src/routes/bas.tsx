/**
 * /bas — Admin BA Oversight (wireframe 4.C · locked-spec 4.C).
 *
 * C.1 directory + C.4 profile drawer + C.5 sponsor override flow.
 *
 * Reads:
 *   GET /api/admin/bas               → directory rows (15 columns)
 *   GET /api/admin/bas/:tmagId         → profile bundle (drawer)
 *
 * Writes:
 *   POST /api/admin/bas/:tmagId/sponsor-override   (C.5, critical audit)
 *   POST /api/admin/bas/:tmagId/leader-tag         (curated badge toggle)
 *   POST /api/admin/bas/:tmagId/notes              (Kevin-only append-only)
 *
 * Compliance discipline (Chat #89):
 *   - No algorithmic flagging in the table. No score columns. Kevin reads
 *     the raw numbers (2-in-72, profile %, follow-up aging) and decides.
 *   - Leader badges are display, never ranking — system-detected is a
 *     hard rule (currently dormant; binary qualification not mirrored
 *     yet, see `leaderDetectionNote`), curated is Kevin-toggled.
 */

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DirectoryTable } from '@/components/ba-oversight/directory-table';
import { ProfileDrawer } from '@/components/ba-oversight/profile-drawer';
import { BaCrudModal, type BaCrudResponse } from '@/components/ba-oversight/ba-crud-modal';
import { LaunchReadinessPanel } from '@/components/ba-oversight/launch-readiness-panel';
import type {
  McsAdminBaDirectoryResponse,
  McsAdminBaDirectoryRow,
  McsAdminLeaderTagResponse,
} from '@momentum/shared';

export function BAsPage() {
  const [rows, setRows] = useState<McsAdminBaDirectoryRow[] | null>(null);
  const [leaderNote, setLeaderNote] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [openTmagId, setOpenTmagId] = useState<string | null>(null);
  const [togglePendingTmagId, setTogglePendingTmagId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch('/api/admin/bas', { credentials: 'include' });
      const data = (await res.json()) as McsAdminBaDirectoryResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load directory.');
        return;
      }
      setRows(data.rows);
      setLeaderNote(data.leaderDetectionNote);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onRowChanged(next: McsAdminBaDirectoryRow) {
    setRows((prev) =>
      prev ? prev.map((r) => (r.tmagId === next.tmagId ? next : r)) : prev,
    );
  }

  function onCreateDone(_resp: BaCrudResponse) {
    setCreateOpen(false);
    void load();
  }

  async function onToggleCurated(tmagId: string, next: boolean) {
    setTogglePendingTmagId(tmagId);
    try {
      const res = await fetch(
        `/api/admin/bas/${encodeURIComponent(tmagId)}/leader-tag`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ curated: next }),
        },
      );
      const data = (await res.json()) as
        | McsAdminLeaderTagResponse
        | { ok: false; error: string };
      if (!data.ok) {
        setErr(data.error || 'Leader tag update failed.');
        return;
      }
      setRows((prev) =>
        prev
          ? prev.map((r) =>
              r.tmagId === tmagId ? { ...r, curatedLeader: data.curated } : r,
            )
          : prev,
      );
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setTogglePendingTmagId(null);
    }
  }

  return (
    <div className="max-w-[1400px]">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section C · BA Oversight
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Brand Ambassadors</h1>
      <p className="text-cream-mute text-sm mb-6 max-w-2xl">
        Flat operational directory. Click a name or BA ID for the profile drawer.
        Sponsor overrides happen from the drawer's Sponsor section.
      </p>

      {leaderNote && (
        <p className="text-[11px] font-mono text-cream-faint mb-6 max-w-2xl">
          {leaderNote}
        </p>
      )}

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">{err}</p>
      )}

      <LaunchReadinessPanel />

      <div className="mb-4 max-w-md">
        <Input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter by name, BA ID, sponsor, code, email…"
        />
      </div>

      <div className="mb-4">
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          + New Brand Ambassador
        </Button>
      </div>

      {rows === null ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          Loading…
        </p>
      ) : (
        <DirectoryTable
          rows={rows}
          filterText={filterText}
          onOpenProfile={setOpenTmagId}
          onToggleCurated={(id, next) => void onToggleCurated(id, next)}
          togglePendingTmagId={togglePendingTmagId}
        />
      )}

      {openTmagId && (
        <ProfileDrawer
          tmagId={openTmagId}
          onClose={() => setOpenTmagId(null)}
          onRowChanged={onRowChanged}
        />
      )}

      {createOpen && (
        <BaCrudModal
          mode="create"
          row={null}
          onClose={() => setCreateOpen(false)}
          onDone={onCreateDone}
        />
      )}
    </div>
  );
}
