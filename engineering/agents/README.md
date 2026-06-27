# Engineering Agent Workflow

Momentum Creation System V2 architecture is frozen at v1.0. Engineering agents operate inside the freeze discipline: audit first, plan second, implement only after Kevin approves a sprint.

## Agent Roles

- Lead Engineering Agent: owns workflow sequencing, folder structure, prompt stewardship, audit orchestration, integration planning, blockers, and final reporting.
- Repository Analysis Agent: maps repository structure, package scripts, source boundaries, existing implementation state, and stale-worktree risk.
- Backend Alignment Agent: audits server, domain, route, persistence, event, and worker alignment against frozen runtime architecture.
- Frontend Alignment Agent: audits apps/com, apps/team, and apps/admin for surface completeness, routing, UX boundaries, and compliance constraints.
- Knowledge Platform Alignment Agent: audits knowledge, memory, GraphRAG, persistence, ingestion, and triple-stack alignment.
- Agent Runtime Alignment Agent: audits agent registry, event model, browser/voice runtime, context manager, and learning pipeline alignment.
- QA/Test Alignment Agent: audits verification coverage, typecheck/build scripts, acceptance criteria, smoke paths, and release confidence.
- Documentation Alignment Agent: audits docs, reports, ACR status, architecture freeze compliance, and stale or conflicting documentation.
- Integration Planning Agent: reads all audit reports and creates the master implementation plan plus Sprint 1 plan.

## Branch Naming

- Default feature branches use the `codex/` prefix.
- Audit and planning branches should describe the workflow, for example `codex/engineering-audit-plan`.
- Implementation branches are created only after Kevin approves a sprint.

## Audit-Only Rule

During the audit phase agents must not write production code, alter runtime behavior, edit ratified architecture documents, or apply proposed ACRs. Agents may create audit reports, planning documents, and workflow scaffolding under `engineering/`.

## Report Outputs

- Specialist audit reports go in `engineering/audits/`.
- Integrated implementation plans go in `engineering/plans/`.
- Sprint plans go in `engineering/sprints/`.
- Cross-cutting summaries and status reports go in `engineering/reports/`.

Each audit report must include scope, sources read, findings, gaps, blockers, implementation risks, and recommended sequencing.

## Lead Engineering Responsibilities

- Preserve the v1.0 architecture freeze.
- Run agents in the required order.
- Ensure no production code is written during audit.
- Ensure each report names evidence from repository files.
- Reconcile specialist reports into one implementation plan.
- Identify blockers and approval gates.
- Stop before Sprint 1 implementation.

## Claude Governance Audit Step

Before implementation begins, Claude as Chief Governance Architect must review the audit package and implementation plan for freeze compliance, proposed ACR separation, and architectural drift.

## Kevin Approval Step

Kevin approves the master plan and Sprint 1 before any implementation branch begins. Approval must be explicit. Until then, the only permitted outputs are scaffolding, audits, reports, and plans.
