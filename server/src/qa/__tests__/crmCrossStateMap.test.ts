import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CRM_CALLBACK_INTENTS,
  CRM_CALLBACK_STATE_MAPPINGS,
  CRM_CANONICAL_LIFECYCLE_STATES,
  CRM_CROSS_STATE_MAPPINGS,
  CRM_OUTCOME_STATE_MAPPINGS,
  CRM_RECORD_STATUS_MAPPINGS,
  CRM_TIMELINE_EVENT_KINDS,
  CRM_TIMELINE_STATE_MAPPINGS,
  CRM_TOKEN_STATE_MAPPINGS,
  CRM_VM_DELIVERY_STATUSES,
  CRM_VM_LEAD_STATUSES,
  CRM_VM_RVM_DELIVERY_STATE_MAPPINGS,
  CRM_VM_RVM_LEAD_STATE_MAPPINGS,
} from '@momentum/shared';

const repoRoot = path.resolve(__dirname, '../../../..');
const sharedTypesPath = path.join(repoRoot, 'packages/shared/src/types.ts');
const mapDocPath = path.join(
  repoRoot,
  'engineering/sprints/platform-audit-p1/CRM_CROSS_STATE_MAP.md',
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

function byRailState(mappings: readonly { sourceState: string }[]): string[] {
  return mappings.map((mapping) => mapping.sourceState);
}

describe('P1 CRM cross-state map', () => {
  it('maps every invitation token state to canonical CRM lifecycle states', () => {
    expect(byRailState(CRM_TOKEN_STATE_MAPPINGS)).toEqual(
      extractUnionMembers(readSharedTypes(), 'McsTokenState'),
    );
  });

  it('maps every CRM record status, callback intent, and timeline event kind', () => {
    const source = readSharedTypes();

    expect(byRailState(CRM_RECORD_STATUS_MAPPINGS)).toEqual(
      extractUnionMembers(source, 'McsProspectCrmStatus'),
    );
    expect(CRM_CALLBACK_INTENTS).toEqual(extractUnionMembers(source, 'McsCallbackIntent'));
    expect(byRailState(CRM_CALLBACK_STATE_MAPPINGS)).toEqual(CRM_CALLBACK_INTENTS);
    expect(CRM_TIMELINE_EVENT_KINDS).toEqual(
      extractUnionMembers(source, 'McsProspectTimelineEventKind'),
    );
    expect(byRailState(CRM_TIMELINE_STATE_MAPPINGS)).toEqual(CRM_TIMELINE_EVENT_KINDS);
  });

  it('maps every VM/RVM delivery and lead lifecycle state', () => {
    const source = readSharedTypes();

    expect(CRM_VM_DELIVERY_STATUSES).toEqual(
      extractUnionMembers(source, 'McsVmDeliveryStatus'),
    );
    expect(byRailState(CRM_VM_RVM_DELIVERY_STATE_MAPPINGS)).toEqual(
      CRM_VM_DELIVERY_STATUSES,
    );
    expect(CRM_VM_LEAD_STATUSES).toEqual(
      extractUnionMembers(source, 'McsVmLeadLifecycleStatus'),
    );
    const mappedLeadStates = byRailState(CRM_VM_RVM_LEAD_STATE_MAPPINGS);
    expect(new Set(mappedLeadStates)).toEqual(new Set(CRM_VM_LEAD_STATUSES));
    expect(mappedLeadStates).toHaveLength(CRM_VM_LEAD_STATUSES.length);
  });

  it('maps every disposition and closed reason outcome source state', () => {
    const source = readSharedTypes();
    const outcomeStates = new Set(byRailState(CRM_OUTCOME_STATE_MAPPINGS));

    for (const disposition of extractUnionMembers(source, 'McsCrmDisposition')) {
      expect(outcomeStates.has(disposition)).toBe(true);
    }
    for (const reason of extractUnionMembers(source, 'McsProspectCrmClosedReason')) {
      expect(outcomeStates.has(reason)).toBe(true);
    }
  });

  it('only points mappings at known canonical state ids', () => {
    const known = new Set(CRM_CANONICAL_LIFECYCLE_STATES.map((state) => state.id));

    for (const mapping of CRM_CROSS_STATE_MAPPINGS) {
      expect(mapping.canonicalStateIds.length).toBeGreaterThan(0);
      for (const stateId of mapping.canonicalStateIds) {
        expect(known.has(stateId)).toBe(true);
      }
    }
  });

  it('keeps callback, webinar, and follow-up as signal rails outside token states', () => {
    const signalStates = CRM_CANONICAL_LIFECYCLE_STATES.filter((state) =>
      ['callback_requested', 'webinar_reserved', 'follow_up_scheduled', 'follow_up_due'].includes(
        state.id,
      ),
    );

    for (const state of signalStates) {
      expect(state.tokenStates).toEqual([]);
    }
  });

  it('keeps the Markdown artifact aligned to the shared map', () => {
    const doc = fs.readFileSync(mapDocPath, 'utf8');

    expect(doc).toContain('Source of truth: `packages/shared/src/crm-lifecycle.ts`');
    for (const rail of [
      'Invitation token',
      'Prospect account',
      'CRM record',
      'Callback',
      'Webinar',
      'VM/RVM delivery',
      'VM/RVM lead',
      'Outcome',
    ]) {
      expect(doc).toContain(`| ${rail} |`);
    }
  });
});
