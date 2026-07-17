import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

interface ResourceDetail {
  ok: true;
  schemaVersion: 'resource_center.v1';
  item: {
    resourceVersionId: string;
    title: string;
    summary: string;
    categories: string[];
    tags: string[];
    version: number;
    updatedAt: string;
  };
  content: string;
  document: {
    filename: string;
    mimeType: string;
    originalBytes: number;
    sha256: string;
    openTarget: string;
  } | null;
}

export function ResourceDetailPage() {
  const { resourceVersionId = '' } = useParams();
  const [detail, setDetail] = useState<ResourceDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    void fetch(`/api/resources/${encodeURIComponent(resourceVersionId)}`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('resource_not_available');
        return (await response.json()) as ResourceDetail;
      })
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setState('ready');
        void fetch(`/api/resources/${encodeURIComponent(data.item.resourceVersionId)}/usage`, {
          method: 'POST', credentials: 'include', keepalive: true,
        });
      })
      .catch(() => {
        if (!cancelled) setState('missing');
      });
    return () => { cancelled = true; };
  }, [resourceVersionId]);

  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="mx-auto max-w-4xl px-6 py-10 md:py-16">
        <Link to="/resources" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-teal hover:text-gold">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Resource Center
        </Link>
        {state === 'loading' && <Panel message="Verifying the approved resource version…" />}
        {state === 'missing' && <Panel message="This resource is not available as a verified Kevin-approved version." />}
        {state === 'ready' && detail && (
          <article className="mt-8 overflow-hidden rounded-md border border-line bg-ink-2">
            <header className="border-b border-line px-6 py-8 md:px-10 md:py-10">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal">Kevin-approved knowledge</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream-faint">Verified · v{detail.item.version}</span>
              </div>
              <h1 className="mt-5 font-display text-[clamp(42px,7vw,72px)] leading-[0.95] text-cream">{detail.item.title}</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-cream-mute">{detail.item.summary}</p>
              {detail.item.categories.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {detail.item.categories.map((category) => <span key={category} className="rounded-full border border-line px-3 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-cream-faint">{category}</span>)}
                </div>
              )}
              {detail.document && (
                <a
                  className="mt-7 inline-flex items-center gap-2 rounded-sm bg-gold px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-gold-bright"
                  href={detail.document.openTarget}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" /> Open / Print PDF
                </a>
              )}
            </header>
            <div className="whitespace-pre-wrap px-6 py-8 text-[15px] leading-7 text-cream-mute md:px-10 md:py-10">{detail.content}</div>
          </article>
        )}
      </div>
    </main>
  );
}

function Panel({ message }: { message: string }) {
  return (
    <div className="mt-8 flex items-start gap-3 rounded-md border border-line bg-cream/[0.02] p-6">
      <BookOpen className="mt-0.5 h-5 w-5 text-gold" aria-hidden="true" />
      <p className="text-sm leading-6 text-cream-mute">{message}</p>
    </div>
  );
}

export default ResourceDetailPage;
