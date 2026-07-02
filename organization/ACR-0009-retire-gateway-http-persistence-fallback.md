# ACR-0009 — Retire the Gateway HTTP Persistence Fallback; Direct-Only Runtime Dispatch

## Momentum Creation System V2

Status: Approved

Type: Persistence Pattern (completes ACR-0007 — removes the transitional fallback)

Risk: Critical (persistence-pattern change; QA boundary-contract change) — approval authority is Kevin

Approval: APPROVED by Kevin L. Gardner — 2026-07-01 (direct instruction in session: “the whole gateway needs to be taken care of now — there is no gateway as persistence”)

---

## Purpose

Complete ACR-0007. The S1.3 migration (Option C) deliberately preserved a Gateway HTTP fallback path inside `server/src/services/gateway.ts` (POST to the Gateway `/execute` endpoint) so the direct cutover was reversible per store. All three stores have been in verified direct mode against the dedicated governed stack (Mongo :30000 · Neo4j :7710 · Chroma :8200) since the S1.3 closeout. This ACR removes the fallback entirely: the runtime can no longer reach the Universal Gateway under any configuration. The Gateway V2 (localhost:2526) remains what ACR-0007 defined — an MCP developer tool for AI agents (a token-saving interface for Claude Desktop / Claude Code / Codex), never a runtime dependency.

## Changes

### Code (branch `refactor/acr-0009-retire-gateway-persistence`)

1. `server/src/services/gateway.ts` — HTTP fallback deleted (undici import, `GATEWAY_URL` fetch, `GatewayResponse` envelope). `gatewayCall` now dispatches ONLY to the direct adapters. A non-persistence tool, or a store whose mode is not `direct`, throws `GatewayError` LOUD at dispatch — no silent fallback of any kind. Exported names `gatewayCall`/`GatewayError` preserved so the ~405 call sites and their error guards stay unchanged (rename to `persistenceCall`/`PersistenceError` tracked for Phase 11).
2. `server/src/env.ts` — `GATEWAY_URL` removed from the schema. Persistence defaults flipped to the governed stack and direct mode: `MONGODB_URI` :30000, `NEO4J_URI` :7710, `CHROMA_URL` :8200, all `PERSISTENCE_*_MODE=direct`, `PERSISTENCE_DIRECT_ENABLED=true`. A fresh environment now defaults to the ratified architecture; `PERSISTENCE_DIRECT_ENABLED=false` acts as a loud kill switch, not a re-route.
3. `server/src/routes/health.ts` — the misleading `/api/health/gateway` probe (which in direct mode reported direct-Mongo health labeled “gateway”) replaced by `/api/health/persistence`, backed by the previously unmounted `directPersistenceHealth()` — per-leg store health + mode snapshot + GPU-embedder check (first slice of finding H7).
4. Stale gateway-era comments reconciled: `tripleStack.ts`, `services/persistence/flags.ts`, `gatewayLatency.ts`, `chromaCollections.ts`, `index.ts`. `chromaCollections.ts` boot-created collection metadata stamp corrected `momentum_creation_system_v1` → `_v2`.

### QA boundary contracts (same branch)

5. `qa/__tests__/staticBoundary.test.ts` — the “preserves the Gateway HTTP fallback” contract inverted: now asserts the fallback is ABSENT (`env.GATEWAY_URL` and the undici import must not appear in `gateway.ts`).
6. 14 orchestration governance-boundary tests — `toContain('/execute')` / `toContain('GATEWAY_URL')` flipped to `not.toContain(…)`; test titles updated to “verifies the Gateway HTTP fallback stays retired (ACR-0009)”.
7. `services/__tests__/gatewayDispatch.test.ts` — rewritten direct-only: per-store adapter dispatch, non-persistence tool refusal, loud failure on non-direct mode and on master-flag-off, `GatewayError` wrapping contract, caller-contract preservation.

## Verification

- `pnpm --filter @momentum/server typecheck` — clean (exit 0).
- `pnpm --filter @momentum/server test` — 114 files, 1,334 tests, all passing (2026-07-01).
- Live config verified before the change: `.env` already ran all three legs direct against 30000/7710/8200 — this ACR removes dead code and a misleading default, it does not change the operating persistence path.

## Rollback

`rollback_to`: main @ `7071c6a` (pre-branch). The fallback’s removal is reversible by reverting the branch; no data migration is involved — this change is code-path-only.

## Follow-ups (Phase 11)

- ~~Repo-wide rename `gatewayCall` → `persistenceCall`~~ ✅ **EXECUTED 2026-07-02** — Codex slice merged to `main` (`86c390a`): `services/gateway.ts` → `services/persistence/dispatch.ts`, `gatewayLatency.ts` → `persistenceLatency.ts`, dispatch test renamed, `UNIVERSAL_GATEWAY_V2_STANDARD.md` → `EXTERNAL_MCP_TOOLING_STANDARD.md`; boundary tests repointed; gates green (1,334). ACR-0009 is now FULLY executed.
- Rename shared-type fields `gatewayLatencyMsP50/P95` (append-only shared types — needs its own slice).
- Wire `/api/health/persistence` into a real readiness probe + alert sink (H7).

## Approval

APPROVED — Kevin L. Gardner, 2026-07-01 (sole and final Constitutional Authority). Executed by Claude (chat session, Universal Gateway MCP tooling — used as developer tooling, exactly per this ACR). Kevin merges.
