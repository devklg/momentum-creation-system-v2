# P6.4 — Ivory Runtime Route Verification

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.4 — Ivory Runtime Route
- **Status:** VERIFICATION — code **DONE-ON-MAIN**; this report verifies conformance
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a`
- **Date:** 2026-07-01
- **Depends on:** P6.2, P6.3; `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)

> **Scope clarification.** "Ivory Runtime Route" here is the **shipped Ivory
> invitation / warm-market agent** (`server/src/routes/ivory.ts`, Chat #131 — the
> Prospect Momentum Agent), which the implementation prompt explicitly maps to P6.4
> ("server/src/routes/ivory.ts … covers P6.4 — VERIFY, don't recreate"). This is
> **distinct** from the P6.3 `ivory_response_contract.v1` / catalog runtime, which
> P6.3 declares **spec-only, not implemented** (a future gated slice). This report
> verifies the invitation route; it does not build the P6.3 response runtime.

---

## 1. Route surface — `server/src/routes/ivory.ts` (mounted `/api/ivory`)

**Every** endpoint applies `(requireAuth, requireSteveComplete)`; `baId` is read from
`req.session.baId` only — never from body or URL.

| Method + path | Purpose |
|---|---|
| `GET /` | List the BA's warm-market roster. |
| `POST /` | Create an Ivory name. |
| `PATCH /:ivoryId` | Edit name/notes/categories/preferredAngle. |
| `PATCH /:ivoryId/status` | Change disposition (new/invited/customer/ba/not_interested/follow_up). |
| `DELETE /:ivoryId` | Remove a roster record. |
| `POST /coach` | WDYK coaching prompts (LLM, degradable). |
| `POST /invitation-agent/draft` | Draft a warm invitation message (LLM, degradable). |
| `POST /invitation-agent/mint` | Mint the invitation via the existing spine (`source='ivory'`). |
| `POST /generator/run` + `GET /generator/run/:runId` + `POST …/invite` | Generator run lifecycle. |
| `GET /momentum` + `POST /momentum/:prospectId/suggest` | Post-mint momentum view + follow-up suggestion (LLM, degradable). |

## 2. Ownership & sponsor immutability (verified)

- `baId` from session only; not accepted from body/params on any route.
- **`sponsorBaId` is never accepted from the body.** Minting flows through
  `createInvitation()`, which derives sponsor from the token/session spine (spec 3.5).
- Every domain function re-checks ownership (`getIvoryName` throws
  `IvoryOwnershipError` on `baId` mismatch; `assertProspectOwnership` checks
  `sponsorBaId`).

## 3. Persistence (triple-stack, direct seam)

- `createIvoryName` triple-stacks: Mongo `momentum.ivory_names`, Neo4j
  `(:BA)-[:KNOWS]->(:IvoryName)`, Chroma `mcs_ivory`.
- `markIvoryInvited` adds `(:IvoryName)-[:INVITED_AS]->(:Prospect)`.
- `deleteIvoryName` DETACH-DELETEs the node; Chroma history is intentionally left.
- Executes through the direct adapters (`gatewayCall`→`isDirect`→
  `mongoAdapter`/`neo4jAdapter`/`chromaAdapter`), satisfying ACR-0007.

**Conformance gap (honest note):** unlike Steve's `ingestDiscoveryArtifact`, the Ivory
domain performs **no post-write read-back**. Writes are assumed atomic and gateway
errors propagate. This is not a prohibition violation, but it is a **discipline
asymmetry** vs Steve worth recording. *Recommendation:* optional future hardening to
add read-back on `createIvoryName`, matching Steve — **not** in scope for this
documentation worktree.

## 4. LLM usage — pre-existing, wired-dormant, compliance-guarded (honest disclosure)

**Ivory is not a no-LLM surface.** `ivoryCoach`, `draftIvoryInvitation`, and
`suggestIvoryMomentumFollowUp` call Anthropic (`services/anthropic.js`). This is
**pre-existing** behavior from Chat #131, predating Phase 6. Safeguards:

- **Wired-dormant:** with `ANTHROPIC_API_KEY` unset (dev default), each path throws
  `AnthropicConfigError` and **degrades to a deterministic neutral fallback** with
  `degraded: true`. The surface works before the key lands.
- **Immovable compliance prefixes** (`COACH_SYSTEM_PREFIX`,
  `INVITATION_DRAFT_SYSTEM`, `SUGGEST_SYSTEM_PREFIX`): the system prompt forbids
  naming a specific person, scoring/ranking/rating anyone, income/earnings/
  commissions/cycles/ranks/placement/spillover language, medical/weight-loss claims,
  scarcity/urgency/FOMO/guilt, and "the system will send/call/follow up for you."

**Reconciliation with the standing "No LLM calls / No dynamic generation"
prohibitions:** those prohibitions govern **what this Phase 6 worktree may add or
activate** — and this worktree adds **zero** LLM calls and activates nothing. They are
not a claim that the pre-existing Ivory surface is LLM-free. Ivory's LLM drafting was
shipped and reconciled in prior phases; it remains BA-facing, dormant in dev, and
compliance-guarded. Flagged for Kevin's awareness; no change made.

## 5. Signal-priority ordering ≠ person scoring (verified nuance)

`ivory-momentum.ts` defines `PRIORITY_RANK` over **lifecycle signals**
(`callback_raised` … `expired_consider_reinvite`) to order a top-12 focus queue by
signal recency/type. The module header (line 20) and the LLM guard (line 367)
**explicitly forbid scoring/ranking the prospect as a person**. This ordering is a
UI focus aid over signals, not prospect qualification. Recorded as conformant with
the "no scoring/ranking/qualification of people" prohibition; flagged so Kevin can
confirm the framing is acceptable.

## 6. Compliance — never on `.com`

Ivory is `apps/team` + `/api/ivory` only. No prospect-facing exposure; no `.com`
branding, income, placement, or head-count leakage in any route response.

## 7. Gate evidence

`pnpm typecheck` ✅, `pnpm build` ✅, `pnpm --filter @momentum/server test` ✅
(102 files / 1260 tests).

## 8. Recommendation

Record P6.4 as **DONE-ON-MAIN & VERIFIED**, with two flagged, non-blocking items for
Kevin: (a) optional read-back parity with Steve; (b) confirm the signal-priority
ordering framing. No route changes made.
