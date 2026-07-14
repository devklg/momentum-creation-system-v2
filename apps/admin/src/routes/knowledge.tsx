/**
 * /knowledge — Kevin-authored Knowledge Base intake.
 */

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  McsAdminKnowledgeCorrectionPreview,
  McsAdminKnowledgeCorrectionRecord,
  McsAdminKnowledgeIntegrityStatus,
  McsAdminKnowledgeSourceVersionDetail,
  McsAdminKnowledgeSourceVersionSummary,
  McsAdminKnowledgeStatusResponse,
  McsKnowledgeSourceConflictClass,
} from '@momentum/shared';
import {
  MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
  MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION,
} from '@momentum/shared';
import type { McsKnowledgeDomain, McsRuntimeLanguage } from '@momentum/shared/runtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DOMAINS: ReadonlyArray<{ value: McsKnowledgeDomain; label: string }> = [
  { value: 'training', label: 'Training' },
  { value: 'success', label: 'Success' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'performance', label: 'Performance' },
  { value: 'governance', label: 'Governance' },
  { value: 'organizational', label: 'Organizational' },
  { value: 'system', label: 'System' },
];

const RESOURCE_CONTEXT_OPTIONS = [
  { tag: 'context:training:fast-start:1', label: 'Fast Start · The Product' },
  { tag: 'context:training:fast-start:2', label: 'Fast Start · Comp Plan, Layer 1' },
  { tag: 'context:training:fast-start:3', label: 'Fast Start · The Binary as Two Legs' },
  { tag: 'context:training:fast-start:4', label: 'Fast Start · Build Your Prospect List' },
  { tag: 'context:training:fast-start:5', label: 'Fast Start · Build Your Team' },
  { tag: 'context:training:10-steps', label: '10-Step Orientation' },
  { tag: 'context:event:orientation', label: 'New-member orientation materials' },
  { tag: 'context:event:webinar', label: 'Team webinar materials' },
] as const;

interface KnowledgeCreateResponse {
  ok: boolean;
  sourceId?: string;
  title?: string;
  domain?: McsKnowledgeDomain;
  language?: McsRuntimeLanguage;
  filename?: string;
  fileKind?: string;
  extractedCharacters?: number;
  chunkCount?: number;
  referenceCount?: number;
  error?: string;
  message?: string;
}

export function KnowledgePage() {
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<McsKnowledgeDomain>('training');
  const [language, setLanguage] = useState<McsRuntimeLanguage>('en');
  const [content, setContent] = useState('');
  const [topicTags, setTopicTags] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [resourceContexts, setResourceContexts] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [knowledgeStatus, setKnowledgeStatus] = useState<McsAdminKnowledgeStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadKnowledgeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/knowledge/status', { credentials: 'include' });
      const body = (await res.json()) as McsAdminKnowledgeStatusResponse & { error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'Knowledge status unavailable.');
      setKnowledgeStatus(body);
      setStatusError(null);
    } catch (error) {
      setKnowledgeStatus(null);
      setStatusError(error instanceof Error ? error.message : 'Knowledge status unavailable.');
    }
  }, []);

  useEffect(() => { void loadKnowledgeStatus(); }, [loadKnowledgeStatus]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setErr(null);

    try {
      const tags = [...new Set([...resourceContexts, ...topicTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)])];
      const res = await fetch('/api/admin/knowledge/sources', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          domain,
          language,
          content,
          ...(tags.length > 0 ? { topicTags: tags } : {}),
          ...(sourceRef.trim() ? { sourceRef: sourceRef.trim() } : {}),
        }),
      });
      const body = (await res.json()) as KnowledgeCreateResponse;
      if (!res.ok || !body.ok) {
        setErr(body.message ?? body.error ?? 'Knowledge source was not saved.');
        return;
      }
      setStatus(
        `${body.title ?? 'Source'} saved · ${body.chunkCount ?? 0} chunks · ${body.referenceCount ?? 0} references`,
      );
      setTitle('');
      setContent('');
      setTopicTags('');
      setSourceRef('');
      setResourceContexts([]);
      await loadKnowledgeStatus();
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setErr('Choose a file first.');
      return;
    }

    setUploading(true);
    setStatus(null);
    setErr(null);

    try {
      const tags = [...new Set([...resourceContexts, ...topicTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)])];
      const res = await fetch('/api/admin/knowledge/sources/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          base64: await fileToBase64(file),
          title: title.trim() || undefined,
          domain,
          language,
          ...(tags.length > 0 ? { topicTags: tags } : {}),
        }),
      });
      const body = (await res.json()) as KnowledgeCreateResponse;
      if (!res.ok || !body.ok) {
        setErr(body.message ?? body.error ?? 'File was not uploaded.');
        return;
      }
      setStatus(
        `${body.filename ?? file.name} imported as ${body.fileKind ?? 'source'} · ${body.extractedCharacters ?? 0} chars · ${body.chunkCount ?? 0} chunks`,
      );
      setTitle('');
      setContent('');
      setTopicTags('');
      setSourceRef('');
      setResourceContexts([]);
      setFile(null);
      await loadKnowledgeStatus();
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Context Manager · Knowledge Core
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Knowledge Base</h1>
      <p className="text-cream-mute text-sm mb-8 max-w-3xl">
        Kevin-approved source material for Michael, Steve, and Ivory.
      </p>

      <section className="border border-line bg-cream/[0.025] p-5 mb-6" aria-label="Knowledge readiness">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-mono text-[11px] tracking-label uppercase text-gold">Knowledge Status</h2>
            <p className="text-xs text-cream-mute mt-2">
              Retrieval-ready means an active eligible chunk has no unresolved Chroma projection.
            </p>
          </div>
          <button type="button" onClick={() => void loadKnowledgeStatus()} className="font-mono text-[10px] uppercase tracking-label text-gold hover:text-gold-bright">
            Refresh
          </button>
        </div>
        {knowledgeStatus ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatusMetric label="Active Sources" value={knowledgeStatus.activeSources} />
              <StatusMetric label="Active Chunks" value={knowledgeStatus.activeChunks} />
              <StatusMetric label="Retrieval Ready" value={knowledgeStatus.retrievalReadyChunks} state={knowledgeStatus.status} />
            </div>
            <p className="font-mono text-[10px] text-cream-mute mt-4 uppercase tracking-label">
              {knowledgeStatus.pendingChromaProjections} Chroma pending · {knowledgeStatus.failedChromaProjections} Chroma failed · {knowledgeStatus.pendingNeo4jProjections} graph pending · {knowledgeStatus.failedNeo4jProjections} graph failed
            </p>
            {knowledgeStatus.warnings.map((warning) => <p key={warning} className="text-xs text-amber-300 mt-2">{warning}</p>)}
            <KnowledgeIntegrityPanel integrity={knowledgeStatus.integrity} />
            <div className="border-t border-line mt-5 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-[10px] uppercase tracking-label text-gold">Context Manager Degraded Reasons</h3>
                <p className="font-mono text-[9px] uppercase tracking-label text-cream-mute">
                  Michael {knowledgeStatus.contextManager.liveSurfaces.michael ? 'live' : 'off'} · Steve {knowledgeStatus.contextManager.liveSurfaces.steve ? 'live' : 'off'}
                </p>
              </div>
              <p className="text-xs text-cream-mute mt-2">
                {knowledgeStatus.contextManager.total} observed · {knowledgeStatus.contextManager.degraded} degraded · counters reset when the server restarts.
              </p>
              {knowledgeStatus.contextManager.degradedReasons.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {knowledgeStatus.contextManager.degradedReasons.map((entry) => (
                    <span key={entry.reason} className="border border-line px-2 py-1 font-mono text-[10px] text-amber-300">
                      {entry.reason.replaceAll('_', ' ')} · {entry.count}
                    </span>
                  ))}
                </div>
              ) : <p className="text-xs text-cream-mute mt-3">No degraded retrieval reason has been observed since restart.</p>}
            </div>
            <div className="border-t border-line mt-5 pt-4" aria-label="Retrieval performance diagnostics">
              <h3 className="font-mono text-[10px] uppercase tracking-label text-gold">Retrieval Performance</h3>
              <p className="text-xs text-cream-mute mt-2">
                Cache {knowledgeStatus.retrievalPerformance.approvedReferenceCache.hits} hits · {knowledgeStatus.retrievalPerformance.approvedReferenceCache.misses} misses · {knowledgeStatus.retrievalPerformance.approvedReferenceCache.coalesced} coalesced · {knowledgeStatus.retrievalPerformance.approvedReferenceCache.evictions} evictions · {knowledgeStatus.retrievalPerformance.approvedReferenceCache.size}/{knowledgeStatus.retrievalPerformance.approvedReferenceCache.maxEntries} entries
              </p>
              <p className="text-xs text-cream-mute mt-1">
                GraphRAG {knowledgeStatus.retrievalPerformance.graphRagReadiness.batches} batches · {knowledgeStatus.retrievalPerformance.graphRagReadiness.requestedIds} ids · {knowledgeStatus.retrievalPerformance.graphRagReadiness.storeCalls.mongoCanonical + knowledgeStatus.retrievalPerformance.graphRagReadiness.storeCalls.mongoOutbox} Mongo calls · {knowledgeStatus.retrievalPerformance.graphRagReadiness.storeCalls.neo4j} Neo4j calls · {knowledgeStatus.retrievalPerformance.graphRagReadiness.storeCalls.chroma} Chroma calls
              </p>
              <p className="font-mono text-[9px] uppercase tracking-label text-cream-mute mt-2">
                Content-free in-process counters · reset on server restart
              </p>
            </div>
          </>
        ) : <p className="text-sm text-cream-mute">{statusError ?? 'Loading knowledge status…'}</p>}
      </section>

      <KnowledgeCorrectionPanel />

      <section className="border border-line bg-cream/[0.025] p-5 mb-6">
        <h2 className="font-mono text-[11px] tracking-label uppercase text-gold mb-5">
          Upload File
        </h2>

        <form onSubmit={upload} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_140px] gap-4">
            <Field label="File">
              <Input
                type="file"
                accept=".txt,.text,.md,.markdown,.csv,.tsv,.json,.html,.htm,.pdf,.docx,text/plain,text/markdown,text/csv,application/json,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>

            <Field label="Domain">
              <select
                value={domain}
                onChange={(event) => setDomain(event.target.value as McsKnowledgeDomain)}
                className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 h-11 text-sm focus:outline-none focus:border-gold"
              >
                {DOMAINS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Language">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as McsRuntimeLanguage)}
                className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 h-11 text-sm focus:outline-none focus:border-gold"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title Override">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Leave blank to use filename"
              />
            </Field>

            <Field label="Topic Tags">
              <Input
                value={topicTags}
                onChange={(event) => setTopicTags(event.target.value)}
                placeholder="orientation, follow-up"
              />
            </Field>
          </div>

          <ResourceContextPicker values={resourceContexts} onChange={setResourceContexts} />

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? 'Uploading' : 'Upload Source'}
            </Button>
            <p className="text-xs text-cream-mute">
              TXT, Markdown, CSV, JSON, HTML, PDF, and DOCX are accepted.
            </p>
          </div>
        </form>
      </section>

      <section className="border border-line bg-cream/[0.025] p-5">
        <h2 className="font-mono text-[11px] tracking-label uppercase text-gold mb-5">
          Paste Text
        </h2>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_220px_140px] gap-4">
            <Field label="Title">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                minLength={3}
                placeholder="Training standard"
              />
            </Field>

            <Field label="Domain">
              <select
                value={domain}
                onChange={(event) => setDomain(event.target.value as McsKnowledgeDomain)}
                className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 h-11 text-sm focus:outline-none focus:border-gold"
              >
                {DOMAINS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Language">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as McsRuntimeLanguage)}
                className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 h-11 text-sm focus:outline-none focus:border-gold"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </Field>
          </div>

          <Field label="Content">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              minLength={20}
              rows={14}
              className="w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 py-3 text-sm leading-6 placeholder:text-cream/30 focus:outline-none focus:border-gold resize-y"
              placeholder="Approved source text"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Topic Tags">
              <Input
                value={topicTags}
                onChange={(event) => setTopicTags(event.target.value)}
                placeholder="orientation, follow-up"
              />
            </Field>

            <Field label="Source Reference">
              <Input
                value={sourceRef}
                onChange={(event) => setSourceRef(event.target.value)}
                placeholder="doc, URL, note id"
              />
            </Field>
          </div>

          <ResourceContextPicker values={resourceContexts} onChange={setResourceContexts} />

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving' : 'Save Source'}
            </Button>
            {status && <p className="font-mono text-xs text-gold">{status}</p>}
            {err && <p className="font-mono text-xs text-red-400">{err}</p>}
          </div>
        </form>
      </section>
    </div>
  );
}

function KnowledgeCorrectionPanel() {
  const [versions, setVersions] = useState<McsAdminKnowledgeSourceVersionSummary[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = useState<'active' | 'approved' | 'superseded'>('active');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<McsAdminKnowledgeSourceVersionDetail | null>(null);
  const [replacementContent, setReplacementContent] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<McsAdminKnowledgeCorrectionPreview | null>(null);
  const [correction, setCorrection] = useState<McsAdminKnowledgeCorrectionRecord | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadVersions = useCallback(async (cursor?: string) => {
    const query = new URLSearchParams({ limit: '25', status: lifecycleFilter });
    if (cursor) query.set('cursor', cursor);
    const res = await fetch(`/api/admin/knowledge/source-versions?${query}`, { credentials: 'include' });
    const body = await res.json() as { ok?: boolean; items?: McsAdminKnowledgeSourceVersionSummary[]; nextCursor?: string | null; error?: string };
    if (!res.ok || !body.ok) throw new Error(body.error ?? 'Source versions unavailable.');
    setVersions((current) => cursor ? [...current, ...(body.items ?? [])] : (body.items ?? []));
    setNextCursor(body.nextCursor ?? null);
  }, [lifecycleFilter]);

  useEffect(() => { void loadVersions().catch((error) => setMessage(error instanceof Error ? error.message : 'Source versions unavailable.')); }, [loadVersions]);

  async function selectVersion(version: McsAdminKnowledgeSourceVersionSummary) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/knowledge/source-versions/${encodeURIComponent(version.sourceVersionId)}`, { credentials: 'include' });
      const body = await res.json() as { ok?: boolean; source?: McsAdminKnowledgeSourceVersionDetail; error?: string };
      if (!res.ok || !body.ok || !body.source) throw new Error(body.error ?? 'Source version unavailable.');
      setSelected(body.source);
      setReplacementContent(body.source.originalContent);
      setReason('');
      setPreview(null);
      setCorrection(null);
      setConfirmation('');
      setRollbackReason('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Source version unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function createPreview() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/knowledge/source-versions/${encodeURIComponent(selected.sourceVersionId)}/corrections/preview`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replacementContent, reason }),
      });
      const body = await res.json() as { ok?: boolean; preview?: McsAdminKnowledgeCorrectionPreview; error?: string; message?: string };
      if (!res.ok || !body.ok || !body.preview) throw new Error(body.message ?? body.error ?? 'Preview unavailable.');
      setPreview(body.preview);
      setConfirmation('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Preview unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function applyCorrection() {
    if (!selected || !preview) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/knowledge/source-versions/${encodeURIComponent(selected.sourceVersionId)}/corrections`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replacementContent, reason,
          previewId: preview.previewId,
          previewCreatedAt: preview.createdAt,
          previewExpiresAt: preview.expiresAt,
          previewDigestSha256: preview.previewDigestSha256,
          idempotencyKey: `admin-${preview.previewId}`,
          confirmation,
        }),
      });
      const body = await res.json() as { ok?: boolean; correction?: McsAdminKnowledgeCorrectionRecord; error?: string; message?: string };
      if (!res.ok || !body.ok || !body.correction) throw new Error(body.message ?? body.error ?? 'Correction did not start.');
      setCorrection(body.correction);
      setMessage(body.correction.state === 'verified' ? 'Correction verified across the governed cutover.' : `Correction state: ${body.correction.state}`);
      await loadVersions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Correction did not start.');
    } finally {
      setBusy(false);
    }
  }

  async function retryCorrection() {
    if (!correction) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/knowledge/corrections/${encodeURIComponent(correction.correctionId)}/retry`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRecordRevision: correction.recordRevision,
          idempotencyKey: correction.idempotencyKey,
          approvalDecisionId: correction.approvalDecisionId,
          confirmation: MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
        }),
      });
      const body = await res.json() as { ok?: boolean; correction?: McsAdminKnowledgeCorrectionRecord; error?: string };
      if (!res.ok || !body.correction) throw new Error(body.error ?? 'Retry failed.');
      setCorrection(body.correction);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Retry failed.'); }
    finally { setBusy(false); }
  }

  async function rollbackCorrection() {
    if (!correction) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/knowledge/corrections/${encodeURIComponent(correction.correctionId)}/rollback`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rollbackReason,
          idempotencyKey: `rollback-${correction.correctionId}`,
          expectedState: correction.state,
          expectedRecordRevision: correction.recordRevision,
          rollbackTargetSourceVersionId: correction.rollbackTargetSourceVersionId,
          rollbackTargetDigestSha256: correction.currentDigestSha256,
          approvalDecisionId: correction.approvalDecisionId,
          confirmation,
        }),
      });
      const body = await res.json() as { ok?: boolean; correction?: McsAdminKnowledgeCorrectionRecord; error?: string; message?: string };
      if (!res.ok || !body.correction) throw new Error(body.message ?? body.error ?? 'Rollback failed.');
      setCorrection(body.correction);
      setMessage('Rollback appended and verified a new immutable version.');
      await loadVersions();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Rollback failed.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="border border-line bg-cream/[0.025] p-5 mb-6" aria-label="Governed knowledge corrections">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-mono text-[11px] tracking-label uppercase text-gold">Governed Corrections</h2>
          <p className="text-sm text-cream-mute mt-2">Kevin-only · immutable versions · exact preview evidence · safe-gap cutover</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['active', 'approved', 'superseded'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setLifecycleFilter(value)} className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-label ${lifecycleFilter === value ? 'border-gold text-gold' : 'border-line text-cream-mute'}`}>{value}</button>
          ))}
          <Button type="button" variant="outline" onClick={() => void loadVersions()} disabled={busy}>Refresh</Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="border border-line bg-ink-2 max-h-[420px] overflow-y-auto">
          {versions.map((version) => (
            <button key={version.sourceVersionId} type="button" onClick={() => void selectVersion(version)} className="block w-full border-b border-line p-3 text-left hover:bg-cream/5">
              <span className="block text-sm text-cream">{version.title}</span>
              <span className="block font-mono text-[9px] uppercase tracking-label text-cream-mute mt-1">v{version.version} · {version.status} · {version.domain}/{version.language}</span>
              <span className="block font-mono text-[9px] text-cream-mute mt-1">{version.contentDigestSha256.slice(0, 12)}</span>
            </button>
          ))}
          {versions.length === 0 && <p className="p-3 text-xs text-cream-mute">No source versions returned.</p>}
          {nextCursor && <Button type="button" variant="outline" className="m-3" onClick={() => void loadVersions(nextCursor)} disabled={busy}>Load more</Button>}
        </div>
        <div>
          {selected ? <>
            <p className="font-mono text-[10px] uppercase tracking-label text-gold">{selected.sourceVersionId}</p>
            <p className="text-xs text-cream-mute mt-1">{selected.authorityStatus} · {selected.chunkCount} chunks · digest {selected.contentDigestSha256.slice(0, 16)}</p>
            <textarea value={replacementContent} onChange={(event) => { setReplacementContent(event.target.value); setPreview(null); }} rows={10} className="mt-3 w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 py-3 text-sm leading-6" aria-label="Replacement content" />
            <Input value={reason} onChange={(event) => { setReason(event.target.value); setPreview(null); }} className="mt-3" placeholder="Correction reason (required)" aria-label="Correction reason" />
            <div className="flex flex-wrap gap-2 mt-3">
              <Button type="button" onClick={() => void createPreview()} disabled={busy || selected.status !== 'active'}>Create read-only preview</Button>
            </div>
            {preview && <div className="border border-gold/40 bg-ink-2 p-3 mt-4">
              <p className="font-mono text-[10px] text-gold uppercase tracking-label">Preview · no live mutation yet</p>
              <p className="text-xs text-cream-mute mt-2">{preview.currentSourceVersionId} → {preview.replacementSourceVersionId}</p>
              <p className="font-mono text-[9px] text-cream-mute mt-1">old {preview.currentDigestSha256.slice(0, 12)} · new {preview.replacementDigestSha256.slice(0, 12)} · preview {preview.previewDigestSha256.slice(0, 12)}</p>
              <p className="text-xs text-cream-mute mt-1">Mongo · Neo4j · Chroma · Resource Catalog · GraphRAG · rollback target {preview.rollbackTargetSourceVersionId}</p>
              <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-3" placeholder={MCS_KNOWLEDGE_CORRECTION_CONFIRMATION} aria-label="Exact correction confirmation" />
              <Button type="button" className="mt-3" onClick={() => void applyCorrection()} disabled={busy || confirmation !== MCS_KNOWLEDGE_CORRECTION_CONFIRMATION}>Apply governed correction</Button>
            </div>}
            {correction && <div className="border border-line p-3 mt-4">
              <p className="font-mono text-[10px] uppercase tracking-label text-gold">Correction {correction.state}</p>
              <p className="text-xs text-cream-mute mt-2">Phase {correction.cutoverPhase.replaceAll('_', ' ')} · attempt {correction.attemptCount} · revision {correction.recordRevision}</p>
              {correction.failureCode && <p className="text-xs text-red-400 mt-2">{correction.failureStage}: {correction.failureCode}</p>}
              {correction.state === 'failed' && <Button type="button" className="mt-3" onClick={() => void retryCorrection()} disabled={busy}>Retry exact approved correction</Button>}
              {correction.state === 'verified' && <>
                <Input value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} className="mt-3" placeholder="Rollback reason (required)" aria-label="Rollback reason" />
                <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-3" placeholder={MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION} aria-label="Exact rollback confirmation" />
                <Button type="button" variant="outline" className="mt-3" onClick={() => void rollbackCorrection()} disabled={busy || rollbackReason.trim().length < 8 || confirmation !== MCS_KNOWLEDGE_ROLLBACK_CONFIRMATION}>Append rollback version</Button>
              </>}
            </div>}
          </> : <p className="text-sm text-cream-mute">Select a source version to inspect its canonical content. List rows expose metadata only.</p>}
          {message && <p className="font-mono text-[10px] text-amber-300 mt-3">{message}</p>}
        </div>
      </div>
      <p className="font-mono text-[9px] uppercase tracking-label text-cream-mute mt-4">No automatic stale classification · no semantic truth decision · no external communication</p>
    </section>
  );
}

const CONFLICT_LABELS: Record<McsKnowledgeSourceConflictClass, string> = {
  active_source_ref_divergence: 'Source reference divergence',
  active_source_identity_divergence: 'Source identity divergence',
  resource_projection_digest_mismatch: 'Resource digest mismatch',
  active_authority_state_mismatch: 'Authority state mismatch',
  active_exact_duplicate: 'Exact active duplicate',
};

function KnowledgeIntegrityPanel({ integrity }: { integrity: McsAdminKnowledgeIntegrityStatus }) {
  const stateColor = integrity.status === 'clear'
    ? 'text-teal border-teal/40'
    : integrity.status === 'conflicts'
      ? 'text-amber-300 border-amber-300/40'
      : 'text-red-400 border-red-400/40';
  const populatedCounts = (Object.entries(integrity.counts) as Array<[McsKnowledgeSourceConflictClass, number]>)
    .filter(([, count]) => count > 0);

  return (
    <div className="border-t border-line mt-5 pt-4" aria-label="Knowledge source integrity">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-label text-gold">Source Integrity</h3>
        <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-label ${stateColor}`}>
          {integrity.status}
        </span>
      </div>
      <p className="text-xs text-cream-mute mt-2">
        {integrity.scan.sourcesObserved} sources · {integrity.scan.resourcesObserved} resources · {integrity.conflictCount} conflicts
        {integrity.highestSeverity ? ` · highest severity ${integrity.highestSeverity}` : ''}
      </p>
      {integrity.status === 'clear' && (
        <p className="text-xs text-teal mt-2">The bounded canonical scan found no deterministic source conflicts.</p>
      )}
      {(integrity.status === 'degraded' || integrity.status === 'truncated') && (
        <p className="text-xs text-red-400 mt-2">
          Integrity is not clear because the canonical scan was {integrity.status}. Refresh after the store or scan boundary is resolved.
        </p>
      )}
      {populatedCounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {populatedCounts.map(([conflictClass, count]) => (
            <span key={conflictClass} className="border border-line px-2 py-1 font-mono text-[10px] text-amber-300">
              {CONFLICT_LABELS[conflictClass]} · {count}
            </span>
          ))}
        </div>
      )}
      {integrity.degradedReasons.length > 0 && (
        <p className="font-mono text-[9px] uppercase tracking-label text-red-400 mt-3">
          {integrity.degradedReasons.map((entry) => `${entry.reason.replaceAll('_', ' ')} · ${entry.count}`).join(' · ')}
        </p>
      )}
      {integrity.samples.length > 0 && (
        <ul className="grid gap-1 mt-3" aria-label="Conflict fingerprints">
          {integrity.samples.map((sample) => (
            <li key={`${sample.conflictClass}:${sample.fingerprint}`} className="font-mono text-[9px] text-cream-mute">
              {CONFLICT_LABELS[sample.conflictClass]} · {sample.severity} · hash {sample.fingerprint.slice(0, 12)}
            </li>
          ))}
        </ul>
      )}
      <p className="font-mono text-[9px] uppercase tracking-label text-cream-mute mt-3">
        Read-only observation · content-free fingerprints · no mutation authorized
      </p>
    </div>
  );
}

function StatusMetric({ label, value, state }: { label: string; value: number; state?: McsAdminKnowledgeStatusResponse['status'] }) {
  const color = state === 'ready' ? 'text-teal' : state === 'degraded' ? 'text-red-400' : state === 'partial' ? 'text-amber-300' : 'text-cream';
  return (
    <div className="border border-line bg-ink-2 p-4">
      <p className="font-mono text-[10px] uppercase tracking-label text-cream-mute">{label}</p>
      <p className={`font-display text-[32px] leading-none mt-2 ${color}`}>{value}</p>
      {state && <p className={`font-mono text-[10px] uppercase tracking-label mt-2 ${color}`}>{state}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function ResourceContextPicker({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="border border-line bg-ink-2 p-4">
      <legend className="px-2 font-mono text-[10px] uppercase tracking-label text-gold">
        Resource connections
      </legend>
      <p className="mb-3 text-xs text-cream-mute">
        Optional. Kevin-selected links only—nothing is inferred from the document.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {RESOURCE_CONTEXT_OPTIONS.map((option) => (
          <label key={option.tag} className="flex items-start gap-2 text-xs text-cream-mute">
            <input
              type="checkbox"
              checked={values.includes(option.tag)}
              onChange={(event) => onChange(
                event.target.checked
                  ? [...values, option.tag]
                  : values.filter((value) => value !== option.tag),
              )}
              className="mt-0.5 accent-gold"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
