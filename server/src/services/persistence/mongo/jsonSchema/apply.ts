import { env } from '../../../../env.js';
import { getMongoConnection } from '../connection.js';
import { generateMongoJsonSchema } from './generate.js';
import { getMongoSchema } from '../models/registry.js';

export interface ApplyMongoValidatorResult {
  collection: string;
  database: string;
  applied: boolean;
}

export async function applyMongoJsonSchemaValidator(
  collection: string,
  database = env.MONGODB_DB,
): Promise<ApplyMongoValidatorResult> {
  const connection = getMongoConnection(database);
  const db = connection.db;
  if (!db) throw new Error(`[mongo-validator] database ${database} is not connected`);
  const validator = { $jsonSchema: generateMongoJsonSchema(getMongoSchema(collection)) };
  await db.command({
    collMod: collection,
    validator,
    validationLevel: 'moderate',
    validationAction: 'error',
  });
  return { collection, database, applied: true };
}
