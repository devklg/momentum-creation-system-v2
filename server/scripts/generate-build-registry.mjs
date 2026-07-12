#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(repoRoot, 'docs/project-wireframe.md');
const outputPath = path.join(repoRoot, 'docs/build-registry.md');
const check = process.argv.includes('--check');
const trackedFiles = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((value) => value.replaceAll('\\', '/'));

const STATUS = { x: 'done', '~': 'partial', ' ': 'pending' };

function surfaceOf(heading) {
  if (!heading) return 'other';
  const value = heading.toLowerCase();
  if (value.includes('foundation')) return 'foundation';
  if (value.includes('auth')) return 'auth';
  if (value.includes('.com')) return 'com';
  if (value.includes('.team')) return 'team';
  if (value.includes('admin')) return 'admin';
  if (value.includes('drift') || value.includes('hygiene')) return 'hygiene';
  return 'other';
}

function parseWireframe(text) {
  const rows = [];
  let group = null;
  let section = null;
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const h2 = raw.match(/^##\s+(.+)$/);
    if (h2) {
      group = h2[1].trim();
      section = null;
      continue;
    }
    const h3 = raw.match(/^###\s+(.+)$/);
    if (h3) {
      section = h3[1].trim();
      continue;
    }
    const item = raw.match(/^(\s*)-\s\[([x~ ])\]\s+(.+)$/);
    if (!item) continue;
    rows.push({
      seq: rows.length + 1,
      surface: surfaceOf(group),
      group: group ?? 'Other',
      section: section ?? group ?? 'Other',
      depth: Math.floor(item[1].length / 2),
      status: STATUS[item[2]],
      title: item[3].trim(),
    });
  }
  return rows;
}

function evidenceFor(title) {
  const refs = [...title.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1].trim())
    .filter((ref) => /^(apps|server|packages|docs|engineering)\//.test(ref))
    .filter((ref) => !ref.includes('*'));
  const unique = [...new Set(refs)];
  const existing = unique.filter((ref) => existsSync(path.join(repoRoot, ref)));
  const missing = unique.filter((ref) => !existsSync(path.join(repoRoot, ref)));
  const mentionedFiles = [...title.matchAll(/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:ts|tsx|mjs|md|html|pdf|docx)/g)]
    .map((match) => match[0].replaceAll('\\', '/'));
  const inferred = [];
  for (const mention of mentionedFiles) {
    const normalized = mention.replace(/^(apps|server|packages|docs|engineering)\//, '$1/');
    const matches = trackedFiles.filter((file) => file === normalized || file.endsWith(`/${normalized}`));
    for (const match of matches) {
      if (!existing.includes(match) && !inferred.includes(match)) inferred.push(match);
      if (inferred.length >= 4) break;
    }
    if (inferred.length >= 4) break;
  }
  return { existing: [...existing, ...inferred], missing };
}

function escCell(value) {
  return String(value).replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function render(rows) {
  const statuses = ['done', 'partial', 'pending'];
  const surfaces = [...new Set(rows.map((row) => row.surface))];
  const totals = Object.fromEntries(statuses.map((status) => [status, rows.filter((row) => row.status === status).length]));
  const explicitEvidence = rows.filter((row) => evidenceFor(row.title).existing.length > 0).length;
  const missingRefs = rows.flatMap((row) => evidenceFor(row.title).missing.map((ref) => ({ seq: row.seq, ref })));

  let out = '# Build Registry — Team Magnificent Momentum Creation System v2\n\n';
  out += '> GENERATED FILE. Source state comes from `docs/project-wireframe.md`; repository paths in wireframe leaves are checked against the working tree. Run `pnpm registry:build` after changing the wireframe and `pnpm registry:build:check` to detect drift.\n\n';
  out += '## Authority and interpretation\n\n';
  out += 'Decision ledger (currency) > `docs/locked-spec.md` (state) > design docs > this generated registry > git log > agent chat registry > handoffs. A `done` status is inherited from the wireframe. “Path verified” means at least one repository path named by that leaf exists; it does not independently prove runtime behavior.\n\n';
  out += '## Current summary\n\n';
  out += `- Total build leaves: ${rows.length}\n- Done: ${totals.done}\n- Partial: ${totals.partial}\n- Pending: ${totals.pending}\n- Leaves with explicit verified repository-path evidence: ${explicitEvidence}\n- Stale explicit repository references: ${missingRefs.length}\n\n`;
  out += '| Surface | Done | Partial | Pending | Total |\n|---|---:|---:|---:|---:|\n';
  for (const surface of surfaces) {
    const subset = rows.filter((row) => row.surface === surface);
    out += `| ${surface} | ${subset.filter((r) => r.status === 'done').length} | ${subset.filter((r) => r.status === 'partial').length} | ${subset.filter((r) => r.status === 'pending').length} | ${subset.length} |\n`;
  }

  out += '\n## Leaf registry\n\n';
  out += '| # | Surface | Section | Status | Build leaf | Code evidence |\n|---:|---|---|---|---|---|\n';
  for (const row of rows) {
    const evidence = evidenceFor(row.title);
    const evidenceText = evidence.existing.length
      ? evidence.existing.map((ref) => `\`${ref}\``).join(', ')
      : evidence.missing.length
        ? `stale ref: ${evidence.missing.map((ref) => `\`${ref}\``).join(', ')}`
        : 'wireframe status; no explicit path';
    const indent = row.depth > 0 ? '↳ ' : '';
    out += `| ${row.seq} | ${escCell(row.surface)} | ${escCell(row.section)} | ${row.status} | ${indent}${escCell(row.title)} | ${escCell(evidenceText)} |\n`;
  }

  if (missingRefs.length) {
    out += '\n## Stale explicit references\n\n';
    out += 'These paths are named by the wireframe but were not present when this registry was generated. They are surfaced for reconciliation; the generator never changes leaf status automatically.\n\n';
    for (const item of missingRefs) out += `- Leaf ${item.seq}: \`${item.ref}\`\n`;
  }

  out += '\n---\n\nGenerated deterministically from `docs/project-wireframe.md` plus filesystem path evidence. Do not hand-edit this file.\n';
  return out;
}

const generated = render(parseWireframe(readFileSync(sourcePath, 'utf8')));
if (check) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (current !== generated) {
    console.error('docs/build-registry.md is stale. Run: pnpm registry:build');
    process.exit(1);
  }
  console.log('docs/build-registry.md is current.');
} else {
  writeFileSync(outputPath, generated, 'utf8');
  console.log('WROTE docs/build-registry.md');
}
