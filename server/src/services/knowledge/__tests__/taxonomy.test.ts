import { describe, expect, it } from 'vitest';
import {
  classifyKnowledgeTaxonomy,
  inferTaxonomyHints,
  taxonomyFilterFromHints,
  taxonomyFlags,
} from '../taxonomy.js';

describe('knowledge taxonomy', () => {
  it('classifies product content separately from general training', () => {
    const taxonomy = classifyKnowledgeTaxonomy({
      title: 'How GLP THREE Supports Healthy Metabolism',
      sourceRef: 'url:https://blog.threeinternational.com/glp-three-metabolism',
      domain: 'training',
      topicTags: ['product'],
    });

    expect(taxonomy).toMatchObject({
      taxonomyVersion: 'kb_taxonomy.v1',
      primaryCategory: 'products',
      complianceSensitivity: 'standard',
    });
    expect(taxonomy.categoryTags).toEqual(expect.arrayContaining(['products']));
    expect(taxonomy.productTags).toEqual(expect.arrayContaining(['glp-three']));
    expect(taxonomy.topicTags).toEqual(expect.arrayContaining(['metabolism', 'product-education']));
  });

  it('classifies compensation and compliance as distinct categories', () => {
    const compensation = classifyKnowledgeTaxonomy({
      title: 'THREE Financial Rewards Plan NAM English',
      sourceRef: 'file:D:/THREE/compensation/financial-rewards.pdf',
      domain: 'training',
    });
    const compliance = classifyKnowledgeTaxonomy({
      title: 'Do and Do Not Income Story',
      sourceRef: 'file:D:/THREE/policies/income-story.pdf',
      domain: 'governance',
    });

    expect(compensation.primaryCategory).toBe('compensation-plan');
    expect(compensation.topicTags).toContain('compensation');
    expect(compliance.primaryCategory).toBe('compliance-policies');
    expect(compliance.complianceSensitivity).toBe('high');
  });

  it('emits Chroma-safe flags and taxonomy filters for runtime hints', () => {
    const hints = inferTaxonomyHints('Visage skincare serum');
    const where = taxonomyFilterFromHints(hints);
    const flags = taxonomyFlags(classifyKnowledgeTaxonomy({
      title: 'Visage Super Serum',
      domain: 'training',
    }));

    expect(where).toEqual({
      $or: expect.arrayContaining([
        { 'kb.product.visage': true },
        { 'kb.category.products': true },
        { 'kb.topic.skincare': true },
      ]),
    });
    expect(flags).toMatchObject({
      taxonomyVersion: 'kb_taxonomy.v1',
      taxonomyPrimaryCategory: 'products',
      'kb.product.visage': true,
      'kb.category.products': true,
      'kb.topic.skincare': true,
    });
  });
});
