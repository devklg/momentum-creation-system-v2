/**
 * /agents — Admin oversight for BA support agents and Success Profile memory.
 */

import { useEffect, useState, type ReactNode } from 'react';
import type { AdminAgentOversightResponse } from '@momentum/shared';

export function AgentsPage() {
  const [data, setData] = useState<AdminAgentOversightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/admin/agents/overview', {
          credentials: 'include',
        });
        const body = (await res.json()) as AdminAgentOversightResponse & {
          error?: string;
        };
        if (!res.ok || !body.ok) {
          setErr(body.error ?? 'Could not load agent oversight.');
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
