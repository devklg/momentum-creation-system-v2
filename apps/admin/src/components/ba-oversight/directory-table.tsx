/**
 * C.1 — Brand Ambassador directory table.
 *
 * 15 columns, every one sortable. Click a column header to sort asc;
 * click again to flip desc. Filter input is a free-text "contains" over
 * BA name + BA IDs + email + sponsor name + access code.
 *
 * Compliance discipline (Chat #89):
 *   - No "at-risk" badges, no score columns. Every metric is the raw
 *     count or raw timestamp; Kevin reads it.
 *   - The two leader badges are display-only — system-detected is a
 *     hard rule (currently always false; binary qualification not
 *     mirrored yet), curated is Kevin-toggled from the row.
 */

import { useMemo, useState } from 'react';
import type { McsAdminBaDirectoryRow } from '@momentum/shared';

type SortKey =
  | 'fullName'
  | 'threeBaId'
  | 'accessCodeOwned'
  | 'sponsorName'
  | 'joinedAt'
  | 'welcomeAcceptedAt'
  | 'lastLoginAt'
  | 'twoInSeventyTwoCount'
  | 'profileCompletenessPct'
  | 'personalInvitesCount'
  | 'oldestOpenFollowUpDueAt'
  | 'trainingModulesCompleted'
  | 'status'
  | 'lastActivityAt'
  | 'curatedLeader';

interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

interface Props {
  rows: McsAdminBaDirectoryRow[];
  filterText: string;
  onOpenProfile: (tmagId: string) => void;
  onToggleCurated: (tmagId: string, next: boolean) => void;
  togglePendingTmagId: string | null;
}

export function DirectoryTable({
  rows,
  filterText,
  onOpenProfile,
  onToggleCurated,
  togglePendingTmagId,
}: Props) {
  const [sort, setSort] = useState<SortState>({ key: 'joinedAt', dir: 'desc' });

  const filtered = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.fullName,
        r.tmagId,
        r.threeBaId,
        r.email ?? '',
        r.sponsorName ?? '',
        r.sponsorTmagId ?? '',
        r.accessCodeOwned ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, filterText]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => compareRows(a, b, sort.key));
    if (sort.dir === 'desc') copy.reverse();
    return copy;
  }, [filtered, sort]);

  function onHeaderClick(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
        No BAs yet.
      </p>
    );
  }

  return (
    <div className="border border-line rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-cream/[0.025]">
          <tr className="text-left">
            <SortHeader
              label="Name"
              col="fullName"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="THREE BA ID"
              col="threeBaId"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Code"
              col="accessCodeOwned"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Sponsor"
              col="sponsorName"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Signed up"
              col="joinedAt"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Welcome"
              col="welcomeAcceptedAt"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="First login"
              col="lastLoginAt"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="2-in-72"
              col="twoInSeventyTwoCount"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Profile %"
              col="profileCompletenessPct"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Invites"
              col="personalInvitesCount"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Follow-up aging"
              col="oldestOpenFollowUpDueAt"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Training"
              col="trainingModulesCompleted"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Status"
              col="status"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Last activity"
              col="lastActivityAt"
              sort={sort}
              onClick={onHeaderClick}
            />
            <SortHeader
              label="Leader"
              col="curatedLeader"
              sort={sort}
              onClick={onHeaderClick}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.tmagId} className="border-t border-line hover:bg-cream/[0.015]">
              <Td>
                <button
                  type="button"
                  onClick={() => onOpenProfile(r.tmagId)}
                  className="text-cream hover:text-gold transition-colors text-left"
                >
                  {r.fullName}
                </button>
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() => onOpenProfile(r.tmagId)}
                  className="font-mono text-cream-mute hover:text-gold transition-colors"
                >
                  {r.threeBaId}
                </button>
              </Td>
              <Td>
                {r.accessCodeOwned ? (
                  <span className="font-mono text-gold">{r.accessCodeOwned}</span>
                ) : (
                  <span className="text-cream-faint font-mono text-[11px]">—</span>
                )}
              </Td>
              <Td>
                {r.sponsorName ? (
                  <span>
                    <span className="text-cream">{r.sponsorName}</span>
                    {r.originalSponsorTmagId && r.originalSponsorName && (
                      <span
                        className="ml-2 text-[10px] font-mono text-gold/70 uppercase tracking-label"
                        title={`Original sponsor: ${r.originalSponsorName} (${r.originalSponsorTmagId})`}
                      >
                        override
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-cream-faint">— root —</span>
                )}
              </Td>
              <Td className="text-cream-mute whitespace-nowrap">
                {formatDate(r.joinedAt)}
              </Td>
              <Td>
                {r.welcomeAcceptedAt ? (
                  <span
                    className="text-teal font-mono text-[11px] uppercase tracking-label"
                    title={formatDateTime(r.welcomeAcceptedAt)}
                  >
                    yes
                  </span>
                ) : (
                  <span className="text-cream-faint font-mono text-[11px] uppercase tracking-label">
                    no
                  </span>
                )}
              </Td>
              <Td>
                {r.lastLoginAt ? (
                  <span
                    className="text-cream-mute font-mono text-[11px]"
                    title={`Most recent login: ${formatDateTime(r.lastLoginAt)}`}
                  >
                    {formatDate(r.lastLoginAt)}
                  </span>
                ) : (
                  <span className="text-cream-faint font-mono text-[11px] uppercase tracking-label">
                    never
                  </span>
                )}
              </Td>
              <Td>
                <span
                  className="font-mono text-cream"
                  title={`Trailing 72h from ${formatDateTime(r.twoInSeventyTwoWindowStart)}`}
                >
                  {r.twoInSeventyTwoCount}
                </span>
              </Td>
              <Td>
                <span className="font-mono text-cream-mute">
                  {r.profileCompletenessPct}%
                </span>
              </Td>
              <Td>
                <span className="font-mono text-cream-mute">
                  {r.personalInvitesCount}
                </span>
              </Td>
              <Td>
                {r.oldestOpenFollowUpDueAt ? (
                  <span
                    className="font-mono text-cream-mute"
                    title={`Oldest open follow-up due: ${formatDateTime(r.oldestOpenFollowUpDueAt)}`}
                  >
                    {agingFromNow(r.oldestOpenFollowUpDueAt)}
                  </span>
                ) : (
                  <span className="text-cream-faint font-mono text-[11px]">—</span>
                )}
              </Td>
              <Td>
                <span className="font-mono text-cream-mute">
                  {r.trainingModulesCompleted}/5
                </span>
                {r.trainingComplete && (
                  <span className="ml-2 text-[10px] font-mono text-teal uppercase tracking-label">
                    done
                  </span>
                )}
              </Td>
              <Td>
                <StatusPill status={r.status} />
              </Td>
              <Td className="text-cream-mute whitespace-nowrap">
                {r.lastActivityAt ? formatDate(r.lastActivityAt) : '—'}
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  {r.systemDetectedLeader && (
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-label border border-gold/40 text-gold bg-gold/[0.06]"
                      title="System-detected leader"
                    >
                      sys
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={togglePendingTmagId === r.tmagId}
                    onClick={() => onToggleCurated(r.tmagId, !r.curatedLeader)}
                    className={[
                      'text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-label border transition-colors',
                      r.curatedLeader
                        ? 'border-teal/40 text-teal bg-teal/[0.06] hover:border-teal/70'
                        : 'border-line text-cream-faint hover:text-cream hover:border-cream-mute',
                      togglePendingTmagId === r.tmagId ? 'opacity-50 cursor-wait' : '',
                    ].join(' ')}
                    title={
                      r.curatedLeader
                        ? 'Curated leader — click to clear'
                        : 'Mark as curated leader'
                    }
                  >
                    {r.curatedLeader ? 'curated' : 'tag'}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function compareRows(
  a: McsAdminBaDirectoryRow,
  b: McsAdminBaDirectoryRow,
  key: SortKey,
): number {
  const av = a[key];
  const bv = b[key];
  if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
  if (bv === null || bv === undefined) return -1;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  if (typeof av === 'boolean' && typeof bv === 'boolean') {
    return av === bv ? 0 : av ? -1 : 1;
  }
  return String(av).localeCompare(String(bv));
}

function SortHeader({
  label,
  col,
  sort,
  onClick,
}: {
  label: string;
  col: SortKey;
  sort: SortState;
  onClick: (key: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className="px-3 py-2.5 text-[10px] font-mono tracking-label uppercase text-cream-faint text-left whitespace-nowrap">
      <button
        type="button"
        onClick={() => onClick(col)}
        className={[
          'inline-flex items-center gap-1 transition-colors',
          active ? 'text-gold' : 'hover:text-cream',
        ].join(' ')}
      >
        {label}
        {active && <span>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
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
  return <td className={['px-3 py-2.5 align-middle', className ?? ''].join(' ')}>{children}</td>;
}

function StatusPill({
  status,
}: {
  status: McsAdminBaDirectoryRow['status'];
}) {
  const cls =
    status === 'active'
      ? 'text-teal border-teal/30 bg-teal/[0.08]'
      : status === 'suspended'
      ? 'text-red-400 border-red-400/30 bg-red-400/[0.06]'
      : 'text-cream-faint border-line bg-cream/[0.025]';
  return (
    <span
      className={[
        'inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
        cls,
      ].join(' ')}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function agingFromNow(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms <= 0) return 'due now';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / (60 * 1000));
  return `${mins}m`;
}
