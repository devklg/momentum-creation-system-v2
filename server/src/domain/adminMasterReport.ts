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
import { buildBaActivationReport } from './reports/baActivation.js';
import { buildTrainingReport } from './reports/trainingCompletion.js';
import { buildInviteFunnelReport } from './reports/inviteFunnel.js';
import { buildQueueVelocityReport } from './reports/queueVelocity.js';
import { buildEnrollmentReport } from './reports/enrollmentCompletion.js';
import { buildFollowUpReport } from './reports/followUpAging.js';
import { buildLeaderScorecardReport } from './reports/leaderScorecards.js';
import { resolveTimeRange } from './reports/timeRange.js';
import { buildPdfToBuffer } from '../services/pdfReport.js';
import type { AdminDashboardFilter, AdminDashboardMetrics } from '@momentum/shared';

const PROVENANCE_NOTE =
  'Scope note (Chat #143): This master report composites the Section B ' +
  'dashboard metrics and the full I.1 standard-report library this tranche ' +
  'builds (Reports 1–6 + 9: BA activation, training completion, invite-to-' +
  'presentation movement, queue velocity, enrollment completion, follow-up ' +
  'aging, leader scorecards). Reports 7 and 8 are intentionally not built ' +
  '(see decision dec_reporting_i1_scope).';

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

  // I.1 reports composited into the master (lifetime window for the snapshot).
  const lifetimeRange = resolveTimeRange({ preset: 'lifetime' });
  const activation = await buildBaActivationReport(filter, lifetimeRange);
  const training = await buildTrainingReport(filter, lifetimeRange);
  const inviteFunnel = await buildInviteFunnelReport(filter, lifetimeRange);
  const queueVelocity = await buildQueueVelocityReport(filter, lifetimeRange);
  const enrollment = await buildEnrollmentReport(filter, lifetimeRange);
  const followUp = await buildFollowUpReport(filter, lifetimeRange);
  const leaderScorecards = await buildLeaderScorecardReport(filter, lifetimeRange);

  const { buffer, generatedAt, sourceHash } = await buildPdfToBuffer(
    {
      title: 'Master Report',
      subtitle: `Team Magnificent · ${fmtFilterScope(filter)}`,
      provenanceNote: PROVENANCE_NOTE,
      // Hash over the exact metrics + applied filter + composited reports.
      sourceData: { filter, metrics, activation: activation.result, training: training.result, inviteFunnel: inviteFunnel.result, queueVelocity: queueVelocity.result, enrollment: enrollment.result, followUp: followUp.result, leaderScorecards: leaderScorecards.result },
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

      report.section('I.1 · BA Activation');
      report.stat('Signups in scope', String(activation.result.totals.signups));
      report.stat(
        'Reached first invite',
        String(activation.result.totals.reachedFirstInvite),
      );
      report.stat(
        'Reached first enrollment',
        String(activation.result.totals.reachedFirstEnrollment),
      );
      report.stat(
        'Median days signup -> first invite',
        activation.result.totals.medianDaysSignupToFirstInvite == null
          ? '—'
          : String(activation.result.totals.medianDaysSignupToFirstInvite),
      );
      if (activation.result.cohorts.length > 0) {
        report.paragraph('Signup cohorts:');
        for (const c of activation.result.cohorts) {
          report.stat(
            c.cohort,
            `${c.signups} signed · ${c.reachedFirstInvite} invited · ${c.reachedFirstEnrollment} enrolled`,
          );
        }
      }

      report.section('I.1 · Training Completion');
      report.stat('BAs in scope', String(training.result.totals.bas));
      report.stat(
        'Fast Start complete',
        training.result.totals.fastStartCompletePct == null
          ? `${training.result.totals.fastStartComplete}`
          : `${training.result.totals.fastStartComplete} (${training.result.totals.fastStartCompletePct}%)`,
      );
      report.stat('Orientation complete', String(training.result.totals.orientationComplete));
      report.stat(
        'Avg days signup -> Fast Start complete',
        training.result.totals.avgDaysSignupToFastStartComplete == null
          ? '—'
          : String(training.result.totals.avgDaysSignupToFastStartComplete),
      );
      for (const m of training.result.moduleCompletion) {
        report.stat(`Module ${m.moduleId} completed`, String(m.completed));
      }
      report.paragraph(training.result.provenanceNote, { size: 8 });

      report.section('I.1 · Invite → Presentation Movement');
      report.stat('Minted', String(inviteFunnel.result.totals.minted));
      report.stat('Clicked', String(inviteFunnel.result.totals.clicked));
      report.stat('Video started', String(inviteFunnel.result.totals.videoStarted));
      report.stat('Video complete', String(inviteFunnel.result.totals.videoComplete));
      report.stat('Mint -> click', inviteFunnel.result.totals.mintToClickPct == null ? '—' : `${inviteFunnel.result.totals.mintToClickPct}%`);
      report.stat('Click -> video start', inviteFunnel.result.totals.clickToVideoStartPct == null ? '—' : `${inviteFunnel.result.totals.clickToVideoStartPct}%`);
      report.stat('Video start -> complete', inviteFunnel.result.totals.videoStartToCompletePct == null ? '—' : `${inviteFunnel.result.totals.videoStartToCompletePct}%`);
      report.stat('Avg days mint -> click', inviteFunnel.result.totals.avgDaysMintToClick == null ? '—' : String(inviteFunnel.result.totals.avgDaysMintToClick));
      report.stat('Avg days click -> video complete', inviteFunnel.result.totals.avgDaysClickToVideoComplete == null ? '—' : String(inviteFunnel.result.totals.avgDaysClickToVideoComplete));
      report.paragraph(inviteFunnel.result.provenanceNote, { size: 8 });

      report.section('I.1 · Queue Velocity');
      report.stat('Placements (lifetime)', String(queueVelocity.result.totals.placements));
      report.stat('Flushes (lifetime)', String(queueVelocity.result.totals.flushes));
      report.stat('Enrollments (lifetime)', String(queueVelocity.result.totals.enrollments));
      report.stat('Net change (lifetime)', String(queueVelocity.result.totals.net));
      report.stat('Placements / day (last 7d)', queueVelocity.result.totals.placementsPerDay7d == null ? '—' : String(queueVelocity.result.totals.placementsPerDay7d));
      report.stat('Placements / day (last 30d)', queueVelocity.result.totals.placementsPerDay30d == null ? '—' : String(queueVelocity.result.totals.placementsPerDay30d));
      report.stat('Enrollments / day (last 7d)', queueVelocity.result.totals.enrollmentsPerDay7d == null ? '—' : String(queueVelocity.result.totals.enrollmentsPerDay7d));
      report.stat('Enrollments / day (last 30d)', queueVelocity.result.totals.enrollmentsPerDay30d == null ? '—' : String(queueVelocity.result.totals.enrollmentsPerDay30d));
      report.stat('Active days observed', String(queueVelocity.result.days.length));

      report.section('I.1 · Enrollment Completion');
      report.stat('Total enrollments', String(enrollment.result.totals.enrollments));
      report.stat('Enrolling BAs', String(enrollment.result.totals.enrollingBas));
      report.stat('Enrollments / day (last 7d)', enrollment.result.totals.perDayAvg7d == null ? '—' : String(enrollment.result.totals.perDayAvg7d));
      report.stat('Enrollments / day (last 30d)', enrollment.result.totals.perDayAvg30d == null ? '—' : String(enrollment.result.totals.perDayAvg30d));
      if (enrollment.result.perCohort.length > 0) {
        report.paragraph('BA signup cohort × enrollments:');
        for (const c of enrollment.result.perCohort) {
          report.stat(c.cohort, `${c.bas} BA(s) · ${c.enrollments} enrolled`);
        }
      }
      report.paragraph(
        'Renamed from spec\'s "Registration handoff completion" — enrollment ' +
        'is BA-to-BA off-app per locked-spec 3.6 / Chat #84; this counts what ' +
        'the system actually records (BA marking enrolled).',
        { size: 8 },
      );

      report.section('I.1 · Follow-Up Aging');
      report.stat('Open prospects (proxy)', String(followUp.result.totals.prospects));
      report.stat('Avg age (days)', followUp.result.totals.avgAgeDays == null ? '—' : String(followUp.result.totals.avgAgeDays));
      report.stat('Oldest (days)', followUp.result.totals.maxAgeDays == null ? '—' : String(followUp.result.totals.maxAgeDays));
      for (const b of followUp.result.buckets) {
        report.stat(`${b.bucket} days`, String(b.prospects));
      }
      report.paragraph(followUp.result.provenanceNote, { size: 8 });

      report.section('I.1 · Leader Scorecards (Kevin-only)');
      report.stat('Leaders detected', String(leaderScorecards.result.leaderCount));
      if (leaderScorecards.result.rows.length === 0) {
        report.paragraph(
          'No leaders to report. The leader set is empty by design until ' +
          'THREE binary-qualified + ≥5 personally-enrolled data mirrors in ' +
          '(Chat #100); no algorithmic heuristic is permitted.',
          { size: 9 },
        );
      } else {
        for (const r of leaderScorecards.result.rows) {
          report.stat(
            r.fullName,
            `personal=${r.personalEnrollments} · team enrolls 30d=${r.teamRecentEnrollments} · team placed 30d=${r.teamPlacementsLast30d} · team video 30d=${r.teamVideoCompletesLast30d}`,
          );
        }
      }
      report.paragraph(leaderScorecards.result.provenanceNote, { size: 8 });

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
