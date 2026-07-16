import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_CORRECTION_COLLECTION,
  KNOWLEDGE_CORRECTION_INDEX_DEFINITIONS,
} from '../knowledgeCorrectionSchema.js';

describe('ACR-0029 index definitions', () => {
  it('defines idempotency and bounded lifecycle indexes without authorizing live apply', () => {
    expect(KNOWLEDGE_CORRECTION_COLLECTION).toBe('mcs_knowledge_corrections');
    expect(KNOWLEDGE_CORRECTION_INDEX_DEFINITIONS.map((index) => index.name)).toEqual([
      'unique_knowledge_correction_idempotency',
      'knowledge_correction_state_updated',
      'knowledge_source_version_list',
      'knowledge_chunk_source_version_lifecycle',
    ]);
    expect(KNOWLEDGE_CORRECTION_INDEX_DEFINITIONS.every((index) => index.liveApplyAuthorized === false)).toBe(true);
    expect(KNOWLEDGE_CORRECTION_INDEX_DEFINITIONS[0]).toMatchObject({
      keys: { idempotencyKey: 1 },
      unique: true,
    });
  });
});
