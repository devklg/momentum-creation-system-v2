import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { closeMongo } from '../src/services/persistence/mongo/connection.js';
import { attachKnowledgeDocumentToSource } from '../src/services/knowledge/knowledgeDocumentStorage.js';

const sourceId = argument('--source-id');
const sourceVersion = Number(argument('--source-version'));
const filePath = path.resolve(argument('--file'));
const documentKey = optionalArgument('--docling-key');

if (!Number.isInteger(sourceVersion) || sourceVersion < 1) {
  throw new Error('--source-version must be a positive integer');
}

try {
  const bytes = await readFile(filePath);
  const pointer = await attachKnowledgeDocumentToSource({
    sourceId,
    sourceVersion,
    filename: path.basename(filePath),
    mimeType: 'application/pdf',
    bytes,
    extraction: {
      engine: 'docling',
      ...(documentKey ? { documentKey } : {}),
      extractedAt: new Date().toISOString(),
    },
  });
  console.log(JSON.stringify({ ok: true, sourceId, sourceVersion, pointer }, null, 2));
} finally {
  await closeMongo();
}

function argument(name: string): string {
  const value = optionalArgument(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
