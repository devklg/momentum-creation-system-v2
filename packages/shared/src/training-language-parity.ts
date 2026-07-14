import { MCS_TRAINING_MODULE_CATALOG } from './training-catalog.js';

export type McsTrainingContentLocale = 'en' | 'es';
export type McsTrainingContentAvailability = 'available' | 'missing';

export interface McsTrainingLanguageVariant {
  locale: McsTrainingContentLocale;
  status: McsTrainingContentAvailability;
  sourcePath: string | null;
  implementedBlockKeys: readonly string[];
}

export interface McsTrainingLanguageParitySurface {
  id: string;
  kind: 'hub' | 'fast_start_module' | 'adjacent_training';
  teamRoute: string;
  requiredBlockKeys: readonly string[];
  variants: Readonly<Record<McsTrainingContentLocale, McsTrainingLanguageVariant>>;
}

const missingSpanish = (): McsTrainingLanguageVariant => ({
  locale: 'es',
  status: 'missing',
  sourcePath: null,
  implementedBlockKeys: [],
});

const availableEnglish = (
  sourcePath: string,
  implementedBlockKeys: readonly string[],
): McsTrainingLanguageVariant => ({
  locale: 'en',
  status: 'available',
  sourcePath,
  implementedBlockKeys,
});

const moduleById = new Map(MCS_TRAINING_MODULE_CATALOG.map((module) => [module.moduleId, module]));

/**
 * P2-114 current training language inventory.
 *
 * `requiredBlockKeys` describe structural content obligations, not translated
 * wording. A future Spanish variant must declare the same block set and its
 * own source path. The current missing state is intentional audit truth; this
 * catalog does not synthesize or machine-translate training copy.
 */
export const MCS_TRAINING_LANGUAGE_PARITY_SURFACES: readonly McsTrainingLanguageParitySurface[] = [
  {
    id: 'fast_start_hub',
    kind: 'hub',
    teamRoute: '/training/fast-start',
    requiredBlockKeys: ['hero', 'module_grid', 'progress_strip', 'program_completion_rule'],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/index.tsx', [
        'hero', 'module_grid', 'progress_strip', 'program_completion_rule',
      ]),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_01_product',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_01_product')!.routes.team,
    requiredBlockKeys: [
      'what_it_is', 'ingredients', 'scientific_authority', 'supported_benefits',
      'product_line', 'closing_belief', 'context_resources', 'completion_control',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/product.tsx', [
        'what_it_is', 'ingredients', 'scientific_authority', 'supported_benefits',
        'product_line', 'closing_belief', 'context_resources', 'completion_control',
      ]),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_02_comp_layer_1',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_02_comp_layer_1')!.routes.team,
    requiredBlockKeys: [
      'cv_definition', 'six_payment_methods', 'cycle_mechanics', 'active_and_qualified',
      'quick_cash_levers', 'closing_belief', 'context_resources', 'completion_control',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/comp-layer-1.tsx', [
        'cv_definition', 'six_payment_methods', 'cycle_mechanics', 'active_and_qualified',
        'quick_cash_levers', 'closing_belief', 'context_resources', 'completion_control',
      ]),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_03_binary',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_03_binary')!.routes.team,
    requiredBlockKeys: [
      'two_legs', 'no_breakage', 'first_mover_structure', 'duplication_rule',
      'duplication_rounds', 'closing_belief', 'context_resources', 'completion_control',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/binary.tsx', [
        'two_legs', 'no_breakage', 'first_mover_structure', 'duplication_rule',
        'duplication_rounds', 'closing_belief', 'context_resources', 'completion_control',
      ]),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_04_prospect_list',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_04_prospect_list')!.routes.team,
    requiredBlockKeys: [
      'names_list', 'sharing_mindset', 'first_touch_script', 'ivory_handoff',
      'numbers_preview', 'context_resources', 'completion_control',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/prospect-list.tsx', [
        'names_list', 'sharing_mindset', 'first_touch_script', 'ivory_handoff',
        'numbers_preview', 'context_resources', 'completion_control',
      ]),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_05_team',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_05_team')!.routes.team,
    requiredBlockKeys: [
      'two_and_stop_correction', 'real_team_model', 'first_72_hours', 'placement_habit',
      'crm_action', 'closing_belief', 'context_resources', 'completion_control',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/team.tsx', [
        'two_and_stop_correction', 'real_team_model', 'first_72_hours', 'placement_habit',
        'crm_action', 'closing_belief', 'context_resources', 'completion_control',
      ]),
      es: missingSpanish(),
    },
  },
  {
    id: 'ten_step_orientation',
    kind: 'adjacent_training',
    teamRoute: '/training/10-steps',
    requiredBlockKeys: [
      'hero', 'steps_01_through_10', 'context_resources', 'success_mantra', 'training_disclaimer',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/10-steps.tsx', [
        'hero', 'steps_01_through_10', 'context_resources', 'success_mantra', 'training_disclaimer',
      ]),
      es: missingSpanish(),
    },
  },
] as const;

export interface McsTrainingLanguageParityFinding {
  surfaceId: string;
  locale: McsTrainingContentLocale;
  kind: 'missing_variant' | 'missing_source' | 'missing_required_blocks';
  missingBlockKeys: string[];
}

function missingBlocks(
  required: readonly string[],
  implemented: readonly string[],
): string[] {
  const implementedSet = new Set(implemented);
  return required.filter((key) => !implementedSet.has(key));
}

export function buildTrainingLanguageParityReport(
  surfaces: readonly McsTrainingLanguageParitySurface[] = MCS_TRAINING_LANGUAGE_PARITY_SURFACES,
) {
  const findings: McsTrainingLanguageParityFinding[] = [];
  const availableByLocale: Record<McsTrainingContentLocale, number> = { en: 0, es: 0 };
  let parityCompleteSurfaceCount = 0;

  for (const surface of surfaces) {
    let surfaceComplete = true;
    for (const locale of ['en', 'es'] as const) {
      const variant = surface.variants[locale];
      if (variant.status === 'missing') {
        findings.push({ surfaceId: surface.id, locale, kind: 'missing_variant', missingBlockKeys: [] });
        surfaceComplete = false;
        continue;
      }
      availableByLocale[locale] += 1;
      if (!variant.sourcePath) {
        findings.push({ surfaceId: surface.id, locale, kind: 'missing_source', missingBlockKeys: [] });
        surfaceComplete = false;
      }
      const missing = missingBlocks(surface.requiredBlockKeys, variant.implementedBlockKeys);
      if (missing.length > 0) {
        findings.push({
          surfaceId: surface.id,
          locale,
          kind: 'missing_required_blocks',
          missingBlockKeys: missing,
        });
        surfaceComplete = false;
      }
    }
    if (surfaceComplete) parityCompleteSurfaceCount += 1;
  }

  return {
    contractVersion: 'training_language_parity.v1' as const,
    requiredLocales: ['en', 'es'] as const,
    surfaceCount: surfaces.length,
    availableByLocale,
    parityCompleteSurfaceCount,
    parityComplete: surfaces.length > 0 && parityCompleteSurfaceCount === surfaces.length,
    findings,
  };
}

export const MCS_TRAINING_LANGUAGE_PARITY_REPORT = buildTrainingLanguageParityReport();
