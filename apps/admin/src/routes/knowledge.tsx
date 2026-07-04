/**
 * /knowledge — Kevin-authored Knowledge Base intake.
 */

import { FormEvent, useState, type ReactNode } from 'react';
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
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setErr(null);

    try {
      const tags = topicTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
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
      const tags = topicTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
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
      setFile(null);
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
    </label>
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
