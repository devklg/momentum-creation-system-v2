export type RuntimeLanguage = 'en' | 'es';

export type RuntimeLanguageFallbackReason =
  | 'same_language_unavailable'
  | 'template_unavailable'
  | 'translation_unavailable'
  | 'machine_translation_marked'
  | 'language_neutral_template'
  | 'clarification_required';

export type RuntimeTranslationStatus =
  | 'not_required'
  | 'same_language'
  | 'human_reviewed_translation'
  | 'machine_translation_marked'
  | 'language_neutral_template'
  | 'clarification_required';

export interface RuntimeLanguageContext {
  primary: RuntimeLanguage;
  detectedFromInput?: RuntimeLanguage;
  userPreference?: RuntimeLanguage;
  fallback?: RuntimeLanguage;
  fallbackReason?: RuntimeLanguageFallbackReason;
  translationAllowed: boolean;
  translationStatus: RuntimeTranslationStatus;
  machineTranslationUsed: boolean;
  humanReviewed: boolean;
}

export interface RuntimeLanguageMetadata {
  language: RuntimeLanguage;
  detectedLanguage?: RuntimeLanguage;
  fallbackLanguage?: RuntimeLanguage;
  fallbackReason?: RuntimeLanguageFallbackReason;
  translationStatus: RuntimeTranslationStatus;
  machineTranslationUsed: boolean;
  humanReviewed: boolean;
}

export type BrowserSpeechLocale = 'en-US' | 'es-US' | 'es-MX' | 'es-ES';
