import { describe, expect, it, vi } from 'vitest';
import { buildCrmIntegrityReport } from '../crmIntegrityReport.js';

describe('P1-58 CRM integrity report', () => {
  it('reports stuck, duplicate, orphaned, inconsistent, and ambiguous rows without mutation', async () => {
    const old = '2026-01-01T00:00:00.000Z';
    const crm = [
      { crmRecordId: 'crm_1', prospectId: 'p1', ownerTmagId: 'BA2', sponsorTmagId: 'BA1', status: 'active', followUpDueAt: null, updatedAt: old },
      { crmRecordId: 'crm_2', prospectId: 'p1', ownerTmagId: 'BA1', sponsorTmagId: 'BA1', status: 'active', followUpDueAt: null, updatedAt: old },
      { crmRecordId: 'crm_orphan', prospectId: 'missing', ownerTmagId: 'BA1', sponsorTmagId: 'BA1', status: 'active', followUpDueAt: null, updatedAt: old },
      { crmRecordId: 'crm_ambiguous', status: 'active', updatedAt: old },
    ];
    const followUps = [
      { followUpId: 'f1', prospectId: 'p1', sponsorTmagId: 'BA1', dueAt: old, clearedAt: null },
      { followUpId: 'f2', prospectId: 'p1', sponsorTmagId: 'BA1', dueAt: old, clearedAt: null },
      { followUpId: 'f3', prospectId: 'missing2', sponsorTmagId: 'BA1', dueAt: old, clearedAt: null },
    ];
    const prospects = [{ prospectId: 'p1', state: 'enrolled' }];
    const persistence = vi.fn(async (tool: string, action: string, params: Record<string, unknown>) => {
      expect(tool).toBe('mongodb');
      expect(action).toBe('query');
      if (params.collection === 'tmag_prospect_crm_records') return { documents: crm };
      if (params.collection === 'tmag_prospect_crm_followups') return { documents: followUps };
      if (params.collection === 'tmag_prospects') return { documents: prospects };
      throw new Error(`unexpected collection ${params.collection}`);
    });

    const report = await buildCrmIntegrityReport({
      now: () => new Date('2026-07-11T00:00:00.000Z'),
      persistence: persistence as never,
    });

    expect(report.policy).toBe('report_only');
    expect(report.findings.every((row) => row.repairPolicy === 'report_only')).toBe(true);
    expect(report.totals).toMatchObject({ stuck: 4, duplicate: 2, orphan: 3, ambiguous: 1 });
    expect(report.totals.inconsistent).toBeGreaterThanOrEqual(3);
    expect(persistence.mock.calls.every((call) => call[1] === 'query')).toBe(true);
  });

  it('uses elapsed time only to report a stuck candidate', async () => {
    const persistence = vi.fn()
      .mockResolvedValueOnce({ documents: [{ crmRecordId: 'crm_1', prospectId: 'p1', ownerTmagId: 'BA1', sponsorTmagId: 'BA1', status: 'active', followUpDueAt: null, updatedAt: '2020-01-01T00:00:00.000Z' }] })
      .mockResolvedValueOnce({ documents: [] })
      .mockResolvedValueOnce({ documents: [{ prospectId: 'p1', state: 'video_complete' }] })
      .mockResolvedValueOnce({ documents: [{ crmRecordId: 'crm_1', prospectId: 'p1', ownerTmagId: 'BA1', sponsorTmagId: 'BA1', status: 'active', followUpDueAt: null }] })
      .mockResolvedValueOnce({ documents: [] })
      .mockResolvedValueOnce({ documents: [{ prospectId: 'p1', state: 'video_complete' }] });
    const report = await buildCrmIntegrityReport({ persistence: persistence as never });
    expect(report.findings).toEqual([expect.objectContaining({ category: 'stuck', code: 'open_crm_without_recent_change' })]);
    expect(persistence.mock.calls.every((call) => call[1] === 'query')).toBe(true);
  });
});
