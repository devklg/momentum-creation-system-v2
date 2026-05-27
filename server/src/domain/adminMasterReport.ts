/**
 * ADMIN I.3 — Print Master Report (Chat #142).
 *
 * Locked spec (ADMIN Design I.3): a print-friendly composite of every
 * standard report for a chosen time range, rendered as a single brand-locked
 * PDF, with a generation timestamp and a hash of the source data so the
 * report can be verified later.
 *
 * HONEST SCOPE NOTE (Kevin decision, Chat #142): I.3 is spec'd as a composite
 * of the I.1 standard-report library — but I.1 is not built yet. Rather than
 * silently redefine I.3 to mean "the dashboard metrics," this report:
 *   (a) composites the data that genuinely exists today — the Section B
 *       dashboard metrics (computeAdminDashboardMetrics) — and
 *   (b) prints an explicit provenance line stating exactly what it currently
 *       composites and that the full I.1 library is pending.
 * So a filed/shared snapshot can never be mistaken for the finished master
 * report. As each I.1 report lands, it gets appended as a new section here;
 * the provenance line shrinks accordingly. This keeps faith with the locked
 * spec (Part 6 — no drift) while delivering a usable artifact now.
 *
 * Compliance: /admin-only surface (Kevin via ADMIN_BA_IDS). Aggregate
 * operational metrics, no prospect/BA scoring, no income ranking (ADMIN I.5).
 */

import {
  computeAdminDashboardMetrics,
  LEADER_DETECTION_NOTE,
} from './adminMetrics.js';
import { buildPdfToBuffer } from '../services/pdfReport.js';
import type { AdminDashboardFilter, AdminDashboardMetrics } from '@momentum/shared';

const PROVENANCE_NOTE =
  'Scope note (Chat #142): This master report currently composites the ' +
  'Section B dashboard metrics only. The full I.1 standard-report library ' +
  '(activation, training, invite-to-presentation, queue velocity, follow-up ' +
  'aging, compliance counts, exception dashboard, leader scorecards) is not ' +
  'yet built; each report will be appended here as it lands.';

function fmtFilterScope(filter: AdminDashboardFilter): string {
  const parts: string[] = [];
  parts.push(filter.baId ? `BA: ${filter.baId}` : 'All BAs');
  const lg = filter.leaderGroup;
  if (lg && lg !== 'all') {
    parts.push(lg === 'leaders_only' ? 'Leaders only' : 'Non-leaders');
  }
  return parts.join(' · ');
}

export interface MasterReportResult {
  buffer: Buffer;
  generatedAt: string;
  sourceHash: string;
  filename: string;
}

/**
 * Build the I.3 master report PDF for the given filter. Returns the buffer
 * plus verifiability fields (timestamp + source hash) for the audit entry.
 */
export async function buildMasterReportPdf(
  filter: AdminDashboardFilter,
): Promise<MasterReportResult> {
  const metrics: AdminDashboardMetrics = await computeAdminDashboardMetrics(filter);

  const { buffer, generatedAt, sourceHash } = await buildPdfToBuffer(
    {
      title: 'Master Report',
      subtitle: `Team Magnificent · ${fmtFilterScope(filter)}`,
      provenanceNote: PROVENANCE_NOTE,
      // Hash over the exact metrics + applied filter rendered.
      sourceData: { filter, metrics },
    },
    (report) => {
      report.section('Dashboard Metrics (Section B)');
      report.stat('Active BAs (last 24h)', String(metrics.activeBaCount));
      report.stat('Total BAs', String(metrics.totalBaCount));
      report.stat('Prospects in flow', String(metrics.prospectsInFlow));
      report.stat(
        'Queue movement (24h)',
        `+${metrics.queueMovement24h.placements} placed · ` +
          `-${metrics.queueMovement24h.flushes} flushed · ` +
          `net ${metrics.queueMovement24h.net >= 0 ? '+' : ''}${metrics.queueMovement24h.net}`,
      );
      report.stat('Enrollments (24h)', String(metrics.enrollments24h));
      report.stat(
        'Fast Start completion',
        metrics.trainingCompletionPct == null ? '—' : `${metrics.trainingCompletionPct}%`,
      );
      report.stat('Metrics computed at', metrics.computedAt);

      report.section('Notes');
      report.paragraph(`Leader detection: ${LEADER_DETECTION_NOTE}`);
      report.paragraph(
        'Verification: the SHA-256 hash in the footer is computed over the ' +
          'applied filter and the metrics snapshot above. Re-running this ' +
          'report against unchanged data reproduces the same hash.',
      );
    },
  );

  const scope = filter.baId ? `-${filter.baId}` : '-all';
  const filename = `master-report${scope}-${generatedAt.slice(0, 10)}.pdf`;

  return { buffer, generatedAt, sourceHash, filename };
}
