/**
 * Michael Runtime Health & Debugger panel — admin-only, read-only.
 *
 * Surfaces the in-process Michael runtime observability snapshot from
 * `GET /api/admin/michael-runtime/observability` (S3.6): the three evaluated
 * kill-switch flags plus six monotonic, process-lifetime aggregate counters.
 *
 * This panel is Kevin-only (the route is gated by requireAdmin / ADMIN_BA_IDS)
 * and never appears on `.com`. It is a pure read: it issues a GET, renders the
 * aggregates, and offers a manual Refresh. It NEVER writes, persists, sends,
 * schedules, scores, or ranks anything. The snapshot carries no PII, tokens,
 * IDs, request/response bodies, traces, or Context Packets — only booleans and
 * integer counts — so nothing sensitive can reach the DOM.
 *
 * Wire types are declared locally rather than imported from @momentum/shared,
 * matching the apps convention for cross-workspace type isolation.
 */

import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

// ── Wire shape (mirrors the server snapshot; aggregate-only) ──────────────────

interface MichaelRuntimeCounters {
  routeDisabledSkips: number;
  responseDisabledSkips: number;
  successfulFacadeResolutions: number;
  facadeFailures: number;
  bodyBaOverrideRejections: number;
  missingTurnRejections: number;
}

interface MichaelRuntimeObservabilitySnapshot {
  routeEnabled: boolean;
  responseEnabled: boolean;
  traceEnabled: boolean;
  counters: MichaelRuntimeCounters;
}

export interface MichaelRuntimeHealth {
  state: 'available' | 'dormant' | 'attention';
  label: string;
  detail: string;
}

/** Discriminated fetch result. The error / unauthorized paths leak no server
 *  internals (status codes, reasons) into the render. */
export type MichaelRuntimeObservabilityResult =
  | { kind: 'loading' }
  | { kind: 'ok'; snapshot: MichaelRuntimeObservabilitySnapshot }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

const COUNTER_FIELDS: ReadonlyArray<keyof MichaelRuntimeCounters> = [
  'routeDisabledSkips',
  'responseDisabledSkips',
  'successfulFacadeResolutions',
  'facadeFailures',
  'bodyBaOverrideRejections',
  'missingTurnRejections',
];

const COUNTER_LABELS: Record<keyof MichaelRuntimeCounters, string> = {
  routeDisabledSkips: 'Route-disabled skips',
  responseDisabledSkips: 'Response-disabled skips',
  successfulFacadeResolutions: 'Successful resolutions',
  facadeFailures: 'Facade failures',
  bodyBaOverrideRejections: 'Body BA-override rejections',
  missingTurnRejections: 'Missing-turn rejections',
};

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Interpret the two delivery kill switches without guessing from lifetime
 * counters. Matching switches are an intentional state; a mismatch is the only
 * configuration condition that needs admin attention.
 */
export function deriveMichaelRuntimeHealth(
  snapshot: Pick<MichaelRuntimeObservabilitySnapshot, 'routeEnabled' | 'responseEnabled'>,
): MichaelRuntimeHealth {
  if (snapshot.routeEnabled && snapshot.responseEnabled) {
    return {
      state: 'available',
      label: 'Available',
      detail: 'The route and generated responses are enabled.',
    };
  }

  if (!snapshot.routeEnabled && !snapshot.responseEnabled) {
    return {
      state: 'dormant',
      label: 'Dormant by configuration',
      detail: 'The route and generated responses are both disabled.',
    };
  }

  return snapshot.routeEnabled
    ? {
        state: 'attention',
        label: 'Configuration mismatch',
        detail: 'The route is enabled while generated responses are disabled.',
      }
    : {
        state: 'attention',
        label: 'Configuration mismatch',
        detail: 'Generated responses are enabled while the route is disabled.',
      };
}

// ── Client helper ─────────────────────────────────────────────────────────────

/**
 * GET the admin observability snapshot and map every status to a typed result.
 * Read-only: no body, no mutation, no storage writes, no analytics. 401/403 →
 * `unauthorized`; any other non-200, network error, parse failure, or malformed
 * shape → generic `error`.
 */
export async function fetchMichaelRuntimeObservability(): Promise<MichaelRuntimeObservabilityResult> {
  let res: Response;
  try {
    res = await fetch('/api/admin/michael-runtime/observability', {
      credentials: 'include',
    });
  } catch {
    return { kind: 'error' };
  }

  if (res.status === 401 || res.status === 403) {
    return { kind: 'unauthorized' };
  }
  if (res.status !== 200) {
    return { kind: 'error' };
  }

  let payload: { ok?: unknown; michaelRuntime?: unknown };
  try {
    payload = (await res.json()) as { ok?: unknown; michaelRuntime?: unknown };
  } catch {
    return { kind: 'error' };
  }

  const mr = payload.michaelRuntime;
  if (payload.ok !== true || !mr || typeof mr !== 'object') {
    return { kind: 'error' };
  }

  const raw = mr as {
    routeEnabled?: unknown;
    responseEnabled?: unknown;
    traceEnabled?: unknown;
    counters?: unknown;
  };
  if (
    typeof raw.routeEnabled !== 'boolean' ||
    typeof raw.responseEnabled !== 'boolean' ||
    typeof raw.traceEnabled !== 'boolean' ||
    !raw.counters ||
    typeof raw.counters !== 'object'
  ) {
    return { kind: 'error' };
  }

  const rc = raw.counters as Record<string, unknown>;
  const counters = {} as MichaelRuntimeCounters;
  for (const field of COUNTER_FIELDS) {
    counters[field] = asCount(rc[field]);
  }

  return {
    kind: 'ok',
    snapshot: {
      routeEnabled: raw.routeEnabled,
      responseEnabled: raw.responseEnabled,
      traceEnabled: raw.traceEnabled,
      counters,
    },
  };
}

// ── Presentational bits ───────────────────────────────────────────────────────

function FlagChip({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between border border-line rounded px-3 py-2">
      <span className="text-cream-mute text-sm">{label}</span>
      <span
        className={
          on
            ? 'font-mono text-[11px] uppercase tracking-[0.14em] text-gold'
            : 'font-mono text-[11px] uppercase tracking-[0.14em] text-cream-faint'
        }
      >
        {on ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}

function CounterCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line rounded px-3 py-2">
      <p className="font-mono text-[22px] leading-none text-cream tabular-nums">{value}</p>
      <p className="text-cream-faint text-[11px] mt-1">{label}</p>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Read-only health and debugger panel. Fetches the snapshot on mount and on manual
 * Refresh. Every state (loading / ok / unauthorized / error) renders leak-free.
 */
export function MichaelRuntimeObservabilityPanel() {
  const [result, setResult] = useState<MichaelRuntimeObservabilityResult>({ kind: 'loading' });

  const load = useCallback(() => {
    let cancelled = false;
    setResult({ kind: 'loading' });
    void fetchMichaelRuntimeObservability().then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <section
      aria-label="Michael runtime health and debugger"
      className="bg-ink/40 border border-line rounded-md p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gold/30 bg-gold/[0.06] text-gold"
          >
            <Activity className="h-4 w-4" />
          </span>
          <h3 className="font-mono tracking-[0.18em] text-[11px] text-cream-mute uppercase">
            Michael · Runtime Health &amp; Debugger
          </h3>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="font-mono tracking-[0.12em] text-[10px] text-gold uppercase underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Refresh
        </button>
      </div>

      {renderObservability(result)}

      <p className="text-cream-faint text-[11px] mt-4">
        In-memory diagnostics · counts reset on server restart · no PII or IDs.
      </p>
    </section>
  );
}

function renderObservability(result: MichaelRuntimeObservabilityResult) {
  switch (result.kind) {
    case 'loading':
      return <p className="text-cream-mute text-sm">Loading runtime observability…</p>;

    case 'unauthorized':
      return <p className="text-cream-mute text-sm">Admin access is required to view this.</p>;

    case 'error':
      return (
        <p className="text-red-400 text-sm">
          Couldn&rsquo;t load runtime observability. Try Refresh in a moment.
        </p>
      );

    case 'ok': {
      const { routeEnabled, responseEnabled, traceEnabled, counters } = result.snapshot;
      const health = deriveMichaelRuntimeHealth(result.snapshot);
      const healthTone =
        health.state === 'available'
          ? 'border-teal/40 bg-teal/[0.04] text-teal'
          : health.state === 'attention'
            ? 'border-red-400/40 bg-red-400/[0.04] text-red-300'
            : 'border-line bg-cream/[0.025] text-cream-mute';
      return (
        <div className="space-y-4">
          <div
            role="status"
            aria-label={`Michael runtime health: ${health.label}`}
            className={`border rounded px-4 py-3 ${healthTone}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em]">
                Runtime health · {health.label}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em]">
                Trace diagnostics {traceEnabled ? 'enabled' : 'disabled'}
              </p>
            </div>
            <p className="mt-2 text-xs text-cream-mute">{health.detail}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <FlagChip label="Route" on={routeEnabled} />
            <FlagChip label="Response" on={responseEnabled} />
            <FlagChip label="Trace" on={traceEnabled} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {COUNTER_FIELDS.map((field) => (
              <CounterCell key={field} label={COUNTER_LABELS[field]} value={counters[field]} />
            ))}
          </div>
        </div>
      );
    }

    default:
      // Exhaustiveness guard — every result kind is handled above.
      return null as never;
  }
}
