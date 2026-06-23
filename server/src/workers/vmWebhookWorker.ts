import { pathToFileURL } from 'node:url';
import {
  claimVmJobs,
  failVmJob,
  processWebhookEvent,
  type VmQueueJob,
  type VmProviderKey,
} from '../domain/vmProviderQueue.js';

const TICK_MS = 1000;
const BATCH = 20;

let workerStarted = false;
let timer: NodeJS.Timeout | null = null;
let tickInFlight = false;

export async function startVmWebhookWorker(): Promise<void> {
  if (workerStarted) return;
  workerStarted = true;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // eslint-disable-next-line no-console
  console.log(`[vmWebhookWorker] started — tick=${TICK_MS}ms batch=${BATCH}`);
}

export function stopVmWebhookWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
  workerStarted = false;
}

async function tick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const jobs = await claimVmJobs(['webhook_event'], BATCH);
    await Promise.all(
      jobs.map(async (job) => {
        try {
          await processWebhookEvent(job as VmQueueJob<{ webhookEventId: string; provider: VmProviderKey }>);
        } catch (err) {
          await failVmJob(job, err instanceof Error ? err.message : String(err));
        }
      }),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[vmWebhookWorker] tick failed', err);
  } finally {
    tickInFlight = false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startVmWebhookWorker();
}
