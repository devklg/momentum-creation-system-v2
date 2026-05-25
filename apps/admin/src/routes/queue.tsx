/**
 * /queue — Admin Section E · Queue / Recruitment Leg Oversight
 * (wireframe 4.E · ADMIN Design E).
 *
 * Composes the six panels:
 *   • QueueDepthPanel        (E.1) — depth + today's movement
 *   • QueueNumbersPanel      (E.2) — monotonic numbers + position lookup
 *   • VisibleWindowPanel     (E.3) — .com position-stack setting + preview
 *   • GrowthSparkline        (E.4) — rolling 7/30/lifetime + 30-day chart
 *   • AdminTickerPanel       (E.5) — real-name ticker mirror (SSE)
 *   • QueueRulesPanel        (E.6) — managed rules (audited changes)
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  QueueOversightSummary,
  QueueOversightSummaryResponse,
} from '@momentum/shared';
import { QueueDepthPanel } from '@/components/queue-oversight/QueueDepthPanel';
import { QueueNumbersPanel } from '@/components/queue-oversight/QueueNumbersPanel';
import { VisibleWindowPanel } from '@/components/queue-oversight/VisibleWindowPanel';
import { GrowthSparkline } from '@/components/queue-oversight/GrowthSparkline';
import { AdminTickerPanel } from '@/components/queue-oversight/AdminTickerPanel';
import { QueueRulesPanel } from '@/components/queue-oversight/QueueRulesPanel';

export function QueuePage() {
  const [summary, setSummary] = useState<QueueOversightSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/queue/summary', { credentials: 'include' });
      const data = (await res.json()) as QueueOversightSummaryResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load queue summary.');
        return;
      }
      setSummary(data.summary);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <div className="max-w-7xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section E · Queue / Recruitment Leg
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Queue Oversight</h1>
      <p className="text-cream-mute text-sm mb-8 max-w-2xl">
        Team-wide holding tank. Positions are monotonic — flushes vacate
        slots but never renumber. No comp math, no binary leg detail; this
        surface shows TM's overall growth movement only.
      </p>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">
          {err}
        </p>
      )}

      <QueueDepthPanel
        movement={summary?.depthMovement ?? null}
        loading={loading}
        onRefresh={() => void loadSummary()}
      />

      <QueueNumbersPanel
        numbers={summary?.numbers ?? null}
        loading={loading}
      />

      <VisibleWindowPanel initialValue={summary?.visibleWindow ?? null} />

      <GrowthSparkline growth={summary?.growth ?? null} loading={loading} />

      <AdminTickerPanel />

      <QueueRulesPanel />
    </div>
  );
}
