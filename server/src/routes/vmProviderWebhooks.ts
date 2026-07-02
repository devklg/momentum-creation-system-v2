import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import { requireAdmin } from '../middleware/requireAuth.js';
import {
  createManualImportJobs,
  listDeliveryRowsForManualExport,
  recordProviderWebhook,
  type VmImportLeadRow,
  type VmProviderKey,
} from '../domain/vmProviderQueue.js';
import { buildManualCsv } from '../services/vmProviders/manualCsv.js';
import { listVmProviders } from '../services/vmProviders/index.js';

export const vmProviderWebhookRoutes: Router = express.Router();

const PROVIDERS = ['manual_csv', 'acquisition_provider_placeholder'] as const;

const ProviderParams = z.object({
  provider: z.enum(PROVIDERS),
});

const LeadRowSchema = z.object({
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().max(254).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  stateOrRegion: z.string().max(120).nullable().optional(),
  country: z.string().max(2).nullable().optional(),
  sourceLeadId: z.string().max(120).nullable().optional(),
  consentStatus: z.enum(['unknown', 'provided', 'not_provided', 'do_not_contact']).optional(),
  raw: z.record(z.unknown()).optional(),
});

const JsonImportBody = z.object({
  leadOwnerId: z.string().min(3).max(160),
  vmCampaignId: z.string().min(3).max(160),
  ownerTmagId: z.string().min(2).max(80),
  sponsorTmagId: z.string().min(2).max(80),
  sourceLabel: z.string().min(2).max(120).default('manual_csv'),
  rows: z.array(LeadRowSchema).min(1).max(10_000),
});

const CsvImportQuery = z.object({
  leadOwnerId: z.string().min(3).max(160),
  vmCampaignId: z.string().min(3).max(160),
  ownerTmagId: z.string().min(2).max(80),
  sponsorTmagId: z.string().min(2).max(80),
  sourceLabel: z.string().min(2).max(120).default('manual_csv'),
});

vmProviderWebhookRoutes.get('/status', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    ok: true,
    liveDeliveryEnabled: env.VM_LIVE_DELIVERY_ENABLED,
    defaultProviderMode: env.VM_PROVIDER_MODE,
    deliveryRatePerMinute: env.VM_DELIVERY_RATE_PER_MINUTE,
    providers: listVmProviders(),
  });
});

vmProviderWebhookRoutes.post('/manual-csv/import', requireAdmin, async (req: Request, res: Response) => {
  const parsed = JsonImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid VM import payload.', issues: parsed.error.issues });
    return;
  }

  try {
    const result = await createManualImportJobs({
      ...parsed.data,
      rows: parsed.data.rows,
      createdBy: req.session?.tmagId ?? 'admin',
    });
    res.status(202).json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'import_failed' });
  }
});

vmProviderWebhookRoutes.post(
  '/manual-csv/import.csv',
  requireAdmin,
  express.text({ type: ['text/csv', 'text/plain'], limit: '25mb' }),
  async (req: Request, res: Response) => {
    const query = CsvImportQuery.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ ok: false, error: 'Invalid CSV import query.', issues: query.error.issues });
      return;
    }

    try {
      const rows = parseLeadCsv(typeof req.body === 'string' ? req.body : '');
      const result = await createManualImportJobs({
        ...query.data,
        rows,
        createdBy: req.session?.tmagId ?? 'admin',
      });
      res.status(202).json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'csv_import_failed' });
    }
  },
);

vmProviderWebhookRoutes.get('/manual-csv/export/:campaignId', requireAdmin, async (req: Request, res: Response) => {
  const campaignId = String(req.params.campaignId ?? '');
  if (!campaignId) {
    res.status(400).json({ ok: false, error: 'campaignId required.' });
    return;
  }
  try {
    const rows = await listDeliveryRowsForManualExport(campaignId);
    const csv = buildManualCsv(rows, env.PROSPECT_BASE_URL.replace(/\/$/, ''));
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="vm-campaign-${campaignId}.csv"`)
      .send(csv);
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'manual_export_failed' });
  }
});

vmProviderWebhookRoutes.post('/:provider/webhook', async (req: Request, res: Response) => {
  const params = ProviderParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ ok: false, error: 'unknown_provider' });
    return;
  }
  if (env.VM_WEBHOOK_SHARED_SECRET) {
    const presented = req.header('x-vm-provider-secret');
    if (presented !== env.VM_WEBHOOK_SHARED_SECRET) {
      res.status(401).json({ ok: false, error: 'invalid_webhook_secret' });
      return;
    }
  }

  try {
    const payload = coerceObject(req.body);
    const result = await recordProviderWebhook({
      provider: params.data.provider as VmProviderKey,
      payload,
      headers: req.headers,
    });
    res.status(202).json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'webhook_ingest_failed' });
  }
});

function coerceObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function parseLeadCsv(csv: string): VmImportLeadRow[] {
  const lines = parseCsvRows(csv);
  if (lines.length < 2) throw new Error('csv_requires_header_and_rows');
  const headers = lines[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const rows: VmImportLeadRow[] = [];
  for (const cols of lines.slice(1)) {
    if (cols.every((c) => c.trim() === '')) continue;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cols[index]?.trim() ?? '';
    });
    rows.push({
      firstName: pick(record, ['firstname', 'first_name', 'first name']),
      lastName: pick(record, ['lastname', 'last_name', 'last name']),
      phone: pick(record, ['phone', 'mobile', 'cell', 'telephone']),
      email: pick(record, ['email', 'emailaddress', 'email_address']),
      city: pick(record, ['city']),
      stateOrRegion: pick(record, ['state', 'stateorregion', 'state_or_region', 'region']),
      country: pick(record, ['country']) || 'US',
      sourceLeadId: pick(record, ['sourceleadid', 'source_lead_id', 'leadid', 'lead_id']),
      consentStatus: 'unknown',
      raw: record,
    });
  }
  return rows;
}

function pick(record: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value) return value;
  }
  return null;
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
