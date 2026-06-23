/**
 * /vm-campaigns - BA-facing VM campaign workspace.
 *
 * UI-only shell for contact batches, campaign setup, dry-run/manual delivery,
 * and engagement analytics. No live VM/SMS/email send is triggered here.
 */

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  FileUp,
  ListChecks,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Plus,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CampaignStatus = 'draft' | 'ready' | 'dry_run' | 'paused' | 'complete';
type ProviderMode = 'manual_csv' | 'leadsrain_style' | 'slybroadcast_style';

interface LeadBatchDraft {
  batchId: string;
  name: string;
  source: string;
  country: string;
  quantity: number;
  fileName: string | null;
}

interface VmCampaignDraft {
  campaignId: string;
  name: string;
  batchId: string;
  provider: ProviderMode;
  status: CampaignStatus;
  voicemailScript: string;
  smsTemplate: string;
  emailTemplate: string;
  scheduledFor: string | null;
  metrics: {
    imported: number;
    queued: number;
    contacted: number;
    clicked: number;
    activated: number;
    callbacks: number;
    completed: number;
    closed: number;
  };
}

const PROVIDER_LABEL: Record<ProviderMode, string> = {
  manual_csv: 'Manual CSV',
  leadsrain_style: 'Provider adapter',
  slybroadcast_style: 'Alternate adapter',
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  dry_run: 'Dry-run',
  paused: 'Paused',
  complete: 'Complete',
};

const EMPTY_METRICS: VmCampaignDraft['metrics'] = {
  imported: 0,
  queued: 0,
  contacted: 0,
  clicked: 0,
  activated: 0,
  callbacks: 0,
  completed: 0,
  closed: 0,
};

const EXAMPLE_BATCH: LeadBatchDraft = {
  batchId: 'batch_demo_contact_list',
  name: 'Personal VM test list',
  source: 'Manual upload',
  country: 'US',
  quantity: 0,
  fileName: null,
};

const EXAMPLE_CAMPAIGN: VmCampaignDraft = {
  campaignId: 'vm_campaign_draft_001',
  name: 'First VM Campaign',
  batchId: EXAMPLE_BATCH.batchId,
  provider: 'manual_csv',
  status: 'draft',
  voicemailScript:
    "Hi, it's {{baFirstName}}. I sent you a quick Team Magnificent video because I thought it might be worth a look. If it speaks to you, tap the link and I will follow up personally.",
  smsTemplate:
    'Hi {{firstName}}, this is {{baFirstName}}. Here is the video I mentioned: {{presentationLink}}',
  emailTemplate:
    'Subject: Quick video\n\nHi {{firstName}},\n\nHere is the short presentation I mentioned. Watch it when you have a quiet moment and I will follow up personally.\n\n{{presentationLink}}',
  scheduledFor: null,
  metrics: EMPTY_METRICS,
};

function numberFmt(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function VmCampaignsPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<LeadBatchDraft[]>([EXAMPLE_BATCH]);
  const [campaigns, setCampaigns] = useState<VmCampaignDraft[]>([EXAMPLE_CAMPAIGN]);
  const [selectedId, setSelectedId] = useState(EXAMPLE_CAMPAIGN.campaignId);

  const selected = campaigns.find((c) => c.campaignId === selectedId) ?? campaigns[0]!;
  const selectedBatch = batches.find((b) => b.batchId === selected.batchId) ?? null;

  const totals = useMemo(
    () =>
      campaigns.reduce(
        (acc, c) => ({
          imported: acc.imported + c.metrics.imported,
          activated: acc.activated + c.metrics.activated,
          callbacks: acc.callbacks + c.metrics.callbacks,
          completed: acc.completed + c.metrics.completed,
        }),
        { imported: 0, activated: 0, callbacks: 0, completed: 0 },
      ),
    [campaigns],
  );

  function addBatch(batch: LeadBatchDraft) {
    setBatches((prev) => [batch, ...prev]);
    setCampaigns((prev) =>
      prev.map((c) =>
        c.campaignId === selectedId
          ? {
              ...c,
              batchId: batch.batchId,
              metrics: { ...c.metrics, imported: batch.quantity, queued: batch.quantity },
            }
          : c,
      ),
    );
  }

  function patchSelected(patch: Partial<VmCampaignDraft>) {
    setCampaigns((prev) =>
      prev.map((c) => (c.campaignId === selected.campaignId ? { ...c, ...patch } : c)),
    );
  }

  function createCampaign() {
    const next: VmCampaignDraft = {
      ...EXAMPLE_CAMPAIGN,
      campaignId: `vm_campaign_${Date.now()}`,
      name: `VM Campaign ${campaigns.length + 1}`,
      batchId: batches[0]?.batchId ?? EXAMPLE_BATCH.batchId,
      metrics: { ...EMPTY_METRICS },
    };
    setCampaigns((prev) => [next, ...prev]);
    setSelectedId(next.campaignId);
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
            onClick={createCampaign}
            className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-6 py-5"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New campaign
          </Button>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Contacts" value={totals.imported} />
          <Metric label="Activated" value={totals.activated} accent="teal" />
          <Metric label="Callbacks" value={totals.callbacks} accent="gold" />
          <Metric label="Completed" value={totals.completed} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream-mute">
                  Campaigns
                </p>
                <span className="font-mono text-[10px] text-cream-faint">
                  {campaigns.length}
                </span>
              </div>
              <ul className="space-y-2">
                {campaigns.map((campaign) => (
                  <li key={campaign.campaignId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(campaign.campaignId)}
                      className={
                        'w-full rounded border p-3 text-left transition-colors ' +
                        (campaign.campaignId === selected.campaignId
                          ? 'border-gold/50 bg-gold/[0.05]'
                          : 'border-cream/10 bg-cream/[0.02] hover:border-cream/25')
                      }
                    >
                      <p className="text-[15px] leading-[1.25] text-cream">
                        {campaign.name}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
                        {STATUS_LABEL[campaign.status]} / {PROVIDER_LABEL[campaign.provider]}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <BatchImportCard onAddBatch={addBatch} />
          </aside>

          <section className="space-y-6">
            <CampaignBuilder
              campaign={selected}
              batches={batches}
              onPatch={patchSelected}
            />
            <CampaignAnalytics campaign={selected} batch={selectedBatch} />
          </section>
        </div>
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

function BatchImportCard({
  onAddBatch,
}: {
  onAddBatch: (batch: LeadBatchDraft) => void;
}) {
  const [name, setName] = useState('Personal VM test list');
  const [source, setSource] = useState('Manual upload');
  const [quantity, setQuantity] = useState('0');
  const [country, setCountry] = useState('US');
  const [fileName, setFileName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null);
    setSaved(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const qty = Math.max(0, Number.parseInt(quantity, 10) || 0);
    onAddBatch({
      batchId: `batch_${Date.now()}`,
      name: name.trim() || 'Untitled contact batch',
      source: source.trim() || 'Manual upload',
      country: country.trim().toUpperCase() || 'US',
      quantity: qty,
      fileName,
    });
    setSaved(true);
  }

  return (
    <section className="rounded-md border border-gold/20 bg-cream/[0.02] p-4">
      <div className="mb-4 flex items-center gap-2">
        <FileUp className="h-4 w-4 text-gold" aria-hidden="true" />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream-mute">
          Contact batch
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="batchName">Batch name</Label>
          <Input id="batchName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="source">Source</Label>
            <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="quantity">Contact count</Label>
          <Input
            id="quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <label className="block cursor-pointer rounded-md border border-dashed border-cream/20 bg-cream/[0.02] p-4 hover:border-gold/40">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-gold">
            <Upload className="h-4 w-4" aria-hidden="true" />
            CSV file
          </span>
          <span className="mt-2 block truncate text-[13px] text-cream-faint">
            {fileName ?? 'No file selected'}
          </span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
        </label>
        <Button
          type="submit"
          className="w-full border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px] tracking-[0.04em]"
        >
          Save batch draft
        </Button>
        {saved && (
          <p className="font-mono text-[11px] tracking-[0.04em] text-teal">
            Batch draft attached.
          </p>
        )}
      </form>
    </section>
  );
}

function CampaignBuilder({
  campaign,
  batches,
  onPatch,
}: {
  campaign: VmCampaignDraft;
  batches: LeadBatchDraft[];
  onPatch: (patch: Partial<VmCampaignDraft>) => void;
}) {
  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            Setup
          </p>
          <h2 className="mt-2 font-display text-[34px] leading-none text-cream">
            {campaign.name}
          </h2>
        </div>
        <StatusPill status={campaign.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <Label htmlFor="campaignName">Campaign name</Label>
          <Input
            id="campaignName"
            value={campaign.name}
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="provider">Provider mode</Label>
          <select
            id="provider"
            value={campaign.provider}
            onChange={(e) => onPatch({ provider: e.target.value as ProviderMode })}
            className="h-12 w-full rounded-md border border-line bg-ink-2 px-3 text-cream"
          >
            <option value="manual_csv">Manual CSV</option>
            <option value="leadsrain_style">Provider adapter</option>
            <option value="slybroadcast_style">Alternate adapter</option>
          </select>
        </div>

        <div>
          <Label htmlFor="batch">Contact batch</Label>
          <select
            id="batch"
            value={campaign.batchId}
            onChange={(e) => onPatch({ batchId: e.target.value })}
            className="h-12 w-full rounded-md border border-line bg-ink-2 px-3 text-cream"
          >
            {batches.map((batch) => (
              <option key={batch.batchId} value={batch.batchId}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="schedule">Schedule</Label>
          <Input
            id="schedule"
            type="datetime-local"
            value={campaign.scheduledFor ?? ''}
            onChange={(e) => onPatch({ scheduledFor: e.target.value || null })}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <TemplateBox
          label="Voicemail script"
          icon={<Megaphone />}
          value={campaign.voicemailScript}
          onChange={(value) => onPatch({ voicemailScript: value })}
        />
        <TemplateBox
          label="SMS follow-up"
          icon={<ListChecks />}
          value={campaign.smsTemplate}
          onChange={(value) => onPatch({ smsTemplate: value })}
        />
        <TemplateBox
          label="Email follow-up"
          icon={<CalendarClock />}
          value={campaign.emailTemplate}
          onChange={(value) => onPatch({ emailTemplate: value })}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => onPatch({ status: 'ready' })}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-5 py-3 h-auto"
        >
          <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
          Mark ready
        </Button>
        <Button
          onClick={() => onPatch({ status: 'dry_run' })}
          className="border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px] tracking-[0.04em] px-5 py-3 h-auto"
        >
          <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />
          Dry-run
        </Button>
        <Button
          onClick={() => onPatch({ status: 'paused' })}
          className="border border-cream/15 bg-transparent text-cream-mute hover:border-cream/30 hover:text-cream font-mono text-[12px] tracking-[0.04em] px-5 py-3 h-auto"
        >
          <PauseCircle className="mr-2 h-4 w-4" aria-hidden="true" />
          Pause
        </Button>
      </div>
    </section>
  );
}

function TemplateBox({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactElement;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cream-faint">
        {icon}
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="w-full resize-y rounded-md border border-cream/10 bg-cream/[0.03] p-3 text-[13px] leading-[1.55] text-cream placeholder:text-cream-faint"
      />
    </label>
  );
}

function CampaignAnalytics({
  campaign,
  batch,
}: {
  campaign: VmCampaignDraft;
  batch: LeadBatchDraft | null;
}) {
  const rows = [
    { label: 'Imported', value: batch?.quantity ?? campaign.metrics.imported },
    { label: 'Queued', value: campaign.metrics.queued },
    { label: 'Contacted', value: campaign.metrics.contacted },
    { label: 'Clicked', value: campaign.metrics.clicked },
    { label: 'Activated', value: campaign.metrics.activated },
    { label: 'Callbacks', value: campaign.metrics.callbacks },
    { label: 'Completed', value: campaign.metrics.completed },
    { label: 'Closed', value: campaign.metrics.closed },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            Analytics
          </p>
          <p className="mt-2 text-[14px] leading-[1.55] text-cream-mute">
            {batch?.name ?? 'No batch selected'} / {batch?.fileName ?? 'manual draft'}
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream-faint">
          {campaign.scheduledFor ? `Scheduled ${campaign.scheduledFor}` : 'Not scheduled'}
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-cream-faint">
                {row.label}
              </span>
              <span className="font-mono text-[12px] text-cream">
                {numberFmt(row.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-cream/[0.06]">
              <div
                className="h-full rounded bg-gold"
                style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: CampaignStatus }) {
  const cls =
    status === 'ready' || status === 'dry_run'
      ? 'border-teal/40 bg-teal/[0.06] text-teal'
      : status === 'paused'
        ? 'border-gold/40 bg-gold/[0.06] text-gold'
        : 'border-cream/15 bg-cream/[0.03] text-cream-mute';
  return (
    <span className={`rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default VmCampaignsPage;
