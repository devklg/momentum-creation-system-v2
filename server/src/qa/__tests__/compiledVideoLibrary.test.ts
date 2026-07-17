import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const catalog = readFileSync(
  resolve(repoRoot, 'apps/team/src/routes/video-library-catalog.ts'),
  'utf8',
);
const page = readFileSync(
  resolve(repoRoot, 'apps/team/src/routes/video-library.tsx'),
  'utf8',
);

describe('compiled Team Magnificent video library', () => {
  it('ships the established GitHub catalog instead of an empty-state gallery', () => {
    expect(catalog).toContain('9895369a6640491fd7ee0e85a5475429ca758cd3');
    expect(catalog).toContain("youtube('GLP THREE', 1, '1IZiV7RXdCY'");
    expect(catalog).toContain("youtube('PRODUCTS', 2, 'dEO_A-Q5pTE'");
    expect(catalog).toContain('PLbYmyx2Gv3LRQJO7rGbCy6Lj0JzJkRTiI');
    expect(page).toContain('COMPILED_VIDEO_LIBRARY_SECTIONS');
    expect(page).not.toContain('No gallery videos are active yet');
  });

  it('keeps shorts product-focused and compensation resources member-only', () => {
    expect(catalog.match(/youtube\('GLP THREE'/g)).toHaveLength(17);
    expect(catalog.match(/youtube\('PRODUCTS'/g)).toHaveLength(24);
    expect(catalog).not.toContain("youtube('COMPENSATION PLAN'");
    expect(catalog.match(/contentVideoId: 'compiled-compensation-/g)).toHaveLength(2);
    expect(catalog.match(/audience: 'member'/g)).toHaveLength(2);
    expect(catalog).not.toContain("youtube('GLP THREE', 2, 'jGG1nSu9s94'");
  });

  it('retains Vimeo playback and merges unique future admin additions', () => {
    expect(catalog).toContain('player.vimeo.com/video/1157693865');
    expect(page).toContain('mergeLibrarySections');
    expect(page).toContain('hasExternalEmbed');
    expect(page).toContain('allow="autoplay; fullscreen; picture-in-picture"');
  });
});
