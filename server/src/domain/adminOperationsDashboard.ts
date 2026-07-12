import type { McsAdminOperationsDashboardResponse } from '@momentum/shared';
import { env } from '../env.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { readHealthStatusFile } from './healthProbe.js';
import { buildAdminOutboxHealth } from './adminOutboxHealth.js';
import { buildAdminVmOverview } from './adminVm.js';
import { getProjectionOutboxWorkerStatus } from '../services/projectionOutbox.js';
import { getBroadcastWorkerStatus } from '../services/broadcastQueue.js';
import { getVmDeliveryWorkerStatus } from '../workers/vmDeliveryWorker.js';
import { getVmImportWorkerStatus } from '../workers/vmImportWorker.js';
import { getVmWebhookWorkerStatus } from '../workers/vmWebhookWorker.js';

async function count(collection: string): Promise<number> {
  const result = await persistenceCall<{ count?: number; documents?: unknown[] }>('mongodb', 'query', {
    database: 'momentum', collection, filter: {}, projection: { _id: 1 }, limit: 1,
  });
  return result.count ?? result.documents?.length ?? 0;
}

export async function buildAdminOperationsDashboard(): Promise<McsAdminOperationsDashboardResponse> {
  const warnings: string[] = [];
  const [health, outbox, vm, sourceCount, chunkCount] = await Promise.all([
    readHealthStatusFile(env.HEALTH_STATUS_PATH).catch((err) => ({ ok: false, status: null, error: String(err) })),
    buildAdminOutboxHealth(),
    buildAdminVmOverview(),
    count('mcs_knowledge_sources').catch((err) => { warnings.push(`Knowledge sources unavailable: ${String(err)}`); return 0; }),
    count('mcs_knowledge_chunks').catch((err) => { warnings.push(`Knowledge chunks unavailable: ${String(err)}`); return 0; }),
  ]);
  const projectionWorker = getProjectionOutboxWorkerStatus();
  const deliveryWorker = getVmDeliveryWorkerStatus();
  const worker = (key: string, label: string, started: boolean, busy = false, detail = '') => ({
    key, label, status: !started ? 'stopped' as const : busy ? 'busy' as const : 'running' as const, detail,
  });
  const providers = vm.providerHealth;
  const delivered24h = providers.reduce((sum, row) => sum + row.delivered24h, 0);
  const failed24h = providers.reduce((sum, row) => sum + row.failed24h, 0);
  const pendingKnowledge = outbox.queue.byTier.knowledge;
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    workers: [
      worker('projection', 'Projection outbox', projectionWorker.started, projectionWorker.inFlight, `last success ${projectionWorker.lastSuccessAt ?? 'never'}`),
      worker('vm_import', 'VM import', getVmImportWorkerStatus().started),
      worker('vm_delivery', 'VM delivery', deliveryWorker.started, deliveryWorker.inFlight, `last dispatch ${deliveryWorker.lastDispatchAt ?? 'never'}`),
      worker('vm_webhook', 'VM webhook', getVmWebhookWorkerStatus().started),
      worker('broadcast', 'Broadcast', getBroadcastWorkerStatus().started),
    ],
    persistence: health.ok && health.status
      ? { status: health.status.overall === 'green' ? 'healthy' : 'degraded', checkedAt: health.status.checkedAt, detail: health.status.checks.map((item) => `${item.name}:${item.ok ? 'ok' : 'fail'}`).join(' · ') }
      : { status: 'unknown', checkedAt: null, detail: health.error ?? 'Health status unavailable.' },
    delivery: { status: providers.some((row) => row.status === 'warning') ? 'warning' : providers.every((row) => row.status === 'not_configured') ? 'not_configured' : 'healthy', delivered24h, failed24h, providers: providers.length },
    projections: { pending: outbox.queue.pending, due: outbox.queue.due, scheduled: outbox.queue.scheduled, deadLettered: outbox.queue.deadLettered, attempts: outbox.queue.attempts, oldestPendingAt: outbox.queue.oldestPendingAt },
    knowledge: { status: warnings.length > 0 ? 'degraded' : sourceCount > 0 && chunkCount > 0 ? 'ready' : 'empty', sources: sourceCount, chunks: chunkCount, pendingProjections: pendingKnowledge, detail: sourceCount > 0 && chunkCount > 0 ? 'Approved knowledge is available to retrieval.' : 'No approved knowledge corpus is active yet.' },
    warnings: [...warnings, ...vm.warnings],
  };
}
