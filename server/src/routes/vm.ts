/**
 * /api/vm — BA-owned VM lead batch and campaign API.
 *
 * Owner/sponsor identity comes only from req.session.baId. Client payloads
 * cannot override ownership.
 */

import { Router } from 'express';
import { z } from 'zod';
import type {
  LeadBatchListResponse,
  LeadBatchResponse,
  VMCampaignListResponse,
  VMCampaignProviderMode,
  VMCampaignResponse,
  ImportBulkLeadsResponse,
} from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
import {
  LeadBatchError,
  createLeadBatch,
  findLeadBatchForOwner,
  listLeadBatchesForOwner,
} from '../domain/vmLeadBatches.js';
import {
  VMCampaignError,
  createVMCampaign,
  findVMCampaignForOwner,
  listVMCampaignsForOwner,
} from '../domain/vmCampaigns.js';
import { BulkLeadError, importBulkLeads } from '../domain/bulkLeads.js';

export const vmRoutes: Router = Router();

const PROVIDERS: readonly VMCampaignProviderMode[] = [
  'manual_csv',
  'leadsrain_style_adapter',
  'slybroadcast_style_adapter',
  'future_telecom_adapter',
];

const CreateBatchSchema = z.object({
  name: z.string().min(1).max(160),
  source: z.string().min(1).max(120),
  country: z.string().min(2).max(2).default('US'),
  leadType: z.string().min(1).max(80),
  quantityImported: z.number().int().min(0).max(10_000_000).default(0),
});

const CreateCampaignSchema = z.object({
  leadBatchId: z.string().min(4).max(120),
  name: z.string().min(1).max(160),
  provider: z.enum(PROVIDERS as [VMCampaignProviderMode, ...VMCampaignProviderMode[]]).default('manual_csv'),
  voicemailAudioId: z.string().min(1).max(120).nullable().optional(),
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
});

const ImportLeadsSchema = z.object({
  vmCampaignId: z.string().min(4).max(120),
  leads: z.array(ImportLeadSchema).min(1).max(500),
});

function sessionBaId(req: import('express').Request): string | null {
  return req.session?.baId ?? null;
}

function routeParam(req: import('express').Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function sendVmError(res: import('express').Response, err: unknown) {
  if (
    err instanceof LeadBatchError ||
    err instanceof VMCampaignError ||
    err instanceof BulkLeadError
  ) {
    const status =
      err.code.endsWith('_not_found') || err.code === 'campaign_batch_mismatch'
        ? 404
        : 400;
    return res.status(status).json({ ok: false, error: err.code });
  }
  // eslint-disable-next-line no-console
  console.error('[vm route] unexpected error', err);
  return res.status(500).json({ ok: false, error: 'server_error' });
}

vmRoutes.get('/batches', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = sessionBaId(req);
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const batches = await listLeadBatchesForOwner(baId);
    const body: LeadBatchListResponse = { ok: true, batches };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.post('/batches', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = sessionBaId(req);
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = CreateBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const batch = await createLeadBatch({
      ownerTmBaId: baId,
      sponsorTmBaId: baId,
      ...parsed.data,
    });
    const body: LeadBatchResponse = { ok: true, batch };
    return res.status(201).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.get('/batches/:batchId', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = sessionBaId(req);
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const batch = await findLeadBatchForOwner(routeParam(req, 'batchId'), baId);
    const body: LeadBatchResponse = { ok: true, batch };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.get('/campaigns', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = sessionBaId(req);
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const campaigns = await listVMCampaignsForOwner(baId);
    const body: VMCampaignListResponse = { ok: true, campaigns };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.post('/campaigns', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = sessionBaId(req);
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = CreateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const campaign = await createVMCampaign({
      ownerTmBaId: baId,
      sponsorTmBaId: baId,
      leadBatchId: parsed.data.leadBatchId,
      name: parsed.data.name,
      provider: parsed.data.provider,
      voicemailAudioId: parsed.data.voicemailAudioId ?? null,
      smsTemplateId: parsed.data.smsTemplateId ?? null,
      emailTemplateId: parsed.data.emailTemplateId ?? null,
      scheduledAt: parsed.data.scheduledAt ?? null,
    });
    const body: VMCampaignResponse = { ok: true, campaign };
    return res.status(201).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.get('/campaigns/:campaignId', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = sessionBaId(req);
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const campaign = await findVMCampaignForOwner(routeParam(req, 'campaignId'), baId);
    const body: VMCampaignResponse = { ok: true, campaign };
    return res.status(200).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});

vmRoutes.post('/batches/:batchId/import', requireAuth, requireMichaelComplete, async (req, res) => {
  const baId = sessionBaId(req);
  if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = ImportLeadsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const result = await importBulkLeads({
      ownerTmBaId: baId,
      sponsorTmBaId: baId,
      leadBatchId: routeParam(req, 'batchId'),
      vmCampaignId: parsed.data.vmCampaignId,
      leads: parsed.data.leads,
    });
    const body: ImportBulkLeadsResponse = {
      ok: true,
      batch: result.batch,
      campaign: result.campaign,
      leads: result.leads,
    };
    return res.status(201).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
});
