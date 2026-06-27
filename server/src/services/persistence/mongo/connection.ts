/**
 * MongoDB direct connection lifecycle (S1.3 Phase 0).
 *
 * Mongoose is the application schema layer. Collection-level `$jsonSchema`
 * validators are generated from these Mongoose schemas, never hand-maintained.
 */
import mongoose, { type Connection } from 'mongoose';
import { env } from '../../../env.js';

export async function connectMongo(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB });
}

export function getMongoConnection(database = env.MONGODB_DB): Connection {
  const base = mongoose.connection;
  if (database === env.MONGODB_DB) return base;
  return base.useDb(database, { useCache: true });
}

export async function mongoHealth(database = env.MONGODB_DB): Promise<boolean> {
  try {
    await connectMongo();
    const db = getMongoConnection(database).db;
    if (!db) return false;
    await db.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export async function closeMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
