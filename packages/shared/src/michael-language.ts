/**
 * Canonical Michael runtime language and fallback policy.
 *
 * This file owns the already-approved, pre-authored EN/ES response words, the
 * Context Packet safe-path mapping, and the current English-only UI chrome.
 * Consumers must reference these constants instead of copying language into
 * server fixtures or the `.team` card. Changing a value is a governed language
 * change; moving a consumer to this source is not approval to rewrite it.
 */

export const MICHAEL_RUNTIME_LANGUAGE_AUTHORITY_VERSION = '1.0.0' as const;

export type MichaelRuntimeLanguage = 'en' | 'es';
export type MichaelRuntimeFallbackScenario = 'degraded' | 'missing' | 'failed' | 'rejected';
export type MichaelRuntimeFallbackResponseType = 'safe_fallback' | 'safe_close';

export const MICHAEL_RUNTIME_SUPPORTED_LANGUAGES = [
  'en',
  'es',
] as const satisfies readonly MichaelRuntimeLanguage[];

export const MICHAEL_RUNTIME_FALLBACK_SCENARIOS = [
  'degraded',
  'missing',
  'failed',
  'rejected',
] as const satisfies readonly MichaelRuntimeFallbackScenario[];

export const MICHAEL_RUNTIME_FALLBACK_POLICY = {
  degraded: { responseType: 'safe_fallback', behavior: 'return_controlled_copy' },
  missing: { responseType: 'safe_fallback', behavior: 'return_controlled_copy' },
  failed: { responseType: 'safe_close', behavior: 'close_without_side_effects' },
  rejected: { responseType: 'safe_close', behavior: 'close_without_side_effects' },
} as const satisfies Readonly<
  Record<
    MichaelRuntimeFallbackScenario,
    { responseType: MichaelRuntimeFallbackResponseType; behavior: string }
  >
>;

export const MICHAEL_RUNTIME_RESPONSE_COPY = {
  nextTrainingStep: {
    en: {
      text: 'Review the next training step, then write down one question you want your sponsor to help you practice.',
      nextStep: {
        title: 'Review the next training step',
        instruction:
          'Open the next training step and make one private note about what you want to practice.',
      },
    },
    es: {
      text: 'Repasa el siguiente paso de entrenamiento y anota una pregunta para practicarla con tu patrocinador.',
      nextStep: {
        title: 'Repasa el siguiente paso',
        instruction:
          'Abre el siguiente paso de entrenamiento y escribe una nota privada sobre lo que quieres practicar.',
      },
    },
  },
  clarificationQuestion: {
    en: {
      text: 'Which part would help most right now: understanding the two-leg structure, practicing your words, or choosing the next training page?',
    },
    es: {
      text: '¿Qué te ayudaría más ahora: entender la estructura de dos piernas, practicar tus palabras o elegir la próxima página de entrenamiento?',
    },
  },
  safeFallback: {
    degraded: {
      en: {
        text: 'I have limited context right now, so keep this simple: continue with the next training step and ask your sponsor before making any outside commitment.',
      },
      es: {
        text: 'Ahora tengo contexto limitado, así que mantengámoslo sencillo: sigue con tu entrenamiento y consulta a tu patrocinador antes de cualquier compromiso externo.',
      },
    },
    missing: {
      en: {
        text: 'I do not have the training context I need. Please return to the training page or ask your sponsor for the next step.',
      },
      es: {
        text: 'No tengo el contexto de entrenamiento que necesito. Por favor regresa a la página de entrenamiento o pide a tu patrocinador el siguiente paso.',
      },
    },
  },
  safeClose: {
    failed: {
      en: {
        text: 'I cannot continue this training turn without a valid Context Packet. Nothing was saved or sent.',
      },
      es: {
        text: 'No puedo continuar este turno de entrenamiento sin un Context Packet válido. No se guardó ni se envió nada.',
      },
    },
    rejected: {
      en: {
        text: 'I cannot use candidate or review-only context for this turn. Please continue from approved training context only.',
      },
      es: {
        text: 'No puedo usar contexto candidato o de solo revisión en este turno. Por favor continúa solo desde contexto de entrenamiento aprobado.',
      },
    },
  },
} as const;

/**
 * Current `.team` runtime-card chrome. The card has no approved language
 * selector yet, so its chrome remains English while controlled response bodies
 * support EN/ES. Do not invent translated chrome in a consumer.
 */
export const MICHAEL_RUNTIME_UI_COPY = {
  en: {
    regionLabel: 'Michael runtime training support',
    heading: 'Michael · Training Support',
    askLabel: 'Ask Michael about training',
    askPlaceholder: 'Ask about training...',
    sendLabel: 'Send training question',
    tryAgain: 'Try again',
    loading: 'Bringing up your next training step…',
    disabledBody:
      'Michael is your training guide. When it’s switched on, this is where your next suggested training step shows up — a calm pointer to what to learn or practice next.',
    disabledStatus: 'Not available yet',
    responseDisabled:
      'Michael is on, but training guidance is paused right now. Check back a little later for your next suggested step.',
    emptySafeFallback:
      'No specific step to suggest right now — keep working your usual training rhythm.',
    emptySafeClose: 'Nothing more to add for now. You’re good to keep going.',
    nextStepLabel: 'Your next step',
    guidanceLabel: 'Guidance',
    genericError:
      'Couldn’t load a training step just now. Nothing’s wrong on your end — try again a little later.',
  },
} as const;
