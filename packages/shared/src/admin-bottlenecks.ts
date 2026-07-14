export const MCS_ADMIN_BOTTLENECKS_SCHEMA_VERSION = 'admin_bottlenecks.v1' as const;

export type McsAdminBottleneckStatus = 'clear' | 'observed' | 'attention' | 'unavailable';
export type McsAdminBottleneckSourceStatus = 'partial' | 'unavailable';
export type McsAdminBottleneckSectionKey =
  | 'invitations'
  | 'crm'
  | 'training'
  | 'events'
  | 'delivery';

export interface McsAdminBottleneckCoverage {
  mode: 'bounded_snapshot' | 'current_window' | 'operations_subset';
  note: string;
  constraints: string[];
}

export interface McsAdminBottleneckSectionBase {
  status: McsAdminBottleneckStatus;
  sourceStatus: McsAdminBottleneckSourceStatus;
  summary: string;
  sourceGeneratedAt: string | null;
  coverage: McsAdminBottleneckCoverage;
}

export interface McsAdminInvitationBottleneckSection extends McsAdminBottleneckSectionBase {
  currentStates: {
    scanned: number;
    sentUnopened: number;
    openedNotStarted: number;
    presentationInProgress: number;
    presentationComplete: number;
    enrolled: number;
    expired: number;
  };
}

export interface McsAdminCrmBottleneckSection extends McsAdminBottleneckSectionBase {
  scanned: { crmRecords: number; followUps: number; prospects: number };
  findings: {
    stuck: number;
    duplicate: number;
    orphan: number;
    inconsistent: number;
    ambiguous: number;
    total: number;
    cleanupCandidates: number;
  };
}

export interface McsAdminTrainingBottleneckSection extends McsAdminBottleneckSectionBase {
  scopeBaCount: number;
  programStates: { notStarted: number; underway: number; allModulesComplete: number };
  allModulesCompletionPct: number | null;
  dataQuality: { duplicateProgressRecords: number; invalidProgressRecords: number };
}

export interface McsAdminEventBottleneckSection extends McsAdminBottleneckSectionBase {
  events: { upcoming: number; past: number; cancelled: number; fullUpcoming: number };
  attendance: {
    recorded: number;
    missed: number;
    missedWithoutActiveReminder: number | null;
  };
  remindersNotConfigured: number;
  governanceDependencies: string[];
}

export interface McsAdminDeliveryBottleneckSection extends McsAdminBottleneckSectionBase {
  operationalScope: 'vm_rvm_and_projection_health';
  delivered24h: number;
  failed24h: number;
  providers: number;
  projections: { pending: number; due: number; deadLettered: number; oldestPendingAt: string | null };
  stoppedWorkers: string[];
  warningCount: number;
}

export interface McsAdminBottleneckReportResponse {
  ok: true;
  schemaVersion: typeof MCS_ADMIN_BOTTLENECKS_SCHEMA_VERSION;
  generatedAt: string;
  scope: 'team_aggregate_bounded';
  policy: 'aggregate_observations_only_no_ranking_or_scoring';
  sections: {
    invitations: McsAdminInvitationBottleneckSection;
    crm: McsAdminCrmBottleneckSection;
    training: McsAdminTrainingBottleneckSection;
    events: McsAdminEventBottleneckSection;
    delivery: McsAdminDeliveryBottleneckSection;
  };
  partialSources: McsAdminBottleneckSectionKey[];
  unavailableSources: McsAdminBottleneckSectionKey[];
}
