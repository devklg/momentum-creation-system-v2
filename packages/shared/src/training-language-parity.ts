import { MCS_TRAINING_MODULE_CATALOG } from './training-catalog.js';

export type McsTrainingContentLocale = 'en' | 'es';
export type McsTrainingContentAvailability = 'available' | 'missing';

export interface McsTrainingLanguageVariant {
  locale: McsTrainingContentLocale;
  status: McsTrainingContentAvailability;
  sourcePath: string | null;
  sourceAnchors: Readonly<Record<string, string>>;
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
  sourceAnchors: {},
});

const availableEnglish = (
  sourcePath: string,
  sourceAnchors: Readonly<Record<string, string>>,
): McsTrainingLanguageVariant => ({
  locale: 'en',
  status: 'available',
  sourcePath,
  sourceAnchors,
});

const moduleById = new Map(MCS_TRAINING_MODULE_CATALOG.map((module) => [module.moduleId, module]));

/**
 * P2-114 current training language inventory.
 *
 * `requiredBlockKeys` describe structural content obligations. Each available
 * variant maps those obligations to distinctive literal anchors in its own
 * source file; CI reads that file and verifies every anchor. A future Spanish
 * variant must provide Spanish-source anchors rather than copying an English
 * implementation claim. The current missing state is intentional audit truth.
 */
export const MCS_TRAINING_LANGUAGE_PARITY_SURFACES: readonly McsTrainingLanguageParitySurface[] = [
  {
    id: 'fast_start_hub',
    kind: 'hub',
    teamRoute: '/training/fast-start',
    requiredBlockKeys: ['hero', 'module_grid', 'progress_strip', 'program_completion_rule'],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/index.tsx', {
        hero: 'Your Fast Start',
        module_grid: 'FAST_START_MODULES.map',
        progress_strip: 'label="Modules complete"',
        program_completion_rule: "const fastStartComplete = state.kind === 'ready' ? state.data.complete : false;",
      }),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_01_product',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_01_product')!.routes.team,
    requiredBlockKeys: [
      'what_it_is', 'ingredients', 'scientific_authority', 'supported_benefits',
      'product_line', 'closing_belief',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/product.tsx', {
        what_it_is: '<SectionLabel>What it is</SectionLabel>',
        ingredients: '<SectionLabel>What\'s in it</SectionLabel>',
        scientific_authority: '<SectionTitle>Dr. Dan Gubler.</SectionTitle>',
        supported_benefits: '<SectionLabel>What it supports</SectionLabel>',
        product_line: '<SectionLabel>The product line</SectionLabel>',
        closing_belief: '<SectionTitle>You can\'t share what you don\'t take.</SectionTitle>',
      }),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_02_comp_layer_1',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_02_comp_layer_1')!.routes.team,
    requiredBlockKeys: [
      'cv_definition', 'six_payment_methods', 'cycle_mechanics', 'active_and_qualified',
      'quick_cash_levers', 'closing_belief',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/comp-layer-1.tsx', {
        cv_definition: '<SectionTitle>CV is Commissionable Volume.</SectionTitle>',
        six_payment_methods: '<SectionTitle>Six ways a Brand Ambassador gets paid.</SectionTitle>',
        cycle_mechanics: '<SectionLabel>How volume becomes a check</SectionLabel>',
        active_and_qualified: '<SectionTitle>Active + Qualified.</SectionTitle>',
        quick_cash_levers: '<SectionLabel>Quick cash levers</SectionLabel>',
        closing_belief: '<SectionTitle>You don\'t compute. You teach.</SectionTitle>',
      }),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_03_binary',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_03_binary')!.routes.team,
    requiredBlockKeys: [
      'two_legs', 'no_breakage', 'first_mover_structure', 'duplication_rule',
      'duplication_rounds', 'closing_belief',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/binary.tsx', {
        two_legs: '<SectionTitle>You have two businesses, not one.</SectionTitle>',
        no_breakage: '<SectionTitle>No breakage. Volume flows up from unlimited depth.</SectionTitle>',
        first_mover_structure: '<SectionTitle>First-mover advantage. This is math, not motivation.</SectionTitle>',
        duplication_rule: '<SectionTitle>You sponsor 2. They sponsor 2. They sponsor 2.</SectionTitle>',
        duplication_rounds: '<SectionTitle>14 rounds of duplication, one leg.</SectionTitle>',
        closing_belief: '<SectionTitle>Two. Then teach. That is the whole job.</SectionTitle>',
      }),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_04_prospect_list',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_04_prospect_list')!.routes.team,
    requiredBlockKeys: [
      'names_list', 'sharing_mindset', 'first_touch_script', 'ivory_handoff',
      'numbers_preview',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/prospect-list.tsx', {
        names_list: '<SectionTitle>Your names list is the business.</SectionTitle>',
        sharing_mindset: '<SectionTitle>You are sharing, not selling.</SectionTitle>',
        first_touch_script: '<SectionLabel>The first-touch script</SectionLabel>',
        ivory_handoff: '<SectionTitle>Ivory.</SectionTitle>',
        numbers_preview: '<SectionTitle>This is a numbers game. Honest one.</SectionTitle>',
      }),
      es: missingSpanish(),
    },
  },
  {
    id: 'fast_start_05_team',
    kind: 'fast_start_module',
    teamRoute: moduleById.get('fast_start_05_team')!.routes.team,
    requiredBlockKeys: [
      'two_and_stop_correction', 'real_team_model', 'first_72_hours', 'placement_habit',
      'crm_action', 'closing_belief',
    ],
    variants: {
      en: availableEnglish('apps/team/src/routes/training/fast-start/team.tsx', {
        two_and_stop_correction: '<SectionTitle>"Find two and stop" is the trap.</SectionTitle>',
        real_team_model: '<SectionTitle>22 people in two weeks. From 240 contacts.</SectionTitle>',
        first_72_hours: '<SectionLabel>The first 72 hours</SectionLabel>',
        placement_habit: '<SectionTitle>Far-left, far-right. Balance the org.</SectionTitle>',
        crm_action: '<SectionTitle>Mark your first candidates in the CRM.</SectionTitle>',
        closing_belief: '<SectionTitle>The work is the work.</SectionTitle>',
      }),
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
      en: availableEnglish('apps/team/src/routes/training/10-steps.tsx', {
        hero: '<span className="block">10 Steps to</span>',
        steps_01_through_10: 'STEPS.map',
        context_resources: '<ContextResources contextTag="context:training:10-steps" />',
        success_mantra: '<MantraItem word="People" sub="Build the team" />',
        training_disclaimer: 'For Training Purposes Only · Not a guarantee of income',
      }),
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
  anchors: Readonly<Record<string, string>>,
): string[] {
  return required.filter((key) => !anchors[key]);
}

export function findMissingTrainingSourceAnchors(
  surface: McsTrainingLanguageParitySurface,
  locale: McsTrainingContentLocale,
  sourceText: string,
): string[] {
  const anchors = surface.variants[locale].sourceAnchors;
  return surface.requiredBlockKeys.filter((key) => {
    const anchor = anchors[key];
    return !anchor || !sourceText.includes(anchor);
  });
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
      const missing = missingBlocks(surface.requiredBlockKeys, variant.sourceAnchors);
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
