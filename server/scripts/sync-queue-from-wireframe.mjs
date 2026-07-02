#!/usr/bin/env node
/**
 * sync-queue-from-wireframe.mjs — generate the leaf-level work queue FROM the
 * wireframe (Chat #129).
 *
 * THE WIREFRAME IS THE SOURCE. This script parses docs/project-wireframe.md,
 * extracts every checkbox leaf ([x]/[~]/[ ]) under its surface + section
 * heading, and writes one row per leaf into momentum.work_queue_leaves. Re-run
 * any time the wireframe changes — the document stays the single source of
 * truth, the queue is its queryable mirror. No hand-keying, no drift.
 *
 * Status map: [x]->done  [~]->partial  [ ]->pending
 * Section context comes from the nearest preceding ## or ### heading.
 * Stable _id = wf_<NNNN> by document order so re-runs are idempotent.
 *
 * Run:  node server/scripts/sync-queue-from-wireframe.mjs   (from repo root)
 */

import { readFile } from 'node:fs/promises';
import { closeMomentumMongo, momentumCollection } from './lib/momentum-mongo.mjs';

const COLL = 'work_queue_leaves';
const WIREFRAME = 'docs/project-wireframe.md';

const STATUS = { 'x': 'done', '~': 'partial', ' ': 'pending' };

// Top-level surface inferred from the "## N · NAME" heading.
function surfaceOf(h2) {
  if (!h2) return 'other';
  const m = h2.toLowerCase();
  if (m.includes('foundation')) return 'infra';
  if (m.includes('auth')) return 'auth';
  if (m.includes('admin')) return 'admin';
  if (m.includes('.com')) return 'com';
  if (m.includes('.team')) return 'team';
  if (m.includes('drift') || m.includes('hygiene')) return 'hygiene';
  return 'other';
}

async function main() {
  const text = await readFile(WIREFRAME, 'utf8');
  const lines = text.split(/\r?\n/);

  let h2 = null;   // current "## ..." surface heading
  let h3 = null;   // current "### ..." section heading
  const leaves = [];
  let n = 0;

  // Match a checkbox line; capture indent, mark, and text.
  const cb = /^(\s*)-\s\[([x~ ])\]\s+(.*)$/;

  for (const raw of lines) {
    const h2m = raw.match(/^##\s+(.*)$/);
    if (h2m) { h2 = h2m[1].trim(); h3 = null; continue; }
    const h3m = raw.match(/^###\s+(.*)$/);
    if (h3m) { h3 = h3m[1].trim(); continue; }

    const m = raw.match(cb);
    if (!m) continue;
    const indent = m[1].length;
    const mark = m[2];
    const title = m[3].trim();
    n += 1;
    leaves.push({
      _id: `wf_${String(n).padStart(4, '0')}`,
      seq: n,
      surface: surfaceOf(h2),
      section: h3 || h2 || null,
      group: h2 || null,
      depth: Math.floor(indent / 2),       // 0 = top leaf, 1+ = sub-leaf
      is_subleaf: indent > 0,
      status: STATUS[mark],
      title,
    });
  }

  const collection = await momentumCollection(COLL);

  // Idempotent: wipe then insert.
  await collection.deleteMany({});

  const now = new Date().toISOString();
  const docs = leaves.map((l) => ({ ...l, synced_at: now, source: WIREFRAME, synced_chat: 147 }));
  // Insert in batches to keep payloads small.
  const BATCH = 40;
  for (let i = 0; i < docs.length; i += BATCH) {
    await collection.insertMany(docs.slice(i, i + BATCH));
  }

  // Read back.
  const total = await collection.aggregate([{ $count: 't' }]).toArray();
  const byStatus = await collection
    .aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    .toArray();
  const bySurface = await collection
    .aggregate([
      { $group: { _id: { s: '$surface', st: '$status' }, n: { $sum: 1 } } },
      { $sort: { '_id.s': 1, '_id.st': 1 } },
    ])
    .toArray();

  console.log('=== LEAF QUEUE SYNCED FROM WIREFRAME ===');
  console.log('source:', WIREFRAME);
  console.log('total leaves:', JSON.stringify(total));
  console.log('by status:', JSON.stringify(byStatus));
  console.log('\nby surface x status:');
  for (const r of bySurface) {
    console.log(`  ${r._id.s.padEnd(8)} ${r._id.st.padEnd(7)} ${r.n}`);
  }
  await closeMomentumMongo();
}

main().catch(async (e) => {
  await closeMomentumMongo().catch(() => undefined);
  console.error('SYNC FAILED:', e);
  process.exit(1);
});
