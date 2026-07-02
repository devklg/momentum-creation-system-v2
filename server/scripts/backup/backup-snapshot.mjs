// MCS v2 — dev-stack snapshot backup (B4 leg 2, local half).
// Dumps all Rev 3 collections from the governed local stack to JSON under
// D:/backups/mcs-v2/<timestamp>/ : Mongo (per-collection JSON), Neo4j (full
// node+relationship export — graph is small in dev), Chroma (per-collection
// docs+metadatas). PRODUCTION backups are the managed offerings: Atlas
// continuous backup, Aura daily snapshots, Chroma Cloud managed — enable in
// B1 provisioning; this script is the local/dev complement and DR drill tool.
// Run: pnpm --filter @momentum/server tsx scripts/backup/backup-snapshot.mjs
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import neo4j from 'neo4j-driver';
import { MONGO_COLLECTIONS, CHROMA_COLLECTIONS } from '../provisioning/rev3-registry.mjs';

const { MongoClient } = mongoose.mongo;
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = process.env.BACKUP_DIR || `D:/backups/mcs-v2/${STAMP}`;
mkdirSync(`${OUT}/mongo`, { recursive: true });
mkdirSync(`${OUT}/neo4j`, { recursive: true });
mkdirSync(`${OUT}/chroma`, { recursive: true });

function dotenvVal(key) {
  try {
    const t = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
    const m = t.match(new RegExp('^' + key + '=(.*)$', 'm'));
    return m ? m[1].trim() : undefined;
  } catch { return undefined; }
}

// ---- Mongo ----
const mongoUri = process.env.MONGO_PROVISION_URI || 'mongodb://127.0.0.1:30000';
const mongoDb = process.env.MONGO_PROVISION_DB || 'momentum';
const mc = new MongoClient(mongoUri);
await mc.connect();
let mongoDocs = 0;
for (const def of MONGO_COLLECTIONS) {
  const docs = await mc.db(mongoDb).collection(def.name).find({}).toArray();
  writeFileSync(`${OUT}/mongo/${def.name}.json`, JSON.stringify(docs, null, 1));
  mongoDocs += docs.length;
}
await mc.close();
console.log(`[backup] mongo: ${MONGO_COLLECTIONS.length} collections, ${mongoDocs} docs`);

// ---- Neo4j ----
const n4jUri = process.env.NEO4J_PROVISION_URI || 'bolt://127.0.0.1:7710';
const n4jUser = process.env.NEO4J_PROVISION_USER || dotenvVal('NEO4J_USERNAME') || 'neo4j';
const n4jPass = process.env.NEO4J_PROVISION_PASSWORD || dotenvVal('NEO4J_PASSWORD');
const driver = neo4j.driver(n4jUri, neo4j.auth.basic(n4jUser, n4jPass));
const nodes = await driver.executeQuery('MATCH (n) RETURN labels(n) AS labels, properties(n) AS props');
const rels = await driver.executeQuery('MATCH (a)-[r]->(b) RETURN type(r) AS type, properties(r) AS props, elementId(a) AS from, elementId(b) AS to');
writeFileSync(`${OUT}/neo4j/nodes.json`, JSON.stringify(nodes.records.map((r) => r.toObject()), null, 1));
writeFileSync(`${OUT}/neo4j/relationships.json`, JSON.stringify(rels.records.map((r) => r.toObject()), null, 1));
console.log(`[backup] neo4j: ${nodes.records.length} nodes, ${rels.records.length} relationships`);
await driver.close();

// ---- Chroma ----
const base = process.env.CHROMA_PROVISION_URL || 'http://localhost:8200';
const api = `${base}/api/v2/tenants/default_tenant/databases/default_database`;
const cols = await (await fetch(`${api}/collections?limit=200`)).json();
let chromaDocs = 0;
for (const name of CHROMA_COLLECTIONS) {
  const col = cols.find((c) => c.name === name);
  if (!col) continue;
  const body = await (await fetch(`${api}/collections/${col.id}/get`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 10000, include: ['documents', 'metadatas'] }),
  })).json();
  writeFileSync(`${OUT}/chroma/${name}.json`, JSON.stringify(body, null, 1));
  chromaDocs += body.ids?.length ?? 0;
}
console.log(`[backup] chroma: ${CHROMA_COLLECTIONS.length} collections, ${chromaDocs} docs`);
console.log(`[backup] COMPLETE → ${OUT}`);
process.exit(0);
