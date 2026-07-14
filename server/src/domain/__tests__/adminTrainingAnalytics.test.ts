import { describe, expect, it } from 'vitest';
import { aggregateAdminTrainingAnalytics } from '../adminTrainingAnalytics.js';

describe('P2-113 aggregate admin training analytics', () => {
  it('reports curriculum state without emitting person rows or identities', () => {
    const analytics = aggregateAdminTrainingAnalytics({
      scopedTmagIds: ['TM-A', 'TM-B', 'TM-C'],
      progressDocs: [
        { tmagId: 'TM-A', moduleId: 1, state: 'completed', updatedAt: '2026-07-01T00:00:00.000Z' },
        { tmagId: 'TM-A', moduleId: 1, state: 'in_progress', updatedAt: '2026-07-02T00:00:00.000Z' },
        ...Array.from({ length: 5 }, (_, index) => ({
          tmagId: 'TM-B',
          moduleId: index + 1,
          state: 'completed',
          updatedAt: '2026-07-03T00:00:00.000Z',
        })),
        { tmagId: 'TM-C', moduleId: 6, state: 'completed' },
      ],
      computedAt: '2026-07-13T12:00:00.000Z',
    });

    expect(analytics.programStateCounts).toEqual({
      notStarted: 1,
      underway: 1,
      allModulesComplete: 1,
    });
    expect(analytics.allModulesCompletionPct).toBe(33);
    expect(analytics.modules[0]).toMatchObject({
      moduleId: 1,
      stateCounts: { notStarted: 1, inProgress: 1, completed: 1 },
      completionPct: 33,
    });
    expect(analytics.modules[1]?.stateCounts).toEqual({
      notStarted: 2,
      inProgress: 0,
      completed: 1,
    });
    expect(analytics.dataQuality).toEqual({
      duplicateProgressRecordCount: 1,
      invalidProgressRecordCount: 1,
    });
    expect(analytics.policy).toEqual({
      people: 'aggregate_only_no_ranking_or_scoring',
      effectiveness: 'not_measured',
    });
    expect(JSON.stringify(analytics)).not.toMatch(/TM-A|TM-B|TM-C|fullName|tmagId/);
  });

  it('returns honest empty-scope values', () => {
    const analytics = aggregateAdminTrainingAnalytics({
      scopedTmagIds: [],
      progressDocs: [],
      computedAt: '2026-07-13T12:00:00.000Z',
    });

    expect(analytics.scopeBaCount).toBe(0);
    expect(analytics.allModulesCompletionPct).toBeNull();
    expect(analytics.programStateCounts).toEqual({
      notStarted: 0,
      underway: 0,
      allModulesComplete: 0,
    });
    expect(analytics.modules).toHaveLength(5);
    expect(analytics.modules.every((module) => module.completionPct === null)).toBe(true);
  });
});
