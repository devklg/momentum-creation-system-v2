/**
 * E.2 — Fixed assigned queue numbers + position lookup.
 *
 * Monotonic; timestamps anchor positions at video_complete; flushes
 * vacate slots but never renumber. Position-lookup deep-links to
 * Agent D's prospect detail panel via /prospects?prospectId=<id>.
 */

import { useState, type FormEvent } from 'react';
import type {
  QueueLookupResponse,
  QueueLookupResult,
  QueueNumbers,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  numbers: QueueNumbers | null;
  loading: boolean;
}

export function QueueNumbersPanel({ numbers, loading }: Props) {
  return (
    <section className="mb-10">
      <header className="mb-3">
        <h2 className="font-display text-[22px] leading-none">
          E.2 · Fixed assigned queue numbers
        </h2>
        <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase mt-1">
          Monotonic · timestamp-anchored at video_complete · never reshuffled
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <NumberStat label="Highest today" value={numbers?.highestToday} loading={loading} />
        <NumberStat
          label="Highest ever (lifetime)"
          value={numbers?.highestEver}
          loading={loading}
          accent="gold"
        />
        <NumberStat label="Vacant slots" value={numbers?.vacantSlots} loading={loading} />
      </div>

      <LookupForm />
    </section>
  );
}

function NumberStat({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  accent?: 'gold';
}) {
  return (
    <div className="bg-ink-2 border border-line rounded-md px-4 py-3">
      <p className="text-[10px] font-mono tracking-label text-cream-faint uppercase mb-1">
        {label}
      </p>
      <p
        className={[
          'font-display text-[32px] leading-none',
          accent === 'gold' ? 'text-gold' : 'text-cream',
        ].join(' ')}
      >
        {loading ? '…' : typeof value === 'number' ? value.toLocaleString() : '—'}
      </p>
    </div>
  );
}

function LookupForm() {
  const [position, setPosition] = useState('');
  const [result, setResult] = useState<QueueLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(position, 10);
    if (!Number.isFinite(n) || n < 1) {
      setErr('Enter a positive position number.');
      setResult(null);
      return;
    }
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/queue/lookup?position=${n}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as QueueLookupResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Lookup failed.');
        return;
      }
      setResult(data.result);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-ink-2 border border-line rounded-md p-4">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Position lookup
      </p>
      <form onSubmit={onSubmit} className="flex gap-2 items-end mb-3">
        <div className="flex-1 max-w-[200px]">
          <Input
            inputMode="numeric"
            placeholder="e.g. 347"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Looking up…' : 'Look up'}
        </Button>
      </form>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">{err}</p>
      )}

      {result && <LookupResultView result={result} />}
    </div>
  );
}

function LookupResultView({ result }: { result: QueueLookupResult }) {
  if (!result.found && !result.vacant) {
    return (
      <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
        #{result.position} · not minted yet
      </p>
    );
  }

  if (result.vacant && result.prospect) {
    return (
      <div className="border-t border-line pt-3 mt-1">
        <p className="font-mono text-[11px] tracking-label uppercase text-cream-faint mb-1">
          #{result.position} · vacant · flushed
        </p>
        <p className="text-cream mb-1">
          {result.prospect.firstName} {result.prospect.lastName}
        </p>
        <p className="text-[12px] font-mono text-cream-mute">
          reason: {result.prospect.flushReason ?? 'unknown'} · flushed{' '}
          {result.prospect.flushedAt
            ? new Date(result.prospect.flushedAt).toLocaleString()
            : '—'}
        </p>
        <a
          href={result.prospect.deepLink}
          className="text-[11px] font-mono uppercase tracking-label text-gold hover:underline mt-2 inline-block"
        >
          Open prospect detail →
        </a>
      </div>
    );
  }

  if (result.found && result.prospect) {
    const p = result.prospect;
    return (
      <div className="border-t border-line pt-3 mt-1">
        <p className="font-mono text-[11px] tracking-label uppercase text-cream-faint mb-1">
          #{result.position} · {p.state}
        </p>
        <p className="text-cream mb-1">
          {p.firstName} {p.lastName}
          {p.city || p.stateOrRegion ? (
            <span className="text-cream-mute">
              {' · '}
              {[p.city, p.stateOrRegion].filter(Boolean).join(', ')}
            </span>
          ) : null}
        </p>
        <p className="text-[12px] font-mono text-cream-mute">
          placed {new Date(p.placedAt).toLocaleString()} · sponsor {p.sponsorBaId}
        </p>
        <a
          href={p.deepLink}
          className="text-[11px] font-mono uppercase tracking-label text-gold hover:underline mt-2 inline-block"
        >
          Open prospect detail →
        </a>
      </div>
    );
  }

  return null;
}
