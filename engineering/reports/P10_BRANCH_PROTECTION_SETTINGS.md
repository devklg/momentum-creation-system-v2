# P10 — Branch Protection Settings (in-repo record)

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Resolves (docs half of):** release-checklist blocker **B2** / finding **H5** (P10.1).
**Purpose:** Make the branch-protection state **auditable from inside the repo**. Branch protection lives in the GitHub UI and cannot be read from the working tree; H5's core gap was that nothing in-repo proved it was enabled. This file is that proof-of-record, sourced from the repo owner.
**Author:** Claude Code (Instance 2), Phase 10 worktree.
**Date:** 2026-06-30.

---

## 1. Owner-confirmed state

**Kevin (repo owner) confirmed on 2026-06-30:** branch protection is configured on `main` with the **CI `gates` status check required**. This is the check produced by the `gates` job in `.github/workflows/ci.yml` (build:shared → typecheck → build → server test). Enforcement therefore **is** active — resolving the "unverifiable / pending" state the audit reported.

| Protection | State | Source |
|---|---|---|
| Require status check `gates` to pass before merge | ✅ enabled | owner-confirmed 2026-06-30 |
| Require pull request before merging (no direct pushes) | ❓ confirm | not yet reported |
| Require branches up to date before merging | ❓ confirm | not yet reported |
| Block force-push to `main` | ❓ confirm | not yet reported |
| Block deletion of `main` | ❓ confirm | not yet reported |
| Require linear history | ❓ optional | — |
| `CODEOWNERS` review routing | ❌ not present | no `CODEOWNERS` in repo |

> The ❓ rows are recommended companions to a required status check; a required check alone still leaves `main` open to direct pushes / force-pushes unless those are also blocked. Confirm and update this table.

---

## 2. Known gotcha (carry forward)

Branch protection pins the **exact check-name string** `gates`. If the CI job is renamed, the required check silently vacates and the gate stops enforcing. Keep the job name `gates` stable in `ci.yml` (`.github/workflows/ci.yml`), or update the protection rule in lockstep with any rename.

---

## 3. Follow-ons (unchanged from the checklist)

- [ ] Confirm the ❓ rows above and update this record.
- [ ] (Optional, gated) Add a `CODEOWNERS` file to route mandatory review; extend the pre-push hook to include server tests (it currently runs typecheck + build only). Propose in an isolated PR.
- [ ] Governance: changes flow through the ACR process + decision ledger (`ROADMAP.md:192`).

---

## 4. Standing-prohibition note

Documentation record only — no code, CI, or settings changed by this file. It records an owner-reported fact so the repo's declared protection state is auditable.
