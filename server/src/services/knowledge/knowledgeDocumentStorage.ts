import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
  type McsKnowledgeBaseDocumentPointer,
  type McsKnowledgeBaseExtractionMetadata,
} from '@momentum/shared/runtime';
import { GridFSBucket, ObjectId, type GridFSBucketReadStream } from 'mongodb';
import { persistenceCall } from '../persistence/dispatch.js';
import { connectMongo, getMongoConnection } from '../persistence/mongo/connection.js';

export const KNOWLEDGE_DOCUMENT_BUCKET = 'mcs_knowledge_documents' as const;
const DATABASE = 'momentum';

export interface AttachKnowledgeDocumentInput {
  sourceId: string;
  sourceVersion: number;
  filename: string;
  mimeType: string;
  bytes: Buffer;
  extraction?: McsKnowledgeBaseExtractionMetadata;
  uploadedAt?: string;
}

export interface OpenKnowledgeDocumentResult {
  stream: GridFSBucketReadStream;
  filename: string;
  mimeType: string;
  originalBytes: number;
  sha256: string;
}

export async function attachKnowledgeDocumentToSource(
  input: AttachKnowledgeDocumentInput,
): Promise<McsKnowledgeBaseDocumentPointer> {
  if (!input.sourceId.trim()) throw new Error('knowledge_document_source_id_required');
  if (!Number.isInteger(input.sourceVersion) || input.sourceVersion < 1) {
    throw new Error('knowledge_document_source_version_invalid');
  }
  if (!input.filename.trim()) throw new Error('knowledge_document_filename_required');
  if (input.bytes.length === 0) throw new Error('knowledge_document_bytes_required');

  await connectMongo();
  const db = getMongoConnection(DATABASE).db;
  if (!db) throw new Error('knowledge_document_database_unavailable');

  const bucket = new GridFSBucket(db, { bucketName: KNOWLEDGE_DOCUMENT_BUCKET });
  const sha256 = createHash('sha256').update(input.bytes).digest('hex');
  const existing = await db.collection(`${KNOWLEDGE_DOCUMENT_BUCKET}.files`).findOne({
    'metadata.sourceId': input.sourceId,
    'metadata.sourceVersion': input.sourceVersion,
    'metadata.sha256': sha256,
  });

  let fileId: ObjectId;
  let created = false;
  const uploadedAt = input.uploadedAt ?? new Date().toISOString();
  if (existing?._id instanceof ObjectId) {
    fileId = existing._id;
  } else {
    const upload = bucket.openUploadStream(input.filename, {
      metadata: {
        sourceId: input.sourceId,
        sourceVersion: input.sourceVersion,
        mimeType: input.mimeType,
        sha256,
        uploadedAt,
      },
    });
    await pipeline(Readable.from([input.bytes]), upload);
    fileId = upload.id;
    created = true;
  }

  const pointer: McsKnowledgeBaseDocumentPointer = {
    storage: 'mongo_gridfs',
    bucketName: KNOWLEDGE_DOCUMENT_BUCKET,
    fileId: fileId.toHexString(),
    filename: input.filename,
    mimeType: input.mimeType,
    originalBytes: input.bytes.length,
    sha256,
    uploadedAt,
  };

  try {
    const update = await persistenceCall<{ matchedCount: number }>('mongodb', 'update', {
      database: DATABASE,
      collection: MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
      filter: { sourceId: input.sourceId, version: input.sourceVersion },
      update: {
        $set: {
          'upload.document': pointer,
          ...(input.extraction ? { 'upload.extraction': input.extraction } : {}),
        },
      },
    });
    if (update.matchedCount !== 1) throw new Error('knowledge_document_source_not_found');

    const readback = await persistenceCall<{ documents?: Array<{ upload?: { document?: unknown } }> }>(
      'mongodb',
      'query',
      {
        database: DATABASE,
        collection: MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
        filter: { sourceId: input.sourceId, version: input.sourceVersion },
        limit: 1,
      },
    );
    const stored = parseKnowledgeDocumentPointer(readback.documents?.[0]?.upload?.document);
    if (!stored || stored.fileId !== pointer.fileId || stored.sha256 !== pointer.sha256) {
      throw new Error('knowledge_document_pointer_readback_failed');
    }
    const file = await db.collection(`${KNOWLEDGE_DOCUMENT_BUCKET}.files`).findOne({ _id: fileId });
    if (!file || Number(file.length) !== pointer.originalBytes) {
      throw new Error('knowledge_document_gridfs_readback_failed');
    }
    return pointer;
  } catch (error) {
    if (created) await bucket.delete(fileId).catch(() => undefined);
    throw error;
  }
}

export async function openKnowledgeDocument(
  pointer: McsKnowledgeBaseDocumentPointer,
): Promise<OpenKnowledgeDocumentResult> {
  const safe = parseKnowledgeDocumentPointer(pointer);
  if (!safe || safe.bucketName !== KNOWLEDGE_DOCUMENT_BUCKET) {
    throw new Error('knowledge_document_pointer_invalid');
  }
  await connectMongo();
  const db = getMongoConnection(DATABASE).db;
  if (!db) throw new Error('knowledge_document_database_unavailable');
  const fileId = new ObjectId(safe.fileId);
  const file = await db.collection(`${KNOWLEDGE_DOCUMENT_BUCKET}.files`).findOne({ _id: fileId });
  if (!file || Number(file.length) !== safe.originalBytes) throw new Error('knowledge_document_not_found');
  const bucket = new GridFSBucket(db, { bucketName: safe.bucketName });
  return {
    stream: bucket.openDownloadStream(fileId),
    filename: safe.filename,
    mimeType: safe.mimeType,
    originalBytes: safe.originalBytes,
    sha256: safe.sha256,
  };
}

export function parseKnowledgeDocumentPointer(value: unknown): McsKnowledgeBaseDocumentPointer | null {
  if (!value || typeof value !== 'object') return null;
  const pointer = value as Partial<McsKnowledgeBaseDocumentPointer>;
  if (
    pointer.storage !== 'mongo_gridfs' ||
    typeof pointer.bucketName !== 'string' ||
    typeof pointer.fileId !== 'string' ||
    !ObjectId.isValid(pointer.fileId) ||
    typeof pointer.filename !== 'string' ||
    !pointer.filename.trim() ||
    typeof pointer.mimeType !== 'string' ||
    !pointer.mimeType.trim() ||
    typeof pointer.originalBytes !== 'number' ||
    !Number.isSafeInteger(pointer.originalBytes) ||
    pointer.originalBytes < 1 ||
    typeof pointer.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(pointer.sha256) ||
    typeof pointer.uploadedAt !== 'string' ||
    Number.isNaN(Date.parse(pointer.uploadedAt))
  ) return null;
  return pointer as McsKnowledgeBaseDocumentPointer;
}
