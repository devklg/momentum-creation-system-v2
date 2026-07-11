import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface ComplianceScan {
  scope: string;
  summary: {
    filesScanned: number;
    visibleStringsScanned: number;
    blockingViolations: number;
    allowedSignals: number;
    status: 'pass' | 'fail';
    allowedSignalsByRule: Record<string, number>;
  };
  blockingRules: Array<{ id: string; severity: string; description: string }>;
  allowedSignalRules: Array<{ id: string; description: string }>;
  violations: Array<{ ruleId: string; file: string; line: number; text: string }>;
  allowedSignals: Array<{ ruleId: string; file: string; line: number; text: string }>;
  scannedStrings: Array<{ kind: string; file: string; lineNumber: number; text: string }>;
}

const repoRoot = path.resolve(process.cwd(), '..');
const scanPath = path.join(repoRoot, 'engineering/sprints/platform-audit-p1/com-prospect-compliance-scan.json');

function scan(): ComplianceScan {
  return JSON.parse(readFileSync(scanPath, 'utf8')) as ComplianceScan;
}

describe('P1 COM prospect compliance scan', () => {
  it('has a current passing scanner artifact for apps/com', () => {
    const data = scan();
    expect(data.scope).toBe('apps/com/src visible strings plus shared compliance constants');
    expect(data.summary.filesScanned).toBeGreaterThanOrEqual(30);
    expect(data.summary.visibleStringsScanned).toBeGreaterThan(300);
    expect(data.summary.status).toBe('pass');
    expect(data.summary.blockingViolations).toBe(0);
    expect(data.violations).toEqual([]);
    expect(data.scannedStrings.length).toBe(data.summary.visibleStringsScanned);
  });

  it('tracks the expected blocker categories for prospect-facing compliance', () => {
    expect(scan().blockingRules.map((rule) => rule.id)).toEqual([
      'income_or_compensation_claim',
      'placement_or_spillover_promise',
      'ai_prospecting_or_qualification',
      'current_team_headcount',
      'three_company_branding',
      'programmatic_three_handoff',
    ]);
  });

  it('documents allowed PMV, product, market, goal, and placement-demo signals', () => {
    const data = scan();
    expect(data.allowedSignalRules.map((rule) => rule.id)).toEqual([
      'glp_three_product_context',
      'public_market_or_cost_context',
      'team_goal_context',
      'pmv_language_context',
      'placement_demo_context',
      'canonical_disclaimer',
    ]);
    for (const rule of data.allowedSignalRules) {
      expect(data.summary.allowedSignalsByRule[rule.id] ?? 0, rule.id).toBeGreaterThan(0);
    }
    expect(data.allowedSignals.length).toBe(data.summary.allowedSignals);
  });
});
