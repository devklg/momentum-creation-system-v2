export const MCS_TRAINING_TARGET_RECONCILIATION_SCHEMA_VERSION =
  'training_target_reconciliation.v1' as const;

export type McsTrainingArchitectureModuleNumber =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20;

export type McsTrainingTargetImplementationState =
  | 'related_content_only'
  | 'unrepresented';

export interface McsTrainingTargetReconciliationEntry {
  architectureModuleNumber: McsTrainingArchitectureModuleNumber;
  architectureTitle: string;
  targetLevel: 'foundation' | 'practitioner' | 'builder' | 'leader' | 'legacy_leader';
  targetCompletionClaim: 'specified_100_percent' | 'required' | 'not_specified';
  implementationState: McsTrainingTargetImplementationState;
  currentTargetRoute: null;
  currentTargetCompletionAuthority: null;
  relatedCurrentContent: readonly {
    ref: string;
    relationship: 'topic_overlap_only';
  }[];
}

const overlap = (...refs: string[]) =>
  refs.map((ref) => ({ ref, relationship: 'topic_overlap_only' as const }));

export const MCS_TRAINING_TARGET_RECONCILIATION_ENTRIES: readonly McsTrainingTargetReconciliationEntry[] = [
  {
    architectureModuleNumber: 0,
    architectureTitle: 'Team Magnificent Welcome',
    targetLevel: 'foundation',
    targetCompletionClaim: 'specified_100_percent',
    implementationState: 'related_content_only',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: overlap('/welcome'),
  },
  {
    architectureModuleNumber: 1,
    architectureTitle: 'Momentum Creation Fundamentals',
    targetLevel: 'foundation',
    targetCompletionClaim: 'required',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 2,
    architectureTitle: 'Understanding Team Magnificent',
    targetLevel: 'foundation',
    targetCompletionClaim: 'required',
    implementationState: 'related_content_only',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: overlap('/welcome', '/training/10-steps'),
  },
  {
    architectureModuleNumber: 3,
    architectureTitle: 'Fast Start Success',
    targetLevel: 'foundation',
    targetCompletionClaim: 'required',
    implementationState: 'related_content_only',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: overlap('/training/fast-start'),
  },
  {
    architectureModuleNumber: 4,
    architectureTitle: 'Product Fundamentals',
    targetLevel: 'foundation',
    targetCompletionClaim: 'not_specified',
    implementationState: 'related_content_only',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: overlap('/training/fast-start/product'),
  },
  {
    architectureModuleNumber: 5,
    architectureTitle: 'Customer Acquisition Foundations',
    targetLevel: 'foundation',
    targetCompletionClaim: 'required',
    implementationState: 'related_content_only',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: overlap('/training/fast-start/prospect-list'),
  },
  {
    architectureModuleNumber: 6,
    architectureTitle: 'Invitation Fundamentals',
    targetLevel: 'practitioner',
    targetCompletionClaim: 'not_specified',
    implementationState: 'related_content_only',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: overlap('/training/fast-start/prospect-list', '/ivory'),
  },
  {
    architectureModuleNumber: 7,
    architectureTitle: 'Prospect Momentum System',
    targetLevel: 'practitioner',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 8,
    architectureTitle: 'Follow-Up Mastery',
    targetLevel: 'practitioner',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 9,
    architectureTitle: 'Launch Center Mastery',
    targetLevel: 'practitioner',
    targetCompletionClaim: 'not_specified',
    implementationState: 'related_content_only',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: overlap('/launch'),
  },
  {
    architectureModuleNumber: 10,
    architectureTitle: 'Personal Productivity',
    targetLevel: 'practitioner',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 11,
    architectureTitle: 'Communication Excellence',
    targetLevel: 'builder',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 12,
    architectureTitle: 'Social Influence & Community Building',
    targetLevel: 'builder',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 13,
    architectureTitle: 'Duplication Fundamentals',
    targetLevel: 'builder',
    targetCompletionClaim: 'not_specified',
    implementationState: 'related_content_only',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: overlap(
      '/training/fast-start/binary',
      '/training/fast-start/team',
    ),
  },
  {
    architectureModuleNumber: 14,
    architectureTitle: 'Coaching Fundamentals',
    targetLevel: 'builder',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 15,
    architectureTitle: 'Leadership Foundations',
    targetLevel: 'builder',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 16,
    architectureTitle: 'Leadership Communication',
    targetLevel: 'leader',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 17,
    architectureTitle: 'Event Leadership',
    targetLevel: 'leader',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 18,
    architectureTitle: 'Mentorship Excellence',
    targetLevel: 'leader',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 19,
    architectureTitle: 'Advanced Team Development',
    targetLevel: 'legacy_leader',
    targetCompletionClaim: 'not_specified',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
  {
    architectureModuleNumber: 20,
    architectureTitle: 'Legacy Leadership',
    targetLevel: 'legacy_leader',
    targetCompletionClaim: 'required',
    implementationState: 'unrepresented',
    currentTargetRoute: null,
    currentTargetCompletionAuthority: null,
    relatedCurrentContent: [],
  },
] as const;

export const MCS_TRAINING_TARGET_RECONCILIATION = {
  schemaVersion: MCS_TRAINING_TARGET_RECONCILIATION_SCHEMA_VERSION,
  source: 'TRAINING_ARCHITECTURE.md',
  auditItem: 'P2-111',
  targetCountReconciliation: {
    architectureLabel: '20-module target',
    enumeratedEntryCount: 21,
    separateWelcomePrelude: 1,
    postWelcomeModuleCount: 20,
    interpretation: 'module_0_plus_modules_1_through_20',
  },
  currentImplementation: {
    implementedProgramId: 'fast_start',
    implementedModuleCount: 5,
    implementedCatalogSource: 'packages/shared/src/training-catalog.ts',
    architectureTargetModulesWithDedicatedRouteAndCompletionAuthority: 0,
    relatedContentNeverEqualsTargetModuleCompletion: true,
  },
  sevenDayDecisionAlignment: {
    status: 'not_implemented_as_decided',
    decisionRefs: [
      'decision_chat96_7day_training_schedule',
      'decision_chat96_day4_certification_test',
      'decision_chat96_fast_start_is_7day_plan',
    ],
    currentHubClaimsSevenDays: true,
    calendarDayStateAuthority: null,
    daysOneThroughFourLearnOnlyEnforced: false,
    dayFourCertificationImplemented: false,
    dayFourCertificationGatesInvitations: false,
    daysFiveThroughSevenTwoIn72PhaseImplemented: false,
    currentCompletionRule: 'all_five_modules_completed_plus_one_invitation_sent',
  },
  implementationBoundaries: {
    targetCurriculumRemainsPlanned: true,
    currentFiveModuleCatalogRemainsCanonicalForImplementedProgress: true,
    noTargetModuleMayBeMarkedCompleteFromTopicOverlap: true,
    noElapsedTimeCompletion: true,
    noPersonScoringRankingOrClassification: true,
    targetLevelLabelsRequireConstitutionalReviewBeforeUseAsPersonLabels: [
      'Practitioner',
      'Builder',
      'Leader',
      'Legacy Leader',
    ],
  },
  entries: MCS_TRAINING_TARGET_RECONCILIATION_ENTRIES,
} as const;
