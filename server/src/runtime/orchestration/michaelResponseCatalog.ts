import { validateMichaelResponseContract } from './michaelResponseContract.js';
import type {
  MichaelResponseCatalogEntry,
  MichaelResponseCatalogValidationIssue,
  MichaelResponseCatalogValidationResult,
  MichaelResponseContractV1,
  MichaelResponseContextPacketStatus,
  MichaelResponseScenarioFamily,
  MichaelResponseType,
} from './types.js';
import {
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureClarificationQuestionEs,
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureNextTrainingStepEs,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeCloseFailedContextPacketEs,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacketEs,
} from './fixtures/index.js';

const MICHAEL_AGENT_KEY = 'michael_magnificent' as const;
const MICHAEL_TASK_TYPE = 'training_support' as const;

const SUBSTANTIVE_RESPONSE_TYPES: readonly MichaelResponseType[] = [
  'next_training_step',
  'clarification_question',
];

const SAFE_PATH_RESPONSE_TYPES: readonly MichaelResponseType[] = [
  'safe_fallback',
  'safe_close',
];

function scenarioFamilyFor(
  status: MichaelResponseContextPacketStatus,
): MichaelResponseScenarioFamily {
  // `complete` maps to the substantive family; every other Context Packet
  // status is already a safe-path scenario family name.
  return status;
}

/**
 * Build one controlled catalog entry from a pre-authored, contract-valid
 * fixture. No text is generated here — `response` is the fixture verbatim.
 */
function entry(
  catalogKey: string,
  response: MichaelResponseContractV1,
): MichaelResponseCatalogEntry {
  const isSubstantive = SUBSTANTIVE_RESPONSE_TYPES.includes(response.responseType);
  const isSafePath = SAFE_PATH_RESPONSE_TYPES.includes(response.responseType);

  return {
    catalogKey,
    language: response.language,
    responseType: response.responseType,
    contextPacketStatus: response.contextPacketStatus,
    scenarioFamily: scenarioFamilyFor(response.contextPacketStatus),
    isSubstantive,
    isSafePath,
    // Every entry is part of the governance-approved, controlled first-Michael
    // contract set. This is descriptive metadata only — nothing is activated.
    allowedForFirstMichaelSlice: true,
    response,
  };
}

/**
 * The controlled Michael response catalog: EN + ES coverage across all four
 * allowed response types and the complete/degraded/missing/failed/rejected
 * scenario families. Pre-authored fixtures only; returned-only; inert.
 */
export const MICHAEL_RESPONSE_CATALOG: readonly MichaelResponseCatalogEntry[] = [
  entry('michael_next_training_step_en', michaelResponseFixtureNextTrainingStepEn),
  entry('michael_next_training_step_es', michaelResponseFixtureNextTrainingStepEs),
  entry('michael_clarification_question_en', michaelResponseFixtureClarificationQuestionEn),
  entry('michael_clarification_question_es', michaelResponseFixtureClarificationQuestionEs),
  entry(
    'michael_safe_fallback_degraded_en',
    michaelResponseFixtureSafeFallbackDegradedContextPacket,
  ),
  entry(
    'michael_safe_fallback_degraded_es',
    michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  ),
  entry(
    'michael_safe_fallback_missing_en',
    michaelResponseFixtureSafeFallbackMissingContextPacket,
  ),
  entry(
    'michael_safe_fallback_missing_es',
    michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  ),
  entry('michael_safe_close_failed_en', michaelResponseFixtureSafeCloseFailedContextPacket),
  entry('michael_safe_close_failed_es', michaelResponseFixtureSafeCloseFailedContextPacketEs),
  entry(
    'michael_safe_close_rejected_en',
    michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  ),
  entry(
    'michael_safe_close_rejected_es',
    michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  ),
] as const;

/** P1-62 generated response-type registry over the controlled catalog. */
export const MICHAEL_RESPONSE_TYPE_REGISTRY = {
  next_training_step: { substantive: true, allowedScenarioFamilies: ['complete'] },
  clarification_question: { substantive: true, allowedScenarioFamilies: ['complete'] },
  safe_fallback: { substantive: false, allowedScenarioFamilies: ['degraded', 'missing'] },
  safe_close: { substantive: false, allowedScenarioFamilies: ['failed', 'rejected'] },
} as const satisfies Readonly<Record<MichaelResponseType, {
  substantive: boolean;
  allowedScenarioFamilies: readonly MichaelResponseScenarioFamily[];
}>>;

/** P1-62 catalog-key registry generated from the actual controlled entries. */
export const MICHAEL_CATALOG_KEY_REGISTRY: Readonly<Record<string, {
  responseType: MichaelResponseType;
  scenarioFamily: MichaelResponseScenarioFamily;
  contextPacketStatus: MichaelResponseContextPacketStatus;
  language: 'en' | 'es';
  substantive: boolean;
  safePath: boolean;
}>> = Object.freeze(Object.fromEntries(MICHAEL_RESPONSE_CATALOG.map((catalogEntry) => [
  catalogEntry.catalogKey,
  Object.freeze({
    responseType: catalogEntry.responseType,
    scenarioFamily: catalogEntry.scenarioFamily,
    contextPacketStatus: catalogEntry.contextPacketStatus,
    language: catalogEntry.language,
    substantive: catalogEntry.isSubstantive,
    safePath: catalogEntry.isSafePath,
  }),
]))) as Readonly<Record<string, {
  responseType: MichaelResponseType;
  scenarioFamily: MichaelResponseScenarioFamily;
  contextPacketStatus: MichaelResponseContextPacketStatus;
  language: 'en' | 'es';
  substantive: boolean;
  safePath: boolean;
}>>;

const CATALOG_BY_KEY: ReadonlyMap<string, MichaelResponseCatalogEntry> = new Map(
  MICHAEL_RESPONSE_CATALOG.map((catalogEntry) => [catalogEntry.catalogKey, catalogEntry]),
);

/** List every controlled catalog entry (returned-only; no side effects). */
export function listMichaelResponseCatalogEntries(): readonly MichaelResponseCatalogEntry[] {
  return MICHAEL_RESPONSE_CATALOG;
}

/** All catalog keys, in catalog order. */
export function listMichaelResponseCatalogKeys(): readonly string[] {
  return MICHAEL_RESPONSE_CATALOG.map((catalogEntry) => catalogEntry.catalogKey);
}

/**
 * Look up a single catalog entry. Returns `undefined` for unknown keys — the
 * catalog never fabricates or generates an entry.
 */
export function getMichaelResponseCatalogEntry(
  catalogKey: string,
): MichaelResponseCatalogEntry | undefined {
  return CATALOG_BY_KEY.get(catalogKey);
}

/** True only when a controlled entry exists for the given key. */
export function hasMichaelResponseCatalogEntry(catalogKey: string): boolean {
  return CATALOG_BY_KEY.has(catalogKey);
}

/**
 * Validate the entire catalog: every entry must be a valid
 * michael_response_contract.v1, scoped to Michael + training_support, with
 * persistence disabled, no agent-generated output, and no nextStep on a safe
 * path. Pure: no I/O, no LLM, no persistence.
 */
export function validateMichaelResponseCatalog(): MichaelResponseCatalogValidationResult {
  const issues: MichaelResponseCatalogValidationIssue[] = [];

  for (const catalogEntry of MICHAEL_RESPONSE_CATALOG) {
    const { catalogKey, response } = catalogEntry;
    const validation = validateMichaelResponseContract(response);

    if (!validation.ok) {
      issues.push({
        catalogKey,
        code: 'invalid_contract',
        message: 'Catalog entry failed michael_response_contract.v1 validation.',
      });
      continue;
    }

    if (response.agentKey !== MICHAEL_AGENT_KEY) {
      issues.push({
        catalogKey,
        code: 'wrong_agent',
        message: 'Catalog entry is not scoped to michael_magnificent.',
      });
    }

    if (response.taskType !== MICHAEL_TASK_TYPE) {
      issues.push({
        catalogKey,
        code: 'wrong_task',
        message: 'Catalog entry is not scoped to training_support.',
      });
    }

    if (response.persistence !== 'disabled') {
      issues.push({
        catalogKey,
        code: 'persistence_not_disabled',
        message: 'Catalog entry persistence must remain disabled.',
      });
    }

    if (response.agentResponseGenerated !== false) {
      issues.push({
        catalogKey,
        code: 'agent_response_generated',
        message: 'Catalog entry must keep agentResponseGenerated false.',
      });
    }

    if (catalogEntry.isSafePath && response.nextStep !== undefined) {
      issues.push({
        catalogKey,
        code: 'next_step_on_safe_path',
        message: 'Safe-path catalog entries must not carry a nextStep.',
      });
    }
  }

  return {
    ok: issues.length === 0,
    entryCount: MICHAEL_RESPONSE_CATALOG.length,
    issues,
  };
}
