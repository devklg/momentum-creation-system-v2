# P2-139 provider-independent VM/RVM queue

Date: 2026-07-16

## Scope

The durable VM/RVM queue was already provider-independent before this audit:
`tmag_vm_queue_jobs` stores generic lifecycle jobs, and the delivery worker
resolves a provider adapter only when a delivery job is dispatched. P2-139
reconciles and hardens that existing seam rather than creating a second queue.

This slice adds one authoritative shared provider catalog that distinguishes
registered adapters, campaign-selectable adapters, registered-but-dormant
adapters, planned identities, and unavailable identities. Campaign creation
and the Team selector now expose only the two previously accepted campaign
providers. Unsupported providers are rejected before persistence or queueing,
and dispatch validates malformed durable data before provider-tagged events or
campaign terminal/requeue branches.

## Safety boundary

- No provider was added or newly activated. The acquisition placeholder remains
  registered but campaign selection is governance-locked.
- `VM_LIVE_DELIVERY_ENABLED` remains false by default.
- Campaign-level admin approval remains a second required live-delivery gate.
- Manual CSV remains external-call-free.
- Dry-run calls to every registered adapter were verified without Telnyx or
  acquisition-provider network activity.
- No queue schema, retry, dead-letter, webhook, raw-body route, rate-limit, or
  throttling behavior changed.
- No production data, provider endpoint, external communication, or live call
  was touched.

P2-140 separately owns provider throttling and rate limits. ACR-002 remains
Proposed and still blocks live-delivery expansion.

## Verification

- Focused provider registry/queue contract tests cover catalog uniqueness,
  selectable resolution, planned/unknown refusal, dry-run isolation, API
  rejection before persistence, and provider-neutral durable payload shape.
- Existing VM/RVM worker, queue, webhook/idempotency, compliance, route-access,
  full server, typecheck, build, and generated-catalog gates are rerun before
  merge.
- The Team selector now consumes the shared catalog and no longer presents
  planned or dormant providers as selectable. Component-level responsive
  visual QA is recorded in
  `engineering/audits/p2-139-visual-qa/README.md`; no authenticated live route
  or provider call is required.
