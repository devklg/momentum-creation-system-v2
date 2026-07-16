import { pathToFileURL } from 'node:url';
import { env } from '../env.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { getVmProvider } from '../services/vmProviders/index.js';
import {
  claimVmJobs,
  completeVmJob,
  failVmJob,
  findLead,
  isDoNotDropLead,
  requeueVmJobWithoutBurningAttempt,
  recordDeliveryEvent,
  skipVmJob,
  updateLeadStatus,
  vmAudit,
  type VmQueueJob,
} from '../domain/vmProviderQueue.js';
import {
  completeRunningCampaignIfIdle,
  startScheduledCampaignForWorker,
} from '../domain/vmCampaigns.js';
import { getTransferAvailability } from '../domain/vmLiveTransfer.js';
import type { McsVMCampaignRecord } from '@momentum/shared';

const MONGO_DB = 'momentum';
const CAMPAIGNS_COLLECTION = 'tmag_vm_campaigns';
const TICK_MS = 1000;
const BATCH = 10;

let workerStarted = false;
let timer: NodeJS.Timeout | null = null;
let tickInFlight = false;
let lastDispatchAt = 0;

export function getVmDeliveryWorkerStatus() {
  return { started: workerStarted, inFlight: tickInFlight, tickMs: TICK_MS, batchSize: BATCH, lastDispatchAt: lastDispatchAt > 0 ? new Date(lastDispatchAt).toISOString() : null };
}

interface DeliveryPayload extends Record<string, unknown> {
  leadId: string;
  provider?: unknown;
}

interface VmCampaignDoc {
  vmCampaignId: string;
  provider?: unknown;
  adminApprovedForLiveDelivery?: boolean;
  audioUrl?: string | null;
  status: McsVMCampaignRecord['status'];
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  /** 'vm_only' (default) | 'live_transfer' | 'both' — see McsVmDialMode. */
  dialMode?: string;
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
    const jobs = await claimVmJobs(
      ['delivery'],
      vmDeliveryClaimBatchSize(env.VM_DELIVERY_RATE_PER_MINUTE, TICK_MS, BATCH),
    );
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
  const minGap = vmDeliveryMinGapMs(env.VM_DELIVERY_RATE_PER_MINUTE);
  const wait = Math.max(0, minGap - (Date.now() - lastDispatchAt));
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastDispatchAt = Date.now();
}

export function vmDeliveryMinGapMs(ratePerMinute: number): number {
  return Math.ceil(60_000 / ratePerMinute);
}

export function vmDeliveryClaimBatchSize(ratePerMinute: number, tickMs: number, maxBatch: number): number {
  const dispatchCapacity = Math.ceil((ratePerMinute * tickMs) / 60_000);
  return Math.max(1, Math.min(maxBatch, dispatchCapacity));
}

export async function dispatchVmDeliveryJobForTest(job: VmQueueJob<DeliveryPayload>): Promise<void> {
  await dispatch(job);
}

async function dispatch(job: VmQueueJob<DeliveryPayload>): Promise<void> {
  try {
    const lead = await findLead(job.payload.leadId);
    if (!lead) throw new Error('lead_not_found');
    const jobProvider = getVmProvider(job.payload.provider ?? env.VM_PROVIDER_MODE);

    // do_not_drop gate — FAIL CLOSED, before any campaign gate. A flagged
    // lead (explicit doNotDrop or leadType 'interviewed') can never receive
    // a delivery dispatch, regardless of campaign state or approval.
    if (isDoNotDropLead(lead)) {
      await recordDeliveryEvent({
        provider: jobProvider.key,
        leadId: lead.leadId,
        vmCampaignId: lead.vmCampaignId,
        ownerTmagId: lead.ownerTmagId,
        status: 'skipped',
        providerMessageId: null,
        providerStatus: 'do_not_drop',
        dryRun: true,
        attempt: job.attempts,
        details: { reason: 'do_not_drop', leadType: lead.leadType ?? null },
      });
      await vmAudit({
        action: 'vm.delivery.do_not_drop_refused',
        entityId: lead.leadId,
        ownerTmagId: lead.ownerTmagId,
        summary: `Delivery refused for doNotDrop VM lead ${lead.leadId} (fail closed).`,
        payload: { jobId: job.jobId, leadType: lead.leadType ?? null },
      });
      await skipVmJob(job.jobId, `Lead ${lead.leadId} is doNotDrop; delivery refused (fail closed).`);
      return;
    }

    const campaign = await findCampaign(lead.vmCampaignId);
    if (!campaign) throw new Error('vm_campaign_not_found');
    const campaignProvider =
      campaign.provider === undefined || campaign.provider === null
        ? null
        : getVmProvider(campaign.provider);
    const provider = getVmProvider(
      job.payload.provider ?? campaignProvider?.key ?? env.VM_PROVIDER_MODE,
    );

    const gate = await gateCampaignForDelivery(job, campaign);
    if (!gate.proceed) return;

    // Live-transfer availability gate — FAIL CLOSED. In 'live_transfer' mode
    // a human answer has nowhere to go when the owner is unavailable, so we
    // do not dial at all (abandoned calls get numbers flagged). The job is
    // requeued without burning an attempt; dials resume when the owner flips
    // available. 'both' mode proceeds — the voicemail branch still works and
    // the webhook side falls back to voicemail on a human answer.
    if (campaign.dialMode === 'live_transfer') {
      const availability = await getTransferAvailability(lead.ownerTmagId);
      if (!availability.available || !availability.transferToNumber) {
        await recordDeliveryEvent({
          provider: provider.key,
          leadId: lead.leadId,
          vmCampaignId: lead.vmCampaignId,
          ownerTmagId: lead.ownerTmagId,
          status: 'skipped',
          providerMessageId: null,
          providerStatus: 'owner_unavailable_live_transfer',
          dryRun: true,
          attempt: job.attempts,
          details: { reason: 'owner_unavailable', dialMode: 'live_transfer' },
        });
        await vmAudit({
          action: 'vm.delivery.live_transfer_owner_unavailable',
          entityId: lead.leadId,
          ownerTmagId: lead.ownerTmagId,
          summary: `Live-transfer dial refused for lead ${lead.leadId}: owner unavailable (fail closed).`,
          payload: { jobId: job.jobId, vmCampaignId: lead.vmCampaignId },
        });
        await requeueVmJobWithoutBurningAttempt(
          job,
          new Date(Date.now() + 5 * 60_000).toISOString(),
          `Owner ${lead.ownerTmagId} unavailable for live transfer; dial refused and requeued.`,
        );
        return;
      }
    }

    if (!lead.token) {
      await completeVmJob(job.jobId, `Lead ${lead.leadId} has no token; delivery skipped.`);
      await completeRunningCampaignIfIdle(lead.vmCampaignId);
      return;
    }
    if (!lead.normalizedPhone) {
      await updateLeadStatus(lead.leadId, 'delivery_dry_run', { reason: 'no_phone', ownerTmagId: lead.ownerTmagId });
      await completeVmJob(job.jobId, `Lead ${lead.leadId} has no phone; delivery skipped.`);
      await completeRunningCampaignIfIdle(lead.vmCampaignId);
      return;
    }

    const tokenUrl = `${env.PROSPECT_BASE_URL.replace(/\/$/, '')}/rvm/${lead.token}`;
    const adminApprovedForLiveDelivery = campaign?.adminApprovedForLiveDelivery === true;
    const dryRun = !env.VM_LIVE_DELIVERY_ENABLED || !adminApprovedForLiveDelivery || provider.key === 'manual_csv';

    const result = await provider.sendDrop({
      lead,
      tokenUrl,
      campaignId: lead.vmCampaignId,
      audioUrl: campaign?.audioUrl ?? null,
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
    await completeRunningCampaignIfIdle(lead.vmCampaignId);
  } catch (err) {
    await failVmJob(job, err instanceof Error ? err.message : String(err));
  }
}

async function gateCampaignForDelivery(
  job: VmQueueJob<DeliveryPayload>,
  campaign: VmCampaignDoc,
): Promise<{ proceed: boolean }> {
  const nowMs = Date.now();
  switch (campaign.status) {
    case 'running':
      return { proceed: true };
    case 'scheduled': {
      const scheduledAt = campaign.scheduledAt ? Date.parse(campaign.scheduledAt) : Number.NaN;
      if (Number.isFinite(scheduledAt) && scheduledAt <= nowMs) {
        await startScheduledCampaignForWorker(campaign as McsVMCampaignRecord);
        return { proceed: true };
      }
      const availableAt = Number.isFinite(scheduledAt)
        ? new Date(scheduledAt).toISOString()
        : new Date(nowMs + 5 * 60_000).toISOString();
      await requeueVmJobWithoutBurningAttempt(
        job,
        availableAt,
        `Campaign ${campaign.vmCampaignId} is scheduled for ${availableAt}; delivery requeued.`,
      );
      return { proceed: false };
    }
    case 'draft':
    case 'ready':
    case 'dry_run':
    case 'paused': {
      const availableAt = new Date(nowMs + 5 * 60_000).toISOString();
      await requeueVmJobWithoutBurningAttempt(
        job,
        availableAt,
        `Campaign ${campaign.vmCampaignId} status ${campaign.status}; delivery requeued.`,
      );
      return { proceed: false };
    }
    case 'cancelled':
    case 'completed':
    case 'archived':
      await skipVmJob(
        job.jobId,
        `Campaign ${campaign.vmCampaignId} status ${campaign.status}; delivery skipped.`,
      );
      return { proceed: false };
  }
  const availableAt = new Date(nowMs + 5 * 60_000).toISOString();
  await requeueVmJobWithoutBurningAttempt(
    job,
    availableAt,
    `Campaign ${campaign.vmCampaignId} status ${campaign.status}; delivery requeued.`,
  );
  return { proceed: false };
}

async function findCampaign(vmCampaignId: string): Promise<VmCampaignDoc | null> {
  const result = await persistenceCall<{ documents: VmCampaignDoc[] }>('mongodb', 'query', {
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
