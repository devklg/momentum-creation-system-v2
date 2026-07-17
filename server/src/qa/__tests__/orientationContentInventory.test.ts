import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MCS_CURRENT_ORIENTATION_CONTENT_INVENTORY,
  MCS_CURRENT_ORIENTATION_CURRICULUM_STEPS,
  MCS_CURRENT_ORIENTATION_STATE_MACHINE,
  MCS_TRAINING_CATALOG,
} from '@momentum/shared';

const root = path.resolve(process.cwd(), '..');
const source = readFileSync(path.join(
  root,
  MCS_CURRENT_ORIENTATION_CONTENT_INVENTORY.curriculum.sourcePath,
), 'utf8');

function extractImplementedSteps() {
  const array = source.match(/const STEPS: Step\[\] = \[([\s\S]*?)\n\];/)?.[1] ?? '';
  return [...array.matchAll(
    /\{\s*n: '(\d{2})',\s*name: '([^']+)',\s*desc: '([^']+)',\s*insight: '([^']+)',\s*\}/g,
  )].map((match) => ({
    displayNumber: match[1] ?? '',
    title: match[2] ?? '',
    description: match[3] ?? '',
    hostInsight: match[4] ?? '',
  }));
}

describe('P2-117 current orientation content inventory', () => {
  it('derives the exact ten-step order and titles from the implemented page', () => {
    const implemented = extractImplementedSteps();
    expect(implemented).toHaveLength(10);
    expect(implemented.map(({ displayNumber, title }) => ({ displayNumber, title }))).toEqual(
      MCS_CURRENT_ORIENTATION_CURRICULUM_STEPS.map(({ displayNumber, title }) => ({ displayNumber, title })),
    );
    expect(implemented.every((step) => step.description.length > 0 && step.hostInsight.length > 0)).toBe(true);
  });

  it('anchors every step title to the locked Part 4.5 authority', () => {
    const lockedSpec = readFileSync(path.join(root, 'docs/locked-spec.md'), 'utf8');
    expect(lockedSpec).toContain('## 4.5 10-step orientation curriculum');
    expect(lockedSpec).toContain('Locked Chat #99. Supersedes the placeholder list');
    for (const step of MCS_CURRENT_ORIENTATION_CURRICULUM_STEPS) {
      expect(lockedSpec).toContain(`${step.sequence}. **${step.title}**`);
    }
  });

  it('anchors the route and every declared supporting block to current code', () => {
    const app = readFileSync(path.join(root, 'apps/team/src/App.tsx'), 'utf8');
    expect(app).toContain(`path="${MCS_CURRENT_ORIENTATION_CONTENT_INVENTORY.curriculum.teamRoute}"`);
    for (const block of MCS_CURRENT_ORIENTATION_CONTENT_INVENTORY.curriculum.supportingBlocks) {
      expect(source, block.id).toContain(block.sourceAnchor);
    }
  });

  it('reports remaining access/language gaps and the ACR-0033 version authority', () => {
    expect(MCS_CURRENT_ORIENTATION_CONTENT_INVENTORY.curriculum).toMatchObject({
      complianceSurface: 'team_only',
      accessControl: { routeContainer: 'TeamShell', authenticationEnforcement: 'not_evidenced' },
      languageAvailability: { en: 'implemented', es: 'missing' },
      contentVersionAuthority: {
        catalogSchemaVersion: 'resource_catalog.v1',
        resourceVersionId: 'training:orientation:ten_step:v1',
        authorityEvidenceId: 'ACR-0033',
      },
      sessionCurriculumBinding: {
        schemaVersion: 'content_version_binding.v1',
        bindingIdentity: 'resourceVersionId',
        immutableAfterSessionCreation: true,
        exactStoreReadbackRequired: true,
      },
    });
  });

  it('keeps curriculum content separate from scheduler, attendance, and completion truth', () => {
    expect(MCS_CURRENT_ORIENTATION_CONTENT_INVENTORY.operations).toMatchObject({
      currentRuntime: 'live_group_session_scheduler',
      attendanceAuthority: null,
      completionAuthority: null,
      reservationProvesAttendance: false,
      elapsedSessionProvesAttendance: false,
      completionInferred: false,
    });
    expect(MCS_CURRENT_ORIENTATION_STATE_MACHINE.completion).toMatchObject({
      attendanceAuthority: null,
      completionAuthority: null,
      elapsedTimeCompletesOrientation: false,
      reservationCompletesOrientation: false,
    });
  });

  it('keeps the Stage 0-10 architecture future-only and orientation outside Fast Start progress', () => {
    const architecture = readFileSync(path.join(root, 'ORIENTATION_ARCHITECTURE.md'), 'utf8');
    for (let stage = 0; stage <= 10; stage += 1) expect(architecture).toContain(`Stage ${stage} -`);
    expect(MCS_CURRENT_ORIENTATION_CONTENT_INVENTORY.futureTarget).toMatchObject({
      architecture: 'stage_0_through_stage_10',
      status: 'planned_not_current_runtime',
      stageRecordsImplemented: false,
      attendanceCaptureImplemented: false,
      completionRecordImplemented: false,
    });
    expect(MCS_TRAINING_CATALOG.adjacentTrainingSurfaces).toContainEqual({
      id: 'ten_step_orientation',
      teamRoute: '/training/10-steps',
      classification: 'live_orientation_curriculum_not_fast_start_module',
      moduleProgressAuthority: false,
      completionSource: 'not_available',
    });
  });
});
