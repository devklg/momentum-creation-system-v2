/**
 * ADMIN I.1 report time-range resolver (Chat #143).
 *
 * Kevin decision A: every report accepts BOTH a preset enum
 * (lifetime | last_30d | last_90d | by_month) AND explicit from/to ISO
 * dates. Explicit dates win when present; otherwise the preset resolves to
 * concrete bounds. The resolver always returns concrete fromIso/toIso (the
 * window actually queried) plus a human label for headers + PDF.
 *
 * by_month is the cohort view: it does not narrow the window (fromIso open)
 * — the report groups by signup month itself. The preset is carried through
 * so a report knows to emit cohort buckets.
 */

import type {
  McsAdminReportRangePreset,
  McsAdminReportTimeRange,
} from '@momentum/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

const PRESET_LABEL: Record<McsAdminReportRangePreset, string> = {
  lifetime: 'Lifetime',
  last_30d: 'Last 30 days',
  last_90d: 'Last 90 days',
  by_month: 'By signup month (lifetime)',
};

function isIso(value: string): boolean {
  if (!value) return false;
  return Number.isFinite(Date.parse(value));
}

export function resolveTimeRange(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
}): McsAdminReportTimeRange {
  const nowIso = new Date().toISOString();
  const from = input.from && isIso(input.from) ? new Date(input.from).toISOString() : null;
  const to = input.to && isIso(input.to) ? new Date(input.to).toISOString() : null;

  if (from || to) {
    const toIso = to ?? nowIso;
    const label = `${from ? from.slice(0, 10) : '—'} → ${to ? to.slice(0, 10) : 'now'}`;
    return { preset: null, fromIso: from, toIso, label };
  }

  const preset = (input.preset ?? 'lifetime') as McsAdminReportRangePreset;
  switch (preset) {
    case 'last_30d':
      return {
        preset,
        fromIso: new Date(Date.now() - 30 * DAY_MS).toISOString(),
        toIso: nowIso,
        label: PRESET_LABEL.last_30d,
      };
    case 'last_90d':
      return {
        preset,
        fromIso: new Date(Date.now() - 90 * DAY_MS).toISOString(),
        toIso: nowIso,
        label: PRESET_LABEL.last_90d,
      };
    case 'by_month':
      return { preset, fromIso: null, toIso: nowIso, label: PRESET_LABEL.by_month };
    case 'lifetime':
    default:
      return { preset: 'lifetime', fromIso: null, toIso: nowIso, label: PRESET_LABEL.lifetime };
  }
}

/** Month bucket key "YYYY-MM" (UTC) for cohort grouping. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Mongo date-range clause for a field, honoring open bounds. Returns {} when
 * fully open (lifetime), so callers can spread it into a filter.
 */
export function rangeClause(
  field: string,
  range: McsAdminReportTimeRange,
): Record<string, unknown> {
  const bounds: Record<string, string> = {};
  if (range.fromIso) bounds.$gte = range.fromIso;
  if (range.toIso) bounds.$lt = range.toIso;
  return Object.keys(bounds).length ? { [field]: bounds } : {};
}
