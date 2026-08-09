/**
 * /agents — Admin oversight for BA support agents and Success Profile memory.
 */

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import type {
  McsAdminAgentHealthResponse,
  McsAdminAgentOversightResponse,
  McsAdminChatTranscriptDetail,
  McsAdminChatTranscriptSummary,
  McsAdminOutboxHealthResponse,
} from '@momentum/shared';
import { MichaelRuntimeObservabilityPanel } from '@/components/admin/MichaelRuntimeObservabilityPanel';

interface TranscriptsListResponse {
  ok: boolean;
  transcripts?: McsAdminChatTranscriptSummary[];
  total?: number;
  nextCursor?: string | null;
  error?: string;
}

interface TranscriptDetailResponse {
  ok: boolean;
  transcript?: McsAdminChatTranscriptDetail;
  error?: string;
}

interface HarvesterStatus {
  started: boolean;
  inFlight: boolean;
  lastRequestedBy: 'manual' | 'scheduled' | null;
  lastRunWindow: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  lastError: string | null;
  lastResult: {
    requested: number;
    written: number;
    skipped: number;
    sourceSessionCount: number;
    runWindow: string | null;
  } | null;
}

interface HarvesterStatusResponse {
  ok: boolean;
  status: HarvesterStatus;
  error?: string;
}

interface HarvesterRunResponse {
  ok: boolean;
  source: string;
  requested: number;
  written: number;
  skipped: number;
  sourceSessionCount: number;
  sourceSessionIds: string[];
  initiatedBy: 'manual' | 'scheduled';
  runWindow: string | null;
  errors: string[];
}

export function AgentsPage() {
  const [data, setData] = useState<McsAdminAgentOversightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [health, setHealth] = useState<McsAdminAgentHealthResponse | null>(null);
  const [outbox, setOutbox] = useState<McsAdminOutboxHealthResponse | null>(null);
  const [transcriptList, setTranscriptList] = useState<McsAdminChatTranscriptSummary[]>([]);
  const [transcriptTotal, setTranscriptTotal] = useState<number>(0);
  const [transcriptCursor, setTranscriptCursor] = useState<string | null>(null);
  const [transcriptsLoading, setTranscriptsLoading] = useState(true);
  const [transcriptsErr, setTranscriptsErr] = useState<string | null>(null);
  const [transcriptDetails, setTranscriptDetails] = useState<Record<string, McsAdminChatTranscriptDetail>>({});
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null);
  const [transcriptDetailLoading, setTranscriptDetailLoading] = useState(false);
  const [transcriptDetailErr, setTranscriptDetailErr] = useState<string | null>(null);
  const [harvesterStatus, setHarvesterStatus] = useState<HarvesterStatus | null>(null);
  const [harvesterStatusErr, setHarvesterStatusErr] = useState<string | null>(null);
  const [harvestRunning, setHarvestRunning] = useState(false);
  const [harvestRunMsg, setHarvestRunMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [res, healthRes, outboxRes, harvesterRes] = await Promise.all([
          fetch('/api/admin/agents/overview', { credentials: 'include' }),
          fetch('/api/admin/agents/health', { credentials: 'include' }),
          fetch('/api/admin/agents/outbox-health', { credentials: 'include' }),
          fetch('/api/admin/agents/transcripts/harvest/status', { credentials: 'include' }),
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
        const harvesterBody = (await harvesterRes.json()) as HarvesterStatusResponse;
        if (!harvesterRes.ok || harvesterBody.ok === false || !harvesterBody.status) {
          setHarvesterStatusErr(harvesterBody.error ?? 'Could not load transcript harvest status.');
        } else {
          setHarvesterStatus(harvesterBody.status);
        }
      } catch (e) {
        setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void loadTranscripts();
  }, []);

  async function loadHarvesterStatus(): Promise<void> {
    try {
      const statusRes = await fetch('/api/admin/agents/transcripts/harvest/status', { credentials: 'include' });
      const statusBody = (await statusRes.json()) as HarvesterStatusResponse;
      if (!statusRes.ok || statusBody.ok === false || !statusBody.status) {
        setHarvesterStatusErr(statusBody.error ?? 'Could not load transcript harvest status.');
        return;
      }
      setHarvesterStatus(statusBody.status);
      setHarvesterStatusErr(null);
    } catch (e) {
      setHarvesterStatusErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    }
  }

  async function runAutoHarvestNow(): Promise<void> {
    try {
      setHarvestRunning(true);
      setHarvestRunMsg(null);
      const res = await fetch('/api/admin/agents/transcripts/harvest/run', {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await res.json()) as HarvesterRunResponse & { error?: string };
      if (!res.ok || payload.ok === false) {
        setHarvestRunMsg(payload.error ?? 'Auto harvest failed.');
        return;
      }
      setHarvestRunMsg(
        `Auto-harvest complete: ${payload.written} written, ${payload.skipped} skipped, ${payload.sourceSessionCount} sessions checked.`,
      );
      await Promise.all([loadHarvesterStatus(), loadTranscripts()]);
    } catch (e) {
      setHarvestRunMsg(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setHarvestRunning(false);
    }
  }

  async function loadTranscripts(cursor: string | null = null, append = false): Promise<void> {
    const query = new URLSearchParams({ limit: '20' });
    if (cursor) query.set('cursor', cursor);
    if (!append) {
      setTranscriptsLoading(true);
      setTranscriptsErr(null);
    }
    try {
      const res = await fetch(`/api/admin/agents/transcripts?${query.toString()}`, { credentials: 'include' });
      const payload = (await res.json()) as TranscriptsListResponse;
      if (!res.ok || !payload.ok) {
        setTranscriptsErr(payload.error ?? 'Could not load chat transcripts.');
        return;
      }
      const nextItems = payload.transcripts ?? [];
      setTranscriptTotal(payload.total ?? nextItems.length);
      setTranscriptCursor(payload.nextCursor ?? null);
      setTranscriptList((current) => (append ? [...current, ...nextItems.filter((row) => !current.some((existing) => existing.transcriptId === row.transcriptId))] : nextItems));
    } catch (e) {
      setTranscriptsErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setTranscriptsLoading(false);
    }
  }

  async function openTranscript(transcriptId: string): Promise<void> {
    if (openTranscriptId === transcriptId) {
      setOpenTranscriptId(null);
      return;
    }
    setOpenTranscriptId(transcriptId);
    setTranscriptDetailErr(null);
    setTranscriptDetailLoading(true);
    try {
      if (transcriptDetails[transcriptId]) {
        setTranscriptDetailLoading(false);
        return;
      }
      const res = await fetch(`/api/admin/agents/transcripts/${encodeURIComponent(transcriptId)}`, { credentials: 'include' });
      const payload = (await res.json()) as TranscriptDetailResponse;
      if (!res.ok || !payload.ok || !payload.transcript) {
        setTranscriptDetailErr(payload.error ?? 'Could not load this transcript.');
        return;
      }
      setTranscriptDetails((current) => ({ ...current, [transcriptId]: payload.transcript! }));
    } catch (e) {
      setTranscriptDetailErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setTranscriptDetailLoading(false);
    }
  }

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

      <div className="mb-8">
        <MichaelRuntimeObservabilityPanel />
      </div>

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

          <section className="border border-line bg-cream/[0.025] p-5 mb-8">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-mono text-[11px] tracking-label uppercase text-gold">
                Cross-tool Chat Transcript Index
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void runAutoHarvestNow()}
                  className="font-mono text-[10px] uppercase tracking-label text-gold hover:underline"
                  disabled={harvestRunning || harvesterStatus?.inFlight}
                >
                  {harvestRunning ? 'Running harvest…' : 'Run auto harvest now'}
                </button>
                <button
                  type="button"
                  onClick={() => void Promise.all([loadTranscripts(), loadHarvesterStatus()])}
                  className="font-mono text-[10px] uppercase tracking-label text-gold hover:underline"
                >
                  Refresh
                </button>
              </div>
            </div>
            <p className="text-xs text-cream-mute mb-4">
              1-0001 style index with model/provider, timestamp, and semantic keyword.
              Open rows for the full role-by-role transcript.
            </p>
            {harvestRunMsg && <p className="text-xs text-cream-mute mb-3">{harvestRunMsg}</p>}
            {harvesterStatusErr && <p className="text-xs text-red-300 mb-3">{harvesterStatusErr}</p>}
            {harvesterStatus && (
              <p className="text-xs text-cream-mute mb-3">
                Auto-harvester worker: {harvesterStatus.started ? (harvesterStatus.inFlight ? 'running now' : 'active') : 'stopped'}
                {harvesterStatus.nextRunAt ? ` · next run ${formatDateTime(harvesterStatus.nextRunAt)}` : ''}
                {harvesterStatus.lastRunAt ? ` · last run ${formatDateTime(harvesterStatus.lastRunAt)}` : ''}
                {harvesterStatus.lastRequestedBy ? ` · last requested by ${harvesterStatus.lastRequestedBy}` : ''}
              </p>
            )}
            {harvesterStatus?.lastError && (
              <p className="text-xs text-red-300 mb-3">Last harvest error: {harvesterStatus.lastError}</p>
            )}
            {transcriptList.length === 0 ? (
              <p className="text-sm text-cream-mute">
                {transcriptsLoading ? 'Loading transcripts…' : 'No transcript index rows yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-cream-faint font-mono uppercase tracking-label">
                    <tr>
                      <Th>Chat</Th>
                      <Th>Model</Th>
                      <Th>Keyword</Th>
                      <Th>Source</Th>
                      <Th>Captured</Th>
                      <Th>Turns</Th>
                      <Th>Words</Th>
                      <Th></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {transcriptList.map((transcript) => (
                      <Fragment key={transcript.transcriptId}>
                        <tr key={transcript.transcriptId} className="border-t border-line/70">
                          <td className="py-2 pr-4 text-cream">{transcript.chatIndex}</td>
                          <td className="py-2 pr-4 text-cream-mute">{transcript.model}</td>
                          <td className="py-2 pr-4 text-cream-mute">{transcript.semanticKeyword}</td>
                          <td className="py-2 pr-4 text-cream-mute">{transcript.source}</td>
                          <td className="py-2 pr-4 text-cream-mute whitespace-nowrap">{formatDateTime(transcript.capturedAt)}</td>
                          <td className="py-2 pr-4 text-cream-mute">{transcript.turnCount}</td>
                          <td className="py-2 pr-4 text-cream-mute">{transcript.wordCount}</td>
                          <td className="py-2 pr-4">
                            <button
                              type="button"
                              onClick={() => void openTranscript(transcript.transcriptId)}
                              className="font-mono text-[10px] uppercase tracking-label text-gold hover:underline"
                              disabled={transcriptDetailLoading}
                            >
                              {openTranscriptId === transcript.transcriptId ? 'Close' : 'Open full transcript'}
                            </button>
                          </td>
                        </tr>
                        {openTranscriptId === transcript.transcriptId && (
                          <tr className="border-t border-line/70 bg-cream/[0.03]">
                            <td colSpan={8} className="py-3">
                              {transcriptDetails[transcript.transcriptId] ? (
                                <div className="space-y-2">
                                  <div className="font-mono text-[10px] uppercase tracking-label text-cream-faint">
                                    {transcriptDetails[transcript.transcriptId].title}
                                  </div>
                                  <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] border border-line bg-ink p-3">
                                    {transcriptToText(transcriptDetails[transcript.transcriptId].transcript)}
                                  </pre>
                                </div>
                              ) : (
                                <p className="font-mono text-xs text-cream-mute">
                                  {transcriptDetailLoading ? 'Loading full transcript…' : (transcriptDetailErr ?? 'Could not load full transcript.')}
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {transcriptsErr && <p className="font-mono text-[11px] text-red-300 mt-3">{transcriptsErr}</p>}
            {transcriptCursor && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void loadTranscripts(transcriptCursor, true)}
                  className="font-mono text-[10px] uppercase tracking-label text-gold hover:underline"
                  disabled={transcriptsLoading}
                >
                  {transcriptsLoading ? 'Loading…' : 'Load more transcripts'}
                </button>
              </div>
            )}
            <p className="font-mono text-[10px] uppercase tracking-label text-cream-faint mt-3">
              Loaded {transcriptList.length} of {transcriptTotal}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-line py-2 pr-4 font-normal">
      {children}
    </th>
  );
}

function transcriptToText(turns: McsAdminChatTranscriptDetail['transcript']): string {
  return turns
    .map((turn) => `${turn.role} ${turn.speaker}: ${turn.text} (${turn.timestamp ? formatDateTime(turn.timestamp) : 'no time'})`)
    .join('\n');
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
