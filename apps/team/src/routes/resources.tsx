import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, CalendarDays, Search, Sparkles, Video } from 'lucide-react';

type ResourceKind = 'content_video' | 'master_template' | 'knowledge_source' | 'knowledge_chunk' | 'static_resource';

interface ResourceItem {
  resourceId: string;
  resourceVersionId: string;
  title: string;
  summary: string;
  kind: ResourceKind;
  categories: string[];
  tags: string[];
  languageCode: 'en' | 'es' | null;
  version: number;
  sourceSystem: string;
  openTarget: string | null;
  updatedAt: string;
}

interface ResourceResponse {
  ok: true;
  schemaVersion: 'resource_center.v1';
  items: ResourceItem[];
  categories: string[];
  kinds: ResourceKind[];
}

const SOURCE_SHORTCUTS = [
  { to: '/video-library', label: 'Product Gallery', detail: 'Product videos and shareable education', icon: Video },
  { to: '/training/fast-start', label: 'Fast Start', detail: 'The first steps of your training path', icon: Sparkles },
  { to: '/training/10-steps', label: '10-Step Orientation', detail: 'The full member orientation sequence', icon: BookOpen },
] as const;

const KIND_LABELS: Record<ResourceKind, string> = {
  content_video: 'Video',
  master_template: 'Guide',
  knowledge_source: 'Knowledge',
  knowledge_chunk: 'Reference',
  static_resource: 'Resource',
};

export function ResourcesPage() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState<'all' | ResourceKind>('all');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/resources', { credentials: 'include' })
      .then(async (response) => {
        const data = (await response.json()) as ResourceResponse | { ok: false };
        if (!response.ok || !data.ok) throw new Error('resource_catalog_unavailable');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(
    () => [...new Set(items.flatMap((item) => item.categories))].sort(),
    [items],
  );
  const kinds = useMemo(
    () => [...new Set(items.map((item) => item.kind))].sort(),
    [items],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (category !== 'all' && !item.categories.includes(category)) return false;
      if (kind !== 'all' && item.kind !== kind) return false;
      if (!needle) return true;
      return [item.title, item.summary, ...item.categories, ...item.tags]
        .some((value) => value.toLocaleLowerCase().includes(needle));
    });
  }, [category, items, kind, query]);

  return (
    <main className="min-h-screen bg-ink text-cream">
      <section className="border-b border-line px-6 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-teal">Resource Center</p>
          <div className="mt-4 grid gap-8 md:grid-cols-[1fr_0.7fr] md:items-end">
            <h1 className="font-display text-[clamp(48px,8vw,88px)] leading-[0.9]">
              Find what you need.<br /><span className="text-gold-bright">Keep moving.</span>
            </h1>
            <p className="max-w-xl text-[16px] leading-7 text-cream-mute">
              Search approved Team Magnificent resources, or go straight to the training and product libraries you already use.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        <section aria-labelledby="resource-shortcuts">
          <div className="flex items-center justify-between gap-4">
            <h2 id="resource-shortcuts" className="font-display text-3xl tracking-wide">Explore the libraries</h2>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-cream-faint md:block">Source-owned paths</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {SOURCE_SHORTCUTS.map(({ to, label, detail, icon: Icon }) => (
              <Link key={to} to={to} className="group rounded-md border border-line bg-cream/[0.02] p-5 transition hover:border-gold/45 hover:bg-gold/[0.04]">
                <div className="flex items-start justify-between gap-4">
                  <Icon className="h-6 w-6 text-teal" aria-hidden="true" />
                  <ArrowUpRight className="h-4 w-4 text-cream-faint transition group-hover:text-gold" aria-hidden="true" />
                </div>
                <h3 className="mt-7 font-display text-2xl tracking-wide text-cream">{label}</h3>
                <p className="mt-2 text-sm leading-6 text-cream-mute">{detail}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-line pt-10" aria-labelledby="approved-resources">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-teal">Version-verified</p>
              <h2 id="approved-resources" className="mt-2 font-display text-4xl tracking-wide">Approved resources</h2>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-3xl">
              <label className="relative sm:col-span-1">
                <span className="sr-only">Search resources</span>
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-cream-faint" aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources" className="h-10 w-full rounded-md border border-line bg-ink-2 pl-10 pr-3 text-sm text-cream outline-none placeholder:text-cream-faint focus:border-gold" />
              </label>
              <label>
                <span className="sr-only">Filter by category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-md border border-line bg-ink-2 px-3 text-sm text-cream outline-none focus:border-gold">
                  <option value="all">All categories</option>
                  {categories.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by resource type</span>
                <select value={kind} onChange={(event) => setKind(event.target.value as 'all' | ResourceKind)} className="h-10 w-full rounded-md border border-line bg-ink-2 px-3 text-sm text-cream outline-none focus:border-gold">
                  <option value="all">All types</option>
                  {kinds.map((value) => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}
                </select>
              </label>
            </div>
          </div>

          {state === 'loading' && <StatePanel message="Checking approved resource versions…" />}
          {state === 'error' && <StatePanel message="The verified catalog is unavailable right now. Your source libraries are still available above." tone="error" />}
          {state === 'ready' && items.length === 0 && <StatePanel message="No resources have completed version verification yet. Use the source libraries above while Kevin prepares the approved catalog." />}
          {state === 'ready' && items.length > 0 && visible.length === 0 && <StatePanel message="No approved resources match those filters." />}
          {state === 'ready' && visible.length > 0 && (
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {visible.map((item) => <ResourceCard key={item.resourceVersionId} item={item} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ResourceCard({ item }: { item: ResourceItem }) {
  const external = item.openTarget?.startsWith('https://') ?? false;
  const content = (
    <article className="h-full rounded-md border border-line bg-ink-2 p-5 transition hover:border-gold/40">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal">{KIND_LABELS[item.kind]}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-cream-faint">Verified · v{item.version}</span>
      </div>
      <h3 className="mt-4 font-display text-2xl tracking-wide text-cream">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-cream-mute">{item.summary}</p>
      {item.categories.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{item.categories.map((value) => <span key={value} className="rounded-full border border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-cream-faint">{value}</span>)}</div>}
    </article>
  );
  if (!item.openTarget) return content;
  if (external) return <a href={item.openTarget} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`} onClick={() => recordResourceOpen(item.resourceVersionId)}>{content}</a>;
  const detailTracksOnLoad = item.openTarget.startsWith('/resources/');
  return <Link to={item.openTarget} aria-label={`Open ${item.title}`} onClick={detailTracksOnLoad ? undefined : () => recordResourceOpen(item.resourceVersionId)}>{content}</Link>;
}

function recordResourceOpen(resourceVersionId: string): void {
  void fetch(`/api/resources/${encodeURIComponent(resourceVersionId)}/usage`, {
    method: 'POST', credentials: 'include', keepalive: true,
  });
}

function StatePanel({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' }) {
  return (
    <div className={`mt-7 rounded-md border p-6 ${tone === 'error' ? 'border-red-400/30 bg-red-500/[0.04]' : 'border-line bg-cream/[0.02]'}`}>
      <div className="flex items-start gap-3">
        <CalendarDays className={`mt-0.5 h-5 w-5 ${tone === 'error' ? 'text-red-300' : 'text-gold'}`} aria-hidden="true" />
        <p className="text-sm leading-6 text-cream-mute">{message}</p>
      </div>
    </div>
  );
}

export default ResourcesPage;
