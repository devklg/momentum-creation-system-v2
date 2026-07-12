/**
 * /agents — Admin oversight for BA support agents and Success Profile memory.
 */

import { useEffect, useState, type ReactNode } from 'react';
import type { McsAdminAgentHealthResponse, McsAdminAgentOversightResponse, McsAdminOutboxHealthResponse } from '@momentum/shared';

export function AgentsPage() {
  const [data, setData] = useState<McsAdminAgentOversightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [health, setHealth] = useState<McsAdminAgentHealthResponse | null>(null);
  const [outbox, setOutbox] = useState<McsAdminOutboxHealthResponse | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [res, healthRes, outboxRes] = await Promise.all([
          fetch('/api/admin/agents/overview', { credentials: 'include' }),
          fetch('/api/admin/agents/health', { credentials: 'include' }),
          fetch('/api/admin/agents/outbox-health', { credentials: 'include' }),
        ]);
        const body = (await res.json()) as McsAdminAgentOversightResponse & {
          error?: string;
        };
        if (!res.ok || !body.ok) {
          setErr(body.error ?? 'Could not load agent oversight.');
          return;
        }
        setData(body);
        if (healthRes.ok) setHealth((await healthRes.json()) as McsAdminAgentHealthResponse);
        if (outboxRes.ok) setOutbox((await outboxRes.json()) as McsAdminOutboxHealthResponse);
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
        Agent 6 · Agent Memory
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">
        Agent Oversight
      </h1>
      <p className="text-cream-mute text-sm mb-8 max-w-3xl">
        Kevin/Admin view of Success Profiles, agent interactions, memory health,
        and GraphRAG bridge drafts. Success Profile data stays out of the BA
        editable profile.
      </p>

      {err && <p className="text-[13px] font-mono text-red-400 mb-4">{err}</p>}
      {loading && <p className="font-mono text-xs text-cream-mute">Loading agent oversight...</p>}

      {data && (
        <>
          {health && (
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
              {health.cards.map((card) => (
                <div key={card.agentKey} className="border border-line bg-cream/[0.025] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-[22px] text-cream">{card.displayName}</p>
                    <span className="font-mono text-[10px] tracking-label uppercase text-gold">{card.status}</span>
                  </div>
                  <p className="text-xs text-cream-mute mt-2">{card.kind} · {card.events7d} events / 7d</p>
                  <p className="text-xs text-cream-mute mt-1">Skills {card.activeSkills} active / {card.plannedSkills} planned</p>
                  <p className="text-xs text-cream-mute">Templates {card.activeTemplates} active / {card.plannedTemplates} planned</p>
                  <p className="font-mono text-[10px] text-cream-faint mt-3 break-all">{card.behaviorSource}</p>
                  {card.issues.length > 0 && <p className="text-xs text-red-300 mt-2">{card.issues.join(', ')}</p>}
                </div>
              ))}
            </section>
          )}
          {data.warnings.length > 0 && (
            <section className="border border-gold/40 bg-gold/[0.06] p-4 mb-6">
              <p className="font-mono text-[10px] tracking-label uppercase text-gold mb-2">
                Source Warnings
              </p>
              <ul className="space-y-1 text-xs text-cream-mute">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          {outbox && (
            <section className="border border-line bg-cream/[0.025] p-5 mb-8">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="font-mono text-[11px] tracking-label uppercase text-gold">Projection Outbox Worker</h2>
                <span className="font-mono text-[10px] uppercase text-cream-mute">
                  {outbox.worker.started ? (outbox.worker.inFlight ? 'draining' : 'running') : 'stopped'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                {[
                  ['Pending', outbox.queue.pending], ['Due', outbox.queue.due],
                  ['Scheduled', outbox.queue.scheduled], ['Dead letters', outbox.queue.deadLettered],
                  ['Attempts', outbox.queue.attempts], ['Landed', outbox.worker.totals.landed],
                  ['Re-enqueued', outbox.worker.totals.reEnqueued], ['Scanned', outbox.worker.totals.scanned],
                ].map(([label, value]) => (
                  <div key={label} className="border border-line p-3">
                    <p className="font-display text-[26px] text-cream">{value}</p>
                    <p className="font-mono text-[9px] uppercase text-cream-faint">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-cream-mute mt-4">
                Last successful tick: {formatDateTime(outbox.worker.lastSuccessAt)} · Oldest pending: {formatDateTime(outbox.queue.oldestPendingAt)} · interval {outbox.worker.intervalMs / 1000}s
              </p>
              {outbox.worker.lastError && <p className="text-xs text-red-300 mt-2">Last worker error: {outbox.worker.lastError}</p>}
            </section>
          )}

          <section className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6 mb-8">
            <Panel title="Success Profiles">
              <DenseTable
                headers={['BA', 'Primary Why', 'Learning', 'Support', 'Signed']}
                rows={data.successProfiles.slice(0, 20).map((profile) => [
                  `${profile.baName} · ${profile.tmagId}`,
                  profile.primaryWhy ?? 'not captured',
                  profile.learningStyle.join(', ') || 'not captured',
                  profile.supportAreas.join(', ') || 'not captured',
                  profile.signedBy ?? 'not signed',
                ])}
                empty="No Success Profiles have landed yet."
              />
            </Panel>

            <Panel title="Agent Interactions">
              <div className="grid grid-cols-2 gap-3">
                {data.interactionSummary.map((agent) => (
                  <div key={agent.agentId} className="border border-line p-3">
                    <p className="font-mono text-[10px] tracking-label uppercase text-gold">
                      {agent.agentId}
                    </p>
                    <p className="font-display text-[28px] leading-none text-cream mt-2">
                      {agent.events7d}
                    </p>
                    <p className="text-xs text-cream-mute mt-2">
                      7d events · last {formatDate(agent.lastEventAt)}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            <Panel title="Memory Health">
              <DenseTable
                headers={['Collection', 'Status', 'Records', 'Purpose']}
                rows={data.memoryStatus.map((row) => [
                  row.collection,
                  row.status,
                  row.recordCount === null ? 'n/a' : String(row.recordCount),
                  row.purpose,
                ])}
                empty="No memory rows."
              />
            </Panel>

            <Panel title="Projection Dead Letters">
              <DenseTable
                headers={['Outbox', 'Tier', 'Target', 'Attempts', 'Last Error']}
                rows={data.projectionOutboxDeadLetters.map((row) => [
                  `${row.outboxId} · ${row.mongoCollection}`,
                  row.tier,
                  `${row.target} · ${row.entityId}`,
                  `${row.attempts}/${row.maxAttempts}`,
                  row.lastError ?? 'not captured',
                ])}
                empty="No dead-lettered projections."
              />
            </Panel>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            <Panel title="GraphRAG Bridge Drafts">
              <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                {data.bridgeDrafts.length === 0 ? (
                  <p className="text-sm text-cream-mute">No bridge drafts yet.</p>
                ) : (
                  data.bridgeDrafts.map((draft) => (
                    <div key={draft.base.id} className="border border-line p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-xs text-cream">{draft.tmagId}</p>
                        <span className="font-mono text-[10px] tracking-label uppercase text-gold">
                          {draft.requiredWritePath}
                        </span>
                      </div>
                      <p className="text-xs text-cream-mute mt-2">
                        {draft.semanticDocument}
                      </p>
                      <p className="font-mono text-[10px] text-cream-faint mt-3">
                        require: {draft.options.require.join(', ')} · enforce_schema:{' '}
                        {String(draft.options.enforce_schema)}
                      </p>
                      <p className="text-xs text-cream-mute mt-2">{draft.note}</p>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </section>
        </>
      )}
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
  if (rows.length === 0) {
    return <p className="text-sm text-cream-mute">{empty}</p>;
  }
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

function formatDate(value: string | null): string {
  if (!value) return 'never';
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string | null): string {
  if (!value) return 'never';
  return new Date(value).toLocaleString();
}
