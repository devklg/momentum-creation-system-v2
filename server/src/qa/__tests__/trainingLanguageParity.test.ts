import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MCS_TRAINING_LANGUAGE_PARITY_REPORT,
  MCS_TRAINING_LANGUAGE_PARITY_SURFACES,
  MCS_TRAINING_MODULE_CATALOG,
  buildTrainingLanguageParityReport,
  findMissingTrainingSourceAnchors,
} from '@momentum/shared';

const root = path.resolve(process.cwd(), '..');

describe('P2-114 training language parity', () => {
  it('covers the Fast Start hub, every current module, and orientation exactly once', () => {
    expect(MCS_TRAINING_LANGUAGE_PARITY_SURFACES).toHaveLength(7);
    expect(new Set(MCS_TRAINING_LANGUAGE_PARITY_SURFACES.map((surface) => surface.id)).size).toBe(7);

    const moduleSurfaceIds = MCS_TRAINING_LANGUAGE_PARITY_SURFACES
      .filter((surface) => surface.kind === 'fast_start_module')
      .map((surface) => surface.id);
    expect(moduleSurfaceIds).toEqual(MCS_TRAINING_MODULE_CATALOG.map((module) => module.moduleId));
    for (const module of MCS_TRAINING_MODULE_CATALOG) {
      const surface = MCS_TRAINING_LANGUAGE_PARITY_SURFACES.find(
        (candidate) => candidate.id === module.moduleId,
      );
      expect(surface?.teamRoute).toBe(module.routes.team);
      expect(surface?.variants.en.sourcePath).toBe(module.contentSources[0]);
    }
    expect(MCS_TRAINING_LANGUAGE_PARITY_SURFACES.map((surface) => surface.id)).toContain('fast_start_hub');
    expect(MCS_TRAINING_LANGUAGE_PARITY_SURFACES.map((surface) => surface.id)).toContain('ten_step_orientation');
  });

  it('anchors every available language variant to a real source file and every surface to a real route', () => {
    const app = fs.readFileSync(path.join(root, 'apps/team/src/App.tsx'), 'utf8');
    for (const surface of MCS_TRAINING_LANGUAGE_PARITY_SURFACES) {
      expect(app).toContain(`path="${surface.teamRoute}"`);
      for (const locale of ['en', 'es'] as const) {
        const variant = surface.variants[locale];
        if (variant.status === 'available') {
          expect(variant.sourcePath).not.toBeNull();
          expect(fs.existsSync(path.join(root, variant.sourcePath!)), variant.sourcePath!).toBe(true);
        }
      }
    }
  });

  it('requires every declared block anchor to exist in the actual locale source', () => {
    for (const surface of MCS_TRAINING_LANGUAGE_PARITY_SURFACES) {
      for (const locale of ['en', 'es'] as const) {
        const variant = surface.variants[locale];
        if (variant.status !== 'available') continue;
        const sourceText = fs.readFileSync(path.join(root, variant.sourcePath!), 'utf8');
        expect(Object.keys(variant.sourceAnchors).sort()).toEqual([...surface.requiredBlockKeys].sort());
        expect(findMissingTrainingSourceAnchors(surface, locale, sourceText)).toEqual([]);
      }
    }
  });

  it('reports the current English-only gap without pretending parity exists', () => {
    expect(MCS_TRAINING_LANGUAGE_PARITY_REPORT).toMatchObject({
      contractVersion: 'training_language_parity.v1',
      surfaceCount: 7,
      availableByLocale: { en: 7, es: 0 },
      parityCompleteSurfaceCount: 0,
      parityComplete: false,
    });
    expect(MCS_TRAINING_LANGUAGE_PARITY_REPORT.findings).toHaveLength(7);
    expect(MCS_TRAINING_LANGUAGE_PARITY_REPORT.findings.every((finding) => (
      finding.locale === 'es' && finding.kind === 'missing_variant'
    ))).toBe(true);
  });

  it('detects a future declared variant that omits a required content block', () => {
    const surface = MCS_TRAINING_LANGUAGE_PARITY_SURFACES[0]!;
    const report = buildTrainingLanguageParityReport([{
      ...surface,
      variants: {
        en: surface.variants.en,
        es: {
          locale: 'es',
          status: 'available',
          sourcePath: 'apps/team/src/routes/training/fast-start/index.es.tsx',
          sourceAnchors: Object.fromEntries(surface.requiredBlockKeys.slice(1).map((key) => [key, key])),
        },
      },
    }]);

    expect(report.parityComplete).toBe(false);
    expect(report.findings).toEqual([{
      surfaceId: 'fast_start_hub',
      locale: 'es',
      kind: 'missing_required_blocks',
      missingBlockKeys: ['hero'],
    }]);
  });
});
