/**
 * /ivory — the BA-private warm-market roster + WDYK coach + Generator.
 *
 * Chat #131 — wireframe §3.4. One page, three tabs (URL hash):
 *
 *   #roster     (default) — the persistent list of names this BA knows.
 *                            Add, edit, categorize, tag with preferred angle,
 *                            mark disposition (invited/customer/BA/not-interested/
 *                            follow-up). Search-filterable.
 *
 *   #coach                 — the WDYK reflection surface. The BA picks an angle
 *                            (do-the-business / make-money / lose-fat), optionally
 *                            anchors on a product, writes an ask, and receives a
 *                            short framing + a list of "who do you know"
 *                            questions that surface names from memory. Inline
 *                            quick-add to roster as names come up.
 *
 *   #generator             — pick a product from the gallery, pick an angle,
 *                            multi-select names from the roster, then mint
 *                            invitations one at a time. Each mint returns a
 *                            /p/{token} link the BA copies and texts from their
 *                            own phone (locked-spec 1.13 / 3.6 — the system never
 *                            auto-sends to a prospect).
 *
 * COMPLIANCE GUARANTEES (locked-spec 3.10 / 3.11):
 *   - Ivory and Generator are BA-facing only. No prospect ever sees this page.
 *   - The coach never names specific people (the BA does — the coach asks).
 *   - The coach never speaks comp / income / medical claims; the server's
 *     system prefix enforces it script-time and falls back to a deterministic
 *     evergreen prompt set when the LLM is unavailable.
 *   - The catalog here is the share-worthy product VIDEO/share set only —
 *     never CV, pricing, cycle, or comp math.
 *
 * `.team` TS6059 CONVENTION: wire types and the local gallery snapshot live
 * inline so this app's rootDir never has to compile sources from packages/
 * shared. The server is the source of truth — see packages/shared/src/
 * types.ts (IvoryName, GeneratorRun, …) and product-catalog.ts.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ───────────────────────────────────────────────────────────────────────
// Local wire contracts (mirror packages/shared/src/types.ts)
// ───────────────────────────────────────────────────────────────────────

type IvoryCategory =
  | 'family' | 'close_friend' | 'work' | 'church' | 'school'
  | 'neighbor' | 'gym' | 'social' | 'past_colleague' | 'other';

type IvoryStatus =
  | 'new' | 'invited' | 'customer' | 'ba' | 'not_interested' | 'follow_up';

type IvoryAngle =
  | 'do_the_business' | 'make_money' | 'lose_fat' | 'unspecified';

interface IvoryName {
  ivoryId: string;
  baId: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  notes: string;
  categories: IvoryCategory[];
  preferredAngle: IvoryAngle;
  status: IvoryStatus;
  lastProspectId: string | null;
  lastTouchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GeneratorRun {
  runId: string;
  baId: string;
  productKey: string;
  productName: string;
  angle: IvoryAngle;
  selectedIvoryIds: string[];
  invitations: Array<{
    ivoryId: string;
    prospectId: string;
    token: string;
    inviteUrl: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface IvoryCoachResponse {
  ok: true;
  coaching: string;
  prompts: string[];
  degraded: boolean;
}

// ───────────────────────────────────────────────────────────────────────
// Local product gallery (display-only; server validates productKey)
// ───────────────────────────────────────────────────────────────────────

interface GalleryProduct {
  productKey: string;
  productName: string;
  blurb: string;
}

const GALLERY: GalleryProduct[] = [
  { productKey: 'glp-three',    productName: 'GLP-THREE',                blurb: 'Natural GLP-1 replacement — the flagship.' },
  { productKey: 'product-line', productName: 'the THREE product line',   blurb: 'Broad intro — the full catalogue.' },
  { productKey: 'visage',       productName: 'VISAGE',                   blurb: 'Skin collection.' },
  { productKey: 'vitalite',     productName: 'Vitalité',                 blurb: 'Energy and vitality.' },
  { productKey: 'revive',       productName: 'Revíve',                   blurb: 'Recovery and renewal.' },
  { productKey: 'collagene',    productName: 'Collagène',                blurb: 'Collagen and skin health.' },
  { productKey: 'imune',        productName: 'Imúne',                    blurb: 'Immune support.' },
  { productKey: 'purifi',       productName: 'Purifí',                   blurb: 'Detox and cleanse.' },
  { productKey: 'eternel',      productName: 'Éternel',                  blurb: 'Anti-aging and longevity.' },
];

// ───────────────────────────────────────────────────────────────────────
// Vocabulary tables
// ───────────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<IvoryCategory, string> = {
  family: 'Family',
  close_friend: 'Close friend',
  work: 'Work',
  church: 'Church',
  school: 'School',
  neighbor: 'Neighbor',
  gym: 'Gym',
  social: 'Social',
  past_colleague: 'Past colleague',
  other: 'Other',
};
const CATEGORIES: IvoryCategory[] = [
  'family', 'close_friend', 'work', 'church', 'school',
  'neighbor', 'gym', 'social', 'past_colleague', 'other',
];

const ANGLE_LABEL: Record<IvoryAngle, string> = {
  do_the_business: 'Do the business',
  make_money: 'Make money',
  lose_fat: 'Lose fat',
  unspecified: 'Unspecified',
};
const ANGLES: IvoryAngle[] = [
  'do_the_business', 'make_money', 'lose_fat', 'unspecified',
];

const STATUS_LABEL: Record<IvoryStatus, string> = {
  new: 'New',
  invited: 'Invited',
  customer: 'Customer',
  ba: 'BA',
  not_interested: 'Not interested',
  follow_up: 'Follow up',
};
const STATUSES: IvoryStatus[] = [
  'new', 'invited', 'customer', 'ba', 'not_interested', 'follow_up',
];

const STATUS_COLOR: Record<IvoryStatus, string> = {
  new: 'bg-cream/[0.06] text-cream border-cream/20',
  invited: 'bg-teal/10 text-teal border-teal/30',
  customer: 'bg-gold/10 text-gold border-gold/30',
  ba: 'bg-gold-bright/10 text-gold-bright border-gold-bright/40',
  not_interested: 'bg-cream/[0.04] text-cream-faint border-cream/15',
  follow_up: 'bg-teal/5 text-cream border-teal/20',
};

// ───────────────────────────────────────────────────────────────────────
// Page shell
// ───────────────────────────────────────────────────────────────────────

type Tab = 'roster' | 'coach' | 'generator';

function tabFromHash(): Tab {
  if (typeof window === 'undefined') return 'roster';
  const h = window.location.hash.replace('#', '');
  if (h === 'coach' || h === 'generator') return h;
  return 'roster';
}

export function IvoryPage() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [roster, setRoster] = useState<IvoryName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ivory', { credentials: 'include' });
      const data = (await res.json()) as
        | { ok: true; names: IvoryName[] }
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError('Could not load your roster.');
        return;
      }
      setRoster(data.names);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const setActiveTab = useCallback((t: Tab) => {
    window.location.hash = t;
    setTab(t);
  }, []);

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="px-6 pt-16 pb-8 border-b border-line">
        <div className="max-w-6xl mx-auto">
          <p className="font-mono tracking-[0.18em] text-[11px] text-teal uppercase mb-3">
            Team Magnificent · Ivory
          </p>
          <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] text-cream mb-3">
            Who do you <span className="text-gold-bright">know?</span>
          </h1>
          <p className="text-cream-mute text-[15px] leading-[1.6] max-w-2xl">
            Your private warm market. Add the people you already know,
            brainstorm who you haven&rsquo;t thought of yet, and when you&rsquo;re
            ready, share a product video with one of them.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            <TabBtn active={tab === 'roster'}    onClick={() => setActiveTab('roster')}>Roster · {roster.length}</TabBtn>
            <TabBtn active={tab === 'coach'}     onClick={() => setActiveTab('coach')}>Coach</TabBtn>
            <TabBtn active={tab === 'generator'} onClick={() => setActiveTab('generator')}>Generator</TabBtn>
          </div>
        </div>
      </header>

      <main className="px-6 py-10">
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="mb-6 text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-3">
              {error}
            </div>
          )}
          {loading && (
            <p className="font-mono tracking-[0.12em] text-[11px] text-cream-faint uppercase mb-4">
              Loading your roster…
            </p>
          )}
          {tab === 'roster'    && <RosterTab    roster={roster} onChange={refresh} />}
          {tab === 'coach'     && <CoachTab     roster={roster} onAdded={refresh} />}
          {tab === 'generator' && <GeneratorTab roster={roster} onChange={refresh} />}
        </div>
      </main>
    </div>
  );
}

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'font-mono tracking-[0.1em] text-[12px] uppercase px-4 py-2 rounded-md border transition-colors ' +
        (active
          ? 'bg-gold text-ink border-gold'
          : 'bg-transparent text-cream-mute border-line hover:text-cream hover:border-cream/30')
      }
    >
      {children}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Roster tab
// ───────────────────────────────────────────────────────────────────────

function RosterTab({
  roster, onChange,
}: { roster: IvoryName[]; onChange: () => Promise<void> }) {
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<IvoryName | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((n) =>
      `${n.firstName} ${n.lastName} ${n.notes} ${n.categories.join(' ')}`
        .toLowerCase()
        .includes(q),
    );
  }, [filter, roster]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Input
          placeholder="Filter names, notes, categories…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
        <Button
          onClick={() => setAdding(true)}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-5 py-4"
        >
          Add a name
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-line rounded-md py-10 px-6 text-center">
          <p className="font-display text-[20px] text-cream mb-2">
            {roster.length === 0 ? 'Your roster is empty.' : 'No matches.'}
          </p>
          <p className="text-cream-mute text-[14px]">
            {roster.length === 0
              ? 'Open the Coach tab — it asks you the questions that surface names you forgot.'
              : 'Try a different search, or clear the filter.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-md">
          {filtered.map((n) => (
            <li
              key={n.ivoryId}
              onClick={() => setEditing(n)}
              className="grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-cream/[0.02] cursor-pointer"
            >
              <div className="col-span-3">
                <p className="text-cream text-[15px] leading-[1.3]">
                  {n.firstName} <span className="text-cream-mute">{n.lastInitial}.</span>
                </p>
                <p className="font-mono text-[10px] tracking-[0.08em] text-cream-faint uppercase mt-0.5">
                  {ANGLE_LABEL[n.preferredAngle]}
                </p>
              </div>
              <div className="col-span-4 flex flex-wrap gap-1.5">
                {n.categories.length === 0 ? (
                  <span className="font-mono text-[10px] tracking-[0.08em] text-cream-faint uppercase">
                    no tags
                  </span>
                ) : (
                  n.categories.map((c) => (
                    <span
                      key={c}
                      className="font-mono text-[10px] tracking-[0.06em] text-cream-mute bg-cream/[0.05] border border-cream/15 rounded-sm py-0.5 px-1.5"
                    >
                      {CATEGORY_LABEL[c]}
                    </span>
                  ))
                )}
              </div>
              <div className="col-span-2">
                <span
                  className={
                    'inline-flex font-mono text-[10px] tracking-[0.08em] uppercase border rounded-sm py-0.5 px-1.5 ' +
                    STATUS_COLOR[n.status]
                  }
                >
                  {STATUS_LABEL[n.status]}
                </span>
              </div>
              <div className="col-span-3">
                <p className="text-cream-faint text-[12px] line-clamp-2">
                  {n.notes || <span className="text-cream-faint/60">—</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <NameModal
          mode="add"
          onClose={() => setAdding(false)}
          onSaved={async () => { setAdding(false); await onChange(); }}
        />
      )}
      {editing && (
        <NameModal
          mode="edit"
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await onChange(); }}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Add / edit modal
// ───────────────────────────────────────────────────────────────────────

interface NameForm {
  firstName: string;
  lastName: string;
  notes: string;
  categories: IvoryCategory[];
  preferredAngle: IvoryAngle;
}

function NameModal({
  mode, existing, onClose, onSaved,
}: {
  mode: 'add' | 'edit';
  existing?: IvoryName;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<NameForm>({
    firstName: existing?.firstName ?? '',
    lastName: existing?.lastName ?? '',
    notes: existing?.notes ?? '',
    categories: existing?.categories ?? [],
    preferredAngle: existing?.preferredAngle ?? 'unspecified',
  });
  const [status, setStatus] = useState<IvoryStatus>(existing?.status ?? 'new');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCat = useCallback((c: IvoryCategory) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(c)
        ? f.categories.filter((x) => x !== c)
        : [...f.categories, c],
    }));
  }, []);

  const ready = form.firstName.trim() !== '' && form.lastName.trim() !== '' && !submitting;

  const handleSave = useCallback(async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      let res: Response;
      if (mode === 'add') {
        res = await fetch('/api/ivory', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else if (existing) {
        res = await fetch(`/api/ivory/${existing.ivoryId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok && status !== existing.status) {
          await fetch(`/api/ivory/${existing.ivoryId}/status`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });
        }
      } else {
        return;
      }
      if (!res.ok) {
        setError('Could not save. Try again.');
        return;
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setSubmitting(false);
    }
  }, [ready, mode, existing, form, status, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!existing) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ivory/${existing.ivoryId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        setError('Could not delete. Try again.');
        return;
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setDeleting(false);
    }
  }, [existing, onSaved]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/85 px-6 py-12 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-ink-2 border border-gold/30 rounded-lg p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono tracking-[0.18em] text-[11px] text-teal uppercase mb-2">
          {mode === 'add' ? 'Add a name' : 'Edit name'}
        </p>
        <h2 className="font-display text-[clamp(26px,4vw,36px)] leading-[1] text-cream mb-5">
          {mode === 'add' ? 'Who came to mind?' : `${form.firstName || '—'} ${form.lastName || ''}`}
        </h2>

        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="iv-first">First name</Label>
              <Input
                id="iv-first"
                value={form.firstName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
                maxLength={80}
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="iv-last">Last name</Label>
              <Input
                id="iv-last"
                value={form.lastName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
                maxLength={80}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CATEGORIES.map((c) => {
                const on = form.categories.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleCat(c)}
                    className={
                      'font-mono text-[11px] tracking-[0.06em] uppercase border rounded-sm py-1 px-2 transition-colors ' +
                      (on
                        ? 'bg-teal/10 text-teal border-teal/40'
                        : 'bg-transparent text-cream-faint border-cream/15 hover:border-cream/30')
                    }
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Preferred angle</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ANGLES.map((a) => {
                const on = form.preferredAngle === a;
                return (
                  <button
                    type="button"
                    key={a}
                    onClick={() => setForm((f) => ({ ...f, preferredAngle: a }))}
                    className={
                      'font-mono text-[11px] tracking-[0.06em] uppercase border rounded-sm py-1 px-2 transition-colors ' +
                      (on
                        ? 'bg-gold/10 text-gold border-gold/40'
                        : 'bg-transparent text-cream-faint border-cream/15 hover:border-cream/30')
                    }
                  >
                    {ANGLE_LABEL[a]}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'edit' && (
            <div>
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {STATUSES.map((s) => {
                  const on = status === s;
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setStatus(s)}
                      className={
                        'font-mono text-[11px] tracking-[0.06em] uppercase border rounded-sm py-1 px-2 transition-colors ' +
                        (on ? STATUS_COLOR[s] : 'bg-transparent text-cream-faint border-cream/15 hover:border-cream/30')
                      }
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="iv-notes">
              Notes <span className="text-cream-faint normal-case">(private to you)</span>
            </Label>
            <textarea
              id="iv-notes"
              value={form.notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={4}
              maxLength={1200}
              className={
                'w-full bg-ink border border-line text-cream rounded-md px-3.5 py-3 ' +
                'text-sm font-body leading-[1.55] placeholder:text-cream/30 ' +
                'focus:outline-none focus:border-gold transition-colors resize-y'
              }
              placeholder="What you know about them, when you last connected, what they care about…"
            />
            <p className="mt-1.5 text-[11px] font-mono tracking-[0.06em] text-cream-faint">
              {form.notes.length}/1200
            </p>
          </div>

          {error && (
            <div className="text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-2.5">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={!ready}
              className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-6 py-5"
            >
              {submitting ? 'Saving…' : mode === 'add' ? 'Add to roster' : 'Save changes'}
            </Button>
            <Button
              onClick={onClose}
              className="bg-transparent text-cream border border-cream/20 hover:bg-cream/[0.05] font-mono tracking-[0.04em] text-[13px] px-5 py-5"
            >
              Cancel
            </Button>
            {mode === 'edit' && (
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-transparent text-red-400 border border-red-500/30 hover:bg-red-500/[0.05] font-mono tracking-[0.04em] text-[13px] px-5 py-5 ml-auto"
              >
                {deleting ? 'Removing…' : 'Remove from roster'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Coach tab
// ───────────────────────────────────────────────────────────────────────

function CoachTab({
  roster, onAdded,
}: { roster: IvoryName[]; onAdded: () => Promise<void> }) {
  const [angle, setAngle] = useState<IvoryAngle>('unspecified');
  const [productName, setProductName] = useState<string>('');
  const [ask, setAsk] = useState('');
  const [coaching, setCoaching] = useState<IvoryCoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick-add inline (no full modal — keep the brainstorm flow tight).
  const [quickFirst, setQuickFirst] = useState('');
  const [quickLast, setQuickLast] = useState('');
  const [quickStatus, setQuickStatus] = useState<string | null>(null);

  const handleCoach = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ivory/coach', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          angle,
          productName: productName || null,
          rosterSize: roster.length,
          ask,
        }),
      });
      const data = (await res.json()) as IvoryCoachResponse | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError('Could not run the coach.');
        return;
      }
      setCoaching(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [angle, productName, ask, roster.length]);

  const handleQuickAdd = useCallback(async () => {
    if (!quickFirst.trim() || !quickLast.trim()) return;
    setQuickStatus('saving');
    try {
      const res = await fetch('/api/ivory', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: quickFirst.trim(),
          lastName: quickLast.trim(),
          preferredAngle: angle,
        }),
      });
      if (res.ok) {
        setQuickFirst('');
        setQuickLast('');
        setQuickStatus('saved');
        await onAdded();
        setTimeout(() => setQuickStatus(null), 1600);
      } else {
        setQuickStatus('error');
      }
    } catch {
      setQuickStatus('error');
    }
  }, [quickFirst, quickLast, angle, onAdded]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: controls */}
      <div>
        <h2 className="font-display text-[28px] text-cream mb-3">Brainstorm</h2>
        <p className="text-cream-mute text-[14px] leading-[1.6] mb-6">
          Pick an angle, optionally anchor on a product you've been sharing,
          and write a sentence about who you keep blanking on. The coach
          returns questions — not names. You provide the names.
        </p>

        <div className="space-y-4">
          <div>
            <Label>Angle</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ANGLES.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setAngle(a)}
                  className={
                    'font-mono text-[11px] tracking-[0.06em] uppercase border rounded-sm py-1.5 px-2.5 transition-colors ' +
                    (angle === a
                      ? 'bg-gold/15 text-gold border-gold/50'
                      : 'bg-transparent text-cream-faint border-cream/15 hover:border-cream/30')
                  }
                >
                  {ANGLE_LABEL[a]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="coach-product">
              Product anchor <span className="text-cream-faint normal-case">(optional)</span>
            </Label>
            <select
              id="coach-product"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-ink border border-line text-cream rounded-md px-3.5 py-3 text-sm font-body focus:outline-none focus:border-gold"
            >
              <option value="">— none —</option>
              {GALLERY.map((p) => (
                <option key={p.productKey} value={p.productName}>{p.productName}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="coach-ask">What's stuck?</Label>
            <textarea
              id="coach-ask"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="e.g. I keep forgetting people from church, or anyone I worked with before 2022."
              className={
                'w-full bg-ink border border-line text-cream rounded-md px-3.5 py-3 ' +
                'text-sm font-body leading-[1.55] placeholder:text-cream/30 ' +
                'focus:outline-none focus:border-gold transition-colors resize-y'
              }
            />
            <p className="mt-1.5 text-[11px] font-mono tracking-[0.06em] text-cream-faint">
              {ask.length}/600
            </p>
          </div>

          <Button
            onClick={handleCoach}
            disabled={loading}
            className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-6 py-5"
          >
            {loading ? 'Thinking…' : 'Coach me'}
          </Button>

          {error && (
            <div className="text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-2.5">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Right: results + quick-add */}
      <div>
        <h2 className="font-display text-[28px] text-cream mb-3">Prompts</h2>

        {!coaching ? (
          <p className="text-cream-faint text-[14px] leading-[1.6]">
            Press <span className="text-cream">Coach me</span> and the questions appear here.
          </p>
        ) : (
          <div>
            {coaching.degraded && (
              <p className="mb-3 font-mono text-[10px] tracking-[0.1em] text-cream-faint uppercase">
                Coach offline — showing evergreen prompts
              </p>
            )}
            <p className="text-cream text-[15px] leading-[1.6] mb-5">{coaching.coaching}</p>
            <ol className="space-y-3 mb-7">
              {coaching.prompts.map((q, i) => (
                <li key={i} className="flex gap-3 text-cream-mute text-[14px] leading-[1.55]">
                  <span className="font-mono text-[11px] tracking-[0.12em] text-teal mt-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{q}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Quick-add — for names that surface mid-brainstorm */}
        <div className="border-t border-line pt-5">
          <p className="font-mono tracking-[0.12em] text-[11px] text-teal uppercase mb-2">
            Quick add
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <Label htmlFor="qa-first">First</Label>
              <Input
                id="qa-first"
                value={quickFirst}
                onChange={(e) => setQuickFirst(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label htmlFor="qa-last">Last</Label>
              <Input
                id="qa-last"
                value={quickLast}
                onChange={(e) => setQuickLast(e.target.value)}
                maxLength={80}
              />
            </div>
            <Button
              onClick={handleQuickAdd}
              disabled={!quickFirst.trim() || !quickLast.trim() || quickStatus === 'saving'}
              className="bg-teal/15 text-teal border border-teal/40 hover:bg-teal/25 font-mono tracking-[0.06em] text-[12px] px-4 py-3 uppercase"
            >
              {quickStatus === 'saving' ? 'Saving…' : 'Add'}
            </Button>
          </div>
          {quickStatus === 'saved' && (
            <p className="mt-2 font-mono text-[10px] tracking-[0.1em] text-teal uppercase">
              Added to roster
            </p>
          )}
          {quickStatus === 'error' && (
            <p className="mt-2 font-mono text-[10px] tracking-[0.1em] text-red-400 uppercase">
              Could not add
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Generator tab
// ───────────────────────────────────────────────────────────────────────

function GeneratorTab({
  roster, onChange,
}: { roster: IvoryName[]; onChange: () => Promise<void> }) {
  const [productKey, setProductKey] = useState<string>('');
  const [angle, setAngle] = useState<IvoryAngle>('unspecified');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<GeneratorRun | null>(null);
  const [message, setMessage] = useState('');
  const [mintingId, setMintingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligibleRoster = useMemo(
    () => roster.filter((n) => n.status !== 'invited' && n.status !== 'not_interested'),
    [roster],
  );

  const selectedProduct = useMemo(
    () => GALLERY.find((g) => g.productKey === productKey) ?? null,
    [productKey],
  );

  const toggle = useCallback((ivoryId: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(ivoryId)) next.delete(ivoryId);
      else next.add(ivoryId);
      return next;
    });
  }, []);

  const handleStart = useCallback(async () => {
    if (!selectedProduct) {
      setError('Pick a product first.');
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/ivory/generator/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productKey: selectedProduct.productKey,
          angle,
          selectedIvoryIds: Array.from(selected),
        }),
      });
      const data = (await res.json()) as
        | { ok: true; run: GeneratorRun }
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError('Could not start the run.');
        return;
      }
      setRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    }
  }, [selectedProduct, angle, selected]);

  const handleMint = useCallback(async (ivoryId: string) => {
    if (!run) return;
    setMintingId(ivoryId);
    setError(null);
    try {
      const res = await fetch(`/api/ivory/generator/run/${run.runId}/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ivoryId, message: message.trim() || null }),
      });
      const data = (await res.json()) as
        | { ok: true; run: GeneratorRun; invitation: { inviteUrl: string } }
        | { ok: false; error?: string };
      if (!res.ok || !data.ok) {
        setError('Could not mint that invite.');
        return;
      }
      setRun(data.run);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setMintingId(null);
    }
  }, [run, message, onChange]);

  const handleReset = useCallback(() => {
    setRun(null);
    setSelected(new Set());
    setProductKey('');
    setMessage('');
    setError(null);
  }, []);

  const copy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
  }, []);

  if (run) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-[28px] text-cream">
            Running · <span className="text-gold-bright">{run.productName}</span>
          </h2>
          <span className="font-mono text-[11px] tracking-[0.1em] text-teal uppercase">
            angle: {ANGLE_LABEL[run.angle]}
          </span>
          <Button
            onClick={handleReset}
            className="ml-auto bg-transparent text-cream-mute hover:text-cream border border-cream/20 font-mono tracking-[0.04em] text-[12px] px-4 py-2 uppercase"
          >
            New run
          </Button>
        </div>

        <div className="mb-6">
          <Label htmlFor="gen-msg">
            Invitation message <span className="text-cream-faint normal-case">(optional, reused across this run)</span>
          </Label>
          <textarea
            id="gen-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={1200}
            placeholder={`Hey — I came across ${selectedProduct?.productName ?? 'this'} and thought of you. Two minutes — want to watch and tell me what you think?`}
            className={
              'w-full bg-ink-2 border border-line text-cream rounded-md px-3.5 py-3 ' +
              'text-sm font-body leading-[1.55] placeholder:text-cream/30 ' +
              'focus:outline-none focus:border-gold transition-colors resize-y'
            }
          />
          <p className="mt-1.5 text-[11px] font-mono tracking-[0.06em] text-cream-faint">
            {message.length}/1200 · saved on each mint
          </p>
        </div>

        {error && (
          <div className="mb-4 text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-2.5">
            {error}
          </div>
        )}

        <ul className="divide-y divide-line border border-line rounded-md">
          {run.selectedIvoryIds.map((ivoryId) => {
            const name = roster.find((n) => n.ivoryId === ivoryId);
            const minted = run.invitations.find((i) => i.ivoryId === ivoryId);
            return (
              <li key={ivoryId} className="grid grid-cols-12 gap-3 items-center px-4 py-3">
                <div className="col-span-3">
                  <p className="text-cream text-[15px]">
                    {name ? `${name.firstName} ${name.lastInitial}.` : ivoryId}
                  </p>
                </div>
                <div className="col-span-6">
                  {minted ? (
                    <p className="font-mono text-[12px] text-cream break-all">{minted.inviteUrl}</p>
                  ) : (
                    <p className="font-mono text-[11px] tracking-[0.06em] text-cream-faint uppercase">
                      not yet minted
                    </p>
                  )}
                </div>
                <div className="col-span-3 flex flex-wrap gap-2 justify-end">
                  {minted ? (
                    <Button
                      onClick={() => copy(minted.inviteUrl)}
                      className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[12px] px-4 py-2 uppercase"
                    >
                      Copy link
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleMint(ivoryId)}
                      disabled={mintingId === ivoryId}
                      className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[13px] px-4 py-3"
                    >
                      {mintingId === ivoryId ? 'Minting…' : 'Mint invite'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-cream-faint text-[13px] leading-[1.55]">
          Copy each link and text it from your own phone, in your own words.
          The system never sends to a prospect for you.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-[28px] text-cream mb-3">Pick a product</h2>
      <p className="text-cream-mute text-[14px] leading-[1.6] mb-5">
        Pick what you want to share, pick the angle, then choose the names from
        your roster you want to invite. Each name gets its own /p link.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-7">
        {GALLERY.map((p) => {
          const on = productKey === p.productKey;
          return (
            <button
              type="button"
              key={p.productKey}
              onClick={() => setProductKey(p.productKey)}
              className={
                'text-left bg-ink-2 border rounded-md p-4 transition-colors ' +
                (on
                  ? 'border-gold/60 ring-1 ring-gold/30'
                  : 'border-line hover:border-cream/30')
              }
            >
              <p className="font-display text-[18px] text-cream mb-1">{p.productName}</p>
              <p className="text-cream-faint text-[12px] leading-[1.5]">{p.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="mb-6">
        <Label>Angle</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {ANGLES.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => setAngle(a)}
              className={
                'font-mono text-[11px] tracking-[0.06em] uppercase border rounded-sm py-1.5 px-2.5 transition-colors ' +
                (angle === a
                  ? 'bg-gold/15 text-gold border-gold/50'
                  : 'bg-transparent text-cream-faint border-cream/15 hover:border-cream/30')
              }
            >
              {ANGLE_LABEL[a]}
            </button>
          ))}
        </div>
      </div>

      <h3 className="font-display text-[20px] text-cream mb-2">Pick names</h3>
      <p className="text-cream-faint text-[12px] mb-3">
        Already-invited and not-interested names are hidden.
      </p>
      {eligibleRoster.length === 0 ? (
        <p className="border border-line rounded-md py-8 px-4 text-center text-cream-mute text-[14px]">
          No eligible names yet — add some in the Roster tab or the Coach tab.
        </p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-md mb-7">
          {eligibleRoster.map((n) => {
            const on = selected.has(n.ivoryId);
            return (
              <li
                key={n.ivoryId}
                onClick={() => toggle(n.ivoryId)}
                className={
                  'grid grid-cols-12 gap-3 items-center px-4 py-3 cursor-pointer transition-colors ' +
                  (on ? 'bg-gold/[0.06]' : 'hover:bg-cream/[0.02]')
                }
              >
                <div className="col-span-1">
                  <span
                    className={
                      'inline-block w-4 h-4 rounded-sm border ' +
                      (on ? 'bg-gold border-gold' : 'border-cream/30')
                    }
                  />
                </div>
                <div className="col-span-4">
                  <p className="text-cream text-[14px]">
                    {n.firstName} <span className="text-cream-mute">{n.lastInitial}.</span>
                  </p>
                </div>
                <div className="col-span-4">
                  <span className="font-mono text-[10px] tracking-[0.08em] text-cream-faint uppercase">
                    {ANGLE_LABEL[n.preferredAngle]}
                  </span>
                </div>
                <div className="col-span-3">
                  <span
                    className={
                      'inline-flex font-mono text-[10px] tracking-[0.08em] uppercase border rounded-sm py-0.5 px-1.5 ' +
                      STATUS_COLOR[n.status]
                    }
                  >
                    {STATUS_LABEL[n.status]}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <div className="mb-4 text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-2.5">
          {error}
        </div>
      )}

      <Button
        onClick={handleStart}
        disabled={!productKey || selected.size === 0}
        className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-7 py-5"
      >
        Start run · {selected.size} {selected.size === 1 ? 'name' : 'names'}
      </Button>
    </div>
  );
}

export default IvoryPage;
