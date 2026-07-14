/**
 * P2-128 — one read-only aggregate admin bottleneck composition.
 *
 * Every section preserves the limits of its existing source authority. The
 * report never ranks people, infers outcomes, repairs data, or enables a
 * provider/worker.
 */
import {
  MCS_ADMIN_BOTTLENECKS_SCHEMA_VERSION,
  type McsAdminBottleneckCoverage,
  type McsAdminBottleneckReportResponse,
  type McsAdminCrmIntegrityReportResponse,
  type McsAdminDashboardFilter,
  type McsAdminEventCenterResponse,
  type McsAdminOperationsDashboardResponse,
  type McsAdminTrainingAnalytics,
  type McsInviteTokenRecord,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { buildCrmIntegrityReport } from './crmIntegrityReport.js';
import { buildAdminTrainingAnalytics } from './adminTrainingAnalytics.js';
import { getEventCenterForAdmin } from './eventCenter.js';
import { buildAdminOperationsDashboard } from './adminOperationsDashboard.js';

type Source<T> = { value: T; generatedAt: string } | null;

export interface AdminBottleneckProjectionSources {
  invitations: Source<McsInviteTokenRecord[]>;
  crm: Source<McsAdminCrmIntegrityReportResponse>;
  training: Source<McsAdminTrainingAnalytics>;
  events: Source<McsAdminEventCenterResponse>;
  delivery: Source<McsAdminOperationsDashboardResponse>;
  generatedAt: string;
}

const unavailableSummary = 'This source was unavailable when the aggregate snapshot was generated.';

const COVERAGE = {
  invitations: {
    mode: 'bounded_snapshot',
    note: 'Current token states only; this is not a historical conversion or performance score.',
    constraints: ['Maximum 200,000 invitation-token rows.'],
  },
  crm: {
    mode: 'bounded_snapshot',
    note: 'Report-only integrity scan over the oldest bounded records; elapsed time is not repair authority.',
    constraints: ['Maximum 500 CRM, follow-up, and prospect rows per source.'],
  },
  training: {
    mode: 'bounded_snapshot',
    note: 'Current five-module curriculum state only; effectiveness and outcomes are not measured.',
    constraints: ['Maximum 50,000 member rows and 50,000 progress rows.'],
  },
  events: {
    mode: 'current_window',
    note: 'Current Event Center operating window; attendance is explicit and never inferred.',
    constraints: [
      'Webinars are limited to the next 30 days and 100 events.',
      'Reservations are capped at 5,000, follow-ups at 10,000, and orientation scans are bounded.',
    ],
  },
  delivery: {
    mode: 'operations_subset',
    note: 'VM/RVM provider delivery plus projection and worker health; not a claim about every message channel.',
    constraints: ['VM operational reads are bounded at 200,000 rows.', 'Event reminders remain governed separately by P2-109.'],
  },
} as const satisfies Record<string, McsAdminBottleneckCoverage>;

function invitationSection(source: AdminBottleneckProjectionSources['invitations']) {
  const empty = {
    scanned: 0, sentUnopened: 0, openedNotStarted: 0, presentationInProgress: 0,
    presentationComplete: 0, enrolled: 0, expired: 0,
  };
  if (!source) return {
    status: 'unavailable' as const, sourceStatus: 'unavailable' as const,
    summary: unavailableSummary, sourceGeneratedAt: null, coverage: COVERAGE.invitations,
    currentStates: empty,
  };
  const currentStates = { ...empty, scanned: source.value.length };
  for (const token of source.value) {
    if (token.state === 'minted') currentStates.sentUnopened += 1;
    else if (token.state === 'clicked') currentStates.openedNotStarted += 1;
    else if (['video_started', 'video_quarter', 'video_half', 'video_three_quarter'].includes(token.state)) {
      currentStates.presentationInProgress += 1;
    } else if (token.state === 'video_complete') currentStates.presentationComplete += 1;
    else if (token.state === 'enrolled') currentStates.enrolled += 1;
    else if (token.state === 'expired') currentStates.expired += 1;
  }
  const attention = currentStates.expired > 0;
  return {
    status: attention ? 'attention' as const : currentStates.scanned > 0 ? 'observed' as const : 'clear' as const,
    sourceStatus: 'partial' as const,
    summary: attention
      ? 'Expired invitation states are present for human review; no contact or re-invite is automated.'
      : 'Current invitation lifecycle states are shown as aggregate observations.',
    sourceGeneratedAt: source.generatedAt, coverage: COVERAGE.invitations, currentStates,
  };
}

function crmSection(source: AdminBottleneckProjectionSources['crm']) {
  if (!source) return {
    status: 'unavailable' as const, sourceStatus: 'unavailable' as const,
    summary: unavailableSummary, sourceGeneratedAt: null, coverage: COVERAGE.crm,
    scanned: { crmRecords: 0, followUps: 0, prospects: 0 },
    findings: { stuck: 0, duplicate: 0, orphan: 0, inconsistent: 0, ambiguous: 0, total: 0, cleanupCandidates: 0 },
  };
  const totals = source.value.totals;
  const attention = totals.findings > 0 || totals.cleanupCandidates > 0;
  return {
    status: attention ? 'attention' as const : 'clear' as const,
    sourceStatus: 'partial' as const,
    summary: attention ? `${totals.findings} report-only integrity finding${totals.findings === 1 ? '' : 's'} require review.` : 'No findings were observed in the bounded CRM scan.',
    sourceGeneratedAt: source.generatedAt, coverage: COVERAGE.crm, scanned: source.value.scanned,
    findings: { stuck: totals.stuck, duplicate: totals.duplicate, orphan: totals.orphan,
      inconsistent: totals.inconsistent, ambiguous: totals.ambiguous, total: totals.findings,
      cleanupCandidates: totals.cleanupCandidates },
  };
}

function trainingSection(source: AdminBottleneckProjectionSources['training']) {
  if (!source) return {
    status: 'unavailable' as const, sourceStatus: 'unavailable' as const,
    summary: unavailableSummary, sourceGeneratedAt: null, coverage: COVERAGE.training,
    scopeBaCount: 0, programStates: { notStarted: 0, underway: 0, allModulesComplete: 0 },
    allModulesCompletionPct: null, dataQuality: { duplicateProgressRecords: 0, invalidProgressRecords: 0 },
  };
  const qualityCount = source.value.dataQuality.duplicateProgressRecordCount + source.value.dataQuality.invalidProgressRecordCount;
  return {
    status: qualityCount > 0 ? 'attention' as const : source.value.scopeBaCount > 0 ? 'observed' as const : 'clear' as const,
    sourceStatus: 'partial' as const,
    summary: qualityCount > 0 ? `${qualityCount} training data-quality record${qualityCount === 1 ? '' : 's'} require review.` : 'Curriculum states are aggregate observations; effectiveness is not measured.',
    sourceGeneratedAt: source.generatedAt, coverage: COVERAGE.training,
    scopeBaCount: source.value.scopeBaCount, programStates: source.value.programStateCounts,
    allModulesCompletionPct: source.value.allModulesCompletionPct,
    dataQuality: { duplicateProgressRecords: source.value.dataQuality.duplicateProgressRecordCount,
      invalidProgressRecords: source.value.dataQuality.invalidProgressRecordCount },
  };
}

function eventSection(source: AdminBottleneckProjectionSources['events']) {
  if (!source) return {
    status: 'unavailable' as const, sourceStatus: 'unavailable' as const,
    summary: unavailableSummary, sourceGeneratedAt: null, coverage: COVERAGE.events,
    events: { upcoming: 0, past: 0, cancelled: 0, fullUpcoming: 0 },
    attendance: { recorded: 0, missed: 0, missedWithoutActiveReminder: null },
    remindersNotConfigured: 0, governanceDependencies: [],
  };
  const value = source.value;
  const events = {
    upcoming: value.events.filter((event) => event.status === 'upcoming').length,
    past: value.events.filter((event) => event.status === 'past').length,
    cancelled: value.events.filter((event) => event.status === 'cancelled').length,
    fullUpcoming: value.events.filter((event) => event.status === 'upcoming' && event.registration.state === 'full').length,
  };
  const recorded = value.events.reduce((sum, event) => sum + event.attendance.counts.recorded, 0);
  const missed = value.events.reduce((sum, event) => sum + event.attendance.counts.missed, 0);
  const missedWithoutActiveReminder = value.dependencies.crm === 'available'
    ? value.webinarReservations.filter((row) => row.attendance === 'missed' && row.crmFollowUpDueAt === null).length
    : null;
  const remindersNotConfigured = value.events.filter((event) => event.reminders.status === 'not_configured').length;
  const governanceDependencies: string[] = [];
  if (remindersNotConfigured > 0) governanceDependencies.push('Event reminders remain not configured pending P2-109 governance decisions.');
  if (value.dependencies.attendance === 'unavailable') governanceDependencies.push('Attendance authority is unavailable.');
  if (value.dependencies.crm === 'unavailable') governanceDependencies.push('Human CRM reminder authority is unavailable.');
  const sourcesUnavailable = value.sources.orientation === 'unavailable' && value.sources.webinar === 'unavailable';
  const attention = events.fullUpcoming > 0 || (missedWithoutActiveReminder ?? 0) > 0;
  return {
    status: sourcesUnavailable ? 'unavailable' as const : attention ? 'attention' as const : value.events.length > 0 ? 'observed' as const : 'clear' as const,
    sourceStatus: sourcesUnavailable ? 'unavailable' as const : 'partial' as const,
    summary: sourcesUnavailable ? unavailableSummary : attention
      ? 'Explicit capacity or missed-attendance rows without an active reminder require human review; this does not prove follow-up was not completed.'
      : 'Event capacity, explicit attendance, reminder configuration, and active human reminders are shown from current authorities.',
    sourceGeneratedAt: source.generatedAt, coverage: COVERAGE.events, events,
    attendance: { recorded, missed, missedWithoutActiveReminder }, remindersNotConfigured, governanceDependencies,
  };
}

function deliverySection(source: AdminBottleneckProjectionSources['delivery']) {
  if (!source) return {
    status: 'unavailable' as const, sourceStatus: 'unavailable' as const,
    summary: unavailableSummary, sourceGeneratedAt: null, coverage: COVERAGE.delivery,
    operationalScope: 'vm_rvm_and_projection_health' as const, delivered24h: 0, failed24h: 0, providers: 0,
    projections: { pending: 0, due: 0, deadLettered: 0, oldestPendingAt: null }, stoppedWorkers: [], warningCount: 0,
  };
  const value = source.value;
  const deliveryWorkerKeys = new Set(['projection', 'vm_delivery', 'vm_webhook', 'broadcast']);
  const stoppedWorkers = value.workers.filter((worker) => deliveryWorkerKeys.has(worker.key) && worker.status === 'stopped').map((worker) => worker.label);
  const deliveryWarnings = value.warnings.filter((warning) => /delivery|provider|projection|outbox|webhook|broadcast/i.test(warning));
  const attention = value.delivery.failed24h > 0 || value.delivery.status === 'warning' || value.projections.due > 0 || value.projections.deadLettered > 0 || stoppedWorkers.length > 0 || deliveryWarnings.length > 0;
  return {
    status: attention ? 'attention' as const : value.delivery.status === 'not_configured' ? 'observed' as const : 'clear' as const,
    sourceStatus: 'partial' as const,
    summary: attention ? 'Explicit VM/RVM delivery failures, projection backlog, warnings, or stopped workers require review.'
      : value.delivery.status === 'not_configured' ? 'VM/RVM providers are not configured; this is an operating state, not a delivery failure.'
        : 'No explicit VM/RVM or projection failure condition was observed.',
    sourceGeneratedAt: source.generatedAt, coverage: COVERAGE.delivery,
    operationalScope: 'vm_rvm_and_projection_health' as const,
    delivered24h: value.delivery.delivered24h, failed24h: value.delivery.failed24h, providers: value.delivery.providers,
    projections: { pending: value.projections.pending, due: value.projections.due, deadLettered: value.projections.deadLettered, oldestPendingAt: value.projections.oldestPendingAt },
    stoppedWorkers, warningCount: deliveryWarnings.length,
  };
}

export function projectAdminBottleneckReport(sources: AdminBottleneckProjectionSources): McsAdminBottleneckReportResponse {
  const sections = { invitations: invitationSection(sources.invitations), crm: crmSection(sources.crm),
    training: trainingSection(sources.training), events: eventSection(sources.events), delivery: deliverySection(sources.delivery) };
  const entries = Object.entries(sections) as Array<[keyof typeof sections, (typeof sections)[keyof typeof sections]]>;
  return { ok: true, schemaVersion: MCS_ADMIN_BOTTLENECKS_SCHEMA_VERSION, generatedAt: sources.generatedAt,
    scope: 'team_aggregate_bounded', policy: 'aggregate_observations_only_no_ranking_or_scoring', sections,
    partialSources: entries.filter(([, section]) => section.sourceStatus === 'partial').map(([key]) => key),
    unavailableSources: entries.filter(([, section]) => section.sourceStatus === 'unavailable').map(([key]) => key) };
}

function fulfilled<T>(result: PromiseSettledResult<T>): T | null { return result.status === 'fulfilled' ? result.value : null; }

async function loadInvitationTokens(): Promise<McsInviteTokenRecord[]> {
  const result = await persistenceCall<{ documents?: McsInviteTokenRecord[] }>('mongodb', 'query', {
    database: 'momentum', collection: 'tmag_prospect_invite_tokens', filter: {}, limit: 200_000,
  });
  return result.documents ?? [];
}

export async function buildAdminBottleneckReport(): Promise<McsAdminBottleneckReportResponse> {
  const filter: McsAdminDashboardFilter = { tmagId: null, leaderGroup: 'all' };
  const [invitations, crm, training, events, delivery] = await Promise.allSettled([
    loadInvitationTokens(), buildCrmIntegrityReport(), buildAdminTrainingAnalytics(filter),
    getEventCenterForAdmin(), buildAdminOperationsDashboard(),
  ]);
  const invitationValue = fulfilled(invitations); const crmValue = fulfilled(crm);
  const trainingValue = fulfilled(training); const eventValue = fulfilled(events); const deliveryValue = fulfilled(delivery);
  const generatedAt = new Date().toISOString();
  return projectAdminBottleneckReport({
    invitations: invitationValue ? { value: invitationValue, generatedAt } : null,
    crm: crmValue ? { value: crmValue, generatedAt: crmValue.generatedAt } : null,
    training: trainingValue ? { value: trainingValue, generatedAt: trainingValue.computedAt } : null,
    events: eventValue ? { value: eventValue, generatedAt: eventValue.generatedAt } : null,
    delivery: deliveryValue ? { value: deliveryValue, generatedAt: deliveryValue.generatedAt } : null,
    generatedAt,
  });
}
