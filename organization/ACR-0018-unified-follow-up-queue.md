# ACR-0018 — Unified Human Follow-up Queue

**Status:** APPROVED / VERIFIED — Kevin L. Gardner, 2026-07-13
**Audit authority:** `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-107
**Depends on:** ACR-0016
**Risk:** Low — additive, owner-scoped read contract and BA-facing projection

## Approval

Kevin directed Codex to continue with implementation priority immediately after
the ACR-0017 detour. P2-107 is the first unchecked audit item and names this
exact bounded change.

## Decision

Provide one authenticated BA queue that reads the existing canonical callback
and CRM reminder collections across both prospect and VM/RVM identities.

The queue:

- includes prospect callback requests and VM/RVM inbound callback requests;
- includes active prospect reminders, including reminders connected from
  explicit Event Center attendance through ACR-0016;
- includes active VM/RVM lead reminders;
- collapses duplicate callback/reminder evidence for the same entity;
- orders raised hands, overdue reminders, then upcoming reminders;
- links the BA to the owning human workspace; and
- remains read-only and explicitly manual-contact-only.

## Boundaries

- No call, SMS, email, draft, disposition, classification, or score is created.
- Ownership comes only from the authenticated BA session.
- No prospect-facing output changes.
- No new persistent collection or lifecycle state is introduced.
- VM entitlement continues to guard the VM workspace itself.

## Contract

- `GET /api/cockpit/follow-up-queue`
- additive `McsUnifiedFollowUpQueueResponse`
- source labels distinguish `prospect_crm` from `vm_rvm`
- statuses are factual: `raised_hand`, `overdue`, or `upcoming`

## Rollback

Remove the additive endpoint and cockpit component. Existing callback, CRM,
Event Center, PMV, and VM/RVM records and workflows remain unchanged.

## Verification

- Domain tests for cross-source merging, deduplication, ordering, ownership,
  and orphan handling.
- Team/server/shared typecheck and repository build.
- Cockpit visual verification.
- Full server suite and GitHub merge gates.

Local verification passed with 1,997 server tests, 56 team tests, repo-wide
typecheck, test typecheck, and production build. The in-app browser connection
was not trusted, so automated screenshot inspection was unavailable; populated,
empty, unavailable, prospect-click, and VM-click render states are covered by
the component suite. GitHub gates remain the publication gate.
