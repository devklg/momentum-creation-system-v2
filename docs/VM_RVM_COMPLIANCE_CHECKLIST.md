# VM/RVM Compliance Checklist

Status: required before any VM/RVM live delivery expansion.
Created: 2026-07-11.
Related ACR: `constitution/acr/ACR-002-vm-rvm-live-delivery-governance.md`.

Live delivery remains disabled until Kevin approves the ACR, this checklist, provider controls, and campaign-level admin approval.

## Hard Stops

- No AI lead qualification, readiness judgment, lead scoring, prospect ranking, or hidden potential labels.
- No automated prospecting, cold-call automation, auto-send outreach, or agent-owned sending.
- No income claims, earnings projections, commission math, cycle math, spillover promises, placement claims, or urgency pressure.
- No prospect-facing THREE branding, current team headcount, AI-prospecting language, or noncompliant PMV language.
- No Holding Tank placement for imported/contacted/tokenized leads until the existing `video_complete -> placement` rule fires.

## Ownership

- Every lead/prospect must carry server-derived `ownerTmBaId` and `sponsorTmBaId`.
- Client-provided ownership overrides must be rejected.
- Admin ownership correction must be audited with before/after state and reason.
- RVM tokens must preserve original owner/sponsor routing.

## Provider Controls

- Suppression list and opt-out enforcement.
- DNC/compliance flags before send.
- Quiet hours by timezone where applicable.
- Rate limits and backpressure.
- Webhook authentication with `VM_WEBHOOK_SHARED_SECRET` in production.
- Retry controls and idempotency keys.
- Dead-letter visibility for stuck delivery events.
- Audit logs for campaign approval, send attempts, provider callbacks, failures, and opt-outs.

## Copy Controls

- Approved templates only for voicemail, SMS, and email.
- BA/admin review before any live send path.
- Compliance scan before queueing live delivery.
- Ambiguous content escalates instead of sending.
- Copy must remain relational, consent-aware, and educational.

## Runtime And Knowledge Controls

- Agents receive Context Packets only; they do not query MongoDB, Neo4j, Chroma, or GraphRAG directly.
- GraphRAG and Context Manager live flags remain off until canary criteria are written and approved.
- Agent-generated copy remains draft/recommendation unless a human-controlled approved workflow explicitly sends it.

## Verification

- Dry-run proves no external send occurs while `VM_LIVE_DELIVERY_ENABLED=false`.
- Dry-run proves no external send occurs without campaign `adminApprovedForLiveDelivery=true`.
- Fixture RVM tokens resolve to the correct sponsor/owner.
- Compliance scans pass on approved templates.
- Audit/readback exists for campaign approval and delivery events.
- Provider webhook fixtures prove authentication, idempotency, and opt-out handling.

