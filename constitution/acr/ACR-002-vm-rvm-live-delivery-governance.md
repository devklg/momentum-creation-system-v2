# ACR-002 - VM/RVM Live Delivery Governance

Status: Proposed
Risk: High
Change type: integration, compliance boundary, external communications, agent/runtime boundary
Proposed by: Codex, Platform Audit P0 Lane 3
Created: 2026-07-11
Approver: Kevin L. Gardner

## Summary

This ACR proposes the governance envelope required before VM/RVM live delivery can expand beyond dry-run/manual operation.

The VM/RVM module touches external communications, provider integration, prospect acquisition, PMV transition rules, copy compliance, ownership controls, opt-out handling, webhook security, and admin approval gates. Those are ACR triggers under `constitution/MOMENTUM_ACR_SYSTEM.md`.

This ACR does not enable live delivery. It records the decision boundary and required approval conditions.

## Current State

- `VM_PROVIDER_MODE=manual_csv` is the default.
- `VM_LIVE_DELIVERY_ENABLED=false` is the default.
- A campaign must also carry `adminApprovedForLiveDelivery=true` before any live delivery path may run.
- `VM_WEBHOOK_SHARED_SECRET` defaults empty and must be set for production webhook authentication.
- No separate RVM live-delivery flag was found; RVM outbound delivery is governed by VM delivery flags and campaign approval.
- GraphRAG and Context Manager live flags remain off pending canary criteria and approval.

## Constitutional Check

Future-Development Test: pass only if the implementation preserves human authority, compliance, clarity, simplicity, trust, and BA ownership.

Boundaries reviewed:

- No AI lead qualification.
- No automated prospecting or agent-owned sending.
- No income claims, cycle math, spillover promises, or placement claims in prospect-facing copy.
- PMV language remains People -> Momentum -> Volume -> Checks where applicable.
- Holding Tank placement remains earned only by `video_complete`.
- Sponsor and owner are server-derived and immutable except for audited admin correction.
- Kevin approval is required before high-risk live external communications expand.

## Approval Conditions

Before this ACR can move from Proposed to Approved:

1. Kevin approves VM/RVM live-delivery governance.
2. `docs/VM_RVM_COMPLIANCE_CHECKLIST.md` is reviewed and accepted.
3. Provider controls are documented and tested: suppression list, opt-out, quiet hours, rate limits, webhook authentication, retry/idempotency, dead letters, and audit records.
4. Copy controls are documented and tested: approved templates only, compliance scan, human/admin review before sending, and no prospect-facing forbidden language.
5. Dry-run verification proves no external send occurs when live flags or campaign approval are absent.
6. Fixture RVM tokens are smoke-tested without Holding Tank placement before `video_complete`.
7. Audit/readback exists for campaign approval and delivery events.

## Implementation Conditions

If approved, implementation must keep:

- `VM_LIVE_DELIVERY_ENABLED=false` as the safe default.
- Campaign-level `adminApprovedForLiveDelivery` as a second required gate.
- Provider secrets absent from tracked files.
- External delivery disabled in tests unless explicitly mocked.
- Admin approval events audited.
- Webhook and delivery events idempotent.

## Rollback

Rollback target: `VM_LIVE_DELIVERY_ENABLED=false` and campaign `adminApprovedForLiveDelivery=false`.

Rollback action: disable live env flag, revoke provider credentials if needed, pause delivery workers, and keep existing CRM/token records for audit.

## Decision Ledger

No decision-ledger entry is active yet. Create a decision-ledger record only after Kevin approves this ACR.

