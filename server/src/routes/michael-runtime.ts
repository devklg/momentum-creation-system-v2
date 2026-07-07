/**
 * POST /api/michael-runtime/resolve — Sprint 3 S3.11 server-owned Michael runtime route.
 *
 * The FIRST runtime-facing Michael route. It is `.team`-only, authenticated,
 * BA-scoped, fixtures-only, non-persistent, LLM-free, voice-free, and
 * fail-closed behind a three-axis kill switch (route / response / trace).
 *
 * SERVER-OWNED TURN CONTRACT (S3.11): the runtime turn is built entirely
 * server-side from the authenticated session — the client NO LONGER supplies a
 * `body.turn`. The request body must be server-owned: the ONLY accepted fields
 * are optional `language` ('en' | 'es') and optional `ask` (a short BA-owned
 * training/support question). Any other key — or malformed allowed values — is
 * rejected with 400 `CLIENT_RUNTIME_INPUT_NOT_ALLOWED`. This merges the old
 * body-BA-scope rejection (`tmagId`/`sponsorTmagId`/`targetTmagId`) into one
 * broader rule. A valid client request is `{}`, `{ "language": "en" | "es" }`,
 * `{ "ask": "..." }`, or both.
 *
 * The turn is produced by the S3.10 server-owned turn source
 * (`createMichaelRuntimeTurnForAuthenticatedBa`), which derives BA scope from the
 * session alone and delegates packet assembly to the sanctioned context layer
 * (degraded, fail-closed). The resulting adapter input is then resolved by the
 * S2.20 inert facade (`resolveMichaelRuntimeTurnResponse`), which returns a
 * pre-authored, contract-validated fixture BY REFERENCE plus a redacted trace.
 * The route NEVER generates text, calls an LLM, persists anything, assembles a
 * Context Packet itself, touches a store/PERSISTENCE/retrieval helper, or imports the
 * S2.13 test-only harness.
 *
 * Sponsor immutability (locked-spec 3.5): BA scope comes from req.session.tmagId,
 * never the request body. Body-supplied runtime input (incl. BA authority) is
 * rejected before any work.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  createMichaelRuntimeTurnForAuthenticatedBa,
  resolveMichaelRuntimeTurnResponse,
} from '../runtime/orchestration/index.js';
import type { MichaelRuntimeAdapterContractInput } from '../runtime/orchestration/index.js';
import {
  michaelRuntimeResponseEnabled,
  michaelRuntimeRouteEnabled,
  michaelRuntimeTraceEnabled,
} from '../config/michaelRuntimeFlags.js';
import {
  recordMichaelRuntimeBodyBaOverrideRejection,
  recordMichaelRuntimeFacadeFailure,
  recordMichaelRuntimeResponseDisabled,
  recordMichaelRuntimeRouteDisabled,
  recordMichaelRuntimeSuccess,
} from '../services/michaelRuntimeObservability.js';

export const michaelRuntimeRoutes: Router = Router();

// The request body is server-owned: accepted fields are optional `language` and
// optional `ask`. Everything else (client-supplied turn, packet, retrieval, BA
// authority, identifiers, tokens, etc.) is rejected. `ask` is content only: it
// is sanitized, length-limited, and used only as a Context Manager search cue.
const ALLOWED_BODY_FIELDS = new Set(['language', 'ask']);
const SUPPORTED_BODY_LANGUAGES = new Set(['en', 'es']);
const MAX_ASK_LENGTH = 500;

interface MichaelRuntimeSupportingContextItem {
  readonly title: string;
  readonly summary: string;
}

/**
 * POST /api/michael-runtime/resolve handler. Exported for direct unit testing
 * with mock req/res (the route registers it behind requireAuth +
 * requireSteveComplete). Async: it builds the server-owned turn from the session
 * via the S3.10 turn source, then resolves it through the inert S2.20 facade. No
 * persistence, LLM, or side effects beyond in-memory observability counters.
 */
export async function handleMichaelRuntimeResolve(
  req: Request,
  res: Response,
): Promise<Response> {
  // Axis 1 — route kill switch. Fail-closed BEFORE any work: no turn source, no
  // facade call, no response, no trace, no side effect.
  if (!michaelRuntimeRouteEnabled()) {
    recordMichaelRuntimeRouteDisabled();
    return res
      .status(503)
      .json({ ok: false, disabled: true, reason: 'michael_runtime_disabled' });
  }

  // Axis 2 — response kill switch. Authenticated and route-enabled, but no
  // response body and (for this first implementation) no trace either.
  if (!michaelRuntimeResponseEnabled()) {
    recordMichaelRuntimeResponseDisabled();
    return res
      .status(503)
      .json({ ok: false, disabled: true, reason: 'michael_runtime_response_disabled' });
  }

  // Server-owned body validation. Reject ANY field that is not exactly
  // `language`, and reject a `language` value that is not 'en' or 'es'. This
  // single rule subsumes the old body-BA-scope rejection — body tmagId/sponsorTmagId/
  // targetTmagId (and turn/contextPacket/token/sessionId/etc.) now all yield
  // CLIENT_RUNTIME_INPUT_NOT_ALLOWED.
  const body = (req.body ?? {}) as Record<string, unknown>;
  let validatedLanguage: 'en' | 'es' | undefined;
  let validatedAsk: string | undefined;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_FIELDS.has(key)) {
      recordMichaelRuntimeBodyBaOverrideRejection();
      return res.status(400).json({
        ok: false,
        error: 'Michael runtime input must be server-owned.',
        code: 'CLIENT_RUNTIME_INPUT_NOT_ALLOWED',
      });
    }
  }
  if (body.language !== undefined) {
    if (typeof body.language !== 'string' || !SUPPORTED_BODY_LANGUAGES.has(body.language)) {
      recordMichaelRuntimeBodyBaOverrideRejection();
      return res.status(400).json({
        ok: false,
        error: 'Michael runtime input must be server-owned.',
        code: 'CLIENT_RUNTIME_INPUT_NOT_ALLOWED',
      });
    }
    validatedLanguage = body.language as 'en' | 'es';
  }
  if (body.ask !== undefined) {
    if (typeof body.ask !== 'string') {
      recordMichaelRuntimeBodyBaOverrideRejection();
      return res.status(400).json({
        ok: false,
        error: 'Michael runtime input must be server-owned.',
        code: 'CLIENT_RUNTIME_INPUT_NOT_ALLOWED',
      });
    }

    const normalizedAsk = body.ask.replace(/\s+/g, ' ').trim();
    if (normalizedAsk.length > MAX_ASK_LENGTH) {
      recordMichaelRuntimeBodyBaOverrideRejection();
      return res.status(400).json({
        ok: false,
        error: 'Michael runtime input must be server-owned.',
        code: 'CLIENT_RUNTIME_INPUT_NOT_ALLOWED',
      });
    }
    if (normalizedAsk.length > 0) validatedAsk = normalizedAsk;
  }

  const sessionTmagId = req.session?.tmagId;
  if (!sessionTmagId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }

  // Build the server-owned turn from session-derived identity ONLY. The turn
  // source delegates packet assembly to the sanctioned context layer and returns
  // a degraded, fail-closed adapter input — never a client-supplied turn.
  let created: Awaited<ReturnType<typeof createMichaelRuntimeTurnForAuthenticatedBa>>;
  try {
    created = await createMichaelRuntimeTurnForAuthenticatedBa({
      tmagId: sessionTmagId,
      language: validatedLanguage,
      turnContent: validatedAsk,
    });
  } catch {
    recordMichaelRuntimeFacadeFailure();
    return res.status(422).json({
      ok: false,
      issues: [{ code: 'resolution_error', message: 'Runtime resolution failed.' }],
    });
  }

  if (!created.ok) {
    recordMichaelRuntimeFacadeFailure();
    return res.status(422).json({ ok: false, issues: created.issues });
  }

  // The facade is documented as never-throwing, but is wrapped defensively —
  // any unexpected throw is mapped to a deterministic failure, never a 500.
  let result: ReturnType<typeof resolveMichaelRuntimeTurnResponse>;
  try {
    result = resolveMichaelRuntimeTurnResponse(created.input);
  } catch {
    recordMichaelRuntimeFacadeFailure();
    return res.status(422).json({
      ok: false,
      issues: [{ code: 'resolution_error', message: 'Runtime resolution failed.' }],
    });
  }

  if (!result.ok) {
    recordMichaelRuntimeFacadeFailure();
    return res.status(422).json({ ok: false, issues: result.issues });
  }

  const payload: {
    ok: true;
    selectionRequest: MichaelRuntimeAdapterContractInput | unknown;
    catalogKey: string;
    response: unknown;
    supportingContext?: readonly MichaelRuntimeSupportingContextItem[];
    trace?: unknown;
  } = {
    ok: true,
    selectionRequest: result.selectionRequest,
    catalogKey: result.catalogKey,
    response: result.response,
  };

  const supportingContext = buildSupportingContext(created.input);
  if (supportingContext.length > 0) {
    payload.supportingContext = supportingContext;
  }

  // Axis 3 — trace kill switch. The redacted trace is included ONLY when
  // explicitly enabled.
  if (michaelRuntimeTraceEnabled()) {
    payload.trace = result.trace;
  }

  recordMichaelRuntimeSuccess();
  return res.status(200).json(payload);
}

function buildSupportingContext(
  input: MichaelRuntimeAdapterContractInput,
): readonly MichaelRuntimeSupportingContextItem[] {
  const packet =
    input.runtimeTurn.result.decision === 'proceed'
      ? input.runtimeTurn.result.consumption.packet
      : undefined;
  if (!packet) return [];

  return packet.approvedKnowledge.slice(0, 3).flatMap((item) => {
    const title = item.title.replace(/\s+/g, ' ').trim();
    const summary = item.summary.replace(/\s+/g, ' ').trim();
    if (!title || !summary) return [];
    return [{
      title: title.slice(0, 90),
      summary: summary.slice(0, 220),
    }];
  });
}

michaelRuntimeRoutes.post(
  '/resolve',
  requireAuth,
  requireSteveComplete,
  (req, res) => {
    void handleMichaelRuntimeResolve(req, res);
  },
);
