import type {
  MichaelResponseContractV1,
  MichaelResponseContractValidationIssue,
  MichaelResponseContractValidationResult,
  MichaelResponseSafetyValidationStatus,
  MichaelResponseType,
} from './types.js';

const RESPONSE_TYPES = [
  'next_training_step',
  'clarification_question',
  'safe_fallback',
  'safe_close',
] as const satisfies readonly MichaelResponseType[];

const SAFETY_STATUSES = [
  'passed',
  'blocked',
  'degraded',
] as const satisfies readonly MichaelResponseSafetyValidationStatus[];

const CONTEXT_PACKET_STATUSES = ['complete', 'degraded', 'failed', 'missing', 'rejected'] as const;

export const MICHAEL_RESPONSE_CONTRACT_SCHEMA_VERSION =
  'michael_response_contract.v1' as const;

export const MICHAEL_RESPONSE_AGENT_KEY = 'michael_magnificent' as const;

export const MICHAEL_RESPONSE_TASK_TYPE = 'training_support' as const;

export const MICHAEL_RESPONSE_TYPES = RESPONSE_TYPES;

export const MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS = [
  'score',
  'rank',
  'classification',
  'readinessClassification',
  'qualification',
  'prediction',
  'incomeProjection',
  'commissionEstimate',
  'cycleMath',
  'placementPromise',
  'prospectFacingMessage',
  'prospectingList',
  'leadQualification',
  'medicalAdvice',
  'threeAuthorityDecision',
  'sendMessage',
  'callProspect',
  'scheduleCall',
  'autoSend',
  'autoCall',
  'automaticProspecting',
  'knowledgeApproval',
  'persistenceInstruction',
  'rawStoreResults',
  'rawGraphRagResults',
  'rawPERSISTENCEFallbackResponse',
] as const;

export const MICHAEL_RESPONSE_FORBIDDEN_FIELDS =
  MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS;

export const MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELD_ALIASES = [
  'earningsProjection',
  'compensationProjection',
  'cvCalculation',
  'placementGuarantee',
  'prospectQualification',
  'callControl',
] as const;

const PROHIBITED_TEXT_PATTERNS = [
  {
    label: 'income_claim',
    pattern: /\b(?:income|earnings?|commission|compensation|paycheck|checks?|dollars?|paid|get paid|make money|earn money|guaranteed?\s+to\s+make|make\s+\$?\d)|\$\s?\d/i,
  },
  {
    label: 'placement_promise',
    pattern: /\b(?:placement|guarantee|guaranteed|spillover|positioned under|binary leg|leg position)\b/i,
  },
  {
    label: 'cycle_math',
    pattern: /\b(?:cycle|cycles|cycle math|cv|volume points?|binary volume)\b/i,
  },
  {
    label: 'medical_advice',
    pattern: /\b(?:medical advice|diagnose|treat|cure|prescribe|dosage|doctor says|stop taking)\b/i,
  },
  {
    label: 'three_authority',
    pattern: /\b(?:THREE approved|THREE has approved|THREE guarantees|enroll through THREE|THREE authority|official THREE)\b/i,
  },
  {
    label: 'prospect_facing_instruction',
    pattern: /\b(?:send this to your prospect|tell your prospect|tell the prospect|forward this to|share this with a prospect|prospect they are qualified|send this exact page|lead)\b/i,
  },
  {
    label: 'automatic_action',
    pattern: /\b(?:auto-?send|send automatically|call automatically|schedule automatically|automatically\s+(?:send|text|call|schedule)|send texts?|call prospects?|schedule follow-ups?|auto-?call|automatic prospecting|prospecting list|dial)\b/i,
  },
] as const;

const SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN =
  /\b(?:open|review|practice|complete|start|continue)\s+(?:module|lesson|training|script|next step)\b/i;

// S3.3 — Spanish (es) lexical guardrails. These run against a diacritic- and
// case-normalized copy of the text so `comisión`/`comision`/`COMISIÓN` all
// match. They sit ALONGSIDE the English patterns above (English coverage is
// unchanged). Automatic-action terms target instruction forms (infinitive /
// imperative / gerund), not simple past statements like "no se envió nada",
// mirroring how the English guard blocks "send automatically" but not "sent".
const ES_PROHIBITED_TEXT_PATTERNS = [
  {
    label: 'income_claim',
    pattern: /\b(?:ingresos?|ganancias?|comision(?:es)?|compensacion(?:es)?)\b/,
  },
  {
    label: 'placement_promise',
    pattern: /\b(?:colocacion(?:es)?|garantizad[oa]s?|garantia)\b/,
  },
  {
    label: 'medical_advice',
    pattern: /\b(?:medic[oa]s?|salud)\b/,
  },
  {
    label: 'prospect_facing_instruction',
    pattern: /\b(?:prospectos?)\b/,
  },
  {
    label: 'automatic_action',
    pattern:
      /\b(?:automatic[oa]s?|automaticamente|enviar(?:les|le|nos)?|enviando|envien|envie|llamar(?:les|le|nos)?|llamando|llamen|llame|agendar|programar)\b/,
  },
] as const;

// Spanish safe-close substantive-guidance guard: a training verb immediately
// followed by an optional article and a training noun (mirrors the English
// SAFE_CLOSE pattern). Safe phrases like "continúa solo desde contexto de
// entrenamiento" do not match (no article/noun directly after the verb).
const ES_SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN =
  /\b(?:abre|revisa|repasa|practica|completa|empieza|comienza|inicia|continua|sigue|estudia)\s+(?:el|la|los|las|un|una|tu|su|al)?\s*(?:modulo|leccion|entrenamiento|guion|paso|capacitacion|curso|pagina|video)\b/;

/**
 * Normalize text for Spanish lexical scanning: lowercase and strip combining
 * diacritics (NFD decomposition). Pure and deterministic; English text is
 * unaffected by the transform.
 */
function normalizeForLexicalScan(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const TOP_LEVEL_FIELDS = [
  'schemaVersion',
  'responseType',
  'agentKey',
  'taskType',
  'sessionId',
  'turnId',
  'correlationId',
  'contextPacketStatus',
  'language',
  'text',
  'safety',
  'persistence',
  'generatedAt',
  'agentResponseGenerated',
  'contextPacketId',
  'nextStep',
] as const;

const SAFETY_FIELDS = [
  'validationStatus',
  'guardrailIds',
  'blockedReasonCodes',
] as const;

const NEXT_STEP_FIELDS = [
  'label',
  'title',
  'instruction',
  'baOwned',
  'automaticSending',
  'automaticCalling',
  'externalSideEffect',
] as const;

const REQUIRED_TOP_LEVEL_FIELDS = TOP_LEVEL_FIELDS.filter(
  (field) => field !== 'contextPacketId' && field !== 'nextStep',
);

export function validateMichaelResponseContractV1(
  candidate: unknown,
): MichaelResponseContractValidationResult {
  const issues: MichaelResponseContractValidationIssue[] = [];

  if (!isRecord(candidate)) {
    return {
      ok: false,
      issues: [
        issue('', 'not_object', 'Michael response contract must be an object.'),
      ],
    };
  }

  collectForbiddenFieldIssues(candidate, '', issues);
  validateAllowedKeys(candidate, '', TOP_LEVEL_FIELDS, issues);
  validateRequiredFields(candidate, REQUIRED_TOP_LEVEL_FIELDS, issues);

  expectLiteral(
    candidate,
    'schemaVersion',
    MICHAEL_RESPONSE_CONTRACT_SCHEMA_VERSION,
    issues,
  );
  expectEnum(candidate, 'responseType', RESPONSE_TYPES, issues);
  expectLiteral(candidate, 'agentKey', 'michael_magnificent', issues);
  expectLiteral(candidate, 'taskType', 'training_support', issues);
  expectString(candidate, 'sessionId', issues);
  expectString(candidate, 'turnId', issues);
  expectString(candidate, 'correlationId', issues);
  expectEnum(candidate, 'contextPacketStatus', CONTEXT_PACKET_STATUSES, issues);
  expectEnum(candidate, 'language', ['en', 'es'] as const, issues);
  expectString(candidate, 'text', issues);
  expectLiteral(candidate, 'persistence', 'disabled', issues);
  expectTimestamp(candidate, 'generatedAt', issues);
  expectLiteral(candidate, 'agentResponseGenerated', false, issues);
  validateTextContent(candidate.text, 'text', issues);
  validateSafeCloseTextContent(candidate, issues);

  if ('contextPacketId' in candidate) {
    expectString(candidate, 'contextPacketId', issues);
    if (
      candidate.contextPacketStatus === 'failed' ||
      candidate.contextPacketStatus === 'missing' ||
      candidate.contextPacketStatus === 'rejected'
    ) {
      issues.push(
        issue(
          'contextPacketId',
          'context_packet_id_without_valid_packet',
          'contextPacketId is allowed only when a valid Context Packet exists.',
        ),
      );
    }
  }

  validateSafety(candidate.safety, issues);
  validateNextStep(candidate, issues);
  validateContextPacketStatusBehavior(candidate, issues);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    contract: candidate as unknown as MichaelResponseContractV1,
    issues: [],
  };
}

export function validateMichaelResponseContract(
  candidate: unknown,
): MichaelResponseContractValidationResult {
  return validateMichaelResponseContractV1(candidate);
}

export function assertMichaelResponseContractV1(
  candidate: unknown,
): asserts candidate is MichaelResponseContractV1 {
  const result = validateMichaelResponseContractV1(candidate);
  if (!result.ok) {
    throw new MichaelResponseValidationError(result.issues);
  }
}

export function assertValidMichaelResponseContract(
  candidate: unknown,
): asserts candidate is MichaelResponseContractV1 {
  assertMichaelResponseContractV1(candidate);
}

export function isMichaelResponseContractV1(
  candidate: unknown,
): candidate is MichaelResponseContractV1 {
  return validateMichaelResponseContractV1(candidate).ok;
}

export class MichaelResponseValidationError extends Error {
  readonly issues: MichaelResponseContractValidationIssue[];

  constructor(issues: MichaelResponseContractValidationIssue[]) {
    const details = issues
      .map((validationIssue) => `${validationIssue.path}: ${validationIssue.message}`)
      .join('; ');
    super(`Invalid michael_response_contract.v1: ${details}`);
    this.name = 'MichaelResponseValidationError';
    this.issues = issues;
  }
}

function validateSafety(
  value: unknown,
  issues: MichaelResponseContractValidationIssue[],
): void {
  if (!isRecord(value)) {
    issues.push(issue('safety', 'invalid_type', 'safety must be an object.'));
    return;
  }

  validateAllowedKeys(value, 'safety', SAFETY_FIELDS, issues);
  validateRequiredFields(value, SAFETY_FIELDS, issues, 'safety');
  expectEnum(value, 'validationStatus', SAFETY_STATUSES, issues, 'safety');
  expectStringArray(value, 'guardrailIds', issues, 'safety');
  expectStringArray(value, 'blockedReasonCodes', issues, 'safety');
}

function validateNextStep(
  contract: Record<string, unknown>,
  issues: MichaelResponseContractValidationIssue[],
): void {
  const responseType = contract.responseType;
  const value = contract.nextStep;

  if (responseType !== 'next_training_step') {
    if ('nextStep' in contract) {
      issues.push(
        issue(
          'nextStep',
          'next_step_not_allowed',
          'nextStep is allowed only for next_training_step responses.',
        ),
      );
    }
    return;
  }

  if (!('nextStep' in contract)) {
    issues.push(
      issue(
        'nextStep',
        'next_step_required',
        'nextStep is required for next_training_step responses.',
      ),
    );
    return;
  }

  if (!isRecord(value)) {
    issues.push(issue('nextStep', 'invalid_type', 'nextStep must be an object.'));
    return;
  }

  validateAllowedKeys(value, 'nextStep', NEXT_STEP_FIELDS, issues);
  validateRequiredFields(
    value,
    ['baOwned', 'automaticSending', 'automaticCalling', 'externalSideEffect'],
    issues,
    'nextStep',
  );
  expectOptionalString(value, 'title', issues, 'nextStep');
  expectOptionalString(value, 'instruction', issues, 'nextStep');
  expectOptionalString(value, 'label', issues, 'nextStep');
  validateTextContent(value.title, 'nextStep.title', issues);
  validateTextContent(value.instruction, 'nextStep.instruction', issues);
  validateTextContent(value.label, 'nextStep.label', issues);
  expectLiteral(value, 'baOwned', true, issues, 'nextStep');
  expectLiteral(value, 'automaticSending', false, issues, 'nextStep');
  expectLiteral(value, 'automaticCalling', false, issues, 'nextStep');
  expectLiteral(value, 'externalSideEffect', false, issues, 'nextStep');
}

function validateContextPacketStatusBehavior(
  contract: Record<string, unknown>,
  issues: MichaelResponseContractValidationIssue[],
): void {
  const packetStatus = contract.contextPacketStatus;
  const responseType = contract.responseType;

  if (
    (packetStatus === 'failed' || packetStatus === 'missing' || packetStatus === 'rejected') &&
    responseType !== 'safe_fallback' &&
    responseType !== 'safe_close'
  ) {
    issues.push(
      issue(
        'responseType',
        'substantive_response_not_allowed',
        'failed, missing, and rejected Context Packets allow only safe_fallback or safe_close.',
      ),
    );
  }

  if (packetStatus === 'rejected' && responseType !== 'safe_close') {
    issues.push(
      issue(
        'responseType',
        'rejected_context_requires_safe_close',
        'rejected Context Packets require safe_close.',
      ),
    );
  }

  // S3.3 — contract-level strictness: failed Context Packets require safe_close
  // (the adapter already enforces this; this closes the latent gap for any
  // future non-adapter consumer that validates the contract directly).
  if (packetStatus === 'failed' && responseType !== 'safe_close') {
    issues.push(
      issue(
        'responseType',
        'failed_context_requires_safe_close',
        'failed Context Packets require safe_close.',
      ),
    );
  }
}

function collectForbiddenFieldIssues(
  value: unknown,
  path: string,
  issues: MichaelResponseContractValidationIssue[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectForbiddenFieldIssues(item, `${path}[${index}]`, issues),
    );
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (
      (MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS as readonly string[]).includes(key) ||
      (MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELD_ALIASES as readonly string[]).includes(key)
    ) {
      issues.push(
        issue(
          childPath,
          'forbidden_field',
          `Field ${key} is forbidden in michael_response_contract.v1.`,
        ),
      );
    }
    collectForbiddenFieldIssues(child, childPath, issues);
  }
}

function validateTextContent(
  value: unknown,
  path: string,
  issues: MichaelResponseContractValidationIssue[],
): void {
  if (typeof value !== 'string') return;

  for (const { label, pattern } of PROHIBITED_TEXT_PATTERNS) {
    if (!pattern.test(value)) continue;
    issues.push(
      issue(
        path,
        'prohibited_text',
        `Text field ${path} contains prohibited ${label} language.`,
      ),
    );
  }

  // S3.3 — Spanish lexical guardrails over diacritic-/case-normalized text.
  const normalized = normalizeForLexicalScan(value);
  for (const { label, pattern } of ES_PROHIBITED_TEXT_PATTERNS) {
    if (!pattern.test(normalized)) continue;
    issues.push(
      issue(
        path,
        'prohibited_text',
        `Text field ${path} contains prohibited ${label} language.`,
      ),
    );
  }
}

function validateSafeCloseTextContent(
  candidate: Record<string, unknown>,
  issues: MichaelResponseContractValidationIssue[],
): void {
  if (candidate.responseType !== 'safe_close') return;
  if (typeof candidate.text !== 'string') return;

  const matchesEn = SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN.test(candidate.text);
  const matchesEs = ES_SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN.test(
    normalizeForLexicalScan(candidate.text),
  );
  if (!matchesEn && !matchesEs) return;

  issues.push(
    issue(
      'text',
      'prohibited_text',
      'safe_close text cannot include substantive training guidance.',
    ),
  );
}

function validateAllowedKeys(
  value: Record<string, unknown>,
  basePath: string,
  allowed: readonly string[],
  issues: MichaelResponseContractValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    issues.push(
      issue(
        pathOf(basePath, key),
        'unexpected_field',
        `Field ${key} is not part of michael_response_contract.v1.`,
      ),
    );
  }
}

function validateRequiredFields(
  value: Record<string, unknown>,
  required: readonly string[],
  issues: MichaelResponseContractValidationIssue[],
  basePath = '',
): void {
  for (const key of required) {
    if (key in value) continue;
    issues.push(
      issue(
        pathOf(basePath, key),
        'missing_required_field',
        `Field ${key} is required.`,
      ),
    );
  }
}

function expectLiteral<T extends string | boolean>(
  value: Record<string, unknown>,
  key: string,
  expected: T,
  issues: MichaelResponseContractValidationIssue[],
  basePath = '',
): void {
  if (!(key in value)) return;
  if (value[key] === expected) return;
  issues.push(
    issue(
      pathOf(basePath, key),
      'invalid_literal',
      `Field ${key} must be ${String(expected)}.`,
    ),
  );
}

function expectEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  issues: MichaelResponseContractValidationIssue[],
  basePath = '',
): void {
  if (!(key in value)) return;
  const candidate = value[key];
  if (typeof candidate === 'string' && allowed.includes(candidate as T)) return;
  issues.push(
    issue(
      pathOf(basePath, key),
      'invalid_enum',
      `Field ${key} must be one of: ${allowed.join(', ')}.`,
    ),
  );
}

function expectString(
  value: Record<string, unknown>,
  key: string,
  issues: MichaelResponseContractValidationIssue[],
  basePath = '',
): void {
  if (!(key in value)) return;
  if (typeof value[key] === 'string' && value[key].length > 0) return;
  issues.push(
    issue(pathOf(basePath, key), 'invalid_type', `Field ${key} must be a string.`),
  );
}

function expectOptionalString(
  value: Record<string, unknown>,
  key: string,
  issues: MichaelResponseContractValidationIssue[],
  basePath = '',
): void {
  if (!(key in value) || value[key] === undefined) return;
  expectString(value, key, issues, basePath);
}

function expectStringArray(
  value: Record<string, unknown>,
  key: string,
  issues: MichaelResponseContractValidationIssue[],
  basePath = '',
): void {
  if (!(key in value)) return;
  const candidate = value[key];
  if (Array.isArray(candidate) && candidate.every((item) => typeof item === 'string')) {
    return;
  }
  issues.push(
    issue(
      pathOf(basePath, key),
      'invalid_type',
      `Field ${key} must be an array of strings.`,
    ),
  );
}

function expectTimestamp(
  value: Record<string, unknown>,
  key: string,
  issues: MichaelResponseContractValidationIssue[],
): void {
  if (!(key in value)) return;
  const candidate = value[key];
  if (typeof candidate === 'string' && !Number.isNaN(Date.parse(candidate))) return;
  issues.push(
    issue(key, 'invalid_timestamp', `Field ${key} must be an ISO-compatible timestamp.`),
  );
}

function pathOf(basePath: string, key: string): string {
  return basePath ? `${basePath}.${key}` : key;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  path: string,
  code: MichaelResponseContractValidationIssue['code'],
  message: string,
): MichaelResponseContractValidationIssue {
  return { path, code, message };
}
