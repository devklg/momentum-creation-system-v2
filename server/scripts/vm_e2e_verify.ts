/**
 * VM Dialer end-to-end verification harness.
 * Drives the REAL domain pipeline against the LIVE triple-stack, in-process.
 * Run with tsx from server/.
 */
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { createLeadOwner } from '../src/domain/vmLeadOwners.js';
import { createVMCampaign, patchVMCampaignStatusForOwner } from '../src/domain/vmCampaigns.js';
import {
  createManualImportJobs,
  claimVmJobs,
  processImportChunk,
  processSuppressionCheck,
  processTokenGeneration,
  processCrmCreation,
} from '../src/domain/vmProviderQueue.js';
import { dispatchVmDeliveryJobForTest } from '../src/workers/vmDeliveryWorker.js';
import { connectMongo } from '../src/services/persistence/mongo/connection.js';

const RUN_ID = `e2e_${Date.now()}`;
const OWNER = 'TMAG-01';
const SPONSOR = 'TMAG-01';
const DB = 'momentum';
const C_LEADS = 'tmag_vm_bulk_leads';
const C_EVENTS = 'tmag_vm_delivery_events';
const C_CAMPAIGNS = 'tmag_vm_campaigns';
const C_OWNERS = 'tmag_vm_lead_owners';
const C_QUEUE = 'tmag_vm_queue_jobs';
const C_AUDIT = 'tmag_vm_audit_events';

const log = (...a: unknown[]) => console.log(`[${RUN_ID}]`, ...a);
let ok = true;
const fail = (m: string) => { ok = false; console.error(`[${RUN_ID}] FAIL: ${m}`); };
const q = (collection: string, filter: Record<string, unknown>, limit = 5) =>
  persistenceCall<{ documents: any[] }>('mongodb', 'query', { database: DB, collection, filter, limit });
const del = (collection: string, filter: Record<string, unknown>) =>
  persistenceCall('mongodb', 'delete', { database: DB, collection, filter }).catch(() => undefined);

async function drainQueue() {
  const processors: Array<[string, (j: any) => Promise<void>]> = [
    ['import_validate', processImportChunk],
    ['suppression_check', processSuppressionCheck],
    ['token_generate', processTokenGeneration],
    ['crm_create', processCrmCreation],
  ];
  for (let pass = 0; pass < 25; pass++) {
    let did = 0;
    for (const [type, fn] of processors) {
      const jobs = await claimVmJobs([type] as any, 10);
      for (const job of jobs) { await fn(job); did++; }
    }
    if (did === 0) break;
  }
}

async function main() {
  log('START. stack: mongo:30000 chroma:8200 neo4j:7710');
  await connectMongo();
  log('mongo connected');

  const owner = await createLeadOwner({
    ownerTmagId: OWNER, sponsorTmagId: SPONSOR,
    name: `E2E Owner ${RUN_ID}`, source: 'aged_purchase', country: 'US',
    leadType: 'aged', quantityImported: 1,
  });
  log('lead owner:', owner.leadOwnerId);

  const campaign = await createVMCampaign({
    ownerTmagId: OWNER, sponsorTmagId: SPONSOR, leadOwnerId: owner.leadOwnerId,
    name: `E2E Campaign ${RUN_ID}`, provider: 'manual_csv',
  } as any);
  log('campaign:', campaign.vmCampaignId, 'status:', campaign.status);

  await patchVMCampaignStatusForOwner({ vmCampaignId: campaign.vmCampaignId, ownerTmagId: OWNER, action: 'ready' } as any);
  const started = await patchVMCampaignStatusForOwner({ vmCampaignId: campaign.vmCampaignId, ownerTmagId: OWNER, action: 'start' } as any);
  log('status after ready->start:', started.status);
  if (started.status !== 'running') fail(`expected running, got ${started.status}`);

  const imp = await createManualImportJobs({
    ownerTmagId: OWNER, sponsorTmagId: SPONSOR, leadOwnerId: owner.leadOwnerId,
    vmCampaignId: campaign.vmCampaignId, sourceLabel: RUN_ID,
    rows: [{ firstName: 'E2E', lastName: 'Prospect', phone: '+13235550123', email: `${RUN_ID}@example.com`, city: 'Los Angeles', stateOrRegion: 'CA', country: 'US' }],
  } as any);
  log('import queued:', imp.importJobId, 'chunks:', imp.chunksQueued, 'rowsAccepted:', imp.rowsAccepted);
  if (imp.rowsAccepted !== 1) fail(`expected 1 row, got ${imp.rowsAccepted}`);

  await drainQueue();

  const l1 = (await q(C_LEADS, { vmCampaignId: campaign.vmCampaignId })).documents?.[0];
  if (!l1) fail('no lead written after pipeline');
  else {
    log('lead after pipeline:', l1.leadId, 'status:', l1.status, 'token:', l1.token ? 'yes' : 'no', 'phone:', l1.normalizedPhone);
    if (!l1.token) fail('lead has no token after token_generate');
  }

  const deliveryJobs = await claimVmJobs(['delivery'] as any, 5);
  log('delivery jobs claimed:', deliveryJobs.length);
  if (deliveryJobs.length === 0) fail('crm_create did not enqueue a delivery job');
  for (const j of deliveryJobs) await dispatchVmDeliveryJobForTest(j as any);

  const l2 = (await q(C_LEADS, { vmCampaignId: campaign.vmCampaignId })).documents?.[0];
  log('lead status after delivery:', l2?.status);
  if (!['delivery_dry_run', 'manual_exported'].includes(l2?.status)) fail(`expected dry-run/manual_exported, got ${l2?.status}`);

  const ev = (await q(C_EVENTS, { vmCampaignId: campaign.vmCampaignId })).documents?.[0];
  log('delivery event:', ev ? `${ev.eventId} status=${ev.status} dryRun=${ev.dryRun}` : 'NONE');
  if (!ev) fail('no delivery event recorded');
  else if (ev.dryRun !== true) fail(`event NOT dry-run (dryRun=${ev.dryRun}) - a LIVE send would have fired`);

  log('cleanup...');
  await del(C_LEADS, { vmCampaignId: campaign.vmCampaignId });
  await del(C_EVENTS, { vmCampaignId: campaign.vmCampaignId });
  await del(C_QUEUE, { 'payload.vmCampaignId': campaign.vmCampaignId });
  await del(C_AUDIT, { entityId: campaign.vmCampaignId });
  await del(C_CAMPAIGNS, { vmCampaignId: campaign.vmCampaignId });
  await del(C_OWNERS, { leadOwnerId: owner.leadOwnerId });
  log('mongo cleanup done (neo4j/chroma test nodes remain; tagged for manual sweep)');

  console.log(ok ? `\n[${RUN_ID}] E2E_RESULT: PASS` : `\n[${RUN_ID}] E2E_RESULT: FAIL`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(`[${RUN_ID}] HARNESS ERROR:`, e?.stack || e); process.exit(2); });
