import type {
  CorrelationId,
  RuntimeTurnId,
  SessionId,
} from '@momentum/shared/runtime';
import type { MichaelResponseContractV1 } from '../types.js';

const SESSION_ID = 'session_s2_12_michael_response_fixture' as SessionId;
const TURN_ID = 'turn_s2_12_michael_response_fixture' as RuntimeTurnId;
const CORRELATION_ID = 'corr_s2_12_michael_response_fixture' as CorrelationId;
const GENERATED_AT = '2026-06-28T12:00:12.000Z';
const COMPLETE_CONTEXT_PACKET_ID = 'ctx_s2_12_michael_complete';
const DEGRADED_CONTEXT_PACKET_ID = 'ctx_s2_12_michael_degraded';

function baseFixture(
  overrides: Pick<
    MichaelResponseContractV1,
    'responseType' | 'contextPacketStatus' | 'language' | 'text' | 'safety'
  > &
    Partial<Pick<MichaelResponseContractV1, 'contextPacketId' | 'nextStep'>>,
): MichaelResponseContractV1 {
  return {
    schemaVersion: 'michael_response_contract.v1',
    responseType: overrides.responseType,
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    sessionId: SESSION_ID,
    turnId: TURN_ID,
    correlationId: CORRELATION_ID,
    contextPacketStatus: overrides.contextPacketStatus,
    language: overrides.language,
    text: overrides.text,
    safety: overrides.safety,
    persistence: 'disabled',
    generatedAt: GENERATED_AT,
    agentResponseGenerated: false,
    ...(overrides.contextPacketId ? { contextPacketId: overrides.contextPacketId } : {}),
    ...(overrides.nextStep ? { nextStep: overrides.nextStep } : {}),
  };
}

const validSafety = {
  validationStatus: 'passed',
  guardrailIds: [
    'no_prospect_facing_language',
    'no_income_or_placement_claims',
    'no_automatic_actions',
  ],
  blockedReasonCodes: [],
} satisfies MichaelResponseContractV1['safety'];

const safeFallbackSafety = {
  validationStatus: 'degraded',
  guardrailIds: ['mandatory_text_fallback', 'context_packet_required'],
  blockedReasonCodes: [],
} satisfies MichaelResponseContractV1['safety'];

const blockedSafety = {
  validationStatus: 'blocked',
  guardrailIds: ['context_packet_required', 'candidate_knowledge_excluded_by_default'],
  blockedReasonCodes: ['context_packet_unavailable'],
} satisfies MichaelResponseContractV1['safety'];

export const michaelResponseFixtureNextTrainingStepEn = baseFixture({
  responseType: 'next_training_step',
  contextPacketStatus: 'complete',
  contextPacketId: COMPLETE_CONTEXT_PACKET_ID,
  language: 'en',
  text: 'Review the next training step, then write down one question you want your sponsor to help you practice.',
  safety: validSafety,
  nextStep: {
    title: 'Review the next training step',
    instruction:
      'Open the next training step and make one private note about what you want to practice.',
    baOwned: true,
    automaticSending: false,
    automaticCalling: false,
    externalSideEffect: false,
  },
});

export const michaelResponseFixtureNextTrainingStepEs = baseFixture({
  responseType: 'next_training_step',
  contextPacketStatus: 'complete',
  contextPacketId: COMPLETE_CONTEXT_PACKET_ID,
  language: 'es',
  text: 'Repasa el siguiente paso de entrenamiento y anota una pregunta para practicarla con tu patrocinador.',
  safety: validSafety,
  nextStep: {
    title: 'Repasa el siguiente paso',
    instruction:
      'Abre el siguiente paso de entrenamiento y escribe una nota privada sobre lo que quieres practicar.',
    baOwned: true,
    automaticSending: false,
    automaticCalling: false,
    externalSideEffect: false,
  },
});

export const michaelResponseFixtureClarificationQuestionEn = baseFixture({
  responseType: 'clarification_question',
  contextPacketStatus: 'complete',
  contextPacketId: COMPLETE_CONTEXT_PACKET_ID,
  language: 'en',
  text: 'Which part would help most right now: understanding the two-leg structure, practicing your words, or choosing the next training page?',
  safety: validSafety,
});

export const michaelResponseFixtureClarificationQuestionEs = baseFixture({
  responseType: 'clarification_question',
  contextPacketStatus: 'complete',
  contextPacketId: COMPLETE_CONTEXT_PACKET_ID,
  language: 'es',
  text: '¿Qué te ayudaría más ahora: entender la estructura de dos piernas, practicar tus palabras o elegir la próxima página de entrenamiento?',
  safety: validSafety,
});

export const michaelResponseFixtureSafeFallbackDegradedContextPacket = baseFixture({
  responseType: 'safe_fallback',
  contextPacketStatus: 'degraded',
  contextPacketId: DEGRADED_CONTEXT_PACKET_ID,
  language: 'en',
  text: 'I have limited context right now, so keep this simple: continue with the next training step and ask your sponsor before making any outside commitment.',
  safety: safeFallbackSafety,
});

export const michaelResponseFixtureSafeFallbackMissingContextPacket = baseFixture({
  responseType: 'safe_fallback',
  contextPacketStatus: 'missing',
  language: 'en',
  text: 'I do not have the training context I need. Please return to the training page or ask your sponsor for the next step.',
  safety: safeFallbackSafety,
});

export const michaelResponseFixtureSafeCloseFailedContextPacket = baseFixture({
  responseType: 'safe_close',
  contextPacketStatus: 'failed',
  language: 'en',
  text: 'I cannot continue this training turn without a valid Context Packet. Nothing was saved or sent.',
  safety: blockedSafety,
});

export const michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection = baseFixture({
  responseType: 'safe_close',
  contextPacketStatus: 'rejected',
  language: 'en',
  text: 'I cannot use candidate or review-only context for this turn. Please continue from approved training context only.',
  safety: {
    ...blockedSafety,
    blockedReasonCodes: ['candidate_review_only_context_rejected'],
  },
});

// S2.16 — Spanish (`es`) safe-path fixtures. These mirror the English safe-path
// set 1:1 so the inert Michael adapter can return a validated Spanish safe
// response on every degraded / missing / failed / rejected-family path when the
// resolved language is `es`. They remain controlled, pre-authored text: no
// dynamic generation, no persistence, agentResponseGenerated stays false.
export const michaelResponseFixtureSafeFallbackDegradedContextPacketEs = baseFixture({
  responseType: 'safe_fallback',
  contextPacketStatus: 'degraded',
  contextPacketId: DEGRADED_CONTEXT_PACKET_ID,
  language: 'es',
  text: 'Ahora tengo contexto limitado, así que mantengámoslo sencillo: sigue con tu entrenamiento y consulta a tu patrocinador antes de cualquier compromiso externo.',
  safety: safeFallbackSafety,
});

export const michaelResponseFixtureSafeFallbackMissingContextPacketEs = baseFixture({
  responseType: 'safe_fallback',
  contextPacketStatus: 'missing',
  language: 'es',
  text: 'No tengo el contexto de entrenamiento que necesito. Por favor regresa a la página de entrenamiento o pide a tu patrocinador el siguiente paso.',
  safety: safeFallbackSafety,
});

export const michaelResponseFixtureSafeCloseFailedContextPacketEs = baseFixture({
  responseType: 'safe_close',
  contextPacketStatus: 'failed',
  language: 'es',
  text: 'No puedo continuar este turno de entrenamiento sin un Context Packet válido. No se guardó ni se envió nada.',
  safety: blockedSafety,
});

export const michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs = baseFixture({
  responseType: 'safe_close',
  contextPacketStatus: 'rejected',
  language: 'es',
  text: 'No puedo usar contexto candidato o de solo revisión en este turno. Por favor continúa solo desde contexto de entrenamiento aprobado.',
  safety: {
    ...blockedSafety,
    blockedReasonCodes: ['candidate_review_only_context_rejected'],
  },
});

export const michaelResponseInvalidFixtureWithForbiddenScoringField: unknown = {
  ...michaelResponseFixtureClarificationQuestionEn,
  score: 92,
};

export const michaelResponseInvalidFixtureWithForbiddenProspectFacingField: unknown = {
  ...michaelResponseFixtureClarificationQuestionEn,
  prospectFacingMessage: 'Send this to your prospect.',
};

export const michaelResponseInvalidFixtureWithForbiddenAutomaticActionField: unknown = {
  ...michaelResponseFixtureNextTrainingStepEn,
  autoSend: true,
};

export const michaelResponseInvalidFixtureWithWrongTaskType: unknown = {
  ...michaelResponseFixtureClarificationQuestionEn,
  taskType: 'success_interview',
};

export const michaelResponseInvalidFixtureWithWrongAgentKey: unknown = {
  ...michaelResponseFixtureClarificationQuestionEn,
  agentKey: 'steve_success',
};

export const michaelResponseInvalidFixtureWithPersistenceNotDisabled: unknown = {
  ...michaelResponseFixtureClarificationQuestionEn,
  persistence: 'enabled',
};

export const validMichaelResponseFixtures = [
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureNextTrainingStepEs,
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureClarificationQuestionEs,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  michaelResponseFixtureSafeCloseFailedContextPacketEs,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
] as const;

export const invalidMichaelResponseFixtures = [
  michaelResponseInvalidFixtureWithForbiddenScoringField,
  michaelResponseInvalidFixtureWithForbiddenProspectFacingField,
  michaelResponseInvalidFixtureWithForbiddenAutomaticActionField,
  michaelResponseInvalidFixtureWithWrongTaskType,
  michaelResponseInvalidFixtureWithWrongAgentKey,
  michaelResponseInvalidFixtureWithPersistenceNotDisabled,
] as const;

export const michaelResponseFixtures = {
  nextTrainingStepEn: michaelResponseFixtureNextTrainingStepEn,
  nextTrainingStepEs: michaelResponseFixtureNextTrainingStepEs,
  clarificationQuestionEn: michaelResponseFixtureClarificationQuestionEn,
  clarificationQuestionEs: michaelResponseFixtureClarificationQuestionEs,
  safeFallbackDegradedContextPacket:
    michaelResponseFixtureSafeFallbackDegradedContextPacket,
  safeFallbackMissingContextPacket: michaelResponseFixtureSafeFallbackMissingContextPacket,
  safeCloseFailedContextPacket: michaelResponseFixtureSafeCloseFailedContextPacket,
  safeCloseCandidateReviewOnlyRejection:
    michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  safeFallbackDegradedContextPacketEs:
    michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  safeFallbackMissingContextPacketEs:
    michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  safeCloseFailedContextPacketEs: michaelResponseFixtureSafeCloseFailedContextPacketEs,
  safeCloseCandidateReviewOnlyRejectionEs:
    michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  invalidWithForbiddenScoringField:
    michaelResponseInvalidFixtureWithForbiddenScoringField,
  invalidWithForbiddenProspectFacingField:
    michaelResponseInvalidFixtureWithForbiddenProspectFacingField,
  invalidWithForbiddenAutomaticActionField:
    michaelResponseInvalidFixtureWithForbiddenAutomaticActionField,
  invalidWithWrongTaskType: michaelResponseInvalidFixtureWithWrongTaskType,
  invalidWithWrongAgentKey: michaelResponseInvalidFixtureWithWrongAgentKey,
  invalidWithPersistenceNotDisabled:
    michaelResponseInvalidFixtureWithPersistenceNotDisabled,
} as const;

export type MichaelResponseFixtureKey = keyof typeof michaelResponseFixtures;

export const michaelResponseFixtureEntries = Object.entries(michaelResponseFixtures) as Array<
  [MichaelResponseFixtureKey, (typeof michaelResponseFixtures)[MichaelResponseFixtureKey]]
>;
