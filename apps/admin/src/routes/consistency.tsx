/**
 * /consistency - persistence consistency report.
 */

import { useEffect, useState, type ReactNode } from 'react';
import type {
  McsAdminConsistencyReportResponse,
  McsAdminCrmIntegrityReportResponse,
} from '@momentum/shared';

export function ConsistencyPage() {
  const [data, setData] = useState<McsAdminConsistencyReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [crmIntegrity, setCrmIntegrity] = useState<McsAdminCrmIntegrityReportResponse | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [res, crmRes] = await Promise.all([
          fetch('/api/admin/consistency/report', { credentials: 'include' }),
          fetch('/api/admin/consistency/crm-integrity', { credentials: 'include' }),
        ]);
        const body = (await res.json()) as McsAdminConsistencyReportResponse & {
          error?: string;
        };
        if (!res.ok || !body.ok) {
          setErr(body.error ?? 'Could not load consistency report.');
          return;
        }
        setData(body);
        const crmBody = (await crmRes.json()) as McsAdminCrmIntegrityReportResponse & { error?: string };
        if (!crmRes.ok || !crmBody.ok) {
          setErr(crmBody.error ?? 'Could not load CRM integrity report.');
          return;
        }
        setCrmIntegrity(crmBody);
      } catch (e) {
        setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-7xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Data Integrity
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">
        Consistency Report
      </h1>
      <p className="text-cream-mute text-sm mb-8 max-w-3xl">
        Mongo, Neo4j, Chroma, and projection queue health for the core launch records.
      </p>

      {err && <p className="text-[13px] font-mono text-red-400 mb-4">{err}</p>}
      {loading && <p className="font-mono text-xs text-cream-mute">Loading consistency report...</p>}

      {data && (
        <>
          <section className="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-8">
            <Metric label="Overall" value={data.overall.toUpperCase()} tone={data.overall} />
            <Metric label="Half-Writes" value={String(data.totals.halfWrites)} tone={data.totals.halfWrites > 0 ? 'red' : 'green'} />
            <Metric label="Stale Projections" value={String(data.totals.staleProjections)} tone={data.totals.staleProjections > 0 ? 'yellow' : 'green'} />
            <Metric label="Failed Projections" value={String(data.totals.failedProjections)} tone={data.totals.failedProjections > 0 ? 'red' : 'green'} />
            <Metric label="Orphans" value={String(data.totals.orphanRecords)} tone={data.totals.orphanRecords > 0 ? 'red' : 'green'} />
            <Metric label="Warnings" value={String(data.totals.warnings)} tone={data.totals.warnings > 0 ? 'yellow' : 'green'} />
          </section>

          {data.warnings.length > 0 && (
            <section className="border border-gold/40 bg-gold/[0.06] p-4 mb-6">
              <p className="font-mono text-[10px] tracking-label uppercase text-gold mb-2">
                Warnings
              </p>
              <ul className="space-y-1 text-xs text-cream-mute">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            <Panel title="Suspected Half-Writes">
              <DenseTable
                headers={['Spec', 'Record', 'Mongo', 'Graph']}
                rows={data.halfWrites.map((row) => [
                  row.specKey,
                  row.id,
                  row.mongoCollection,
                  `${row.neo4jStatus}: ${row.detail}`,
                ])}
                empty="No suspected graph-critical half-writes."
              />
            </Panel>

            <Panel title="Stale Projection Queue">
              <DenseTable
                headers={['Outbox', 'Tier', 'Target', 'Age', 'Last Error']}
                rows={data.staleProjections.map((row) => [
                  `${row.outboxId} · ${row.status}`,
                  row.tier,
                  `${row.target} · ${row.mongoCollection}/${row.entityId}`,
                  `${row.ageMinutes}m · ${row.attempts}/${row.maxAttempts}`,
                  row.lastError ?? 'not captured',
                ])}
                empty="No stale or failed projections."
              />
            </Panel>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            <Panel title="Graph Orphans">
              <div className="space-y-4">
                {data.orphanCategories.map((category) => (
                  <div key={category.key} className="border border-line p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[10px] tracking-label uppercase text-gold">
                        {category.label}
                      </p>
                      <span className="font-display text-[24px] leading-none">
                        {category.records.length}
                      </span>
                    </div>
                    {category.error && (
                      <p className="text-xs text-red-300 mt-2">{category.error}</p>
                    )}
                    {category.records.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-cream-mute">
                        {category.records.slice(0, 8).map((record) => (
                          <li key={record.id}>{record.id}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Reconciliation Issues">
              <DenseTable
                headers={['Spec', 'Record', 'Issues', 'Details']}
                rows={data.reconciliation.issues.map((row) => [
                  row.specKey,
                  `${row.mongoCollection}/${row.id}`,
                  row.issues.join(', '),
                  row.detail,
                ])}
                empty="No reconciliation issues in the sampled rows."
              />
            </Panel>
          </section>

          <section className="mb-8">
            <Panel title="Sample Coverage">
              <DenseTable
                headers={['Spec', 'Scanned', 'Issues']}
                rows={data.reconciliation.specs.map((spec) => [
                  spec.label,
                  String(spec.scanned),
                  String(spec.issueCount),
                ])}
                empty="No reconciliation specs ran."
              />
            </Panel>
          </section>

          {crmIntegrity && (
            <section className="mb-8">
              <Panel title="CRM State Integrity · Report Only">
                <p className="text-sm text-cream-mute mb-4">
                  Missing, duplicate, orphaned, ambiguous, and age-based findings are never repaired here.
                  Elapsed time never closes a CRM record or clears a follow-up.
                </p>
                <div className="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-5">
                  <Metric label="Stuck" value={String(crmIntegrity.totals.stuck)} tone={crmIntegrity.totals.stuck ? 'yellow' : 'green'} />
                  <Metric label="Duplicates" value={String(crmIntegrity.totals.duplicate)} tone={crmIntegrity.totals.duplicate ? 'red' : 'green'} />
                  <Metric label="Orphans" value={String(crmIntegrity.totals.orphan)} tone={crmIntegrity.totals.orphan ? 'red' : 'green'} />
                  <Metric label="Inconsistent" value={String(crmIntegrity.totals.inconsistent)} tone={crmIntegrity.totals.inconsistent ? 'red' : 'green'} />
                  <Metric label="Ambiguous" value={String(crmIntegrity.totals.ambiguous)} tone={crmIntegrity.totals.ambiguous ? 'yellow' : 'green'} />
                  <Metric label="Cleanup Preview" value={String(crmIntegrity.totals.cleanupCandidates)} tone={crmIntegrity.totals.cleanupCandidates ? 'yellow' : 'green'} />
                </div>
                <DenseTable
                  headers={['Category', 'Code', 'Record', 'Detail']}
                  rows={crmIntegrity.findings.map((row) => [
                    row.category,
                    row.code,
                    row.crmRecordId ?? row.prospectId ?? 'identity missing',
                    row.detail,
                  ])}
                  empty="No CRM state integrity findings in the bounded scan."
                />
              </Panel>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'yellow' | 'red';
}) {
  const toneClass =
    tone === 'red'
      ? 'text-red-300 border-red-500/40'
      : tone === 'yellow'
        ? 'text-gold border-gold/40'
        : 'text-cream border-line';
  return (
    <div className={`border bg-cream/[0.025] p-4 ${toneClass}`}>
      <p className="font-mono text-[10px] tracking-label uppercase text-cream-faint">
        {label}
      </p>
      <p className="font-display text-[28px] leading-none mt-2">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-line bg-cream/[0.025] p-5">
      <h2 className="font-mono text-[11px] tracking-label uppercase text-gold mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DenseTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-cream-mute">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="text-cream-faint font-mono uppercase tracking-label">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-line py-2 pr-4 font-normal">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`} className="border-b border-line/70">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${cell}-${cellIndex}`}
                  className="py-2 pr-4 text-cream-mute align-top"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
