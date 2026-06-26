#!/usr/bin/env node
/**
 * write-handoff-129b.mjs — Chat #129 session save (second half). Writes the
 * handoff to every LIVE leg and reads each back to confirm. Does NOT run ARCHIE.
 */
const GATEWAY_BASE = (process.env.GATEWAY_URL || 'http://localhost:2526/api').replace(/\/$/, '');
const GW = `${GATEWAY_BASE}/execute`;
async function gw(tool, action, params) {
  const r = await fetch(GW, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, action, params }) });
  return r.json();
}

const H = {
  _id: 'handoff_chat_129b',
  handoff_id: 'handoff_chat_129b',
  chat_number: 129,
  session_id: 'tm_session_2026_05_24_b',
  date: '2026-05-24',
  created_at: '2026-05-25T01:30:00Z',
  created_by: 'Chat 129 verified close (part 2)',
  status: 'open',
  title: 'Chat #129 (cont) - staged 5 parallel worktrees, built exponential-growth explainer, removed member PII from onboarding.html',
  summary: 'Continuation of #129. After building the currency/queue/wireframe infrastructure (see handoff_chat_129), this half staged the PARALLEL BUILD and harvested upline content. (1) FIVE git worktrees created as siblings of the main repo, each on its own branch with a TASK.md: D:/mcs-ivory (feat/invitation-generator-ivory, wf3.4), D:/mcs-audit (feat/admin-audit-log, wf4.J), D:/mcs-hygiene (chore/content-hygiene, wf5 + dossier wiring), D:/mcs-crm (feat/ba-crm, wf3.3 write-side), D:/mcs-training (feat/fast-start-training, wf3.5). All share the one local .git; merge order: hygiene -> audit -> ivory -> then crm + training (both depend on ivory invite shape). (2) Harvested upline content (Kevin confirmed free to adapt; upline paid on downline): rlegacymakers.com onboarding hub + getting-started checklist + product-overview page; the GLP-THREE scientific dossier (MBC-267, 267 salmon+mushroom peptides + saffron/ginseng/hops; PDR-listed; patent-pending); the live onboarding-webinar transcript (Adrianne, 6-fig earner; Paul is 7-fig). (3) Built docs/exponential-growth-explainer.html (currently in chat outputs, NOT yet in repo) — play-controlled, ~2.5min, People->Momentum->Volume->Checks, eat-the-elephant duplication, brand-token matched, income disclaimer, NO dollar figures. (4) Edited D:/team-magnificent-training/onboarding.html to REMOVE the live team-momentum section (real member names + genealogy + stale 13/4 stats) — PII on a public GitHub Pages site. Kevin/Paul leadership attribution retained.',
  decisions_made: [
    'TRAINING MODEL CORRECTED (Kevin insistent): "get your two" is the ACTIVATION step, NOT the income model. You make money recruiting a TEAM and driving VOLUME. Leadership is six-fig (Adrianne) + seven-fig (Paul); expectations are NOT $500/month. mcs-training TASK.md rewritten to teach this truth + the eat-the-elephant exponential framing, sourced from the upline call + the devklg.github.io Power-in-Numbers page. Keep TM calm/demonstration voice, not hard-sell.',
    'COMP CONTENT HOME: comp mechanics (CV, cycles, 300+600=900=$35, QBA path 100CV activate / 60CV SmartShip, PIB tiers) live in the TRAINING/comp surfaces, .team-only, with disclaimer. The app NEVER computes CV — THREE tracks volume in its own back office. Training job is CONCEPTUAL: what CV is, where it comes from, and making the exponential REALIZABLE.',
    'IVORY SCOPE FENCED: Ivory/generator has NOTHING to do with CV/cycles/volume/pricing/comp math. "Product gallery" = the share/video set (which product + which angle), NOT pricing. Guard added to mcs-ivory TASK.md.',
    'ORIENTATION STRUCTURE: New Member Orientation Part 1 = 10-steps.html (blueprint, credited to Randy Schroeder, refined by Kevin+Paul). Part 2 = onboarding.html (full experience that EMBEDS the 10 steps + market why-now + tools grid + CTA). Both are porting sources for the .team orientation surface.',
    'CONTENT FIXES FLAGGED for the orientation port: pack names drift ("Entry/Elite/Pro" -> real catalog: Simple Six Ultimate/Elite/Boost/Starter + GLP Complete/Advantage/Essential); income-claim lines ("67 enrollments in 3 days", monthly $ figures) are .team-only, never .com; CSS palette had stray green #2ECC71/orange not in locked 5-color palette.',
    'PII REMOVED from public onboarding.html: deleted the entire team-momentum section (member names Dr.Roni/Pearl/Shawn/Alemattu/Timettra/Samuel/David-Hester/Florence/Elizabeth/Yejide, MA location, 13/4/682 stats). Team is now 43+; a hardcoded tree drifts AND exposes PII. Section cut entirely rather than de-identified.',
  ],
  next_priorities: [
    'PUSH the onboarding.html PII fix: from D:/team-magnificent-training run git add/commit/push — public GitHub Pages still shows real member names until pushed. Do this SOON (real PII).',
    'OPEN the 5 Claude Code instances (one per worktree folder); prompt each "read TASK.md and CLAUDE.md, then build it." They build in parallel; HARD RULES in each TASK.md keep types.ts + index.ts append-only to avoid merge collisions.',
    'MERGE order after builds (from main repo): hygiene -> audit -> ivory -> crm -> training; re-run node server/scripts/sync-queue-from-wireframe.mjs after each.',
    'Move exponential-growth-explainer.html into D:/team-magnificent-training/ (currently only in chat outputs) so it publishes; pairs with the (now-removed) team section conceptually + the Power-in-Numbers page. Tune rowRevealAt/LEVELS timing arrays after viewing.',
    'Reconcile wireframe stale leaf statuses before/at first merge (welcome is DONE not partial; prospect re-entry L2/L3 DONE per #130). The wireframe must be accurate so agents tick boxes against real state.',
  ],
  blockers: [
    'NONE blocking the parallel build. ANTHROPIC_API_KEY in root .env (Ivory/LLM unblocked).',
    'onboarding.html PII fix is LOCAL only — unpushed. Live public site still exposes names until git push.',
    'Open (non-blocking): gmail invalid_grant; telnyx disabled pending re-key; Resend dormant pending teammagnificent.com domain verify; Neon erroring.',
  ],
  front_of_line: 'PUSH the onboarding.html PII removal (real names live on public site until pushed). THEN open the 5 Claude Code worktree instances to build in parallel. Build map: docs/project-wireframe.md + momentum.work_queue_leaves. Currency: momentum.decisions. SurrealDB write contract: action create, param id.',
  artifacts_this_half: [
    '5 worktrees: D:/mcs-{ivory,audit,hygiene,crm,training} each w/ TASK.md',
    'docs/exponential-growth-explainer.html (in chat outputs; move to team-magnificent-training repo)',
    'D:/team-magnificent-training/onboarding.html (member PII removed; UNPUSHED)',
    'mcs-training/TASK.md + mcs-ivory/TASK.md updated w/ comp-truth, eat-the-elephant, scope guard',
  ],
  reminder: 'Kevin: RUN ARCHIE to capture the full transcript of this session half. Claude cannot run ARCHIE.',
};

async function main(){
  const results={};
  await gw('mongodb','delete',{database:'universal_gateway',collection:'session_handoffs',filter:{_id:'handoff_chat_129b'}});
  const ins=await gw('mongodb','insert',{database:'universal_gateway',collection:'session_handoffs',documents:[H]});
  const rb=await gw('mongodb','aggregate',{database:'universal_gateway',collection:'session_handoffs',pipeline:[{$match:{_id:'handoff_chat_129b'}},{$project:{_id:1,chat_number:1,title:1}}]});
  results.mongo={inserted:ins?.data?.insertedCount, readback:rb?.data?.results?.length};

  const cy=await gw('neo4j','cypher',{query:'MERGE (h:SessionHandoff {handoff_id:$id}) SET h.chat_number=$n,h.title=$t,h.created_at=$c,h.status=$s RETURN h.handoff_id AS id',params:{id:'handoff_chat_129b',n:129,t:H.title,c:H.created_at,s:'open'}});
  results.neo4j=cy?.data?.records?.length?('ok: '+cy.data.records[0].id):(cy?.error||cy);

  const doc=`Chat #129 (part 2) handoff. ${H.summary} FRONT OF LINE: ${H.front_of_line}`;
  const ch=await gw('chromadb','add',{collection:'perry_handoffs',ids:['handoff_chat_129b'],documents:[doc],metadatas:[{chat_number:129,date:'2026-05-24',status:'open'}]});
  results.chroma=ch?.data?.verified?('ok added '+(ch.data.added)):(ch?.error||ch);

  const sdb=await gw('surrealdb','create',{id:'session_handoff:chat_129b',data:{chat_number:129,created_at:H.created_at,status:'open',title:H.title,front_of_line:H.front_of_line}});
  results.surrealdb=sdb?.data?.verified?'ok created':(sdb?.error||sdb);

  console.log('=== HANDOFF #129b WRITE RESULTS (per leg) ===');
  console.log(JSON.stringify(results,null,2));
}
main().catch(e=>{console.error('HANDOFF WRITE FAILED:',e);process.exit(1);});
