/**
 * Michael Runtime Support card (Sprint 3 S3.9 → S3.11 wiring).
 *
 * Read-only, `.team`-only cockpit card that surfaces Michael's runtime
 * *training guidance* to the signed-in Brand Ambassador. Michael is BA-facing
 * support only — never a prospect-facing surface, never an automated actor. The
 * card frames Michael as a "next training step" guide, never as something that
 * sends, calls, schedules, or prospects on the BA's behalf.
 *
 * BA scope is enforced SERVER-SIDE. POST /api/michael-runtime/resolve derives
 * the BA from req.session.baId and rejects any body-supplied BA authority
 * (sponsor immutability, locked-spec 3.5). This component never sends a BA id —
 * the request body carries at most `{ language }` and nothing else.
 *
 * Fixtures-only / non-persistent: the runtime route is a one-call consumer of
 * the inert S2.20 resolution facade. It returns a pre-authored, contract-
 * validated fixture by reference. Nothing is persisted, no LLM is called, no
 * voice path exists, and the redacted trace is NEVER shown to the BA.
 *
 * ── TURN-SOURCE BLOCKER (S3.9) — RESOLVED ────────────────────────────────────
 * S3.9 left a client-safe turn-source blocker: there was NO client-safe producer
 * of a valid `runtimeTurn`, so the UI could not call resolve without fabricating
 * a Context Packet / turn (forbidden by the S3.9 Critical Data Contract Rule).
 * The S3.10 server-owned turn source RESOLVES this: the server now owns and
 * produces the runtime turn entirely. The client sends NO turn, NO Context
 * Packet, and NO BA authority — at most an optional UI language hint. This S3.11
 * wiring therefore safely calls the route LIVE on mount.
 *
 * The card remains read-only and inert. Behind the default-off kill switch the
 * route returns 503 michael_runtime_disabled, so the card shows the calm
 * disabled state driven by the REAL endpoint until Kevin enables the flags.
 * When route + response are enabled it renders the server's degraded
 * safe_fallback (and other) fixtures. trace / IDs / counters / Context-Packet
 * are NEVER read or rendered.
 *
 * Compliance: no income / placement / cycle / comp language; no IDs, tokens,
 * PII, counters, persistence internals, safety internals, nextStep boolean
 * flags, or trace are ever rendered. BA-language read-back only.
 *
 * Per .team convention (cockpit.tsx, MichaelTrainingSupportCard.tsx): wire
 * shapes are declared LOCALLY rather than imported from @momentum/shared — the
 * shared `src` alias is outside this app's rootDir and trips TS6059
 * (lesson_team_app_cannot_import_shared_types_ts6059_chat120).
 */

import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';

// ── Safe render subset ───────────────────────────────────────────────────────
// Only the fields a BA is allowed to see. The server response carries far more
// (sessionId, turnId, correlationId, contextPacketId, safety, persistence,
// nextStep boolean flags, trace, …) — none of it is mapped into this shape.

type MichaelRuntimeResponseType =
  | 'next_training_step'
  | 'clarification_question'
  | 'safe_fallback'
  | 'safe_close';

/** Safe subset of `response.nextStep` (display strings only — never the
 *  baOwned / automaticSending / automaticCalling / externalSideEffect flags). */
interface MichaelRuntimeNextStepSafe {
  title?: string;
  instruction?: string;
  label?: string;
}

/** Safe subset of a successful runtime `response`. */
interface MichaelRuntimeSuccessSafe {
  text: string;
  responseType: MichaelRuntimeResponseType;
  language: string;
  nextStep?: MichaelRuntimeNextStepSafe;
}

/**
 * Discriminated result of a runtime resolve. Deliberately leaks nothing on the
 * error / disabled paths — no status codes, reason strings, or server internals
 * reach the BA-facing render.
 */
export type MichaelRuntimeResult =
  | { kind: 'disabled' } // route kill switch — michael_runtime_disabled
  | { kind: 'response_disabled' } // response kill switch — michael_runtime_response_disabled
  | { kind: 'loading' }
  | { kind: 'success'; data: MichaelRuntimeSuccessSafe }
  | { kind: 'safe_fallback'; text: string }
  | { kind: 'safe_close'; text: string }
  | { kind: 'error' }; // generic — no internals surfaced

// ── Client helper (server-owned turn source) ─────────────────────────────────

/**
 * Ask the server-owned resolve route for the next training step and map every
 * status to a typed, leak-free `MichaelRuntimeResult`.
 *
 * The server owns the runtime turn entirely (S3.10). This helper sends ONLY an
 * optional `{ language }` UI hint — and an empty body `{}` when no hint is
 * given. It NEVER sends turn / runtimeTurn / contextPacket / baId / sponsorBaId
 * / targetBaId / downlineBaId / prospectId / token / sessionId / turnId /
 * correlationId or any other BA-authority or id field. It reads only the safe
 * subset of a 200 response: it never reads or stores `trace`, IDs, safety, or
 * persistence internals, never writes localStorage / sessionStorage /
 * IndexedDB, and emits no analytics.
 */
export async function resolveMichaelRuntimeTrainingStep(opts?: {
  language?: 'en' | 'es';
}): Promise<MichaelRuntimeResult> {
  // Body is an optional UI language hint ONLY — `{}` when absent. No turn, no
  // Context Packet, no BA-authority / id fields ever.
  const body = opts?.language ? { language: opts.language } : {};

  let res: Response;
  try {
    res = await fetch('/api/michael-runtime/resolve', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: 'error' };
  }

  // 503 carries a kill-switch reason; everything else collapses to a generic
  // error so no server internal (code, issues, message) reaches the BA.
  if (res.status === 503) {
    let reason: unknown;
    try {
      reason = ((await res.json()) as { reason?: unknown }).reason;
    } catch {
      return { kind: 'error' };
    }
    if (reason === 'michael_runtime_disabled') return { kind: 'disabled' };
    if (reason === 'michael_runtime_response_disabled') {
      return { kind: 'response_disabled' };
    }
    return { kind: 'error' };
  }

  // 400 (CLIENT_RUNTIME_INPUT_NOT_ALLOWED / other), 401, 403 (STEVE_GATE_CLOSED),
  // 422 (contract failure) and any other non-200 → generic error. We never
  // surface codes / issues / reasons to the BA.
  if (res.status !== 200) {
    return { kind: 'error' };
  }

  let payload: { ok?: boolean; response?: unknown };
  try {
    payload = (await res.json()) as { ok?: boolean; response?: unknown };
  } catch {
    return { kind: 'error' };
  }

  const response = payload.response;
  if (!payload.ok || !response || typeof response !== 'object') {
    return { kind: 'error' };
  }

  // Extract ONLY the safe fields. Everything else on `response` (sessionId,
  // turnId, correlationId, contextPacketId, safety, persistence, the nextStep
  // boolean flags, generatedAt, agentResponseGenerated, …) is ignored. `trace`
  // lives at payload top-level and is never read here.
  const r = response as {
    responseType?: unknown;
    text?: unknown;
    language?: unknown;
    nextStep?: unknown;
  };

  const responseType = r.responseType;
  const text = typeof r.text === 'string' ? r.text : '';
  const language = typeof r.language === 'string' ? r.language : 'en';

  if (responseType === 'safe_fallback') {
    return { kind: 'safe_fallback', text };
  }
  if (responseType === 'safe_close') {
    return { kind: 'safe_close', text };
  }
  if (
    responseType === 'next_training_step' ||
    responseType === 'clarification_question'
  ) {
    const nextStep = extractSafeNextStep(r.nextStep);
    return {
      kind: 'success',
      data: {
        text,
        responseType,
        language,
        ...(nextStep ? { nextStep } : {}),
      },
    };
  }

  // Unknown / unexpected discriminator — fail closed to a generic error rather
  // than rendering something unvetted.
  return { kind: 'error' };
}

/** Pull only the display strings from `response.nextStep`; drop every boolean
 *  flag (baOwned / automaticSending / automaticCalling / externalSideEffect). */
function extractSafeNextStep(
  raw: unknown,
): MichaelRuntimeNextStepSafe | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ns = raw as { title?: unknown; instruction?: unknown; label?: unknown };
  const safe: MichaelRuntimeNextStepSafe = {};
  if (typeof ns.title === 'string') safe.title = ns.title;
  if (typeof ns.instruction === 'string') safe.instruction = ns.instruction;
  if (typeof ns.label === 'string') safe.label = ns.label;
  return Object.keys(safe).length > 0 ? safe : undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Read-only card. On mount it calls the server-owned resolve route ONCE (no
 * turn, no Context Packet, no BA authority — at most a language hint). With the
 * flags off (default) the route answers 503 michael_runtime_disabled and the
 * card shows the calm disabled state driven by the REAL endpoint. When Kevin
 * enables route + response, it renders the server's degraded safe_fallback (and
 * other) fixtures. The render stays read-only and leak-free in every state.
 */
export function MichaelRuntimeSupportCard() {
  const [result, setResult] = useState<MichaelRuntimeResult>({
    kind: 'loading',
  });
  // Bump to re-run the resolve (manual "try again" affordance, read-only).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Live call to the server-owned route — safe because the client fabricates
    // nothing and the default-off kill switch protects it.
    void resolveMichaelRuntimeTrainingStep().then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <section
      aria-label="Michael runtime training support"
      className="bg-cream/[0.02] border border-gold/25 rounded-md p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gold/30 bg-gold/[0.06] text-gold"
        >
          <Bot className="h-4 w-4" />
        </span>
        <h3 className="font-mono tracking-[0.18em] text-[11px] text-cream-mute uppercase">
          Michael · Training Support
        </h3>
      </div>
      {renderRuntimeResult(result)}
      {result.kind === 'error' && (
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-3 font-mono tracking-[0.12em] text-[10px] text-gold uppercase underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Try again
        </button>
      )}
    </section>
  );
}

// ── State rendering ──────────────────────────────────────────────────────────

function renderRuntimeResult(result: MichaelRuntimeResult) {
  switch (result.kind) {
    case 'loading':
      return (
        <p className="text-cream-mute text-[13px] leading-[1.5]">
          Bringing up your next training step…
        </p>
      );

    case 'disabled':
      // Route off — the honest, calm placeholder a BA sees today, now driven by
      // the real endpoint's default-off kill switch.
      return (
        <div className="space-y-2">
          <p className="text-cream-mute text-[13px] leading-[1.5]">
            Michael is your training guide. When it&rsquo;s switched on, this is
            where your next suggested training step shows up — a calm pointer to
            what to learn or practice next.
          </p>
          <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase">
            Not available yet
          </p>
        </div>
      );

    case 'response_disabled':
      return (
        <p className="text-cream-mute text-[13px] leading-[1.5]">
          Michael is on, but training guidance is paused right now. Check back a
          little later for your next suggested step.
        </p>
      );

    case 'safe_fallback':
      return (
        <p className="text-cream-mute text-[13px] leading-[1.5]">
          {result.text ||
            'No specific step to suggest right now — keep working your usual training rhythm.'}
        </p>
      );

    case 'safe_close':
      return (
        <p className="text-cream-mute text-[13px] leading-[1.5]">
          {result.text ||
            'Nothing more to add for now. You&rsquo;re good to keep going.'}
        </p>
      );

    case 'success': {
      const { text, language, nextStep } = result.data;
      return (
        <div className="space-y-3">
          {text && (
            <p className="text-cream-mute text-[13px] leading-[1.5]">{text}</p>
          )}
          {nextStep && (nextStep.title || nextStep.instruction) && (
            <div className="border-l border-gold/30 pl-4">
              <p className="font-mono tracking-[0.12em] text-[10px] text-gold uppercase mb-1">
                Your next step
              </p>
              {nextStep.title && (
                <p className="font-display text-[16px] text-cream leading-tight">
                  {nextStep.title}
                </p>
              )}
              {nextStep.instruction && (
                <p className="text-cream-mute text-[13px] leading-[1.5] mt-1">
                  {nextStep.instruction}
                </p>
              )}
              {nextStep.label && (
                <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mt-2">
                  {nextStep.label}
                </p>
              )}
            </div>
          )}
          <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase">
            Guidance · {language}
          </p>
        </div>
      );
    }

    case 'error':
      return (
        <p className="text-cream-mute text-[13px] leading-[1.5]">
          Couldn&rsquo;t load a training step just now. Nothing&rsquo;s wrong on
          your end — try again a little later.
        </p>
      );

    default:
      // Exhaustiveness guard — every MichaelRuntimeResult kind is handled above.
      return null as never;
  }
}
