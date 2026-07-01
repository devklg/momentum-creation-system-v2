/**
 * ADMIN I.4/I.5 · CSV export for the seven I.1 reports (Chat #144).
 *
 * Pure serialization: given a resolved report result and a redaction
 * choice, return a CSV string + a flat data-row count for the audit log.
 *
 * The CSV is multi-section — each report has a totals/summary block plus
 * one or more sub-tables (cohorts, per-BA rows, per-day rows, etc.).
 * Sections are separated by a blank line and a section-header row, so
 * Excel and Google Sheets render them as a single sheet with visually
 * obvious section breaks. Numbers are emitted verbatim; nulls render as
 * empty cells; strings are CSV-escaped (quote when the cell contains
 * `"`, `,`, `\n`, or `\r`; embedded `"` doubled).
 *
 * Redaction: every data row passes through `applyRedaction` in
 * services/piiRedact.ts. The four PII fields (prospectFirstName,
 * prospectLastName, phone, email) are rewritten when redact=true; the
 * remaining fields (city, prospectId, tokenId, sponsorTmagId,
 * sponsorFullName, BA fullName) pass through verbatim per Chat #144.
 *
 * Filename convention: `<reportKey>-<UTC-timestamp>.csv` — the report
 * key is the AdminReportKey snake_case form so the filename and the
 * audit entry's `entity` field agree.
 */

import type {
  AdminActivationReport,
  AdminEnrollmentReport,
  AdminFollowUpReport,
  AdminInviteFunnelReport,
  AdminLeaderScorecardReport,
  AdminQueueVelocityReport,
  AdminReportKey,
  AdminReportMeta,
  AdminTrainingReport,
} from '@momentum/shared';
import { applyRedaction } from '../../services/piiRedact.js';

export interface ExportInput<R> {
  reportKey: AdminReportKey;
  result: R;
  meta: Omit<AdminReportMeta, 'reportKey'> | AdminReportMeta;
  redact: boolean;
}

export interface ExportOutput {
  csv: string;
  /** Count of data rows emitted (excludes section headers + blank lines). */
  rowCount: number;
  /** `<reportKey>-<UTC-timestamp>.csv` — drop straight into Content-Disposition. */
  filename: string;
}

/* ─── CSV primitives ─────────────────────────────────────────── */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: readonly unknown[]): string {
  return cells.map(escapeCell).join(',');
}

function timestampForFilename(iso: string): string {
  // Strip punctuation: 2026-05-27T14:00:00.000Z → 20260527T140000Z.
  return iso.replace(/[-:.]/g, '').replace(/(\d{8}T\d{6})\d*Z?/, '$1Z');
}

export function buildFilename(reportKey: AdminReportKey, generatedAt: string): string {
  return `${reportKey}-${timestampForFilename(generatedAt)}.csv`;
}

/* ─── Header block (every report) ────────────────────────────── */

function headerLines(reportKey: AdminReportKey, meta: ExportInput<unknown>['meta'], redact: boolean): string[] {
  const lines: string[] = [];
  lines.push(csvRow(['Report', reportKey]));
  lines.push(csvRow(['Generated at', meta.generatedAt]));
  lines.push(csvRow(['Range', meta.range.label]));
  if (meta.range.fromIso) lines.push(csvRow(['Range from', meta.range.fromIso]));
  lines.push(csvRow(['Range to', meta.range.toIso]));
  const filter = meta.appliedFilter;
  lines.push(csvRow(['Filter · BA', filter.tmagId ?? 'All BAs']));
  lines.push(csvRow(['Filter · Leader group', filter.leaderGroup ?? 'all']));
  lines.push(csvRow(['Source hash', meta.sourceHash]));
  lines.push(csvRow(['Redaction', redact ? 'redacted' : 'raw']));
  return lines;
}

function section(title: string, headerRow: readonly string[]): string[] {
  return ['', csvRow([`# ${title}`]), csvRow(headerRow)];
}

/** Emit `obj` as a single row in the order of `cols`, applying redaction. */
function emitRow<T extends Record<string, unknown>>(
  obj: T,
  cols: readonly (keyof T & string)[],
  redact: boolean,
): string {
  const redacted = applyRedaction(obj, redact);
  return csvRow(cols.map((c) => redacted[c]));
}

/* ─── 1 · BA activation ──────────────────────────────────────── */

function serializeActivation(
  result: AdminActivationReport,
  meta: ExportInput<unknown>['meta'],
  redact: boolean,
): { csv: string; rowCount: number } {
  const lines: string[] = headerLines('ba_activation', meta, redact);
  let rowCount = 0;

  lines.push(...section('Totals', ['metric', 'value']));
  lines.push(csvRow(['Signups', result.totals.signups]));
  lines.push(csvRow(['Reached first invite', result.totals.reachedFirstInvite]));
  lines.push(csvRow(['Reached first enrollment', result.totals.reachedFirstEnrollment]));
  lines.push(csvRow(['Median days signup → first invite', result.totals.medianDaysSignupToFirstInvite ?? '']));
  rowCount += 4;

  if (result.cohorts.length > 0) {
    lines.push(...section('Cohorts (by signup month)', [
      'cohort',
      'signups',
      'reachedWelcome',
      'reachedSteveDiscovery',
      'reachedFirstInvite',
      'reachedFirstVideoComplete',
      'reachedFirstEnrollment',
    ]));
    for (const c of result.cohorts) {
      lines.push(csvRow([c.cohort, c.signups, c.reachedWelcome, c.reachedSteveDiscovery, c.reachedFirstInvite, c.reachedFirstVideoComplete, c.reachedFirstEnrollment]));
      rowCount++;
    }
  }

  if (result.rows.length > 0) {
    const cols = [
      'tmagId',
      'fullName',
      'signupAt',
      'welcomeAcceptedAt',
      'steveDiscoveryCompletedAt',
      'firstInviteAt',
      'firstVideoCompleteAt',
      'firstEnrollmentAt',
      'daysSignupToFirstInvite',
    ] as const;
    lines.push(...section('Per-BA rows', cols));
    for (const r of result.rows) {
      lines.push(emitRow(r as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  return { csv: lines.join('\r\n') + '\r\n', rowCount };
}

/* ─── 2 · Training completion ────────────────────────────────── */

function serializeTraining(
  result: AdminTrainingReport,
  meta: ExportInput<unknown>['meta'],
  redact: boolean,
): { csv: string; rowCount: number } {
  const lines: string[] = headerLines('training_completion', meta, redact);
  let rowCount = 0;

  lines.push(...section('Totals', ['metric', 'value']));
  lines.push(csvRow(['BAs in scope', result.totals.bas]));
  lines.push(csvRow(['Fast Start complete', result.totals.fastStartComplete]));
  lines.push(csvRow(['Fast Start complete %', result.totals.fastStartCompletePct ?? '']));
  lines.push(csvRow(['Orientation complete', result.totals.orientationComplete]));
  lines.push(csvRow(['Avg days signup → Fast Start complete', result.totals.avgDaysSignupToFastStartComplete ?? '']));
  rowCount += 5;

  lines.push(...section('Module completion', ['moduleId', 'completed']));
  for (const m of result.moduleCompletion) {
    lines.push(csvRow([m.moduleId, m.completed]));
    rowCount++;
  }

  if (result.rows.length > 0) {
    const cols = [
      'tmagId',
      'fullName',
      'signupAt',
      'modulesCompleted',
      'fastStartComplete',
      'fastStartCompletedAt',
      'orientationCompletedAt',
      'daysSignupToFastStartComplete',
    ] as const;
    lines.push(...section('Per-BA rows', cols));
    for (const r of result.rows) {
      lines.push(emitRow(r as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  lines.push('', csvRow(['# Provenance']), csvRow([result.provenanceNote]));

  return { csv: lines.join('\r\n') + '\r\n', rowCount };
}

/* ─── 3 · Invite-to-presentation movement ────────────────────── */

function serializeInviteFunnel(
  result: AdminInviteFunnelReport,
  meta: ExportInput<unknown>['meta'],
  redact: boolean,
): { csv: string; rowCount: number } {
  const lines: string[] = headerLines('invite_to_presentation', meta, redact);
  let rowCount = 0;

  lines.push(...section('Totals', ['metric', 'value']));
  lines.push(csvRow(['Minted', result.totals.minted]));
  lines.push(csvRow(['Clicked', result.totals.clicked]));
  lines.push(csvRow(['Video started', result.totals.videoStarted]));
  lines.push(csvRow(['Video complete', result.totals.videoComplete]));
  lines.push(csvRow(['Mint → click %', result.totals.mintToClickPct ?? '']));
  lines.push(csvRow(['Click → video-start %', result.totals.clickToVideoStartPct ?? '']));
  lines.push(csvRow(['Video-start → complete %', result.totals.videoStartToCompletePct ?? '']));
  lines.push(csvRow(['Avg days mint → click', result.totals.avgDaysMintToClick ?? '']));
  lines.push(csvRow(['Avg days click → video-complete', result.totals.avgDaysClickToVideoComplete ?? '']));
  rowCount += 9;

  lines.push(...section('Stages', ['stage', 'tokens', 'conversionFromMint']));
  for (const s of result.stages) {
    lines.push(csvRow([s.stage, s.tokens, s.conversionFromMint ?? '']));
    rowCount++;
  }

  if (result.perBa.length > 0) {
    const cols = [
      'tmagId',
      'fullName',
      'minted',
      'clicked',
      'videoStarted',
      'videoComplete',
      'mintToCompletePct',
    ] as const;
    lines.push(...section(`Per-BA (sorted by ${result.perBaSort})`, cols));
    for (const r of result.perBa) {
      lines.push(emitRow(r as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  lines.push('', csvRow(['# Provenance']), csvRow([result.provenanceNote]));

  return { csv: lines.join('\r\n') + '\r\n', rowCount };
}

/* ─── 4 · Queue velocity ─────────────────────────────────────── */

function serializeQueueVelocity(
  result: AdminQueueVelocityReport,
  meta: ExportInput<unknown>['meta'],
  redact: boolean,
): { csv: string; rowCount: number } {
  const lines: string[] = headerLines('queue_velocity', meta, redact);
  let rowCount = 0;

  lines.push(...section('Totals', ['metric', 'value']));
  lines.push(csvRow(['Placements', result.totals.placements]));
  lines.push(csvRow(['Flushes', result.totals.flushes]));
  lines.push(csvRow(['Enrollments', result.totals.enrollments]));
  lines.push(csvRow(['Net (placements − flushes)', result.totals.net]));
  lines.push(csvRow(['Placements/day (7d)', result.totals.placementsPerDay7d ?? '']));
  lines.push(csvRow(['Placements/day (30d)', result.totals.placementsPerDay30d ?? '']));
  lines.push(csvRow(['Enrollments/day (7d)', result.totals.enrollmentsPerDay7d ?? '']));
  lines.push(csvRow(['Enrollments/day (30d)', result.totals.enrollmentsPerDay30d ?? '']));
  rowCount += 8;

  if (result.days.length > 0) {
    const cols = ['date', 'placements', 'flushes', 'enrollments', 'net'] as const;
    lines.push(...section('Daily', cols));
    for (const d of result.days) {
      lines.push(emitRow(d as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  return { csv: lines.join('\r\n') + '\r\n', rowCount };
}

/* ─── 5 · Enrollment completion ──────────────────────────────── */

function serializeEnrollment(
  result: AdminEnrollmentReport,
  meta: ExportInput<unknown>['meta'],
  redact: boolean,
): { csv: string; rowCount: number } {
  const lines: string[] = headerLines('enrollment_completion', meta, redact);
  let rowCount = 0;

  lines.push(...section('Totals', ['metric', 'value']));
  lines.push(csvRow(['Enrollments', result.totals.enrollments]));
  lines.push(csvRow(['Enrolling BAs', result.totals.enrollingBas]));
  lines.push(csvRow(['Per-day avg (7d)', result.totals.perDayAvg7d ?? '']));
  lines.push(csvRow(['Per-day avg (30d)', result.totals.perDayAvg30d ?? '']));
  rowCount += 4;

  if (result.perBa.length > 0) {
    const cols = ['tmagId', 'fullName', 'enrollments'] as const;
    lines.push(...section('Per-BA', cols));
    for (const r of result.perBa) {
      lines.push(emitRow(r as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  if (result.perDay.length > 0) {
    const cols = ['date', 'enrollments'] as const;
    lines.push(...section('Per-day', cols));
    for (const r of result.perDay) {
      lines.push(emitRow(r as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  if (result.perCohort.length > 0) {
    const cols = ['cohort', 'bas', 'enrollments'] as const;
    lines.push(...section('Per-cohort (BA signup month)', cols));
    for (const r of result.perCohort) {
      lines.push(emitRow(r as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  return { csv: lines.join('\r\n') + '\r\n', rowCount };
}

/* ─── 6 · Follow-up aging ────────────────────────────────────── */

function serializeFollowUp(
  result: AdminFollowUpReport,
  meta: ExportInput<unknown>['meta'],
  redact: boolean,
): { csv: string; rowCount: number } {
  const lines: string[] = headerLines('follow_up_aging', meta, redact);
  let rowCount = 0;

  lines.push(...section('Totals', ['metric', 'value']));
  lines.push(csvRow(['Prospects', result.totals.prospects]));
  lines.push(csvRow(['Avg age (days)', result.totals.avgAgeDays ?? '']));
  lines.push(csvRow(['Max age (days)', result.totals.maxAgeDays ?? '']));
  rowCount += 3;

  lines.push(...section('Buckets', ['bucket', 'prospects']));
  for (const b of result.buckets) {
    lines.push(csvRow([b.bucket, b.prospects]));
    rowCount++;
  }

  if (result.rows.length > 0) {
    const cols = [
      'prospectId',
      'sponsorTmagId',
      'disposition',
      'lastUpdatedAt',
      'ageDays',
      'bucket',
    ] as const;
    lines.push(...section('Per-prospect (sorted oldest first)', cols));
    for (const r of result.rows) {
      lines.push(emitRow(r as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  lines.push('', csvRow(['# Provenance']), csvRow([result.provenanceNote]));

  return { csv: lines.join('\r\n') + '\r\n', rowCount };
}

/* ─── 9 · Leader scorecards ──────────────────────────────────── */

function serializeLeaderScorecards(
  result: AdminLeaderScorecardReport,
  meta: ExportInput<unknown>['meta'],
  redact: boolean,
): { csv: string; rowCount: number } {
  const lines: string[] = headerLines('leader_scorecards', meta, redact);
  let rowCount = 0;

  lines.push(...section('Totals', ['metric', 'value']));
  lines.push(csvRow(['Leader count', result.leaderCount]));
  rowCount += 1;

  if (result.rows.length > 0) {
    const cols = [
      'tmagId',
      'fullName',
      'signupAt',
      'personalEnrollments',
      'teamRecentEnrollments',
      'teamPlacementsLast30d',
      'teamVideoCompletesLast30d',
    ] as const;
    lines.push(...section('Per-leader', cols));
    for (const r of result.rows) {
      lines.push(emitRow(r as unknown as Record<string, unknown>, cols as readonly string[], redact));
      rowCount++;
    }
  }

  lines.push('', csvRow(['# Provenance']), csvRow([result.provenanceNote]));

  return { csv: lines.join('\r\n') + '\r\n', rowCount };
}

/* ─── Public surface — one entry point per report ─────────────── */

export function exportBaActivation(
  input: ExportInput<AdminActivationReport>,
): ExportOutput {
  const { csv, rowCount } = serializeActivation(input.result, input.meta, input.redact);
  return { csv, rowCount, filename: buildFilename('ba_activation', input.meta.generatedAt) };
}

export function exportTraining(
  input: ExportInput<AdminTrainingReport>,
): ExportOutput {
  const { csv, rowCount } = serializeTraining(input.result, input.meta, input.redact);
  return { csv, rowCount, filename: buildFilename('training_completion', input.meta.generatedAt) };
}

export function exportInviteFunnel(
  input: ExportInput<AdminInviteFunnelReport>,
): ExportOutput {
  const { csv, rowCount } = serializeInviteFunnel(input.result, input.meta, input.redact);
  return { csv, rowCount, filename: buildFilename('invite_to_presentation', input.meta.generatedAt) };
}

export function exportQueueVelocity(
  input: ExportInput<AdminQueueVelocityReport>,
): ExportOutput {
  const { csv, rowCount } = serializeQueueVelocity(input.result, input.meta, input.redact);
  return { csv, rowCount, filename: buildFilename('queue_velocity', input.meta.generatedAt) };
}

export function exportEnrollment(
  input: ExportInput<AdminEnrollmentReport>,
): ExportOutput {
  const { csv, rowCount } = serializeEnrollment(input.result, input.meta, input.redact);
  return { csv, rowCount, filename: buildFilename('enrollment_completion', input.meta.generatedAt) };
}

export function exportFollowUp(
  input: ExportInput<AdminFollowUpReport>,
): ExportOutput {
  const { csv, rowCount } = serializeFollowUp(input.result, input.meta, input.redact);
  return { csv, rowCount, filename: buildFilename('follow_up_aging', input.meta.generatedAt) };
}

export function exportLeaderScorecards(
  input: ExportInput<AdminLeaderScorecardReport>,
): ExportOutput {
  const { csv, rowCount } = serializeLeaderScorecards(input.result, input.meta, input.redact);
  return { csv, rowCount, filename: buildFilename('leader_scorecards', input.meta.generatedAt) };
}
