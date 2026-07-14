# Momentum Creation System V2 - Platform Audit Priority Task List

> Agent orchestration Markdown reformatted from `PLATFORM_AUDIT_PRIORITY_TASKLIST.docx`.
> This file preserves the global priority numbering. Do not renumber items unless the audit is regenerated.

## Orchestration Notes

- Source document: `PLATFORM_AUDIT_PRIORITY_TASKLIST.docx`
- Task count: 173
- Execution order: complete P0 items first, then P1, P2, and P3.
- Suggested multi-agent lane shape: assign by subsystem label while preserving item dependencies and priority order.
- Checkbox format: unchecked items use `- [ ]` so agents can update progress in Markdown.
- Governance rule: do not skip items; if an item is blocked, mark it blocked in notes instead of deleting it.

## Source Metadata

- **Source:** PLATFORM_AUDIT.md
- **Generated:** July 10, 2026
- **Task count:** 173 numbered checklist items
- **Ordering:** P0 immediate blockers first, then P1, P2, and P3 work

## P0 - Immediate / Critical

Release blockers, governance blockers, and correctness issues that should be handled first.

- [x] 1. **Michael runtime:** Resolve the Michael runtime contract decision: degraded safe_fallback versus next_training_step for server-owned turns.
- [x] 2. **Michael runtime:** Update either the Michael implementation or the tests so the contract is explicit and no longer drifted.
- [x] 3. **Michael runtime:** Add regression coverage for empty body, explicit English, and explicit Spanish Michael runtime requests.
- [x] 4. **Verification:** Rerun the full server Vitest suite until the Michael runtime failure cluster is green.
- [x] 5. **Verification:** Resolve pnpm dependency approval state for argon2 and esbuild so normal gates run without bypass flags.
- [x] 6. **Operations:** Document the accepted local gate command pattern if pnpm approval state intentionally remains constrained.
- [x] 7. **Chroma:** Fix Chroma health heartbeat readback so the metadata field used for write and readback matches.
- [x] 8. **Chroma:** Add a regression test for Chroma health readback and metadata filtering.
- [x] 9. **Operations:** Validate the admin triple-stack health probe after the Chroma heartbeat fix.
- [x] 10. **Agents:** Create AI_AGENT_PLAYBOOK.md or formally reconcile the missing file to a named current replacement.
- [x] 11. **Agents:** Link the agent playbook to AGENT_ARCHITECTURE.md, AGENT_PROMPT_GOVERNANCE.md, and runtime agent docs.
- [x] 12. **VM/RVM:** Create the explicit VM/RVM governance decision or ACR before expanding live delivery.
- [x] 13. **VM/RVM:** Add a VM/RVM compliance checklist covering automation, qualification, PMV, copy, and provider controls.
- [x] 14. **VM/RVM:** Confirm VM live delivery remains disabled until the governance and compliance checklist is approved.
- [x] 15. **GraphRAG:** Keep GraphRAG and Context Manager live flags off until canary criteria are written and approved.
- [x] 16. **Docs:** Regenerate or clearly mark docs/build-registry.md as stale/current so agents do not rely on old status.
- [x] 17. **Docs:** Replace, remove, or explicitly mark the stale root TASK.md on main.
- [x] 18. **Docs:** Regenerate graphify output or add a visible stale-against-HEAD warning to existing graphify artifacts.
- [x] 19. **Release:** Document the current release blockers and cautions in the active project tracking location.
- [x] 20. **Verification:** Run typecheck, build, and server tests again after P0 fixes and record the clean gate result.

## P1 - High Priority

Core consolidation work that protects data integrity, governance, compliance, and operator confidence.

- [x] 21. **Persistence:** Inventory all 56 tripleStackWrite call sites.
- [x] 22. **Persistence:** Classify every tripleStackWrite call as graph_critical, knowledge, or operational.
- [x] 23. **Persistence:** Migrate BA identity writes to the tiered write model.
- [x] 24. **Persistence:** Migrate sponsor immutability writes to the tiered write model.
- [x] 25. **Persistence:** Migrate token lifecycle writes to the tiered write model.
- [x] 26. **Persistence:** Migrate pool placement writes to the tiered write model.
- [x] 27. **Persistence:** Migrate CRM ownership writes to the tiered write model.
- [x] 28. **Persistence:** Migrate VM ownership and provider queue writes to the tiered write model.
- [x] 29. **Persistence:** Migrate knowledge approval writes to the tiered write model.
- [x] 30. **Persistence:** Move graph-critical records to writeGraphCritical with rollback and readback expectations.
- [x] 31. **Persistence:** Move knowledge records to writeKnowledge with durable projection through the outbox.
- [x] 32. **Persistence:** Move operational records to writeOperational with durable projection through the outbox.
- [x] 33. **Persistence:** Add failure simulation tests for graph-critical, knowledge, and operational write tiers.
- [x] 34. **Persistence:** Expose projection outbox dead letters in the admin surface.
- [x] 35. **Persistence:** Build a cross-store reconciliation job for Mongo, Neo4j, and Chroma.
- [x] 36. **Persistence:** Create an admin consistency report for half-writes, stale projections, and orphan records.
- [x] 37. **Schema:** Create a schema catalog across Mongo collections, Neo4j labels, Chroma collections, route payloads, and shared types.
- [x] 38. **Mongo:** Create a Mongo collection ownership map.
- [x] 39. **Mongo:** Run a Mongo index audit and document the index plan for high-volume collections.
- [x] 40. **Neo4j:** Create the Neo4j labels, relationships, and constraints catalog.
- [x] 41. **Neo4j:** Add Neo4j constraint creation and migration scripts.
- [x] 42. **Chroma:** Create the Chroma collection catalog by purpose, domain, language, source, and metadata contract.
- [x] 43. **Chroma:** Add Chroma metadata contract tests for canonical ids, tenant, domain, language, readiness, and source.
- [x] 44. **API:** Generate a current API route map from server/src/index.ts and route modules.
- [x] 45. **Security:** Generate a route access matrix covering auth, admin, Steve completion, and VM entitlement gates.
- [x] 46. **Security:** Add tests proving every admin route is protected by requireAdmin.
- [x] 47. **Security:** Add tests proving gated BA routes enforce auth and onboarding gates where intended.
- [x] 48. **Security:** Add tests proving pre-gate routes stay limited to the approved pre-gate surface.
- [x] 49. **Compliance:** Add architectural linting for prospect-facing forbidden terms and route placement mistakes.
- [x] 50. **Compliance:** Add a PMV/prospect-facing compliance scanner for apps/com.
- [x] 51. **Compliance:** Add compliance checks around ScriptMaker and Ivory generated copy paths.
- [x] 52. **PMV:** Create the PMV contract mapping concepts to allowed language, forbidden language, fields, and events.
- [x] 53. **PMV:** Create the PMV analytics event taxonomy without earnings, cycle math, or placement claims.
- [x] 54. **CRM:** Create the canonical CRM lifecycle state model.
- [x] 55. **CRM:** Map invitation token, prospect account, CRM, callback, webinar, VM/RVM delivery, and outcome states.
- [x] 56. **CRM:** Add explicit CRM and follow-up state transition audit entries.
- [x] 57. **CRM:** Add stuck CRM and follow-up cleanup jobs.
- [x] 58. **CRM:** Create an admin state integrity report for stuck, duplicated, orphaned, and inconsistent records.
- [x] 59. **Agents:** Create the agent registry for Steve, Michael, Ivory, ScriptMaker, admin recommendations, and future agents.
- [x] 60. **Agents:** Tie prompts to versions, owners, tests, allowed inputs, forbidden outputs, and degradation behavior.
- [x] 61. **Agents:** Add no-scoring, no-qualification, and no-income-claim tests for agent outputs.
- [x] 62. **Michael:** Generate a Michael catalog key and response type registry.
- [x] 63. **Prompts:** Create the prompt review, versioning, and deployment approval workflow.
- [x] 64. **Admin:** Create admin agent health/debug cards.
- [x] 65. **Docs:** Regenerate docs/build-registry.md from the project wireframe and code evidence.
- [x] 66. **Docs:** Add freshness metadata to core docs and generated artifacts.
- [x] 67. **Docs:** Mark historical and generated docs with explicit authority status.
- [x] 68. **Docs:** Add stale-document detection to CI or the agent workflow.
- [x] 69. **Persistence:** Generate and maintain a persistence write catalog as part of CI.
- [x] 70. **Operations:** Expose outbox worker status and retry metrics.
- [x] 71. **Operations:** Create an operational dashboard for workers, persistence, delivery, projections, and knowledge readiness.
- [x] 72. **Operations:** Add structured correlation ids for token, invitation, CRM, and VM/RVM flows.
- [x] 73. **Security:** Create a permissions matrix by route, role, entitlement, and gate.
- [x] 74. **Entitlements:** Create an entitlement admin audit view.
- [x] 75. **Audit:** Create a unified admin audit-event taxonomy.
- [x] 76. **Admin:** Add tests for destructive or governance-sensitive admin actions.
- [x] 77. **VM/RVM:** Document VM/RVM lifecycle schemas for campaigns, recipients, queue, webhooks, attempts, and tokens.
- [x] 78. **VM/RVM:** Create a VM/RVM provider queue failure and stuck-state dashboard.
- [x] 79. **VM/RVM:** Add VM/RVM copy compliance tests.
- [x] 80. **VM/RVM:** Add idempotency keys for VM/RVM provider events and webhooks.
- [x] 81. **Delivery:** Add delivery retry, backpressure, and dead-letter controls.
- [x] 82. **Resources:** Define resource and content lifecycle states: draft, review, approved, active, archived, superseded.
- [x] 83. **Resources:** Build the unified resource catalog schema.
- [x] 84. **Resources:** Add a content publishing gate requiring Chroma and Neo4j readiness before retrieval.
- [x] 85. **Knowledge:** Map the candidate-to-approved knowledge workflow end to end.
- [x] 86. **Knowledge:** Add active and retrieval-ready knowledge status to admin.
- [x] 87. **Knowledge:** Connect approved knowledge store to GraphRAG through tiered writes and the projection outbox.
- [x] 88. **GraphRAG:** Add GraphRAG retrieval-readiness tests across Mongo, Chroma, Neo4j, and Context Manager packets.
- [x] 89. **Context:** Create the Context Manager packet contract and trace schema.
- [x] 90. **Context:** Expose Context Manager degraded reasons in admin or runtime diagnostics.
- [x] 91. **Knowledge:** Add source lineage and citation storage for knowledge records.
- [x] 92. **Schema:** Add schema drift CI checks.
- [x] 93. **Docs:** Generate route, access, schema, and persistence maps into the documentation set.

## P2 - Medium Priority

Product unification, workflow completion, content operations, and scale-hardening work.

- [x] 94. **Launch Center:** Decide whether Launch Center is a named surface or cockpit umbrella concept.
- [x] 95. **Launch Center:** If Launch Center is a named surface, create its route and data catalog.
- [x] 96. **Launch Center:** If Launch Center is an umbrella concept, document cockpit, training, invitation, and CRM composition. *(Not applicable: P2-94 selected the named `/cockpit` surface.)*
- [x] 97. **Launch Center:** Create a launch state projection combining orientation, training, invitations, profile, and CRM readiness.
- [x] 98. **Launch Center:** Add a launch readiness admin view that avoids ranking or scoring people.
- [x] 99. **Resource Center:** Define the Resource Center product boundary.
- [x] 100. **Resource Center:** Build Resource Center UI with search, filters, categories, and version-safe content.
- [x] 101. **Resource Center:** Connect resources to training modules and event materials.
- [x] 102. **Resource Center:** Add resource usage analytics and stale-resource warnings.
- [x] 103. **Event Center:** Define the Event Center product boundary.
- [x] 104. **Event Center:** Build Event Center BA and admin UI.
- [x] 105. **Event Center:** Add event model fields for type, visibility, capacity, registration, reminders, attendance, and follow-up.
- [x] 106. **Event Center:** Connect event attendance to CRM follow-up.
- [~] 107. **Follow-up:** Build a unified follow-up queue. Implementation and automated tests are complete; scoped local component visual QA passed on 2026-07-13, but production visual/release verification is blocked because the deployed `.team` asset does not contain P2-107 and no authorized authenticated test identity or production SHA was available. Evidence: `engineering/audits/p2-107-visual-qa/README.md`.
- [x] 108. **Event Center:** Add multi-timezone event handling tests.
- [ ] 109. **Delivery:** Add email and SMS reminder governance for event workflows.
- [x] 110. **Training:** Build the training module catalog with ids, prerequisites, completion criteria, content sources, and routes.
- [x] 111. **Training:** Reconcile the full 20-module training target with the current implementation.
- [ ] 112. **Training:** Add a training effectiveness feedback loop tied to approved knowledge and outcomes.
- [x] 113. **Training:** Add admin training analytics that avoid ranking or scoring people.
- [x] 114. **Training:** Add Spanish and English parity checks for training content.
- [x] 115. **Orientation:** Create the current orientation state machine.
- [x] 116. **Orientation:** Add an admin diagnostic for stuck, duplicate, or inconsistent orientation records.
- [x] 117. **Orientation:** Create the current orientation content inventory.
- [x] 118. **Steve:** Connect Steve profile outputs to tailored training and launch guidance.
- [x] 119. **Steve:** Add Steve route, completion, and gate tests.
- [ ] 120. **Steve:** Add Steve prompt and playbook entries. *(PR #305 documented two existing records, but the active `extractionSystem()` LLM prompt was not registered. A planned extraction entry and ACR-0022 now preserve the unresolved approval gate.)*
- [x] 121. **Michael:** Create a Michael runtime health and admin debugger.
- [ ] 122. **Michael:** Create a single source of truth for Michael language and fallback behavior.
- [x] 123. **Ivory:** Register Ivory and ScriptMaker prompts in the prompt registry. *(All four live provider-backed generation surfaces are registered with behavior/fallback sources and regression coverage; the two approved planned ScriptMaker WDYK contracts remain explicitly planned.)*
- [x] 124. **Ivory:** Add generated-output audit records with prompt version, input, user, and compliance result. *(All four live Ivory/ScriptMaker generation routes append privacy-minimal records to the existing audit substrate, derive prompt identity/version from the registry, independently rescan delivered copy, and fail closed on rejection.)*
- [x] 125. **LLM:** Add LLM provider error observability and retry/degradation reporting. *(The shared Anthropic adapter now performs one bounded transient retry, reports safe aggregate outcomes and fallback degradations, and exposes an admin-only provider-health snapshot without prompt, output, identity, credential, or upstream-body content.)*
- [x] 126. **PMV:** Build a PMV dashboard without earnings or placement claims. *(The BA Cockpit now opens with a PMV activity snapshot derived from the existing BA-scoped projection: People, Momentum, Volume, manual Next Steps, and three governed observational rates. Regression coverage keeps rendered copy outside the shared PMV analytics forbidden patterns.)*
- [ ] 127. **Cockpit:** Add deterministic cockpit next-step suggestions from lifecycle state.
- [ ] 128. **Admin:** Add admin bottleneck reports for invitations, CRM, training, events, and delivery.
- [ ] 129. **Frontend:** Reduce the team app bundle size through code splitting or manual chunks.
- [ ] 130. **Frontend:** Resolve the com app dynamic/static import split warning.
- [ ] 131. **Admin:** Add pagination and index awareness for high-volume admin views.
- [ ] 132. **Context:** Add caching and batching for Context Manager and GraphRAG retrieval canaries.
- [ ] 133. **Chroma:** Add Chroma re-index tooling and age-out policy.
- [ ] 134. **Knowledge:** Add source conflict detection.
- [ ] 135. **Knowledge:** Add stale knowledge correction and supersession workflow.
- [ ] 136. **Neo4j:** Add graph traversals for orphan and duplicate detection.
- [ ] 137. **Neo4j:** Add sponsor immutability graph verification tests.
- [ ] 138. **Neo4j:** Add pool positioning graph verification tests.
- [ ] 139. **VM/RVM:** Add a provider-independent queue abstraction.
- [ ] 140. **VM/RVM:** Add throttling and rate limits for delivery providers.
- [ ] 141. **Privacy:** Run a privacy and minimal-exposure review for Steve profile data.
- [ ] 142. **Content:** Add content versioning for training, orientation, resources, and event materials.
- [ ] 143. **Release:** Add live-environment smoke tests for email and LLM keys.

## P3 - Later / Strategic

Longer-horizon expansion after release blockers, governance layer, and core catalogs are stable.

- [ ] 144. **Knowledge:** Activate one narrow approved-knowledge domain as the first canary.
- [ ] 145. **Context:** Expand Context Manager use to Michael training only after the first canary passes.
- [ ] 146. **GraphRAG:** Expand GraphRAG beyond the first canary domain.
- [ ] 147. **GraphRAG:** Add GraphRAG source citation UI.
- [ ] 148. **Admin:** Build advanced admin knowledge dashboards.
- [ ] 149. **Neo4j:** Add a graph lineage explorer.
- [ ] 150. **Scale:** Externalize the in-process event bus for multi-instance deployment.
- [ ] 151. **Scale:** Externalize high-volume worker queues.
- [ ] 152. **Scale:** Add multi-instance coordination for SSE, workers, and delivery jobs.
- [ ] 153. **Neo4j:** Add deeper graph diagnostics and lineage queries.
- [ ] 154. **Docs:** Automate route inventory generation from code.
- [ ] 155. **Docs:** Automate schema documentation from Zod and shared TypeScript types.
- [ ] 156. **Resources:** Add governed resource suggestions based on approved knowledge and user context.
- [ ] 157. **PMV:** Add advanced PMV reporting linked to cockpit behavior without income or placement claims.
- [ ] 158. **Events:** Add attendance, no-show, and post-event trend analytics.
- [ ] 159. **Knowledge:** Build content deduplication and chunking for large knowledge imports.
- [ ] 160. **Chroma:** Build batch embedding pipelines for large imports.
- [ ] 161. **Retrieval:** Add retrieval latency budgets and caching policies.
- [ ] 162. **Launch Center:** Add launch plan templates tied to Fast Start and PMV.
- [ ] 163. **Recommendations:** Add resource, event, and training recommendation rules that remain non-scoring.
- [ ] 164. **Ivory:** Add Spanish variants for generated compliant copy.
- [ ] 165. **Prompts:** Build a prompt deployment dashboard.
- [ ] 166. **Agents:** Build an agent memory read/write audit dashboard.
- [ ] 167. **Operations:** Add worker and queue runbooks for production operations.
- [ ] 168. **Compliance:** Add multi-language compliance review workflow.
- [ ] 169. **Docs:** Add a generated endpoint map to every release handoff.
- [ ] 170. **Schema:** Add migration guides for future schema changes.
- [ ] 171. **GraphRAG:** Add graph-aware stale knowledge alerts.
- [ ] 172. **Admin:** Add operational drill-downs for cross-store lineage.
- [ ] 173. **Governance:** Review this task list after P0/P1 completion and regenerate the priority order from the updated repo state.

## Agent Lane Planning Template

Use this section when assigning work to multiple agents. Keep the original numbered task list above as the source of truth.

| Lane | Agent | Item range or explicit items | Subsystem focus | Branch | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Lane 0 | Codex/Claude Code | 5, 6, 10, 16, 17, 18, 19 | P0 release-control foundation, stale-doc reconciliation, active blocker tracker | `codex/platform-audit-p0-lane0-foundation` | Prepared | Must run and merge first. Brief: `engineering/sprints/platform-audit-p0/LANE_0_FOUNDATION.md` |
| Lane 1 | Codex/Claude Code | 1, 2, 3, 4 | Michael runtime contract, EN/ES regressions, server Vitest cluster | `codex/platform-audit-p0-lane1-michael` | Gated | Start after Lane 0 merges. Brief: `engineering/sprints/platform-audit-p0/LANE_1_MICHAEL_RUNTIME.md` |
| Lane 2 | Codex/Claude Code | 7, 8, 9 | Chroma heartbeat metadata readback, regression test, admin health probe | `codex/platform-audit-p0-lane2-chroma` | Gated | Start after Lane 0 merges. Brief: `engineering/sprints/platform-audit-p0/LANE_2_CHROMA_HEALTH.md` |
| Lane 3 | Codex/Claude Code | 11, 12, 13, 14, 15 | Agent playbook links, VM/RVM governance, GraphRAG/Context canary guardrails | `codex/platform-audit-p0-lane3-governance` | Gated | Start after Lane 0 merges. Brief: `engineering/sprints/platform-audit-p0/LANE_3_GOVERNANCE.md` |
| Lane 4 | Codex/Claude Code | 20 plus validation of 4 and 9 | Final gates: typecheck, build, server tests, P0 closeout record | `codex/platform-audit-p0-lane4-final-gates` | Gated | Start after Lanes 1-3 merge. Brief: `engineering/sprints/platform-audit-p0/LANE_4_FINAL_GATES.md` |

## Progress Log

| Date | Item | Agent | Update | Blocker |
| --- | --- | --- | --- | --- |
| 2026-07-10 | P0 orchestration | Codex | Created P0 lane map, master prompt, lane briefs, launcher/worktree scripts, Lane 0 worktree, and `momentum.agent_status` rows for lanes 0-4. Lane 0 is prepared first; dependent lanes are gated until Lane 0 merges. | Queue mirror currently returned no `work_queue_leaves` rows from local Mongo `momentum`; P0 tasklist remains the source for this audit orchestration. |
| 2026-07-11 | P0 Lane 0 foundation | Codex | Closed items 5, 6, 10, 16, 17, 18, and 19: normal `pnpm install --frozen-lockfile` passed with `argon2`/`esbuild` allowBuilds, active gate commands and blockers are in `engineering/sprints/platform-audit-p0/P0_RELEASE_TRACKER.md`, `AI_AGENT_PLAYBOOK.md` exists, stale build-registry/TASK/graphify warnings are visible. | Items 1-4, 7-9, 11-15, and 20 remain owned by Lanes 1-4. |
| 2026-07-11 | P0 Lane 1 Michael runtime | Codex | Closed items 1-4 as evidence-only: current baseline already enforces degraded `safe_fallback` for server-owned turns while Context Manager live retrieval is off, with regression coverage for empty body, explicit English, explicit Spanish, forbidden body fields, malformed language, fail-closed flags, trace off by default, and disabled persistence. Verification passed: `pnpm --filter @momentum/server test -- michael-runtime` (7 files / 104 tests) and full server Vitest (150 files / 1615 tests). | No implementation edit was needed. A future `next_training_step` contract requires approved live Context Manager retrieval, not this P0 lane. |
| 2026-07-11 | P0 Lane 2 Chroma health | Codex | Closed items 7, 8, and 9: Chroma heartbeat readback now filters and checks metadata by canonical `heartbeatId`; regression tests assert writer/readback key parity, metadata-only readback, and admin `/triple-stack` 200/503 route shapes. Verification passed: targeted health tests 9/9, full server Vitest 150 files / 1618 tests, `@momentum/shared` build, server typecheck. | Live admin health probe was not called because this lane used isolated tests; live validation should use MCS stack Mongo 30000 / Neo4j 7710 / Chroma 8200 with inherited DB env stripped. |
| 2026-07-11 | P0 Lane 3 governance | Codex | Closed items 11-15: linked the agent playbook from agent/prompt/runtime docs, proposed ACR-002 for VM/RVM live-delivery governance, added VM/RVM compliance checklist, documented live delivery disabled until approval, and added GraphRAG/Context canary criteria with live flags off by default. | ACR-002 remains Proposed and requires Kevin approval before live delivery expansion. |
| 2026-07-11 | P0 Lane 4 final gates | Codex | Closed item 20 after integrating Lanes 0-3 locally. Final gates passed: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, and `pnpm --filter @momentum/server test` (150 files / 1618 tests). | Build warnings remain as existing P2/P3 cautions: `.com` dynamic/static import split and `.team` chunk size over 500 kB. |
| 2026-07-11 | P1 persistence catalog | Codex | Closed items 21, 22, and 69: generated `engineering/sprints/platform-audit-p1/PERSISTENCE_WRITE_CATALOG.md` plus JSON from AST discovery; catalog covers 56 production `tripleStackWrite` call sites and classifies them as 11 graph-critical, 20 knowledge, and 25 operational. Added `pnpm catalog:persistence:check` to the CI `gates` job so new/unclassified call sites fail the merge gate. | Migration items 23-33 remain open; the catalog is the dependency map for moving callers onto `writeGraphCritical`, `writeKnowledge`, and `writeOperational`. |
| 2026-07-11 | P1 BA identity tiered writes | Codex | Closed item 23: migrated BA identity writes in registration, admin manual BA create, and founder BA seeding from `tripleStackWrite` to `writeGraphCritical` through `baIdentityPersistence.ts`. Sponsor-backed BA graph writes now `MATCH` the sponsor node, verify the sponsor edge with `RETURN count(n) AS n`, and roll back Mongo through the tiered writer if the graph leg fails. Catalog regenerated to 53 remaining production `tripleStackWrite` call sites. | P1-24 sponsor immutability remains open; founder access-code seeding and `codeGen.ts` still use `tripleStackWrite` until that tranche. |
| 2026-07-11 | P1 sponsor immutability tiered writes | Codex | Closed item 24: migrated admin access-code minting, founder access-code seeding, and admin sponsor override graph writes from `tripleStackWrite` to `writeGraphCritical` through `sponsorImmutabilityPersistence.ts`. Access-code owner and sponsor override graph writes now `MATCH` required member nodes and verify owner/current/original/override relationships with `RETURN count(...) AS n`. Catalog regenerated to 50 remaining production `tripleStackWrite` call sites. | P1-25 token lifecycle remains open. |
| 2026-07-11 | P1 token lifecycle tiered writes | Codex | Closed item 25: migrated token creation in invitations, re-invites, legacy bulk leads, and VM provider token generation to `writeGraphCritical` through `tokenLifecyclePersistence.ts`; migrated shared token state transitions and CRM close-as-new-BA token enrollment updates to an operational helper that verifies Mongo readback and queues Neo4j projection on graph failure. Catalog regenerated to 49 remaining production `tripleStackWrite` call sites. | P1-26 pool placement remains open. |
| 2026-07-11 | P1 pool placement tiered writes | Codex | Closed item 26: migrated holding-tank placement creation, expiry sweep placement flushes, and admin move/reassign/manual-flush/force-enroll placement patches through `poolPlacementPersistence.ts`. Placement creation now uses `writeGraphCritical` with a matched prospect node and `IN_HOLDING_TANK` readback; placement patches verify Mongo readback and queue Neo4j projection on graph failure. Catalog remains at 49 remaining production `tripleStackWrite` call sites because this tranche migrated direct persistence calls. | P1-27 CRM ownership remains open. |
| 2026-07-11 | P1 CRM ownership tiered writes | Codex | Closed item 27: migrated prospect-token CRM record creation and VM-lead CRM record creation through `crmOwnershipPersistence.ts`. CRM ownership creation now uses `writeGraphCritical` with matched owner/prospect or owner/VM-lead anchors and readback verification for the ownership graph shape. Catalog regenerated to 47 remaining production `tripleStackWrite` call sites. | P1-28 VM ownership and provider queue remains open. |
| 2026-07-11 | P1 VM ownership and provider queue tiered writes | Codex | Closed item 28: migrated VM lead-owner creation to `writeGraphCritical` and VM provider audit, queue, imported-lead, delivery-event, and provider-webhook writes to `writeOperational`. VM ownership now matches the existing BA owner and verifies the owner-to-lead-owner graph edge; provider queue writes keep Mongo as the operational success boundary. Catalog regenerated to 41 remaining production `tripleStackWrite` call sites. | P1-29 knowledge approval writes remain open. |
| 2026-07-11 | P1 knowledge approval tiered writes | Codex | Closed item 29: migrated Kevin/admin approved knowledge source and chunk writes in `approvedKnowledgeStore.ts` from `tripleStackWrite` to `writeKnowledge`. Approved knowledge writes now commit through the knowledge tier, with Neo4j and Chroma projections handled by the durable projection path. Catalog regenerated to 39 remaining production `tripleStackWrite` call sites. | P1-30 graph-critical record sweep remains open. |
| 2026-07-11 | P1 graph-critical record sweep | Codex | Closed item 30: migrated the remaining graph-critical raw writes in `bulkLeads.ts`, `invitations.ts`, and `ivory.ts` to `writeGraphCritical`. Required graph anchors now use `MATCH`, each write includes a `RETURN count(...) AS n` verification query, and the catalog has zero remaining graph-critical `tripleStackWrite` call sites. Catalog regenerated to 35 remaining production `tripleStackWrite` call sites. | P1-31 knowledge record sweep remains open. |
| 2026-07-11 | P1 knowledge record sweep | Codex | Closed item 31: migrated the remaining 17 knowledge-tier raw writes to `writeKnowledge`, including agent events, content videos, CRM notes/followups/dispositions/activity, generator runs, GraphRAG, invitation activity, learning candidates, prospect CRM timeline events, questionnaires, recruiting-cycle records, Steve discovery, and training progress. Catalog regenerated to 18 remaining production `tripleStackWrite` call sites, all operational. | P1-32 operational record sweep remains open. |
| 2026-07-11 | P1 operational record sweep | Codex | Closed item 32: migrated the remaining 18 operational raw writes to `writeOperational`, including admin oversight, tenant settings, audit/runtime audit, broadcast, callback requests, commitments, orientation, outcomes, prospect accounts and magic links, three-way calls, VM campaigns, webinar reservations, and webinar seeding. Catalog regenerated to 0 remaining production `tripleStackWrite` call sites. | P1-33 tier failure simulation tests remain open. |
| 2026-07-11 | P1 tier failure simulation tests | Codex | Closed item 33: added service-level failure simulations for `writeGraphCritical`, `writeKnowledge`, and `writeOperational`. Tests prove graph-critical Neo4j failure rolls back Mongo and does not queue projection, knowledge Neo4j failure preserves Mongo success and queues a high-priority projection, and operational Chroma failure preserves Mongo success and queues an operational projection. | P1-34 projection outbox dead-letter admin exposure remains open. |
| 2026-07-11 | P1 projection outbox dead-letter admin exposure | Codex | Closed item 34: extended the admin agent oversight API and `/agents` admin page with projection outbox dead-letter rows. The response now includes failed outbox records with tier, target, entity, source collection, attempt count, last error, and timestamps; the memory health row counts both pending knowledge projections and dead-letter projections. | P1-35 cross-store reconciliation job remains open. |
| 2026-07-11 | P1 cross-store reconciliation job | Codex | Closed item 35: added a read-only bounded reconciliation job for Mongo, Neo4j, and Chroma covering member identity, prospect invitations, invite tokens, pool placements, Steve discoveries, and content videos. Run with `pnpm --filter @momentum/server reconcile:stores -- --limit 25`; add `--fail-on-drift` when using it as a gate. | P1-36 admin consistency report remains open. |
| 2026-07-11 | P1 admin consistency report | Codex | Closed item 36: added `/api/admin/consistency/report` and the `/consistency` admin page. The report summarizes suspected graph-critical half-writes, stale/dead-letter projection outbox rows, bounded graph-orphan scans, and sampled cross-store reconciliation issues. | P1-37 schema catalog remains open. |
| 2026-07-11 | P1 schema catalog | Codex | Closed item 37: added `server/scripts/generate-schema-catalog.mjs`, `pnpm catalog:schema`, `pnpm catalog:schema:check`, and generated `engineering/sprints/platform-audit-p1/SCHEMA_CATALOG.md` plus JSON. The catalog covers Mongo collections, Neo4j labels/relationships, Chroma collections, route payload surface, and shared exports. | P1-38 Mongo collection ownership map remains open. |
| 2026-07-11 | P1 Mongo ownership map | Codex | Closed item 38: added `server/scripts/generate-mongo-ownership-map.mjs`, `pnpm catalog:mongo-ownership`, `pnpm catalog:mongo-ownership:check`, and generated `MONGO_COLLECTION_OWNERSHIP_MAP.md` plus JSON. All 65 cataloged Mongo collections are assigned to an owner domain/steward with zero unclassified rows. | P1-39 Mongo index audit remains open. |
| 2026-07-11 | P1 Mongo index audit | Codex | Closed item 39: added `server/scripts/generate-mongo-index-audit.mjs`, `pnpm catalog:mongo-indexes`, `pnpm catalog:mongo-indexes:check`, and generated `MONGO_INDEX_AUDIT_PLAN.md` plus JSON. The audit documents 46 high-volume/planned index rows and records that the general `ensureIndexes` runner is still not present. | P1-40 Neo4j catalog remains open. |
| 2026-07-11 | P1 Neo4j catalog | Codex | Closed item 40: added `server/scripts/generate-neo4j-catalog.mjs`, `pnpm catalog:neo4j`, `pnpm catalog:neo4j:check`, and generated `NEO4J_CATALOG.md` plus JSON. The catalog covers 68 labels, 59 relationships, 11 planned core constraints, and 7 declared Phase 7 constraints/indexes. | P1-41 Neo4j constraint creation and migration scripts remain open. |
| 2026-07-11 | P1 Neo4j schema migrations | Codex | Closed item 41: added an app-persistence Neo4j schema migration planner, dry-run/apply/verify CLI commands, and tests proving idempotent planning, dry-run safety, dispatch execution, and name-based verification. | P1-42 Chroma collection catalog remains open. |
| 2026-07-11 | P1 Chroma collection catalog | Codex | Closed item 42: added `server/scripts/generate-chroma-catalog.mjs`, `pnpm catalog:chroma`, `pnpm catalog:chroma:check`, and generated `CHROMA_COLLECTION_CATALOG.md` plus JSON. The catalog covers 50 registered collections, purpose/domain/language classifications, observed actions, metadata/filter keys, inferred required metadata contracts, and 7 observed unregistered/dynamic targets. | P1-43 Chroma metadata contract tests remain open. |
| 2026-07-11 | P1 Chroma metadata contract tests | Codex | Closed item 43: added catalog-backed tests for canonical ids, tenant scope, domain, language, readiness, source lineage, review-only separation, and unregistered/dynamic Chroma target visibility. Also moved GraphRAG retrieval from unsupported `chromadb.query` to `query_with_filter`. | P1-44 API route map remains open. |
| 2026-07-11 | P1 API route map | Codex | Closed item 44: added `server/scripts/generate-api-route-map.mjs`, `pnpm catalog:api-routes`, `pnpm catalog:api-routes:check`, generated `API_ROUTE_MAP.md` plus JSON, and added QA coverage for raw-body, admin, BA-gated, VM-entitlement, prospect-token, and internal-runtime route families. | P1-45 route access matrix remains open. |
| 2026-07-11 | P1 route access matrix | Codex | Closed item 45: added `server/scripts/generate-route-access-matrix.mjs`, `pnpm catalog:route-access`, `pnpm catalog:route-access:check`, generated `ROUTE_ACCESS_MATRIX.md` plus JSON, and added QA coverage for admin, admin-secret, Steve-gated, Steve-whitelisted, VM entitlement, prospect-token, worker-secret, and provider-webhook route classes. | P1-46 admin route protection tests remain open. |
| 2026-07-11 | P1 admin route protection tests | Codex | Closed item 46: added `server/src/qa/__tests__/adminRouteProtection.test.ts`, proving every `/api/admin/*` route has `requireAdmin` or the explicit `requireAdminOrHealthSecret` exception, and that ordinary admin routes are admin-session only. | P1-47 gated BA route tests remain open. |
| 2026-07-11 | P1 BA gate protection tests | Codex | Closed item 47: added `server/src/qa/__tests__/baRouteGateProtection.test.ts`, proving BA-gated routes require auth and Steve completion, VM BA routes require the VM entitlement gate, and pre-Steve BA exceptions remain authenticated and documented. | P1-48 pre-gate route limitation tests remain open. |
| 2026-07-11 | P1 pre-gate surface tests | Codex | Closed item 48: added `server/src/qa/__tests__/preGateSurface.test.ts`, proving pre-gate/raw-body/admin-large-body routes stay within approved access classes and prefixes, ordinary BA-gated app routes do not slip into pre-gate mounts except explicit Michael/Steve sponsor-support routes, and unauthenticated routes remain token/bootstrap/health/secret/admin/internal only. | P1-49 compliance architectural linting remains open. |
| 2026-07-11 | P1 prospect-facing compliance architecture lint | Codex | Closed item 49: added `server/src/qa/__tests__/prospectFacingComplianceArchitecture.test.ts`, enforcing forbidden high-risk runtime terms in `.com`, canonical shared disclaimer usage, `.com` API literals limited to `/api/p` and `/api/rvm`, and route-matrix proof that every `.com` client endpoint is prospect-only. Also added missing prospect-token RVM routes for stream, webinar reservation, and team stats. | P1-50 PMV/prospect-facing apps/com scanner remains open. |
| 2026-07-11 | P1 `.com` PMV/prospect compliance scanner | Codex | Closed item 50: added `server/scripts/generate-com-prospect-compliance-scan.mjs`, `pnpm compliance:com`, `pnpm compliance:com:check`, generated `COM_PROSPECT_COMPLIANCE_SCAN.md` plus JSON, and added `server/src/qa/__tests__/comProspectComplianceScan.test.ts`. The scanner blocks income/compensation, placement/spillover, AI qualification, current headcount, THREE company branding, and programmatic handoff language while documenting allowed GLP-THREE, market/cost, 100,000-goal, PMV, and placement-demo signals. | P1-51 ScriptMaker/Ivory generated-copy compliance checks remain open. |
| 2026-07-11 | P1 ScriptMaker/Ivory generated-copy compliance | Codex | Closed item 51: added `server/src/domain/generatedCopyCompliance.ts` and domain tests proving ScriptMaker, Ivory coach, Ivory invitation drafts, Ivory Momentum follow-up suggestions, Ivory direct mint, and the shared invitation spine block or degrade on forbidden generated copy. Ivory generated prompts now use compliance-safe angle labels while preserving BA-side canonical labels. | P1-52 PMV contract mapping remains open. |
| 2026-07-11 | P1 PMV contract mapping | Codex | Closed item 52: added `packages/shared/src/pmv-contract.ts`, exported it from shared, documented `PMV_CONTRACT.md`, and added `server/src/qa/__tests__/pmvContract.test.ts` to prove lifecycle, next-action, last-signal, row-field, concept, language, field, and event mappings stay aligned with the current PMV shared types. | P1-53 PMV analytics event taxonomy remains open. |
| 2026-07-11 | P1 PMV analytics event taxonomy | Codex | Closed item 53: added `packages/shared/src/pmv-analytics-taxonomy.ts`, exported it from shared, documented `PMV_ANALYTICS_EVENT_TAXONOMY.md`, and added `server/src/qa/__tests__/pmvAnalyticsTaxonomy.test.ts` proving every PMV contract event has an analytics definition and public metric text avoids earnings, cycle math, and placement/spillover claims. | P1-54 CRM lifecycle state model remains open. |
| 2026-07-11 | P1 CRM lifecycle state model | Codex | Closed item 54: added `packages/shared/src/crm-lifecycle.ts`, exported it from shared, documented `CRM_LIFECYCLE_STATE_MODEL.md`, and added `server/src/qa/__tests__/crmLifecycleStateModel.test.ts` proving the canonical lifecycle model stays aligned with token, PMV, CRM, timeline, disposition, closed-reason, follow-up, and VM/RVM lead state rails. | P1-55 cross-state mapping remains open. |
| 2026-07-11 | P1 CRM cross-state mapping | Codex | Closed item 55: expanded `packages/shared/src/crm-lifecycle.ts` with source-backed mappings across invitation token, prospect account, CRM record, callback, webinar, VM/RVM delivery and lead, outcome, follow-up, and timeline rails; documented `CRM_CROSS_STATE_MAP.md`; and added `server/src/qa/__tests__/crmCrossStateMap.test.ts` to prove complete union coverage and canonical-state alignment. | P1-56 explicit CRM and follow-up transition audit entries remains open. |
| 2026-07-11 | P1 CRM transition audit entries | Codex | Closed item 56: added explicit append-only audit entries for CRM lifecycle status changes, follow-up scheduling/rescheduling/clearing, and disposition set/change/clear paths. Entries carry actor/entity identity and exact before/after snapshots; idempotent no-ops and failed mutations emit no audit. Added focused behavioral coverage in `server/src/domain/__tests__/crmTransitionAudit.test.ts` and documented the action contract in `CRM_TRANSITION_AUDIT_ENTRIES.md`. | P1-57 stuck CRM and follow-up cleanup jobs remains open. |
| 2026-07-11 | P1 CRM cleanup job | Codex | Closed item 57: added the conservative cleanup domain in `server/src/domain/crmCleanup.ts`, the explicit dry-run/apply CLI in `server/scripts/run-crm-cleanup.ts`, and the `cleanup:crm` server command. The job clears active follow-ups only from authoritative terminal/deleted-prospect or closed-CRM evidence and reconciles the CRM `followUpDueAt` projection; it never closes records because of age or treats an overdue reminder as stale. Apply-mode changes are conditional, read-back verified, idempotent, counted, and append system audit evidence; dry-run reports the same bounded candidates without mutation. Contract documented in `CRM_CLEANUP_JOB.md`. | P1-58 admin state integrity report remains open for duplicate, ambiguous, orphaned, terminal-CRM, and other inconsistent records that must be surfaced rather than automatically repaired. |
| 2026-07-11 | P1 CRM state integrity report | Codex | Closed item 58: added a bounded, read-only CRM integrity report on the Kevin-only consistency surface for stuck, duplicate, orphaned, inconsistent, and ambiguous records. It consumes P1-57 in dry-run mode, labels every finding report-only, and explicitly prevents elapsed time from closing CRM records or clearing follow-ups. | P1-59 remains open. |
| 2026-07-13 | P2 unified follow-up queue | Codex | Implementation complete; audit status remains partial. Added one BA-owned read queue across prospect callbacks, VM/RVM inbound callbacks, prospect reminders (including Event Center-connected reminders), and VM/RVM lead reminders. Automated verification passed: focused domain/component tests, repo typecheck, production build, full server suite (1,997 passed), and full team suite (56 passed). Scoped local visual QA subsequently passed for populated, empty, unavailable, click-through, desktop, and mobile component states. | Production verification is BLOCKED: unauthenticated `/cockpit` redirects to `/register`, no authorized test identity was available, `/api/health` exposes no release SHA, and deployed `.team` asset `index-DVxQlJCw.js` does not contain the P2-107 title/manual-contact literals. See `engineering/audits/p2-107-visual-qa/README.md`. P2-109 remains the next unchecked implementation item. |
| 2026-07-13 | P2 Event Center timezone tests | Codex | Closed item 108: extracted deterministic Event Center instant formatting, added Los Angeles/New York/London/Kolkata display coverage, pinned Pacific spring-forward and fall-back behavior, normalized new admin orientation timestamps to UTC, and changed mixed-source ordering from ISO text to actual epoch order. Verification passed: focused timezone tests (9), repo typecheck, production build, full server suite (1,999 passed), and full team suite (59 passed). | P2-109 email/SMS reminder governance is next. |
| 2026-07-13 | P2-109 event reminder governance authority gate | Codex | Kevin approved the High-risk ACR-0019 fail-closed boundary in the Codex task. No runtime, schema, provider, scheduler, queue, canonical Event Center, production, or live-communication change was made. | Boundary approval is recorded. Implementation remains BLOCKED pending Kevin's exact cadence/copy, email-authority, member-consent/backfill, and current-confirmation-path decisions. Item 109 remains unchecked; Event Center remains `not_configured` with `channels:[]`. |
| 2026-07-13 | P2 training module catalog | Codex | Closed item 110: added the versioned `training_catalog.v1` shared catalog for the five implemented Fast Start modules, with stable ids, Steve/auth access prerequisites, non-hard-gated sequence, explicit completion evidence, source references, Team/API routes, resource context tags, and current program completion authority. Added a human-readable catalog boundary and six QA checks covering uniqueness, legacy parity, prerequisites, completion evidence, real routes/sources, and the P2-111 boundary. Focused tests, repo typecheck, and production build passed. | P2-109 remains temporarily deferred by Kevin for email/Resend consideration. P2-111 owns the separate full-target-versus-current reconciliation; the current catalog makes no claim that the larger `TRAINING_ARCHITECTURE.md` target is implemented. |
| 2026-07-13 | P2 training target reconciliation | Codex | Closed item 111: reconciled the architecture's separate Module 0 plus Modules 1–20 (21 enumerated entries), the five-module current Fast Start implementation, and Kevin's active seven-day Fast Start decisions. Added a versioned machine-readable matrix, human audit report, and six QA checks. No target module is falsely marked implemented from topic overlap. | Current Fast Start does not implement the decided calendar-day state, Days 1–4 learn-only rule, Day 4 certification/invitation gate, or Days 5–7 2-in-72 phase. Architecture completion-level labels require constitutional review before any future use as BA classifications. P2-109 remains temporarily deferred by Kevin. |
| 2026-07-13 | P2 admin training analytics | Codex | Closed item 113: replaced the dashboard training tile's person-row presentation with aggregate curriculum health. The admin view now reports scoped not-started, underway, and all-five-modules-complete counts plus per-module state counts and completion percentages from explicit `tmag_fast_start_progress` evidence. Added duplicate/invalid-record visibility and focused aggregate tests. | P2-112 effectiveness/outcome attribution remains blocked behind proposed ACR-0020 and is not used here. This surface emits no BA identity, score, rank, prediction, effectiveness claim, or outcome attribution. |
| 2026-07-13 | P2 training language parity | Codex | Closed item 114: added a versioned EN/ES training parity contract and five CI-backed QA checks covering the Fast Start hub, all five current modules, and ten-step orientation. The checks enforce inventory coverage, real routes/sources, structural block parity for declared variants, and detection of incomplete future variants. | Current audit truth is 7/7 English variants, 0/7 Spanish variants, and 0 parity-complete surfaces. No Spanish copy was invented or machine-translated; approved Spanish content remains a content-authority dependency. |
| 2026-07-13 | P2 current orientation state machine | Codex | Closed item 115: added the versioned `orientation_state.v1` contract, a fail-closed projector over current reservation evidence, and authenticated `GET /api/orientation/state`. Current states are not-scheduled, scheduled, cancelled, attendance-unverified, and inconsistent; six focused tests cover supported transitions and malformed/duplicate evidence. | The future Stage 0–10 architecture is not current runtime truth. Reservation and elapsed time never imply attendance or completion; the current app still has no attendance/completion authority. |
| 2026-07-13 | P2 orientation record diagnostic | Codex | Closed item 116: added a bounded, Kevin-only `orientation_diagnostic.v1` report over the current session and reservation authorities, exposed it at `GET /api/admin/orientation/diagnostic`, and surfaced stuck, duplicate, and inconsistent evidence on the existing Group Orientation admin page. The pure projector, route gate/audit behavior, bounded-scan state, populated findings, empty UI state, and desktop/narrow visual layouts were verified. | The diagnostic is report-only: `autoRepair=false`, attendance/completion authorities remain null, and elapsed reservations never become attendance or completion evidence. Stored `upcoming` sessions are not treated as stale solely because time elapsed because the current scheduler has no session-status transition writer. |
| 2026-07-13 | P2 current orientation content inventory | Codex | Closed item 117: added `orientation_content_inventory.v1`, enumerating the exact ten-step live-hosted curriculum in locked/source order, its supporting hero/resource/mantra/disclaimer blocks, `.team`-only compliance boundary, current scheduler authorities, and current participant-content route. Added a human-readable inventory plus six source-backed QA checks. | Stage 0–10 lifecycle/personalization/completion architecture remains `planned_not_current_runtime`. Attendance/completion authorities remain null. Spanish, curriculum version/session binding, host-delivery evidence, and evidenced route authentication remain absent; `TeamShell` is presently layout-only. |
| 2026-07-13 | P2 Steve-tailored training and Launch Center guidance | Codex | P2-118 implementation is verified but remains unchecked pending its authority/merge gate. Added a fail-closed `steve_guidance.v1` projection to the existing authenticated Launch Center response and a responsive self-facing guidance panel. It preserves the stored Steve recommendation order, allowlists internal links, filters unsafe copy, and does not change curriculum, access, completion, or the canonical next action. Verification passed: focused projector/component tests (7), full server suite (2,040 passed / 19 skipped), full team suite (62 passed), repo typecheck, production build, and actual-component visual QA at desktop and a device-emulated 390px viewport with no horizontal overflow. | ACR-0021 is Proposed and requires Kevin approval before this branch may merge or item 118 may be checked. The projection is read-only and non-persistent; it does not activate Context Manager, Michael runtime profile consumption, scoring, ranking, classification, qualification, prediction, comparison, or approved-knowledge status. P2-141 still owns the broader Steve-profile privacy review. |
| 2026-07-13 | P2 Steve extraction prompt registry reconciliation | Codex | Reopened P2-120 after post-merge verification of PR #305 found that active `extractionSystem()` LLM behavior was absent from the current template registry while `steve_success_profile` points only to deterministic assembly. Prepared `steve_success_profile_extraction@1.0.0` as a planned, fail-closed registry record; separated extraction from assembly in the playbook; strengthened registry/playbook tests; and preserved the existing runtime unchanged. | ACR-0022 is Proposed. Kevin approval is required before the extraction record may become active, P2-120 may be checked again, or this reconciliation may merge. Existing base-prompt drift (36/11 locked target versus 17/7 current source and a stale phone-call literal) remains explicit and is not silently changed here. |
