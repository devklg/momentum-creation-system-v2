import type {
  McsSteveGuidanceRecommendation,
  McsSteveTailoredGuidance,
} from '@momentum/shared';
import { MCS_TRAINING_MODULE_CATALOG } from '@momentum/shared';
import { scanGeneratedCopyCompliance } from './generatedCopyCompliance.js';

export const STEVE_GUIDANCE_SCHEMA_VERSION = 'steve_guidance.v1' as const;

const MAX_RECOMMENDATIONS = 6;
const MAX_TEXT_LENGTH = 500;
const allowedTrainingRoutes = new Set<string>([
  '/training/fast-start',
  '/training/10-steps',
  '/resources',
  ...MCS_TRAINING_MODULE_CATALOG.map((module) => module.routes.team),
]);
const allowedLaunchRoutes = new Set<string>([
  '/cockpit',
  '/cockpit#pmv',
  '/cockpit#sponsor',
  '/events',
  '/ivory',
  '/resources',
  '/steve/discovery',
  '/training/10-steps',
  '/training/fast-start',
  ...MCS_TRAINING_MODULE_CATALOG.map((module) => module.routes.team),
]);

const policy: McsSteveTailoredGuidance['policy'] = {
  guidanceNotRequirement: true,
  equalAccess: true,
  changesAccess: false,
  changesCurriculumOrder: false,
  changesCompletion: false,
  changesLaunchNextAction: false,
  approvedKnowledge: false,
  scoring: false,
  ranking: false,
  classification: false,
  qualification: false,
  prediction: false,
  comparison: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnsafeGuidance(text: string): boolean {
  return scanGeneratedCopyCompliance(text).violations.some(
    (violation) => violation.id !== 'comp_plan',
  );
}

export function isSafeSteveGuidanceText(text: string): boolean {
  return text.trim().length > 0 && !isUnsafeGuidance(text);
}

function projectRecommendations(
  value: unknown,
  allowedRoutes: ReadonlySet<string>,
): McsSteveGuidanceRecommendation[] {
  if (!Array.isArray(value)) return [];
  const projected: McsSteveGuidanceRecommendation[] = [];
  for (const item of value) {
    if (projected.length >= MAX_RECOMMENDATIONS) break;
    if (!isRecord(item) || typeof item.text !== 'string') continue;
    const text = item.text.trim().slice(0, MAX_TEXT_LENGTH);
    if (!isSafeSteveGuidanceText(text)) continue;
    const href = typeof item.href === 'string' && allowedRoutes.has(item.href)
      ? item.href
      : null;
    projected.push({ text, href });
  }
  return projected;
}

function emptyGuidance(args: {
  status: 'unavailable' | 'needs_attention';
  reason: McsSteveTailoredGuidance['reason'];
}): McsSteveTailoredGuidance {
  return {
    schemaVersion: STEVE_GUIDANCE_SCHEMA_VERSION,
    status: args.status,
    reason: args.reason,
    source: 'steve_success_profile',
    provenance: { generatedAt: null, signedBy: null },
    training: [],
    launch: [],
    policy,
  };
}

/**
 * Project only already-persisted Steve recommendations for the authenticated
 * BA. This function creates no recommendation, score, readiness state, or
 * persistence. Duplicate or identity-inconsistent evidence fails closed.
 */
export function projectSteveTailoredGuidance(args: {
  expectedTmagId: string;
  steveComplete: boolean;
  profileRecordCount: number;
  successProfile: unknown;
  personalizationActive?: boolean;
}): McsSteveTailoredGuidance {
  if (!args.steveComplete) {
    return emptyGuidance({ status: 'unavailable', reason: 'profile_not_complete' });
  }
  if (args.personalizationActive === false) {
    return emptyGuidance({ status: 'unavailable', reason: 'profile_missing' });
  }
  if (args.profileRecordCount === 0 || !isRecord(args.successProfile)) {
    return emptyGuidance({ status: 'unavailable', reason: 'profile_missing' });
  }
  if (
    args.profileRecordCount !== 1 ||
    args.successProfile.tmagId !== args.expectedTmagId
  ) {
    return emptyGuidance({
      status: 'needs_attention',
      reason: 'profile_duplicate_or_identity_inconsistent',
    });
  }

  return {
    schemaVersion: STEVE_GUIDANCE_SCHEMA_VERSION,
    status: 'available',
    reason: 'profile_available',
    source: 'steve_success_profile',
    provenance: {
      generatedAt: typeof args.successProfile.generatedAt === 'string'
        ? args.successProfile.generatedAt
        : null,
      signedBy: typeof args.successProfile.signedBy === 'string'
        ? args.successProfile.signedBy
        : null,
    },
    training: projectRecommendations(
      args.successProfile.trainingRecommendations,
      allowedTrainingRoutes,
    ),
    launch: projectRecommendations(
      args.successProfile.launchRecommendations,
      allowedLaunchRoutes,
    ),
    policy,
  };
}
