import { describe, expect, it } from 'vitest';
import type {
  McsAdminCrmIntegrityReportResponse,
  McsAdminEventCenterResponse,
  McsAdminOperationsDashboardResponse,
  McsAdminTrainingAnalytics,
  McsInviteTokenRecord,
} from '@momentum/shared';
import { projectAdminBottleneckReport } from '../adminBottlenecks.js';

const at = '2026-07-14T04:00:00.000Z';

function sources() {
  const invitations = [
    'minted', 'clicked', 'video_started', 'video_quarter', 'video_half',
    'video_three_quarter', 'video_complete', 'enrolled', 'expired',
  ].map((state, index) => ({
    token: `token-${index}`, prospectId: `prospect-${index}`, sponsorTmagId: 'TMBA-FOUNDER',
    state, createdAt: at, clickedAt: state === 'minted' ? null : at, expiresAt: at,
  })) as McsInviteTokenRecord[];
  const crm = {
    ok: true, generatedAt: at, policy: 'report_only', stuckDays: 30,
    scanned: { crmRecords: 2, followUps: 1, prospects: 2 },
    totals: { stuck: 1, duplicate: 0, orphan: 0, inconsistent: 0, ambiguous: 0, findings: 1, cleanupCandidates: 0 },
    cleanupPreview: { dryRun: true, planned: 0, actions: [], errors: [] }, findings: [],
  } as unknown as McsAdminCrmIntegrityReportResponse;
  const training = {
    computedAt: at, sourceAuthority: 'tmag_fast_start_progress',
    policy: { people: 'aggregate_only_no_ranking_or_scoring', effectiveness: 'not_measured' },
    scopeBaCount: 3, programStateCounts: { notStarted: 1, underway: 1, allModulesComplete: 1 },
    allModulesCompletionPct: 33, modules: [],
    dataQuality: { duplicateProgressRecordCount: 0, invalidProgressRecordCount: 0 },
  } as McsAdminTrainingAnalytics;
  const events = {
    ok: true, generatedAt: at, sources: { orientation: 'available', webinar: 'available' },
    dependencies: { attendance: 'available', crm: 'available' },
    events: [{
      eventId: 'webinar:event-1', sourceId: 'event-1', eventType: 'prospect_webinar',
      visibility: { team: 'authenticated', admin: 'founder_admin', prospect: 'invitation_token_only' },
      scheduledFor: at, hosts: ['Kevin'], durationMinutes: 30, status: 'upcoming',
      capacity: { mode: 'unlimited', limit: null, reserved: 3, remaining: null },
      registration: { owner: 'prospect_webinar', mode: 'prospect_invitation_token', state: 'invitation_required' },
      reminders: { owner: 'source_domain', status: 'not_configured', channels: [] },
      attendance: { state: 'recorded', recordedAt: at, inferred: false,
        counts: { recorded: 3, attended: 1, missed: 1, rescheduled: 1 } },
      followUp: { owner: 'human_crm', connection: 'available', automated: false, connectedCount: 2 },
    }],
    orientationSessions: [], webinarEvents: [],
    webinarReservations: [
      { reservationId: 'attended', eventId: 'event-1', prospectId: 'p1', sponsorTmagId: 'TMBA-FOUNDER', name: 'A', createdAt: at, attendance: 'attended', attendanceRecordedAt: at, crmFollowUpDueAt: at },
      { reservationId: 'missed', eventId: 'event-1', prospectId: 'p2', sponsorTmagId: 'TMBA-FOUNDER', name: 'B', createdAt: at, attendance: 'missed', attendanceRecordedAt: at, crmFollowUpDueAt: null },
      { reservationId: 'rescheduled', eventId: 'event-1', prospectId: 'p3', sponsorTmagId: 'TMBA-FOUNDER', name: 'C', createdAt: at, attendance: 'rescheduled', attendanceRecordedAt: at, crmFollowUpDueAt: at },
    ],
  } as unknown as McsAdminEventCenterResponse;
  const delivery = {
    ok: true, generatedAt: at, workers: [],
    persistence: { status: 'healthy', checkedAt: at, detail: 'ok' },
    delivery: { status: 'not_configured', delivered24h: 0, failed24h: 0, providers: 0 },
    projections: { pending: 2, due: 0, scheduled: 0, deadLettered: 0, attempts: 0, oldestPendingAt: at },
    knowledge: { status: 'ready', sources: 1, chunks: 1, pendingProjections: 0, detail: 'ok' }, warnings: [],
  } as McsAdminOperationsDashboardResponse;
  return {
    invitations: { value: invitations, generatedAt: at }, crm: { value: crm, generatedAt: at },
    training: { value: training, generatedAt: at }, events: { value: events, generatedAt: at },
    delivery: { value: delivery, generatedAt: at }, generatedAt: at,
  };
}

describe('P2-128 admin bottleneck projection', () => {
  it('keeps full invitation lifecycle states as current aggregate observations', () => {
    const report = projectAdminBottleneckReport(sources());
    expect(report.sections.invitations.currentStates).toEqual({
      scanned: 9, sentUnopened: 1, openedNotStarted: 1, presentationInProgress: 4,
      presentationComplete: 1, enrolled: 1, expired: 1,
    });
    expect(report.sections.invitations.coverage.mode).toBe('bounded_snapshot');
  });

  it('correlates missed attendance with its own active reminder instead of all follow-ups', () => {
    const report = projectAdminBottleneckReport(sources());
    expect(report.sections.events.attendance).toMatchObject({ missed: 1, missedWithoutActiveReminder: 1 });
  });

  it('does not synthesize missed-reminder truth when CRM authority is unavailable', () => {
    const input = sources();
    input.events.value.dependencies.crm = 'unavailable';
    const report = projectAdminBottleneckReport(input);
    expect(report.sections.events.attendance.missedWithoutActiveReminder).toBeNull();
    expect(report.sections.events.governanceDependencies).toContain('Human CRM reminder authority is unavailable.');
  });

  it('labels every available source as bounded or partial rather than exhaustive', () => {
    const report = projectAdminBottleneckReport(sources());
    expect(report.scope).toBe('team_aggregate_bounded');
    expect(report.partialSources).toEqual(['invitations', 'crm', 'training', 'events', 'delivery']);
    expect(report.unavailableSources).toEqual([]);
  });

  it('fails soft by exposing unavailable sources without person-level output', () => {
    const report = projectAdminBottleneckReport({
      invitations: null, crm: null, training: null, events: null, delivery: null, generatedAt: at,
    });
    expect(report.unavailableSources).toEqual(['invitations', 'crm', 'training', 'events', 'delivery']);
    const keys = JSON.stringify(report, (key, value) => {
      expect(key).not.toMatch(/prospectId|tmagId|fullName|personRows|perBa/i);
      return value;
    });
    expect(keys).not.toContain('leader-scorecards');
  });

  it('treats not-configured delivery as an observed operating state, not a failure', () => {
    const report = projectAdminBottleneckReport(sources());
    expect(report.sections.delivery.status).toBe('observed');
    expect(report.sections.delivery.summary).toContain('not configured');
    expect(report.sections.delivery.projections.pending).toBe(2);
  });

  it('surfaces VM source warnings and stopped delivery workers as attention', () => {
    const input = sources();
    input.delivery.value.warnings = ['tmag_vm_campaigns unavailable; analytics using empty set.'];
    input.delivery.value.workers = [{ key: 'vm_delivery', label: 'VM delivery', status: 'stopped', detail: 'never' }];
    const report = projectAdminBottleneckReport(input);
    expect(report.sections.delivery.status).toBe('attention');
    expect(report.sections.delivery.warningCount).toBe(1);
    expect(report.sections.delivery.stoppedWorkers).toEqual(['VM delivery']);
  });
});
