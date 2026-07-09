# Momentum Creation System V2 Platform Audit

Repository audit generated from the local repository state on 2026-07-09.

Source of truth for this audit: the repository implementation and repo-tracked authority files. The requested comparison documents are treated as source inputs, but when documents conflict with implementation or later authority files, the conflict is recorded instead of silently resolved.

Audited HEAD: `b2c5620`

Branch: `main`

Requested comparison files:

- `MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md`
- `SCHEMA_GOVERNANCE.md`
- `TRAINING_ARCHITECTURE.md`
- `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md`
- `AI_AGENT_PLAYBOOK.md`

Important source note: `AI_AGENT_PLAYBOOK.md` was not found in the repository. Closest repo-tracked agent authorities found were `AGENT_ARCHITECTURE.md`, `AGENT_PROMPT_GOVERNANCE.md`, and runtime/engineering agent documents. This is recorded as a governance gap, not inferred away.

Verification run:

- `pnpm --config.verify-deps-before-run=false typecheck`: PASS
- `pnpm --config.verify-deps-before-run=false build`: PASS
- `pnpm --config.verify-deps-before-run=false --filter @momentum/server test`: FAIL, 9 failing Michael runtime assertions out of 1425 tests
- Plain `pnpm typecheck`, `pnpm build`, and server test commands were initially blocked before execution by pnpm dependency build-script approval state for `argon2` and `esbuild`

---

## Page 01 - Executive Summary

Momentum Creation System V2 is no longer just an architectural idea. The repository contains a substantial working application with three client surfaces, an Express API, direct MongoDB/Neo4j/ChromaDB persistence adapters, real product routes, admin controls, invitation workflows, CRM workflows, orientation and training flows, agent-adjacent surfaces, and a large verification suite. The current system is best understood as a mostly built operating platform with several advanced knowledge and agent governance layers still in staged, dormant, canary, or partially adopted form.

The repo strongly implements the core product thesis from the foundation document: Brand Ambassadors invite people into a Team Magnificent path through shareable presentation experiences, PMV language, guided orientation, launch support, callback/webinar paths, and BA-facing tools. The `.com`, `.team`, and `admin` separation is real in code. The token lifecycle and prospect dashboard are real. The shared pool mechanic is real. The BA cockpit, CRM, invitation generator, ScriptMaker/Ivory support, Steve success-profile/onboarding work, Fast Start training, 10-step orientation, admin queue/reporting/live ops, and VM/RVM campaign lane all have concrete implementation.

The strongest architectural choice is direct app persistence through a dedicated app stack rather than gateway-mediated runtime writes. `server/src/services/persistence` establishes MongoDB, Neo4j, ChromaDB, and embedding health as first-class app dependencies. The newer `tieredWrite.ts` and `projectionOutbox.ts` design is a major improvement over one-shot triple-stack writes because it separates graph-critical writes from operational and knowledge projections. It creates a path toward recoverable, observable, retryable multi-database consistency.

The largest implementation debt is that the stronger tiered writer has not yet replaced the older `tripleStackWrite()` call pattern. There are 56 production/test references to `tripleStackWrite(`, while the exported `writeGraphCritical`, `writeKnowledge`, and `writeOperational` helpers are not used by production callers. The older helper performs Mongo first and then optional Neo4j/Chroma legs. If a downstream leg fails after Mongo succeeds, the current call shape can produce partial persistence. That is the single most important backend architecture gap because the project repeatedly states that multi-store persistence and auditability are non-negotiable.

The second largest debt is governance/documentation drift. `docs/project-wireframe.md` appears to be the best current implementation map, while `docs/build-registry.md` is materially stale. `TASK.md` in the root points at an old feature branch while the repository is on `main`, so it is stale operational context. The requested `AI_AGENT_PLAYBOOK.md` is absent. Some older documents still describe future, open, or snake_case schema targets that do not match the later constitutional and implementation reality. This does not mean the repo is wrong; it means the authority trail needs an explicit reconciliation pass.

The third major debt is the knowledge/agent runtime gap. The repository contains thoughtful runtime documents, context manager scaffolding, learning pipeline material, GraphRAG domain code, and active knowledge store code. But the GraphRAG persistence is canary-gated off by default, the domain file itself says it is wired dormant, and Context Manager live flags default to false. The code is in position, but not yet operating as a fully live self-improving agent knowledge layer.

The fourth major issue is verification drift in Michael runtime tests. Typecheck and build pass when pnpm's dependency approval gate is bypassed for command execution, but server tests fail in 4 files with 9 assertions. The failure pattern is consistent: tests expect degraded `safe_fallback` catalog responses, while the implementation now returns `next_training_step`. This is likely a contract/test update issue, but until it is reconciled it is a release risk because it touches agent behavior boundaries.

The fifth major issue is compliance/governance risk around the VM/RVM campaign lane. The lane is implemented with entitlements, admin approval, provider queue, dry-run/manual controls, tokenized presentation flow, and delivery governance. It is not simply wild automation. Still, the original foundation, locked spec, and compliance rules repeatedly protect the platform from automated prospecting, lead qualification, pressure, and noncompliant claims. The VM/RVM lane changes the acquisition posture enough that it should be tied to an explicit current decision/ACR and compliance review.

Bottom line: this repository is in an advanced build state. It is not a blank slate. It is also not yet a fully governed live knowledge-agent operating system. The immediate path is not to rebuild; it is to consolidate: migrate writes to tiered persistence, reconcile agent/runtime contracts, make authority docs current, harden the knowledge ingestion/retrieval path, and close the last governance gaps around VM/RVM and prompt/agent registries.

---

## Page 02 - Audit Scope And Method

This audit examined repository structure, governing documentation, implementation files, route surfaces, persistence adapters, runtime and knowledge systems, test/build outcomes, and current documentation authority. The audit focused on what the code actually contains rather than relying only on planning documents.

Primary implementation areas reviewed:

- `apps/com`
- `apps/team`
- `apps/admin`
- `server/src`
- `packages/shared`
- `runtime`
- `knowledge`
- `implementation`
- `constitution`
- `organization`
- `engineering`
- `docs`

Repository size signals from the audit scan:

- 1037 files in the main audit scope directories
- 585 TypeScript/JavaScript source files under `apps`, `server`, and `packages`
- 136 server test files executed by Vitest
- 1425 server tests observed in the server test run

The audit used the following authority logic:

1. The repository implementation is the source of truth requested by Kevin.
2. `docs/project-wireframe.md` appears to be the most current implementation map.
3. `constitution/MOMENTUM_CONSTITUTION.md` and the related decision framework describe current operating authority more clearly than the older foundation documents.
4. `docs/locked-spec.md` remains important, but portions of it are older and should be reconciled against the wireframe and code.
5. `docs/build-registry.md` is useful historical evidence but is stale relative to recent implementation.
6. Missing requested files are gaps, not opportunities for fabrication.

The audit did not assume live database contents beyond what code and configuration prove. It reviewed database usage patterns through repository code, environment defaults, health probes, route/domain behavior, and adapter contracts.

---

## Page 03 - Source Documents Compared

`MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md` defines the original vision: transformation, Team Magnificent community, PMV, invitation-driven growth, a prospect-facing presentation, BA-facing launch and training, AI support bounded by human decision-making, and a multi-database knowledge layer. The implementation broadly follows this product intent, but later repo authority has refined the language and system boundaries.

`SCHEMA_GOVERNANCE.md` states a strict one-concept-one-schema discipline, warns against schema drift, and emphasizes canonical schema repositories. The implementation follows the spirit of this document through shared types, direct adapters, audit trails, and route/domain decomposition. However, there is visible drift between older schema-governance language and the current camelCase TypeScript/application model. This needs reconciliation through the current ACR/decision system rather than a casual rewrite.

`TRAINING_ARCHITECTURE.md` describes Resource Center, Orientation, Training Modules, Launch Center, and Daily Success Coach as a connected training ecosystem. The implementation materially covers Orientation, Fast Start, 10-step training, content videos, Steve onboarding/success profile work, Michael runtime support, and BA cockpit guidance. The larger resource/event/training graph vision exists partially, not fully.

`MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` requires MongoDB as canonical truth, ChromaDB as semantic retrieval, Neo4j as relationship reasoning, and GraphRAG as grounded retrieval/synthesis. The implementation has direct app persistence, health probes, Chroma collection setup, Neo4j adapters, approved knowledge store code, GraphRAG canary code, context scaffolding, and outbox mechanics. But the live knowledge-agent loop is still incomplete because GraphRAG and Context Manager are gated/dormant by default.

`AI_AGENT_PLAYBOOK.md` was requested but not found. The repository contains `AGENT_ARCHITECTURE.md`, `AGENT_PROMPT_GOVERNANCE.md`, `runtime/AGENT_RUNTIME.md`, and engineering agent guides. Those files give enough authority to audit agent behavior, but the missing named playbook is itself a governance and onboarding gap.

---

## Page 04 - Current State Assessment

The current state is a mature monorepo with a real app architecture:

- Prospect surface: `apps/com`
- BA/team surface: `apps/team`
- Kevin/admin surface: `apps/admin`
- API surface: `server`
- Shared brand/types/compliance package: `packages/shared`
- Runtime and governance documents: `runtime`, `constitution`, `organization`, `engineering`, `docs`

The system is not merely a prototype. It contains route-level authentication and onboarding gates, token lifecycle handling, invitation creation, PMV presentation flow, prospect dashboard, BA cockpit, CRM, training progress, Steve success interview, Michael runtime, ScriptMaker/Ivory generation support, admin oversight, access code management, reports, live ops, audit controls, content videos, VM/RVM campaign routes, provider queue workers, broadcast workers, and direct persistence.

Verification state:

- TypeScript passes across shared, admin, com, team, and server when pnpm dependency-run verification is bypassed with `--config.verify-deps-before-run=false`.
- Build passes across shared, admin, com, team, and server under the same pnpm run configuration.
- Server tests are very strong numerically: 1416 passing tests out of 1425.
- The 9 failing tests are concentrated around Michael runtime expected catalog behavior.
- Build warns about team app chunk size and a com dynamic import that cannot split because the module is also statically imported.

The implementation state is therefore not "broken." It is "mostly buildable with a small but important failing test cluster and a package-manager approval gate that must be resolved for normal commands."

---

## Page 05 - Repository Topology

The topology is consistent with the intended three-surface product:

- `apps/com` holds prospect-facing routes, presentation sections, dashboard sections, PMV-facing content, magic link redemption, and RVM token route.
- `apps/team` holds BA login, cockpit, CRM, invitation tools, Ivory surfaces, training, video library, profile, onboarding, Steve/Michael routes, leadership, VM campaigns, and sponsor workbook surfaces.
- `apps/admin` holds Kevin/admin login, dashboard, access codes, BA/prospect oversight, queue, reports, live ops, broadcast, knowledge, audit, content videos, orientation admin, tenant, agents, and VM admin.
- `server/src/routes` provides the API shape.
- `server/src/domain` contains most business logic.
- `server/src/services` contains persistence, auth/session, delivery, LLM, audit, projection, knowledge, and integration services.
- `server/src/runtime` contains agent/context/knowledge runtime scaffolding and tests.
- `packages/shared/src` contains shared types, rules, compliance, brand, runtime contracts, and package exports.

This layout is a strength. It keeps surface-level UI separate from server logic and keeps shared vocabulary/types in a workspace package. It also allows the team to scale implementation across parallel worktrees because domains and routes are fairly well separated.

The main topology weakness is that the server domain layer is now wide. There are many independent domain files, many route modules, and many persistence call sites. That is expected for a fast-moving product, but it raises the cost of consistency work. Any cross-cutting change, especially persistence governance, prompt governance, compliance vocabulary, or agent behavior, now requires repo-wide migration discipline.

---

## Page 06 - Verification Findings

The audit ran normal verification first:

- `pnpm typecheck`
- `pnpm --filter @momentum/server test`
- `pnpm build`

All three initially failed before reaching TypeScript, Vitest, or Vite build work because pnpm stopped on ignored dependency build scripts:

- `argon2@0.41.1`
- `esbuild@0.23.1`
- `esbuild@0.24.2`
- `esbuild@0.25.12`

The non-invasive command workaround was to run the same gates with `--config.verify-deps-before-run=false`. That does not approve dependency builds; it only avoids the pre-run dependency status check for this command invocation.

Results with that flag:

- Typecheck: PASS
- Build: PASS
- Server tests: FAIL

Server test failure details:

- 4 files failed.
- 9 tests failed.
- 132 server test files passed.
- 1416 tests passed.
- 1425 tests ran.

Failure pattern:

- Tests expect `michael_safe_fallback_degraded_en` or `michael_safe_fallback_degraded_es`.
- Implementation returns `michael_next_training_step_en` or `michael_next_training_step_es`.
- Tests expect response type `safe_fallback`.
- Implementation returns response type `next_training_step`.

Assessment:

This looks like drift between Michael runtime contract tests and current route behavior, not a broad platform collapse. It still matters because Michael is an agent-facing runtime and contract drift is exactly where governance failures begin. The next action should be to decide whether current behavior is intended. If intended, update the tests and governing runtime docs. If not intended, restore degraded fallback behavior for empty/server-owned turns.

---

## Page 07 - Architecture Assessment

Strengths:

- The three-client architecture matches the product boundaries: prospect, BA/team, admin.
- The Express API is route modular and domain-heavy rather than putting all logic in route handlers.
- Raw Telnyx webhook mounting before JSON body parsing is correctly preserved in `server/src/index.ts`.
- Pre-gate routes and gated BA-facing routes are separated in server boot order.
- Direct app persistence is clearly separated from external agent memory/tooling.
- Shared package exports enforce common brand, compliance, rules, and types.
- Workers are explicitly started and stopped.

Weaknesses:

- The server domain layer is large and consistency relies heavily on convention.
- Multiple generations of architecture coexist: older `tripleStackWrite`, newer tiered writer, runtime docs, dormant GraphRAG, and live product routes.
- Documentation authority is fractured across root docs, constitution docs, runtime docs, engineering docs, `docs/project-wireframe.md`, and stale registry files.
- Route growth has outpaced a concise endpoint inventory.

Technical Debt:

- `tripleStackWrite()` remains the dominant multi-store write helper.
- Tiered persistence exists but is not production-adopted.
- Some route/domain naming still reflects historical transitions: Michael/Steve role shifts, lead/prospect vocabulary, launch/training/resource terminology.
- Current build registry is stale relative to implementation.

Missing Components:

- A current generated API map.
- A current data schema catalog that binds Mongo collections, Neo4j labels, Chroma collections, shared TypeScript types, and route payloads.
- A migration status document for `tripleStackWrite` to tiered writes.
- A single current agent playbook matching the requested `AI_AGENT_PLAYBOOK.md`.

Optimization Opportunities:

- Generate route inventory from `server/src/index.ts` and route files.
- Generate persistence call inventory and make it part of CI.
- Add architectural lint rules for forbidden route placements and forbidden prospect-facing vocabulary.
- Turn `docs/project-wireframe.md` into the authoritative human-readable build ledger and automatically mark stale mirrors.

Scalability Concerns:

- In-process SSE/event emitters and workers are fine for local/single-instance operation but need external coordination before multi-instance deployment.
- Large team app bundle should be split as modules mature.
- More domain modules mean more write-path risk unless persistence calls are standardized.

Governance Concerns:

- Missing `AI_AGENT_PLAYBOOK.md`.
- Stale `TASK.md` can mislead agents on `main`.
- Stale `docs/build-registry.md` can cause agents to rebuild or misclassify completed work.
- Architecture changes should be tied to ACR/decision rows, especially VM/RVM and knowledge runtime activation.

---

## Page 08 - Product Surface Assessment

The product surface is stronger than the older planning documents imply. The `.com` app includes the tokenized presentation and dashboard path. The `.team` app includes login, cockpit, invitation, CRM, training, Steve, Michael, Ivory, profile, preview, leadership, and VM campaign routes. The admin app includes Kevin-level operational controls.

The `.com` surface aligns with the foundation's core purpose: prospects get a presentation path and next-step options without exposing the internal BA tools. The `.team` surface aligns with the training and launch-center vision: BAs have guided tools to invite, follow up, learn, and work from their cockpit. The admin surface aligns with governance and operations: Kevin can manage access, queue, reporting, content, live ops, and oversight.

The largest product-surface gap is not that routes are absent; it is that the feature map is now broader than the old source documents. The VM/RVM lane, knowledge admin, content video management, Michael runtime canaries, and agent overview surfaces need current documented placement in the product architecture.

The current repo should be treated as the working application, not as a wireframe waiting to be built.

---

## Page 09 - PMV Assessment

Strengths:

- PMV is implemented as a vocabulary and compliance frame, not just a slogan.
- Prospect-facing routes avoid classic income-claim framing.
- Tokenized presentation and dashboard flows support People, Momentum, Volume, Checks without exposing internal compensation math.
- The foundation and locked-spec intent of "position in a shared pool is not a binary placement promise" is reflected in the code and comments.
- BA-facing systems center inviting and follow-up rather than AI lead scoring.

Weaknesses:

- PMV documentation remains split across foundation, locked spec, shared rules, compliance constants, presentation content, and admin reporting.
- Some newer VM/RVM files necessarily use "lead" vocabulary internally; this must remain internal/gated and not bleed into prospect-facing copy.
- PMV measurement is not yet obviously expressed as a single analytics model across invitation, CRM, training, and events.

Technical Debt:

- Need a single PMV contract that maps each PMV concept to allowed UI language, forbidden UI language, database fields, and analytics events.
- Need automated scanning for forbidden prospect-facing terms in `apps/com`.
- Need PMV examples in admin reporting to distinguish operational analytics from prospect promises.

Missing Components:

- PMV analytics dashboard that traces People -> Momentum -> Volume -> Checks without dollar claims.
- PMV glossary enforced by lint/tests.
- PMV event taxonomy shared across invitation, CRM, orientation, launch, and training.

Optimization Opportunities:

- Connect PMV metrics to cockpit guidance so BAs get simple activity guidance without scoring people.
- Add PMV compliance snapshots to admin reports.
- Build PMV content variants for training and resource center without changing the compliance baseline.

Scalability Concerns:

- As more content is added, PMV language drift becomes likely unless content creation tools validate against shared compliance constants.
- Internal campaign lanes can accidentally normalize sales terminology if governance is not explicit.

Governance Concerns:

- PMV must stay prospect-safe: no income guarantees, no cycle math, no placement promises, no automated qualification.
- New VM/RVM acquisition flows should be reviewed against PMV vocabulary and THREE compliance rules before live delivery expands.

---

## Page 10 - CRM Assessment

Strengths:

- CRM is implemented as a BA-facing tool rather than a cold-sales pipeline.
- Server domains include `crm.ts`, `crmHub.ts`, `prospectCrm.ts`, callback requests, outcomes, recruiting cycle, invitations, and prospect account logic.
- Routes are gated behind auth and onboarding where appropriate.
- Ownership checks are visible in CRM domain code.
- CRM connects naturally to invitations, prospects, callbacks, and cockpit workflows.

Weaknesses:

- CRM scope has expanded into several files and concepts, which increases the chance of duplicated status language.
- The older foundation/training docs do not fully describe the now-implemented CRM hub behavior.
- Relationship between CRM contacts, tokenized prospects, RVM leads, and invitation records needs a current canonical schema map.

Technical Debt:

- Need a single CRM lifecycle state model that maps prospect token states, CRM stages, callback states, webinar states, and VM/RVM import states.
- Need cross-surface ownership invariants documented and tested as a schema contract.
- Need a generated collection and graph-label index for CRM-related writes.

Missing Components:

- End-to-end CRM journey documentation.
- Admin-level CRM health report showing stuck states, orphaned prospects, and stale follow-ups.
- Clear human-readable definitions for each CRM state.

Optimization Opportunities:

- Use CRM events to drive non-AI, rule-based cockpit nudges.
- Add stale-follow-up reports for BAs and admin without scoring prospects.
- Add event-sourced history views so Kevin can inspect why a record is in a given state.

Scalability Concerns:

- CRM write volume will grow with invites, VM/RVM campaigns, callbacks, and training actions.
- Without state-machine validation, future branches can introduce incompatible CRM stage names.

Governance Concerns:

- CRM must remain a relationship-support system, not AI lead qualification.
- Any automated recommendations must be explainable, non-coercive, and BA-facing only.

---

## Page 11 - Training Assessment

Strengths:

- Training is meaningfully implemented in `apps/team` and `server/src/domain/training.ts`.
- Fast Start materials, 10-step training, video library, content videos, and progress routes exist.
- Training connects to onboarding and BA cockpit.
- The system includes runtime and knowledge documents that describe learning feedback loops.
- Steve and Michael roles are increasingly separated: Steve for discovery/success profile, Michael for training support/daily coach.

Weaknesses:

- The training architecture vision is larger than the current live implementation.
- Resource Center, Launch Center, Training Modules, and Daily Success Coach exist at different maturity levels.
- Training knowledge ingestion is not fully live through the GraphRAG/Context Manager stack.
- Michael runtime tests show contract drift around fallback vs next-training-step behavior.

Technical Debt:

- Need a single training module catalog with module ids, prerequisites, completion criteria, content sources, and routes.
- Need stronger test coverage around training progress transitions.
- Need documentation that reflects the current Steve/Michael split and removes older ambiguity.

Missing Components:

- Full 20-module training ecosystem from `TRAINING_ARCHITECTURE.md`, if still desired.
- Training effectiveness feedback loop tied to approved knowledge and outcomes.
- Admin training analytics that avoid ranking/scoring people in ways that conflict with values.

Optimization Opportunities:

- Use training progress to personalize BA cockpit next steps without creating pressure or shame.
- Use approved knowledge snippets to keep training content fresh through governed ingestion.
- Add Spanish/English parity checks for training content.

Scalability Concerns:

- Content growth will require better module metadata, search, versioning, and publishing workflow.
- Training state should be resilient to content changes so old completions do not become invalid silently.

Governance Concerns:

- Training recommendations must not become qualification scores.
- Agent-generated training guidance must be grounded in approved knowledge and logged.

---

## Page 12 - Orientation Assessment

Strengths:

- Orientation is implemented as a concrete `.team` route family and server domain.
- The wireframe marks 10-step orientation as largely complete.
- Orientation connects to onboarding, Steve success profile, cockpit readiness, and launch path.
- Orientation sessions and admin orientation oversight exist in code.
- The system respects the idea that a BA should be guided into action rather than dropped into a blank dashboard.

Weaknesses:

- Orientation is spread across onboarding, questionnaire, Steve interview, training/10-steps, and orientation sessions.
- Some docs still refer to older or broader onboarding concepts that do not exactly match the code.
- Orientation's relationship to Launch Center and Resource Center needs clearer current-state documentation.

Technical Debt:

- Need a current orientation state machine.
- Need a canonical route/data mapping for orientation completion, Steve completion, and cockpit unlock.
- Need tests proving pre-gate routes stay pre-gate and BA-facing routes stay gated.

Missing Components:

- Orientation analytics that show where BAs stop without pressuring them.
- Admin diagnostic for orientation records that are stuck, duplicated, or inconsistent.
- Current orientation content inventory.

Optimization Opportunities:

- Make orientation completion feed cockpit next steps.
- Use Steve success profile outputs to tailor orientation sequencing.
- Add admin content tools for safe orientation updates.

Scalability Concerns:

- Orientation becomes harder to evolve when multiple domains treat completion as a gate.
- Future multi-language orientation needs content versioning.

Governance Concerns:

- Orientation must remain supportive and non-scoring.
- Any onboarding-gate changes require ACR-level discipline because they affect access and product flow.

---

## Page 13 - Launch Center Assessment

Strengths:

- Launch-like behavior exists through cockpit, Fast Start, invitation generator, ScriptMaker/Ivory, CRM, training, and profile flows.
- The BA cockpit gives the platform a central operational home.
- Invitation creation and follow-up tools align with the foundation's launch vision.
- The system focuses on daily action and relationship support rather than compensation math.

Weaknesses:

- "Launch Center" as a named, unified subsystem is less explicit in implementation than "cockpit", "training", "invitations", and "CRM."
- Launch readiness is inferred from multiple signals rather than modeled as one canonical launch state.
- Admin visibility into launch completion may be fragmented across reports, BA oversight, and cockpit data.

Technical Debt:

- Need a launch state projection that composes orientation, training, invitations, CRM setup, profile, and first actions.
- Need a launch event taxonomy separate from prospect token lifecycle.
- Need route naming/docs that clarify whether "Launch Center" is a product area or an umbrella concept.

Missing Components:

- Unified Launch Center dashboard, if the foundation term remains a current product requirement.
- Launch plan templates tied to Fast Start and PMV.
- Launch readiness review for Kevin/admin without creating rank/scoring behavior.

Optimization Opportunities:

- Make cockpit the de facto Launch Center and document that decision.
- Add "next best simple action" guidance using deterministic rules, not autonomous qualification.
- Connect launch milestones to resource and event suggestions.

Scalability Concerns:

- If launch flows remain split, future agents may duplicate "launch state" in multiple collections.
- Launch guidance can become noisy as training/resources grow.

Governance Concerns:

- Launch guidance must avoid pressure, income promises, and implied placement guarantees.
- Any AI involvement must stay BA-facing and explainable.

---

## Page 14 - Resource Center Assessment

Strengths:

- The repository contains a knowledge/admin surface and content video management.
- Training and video library routes provide resource-like behavior.
- Runtime docs describe a Knowledge Core and approved knowledge flow.
- `server/src/services/knowledge/approvedKnowledgeStore.ts` exists and uses triple-stack persistence.

Weaknesses:

- Resource Center is not yet a fully unified, named implementation area.
- Resource content, approved knowledge, training videos, and runtime knowledge are adjacent but not fully unified.
- Search/retrieval behavior is not fully live through Context Manager.

Technical Debt:

- Need a resource catalog schema covering videos, docs, training modules, approved knowledge, and event materials.
- Need content lifecycle states: draft, review, approved, active, archived, superseded.
- Need Chroma/Neo4j indexing status visible per resource.

Missing Components:

- Full Resource Center UI with search, filters, categories, and version-safe content.
- Admin publishing workflow that ensures Chroma/Neo4j readiness before resources become retrievable.
- Resource-to-training and resource-to-event graph edges.

Optimization Opportunities:

- Use approved knowledge metadata to power resource search.
- Connect Resource Center suggestions to training context and cockpit needs.
- Add content usage analytics to retire stale resources.

Scalability Concerns:

- Resource volume will require indexing, pagination, caching, and clear archival rules.
- Without a canonical resource schema, every new content type can create another mini-system.

Governance Concerns:

- Resource content must preserve compliance and source lineage.
- Agent-ingested resources must remain candidate/review-only until approved.

---

## Page 15 - Event Center Assessment

Strengths:

- Webinar reservation and orientation session domains exist.
- Prospect next-step paths include callback/webinar-style movement.
- Admin routes include orientation management.
- Runtime and locked-spec material acknowledge event workflows.

Weaknesses:

- Event Center is less built out as a unified named product area than invitations, CRM, training, or admin.
- Email delivery is intentionally dormant/degraded when keys are absent, which affects event reminders.
- Calendar/room/scheduling automation is not a core implemented subsystem.

Technical Debt:

- Need canonical event model: event type, visibility, capacity, registration state, reminders, attendance, follow-up.
- Need one event center route/domain map.
- Need integration status for email/SMS reminders.

Missing Components:

- Full Event Center UI for BAs and admin.
- Event attendance tracking linked to CRM and training.
- Event resource pack and post-event follow-up workflow.

Optimization Opportunities:

- Use event participation to trigger non-AI follow-up reminders.
- Add admin views for upcoming events, reservations, no-shows, and callback requests.
- Connect events to PMV and training without making attendance a score.

Scalability Concerns:

- Event reminders and live updates need queue-backed delivery before scale.
- Multi-timezone event handling must be explicit.

Governance Concerns:

- Events cannot become pressure funnels or implied earnings/placement claims.
- Reminder automation must remain opt-in, compliant, and auditable.

---

## Page 16 - Agents Assessment

Strengths:

- The repository treats agents as support systems, not autonomous authority.
- Steve, Michael, Ivory, ScriptMaker, admin agent overview, and runtime context scaffolding exist in code.
- Agent architecture and prompt governance docs emphasize boundaries, auditability, and no scoring.
- Agent event persistence exists through `/api/agents/events`.
- Michael runtime has extensive test coverage, even though 9 tests currently fail.

Weaknesses:

- The requested `AI_AGENT_PLAYBOOK.md` is missing.
- Agent behavior is spread across root docs, runtime docs, server runtime files, domain files, and route tests.
- Prompt registry/governance is documented more strongly than it is enforced in implementation.
- Context Manager live activation is off by default.

Technical Debt:

- Need a current agent registry file mapping every agent to owner, purpose, allowed inputs, forbidden outputs, prompts, tools, persistence, and tests.
- Need prompt versioning tied to actual route/runtime behavior.
- Need a single contract for "agent recommendation" vs "deterministic cockpit recommendation."

Missing Components:

- `AI_AGENT_PLAYBOOK.md` or a current replacement referenced from repo orientation.
- Agent permission matrix.
- Agent memory write/read audit dashboard.
- Prompt deployment approval workflow.

Optimization Opportunities:

- Promote agent contracts into shared runtime types.
- Add automated tests for forbidden agent behaviors: scoring, qualification, income claims, pressure, and prospect-facing AI claims.
- Generate per-agent health cards for admin.

Scalability Concerns:

- As more agents are introduced, prompt drift and duplicated context logic can multiply.
- Live agent memory must not activate without retrieval-ready gates and lineage.

Governance Concerns:

- Agents must not qualify prospects.
- Agents must not override Kevin, sponsor, THREE, or canonical source-of-truth records.
- Agent output must be traceable to approved knowledge or explicitly marked as degraded/dormant/manual.

---

## Page 17 - Steve Assessment

Strengths:

- Steve is implemented as a discovery/success-profile/onboarding support surface.
- The route/domain files reflect a move away from older Michael interview behavior.
- Steve-related runtime context foundation exists.
- Steve completion is used as a gate concept in the app.

Weaknesses:

- Historical docs and code names can still confuse Steve and Michael responsibilities.
- The on-disk gate is named `requireSteveComplete`, while historical docs sometimes use older names.
- Steve context manager live flag defaults to false, so advanced context behavior is not live by default.

Technical Debt:

- Need a Steve-specific contract document that matches current implementation.
- Need route tests around Steve completion gates and pre-gate access.
- Need current user journey documentation for questionnaire -> Steve -> cockpit/training.

Missing Components:

- Steve prompt/playbook in a current agent registry.
- Steve memory/knowledge lineage if Steve outputs become knowledge inputs.
- Admin diagnostic for Steve completion failures.

Optimization Opportunities:

- Use Steve profile outputs to tailor training and launch guidance deterministically.
- Add content versioning to Steve interview prompts and profile schemas.

Scalability Concerns:

- If Steve profile schema changes without migration, cockpit/training personalization can break.
- Live context activation should be staged with telemetry.

Governance Concerns:

- Steve must discover and support, not judge or rank.
- Profile data is sensitive and should remain scoped, auditable, and minimally exposed.

---

## Page 18 - Michael Assessment

Strengths:

- Michael is present as BA-facing runtime/training support.
- Michael runtime has a large test suite.
- Route body rejection canaries and server-owned turn tests show strong attention to security and behavior contracts.
- Michael's current role aligns better with training/daily coach than older interview ownership.

Weaknesses:

- Server tests currently fail on Michael runtime response expectations.
- There is current drift between expected degraded fallback behavior and implementation returning next training step.
- Context Manager live behavior is disabled by default.

Technical Debt:

- Need to reconcile Michael runtime tests, route behavior, and docs in one ACR/decision.
- Need a generated catalog of Michael response keys and their intended degraded/live behavior.
- Need a single source for supported languages and fallback logic.

Missing Components:

- Current Michael playbook section.
- Runtime contract that clearly states empty body behavior.
- Admin-visible Michael health/debug page for catalog and persistence mode.

Optimization Opportunities:

- Turn failing test cluster into a clear intentional contract: either safe fallback or next training step.
- Add snapshot tests for catalog keys and response types.
- Use Michael only after training context is known, reducing fallback ambiguity.

Scalability Concerns:

- If Michael becomes more live without context governance, fallback paths can leak inconsistent guidance.
- Language expansion multiplies catalog/test complexity.

Governance Concerns:

- Michael must not be prospect-facing.
- Michael must not prospect, score, qualify, or imply success guarantees.
- Runtime changes need prompt and behavior review because they alter agent output.

---

## Page 19 - Ivory And ScriptMaker Assessment

Strengths:

- Ivory and ScriptMaker are implemented as BA-facing composition support.
- The system degrades when LLM/API keys are absent rather than crashing.
- Invitation and script generation are tied to user workflows.
- Compliance boundaries are documented and supported by shared constants/rules.

Weaknesses:

- Prompt governance is stronger in docs than in code-enforced registries.
- Generated copy needs ongoing automated compliance checks as content grows.
- Ivory, ScriptMaker, and invitation generator responsibilities can blur.

Technical Debt:

- Need prompt registry entries for each generation surface.
- Need generated-output audit records linked to prompt version, input, user, and compliance check result.
- Need test fixtures for compliant and noncompliant generation requests.

Missing Components:

- Admin prompt review UI.
- Prompt version migration plan.
- Model/provider abstraction governance tied to env and keys.

Optimization Opportunities:

- Add deterministic compliance preflight and postflight around every generated copy path.
- Provide rewrite suggestions that preserve PMV language.
- Add Spanish variants with compliance parity.

Scalability Concerns:

- More generation surfaces mean higher risk of prompt drift.
- LLM provider errors need queue/retry/observability if generation becomes central to daily work.

Governance Concerns:

- Generated text must not include income claims, cycle math, placement promises, automated prospecting language, or prospect-facing AI claims.
- Human BA remains the sender/owner of relationship communication.

---

## Page 20 - Admin Surface Assessment

Strengths:

- Admin has broad implemented coverage: dashboard, access codes, BA oversight, prospect oversight, queue, reports, live ops, broadcast, audit, knowledge, content videos, orientation, tenant, agents, and VM.
- Admin routes are guarded by `requireAdmin`.
- Audit entries are used across administrative actions.
- Admin has the operational shape Kevin needs to run and inspect the platform.

Weaknesses:

- Admin breadth is now large enough to need a current admin information architecture document.
- Some admin modules are complete while others are partial or newer lanes.
- Admin knowledge and VM areas need stronger governance labels because they can affect system behavior.

Technical Debt:

- Need a generated admin route/module inventory.
- Need a unified admin audit-event taxonomy.
- Need admin action tests around destructive or governance-sensitive operations.

Missing Components:

- Admin governance dashboard for ACR status, prompt registry status, knowledge indexing status, and persistence projection status.
- Admin stale-document warnings.
- Admin cross-store consistency dashboard.

Optimization Opportunities:

- Use admin as the visible control plane for knowledge and agent readiness.
- Add health summaries for workers, queues, projection outbox, Chroma, Neo4j, Mongo, and embedding service.

Scalability Concerns:

- Admin views over growing BA/prospect/event/resource volumes need pagination and index awareness.
- Broadcast/live ops need queue-based backpressure at scale.

Governance Concerns:

- Admin override actions must stay audited.
- Kevin-only controls should remain hard-gated by canonical BA identifiers.

---

## Page 21 - Knowledge Systems Assessment

Strengths:

- The repository contains a serious knowledge-system architecture: runtime documents, approved knowledge store, GraphRAG domain, context manager scaffolding, Chroma/Neo4j/Mongo adapters, knowledge admin surface, and learning pipeline docs.
- Candidate vs approved knowledge separation is described in runtime docs and partly reflected in code.
- GraphRAG code includes retrieval-ready gating and separates active collections from review-only candidates.
- Context Manager scaffolding is designed to fail closed.

Weaknesses:

- The live knowledge loop is not fully enabled.
- `GRAPHRAG_PERSISTENCE_ENABLED` defaults false.
- `MCS_CONTEXT_MANAGER_LIVE_ENABLED` and `STEVE_CONTEXT_MANAGER_LIVE_ENABLED` default false.
- `server/src/domain/graphrag.ts` explicitly says it is wired dormant and not route-mounted.
- Knowledge governance docs are extensive, but implementation activation is cautious and partial.

Technical Debt:

- Need to connect approved knowledge store, GraphRAG persistence, Context Manager retrieval, and admin review into one live path.
- Need automated consistency checks for candidate/review-only vs active/retrieval-ready knowledge.
- Need a visible projection/indexing status per knowledge record.

Missing Components:

- Full admin review workflow from candidate ingestion to active retrieval.
- Current knowledge schema catalog.
- Runtime dashboard showing which knowledge domains are live, dormant, or canary.

Optimization Opportunities:

- Use the projection outbox for knowledge store graph/vector updates.
- Add source conflict detection and stale knowledge warnings.
- Build retrieval tests with known approved snippets and expected context packets.

Scalability Concerns:

- Knowledge volume will require chunking, deduplication, re-indexing, versioning, and aging policies.
- Chroma collections per domain/language can multiply quickly without registry control.

Governance Concerns:

- Chroma must not become canonical truth.
- Candidate knowledge must not be retrieved as active guidance.
- GraphRAG synthesis must be grounded and auditable.

---

## Page 22 - Mongo Usage Assessment

Strengths:

- MongoDB is treated as canonical operational truth in the implementation.
- Direct Mongo adapter configuration uses the dedicated MCS stack, not the external agent gateway stack.
- `PERSISTENCE_DIRECT_ENABLED` defaults true.
- Many domain writes use Mongo collection names consistently through helper calls.
- Newer tiered write design correctly treats Mongo commit as the operational success point for non-graph-critical records.

Weaknesses:

- Many writes still flow through older `tripleStackWrite()`.
- Mongo collection ownership and schema catalog are not centrally generated.
- Partial writes can occur if Mongo succeeds and later Neo4j/Chroma legs fail in the old helper path.

Technical Debt:

- Need collection-by-collection schema registry.
- Need indexes documented and verified for high-volume paths: prospects, tokens, invitations, CRM, VM queue, audit logs, projection outbox.
- Need migration from old triple-stack helper to tiered writer.

Missing Components:

- Mongo schema governance dashboard.
- Collection ownership map.
- Automated index audit.

Optimization Opportunities:

- Use Mongo change/outbox patterns for projections rather than synchronous multi-leg calls on operational writes.
- Add collection-level validation where appropriate.
- Add stuck-state queries for admin health.

Scalability Concerns:

- Audit, CRM, invitation, token, and VM queue collections can grow quickly.
- Without indexing discipline, admin reports and dashboards can degrade under load.

Governance Concerns:

- Mongo remains the source of truth. Chroma and Neo4j should not be allowed to overwrite canonical facts.
- Agent-memory Mongo and app-runtime Mongo must remain separate in naming, stack, and purpose.

---

## Page 23 - Chroma Usage Assessment

Strengths:

- ChromaDB is configured as a direct app dependency on `http://localhost:8200`.
- Startup ensures Chroma collections.
- Chroma health and embedding service readiness are part of persistence health.
- GraphRAG active knowledge uses domain/language collection naming.
- Runtime docs correctly treat Chroma as semantic retrieval, not truth.

Weaknesses:

- GraphRAG persistence is disabled by default.
- Many Chroma writes remain tied to old `tripleStackWrite`.
- Health probe readback has a likely metadata mismatch: write metadata includes `heartbeatId`, but readback filters/checks `healthHeartbeatId`.
- Chroma collection registry is not fully visible as a single current artifact.

Technical Debt:

- Fix the health metadata mismatch.
- Move Chroma projections to the durable outbox/tiered write path.
- Add collection schema and metadata contract tests.

Missing Components:

- Chroma collection catalog by purpose, domain, language, and source.
- Admin visibility into Chroma projection failures and stale embeddings.
- Re-index tooling and age-out policy.

Optimization Opportunities:

- Batch embeddings for large imports.
- Store compact metadata with canonical Mongo ids for reliable joins.
- Use retrieval tests to validate tenant/domain/language gates.

Scalability Concerns:

- Per-domain/per-language collections can fragment retrieval if not governed.
- Embedding service availability can block write paths if Chroma is synchronous in old helper calls.

Governance Concerns:

- Chroma results must always resolve back to canonical Mongo records and approved knowledge.
- No candidate/review-only records should be retrievable by live agents.

---

## Page 24 - Neo4j Usage Assessment

Strengths:

- Neo4j is a first-class direct persistence leg.
- Many domain writes include graph merge queries.
- The newer `tieredWrite.ts` correctly distinguishes graph-critical writes and supports rollback when Neo4j fails after Mongo.
- Graph labels such as knowledge and health heartbeat nodes are used to model relationships and operational status.

Weaknesses:

- Neo4j schema/constraint registry is not obvious as a single current implementation artifact.
- Old triple-stack call sites can half-write when Neo4j fails after Mongo.
- Graph usage appears broad but not yet fully governed by a generated graph model.

Technical Debt:

- Need Neo4j label/relationship/constraint catalog.
- Need migration of graph-critical writes into `writeGraphCritical`.
- Need graph verification tests for sponsor immutability, pool positioning, CRM ownership, knowledge lineage, and VM ownership.

Missing Components:

- Admin graph health report.
- Constraint creation/migration scripts.
- GraphRAG relationship readiness dashboard.

Optimization Opportunities:

- Use Neo4j for explainable lineage queries and admin diagnostics.
- Add graph traversals to detect orphaned or inconsistent records.
- Use graph-critical tiers only where relationships are truly load-bearing.

Scalability Concerns:

- Graph write volume can become expensive if every operational event creates dense relationships.
- Without constraints, duplicate graph nodes become likely as data grows.

Governance Concerns:

- Neo4j should support relationships and reasoning, not override canonical Mongo facts.
- Any graph-derived recommendation must be explainable and grounded.

---

## Page 25 - GraphRAG Assessment

Strengths:

- GraphRAG is represented in code, not just docs.
- The domain implementation uses active knowledge collections, retrieval-ready gates, tenant filters, and Neo4j knowledge nodes.
- It explicitly avoids retrieving candidate/review-only records.
- The canary-gated default-off posture is appropriate for a sensitive knowledge system.

Weaknesses:

- `GRAPHRAG_PERSISTENCE_ENABLED` defaults false.
- The GraphRAG file says it is wired dormant and no route mounts it.
- It still uses `tripleStackWrite()` rather than the newer tiered writer/outbox pattern.
- Live Context Manager retrieval is not fully active.

Technical Debt:

- Move GraphRAG persistence to `writeKnowledge`.
- Add GraphRAG route/service activation under an explicit ACR.
- Add retrieval-readiness tests spanning Mongo, Chroma, Neo4j, and context packet assembly.

Missing Components:

- Live GraphRAG admin control and health status.
- GraphRAG source citation UI.
- Knowledge conflict resolution workflow.

Optimization Opportunities:

- Use GraphRAG first for admin/agent context packets, not user-visible autonomous answers.
- Start with a narrow domain such as training resources or compliance snippets.
- Add trace ids from source document to context packet to agent output.

Scalability Concerns:

- Retrieval latency can increase quickly if graph and vector steps are not cached/batched.
- Source lineage and supersession edges need strict indexing.

Governance Concerns:

- GraphRAG must never synthesize unsourced compliance or earnings claims.
- GraphRAG output should be read as assisted retrieval, not authority.

---

## Page 26 - Multi-Database Persistence Assessment

Strengths:

- Direct persistence stack is clear: Mongo 30000, Neo4j 7710, Chroma 8200, embedding service 8300 in repo environment examples.
- `connectDirectPersistence()` validates all legs.
- `directPersistenceHealth` is available.
- `/api/health/persistence` and admin triple-stack health probe exist.
- New tiered writer and projection outbox are architecturally strong.

Weaknesses:

- Old and new write strategies coexist.
- Old write helper allows optional Neo4j/Chroma inputs despite docs saying every persistent app write should hit all three.
- Projection outbox is not yet the dominant path.
- Health probe has the Chroma metadata readback bug noted earlier.

Technical Debt:

- Inventory every `tripleStackWrite` caller and classify as graph-critical, knowledge, or operational.
- Migrate high-risk writes first: BA identity, sponsorship, token lifecycle, pool placement, CRM ownership, VM ownership, knowledge approvals.
- Add write-path tests that simulate Neo4j/Chroma failures.

Missing Components:

- Migration tracker for all 56 call sites.
- Outbox dead-letter admin UI.
- Cross-store reconciliation job.

Optimization Opportunities:

- Treat Mongo commit as primary for operational writes and queue projections.
- Use graph-critical rollback only for relationship invariants that cannot tolerate eventual graph projection.
- Add automatic alerts for exhausted projection retries.

Scalability Concerns:

- Synchronous triple-stack writes increase latency and failure coupling.
- Multi-store writes need idempotency keys and retries as volume grows.

Governance Concerns:

- The project says all persistent writes land in all three stores. Current implementation needs a stricter enforcement layer or a formally ratified tiered consistency model.

---

## Page 27 - Context Manager Assessment

Strengths:

- Context Manager scaffolding is careful and governance-aware.
- It is fail-closed by default.
- Runtime context foundation files exist for Michael and Steve.
- Context packet construction is separated from route/domain code.
- Tests exist for live flag behavior.

Weaknesses:

- Live flags default false.
- Active retrieval is limited/dormant.
- Context Manager is not yet the central way agents receive approved knowledge.
- Documentation is ahead of runtime activation.

Technical Debt:

- Need context packet contract frozen and referenced from agent routes.
- Need real approved knowledge provider integration behind canaries.
- Need end-to-end trace from source knowledge -> context packet -> agent response -> audit event.

Missing Components:

- Admin Context Manager health page.
- Context packet debugger.
- Retrieval coverage tests across domains and languages.

Optimization Opportunities:

- Activate one narrow context domain first.
- Use context packets for Michael training guidance before broader live agent features.
- Add observability around degradation reasons.

Scalability Concerns:

- Context assembly can become slow without caching and careful retrieval budgets.
- Multi-agent context duplication can increase token and latency costs.

Governance Concerns:

- Context Manager must only retrieve approved, active, retrieval-ready knowledge.
- It must preserve source lineage and never hide degraded mode.

---

## Page 28 - Schema Governance Assessment

Strengths:

- Shared package centralizes many types, compliance constants, rules, and brand tokens.
- Runtime documents strongly articulate schema discipline.
- Direct persistence adapters reduce uncontrolled external schema behavior.
- The ACR system provides a governance mechanism for schema-changing work.

Weaknesses:

- `SCHEMA_GOVERNANCE.md` does not fully match the current implementation style and later authority.
- There is no single generated schema catalog covering Mongo, Neo4j, Chroma, route payloads, and shared types.
- Domain-specific schemas are spread across TypeScript types, zod validation, Mongoose-ish adapters, and inline objects.

Technical Debt:

- Need schema owner map.
- Need one-concept-one-schema enforcement checks.
- Need canonical naming decisions for camelCase app model vs older snake_case governance docs.

Missing Components:

- Current Schema Registry.
- Schema drift CI.
- Collection-to-type-to-route mapping.

Optimization Opportunities:

- Generate documentation from zod/shared types where possible.
- Add schema change checklist to ACR.
- Add tests that fail on duplicate incompatible lifecycle enums.

Scalability Concerns:

- More surfaces and agents will create more state names unless lifecycle models are centralized.
- Data migrations become harder as schema drift accumulates.

Governance Concerns:

- Schema drift is one of the highest governance risks because it breaks GraphRAG, reports, agents, and admin oversight at once.
- Schema changes need explicit decision records.

---

## Page 29 - Documentation Authority Assessment

Strengths:

- The repository has unusually rich documentation.
- `docs/READ-ME-FIRST.md` correctly points agents to the current operating map.
- Constitution and decision framework documents explain authority and decision currency.
- Runtime docs are detailed enough to guide future knowledge and agent work.

Weaknesses:

- Some docs are stale or historical but not clearly marked in all places.
- `docs/build-registry.md` is stale relative to recent implementation and wireframe status.
- Root `TASK.md` is stale on `main`.
- Missing `AI_AGENT_PLAYBOOK.md` can cause agents to search or infer incorrectly.
- `graphify-out/GRAPH_REPORT.md` is from an older commit and should not be treated as current truth.

Technical Debt:

- Need doc freshness metadata and stale warnings.
- Need to archive or clearly mark old generated constitution handbooks.
- Need automated checks that requested authority files exist.

Missing Components:

- Current agent playbook.
- Current build registry regeneration.
- Current endpoint map and schema map.

Optimization Opportunities:

- Generate build registry from project wireframe and code scans.
- Add doc authority banner templates: current, historical, stale, generated archive.
- Add "last verified against commit" metadata.

Scalability Concerns:

- A large doc ecosystem can slow agents down if authority order is not machine-checkable.
- Stale docs can cause duplicate implementation in parallel worktrees.

Governance Concerns:

- Decision ledger and wireframe must remain ahead of mirrors.
- Agents should not treat old planning docs as permission to rebuild current features.

---

## Page 30 - Compliance Assessment

Strengths:

- Compliance is embedded in repo instructions, shared rules, shared compliance constants, surface separation, and route gating.
- Prospect-facing `.com` is separated from BA-facing `.team`.
- The codebase includes comments and structures that avoid income, placement, AI prospecting, and THREE branding on `.com`.
- ScriptMaker/Ivory are designed to degrade safely when API keys are absent.

Weaknesses:

- Compliance scans are not obviously enforced as a full CI gate across all prospect-facing copy.
- Newer VM/RVM language introduces "lead" vocabulary internally, which is acceptable only if kept gated and non-prospect-facing.
- Content growth increases copy drift risk.

Technical Debt:

- Need CI copy scan for `apps/com`.
- Need generated compliance report for generated scripts, resources, training, and event content.
- Need a compliance owner matrix for new lanes.

Missing Components:

- Automated PMV/prohibited-language scanner.
- Admin compliance dashboard.
- VM/RVM compliance ACR linkage.

Optimization Opportunities:

- Build compliance checks into content/video/resource publish workflows.
- Add test fixtures for noncompliant copy.
- Use shared rules as both runtime guards and static scan inputs.

Scalability Concerns:

- More user-generated/generated content means more moderation and review load.
- Multi-language content needs equivalent compliance checks.

Governance Concerns:

- No income claims, no placement promises, no automated prospect qualification, no prospect-facing AI claims, no THREE branding on `.com`.
- VM/RVM expansion should be reviewed under current policy and product governance.

---

## Page 31 - Security And Access Assessment

Strengths:

- Auth middleware, admin middleware, Steve gate, and VM entitlement middleware exist.
- Admin routes are consistently gated.
- Prospect token routes are separated from BA/admin routes.
- VM dialer access requires BA authentication and explicit entitlement.
- Env validation warns when live VM delivery lacks webhook shared secret.

Weaknesses:

- Access logic is distributed across routes and middleware.
- Entitlement models need clear schema ownership as new modules are added.
- Some pre-gate routes are necessarily open and need continued route-placement discipline.

Technical Debt:

- Need route-level access inventory.
- Need tests proving every admin route uses `requireAdmin`.
- Need tests proving every gated BA route applies auth and onboarding where intended.

Missing Components:

- Permissions matrix by route.
- Entitlement admin audit view.
- Automated route mount lint.

Optimization Opportunities:

- Generate access docs from route mount declarations.
- Add route smoke tests for 401/403 behavior.
- Add security headers and cookie setting documentation if not already covered elsewhere.

Scalability Concerns:

- As modules grow, manual access review becomes error-prone.
- Multi-tenant expansion will require more explicit tenant scoping.

Governance Concerns:

- Kevin-only admin controls must remain hard gated.
- Prospect access must never expose BA/admin internals.

---

## Page 32 - Observability And Operations Assessment

Strengths:

- Health routes exist.
- Direct persistence health exists.
- Admin triple-stack health probe exists.
- Workers have explicit start/stop hooks.
- Projection outbox has retry and dead-letter semantics.
- Audit logs exist across admin and domain actions.

Weaknesses:

- Health probe Chroma readback likely has a metadata mismatch.
- Outbox dead-letter handling currently appears more code-level than admin-visible.
- Observability is not yet centralized into one operational dashboard.
- Plain pnpm commands are blocked by dependency approval state, which can confuse operators.

Technical Debt:

- Fix Chroma heartbeat readback metadata.
- Add operations runbook for pnpm dependency approvals.
- Expose projection outbox health in admin.
- Add worker status reporting.

Missing Components:

- Operations dashboard combining app health, persistence health, worker state, outbox state, delivery state, and test/build status.
- Alert routing beyond console/log where needed.
- Stuck queue diagnostics.

Optimization Opportunities:

- Add structured logs with correlation ids for token/invitation/CRM/VM flows.
- Add health probe IDs that can be traced across Mongo, Neo4j, and Chroma.
- Add build/test status to release checklist.

Scalability Concerns:

- In-process workers and event buses need coordination before multi-instance deployment.
- Delivery queues need backpressure and retry controls as volume increases.

Governance Concerns:

- Operational alerts should not leak private data.
- Health checks should prove all required persistence legs, not merely liveness.

---

## Page 33 - VM And RVM Campaign Lane Assessment

Strengths:

- VM/RVM is implemented with clear server domains, admin routes, team routes, token route, provider queue, webhook handling, entitlement gate, and live-delivery flags.
- Live delivery is explicitly guarded by both environment flag and campaign/admin approval concepts.
- Default env state is safe: live delivery disabled.
- RVM token route keeps campaign recipients on a controlled presentation path.

Weaknesses:

- This lane is newer than the original foundation model and changes the acquisition posture.
- It introduces internal lead/campaign language that must stay out of prospect-facing `.com` PMV surfaces.
- It needs explicit current authority linkage because older rules warn against automated prospecting and AI calling.

Technical Debt:

- Need a VM/RVM ACR or current decision record referenced from docs and code comments.
- Need compliance tests for VM/RVM copy and prospect routing.
- Need schema catalog entries for VM campaign, lead owner, provider queue, webhook, delivery attempt, and RVM token records.

Missing Components:

- VM/RVM governance summary in current docs.
- Admin compliance review checklist.
- Provider failure/stuck-queue dashboard.

Optimization Opportunities:

- Keep initial operation in dry-run/manual modes until compliance and delivery evidence is strong.
- Add throttling, retries, and provider-independent queue abstractions.
- Add lifecycle reporting for uploaded/imported contacts without scoring people.

Scalability Concerns:

- Provider delivery and webhook volume can grow quickly.
- Queue processing needs rate limits, idempotency, and dead-letter visibility.

Governance Concerns:

- Must not become automated prospecting or automated qualification.
- Must not imply income, placement, or guaranteed outcomes.
- Must remain permissioned, auditable, and compliant with THREE rules.

---

## Page 34 - CRM, Events, And Follow-Up Integration

The CRM, Event Center, callback, webinar, orientation, and VM/RVM systems are interconnected in product reality, even if implemented as separate domains. This is normal at the current stage. The integration question is whether a prospect or BA can move through these systems without inconsistent states.

Strengths:

- Token lifecycle states exist.
- Callback and webinar reservation domains exist.
- CRM domain connects to invitation and prospect records.
- VM/RVM tokenization gives imported/campaign contacts a controlled route.
- Admin oversight surfaces exist.

Weaknesses:

- No single lifecycle diagram currently covers all follow-up paths.
- Event attendance/follow-up is less mature than invitation and CRM.
- Callback/webinar/email delivery depends on dormant/degraded external delivery keys.

Technical Debt:

- Need unified lifecycle map across invite token, prospect account, CRM contact, callback, webinar, orientation, VM/RVM delivery, and outcome.
- Need stuck-state cleanup jobs.
- Need idempotency keys across external events/webhooks.

Missing Components:

- Event attendance to CRM follow-up loop.
- Unified follow-up queue.
- Admin "state integrity" report.

Optimization Opportunities:

- Build deterministic next-step suggestions from lifecycle state.
- Use admin reports to identify system bottlenecks.
- Add explicit state transition audit entries.

Scalability Concerns:

- Follow-up workflows can become noisy without prioritization rules.
- Event and delivery webhooks need idempotent processing.

Governance Concerns:

- Follow-up automation must not cross into AI qualification or pressure.
- Human relationship owner must remain clear.

---

## Page 35 - Gap Analysis

Critical gaps:

1. `AI_AGENT_PLAYBOOK.md` is absent despite being requested as a comparison authority.
2. Tiered persistence is not adopted by production call sites.
3. Michael runtime tests fail due to contract drift.
4. GraphRAG and Context Manager are not live by default and remain partially dormant.
5. VM/RVM lane needs explicit current governance linkage.
6. Build registry and root task file are stale.
7. Chroma health readback likely has a metadata mismatch.

High gaps:

1. No current schema catalog across Mongo, Neo4j, Chroma, routes, and shared types.
2. No generated route/access matrix.
3. No admin-visible projection outbox and cross-store consistency dashboard.
4. No current full PMV compliance scanner.
5. No unified training/resource/event/launch catalog.

Medium gaps:

1. Team app bundle size warning.
2. Com app dynamic import warning.
3. Documentation freshness metadata is inconsistent.
4. Graphify output is stale relative to current HEAD.
5. Resource Center and Event Center are conceptually present but not fully unified.

Low gaps:

1. Some older naming/comment drift.
2. Some stale historical docs remain in generated archives.
3. TODO/future language is high in docs because many runtime specs are intentionally forward-looking.

---

## Page 36 - Risk Analysis

Risk 1: Multi-store inconsistency

Severity: Critical

Likelihood: Medium

Reason: Old triple-stack writes still dominate. If Mongo succeeds and Neo4j/Chroma fails, records can become inconsistent unless caller-specific recovery exists.

Mitigation: Migrate to tiered writer and projection outbox, starting with identity, sponsor, token, pool, CRM ownership, VM ownership, and knowledge approval writes.

Risk 2: Agent contract drift

Severity: High

Likelihood: High

Reason: Michael tests already fail on behavior expectations. Missing `AI_AGENT_PLAYBOOK.md` increases drift risk.

Mitigation: Decide current behavior, update tests/docs or route logic, and create current agent playbook.

Risk 3: Governance/doc drift

Severity: High

Likelihood: High

Reason: Build registry, TASK.md, missing playbook, older schema docs, and stale graph reports can mislead future agents.

Mitigation: Reconcile docs, mark stale/historical docs, regenerate registry, and add freshness metadata.

Risk 4: VM/RVM compliance exposure

Severity: High

Likelihood: Medium

Reason: VM/RVM lane is real and powerful. It can be compliant if governed, but it sits near prohibited automation/prospecting territory.

Mitigation: Tie to explicit ACR, compliance checklist, entitlement controls, copy scans, and admin audit.

Risk 5: Knowledge retrieval activation before readiness

Severity: High

Likelihood: Low to Medium

Reason: Flags default off, which lowers immediate likelihood. But runtime docs are extensive and future activation is likely.

Mitigation: Require retrieval-ready gates, source lineage, admin review, context packet traces, and canary activation.

Risk 6: Operational confusion from pnpm approval state

Severity: Medium

Likelihood: High

Reason: Normal commands fail before running unless dependency verification is bypassed or approvals are resolved.

Mitigation: Add operations runbook or resolve approved-builds configuration intentionally.

Risk 7: Scale limits from in-process workers/events

Severity: Medium

Likelihood: Medium

Reason: Fine locally, but multi-instance deployment needs external queues/coordination.

Mitigation: Move high-volume delivery/projection/event paths to durable queue semantics.

---

## Page 37 - Optimization Roadmap

Phase 1: Stabilize release confidence

- Resolve pnpm dependency approval state so normal `pnpm typecheck`, `pnpm build`, and tests execute.
- Reconcile Michael runtime failing tests.
- Fix Chroma health readback metadata.
- Regenerate or clearly mark stale `docs/build-registry.md`.
- Replace or remove stale root `TASK.md` on `main`.

Phase 2: Consolidate persistence

- Inventory all 56 `tripleStackWrite` call sites.
- Classify each call as graph-critical, knowledge, or operational.
- Migrate graph-critical writes first.
- Migrate knowledge writes to `writeKnowledge`.
- Migrate operational writes to `writeOperational`.
- Add failure simulation tests for each tier.
- Add admin projection outbox dashboard.

Phase 3: Govern agents

- Create `AI_AGENT_PLAYBOOK.md` or formally rename/reference current replacement.
- Create agent registry: Steve, Michael, Ivory, ScriptMaker, admin recommendations, future agents.
- Tie prompts to versions, owners, tests, allowed inputs, forbidden outputs, and degradation behavior.
- Add no-scoring/no-qualification/no-income-claim agent tests.

Phase 4: Activate knowledge safely

- Build knowledge schema catalog.
- Connect approved knowledge store to GraphRAG through tiered writer/outbox.
- Add active/retrieval-ready admin UI.
- Canary one knowledge domain for Context Manager.
- Add traceable context packet logs.

Phase 5: Product unification

- Decide whether Launch Center, Resource Center, and Event Center are named surfaces or umbrella concepts.
- If named surfaces, create route/data catalogs and build missing UI.
- If umbrella concepts, document their composition from cockpit/training/resources/events.
- Add PMV analytics without earnings or placement claims.

Phase 6: Scale and operations

- Externalize queues/event buses where necessary.
- Add route/access matrix generation.
- Add schema drift CI.
- Add compliance copy scan CI.
- Add operational dashboard for workers, persistence, projection, delivery, and knowledge.

---

## Page 38 - Priority Matrix

P0 - Immediate:

- Resolve Michael runtime test drift.
- Fix Chroma health readback metadata.
- Create or reconcile `AI_AGENT_PLAYBOOK.md`.
- Decide/record VM/RVM governance authority.
- Clear pnpm verification blocker or document accepted command pattern.

P1 - High:

- Migrate high-risk `tripleStackWrite` call sites to tiered writes.
- Create schema catalog.
- Regenerate build registry.
- Add route/access inventory.
- Add PMV/prospect-facing compliance scan.
- Add projection outbox admin visibility.

P2 - Medium:

- Unify Launch Center/Resource Center/Event Center definitions.
- Add PMV analytics model.
- Add training/resource/event content catalog.
- Add knowledge activation canary.
- Address team app bundle size.

P3 - Later:

- Expand GraphRAG beyond first canary domain.
- Add advanced admin knowledge dashboards.
- Add multi-instance queue infrastructure.
- Add deeper graph diagnostics and lineage exploration.

Decision matrix:

| Area | Impact | Urgency | Difficulty | Recommended priority |
| --- | --- | --- | --- | --- |
| Michael runtime test drift | High | Immediate | Low-Medium | P0 |
| Tiered write migration | Critical | High | Medium-High | P1, with P0 planning |
| Missing agent playbook | High | Immediate | Medium | P0 |
| VM/RVM governance | High | Immediate | Medium | P0 |
| Chroma health bug | Medium-High | Immediate | Low | P0 |
| Schema catalog | High | High | Medium | P1 |
| Build registry freshness | Medium | High | Low | P1 |
| Context Manager activation | High | Medium | High | P2/P3 |
| Resource/Event unification | Medium | Medium | Medium | P2 |
| Team bundle optimization | Medium | Low | Medium | P2 |

---

## Page 39 - Future Recommendations

Recommendation 1: Treat the current repo as a consolidation project, not a rebuild project.

The product is substantially implemented. The best next work is to remove drift, standardize write paths, harden governance, and activate knowledge systems carefully.

Recommendation 2: Make `docs/project-wireframe.md` and generated registries agree.

If the wireframe is the live build map, regenerate stale mirrors or mark them historical. Agents should not need to guess which document is current.

Recommendation 3: Adopt tiered persistence as the mandatory runtime write model.

The old "all three synchronously or bust" model is too brittle for operational scale. The newer tiered writer is the right direction because it distinguishes true graph-critical invariants from eventually consistent projections. The governance docs should be updated to state this explicitly if Kevin approves that model.

Recommendation 4: Create the agent playbook now.

The missing `AI_AGENT_PLAYBOOK.md` is not just a doc hole. It is the natural place to unify Steve, Michael, Ivory, ScriptMaker, prompt registry, context manager, degradation behavior, and no-scoring/no-qualification rules.

Recommendation 5: Keep GraphRAG gated until the active knowledge path is proven.

The current default-off posture is wise. Activate one domain, prove source lineage and retrieval-ready filtering, then expand.

Recommendation 6: Give VM/RVM a governance wrapper.

The lane can be valuable, but it must be surrounded by explicit policy, copy checks, entitlement gates, admin approvals, provider controls, and audit logs.

Recommendation 7: Add generated maps.

The repo has grown past hand-maintained mental maps. Generate:

- route/access map
- schema catalog
- persistence write catalog
- Chroma collection catalog
- Neo4j label/relationship catalog
- agent/prompt registry
- compliance surface inventory

---

## Page 40 - Subsystem Matrix Summary

| Subsystem | Current maturity | Main strength | Main gap | Priority |
| --- | --- | --- | --- | --- |
| Architecture | High | Three-surface app and modular server are real | Consistency across generations | P1 |
| Agents | Medium | Clear support-not-authority posture | Missing playbook and contract drift | P0 |
| PMV | High | Strong compliance vocabulary and product framing | Need automated scan/analytics model | P1 |
| CRM | Medium-High | Implemented BA-facing relationship workflows | Unified lifecycle model | P1 |
| Training | Medium-High | Fast Start, 10-step, video/content paths | Larger training architecture not fully unified | P2 |
| Orientation | Medium-High | Concrete onboarding/orientation flows | State machine documentation | P1 |
| Launch Center | Medium | Cockpit/invite/training compose launch | Named surface ambiguity | P2 |
| Resource Center | Medium | Knowledge/content/video pieces exist | Unified resource catalog | P2 |
| Event Center | Medium-Low | Webinar/orientation/callback pieces exist | Full event center workflow | P2 |
| Knowledge Systems | Medium | Strong docs and partial implementation | Live activation incomplete | P2 |
| Mongo | High | Canonical app truth via direct adapter | Schema/index catalog | P1 |
| Chroma | Medium | Direct semantic store and collection setup | Dormant GraphRAG, health bug | P0/P2 |
| Neo4j | Medium-High | Direct graph leg and tiered-write path | Constraint/model catalog | P1 |
| GraphRAG | Medium-Low | Gated, retrieval-ready design exists | Not live/routed by default | P2/P3 |

---

## Page 41 - Concrete Findings

Finding 1: Production still uses old triple-stack helper.

Evidence: 56 references to `tripleStackWrite(` across `server/src`, `apps`, and `packages`. Only the tiered writer exports reference `writeGraphCritical`, `writeKnowledge`, and `writeOperational`.

Impact: The most important persistence guarantees are not yet enforced by the strongest available implementation.

Finding 2: Tiered writer is architecturally strong but under-adopted.

Evidence: `server/src/services/tieredWrite.ts` defines graph-critical rollback and durable projection behavior, but production callers are not using the exported helpers.

Impact: The repository already has the shape of the solution; the work is migration and verification.

Finding 3: Chroma health readback likely filters on the wrong metadata field.

Evidence: health write metadata spreads `heartbeat` which includes `heartbeatId`; readback uses `where: { healthHeartbeatId: heartbeatId }` and checks `m?.healthHeartbeatId`.

Impact: Chroma health can report failure even when the write landed.

Finding 4: Michael runtime behavior and tests disagree.

Evidence: Server tests expect safe fallback; route returns next training step. 9 tests fail.

Impact: Agent behavior contract is unsettled.

Finding 5: Requested agent playbook is missing.

Evidence: Search found no `AI_AGENT_PLAYBOOK.md` or direct equivalent with that name.

Impact: Agent governance onboarding is incomplete.

Finding 6: GraphRAG is intentionally dormant.

Evidence: `GRAPHRAG_PERSISTENCE_ENABLED` defaults false, and `graphrag.ts` states it is wired dormant.

Impact: Knowledge-system docs are ahead of live runtime.

Finding 7: Normal pnpm commands are blocked by approval state.

Evidence: Initial verification fails on ignored dependency build scripts.

Impact: Operators/agents can think the repo is failing before actual gates run.

Finding 8: VM/RVM lane needs authority linkage.

Evidence: Implementation is real and gated; older docs constrain automated prospecting. This is a governance boundary change.

Impact: Without explicit ACR/decision linkage, future agents may mis-handle compliance.

---

## Page 42 - Current State By Requested Area

Architecture: Strong core architecture, real product surfaces, route/domain separation, direct persistence. Needs consolidation around write tiers and generated maps.

Agents: Implemented support surfaces and runtime scaffolding. Needs current playbook, prompt registry enforcement, and Michael contract reconciliation.

PMV: Strongly represented in product flow and compliance vocabulary. Needs automated scanning and PMV analytics model.

CRM: Implemented and useful. Needs unified lifecycle map across invite/prospect/callback/webinar/VM/outcome.

Training: Substantially implemented. Needs catalog/versioning and stronger integration with knowledge activation.

Orientation: Real implementation. Needs current state machine and admin diagnostics.

Launch Center: Functionally present through cockpit/training/invites/CRM. Needs naming decision and unified projection if product requires a formal surface.

Resource Center: Partially present through video/content/knowledge/training. Needs unified catalog and publishing workflow.

Event Center: Partially present through webinar/callback/orientation sessions. Needs full event workflow and reminder/delivery governance.

Knowledge Systems: Strong design and partial implementation. Needs safe activation path.

Mongo Usage: Strong and canonical. Needs schema/index catalog and tiered write migration.

Chroma Usage: Present and direct. Needs health bug fix, collection catalog, and live retrieval governance.

Neo4j Usage: Present and direct. Needs graph schema/constraint catalog and graph-critical migration.

GraphRAG Usage: Designed and coded in canary/dormant form. Needs activation, route/service integration, source citation, and tiered persistence.

---

## Page 43 - Launch Readiness View

The repository is build-ready under the noverify pnpm command pattern, but not release-clean because server tests fail.

Release blockers:

- Michael runtime test drift.
- Pnpm dependency approval state for normal commands.
- Chroma health readback bug if health probe is part of release criteria.
- VM/RVM governance decision if live delivery is planned.

Release cautions:

- Team bundle size warning.
- Com dynamic import warning.
- Tiered persistence migration incomplete.
- GraphRAG/Context Manager should remain off unless explicitly canaried.
- Email/LLM live behavior depends on env keys and should be smoke-tested in the intended environment.

Release strengths:

- TypeScript passes.
- Build passes.
- Server tests are overwhelmingly passing except one focused Michael cluster.
- Core product surfaces are implemented.
- Admin and operational controls are broad.
- Direct persistence stack is in place.

Launch recommendation:

Do not delay normal product consolidation because of dormant GraphRAG. Keep advanced knowledge systems gated. Fix the P0 items, then treat tiered persistence migration and doc/schema consolidation as the next launch-hardening phase.

---

## Page 44 - Final Assessment

Momentum Creation System V2 is a real working platform with a strong product spine and a serious governance ambition. Its implementation is ahead of several older planning documents. The prospect experience, BA experience, admin controls, PMV framing, invitation system, CRM, training/orientation, and direct persistence stack are all materially present.

The platform's highest-value next work is precision work:

- settle Michael runtime behavior
- resolve normal verification command blockers
- fix Chroma health readback
- create the missing agent playbook
- wrap VM/RVM in explicit governance
- migrate persistence to the tiered writer
- generate current schema/route/persistence maps
- activate knowledge systems only through governed canaries

The system should not be described as unfinished in a broad sense. It should be described as built, expanding, and in need of governance consolidation before the most advanced agent/knowledge promises are treated as fully live.

This is the right problem to have at this stage. The repository has enough real implementation that the next bottleneck is not imagination; it is disciplined alignment.
