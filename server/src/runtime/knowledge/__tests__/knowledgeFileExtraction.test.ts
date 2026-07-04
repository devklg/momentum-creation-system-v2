import { describe, expect, it } from 'vitest';
import {
  extractKnowledgeFile,
  KnowledgeFileExtractionError,
  resolveFileKind,
} from '../knowledgeFileExtraction.js';

describe('knowledge file extraction', () => {
  it('resolves supported file kinds by extension and MIME type', () => {
    expect(resolveFileKind('guide.md')).toBe('markdown');
    expect(resolveFileKind('notes.txt')).toBe('plain_text');
    expect(resolveFileKind('data.csv')).toBe('csv');
    expect(resolveFileKind('source.json')).toBe('json');
    expect(resolveFileKind('page.html')).toBe('html');
    expect(resolveFileKind('playbook.pdf')).toBe('pdf');
    expect(resolveFileKind('training.docx')).toBe('docx');
    expect(resolveFileKind('unknown', 'application/pdf')).toBe('pdf');
  });

  it('extracts text-like files and normalizes JSON / HTML', async () => {
    await expect(
      extractKnowledgeFile({
        filename: 'source.txt',
        bytes: Buffer.from('hello\r\nworld', 'utf8'),
      }),
    ).resolves.toMatchObject({ kind: 'plain_text', content: 'hello\nworld' });

    await expect(
      extractKnowledgeFile({
        filename: 'source.json',
        bytes: Buffer.from('{"b":2,"a":1}', 'utf8'),
      }),
    ).resolves.toMatchObject({ kind: 'json', content: '{\n  "b": 2,\n  "a": 1\n}' });

    await expect(
      extractKnowledgeFile({
        filename: 'source.html',
        bytes: Buffer.from('<h1>Title</h1><script>bad()</script><p>A &amp; B</p>', 'utf8'),
      }),
    ).resolves.toMatchObject({ kind: 'html', content: 'Title A & B' });
  });

  it('rejects empty and unsupported files', async () => {
    await expect(
      extractKnowledgeFile({ filename: 'empty.txt', bytes: Buffer.alloc(0) }),
    ).rejects.toBeInstanceOf(KnowledgeFileExtractionError);

    await expect(
      extractKnowledgeFile({
        filename: 'archive.zip',
        bytes: Buffer.from('zip', 'utf8'),
      }),
    ).rejects.toMatchObject({ code: 'unsupported_file_type' });
  });
});
