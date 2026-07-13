export type ResourceContextLink =
  | {
      kind: 'training_module';
      tag: string;
      targetId: string;
      label: string;
      route: string;
    }
  | {
      kind: 'event_material';
      tag: string;
      targetId: string;
      label: string;
      route: string | null;
    };

const LINKS: readonly ResourceContextLink[] = [
  ...[
    [1, 'product', 'The Product'],
    [2, 'comp-layer-1', 'Comp Plan, Layer 1'],
    [3, 'binary', 'The Binary as Two Legs'],
    [4, 'prospect-list', 'Build Your Prospect List'],
    [5, 'team', 'Build Your Team'],
  ].map(([id, slug, label]) => ({
    kind: 'training_module' as const,
    tag: `context:training:fast-start:${id}`,
    targetId: `fast-start:${id}`,
    label: `Fast Start · ${label}`,
    route: `/training/fast-start/${slug}`,
  })),
  {
    kind: 'training_module',
    tag: 'context:training:10-steps',
    targetId: '10-steps',
    label: '10-Step Orientation',
    route: '/training/10-steps',
  },
  {
    kind: 'event_material',
    tag: 'context:event:orientation',
    targetId: 'orientation',
    label: 'New-member orientation',
    route: null,
  },
  {
    kind: 'event_material',
    tag: 'context:event:webinar',
    targetId: 'webinar',
    label: 'Team webinar',
    route: null,
  },
] as const;

const BY_TAG = new Map(LINKS.map((link) => [link.tag, link]));

/**
 * Context links are explicit Kevin-selected metadata. Unknown tags never mint
 * graph nodes, and semantic similarity never creates an association.
 */
export function resourceContextLinksFromTags(tags: readonly string[]): ResourceContextLink[] {
  return [...new Set(tags)]
    .map((tag) => BY_TAG.get(tag))
    .filter((link): link is ResourceContextLink => link !== undefined);
}
