import {
  MICHAEL_RUNTIME_FALLBACK_POLICY,
  MICHAEL_RUNTIME_FALLBACK_SCENARIOS,
  MICHAEL_RUNTIME_SUPPORTED_LANGUAGES,
} from '@momentum/shared';
import {
  getMichaelResponseCatalogEntry,
  MICHAEL_RESPONSE_CATALOG,
} from './michaelResponseCatalog.js';
import { validateMichaelResponseContract } from './michaelResponseContract.js';
import type {
  MichaelCatalogSelectorIntent,
  MichaelResponseCatalogSelectionIssue,
  MichaelResponseCatalogSelectionRequest,
  MichaelResponseCatalogSelectionResult,
} from './types.js';

const MICHAEL_AGENT_KEY = 'michael_magnificent' as const;
const MICHAEL_TASK_TYPE = 'training_support' as const;
const KNOWN_RESPONSE_TYPES = [
  'next_training_step',
  'clarification_question',
  'safe_fallback',
  'safe_close',
] as const;
const KNOWN_SCENARIO_FAMILIES = ['complete', ...MICHAEL_RUNTIME_FALLBACK_SCENARIOS] as const;

/**
 * Valid (scenarioFamily, responseType) → catalog-key-base mapping. Language is
 * appended at lookup time. Any pair absent from this table is an invalid
 * combination (e.g. complete+safe_close, failed+next_training_step).
 */
const CATALOG_KEY_BASE_BY_COMBINATION: ReadonlyMap<string, string> = new Map([
  ['complete|next_training_step', 'michael_next_training_step'],
  ['complete|clarification_question', 'michael_clarification_question'],
  ...Object.entries(MICHAEL_RUNTIME_FALLBACK_POLICY).map(
    ([scenarioFamily, policy]) => [
      `${scenarioFamily}|${policy.responseType}`,
      `michael_${policy.responseType}_${scenarioFamily}`,
    ] as const,
  ),
]);

/** Intent that must accompany each complete-family response type, when given. */
const INTENT_FOR_COMPLETE_RESPONSE_TYPE: Readonly<Record<string, MichaelCatalogSelectorIntent>> = {
  next_training_step: 'clear_training_support',
  clarification_question: 'ambiguous_training_support',
};

function issue(
  code: MichaelResponseCatalogSelectionIssue['code'],
  message: string,
): MichaelResponseCatalogSelectionIssue {
  return { code, message };
}

/**
 * Pure, returned-only selector: maps a deterministic request to the matching
 * MICHAEL_RESPONSE_CATALOG entry. Never mutates the catalog, generates no text,
 * and performs no I/O. Returns a discriminated result.
 */
export function selectMichaelResponseCatalogEntry(
  request: MichaelResponseCatalogSelectionRequest,
): MichaelResponseCatalogSelectionResult {
  const issues: MichaelResponseCatalogSelectionIssue[] = [];

  if (request.agentKey !== MICHAEL_AGENT_KEY) {
    issues.push(issue('wrong_agent', 'Selector accepts only michael_magnificent.'));
  }

  if (request.taskType !== MICHAEL_TASK_TYPE) {
    issues.push(issue('wrong_task', 'Selector accepts only training_support.'));
  }

  if (!(MICHAEL_RUNTIME_SUPPORTED_LANGUAGES as readonly string[]).includes(request.language)) {
    issues.push(issue('unsupported_language', 'Selector accepts only en or es.'));
  }

  if (!(KNOWN_RESPONSE_TYPES as readonly string[]).includes(request.responseType)) {
    issues.push(issue('invalid_response_type', 'Unknown catalog response type.'));
  }

  if (!(KNOWN_SCENARIO_FAMILIES as readonly string[]).includes(request.scenarioFamily)) {
    issues.push(issue('invalid_scenario_family', 'Unknown catalog scenario family.'));
  }

  if (
    request.contextPacketStatus !== undefined &&
    request.contextPacketStatus !== request.scenarioFamily
  ) {
    issues.push(
      issue(
        'inconsistent_context_status',
        'contextPacketStatus must match scenarioFamily when provided.',
      ),
    );
  }

  if (
    request.scenarioFamily === 'complete' &&
    request.intent !== undefined &&
    INTENT_FOR_COMPLETE_RESPONSE_TYPE[request.responseType] !== request.intent
  ) {
    issues.push(
      issue('intent_mismatch', 'intent does not match the requested complete responseType.'),
    );
  }

  // Stop before combination/key resolution if the request envelope is invalid.
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const combinationKey = `${request.scenarioFamily}|${request.responseType}`;
  const catalogKeyBase = CATALOG_KEY_BASE_BY_COMBINATION.get(combinationKey);

  if (!catalogKeyBase) {
    return {
      ok: false,
      issues: [
        issue(
          'invalid_combination',
          `Invalid scenarioFamily/responseType combination: ${combinationKey}.`,
        ),
      ],
    };
  }

  const catalogKey = `${catalogKeyBase}_${request.language}`;
  const entry = getMichaelResponseCatalogEntry(catalogKey);

  if (!entry) {
    return {
      ok: false,
      issues: [issue('catalog_key_not_found', `No catalog entry for key ${catalogKey}.`)],
    };
  }

  // Defensive: the entry must still be a valid contract. The selector returns
  // the catalog object verbatim — it never copies, edits, or regenerates it.
  const validation = validateMichaelResponseContract(entry.response);
  if (!validation.ok) {
    return {
      ok: false,
      issues: [issue('invalid_contract', `Catalog entry ${catalogKey} failed validation.`)],
    };
  }

  return { ok: true, catalogKey, entry, response: entry.response };
}

/**
 * Convenience: resolve a request to its catalog key, or `undefined` when the
 * request does not map to a controlled catalog entry.
 */
export function selectMichaelResponseCatalogKey(
  request: MichaelResponseCatalogSelectionRequest,
): string | undefined {
  const result = selectMichaelResponseCatalogEntry(request);
  return result.ok ? result.catalogKey : undefined;
}

/**
 * Validate a selection request: returns the issues a selection would raise
 * (empty when the request resolves to a valid catalog entry). Pure.
 */
export function validateMichaelResponseCatalogSelection(
  request: MichaelResponseCatalogSelectionRequest,
): { readonly ok: boolean; readonly issues: readonly MichaelResponseCatalogSelectionIssue[] } {
  const result = selectMichaelResponseCatalogEntry(request);
  return result.ok ? { ok: true, issues: [] } : { ok: false, issues: result.issues };
}

/**
 * Build the canonical selection request that resolves to a given catalog entry.
 * Used by parity tests to prove every catalog entry is selectable. Pure.
 */
export function selectionRequestForCatalogKey(
  catalogKey: string,
): MichaelResponseCatalogSelectionRequest | undefined {
  const entry = getMichaelResponseCatalogEntry(catalogKey);
  if (!entry) return undefined;

  return {
    agentKey: MICHAEL_AGENT_KEY,
    taskType: MICHAEL_TASK_TYPE,
    language: entry.language,
    responseType: entry.responseType,
    scenarioFamily: entry.scenarioFamily,
    contextPacketStatus: entry.contextPacketStatus,
    ...(entry.scenarioFamily === 'complete'
      ? { intent: INTENT_FOR_COMPLETE_RESPONSE_TYPE[entry.responseType] }
      : {}),
  };
}

/** Every catalog key the selector can resolve (mirrors the catalog order). */
export const MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS: readonly string[] =
  MICHAEL_RESPONSE_CATALOG.map((entry) => entry.catalogKey);
