import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MCS_FAST_START_MODULES,
  MCS_TRAINING_CATALOG,
  MCS_TRAINING_MODULE_CATALOG,
} from '@momentum/shared';

const root = path.resolve(process.cwd(), '..');

describe('P2-110 training module catalog', () => {
  it('catalogs the five implemented Fast Start modules with stable unique ids', () => {
    expect(MCS_TRAINING_CATALOG).toMatchObject({
      schemaVersion: 'training_catalog.v1',
      owner: 'training',
      scope: 'current_implemented_training_truth',
    });
    expect(MCS_TRAINING_MODULE_CATALOG).toHaveLength(5);
    expect(new Set(MCS_TRAINING_MODULE_CATALOG.map((module) => module.moduleId)).size).toBe(5);
    expect(new Set(MCS_TRAINING_MODULE_CATALOG.map((module) => module.progressModuleId))).toEqual(
      new Set([1, 2, 3, 4, 5]),
    );
  });

  it('stays aligned with the existing Fast Start compatibility metadata', () => {
    expect(
      MCS_TRAINING_MODULE_CATALOG.map(({ progressModuleId, slug, title }) => ({
        id: progressModuleId,
        slug,
        title,
      })),
    ).toEqual(MCS_FAST_START_MODULES.map(({ id, slug, title }) => ({ id, slug, title })));
  });

  it('records access prerequisites without inventing inter-module hard gates', () => {
    const [first, ...remaining] = MCS_TRAINING_MODULE_CATALOG;
    expect(first?.prerequisites).toEqual({
      access: ['authenticated_ba'],
      recommendedPreviousModuleId: null,
      previousModuleEnforced: false,
    });
    for (const module of remaining) {
      expect(module.prerequisites.access).toEqual([
        'authenticated_ba',
        'steve_discovery_complete',
      ]);
      expect(module.prerequisites.previousModuleEnforced).toBe(false);
    }
    expect(MCS_TRAINING_CATALOG.program.sequencing).toBe('recommended_not_hard_gated');
  });

  it('requires explicit completion evidence and preserves the program completion rule', () => {
    for (const module of MCS_TRAINING_MODULE_CATALOG) {
      expect(module.completionCriteria).toEqual({
        authority: 'tmag_fast_start_progress',
        requiredState: 'completed',
        transition: 'explicit_ba_action',
        inferredFromElapsedTime: false,
      });
    }
    expect(MCS_TRAINING_CATALOG.program.completionCriteria).toEqual({
      everyCatalogModuleState: 'completed',
      minimumInvitationsSent: 1,
      invitationAuthority: 'tmag_prospects.sentAt',
      progressAuthority: 'tmag_fast_start_progress',
    });
  });

  it('points every module at real content and current Team/API routes', () => {
    const teamApp = readFileSync(path.join(root, 'apps/team/src/App.tsx'), 'utf8');
    const trainingRoutes = readFileSync(path.join(root, 'server/src/routes/training.ts'), 'utf8');

    for (const module of MCS_TRAINING_MODULE_CATALOG) {
      expect(module.contentSources.length).toBeGreaterThan(0);
      for (const source of module.contentSources.filter((value) => !value.includes('#'))) {
        expect(existsSync(path.join(root, source)), source).toBe(true);
      }
      expect(teamApp).toContain(`path="${module.routes.team}"`);
      expect(module.routes.progressRead).toBe('/api/training/fast-start/progress');
      expect(module.routes.progressWrite).toBe(
        `/api/training/fast-start/modules/${module.progressModuleId}/state`,
      );
      expect(module.contextTag).toBe(
        `context:training:fast-start:${module.progressModuleId}`,
      );
    }

    expect(trainingRoutes).toContain("'/fast-start/progress'");
    expect(trainingRoutes).toContain("'/fast-start/modules/:id/state'");
  });

  it('keeps orientation/resources adjacent and leaves target reconciliation to P2-111', () => {
    expect(MCS_TRAINING_CATALOG.adjacentTrainingSurfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ten_step_orientation',
          teamRoute: '/training/10-steps',
          moduleProgressAuthority: false,
          completionSource: 'not_available',
        }),
        expect.objectContaining({
          id: 'resource_center',
          teamRoute: '/resources',
          moduleProgressAuthority: false,
        }),
      ]),
    );
    expect(MCS_TRAINING_CATALOG.boundaries).toMatchObject({
      currentCatalogDoesNotClaimFullTargetReconciliation: true,
      targetArchitectureSource: 'TRAINING_ARCHITECTURE.md',
      targetReconciliationAuditItem: 'P2-111',
      noPersonScoringRankingOrClassification: true,
      completionRequiresExplicitEvidence: true,
    });
  });
});
