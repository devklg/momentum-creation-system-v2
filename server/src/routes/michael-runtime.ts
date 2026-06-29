/**
 * POST /api/michael-runtime/resolve — Sprint 3 S3.4 minimal Michael runtime route.
 *
 * The FIRST runtime-facing Michael route. It is `.team`-only, authenticated,
 * BA-scoped, fixtures-only, non-persistent, LLM-free, voice-free, and
 * fail-closed behind a three-axis kill switch (route / response / trace).
 *
 * It is a one-call consumer of the S2.20 inert resolution facade
 * (`resolveMichaelRuntimeTurnResponse`), which composes the canonical
 * S2.17–S2.20 chain (catalog → selector → derivation → facade) and returns a
 * pre-authored, contract-validated fixture BY REFERENCE plus a redacted trace.
 * It NEVER generates text, calls an LLM, persists anything, assembles a Context
 * Packet, touches a store/Gateway/retrieval helper, or imports the S2.13
 * test-only harness.
 *
 * Sponsor immutability (locked-spec 3.5): BA scope comes from req.session.baId,
 * never the request body. Body-supplied BA authority is rejected.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { resolveMichaelRuntimeTurnResponse } from '../runtime/orchestration/index.js';
import type { MichaelRuntimeAdapterContractInput } from '../runtime/orchestration/index.js';
import {
  michaelRuntimeResponseEnabled,
  michaelRuntimeRouteEnabled,
  michaelRuntimeTraceEnabled,
} from '../config/michaelRuntimeFlags.js';

export const michaelRuntimeRoutes: Router = Router();

// Body-supplied BA-authority fields are never trusted (sponsor immutability).
const FORBIDDEN_BODY_BA_FIELDS = ['baId', 'sponsorBaId', 'targetBaId'] as const;

/**
 * POST /api/michael-runtime/resolve handler. Exported for direct unit testing
 * with mock req/res (the route registers it behind requireAuth +
 * requireSteveComplete). Pure with respect to I/O: it reads req.session/req.body
 * and the env-driven flags, calls only the inert S2.20 facade, and writes the
 * response — no persistence, LLM, or side effects.
 */
export function handleMichaelRuntimeResolve(req: Request, res: Response): Response {
  // Axis 1 — route kill switch. Fail-closed BEFORE any work: no facade call,
  // no response, no trace, no side effect.
  if (!michaelRuntimeRouteEnabled()) {
    return res
      .status(503)
      .json({ ok: false, disabled: true, reason: 'michael_runtime_disabled' });
  }

  // Axis 2 — response kill switch. Authenticated and route-enabled, but no
  // response body and (for this first implementation) no trace either.
  if (!michaelRuntimeResponseEnabled()) {
    return res
      .status(503)
      .json({ ok: false, disabled: true, reason: 'michael_runtime_response_disabled' });
  }

  const sessionBaId = req.session?.baId;
  if (!sessionBaId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  // Sponsor immutability — reject any body-supplied BA authority.
  for (const field of FORBIDDEN_BODY_BA_FIELDS) {
    if (body[field] !== undefined) {
      return res.status(400).json({
        ok: false,
        error: 'BA scope must come from the authenticated session.',
        code: 'BODY_BA_SCOPE_NOT_ALLOWED',
      });
    }
  }

  const turn = body.turn;
  if (!turn || typeof turn !== 'object') {
    return res
      .status(400)
      .json({ ok: false, error: 'Missing runtime turn.', code: 'MISSING_RUNTIME_TURN' });
  }

  // Normalize the adapter input: force the session BA scope (server-authoritative),
  // preserving the rest of the supplied turn. The inert facade does not use the
  // scope for classification, but this guarantees BA scope is session-derived.
  const turnInput = turn as Partial<MichaelRuntimeAdapterContractInput> & {
    identity?: { scope?: Record<string, unknown> };
  };
  const scopedInput = {
    ...turnInput,
    identity: {
      ...turnInput.identity,
      scope: {
        ...(turnInput.identity?.scope ?? {}),
        baId: sessionBaId,
      },
    },
  } as unknown as MichaelRuntimeAdapterContractInput;

  // The facade is documented as never-throwing, but the body is untrusted —
  // a malformed turn is mapped to a deterministic failure, never a 500.
  let result: ReturnType<typeof resolveMichaelRuntimeTurnResponse>;
  try {
    result = resolveMichaelRuntimeTurnResponse(scopedInput);
  } catch {
    return res.status(422).json({
      ok: false,
      issues: [{ code: 'resolution_error', message: 'Runtime resolution failed.' }],
    });
  }

  if (!result.ok) {
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

  return res.status(200).json(payload);
}

michaelRuntimeRoutes.post(
  '/resolve',
  requireAuth,
  requireSteveComplete,
  handleMichaelRuntimeResolve,
);
