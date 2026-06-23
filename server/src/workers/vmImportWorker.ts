import { pathToFileURL } from 'node:url';
import {
  claimVmJobs,
  failVmJob,
  processCrmCreation,
  processImportChunk,
  processSuppressionCheck,
  processTokenGeneration,
  type VmQueueJob,
} from '../domain/vmProviderQueue.js';

const TICK_MS = 1000;
const BATCH = 10;

let workerStarted = false;
let timer: NodeJS.Timeout | null = null;
let tickInFlight = false;

export async function startVmImportWorker(): Promise<void> {
  if (workerStarted) return;
  workerStarted = true;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // eslint-disable-next-line no-console
  console.log(`[vmImportWorker] started — tick=${TICK_MS}ms batch=${BATCH}`);
}

export function stopVmImportWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
  workerStarted = false;
}

async function tick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const jobs = await claimVmJobs(
      ['import_validate', 'suppression_check', 'token_generate', 'crm_create'],
      BATCH,
    );
    await Promise.all(jobs.map(dispatch));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[vmImportWorker] tick failed', err);
  } finally {
    tickInFlight = false;
  }
}

async function dispatch(job: VmQueueJob): Promise<void> {
  try {
    switch (job.kind) {
      case 'import_validate':
        await processImportChunk(job as Parameters<typeof processImportChunk>[0]);
        break;
      case 'suppression_check':
        await processSuppressionCheck(job as Parameters<typeof processSuppressionCheck>[0]);
        break;
      case 'token_generate':
        await processTokenGeneration(job as Parameters<typeof processTokenGeneration>[0]);
        break;
      case 'crm_create':
        await processCrmCreation(job as Parameters<typeof processCrmCreation>[0]);
        break;
      default:
        await failVmJob(job, `unsupported_import_worker_kind:${job.kind}`);
    }
  } catch (err) {
    await failVmJob(job, err instanceof Error ? err.message : String(err));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startVmImportWorker();
}
