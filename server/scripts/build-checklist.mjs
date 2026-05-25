#!/usr/bin/env node
/**
 * build-checklist.mjs — render docs/project-wireframe.md into a printable,
 * black-and-white numbered checklist.
 *
 * FIXED (Chat #133): previously read docs/_leaves.json, which hygiene deleted
 * (Chat #132). Now parses the wireframe DIRECTLY, using the SAME checkbox
 * regex, status map, surface inference, and section tracking as
 * sync-queue-from-wireframe.mjs. One parse, one source of truth: the checklist
 * numbering (seq) is therefore identical to the leaf queue's. Update the
 * wireframe, re-run this — no JSON intermediary, no drift, no Mongo dependency.
 *
 * Status map: [x]->done  [~]->partial  [ ]->pending
 * Run: node server/scripts/build-checklist.mjs  -> docs/build-checklist.html
 */
import { readFile, writeFile } from 'node:fs/promises';

const SRC = 'docs/project-wireframe.md';
const OUT = 'docs/build-checklist.html';

const SURFACE_TITLES = {
  infra: '0 \u00b7 Foundation (infra + shared)',
  auth: '1 \u00b7 Auth / Signup',
  com: '2 \u00b7 .com \u2014 Prospect Surface',
  team: '3 \u00b7 .team \u2014 BA Surface',
  admin: '4 \u00b7 /admin \u2014 Kevin-only',
  hygiene: '5 \u00b7 Drift / Hygiene',
  other: 'Other',
};
const ORDER = ['infra', 'auth', 'com', 'team', 'admin', 'hygiene', 'other'];

// --- IDENTICAL parse contract to sync-queue-from-wireframe.mjs ---
const STATUS = { 'x': 'done', '~': 'partial', ' ': 'pending' };

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

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Parse the wireframe into leaves, same order/numbering as the sync script.
const text = await readFile(SRC, 'utf8');
const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

const cb = /^(\s*)-\s\[([x~ ])\]\s+(.*)$/;
let h2 = null;
let h3 = null;
let n = 0;
const rows = [];

for (const raw of lines) {
  const h2m = raw.match(/^##\s+(.*)$/);
  if (h2m) { h2 = h2m[1].trim(); h3 = null; continue; }
  const h3m = raw.match(/^###\s+(.*)$/);
  if (h3m) { h3 = h3m[1].trim(); continue; }
  const m = raw.match(cb);
  if (!m) continue;
  const indent = m[1].length;
  n += 1;
  rows.push({
    seq: n,
    surface: surfaceOf(h2),
    section: h3 || h2 || null,
    depth: Math.floor(indent / 2),
    status: STATUS[m[2]],
    title: m[3].trim(),
  });
}

const total = rows.length;
const done = rows.filter((r) => r.status === 'done').length;
const partial = rows.filter((r) => r.status === 'partial').length;
const pending = rows.filter((r) => r.status === 'pending').length;

// Group by surface, preserving section subheads in document order.
const bySurface = new Map();
for (const r of rows) {
  if (!bySurface.has(r.surface)) bySurface.set(r.surface, []);
  bySurface.get(r.surface).push(r);
}

let body = '';
for (const surf of ORDER) {
  const items = bySurface.get(surf);
  if (!items || !items.length) continue;
  body += `<section class="surf">\n<h2>${esc(SURFACE_TITLES[surf] || surf)}</h2>\n`;
  let lastSection = null;
  for (const r of items) {
    if (r.section && r.section !== lastSection) {
      body += `<h3>${esc(r.section)}</h3>\n`;
      lastSection = r.section;
    }
    const box = r.status === 'done' ? '[x]' : r.status === 'partial' ? '[/]' : '[ ]';
    const cls = r.status === 'done' ? 'done' : r.status === 'partial' ? 'partial' : 'pending';
    const sub = r.depth > 0 ? ' sub' : '';
    const tag = r.status === 'partial' ? ' <span class="tag">(partial)</span>'
      : r.status === 'done' ? ' <span class="tag">(done)</span>' : '';
    body += `<div class="item ${cls}${sub}"><span class="n">${r.seq}.</span><span class="box">${box}</span><span class="t">${esc(r.title)}${tag}</span></div>\n`;
  }
  body += `</section>\n`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Team Magnificent MCS \u2014 Build Checklist</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt; line-height: 1.35; padding: 28px 34px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1 { font-size: 20pt; margin: 0 0 2px; letter-spacing: .01em; }
  .sub1 { font-size: 9.5pt; color: #000; margin: 0 0 10px; }
  .summary {
    border: 1.5px solid #000; padding: 7px 12px; margin: 0 0 18px;
    font-size: 10pt; display: flex; gap: 22px; flex-wrap: wrap;
  }
  .summary b { font-size: 12pt; }
  h2 {
    font-size: 13pt; margin: 20px 0 6px; padding-bottom: 3px;
    border-bottom: 2px solid #000; page-break-after: avoid;
  }
  h3 {
    font-size: 10.5pt; margin: 12px 0 4px; font-weight: 700;
    color: #000; page-break-after: avoid;
  }
  .item {
    display: flex; align-items: baseline; gap: 7px;
    padding: 1.5px 0; page-break-inside: avoid;
  }
  .item.sub { margin-left: 22px; }
  .n { min-width: 26px; text-align: right; font-variant-numeric: tabular-nums; color: #000; }
  .box { font-family: "Courier New", monospace; font-weight: 700; white-space: pre; }
  .t { flex: 1; }
  .item.done .t { text-decoration: line-through; color: #555; }
  .tag { font-size: 8.5pt; color: #555; font-style: italic; }
  .legend { font-size: 9pt; color: #000; margin: 4px 0 0; }
  .legend code { font-family: "Courier New", monospace; font-weight: 700; }
  footer { margin-top: 24px; font-size: 8.5pt; color: #555; border-top: 1px solid #000; padding-top: 6px; }
  @media print {
    body { padding: 0; }
    h2 { border-bottom: 2px solid #000; }
    .summary { border: 1.5px solid #000; }
  }
  @page { margin: 14mm; }
</style>
</head>
<body>
  <h1>Team Magnificent \u2014 Build Checklist</h1>
  <p class="sub1">Marketing Momentum Creation System \u00b7 generated from project-wireframe.md \u00b7 Chat #133 \u00b7 ${new Date().toISOString().slice(0, 10)}</p>
  <div class="summary">
    <span><b>${total}</b> items</span>
    <span><b>${done}</b> done</span>
    <span><b>${partial}</b> partial</span>
    <span><b>${pending}</b> remaining</span>
  </div>
  <p class="legend">Legend: <code>[x]</code> done \u00b7 <code>[/]</code> partial \u00b7 <code>[ ]</code> to&nbsp;build</p>
  ${body}
  <footer>Source of truth: docs/project-wireframe.md (state) + momentum.decisions (currency). Re-run server/scripts/build-checklist.mjs after updating the wireframe.</footer>
</body>
</html>
`;

await writeFile(OUT, html, 'utf8');
console.log(`WROTE ${OUT}`);
console.log(`items: ${total}  done: ${done}  partial: ${partial}  pending: ${pending}`);
