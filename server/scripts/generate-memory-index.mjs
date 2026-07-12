#!/usr/bin/env node
/**
 * ACR-0012 §3.6 — the agent-memory context library.
 *
 * Reads ALL notes from `universal_gateway.claude_learning_notes` on the
 * MEMORY stack and emits:
 *   - docs/agent-memory-index.html       (print-ready library of context)
 *   - docs/agent-memory-drift-report.md  (what a future migration would touch)
 *
 * READ-ONLY. This script never writes to any database. It normalizes legacy
 * field dialects on read and never mutates the source documents.
 *
 * Stack discipline (ACR-0012 §3.1): agent memory lives on the MEMORY stack
 * (gateway connectors mongodb/chromadb/neo4j — Mongo on 28000). The MCS-v2
 * APP stack (mongodb2/chromadb2/neo4j2 — Mongo on 30000) also hosts a
 * database named `momentum`; both stacks answer queries successfully, so this
 * script refuses to run against the app-stack Mongo.
 *
 * Env:
 *   MEMORY_MONGODB_URI  memory-stack Mongo URI. Default: mongodb://127.0.0.1:28000
 *   MEMORY_MONGODB_DB   memory-stack database.  Default: universal_gateway
 *
 * These are agent-tooling env vars, deliberately NOT in .env.example (that
 * file documents app-runtime persistence only). Do NOT reuse MONGODB_URI —
 * that is the app stack.
 *
 * Usage: node server/scripts/generate-memory-index.mjs   (or `pnpm memory:index`)
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const htmlPath = path.join(repoRoot, 'docs/agent-memory-index.html');
const driftPath = path.join(repoRoot, 'docs/agent-memory-drift-report.md');

const MEMORY_MONGODB_URI = process.env.MEMORY_MONGODB_URI || 'mongodb://127.0.0.1:28000';
const MEMORY_MONGODB_DB = process.env.MEMORY_MONGODB_DB || 'universal_gateway';
const COLLECTION = 'claude_learning_notes';
const CANONICAL_COLLECTION = `${MEMORY_MONGODB_DB}.${COLLECTION}`;

// The app stack (mongodb2) listens on 30000 and hosts a `momentum` database
// too. Reading memory from it "succeeds" and lies. Fail loudly instead.
if (/:30000\b/.test(MEMORY_MONGODB_URI)) {
  console.error(
    `MEMORY_MONGODB_URI (${MEMORY_MONGODB_URI}) points at port 30000 — that is the MCS-v2 APP stack, not the memory stack. ` +
      'Agent memory lives on the memory-stack Mongo (default mongodb://127.0.0.1:28000). Refusing to run.',
  );
  process.exit(1);
}

const CANONICAL_SEVERITIES = ['critical', 'high', 'medium', 'low'];
const SEVERITY_MEANINGS = {
  critical: 'violating this breaks production, corrupts data, or loses money',
  high: 'costs real rework, or repeats a mistake already paid for',
  medium: 'useful; saves time',
  low: 'incidental',
};

// ---------- normalization on read (never mutates the source) ----------

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

function toIso(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeNote(doc) {
  const severityRaw = typeof doc.severity === 'string' ? doc.severity : null;
  const severityLower = severityRaw ? severityRaw.toLowerCase() : null;
  let severityBucket;
  if (severityRaw == null) severityBucket = 'ungraded';
  else if (CANONICAL_SEVERITIES.includes(severityLower)) severityBucket = severityLower;
  else severityBucket = 'non-standard';

  const project = firstString(doc.project);
  const anchorPhrase = firstString(doc.anchor_phrase);
  const chat = Number.isFinite(doc.chat_number) ? doc.chat_number : Number.isFinite(doc.chat) ? doc.chat : null;

  return {
    id: firstString(doc.note_id, doc.noteId) ?? String(doc._id ?? ''),
    subject: firstString(doc.subject, doc.topic, doc.category) ?? '(no subject)',
    body: firstString(doc.note, doc.learned, doc.lesson, doc.content) ?? '',
    createdAt: toIso(doc.created_at ?? doc.createdAt ?? doc.timestamp ?? doc.date),
    severityRaw,
    severityBucket,
    severityCaseDrift: severityRaw != null && severityRaw !== severityLower && CANONICAL_SEVERITIES.includes(severityLower),
    project,
    unassignedProject: project == null || project === 'unassigned',
    chat,
    isAnchor: doc.priority_anchor === true || anchorPhrase != null,
    anchorPhrase,
    dialects: {
      noteId: 'noteId' in doc,
      topic: 'topic' in doc,
      category: 'category' in doc,
      learned: 'learned' in doc,
      lesson: 'lesson' in doc,
      content: 'content' in doc,
      createdAt: 'createdAt' in doc,
      timestamp: !('created_at' in doc) && !('createdAt' in doc) && 'timestamp' in doc,
      date: !('created_at' in doc) && !('createdAt' in doc) && 'date' in doc,
      chat: !('chat_number' in doc) && 'chat' in doc,
    },
    hasCanonicalDate: 'created_at' in doc,
    hasAnyDate: toIso(doc.created_at ?? doc.createdAt ?? doc.timestamp ?? doc.date) != null,
  };
}

// ---------- integrity metrics ----------

function buildIntegrity(notes) {
  const total = notes.length;
  const count = (fn) => notes.filter(fn).length;
  const bySeverity = {};
  for (const bucket of [...CANONICAL_SEVERITIES, 'non-standard', 'ungraded']) {
    bySeverity[bucket] = count((n) => n.severityBucket === bucket);
  }
  const dialectCounts = {};
  for (const key of ['noteId', 'topic', 'category', 'learned', 'lesson', 'content', 'createdAt', 'timestamp', 'date', 'chat']) {
    dialectCounts[key] = count((n) => n.dialects[key]);
  }
  const criticalOrHigh = bySeverity.critical + bySeverity.high;
  return {
    total,
    ungraded: bySeverity.ungraded,
    unassignedProject: count((n) => n.unassignedProject),
    anchors: count((n) => n.isAnchor),
    bySeverity,
    severityCaseDrift: count((n) => n.severityCaseDrift),
    nonStandardSeverityValues: [...new Set(notes.filter((n) => n.severityBucket === 'non-standard').map((n) => n.severityRaw))],
    criticalOrHigh,
    criticalOrHighPct: total === 0 ? 0 : Math.round((criticalOrHigh / total) * 1000) / 10,
    dialectCounts,
    undated: count((n) => !n.hasAnyDate),
    nonCanonicalDate: count((n) => !n.hasCanonicalDate),
  };
}

// ---------- HTML ----------

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : '—';
}

function newestFirst(a, b) {
  if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
  if (a.createdAt) return -1;
  if (b.createdAt) return 1;
  return a.subject.localeCompare(b.subject);
}

function severityTable(title, meaning, rows) {
  const body = rows
    .map(
      (n) => `      <tr>
        <td class="date">${esc(fmtDate(n.createdAt))}</td>
        <td class="subject">${esc(n.subject)}${n.isAnchor ? ' <span class="anchor-mark">⚓ anchor</span>' : ''}</td>
        <td>${n.unassignedProject ? '<span class="defect">unassigned</span>' : esc(n.project)}</td>
        <td class="num">${n.chat ?? '—'}</td>
        <td class="mono">${esc(n.id)}</td>
      </tr>`,
    )
    .join('\n');
  return `  <section class="severity-section">
    <h2><span class="sev sev--${title.replace(/[^a-z]/g, '')}">${esc(title)}</span> <span class="count">${rows.length}</span>${meaning ? ` <span class="meaning">${esc(meaning)}</span>` : ''}</h2>
    <table>
      <thead>
        <tr><th class="date">Date</th><th class="subject">Subject</th><th>Project</th><th class="num">Chat</th><th>note_id</th></tr>
      </thead>
      <tbody>
${body}
      </tbody>
    </table>
  </section>`;
}

function renderHtml(notes, integrity, generatedAt) {
  const anchors = notes.filter((n) => n.isAnchor).sort(newestFirst);
  const anchorCards = anchors
    .map(
      (n) => `    <article class="anchor-card">
      <p class="anchor-phrase">${esc((n.anchorPhrase ?? n.subject).toUpperCase())}</p>
      <p class="anchor-subject">${esc(n.subject)}</p>
      <p class="anchor-meta">${esc(fmtDate(n.createdAt))} · ${n.unassignedProject ? 'unassigned' : esc(n.project)} · <span class="mono">${esc(n.id)}</span></p>
      <p class="anchor-body">${esc(n.body.slice(0, 480))}${n.body.length > 480 ? '…' : ''}</p>
    </article>`,
    )
    .join('\n');

  const sections = [
    ...CANONICAL_SEVERITIES.map((sev) =>
      severityTable(sev, SEVERITY_MEANINGS[sev], notes.filter((n) => n.severityBucket === sev).sort(newestFirst)),
    ),
    severityTable('non-standard', 'severity value outside the canonical four — counted, never silently coerced', notes.filter((n) => n.severityBucket === 'non-standard').sort(newestFirst)),
    severityTable('ungraded', 'no severity at all — invisible to triage until graded', notes.filter((n) => n.severityBucket === 'ungraded').sort(newestFirst)),
  ].join('\n');

  const dialectRows = Object.entries(integrity.dialectCounts)
    .filter(([, n]) => n > 0)
    .map(([field, n]) => `        <tr><td class="mono">${esc(field)}</td><td class="num">${n}</td></tr>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Memory Index — The Library of Context</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #0A0A0A;
    --ink-2: #0F0F0F;
    --gold: #C9A84C;
    --gold-bright: #F5C030;
    --teal: #2DD4BF;
    --cream: #F5EFE6;
    --cream-mute: rgba(245, 239, 230, 0.72);
    --cream-faint: rgba(245, 239, 230, 0.48);
    --line: rgba(245, 239, 230, 0.12);
    --display: 'Bebas Neue', sans-serif;
    --body: 'DM Sans', sans-serif;
    --mono: 'DM Mono', 'JetBrains Mono', monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ink);
    color: var(--cream);
    font-family: var(--body);
    font-size: 14px;
    line-height: 1.5;
  }
  main { max-width: 1080px; margin: 0 auto; padding: 48px 32px 96px; }
  header.masthead { border-bottom: 1px solid var(--gold); padding-bottom: 24px; margin-bottom: 40px; }
  .eyebrow { color: var(--teal); font-family: var(--mono); font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; margin: 0 0 8px; }
  h1 { font-family: var(--display); font-size: 56px; font-weight: 400; letter-spacing: 0.02em; color: var(--gold); margin: 0; line-height: 1; }
  .subtitle { color: var(--cream-mute); margin: 10px 0 0; max-width: 64ch; }
  .provenance { font-family: var(--mono); font-size: 12px; color: var(--cream-faint); margin-top: 14px; }
  h2 { font-family: var(--display); font-size: 30px; font-weight: 400; letter-spacing: 0.03em; color: var(--gold); margin: 0 0 16px; }
  h2 .count { color: var(--cream-faint); font-size: 22px; margin-left: 8px; }
  h2 .meaning { display: block; font-family: var(--body); font-size: 13px; color: var(--cream-faint); letter-spacing: 0; text-transform: none; margin-top: 2px; }
  section { margin-bottom: 48px; }

  /* Corpus integrity — governance first */
  .integrity { border: 1px solid var(--gold); background: var(--ink-2); padding: 24px; }
  .integrity h2 { color: var(--gold-bright); }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .stat { border: 1px solid var(--line); padding: 14px 16px; }
  .stat .value { font-family: var(--display); font-size: 40px; line-height: 1; color: var(--cream); }
  .stat .label { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cream-faint); margin-top: 6px; }
  .stat--defect .value { color: var(--gold-bright); }
  .stat--anchor .value { color: var(--teal); }
  .integrity-note { color: var(--cream-mute); font-size: 13px; max-width: 78ch; }
  .defect { color: var(--gold-bright); font-family: var(--mono); font-size: 12px; }

  /* Anchors — Kevin's handles */
  .anchors h2 { color: var(--teal); }
  .anchor-card { border: 1px solid var(--gold); border-left: 6px solid var(--gold-bright); background: var(--ink-2); padding: 20px 24px; margin-bottom: 16px; }
  .anchor-phrase { font-family: var(--display); font-size: 34px; letter-spacing: 0.04em; color: var(--gold-bright); margin: 0; line-height: 1.05; }
  .anchor-subject { color: var(--cream); font-weight: 500; margin: 8px 0 0; }
  .anchor-meta { font-family: var(--mono); font-size: 12px; color: var(--cream-faint); margin: 6px 0 0; }
  .anchor-body { color: var(--cream-mute); margin: 12px 0 0; font-size: 13px; }
  .anchor-rule { color: var(--cream-faint); font-size: 13px; margin-top: 4px; }

  table { width: 100%; border-collapse: collapse; }
  th { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--gold); }
  td { padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  td.subject { color: var(--cream); }
  td.date, th.date { white-space: nowrap; width: 96px; }
  .num { text-align: right; width: 56px; font-family: var(--mono); }
  .mono { font-family: var(--mono); font-size: 12px; color: var(--cream-mute); }
  .anchor-mark { color: var(--teal); font-family: var(--mono); font-size: 11px; }
  .sev { text-transform: uppercase; }
  .sev--critical { color: var(--gold-bright); }
  .sev--high { color: var(--gold); }
  .sev--medium, .sev--low { color: var(--cream); }
  .sev--nonstandard, .sev--ungraded { color: var(--cream-mute); }

  /* Print — Letter, light theme (brand print variant), repeating thead, no row splits */
  @media print {
    @page { size: Letter; margin: 0.6in; }
    body { background: #FFFFFF; color: var(--ink); font-size: 11px; }
    main { max-width: none; padding: 0; }
    h1 { color: var(--ink); }
    .eyebrow, .anchor-mark { color: #0E8074; }
    h2, th { color: var(--ink); border-color: var(--ink); }
    .subtitle, .integrity-note, .anchor-body, .meaning, td.subject, td, .mono, .anchor-rule { color: var(--ink); }
    .provenance, .stat .label, .anchor-meta, h2 .count { color: rgba(10, 10, 10, 0.6); }
    .integrity, .anchor-card, .stat { background: #FFFFFF; border-color: var(--gold); }
    .stat .value, .anchor-phrase { color: var(--ink); }
    .stat--defect .value, .defect, .sev--critical { color: #8A6D1F; }
    td { border-bottom-color: rgba(10, 10, 10, 0.15); }
    thead { display: table-header-group; }
    tr, .stat, .anchor-card { break-inside: avoid; page-break-inside: avoid; }
    .severity-section, .anchors { break-before: auto; }
    h2 { break-after: avoid; }
  }
</style>
</head>
<body>
<main>
  <header class="masthead">
    <p class="eyebrow">Team Magnificent · Agent Memory · ACR-0012</p>
    <h1>The Library of Context</h1>
    <p class="subtitle">Every durable lesson, decision, and correction in <span class="mono">${esc(CANONICAL_COLLECTION)}</span>. Memory is not an archive — it is a vocabulary. Regenerate with <span class="mono">pnpm memory:index</span>.</p>
    <p class="provenance">Generated ${esc(generatedAt)} · memory stack (read-only) · ${integrity.total} notes</p>
  </header>

  <section class="integrity">
    <h2>Corpus Integrity</h2>
    <div class="stat-grid">
      <div class="stat"><div class="value">${integrity.total}</div><div class="label">Total notes</div></div>
      <div class="stat stat--defect"><div class="value">${integrity.ungraded}</div><div class="label">Ungraded (no severity)</div></div>
      <div class="stat stat--defect"><div class="value">${integrity.unassignedProject}</div><div class="label">Unassigned project</div></div>
      <div class="stat stat--anchor"><div class="value">${integrity.anchors}</div><div class="label">Named anchors</div></div>
      <div class="stat stat--defect"><div class="value">${integrity.criticalOrHighPct}%</div><div class="label">Critical or high</div></div>
      <div class="stat stat--defect"><div class="value">${integrity.severityCaseDrift + integrity.bySeverity['non-standard']}</div><div class="label">Severity drift</div></div>
      <div class="stat stat--defect"><div class="value">${integrity.undated}</div><div class="label">No usable date</div></div>
    </div>
    <table>
      <thead><tr><th>Legacy field dialect</th><th class="num">Notes</th></tr></thead>
      <tbody>
${dialectRows}
      </tbody>
    </table>
    <p class="integrity-note">Severity grades the consequence of being wrong, not enthusiasm at the time of writing. ${integrity.criticalOrHighPct}% of the corpus is graded critical-or-high against a &lt;10% critical target — severity does not currently discriminate. ${integrity.severityCaseDrift} note(s) drift only in casing (e.g. HIGH); ${integrity.bySeverity['non-standard']} carry a value outside the canonical four (${esc(integrity.nonStandardSeverityValues.join(', ') || 'none')}). Nothing here has been mutated: this index normalizes on read only (ACR-0012 §4).</p>
  </section>

  <section class="anchors">
    <h2>Named Anchors — Kevin's Handles</h2>
    <p class="anchor-rule">An anchor is minted only when Kevin names something. Saying the phrase pulls the whole reasoning chain back into context (ACR-0012 §3.4).</p>
${anchorCards || '    <p class="integrity-note">No named anchors found.</p>'}
  </section>

${sections}
</main>
</body>
</html>
`;
}

// ---------- drift report ----------

function renderDriftReport(integrity, generatedAt) {
  const s = integrity;
  const dialectLines = Object.entries(s.dialectCounts)
    .filter(([, n]) => n > 0)
    .map(([field, n]) => {
      const target = {
        noteId: 'rename to `note_id`',
        topic: 'rename to `subject`',
        category: 'rename to `subject`',
        learned: 'rename to `note`',
        lesson: 'rename to `note`',
        content: 'rename to `note`',
        createdAt: 'rename to `created_at`',
        timestamp: 'convert to `created_at` (ISO 8601)',
        date: 'convert to `created_at` (ISO 8601)',
        chat: 'rename to `chat_number` (integer-only)',
      }[field];
      return `| \`${field}\` | ${n} | ${target} |`;
    })
    .join('\n');

  return `# Agent Memory Drift Report — \`${CANONICAL_COLLECTION}\`

> Generated ${generatedAt} by \`node server/scripts/generate-memory-index.mjs\` (\`pnpm memory:index\`).
>
> **READ-ONLY.** This report *describes* non-conformance against the canonical
> schema in [ACR-0012 §3.2](governance/ACR-0012-agent-memory-schema.md). Under
> ACR-0012 §4, mutating the existing corpus — backfill, re-grading, renames —
> is explicitly out of scope and requires a separately ratified migration.
> Nothing was modified to produce this report.

## Corpus snapshot

| Metric | Value |
|---|---:|
| Total notes | ${s.total} |
| Ungraded (no \`severity\`) | ${s.ungraded} |
| Unassigned project (missing or \`unassigned\`) | ${s.unassignedProject} |
| Named anchors | ${s.anchors} |
| Graded \`critical\` | ${s.bySeverity.critical} |
| Graded \`high\` | ${s.bySeverity.high} |
| Graded \`medium\` | ${s.bySeverity.medium} |
| Graded \`low\` | ${s.bySeverity.low} |
| Critical-or-high share | ${s.criticalOrHighPct}% (target: critical <10%) |
| Severity casing drift (e.g. \`HIGH\`) | ${s.severityCaseDrift} |
| Non-standard severity values | ${s.bySeverity['non-standard']} (${s.nonStandardSeverityValues.join(', ') || 'none'}) |
| No usable date at all | ${s.undated} |
| No canonical \`created_at\` | ${s.nonCanonicalDate} |

## What a future migration would touch

### Field renames (dialect → canonical)

| Legacy field | Notes carrying it | Migration action |
|---|---:|---|
${dialectLines}

Counts overlap — one note can carry several dialects. \`timestamp\`/\`date\`/\`chat\`
are counted only where the canonical field is absent.

### Grading and assignment backfill

- **${s.ungraded} notes** need a severity grade. Under §3.3 discipline most
  should land \`medium\`/\`low\`; bulk-defaulting them to \`high\` would repeat the
  severity collapse this ACR exists to reverse.
- **${s.unassignedProject} notes** need a real \`project\` value. \`unassigned\`
  is a defect, not a value.
- **${s.severityCaseDrift} notes** need only case normalization (\`HIGH\` → \`high\`).
- **${s.bySeverity['non-standard']} note(s)** carry a severity outside the canonical
  four (${s.nonStandardSeverityValues.join(', ') || 'none'}) and need a human re-grade —
  not a mechanical coercion.
- **${s.undated} notes** have no recoverable date on any known dialect; a
  migration could fall back to the ObjectId timestamp where \`_id\` is an ObjectId.
- Every note needs \`canonical_collection: "${CANONICAL_COLLECTION}"\` and a
  \`trigger\` keyword string where absent.

### Cross-store legs

The canonical write protocol (§3.5) is Mongo → Chroma → Neo4j with read-back.
A migration must also reconcile the Chroma projection (memory-stack
\`claude_learning_notes\` — the app-stack copy is legacy and must not be
written) using **delete-then-add** (Chroma \`add()\` does not overwrite), and
re-verify anchor retrieval for every \`priority_anchor\` note.

## What this report deliberately does not do

- It does not modify, re-grade, rename, or backfill any of the ${s.total} notes.
- It does not touch the app stack (\`mongodb2\`/\`chromadb2\`/\`neo4j2\`).
- It does not decide the migration — that is a separate ratified step.
`;
}

// ---------- main ----------

async function main() {
  const connection = await mongoose
    .createConnection(MEMORY_MONGODB_URI, { dbName: MEMORY_MONGODB_DB, serverSelectionTimeoutMS: 8000 })
    .asPromise();
  try {
    const docs = await connection.db.collection(COLLECTION).find({}).toArray();
    const notes = docs.map(normalizeNote);
    const integrity = buildIntegrity(notes);
    const generatedAt = new Date().toISOString();

    writeFileSync(htmlPath, renderHtml(notes, integrity, generatedAt));
    writeFileSync(driftPath, renderDriftReport(integrity, generatedAt));

    console.log(`Read ${integrity.total} notes from ${CANONICAL_COLLECTION} (memory stack, read-only).`);
    console.log(
      `Integrity: ${integrity.ungraded} ungraded · ${integrity.unassignedProject} unassigned project · ` +
        `${integrity.anchors} named anchor(s) · ${integrity.criticalOrHighPct}% critical-or-high · ` +
        `${integrity.severityCaseDrift} severity case drift · ${integrity.bySeverity['non-standard']} non-standard severity.`,
    );
    console.log(`Wrote ${path.relative(repoRoot, htmlPath)} and ${path.relative(repoRoot, driftPath)}.`);
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
