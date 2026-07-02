// Renders the ERD Mermaid diagrams to a print-ready multi-page PDF (one diagram
// per page, landscape). mermaid-cli (bundled chromium) → PNG → pdf-lib → PDF.
// Regenerate: pnpm add -w -D @mermaid-js/mermaid-cli pdf-lib && node scripts/gen-erd-pdf.mjs
// (these deps are removed after generating so puppeteer/chromium don't burden CI/installs).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const SRC = 'engineering/reports/MCS_V2_DB_ERD.md';
const OUT = 'engineering/reports/MCS_V2_DB_ERD.pdf';
const TMP = process.env.SCRATCH || 'scripts/.erd-tmp';
mkdirSync(TMP, { recursive: true });
writeFileSync(`${TMP}/pp.json`, JSON.stringify({ args: ['--no-sandbox'] }));

// ── parse: pair each ## heading with the mermaid block that follows ──
const lines = readFileSync(SRC, 'utf8').split(/\r?\n/);
const blocks = [];
let heading = 'Overview', inMer = false, buf = [];
for (const ln of lines) {
  const h = ln.match(/^##+\s+(.*)$/);
  if (h && !inMer) heading = h[1].replace(/[·]/g, '-').trim();
  if (ln.trim() === '```mermaid') { inMer = true; buf = []; continue; }
  if (inMer && ln.trim() === '```') { inMer = false; blocks.push({ heading, code: buf.join('\n') }); continue; }
  if (inMer) buf.push(ln);
}
console.log(`found ${blocks.length} diagrams`);

const CLI = 'node_modules/@mermaid-js/mermaid-cli/src/cli.js';
const pngs = [];
blocks.forEach((b, i) => {
  const mmd = `${TMP}/d${i}.mmd`, png = `${TMP}/d${i}.png`;
  writeFileSync(mmd, b.code);
  try {
    execFileSync(process.execPath, [CLI, '-i', mmd, '-o', png, '-b', 'white', '-s', '3', '-p', `${TMP}/pp.json`, '-t', 'neutral'], { stdio: 'pipe' });
    pngs.push({ ...b, png });
    console.log(`  rendered ${i + 1}/${blocks.length}: ${b.heading}`);
  } catch (e) {
    console.log(`  FAILED ${b.heading}: ${String(e.stderr || e).slice(0, 200)}`);
  }
});

// ── assemble PDF (landscape letter, one diagram/page, title above) ──
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.HelveticaBold);
const sub = await pdf.embedFont(StandardFonts.Helvetica);
const PW = 792, PH = 612, M = 40;
const ascii = (s) => s.replace(/→/g, '->').replace(/[·—–]/g, '-').replace(/[^\x20-\x7E]/g, '').trim();

// title page
{
  const pg = pdf.addPage([PW, PH]);
  pg.drawText('MOMENTUM CREATION SYSTEM V2', { x: M, y: PH - 140, size: 16, font: sub, color: rgb(0.54, 0.17, 0.89) });
  pg.drawText('Database Architecture — ERD', { x: M, y: PH - 180, size: 34, font, color: rgb(0.08, 0.09, 0.11) });
  pg.drawText('Dedicated triple-stack · Mongo momentum@30000 · Neo4j@7710 · Chroma@8200', { x: M, y: PH - 212, size: 12, font: sub, color: rgb(0.36, 0.38, 0.43) });
  pg.drawText('Canonical (Rev 2) names · tmag_ app-domain · mcs_ system/memory', { x: M, y: PH - 232, size: 12, font: sub, color: rgb(0.36, 0.38, 0.43) });
}

for (const b of pngs) {
  const img = await pdf.embedPng(readFileSync(b.png));
  const pg = pdf.addPage([PW, PH]);
  pg.drawText(ascii(b.heading), { x: M, y: PH - M - 6, size: 16, font, color: rgb(0.23, 0.51, 0.96) });
  const availW = PW - 2 * M, availH = PH - 2 * M - 30;
  const sc = Math.min(availW / img.width, availH / img.height);
  const w = img.width * sc, h = img.height * sc;
  pg.drawImage(img, { x: (PW - w) / 2, y: (PH - M - 30 - h), width: w, height: h });
}

const bytes = await pdf.save();
writeFileSync(OUT, bytes);
console.log(`wrote ${OUT} (${pngs.length} diagrams, ${(bytes.length / 1024).toFixed(0)} KB)`);
