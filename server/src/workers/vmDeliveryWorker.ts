import { pathToFileURL } from 'node:url';
import { env } from '../env.js';
import { gatewayCall } from '../services/gateway.js';
import { getVmProvider } from '../services/vmProviders/index.js';
import {
  claimVmJobs,
  completeVmJob,
  failVmJob,
  findLead,
  recordDeliveryEvent,
  updateLeadStatus,
  type VmProviderKey,
  type VmQueueJob,
} from '../domain/vmProviderQueue.js';

const MONGO_DB = 'momentum';
const CAMPAIGNS_COLLECTION = 'vm_campaigns';
const TICK_MS = 1000;
const BATCH = 10;

let workerStarted = false;
let timer: NodeJS.Timeout | null = null;
let tickInFlight = false;
let lastDispatchAt = 0;

interface DeliveryPayload extends Record<string, unknown> {
  leadId: string;
  provider?: VmProviderKey;
}

interface VmCampaignDoc {
  vmCampaignId: string;
  provider?: VmProviderKey;
  adminApprovedForLiveDelivery?: boolean;
}

export async function startVmDeliveryWorker(): Promise<void> {
  if (workerStarted) return;
  workerStarted = true;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // eslint-disable-next-line no-console
  console.log(
    `[vmDeliveryWorker] started — tick=${TICK_MS}ms batch=${BATCH} rate=${env.VM_DELIVERY_RATE_PER_MINUTE}/min live=${env.VM_LIVE_DELIVERY_ENABLED}`,
  );
}

export function stopVmDeliveryWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
  workerStarted = false;
}

async function tick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const jobs = await claimVmJobs(['delivery'], BATCH);
    for (const job of jobs) {
      await throttle();
      await dispatch(job as VmQueueJob<DeliveryPayload>);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[vmDeliveryWorker] tick failed', err);
  } finally {
    tickInFlight = false;
  }
}

async function throttle(): Promise<void> {
  const minGap = Math.ceil(60_000 / env.VM_DELIVERY_RATE_PER_MINUTE);
  const wait = Math.max(0, minGap - (Date.now() - lastDispatchAt));
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastDispatchAt = Date.now();
}

async function dispatch(job: VmQueueJob<DeliveryPayload>): Promise<void> {
  try {
    const lead = await findLead(job.payload.leadId);
    if (!lead) throw new Error('lead_not_found');
    if (!lead.token) {
      await completeVmJob(job.jobId, `Lead ${lead.leadId} has no token; delivery skipped.`);
      return;
    }
    if (!lead.normalizedPhone) {
      await updateLeadStatus(lead.leadId, 'delivery_dry_run', { reason: 'no_phone', ownerTmagId: lead.ownerTmagId });
      await completeVmJob(job.jobId, `Lead ${lead.leadId} has no phone; delivery skipped.`);
      return;
    }

    const campaign = await findCampaign(lead.vmCampaignId);
    const providerKey = job.payload.provider ?? campaign?.provider ?? env.VM_PROVIDER_MODE;
    const provider = getVmProvider(providerKey);
    const tokenUrl = `${env.PROSPECT_BASE_URL.replace(/\/$/, '')}/rvm/${lead.token}`;
    const adminApprovedForLiveDelivery = campaign?.adminApprovedForLiveDelivery === true;
    const dryRun = !env.VM_LIVE_DELIVERY_ENABLED || !adminApprovedForLiveDelivery || provider.key === 'manual_csv';

    const result = await provider.sendDrop({
      lead,
      tokenUrl,
      campaignId: lead.vmCampaignId,
      dryRun,
      adminApprovedForLiveDelivery,
    });

    await recordDeliveryEvent({
      provider: result.provider,
      leadId: lead.leadId,
      vmCampaignId: lead.vmCampaignId,
      ownerTmagId: lead.ownerTmagId,
      status: result.status,
      providerMessageId: result.providerMessageId,
      providerStatus: result.status,
      dryRun: result.dryRun,
      attempt: job.attempts,
      details: result.details,
    });

    const nextStatus =
      result.status === 'manual_export_ready'
        ? 'manual_exported'
        : result.status === 'dry_run'
          ? 'delivery_dry_run'
          : result.status;
    await updateLeadStatus(lead.leadId, nextStatus, { ownerTmagId: lead.ownerTmagId });
    await completeVmJob(job.jobId, `Delivery processed for VM lead ${lead.leadId}: ${result.status}.`);
  } catch (err) {
    await failVmJob(job, err instanceof Error ? err.message : String(err));
  }
}

async function findCampaign(vmCampaignId: string): Promise<VmCampaignDoc | null> {
  const result = await gatewayCall<{ documents: VmCampaignDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: CAMPAIGNS_COLLECTION,
    filter: { vmCampaignId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startVmDeliveryWorker();
}
