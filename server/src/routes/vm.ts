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
  McsImportBulkLeadsResponse,
} from '@momentum/shared';
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
} from '../domain/vmCampaigns.js';
import { BulkLeadError, importBulkLeads } from '../domain/bulkLeads.js';

export const vmRoutes: Router = Router();

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
});

const ImportLeadsSchema = z.object({
  vmCampaignId: z.string().min(4).max(120),
  leads: z.array(ImportLeadSchema).min(1).max(500),
});

function sessionTmagId(req: import('express').Request): string | null {
  return req.session?.tmagId ?? null;
}

function routeParam(req: import('express').Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function sendVmError(res: import('express').Response, err: unknown) {
  if (
    err instanceof LeadOwnerError ||
    err instanceof VMCampaignError ||
    err instanceof BulkLeadError
  ) {
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

async function importLeadOwnerLeadsHandler(req: import('express').Request, res: import('express').Response) {
  const tmagId = sessionTmagId(req);
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const parsed = ImportLeadsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const result = await importBulkLeads({
      ownerTmagId: tmagId,
      sponsorTmagId: tmagId,
      leadOwnerId: routeParam(req, 'leadOwnerId'),
      vmCampaignId: parsed.data.vmCampaignId,
      leads: parsed.data.leads,
    });
    const body: McsImportBulkLeadsResponse = {
      ok: true,
      leadOwner: result.leadOwner,
      campaign: result.campaign,
      leads: result.leads,
    };
    return res.status(201).json(body);
  } catch (err) {
    return sendVmError(res, err);
  }
}

vmRoutes.post('/lead-owners/:leadOwnerId/import', requireAuth, requireSteveComplete, requireVmDialerAccess, importLeadOwnerLeadsHandler);
