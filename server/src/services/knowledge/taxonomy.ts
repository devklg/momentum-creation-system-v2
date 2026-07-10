export const KB_TAXONOMY_VERSION = 'kb_taxonomy.v1' as const;

export interface KnowledgeTaxonomyInput {
  title?: string;
  sourceRef?: string;
  domain?: string;
  topicTags?: readonly string[];
}

export interface KnowledgeTaxonomy {
  taxonomyVersion: typeof KB_TAXONOMY_VERSION;
  primaryCategory: string;
  categoryTags: string[];
  productTags: string[];
  topicTags: string[];
  complianceSensitivity: 'none' | 'standard' | 'high';
}

export interface KnowledgeTaxonomyHints {
  categoryTags: string[];
  productTags: string[];
  topicTags: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  'business-building': 'Business Building',
  'compensation-plan': 'Compensation Plan / Business',
  'compliance-policies': 'Compliance / Policies',
  'forms-admin': 'Forms / Admin',
  'general-training': 'General Training',
  'product-science': 'Product Science / Studies',
  products: 'Products',
  'team-training': 'Team Training',
  'vision-strategy': 'Vision / Strategy',
  'wellness-education': 'Wellness Education',
};

export function categoryLabel(slug: string): string {
  return CATEGORY_LABELS[slug] ?? slug;
}

export function classifyKnowledgeTaxonomy(input: KnowledgeTaxonomyInput): KnowledgeTaxonomy {
  const text = searchableText(input);
  const categoryTags = new Set<string>();
  const productTags = new Set<string>();
  const topicTags = new Set<string>((input.topicTags ?? []).map(slugify).filter(Boolean));

  addProducts(text, productTags);
  addTopics(text, topicTags);

  if (matches(text, ['policies', 'policy', 'compliance', 'do and do not', 'do_and_dont', 'income story', 'product story'])) {
    categoryTags.add('compliance-policies');
  }
  if (matches(text, ['compensation', 'financial rewards', 'rewards plan', 'business sheet', '2by2', '2 by 2', 'nueva-comp', 'binary compensation'])) {
    categoryTags.add('compensation-plan');
  }
  if (matches(text, ['enrollment', 'business card', 'calendar', 'registration', 'form'])) {
    categoryTags.add('forms-admin');
  }
  if (matches(text, ['clinical', 'study', 'science', 'absorption', 'bioavail', 'mbc-267', 'peptide', 'third-party testing', 'dossier'])) {
    categoryTags.add('product-science');
  }
  if (
    productTags.size > 0 ||
    matches(text, ['product', 'fact sheet', 'faq', 'price sheet', 'focus group', 'skincare', 'serum', 'cleanse', 'toner', 'caviar'])
  ) {
    categoryTags.add('products');
  }
  if (matches(text, ['social media', 'networking', 'invitation', 'prospect', 'warm market', 'training zoom', 'business approach'])) {
    categoryTags.add('business-building');
  }
  if (matches(text, ['team-magnificent-training', 'onboarding', '72-hour', 'video library', '10 steps', 'training hub', 'success steps'])) {
    categoryTags.add('team-training');
  }
  if (matches(text, ['semantic-context', 'semantic context', 'context-manager', 'context manager', 'memory-gap', 'memory gap', 'runtime trace'])) {
    categoryTags.add('general-training');
  }
  if (matches(text, ['vision', 'strategic foundation'])) {
    categoryTags.add('vision-strategy');
  }
  if (categoryTags.size === 0 && input.sourceRef?.includes('blog.threeinternational')) {
    categoryTags.add('wellness-education');
  }
  if (categoryTags.size === 0 && input.domain === 'organizational') categoryTags.add('forms-admin');
  if (categoryTags.size === 0 && input.domain === 'governance') categoryTags.add('compliance-policies');
  if (categoryTags.size === 0) categoryTags.add('general-training');

  const categories = [...categoryTags].sort(categorySort);
  return {
    taxonomyVersion: KB_TAXONOMY_VERSION,
    primaryCategory: categories[0] ?? 'general-training',
    categoryTags: categories,
    productTags: [...productTags].sort(),
    topicTags: [...topicTags].sort(),
    complianceSensitivity: categories.includes('compliance-policies') || categories.includes('compensation-plan') ? 'high' : 'standard',
  };
}

export function inferTaxonomyHints(query: string): KnowledgeTaxonomyHints {
  const text = normalize(query);
  const taxonomy = classifyKnowledgeTaxonomy({ title: query, sourceRef: '', topicTags: [] });
  const categoryTags = new Set<string>();
  const productTags = new Set(taxonomy.productTags);
  const topicTags = new Set(taxonomy.topicTags);

  for (const category of taxonomy.categoryTags) {
    if (category !== 'wellness-education' && category !== 'general-training') categoryTags.add(category);
  }
  if (matches(text, ['compliance', 'policy', 'policies', 'claim', 'income claim', 'do and do not'])) {
    categoryTags.add('compliance-policies');
  }
  if (matches(text, ['compensation', 'pay plan', 'binary', 'cycle', 'commission', 'financial rewards', '2 by 2'])) {
    categoryTags.add('compensation-plan');
  }
  if (matches(text, ['product', 'ingredient', 'fact sheet', 'faq'])) {
    categoryTags.add('products');
  }

  return {
    categoryTags: [...categoryTags].sort(categorySort),
    productTags: [...productTags].sort(),
    topicTags: [...topicTags].sort(),
  };
}

export function taxonomyFlags(taxonomy: KnowledgeTaxonomy): Record<string, true | string> {
  const flags: Record<string, true | string> = {
    taxonomyVersion: taxonomy.taxonomyVersion,
    taxonomyPrimaryCategory: taxonomy.primaryCategory,
    taxonomyCategoryTags: taxonomy.categoryTags.join('|'),
    taxonomyProductTags: taxonomy.productTags.join('|'),
    taxonomyTopicTags: taxonomy.topicTags.join('|'),
    taxonomyComplianceSensitivity: taxonomy.complianceSensitivity,
  };
  for (const category of taxonomy.categoryTags) flags[`kb.category.${safeKey(category)}`] = true;
  for (const product of taxonomy.productTags) flags[`kb.product.${safeKey(product)}`] = true;
  for (const topic of taxonomy.topicTags) flags[`kb.topic.${safeKey(topic)}`] = true;
  return flags;
}

export function taxonomyFilterFromHints(hints: KnowledgeTaxonomyHints): Record<string, unknown> | undefined {
  const clauses: Array<Record<string, true>> = [];
  for (const product of hints.productTags) clauses.push({ [`kb.product.${safeKey(product)}`]: true });
  for (const category of hints.categoryTags) clauses.push({ [`kb.category.${safeKey(category)}`]: true });
  for (const topic of hints.topicTags.slice(0, 4)) clauses.push({ [`kb.topic.${safeKey(topic)}`]: true });
  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return { $or: clauses };
}

export function safeKey(slug: string): string {
  return slug.replace(/[^a-z0-9_]/g, '_');
}

function categorySort(a: string, b: string): number {
  const order = [
    'compliance-policies',
    'compensation-plan',
    'products',
    'product-science',
    'business-building',
    'team-training',
    'forms-admin',
    'vision-strategy',
    'wellness-education',
    'general-training',
  ];
  return (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) -
    (order.indexOf(b) === -1 ? 999 : order.indexOf(b)) ||
    a.localeCompare(b);
}

function searchableText(input: KnowledgeTaxonomyInput): string {
  return normalize([
    input.title ?? '',
    input.sourceRef ?? '',
    input.domain ?? '',
    ...(input.topicTags ?? []),
  ].join(' '));
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&nbsp;|&amp;|&quot;/g, ' ')
    .toLowerCase();
}

function matches(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(normalize(needle)));
}

function addProducts(text: string, products: Set<string>): void {
  const productNeedles: Record<string, readonly string[]> = {
    'glp-three': ['glp-three', 'glp three', 'glpthree'],
    visage: ['visage', 'serum', 'pure cleanse', 'radiant toner', 'creme caviar', 'crème caviar', 'skincare'],
    kynetik: ['kynetik', 'energy drink', 'clean caffeine'],
    collagene: ['collagene', 'collagène', 'collagen'],
    vitalite: ['vitalite', 'vitalité', 'multivitamin'],
    revive: ['revive', 'revíve', 'superoxide'],
    purifi: ['purifi', 'purifí', 'detox', 'cleanse'],
    imune: ['imune', 'imúne', 'immune'],
    eternel: ['eternel', 'éternel', 'resveratrol'],
    'mbc-267': ['mbc-267', 'peptide complex'],
    'omega-3': ['omega-3', 'fish oil'],
    coq10: ['coq10', 'coq 10'],
    glutathione: ['glutathione'],
  };
  for (const [product, needles] of Object.entries(productNeedles)) {
    if (matches(text, needles)) products.add(product);
  }
}

function addTopics(text: string, topics: Set<string>): void {
  const topicNeedles: Record<string, readonly string[]> = {
    compensation: ['compensation', 'financial rewards', 'binary', 'commission', 'pay plan'],
    compliance: ['compliance', 'policies', 'policy', 'do and do not', 'claims'],
    'business-building': ['business building', 'social media', 'networking', 'prospect', 'invitation'],
    'product-education': ['product', 'fact sheet', 'faq', 'ingredients'],
    skincare: ['skin', 'skincare', 'serum', 'toner', 'cleanse', 'caviar'],
    metabolism: ['metabolic', 'metabolism', 'cravings', 'hormone'],
    'gut-immune': ['gut', 'immune', 'probiotic', 'digestion'],
    detox: ['detox', 'cleanse', 'heavy metals'],
    energy: ['energy', 'caffeine', 'kynetik'],
    'cellular-absorption': ['cellular absorption', 'bioavailability', 'bioavailable'],
  };
  for (const [topic, needles] of Object.entries(topicNeedles)) {
    if (matches(text, needles)) topics.add(topic);
  }
}

function slugify(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
