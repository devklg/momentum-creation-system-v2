/**
 * /content-videos — Kevin-only Product Gallery content control.
 */

import { useEffect, useMemo, useState } from 'react';
import type {
  McsContentVideoAudience,
  McsContentVideoRecord,
  McsContentVideoReorderResponse,
  McsContentVideosAdminListResponse,
  McsContentVideoMutationResponse,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface FormState {
  section: string;
  title: string;
  youtubeId: string;
  url: string;
  description: string;
  sortOrder: string;
  audience: McsContentVideoAudience;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  section: 'Product Knowledge',
  title: '',
  youtubeId: '',
  url: '',
  description: '',
  sortOrder: '100',
  audience: 'both',
  active: true,
};

export function ContentVideosPage() {
  const [sections, setSections] = useState<McsContentVideosAdminListResponse['sections']>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SaveState>('idle');
  const [err, setErr] = useState<string | null>(null);

  const videos = useMemo(() => sections.flatMap((section) => section.videos), [sections]);
  const selected = videos.find((video) => video.contentVideoId === selectedId) ?? null;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/content/videos', { credentials: 'include' });
      const data = (await res.json()) as McsContentVideosAdminListResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load Product Gallery content.');
        return;
      }
      setSections(data.sections);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startCreate() {
    setSelectedId(null);
    setForm({ ...EMPTY_FORM, sortOrder: String(nextSortOrder(videos)) });
    setState('idle');
    setErr(null);
  }

  function startEdit(video: McsContentVideoRecord) {
    setSelectedId(video.contentVideoId);
    setForm({
      section: video.section,
      title: video.title,
      youtubeId: video.youtubeId ?? '',
      url: video.url ?? '',
      description: video.description,
      sortOrder: String(video.sortOrder),
      audience: video.audience,
      active: video.active,
    });
    setState('idle');
    setErr(null);
  }

  async function save() {
    setState('saving');
    setErr(null);
    const payload = {
      section: form.section.trim(),
      title: form.title.trim(),
      youtubeId: form.youtubeId.trim() || null,
      url: form.url.trim() || null,
      description: form.description.trim(),
      sortOrder: Number(form.sortOrder),
      audience: form.audience,
      active: form.active,
    };
    const endpoint = selectedId
      ? `/api/admin/content/videos/${selectedId}`
      : '/api/admin/content/videos';
    try {
      const res = await fetch(endpoint, {
        method: selectedId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as McsContentVideoMutationResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ? JSON.stringify(data.error) : 'Save failed.');
        setState('error');
        return;
      }
      await load();
      setSelectedId(data.video.contentVideoId);
      setState('saved');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error.');
      setState('error');
    }
  }

  async function saveOrder(nextVideos: McsContentVideoRecord[]) {
    setErr(null);
    try {
      const res = await fetch('/api/admin/content/videos/reorder', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: nextVideos.map((video, index) => ({
            contentVideoId: video.contentVideoId,
            sortOrder: (index + 1) * 10,
          })),
        }),
      });
      const data = (await res.json()) as McsContentVideoReorderResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ? JSON.stringify(data.error) : 'Reorder failed.');
        return;
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error.');
    }
  }

  function move(video: McsContentVideoRecord, direction: -1 | 1) {
    const sameSection = videos
      .filter((item) => item.section === video.section)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sameSection.findIndex((item) => item.contentVideoId === video.contentVideoId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= sameSection.length) return;
    const next = [...sameSection];
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
    void saveOrder(next);
  }

  return (
    <div className="max-w-7xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
            Admin · Product Gallery
          </p>
          <h1 className="font-display text-[36px] leading-none mb-2">
            Product Gallery Content
          </h1>
          <p className="text-cream-mute text-sm max-w-3xl">
            Load, edit, and reorder the videos shown at /video-library without a redeploy.
          </p>
        </div>
        <Button type="button" variant="primary" size="md" onClick={startCreate}>
          Add Video
        </Button>
      </header>

      {err && <p className="font-mono text-[12px] text-red-400">{err}</p>}
      {loading && <p className="font-mono text-[12px] text-cream-mute">Loading...</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start">
        <section className="border border-line rounded-md bg-ink-2/40 overflow-hidden">
          {sections.length === 0 && !loading ? (
            <p className="text-cream-mute text-sm p-5">
              No Product Gallery content yet. Add the first item or run the seed script.
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.section} className="border-b border-line last:border-b-0">
                <div className="px-4 py-3 bg-cream/[0.03] flex items-center justify-between gap-4">
                  <h2 className="font-display text-[22px] leading-none">
                    {section.section}
                  </h2>
                  <span className="font-mono text-[10px] tracking-label text-cream-faint uppercase">
                    {section.videos.length} items
                  </span>
                </div>
                <table className="w-full text-[12px]">
                  <thead className="border-b border-line text-cream-faint font-mono tracking-label uppercase">
                    <tr>
                      <th className="text-left p-3">Order</th>
                      <th className="text-left p-3">Title</th>
                      <th className="text-left p-3">Audience</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-right p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.videos.map((video) => (
                      <tr key={video.contentVideoId} className="border-b border-line/40 last:border-b-0">
                        <td className="p-3 font-mono text-cream-mute">{video.sortOrder}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => startEdit(video)}
                            className="text-left text-cream hover:text-gold"
                          >
                            {video.title}
                          </button>
                          <p className="text-cream-faint mt-1">
                            {video.youtubeId ?? video.url ?? 'No URL'}
                          </p>
                        </td>
                        <td className="p-3 font-mono text-cream-mute">{video.audience}</td>
                        <td className="p-3 font-mono text-cream-mute">
                          {video.active ? 'active' : 'hidden'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => move(video, -1)}
                            className="font-mono text-[11px] text-cream-mute hover:text-gold mr-3"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => move(video, 1)}
                            className="font-mono text-[11px] text-cream-mute hover:text-gold"
                          >
                            Down
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </section>

        <FormPanel
          form={form}
          selected={selected}
          state={state}
          onChange={setForm}
          onSave={() => void save()}
        />
      </div>
    </div>
  );
}

function FormPanel({
  form,
  selected,
  state,
  onChange,
  onSave,
}: {
  form: FormState;
  selected: McsContentVideoRecord | null;
  state: SaveState;
  onChange: (next: FormState) => void;
  onSave: () => void;
}) {
  const canSave =
    form.section.trim() !== '' &&
    form.title.trim() !== '' &&
    form.description.trim() !== '' &&
    Number.isFinite(Number(form.sortOrder)) &&
    (form.youtubeId.trim() !== '' || form.url.trim() !== '');

  return (
    <section className="border border-line rounded-md p-5 bg-ink-2/40 sticky top-6">
      <p className="font-mono tracking-label text-[10px] text-gold uppercase mb-1">
        {selected ? 'Edit item' : 'Add item'}
      </p>
      <h2 className="font-display text-[24px] leading-none mb-4">
        {selected ? selected.title : 'New Gallery Video'}
      </h2>

      <div className="space-y-3">
        <Field label="Section" value={form.section} onChange={(section) => onChange({ ...form, section })} />
        <Field label="Title" value={form.title} onChange={(title) => onChange({ ...form, title })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="YouTube ID or URL" value={form.youtubeId} onChange={(youtubeId) => onChange({ ...form, youtubeId })} />
          <Field label="Resource URL" value={form.url} onChange={(url) => onChange({ ...form, url })} />
        </div>
        <label className="block">
          <span className="block font-mono tracking-label text-[10px] text-cream-faint uppercase mb-1">
            Description
          </span>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            rows={4}
            className="w-full bg-ink border border-line rounded-md p-3 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sort order" value={form.sortOrder} onChange={(sortOrder) => onChange({ ...form, sortOrder })} />
          <label className="block">
            <span className="block font-mono tracking-label text-[10px] text-cream-faint uppercase mb-1">
              Audience
            </span>
            <select
              value={form.audience}
              onChange={(e) => onChange({ ...form, audience: e.target.value as McsContentVideoAudience })}
              className="w-full bg-ink border border-line rounded-md px-3 h-10 text-sm text-cream focus:outline-none focus:border-gold"
            >
              <option value="both">both</option>
              <option value="member">member</option>
              <option value="prospect">prospect</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-cream-mute">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => onChange({ ...form, active: e.target.checked })}
          />
          Show in Product Gallery
        </label>
        <Button type="button" variant="primary" size="md" onClick={onSave} disabled={!canSave || state === 'saving'}>
          {state === 'saving' ? 'Saving...' : selected ? 'Save changes' : 'Add video'}
        </Button>
        {state === 'saved' && (
          <p className="font-mono text-[12px] text-teal">Saved and triple-stack mirrored.</p>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block font-mono tracking-label text-[10px] text-cream-faint uppercase mb-1">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-ink border border-line rounded-md px-3 h-10 text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold"
      />
    </label>
  );
}

function nextSortOrder(videos: McsContentVideoRecord[]): number {
  return videos.reduce((max, video) => Math.max(max, video.sortOrder), 0) + 10;
}
