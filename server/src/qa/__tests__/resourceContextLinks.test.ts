import { describe, expect, it } from 'vitest';
import { resourceContextLinksFromTags } from '../../domain/resourceContextLinks.js';

describe('P2-101 explicit resource context links', () => {
  it('maps only known human-selected training and event tags', () => {
    expect(resourceContextLinksFromTags([
      'context:training:fast-start:1',
      'context:event:orientation',
      'product-education',
      'context:training:invented',
    ])).toEqual([
      expect.objectContaining({ kind: 'training_module', targetId: 'fast-start:1' }),
      expect.objectContaining({ kind: 'event_material', targetId: 'orientation' }),
    ]);
  });

  it('deduplicates repeated explicit links', () => {
    expect(resourceContextLinksFromTags([
      'context:training:10-steps',
      'context:training:10-steps',
    ])).toHaveLength(1);
  });
});
