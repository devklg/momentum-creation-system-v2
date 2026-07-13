import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCS_RESOURCE_CENTER_CATALOG as catalog } from '@momentum/shared';

const root = path.resolve(process.cwd(), '..');

describe('P2-99 Resource Center product boundary', () => {
  it('defines one named BA library with the P2-100 UI live', () => {
    expect(catalog).toMatchObject({
      productBoundary: 'named_ba_library_over_source_owned_resources',
      currentState: 'named_ui_live_version_safe_projection',
      teamRoute: '/resources',
      access: 'ba_authenticated',
    });

    const teamApp = readFileSync(path.join(root, 'apps/team/src/App.tsx'), 'utf8');
    const boundary = readFileSync(path.join(root, 'docs/resource-center-product-boundary.md'), 'utf8');
    const tasklist = readFileSync(path.join(root, 'PLATFORM_AUDIT_PRIORITY_TASKLIST.md'), 'utf8');
    expect(teamApp).toContain('path="/resources"');
    expect(boundary).toContain('governed discovery layer over source-owned resources');
    expect(boundary).toContain('P2-100 added the `/resources` UI');
    expect(tasklist).toMatch(/\[x\] 99\. \*\*Resource Center:\*\*/);
    expect(catalog.deferred).not.toHaveProperty('p2_100');
  });

  it('keeps resource sources authoritative and avoids double-counting the Product Gallery', () => {
    const videos = catalog.sourceDomains.find((source) => source.domain === 'content_videos');
    const training = catalog.sourceDomains.find((source) => source.domain === 'training_content');
    const knowledge = catalog.sourceDomains.find((source) => source.domain === 'approved_knowledge');
    const events = catalog.sourceDomains.find((source) => source.domain === 'event_materials');

    expect(videos).toMatchObject({
      owner: 'product_gallery',
      currentTeamRoute: '/video-library',
      inclusion: 'catalog_projection_required',
      aliases: ['video_library', 'product_gallery'],
    });
    expect(training).toMatchObject({ owner: 'training', inclusion: 'catalog_projection_required' });
    expect(knowledge).toMatchObject({
      owner: 'knowledge_core',
      inclusion: 'active_human_approved_human_readable_projection_only',
    });
    expect(events).toMatchObject({
      owner: 'event_center',
      currentState: 'approved_resources_linkable_to_orientation_and_webinar_contexts',
      inclusion: 'explicit_context_tag_only',
    });
    expect(catalog.connections).toMatchObject({
      authority: 'kevin_selected_during_knowledge_approval',
      inference: 'forbidden',
      graphRelationships: ['SUPPORTS_TRAINING_MODULE', 'SUPPORTS_EVENT_MATERIAL'],
    });
    expect(catalog.deferred).not.toHaveProperty('p2_101');
  });

  it('pins fail-closed version safety and explicit exclusions', () => {
    expect(catalog.versionSafety).toMatchObject({
      schema: 'resource_catalog.v1',
      mongoCollection: 'tmag_resource_catalog',
      chromaCollection: 'mcs_resource_catalog',
      retrievalLifecycle: 'active',
      sourceRule: 'catalog_is_projection_not_source_authority',
    });
    expect(catalog.exclusions).toEqual(expect.arrayContaining([
      'prospect_public_surface',
      'training_sequence_or_progress',
      'event_scheduling_registration_or_attendance',
      'candidate_unapproved_or_private_knowledge',
      'semantic_similarity_as_truth',
      'duplicate_content_authority',
    ]));
  });
});
