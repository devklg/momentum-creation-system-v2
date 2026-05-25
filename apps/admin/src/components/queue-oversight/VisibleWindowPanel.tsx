/**
 * E.3 — Visible window on .com.
 *
 * The number of position cards that render on the .com prospect dashboard's
 * position stack. Default 10; selector is 5 / 10 / 20. Persists server-side
 * (admin_settings collection); the .com surface reads the same value at
 * page render (integration contract — see claude-notes-admin-e.md).
 *
 * Includes a sandboxed preview against the current queue state — reuses
 * the same /api/admin/queue/ticker endpoint to show "what Kevin's setting
 * looks like right now."
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  AdminTickerEntry,
  QueueAdminTickerResponse,
  QueueVisibleWindow,
  QueueVisibleWindowResponse,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';

interface Props {
  initialValue: QueueVisibleWindow | null;
}

const CHOICES: ReadonlyArray<QueueVisibleWindow> = [5, 10, 20];

export function VisibleWindowPanel({ initialValue }: Props) {
  const [value, setValue] = useState<QueueVisibleWindow | null>(initialValue);
  const [draft, setDraft] = useState<QueueVisibleWindow | null>(initialValue);
  const [reason, setReason] = useState('');
  const [lastChangedAt, setLastChangedAt] = useState<string | null>(null);
  const [lastChangedBy, setLastChangedBy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState<string | null>(null);

  // If the parent passed a value, sync it once.
  useEffect(() => {
    if (initialValue && value === null) {
      setValue(initialValue);
      setDraft(initialValue);
    }
  }, [initialValue, value]);

  // Independent fetch for changedAt/By metadata (summary endpoint omits these).
  const loadSetting = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/queue/visible-window', {
        credentials: 'include',
      });
      const data = (await res.json()) as QueueVisibleWindowResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load setting.');
        return;
      }
      setValue(data.value);
      setDraft(data.value);
      setLastChangedAt(data.lastChangedAt);
      setLastChangedBy(data.lastChangedBy);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    }
  }, []);

  useEffect(() => {
    void loadSetting();
  }, [loadSetting]);

  async function onSave() {
    if (!draft || draft === value) return;
    setSaving(true);
    setErr(null);
    setOkFlash(null);
    try {
      const res = await fetch('/api/admin/queue/visible-window', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: draft,
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as QueueVisibleWindowResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Update failed.');
        return;
      }
      setValue(data.value);
      setDraft(data.value);
      setLastChangedAt(data.lastChangedAt);
      setLastChangedBy(data.lastChangedBy);
      setReason('');
      setOkFlash(`Saved · .com will render ${data.value} cards on next load.`);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  const dirty = draft !== null && draft !== value;

  return (
    <section className="mb-10">
      <header className="mb-3">
        <h2 className="font-display text-[22px] leading-none">
          E.3 · Visible window on .com
        </h2>
        <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase mt-1">
          Position-stack card count on the prospect dashboard
        </p>
      </header>

      <div className="bg-ink-2 border border-line rounded-md p-4 mb-4">
        <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-3">
          Setting
        </p>
        <div className="flex gap-2 mb-4">
          {CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDraft(c)}
              className={[
                'px-5 py-2.5 font-mono text-sm rounded border transition-colors',
                draft === c
                  ? 'bg-gold/[0.08] border-gold text-gold'
                  : 'bg-ink border-line text-cream-mute hover:text-cream',
              ].join(' ')}
            >
              {c}
            </button>
          ))}
          <div className="flex-1" />
          {value !== null && (
            <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase self-end">
              current · {value}
              {value === 10 ? ' (default)' : ''}
            </p>
          )}
        </div>

        {dirty && (
          <div className="border-t border-line pt-3">
            <label className="block">
              <span className="text-[10px] font-mono tracking-label text-cream-faint uppercase block mb-1">
                Reason (optional, audited)
              </span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. testing tighter focus during Q3"
                className="w-full bg-ink border border-line rounded px-2 py-1.5 text-sm text-cream font-mono mb-3"
              />
            </label>
            <div className="flex gap-2">
              <Button onClick={() => void onSave()} disabled={saving}>
                {saving ? 'Saving…' : `Save · set to ${draft}`}
              </Button>
              <Button variant="outline" onClick={() => setDraft(value)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {lastChangedAt && (
          <p className="text-[11px] font-mono text-cream-faint mt-3">
            last changed {new Date(lastChangedAt).toLocaleString()} by {lastChangedBy ?? '—'}
          </p>
        )}

        {err && (
          <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mt-3">
            {err}
          </p>
        )}
        {okFlash && (
          <p className="text-[13px] font-mono tracking-[0.04em] text-teal mt-3">
            {okFlash}
          </p>
        )}
      </div>

      <SandboxPreview windowSize={value ?? 10} />
    </section>
  );
}

function SandboxPreview({ windowSize }: { windowSize: QueueVisibleWindow }) {
  const [entries, setEntries] = useState<AdminTickerEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/queue/ticker?limit=${windowSize}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as QueueAdminTickerResponse & { error?: string };
        if (cancelled) return;
        if (!data.ok) {
          setErr(data.error ?? 'Preview failed.');
          return;
        }
        setEntries(data.entries.slice(0, windowSize));
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowSize]);

  return (
    <div className="bg-ink-2 border border-line rounded-md p-4">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Preview · what the .com position stack looks like with {windowSize} cards
      </p>
      <p className="text-[11px] font-mono text-cream-faint mb-4">
        Sandboxed · shows real ticker entries with .com anonymization (first
        name + last initial · city, state).
      </p>
      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">{err}</p>
      )}
      {entries === null ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          Loading…
        </p>
      ) : entries.length === 0 ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          No placements yet.
        </p>
      ) : (
        <ol className="space-y-1">
          {entries.map((e) => (
            <li
              key={`${e.positionNumber}_${e.placedAt}`}
              className="flex justify-between items-baseline border-l-2 border-line pl-3 py-1"
            >
              <span className="font-mono text-cream">
                #{e.positionNumber.toLocaleString()}
              </span>
              <span className="text-cream-mute text-sm">
                {e.firstName} {e.lastName.charAt(0).toUpperCase()}
                {e.lastName ? '.' : ''}
                {e.city || e.stateOrRegion
                  ? ` · ${[e.city, e.stateOrRegion].filter(Boolean).join(', ')}`
                  : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
