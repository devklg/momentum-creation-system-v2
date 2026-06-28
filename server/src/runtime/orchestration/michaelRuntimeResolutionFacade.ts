import { validateMichaelResponseContract } from './michaelResponseContract.js';
import { selectMichaelResponseCatalogEntry } from './michaelResponseCatalogSelector.js';
import {
  deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput,
  deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn,
} from './michaelResponseSelectionRequest.js';
import type {
  DeriveMichaelSelectionRequestFromRuntimeTurnInput,
  MichaelResponseCatalogSelectionRequest,
  MichaelResponseSelectionRequestDerivationResult,
  MichaelRuntimeAdapterContractInput,
  MichaelRuntimeResolutionIssue,
  MichaelRuntimeResolutionResult,
  MichaelRuntimeResolutionTrace,
} from './types.js';

function issue(
  code: MichaelRuntimeResolutionIssue['code'],
  message: string,
): MichaelRuntimeResolutionIssue {
  return { code, message };
}

/**
 * Map a derivation failure to a deterministic resolution issue. Missing
 * identity/turnId/taskType are runtime-turn shape problems; an unresolved
 * selection from derivation is a derivation failure.
 */
function resolutionIssueFromDerivation(
  derivation: Extract<MichaelResponseSelectionRequestDerivationResult, { ok: false }>,
): MichaelRuntimeResolutionIssue {
  const first = derivation.issues[0];
  if (
    first &&
    (first.code === 'missing_identity' ||
      first.code === 'missing_turn_id' ||
      first.code === 'missing_task_type')
  ) {
    return issue('invalid_runtime_turn', first.message);
  }

  return issue(
    'derivation_failed',
    first?.message ?? 'Selection request could not be derived from the runtime turn.',
  );
}

/**
 * Build the inert, redacted resolution trace. Constructed explicitly from
 * controlled metadata only — never spreads the response, so it can never leak
 * session/turn/correlation IDs, generated text, or raw upstream output.
 */
function buildTrace(
  selectionRequest: MichaelResponseCatalogSelectionRequest,
  catalogKey: string,
): MichaelRuntimeResolutionTrace {
  return {
    classification: {
      scenarioFamily: selectionRequest.scenarioFamily as MichaelRuntimeResolutionTrace['classification']['scenarioFamily'],
      responseType: selectionRequest.responseType as MichaelRuntimeResolutionTrace['classification']['responseType'],
      language: selectionRequest.language as 'en' | 'es',
      ...(selectionRequest.intent ? { intent: selectionRequest.intent } : {}),
    },
    selectionRequest,
    catalogKey,
    responseType: selectionRequest.responseType as MichaelRuntimeResolutionTrace['responseType'],
    contextPacketStatus:
      selectionRequest.scenarioFamily as MichaelRuntimeResolutionTrace['contextPacketStatus'],
    language: selectionRequest.language as 'en' | 'es',
    persistence: 'disabled',
    agentResponseGenerated: false,
  };
}

/**
 * Resolve a derived selection request to its catalog entry + validated response.
 * Shared tail of both entry points. Pure: composes the S2.18 selector and the
 * response contract validator; returns the fixture BY REFERENCE; mutates nothing.
 */
function resolveFromSelectionRequest(
  selectionRequest: MichaelResponseCatalogSelectionRequest,
): MichaelRuntimeResolutionResult {
  const selection = selectMichaelResponseCatalogEntry(selectionRequest);
  if (!selection.ok) {
    for (const selectionIssue of selection.issues) {
      if (
        selectionIssue.code === 'wrong_agent' ||
        selectionIssue.code === 'wrong_task' ||
        selectionIssue.code === 'unsupported_language'
      ) {
        return { ok: false, issues: [issue(selectionIssue.code, selectionIssue.message)] };
      }
    }
    return {
      ok: false,
      issues: [
        issue(
          'selection_failed',
          selection.issues[0]?.message ?? 'Selection request did not resolve to a catalog entry.',
        ),
      ],
    };
  }

  const validation = validateMichaelResponseContract(selection.entry.response);
  if (!validation.ok) {
    return {
      ok: false,
      issues: [issue('contract_validation_failed', 'Resolved catalog response failed validation.')],
    };
  }

  return {
    ok: true,
    selectionRequest,
    catalogKey: selection.catalogKey,
    catalogEntry: selection.entry,
    // Returned BY REFERENCE — the pre-authored fixture, never cloned or mutated.
    response: selection.entry.response,
    trace: buildTrace(selectionRequest, selection.catalogKey),
  };
}

/**
 * Resolve a Michael adapter-contract input end-to-end:
 *   adapter input → S2.19 derivation → S2.18 selection → validated fixture.
 * Inert, returned-only. Never throws; returns deterministic issues on failure.
 */
export function resolveMichaelRuntimeTurnResponseFromAdapterInput(
  input: MichaelRuntimeAdapterContractInput,
): MichaelRuntimeResolutionResult {
  const derivation = deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput(input);
  if (!derivation.ok) {
    return { ok: false, issues: [resolutionIssueFromDerivation(derivation)] };
  }

  return resolveFromSelectionRequest(derivation.selectionRequest);
}

/**
 * Resolve a runtime turn fixture result end-to-end:
 *   runtime turn → S2.19 derivation → S2.18 selection → validated fixture.
 * Inert, returned-only. Never throws; returns deterministic issues on failure.
 */
export function resolveMichaelRuntimeTurnResponseFromFixture(
  args: DeriveMichaelSelectionRequestFromRuntimeTurnInput,
): MichaelRuntimeResolutionResult {
  const derivation = deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn(args);
  if (!derivation.ok) {
    return { ok: false, issues: [resolutionIssueFromDerivation(derivation)] };
  }

  return resolveFromSelectionRequest(derivation.selectionRequest);
}

/**
 * Primary entry point: resolve a Michael adapter-contract input end-to-end.
 * Alias of the adapter-input resolution.
 */
export function resolveMichaelRuntimeTurnResponse(
  input: MichaelRuntimeAdapterContractInput,
): MichaelRuntimeResolutionResult {
  return resolveMichaelRuntimeTurnResponseFromAdapterInput(input);
}
