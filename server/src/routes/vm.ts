/**
 * /api/vm — BA-owned VM lead owner and campaign API.
 *
 * Owner/sponsor identity comes only from req.session.tmagId. Client payloads
 * cannot override ownership.
 */

import { Router } from 'express';
import { z } from 'zod';
import type {
  McsLeadOwnerListResponse,
  McsLeadOwnerResponse,
  McsVMCampaignListResponse,
  McsVMCampaignProviderMode,
  McsVMCampaignResponse,
  McsVmCampaignLeadRow,
  McsVmCampaignLeadsResponse,
  McsVmCampaignMetricStatus,
  McsVmCampaignMetrics,
  McsVmCampaignMetricsResponse,
  McsVmCampaignStatusPatchPayload,
  McsVmCampaignStatusPatchResponse,
  McsVmImportJobStatusResponse,
  McsVmImportQueuedResponse,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { requireVmDialerAccess } from '../middleware/requireVmDialerAccess.js';
import {
  LeadOwnerError,
  createLeadOwner,
  findLeadOwnerForOwner,
  listLeadOwnersForOwner,
} from '../domain/vmLeadOwners.js';
import {
  VMCampaignError,
  createVMCampaign,
  findVMCampaignForOwner,
  listVMCampaignsForOwner,
  patchVMCampaignStatusForOwner,
} from '../domain/vmCampaigns.js';
import { createManualImportJobs } from '../domain/vmProviderQueue.js';
import { buildManualExportCsv } from '../domain/vmManualExport.js';

export const vmRoutes: Router = Router();

const MONGO_DB = 'momentum';
const LEADS_COLLECTION = 'tmag_vm_bulk_leads';

const PROVIDERS: readonly McsVMCampaignProviderMode[] = [
  'manual_csv',
  'telnyx_call_control',
  'leadsrain_style_adapter',
  'slybroadcast_style_adapter',
  'future_telecom_adapter',
];

const CreateLeadOwnerSchema = z.object({
  name: z.string().min(1).max(160),
  source: z.string().min(1).max(120),
  country: z.string().min(2).max(2).default('US'),
  leadType: z.string().min(1).max(80),
  quantityImported: z.number().int().min(0).max(10_000_000).default(0),
});

const CreateCampaignSchema = z.object({
  leadOwnerId: z.string().min(4).max(120),
  name: z.string().min(1).max(160),
  provider: z.enum(PROVIDERS as [McsVMCampaignProviderMode, ...McsVMCampaignProviderMode[]]).default('manual_csv'),
  voicemailAudioId: z.string().min(1).max(120).nullable().optional(),
  audioUrl: z.string().url().nullable().optional(),
  smsTemplateId: z.string().min(1).max(120).nullable().optional(),
  emailTemplateId: z.string().min(1).max(120).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const ImportLeadSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(254).nullable().optional(),
  city: z.string().min(1).max(120),
  stateOrRegion: z.string().min(1).max(120),
  country: z.string().min(2).max(2).optional(),
  // Lead classification; 'interviewed' implies doNotDrop (a human already
  // spoke to this person — never voicemail them).
  leadType: z.string().min(1).max(80).nullable().optional(),
  // Hard VM-delivery block, enforced fail-closed in the delivery worker.
  doNotDrop: z.boolean().optional(),
});

const ImportLeadsSchema = z.object({
  vmCampaignId: z.string().min(4).max(120),
  leads: z.array(ImportLeadSchema).min(1).max(500),
});

const StatusPatchSchema = z.object({
  action: z.enum(['ready', 'schedule', 'start', 'pause', 'resume', 'cancel']),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const METRIC_STATUSES = [
  'imported',
  'validated',
  'invalid',
  'duplicate',
  'suppressed',
  'token_created',
  'crm_created',
  'queued',
  'delivery_dry_run',
  'manual_exported',
  'voicemail_drop_queued',
  'voicemail_drop_delivered',
  'voicemail_drop_failed',
  'opted_out',
] as const satisfies readonly McsVmCampaignMetricStatus[];

const LeadStatusQuerySchema = z.object({
  status: z.enum(METRIC_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

function sessionTmagId(req: import('express').Request): string | null {
  return req.session?.tmagId ?? null;
}

function routeParam(req: import('express').Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function sendVmError(res: import('express').Response, err: unknown) {
  if (err instanceof LeadOwnerError || err instanceof VMCampaignError) {
    if (err.code === 'illegal_transition') {
      return res.status(409).json({ ok: false, error: 'illegal_transition' });
    }
    const status =
      err.code.endsWith('_not_found') || err.code === 'campaign_lead_owner_mismatch'
        ? 404
        : 400;
    return res.status(status).json({ ok: false, error: err.code });
  }
  // eslint-disable-next-line no-console
  console.error('[vm route] unexpected error', err);
  return res.status(500).json({ ok: false, error: 'server_error' });
}

async function listLeadOwnersHandler(req: import('express').Request, res: import('express').Response) {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const leadOwners = await listLeadOwnersForOwner(tmagId);
    const body: McsLeadOwnerListResponse = { ok: true, leadOwners };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
}

vmRoutes.get('/lead-owners', requireAuth, requireSteveComplete, requireVmDialerAccess, listLeadOwnersHandler);

async function createLeadOwnerHandler(req: import('express').Request, res: import('express').Response) {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = CreateLeadOwnerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const leadOwner = await createLeadOwner({
      ownerTmagId: tmagId,
      sponsorTmagId: tmagId,
      ...parsed.data,
    });
    const body: McsLeadOwnerResponse = { ok: true, leadOwner };
    return res.status(201).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
}

vmRoutes.post('/lead-owners', requireAuth, requireSteveComplete, requireVmDialerAccess, createLeadOwnerHandler);

async function getLeadOwnerHandler(req: import('express').Request, res: import('express').Response) {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const leadOwner = await findLeadOwnerForOwner(routeParam(req, 'leadOwnerId'), tmagId);
    const body: McsLeadOwnerResponse = { ok: true, leadOwner };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
}

vmRoutes.get('/lead-owners/:leadOwnerId', requireAuth, requireSteveComplete, requireVmDialerAccess, getLeadOwnerHandler);

vmRoutes.get('/campaigns', requireAuth, requireSteveComplete, requireVmDialerAccess, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const campaigns = await listVMCampaignsForOwner(tmagId);
    const body: McsVMCampaignListResponse = { ok: true, campaigns };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.post('/campaigns', requireAuth, requireSteveComplete, requireVmDialerAccess, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = CreateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
  }
  const data = parsed.data as {
    leadOwnerId: string;
    name: string;
    provider: McsVMCampaignProviderMode;
    voicemailAudioId?: string | null;
    audioUrl?: string | null;
    smsTemplateId?: string | null;
    emailTemplateId?: string | null;
    scheduledAt?: string | null;
  };
  try {
    const campaign = await createVMCampaign({
      ownerTmagId: tmagId,
      sponsorTmagId: tmagId,
      leadOwnerId: data.leadOwnerId,
      name: data.name,
      provider: data.provider,
      voicemailAudioId: data.voicemailAudioId ?? null,
      audioUrl: data.audioUrl ?? null,
      smsTemplateId: data.smsTemplateId ?? null,
      emailTemplateId: data.emailTemplateId ?? null,
      scheduledAt: data.scheduledAt ?? null,
    });
    const body: McsVMCampaignResponse = { ok: true, campaign };
    return res.status(201).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.get('/campaigns/:campaignId', requireAuth, requireSteveComplete, requireVmDialerAccess, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const campaign = await findVMCampaignForOwner(routeParam(req, 'campaignId'), tmagId);
    const body: McsVMCampaignResponse = { ok: true, campaign };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.patch('/campaigns/:campaignId/status', requireAuth, requireSteveComplete, requireVmDialerAccess, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = StatusPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const payload = parsed.data as McsVmCampaignStatusPatchPayload;
    const campaign = await patchVMCampaignStatusForOwner({
      vmCampaignId: routeParam(req, 'campaignId'),
      ownerTmagId: tmagId,
      action: payload.action,
      scheduledAt: payload.scheduledAt ?? null,
    });
    const body: McsVmCampaignStatusPatchResponse = { ok: true, campaign };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

function emptyMetrics(): McsVmCampaignMetrics {
  const metrics = Object.fromEntries(METRIC_STATUSES.map((status) => [status, 0])) as Record<
    McsVmCampaignMetricStatus,
    number
  >;
  return { ...metrics, total: 0 };
}

async function campaignLeadMetrics(filter: Record<string, unknown>): Promise<McsVmCampaignMetrics> {
  const metrics = emptyMetrics();
  const result = await persistenceCall<{ results: Array<{ _id: McsVmCampaignMetricStatus; count: number }> }>(
    'mongodb',
    'aggregate',
    {
      database: MONGO_DB,
      collection: LEADS_COLLECTION,
      pipeline: [{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }],
    },
  );
  for (const row of result.results ?? []) {
    if (METRIC_STATUSES.includes(row._id)) {
      metrics[row._id] = row.count;
      metrics.total += row.count;
    }
  }
  return metrics;
}

vmRoutes.get('/campaigns/:campaignId/metrics', requireAuth, requireSteveComplete, requireVmDialerAccess, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const vmCampaignId = routeParam(req, 'campaignId');
  try {
    await findVMCampaignForOwner(vmCampaignId, tmagId);
    const metrics = await campaignLeadMetrics({ vmCampaignId, ownerTmagId: tmagId });
    const body: McsVmCampaignMetricsResponse = { ok: true, vmCampaignId, metrics };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.get('/campaigns/:campaignId/leads', requireAuth, requireSteveComplete, requireVmDialerAccess, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = LeadStatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_query', issues: parsed.error.issues });
  }
  const vmCampaignId = routeParam(req, 'campaignId');
  const { status, page, pageSize } = parsed.data;
  const filter: Record<string, unknown> = { vmCampaignId, ownerTmagId: tmagId };
  if (status) filter.status = status;
  try {
    await findVMCampaignForOwner(vmCampaignId, tmagId);
    const [rowsResult, countResult] = await Promise.all([
      persistenceCall<{ results: McsVmCampaignLeadRow[] }>('mongodb', 'aggregate', {
        database: MONGO_DB,
        collection: LEADS_COLLECTION,
        pipeline: [
          { $match: filter },
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            $project: {
              _id: 0,
              leadId: 1,
              firstName: 1,
              lastName: 1,
              city: 1,
              stateOrRegion: 1,
              country: 1,
              normalizedPhone: 1,
              normalizedEmail: 1,
              status: 1,
              token: 1,
              crmRecordId: 1,
              validationIssues: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
      }),
      persistenceCall<{ results: Array<{ count: number }> }>('mongodb', 'aggregate', {
        database: MONGO_DB,
        collection: LEADS_COLLECTION,
        pipeline: [{ $match: filter }, { $count: 'count' }],
      }),
    ]);
    const body: McsVmCampaignLeadsResponse = {
      ok: true,
      leads: rowsResult.results ?? [],
      page,
      pageSize,
      total: countResult.results?.[0]?.count ?? 0,
    };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.get('/campaigns/:campaignId/manual-export', requireAuth, requireSteveComplete, requireVmDialerAccess, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const vmCampaignId = routeParam(req, 'campaignId');
  try {
    await findVMCampaignForOwner(vmCampaignId, tmagId);
    const csv = await buildManualExportCsv(vmCampaignId, tmagId);
    return res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="vm-campaign-${vmCampaignId}.csv"`)
      .send(csv);
  } catch (err) {
    return sendVmError(res, err);
  }
});

async function importLeadOwnerLeadsHandler(req: import('express').Request, res: import('express').Response) {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = ImportLeadsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const leadOwnerId = routeParam(req, 'leadOwnerId');
    await findLeadOwnerForOwner(leadOwnerId, tmagId);
    const campaign = await findVMCampaignForOwner(parsed.data.vmCampaignId, tmagId);
    if (campaign.leadOwnerId !== leadOwnerId) {
      throw new VMCampaignError('campaign_lead_owner_mismatch');
    }
    const result = await createManualImportJobs({
      ownerTmagId: tmagId,
      sponsorTmagId: tmagId,
      leadOwnerId,
      vmCampaignId: campaign.vmCampaignId,
      sourceLabel: campaign.provider,
      rows: parsed.data.leads,
      createdBy: tmagId,
    });
    const body: McsVmImportQueuedResponse = {
      ok: true,
      importJobId: result.importJobId,
      chunksQueued: result.chunksQueued,
      rowsAccepted: result.rowsAccepted,
    };
    return res.status(201).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
}

vmRoutes.post('/lead-owners/:leadOwnerId/import', requireAuth, requireSteveComplete, requireVmDialerAccess, importLeadOwnerLeadsHandler);

vmRoutes.get('/imports/:importJobId', requireAuth, requireSteveComplete, requireVmDialerAccess, async (req, res) => {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const importJobId = routeParam(req, 'importJobId');
  try {
    const counts = await campaignLeadMetrics({ importJobId, ownerTmagId: tmagId });
    const body: McsVmImportJobStatusResponse = { ok: true, importJobId, counts };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});
