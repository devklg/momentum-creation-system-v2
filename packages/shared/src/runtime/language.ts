export type McsRuntimeLanguage = 'en' | 'es';

export type McsRuntimeLanguageFallbackReason =
  | 'same_language_unavailable'
  | 'template_unavailable'
  | 'translation_unavailable'
  | 'machine_translation_marked'
  | 'language_neutral_template'
  | 'clarification_required';

export type McsRuntimeTranslationStatus =
  | 'not_required'
  | 'same_language'
  | 'human_reviewed_translation'
  | 'machine_translation_marked'
  | 'language_neutral_template'
  | 'clarification_required';

export interface McsRuntimeLanguageContext {
  primary: McsRuntimeLanguage;
  detectedFromInput?: McsRuntimeLanguage;
  userPreference?: McsRuntimeLanguage;
  fallback?: McsRuntimeLanguage;
  fallbackReason?: McsRuntimeLanguageFallbackReason;
  translationAllowed: boolean;
  translationStatus: McsRuntimeTranslationStatus;
  machineTranslationUsed: boolean;
  humanReviewed: boolean;
}

export interface McsRuntimeLanguageMetadata {
  language: McsRuntimeLanguage;
  detectedLanguage?: McsRuntimeLanguage;
  fallbackLanguage?: McsRuntimeLanguage;
  fallbackReason?: McsRuntimeLanguageFallbackReason;
  translationStatus: McsRuntimeTranslationStatus;
  machineTranslationUsed: boolean;
  humanReviewed: boolean;
}

export type McsBrowserSpeechLocale = 'en-US' | 'es-US' | 'es-MX' | 'es-ES';
