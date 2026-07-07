import { randomUUID } from 'node:crypto';
/**
 * Admin VM oversight read model.
 *
 * Agent 6 surfaces global analytics and operational health. The provider,
 * import, and BA-facing campaign agents own the write paths; this module reads
 * their expected collections when present and degrades to empty analytics with
 * explicit warnings while those agents are still landing.
 */

import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { env } from '../env.js';
import {
  listVmNotificationHooks,
  listVmTeamNewsHooks,
} from './vmNotificationHooks.js';
import type {
  McsAdminVmBaPerformanceRow,
  McsAdminVmLeadOwnerHealthRow,
  McsAdminVmCampaignRow,
  McsAdminVmComplianceSummary,
  McsAdminVmMetricCard,
  McsAdminVmOverviewResponse,
  McsAdminVmProviderHealth,
  McsAdminVmQueueResponse,
  McsAdminVmCampaignProgressResponse,
  McsAdminVmDialerAction,
  McsAdminVmDialerActionResponse,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'team_magnificent_members';
const COLL_LEAD_OWNERS = 'tmag_vm_lead_owners';
const COLL_LEADS = 'tmag_vm_bulk_leads';
const COLL_CAMPAIGNS = 'tmag_vm_campaigns';
const COLL_QUEUE = 'tmag_vm_queue_jobs';
const COLL_DELIVERY = 'tmag_vm_delivery_events';
const COLL_CONTROL = 'tmag_vm_control_actions';
const COLL_CRM = 'tmag_prospect_crm_records';
const COLL_SUPPRESSIONS = 'tmag_vm_suppression_list';

const QUERY_LIMIT = 200_000;
const RECENT_LIMIT = 500;
const MS_24H = 24 * 60 * 60 * 1000;

interface BaDoc {
  tmagId: string;
  firstName?: string;
  lastName?: string;
}

interface LeadOwnerDoc {
  leadOwnerId?: string;
  ownerTmagId?: string;
  source?: string;
  status?: string;
  quantityImported?: number;
  createdAt?: string;
  completedAt?: string | null;
}

interface BulkLeadDoc {
  leadId?: string;
  leadOwnerId?: string;
  vmCampaignId?: string;
  ownerTmagId?: string;
  sponsorTmagId?: string;
  status?: string;
  activatedAt?: string | null;
  createdAt?: string;
  lastActivityAt?: string | null;
}

interface VmCampaignDoc {
  vmCampaignId?: string;
  ownerTmagId?: string;
  leadOwnerId?: string | null;
  name?: string;
  provider?: string;
  status?: string;
  scheduledAt?: string | null;
  createdAt?: string;
}

interface DeliveryEventDoc {
  vmCampaignId?: string;
  ownerTmagId?: string;
  provider?: string;
  status?: string;
  kind?: string;
  createdAt?: string;
}

interface VmQueueJobDoc {
  jobId?: string;
  kind?: string;
  status?: string;
  attempts?: number;
  maxAttempts?: number;
  availableAt?: string;
  lockedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  payload?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface CrmRecordDoc {
  ownerTmagId?: string;
  sponsorTmagId?: string;
  leadId?: string | null;
  leadOwnerId?: string | null;
  vmCampaignId?: string | null;
  source?: string;
  status?: string;
  disposition?: string | null;
  closedReason?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

interface SuppressionDoc {
  kind?: string;
  status?: string;
}

interface AdminVmSources {
  warnings: string[];
  bas: BaDoc[];
  leadOwners: LeadOwnerDoc[];
  leads: BulkLeadDoc[];
  campaigns: VmCampaignDoc[];
  delivery: DeliveryEventDoc[];
  crm: CrmRecordDoc[];
  suppressions: SuppressionDoc[];
}

function fullName(ba: BaDoc | undefined, fallback: string): string {
  if (!ba) return fallback;
  const name = `${ba.firstName ?? ''} ${ba.lastName ?? ''}`.trim();
  return name || fallback;
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function isOneOf(status: string | undefined, values: readonly string[]): boolean {
  return !!status && values.includes(status);
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

async function safeQuery<T>(
  collection: string,
  warnings: string[],
  filter: Record<string, unknown> = {},
  limit = QUERY_LIMIT,
  sort?: Record<string, 1 | -1>,
): Promise<T[]> {
  try {
    const result = await persistenceCall<{ documents?: T[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection,
      filter,
      limit,
      ...(sort ? { sort } : {}),
    });
    return result.documents ?? [];
  } catch (err) {
    warnings.push(
      `${collection} unavailable; analytics using empty set (${
        err instanceof Error ? err.message : String(err)
      }).`,
    );
    return [];
  }
}

function countBy<T>(
  docs: T[],
  keyFn: (doc: T) => string | null | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const doc of docs) {
    const key = keyFn(doc);
    if (!key) continue;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

function countByStatus<T extends { status?: string }>(
  docs: T[],
  keyFn: (doc: T) => string | null | undefined,
  statuses: readonly string[],
): Map<string, number> {
  return countBy(
    docs.filter((d) => isOneOf(d.status, statuses)),
    keyFn,
  );
}

async function loadSources(): Promise<AdminVmSources> {
  const warnings: string[] = [];
  const [bas, leadOwners, leads, campaigns, delivery, crm, suppressions] =
    await Promise.all([
      safeQuery<BaDoc>(COLL_BAS, warnings, {}, 50_000),
      safeQuery<LeadOwnerDoc>(COLL_LEAD_OWNERS, warnings, {}, QUERY_LIMIT, { createdAt: -1 }),
      safeQuery<BulkLeadDoc>(COLL_LEADS, warnings, {}, QUERY_LIMIT),
      safeQuery<VmCampaignDoc>(COLL_CAMPAIGNS, warnings, {}, QUERY_LIMIT, { createdAt: -1 }),
      safeQuery<DeliveryEventDoc>(COLL_DELIVERY, warnings, {}, QUERY_LIMIT),
      safeQuery<CrmRecordDoc>(COLL_CRM, warnings, { source: { $in: ['rvm', 'vm'] } }, QUERY_LIMIT),
      safeQuery<SuppressionDoc>(COLL_SUPPRESSIONS, warnings, {}, QUERY_LIMIT),
    ]);

  return { warnings, bas, leadOwners, leads, campaigns, delivery, crm, suppressions };
}

function buildCards(args: {
  leads: BulkLeadDoc[];
  campaigns: VmCampaignDoc[];
  leadOwners: LeadOwnerDoc[];
  crm: CrmRecordDoc[];
}): McsAdminVmMetricCard[] {
  const leadsImported = args.leads.length;
  const activated = args.leads.filter((l) =>
    isOneOf(l.status, ['activated', 'info_requested', 'callback_requested', 'presentation_started', 'presentation_completed', 'dashboard_entered', 'holding_tank', 'closed_new_brand_ambassador']),
  ).length;
  const completed = args.leads.filter((l) =>
    isOneOf(l.status, ['presentation_completed', 'dashboard_entered', 'holding_tank', 'closed_new_brand_ambassador']),
  ).length;
  const callbacks = args.leads.filter((l) => l.status === 'callback_requested').length +
    args.crm.filter((r) => r.status === 'callback_requested').length;
  const closedNewBa = args.crm.filter((r) =>
    r.disposition === 'new_brand_ambassador' ||
    r.closedReason === 'enrolled_as_brand_ambassador' ||
    r.status === 'closed_new_brand_ambassador',
  ).length;

  return [
    {
      key: 'campaigns',
      label: 'VM Campaigns',
      value: args.campaigns.length,
      detail: `${args.leadOwners.length} lead owners visible`,
      tone: 'neutral',
    },
    {
      key: 'leads_imported',
      label: 'Leads Imported',
      value: leadsImported,
      detail: 'Imported VM lead records',
      tone: 'neutral',
    },
    {
      key: 'activation_rate',
      label: 'Activation Rate',
      value: pct(activated, leadsImported) === null ? 'n/a' : `${pct(activated, leadsImported)}%`,
      detail: `${activated} activated leads`,
      tone: activated > 0 ? 'good' : 'watch',
    },
    {
      key: 'video_completion_rate',
      label: 'Video Completion',
      value: pct(completed, leadsImported) === null ? 'n/a' : `${pct(completed, leadsImported)}%`,
      detail: `${completed} completed presentations`,
      tone: completed > 0 ? 'good' : 'watch',
    },
    {
      key: 'callbacks',
      label: 'Callbacks',
      value: callbacks,
      detail: `${closedNewBa} closed as new BA`,
      tone: callbacks > 0 ? 'good' : 'neutral',
    },
  ];
}

function buildBaRows(sources: AdminVmSources): McsAdminVmBaPerformanceRow[] {
  const baById = new Map(sources.bas.map((b) => [b.tmagId, b]));
  const ownerIds = new Set<string>();
  for (const b of sources.leadOwners) if (b.ownerTmagId) ownerIds.add(b.ownerTmagId);
  for (const c of sources.campaigns) if (c.ownerTmagId) ownerIds.add(c.ownerTmagId);
  for (const l of sources.leads) if (l.ownerTmagId) ownerIds.add(l.ownerTmagId);
  for (const r of sources.crm) if (r.ownerTmagId) ownerIds.add(r.ownerTmagId);

  const campaignsByOwner = countBy(sources.campaigns, (c) => c.ownerTmagId);
  const leadOwnersByOwner = countBy(sources.leadOwners, (b) => b.ownerTmagId);
  const leadsByOwner = countBy(sources.leads, (l) => l.ownerTmagId);
  const contactedByOwner = countByStatus(sources.leads, (l) => l.ownerTmagId, [
    'voicemail_sent',
    'sms_sent',
    'email_sent',
    'link_clicked',
    'activated',
    'info_requested',
    'callback_requested',
    'presentation_started',
    'presentation_completed',
    'dashboard_entered',
    'holding_tank',
    'closed_new_brand_ambassador',
  ]);
  const activatedByOwner = countByStatus(sources.leads, (l) => l.ownerTmagId, [
    'activated',
    'info_requested',
    'callback_requested',
    'presentation_started',
    'presentation_completed',
    'dashboard_entered',
    'holding_tank',
    'closed_new_brand_ambassador',
  ]);
  const startsByOwner = countByStatus(sources.leads, (l) => l.ownerTmagId, [
    'presentation_started',
    'presentation_25',
    'presentation_50',
    'presentation_75',
    'presentation_completed',
    'dashboard_entered',
    'holding_tank',
    'closed_new_brand_ambassador',
  ]);
  const completionsByOwner = countByStatus(sources.leads, (l) => l.ownerTmagId, [
    'presentation_completed',
    'dashboard_entered',
    'holding_tank',
    'closed_new_brand_ambassador',
  ]);
  const callbacksByOwner = countByStatus(sources.leads, (l) => l.ownerTmagId, ['callback_requested']);
  const infoByOwner = countByStatus(sources.leads, (l) => l.ownerTmagId, ['info_requested']);
  const holdingByOwner = countByStatus(sources.leads, (l) => l.ownerTmagId, ['holding_tank']);
  const closedByOwner = countBy(
    sources.crm.filter((r) =>
      r.disposition === 'new_brand_ambassador' ||
      r.closedReason === 'enrolled_as_brand_ambassador' ||
      r.status === 'closed_new_brand_ambassador',
    ),
    (r) => r.ownerTmagId,
  );

  return Array.from(ownerIds)
    .map((tmagId): McsAdminVmBaPerformanceRow => {
      const leadsImported = leadsByOwner.get(tmagId) ?? 0;
      const activated = activatedByOwner.get(tmagId) ?? 0;
      const videoStarts = startsByOwner.get(tmagId) ?? 0;
      const videoCompletions = completionsByOwner.get(tmagId) ?? 0;
      let lastActivityAt: string | null = null;
      for (const lead of sources.leads) {
        if (lead.ownerTmagId !== tmagId) continue;
        lastActivityAt = maxIso(lastActivityAt, lead.lastActivityAt ?? lead.activatedAt ?? lead.createdAt ?? null);
      }
      return {
        tmagId,
        baName: fullName(baById.get(tmagId), tmagId),
        campaignCount: campaignsByOwner.get(tmagId) ?? 0,
        leadOwnerCount: leadOwnersByOwner.get(tmagId) ?? 0,
        leadsImported,
        leadsContacted: contactedByOwner.get(tmagId) ?? 0,
        activated,
        activationRate: pct(activated, leadsImported),
        videoStarts,
        videoCompletions,
        completionRate: pct(videoCompletions, videoStarts),
        callbacks: callbacksByOwner.get(tmagId) ?? 0,
        infoRequests: infoByOwner.get(tmagId) ?? 0,
        holdingTankEntries: holdingByOwner.get(tmagId) ?? 0,
        closedNewBa: closedByOwner.get(tmagId) ?? 0,
        lastActivityAt,
      };
    })
    .sort((a, b) => b.activated - a.activated || b.leadsImported - a.leadsImported)
    .slice(0, RECENT_LIMIT);
}

function buildLeadOwnerRows(sources: AdminVmSources): McsAdminVmLeadOwnerHealthRow[] {
  const baById = new Map(sources.bas.map((b) => [b.tmagId, b]));
  return sources.leadOwners.slice(0, RECENT_LIMIT).map((leadOwner) => {
    const leadOwnerId = leadOwner.leadOwnerId ?? 'unknown_lead_owner';
    const owner = leadOwner.ownerTmagId ?? 'unknown_owner';
    const leads = sources.leads.filter((l) => l.leadOwnerId === leadOwnerId);
    const crm = sources.crm.filter((r) => r.leadOwnerId === leadOwnerId);
    return {
      leadOwnerId,
      ownerTmagId: owner,
      ownerName: fullName(baById.get(owner), owner),
      source: leadOwner.source ?? 'unknown',
      status: leadOwner.status ?? 'unknown',
      quantityImported: leadOwner.quantityImported ?? leads.length,
      validated: leads.filter((l) => isOneOf(l.status, ['validated', 'crm_created', 'token_created', 'queued', 'voicemail_sent', 'activated'])).length,
      suppressed: leads.filter((l) => l.status === 'suppressed').length,
      tokenized: leads.filter((l) => isOneOf(l.status, ['token_created', 'queued', 'voicemail_sent', 'link_clicked', 'activated'])).length,
      crmCreated: crm.length,
      activated: leads.filter((l) => isOneOf(l.status, ['activated', 'info_requested', 'callback_requested', 'presentation_started', 'presentation_completed', 'holding_tank'])).length,
      createdAt: leadOwner.createdAt ?? null,
      completedAt: leadOwner.completedAt ?? null,
    };
  });
}

function buildCampaignRows(sources: AdminVmSources): McsAdminVmCampaignRow[] {
  const baById = new Map(sources.bas.map((b) => [b.tmagId, b]));
  return sources.campaigns.slice(0, RECENT_LIMIT).map((campaign) => {
    const campaignId = campaign.vmCampaignId ?? 'unknown_campaign';
    const owner = campaign.ownerTmagId ?? 'unknown_owner';
    const leads = sources.leads.filter((l) => l.vmCampaignId === campaignId);
    const delivery = sources.delivery.filter((d) => d.vmCampaignId === campaignId);
    const crm = sources.crm.filter((r) => r.vmCampaignId === campaignId);
    return {
      vmCampaignId: campaignId,
      ownerTmagId: owner,
      ownerName: fullName(baById.get(owner), owner),
      leadOwnerId: campaign.leadOwnerId ?? null,
      name: campaign.name ?? campaignId,
      provider: campaign.provider ?? 'manual',
      status: campaign.status ?? 'unknown',
      scheduledAt: campaign.scheduledAt ?? null,
      leadsQueued: leads.filter((l) => isOneOf(l.status, ['queued', 'voicemail_sent', 'sms_sent', 'email_sent'])).length,
      delivered: delivery.filter((d) => isOneOf(d.status, ['delivered', 'sent', 'complete'])).length,
      deliveryFailed: delivery.filter((d) => isOneOf(d.status, ['failed', 'error', 'bounced'])).length,
      activated: leads.filter((l) => isOneOf(l.status, ['activated', 'info_requested', 'callback_requested', 'presentation_started', 'presentation_completed', 'holding_tank'])).length,
      videoCompletions: leads.filter((l) => isOneOf(l.status, ['presentation_completed', 'dashboard_entered', 'holding_tank', 'closed_new_brand_ambassador'])).length,
      callbacks: leads.filter((l) => l.status === 'callback_requested').length,
      closedNewBa: crm.filter((r) =>
        r.disposition === 'new_brand_ambassador' ||
        r.closedReason === 'enrolled_as_brand_ambassador' ||
        r.status === 'closed_new_brand_ambassador',
      ).length,
      createdAt: campaign.createdAt ?? null,
    };
  });
}

function buildComplianceSummary(sources: AdminVmSources): McsAdminVmComplianceSummary {
  const suppressedLeads = sources.leads.filter((l) => l.status === 'suppressed').length;
  const byKind = countBy(sources.suppressions, (s) => s.kind ?? s.status);
  return {
    suppressedLeads,
    optOuts: byKind.get('opt_out') ?? 0,
    dncFlags: byKind.get('dnc') ?? 0,
    invalidPhones: byKind.get('invalid_phone') ?? 0,
    invalidEmails: byKind.get('invalid_email') ?? 0,
    complianceHolds: byKind.get('compliance_hold') ?? 0,
    liveSendEnabled: false,
    note: 'Live VM/SMS/email sends remain disabled until provider, consent, suppression, and admin approval gates are wired.',
  };
}

function buildProviderHealth(sources: AdminVmSources): McsAdminVmProviderHealth[] {
  const providerNames = new Set<string>();
  for (const c of sources.campaigns) providerNames.add(c.provider ?? 'manual');
  for (const d of sources.delivery) providerNames.add(d.provider ?? 'manual');
  if (providerNames.size === 0) providerNames.add('manual');

  const dayAgo = new Date(Date.now() - MS_24H).toISOString();
  return Array.from(providerNames).map((provider) => {
    const providerEvents = sources.delivery.filter((d) => (d.provider ?? 'manual') === provider);
    const events24h = providerEvents.filter((d) => (d.createdAt ?? '') >= dayAgo);
    const failed24h = events24h.filter((d) => isOneOf(d.status, ['failed', 'error', 'bounced'])).length;
    const delivered24h = events24h.filter((d) => isOneOf(d.status, ['delivered', 'sent', 'complete'])).length;
    const lastWebhookAt = providerEvents.reduce<string | null>(
      (latest, event) => maxIso(latest, event.createdAt ?? null),
      null,
    );

    return {
      provider,
      mode: provider === 'manual' ? 'manual' : 'stub',
      status: providerEvents.length === 0 ? 'not_configured' : failed24h > delivered24h ? 'warning' : 'healthy',
      lastWebhookAt,
      delivered24h,
      failed24h,
      note:
        providerEvents.length === 0
          ? 'No provider events have landed yet.'
          : 'Provider events are read-only here; delivery workers own retries.',
    };
  });
}

export async function buildAdminVmOverview(): Promise<McsAdminVmOverviewResponse> {
  const sources = await loadSources();
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    cards: buildCards(sources),
    baPerformance: buildBaRows(sources),
    leadOwners: buildLeadOwnerRows(sources),
    campaigns: buildCampaignRows(sources),
    compliance: buildComplianceSummary(sources),
    providerHealth: buildProviderHealth(sources),
    notificationHooks: listVmNotificationHooks(),
    teamNewsHooks: listVmTeamNewsHooks(),
    warnings: sources.warnings,
  };
}

function liveDeliveryEnabled(): boolean {
  return env.VM_LIVE_DELIVERY_ENABLED === true;
}

export async function buildAdminVmQueueState(): Promise<McsAdminVmQueueResponse> {
  const warnings: string[] = [];
  const jobs = await safeQuery<VmQueueJobDoc>(COLL_QUEUE, warnings, {}, QUERY_LIMIT, { updatedAt: -1 });
  const statuses = ['queued', 'processing', 'complete', 'failed', 'dead_lettered', 'skipped'] as const;
  const now = Date.now();
  const queued = jobs.filter((job) => job.status === 'queued');
  const oldestQueued = queued
    .map((job) => Date.parse(job.availableAt ?? job.createdAt ?? ''))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    liveDeliveryEnabled: liveDeliveryEnabled(),
    depthByStatus: statuses.map((status) => ({
      status,
      count: jobs.filter((job) => job.status === status).length,
    })),
    oldestQueuedAgeSeconds:
      oldestQueued === undefined ? null : Math.max(0, Math.floor((now - oldestQueued) / 1000)),
    inFlightCount: jobs.filter((job) => job.status === 'processing').length,
    deadLetters: jobs
      .filter((job) => job.status === 'dead_lettered' || job.status === 'failed')
      .slice(0, 50)
      .map((job) => ({
        jobId: job.jobId ?? 'unknown_job',
        kind: job.kind ?? 'unknown',
        attempts: job.attempts ?? 0,
        maxAttempts: job.maxAttempts ?? 0,
        failureReason: job.failureReason ?? null,
        availableAt: job.availableAt ?? job.updatedAt ?? new Date(0).toISOString(),
        updatedAt: job.updatedAt ?? job.createdAt ?? new Date(0).toISOString(),
        payload: job.payload ?? {},
      })),
    warnings,
  };
}

export async function buildAdminVmCampaignProgress(
  vmCampaignId: string,
): Promise<McsAdminVmCampaignProgressResponse> {
  const warnings: string[] = [];
  const [campaigns, leads, delivery, jobs] = await Promise.all([
    safeQuery<VmCampaignDoc>(COLL_CAMPAIGNS, warnings, { vmCampaignId }, 1),
    safeQuery<BulkLeadDoc>(COLL_LEADS, warnings, { vmCampaignId }, QUERY_LIMIT),
    safeQuery<DeliveryEventDoc>(COLL_DELIVERY, warnings, { vmCampaignId }, QUERY_LIMIT),
    safeQuery<VmQueueJobDoc>(COLL_QUEUE, warnings, {}, QUERY_LIMIT),
  ]);
  const campaign = campaigns[0];
  const leadIds = new Set(leads.map((lead) => lead.leadId).filter((id): id is string => !!id));
  const campaignJobs = jobs.filter((job) => {
    const leadId = job.payload?.leadId;
    return typeof leadId === 'string' && leadIds.has(leadId);
  });
  const dispositionEntries = countBy(delivery, (event) => event.status ?? event.kind ?? 'unknown');
  const dispositions = Object.fromEntries(dispositionEntries);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    vmCampaignId,
    campaignName: campaign?.name ?? vmCampaignId,
    status: campaign?.status ?? 'unknown',
    totals: {
      leads: leads.length,
      queued: leads.filter((lead) => isOneOf(lead.status, ['queued', 'voicemail_drop_queued'])).length,
      sent: delivery.filter((event) => isOneOf(event.status, ['sent', 'voicemail_drop_queued', 'token_link_sms_enqueued'])).length,
      delivered: delivery.filter((event) => isOneOf(event.status, ['delivered', 'complete', 'voicemail_drop_delivered'])).length,
      failed: delivery.filter((event) => isOneOf(event.status, ['failed', 'error', 'bounced', 'undeliverable', 'voicemail_drop_failed'])).length,
      suppressed: leads.filter((lead) => lead.status === 'suppressed').length,
      retryable: campaignJobs.filter((job) => job.status === 'failed' || job.status === 'dead_lettered').length,
    },
    dispositions,
    warnings,
  };
}

async function readControlAction(actionId: string): Promise<{ actionId?: string } | null> {
  const readback = await persistenceCall<{ documents?: Array<{ actionId?: string }> }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_CONTROL,
    filter: { _id: actionId },
    limit: 1,
  });
  return readback.documents?.[0] ?? null;
}

async function writeVmControlAction(input: {
  action: McsAdminVmDialerAction;
  vmCampaignId: string;
  actorTmagId: string;
  affectedJobs: number;
}): Promise<string> {
  const actionId = `vmctrl_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  await tripleStackWrite({
    id: actionId,
    mongoCollection: COLL_CONTROL,
    mongoDoc: {
      actionId,
      action: input.action,
      vmCampaignId: input.vmCampaignId,
      actorTmagId: input.actorTmagId,
      affectedJobs: input.affectedJobs,
      liveDeliveryEnabled: liveDeliveryEnabled(),
      createdAt,
    },
    neo4j: {
      cypher:
        'MERGE (a:TmagVmControlAction {actionId: $id}) ' +
        'SET a.action = $action, a.vmCampaignId = $vmCampaignId, ' +
        '    a.actorTmagId = $actorTmagId, a.affectedJobs = $affectedJobs, a.createdAt = datetime($createdAt)',
      params: {
        action: input.action,
        vmCampaignId: input.vmCampaignId,
        actorTmagId: input.actorTmagId,
        affectedJobs: input.affectedJobs,
        createdAt,
      },
    },
    chroma: {
      collection: 'mcs_vm_control_actions',
      document:
        `Admin VM control action ${input.action} for campaign ${input.vmCampaignId}; ` +
        `${input.affectedJobs} queue job(s) affected.`,
      metadata: {
        kind: 'vm_control_action',
        action: input.action,
        vmCampaignId: input.vmCampaignId,
        actorTmagId: input.actorTmagId,
        affectedJobs: input.affectedJobs,
        createdAt,
      },
    },
  });
  if (!(await readControlAction(actionId))) throw new Error('vm_control_action_readback_failed');
  return actionId;
}

export async function runAdminVmDialerAction(input: {
  vmCampaignId: string;
  action: McsAdminVmDialerAction;
  actorTmagId: string;
}): Promise<McsAdminVmDialerActionResponse> {
  const now = new Date().toISOString();
  let affectedJobs = 0;

  const statusByAction: Partial<Record<McsAdminVmDialerAction, string>> = {
    pause: 'paused',
    resume: 'running',
    cancel: 'cancelled',
  };
  const nextStatus = statusByAction[input.action];
  if (nextStatus) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: COLL_CAMPAIGNS,
      filter: { vmCampaignId: input.vmCampaignId },
      update: { $set: { status: nextStatus, updatedAt: now } },
    });
  }

  const leads = await safeQuery<BulkLeadDoc>(
    COLL_LEADS,
    [],
    { vmCampaignId: input.vmCampaignId },
    QUERY_LIMIT,
  );
  const leadIds = leads.map((lead) => lead.leadId).filter((id): id is string => !!id);

  if (leadIds.length > 0 && input.action === 'retry_failed') {
    const result = await persistenceCall<{ modifiedCount?: number }>('mongodb', 'update', {
      database: MONGO_DB,
      collection: COLL_QUEUE,
      filter: {
        kind: 'delivery',
        status: { $in: ['failed', 'dead_lettered'] },
        'payload.leadId': { $in: leadIds },
      },
      update: {
        $set: {
          status: 'queued',
          availableAt: now,
          lockedAt: null,
          failedAt: null,
          failureReason: null,
          updatedAt: now,
        },
      },
      multi: true,
    });
    affectedJobs = result.modifiedCount ?? 0;
  }

  if (leadIds.length > 0 && input.action === 'cancel') {
    const result = await persistenceCall<{ modifiedCount?: number }>('mongodb', 'update', {
      database: MONGO_DB,
      collection: COLL_QUEUE,
      filter: {
        kind: 'delivery',
        status: { $in: ['queued', 'failed', 'dead_lettered'] },
        'payload.leadId': { $in: leadIds },
      },
      update: {
        $set: {
          status: 'skipped',
          completedAt: now,
          updatedAt: now,
          failureReason: 'campaign_cancelled',
        },
      },
      multi: true,
    });
    affectedJobs = result.modifiedCount ?? 0;
  }

  const actionId = await writeVmControlAction({
    action: input.action,
    vmCampaignId: input.vmCampaignId,
    actorTmagId: input.actorTmagId,
    affectedJobs,
  });

  return {
    ok: true,
    actionId,
    action: input.action,
    vmCampaignId: input.vmCampaignId,
    liveDeliveryEnabled: liveDeliveryEnabled(),
    affectedJobs,
    readbackVerified: true,
    note:
      liveDeliveryEnabled()
        ? 'Control action recorded. Live provider delivery remains governed by worker/provider gates.'
        : 'Control action recorded in guarded mode; no real Telnyx drop was triggered.',
  };
}
