import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  paginationAuditMetadata,
  parseBaDirectoryQuery,
} from '../bas.js';

describe('P2-131 BA route contract', () => {
  it('validates bounded additive query parameters', () => {
    expect(parseBaDirectoryQuery({}).success).toBe(true);
    expect(parseBaDirectoryQuery({ pageSize: '100', search: 'TMAG-1' }).success).toBe(true);
    expect(parseBaDirectoryQuery({ pageSize: '0' }).success).toBe(false);
    expect(parseBaDirectoryQuery({ pageSize: '101' }).success).toBe(false);
    expect(parseBaDirectoryQuery({ cursor: 'short' }).success).toBe(false);
    expect(parseBaDirectoryQuery({ sort: 'name' }).success).toBe(false);
  });

  it('does not issue the former duplicate legacy roster read', () => {
    const source = readFileSync(fileURLToPath(new URL('../bas.ts', import.meta.url)), 'utf8');
    expect(source).not.toContain('listAllBAsForAdmin');
    expect(source).toContain('bas: page.legacyBas');
  });

  it('keeps pagination audit metadata privacy-minimal', () => {
    const metadata = paginationAuditMetadata({
      pageSize: 50,
      cursorProvided: true,
      searchApplied: true,
      returnedCount: 17,
      hasMore: false,
    });
    expect(metadata).toEqual({
      pageSize: 50,
      cursorProvided: true,
      searchApplied: true,
      returnedCount: 17,
      hasMore: false,
      sort: 'createdAt_desc_tmagId_desc',
    });
    expect(JSON.stringify(metadata)).not.toMatch(/email|phone|token|accessCode|notes|searchTerm/i);
  });
});
