import express, { type NextFunction, type Request, type Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findVMCampaignById: vi.fn(),
  setVMCampaignLiveApproval: vi.fn(),
  appendAuditEntry: vi.fn(),
}));

vi.mock('../../../middleware/requireAuth.js', () => ({
  requireAdmin: (req: Request, res: Response, next: NextFunction) => {
    if (req.header('x-admin') !== 'true') {
      res.status(403).json({ ok: false, error: 'Not found.' });
      return;
    }
    req.session = { tmagId: 'TMBA-ADMIN', threeBaId: 'THREE-ADMIN' } as Request['session'];
    next();
  },
}));

vi.mock('../../../domain/vmCampaigns.js', () => ({
  findVMCampaignById: mocks.findVMCampaignById,
  setVMCampaignLiveApproval: mocks.setVMCampaignLiveApproval,
}));

vi.mock('../../../domain/auditLog.js', () => ({
  appendAuditEntry: mocks.appendAuditEntry,
}));

vi.mock('../../../domain/adminVm.js', () => ({
  buildAdminVmOverview: vi.fn(),
}));

function app() {
  const instance = express();
  instance.use(express.json());
  return import('../vm.js').then(({ adminVmRoutes }) => {
    instance.use('/api/admin/vm', adminVmRoutes);
    return instance;
  });
}

async function postJson(path: string, body: unknown, admin = true) {
  const instance = await app();
  const server = instance.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('listen_failed');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(admin ? { 'x-admin': 'true' } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

beforeEach(() => {
  mocks.findVMCampaignById.mockReset();
  mocks.setVMCampaignLiveApproval.mockReset();
  mocks.appendAuditEntry.mockReset();
  mocks.findVMCampaignById.mockResolvedValue({
    vmCampaignId: 'vm_1',
    ownerTmagId: 'TMBA-1',
    name: 'Campaign',
    adminApprovedForLiveDelivery: false,
  });
  mocks.setVMCampaignLiveApproval.mockResolvedValue({
    ok: true,
    vmCampaignId: 'vm_1',
    adminApprovedForLiveDelivery: true,
  });
  mocks.appendAuditEntry.mockResolvedValue({ entryId: 'audit_1' });
});

describe('POST /api/admin/vm/campaigns/:vmCampaignId/live-approval', () => {
  it('rejects a BA/non-admin before mutating approval', async () => {
    const result = await postJson(
      '/api/admin/vm/campaigns/vm_1/live-approval',
      { vmCampaignId: 'vm_1', approved: true },
      false,
    );

    expect(result.status).toBe(403);
    expect(mocks.setVMCampaignLiveApproval).not.toHaveBeenCalled();
    expect(mocks.appendAuditEntry).not.toHaveBeenCalled();
  });

  it('persists the live approval flag and appends an audit entry', async () => {
    const result = await postJson('/api/admin/vm/campaigns/vm_1/live-approval', {
      vmCampaignId: 'vm_1',
      approved: true,
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      ok: true,
      vmCampaignId: 'vm_1',
      adminApprovedForLiveDelivery: true,
    });
    expect(mocks.setVMCampaignLiveApproval).toHaveBeenCalledWith({
      vmCampaignId: 'vm_1',
      approved: true,
      adminTmagId: 'TMBA-ADMIN',
    });
    expect(mocks.appendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.vm.live_delivery.approved',
        before: { adminApprovedForLiveDelivery: false },
        after: expect.objectContaining({ adminApprovedForLiveDelivery: true }),
      }),
    );
  });
});
