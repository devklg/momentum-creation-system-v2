// Backfill sourceIds into the THREE-blog provenance manifest by reading the
// snapshot dir + querying Mongo through the gateway is not available here, so
// this reads the ingest-verified mapping already written to Mongo via the
// server's own persistence. Run with the server's normal env (dotenv intact).
import { appendFile } from 'node:fs/promises';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { connectDirectPersistence, closeDirectPersistence } from '../src/services/persistence/index.js';

const MANIFEST = 'D:/momentum-creation-system-v2/knowledge/three-blog/PROVENANCE_MANIFEST.md';

async function main() {
  await connectDirectPersistence();
  const res = await persistenceCall('mongodb', 'query', {
    database: 'momentum',
    collection: 'mcs_knowledge_sources',
    filter: { sourceRef: { $regex: '^url:https://blog.threeinternational' } },
    limit: 200,
  });
  const docs = res.documents ?? [];
  const rows = docs.map((d) => {
    const url = String(d.sourceRef).replace(/^url:/, '');
    const slug = url.split('/en/')[1];
    return `| ${slug} | ${url} | extracted/${slug}.md | ${d.sourceId} | ${d.chunkCount} |`;
  }).sort();
  await appendFile(MANIFEST, `\n## Complete map (sourceId backfill) — ${docs.length} articles\n\n| slug | live URL | snapshot | sourceId | chunks |\n| --- | --- | --- | --- | --- |\n` + rows.join('\n') + '\n', 'utf8');
  console.log('manifest backfilled: ' + docs.length + ' rows');
}
main().then(() => closeDirectPersistence()).catch(async (e) => { console.error(e.message); await closeDirectPersistence(); process.exitCode = 1; });
