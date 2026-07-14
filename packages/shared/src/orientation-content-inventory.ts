export const MCS_ORIENTATION_CONTENT_INVENTORY_VERSION = 'orientation_content_inventory.v1' as const;

export interface McsCurrentOrientationCurriculumStep {
  id: `orientation_step_${string}`;
  sequence: number;
  displayNumber: string;
  title: string;
  sourceBlocks: readonly ['description', 'host_insight'];
}

export const MCS_CURRENT_ORIENTATION_CURRICULUM_STEPS: readonly McsCurrentOrientationCurriculumStep[] = [
  { id: 'orientation_step_01', sequence: 1, displayNumber: '01', title: 'Create an Emotional Barrier of Exit', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_02', sequence: 2, displayNumber: '02', title: 'Place an Appropriate Initial Order', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_03', sequence: 3, displayNumber: '03', title: 'Pay Your Overhead', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_04', sequence: 4, displayNumber: '04', title: 'Review Back Office Daily', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_05', sequence: 5, displayNumber: '05', title: 'Build Belief', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_06', sequence: 6, displayNumber: '06', title: 'Create Your Candidate List', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_07', sequence: 7, displayNumber: '07', title: 'Master the Art of Invitation', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_08', sequence: 8, displayNumber: '08', title: 'Learn How to Present', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_09', sequence: 9, displayNumber: '09', title: 'Winning the Race to Profitability', sourceBlocks: ['description', 'host_insight'] },
  { id: 'orientation_step_10', sequence: 10, displayNumber: '10', title: 'Take MASSIVE Action', sourceBlocks: ['description', 'host_insight'] },
] as const;

/**
 * P2-117 inventory of the participant-facing orientation content that exists
 * today. This is a source projection, not approval for new curriculum and not
 * an attendance or completion record.
 */
export const MCS_CURRENT_ORIENTATION_CONTENT_INVENTORY = {
  schemaVersion: MCS_ORIENTATION_CONTENT_INVENTORY_VERSION,
  scope: 'current_implemented_participant_facing_orientation_content',
  curriculum: {
    id: 'ten_step_orientation',
    status: 'implemented',
    authorityRef: 'docs/locked-spec.md#45-10-step-orientation-curriculum--the-new-bas-blueprint',
    sourcePath: 'apps/team/src/routes/training/10-steps.tsx',
    teamRoute: '/training/10-steps',
    contextTag: 'context:training:10-steps',
    delivery: 'live_founder_or_leader_hosted_group_session',
    selfPaced: false,
    pageRoles: ['live_session_visual_aid', 'permanent_reference'],
    complianceSurface: 'team_only',
    accessControl: {
      routeContainer: 'TeamShell',
      authenticationEnforcement: 'not_evidenced',
    },
    languageAvailability: { en: 'implemented', es: 'missing' },
    contentVersionAuthority: null,
    sessionCurriculumBinding: null,
    steps: MCS_CURRENT_ORIENTATION_CURRICULUM_STEPS,
    supportingBlocks: [
      { id: 'hero', sourceAnchor: '<span className="block">10 Steps to</span>' },
      { id: 'context_resources', sourceAnchor: '<ContextResources contextTag="context:training:10-steps" />' },
      { id: 'pmvc_mantra', sourceAnchor: '<MantraItem word="People" sub="Build the team" />' },
      { id: 'training_disclaimer', sourceAnchor: 'For Training Purposes Only · Not a guarantee of income' },
    ],
    contextResources: {
      role: 'optional_approved_extension',
      contentAuthority: 'active_approved_resource_catalog_entries',
      affectsCurriculumSequence: false,
      provesAttendanceOrCompletion: false,
    },
  },
  operations: {
    currentRuntime: 'live_group_session_scheduler',
    stateContract: 'orientation_state.v1',
    sessionAuthority: 'tmag_new_member_orientation_sessions',
    reservationAuthority: 'tmag_new_member_orientation_reservations',
    attendanceAuthority: null,
    completionAuthority: null,
    reservationProvesAttendance: false,
    elapsedSessionProvesAttendance: false,
    completionInferred: false,
  },
  futureTarget: {
    sourcePath: 'ORIENTATION_ARCHITECTURE.md',
    architecture: 'stage_0_through_stage_10',
    status: 'planned_not_current_runtime',
    stageRecordsImplemented: false,
    attendanceCaptureImplemented: false,
    completionRecordImplemented: false,
    nextStepSelectionImplemented: false,
    launchTransitionWritesImplemented: false,
  },
  boundaries: {
    inventoryIsProjectionNotContentAuthority: true,
    notFastStartModule: true,
    noModuleProgressAuthority: true,
    prospectSurfaceUseProhibited: true,
    noPersonScoringRankingOrClassification: true,
    historicalPlaceholderIsSupersededByLockedSpecChat99: true,
    legacyOnboardingHtmlIsNotCurrentImplementation: true,
    hostDeliveryEvidenceAuthority: null,
  },
} as const;
