import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('knowledge correction decision projection', () => {
  it('projects decided_at into Chroma because exact readback requires it', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/services/knowledge/knowledgeCorrectionStore.ts'),
      'utf8',
    );
    expect(source).toContain('decided_at: decision.decided_at');
  });
});
