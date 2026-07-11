import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PMV_CONCEPTS,
  PMV_CONTRACT,
  PMV_EVENT_IDS,
  PMV_FORBIDDEN_LANGUAGE_CATEGORIES,
  PMV_LAST_SIGNAL_KINDS,
  PMV_LIFECYCLE_STAGES,
  PMV_NEXT_ACTION_KINDS,
  PMV_NEXT_ACTION_SCRIPT_KINDS,
  PMV_ROW_FIELDS,
} from '@momentum/shared';

const repoRoot = path.resolve(__dirname, '../../../..');
const sharedTypesPath = path.join(repoRoot, 'packages/shared/src/types.ts');
const contractDocPath = path.join(
  repoRoot,
  'engineering/sprints/platform-audit-p1/PMV_CONTRACT.md',
);

function readSharedTypes(): string {
  return fs.readFileSync(sharedTypesPath, 'utf8');
}

function extractUnionMembers(source: string, typeName: string): string[] {
  const match = source.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
  if (!match?.[1]) throw new Error(`Missing ${typeName}`);
  return Array.from(match[1].matchAll(/'([^']+)'/g), (m) => {
    const value = m[1];
    if (!value) throw new Error(`Malformed union member in ${typeName}`);
    return value;
  });
}

function extractInterfaceFields(source: string, interfaceName: string): string[] {
  const match = source.match(new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`));
  if (!match?.[1]) throw new Error(`Missing ${interfaceName}`);
  return Array.from(match[1].matchAll(/^  ([A-Za-z]\w*)\??:/gm), (m) => {
    const value = m[1];
    if (!value) throw new Error(`Malformed interface field in ${interfaceName}`);
    return value;
  });
}

describe('P1 PMV contract', () => {
  it('maps every current PMV lifecycle, next-action, script, and last-signal union member', () => {
    const source = readSharedTypes();

    expect(PMV_LIFECYCLE_STAGES).toEqual(
      extractUnionMembers(source, 'McsProspectLifecycleStage'),
    );
    expect(PMV_NEXT_ACTION_KINDS).toEqual(
      extractUnionMembers(source, 'McsProspectNextActionKind'),
    );
    expect(PMV_NEXT_ACTION_SCRIPT_KINDS).toEqual(
      extractUnionMembers(source, 'McsProspectNextActionScriptKind'),
    );
    expect(PMV_LAST_SIGNAL_KINDS).toEqual(
      extractUnionMembers(source, 'McsProspectLastSignalKind'),
    );
  });

  it('maps every field exposed on the PMV row contract', () => {
    const rowFields = extractInterfaceFields(readSharedTypes(), 'McsProspectMomentumRow');

    expect(PMV_ROW_FIELDS).toEqual(rowFields);
  });

  it('maps concepts to allowed language, forbidden language, fields, and events', () => {
    expect(PMV_CONTRACT.route).toBe('/api/cockpit/pmv');
    expect(PMV_CONTRACT.purpose).toMatch(/awareness without surveillance/i);
    expect(PMV_CONCEPTS.map((c) => c.id)).toEqual([
      'people',
      'momentum',
      'volume',
      'checks',
      'next_action',
    ]);

    for (const concept of PMV_CONCEPTS) {
      expect(concept.allowedLanguage.length).toBeGreaterThan(0);
      expect(concept.forbiddenLanguage.length).toBeGreaterThan(0);
      expect(concept.fields).toBeDefined();
      expect(concept.events).toBeDefined();
    }

    expect(PMV_EVENT_IDS).toContain('video_complete');
    expect(PMV_EVENT_IDS).toContain('callback_requested');
    expect(PMV_EVENT_IDS).toContain('follow_up_due');
  });

  it('names the required PMV forbidden language categories', () => {
    expect(PMV_FORBIDDEN_LANGUAGE_CATEGORIES.map((c) => c.id)).toEqual([
      'income_or_checks_claims',
      'comp_plan_or_cycle_math',
      'placement_or_spillover_promises',
      'scoring_or_qualification',
      'surveillance_or_pressure',
      'current_team_headcount_or_company_handoff',
    ]);
  });

  it('keeps the Markdown audit artifact aligned to the shared contract concepts', () => {
    const doc = fs.readFileSync(contractDocPath, 'utf8');

    expect(doc).toContain('Source of truth: `packages/shared/src/pmv-contract.ts`');
    for (const concept of PMV_CONCEPTS) {
      expect(doc).toContain(`| ${concept.name} |`);
    }
  });
});
