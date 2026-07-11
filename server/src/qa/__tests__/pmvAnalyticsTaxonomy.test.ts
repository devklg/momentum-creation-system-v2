import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PMV_ANALYTICS_EVENTS,
  PMV_ANALYTICS_FORBIDDEN_PATTERNS,
  PMV_ANALYTICS_TAXONOMY,
  PMV_EVENT_IDS,
} from '@momentum/shared';

const repoRoot = path.resolve(__dirname, '../../../..');
const taxonomyDocPath = path.join(
  repoRoot,
  'engineering/sprints/platform-audit-p1/PMV_ANALYTICS_EVENT_TAXONOMY.md',
);

const forbidden = new RegExp(PMV_ANALYTICS_FORBIDDEN_PATTERNS.join('|'), 'i');

function publicTextForEvent(event: (typeof PMV_ANALYTICS_EVENTS)[number]): string {
  return [
    event.eventId,
    event.concept,
    event.trigger,
    ...event.allowedMetrics.flatMap((m) => [m.id, m.label, m.description]),
  ].join('\n');
}

describe('P1 PMV analytics event taxonomy', () => {
  it('covers every PMV contract event exactly once', () => {
    expect(PMV_ANALYTICS_EVENTS.map((event) => event.eventId)).toEqual(PMV_EVENT_IDS);
    expect(new Set(PMV_ANALYTICS_EVENTS.map((event) => event.eventId)).size).toBe(
      PMV_EVENT_IDS.length,
    );
  });

  it('keeps public analytics metric ids, labels, descriptions, and triggers clear of forbidden claims', () => {
    for (const event of PMV_ANALYTICS_EVENTS) {
      expect(publicTextForEvent(event)).not.toMatch(forbidden);
    }
  });

  it('documents forbidden metric families for every event', () => {
    for (const event of PMV_ANALYTICS_EVENTS) {
      expect(event.forbiddenMetrics.length).toBeGreaterThan(0);
    }
    expect(PMV_ANALYTICS_TAXONOMY.purpose).toMatch(/without earnings, cycle math/i);
  });

  it('uses only count, rate, timestamp, or duration aggregations', () => {
    const allowed = new Set(['count', 'rate', 'timestamp', 'duration']);
    for (const event of PMV_ANALYTICS_EVENTS) {
      for (const metric of event.allowedMetrics) {
        expect(allowed.has(metric.aggregation)).toBe(true);
      }
    }
  });

  it('keeps the Markdown artifact aligned to the shared taxonomy events', () => {
    const doc = fs.readFileSync(taxonomyDocPath, 'utf8');

    expect(doc).toContain('Source of truth: `packages/shared/src/pmv-analytics-taxonomy.ts`');
    for (const event of PMV_ANALYTICS_EVENTS) {
      expect(doc).toContain(`| \`${event.eventId}\` |`);
    }
  });
});
