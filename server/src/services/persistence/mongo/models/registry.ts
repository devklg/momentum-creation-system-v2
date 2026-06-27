/**
 * Mongoose model registry for direct Mongo persistence (S1.3 Phase 1).
 *
 * Phase 1 keeps legacy collections permissive while still routing every
 * collection through a Mongoose model. Runtime-specific schemas can replace
 * individual entries incrementally without changing adapter callers.
 */
import { Schema, type Model } from 'mongoose';
import { getMongoConnection } from '../connection.js';

export type MongoDocument = Record<string, unknown>;

function modelNameFor(collection: string): string {
  return `Mcs_${collection.replace(/[^A-Za-z0-9]/g, '_')}`;
}

export function createPermissiveCollectionSchema(): Schema<MongoDocument> {
  return new Schema<MongoDocument>(
    { _id: { type: Schema.Types.Mixed, required: true } },
    {
      strict: false,
      versionKey: false,
      minimize: false,
    },
  );
}

export function getMongoSchema(_collection: string): Schema<MongoDocument> {
  return createPermissiveCollectionSchema();
}

export function getMongoModel(database: string, collection: string): Model<MongoDocument> {
  const connection = getMongoConnection(database);
  const modelName = modelNameFor(collection);
  const existing = connection.models[modelName] as Model<MongoDocument> | undefined;
  if (existing) return existing;
  return connection.model<MongoDocument>(modelName, getMongoSchema(collection), collection);
}
