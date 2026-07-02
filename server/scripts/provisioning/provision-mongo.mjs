// Provision MongoDB to Rev 3: create collections + $jsonSchema validators.
// First-pass posture per signed Rev 3: required = core, additionalProperties
// implicitly allowed (no false), validationLevel: moderate, action: error.
// Idempotent: create-if-missing, collMod always (re-runnable as canon tightens).
// Env: MONGO_PROVISION_URI (default mongodb://127.0.0.1:30000),
//      MONGO_PROVISION_DB (default momentum). Atlas (B1): set URI.
import mongoose from 'mongoose';
const { MongoClient } = mongoose.mongo;
import { MONGO_COLLECTIONS, REV } from './rev3-registry.mjs';

const URI = process.env.MONGO_PROVISION_URI || 'mongodb://127.0.0.1:30000';
const DBNAME = process.env.MONGO_PROVISION_DB || 'momentum';
const VERIFY_ONLY = process.argv.includes('--verify');

function validatorFor(def) {
  const properties = {};
  for (const [field, spec] of Object.entries(def.props || {})) {
    if (spec.enum) properties[field] = { enum: spec.enum };
  }
  const schema = { bsonType: 'object', required: def.required };
  if (Object.keys(properties).length) schema.properties = properties;
  return { $jsonSchema: schema };
}

const client = new MongoClient(URI);
await client.connect();
try {
  const db = client.db(DBNAME);
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  let created = 0, modded = 0;
  if (!VERIFY_ONLY) {
    for (const def of MONGO_COLLECTIONS) {
      if (!existing.has(def.name)) { await db.createCollection(def.name); created++; }
      await db.command({ collMod: def.name, validator: validatorFor(def), validationLevel: 'moderate', validationAction: 'error' });
      modded++;
    }
  }
  const after = await db.listCollections().toArray();
  const names = new Set(after.map((c) => c.name));
  const missing = MONGO_COLLECTIONS.filter((d) => !names.has(d.name)).map((d) => d.name);
  const withValidator = after.filter((c) => c.options?.validator).length;
  const strays = after.filter((c) => !MONGO_COLLECTIONS.some((d) => d.name === c.name)).map((c) => c.name);
  console.log(`[mongo] ${REV} @ ${URI}/${DBNAME}: created=${created} validatorsApplied=${modded} present=${MONGO_COLLECTIONS.length - missing.length}/${MONGO_COLLECTIONS.length} withValidator=${withValidator}`);
  if (strays.length) console.log(`[mongo] pre-migration strays (left in place, handled by reidentification migration): ${strays.join(', ')}`);
  if (missing.length) { console.error('[mongo] MISSING:', missing.join(', ')); process.exit(1); }
  console.log('[mongo] OK');
} finally { await client.close(); }
