/**
 * /vm-campaigns - BA-facing VM campaign workspace.
 *
 * Live UI for lead-owner lists, campaign setup, queued import,
 * owner-scoped manual export, lifecycle controls, and campaign metrics.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  FileUp,
  ListChecks,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import type {
  McsCreateLeadOwnerPayload,
  McsCreateVMCampaignPayload,
  McsImportBulkLeadPayload,
  McsImportBulkLeadsPayload,
  McsLeadOwnerListResponse,
  McsLeadOwnerRecord,
  McsLeadOwnerResponse,
  McsVMCampaignListResponse,
  McsVMCampaignRecord,
  McsVMCampaignResponse,
  McsVmCampaignLeadRow,
  McsVmCampaignLeadsResponse,
  McsVmCampaignMetricStatus,
  McsVmCampaignMetrics,
  McsVmCampaignMetricsResponse,
  McsVmCampaignProvider,
  McsVmCampaignStatus,
  McsVmCampaignStatusAction,
  McsVmCampaignStatusPatchPayload,
  McsVmCampaignStatusPatchResponse,
  McsVmImportJobStatusResponse,
  McsVmImportQueuedResponse,
  McsVmLeadOwnerSource,
  McsVmLeadType,
} from '@momentum/shared';
import type { McsVmCampaignDialFields, McsVmDialMode } from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LeadWorkPanel,
  PilotReadoutCard,
  RaisedHandsCard,
  TransferAvailabilityCard,
} from '@/components/vm/PilotCockpit';

type ApiErrorBody = { ok?: false; error?: string };
type LoadState = 'loading' | 'ready' | 'locked' | 'error';
type LeadStatusFilter = 'all' | McsVmCampaignMetricStatus;

interface ImportJobView {
  importJobId: string;
  rowsAccepted: number;
  chunksQueued: number;
  counts: McsVmCampaignMetrics | null;
  error: string | null;
}

const PROVIDER_OPTIONS: Array<{ value: McsVmCampaignProvider; label: string; help: string }> = [
  { value: 'manual_csv', label: 'Manual CSV', help: 'Owner export, no live dialer.' },
  { value: 'acquisition_provider_placeholder', label: 'Provider placeholder', help: 'Dry-run acquisition adapter.' },
  { value: 'telnyx_call_control', label: 'Telnyx Call Control', help: 'Live-capable only after admin approval.' },
  { value: 'leadsrain_style_adapter', label: 'LeadsRain-style adapter', help: 'Provider-mode integration.' },
  { value: 'slybroadcast_style_adapter', label: 'Slybroadcast-style adapter', help: 'Provider-mode integration.' },
];

const PROVIDER_LABEL: Record<McsVmCampaignProvider, string> = {
  manual_csv: 'Manual CSV',
  acquisition_provider_placeholder: 'Provider placeholder',
  telnyx_call_control: 'Telnyx Call Control',
  leadsrain_style_adapter: 'LeadsRain-style adapter',
  slybroadcast_style_adapter: 'Slybroadcast-style adapter',
  future_telecom_adapter: 'Future telecom adapter',
  none: 'None',
};

const STATUS_LABEL: Record<McsVmCampaignStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  dry_run: 'Dry-run',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

const LEAD_OWNER_SOURCES: Array<{ value: McsVmLeadOwnerSource; label: string }> = [
  { value: 'uploaded_csv', label: 'Uploaded CSV' },
  { value: 'manual_import', label: 'Manual import' },
  { value: 'provider_import', label: 'Provider import' },
  { value: 'apache_leads', label: 'Apache leads' },
  { value: 'admin_seed', label: 'Admin seed' },
  { value: 'other', label: 'Other' },
];

const LEAD_TYPES: Array<{ value: McsVmLeadType; label: string }> = [
  { value: 'mobile_vm', label: 'Mobile VM' },
  { value: 'mobile_sms', label: 'Mobile SMS' },
  { value: 'email', label: 'Email' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'unknown', label: 'Unknown' },
];

const METRIC_STATUSES: McsVmCampaignMetricStatus[] = [
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
];

const IMPORT_PROGRESS: McsVmCampaignMetricStatus[] = [
  'imported',
  'validated',
  'token_created',
  'crm_created',
  'delivery_dry_run',
  'manual_exported',
  'voicemail_drop_delivered',
];

const EMPTY_METRICS: McsVmCampaignMetrics = {
  total: 0,
  imported: 0,
  validated: 0,
  invalid: 0,
  duplicate: 0,
  suppressed: 0,
  token_created: 0,
  crm_created: 0,
  queued: 0,
  delivery_dry_run: 0,
  manual_exported: 0,
  voicemail_drop_queued: 0,
  voicemail_drop_delivered: 0,
  voicemail_drop_failed: 0,
  opted_out: 0,
};

const PAGE_SIZE = 25;

function numberFmt(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Not set';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function toIsoFromLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isVmDialerLocked(status: number, body: unknown): boolean {
  return (
    status === 403 &&
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    (body as { error?: unknown }).error === 'VM_DIALER_NOT_ENABLED'
  );
}

async function readJson<T>(res: Response): Promise<T | ApiErrorBody> {
  try {
    return (await res.json()) as T | ApiErrorBody;
  } catch {
    return { ok: false, error: res.ok ? 'Invalid server response.' : `Request failed (${res.status}).` };
  }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseLeadCsv(text: string): McsImportBulkLeadPayload[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerLine = lines[0];
  if (!headerLine) return [];

  const headers = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());
  const indexOf = (name: string) => headers.indexOf(name.toLowerCase());
  const required = ['firstname', 'lastname', 'phone', 'email', 'city', 'stateorregion', 'country'];
  const hasAnyHeader = required.some((name) => indexOf(name) >= 0);
  if (!hasAnyHeader) return [];

  return lines.slice(1).flatMap((line) => {
    const cols = parseCsvLine(line);
    const get = (name: string) => {
      const idx = indexOf(name);
      return idx >= 0 ? (cols[idx] ?? '').trim() : '';
    };
    const firstName = get('firstname');
    const lastName = get('lastname');
    const phone = get('phone');
    const email = get('email');
    if (!firstName && !lastName && !phone && !email) return [];
    return [
      {
        firstName,
        lastName,
        phone: phone || null,
        email: email || null,
        city: get('city'),
        stateOrRegion: get('stateorregion'),
        country: get('country') || 'US',
      },
    ];
  });
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

export function VmCampaignsPage() {
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [pageError, setPageError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [leadOwners, setLeadOwners] = useState<McsLeadOwnerRecord[]>([]);
  const [campaigns, setCampaigns] = useState<McsVMCampaignRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<McsVmCampaignMetrics>(EMPTY_METRICS);
  const [leads, setLeads] = useState<McsVmCampaignLeadRow[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(1);
  const [leadFilter, setLeadFilter] = useState<LeadStatusFilter>('all');
  const [detailLoading, setDetailLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [workLeadId, setWorkLeadId] = useState<string | null>(null);

  const selected = campaigns.find((campaign) => campaign.vmCampaignId === selectedId) ?? null;
  const selectedLeadOwner =
    selected ? leadOwners.find((owner) => owner.leadOwnerId === selected.leadOwnerId) ?? null : null;

  const loadWorkspace = useCallback(async () => {
    setLoadState('loading');
    setPageError(null);
    try {
      const [ownersRes, campaignsRes] = await Promise.all([
        fetch('/api/vm/lead-owners', { credentials: 'include' }),
        fetch('/api/vm/campaigns', { credentials: 'include' }),
      ]);
      const ownersBody = await readJson<McsLeadOwnerListResponse>(ownersRes);
      const campaignsBody = await readJson<McsVMCampaignListResponse>(campaignsRes);
      if (isVmDialerLocked(ownersRes.status, ownersBody) || isVmDialerLocked(campaignsRes.status, campaignsBody)) {
        setLoadState('locked');
        return;
      }
      if (!ownersRes.ok || !('ok' in ownersBody) || ownersBody.ok !== true) {
        setLoadState('error');
        setPageError('Could not load lead owners.');
        return;
      }
      if (!campaignsRes.ok || !('ok' in campaignsBody) || campaignsBody.ok !== true) {
        setLoadState('error');
        setPageError('Could not load VM campaigns.');
        return;
      }
      setLeadOwners(ownersBody.leadOwners);
      setCampaigns(campaignsBody.campaigns);
      setSelectedId((prev) => prev ?? campaignsBody.campaigns[0]?.vmCampaignId ?? null);
      setLoadState('ready');
    } catch (e) {
      setLoadState('error');
      setPageError(e instanceof Error ? `Network error: ${e.message}` : 'Network error loading VM workspace.');
    }
  }, []);

  const loadCampaignDetail = useCallback(async (campaignId: string) => {
    setDetailLoading(true);
    setPageError(null);
    try {
      const res = await fetch(`/api/vm/campaigns/${encodeURIComponent(campaignId)}`, {
        credentials: 'include',
      });
      const body = await readJson<McsVMCampaignResponse>(res);
      if (isVmDialerLocked(res.status, body)) {
        setLoadState('locked');
        return;
      }
      if (!res.ok || !('ok' in body) || body.ok !== true) {
        setPageError((body as ApiErrorBody).error ?? 'Could not load campaign detail.');
        return;
      }
      setCampaigns((prev) => prev.map((c) => (c.vmCampaignId === campaignId ? body.campaign : c)));
      setSelectedSchedule(toLocalInputValue(body.campaign.scheduledAt));
    } catch (e) {
      setPageError(e instanceof Error ? `Network error: ${e.message}` : 'Network error loading campaign detail.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async (campaignId: string) => {
    try {
      const res = await fetch(`/api/vm/campaigns/${encodeURIComponent(campaignId)}/metrics`, {
        credentials: 'include',
      });
      const body = await readJson<McsVmCampaignMetricsResponse>(res);
      if (res.ok && 'ok' in body && body.ok === true) {
        setMetrics({ ...EMPTY_METRICS, ...body.metrics });
      }
    } catch {
      setToast('Could not refresh campaign metrics.');
    }
  }, []);

  const loadLeads = useCallback(async (campaignId: string, page: number, status: LeadStatusFilter) => {
    setLeadsLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (status !== 'all') qs.set('status', status);
      const res = await fetch(`/api/vm/campaigns/${encodeURIComponent(campaignId)}/leads?${qs.toString()}`, {
        credentials: 'include',
      });
      const body = await readJson<McsVmCampaignLeadsResponse>(res);
      if (res.ok && 'ok' in body && body.ok === true) {
        setLeads(body.leads);
        setLeadsTotal(body.total);
      } else {
        setToast((body as ApiErrorBody).error ?? 'Could not load campaign leads.');
      }
    } catch {
      setToast('Network error loading campaign leads.');
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const refreshSelectedCampaignData = useCallback(() => {
    if (!selectedId) return;
    void loadMetrics(selectedId);
    void loadLeads(selectedId, leadPage, leadFilter);
  }, [leadFilter, leadPage, loadLeads, loadMetrics, selectedId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedId || loadState !== 'ready') return;
    void loadCampaignDetail(selectedId);
    void loadMetrics(selectedId);
  }, [loadCampaignDetail, loadMetrics, loadState, selectedId]);

  useEffect(() => {
    if (!selectedId || loadState !== 'ready') return;
    void loadLeads(selectedId, leadPage, leadFilter);
  }, [leadFilter, leadPage, loadLeads, loadState, selectedId]);

  const totals = useMemo(
    () => ({
      campaigns: campaigns.length,
      leadOwners: leadOwners.length,
      imported: leadOwners.reduce((sum, owner) => sum + owner.quantityImported, 0),
      liveApproved: campaigns.filter((campaign) => campaign.adminApprovedForLiveDelivery === true).length,
    }),
    [campaigns, leadOwners],
  );

  async function createLeadOwner(payload: McsCreateLeadOwnerPayload) {
    setToast(null);
    const res = await fetch('/api/vm/lead-owners', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await readJson<McsLeadOwnerResponse>(res);
    if (isVmDialerLocked(res.status, body)) {
      setLoadState('locked');
      return;
    }
    if (!res.ok || !('ok' in body) || body.ok !== true) {
      throw new Error((body as ApiErrorBody).error ?? 'Could not create lead owner.');
    }
    setLeadOwners((prev) => [body.leadOwner, ...prev]);
    setToast('Lead-owner list created.');
  }

  async function createCampaign(payload: McsCreateVMCampaignPayload) {
    setToast(null);
    const res = await fetch('/api/vm/campaigns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await readJson<McsVMCampaignResponse>(res);
    if (isVmDialerLocked(res.status, body)) {
      setLoadState('locked');
      return;
    }
    if (!res.ok || !('ok' in body) || body.ok !== true) {
      throw new Error((body as ApiErrorBody).error ?? 'Could not create campaign.');
    }
    setCampaigns((prev) => [body.campaign, ...prev]);
    setSelectedId(body.campaign.vmCampaignId);
    setToast('Campaign created.');
  }

  async function patchStatus(action: McsVmCampaignStatusAction, scheduledAt?: string | null) {
    if (!selected) return;
    setToast(null);
    const payload: McsVmCampaignStatusPatchPayload = { action };
    if (action === 'schedule') payload.scheduledAt = scheduledAt ?? null;
    const res = await fetch(`/api/vm/campaigns/${encodeURIComponent(selected.vmCampaignId)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await readJson<McsVmCampaignStatusPatchResponse>(res);
    if (res.status === 409) {
      setToast('That campaign transition is not allowed from the current status.');
      return;
    }
    if (!res.ok || !('ok' in body) || body.ok !== true) {
      setToast((body as ApiErrorBody).error ?? 'Could not update campaign status.');
      return;
    }
    setCampaigns((prev) => prev.map((c) => (c.vmCampaignId === selected.vmCampaignId ? body.campaign : c)));
    setSelectedSchedule(toLocalInputValue(body.campaign.scheduledAt));
    setToast(`Campaign is now ${STATUS_LABEL[body.campaign.status]}.`);
  }

  async function patchDialMode(dialMode: McsVmDialMode) {
    if (!selected) return;
    setToast(null);
    const res = await fetch(`/api/vm/campaigns/${encodeURIComponent(selected.vmCampaignId)}/dial-mode`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dialMode }),
    });
    const body = await readJson<McsVMCampaignResponse>(res);
    if (!res.ok || !('ok' in body) || body.ok !== true) {
      setToast((body as ApiErrorBody).error ?? 'Could not update dial mode.');
      return;
    }
    setCampaigns((prev) => prev.map((c) => (c.vmCampaignId === selected.vmCampaignId ? body.campaign : c)));
    setToast(`Dial mode is now ${dialMode.replace(/_/g, ' ')}.`);
  }

  async function importLeadBatch(rows: McsImportBulkLeadPayload[]) {
    if (!selected) throw new Error('Select a campaign first.');
    const payload: McsImportBulkLeadsPayload = {
      vmCampaignId: selected.vmCampaignId,
      leads: rows,
    };
    const res = await fetch(`/api/vm/lead-owners/${encodeURIComponent(selected.leadOwnerId)}/import`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await readJson<McsVmImportQueuedResponse>(res);
    if (!res.ok || !('ok' in body) || body.ok !== true) {
      throw new Error((body as ApiErrorBody).error ?? 'Could not queue import batch.');
    }
    return body;
  }

  async function downloadManualExport() {
    if (!selected) return;
    setToast(null);
    try {
      const res = await fetch(`/api/vm/campaigns/${encodeURIComponent(selected.vmCampaignId)}/manual-export`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await readJson<ApiErrorBody>(res);
        setToast(('error' in body && body.error) || 'Could not download manual export.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selected.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-manual-export.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setToast('Network error downloading manual export.');
    }
  }

  if (loadState === 'locked') {
    return (
      <main className="min-h-screen px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl rounded-md border border-gold/30 bg-gold/[0.06] p-6 md:p-8">
          <ShieldAlert className="mb-4 h-8 w-8 text-gold" aria-hidden="true" />
          <p className="font-mono tracking-[0.22em] text-[11px] text-gold uppercase mb-2">
            VM Dialer
          </p>
          <h1 className="font-display text-[44px] leading-none text-cream">
            Dialer access is not enabled
          </h1>
          <p className="mt-4 text-sm leading-[1.7] text-cream-mute">
            The VM dialer is not enabled for your account yet. Contact Kevin or your admin
            to turn on the vm_dialer entitlement before creating campaigns.
          </p>
          <Button
            onClick={() => navigate('/cockpit')}
            className="mt-6 border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40"
          >
            Back to cockpit
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/cockpit')}
              className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-cream-faint hover:text-gold uppercase"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Cockpit
            </button>
            <p className="font-mono tracking-[0.22em] text-[11px] text-gold uppercase mb-2">
              VM Campaigns
            </p>
            <h1 className="font-display text-[clamp(38px,7vw,72px)] leading-[0.9] text-cream">
              Campaign workspace
            </h1>
          </div>
          <Button
            onClick={() => void loadWorkspace()}
            className="border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px] tracking-[0.04em]"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </header>

        {toast && (
          <div className="mb-5 rounded-md border border-gold/30 bg-gold/[0.06] p-3 font-mono text-[12px] tracking-[0.04em] text-gold">
            {toast}
          </div>
        )}

        {loadState === 'loading' && <StatusCard text="Loading VM campaign workspace..." />}
        {loadState === 'error' && (
          <StatusCard
            text={pageError ?? 'Could not load VM campaign workspace.'}
            actionLabel="Try again"
            onAction={() => void loadWorkspace()}
          />
        )}

        {loadState === 'ready' && (
          <>
            {/* Pilot cockpit — the raised-hand list ALWAYS comes first. */}
            <div className="mb-6 space-y-6">
              <RaisedHandsCard onWorkLead={(leadId) => setWorkLeadId(leadId)} />
              {workLeadId && (
                <LeadWorkPanel
                  leadId={workLeadId}
                  onClose={() => setWorkLeadId(null)}
                  onChanged={refreshSelectedCampaignData}
                />
              )}
              <PilotReadoutCard />
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Campaigns" value={totals.campaigns} />
              <Metric label="Lead owners" value={totals.leadOwners} />
              <Metric label="Imported" value={totals.imported} accent="teal" />
              <Metric label="Live approved" value={totals.liveApproved} accent="gold" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <TransferAvailabilityCard />
                <CampaignCreateCard leadOwners={leadOwners} onCreate={(payload) => createCampaign(payload)} />
                <LeadOwnerCreateCard onCreate={(payload) => createLeadOwner(payload)} />
                <CampaignList
                  campaigns={campaigns}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setLeadPage(1);
                  }}
                />
              </aside>

              <section className="space-y-6">
                {selected ? (
                  <>
                    <CampaignDetail
                      campaign={selected}
                      leadOwner={selectedLeadOwner}
                      scheduleValue={selectedSchedule}
                      detailLoading={detailLoading}
                      onScheduleValue={setSelectedSchedule}
                      onPatchStatus={(action, scheduledAt) => void patchStatus(action, scheduledAt)}
                      onManualExport={() => void downloadManualExport()}
                      onDialMode={(dialMode) => void patchDialMode(dialMode)}
                    />
                    <LeadImportCard
                      campaign={selected}
                      leadOwner={selectedLeadOwner}
                      onImportBatch={importLeadBatch}
                      onJobsChanged={refreshSelectedCampaignData}
                    />
                    <CampaignAnalytics
                      metrics={metrics}
                      leads={leads}
                      leadsTotal={leadsTotal}
                      page={leadPage}
                      pageSize={PAGE_SIZE}
                      filter={leadFilter}
                      loading={leadsLoading}
                      onFilter={(status) => {
                        setLeadFilter(status);
                        setLeadPage(1);
                      }}
                      onPage={setLeadPage}
                      onWorkLead={(leadId) => setWorkLeadId(leadId)}
                    />
                  </>
                ) : (
                  <StatusCard text="Create a lead-owner list and campaign to start." />
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'gold' | 'teal';
}) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/[0.02] p-4">
      <p
        className={
          'font-display text-[32px] leading-none ' +
          (accent === 'gold'
            ? 'text-gold'
            : accent === 'teal'
              ? 'text-teal'
              : 'text-cream')
        }
      >
        {numberFmt(value)}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
        {label}
      </p>
    </div>
  );
}

function StatusCard({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/[0.02] p-6">
      <p className="font-mono text-[13px] tracking-[0.04em] text-cream-faint">{text}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="mt-4 border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px]"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function CampaignList({
  campaigns,
  selectedId,
  onSelect,
}: {
  campaigns: McsVMCampaignRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream-mute">
          Campaigns
        </p>
        <span className="font-mono text-[10px] text-cream-faint">{campaigns.length}</span>
      </div>
      <ul className="space-y-2">
        {campaigns.length === 0 ? (
          <li className="rounded border border-cream/10 bg-cream/[0.02] p-3 text-[13px] text-cream-faint">
            No campaigns yet.
          </li>
        ) : (
          campaigns.map((campaign) => (
            <li key={campaign.vmCampaignId}>
              <button
                type="button"
                onClick={() => onSelect(campaign.vmCampaignId)}
                className={
                  'w-full rounded border p-3 text-left transition-colors ' +
                  (campaign.vmCampaignId === selectedId
                    ? 'border-gold/50 bg-gold/[0.05]'
                    : 'border-cream/10 bg-cream/[0.02] hover:border-cream/25')
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] leading-[1.25] text-cream">{campaign.name}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
                      {STATUS_LABEL[campaign.status]} / {PROVIDER_LABEL[campaign.provider]}
                    </p>
                  </div>
                  <LiveBadge campaign={campaign} compact />
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function LeadOwnerCreateCard({
  onCreate,
}: {
  onCreate: (payload: McsCreateLeadOwnerPayload) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [source, setSource] = useState<McsVmLeadOwnerSource>('uploaded_csv');
  const [country, setCountry] = useState('US');
  const [leadType, setLeadType] = useState<McsVmLeadType>('mobile_vm');
  const [quantityImported, setQuantityImported] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        source,
        country: country.trim().toUpperCase() || 'US',
        leadType,
        quantityImported: Math.max(0, Number.parseInt(quantityImported, 10) || 0),
      });
      setName('');
      setQuantityImported('0');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create lead owner.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-md border border-gold/20 bg-cream/[0.02] p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileUp className="h-4 w-4 text-gold" aria-hidden="true" />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream-mute">
          Lead-owner list
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="leadOwnerName">List name</Label>
          <Input id="leadOwnerName" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            id="leadSource"
            label="Source"
            value={source}
            onChange={(value) => setSource(value as McsVmLeadOwnerSource)}
            options={LEAD_OWNER_SOURCES}
          />
          <div>
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            id="leadType"
            label="Lead type"
            value={leadType}
            onChange={(value) => setLeadType(value as McsVmLeadType)}
            options={LEAD_TYPES}
          />
          <div>
            <Label htmlFor="quantityImported">Expected count</Label>
            <Input
              id="quantityImported"
              inputMode="numeric"
              value={quantityImported}
              onChange={(e) => setQuantityImported(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px] tracking-[0.04em]"
        >
          {submitting ? 'Creating...' : 'Create lead owner'}
        </Button>
        {error && <p className="font-mono text-[11px] tracking-[0.04em] text-red-300">{error}</p>}
      </form>
    </section>
  );
}

function CampaignCreateCard({
  leadOwners,
  onCreate,
}: {
  leadOwners: McsLeadOwnerRecord[];
  onCreate: (payload: McsCreateVMCampaignPayload) => Promise<void>;
}) {
  const [leadOwnerId, setLeadOwnerId] = useState('');
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<McsVmCampaignProvider>('manual_csv');
  const [audioUrl, setAudioUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadOwnerId && leadOwners[0]) {
      setLeadOwnerId(leadOwners[0].leadOwnerId);
    }
  }, [leadOwnerId, leadOwners]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        leadOwnerId,
        name: name.trim(),
        provider,
        audioUrl: audioUrl.trim() || null,
        scheduledAt: toIsoFromLocal(scheduledAt),
      });
      setName('');
      setAudioUrl('');
      setScheduledAt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create campaign.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-4">
      <div className="mb-4 flex items-center gap-2">
        <Plus className="h-4 w-4 text-gold" aria-hidden="true" />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream-mute">
          New campaign
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="campaignName">Campaign name</Label>
          <Input id="campaignName" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <SelectField
          id="campaignLeadOwner"
          label="Lead owner"
          value={leadOwnerId}
          onChange={setLeadOwnerId}
          disabled={leadOwners.length === 0}
          options={leadOwners.map((owner) => ({ value: owner.leadOwnerId, label: owner.name }))}
        />
        <SelectField
          id="campaignProvider"
          label="Provider"
          value={provider}
          onChange={(value) => setProvider(value as McsVmCampaignProvider)}
          options={PROVIDER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />
        <div>
          <Label htmlFor="campaignAudio">Audio URL</Label>
          <Input
            id="campaignAudio"
            type="url"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <Label htmlFor="campaignSchedule">Scheduled at</Label>
          <Input
            id="campaignSchedule"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={submitting || !leadOwnerId}
          className="w-full bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px]"
        >
          {submitting ? 'Creating...' : 'Create campaign'}
        </Button>
        {leadOwners.length === 0 && (
          <p className="text-[12px] leading-[1.5] text-cream-faint">
            Create a lead-owner list before creating a campaign.
          </p>
        )}
        {error && <p className="font-mono text-[11px] tracking-[0.04em] text-red-300">{error}</p>}
      </form>
    </section>
  );
}

const DIAL_MODE_OPTIONS: Array<{ value: McsVmDialMode; label: string; help: string }> = [
  { value: 'vm_only', label: 'VM only', help: 'Machine → voicemail. Human → press-1 gather.' },
  { value: 'live_transfer', label: 'Live transfer', help: 'Human → bridge to you. Machine → hang up, no message.' },
  { value: 'both', label: 'Both', help: 'Human → bridge to you. Machine → voicemail. Every dial produces something.' },
];

function CampaignDetail({
  campaign,
  leadOwner,
  scheduleValue,
  detailLoading,
  onScheduleValue,
  onPatchStatus,
  onManualExport,
  onDialMode,
}: {
  campaign: McsVMCampaignRecord;
  leadOwner: McsLeadOwnerRecord | null;
  scheduleValue: string;
  detailLoading: boolean;
  onScheduleValue: (value: string) => void;
  onPatchStatus: (action: McsVmCampaignStatusAction, scheduledAt?: string | null) => void;
  onManualExport: () => void;
  onDialMode: (dialMode: McsVmDialMode) => void;
}) {
  const scheduledIso = toIsoFromLocal(scheduleValue);
  const dialMode = (campaign as McsVMCampaignRecord & McsVmCampaignDialFields).dialMode ?? 'vm_only';

  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            Campaign detail
          </p>
          <h2 className="mt-2 font-display text-[34px] leading-none text-cream">
            {campaign.name}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-cream-mute">
            {leadOwner?.name ?? campaign.leadOwnerId} / {PROVIDER_LABEL[campaign.provider]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {detailLoading && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
              Updating
            </span>
          )}
          <StatusPill status={campaign.status} />
          <LiveBadge campaign={campaign} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Info label="Scheduled" value={formatDate(campaign.scheduledAt)} />
        <Info label="Started" value={formatDate(campaign.startedAt)} />
        <Info label="Completed" value={formatDate(campaign.completedAt)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ReadOnlyBox label="Voicemail audio" icon={<Megaphone />} value={campaign.audioUrl ?? campaign.voicemailAudioId ?? 'Not set'} />
        <ReadOnlyBox label="SMS template" icon={<ListChecks />} value={campaign.smsTemplateId ?? 'Not set'} />
        <ReadOnlyBox label="Email template" icon={<CalendarClock />} value={campaign.emailTemplateId ?? 'Not set'} />
      </div>

      {campaign.provider === 'telnyx_call_control' && (
        <div className="mt-5 rounded-md border border-teal/20 bg-teal/[0.02] p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream-mute">
            Dial mode — what happens when a human answers
          </p>
          <div className="flex flex-wrap gap-2">
            {DIAL_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.help}
                onClick={() => onDialMode(option.value)}
                className={
                  'rounded border px-3 py-2 text-left transition-colors ' +
                  (dialMode === option.value
                    ? 'border-teal/60 bg-teal/[0.08]'
                    : 'border-cream/10 bg-cream/[0.02] hover:border-cream/25')
                }
              >
                <span className={'block font-mono text-[11px] uppercase tracking-[0.06em] ' + (dialMode === option.value ? 'text-teal' : 'text-cream')}>
                  {option.label}
                </span>
                <span className="mt-1 block max-w-[280px] text-[11px] leading-[1.5] text-cream-faint">
                  {option.help}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-md border border-cream/10 bg-cream/[0.02] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
          <div>
            <Label htmlFor="statusSchedule">Schedule time</Label>
            <Input
              id="statusSchedule"
              type="datetime-local"
              value={scheduleValue}
              onChange={(e) => onScheduleValue(e.target.value)}
            />
          </div>
          <LifecycleControls
            status={campaign.status}
            hasSchedule={scheduledIso !== null}
            onAction={(action) => onPatchStatus(action, action === 'schedule' ? scheduledIso : undefined)}
          />
        </div>
      </div>

      {campaign.provider === 'manual_csv' && (
        <Button
          onClick={onManualExport}
          className="mt-4 border border-teal/30 bg-teal/[0.06] text-teal hover:border-teal/60 font-mono text-[12px] tracking-[0.04em]"
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Download manual export
        </Button>
      )}
    </section>
  );
}

function LifecycleControls({
  status,
  hasSchedule,
  onAction,
}: {
  status: McsVmCampaignStatus;
  hasSchedule: boolean;
  onAction: (action: McsVmCampaignStatusAction) => void;
}) {
  const buttons: Array<{ action: McsVmCampaignStatusAction; label: string; icon: ReactElement; disabled?: boolean }> =
    status === 'draft'
      ? [{ action: 'ready', label: 'Mark ready', icon: <CheckCircle2 className="h-4 w-4" /> }]
      : status === 'ready'
        ? [
            { action: 'start', label: 'Start now', icon: <PlayCircle className="h-4 w-4" /> },
            { action: 'schedule', label: 'Schedule', icon: <CalendarClock className="h-4 w-4" />, disabled: !hasSchedule },
          ]
        : status === 'scheduled'
          ? [
              { action: 'start', label: 'Start now', icon: <PlayCircle className="h-4 w-4" /> },
              { action: 'cancel', label: 'Cancel', icon: <XCircle className="h-4 w-4" /> },
            ]
          : status === 'running'
            ? [
                { action: 'pause', label: 'Pause', icon: <PauseCircle className="h-4 w-4" /> },
                { action: 'cancel', label: 'Cancel', icon: <XCircle className="h-4 w-4" /> },
              ]
            : status === 'paused'
              ? [
                  { action: 'resume', label: 'Resume', icon: <PlayCircle className="h-4 w-4" /> },
                  { action: 'cancel', label: 'Cancel', icon: <XCircle className="h-4 w-4" /> },
                ]
              : [];

  if (buttons.length === 0) {
    return (
      <div className="flex items-center rounded-md border border-cream/10 px-3 py-3 text-[13px] text-cream-faint">
        No lifecycle actions are available for {STATUS_LABEL[status]}.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {buttons.map((button) => (
        <Button
          key={button.action}
          onClick={() => onAction(button.action)}
          disabled={button.disabled}
          className={
            button.action === 'start' || button.action === 'ready' || button.action === 'resume'
              ? 'bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-5 py-3 h-auto'
              : 'border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px] tracking-[0.04em] px-5 py-3 h-auto'
          }
        >
          {button.icon}
          <span className="ml-2">{button.label}</span>
        </Button>
      ))}
    </div>
  );
}

function LeadImportCard({
  campaign,
  leadOwner,
  onImportBatch,
  onJobsChanged,
}: {
  campaign: McsVMCampaignRecord;
  leadOwner: McsLeadOwnerRecord | null;
  onImportBatch: (rows: McsImportBulkLeadPayload[]) => Promise<McsVmImportQueuedResponse>;
  onJobsChanged: () => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ImportJobView[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => parseLeadCsv(csvText), [csvText]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file?.name ?? null);
    if (!file) return;
    setCsvText(await file.text());
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const batches = chunkRows(rows, 500);
      const nextJobs: ImportJobView[] = [];
      for (const batch of batches) {
        const result = await onImportBatch(batch);
        nextJobs.push({
          importJobId: result.importJobId,
          rowsAccepted: result.rowsAccepted,
          chunksQueued: result.chunksQueued,
          counts: null,
          error: null,
        });
      }
      setJobs((prev) => [...nextJobs, ...prev]);
      onJobsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue import.');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (jobs.length === 0) return;
    let cancelled = false;

    async function poll() {
      const updated = await Promise.all(
        jobs.map(async (job) => {
          try {
            const res = await fetch(`/api/vm/imports/${encodeURIComponent(job.importJobId)}`, {
              credentials: 'include',
            });
            const body = await readJson<McsVmImportJobStatusResponse>(res);
            if (res.ok && 'ok' in body && body.ok === true) {
              return { ...job, counts: { ...EMPTY_METRICS, ...body.counts }, error: null };
            }
            return { ...job, error: (body as ApiErrorBody).error ?? 'Could not poll import job.' };
          } catch {
            return { ...job, error: 'Network error polling import job.' };
          }
        }),
      );
      if (!cancelled) {
        setJobs(updated);
        onJobsChanged();
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jobs.length, onJobsChanged]);

  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            Lead import
          </p>
          <p className="mt-2 text-[14px] text-cream-mute">
            {leadOwner?.name ?? campaign.leadOwnerId} / batches of 500 rows or fewer.
          </p>
        </div>
        <label className="cursor-pointer rounded-md border border-dashed border-cream/20 bg-cream/[0.02] px-4 py-3 hover:border-gold/40">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-gold">
            <Upload className="h-4 w-4" aria-hidden="true" />
            CSV file
          </span>
          <span className="mt-1 block max-w-[220px] truncate text-[12px] text-cream-faint">
            {fileName ?? 'Paste or upload'}
          </span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e)} />
        </label>
      </div>

      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder="firstName,lastName,phone,email,city,stateOrRegion,country"
        rows={7}
        className="w-full resize-y rounded-md border border-cream/10 bg-cream/[0.03] p-3 font-mono text-[12px] leading-[1.55] text-cream placeholder:text-cream-faint"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream-faint">
          {numberFmt(rows.length)} parsed rows / {numberFmt(Math.ceil(rows.length / 500))} batch(es)
        </p>
        <Button
          onClick={() => void submit()}
          disabled={submitting || rows.length === 0}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px]"
        >
          {submitting ? 'Queueing...' : 'Queue import'}
        </Button>
      </div>
      {error && <p className="mt-3 font-mono text-[11px] tracking-[0.04em] text-red-300">{error}</p>}

      <CsvPreview rows={rows} />
      <ImportJobs jobs={jobs} />
    </section>
  );
}

function CsvPreview({ rows }: { rows: McsImportBulkLeadPayload[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-5 overflow-hidden rounded-md border border-cream/10">
      <div className="bg-cream/[0.04] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cream-faint">
        Preview
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <tbody>
            {rows.slice(0, 6).map((row, index) => (
              <tr key={`${row.firstName}-${row.lastName}-${index}`} className="border-t border-cream/10">
                <td className="px-3 py-2 text-cream">{row.firstName} {row.lastName}</td>
                <td className="px-3 py-2 text-cream-mute">{row.phone ?? 'No phone'}</td>
                <td className="px-3 py-2 text-cream-mute">{row.email ?? 'No email'}</td>
                <td className="px-3 py-2 text-cream-faint">{row.city}, {row.stateOrRegion}</td>
                <td className="px-3 py-2 text-cream-faint">{row.country ?? 'US'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportJobs({ jobs }: { jobs: ImportJobView[] }) {
  if (jobs.length === 0) return null;
  return (
    <div className="mt-5 space-y-3">
      {jobs.map((job) => (
        <div key={job.importJobId} className="rounded-md border border-cream/10 bg-cream/[0.02] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream">
              {job.importJobId}
            </p>
            <p className="font-mono text-[10px] text-cream-faint">
              {numberFmt(job.rowsAccepted)} accepted / {job.chunksQueued} chunk(s)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            {IMPORT_PROGRESS.map((status) => (
              <MiniMetric key={status} label={titleCase(status)} value={job.counts?.[status] ?? 0} />
            ))}
          </div>
          {job.error && <p className="mt-2 text-[11px] text-red-300">{job.error}</p>}
        </div>
      ))}
    </div>
  );
}

function CampaignAnalytics({
  metrics,
  leads,
  leadsTotal,
  page,
  pageSize,
  filter,
  loading,
  onFilter,
  onPage,
  onWorkLead,
}: {
  metrics: McsVmCampaignMetrics;
  leads: McsVmCampaignLeadRow[];
  leadsTotal: number;
  page: number;
  pageSize: number;
  filter: LeadStatusFilter;
  loading: boolean;
  onFilter: (status: LeadStatusFilter) => void;
  onPage: (page: number) => void;
  onWorkLead: (leadId: string) => void;
}) {
  const maxPage = Math.max(1, Math.ceil(leadsTotal / pageSize));

  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            Metrics
          </p>
          <p className="mt-2 text-[14px] leading-[1.55] text-cream-mute">
            Status counts and owner-scoped lead table.
          </p>
        </div>
        {loading && (
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
            Loading leads
          </p>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {METRIC_STATUSES.map((status) => (
          <MiniMetric key={status} label={titleCase(status)} value={metrics[status] ?? 0} />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterButton active={filter === 'all'} label="All" onClick={() => onFilter('all')} />
        {METRIC_STATUSES.map((status) => (
          <FilterButton
            key={status}
            active={filter === status}
            label={titleCase(status)}
            onClick={() => onFilter(status)}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-cream/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-cream/[0.04] text-cream-faint font-mono text-[10px] uppercase tracking-[0.1em]">
              <tr>
                <th className="px-3 py-2 text-left">Lead</th>
                <th className="px-3 py-2 text-left">Contact</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Token</th>
                <th className="px-3 py-2 text-left">Issues</th>
                <th className="px-3 py-2 text-left">Updated</th>
                <th className="px-3 py-2 text-left" />
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td className="px-3 py-5 text-cream-mute" colSpan={8}>
                    No leads match this view.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.leadId} className="border-t border-cream/10">
                    <td className="px-3 py-2">
                      <p className="text-cream">{lead.firstName ?? 'Unknown'} {lead.lastName ?? ''}</p>
                      <p className="font-mono text-[10px] text-cream-faint">{lead.leadId}</p>
                    </td>
                    <td className="px-3 py-2 text-cream-mute">
                      <p>{lead.normalizedPhone ?? 'No phone'}</p>
                      <p className="text-cream-faint">{lead.normalizedEmail ?? 'No email'}</p>
                    </td>
                    <td className="px-3 py-2 text-cream-mute">
                      {lead.city ?? 'Unknown'}, {lead.stateOrRegion ?? '--'} / {lead.country}
                    </td>
                    <td className="px-3 py-2">
                      <LeadStatusPill status={lead.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-cream-faint">
                      {lead.token ?? 'Not created'}
                    </td>
                    <td className="px-3 py-2 text-cream-faint">
                      {lead.validationIssues.length === 0 ? 'None' : lead.validationIssues.join(', ')}
                    </td>
                    <td className="px-3 py-2 text-cream-faint">{formatDate(lead.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onWorkLead(lead.leadId)}
                        className="rounded border border-gold/40 bg-gold/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] text-gold hover:border-gold/70"
                      >
                        Work
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream-faint">
          Page {page} of {maxPage} / {numberFmt(leadsTotal)} total
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px]"
          >
            Previous
          </Button>
          <Button
            onClick={() => onPage(Math.min(maxPage, page + 1))}
            disabled={page >= maxPage}
            className="border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px]"
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-cream/10 bg-cream/[0.02] p-3">
      <p className="font-display text-[24px] leading-none text-cream">{numberFmt(value)}</p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-cream-faint">
        {label}
      </p>
    </div>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] transition-colors ' +
        (active
          ? 'border-gold/60 bg-gold/[0.08] text-gold'
          : 'border-cream/10 bg-cream/[0.02] text-cream-faint hover:border-cream/25 hover:text-cream')
      }
    >
      {label}
    </button>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-md border border-line bg-ink-2 px-3 text-cream disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlyBox({ label, icon, value }: { label: string; icon: ReactElement; value: string }) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/[0.02] p-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cream-faint">
        {icon}
        {label}
      </div>
      <p className="break-words text-[13px] leading-[1.5] text-cream-mute">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/[0.02] p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-cream-faint">{label}</p>
      <p className="mt-1 text-[13px] text-cream">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: McsVmCampaignStatus }) {
  const cls =
    status === 'running' || status === 'ready' || status === 'scheduled'
      ? 'border-teal/40 bg-teal/[0.06] text-teal'
      : status === 'paused' || status === 'dry_run'
        ? 'border-gold/40 bg-gold/[0.06] text-gold'
        : status === 'cancelled' || status === 'archived'
          ? 'border-red-400/30 bg-red-500/5 text-red-300'
          : 'border-cream/15 bg-cream/[0.03] text-cream-mute';
  return (
    <span className={`rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function LeadStatusPill({ status }: { status: McsVmCampaignMetricStatus }) {
  const cls =
    status === 'voicemail_drop_delivered' || status === 'crm_created' || status === 'token_created'
      ? 'border-teal/40 bg-teal/[0.06] text-teal'
      : status === 'invalid' || status === 'suppressed' || status === 'duplicate' || status === 'voicemail_drop_failed'
        ? 'border-red-400/30 bg-red-500/5 text-red-300'
        : 'border-cream/15 bg-cream/[0.03] text-cream-mute';
  return (
    <span className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${cls}`}>
      {titleCase(status)}
    </span>
  );
}

function LiveBadge({ campaign, compact }: { campaign: McsVMCampaignRecord; compact?: boolean }) {
  const live = campaign.adminApprovedForLiveDelivery === true;
  return (
    <span
      className={
        'inline-flex items-center rounded border font-mono uppercase tracking-[0.08em] ' +
        (compact ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]') +
        ' ' +
        (live
          ? 'border-teal/40 bg-teal/[0.06] text-teal'
          : 'border-gold/40 bg-gold/[0.06] text-gold')
      }
    >
      {live ? <ShieldCheck className="mr-1.5 h-3 w-3" /> : <AlertTriangle className="mr-1.5 h-3 w-3" />}
      {live ? 'Live-approved' : 'Dry-run'}
    </span>
  );
}

export default VmCampaignsPage;
