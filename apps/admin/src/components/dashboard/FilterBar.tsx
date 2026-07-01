/**
 * Dashboard filter bar (wf_0079). Two controls + honest note:
 *   • BA dropdown — narrows every tile + drilldown to one BA's slice.
 *   • Leader group — system-detected ∪ Kevin-curated (locked-spec Part 5).
 *
 * The leader-detection note is rendered verbatim so Kevin always knows
 * what 'leaders_only' currently selects (binary qualification not yet
 * mirrored from THREE; 4.C curated toggle pending).
 */

import type {
  AdminDashboardFilter,
  AdminDashboardFiltersResponse,
} from '@momentum/shared';

interface Props {
  filter: AdminDashboardFilter;
  options: AdminDashboardFiltersResponse | null;
  onChange: (next: AdminDashboardFilter) => void;
}

export function FilterBar({ filter, options, onChange }: Props) {
  return (
    <div className="border border-line rounded-md p-4 mb-6 bg-cream/[0.015]">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-3">
        Filter · system-wide
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 text-[10px] font-mono tracking-label uppercase text-cream-faint">
            Brand Ambassador
          </label>
          <select
            value={filter.tmagId ?? ''}
            onChange={(e) =>
              onChange({ ...filter, tmagId: e.target.value === '' ? null : e.target.value })
            }
            className="w-full bg-ink border border-line rounded px-2 py-1.5 text-sm text-cream font-mono"
          >
            <option value="">All BAs</option>
            {(options?.bas ?? []).map((b) => (
              <option key={b.tmagId} value={b.tmagId}>
                {b.fullName}
                {b.isLeader ? ' · ★' : ''} · {b.tmagId}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 text-[10px] font-mono tracking-label uppercase text-cream-faint">
            Leader group
          </label>
          <select
            value={filter.leaderGroup}
            onChange={(e) =>
              onChange({
                ...filter,
                leaderGroup: e.target.value as AdminDashboardFilter['leaderGroup'],
              })
            }
            className="w-full bg-ink border border-line rounded px-2 py-1.5 text-sm text-cream font-mono"
          >
            {(options?.leaderGroups ?? []).map((g) => (
              <option key={g.value} value={g.value}>
                {g.label} ({g.count})
              </option>
            ))}
            {options === null && <option value="all">All BAs</option>}
          </select>
        </div>
      </div>

      {options?.leaderDetectionNote && (
        <p className="mt-3 text-[11px] font-mono text-cream-faint leading-snug">
          <span className="text-gold">Note:</span> {options.leaderDetectionNote}
        </p>
      )}
    </div>
  );
}
