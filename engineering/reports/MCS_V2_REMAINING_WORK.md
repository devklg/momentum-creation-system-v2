# MCS v2 — What Is So, and What Remains (v2, verified 2026-07-07)

**Method:** Every claim below was read from the code and live environment in `D:/momentum-creation-system-v2` on 2026-07-07 — not from closeout ledgers or memory. Where a fact was checked this session it is stated as verified; where it comes from a prior ledger and was NOT re-read, it says so. Purpose of the app: support and train Team Magnificent BAs and run lead outreach. This measures the app against that purpose, on every layer it is meant to operate.

**Supersedes v1 of this document.** v1 contained errors since corrected: it listed Anthropic/Telnyx keys as unset (both ARE set), described Ivory as needing a context foundation (her generation is real; she only lacks KB grounding), and posed an invented "orchestrator intent question" as a decision for Kevin (not needed — the path is: mirror Steve).

---

## 1. Verified health (genuinely real)

- **Compiles clean.** All 5 packages (`shared`, `server`, `team`, `admin`, `com`) typecheck, 0 TS errors. (verified)
- **Backend heavily tested.** 132 server test files, 1,400 tests, all passing. (verified)
- **Persistence is real.** `persistenceCall` → Mongo/Neo4j/Chroma adapters are genuine; confirmed live by writing + reading back the comp re-scope and Nueva deletion across all three legs. (verified)
- **Knowledge base real.** ~471 approved chunks across 38 sources (+ MCS Strategic Foundation); semantic search returns correctly scoped hits through the production query path. (verified)
- **Config keys ARE set:** `ANTHROPIC_API_KEY` (len 108), `TELNYX_API_KEY` (len 58, + from-number/connection/webhook/public-key), `STEVE_CONTEXT_MANAGER_LIVE_ENABLED=true`, webinar. (verified live in `.env`)

**Bottom line:** not a skeleton. A large, compiling, tested app. The real gaps are two agents not yet running on the KB, a few frontend-only surfaces, and some dormant/unconfigured services — detailed below, each on the layer it lives.

---

## 2. AGENT LAYER — the core of the app ("KB as OS")

The whole point: agents generate real responses grounded in the approved KB. The retrieval spine is BUILT and PROVEN — Steve runs on it end-to-end. This is not a missing subsystem; it's two agents not yet plugged in.

| Agent | Role (settled) | Generates? | Runs on KB? | Gap |
|---|---|---|---|---|
| **Steve** | Discovery / Success Interview | YES (real Anthropic) | YES — `steveConversationRuntime` calls `requestSteveRuntimeContextPacket`, renders into prompt | LIVE PROOF only (flag on, never exercised) |
| **Michael** | Training Agent / Daily Success Coach | **NO — route returns pre-authored FIXTURES** | Foundation exists but route bypasses it | Build generation + reroute off fixture facade |
| **Ivory** | List creation + invitation generation | YES (real Anthropic, admin-tunable, compliance-gated) | **NO — zero KB calls in `ivory.ts`** | Wire her to `searchApprovedKnowledge` |

### Steve — DONE (tested by Kevin ~2026-07-04, working; minor fixes landed)
- [x] **S-1.** Steve generates and runs on the KB. Tested live by Kevin three days before this doc; confirmed in code (`steveConversationRuntime.ts` calls `requestSteveRuntimeContextPacket`, renders into prompt). He is the working reference the other two agents copy — no re-proof needed.
- [ ] **S-2.** Decide **ACR-0010** (Steve context-comparison contract) — committed file, still a proposal. (Kevin decision, not a code gap.)

### Michael — HIGH PRIORITY — does not generate (verified)
`server/src/routes/michael-runtime.ts` is "fixtures-only, non-persistent, LLM-free" by its own header; resolves through the S2.20 inert facade returning pre-authored fixtures. No `buildMichaelSystemPrompt`, no `michaelConversationRuntime` anywhere (grep: 0 hits). His context foundation DOES call `searchApprovedKnowledge` — the route just doesn't use it.
- [ ] **M-1.** **DELEGATED to Codex** — `engineering/sprints/CODEX_EXECUTION_PROMPT_MICHAEL_GENERATION.md`. Build prompt builder + conversation runtime mirroring Steve; reroute `/api/michael-runtime/resolve` off the fixture facade; consume KB; persist triple-stack with read-back; prove one turn live.

### Ivory — HIGH PRIORITY — generates but blind to the KB (verified)
`domain/ivory.ts` calls real Anthropic (`complete()` ~725, ~855), admin-tunable coach prompt, compliance rules, JSON contract — all real. But zero KB grounding: no `searchApprovedKnowledge`, no context foundation. She invents from model priors, not Kevin's approved knowledge.
- [ ] **I-1.** **DELEGATED to Codex** — `engineering/sprints/CODEX_EXECUTION_PROMPT_IVORY_KB_GROUNDING.md`. Add `searchApprovedKnowledge` to her draft path; inject as grounding in `buildCoachSystem` after the hard compliance rules; degrade gracefully if retrieval empty; prove one grounded draft live.

### KB-as-OS — reframed (verified)
Not a missing OS. The retrieval machinery (`searchApprovedKnowledge`, `contextManagerRetrievalAdapter`, `contextManagerService`, per-agent foundations) is built; Steve proves it. "Complete" = M-1 + I-1 + S-1 done. Two side facts: `agentScopes` is NOT enforced at retrieval (descriptive only — decide keep-and-enforce vs remove); only the single `mcs_knowledge_chunks` Chroma collection is embedded/read (per-domain + GraphRAG collections exist but aren't on the read path — confirm intended or prune).

Package overview for Codex: `engineering/sprints/CODEX_WORK_PACKAGE_AGENTS_ON_KB.md`.

---

## 3. VM / VOICEMAIL LEAD LAYER — built, cannot yet run a live campaign

NOT dropped. ~4,000 lines / 20 files: `vmProviderQueue.ts` (1,009), `adminVm.ts` (448), schemas, tokens, campaigns, lead-owners, ownership, 3 workers (delivery/import/webhook), Telnyx transport + call-control, webhook verify, routes. (verified)
- [ ] **VM-1.** `vmNotificationHooks.ts` — 15 hooks all `status:'stubbed'`. Build the real BA/lead feedback layer. (verified)
- [ ] **VM-2.** `VM_LIVE_DELIVERY_ENABLED` absent/false — correct until you approve live delivery. Telnyx key IS set (transport real). Approve + provision when ready. (verified — note: this is a Kevin decision, not a missing key)
- [ ] **VM-3.** Run one campaign end-to-end: import → queue → Telnyx drop → webhook → notification → read-back. Never proven whole.
- [ ] **VM-4.** Confirm the 3 workers run against a live queue, not just unit tests.
- [ ] **VM-5.** `acquisition_provider_placeholder` still a provider mode — confirm real provider path.

---

## 4. FRONTEND-ONLY SURFACES (UI built, no backend)

- [ ] **F-1.** **Admin Live Operations (Section H:** usage telemetry, growth cards, holding-tank grid, conversion funnel). `apps/admin/src/routes/live-ops.tsx` hardcodes `USE_MOCKS = true` — "H-server has not landed." Build `/api/admin/live-ops/*` endpoints, then flip. (verified)
- [ ] **F-2.** `/admin/tenant` F.3 read-only URL-structure panel missing (per Codex same-day audit; not personally re-read). (ledger)

---

## 5. CONFIG-DORMANT / UNCONFIGURED SERVICES

- [ ] **C-1.** Resend (`RESEND_API_KEY` **absent**) — gates prospect webinar confirmation email. Provision, or explicitly accept SMS-only launch. (verified absent)
- [ ] **C-2.** Voicebox, Scriptmaker, Broadcast, Michael/MCS context-manager live flags — absent/off. Provision/enable per need. (verified)
- [ ] ~~Anthropic~~ — SET. (was wrong in v1)
- [ ] ~~Telnyx key~~ — SET. (was wrong in v1)

---

## 6. TEST-COVERAGE GAP

- Server 132 test files; team 2, admin 1, com 0, shared 0. (verified)
- [ ] **T-1.** `packages/shared` (the contract backbone) has zero tests. Add contract tests.
- [ ] **T-2.** `apps/team|admin|com` essentially untested. At minimum smoke/render tests for BA-facing surfaces.

---

## 7. OPERATIONAL-DATA / DRIFT (from Codex same-day audit; NOT personally re-verified)

- [ ] **O-1.** Local `momentum.work_queue_leaves` / `decisions` / `agent_status` / `work_queue` returned zero rows — operational mirror not seeded. Restore so the KB/context layer can act as operational context compiler, not only a source store. (ledger)
- [ ] **O-2.** Stale docs: root `TASK.md` (names `feat/fast-start-training`), `docs/build-registry.md`, `docs/AGENT-BRIEFING.md`, `graphify-out/GRAPH_REPORT.md`. Reconcile to `main`/HEAD. (ledger)

---

## 8. PRODUCTION — B1 SHIPPED 2026-07-03–05 (Kevin's pinned turning point)

Production deployment already HAPPENED (per the milestone record `kevins_real_turning_point_2026_07_05` in `universal_gateway.kevin_milestone_chats`). This section was wrong in v1/v2-draft when it said "cutover pending / NO-GO from ledger." Corrected to actual state:

- **LIVE:** InterServer VPS `104.37.184.37` (Ubuntu, 2 vCPU / 7.3GB). TLS via certbot across all five hostnames (`teammagnificent.com`, `www.`, `teammagnificent.team`, `www.`, `admin.teammagnificent.team`). CORS + `PROSPECT_BASE_URL` fixes landed (login + invite links working). Founders / access codes / webinar events / orientation sessions / Ivory collection seeded. **Anthropic API key wired in production — all agents powered.** (from milestone record)
- Shipped that session: Steve conversation runtime (PR #121), Steve browser voice (PR #122), Fast Start nav (#123), Ivory invitation craft rewrite (#124), knowledge/context/Voicebox foundation (#125), production runbook (#126), Chroma registry reconciliation (#118/#127).

**Still open on the production/ops side (re-verify against the live VPS, do not assume):**
- [ ] **P-1.** Confirm current live-VPS state matches this record (drift possible since 07-05).
- [ ] **P-2.** Managed backups / monitoring / alerting on the live box.
- [ ] **P-3.** CPU query-embedder + model-parity guard if the VPS has no GPU (confirm embedding path in production).
- [ ] **P-4.** B5 manual `.com` compliance walk on the live build.
- [ ] **P-5.** Approve pnpm build-script policy (`argon2`, `esbuild`) for root `pnpm build`/`typecheck`.

---

## Fastest path to a working training app

1. **M-1** Codex builds Michael's generation (the training agent must actually train). Steve is the working reference — already tested, already runs on the KB.
2. **I-1** Codex grounds Ivory in the KB (invitations from approved knowledge, safest for claims).
4. **VM-1 → VM-3** finish notification hooks + prove the lead pipeline.
5. **F-1** build Live-Ops H-server; flip the mock.
6. **C-1** decide Resend vs SMS-only.
7. **T-1/T-2** close frontend/shared test gap.
8. **O-1/O-2** restore operational mirror + reconcile stale docs.
9. **Section 8** production cutover after re-verifying live infra.

When 1–3 are done, the app does the thing it exists to do: agents train and support BAs from Kevin's governed knowledge.
