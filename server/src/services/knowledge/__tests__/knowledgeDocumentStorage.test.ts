import { describe, expect, it } from 'vitest';
import { parseKnowledgeDocumentPointer } from '../knowledgeDocumentStorage.js';

describe('knowledge document pointer', () => {
  it('accepts a complete GridFS pointer and rejects malformed storage references', () => {
    const pointer = {
      storage: 'mongo_gridfs' as const,
      bucketName: 'mcs_knowledge_documents',
      fileId: '507f1f77bcf86cd799439011',
      filename: 'approved-report.pdf',
      mimeType: 'application/pdf',
      originalBytes: 62288,
      sha256: 'a'.repeat(64),
      uploadedAt: '2026-07-17T20:09:43.722Z',
    };
    expect(parseKnowledgeDocumentPointer(pointer)).toEqual(pointer);
    expect(parseKnowledgeDocumentPointer({ ...pointer, fileId: '../../secret' })).toBeNull();
    expect(parseKnowledgeDocumentPointer({ ...pointer, sha256: 'not-a-digest' })).toBeNull();
  });
});
