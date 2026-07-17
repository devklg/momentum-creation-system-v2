import type { McsFastStartModuleId } from './types.js';
import { MCS_FAST_START_CONTENT_VERSIONING_BOUNDARY } from './content-versioning.js';

export const MCS_TRAINING_CATALOG_SCHEMA_VERSION = 'training_catalog.v1' as const;

export type McsTrainingCatalogModuleId =
  | 'fast_start_01_product'
  | 'fast_start_02_comp_layer_1'
  | 'fast_start_03_binary'
  | 'fast_start_04_prospect_list'
  | 'fast_start_05_team';

export type McsTrainingAccessPrerequisite =
  | 'authenticated_ba'
  | 'steve_discovery_complete';

export interface McsTrainingModuleCatalogEntry {
  moduleId: McsTrainingCatalogModuleId;
  programId: 'fast_start';
  progressModuleId: McsFastStartModuleId;
  sequence: McsFastStartModuleId;
  slug: 'product' | 'comp-layer-1' | 'binary' | 'prospect-list' | 'team';
  title: string;
  implementationStatus: 'implemented';
  prerequisites: {
    access: readonly McsTrainingAccessPrerequisite[];
    recommendedPreviousModuleId: McsTrainingCatalogModuleId | null;
    previousModuleEnforced: false;
  };
  completionCriteria: {
    authority: 'tmag_fast_start_progress';
    requiredState: 'completed';
    transition: 'explicit_ba_action';
    inferredFromElapsedTime: false;
  };
  contentSources: readonly string[];
  routes: {
    team: `/training/fast-start/${string}`;
    progressRead: '/api/training/fast-start/progress';
    progressWrite: `/api/training/fast-start/modules/${McsFastStartModuleId}/state`;
    relatedAction: '/ivory' | null;
  };
  contextTag: `context:training:fast-start:${McsFastStartModuleId}`;
}

const progressReadRoute = '/api/training/fast-start/progress' as const;

export const MCS_TRAINING_MODULE_CATALOG: readonly McsTrainingModuleCatalogEntry[] = [
  {
    moduleId: 'fast_start_01_product',
    programId: 'fast_start',
    progressModuleId: 1,
    sequence: 1,
    slug: 'product',
    title: 'The Product',
    implementationStatus: 'implemented',
    prerequisites: {
      access: ['authenticated_ba'],
      recommendedPreviousModuleId: null,
      previousModuleEnforced: false,
    },
    completionCriteria: {
      authority: 'tmag_fast_start_progress',
      requiredState: 'completed',
      transition: 'explicit_ba_action',
      inferredFromElapsedTime: false,
    },
    contentSources: [
      'apps/team/src/routes/training/fast-start/product.tsx',
      'packages/shared/src/product-catalog.ts',
      'docs/training-sources.md#6-the-pdr-position-required-product-training-foundation',
      'docs/training-sources.md#3-glp-three-scientific-dossier-official-three',
    ],
    routes: {
      team: '/training/fast-start/product',
      progressRead: progressReadRoute,
      progressWrite: '/api/training/fast-start/modules/1/state',
      relatedAction: null,
    },
    contextTag: 'context:training:fast-start:1',
  },
  {
    moduleId: 'fast_start_02_comp_layer_1',
    programId: 'fast_start',
    progressModuleId: 2,
    sequence: 2,
    slug: 'comp-layer-1',
    title: 'Comp Plan, Layer 1',
    implementationStatus: 'implemented',
    prerequisites: {
      access: ['authenticated_ba', 'steve_discovery_complete'],
      recommendedPreviousModuleId: 'fast_start_01_product',
      previousModuleEnforced: false,
    },
    completionCriteria: {
      authority: 'tmag_fast_start_progress',
      requiredState: 'completed',
      transition: 'explicit_ba_action',
      inferredFromElapsedTime: false,
    },
    contentSources: [
      'apps/team/src/routes/training/fast-start/comp-layer-1.tsx',
      'docs/training-sources.md#1-team-magnificents-own-comp-training-power-in-numbers',
    ],
    routes: {
      team: '/training/fast-start/comp-layer-1',
      progressRead: progressReadRoute,
      progressWrite: '/api/training/fast-start/modules/2/state',
      relatedAction: null,
    },
    contextTag: 'context:training:fast-start:2',
  },
  {
    moduleId: 'fast_start_03_binary',
    programId: 'fast_start',
    progressModuleId: 3,
    sequence: 3,
    slug: 'binary',
    title: 'The Binary as Two Legs',
    implementationStatus: 'implemented',
    prerequisites: {
      access: ['authenticated_ba', 'steve_discovery_complete'],
      recommendedPreviousModuleId: 'fast_start_02_comp_layer_1',
      previousModuleEnforced: false,
    },
    completionCriteria: {
      authority: 'tmag_fast_start_progress',
      requiredState: 'completed',
      transition: 'explicit_ba_action',
      inferredFromElapsedTime: false,
    },
    contentSources: [
      'apps/team/src/routes/training/fast-start/binary.tsx',
      'docs/training-sources.md#1-team-magnificents-own-comp-training-power-in-numbers',
    ],
    routes: {
      team: '/training/fast-start/binary',
      progressRead: progressReadRoute,
      progressWrite: '/api/training/fast-start/modules/3/state',
      relatedAction: null,
    },
    contextTag: 'context:training:fast-start:3',
  },
  {
    moduleId: 'fast_start_04_prospect_list',
    programId: 'fast_start',
    progressModuleId: 4,
    sequence: 4,
    slug: 'prospect-list',
    title: 'Build Your Prospect List',
    implementationStatus: 'implemented',
    prerequisites: {
      access: ['authenticated_ba', 'steve_discovery_complete'],
      recommendedPreviousModuleId: 'fast_start_03_binary',
      previousModuleEnforced: false,
    },
    completionCriteria: {
      authority: 'tmag_fast_start_progress',
      requiredState: 'completed',
      transition: 'explicit_ba_action',
      inferredFromElapsedTime: false,
    },
    contentSources: [
      'apps/team/src/routes/training/fast-start/prospect-list.tsx',
      'docs/training-sources.md#4-upline-onboarding-webinar-transcript-adrianne',
      'docs/training-sources.md#5-larry-thompson-telecourse-foundational-philosophy',
    ],
    routes: {
      team: '/training/fast-start/prospect-list',
      progressRead: progressReadRoute,
      progressWrite: '/api/training/fast-start/modules/4/state',
      relatedAction: '/ivory',
    },
    contextTag: 'context:training:fast-start:4',
  },
  {
    moduleId: 'fast_start_05_team',
    programId: 'fast_start',
    progressModuleId: 5,
    sequence: 5,
    slug: 'team',
    title: 'Build Your Team',
    implementationStatus: 'implemented',
    prerequisites: {
      access: ['authenticated_ba', 'steve_discovery_complete'],
      recommendedPreviousModuleId: 'fast_start_04_prospect_list',
      previousModuleEnforced: false,
    },
    completionCriteria: {
      authority: 'tmag_fast_start_progress',
      requiredState: 'completed',
      transition: 'explicit_ba_action',
      inferredFromElapsedTime: false,
    },
    contentSources: [
      'apps/team/src/routes/training/fast-start/team.tsx',
      'docs/training-sources.md#1-team-magnificents-own-comp-training-power-in-numbers',
      'docs/training-sources.md#4-upline-onboarding-webinar-transcript-adrianne',
      'docs/training-sources.md#5-larry-thompson-telecourse-foundational-philosophy',
    ],
    routes: {
      team: '/training/fast-start/team',
      progressRead: progressReadRoute,
      progressWrite: '/api/training/fast-start/modules/5/state',
      relatedAction: null,
    },
    contextTag: 'context:training:fast-start:5',
  },
] as const;

export const MCS_TRAINING_CATALOG = {
  schemaVersion: MCS_TRAINING_CATALOG_SCHEMA_VERSION,
  owner: 'training',
  scope: 'current_implemented_training_truth',
  program: {
    programId: 'fast_start',
    title: 'Fast Start Guide',
    implementationStatus: 'implemented',
    teamHubRoute: '/training/fast-start',
    progressReadRoute,
    progressWriteRoute: '/api/training/fast-start/modules/:id/state',
    sequencing: 'recommended_not_hard_gated',
    completionCriteria: {
      everyCatalogModuleState: 'completed',
      minimumInvitationsSent: 1,
      invitationAuthority: 'tmag_prospects.sentAt',
      progressAuthority: 'tmag_fast_start_progress',
    },
  },
  modules: MCS_TRAINING_MODULE_CATALOG,
  contentVersioning: MCS_FAST_START_CONTENT_VERSIONING_BOUNDARY,
  adjacentTrainingSurfaces: [
    {
      id: 'ten_step_orientation',
      teamRoute: '/training/10-steps',
      classification: 'live_orientation_curriculum_not_fast_start_module',
      moduleProgressAuthority: false,
      completionSource: 'not_available',
    },
    {
      id: 'resource_center',
      teamRoute: '/resources',
      classification: 'approved_supporting_resources_not_training_progress',
      moduleProgressAuthority: false,
      completionSource: 'not_applicable',
    },
  ],
  boundaries: {
    currentCatalogDoesNotClaimFullTargetReconciliation: true,
    targetArchitectureSource: 'TRAINING_ARCHITECTURE.md',
    targetReconciliationAuditItem: 'P2-111',
    noPersonScoringRankingOrClassification: true,
    completionRequiresExplicitEvidence: true,
    elapsedTimeNeverCompletesTraining: true,
    catalogIsProjectionNotContentAuthority: true,
    resourceCatalogIsContentAuthority: true,
    currentFastStartContentRatificationDeferredUntilPostAuditAppReview: true,
  },
} as const;
