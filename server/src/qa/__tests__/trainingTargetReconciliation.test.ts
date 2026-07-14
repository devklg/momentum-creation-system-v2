import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MCS_TRAINING_MODULE_CATALOG,
  MCS_TRAINING_TARGET_RECONCILIATION,
  MCS_TRAINING_TARGET_RECONCILIATION_ENTRIES,
} from '@momentum/shared';

const root = path.resolve(process.cwd(), '..');

describe('P2-111 training target reconciliation', () => {
  it('reconciles Module 0 plus Modules 1 through 20 without losing an entry', () => {
    expect(MCS_TRAINING_TARGET_RECONCILIATION_ENTRIES).toHaveLength(21);
    expect(
      MCS_TRAINING_TARGET_RECONCILIATION_ENTRIES.map(
        (entry) => entry.architectureModuleNumber,
      ),
    ).toEqual(Array.from({ length: 21 }, (_, index) => index));
    expect(MCS_TRAINING_TARGET_RECONCILIATION.targetCountReconciliation).toEqual({
      architectureLabel: '20-module target',
      enumeratedEntryCount: 21,
      separateWelcomePrelude: 1,
      postWelcomeModuleCount: 20,
      interpretation: 'module_0_plus_modules_1_through_20',
    });
  });

  it('keeps every reconciled number and title grounded in TRAINING_ARCHITECTURE.md', () => {
    const architecture = readFileSync(path.join(root, 'TRAINING_ARCHITECTURE.md'), 'utf8');
    for (const entry of MCS_TRAINING_TARGET_RECONCILIATION_ENTRIES) {
      expect(architecture).toContain(`# MODULE ${entry.architectureModuleNumber}`);
      expect(architecture).toContain(`## ${entry.architectureTitle}`);
    }
  });

  it('does not claim target-module implementation from topic overlap', () => {
    expect(
      MCS_TRAINING_TARGET_RECONCILIATION.currentImplementation,
    ).toMatchObject({
      implementedModuleCount: 5,
      architectureTargetModulesWithDedicatedRouteAndCompletionAuthority: 0,
      relatedContentNeverEqualsTargetModuleCompletion: true,
    });
    expect(MCS_TRAINING_MODULE_CATALOG).toHaveLength(5);

    for (const entry of MCS_TRAINING_TARGET_RECONCILIATION_ENTRIES) {
      expect(entry.currentTargetRoute).toBeNull();
      expect(entry.currentTargetCompletionAuthority).toBeNull();
      expect(['related_content_only', 'unrepresented']).toContain(
        entry.implementationState,
      );
      for (const related of entry.relatedCurrentContent) {
        expect(related.relationship).toBe('topic_overlap_only');
      }
    }
  });

  it('points every related current route at an actual Team route', () => {
    const teamApp = readFileSync(path.join(root, 'apps/team/src/App.tsx'), 'utf8');
    const refs = new Set(
      MCS_TRAINING_TARGET_RECONCILIATION_ENTRIES.flatMap((entry) =>
        entry.relatedCurrentContent.map((related) => related.ref),
      ),
    );
    for (const ref of refs) {
      expect(teamApp).toContain(`path="${ref}"`);
    }
  });

  it('records the decided seven-day mechanics that are not implemented', () => {
    expect(MCS_TRAINING_TARGET_RECONCILIATION.sevenDayDecisionAlignment).toEqual({
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
    });
  });

  it('preserves the constitutional review boundary around person labels', () => {
    expect(MCS_TRAINING_TARGET_RECONCILIATION.implementationBoundaries).toMatchObject({
      noTargetModuleMayBeMarkedCompleteFromTopicOverlap: true,
      noElapsedTimeCompletion: true,
      noPersonScoringRankingOrClassification: true,
      targetLevelLabelsRequireConstitutionalReviewBeforeUseAsPersonLabels: [
        'Practitioner',
        'Builder',
        'Leader',
        'Legacy Leader',
      ],
    });
  });
});
