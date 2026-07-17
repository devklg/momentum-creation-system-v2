import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MCS_KNOWLEDGE_CORRECTION_CONFIRMATION } from '@momentum/shared';
import { KnowledgeCorrectionWorkflow } from '../src/services/knowledge/knowledgeCorrectionWorkflow.js';
import { knowledgeCorrectionStore } from '../src/services/knowledge/knowledgeCorrectionStore.js';
import { closeMongo, connectMongo } from '../src/services/persistence/mongo/connection.js';
import { closeNeo4j, connectNeo4j } from '../src/services/persistence/neo4j/connection.js';

const sourceVersionId = argument('--source-version-id');
const markdownPath = path.resolve(argument('--markdown'));
const reason = argument('--reason');
const actorTmagId = optionalArgument('--actor') ?? 'TMAG-01';
const idempotencyKey = argument('--idempotency-key');
const workflow = new KnowledgeCorrectionWorkflow({ store: knowledgeCorrectionStore });

try {
  await Promise.all([connectMongo(), connectNeo4j()]);
  const replacementContent = await readFile(markdownPath, 'utf8');
  const preview = await workflow.preview(sourceVersionId, { replacementContent, reason });
  const correction = await workflow.apply(sourceVersionId, {
    replacementContent,
    reason,
    previewId: preview.previewId,
    previewCreatedAt: preview.createdAt,
    previewExpiresAt: preview.expiresAt,
    previewDigestSha256: preview.previewDigestSha256,
    idempotencyKey,
    confirmation: MCS_KNOWLEDGE_CORRECTION_CONFIRMATION,
  }, actorTmagId);
  console.log(JSON.stringify({ ok: correction.state === 'verified', correction }, null, 2));
} finally {
  await Promise.allSettled([closeMongo(), closeNeo4j()]);
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
