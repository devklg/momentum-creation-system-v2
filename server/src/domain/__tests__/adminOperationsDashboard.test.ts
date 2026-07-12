import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.fn();
vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall: persistence }));
vi.mock('../healthProbe.js', () => ({ readHealthStatusFile: vi.fn(async () => ({ ok: true, error: null, status: { checkedAt: '2026-07-12T12:00:00.000Z', overall: 'green', checks: [{ name: 'mongo', ok: true, detail: 'ok' }] } })) }));
vi.mock('../adminOutboxHealth.js', () => ({ buildAdminOutboxHealth: vi.fn(async () => ({ queue: { pending: 2, due: 1, scheduled: 1, deadLettered: 0, attempts: 3, oldestPendingAt: '2026-07-12T11:00:00.000Z', byTier: { knowledge: 1, operational: 1 } } })) }));
vi.mock('../adminVm.js', () => ({ buildAdminVmOverview: vi.fn(async () => ({ providerHealth: [{ status: 'healthy', delivered24h: 8, failed24h: 1 }], warnings: [] })) }));
vi.mock('../../services/projectionOutbox.js', () => ({ getProjectionOutboxWorkerStatus: () => ({ started: true, inFlight: false, lastSuccessAt: '2026-07-12T12:00:00.000Z' }) }));
vi.mock('../../services/broadcastQueue.js', () => ({ getBroadcastWorkerStatus: () => ({ started: true }) }));
vi.mock('../../workers/vmDeliveryWorker.js', () => ({ getVmDeliveryWorkerStatus: () => ({ started: true, inFlight: true, lastDispatchAt: null }) }));
vi.mock('../../workers/vmImportWorker.js', () => ({ getVmImportWorkerStatus: () => ({ started: true }) }));
vi.mock('../../workers/vmWebhookWorker.js', () => ({ getVmWebhookWorkerStatus: () => ({ started: true }) }));
vi.mock('../../env.js', () => ({ env: { HEALTH_STATUS_PATH: 'health.json' } }));

describe('buildAdminOperationsDashboard', () => {
  beforeEach(() => {
    persistence.mockReset().mockResolvedValueOnce({ count: 4 }).mockResolvedValueOnce({ count: 12 });
  });

  it('composes worker, persistence, delivery, projection, and knowledge readiness', async () => {
    const { buildAdminOperationsDashboard } = await import('../adminOperationsDashboard.js');
    const result = await buildAdminOperationsDashboard();
    expect(result.persistence.status).toBe('healthy');
    expect(result.delivery).toMatchObject({ delivered24h: 8, failed24h: 1 });
    expect(result.projections).toMatchObject({ pending: 2, due: 1 });
    expect(result.knowledge).toMatchObject({ status: 'ready', sources: 4, chunks: 12 });
    expect(result.workers).toHaveLength(5);
    expect(result.workers.find((row) => row.key === 'vm_delivery')?.status).toBe('busy');
  });
});
