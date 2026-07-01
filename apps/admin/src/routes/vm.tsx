/**
 * /vm — Agent 6 VM campaign oversight.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  McsAdminVmOverviewResponse,
  McsAdminVmOwnershipCorrectionResponse,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CorrectionForm {
  leadId: string;
  prospectId: string;
  leadBatchId: string;
  vmCampaignId: string;
  oldOwnerTmagId: string;
  newOwnerTmagId: string;
  oldSponsorTmagId: string;
  newSponsorTmagId: string;
  reason: string;
}

const EMPTY_CORRECTION: CorrectionForm = {
  leadId: '',
  prospectId: '',
  leadBatchId: '',
  vmCampaignId: '',
  oldOwnerTmagId: '',
  newOwnerTmagId: '',
  oldSponsorTmagId: '',
  newSponsorTmagId: '',
  reason: '',
};

export function VmPage() {
  const [data, setData] = useState<McsAdminVmOverviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [correction, setCorrection] = useState<CorrectionForm>(EMPTY_CORRECTION);
  const [correctionResult, setCorrectionResult] = useState<string | null>(null);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/admin/vm/overview', { credentials: 'include' });
        const body = (await res.json()) as McsAdminVmOverviewResponse & { error?: string };
        if (!body.ok) {
          setErr(body.error ?? 'Could not load VM overview.');
          return;
        }
        setData(body);
      } catch (e) {
        setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const topBaRows = useMemo(() => data?.baPerformance.slice(0, 12) ?? [], [data]);

  async function submitCorrection() {
    setSubmittingCorrection(true);
    setCorrectionResult(null);
    setErr(null);
    try {
      const body = {
        leadId: correction.leadId.trim() || null,
        prospectId: correction.prospectId.trim() || null,
        leadBatchId: correction.leadBatchId.trim() || null,
        vmCampaignId: correction.vmCampaignId.trim() || null,
        oldOwnerTmagId: correction.oldOwnerTmagId.trim(),
        newOwnerTmagId: correction.newOwnerTmagId.trim(),
        oldSponsorTmagId: correction.oldSponsorTmagId.trim(),
        newSponsorTmagId: correction.newSponsorTmagId.trim(),
        reason: correction.reason.trim(),
      };
      const res = await fetch('/api/admin/vm/ownership-correction', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await res.json()) as
        | McsAdminVmOwnershipCorrectionResponse
        | { ok: false; error: string };
      if (!result.ok) {
        setErr(result.error || 'Ownership correction audit failed.');
        return;
      }
      setCorrectionResult(`${result.note} Audit entry: ${result.auditEntryId}`);
      setCorrection(EMPTY_CORRECTION);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setSubmittingCorrection(false);
    }
  }

  return (
    <div className="max-w-7xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · VM Campaign Oversight
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">VM Campaigns</h1>
      <p className="text-cream-mute text-sm mb-8 max-w-2xl">
        Global VM campaign monitoring, BA-by-BA analytics, batch health,
        suppression/compliance summary, and audited ownership-correction intake.
      </p>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">{err}</p>
      )}

      {loading && (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          Loading…
        </p>
      )}

      {data && (
        <>
          {data.warnings.length > 0 && (
            <div className="border border-gold/30 bg-gold/[0.06] rounded-md p-4 mb-6">
              <p className="font-mono tracking-label text-[11px] text-gold uppercase mb-2">
                Upstream collection warnings
              </p>
              <ul className="space-y-1">
                {data.warnings.map((w) => (
                  <li key={w} className="text-xs text-cream-mute">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="grid grid-cols-5 gap-3 mb-8">
            {data.cards.map((card) => (
              <div key={card.key} className="border border-line rounded-md bg-ink-2 p-4">
                <p className="font-mono text-[10px] tracking-label text-cream-faint uppercase">
                  {card.label}
                </p>
                <p className="font-display text-[30px] leading-none mt-2 text-cream">
                  {card.value}
                </p>
                <p className="text-xs text-cream-mute mt-2">{card.detail}</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-[1.5fr_1fr] gap-6 mb-8">
            <div>
              <SectionHeading title="BA Campaign Analytics" />
              <div className="border border-line rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-cream/[0.04] text-cream-faint font-mono text-[10px] uppercase tracking-label">
                    <tr>
                      <th className="text-left px-3 py-2">BA</th>
                      <th className="text-right px-3 py-2">Leads</th>
                      <th className="text-right px-3 py-2">Activated</th>
                      <th className="text-right px-3 py-2">Complete</th>
                      <th className="text-right px-3 py-2">Callbacks</th>
                      <th className="text-right px-3 py-2">New BA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBaRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-5 text-cream-mute" colSpan={6}>
                          No VM BA analytics have landed yet.
                        </td>
                      </tr>
                    ) : (
                      topBaRows.map((row) => (
                        <tr key={row.tmagId} className="border-t border-line/50">
                          <td className="px-3 py-2">
                            <p className="text-cream">{row.baName}</p>
                            <p className="font-mono text-[11px] text-cream-faint">{row.tmagId}</p>
                          </td>
                          <td className="px-3 py-2 text-right">{row.leadsImported}</td>
                          <td className="px-3 py-2 text-right">
                            {row.activated}
                            <span className="text-cream-faint">
                              {' '}
                              {row.activationRate === null ? '' : `(${row.activationRate}%)`}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.videoCompletions}
                            <span className="text-cream-faint">
                              {' '}
                              {row.completionRate === null ? '' : `(${row.completionRate}%)`}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{row.callbacks}</td>
                          <td className="px-3 py-2 text-right">{row.closedNewBa}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <SectionHeading title="Compliance & Suppression" />
              <div className="border border-line rounded-md bg-ink-2 p-4 space-y-3">
                <Stat label="Suppressed leads" value={data.compliance.suppressedLeads} />
                <Stat label="Opt-outs" value={data.compliance.optOuts} />
                <Stat label="DNC flags" value={data.compliance.dncFlags} />
                <Stat label="Compliance holds" value={data.compliance.complianceHolds} />
                <p className="text-xs text-cream-mute pt-2 border-t border-line/60">
                  {data.compliance.note}
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-6 mb-8">
            <SimpleTable
              title="Lead Batch Monitoring"
              empty="No lead batches have landed yet."
              rows={data.batches.slice(0, 10)}
              renderHeader={() => (
                <tr>
                  <th className="text-left px-3 py-2">Batch</th>
                  <th className="text-left px-3 py-2">Owner</th>
                  <th className="text-right px-3 py-2">Imported</th>
                  <th className="text-right px-3 py-2">Suppressed</th>
                  <th className="text-right px-3 py-2">Activated</th>
                </tr>
              )}
              renderRow={(row) => (
                <tr key={row.leadBatchId} className="border-t border-line/50">
                  <td className="px-3 py-2">
                    <p className="text-cream">{row.leadBatchId}</p>
                    <p className="text-[11px] text-cream-faint">{row.status} · {row.source}</p>
                  </td>
                  <td className="px-3 py-2">{row.ownerName}</td>
                  <td className="px-3 py-2 text-right">{row.quantityImported}</td>
                  <td className="px-3 py-2 text-right">{row.suppressed}</td>
                  <td className="px-3 py-2 text-right">{row.activated}</td>
                </tr>
              )}
            />

            <SimpleTable
              title="Campaign Monitoring"
              empty="No VM campaigns have landed yet."
              rows={data.campaigns.slice(0, 10)}
              renderHeader={() => (
                <tr>
                  <th className="text-left px-3 py-2">Campaign</th>
                  <th className="text-left px-3 py-2">Provider</th>
                  <th className="text-right px-3 py-2">Delivered</th>
                  <th className="text-right px-3 py-2">Failed</th>
                  <th className="text-right px-3 py-2">Complete</th>
                </tr>
              )}
              renderRow={(row) => (
                <tr key={row.vmCampaignId} className="border-t border-line/50">
                  <td className="px-3 py-2">
                    <p className="text-cream">{row.name}</p>
                    <p className="text-[11px] text-cream-faint">{row.status} · {row.ownerName}</p>
                  </td>
                  <td className="px-3 py-2">{row.provider}</td>
                  <td className="px-3 py-2 text-right">{row.delivered}</td>
                  <td className="px-3 py-2 text-right">{row.deliveryFailed}</td>
                  <td className="px-3 py-2 text-right">{row.videoCompletions}</td>
                </tr>
              )}
            />
          </section>

          <section className="grid grid-cols-3 gap-6 mb-8">
            <HookList
              title="Provider Health"
              items={data.providerHealth.map((p) => ({
                id: p.provider,
                title: `${p.provider} · ${p.status}`,
                body: `${p.mode} · ${p.delivered24h} delivered / ${p.failed24h} failed in 24h. ${p.note}`,
              }))}
            />
            <HookList
              title="Notification Triggers"
              items={data.notificationHooks.map((h) => ({
                id: h.hookId,
                title: `${h.trigger} · ${h.status}`,
                body: `${h.audience} via ${h.channel}. ${h.privacyBoundary}`,
              }))}
            />
            <HookList
              title="Team News Hooks"
              items={data.teamNewsHooks.map((h) => ({
                id: h.hookId,
                title: `${h.source} · ${h.status}`,
                body: h.note,
              }))}
            />
          </section>

          <section className="border border-line rounded-md bg-ink-2 p-5">
            <SectionHeading title="Audited Ownership Correction Intake" />
            <p className="text-xs text-cream-mute mb-4">
              This logs the requested correction with critical severity. The
              multi-record mutation waits for the VM ownership service so leads,
              CRM, tokens, and graph edges change together.
            </p>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <InputField label="Lead ID" value={correction.leadId} onChange={(v) => setCorrection({ ...correction, leadId: v })} />
              <InputField label="Prospect ID" value={correction.prospectId} onChange={(v) => setCorrection({ ...correction, prospectId: v })} />
              <InputField label="Batch ID" value={correction.leadBatchId} onChange={(v) => setCorrection({ ...correction, leadBatchId: v })} />
              <InputField label="Campaign ID" value={correction.vmCampaignId} onChange={(v) => setCorrection({ ...correction, vmCampaignId: v })} />
              <InputField label="Old owner TM ID" value={correction.oldOwnerTmagId} onChange={(v) => setCorrection({ ...correction, oldOwnerTmagId: v })} />
              <InputField label="New owner TM ID" value={correction.newOwnerTmagId} onChange={(v) => setCorrection({ ...correction, newOwnerTmagId: v })} />
              <InputField label="Old sponsor TM ID" value={correction.oldSponsorTmagId} onChange={(v) => setCorrection({ ...correction, oldSponsorTmagId: v })} />
              <InputField label="New sponsor TM ID" value={correction.newSponsorTmagId} onChange={(v) => setCorrection({ ...correction, newSponsorTmagId: v })} />
            </div>
            <label className="block mb-3">
              <span className="block font-mono text-[10px] tracking-label text-cream-faint uppercase mb-1">
                Reason
              </span>
              <textarea
                value={correction.reason}
                onChange={(e) => setCorrection({ ...correction, reason: e.target.value })}
                className="w-full min-h-[92px] bg-ink border border-line rounded-md px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold"
              />
            </label>
            <Button size="sm" onClick={() => void submitCorrection()} disabled={submittingCorrection}>
              {submittingCorrection ? 'Logging…' : 'Log Correction Request'}
            </Button>
            {correctionResult && (
              <p className="text-xs text-teal mt-3">{correctionResult}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="font-display text-[24px] leading-none mb-3 text-cream">{title}</h2>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-cream-mute">{label}</span>
      <span className="font-mono text-sm text-cream">{value}</span>
    </div>
  );
}

function InputField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-label text-cream-faint uppercase mb-1">
        {props.label}
      </span>
      <Input value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

function SimpleTable<T>(props: {
  title: string;
  empty: string;
  rows: T[];
  renderHeader: () => ReactNode;
  renderRow: (row: T) => ReactNode;
}) {
  return (
    <div>
      <SectionHeading title={props.title} />
      <div className="border border-line rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream/[0.04] text-cream-faint font-mono text-[10px] uppercase tracking-label">
            {props.renderHeader()}
          </thead>
          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td className="px-3 py-5 text-cream-mute" colSpan={5}>{props.empty}</td>
              </tr>
            ) : (
              props.rows.map(props.renderRow)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HookList(props: {
  title: string;
  items: Array<{ id: string; title: string; body: string }>;
}) {
  return (
    <div>
      <SectionHeading title={props.title} />
      <div className="border border-line rounded-md bg-ink-2 divide-y divide-line/60 max-h-[360px] overflow-auto">
        {props.items.map((item) => (
          <div key={item.id} className="p-3">
            <p className="font-mono text-[11px] text-cream uppercase tracking-label">
              {item.title}
            </p>
            <p className="text-xs text-cream-mute mt-1">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
