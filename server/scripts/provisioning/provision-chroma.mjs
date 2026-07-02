// Provision Chroma to Rev 3: drop empty v1-stamped boot shells, create the
// canonical mcs_ registry. Idempotent. Env: CHROMA_PROVISION_URL (default
// http://localhost:8200). Cloud (B1): set URL + CHROMA_API_KEY headers.
import { CHROMA_COLLECTIONS, CHROMA_METADATA, REV } from './rev3-registry.mjs';

const BASE = process.env.CHROMA_PROVISION_URL || 'http://localhost:8200';
const TENANT = process.env.CHROMA_TENANT || 'default_tenant';
const DB = process.env.CHROMA_DATABASE || 'default_database';
const API = `${BASE}/api/v2/tenants/${TENANT}/databases/${DB}`;
const HDRS = { 'Content-Type': 'application/json', ...(process.env.CHROMA_API_KEY ? { 'x-chroma-token': process.env.CHROMA_API_KEY } : {}) };
const VERIFY_ONLY = process.argv.includes('--verify');

async function listCollections() {
  const r = await fetch(`${API}/collections?limit=200`, { headers: HDRS });
  if (!r.ok) throw new Error(`list failed ${r.status}: ${await r.text()}`);
  return r.json();
}
async function countOf(id) {
  const r = await fetch(`${API}/collections/${id}/count`, { headers: HDRS });
  return r.ok ? r.json() : -1;
}

const existing = await listCollections();
console.log(`[chroma] ${API} — ${existing.length} existing collections`);
let dropped = 0, created = 0, kept = 0, skipped = 0;

if (!VERIFY_ONLY) {
  for (const c of existing) {
    const isV1Shell = c?.metadata?.project === 'momentum_creation_system_v1';
    const n = await countOf(c.id);
    if (isV1Shell && n === 0) {
      const r = await fetch(`${API}/collections/${c.name}`, { method: 'DELETE', headers: HDRS });
      if (!r.ok) throw new Error(`drop ${c.name} failed ${r.status}`);
      dropped++; console.log(`  dropped v1 shell: ${c.name}`);
    } else if (isV1Shell) { skipped++; console.log(`  ⚠ v1 collection NOT empty (count=${n}) — left in place: ${c.name}`); }
  }
  const after = await listCollections();
  const names = new Set(after.map((c) => c.name));
  for (const name of CHROMA_COLLECTIONS) {
    if (names.has(name)) { kept++; continue; }
    const r = await fetch(`${API}/collections`, { method: 'POST', headers: HDRS, body: JSON.stringify({ name, metadata: CHROMA_METADATA }) });
    if (!r.ok) throw new Error(`create ${name} failed ${r.status}: ${await r.text()}`);
    created++;
  }
}

const final = await listCollections();
const finalNames = new Set(final.map((c) => c.name));
const missing = CHROMA_COLLECTIONS.filter((n) => !finalNames.has(n));
const extras = final.filter((c) => !CHROMA_COLLECTIONS.includes(c.name)).map((c) => c.name);
console.log(`[chroma] ${REV}: dropped=${dropped} created=${created} kept=${kept} skippedNonEmpty=${skipped}`);
console.log(`[chroma] registry=${CHROMA_COLLECTIONS.length} present=${CHROMA_COLLECTIONS.length - missing.length} missing=${missing.length} extras=${extras.length}${extras.length ? ' (' + extras.join(', ') + ')' : ''}`);
if (missing.length) { console.error('[chroma] MISSING:', missing.join(', ')); process.exit(1); }
console.log('[chroma] OK');
