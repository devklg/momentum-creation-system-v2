import { describe, expect, it, vi } from 'vitest';
import { buildAdminLaunchReadiness } from '../adminLaunchReadiness.js';

describe('P2-98 admin launch readiness', () => {
  it('batch-composes factual states in neutral name order without writes', async () => {
    const byCollection: Record<string, Array<Record<string, unknown>>> = {
      team_magnificent_members: [
        { tmagId: 'TM-B', firstName: 'Zoe', lastName: 'Able', sponsorTmagId: 'TM-A' },
        { tmagId: 'TM-A', firstName: 'Amy', lastName: 'Baker', sponsorTmagId: null },
      ],
      tmag_new_member_orientation_reservations: [{ tmagId: 'TM-A', status: 'reserved' }],
      tmag_fast_start_progress: Array.from({ length: 5 }, (_, index) => ({ tmagId: 'TM-A', moduleId: index + 1, state: 'completed' })),
      tmag_prospects: [
        { prospectId: 'P-A', sponsorTmagId: 'TM-A', sentAt: '2026-07-01T00:00:00.000Z' },
        { prospectId: 'P-B', sponsorTmagId: 'TM-B', sentAt: null },
      ],
      tmag_steve_success_interview: [
        { tmagId: 'TM-A', completedAt: '2026-07-01T00:00:00.000Z', successProfile: { tmagId: 'TM-A' } },
        { tmagId: 'TM-B', completedAt: '2026-07-01T00:00:00.000Z', successProfile: { tmagId: 'WRONG' } },
      ],
      tmag_prospect_crm_records: [
        { prospectId: 'P-A', ownerTmagId: 'TM-A', sponsorTmagId: 'TM-A' },
      ],
    };
    const persistence = vi.fn(async (_tool: string, action: string, params: Record<string, unknown>) => {
      expect(action).toBe('query');
      return { documents: byCollection[String(params.collection)] ?? [] };
    });
    const result = await buildAdminLaunchReadiness({ persistence: persistence as never });

    expect(persistence).toHaveBeenCalledTimes(6);
    expect(result.policy).toBe('read_only_report_only');
    expect(result.rows.map((row) => row.tmagId)).toEqual(['TM-A', 'TM-B']);
    expect(result.rows[0]?.readiness.items.map((entry) => entry.domain)).toEqual([
      'orientation', 'training', 'invitations', 'success_profile', 'crm',
    ]);
    expect(result.rows[0]?.readiness.items.map((entry) => entry.status)).toEqual([
      'scheduled', 'complete', 'complete', 'complete', 'ready',
    ]);
    expect(result.rows[1]?.readiness.attentionDomains).toEqual(['success_profile', 'crm']);
    expect(result).not.toHaveProperty('score');
  });

  it('reports unavailable sources honestly and never infers orientation completion', async () => {
    const persistence = vi.fn(async (_tool: string, _action: string, params: Record<string, unknown>) => {
      if (params.collection === 'team_magnificent_members') {
        return { documents: [{ tmagId: 'TM-A', firstName: 'Amy', lastName: 'Baker' }] };
      }
      if (params.collection === 'tmag_new_member_orientation_reservations') return { documents: [] };
      if (params.collection === 'tmag_prospect_crm_records') throw new Error('offline');
      return { documents: [] };
    });
    const result = await buildAdminLaunchReadiness({ persistence: persistence as never });
    const states = Object.fromEntries(result.rows[0]!.readiness.items.map((entry) => [entry.domain, entry.status]));
    expect(states.orientation).toBe('source_unavailable');
    expect(states.crm).toBe('source_unavailable');
    expect(result.warnings).toHaveLength(1);
    expect(persistence.mock.calls.every((call) => call[1] === 'query')).toBe(true);
  });
});
