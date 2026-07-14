/**
 * D.1 — the prospect directory table.
 *
 * Ten columns, sortable on every one. Sort is in-memory (Kevin-scale —
 * dozens to low thousands of rows at v1). Row click selects the prospect
 * for the detail panel; the prospect-URL "preview" link opens the
 * sandbox preview inside the detail panel rather than navigating, so
 * no real /p/{token} click event ever fires.
 *
 * D.3 negation visible here: no score / rank / qualification column,
 * deliberately absent. The "Follow-up needed" column shows a DATE,
 * never a system flag — Kevin reads it.
 */

import type {
  McsAdminProspectDirectoryRow,
  McsAdminProspectPresentationStatus,
  McsProspectStatus,
} from '@momentum/shared';

type SortDir = 'asc' | 'desc';
type SortColumn =
  | 'name'
  | 'sponsor'
  | 'status'
  | 'position'
  | 'url'
  | 'firstContact'
  | 'recent'
  | 'days'
  | 'followUp'
  | 'handoff';

interface SortState {
  column: SortColumn;
  dir: SortDir;
}
const DEFAULT_SORT: SortState = { column: 'firstContact', dir: 'desc' };

interface Props {
  rows: McsAdminProspectDirectoryRow[] | null;
  loading: boolean;
  onSelectProspect: (prospectId: string) => void;
}

export function DirectoryTable({ rows, loading, onSelectProspect }: Props) {
  const sort = DEFAULT_SORT;
  const sortedRows = rows;
  const handleSort = () => undefined;

  if (loading && !sortedRows) {
    return (
      <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase mt-6">
        Loading…
      </p>
    );
  }

  if (sortedRows && sortedRows.length === 0) {
    return (
      <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase mt-6">
        No prospects match this filter.
      </p>
    );
  }

  return (
    <div className="border border-line rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-cream/[0.025]">
          <tr className="text-left">
            <SortableTh
              col="name"
              label="Prospect"
              sort={sort}
              onSort={handleSort}
            />
            <SortableTh
              col="sponsor"
              label="Inviting BA"
              sort={sort}
              onSort={handleSort}
            />
            <SortableTh col="status" label="Status" sort={sort} onSort={handleSort} />
            <SortableTh
              col="position"
              label="Position"
              sort={sort}
              onSort={handleSort}
              align="right"
            />
            <SortableTh
              col="url"
              label="Prospect URL"
              sort={sort}
              onSort={handleSort}
            />
            <SortableTh
              col="firstContact"
              label="First Contact"
              sort={sort}
              onSort={handleSort}
            />
            <SortableTh
              col="recent"
              label="Most Recent"
              sort={sort}
              onSort={handleSort}
            />
            <SortableTh
              col="days"
              label="Days in Tank"
              sort={sort}
              onSort={handleSort}
              align="right"
            />
            <SortableTh
              col="followUp"
              label="Follow-up By"
              sort={sort}
              onSort={handleSort}
            />
            <SortableTh
              col="handoff"
              label="Handoff State"
              sort={sort}
              onSort={handleSort}
            />
          </tr>
        </thead>
        <tbody>
          {sortedRows?.map((row) => (
            <tr
              key={row.prospectId}
              className="border-t border-line hover:bg-cream/[0.02] cursor-pointer"
              onClick={() => onSelectProspect(row.prospectId)}
            >
              <Td>
                <span className="text-cream">
                  {row.firstName} {row.lastName}
                </span>
              </Td>
              <Td>
                <div className="leading-tight">
                  <div className="text-cream">{row.sponsorName}</div>
                  <div className="text-[11px] font-mono text-cream-faint">
                    {row.sponsorTmagId}
                  </div>
                </div>
              </Td>
              <Td>
                <StatusPill status={row.presentationStatus} />
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {row.positionNumber !== null ? (
                  <span className="text-cream">#{row.positionNumber}</span>
                ) : (
                  <span className="text-cream-faint">—</span>
                )}
              </Td>
              <Td>
                {row.prospectUrl ? (
                  <span
                    className="text-teal text-[12px] font-mono underline-offset-2 hover:underline"
                    title="Click row to open sandbox preview (does not fire link-click)"
                  >
                    {row.prospectUrl.replace('https://', '')}
                  </span>
                ) : (
                  <span className="text-cream-faint">—</span>
                )}
              </Td>
              <Td className="text-cream-mute text-[12px] font-mono">
                {formatDate(row.firstContactAt)}
              </Td>
              <Td>
                <div className="leading-tight">
                  <div className="text-cream-mute text-[12px] font-mono">
                    {formatDate(row.mostRecentActivity.at)}
                  </div>
                  <div className="text-[11px] text-cream-faint">
                    {row.mostRecentActivity.label}
                  </div>
                </div>
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {row.daysInHoldingTank !== null ? (
                  <span className="text-cream">{row.daysInHoldingTank}d</span>
                ) : (
                  <span className="text-cream-faint">—</span>
                )}
              </Td>
              <Td className="text-cream-mute text-[12px] font-mono">
                {row.followUpNeededBy ? (
                  formatDate(row.followUpNeededBy)
                ) : (
                  <span className="text-cream-faint">—</span>
                )}
              </Td>
              <Td>
                <ProspectStatusPill state={row.prospectStatus} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── helpers ───────────────────────────────────────────────────── */

function SortableTh({
  col,
  label,
  sort,
  onSort: _onSort,
  align = 'left',
}: {
  col: SortColumn;
  label: string;
  sort: SortState;
  onSort: (col: SortColumn) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.column === col;
  const arrow = active ? (sort.dir === 'asc' ? '↑' : '↓') : '';
  return (
    <th
      className={[
        'px-3 py-2.5 text-[10px] font-mono tracking-label uppercase whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        active ? 'text-gold' : 'text-cream-faint',
      ].join(' ')}
    >
      {label} <span className="ml-1">{arrow}</span>
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={['px-3 py-2.5 align-top', className ?? ''].join(' ')}>{children}</td>
  );
}

function StatusPill({ status }: { status: McsAdminProspectPresentationStatus }) {
  const { label, tone } = describePresentationStatus(status);
  return (
    <span
      className={[
        'text-[10px] font-mono tracking-label uppercase px-2 py-0.5 rounded border',
        tone,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function ProspectStatusPill({
  state,
}: {
  state: McsProspectStatus;
}) {
  const tone =
    state === 'enrolled_iii'
      ? 'text-teal border-teal/40'
      : state === 'became_customer'
        ? 'text-gold border-gold/40'
        : state === 'declined'
          ? 'text-red-400 border-red-400/40'
          : 'text-cream-mute border-line';
  return (
    <span
      className={[
        'text-[10px] font-mono tracking-label uppercase px-2 py-0.5 rounded border',
        tone,
      ].join(' ')}
    >
      {state}
    </span>
  );
}

function describePresentationStatus(s: McsAdminProspectPresentationStatus): {
  label: string;
  tone: string;
} {
  switch (s) {
    case 'minted':
      return { label: 'invited', tone: 'text-cream-faint border-line' };
    case 'clicked':
      return { label: 'clicked', tone: 'text-cream-mute border-line' };
    case 'video_started':
      return { label: 'video started', tone: 'text-cream-mute border-line' };
    case 'video_quarter':
      return { label: 'video 25', tone: 'text-cream border-line' };
    case 'video_half':
      return { label: 'video 50', tone: 'text-cream border-line' };
    case 'video_three_quarter':
      return { label: 'video 75', tone: 'text-cream border-line' };
    case 'video_complete':
      return { label: 'video complete', tone: 'text-teal border-teal/40' };
    case 'callback_requested':
      return { label: 'reading dossier', tone: 'text-gold border-gold/40' };
    case 'webinar_reserved':
      return { label: 'webinar reserved', tone: 'text-gold border-gold/40' };
    case 'enrolled':
      return { label: 'enrolled', tone: 'text-teal border-teal/40' };
    case 'expired':
      return { label: 'expired', tone: 'text-red-400 border-red-400/40' };
    default:
      // Defensive: an unrecognized status must never blank the page.
      return { label: String(s ?? 'unknown'), tone: 'text-cream-faint border-line' };
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: '2-digit',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

