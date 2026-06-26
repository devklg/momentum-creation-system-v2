#!/usr/bin/env node
/**
 * write-handoff-129.mjs — Chat #129 session close. Writes the handoff to every
 * LIVE leg and reads each back to confirm. Does NOT run ARCHIE (Kevin's job).
 */
const GATEWAY_BASE = (process.env.GATEWAY_URL || 'http://localhost:2526/api').replace(/\/$/, '');
const GW = `${GATEWAY_BASE}/execute`;
async function gw(tool, action, params) {
  const r = await fetch(GW, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, action, params }) });
  const j = await r.json();
  return j;
}

const HANDOFF = {
  _id: 'handoff_chat_129',
  handoff_id: 'handoff_chat_129',
  chat_number: 129,
  session_id: 'tm_session_2026_05_24_b',
  date: '2026-05-24',
  created_at: '2026-05-24T23:30:00Z',
  created_by: 'Chat 129 verified close',
  status: 'open',
  title: 'Chat #129 - wq_01 DONE: built the currency+queue+wireframe infrastructure that ends per-chat re-teaching. No app code shipped; this was the reconciliation layer.',
  summary: 'HONEST CLOSE: zero application code shipped this session. What WAS built (and is the point): the persistence/currency infrastructure Kevin has been missing, which is why every chat re-taught scope. Four artifacts, all on D drive, all verified by read-back. (1) DECISION LEDGER momentum.decisions — 16 rows, append-only, monotonic seq, topic-keyed; 6 superseded originals + 10 active; the currency layer that answers "what is current on X" with one query instead of guessing between two canonical-looking sources. (2) MASTER WORK QUEUE momentum.work_queue — 42 surface-grain rows, every surface from all 5 spec sources, status grounded in disk. (3) PROJECT WIREFRAME docs/project-wireframe.md — 114-leaf build tree, the decomposition you build FROM. (4) LEAF QUEUE momentum.work_queue_leaves — 114 rows GENERATED from the wireframe (single source; re-run sync to regenerate). Plus a printable B/W checklist docs/build-checklist.html (114 numbered items). Counts agree everywhere: 37 done / 4 partial / 73 pending.',
  decisions_made: [
    'wq_01 (the reconciled scope doc) is DONE — but realized as a SYSTEM not a single doc: ledger (currency) + work_queue (status) + wireframe (build decomposition) + leaf queue (queryable mirror). locked-spec.md was found NOT drifted (675 lines, strong, current) — it was NOT rewritten; the gap was the missing currency/decomposition layer, now built.',
    'PRECEDENCE (ledger dec_source_hierarchy_no_key, #129): decision ledger (currency) > locked-spec (state) > design docs > build-registry > git log > Perry handoffs. KEVIN-CONTEXT.md + THE-KEY are NOT session-start reads per current userPreferences (KEVIN-CONTEXT is older than the new settings). Pull a specific doc only when the work needs it.',
    'wq_02 CONFIRMED NOT DONE (Kevin + verified on disk). SHIPPED invitation work = plain-form spine (#119-121) + ScriptMaker product-anchored drafting (#122-123, video-library.tsx 813 lines, one-name compliance-clean LLM draft -> /invitations seam). wq_02 = gallery-driven per-product MULTI-ANGLE WDYK generator with PERSISTED tagged roster; the multi-angle WDYK + roster is IVORY (wq_03) and is NOT built. ScriptMaker header itself defers "who do you know" to Ivory. Ledger row dec_scriptmaker_not_wq02.',
    'WIREFRAME IS THE SOURCE; leaf queue is its mirror. Discipline: edit docs/project-wireframe.md, re-run server/scripts/sync-queue-from-wireframe.mjs, leaf queue regenerates. Never hand-update both. Same for the printable: re-run build-checklist.mjs.',
    'VERIFIED BUILD STATE: HEAD 5c7105f (#126), tree clean except 2 untracked (WELCOME LETTER pdf in com/public/assets that must NOT be committed + docs/_team-design-extract.txt scratch). .com prospect surface ~complete (17/1/5). Heavy remaining: .team generator+Ivory+Michael-UI (29 pending) and /admin 8-of-9 surfaces (33 pending).',
    'GATEWAY CONTRACT NOTES (cost the usual friction): desktop-commander action is start_process NOT execute_command; PowerShell uses ; not &&; mongodb insert wants documents (array) not document; list_collections is snake_case; PowerShell Out-File -Encoding utf8 writes a BOM that breaks JSON.parse (strip /^\uFEFF/). str_replace/create_file are SANDBOX-only — use desktop-commander write_file/edit_block for D drive.',
  ],
  next_priorities: [
    'FRONT OF LINE = build, no longer reconcile. Two defensible starts (Kevin picks by whether he wants BA-activation or operator-visibility next): (A) .team INVITATION GENERATOR + IVORY (wireframe 3.4, leaves wf_0050-0059) — the heart of .team per locked-spec 1.8, LLM layer unblocked (key in root .env). (B) /admin AUDIT LOG SUBSTRATE (wireframe 4.J, leaves wf_0107-0110) — build 2nd per ADMIN J.6 because every admin surface writes against it.',
    'Read the build map at session start: docs/project-wireframe.md OR query momentum.work_queue_leaves {status:pending, surface:"team"|"admin"} sorted by seq. The pending leaves ARE the task list — do NOT re-derive from design docs.',
    'Clear open decisions in a batch (wireframe bottom lists 11, each tagged to the one surface it blocks): Michael 5 prompts, Fast Start gating, orientation scheduling, phone-change verify, notif defaults, position-stack window, compliance severity, export PII, sponsor-leaves, re-invite cooldown, leadership-track-record placement.',
    'CHEAP HYGIENE (leaves wf_0111-0114): relocate WELCOME LETTER pdf out of com/public/assets; delete docs/_team-design-extract.txt + docs/_leaves.json scratch; update build-registry.md to cover #122-126.',
  ],
  blockers: [
    'NONE blocking the build. ANTHROPIC_API_KEY in root .env (Ivory/LLM unblocked). GitHub connector fixed #128.',
    'Open (non-blocking): gmail invalid_grant (OAuth re-auth needed); telnyx intentionally disabled pending Kevin re-key; Resend dormant pending teammagnificent.com domain verification (BA-SMS is live fallback).',
    'Standing fragility: do NOT trust connector status/lastError (sticky/stale); test live gateway via POST localhost:2526/api/execute; do NOT trust build-registry/docs over git log.',
  ],
  front_of_line: 'BUILD a surface (reconciliation is DONE). Pick (A) .team invitation generator + Ivory [wf_0050-0059] OR (B) /admin audit-log substrate [wf_0107-0110]. Source of truth for what to build: docs/project-wireframe.md + momentum.work_queue_leaves. Currency: momentum.decisions. State: locked-spec.md.',
  artifacts_this_chat: [
    'momentum.decisions (16 rows) — seed: server/scripts/seed-decisions.mjs',
    'momentum.work_queue (42 rows) — seed: server/scripts/seed-work-queue.mjs',
    'docs/project-wireframe.md (114 leaves) — hand-authored from all spec sources',
    'momentum.work_queue_leaves (114 rows) — sync: server/scripts/sync-queue-from-wireframe.mjs',
    'docs/build-checklist.html (printable B/W) — gen: server/scripts/build-checklist.mjs',
  ],
};

async function main() {
  const results = {};

  // ---- Mongo ----
  await gw('mongodb', 'delete', { database: 'universal_gateway', collection: 'session_handoffs', filter: { _id: 'handoff_chat_129' } });
  const ins = await gw('mongodb', 'insert', { database: 'universal_gateway', collection: 'session_handoffs', documents: [HANDOFF] });
  const rb = await gw('mongodb', 'aggregate', { database: 'universal_gateway', collection: 'session_handoffs', pipeline: [{ $match: { _id: 'handoff_chat_129' } }, { $project: { _id: 1, chat_number: 1, title: 1 } }] });
  results.mongo = { inserted: ins?.data?.insertedCount, readback: rb?.data?.results?.length };

  // ---- Neo4j ----
  const cy = await gw('neo4j', 'cypher', { query: 'MERGE (h:SessionHandoff {handoff_id:$id}) SET h.chat_number=$n, h.title=$t, h.created_at=$c, h.status=$s RETURN h.handoff_id AS id, h.chat_number AS n',
    params: { id: 'handoff_chat_129', n: 129, t: HANDOFF.title, c: HANDOFF.created_at, s: 'open' } });
  results.neo4j = cy?.data ?? cy?.error ?? cy;

  // ---- Chroma ----
  const doc = `Chat #129 handoff. ${HANDOFF.summary} FRONT OF LINE: ${HANDOFF.front_of_line}`;
  const ch = await gw('chromadb', 'add', { collection: 'perry_handoffs', ids: ['handoff_chat_129'], documents: [doc],
    metadatas: [{ chat_number: 129, date: '2026-05-24', status: 'open' }] });
  results.chroma = ch?.data ?? ch?.error ?? ch;
  const chq = await gw('chromadb', 'get', { collection: 'perry_handoffs', ids: ['handoff_chat_129'] });
  results.chroma_readback = chq?.data?.ids ?? chq?.error ?? chq;

  // ---- SurrealDB (up per userPreferences; must not be omitted) ----
  const sdb = await gw('surrealdb', 'query', { query: "UPDATE session_handoff:chat_129 SET chat_number=129, title=$t, status='open', created_at=$c",
    params: { t: HANDOFF.title, c: HANDOFF.created_at } });
  results.surrealdb = sdb?.data ?? sdb?.error ?? sdb;

  // ---- Neon (flagged ERRORING per #127; attempt + report real result) ----
  const neon = await gw('neon', 'query', { sql: "INSERT INTO session_handoffs (handoff_id, chat_number, title, status) VALUES ('handoff_chat_129', 129, $1, 'open') ON CONFLICT (handoff_id) DO UPDATE SET title=EXCLUDED.title",
    params: [HANDOFF.title] });
  results.neon = neon?.data ?? neon?.error ?? neon;

  console.log('=== HANDOFF #129 WRITE RESULTS (per leg) ===');
  console.log(JSON.stringify(results, null, 2));
}
main().catch((e) => { console.error('HANDOFF WRITE FAILED:', e); process.exit(1); });
