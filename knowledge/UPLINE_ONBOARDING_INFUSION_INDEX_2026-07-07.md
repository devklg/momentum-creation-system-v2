# INDEX — Upline Onboarding Infusion

Date: 2026-07-07

Session scope: rlegacymakers.com analysis → ACR-0011 (proposed, ratified same day) → upline document corpus captured, ingested, committed, merged.

## Keywords

upline-onboarding-infusion · ACR-0011 · 5-point-system · legacy-makers · rlegacymakers.com · PMV · prospect-momentum-viewer · launch-center · CRM · QBA · CORE-3 · names-list · tranches-of-20 · 100-names · stall-threshold · sponsor-attestation · recruiting-cycle · steve · michael · ivory · why-replay · duplication · knowledge-base · seed-upline-knowledge · upline-reference · scripts · tracker-forms · DMO · team-magnificent · MCS-v2 · multi-agent-lane-orchestration · lane-pattern · opus-4.8 · codex · git-worktrees · env-inheritance

## Governance artifacts (repo, merged to main)

| Artifact | Path | State |
| --- | --- | --- |
| ACR-0011 — 5 Point Recruiting Cycle (Launch Center + CRM Integration) | organization/ACR-0011-five-point-recruiting-cycle.md | Approved, ratified by Kevin 2026-07-07 |
| ACR Register row | organization/ACR-REGISTER.md | ACR-0011 → Approved, v1.2 |
| Decision record | organization/DECISION_upline_onboarding_infusion.md | Recorded |
| Link inventory (34 source URLs + context links) | knowledge/upline-legacy-makers-link-inventory.md | Committed |
| Upline document corpus (33 files: 31 PDF, 2 DOCX) | knowledge/upline-legacy-makers/ | Committed |
| KB seeder | server/scripts/seed-upline-knowledge-base.ts (pnpm run seed:upline-knowledge) | Committed, idempotent |

## Skill memorial (appended 2026-07-07)

**Multi-Agent Lane Orchestration** — skill extracted from this session's ACR-0011 implementation run and memorialized as `skill_multi_agent_lane_orchestration_2026_07_07` (triple-stack: momentum.decisions, Neo4j (:Skill)-[:EXTRACTED_FROM]->(:Decision), Chroma mcs_organizational_knowledge_en). Source: `D:/claude-learning/skills/multi-agent-lane-orchestration/SKILL.md`; packaged `.skill` delivered for claude.ai profile install. Encodes the lane pattern (Lane 0 shared foundation merges first; worktree per lane; detached headless Opus 4.8 / Codex launches; orchestrator-only merges after gates) and the environment scars: gateway $env interpolation leak, inherited ANTHROPIC_* and MONGODB_URI/NEO4J_URI env poisoning (dotenv never overrides), stale-log trap, connector flapping recovery.

## Git

- PR #140 — infusion (39 files) — gates PASS — merge 9472ec5
- PR #141 — ratification (3 files) — gates PASS — merge dcc26dd

## Knowledge base ingestion (2026-07-07)

33 sources / 198 chunks via the approved-knowledge pipeline. Mongo filter: `mcs_knowledge_sources` where `authorityRef` starts with `upline-legacy-makers:`. All tagged `upline-reference`; scripts scoped to michael_magnificent + ivory, onboarding docs to steve_success + michael_magnificent, trackers/DMO to michael_magnificent.

## Triple-stack records (v2 stack: Mongo 30000 / Neo4j 7710 / Chroma 8200)

- Mongo: momentum.decisions → decision_upline_onboarding_infusion_2026_07_07 (acr_status: approved)
- Neo4j: (:Decision {decision_id})-[:PRODUCED]->(:ACR {acr_id: 'ACR-0011', status: 'approved', ratified_at: '2026-07-07'})
- Chroma: mcs_organizational_knowledge_en → id decision_upline_onboarding_infusion_2026_07_07 (GPU-embedded, verified)

## Locked parameters (Kevin, 2026-07-07)

100 names in tranches of 20 (PMV prospect records at Identified) · PMV + CRM only, lead-qual system excluded · stall = 24h inside 72h QBA window / 72h after · QBA + CORE 3 by manual sponsor attestation · milestones in Michael's supportive framing.

## Open items

1. Virtual Launch Script (Google Drive) — direct download returned the Launch Invite PDF (hash-identical); real file needs manual fetch, then add to seeder ITEMS and re-run.
2. Gateway conversation-memory capture / memory_capture actions return 404 (auto-harvester itself is healthy).
3. Upline pages not link-crawled: smartship-loyalty-rewards, set-up-your-iii-wallet, s-projects-basic, about-3, healthcare-professionals tool tiles.
4. ACR-0011 implementation unscheduled — slots after/alongside S2.2 at Kevin's call.
