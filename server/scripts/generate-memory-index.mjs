#!/usr/bin/env node
/**
 * ACR-0012 §3.4 / ACR-0013 §3 — THE LIBRARY OF CONTEXT.
 *
 * Reads ALL memory stores — an index of one is a fragment — and emits:
 *   - docs/memory-index.html        (print-ready library, Kevin-first order)
 *   - docs/memory-drift-report.md   (what a future migration WOULD touch)
 *
 * Section order IS the spec (this is Kevin's library, not an agent hygiene
 * report):
 *   1. Handles & aliases  — Kevin's vocabulary and call phrases
 *   2. Milestones         — pinned, preserve-for-perpetuity
 *   3. Decisions          — governance ledger + Kevin's decisions
 *   4. Work chronicle     — session handoffs (Holding Tank, orientation, …)
 *   5. Learning notes     — corrections, with corpus integrity at the back
 *
 * READ-ONLY against every database. Legacy dialects are normalized on read
 * and never mutated (ACR-0012 §4).
 *
 * Stacks (both host a `momentum` database — name the stack, always):
 *   MEMORY  Mongo 28000  — universal_gateway.* + momentum.decisions (ledger)
 *   APP     Mongo 30000  — momentum.mcs_memory_context_index (CDX home)
 *
 * Env (agent tooling — deliberately NOT in .env.example):
 *   MEMORY_MONGODB_URI  default mongodb://127.0.0.1:28000  (refuses :30000)
 *   APP_MONGODB_URI     default mongodb://127.0.0.1:30000  (refuses :28000)
 *
 * Usage: pnpm memory:index
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const htmlPath = path.join(repoRoot, 'docs/memory-index.html');
const driftPath = path.join(repoRoot, 'docs/memory-drift-report.md');

const MEMORY_MONGODB_URI = process.env.MEMORY_MONGODB_URI || 'mongodb://127.0.0.1:28000';
const APP_MONGODB_URI = process.env.APP_MONGODB_URI || 'mongodb://127.0.0.1:30000';

if (/:30000\b/.test(MEMORY_MONGODB_URI)) {
  console.error(`MEMORY_MONGODB_URI (${MEMORY_MONGODB_URI}) points at :30000 — that is the APP stack. Refusing to run.`);
  process.exit(1);
}
if (/:28000\b/.test(APP_MONGODB_URI)) {
  console.error(`APP_MONGODB_URI (${APP_MONGODB_URI}) points at :28000 — that is the MEMORY stack. Refusing to run.`);
  process.exit(1);
}

const NOTES_COLLECTION = 'universal_gateway.claude_learning_notes';
const CANONICAL_SEVERITIES = ['critical', 'high', 'medium', 'low'];
const SEVERITY_MEANINGS = {
  critical: 'violating this breaks production, corrupts data, or loses money',
  high: 'costs real rework, or repeats a mistake already paid for',
  medium: 'useful; saves time',
  low: 'incidental',
};

// The 13 graph verbs — Kevin's OPERATORS at speak-time, not schema
// decoration. Coverage is a first-class metric: a verb with zero edges is a
// hollow operator and must be reported as dead, never as an empty answer.
const GRAPH_VERBS = [
  'captures',
  'expresses',
  'supports',
  'requires_context',
  'guides',
  'retrieves',
  'grounds',
  'protects',
  'excludes',
  'hands_off_to',
  'relates_to',
  'supersedes',
  'contradicts',
];
const GATEWAY_URL = process.env.AGENT_MEMORY_GATEWAY_URL || 'http://localhost:2526';

/** Count edges per operator on one stack's graph (read-only, via gateway).
 * Edge types on disk are UPPERCASE on the memory stack, lowercase on the
 * app stack — counted case-insensitively, reported lowercase. */
async function measureVerbCoverage(connector, stack) {
  const res = await fetch(`${GATEWAY_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: connector,
      action: 'cypher',
      params: {
        query:
          'MATCH ()-[r]->() WITH type(r) AS t, count(r) AS c ' +
          'WHERE toLower(t) IN $verbs RETURN toLower(t) AS verb, sum(c) AS edges',
        params: { verbs: GRAPH_VERBS },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok || body.success === false) throw new Error(body.error || `HTTP ${res.status}`);
  const counts = new Map();
  for (const row of body.data?.records ?? []) {
    counts.set(String(row.verb), (counts.get(String(row.verb)) ?? 0) + Number(row.edges ?? 0));
  }
  return {
    stack,
    connector,
    verbs: GRAPH_VERBS.map((verb) => ({ verb, edgeCount: counts.get(verb) ?? 0 })),
    hollowVerbs: GRAPH_VERBS.filter((verb) => (counts.get(verb) ?? 0) === 0),
  };
}

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

function anyDate(doc) {
  return toIso(doc.created_at ?? doc.createdAt ?? doc.timestamp ?? doc.date) ?? (typeof doc.date === 'string' ? doc.date : null);
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

// ---------- HTML helpers ----------

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmtDate(value) {
  if (!value) return '—';
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value;
}

function clip(text, max = 260) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function newestFirst(a, b) {
  const da = a.sortDate ?? '';
  const db = b.sortDate ?? '';
  return db.localeCompare(da);
}

// ---------- section renderers ----------

function renderHandles(memoryIndexDocs, contextIndexDocs) {
  const entries = memoryIndexDocs.filter((d) => d.type === 'memory_index_entry');
  const aliases = memoryIndexDocs.filter((d) => d.type === 'memory_index_alias');
  const projections = contextIndexDocs;

  const cards = projections
    .map((d) => ({ ...d, sortDate: toIso(d.created_at ?? d.createdAt) }))
    .sort(newestFirst)
    .map(
      (d) => `    <article class="handle-card">
      <p class="handle-phrase">${esc(String(d.call_phrase ?? d.human_handle ?? d.title ?? d._id).toUpperCase())}</p>
      <p class="handle-subject">${esc(d.title ?? '')}</p>
      <p class="handle-meta">weight ${esc(d.weight ?? '—')}/10 · ${esc(fmtDate(anyDate(d)))} · named by ${esc(d.named_by ?? '—')} · <span class="mono">${esc(d._id)}</span>${
        Array.isArray(d.aliases) && d.aliases.length > 0 ? ` · aliases: <span class="mono">${esc(d.aliases.join(', '))}</span>` : ''
      }</p>
      <p class="handle-body">${esc(clip(d.meaning ?? d.content, 420))}</p>
      ${d.useWhen ? `<p class="handle-usewhen">${esc(clip(d.useWhen, 300))}</p>` : ''}
    </article>`,
    )
    .join('\n');

  const entryRows = entries
    .map((d) => ({ ...d, sortDate: toIso(d.created_at) }))
    .sort(newestFirst)
    .map(
      (d) => `      <tr>
        <td class="date">${esc(fmtDate(anyDate(d)))}</td>
        <td class="subject">${esc(d.human_handle ?? d.title ?? '')}</td>
        <td class="num">${esc(d.weight ?? '—')}</td>
        <td>${esc(d.memory_id ?? '')}</td>
      </tr>`,
    )
    .join('\n');

  const aliasRows = aliases
    .map(
      (d) => `      <tr>
        <td class="subject mono">${esc(d.alias ?? d.human_handle ?? '')}</td>
        <td>${esc(d.canonical_title ?? '')}</td>
        <td class="mono">${esc(d.memory_id ?? '')}</td>
      </tr>`,
    )
    .join('\n');

  return `  <section class="handles">
    <h2>1 · Handles &amp; Aliases — Kevin's Vocabulary</h2>
    <p class="section-note">The handle IS the meaning, not a pointer to it. Kevin says the words; the system reconstitutes the chain (ACR-0013 §2). Only Kevin mints a handle. Cards below are the retrieval-tested context-index projections (<span class="mono">momentum.mcs_memory_context_index</span>, app stack).</p>
${cards || '    <p class="section-note">No context-index handles found.</p>'}
    <h3>Memory-stack index entries <span class="count">${entries.length}</span> <span class="mono">universal_gateway.memory_index</span></h3>
    <table>
      <thead><tr><th class="date">Date</th><th class="subject">Handle (Kevin's words)</th><th class="num">Weight</th><th>memory_id</th></tr></thead>
      <tbody>
${entryRows}
      </tbody>
    </table>
    <h3>Aliases <span class="count">${aliases.length}</span></h3>
    <table>
      <thead><tr><th class="subject">Alias</th><th>Canonical title</th><th>memory_id</th></tr></thead>
      <tbody>
${aliasRows || '      <tr><td colspan="3">none</td></tr>'}
      </tbody>
    </table>
  </section>`;
}

function renderVerbCoverage(coverages) {
  const blocks = coverages
    .map((cov) => {
      if (cov.error) {
        return `    <p class="section-note defect">Verb coverage for the ${esc(cov.stack)} stack (${esc(cov.connector)}) is UNAVAILABLE: ${esc(cov.error)}. An unmeasured operator is not a working operator.</p>`;
      }
      const rows = cov.verbs
        .map(
          (v) =>
            `      <tr><td class="mono">${esc(v.verb)}</td><td class="num">${v.edgeCount}</td><td>${
              v.edgeCount === 0 ? '<span class="defect">DEAD — compiles an empty packet that looks like an answer</span>' : 'populated'
            }</td></tr>`,
        )
        .join('\n');
      return `    <h3>${esc(cov.stack)} stack <span class="mono">(${esc(cov.connector)})</span> <span class="count">${
        cov.verbs.length - cov.hollowVerbs.length
      }/${cov.verbs.length} operators populated</span></h3>
    <table>
      <thead><tr><th>Operator</th><th class="num">Edges</th><th>Status</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
    })
    .join('\n');

  return `  <section class="verbs">
    <h2>1b · Verb Coverage — The Operators</h2>
    <p class="section-note">The 13 graph verbs are Kevin's operators at speak-time: handle (noun) + verb (operator) = a packet compiled for that moment. Edges are relationships, not properties — typed, directional, traversable, carrying their own provenance. A verb with zero edges is a HOLLOW OPERATOR: it compiles an empty packet that looks like an answer. This table is the first-class metric that keeps that visible.</p>
${blocks}
  </section>`;
}

function renderMilestones(milestones) {
  const cards = milestones
    .map((d) => ({ ...d, sortDate: toIso(d.date ?? d.created_at) ?? String(d.date ?? '') }))
    .sort(newestFirst)
    .map(
      (d) => `    <article class="milestone-card">
      <p class="handle-phrase">${esc(String(d.chat_name_pinned_by_kevin ?? d.title ?? d._id).toUpperCase())}</p>
      <p class="handle-subject">${esc(d.title ?? '')}</p>
      <p class="handle-meta">${esc(fmtDate(anyDate(d)))}${d.preserve_for_perpetuity ? ' · PRESERVE FOR PERPETUITY' : ''} · <span class="mono">${esc(d._id)}</span></p>
      <p class="handle-body">${esc(clip(d.significance ?? '', 640))}</p>
    </article>`,
    )
    .join('\n');
  return `  <section class="milestones">
    <h2>2 · Milestones — Pinned by Kevin</h2>
    <p class="section-note"><span class="mono">universal_gateway.kevin_milestone_chats</span> · ${milestones.length} pinned arc(s).</p>
${cards || '    <p class="section-note">No milestones found.</p>'}
  </section>`;
}

function renderDecisions(governance, kevinDecisions) {
  const govRows = governance
    .map((d) => ({ ...d, sortDate: toIso(d.created_at ?? d.updated_at) ?? '' }))
    .sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0))
    .map(
      (d) => `      <tr>
        <td class="num">${esc(d.seq ?? '—')}</td>
        <td class="subject">${esc(d.title ?? d.topic ?? d._id)}</td>
        <td>${esc(d.status ?? '—')}</td>
        <td class="mono">${esc(d._id)}</td>
      </tr>`,
    )
    .join('\n');

  const kevinRows = kevinDecisions
    .map((d) => ({ ...d, sortDate: toIso(d.created_at) }))
    .sort(newestFirst)
    .map(
      (d) => `      <tr>
        <td class="date">${esc(fmtDate(anyDate(d)))}</td>
        <td class="subject">${esc(d.title ?? '')}</td>
        <td>${esc(d.type ?? '')}</td>
        <td>${esc(d.named_by ?? d.origin_kind ?? '—')}</td>
      </tr>`,
    )
    .join('\n');

  return `  <section class="decisions">
    <h2>3 · Decisions</h2>
    <h3>Governance ledger <span class="count">${governance.length}</span> <span class="mono">momentum.decisions (memory stack)</span></h3>
    <table>
      <thead><tr><th class="num">Seq</th><th class="subject">Decision</th><th>Status</th><th>id</th></tr></thead>
      <tbody>
${govRows}
      </tbody>
    </table>
    <h3>Kevin's decisions &amp; discoveries <span class="count">${kevinDecisions.length}</span> <span class="mono">universal_gateway.memory_decisions</span></h3>
    <table>
      <thead><tr><th class="date">Date</th><th class="subject">Title</th><th>Type</th><th>Named / origin</th></tr></thead>
      <tbody>
${kevinRows}
      </tbody>
    </table>
  </section>`;
}

function renderChronicle(handoffs) {
  const rows = handoffs
    .map((d) => ({ ...d, sortDate: toIso(d.created_at) ?? '' }))
    .sort(newestFirst)
    .map(
      (d) => `      <tr>
        <td class="date">${esc(fmtDate(anyDate(d)))}</td>
        <td class="num">${esc(Number.isFinite(d.chat_number) ? d.chat_number : '—')}</td>
        <td class="subject">${esc(d.title || clip(d.summary ?? d.front_of_line ?? '', 90) || String(d._id))}</td>
        <td>${esc(clip(d.summary ?? d.front_of_line ?? '', 220))}</td>
      </tr>`,
    )
    .join('\n');
  const nonInteger = handoffs.filter((d) => d.chat_number != null && !Number.isFinite(d.chat_number)).length;
  return `  <section class="chronicle">
    <h2>4 · Work Chronicle — Session Handoffs</h2>
    <p class="section-note"><span class="mono">universal_gateway.session_handoffs</span> · ${handoffs.length} handoff(s) · ${nonInteger} with non-integer chat_number (registry numbering drift, described in the drift report — not mutated).</p>
    <table>
      <thead><tr><th class="date">Date</th><th class="num">Chat</th><th class="subject">Title</th><th>Summary</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </section>`;
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
  return `    <h3><span class="sev sev--${title.replace(/[^a-z]/g, '')}">${esc(title)}</span> <span class="count">${rows.length}</span>${meaning ? ` <span class="meaning">${esc(meaning)}</span>` : ''}</h3>
    <table>
      <thead>
        <tr><th class="date">Date</th><th class="subject">Subject</th><th>Project</th><th class="num">Chat</th><th>note_id</th></tr>
      </thead>
      <tbody>
${body}
      </tbody>
    </table>`;
}

function noteNewestFirst(a, b) {
  if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
  if (a.createdAt) return -1;
  if (b.createdAt) return 1;
  return a.subject.localeCompare(b.subject);
}

function renderLearningNotes(notes, integrity) {
  const tables = [
    ...CANONICAL_SEVERITIES.map((sev) => severityTable(sev, SEVERITY_MEANINGS[sev], notes.filter((n) => n.severityBucket === sev).sort(noteNewestFirst))),
    severityTable('non-standard', 'severity value outside the canonical four — counted, never silently coerced', notes.filter((n) => n.severityBucket === 'non-standard').sort(noteNewestFirst)),
    severityTable('ungraded', 'no severity at all — invisible to triage until graded', notes.filter((n) => n.severityBucket === 'ungraded').sort(noteNewestFirst)),
  ].join('\n');

  const dialectRows = Object.entries(integrity.dialectCounts)
    .filter(([, n]) => n > 0)
    .map(([field, n]) => `        <tr><td class="mono">${esc(field)}</td><td class="num">${n}</td></tr>`)
    .join('\n');

  return `  <section class="notes">
    <h2>5 · Learning Notes — Agent Corrections</h2>
    <p class="section-note"><span class="mono">${esc(NOTES_COLLECTION)}</span> · severity grades the consequence of being wrong, not enthusiasm. Weight (0–10) on handles is the gradient for meaning; severity lives only here.</p>
${tables}
  </section>

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
    <p class="integrity-note">${integrity.criticalOrHighPct}% of the corpus is graded critical-or-high against a &lt;10% critical target — severity does not currently discriminate. ${integrity.severityCaseDrift} note(s) drift only in casing (e.g. HIGH); ${integrity.bySeverity['non-standard']} carry a value outside the canonical four (${esc(integrity.nonStandardSeverityValues.join(', ') || 'none')}). Nothing here has been mutated: this index normalizes on read only (ACR-0012 §4).</p>
  </section>`;
}

function renderHtml(sections, counts, generatedAt) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Library of Context — Memory Index</title>
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
  body { margin: 0; background: var(--ink); color: var(--cream); font-family: var(--body); font-size: 14px; line-height: 1.5; }
  main { max-width: 1080px; margin: 0 auto; padding: 48px 32px 96px; }
  header.masthead { border-bottom: 1px solid var(--gold); padding-bottom: 24px; margin-bottom: 40px; }
  .eyebrow { color: var(--teal); font-family: var(--mono); font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; margin: 0 0 8px; }
  h1 { font-family: var(--display); font-size: 56px; font-weight: 400; letter-spacing: 0.02em; color: var(--gold); margin: 0; line-height: 1; }
  .subtitle { color: var(--cream-mute); margin: 10px 0 0; max-width: 66ch; }
  .provenance { font-family: var(--mono); font-size: 12px; color: var(--cream-faint); margin-top: 14px; }
  h2 { font-family: var(--display); font-size: 32px; font-weight: 400; letter-spacing: 0.03em; color: var(--gold); margin: 0 0 12px; }
  h3 { font-family: var(--display); font-size: 22px; font-weight: 400; letter-spacing: 0.03em; color: var(--gold); margin: 24px 0 10px; }
  .count { color: var(--cream-faint); font-size: 18px; margin-left: 8px; }
  .meaning { display: block; font-family: var(--body); font-size: 13px; color: var(--cream-faint); letter-spacing: 0; text-transform: none; margin-top: 2px; }
  section { margin-bottom: 56px; }
  .section-note { color: var(--cream-mute); font-size: 13px; max-width: 82ch; }

  .handles h2, .milestones h2 { color: var(--teal); }
  .handle-card, .milestone-card { border: 1px solid var(--gold); border-left: 6px solid var(--gold-bright); background: var(--ink-2); padding: 20px 24px; margin-bottom: 16px; }
  .milestone-card { border-left-color: var(--teal); }
  .handle-phrase { font-family: var(--display); font-size: 34px; letter-spacing: 0.04em; color: var(--gold-bright); margin: 0; line-height: 1.05; }
  .milestone-card .handle-phrase { color: var(--teal); }
  .handle-subject { color: var(--cream); font-weight: 500; margin: 8px 0 0; }
  .handle-meta { font-family: var(--mono); font-size: 12px; color: var(--cream-faint); margin: 6px 0 0; }
  .handle-body { color: var(--cream-mute); margin: 12px 0 0; font-size: 13px; }
  .handle-usewhen { color: var(--teal); margin: 8px 0 0; font-size: 12px; font-family: var(--mono); }

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

  @media print {
    @page { size: Letter; margin: 0.6in; }
    body { background: #FFFFFF; color: var(--ink); font-size: 11px; }
    main { max-width: none; padding: 0; }
    h1 { color: var(--ink); }
    .eyebrow, .anchor-mark, .handle-usewhen { color: #0E8074; }
    h2, h3, th { color: var(--ink); border-color: var(--ink); }
    .subtitle, .integrity-note, .handle-body, .meaning, .section-note, td.subject, td, .mono { color: var(--ink); }
    .provenance, .stat .label, .handle-meta, .count { color: rgba(10, 10, 10, 0.6); }
    .integrity, .handle-card, .milestone-card, .stat { background: #FFFFFF; border-color: var(--gold); }
    .stat .value, .handle-phrase { color: var(--ink); }
    .stat--defect .value, .defect, .sev--critical { color: #8A6D1F; }
    td { border-bottom-color: rgba(10, 10, 10, 0.15); }
    thead { display: table-header-group; }
    tr, .stat, .handle-card, .milestone-card { break-inside: avoid; page-break-inside: avoid; }
    h2, h3 { break-after: avoid; }
  }
</style>
</head>
<body>
<main>
  <header class="masthead">
    <p class="eyebrow">Team Magnificent · Shared Memory · ACR-0012 / ACR-0013</p>
    <h1>The Library of Context</h1>
    <p class="subtitle">Kevin's vocabulary first, then the milestones, decisions, chronicle, and corrections behind it. Every store in ACR-0013 §3 — an index of one is a fragment. Regenerate with <span class="mono">pnpm memory:index</span>.</p>
    <p class="provenance">Generated ${esc(generatedAt)} · read-only across both stacks · ${esc(counts)}</p>
  </header>

${sections}
</main>
</body>
</html>
`;
}

// ---------- drift report ----------

function renderDriftReport(integrity, storeCounts, discrepancies, generatedAt) {
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

  const storeLines = storeCounts.map((r) => `| \`${r.path}\` | ${r.stack} | ${r.count} |`).join('\n');
  const discrepancyLines = discrepancies.map((d) => `- ${d}`).join('\n');

  return `# Memory Drift Report — all stores

> Generated ${generatedAt} by \`node server/scripts/generate-memory-index.mjs\` (\`pnpm memory:index\`).
>
> **READ-ONLY.** This report *describes* non-conformance against ACR-0012 /
> ACR-0013. Under ACR-0012 §4, mutating existing records — backfill,
> re-grading, renames — is out of scope and requires a separately ratified
> migration. Nothing was modified to produce this report.

## Store inventory (ACR-0013 §3 — all of them)

| Store | Stack | Records read |
|---|---|---:|
${storeLines}

## Cross-store discrepancies observed (described, not fixed)

${discrepancyLines}

## Learning-notes corpus snapshot (\`${NOTES_COLLECTION}\`)

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
- Every note needs \`canonical_collection: "${NOTES_COLLECTION}"\` and a
  \`trigger\` keyword string where absent.

### Cross-store legs

The canonical write protocol (ACR-0012 §3.3) is Mongo → Chroma → Neo4j with
read-back. A migration must also reconcile the Chroma projections using
**delete-then-add** (Chroma \`add()\` does not overwrite), and re-run the
retrieval regression (\`pnpm memory:verify\`) for every handle and anchor.

## What this report deliberately does not do

- It does not modify, re-grade, rename, or backfill any record in any store.
- It does not move the chat registry, renumber handoffs, or touch cdx-001's aliases.
- It does not decide the migration — that is a separate ratified step.
`;
}

// ---------- main ----------

async function main() {
  const memory = await mongoose.createConnection(MEMORY_MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const app = await mongoose.createConnection(APP_MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).asPromise();
  try {
    const ug = memory.useDb('universal_gateway');
    const memMomentum = memory.useDb('momentum');
    const appMomentum = app.useDb('momentum');

    const [memoryIndexDocs, kevinDecisions, milestones, handoffs, chatRegistry, governance, noteDocs, kevinLibrary, contextIndexDocs] =
      await Promise.all([
        ug.db.collection('memory_index').find({}).toArray(),
        ug.db.collection('memory_decisions').find({}, { projection: { excerpt: 0 } }).toArray(),
        ug.db.collection('kevin_milestone_chats').find({}).toArray(),
        ug.db.collection('session_handoffs').find({}, { projection: { messages: 0 } }).toArray(),
        ug.db.collection('chat_registry').find({}, { projection: { id: 1, chat_number: 1, registration_status: 1 } }).toArray(),
        memMomentum.db.collection('decisions').find({}).toArray(),
        ug.db.collection('claude_learning_notes').find({}).toArray(),
        ug.db.collection('kevin_library').find({}, { projection: { title: 1, type: 1, created_at: 1 } }).toArray(),
        appMomentum.db.collection('mcs_memory_context_index').find({}).toArray(),
      ]);

    const notes = noteDocs.map(normalizeNote);
    const integrity = buildIntegrity(notes);
    const generatedAt = new Date().toISOString();

    // Verb coverage — first-class metric; degrade loudly, never silently.
    const verbCoverages = await Promise.all(
      [
        ['neo4j', 'memory'],
        ['neo4j2', 'app'],
      ].map(async ([connector, stack]) => {
        try {
          return await measureVerbCoverage(connector, stack);
        } catch (error) {
          return { stack, connector, verbs: [], hollowVerbs: [], error: error instanceof Error ? error.message : String(error) };
        }
      }),
    );

    const storeCounts = [
      { path: 'universal_gateway.memory_index', stack: 'memory', count: memoryIndexDocs.length },
      { path: 'universal_gateway.memory_decisions', stack: 'memory', count: kevinDecisions.length },
      { path: 'universal_gateway.kevin_milestone_chats', stack: 'memory', count: milestones.length },
      { path: 'universal_gateway.session_handoffs', stack: 'memory', count: handoffs.length },
      { path: 'universal_gateway.chat_registry', stack: 'memory', count: chatRegistry.length },
      { path: 'momentum.decisions (governance ledger)', stack: 'memory', count: governance.length },
      { path: 'universal_gateway.claude_learning_notes', stack: 'memory', count: notes.length },
      { path: 'universal_gateway.kevin_library', stack: 'memory', count: kevinLibrary.length },
      { path: 'momentum.mcs_memory_context_index', stack: 'app', count: contextIndexDocs.length },
    ];

    const nonIntegerHandoffs = handoffs.filter((d) => d.chat_number != null && !Number.isFinite(d.chat_number)).length;
    const nonIntegerRegistry = chatRegistry.filter((d) => d.chat_number != null && (!Number.isInteger(d.chat_number) || d.chat_number > 10000)).length;
    const discrepancies = [
      '`docs/handoff-contract.md` names the chat registry as `agent_operations.chat_registry`; the populated collection on the live memory stack is `universal_gateway.chat_registry` (`agent_operations` is empty on both stacks). Readers should follow the rows; a future ratified step should reconcile the doc or move the data — not this generator.',
      `${nonIntegerHandoffs} session_handoffs row(s) carry a non-integer chat_number (slugs/dates) — violates the registry numbering rule; left as-is.`,
      `${nonIntegerRegistry} chat_registry row(s) carry a suspicious chat_number (non-integer or date-as-number, e.g. 20260610); left as-is.`,
      "cdx-001 (`momentum.mcs_memory_context_index`, app stack) claims aliases `digital-memory-discovery` and `dmd-mem`; the Digital Memory Discovery handle entry deliberately claims no aliases to avoid ambiguity. Kevin may reassign; agents must not mutate cdx-001.",
    ];

    const sections = [
      renderHandles(memoryIndexDocs, contextIndexDocs),
      renderVerbCoverage(verbCoverages),
      renderMilestones(milestones),
      renderDecisions(governance, kevinDecisions),
      renderChronicle(handoffs),
      renderLearningNotes(notes, integrity),
    ].join('\n\n');

    const counts = storeCounts.map((r) => `${r.path.split('.').pop()} ${r.count}`).join(' · ');

    for (const cov of verbCoverages) {
      if (cov.error) {
        discrepancies.push(`Verb coverage for the ${cov.stack} stack (${cov.connector}) could not be measured: ${cov.error}.`);
      } else if (cov.hollowVerbs.length > 0) {
        discrepancies.push(
          `${cov.hollowVerbs.length}/13 operators are DEAD on the ${cov.stack} stack (zero edges): ${cov.hollowVerbs.join(', ')}. ` +
            'A hollow operator compiles an empty packet that looks like an answer — edges must be written, not backfilled mechanically.',
        );
      }
    }

    writeFileSync(htmlPath, renderHtml(sections, counts, generatedAt));
    writeFileSync(driftPath, renderDriftReport(integrity, storeCounts, discrepancies, generatedAt));

    console.log('Read (read-only):');
    for (const r of storeCounts) console.log(`  ${r.stack.padEnd(6)} ${r.path}: ${r.count}`);
    console.log(
      `Integrity: ${integrity.ungraded} ungraded · ${integrity.unassignedProject} unassigned project · ` +
        `${integrity.anchors} named anchor(s) · ${integrity.criticalOrHighPct}% critical-or-high.`,
    );
    for (const cov of verbCoverages) {
      if (cov.error) console.log(`Verb coverage (${cov.stack}): UNAVAILABLE — ${cov.error}`);
      else
        console.log(
          `Verb coverage (${cov.stack}): ${cov.verbs.length - cov.hollowVerbs.length}/13 populated` +
            (cov.hollowVerbs.length > 0 ? ` · DEAD: ${cov.hollowVerbs.join(', ')}` : ''),
        );
    }
    console.log(`Wrote ${path.relative(repoRoot, htmlPath)} and ${path.relative(repoRoot, driftPath)}.`);
  } finally {
    await memory.close();
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
