import type { McsOrientationSession } from './types.js';

export const MCS_CONTENT_VERSION_BINDING_SCHEMA_VERSION = 'content_version_binding.v1' as const;

export interface McsBoundResourceVersion {
  resourceVersionId: string;
  contentDigestSha256: string;
}

export interface McsContentVersionBinding {
  schemaVersion: typeof MCS_CONTENT_VERSION_BINDING_SCHEMA_VERSION;
  catalogSchemaVersion: 'resource_catalog.v1';
  contextTag: string;
  primaryResourceVersionId: string;
  resources: McsBoundResourceVersion[];
  bindingDigestSha256: string;
  boundAt: string;
}

export interface McsVersionedOrientationSession extends McsOrientationSession {
  contentBinding: McsContentVersionBinding;
}

/**
 * The current orientation page is the code-owned core curriculum. Its digest
 * is over the source file with CRLF normalized to LF. Any source change must
 * intentionally mint a new version rather than silently mutating v1.
 */
export const MCS_ORIENTATION_CURRICULUM_RESOURCE_VERSION = {
  resourceId: 'training:orientation:ten_step',
  resourceVersionId: 'training:orientation:ten_step:v1',
  version: 1,
  title: '10-Step Orientation Curriculum',
  summary: 'The current Team Magnificent live new-member orientation curriculum and permanent BA reference.',
  sourcePath: 'apps/team/src/routes/training/10-steps.tsx',
  teamRoute: '/training/10-steps',
  contextTags: ['context:training:10-steps', 'context:event:orientation'],
  contentDigestSha256: '8ac538ffd6d442887076f6641f2a911ca0e9911603c3a67eeeddf0c9461ef53b',
  authorityEvidenceId: 'ACR-0033',
} as const;

/**
 * ACR-0033 deliberately establishes the version-binding rule without
 * declaring the current Fast Start source files approved catalog content.
 */
export const MCS_FAST_START_CONTENT_VERSIONING_BOUNDARY = {
  programId: 'fast_start',
  contentAuthority: 'tmag_resource_catalog',
  catalogSchemaVersion: 'resource_catalog.v1',
  bindingIdentity: 'resourceVersionId',
  associationRule: 'explicit_context_tag_only',
  activationStatus: 'deferred_pending_post_audit_app_review',
  purpose: 'immediate_first_training_for_initial_actions_success_behavior_and_future_training_foundation',
  currentApprovedContentVersionIds: [] as readonly string[],
} as const;

export const MCS_RESOURCE_AND_EVENT_MATERIAL_VERSIONING_BOUNDARY = {
  contentAuthority: 'tmag_resource_catalog',
  catalogSchemaVersion: 'resource_catalog.v1',
  bindingIdentity: 'resourceVersionId',
  eventAssociationRule: 'explicit_context_tag_only',
  semanticInferenceCreatesBindings: false,
} as const;

export function validateContentVersionBinding(binding: McsContentVersionBinding): string[] {
  const errors: string[] = [];
  if (!binding.contextTag.trim()) errors.push('context_tag_required');
  if (!binding.primaryResourceVersionId.trim()) errors.push('primary_resource_version_required');
  if (binding.resources.length === 0) errors.push('bound_resource_required');
  if (!/^[a-f0-9]{64}$/i.test(binding.bindingDigestSha256)) errors.push('binding_sha256_required');
  if (Number.isNaN(new Date(binding.boundAt).getTime())) errors.push('bound_at_iso_required');
  const seen = new Set<string>();
  for (const resource of binding.resources) {
    if (!/:v[1-9][0-9]*$/.test(resource.resourceVersionId)) errors.push('exact_resource_version_required');
    if (!/^[a-f0-9]{64}$/i.test(resource.contentDigestSha256)) errors.push('resource_sha256_required');
    if (seen.has(resource.resourceVersionId)) errors.push('duplicate_resource_version');
    seen.add(resource.resourceVersionId);
  }
  if (!seen.has(binding.primaryResourceVersionId)) errors.push('primary_resource_must_be_bound');
  return [...new Set(errors)];
}
