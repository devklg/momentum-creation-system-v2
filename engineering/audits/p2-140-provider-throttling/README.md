# P2-140 VM/RVM provider throttling

Date: 2026-07-16

## Scope

P2-140 adds a process-local, provider-aware scheduling boundary to the existing
provider-independent VM/RVM delivery queue. Live-capable provider dispatches
retain the existing operator-configured global fixed-gap ceiling and also use
provider-keyed fixed-gap, concurrency-one, and cooldown state. Dry runs and
manual CSV exports bypass the external-dispatch scheduler.

Provider adapters translate mocked HTTP 429 responses into a stable,
content-free `provider_rate_limited` error. Numeric and HTTP-date
`Retry-After` values are parsed and bounded to fifteen minutes. The worker
applies that provider-only cooldown and requeues the affected delivery without
burning an attempt. Jobs already claimed behind an active cooldown are
immediately requeued instead of sleeping while holding a processing lease.

## Safety boundary

- No provider was added, selected, activated, or called live.
- `VM_LIVE_DELIVERY_ENABLED` remains false by default, and campaign-level
  approval remains a second required live-delivery gate.
- The existing global rate remains the outer ceiling; provider buckets cannot
  widen aggregate dispatch rate.
- Provider concurrency is one. The delivery worker remains sequential.
- Cooldown and rate state are intentionally process-local and reset on process
  restart. This is not a distributed or production-quota coordination claim.
- No upstream response body, phone, token URL, request payload, or credential
  is persisted in throttle errors or cooldown diagnostics.
- No queue schema, provider catalog/selectability, webhook behavior, quiet-hour
  policy, production quota, live index/constraint, or external communication
  changed.

ACR-002 remains Proposed and continues to block live delivery expansion,
vendor-specific quota policy, durable/distributed rate coordination, and
production validation.

## Verification

- Pure throttle tests cover the global outer ceiling, provider-keyed cooldown
  isolation, concurrency release, bounded cooldowns, and content-free status.
- Retry metadata tests cover delta-seconds, HTTP-date, malformed, past, zero,
  and oversized `Retry-After` values.
- Worker integration tests use a mocked 429 to prove provider-only cooldown,
  no second provider call during cooldown, exact requeue time, and attempt
  preservation.
- Existing VM/RVM campaign, do-not-drop, live-transfer, provider-registry,
  queue, webhook/idempotency, compliance, and route-access tests remain in the
  full server gate.
- This slice changes server-only scheduling and transport error metadata. It
  has no UI surface, so visual QA is not applicable.
