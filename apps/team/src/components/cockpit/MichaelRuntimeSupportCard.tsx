/**
 * Michael Runtime Support card (Sprint 3 S3.9).
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
 * the request body is `{ turn }` and nothing else.
 *
 * Fixtures-only / non-persistent: the runtime route is a one-call consumer of
 * the inert S2.20 resolution facade. It returns a pre-authored, contract-
 * validated fixture by reference. Nothing is persisted, no LLM is called, no
 * voice path exists, and the redacted trace is NEVER shown to the BA.
 *
 * ── TURN-SOURCE BLOCKER (S3.8) — why the live call is intentionally NOT wired ──
 * There is currently NO client-safe producer of a valid `runtimeTurn`. A valid
 * 200 came ONLY from a test-only fixture harness; a hand-authored/flat turn
 * yields 422 (contract validation failure). Per the S3.9 Critical Data Contract
 * Rule (option 2), the UI MUST NOT fabricate a Context Packet or turn. So this
 * card renders the DISABLED / PLACEHOLDER state by default and does NOT
 * auto-invoke a live resolve with a synthesized turn. The typed client helper
 * `resolveMichaelRuntimeTurn` below is implemented and ready for a future
 * SERVER-OWNED turn source — until that exists, it is deliberately left
 * un-invoked (referenced only for type/export coverage).
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

// ── Client helper (server-owned turn source pending) ─────────────────────────

/**
 * POST a runtime turn to the resolve route and map every status to a typed,
 * leak-free `MichaelRuntimeResult`.
 *
 * The request body is `{ turn }` ONLY. It NEVER includes baId / sponsorBaId /
 * targetBaId / downlineBaId / prospectId / token / sessionId / correlationId —
 * BA scope is session-derived server-side. This helper reads only the safe
 * subset of a 200 response: it never reads or stores `trace`, IDs, safety, or
 * persistence internals, never writes localStorage / sessionStorage /
 * IndexedDB, and emits no analytics.
 *
 * NOTE (turn-source blocker): there is no client-safe producer of a valid
 * `runtimeTurn` yet, so this helper is intentionally NOT called on mount with a
 * fabricated turn. It exists for a future server-owned turn source.
 */
export async function resolveMichaelRuntimeTurn(
  turn: unknown,
): Promise<MichaelRuntimeResult> {
  let res: Response;
  try {
    res = await fetch('/api/michael-runtime/resolve', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      // Body is `{ turn }` and nothing else — no BA-authority / id fields.
      body: JSON.stringify({ turn }),
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

  // 400 (MISSING_RUNTIME_TURN / BODY_BA_SCOPE_NOT_ALLOWED), 401, 403
  // (STEVE_GATE_CLOSED), 422 (contract failure) and any other non-200 → generic
  // error. We never surface codes / issues / reasons to the BA.
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
 * Read-only card. Default (and only) state today is the disabled / placeholder
 * variant: the runtime route is default-off AND there is no client-safe turn
 * source, so we never auto-invoke `resolveMichaelRuntimeTurn` with a fabricated
 * turn. The `renderRuntimeResult` switch below is wired to handle every state
 * for the future server-owned turn source.
 */
export function MichaelRuntimeSupportCard() {
  // No fetch on mount — turn-source blocker (see file header). The card is a
  // calm placeholder until a server-owned turn source exists.
  const result: MichaelRuntimeResult = { kind: 'disabled' };

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
      // Route off (and no client-safe turn source yet) — the honest, calm
      // placeholder a BA sees today.
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
