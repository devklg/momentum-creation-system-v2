import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCS_TRAINING_MODULE_CATALOG } from '@momentum/shared';

const root = path.resolve(process.cwd(), '..');

describe('PDR report as the Product Training foundation', () => {
  it('puts the report and opening discussion before all individual-product instruction', () => {
    const page = readFileSync(
      path.join(root, 'apps/team/src/routes/training/fast-start/product.tsx'),
      'utf8',
    );
    const foundation = page.indexOf('What is it? What is its significance? What does it mean to you?');
    const firstProduct = page.indexOf('GLP&#8209;THREE™ — the first product to understand.');

    expect(foundation).toBeGreaterThan(-1);
    expect(page).toContain("MICHAEL'S OPENING DISCUSSION");
    expect(page).toContain('Open / Print PDF');
    expect(page).toContain('knowledge_source_e0951cff-eeb0-45d2-b6c4-e491342c05ac:v2');
    expect(firstProduct).toBeGreaterThan(foundation);
  });

  it('introduces Michael as the owner and guide of the Product Training template', () => {
    const page = readFileSync(
      path.join(root, 'apps/team/src/routes/training/fast-start/product.tsx'),
      'utf8',
    );
    expect(page).toContain('Michael Magnificent · Your Learning, Development, and Training Agent');
    expect(page).toContain('You do not need any background');
    expect(page).toContain('make sure the words on');
    expect(page).toContain('This module is one of his core training templates.');
    expect(page).toContain('The benefit of AI-guided learning, development, and training');
    expect(page).toContain('This is a cutting-edge member benefit that is not yet commonplace.');
    expect(page).toContain('THREE International does not provide AI agents.');
  });

  it('explains Steve, Michael, and Ivory before relying on agent context', () => {
    const page = readFileSync(
      path.join(root, 'apps/team/src/routes/training/fast-start/product.tsx'),
      'utf8',
    );
    const steve = page.indexOf('Steve Success');
    const michael = page.indexOf('Michael Magnificent');
    const ivory = page.indexOf('Ivory');
    expect(steve).toBeGreaterThan(-1);
    expect(michael).toBeGreaterThan(steve);
    expect(ivory).toBeGreaterThan(michael);
    expect(page).toContain('without scoring, ranking, or predicting you');
    expect(page).toContain('without qualifying them or contacting anyone for you');
    expect(page).toContain('Team Magnificent is the only team in THREE International currently providing this AI');
    expect(page).toContain('Develop professional network marketers.');
    expect(page).toContain('professional-level commission');
    expect(page).toContain('Commissions are determined and paid by THREE');
    expect(page).toContain('according to their compensation structure');
    expect(page).toContain('commission-based contractual relationship');
    expect(page).toContain('No commission amount or income result is');
    expect(page).toContain('This training is not theory.');
    expect(page).toContain('from direct experience');
    expect(page).toContain('professional chef who can also run the restaurant');
    expect(page).toMatch(/Knowing the\s+products is knowing the ingredients\./);
    expect(page).toContain('Culinary Institute of America');
    expect(page).toContain('structured learning plus guided work');
    expect(page).toContain('To become masterful, you apprentice or learn from other masters.');
    expect(page).toContain('That is what Team');
  });

  it('implements the authorized product video library inside Module 1 with working links', () => {
    const page = readFileSync(
      path.join(root, 'apps/team/src/routes/training/fast-start/product.tsx'),
      'utf8',
    );

    expect(page).toContain('href="#product-video-library"');
    expect(page).toContain('id="product-video-library"');
    expect(page).toContain('MCS_PRODUCT_CATALOG.map');
    expect(page).toContain('https://www.youtube.com/watch?v=${video.youtubeId}');
    expect(page).toContain('target="_blank"');
    expect(page).not.toContain('to="/video-library"');
  });

  it('uses the approved report language for the in-module significance cards', () => {
    const page = readFileSync(
      path.join(root, 'apps/team/src/routes/training/fast-start/product.tsx'),
      'utf8',
    );
    expect(page).toContain('The Physicians&apos; Desk Reference is not a marketing directory');
    expect(page).toContain('A single PDR listing is a product decision. A complete-catalog listing');
    expect(page).toContain('The PDR position doesn&apos;t grant quality — it reveals it.');
    expect(page).toContain('all nine');
  });

  it('keeps the approved PDF available to authenticated Module 1 members before Steve completion', () => {
    const route = readFileSync(path.join(root, 'server/src/routes/resources.ts'), 'utf8');
    expect(route).toContain(
      "resourceRoutes.get('/:resourceVersionId/document', requireAuth, async (req, res) =>",
    );
    expect(route).not.toContain(
      "resourceRoutes.get('/:resourceVersionId/document', requireAuth, requireSteveComplete",
    );
  });

  it('records the foundational source and required sequence in the training authority', () => {
    const product = MCS_TRAINING_MODULE_CATALOG.find(
      (module) => module.moduleId === 'fast_start_01_product',
    );
    const sources = readFileSync(path.join(root, 'docs/training-sources.md'), 'utf8');

    expect(product?.contentSources).toContain(
      'docs/training-sources.md#6-the-pdr-position-required-product-training-foundation',
    );
    expect(sources).toContain('this is the **first document** and **opening discussion**');
    expect(sources).toContain('in Product Training for **every member**');
    expect(sources).toContain('foundational curriculum, not');
  });
});
