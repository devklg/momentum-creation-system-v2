import express, { type NextFunction, type Request, type Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class LeadOwnerError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  class VMCampaignError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  return {
    LeadOwnerError,
    VMCampaignError,
    findLeadOwnerForOwner: vi.fn(),
    listLeadOwnersForOwner: vi.fn(),
    createLeadOwner: vi.fn(),
    findVMCampaignForOwner: vi.fn(),
    listVMCampaignsForOwner: vi.fn(),
    createVMCampaign: vi.fn(),
    patchVMCampaignStatusForOwner: vi.fn(),
    createManualImportJobs: vi.fn(),
  };
});

vi.mock('../../middleware/requireAuth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.session = { tmagId: 'TMBA-1', threeBaId: 'THREE-1' } as Request['session'];
    next();
  },
}));

vi.mock('../../middleware/requireSteveComplete.js', () => ({
  requireSteveComplete: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/requireVmDialerAccess.js', () => ({
  requireVmDialerAccess: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../domain/vmLeadOwners.js', () => ({
  LeadOwnerError: mocks.LeadOwnerError,
  findLeadOwnerForOwner: mocks.findLeadOwnerForOwner,
  listLeadOwnersForOwner: mocks.listLeadOwnersForOwner,
  createLeadOwner: mocks.createLeadOwner,
}));

vi.mock('../../domain/vmCampaigns.js', () => ({
  VMCampaignError: mocks.VMCampaignError,
  findVMCampaignForOwner: mocks.findVMCampaignForOwner,
  listVMCampaignsForOwner: mocks.listVMCampaignsForOwner,
  createVMCampaign: mocks.createVMCampaign,
  patchVMCampaignStatusForOwner: mocks.patchVMCampaignStatusForOwner,
}));

vi.mock('../../domain/vmProviderQueue.js', () => ({
  createManualImportJobs: mocks.createManualImportJobs,
}));

vi.mock('../../domain/vmManualExport.js', () => ({
  buildManualExportCsv: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: vi.fn(),
}));

function app() {
  const instance = express();
  instance.use(express.json());
  return import('../vm.js').then(({ vmRoutes }) => {
    instance.use('/api/vm', vmRoutes);
    return instance;
  });
}

function baseCampaign() {
  return {
    vmCampaignId: 'vm_1',
    ownerTmagId: 'TMBA-1',
    sponsorTmagId: 'TMBA-1',
    leadOwnerId: 'lo_1',
    name: 'Campaign',
    provider: 'manual_csv',
    status: 'draft',
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

async function postJson(path: string, body: unknown) {
  const instance = await app();
  const server = instance.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('listen_failed');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

beforeEach(() => {
  Object.values(mocks).forEach((value) => {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
  });
  mocks.findLeadOwnerForOwner.mockResolvedValue({ leadOwnerId: 'lo_1', ownerTmagId: 'TMBA-1' });
  mocks.findVMCampaignForOwner.mockResolvedValue(baseCampaign());
  mocks.createManualImportJobs.mockResolvedValue({
    importJobId: 'vmimport_1',
    chunksQueued: 1,
    rowsAccepted: 1,
  });
});

describe('POST /api/vm/lead-owners/:leadOwnerId/import', () => {
  it('queues import_validate jobs through the VM provider queue contract', async () => {
    const result = await postJson('/api/vm/lead-owners/lo_1/import', {
      vmCampaignId: 'vm_1',
      leads: [
        {
          firstName: 'Pat',
          lastName: 'Lead',
          phone: '3235550100',
          email: null,
          city: 'Los Angeles',
          stateOrRegion: 'CA',
        },
      ],
    });

    expect(result.status).toBe(201);
    expect(result.body).toEqual({
      ok: true,
      importJobId: 'vmimport_1',
      chunksQueued: 1,
      rowsAccepted: 1,
    });
    expect(mocks.createManualImportJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerTmagId: 'TMBA-1',
        sponsorTmagId: 'TMBA-1',
        leadOwnerId: 'lo_1',
        vmCampaignId: 'vm_1',
        sourceLabel: 'manual_csv',
        createdBy: 'TMBA-1',
      }),
    );
  });

  it('enforces campaign and lead-owner ownership before queueing', async () => {
    mocks.findVMCampaignForOwner.mockResolvedValueOnce({
      ...baseCampaign(),
      leadOwnerId: 'lo_other',
    });

    const result = await postJson('/api/vm/lead-owners/lo_1/import', {
      vmCampaignId: 'vm_1',
      leads: [
        {
          firstName: 'Pat',
          lastName: 'Lead',
          city: 'Los Angeles',
          stateOrRegion: 'CA',
        },
      ],
    });

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ ok: false, error: 'campaign_lead_owner_mismatch' });
    expect(mocks.createManualImportJobs).not.toHaveBeenCalled();
  });
});
