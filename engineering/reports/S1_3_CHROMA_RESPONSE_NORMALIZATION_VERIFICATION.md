# S1.3 Chroma Response Normalization Verification

Date: 2026-06-27
Scope: Sprint 1 S1.3 Chroma direct adapter response-shape normalization only.

Chroma runtime cutover was not approved or performed.

Current approved runtime state:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=gateway
```

MongoDB remains on the verified direct Mongoose adapter path. Neo4j remains on the verified direct `neo4j-driver` adapter path. ChromaDB remains on the Gateway path.

## Changes Made

- Updated `server/src/services/persistence/chroma/adapter.ts` so direct `search` returns the Gateway-compatible caller-facing shape:
  - `collection`
  - `query`
  - `n_results`
  - `results.ids`
  - `results.documents`
  - `results.metadatas`
  - `results.distances`
- Updated direct `query_with_filter` to return the same Gateway-compatible shape, without the `query` wrapper field, matching the observed Gateway caller-facing response.
- Preserved GPU embedder usage.
- Preserved no CPU fallback behavior.
- Added focused Chroma adapter tests for direct `search` and `query_with_filter` normalization.

No caller sites were rewritten. No domain logic, route logic, frontend surfaces, ratified documents, or `.com` prospect-facing surfaces were modified.

## Commands Run

```powershell
git status -sb
Select-String -Path .env -Pattern '^(PERSISTENCE_DIRECT_ENABLED|PERSISTENCE_MONGO_MODE|PERSISTENCE_NEO4J_MODE|PERSISTENCE_CHROMA_MODE)=' -ErrorAction SilentlyContinue
pnpm --filter @momentum/server test
pnpm --filter @momentum/server typecheck
pnpm typecheck
& .\server\node_modules\.bin\tsx.CMD .logs/s1_3_chroma_response_normalization_verification.ts | Tee-Object -FilePath .logs/s1_3_chroma_response_normalization_verification.json
pnpm build
```

## Verification Results

Unit/compile gates:

```text
pnpm --filter @momentum/server test      PASS, 16 files / 32 tests
pnpm --filter @momentum/server typecheck PASS
pnpm typecheck                           PASS
pnpm build                               PASS
```

`pnpm build` emitted existing Vite warnings only:

- `apps/com`: dynamic/static import chunk warning for `apps/com/src/lib/api.ts`.
- `apps/team`: chunk size warning over 500 kB.

Live verification run:

```text
runId: s13chroma_1782602704119
pass: 10
limited: 0
fail: 0
```

| Check | Result | Notes |
|---|---:|---|
| Approved runtime flags preserved | PASS | MongoDB direct, Neo4j direct, Chroma gateway. |
| Chroma direct add remains functional | PASS | Direct add returned `{ ok: true, count: 1 }`. |
| Chroma direct search returns Gateway-compatible caller-facing shape | PASS | Returned `collection`, `query`, `n_results`, and flat `results.*` arrays. |
| Chroma direct query_with_filter returns Gateway-compatible caller-facing shape | PASS | Returned `collection`, `n_results`, and flat `results.*` arrays. |
| GPU embedder remains required | PASS | Live embed returned one 384-dimensional vector. |
| No CPU fallback exists | PASS | Invalid embedder URL failed loudly with no CPU fallback behavior. |
| Mongo remains direct | PASS | Runtime `gatewayCall('mongodb','insert',...)` returned direct adapter shape without Gateway wrapper metadata. |
| Neo4j remains direct | PASS | Runtime `gatewayCall('neo4j','cypher',...)` returned direct adapter shape without Gateway `queryType`. |
| Chroma remains on Gateway path during normalization work | PASS | Runtime `gatewayCall('chromadb','list_collections',...)` returned Gateway collection shape. |
| No caller sites rewritten | PASS | Runtime callers continue to use `gatewayCall(tool, action, params)`. |

## Runtime Cutover Confirmation

Chroma direct runtime cutover has not occurred.

- `PERSISTENCE_CHROMA_MODE=gateway`
- Gateway HTTP fallback remains in place.
- Direct Chroma adapter normalization was verified explicitly, but runtime Chroma calls still route to Gateway.
- MongoDB remains direct.
- Neo4j remains direct.

## Files Changed

Tracked code/test files changed:

- `server/src/services/persistence/chroma/adapter.ts`
- `server/src/services/persistence/__tests__/chromaAdapter.test.ts`

Tracked report file added:

- `engineering/reports/S1_3_CHROMA_RESPONSE_NORMALIZATION_VERIFICATION.md`

Untracked local runtime config remains:

- `.env` retains the approved current runtime state with Chroma gateway.

## Recommendation

Chroma direct adapter response normalization is verified.

Do not flip `PERSISTENCE_CHROMA_MODE=direct` yet. The next approval boundary should be a dedicated Chroma direct live cutover verification after this normalization lands and is merged.
