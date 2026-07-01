/**
 * Cockpit prospect-list print (Chat #142).
 *
 * Builds the BA's own prospect list as a brand-locked PDF — the printable
 * companion to the cockpit My Invites view. Pulls from the same read path
 * the cockpit uses (listInvitesForBA), so the print matches the screen and
 * stays sponsor-scoped: a BA can only ever print their own prospects
 * (locked-spec 3.5 — the tmagId comes from the session, never the request).
 *
 * Compliance (locked-spec 3.10): this is a .team BA-facing artifact. It
 * shows funnel status (draft/sent/opened/watched/callback/enrolled/expired)
 * and pool position — never income, never placement-equals-leg. Status is
 * progress, not earnings. Position is the monotonic queue number, which the
 * BA already sees on screen.
 */

import { listInvitesForBA } from './cockpit.js';
import { findBAByTmagId } from './ba.js';
import { buildPdfToBuffer, type TableColumn } from '../services/pdfReport.js';
import type { McsInviteSummary, McsInviteDisplayStatus } from '@momentum/shared';

/** Human-facing label for each display status (title-cased, print-friendly). */
const STATUS_LABEL: Record<McsInviteDisplayStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  opened: 'Opened',
  watched: 'Watched',
  callback: 'Callback',
  enrolled: 'Enrolled',
  expired: 'Expired',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // YYYY-MM-DD — compact, unambiguous, sorts naturally in a printed table.
  return d.toISOString().slice(0, 10);
}

export interface CockpitPrintResult {
  buffer: Buffer;
  generatedAt: string;
  sourceHash: string;
  /** Filename the route sets in Content-Disposition. */
  filename: string;
  prospectCount: number;
}

/**
 * Build the BA prospect-list PDF for one BA. Returns the buffer plus the
 * verifiability fields (timestamp + source hash) the route logs to audit.
 */
export async function buildCockpitProspectListPdf(tmagId: string): Promise<CockpitPrintResult> {
  const [ba, { invites }] = await Promise.all([
    findBAByTmagId(tmagId),
    listInvitesForBA(tmagId),
  ]);

  const baName = ba ? `${ba.firstName} ${ba.lastName}` : tmagId;
  // Newest first matches the cockpit's on-screen order (listInvitesForBA
  // already sorts by createdAt desc).
  const rows = invites;

  // Headline counts by status — a quick at-a-glance summary above the table.
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const columns: TableColumn<McsInviteSummary>[] = [
    { header: 'Prospect', width: 120, value: (r) => `${r.firstName} ${r.lastInitial}.` },
    { header: 'City / State', width: 120, value: (r) => `${r.city}, ${r.stateOrRegion}` },
    { header: 'Status', width: 70, value: (r) => STATUS_LABEL[r.status] },
    { header: 'Pos.', width: 45, value: (r) => (r.positionNumber != null ? `#${r.positionNumber}` : '—'), align: 'right' },
    { header: 'Sent', width: 66, value: (r) => fmtDate(r.sentAt), align: 'left' },
    { header: 'Invited', width: 66, value: (r) => fmtDate(r.createdAt), align: 'left' },
  ];

  const { buffer, generatedAt, sourceHash } = await buildPdfToBuffer(
    {
      title: 'My Prospects',
      subtitle: `${baName} · ${rows.length} prospect${rows.length === 1 ? '' : 's'}`,
      sourceData: rows,
    },
    (report) => {
      report.section('Summary');
      report.stat('Total prospects', String(rows.length));
      const order: McsInviteDisplayStatus[] = [
        'draft',
        'sent',
        'opened',
        'watched',
        'callback',
        'enrolled',
        'expired',
      ];
      for (const s of order) {
        if (counts[s]) report.stat(STATUS_LABEL[s], String(counts[s]));
      }

      report.section('Prospects');
      report.table(columns, rows, 'No prospects yet — send your first invitation from the cockpit.');
    },
  );

  const safeName = baName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const filename = `prospects-${safeName || tmagId}-${generatedAt.slice(0, 10)}.pdf`;

  return { buffer, generatedAt, sourceHash, filename, prospectCount: rows.length };
}
