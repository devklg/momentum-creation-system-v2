# P6.10 — Steve Runtime Route and UI Verification

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.10 — Steve Runtime Route and UI
- **Status:** VERIFICATION — code **DONE-ON-MAIN**; this report verifies conformance
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a`
- **Date:** 2026-07-01
- **Depends on:** P6.8, P6.9; `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)

---

## 1. Route surface — `server/src/routes/steve.ts` (mounted `/api/steve`)

| Method + path | Auth | Purpose |
|---|---|---|
| `GET /discovery/state` | `requireAuth` | BA self-read of own discovery view. |
| `GET /discovery/script` | `requireAuth` | Read-only discovery backbone (sections). |
| `GET /discovery/system-prompt?baId=` | `STEVE_WORKER_SECRET` (503 if unset, 401 if bad) | Worker→server: resolved Steve system prompt string. |
| `POST /discovery/ingest` | `STEVE_WORKER_SECRET` | Worker→server: persist completed artifact (triple-stacked). |
| `GET /discovery/profile/:downlineBaId` | `requireAuth` + `requireSteveComplete` | Sponsor-only downline profile card. |

**Mount placement (verified in `server/src/index.ts`):** `app.use('/api/steve',
steveRoutes)` sits in the **pre-gate** block (a new BA opens the gate *via* Steve, so
the route family must not itself require `requireSteveComplete`). The sponsor-only
profile read applies `requireSteveComplete` **internally**, per-route — matching the
documented canonical pattern.

## 2. Worker-secret guard (safe-by-default)

`requireSteveWorker()` returns **503** when `STEVE_WORKER_SECRET` is unset (dev) —
it does **not** allow anonymous artifact writes — and **401** on a mismatched
`x-steve-worker-secret` header. Same posture as `requireMichaelWorker`.

## 3. Persistence path — direct seam + read-back (verified)

`ingestDiscoveryArtifact()`:
1. Looks up the BA (`getBaSponsor`) → throws `NO_BA` (400) if absent.
2. Assembles the Success Profile (pure copy) and **server-stamps `sponsorBaId`**.
3. Defensively truncates transcript/answers to 5000 chars.
4. Upserts by branching on existence (Mongo `update` does not honor `upsert`):
   - existing → Mongo `update` + Neo4j `cypher`;
   - new → `ensureDiscoveriesCollection()` then `tripleStackWrite({ mongo, neo4j, chroma })`.
5. **Read-back:** re-queries Mongo; throws `READBACK_FAILED` if the row/`_id` is absent.

Stores: Mongo `momentum.steve_discoveries`; Neo4j labels `:SteveDiscovery` with
`HAD_STEVE_DISCOVERY` / `VISIBLE_TO_SPONSOR` (independent of Michael); Chroma
`mcs_steve_discoveries` (created existence-first by `ensureDiscoveriesCollection`).
`tripleStackWrite → gatewayCall` executes through the **direct adapters** (`isDirect`
→ `mongoAdapter`/`neo4jAdapter`/`chromaAdapter`), satisfying ACR-0007.

## 4. Sponsor-only authorization (verified)

`getProfileCardForSponsor()` enforces server-side that
`requestingBaId === downline.sponsorBaId`, else `NOT_SPONSOR` (403). Missing artifact
→ `NO_ARTIFACT` (404); missing `completedAt` → `NO_COMPLETED_AT`. The BA's downline
cannot be read by anyone but the direct sponsor.

## 5. UI — `apps/team/src/routes/steve-success-interview.tsx`

Team-app route rendering the Steve discovery surface; builds green under `pnpm build`
(`apps/team` build Done). BA-facing only; no `.com` exposure. (Detailed UI state
walkthrough deferred to manual verification; the build + typecheck gates pass.)

## 6. Compliance & prohibition conformance

- No income/placement language in route responses or system prompt; Layer-1 only.
- No scoring/ranking anywhere; profile is verbatim BA words.
- No LLM call from the server; no in-app voice/call-control (worker is external).
- Audit breadcrumb on ingest: `console.log('[audit] steve_discovery_ingested …')`.

## 7. Gate evidence

`pnpm typecheck` ✅, `pnpm build` ✅ (team included), `pnpm --filter @momentum/server
test` ✅ (102 files / 1260 tests) — including
`__tests__/steveSuccessAdapter.test.ts`.

## 8. Recommendation

Record P6.10 as **DONE-ON-MAIN & VERIFIED**. No route or UI changes required.
