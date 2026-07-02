/**
 * POST /api/michael-runtime/resolve — Sprint 3 S3.11 server-owned Michael runtime route.
 *
 * The FIRST runtime-facing Michael route. It is `.team`-only, authenticated,
 * BA-scoped, fixtures-only, non-persistent, LLM-free, voice-free, and
 * fail-closed behind a three-axis kill switch (route / response / trace).
 *
 * SERVER-OWNED TURN CONTRACT (S3.11): the runtime turn is built entirely
 * server-side from the authenticated session — the client NO LONGER supplies a
 * `body.turn`. The request body must be server-owned: the ONLY accepted field is
 * optional `language` ('en' | 'es'). Any other key — or a malformed `language`
 * value — is rejected with 400 `CLIENT_RUNTIME_INPUT_NOT_ALLOWED`. This merges the
 * old body-BA-scope rejection (`tmagId`/`sponsorTmagId`/`targetTmagId`) into one broader
 * rule. A valid client request is `{}` or `{ "language": "en" | "es" }`.
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

// The request body is server-owned: the ONLY accepted field is optional
// `language`. Everything else (client-supplied turn, Context Packet, retrieval,
// BA authority, identifiers, tokens, …) is rejected. We allowlist `language` and
// reject ANY other key, but also name the high-risk forbidden keys explicitly so
// the boundary is self-documenting.
const ALLOWED_BODY_FIELDS = new Set(['language']);
const SUPPORTED_BODY_LANGUAGES = new Set(['en', 'es']);

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
    trace?: unknown;
  } = {
    ok: true,
    selectionRequest: result.selectionRequest,
    catalogKey: result.catalogKey,
    response: result.response,
  };

  // Axis 3 — trace kill switch. The redacted trace is included ONLY when
  // explicitly enabled.
  if (michaelRuntimeTraceEnabled()) {
    payload.trace = result.trace;
  }

  recordMichaelRuntimeSuccess();
  return res.status(200).json(payload);
}

michaelRuntimeRoutes.post(
  '/resolve',
  requireAuth,
  requireSteveComplete,
  (req, res) => {
    void handleMichaelRuntimeResolve(req, res);
  },
);
