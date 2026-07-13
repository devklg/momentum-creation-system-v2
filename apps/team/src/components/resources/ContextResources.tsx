import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';

interface ResourceItem {
  resourceVersionId: string;
  title: string;
  summary: string;
  tags: string[];
  openTarget: string | null;
  version: number;
}
interface ResourceResponse {
  ok: true;
  items: ResourceItem[];
}

export function ContextResources({
  contextTag,
  title = 'Approved resources for this step',
}: {
  contextTag: string;
  title?: string;
}) {
  const [items, setItems] = useState<ResourceItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/resources', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('resource_catalog_unavailable');
        return (await response.json()) as ResourceResponse;
      })
      .then((body) => {
        if (!cancelled) {
          setItems(body.items.filter((item) => item.tags.includes(contextTag)).slice(0, 6));
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => { cancelled = true; };
  }, [contextTag]);

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-10 border border-teal/25 bg-teal/[0.035] p-5 md:p-6" aria-label={title}>
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-teal" aria-hidden="true" />
        <h2 className="font-display text-2xl tracking-wide text-cream">{title}</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const body = (
            <article className="h-full border border-line bg-ink-2 p-4 transition hover:border-gold/40">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl tracking-wide text-cream">{item.title}</h3>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              </div>
              <p className="mt-2 text-xs leading-5 text-cream-mute">{item.summary}</p>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-teal">Kevin-approved · v{item.version}</p>
            </article>
          );
          if (!item.openTarget) return <div key={item.resourceVersionId}>{body}</div>;
          if (item.openTarget.startsWith('https://')) {
            return <a key={item.resourceVersionId} href={item.openTarget} target="_blank" rel="noreferrer">{body}</a>;
          }
          return <Link key={item.resourceVersionId} to={item.openTarget}>{body}</Link>;
        })}
      </div>
    </section>
  );
}
