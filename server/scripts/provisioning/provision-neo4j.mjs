// Provision Neo4j to Rev 3: uniqueness constraints + lookup indexes on the
// blank graph. Idempotent (IF NOT EXISTS). Env: NEO4J_PROVISION_URI (default
// bolt://127.0.0.1:7710), NEO4J_USER (neo4j), NEO4J_PASSWORD (required — read
// from repo .env). Aura (B1): set URI neo4j+s://... + creds.
import neo4j from 'neo4j-driver';
import { readFileSync } from 'node:fs';
import { NEO4J_CONSTRAINTS, NEO4J_INDEXES, REV } from './rev3-registry.mjs';

function envFromDotenv(key) {
  try {
    const t = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
    const m = t.match(new RegExp('^' + key + '=(.*)$', 'm'));
    return m ? m[1].trim() : undefined;
  } catch { return undefined; }
}

const URI = process.env.NEO4J_PROVISION_URI || 'bolt://127.0.0.1:7710';
const USER = process.env.NEO4J_PROVISION_USER || envFromDotenv('NEO4J_USERNAME') || 'neo4j';
// Deliberately NOT process.env.NEO4J_PASSWORD: stale machine-scope vars
// shadow the governed credential (bit us 2026-07-02). Repo .env is the
// source of truth locally; NEO4J_PROVISION_PASSWORD is the cloud override.
const PASS = process.env.NEO4J_PROVISION_PASSWORD || envFromDotenv('NEO4J_PASSWORD');
if (!PASS) { console.error('[neo4j] NEO4J_PASSWORD not found (env or repo .env)'); process.exit(1); }
const VERIFY_ONLY = process.argv.includes('--verify');

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASS));
try {
  if (!VERIFY_ONLY) {
    for (const [label, key] of NEO4J_CONSTRAINTS) {
      const name = `uniq_${label}_${key}`.toLowerCase();
      await driver.executeQuery(`CREATE CONSTRAINT ${name} IF NOT EXISTS FOR (n:\`${label}\`) REQUIRE n.\`${key}\` IS UNIQUE`);
    }
    for (const [label, prop] of NEO4J_INDEXES) {
      const name = `idx_${label}_${prop}`.toLowerCase();
      await driver.executeQuery(`CREATE INDEX ${name} IF NOT EXISTS FOR (n:\`${label}\`) ON (n.\`${prop}\`)`);
    }
  }
  const cons = await driver.executeQuery('SHOW CONSTRAINTS YIELD name RETURN count(*) AS n');
  const idx = await driver.executeQuery("SHOW INDEXES YIELD name, type WHERE type = 'RANGE' RETURN count(*) AS n");
  const nCons = cons.records[0].get('n').toNumber ? cons.records[0].get('n').toNumber() : cons.records[0].get('n');
  const nIdx = idx.records[0].get('n').toNumber ? idx.records[0].get('n').toNumber() : idx.records[0].get('n');
  console.log(`[neo4j] ${REV} @ ${URI}: constraints=${nCons}/${NEO4J_CONSTRAINTS.length} rangeIndexes=${nIdx} (expected >= ${NEO4J_INDEXES.length}; uniqueness constraints back their own indexes)`);
  if (nCons < NEO4J_CONSTRAINTS.length) { console.error('[neo4j] constraint count below registry'); process.exit(1); }
  console.log('[neo4j] OK');
} finally { await driver.close(); }
