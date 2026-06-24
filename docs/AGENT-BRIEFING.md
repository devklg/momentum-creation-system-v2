# Agent Briefing — Team Magnificent Momentum Creation System v1

**For any agent (Claude, Codex, sub-agent) starting work on this project.** Read this file end-to-end. Then ask Kevin what to build. Do not read other documents unless this file tells you to.

**Authoritative sources, in precedence order:**
1. This file — orientation
2. `docs/locked-spec.md` — authoritative spec (read only the section you're touching)
3. `docs/build-registry.md` — what's done, what's pending
4. The four design docs — reference when changing the surface they describe
5. Chat transcripts in project knowledge — historical context, query on demand

---

## Layer 1 — Identity and rules

**Project.** Team Magnificent Marketing Momentum Creation System v1. Operational infrastructure for Kevin L. Gardner's team inside THREE International, built around GLP-THREE.

**People.** Kevin L. Gardner (founder, TM-01). Paul Barrios (co-leader, TM-02). 41 active Brand Ambassadors as of Chat #84. Goal: 100,000 qualified BAs.

**Product.** GLP-THREE — first all-natural GLP-1 replacement, trademark and patent pending, launched third week of January 2026. Powered by MBC-267 peptide complex (Norwegian salmon + mushrooms). 100% natural, dropper-based, no injections. Dr. Dan Gubler (Caltech PhD, 16 patents) is the formulator and video presenter.

**Qualified BA, per THREE's definition.** Activated with 100 CV + sponsored 2 BAs (one left leg, one right leg) who each did the same. Recursive. Not a signup count.

**Brand tokens (verbatim, never paraphrase):**
- `--ink: #0A0A0A` (dark background)
- `--gold: #C9A84C` (primary accent, headlines, position numbers)
- `--gold-bright: #F5C030` (emphasis, highlighted words)
- `--teal: #2DD4BF` (live-data color, pulse dots, eyebrows)
- `--cream: #F5EFE6` (primary text on ink)
- Display: Bebas Neue. Body: DM Sans. Mono: DM Mono.

**Standing rules. Non-negotiable.**
- THREE International is the final authority on enrollment, registration, genealogy, patronage. We mirror; never override.
- Sponsor immutability: set at access-code resolution at signup, never edited later. One exception: BA-requested-emergency override in /admin, fully audited.
- Position monotonicity: queue positions are timestamp-anchored at video_complete, never reshuffle, never reused. Flushes vacate slots; no renumbering.
- 8-week flush window for holding tank records (currently locked fixed; adaptive flag exists in spec, deferred).
- Triple-stack persistence: every write hits MongoDB + Neo4j + ChromaDB via Universal Gateway at `localhost:2525`. None of the three is optional.
- Team Magnificent is Kevin's downline only. Not THREE-wide. Access codes enforce this — every TM-XXXX traces back to TM-01.

**The five things that never appear on .com:**
1. Income claims, earnings projections, commission figures, cycle math
2. Placement promises or queue-position-equals-leg-position guarantees
3. AI prospecting (Michael is BA-facing only)
4. Current team head count (the 100,000 goal is named; the count is not)
5. THREE International branding (no logo, no name, no "independent promoter" disclaimer)

**Compliance enforcement lives at two layers, not in /admin:**
- Script-time: ScriptMaker refuses to produce drafts that violate the rule set
- Render-time: prospect-facing surfaces fail closed on noncompliant content
- /admin shows aggregated metrics on enforcement, never a manual review queue

**No agent timelines.** Never give Kevin time estimates for AI work. Use `[TIMELINE — confirm with Kevin]` or omit. This is a hard rule from Critical Rule #7.

---

## Layer 2 — Architecture in one paragraph each

**The pool mechanic.** Every Brand Ambassador on Team Magnificent places their prospects into ONE shared collective pool — the holding tank — that the entire team sees. The pool is team-wide, not BA-scoped. A prospect arriving at `/p/{token}` sees the whole team forming around them.

**Two-stage placement.** Stage 1: prospect placed in the team's shared pool at `video_complete`. This is the marketing demonstration layer. Position is team-wide. Stage 2: when the prospect enrolls, they exit the collective and are placed in THREE's binary structure under their sponsoring BA. This is the compensation layer. THREE owns this. Spillover happens at Stage 2 because spillover is real in binary. Stage 1 never promises Stage 2 outcomes.

**Replicated site vs replicated dashboard.** Both share `/p/{token}` URL pattern; render differs by funnel state. Before `video_complete`: BA's replicated site — branded to the sponsoring BA. After `video_complete`: prospect's replicated dashboard — positioned to the individual prospect with their queue number and "behind you" counter.

**No programmatic THREE handoff.** When a prospect decides to enroll, the BA walks them into THREE off-app through THREE's own tools, BA-to-BA. The app does not handle THREE enrollment. There is no registration/handoff/* route family — that was Codex drift, dropped.

**No save-spot.** The presentation page has no "save your spot" button anywhere. Placement fires silently at `video_complete`. The only explicit form on the prospect-facing surface is the callback request: "I want [BA] to call me ASAP" with three intent radios (interested / want to join / questions), phone, best time, "TELL [BA] I'M READY" button.

**Steve + Michael.** Steve conducts Discovery and creates the non-scored Success Profile. Michael is the outbound Training Agent + Daily Success Coach (Telnyx-based): calls each new BA shortly after signup, clarifies the path, answers questions, teaches Layer 1, supports daily rhythm, and captures training/daily-success context for the upline cockpit. Neither agent scores, ranks, predicts, or classifies the BA. **BA-facing only. Never prospect-facing.** Reuses Kevin's existing voice agent infrastructure.

**The six locked dashboard sections** (post-video_complete view at `/p/{token}`, fixed order):
1. Arrival — "You saw it. You're **in.**" Position card with #N, invited-by line, placement timestamp.
2. Opportunity — "This isn't a small room." Four market stat cells.
3. Mechanic — "Two people. Then they find two." Power-of-2 cascade pointing to 100,000.
4. Live Place — "The team is forming around you. Right now." Ahead/behind counters + position stack.
5. Advantage — "We work together. With the same goal." 100,000 mission, pool grid.
6. Your Next Move — "Let's have a real conversation about this unfolding new opportunity." Callback CTA + webinar CTA.

**Three clients, one server.**
- `teammagnificent.com` (apps/com, port 7701) — prospect-facing, single route `/p/{token}` with two faces
- `teammagnificent.team` (apps/team, port 7702) — BA-facing, login + onboarding + cockpit + invitation generator
- `admin.teammagnificent.team` (apps/admin, port 7703) — Kevin-only, gated by `ADMIN_BA_IDS` env var, hard 403
- Express API server (port 7700), shared package at `packages/shared/`, monorepo with pnpm 9 workspaces
- Stack: Vite 6 + React 19 + TypeScript 5.5 + Tailwind 3 + shadcn primitives + Express 4 + jose + argon2 + zod + undici

**Token lifecycle states:** `minted → clicked → video_started → video_quarter → video_half → video_three_quarter → video_complete → callback_requested | webinar_reserved → enrolled | expired`. Position assigned at `video_complete`. Flush triggers: enrolled or 8-week expiry.

**Access codes.** Format: `TM-XXXX` (4-char, 31-char alphabet excluding 0/O/1/I/L — ~924k codes). Generated only by Kevin from /admin. Each code is permanently tied to one BA who reuses it for every BA they sponsor. Sponsor binding is set at code resolution at signup, immutable thereafter.

**Operating frame (from locked-spec Part 1).** This system is a personal word-of-mouth advertising platform at team scale. BAs are sharers, not salespeople. Primary action: share the video. Primary metric: invitations sent per day. Earnings follow sharing. The system refuses AI prospecting, autodialing, mass send — because those tactics turn sharing into selling and kill the channel.

---

## Layer 3 — Pointers, not content

**When you need the spec.** Read `docs/locked-spec.md` Part N where N is the topic you're working on:
- Part 1 — operating frame (17 subsections — the why)
- Part 2 — authority, mirror, access-code bridge
- Part 3 — architecture (the how)
- Part 4 — other locked decisions
- Part 5 — open questions (17 unresolved)
- Part 6 — source-of-truth precedence

Do not read the whole spec at session start. Read the part that matters for your task.

**When you need build state.** Read `docs/build-registry.md` (this directory). 13 sections: design docs, prototypes, reference assets, server, three clients, shared package, infrastructure, pending design-locked, open spec questions, drift items, chat timeline.

**When you need historical context.** Project knowledge has four chat transcripts. Query them only when relevant to your task:
- Chat #82 transcript (Pasted_text.txt) — the dashboard six-section design lock
- Chat #84 (chat-84-architecture-revelation.txt) — the pool/two-stage/replication architecture
- Chat #94 (chat-94-locked-spec-rewrite.txt) — the operating frame and 12 clarifications
- Chat #95 (chat95-full-transcript.txt) — welcome letter + 7-day arc + Day 1 Fast Start

Do not load these in full unless you're auditing a decision from that chat. For specific topics, use `project_knowledge_search` with a short query.

**When you need design surface detail.** Read the relevant `.docx`:
- `Team-Magnificent-App-Description.docx` — Kevin's voice readback of the whole app
- `Team-Magnificent-Signup-Architecture.docx` — `/register` page + the 10-step server sequence
- `Team-Magnificent-COM-Design.docx` — prospect-facing surface, 9 open questions (H.1 resolved)
- `Team-Magnificent-TEAM-Design.docx` — BA-facing surface, 12 open questions (J.3 resolved)
- `Team-Magnificent-ADMIN-Design.docx` — Kevin-only surface, 10 open questions in J.5

**Prototypes (HTML reference, not the wired version).**
- `dashboard-prototype.html` — six locked sections (locked Chat #82). Footer needs drift fix on port.
- `preview.html` — standalone 11-section tm-video-presentation preview.
- `welcome-prototype-v2.html` — /welcome screen prototype, status drafted, markup pending.
- `welcome-letter-v2.html` — the email artifact. **Approved 2026-05-21. Done.**
- `day1-prototype.html` — Fast Start Day 1, drafted, markup pending.

**Brand and style.** `Team-Magnificent-App-Style-Guide.html` is 1,544 lines. The brand tokens you need are in Layer 1 of this file. Read the full style guide only when building a new component pattern that isn't already shown in `apps/com/src/routes/tm-video-presentation/` or `dashboard-prototype.html`.

**Infrastructure quick reference.**
- Universal Gateway: `localhost:2525/api/execute`
- ChromaDB: `localhost:8100` v2 API
- Maxwell GPU embedding service: `localhost:8300` (autostart wired)
- GitHub repo: `github.com/devklg/momentum-creation-system-v1` (private, main branch)
- Monorepo root: `D:/momentum-creation-system-v1/`
- Triple-stack writes via `quadstack.write` action with `options.require: ['mongo','neo4j','chroma']`. Surreal best-effort.
- Chat registry authority: canonical chat/thread identity lives in MongoDB `universal_gateway.chat_registry`, Neo4j `(:ChatRegistry {id})`, and Chroma `chat_registry`. Claude chats, Codex threads, ARCHIE transcripts, Perry handoffs, decisions, learning notes, and GraphRAG records must link to a registry row. Claude and Codex are the active chat providers. Perry/session_handoffs are handoff tools/layers, ARCHIE is a Claude transcript import pipeline, Ulyses is a gateway specialist role/tool when invoked, and GraphRAG is derived memory. Those tools/layers have no autonomous session identity and no authority over chat numbering.
- GraphRAG schema protocol (Chat #135+): every new Universal Gateway memory/lineage write — GraphRAG records, handoffs, decisions, learning notes, transcripts, imports, and derived memory — must call schema-enforced `quadstack.write` with `options.require: ['mongo','neo4j','chroma']` and `options.enforce_schema: true`. Include the canonical `base` envelope from `docs/graphrag-schema-contract.md`: `id`, `type`, `schema_version`, `namespace`, `source`, `created_at`, `title`, `origin_kind`, plus the correct origin field (`chat_number`, `job_id`/`service_name`, or `import_batch_id`). Do not add new `date`, `timestamp`, `chat`, `synced_chat`, or `start_time` aliases on memory records.
- Registry numbering rule: `chat_number` is integer-only. Task slugs, dates, and provider titles belong in `task_id`, `session_label`, or provider metadata, never in `chat_number`. Unproven Claude/Codex records get `chat_number: null` and `registration_status: 'needs_reconciliation'`.

**Critical gotchas (learned the hard way):**
- `mongodb.insert` wants `documents:` (plural array), not `document:`
- `mongodb.query` uses `filter:` (not `query:`), returns `{count, documents}` not the array directly
- `neo4j.cypher` action is `cypher`, parameter is `query`
- ChromaDB requires GPU service alive on 8300 for embeddings; check `/embedding/batch` endpoint per chat59 lesson
- pnpm scripts use `pnpm --filter @momentum/<name>` (path-glob filters break on Windows PowerShell)
- For `tsx` + monorepo `.env`: walk up from current file looking for `pnpm-workspace.yaml` marker — never trust `import.meta.url` path math
- Sandbox-to-Windows file transfer: use `present_files` from `/mnt/user-data/outputs/`, not chunked base64

**When to ask Kevin.** Per the standing rule from Chat #110 lesson: ask rather than improvise when architectural detail is missing. Kevin has a standing trust marker on this after a session where Claude generated questions, auto-filled answers, and pushed commits without genuine direction.

**KEYMD protocol for Team Magnificent sessions** (recommended replacement for the existing 5-step KEYMD when working on this project):
1. Read `D:/claude-learning/THE-KEY.md`
2. View `/mnt/skills/user/session-rules/SKILL.md`
3. View `/mnt/skills/user/perry/SKILL.md`
4. Read this file (`AGENT-BRIEFING.md`)
5. Call `universal-gateway.session-gate.run` with all 4 flags true
6. Acknowledge chat number, ask Kevin to confirm
7. Ask what to build. Do not pre-read other documents.

---

*Last updated: 2026-05-21 (Chat #112). Update this file when a Layer 1 rule changes, a Layer 2 architectural fact shifts, or a Layer 3 pointer becomes stale. Do not let this file grow past ~500 lines. If it does, the discipline has failed.*
