import { env } from '../../../env.js';
import { PersistenceError } from '../dispatch.js';
import { connectMongo, getMongoConnection } from './connection.js';
import { getMongoModel, type MongoDocument } from './models/registry.js';
import type { PipelineStage } from 'mongoose';

interface MongoParams {
  database?: string;
  collection?: string;
  documents?: MongoDocument[];
  filter?: Record<string, unknown>;
  query?: Record<string, unknown>;
  update?: Record<string, unknown>;
  pipeline?: PipelineStage[];
  sort?: Record<string, 1 | -1>;
  limit?: number;
}

function database(params: MongoParams): string {
  return params.database ?? env.MONGODB_DB;
}

function collection(params: MongoParams, action: string): string {
  if (!params.collection) {
    throw new PersistenceError('mongodb', action, 'mongodb action requires `collection`');
  }
  return params.collection;
}

function plain(doc: unknown): MongoDocument {
  if (doc && typeof doc === 'object' && 'toObject' in doc) {
    return (doc as { toObject: (options?: Record<string, unknown>) => MongoDocument }).toObject({
      versionKey: false,
      depopulate: true,
    });
  }
  return doc as MongoDocument;
}

export async function mongoInsert(params: MongoParams): Promise<{
  insertedCount: number;
  insertedIds: Record<number, unknown>;
}> {
  const docs = params.documents ?? [];
  if (!Array.isArray(docs)) {
    throw new PersistenceError('mongodb', 'insert', '`documents` must be an array');
  }
  const model = getMongoModel(database(params), collection(params, 'insert'));
  const inserted = await model.insertMany(docs, { ordered: true });
  const insertedIds: Record<number, unknown> = {};
  inserted.forEach((doc, index) => {
    insertedIds[index] = plain(doc)._id;
  });
  return { insertedCount: inserted.length, insertedIds };
}

export async function mongoQuery(params: MongoParams): Promise<{
  documents: MongoDocument[];
  count: number;
}> {
  const filter = params.filter ?? params.query ?? {};
  const model = getMongoModel(database(params), collection(params, 'query'));
  let query = model.find(filter).lean<MongoDocument[]>();
  if (params.sort) query = query.sort(params.sort);
  if (typeof params.limit === 'number') query = query.limit(params.limit);
  const [documents, count] = await Promise.all([query.exec(), model.countDocuments(filter).exec()]);
  return { documents, count };
}

export async function mongoUpdate(params: MongoParams): Promise<{
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
}> {
  const model = getMongoModel(database(params), collection(params, 'update'));
  const result = await model.updateMany(params.filter ?? {}, params.update ?? {}, {
    upsert: false,
  });
  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    upsertedCount: result.upsertedCount ?? 0,
  };
}

export async function mongoDelete(params: MongoParams): Promise<{ deletedCount: number }> {
  const model = getMongoModel(database(params), collection(params, 'delete'));
  const result = await model.deleteMany(params.filter ?? {});
  return { deletedCount: result.deletedCount };
}

export async function mongoAggregate(params: MongoParams): Promise<{
  results: MongoDocument[];
  count: number;
}> {
  const model = getMongoModel(database(params), collection(params, 'aggregate'));
  const results = await model.aggregate(params.pipeline ?? []).exec();
  return { results: results as MongoDocument[], count: results.length };
}

export async function mongoListCollections(params: MongoParams): Promise<{
  collections: Array<{ name: string }>;
  count: number;
}> {
  await connectMongo();
  const db = getMongoConnection(database(params)).db;
  if (!db) throw new PersistenceError('mongodb', 'list_collections', 'database is not connected');
  const collections = (await db.listCollections().toArray()).map((c) => ({ name: c.name }));
  return { collections, count: collections.length };
}

export async function mongoPing(params: MongoParams): Promise<{ ok: true }> {
  await connectMongo();
  const db = getMongoConnection(database(params)).db;
  if (!db) throw new PersistenceError('mongodb', 'ping', 'database is not connected');
  await db.admin().ping();
  return { ok: true };
}

export async function mongoAdapter(
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  try {
    const p = params as MongoParams;
    switch (action) {
      case 'insert':
        return await mongoInsert(p);
      case 'query':
        return await mongoQuery(p);
      case 'update':
        return await mongoUpdate(p);
      case 'delete':
        return await mongoDelete(p);
      case 'aggregate':
        return await mongoAggregate(p);
      case 'list_collections':
        return await mongoListCollections(p);
      case 'ping':
        return await mongoPing(p);
      default:
        throw new PersistenceError('mongodb', action, `unsupported mongodb action: ${action}`);
    }
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    throw new PersistenceError('mongodb', action, err instanceof Error ? err.message : String(err));
  }
}
