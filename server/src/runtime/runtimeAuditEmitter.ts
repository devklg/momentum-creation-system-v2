/**
 * Runtime audit emitter (Phase 7 · R0 activation wiring — P7.7).
 *
 * The activation SEAM for R0 runtime audit. It emits turn-lifecycle and gate
 * markers by calling the flag-gated `appendRuntimeAuditEntry` writer. Because
 * that writer is a no-op while RUNTIME_AUDIT_PERSISTENCE_ENABLED is false (the
 * default), this module is INERT until the canary is turned on — nothing here
 * persists until Kevin flips the flag.
 *
 * Why it lives OUTSIDE `runtime/orchestration/`: the S2.7 coordinator's
 * governance boundary (s27…GovernanceBoundary) forbids any persistence call in
 * coordinator/orchestration source. This emitter wraps the coordinator from the
 * runtime layer instead, keeping the orchestration boundary clean while giving a
 * single, testable place to emit audit.
 *
 * It mounts NO route (the `/api/runtime/*` prohibition stands). Live wiring — a
 * real turn driver calling `coordinateRuntimeTurnAudited`, and the auth
 * middleware calling `emitGateAllowed`/`emitGateDenied` — is the final
 * activation step, gated on Kevin's approval and a route decision.
 */

import type {
  McsRuntimeAuditAgent,
  McsRuntimeAuditContext,
  McsRuntimeAuditDraftKind,
  McsRuntimeAuditLogEntry,
} from '@momentum/shared';
import type { McsAgentKey } from '@momentum/shared/runtime';
import { appendRuntimeAuditEntry } from '../domain/auditLog.js';
import { coordinateRuntimeTurn } from './orchestration/turnCoordinator.js';
import type {
  RuntimeTurnCoordinatorInput,
  RuntimeTurnCoordinatorResult,
} from './orchestration/types.js';

/** Map the orchestration agent key to the runtime-audit agent label (exhaustive). */
export function agentKeyToRuntimeAuditAgent(agentKey: McsAgentKey): McsRuntimeAuditAgent {
  switch (agentKey) {
    case 'steve_success':
      return 'steve';
    case 'michael_magnificent':
      return 'michael';
    case 'ivory':
      return 'ivory';
  }
}

/** A turn began. */
export function emitTurnOpened(ctx: McsRuntimeAuditContext): Promise<McsRuntimeAuditLogEntry | null> {
  return appendRuntimeAuditEntry({ action: 'runtime.turn.opened', runtime: ctx });
}

/** A turn completed. */
export function emitTurnClosed(ctx: McsRuntimeAuditContext): Promise<McsRuntimeAuditLogEntry | null> {
  return appendRuntimeAuditEntry({ action: 'runtime.turn.closed', runtime: ctx });
}

/** An outcome / guided-action draft was returned (content is NOT stored). */
export function emitDraftEmitted(
  ctx: McsRuntimeAuditContext,
  draftKind: McsRuntimeAuditDraftKind,
): Promise<McsRuntimeAuditLogEntry | null> {
  return appendRuntimeAuditEntry({
    action: 'runtime.turn.draft_emitted',
    runtime: { ...ctx, draftKind },
  });
}

/** A gate (steve/michael/activation) passed. Called by the auth middleware layer. */
export function emitGateAllowed(
  ctx: McsRuntimeAuditContext,
  gate: string,
): Promise<McsRuntimeAuditLogEntry | null> {
  return appendRuntimeAuditEntry({ action: 'runtime.gate.allowed', runtime: { ...ctx, gate } });
}

/** A gate blocked the turn. `reason` is the capped gate-denial cause. */
export function emitGateDenied(
  ctx: McsRuntimeAuditContext,
  gate: string,
  reason?: string | null,
): Promise<McsRuntimeAuditLogEntry | null> {
  return appendRuntimeAuditEntry({
    action: 'runtime.gate.denied',
    runtime: { ...ctx, gate },
    reason: reason ?? null,
  });
}

/**
 * Coordinate a runtime turn with audit emission around it. Emits `turn.opened`
 * before dispatch, a `draft_emitted` marker per draft kind actually returned,
 * and `turn.closed` after — then returns the coordinator's result UNCHANGED.
 *
 * The coordinator itself stays persistence-free (governance boundary); this
 * wrapper owns the audit side effects. All emissions are no-ops while the R0
 * canary is off, so behavior is identical to calling `coordinateRuntimeTurn`
 * directly until the flag is flipped.
 */
export async function coordinateRuntimeTurnAudited(
  input: RuntimeTurnCoordinatorInput,
  ctx: McsRuntimeAuditContext,
): Promise<RuntimeTurnCoordinatorResult> {
  await emitTurnOpened(ctx);

  const result = await coordinateRuntimeTurn(input);

  if (result.outcomeDrafts.length > 0) await emitDraftEmitted(ctx, 'outcome');
  if (result.guidedActionDrafts.length > 0) await emitDraftEmitted(ctx, 'guided_action');

  await emitTurnClosed(ctx);

  return result;
}
