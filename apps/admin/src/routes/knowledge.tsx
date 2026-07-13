/**
 * /knowledge — Kevin-authored Knowledge Base intake.
 */

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { McsAdminKnowledgeStatusResponse } from '@momentum/shared';
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
          </>
        ) : <p className="text-sm text-cream-mute">{statusError ?? 'Loading knowledge status…'}</p>}
      </section>

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
