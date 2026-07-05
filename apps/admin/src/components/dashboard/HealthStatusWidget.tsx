import { useEffect, useState } from 'react';

type HealthOverall = 'green' | 'red';

interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
}

interface HealthStatus {
  checkedAt: string;
  overall: HealthOverall;
  checks: HealthCheck[];
}

interface HealthResponse {
  ok: boolean;
  status: HealthStatus | null;
  error?: string;
}

export function HealthStatusWidget() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/health/status', { credentials: 'include' });
        const body = (await res.json()) as HealthResponse;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setData({
            ok: false,
            status: null,
            error: err instanceof Error ? err.message : 'Network error.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const status = data?.status ?? null;
  const red = status?.overall === 'red';
  const failed = status?.checks.filter((c) => !c.ok) ?? [];

  return (
    <section className="border border-line rounded-md mb-6 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-line bg-cream/[0.025]">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">
            Production health
          </p>
          <p className="font-display text-[20px] leading-none mt-0.5">
            VPS probe status
          </p>
        </div>
        <span
          className={[
            'inline-block min-w-[72px] text-center px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
            red
              ? 'text-red-400 border-red-400/30 bg-red-400/[0.06]'
              : status?.overall === 'green'
                ? 'text-teal border-teal/30 bg-teal/[0.08]'
                : 'text-cream-mute border-line bg-cream/[0.025]',
          ].join(' ')}
        >
          {loading && !status ? 'loading' : status?.overall ?? 'unknown'}
        </span>
      </header>

      <div className="px-4 py-3">
        {!data?.ok || !status ? (
          <p className="text-[12px] font-mono text-cream-mute">
            {data?.error ?? 'No health status file has been written yet.'}
          </p>
        ) : (
          <>
            <p className="text-[12px] font-mono text-cream-mute mb-3">
              Last checked {fmt(status.checkedAt)} · {status.checks.length} checks
            </p>
            {failed.length === 0 ? (
              <p className="text-sm text-cream">All production checks are green.</p>
            ) : (
              <ul className="space-y-1">
                {failed.slice(0, 6).map((check) => (
                  <li
                    key={check.name}
                    className="grid grid-cols-[170px_1fr] gap-3 text-[12px] font-mono"
                  >
                    <span className="text-red-400 truncate">{check.name}</span>
                    <span className="text-cream-mute truncate">{check.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
