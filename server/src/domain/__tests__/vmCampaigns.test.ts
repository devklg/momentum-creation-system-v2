import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McsVMCampaignRecord, McsVmCampaignStatusAction } from '@momentum/shared';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  vmAudit: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../vmProviderQueue.js', () => ({
  vmAudit: mocks.vmAudit,
}));

function campaign(status: McsVMCampaignRecord['status']): McsVMCampaignRecord {
  return {
    vmCampaignId: `vm_${status}`,
    ownerTmagId: 'TMBA-1',
    sponsorTmagId: 'TMBA-1',
    leadOwnerId: 'lo_1',
    name: 'Test Campaign',
    provider: 'manual_csv',
    status,
    voicemailAudioId: null,
    audioUrl: null,
    smsTemplateId: null,
    emailTemplateId: null,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
  };
}

function arrange(current: McsVMCampaignRecord) {
  mocks.persistenceCall.mockImplementation(async (tool: string, action: string) => {
    if (tool === 'mongodb' && action === 'query') {
      return { documents: [current], count: 1 };
    }
    if (tool === 'mongodb' && action === 'aggregate') {
      return { results: [], count: 0 };
    }
    return { ok: true, documents: [], results: [] };
  });
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.vmAudit.mockReset();
});

describe('VM campaign transition table', () => {
  it.each([
    ['draft', 'ready', 'ready'],
    ['ready', 'schedule', 'scheduled'],
    ['ready', 'start', 'running'],
    ['scheduled', 'start', 'running'],
    ['scheduled', 'cancel', 'cancelled'],
    ['running', 'pause', 'paused'],
    ['running', 'cancel', 'cancelled'],
    ['paused', 'resume', 'running'],
    ['paused', 'cancel', 'cancelled'],
  ] as Array<[McsVMCampaignRecord['status'], McsVmCampaignStatusAction, McsVMCampaignRecord['status']]>)(
    'allows %s -> %s',
    async (from, action, expected) => {
      arrange(campaign(from));
      const { patchVMCampaignStatusForOwner } = await import('../vmCampaigns.js');

      const updated = await patchVMCampaignStatusForOwner({
        vmCampaignId: 'vm_1',
        ownerTmagId: 'TMBA-1',
        action,
        scheduledAt: action === 'schedule' ? '2026-07-10T00:00:00.000Z' : null,
      });

      expect(updated.status).toBe(expected);
      expect(mocks.persistenceCall).toHaveBeenCalledWith(
        'mongodb',
        'update',
        expect.objectContaining({
          collection: 'tmag_vm_campaigns',
          update: expect.objectContaining({
            $set: expect.objectContaining({ status: expected }),
          }),
        }),
      );
      expect(mocks.vmAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'vm.campaign.status_changed',
          payload: expect.objectContaining({ beforeStatus: from, afterStatus: expected }),
        }),
      );
    },
  );

  it.each([
    ['draft', 'start'],
    ['draft', 'pause'],
    ['ready', 'pause'],
    ['scheduled', 'pause'],
    ['running', 'ready'],
    ['completed', 'start'],
  ] as Array<[McsVMCampaignRecord['status'], McsVmCampaignStatusAction]>)(
    'rejects illegal %s -> %s',
    async (from, action) => {
      arrange(campaign(from));
      const { patchVMCampaignStatusForOwner, VMCampaignError } = await import('../vmCampaigns.js');

      await expect(
        patchVMCampaignStatusForOwner({
          vmCampaignId: 'vm_1',
          ownerTmagId: 'TMBA-1',
          action,
        }),
      ).rejects.toBeInstanceOf(VMCampaignError);
      await expect(
        patchVMCampaignStatusForOwner({
          vmCampaignId: 'vm_1',
          ownerTmagId: 'TMBA-1',
          action,
        }),
      ).rejects.toMatchObject({ code: 'illegal_transition' });
    },
  );
});
