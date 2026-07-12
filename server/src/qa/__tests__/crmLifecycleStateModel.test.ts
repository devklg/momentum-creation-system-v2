import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CRM_CANONICAL_LIFECYCLE_STATES,
  CRM_CLOSED_REASONS,
  CRM_DISPOSITIONS,
  CRM_FOLLOW_UP_STATES,
  CRM_LIFECYCLE_MODEL,
  CRM_PROSPECT_LIFECYCLE_STAGES,
  CRM_RECORD_STATUSES,
  CRM_TIMELINE_EVENT_KINDS,
  CRM_TOKEN_STATES,
  CRM_VM_LEAD_STATUSES,
  MCS_VM_LEAD_LIFECYCLE_STATUSES,
} from '@momentum/shared';

const repoRoot = path.resolve(__dirname, '../../../..');
const sharedTypesPath = path.join(repoRoot, 'packages/shared/src/types.ts');
const modelDocPath = path.join(
  repoRoot,
  'engineering/sprints/platform-audit-p1/CRM_LIFECYCLE_STATE_MODEL.md',
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

describe('P1 CRM lifecycle state model', () => {
  it('keeps runtime state arrays aligned to the shared CRM/token/PMV unions', () => {
    const source = readSharedTypes();

    expect(CRM_TOKEN_STATES).toEqual(extractUnionMembers(source, 'McsTokenState'));
    expect(CRM_PROSPECT_LIFECYCLE_STAGES).toEqual(
      extractUnionMembers(source, 'McsProspectLifecycleStage'),
    );
    expect(CRM_RECORD_STATUSES).toEqual(
      extractUnionMembers(source, 'McsProspectCrmStatus'),
    );
    expect(CRM_DISPOSITIONS).toEqual(extractUnionMembers(source, 'McsCrmDisposition'));
    expect(CRM_CLOSED_REASONS).toEqual(
      extractUnionMembers(source, 'McsProspectCrmClosedReason'),
    );
    expect(CRM_TIMELINE_EVENT_KINDS).toEqual(
      extractUnionMembers(source, 'McsProspectTimelineEventKind'),
    );
    expect(CRM_VM_LEAD_STATUSES).toEqual(
      extractUnionMembers(source, 'McsVmLeadLifecycleStatus'),
    );
    expect(CRM_VM_LEAD_STATUSES).toEqual(MCS_VM_LEAD_LIFECYCLE_STATUSES);
  });

  it('defines a canonical state for every current CRM status and terminal PMV outcome', () => {
    const coveredCrmStatuses = new Set(
      CRM_CANONICAL_LIFECYCLE_STATES.flatMap((state) => state.crmStatuses),
    );
    for (const status of CRM_RECORD_STATUSES) {
      expect(coveredCrmStatuses.has(status)).toBe(true);
    }

    const coveredPmvStages = new Set(
      CRM_CANONICAL_LIFECYCLE_STATES.flatMap((state) => state.pmvStages),
    );
    for (const terminal of ['customer', 'enrolled', 'expired', 'archived'] as const) {
      expect(coveredPmvStages.has(terminal)).toBe(true);
    }
  });

  it('keeps signal-only states out of the token rail', () => {
    const byId = new Map(CRM_CANONICAL_LIFECYCLE_STATES.map((state) => [state.id, state]));

    expect(byId.get('callback_requested')?.tokenStates).toEqual([]);
    expect(byId.get('follow_up_due')?.tokenStates).toEqual([]);
    expect(byId.get('webinar_reserved')?.tokenStates).toEqual([]);
    expect(CRM_TOKEN_STATES).not.toContain('callback_requested');
    expect(CRM_TOKEN_STATES).not.toContain('webinar_reserved');
  });

  it('names every follow-up state used by the model', () => {
    const known = new Set(CRM_FOLLOW_UP_STATES);
    for (const state of CRM_CANONICAL_LIFECYCLE_STATES) {
      expect(state.followUpStates.length).toBeGreaterThan(0);
      for (const followUpState of state.followUpStates) {
        expect(known.has(followUpState)).toBe(true);
      }
    }
  });

  it('keeps the Markdown artifact aligned to the shared model', () => {
    const doc = fs.readFileSync(modelDocPath, 'utf8');

    expect(doc).toContain('Source of truth: `packages/shared/src/crm-lifecycle.ts`');
    expect(CRM_LIFECYCLE_MODEL.purpose).toMatch(/Canonical CRM lifecycle model/i);
    for (const state of CRM_CANONICAL_LIFECYCLE_STATES) {
      expect(doc).toContain(`| \`${state.id}\` |`);
    }
  });
});
