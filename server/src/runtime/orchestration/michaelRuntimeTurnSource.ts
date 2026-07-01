/**
 * S3.10 — Server-owned Michael runtime turn source (PURE, ADDITIVE).
 *
 * Produces a facade-compatible `MichaelRuntimeAdapterContractInput` for the
 * authenticated BA from SESSION-DERIVED identity ONLY. It is:
 *
 *  - server-owned   — BA scope comes from the authenticated session, never the
 *                     request body (no body tmagId/sponsorTmagId/targetTmagId, no
 *                     prospect/session token, no client-supplied Context Packet
 *                     or raw retrieval output; the signature cannot even carry
 *                     them);
 *  - session-scoped — Team Magnificent / BA scope is derived server-side;
 *  - Context-Manager-assembled — packet assembly does NOT live here. This module
 *                     injects a production `ContextManagerRequestPort` built by
 *                     the sanctioned CONTEXT-LAYER factory
 *                     (`createMichaelRuntimeContextManagerPort` in
 *                     `../context/`). Orchestration NEVER assembles a packet;
 *                     the Context Manager remains the only assembler;
 *  - degraded / fail-closed — the only knowledge-honest, store-free packet is an
 *                     empty-approved-knowledge packet, stamped
 *                     `packetStatus: 'degraded'`, which the inert S2.20 facade
 *                     deterministically resolves to the pre-authored
 *                     `safe_fallback` response. On any assembly/coordination
 *                     failure it returns a deterministic typed-issues result —
 *                     it never throws, never persists, never emits a partial
 *                     unsafe turn;
 *  - boundary-clean — it imports NO store/Gateway/GraphRAG/retrieval client and
 *                     NEVER imports the S2.13 test harness (`fixtures/`). It
 *                     calls no LLM and generates no text.
 *
 * S3.10 boundary: this module is CREATED and EXPORTED but NOT wired to the
 * route (`routes/michael-runtime.ts`) or the UI. A future, separately-gated
 * slice swaps the route's client-supplied `body.turn` for this source. Until
 * then the route is unchanged and the `.team` Michael card stays disabled.
 */

import { randomUUID } from 'node:crypto';
import type {
  TmagId,
  CorrelationId,
  RequestId,
  RuntimeLanguage,
  RuntimeMode,
  RuntimeTurnId,
  SessionId,
  TeamId,
  TenantId,
} from '@momentum/shared/runtime';
import { createMichaelRuntimeContextManagerPort } from '../context/index.js';
import {
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
} from '../events/index.js';
import { coordinateRuntimeTurn } from './turnCoordinator.js';
import type {
  AgentRuntimeAdapterDispatchIdentity,
  MichaelRuntimeAdapterContractInput,
  RuntimeTurnCoordinatorInput,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioMetadata,
} from './types.js';

const MICHAEL_AGENT_KEY = 'michael_magnificent' as const;
const MICHAEL_TASK_TYPE = 'training_support' as const;

// Server-side Team Magnificent scope constants (never body-derived). Only the
// teamKey/teamName are contract-validated; tenant/team ids are opaque non-empty
// identifiers aligned with the rest of the runtime layer.
const TENANT_ID = 'tenant_team_magnificent' as TenantId;
const TEAM_ID = 'team_magnificent' as TeamId;

const SUPPORTED_LANGUAGES: readonly RuntimeLanguage[] = ['en', 'es'];
const SUPPORTED_MODES: readonly RuntimeMode[] = ['browser_text', 'browser_voice', 'mixed'];
const DEFAULT_LANGUAGE: RuntimeLanguage = 'en';
const DEFAULT_MODE: RuntimeMode = 'browser_text';

/**
 * Session-derived BA identity. Carries ONLY what the authenticated session
 * supplies. There is intentionally no field for a body tmagId/sponsorTmagId/
 * targetTmagId, a prospect/session token, or a client-supplied Context Packet /
 * raw retrieval output — the turn source cannot accept them by construction.
 */
export interface CreateMichaelRuntimeTurnForAuthenticatedBaInput {
  /** Authenticated BA id — must be sourced from `req.session.tmagId` only. */
  readonly tmagId: TmagId | string;
  /** BA UI language, server-derived. Defaults to `'en'`. */
  readonly language?: RuntimeLanguage;
  /** BA runtime transport mode, server-derived. Defaults to `'browser_text'`. */
  readonly mode?: RuntimeMode;
  /** Optional server-derived session id (traceability only). */
  readonly sessionId?: SessionId | string;
  /** Optional server-derived correlation id (traceability only). */
  readonly correlationId?: CorrelationId | string;
}

export interface MichaelRuntimeTurnSourceIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

/**
 * Deterministic, typed result. On success it returns ONLY the adapter input the
 * facade consumes server-side; it never exposes the raw Context Packet or the
 * raw runtime turn to any client. On failure it returns typed issues and no
 * turn (fail-closed).
 */
export type CreateMichaelRuntimeTurnForAuthenticatedBaResult =
  | { readonly ok: true; readonly input: MichaelRuntimeAdapterContractInput }
  | { readonly ok: false; readonly issues: readonly MichaelRuntimeTurnSourceIssue[] };

/**
 * Build a degraded, fail-closed Michael runtime turn for the authenticated BA.
 *
 * Pure with respect to I/O: no persistence, no LLM, no store/Gateway/retrieval
 * access. Packet assembly is delegated to the sanctioned context-layer factory
 * (`createMichaelRuntimeContextManagerPort`), whose port is injected into the
 * turn coordinator with empty approved knowledge.
 */
export async function createMichaelRuntimeTurnForAuthenticatedBa(
  input: CreateMichaelRuntimeTurnForAuthenticatedBaInput,
): Promise<CreateMichaelRuntimeTurnForAuthenticatedBaResult> {
  const issues: MichaelRuntimeTurnSourceIssue[] = [];

  const tmagId = typeof input.tmagId === 'string' ? input.tmagId.trim() : '';
  if (tmagId.length === 0) {
    issues.push({
      path: 'tmagId',
      code: 'missing_session_ba_id',
      message: 'A session-derived BA id is required to build a Michael runtime turn.',
    });
  }

  const language = input.language ?? DEFAULT_LANGUAGE;
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    issues.push({
      path: 'language',
      code: 'unsupported_language',
      message: `Language ${String(language)} is not supported for Michael.`,
    });
  }

  const mode = input.mode ?? DEFAULT_MODE;
  if (!SUPPORTED_MODES.includes(mode)) {
    issues.push({
      path: 'mode',
      code: 'unsupported_mode',
      message: `Runtime mode ${String(mode)} is not supported for Michael.`,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const createdAt = new Date().toISOString();
  const sessionId = (
    typeof input.sessionId === 'string' && input.sessionId.trim().length > 0
      ? input.sessionId
      : `michael_session_${randomUUID()}`
  ) as SessionId;
  const correlationId = (
    typeof input.correlationId === 'string' && input.correlationId.trim().length > 0
      ? input.correlationId
      : `michael_corr_${randomUUID()}`
  ) as CorrelationId;
  const requestId = `michael_req_${randomUUID()}` as RequestId;
  const turnId = `michael_turn_${randomUUID()}` as RuntimeTurnId;

  const identity: AgentRuntimeAdapterDispatchIdentity = {
    scope: {
      tenantId: TENANT_ID,
      teamId: TEAM_ID,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: tmagId as TmagId,
    },
    sessionId,
    agentKey: MICHAEL_AGENT_KEY,
    mode,
    language,
    correlationId,
    requestId,
  };

  // Production Context Manager port — assembled by the sanctioned context-layer
  // factory with empty approved knowledge (no store, no retrieval, no Gateway).
  // This is NOT the S2.13 fixture port; the context layer owns assembly and
  // returns a degraded, candidate-excluded packet from session identity alone.
  const contextManager = createMichaelRuntimeContextManagerPort({
    tmagId: tmagId as TmagId,
    mode,
    createdAt,
  });

  const coordinatorInput: RuntimeTurnCoordinatorInput = {
    identity,
    turnId,
    taskType: MICHAEL_TASK_TYPE,
    contextManager,
    requireSubstantive: false,
    createdAt,
  };

  let result: Awaited<ReturnType<typeof coordinateRuntimeTurn>>;
  try {
    result = await coordinateRuntimeTurn(coordinatorInput);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          path: 'coordinateRuntimeTurn',
          code: 'coordination_failed',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  // Fail closed: the only sanctioned outcome for a store-free, empty-knowledge
  // packet is the `degraded` decision. Anything else (reject / block_substantive
  // / proceed) means assembly/coordination did not reach the safe degraded
  // posture, so we return typed issues and NO turn rather than a partial turn.
  if (result.decision !== 'degraded') {
    return {
      ok: false,
      issues: [
        {
          path: 'runtimeTurn',
          code: 'unexpected_coordination_decision',
          message:
            `Expected a degraded fail-closed runtime turn but the coordinator ` +
            `returned decision "${String(result.decision)}".`,
        },
        ...extractResultIssues(result),
      ],
    };
  }

  const metadata: RuntimeTurnFixtureScenarioMetadata = {
    scenario: 'accepted_degraded',
    description:
      'Server-owned, session-scoped Michael runtime turn (degraded, fail-closed).',
    // Inert, type-required literal — read by no production classifier. The
    // adapter contract reads only `metadata.contextManagerInjected`.
    fixtureOnly: true,
    contextManagerInjected: true,
    expectedContextRequest: true,
    expectedDecision: 'degraded',
    persistence: 'disabled',
    behavior: 'not_implemented',
    agentResponseGenerated: false,
  };

  const runtimeTurn: RuntimeTurnFixtureHarnessResult = {
    scenario: 'accepted_degraded',
    metadata,
    input: coordinatorInput,
    result,
    contextCalls: [],
    eventPersistence: 'disabled',
    outcomePersistence: 'disabled',
    guidedActionPersistence: 'disabled',
    envelopePersistence: 'disabled',
    behavior: 'not_implemented',
    agentResponseGenerated: false,
  };

  const adapterInput: MichaelRuntimeAdapterContractInput = {
    identity,
    turnId,
    taskType: MICHAEL_TASK_TYPE,
    runtimeTurn,
    language,
  };

  return { ok: true, input: adapterInput };
}

function extractResultIssues(
  result: Awaited<ReturnType<typeof coordinateRuntimeTurn>>,
): MichaelRuntimeTurnSourceIssue[] {
  const collected: MichaelRuntimeTurnSourceIssue[] = [];

  if ('issues' in result && Array.isArray(result.issues)) {
    for (const entry of result.issues) {
      collected.push({ path: entry.path, code: entry.code, message: entry.message });
    }
  }

  if ('consumption' in result && result.consumption) {
    for (const entry of result.consumption.issues) {
      collected.push({ path: entry.path, code: entry.code, message: entry.message });
    }
  }

  return collected;
}
