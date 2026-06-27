# S1.3 Phase 3 Live Parity Verification

Date: 2026-06-27
Scope: Sprint 1 S1.3 Phase 3 live parity verification only.

Production runtime cutover was not performed. Caller sites were not rewritten. The Gateway HTTP path was not removed.

## Commands Run

```powershell
git status -sb
Select-String -Path .env -Pattern '^(GATEWAY_URL|MONGODB_URI|MONGODB_DB|NEO4J_URI|NEO4J_USERNAME|CHROMA_URL|GPU_EMBEDDER_URL|PERSISTENCE_DIRECT_ENABLED|PERSISTENCE_MONGO_MODE|PERSISTENCE_NEO4J_MODE|PERSISTENCE_CHROMA_MODE|GPU_EMBEDDER_REQUIRED)=' -ErrorAction SilentlyContinue
Invoke-RestMethod -Method Get -Uri 'http://localhost:8100/api/v2/heartbeat'
Invoke-RestMethod -Method Get -Uri 'http://localhost:8300/health'
Invoke-RestMethod -Uri 'http://localhost:2526/api/tools' -Method Get
Invoke-RestMethod -Method Post -Uri 'http://localhost:2526/api/execute' -ContentType 'application/json' -Body '{"tool":"mongodb","action":"list_collections","params":{"database":"momentum"}}'
Invoke-RestMethod -Method Post -Uri 'http://localhost:2526/api/execute' -ContentType 'application/json' -Body '{"tool":"neo4j","action":"cypher","params":{"query":"RETURN 1 AS n"}}'
Invoke-RestMethod -Method Post -Uri 'http://localhost:2526/api/execute' -ContentType 'application/json' -Body '{"tool":"chromadb","action":"list_collections","params":{}}'
& .\server\node_modules\.bin\tsx.CMD .logs/s1_3_phase3_live_parity.ts | Tee-Object -FilePath .logs/s1_3_phase3_live_parity.json
```

The `.logs/s1_3_phase3_live_parity.ts` harness was temporary verification tooling, not production code. It used isolated IDs/collections and did not change runtime flags.

## Environment Flags Used

Final harness run:

```text
GATEWAY_URL=http://localhost:2526/api
PERSISTENCE_DIRECT_ENABLED=false
PERSISTENCE_MONGO_MODE=gateway
PERSISTENCE_NEO4J_MODE=gateway
PERSISTENCE_CHROMA_MODE=gateway
GPU_EMBEDDER_REQUIRED=true
```

Direct adapter calls were invoked directly by the harness for parity comparison. Runtime dispatch flags remained in gateway/default mode.

## Live Stores Tested

- MongoDB on local port 28000
- Neo4j on local Bolt port 7687
- ChromaDB on `http://localhost:8100`
- Local GPU embedder on `http://localhost:8300`

The GPU embedder health response reported `status: healthy`, `device: cuda`, model `all-MiniLM-L6-v2`, and 384-dimensional embeddings.

## Results

Final run ID: `s13p3_1782601241717`

Summary:

```text
pass: 15
limited: 2
fail: 0
```

| Check | Result | Notes |
|---|---:|---|
| Live store health | PASS | Gateway MongoDB, Gateway Neo4j, Gateway ChromaDB, and GPU embedder all reachable. |
| Mongo insert response-shape parity | PASS | Gateway and direct paths returned `insertedCount` and `insertedIds`; Gateway also includes `database`/`collection` metadata. |
| Mongo query response-shape parity | PASS | Gateway and direct paths returned `documents` and `count`. |
| Mongo update response-shape parity | PASS | Gateway and direct paths returned `matchedCount`, `modifiedCount`, and `upsertedCount`. |
| Mongo delete response-shape parity | PASS | Gateway and direct paths returned `deletedCount`; Gateway also includes `database`/`collection` metadata. |
| Mongo aggregate response-shape parity | PASS | Gateway and direct paths returned `results` and `count`. |
| Mongoose validation behavior | PASS | Missing required field rejected by Mongoose validation. |
| Generated Mongo `$jsonSchema` determinism | PASS | Repeated generation produced stable JSON; required fields preserved. |
| Neo4j Cypher response-shape parity | PASS | Gateway and direct paths returned `records` and `summary.counters`. Gateway includes extra timing/query metadata. |
| Neo4j read-back verification | PASS | Gateway and direct paths both read back the two live parity nodes. |
| Chroma add parity | PASS | Gateway add and direct add both wrote live documents. Gateway returns `{ collection, added, ids, verified }`; direct adapter returns `{ ok, count }`. |
| Chroma search parity | LIMITED | Both paths returned matching Chroma result content, but shape differs: Gateway wraps under `results` with flat arrays; direct adapter returns raw Chroma nested arrays. |
| Chroma `query_with_filter` parity | LIMITED | Both paths returned filtered result content, but shape differs the same way as search. |
| GPU embedder required behavior | PASS | Live direct embed returned one 384-dimensional vector. |
| No CPU fallback | PASS | Invalid embedder URL rejected with `no CPU fallback`; no CPU fallback path observed. |
| Rollback flag behavior | PASS | Master flag off resolves all stores to Gateway, even when per-store flags are direct. |
| Mixed-mode triple-stack write readiness | PASS | Verified flag readiness for master-off, Mongo-only direct, and Mongo+Neo4j direct with Chroma gateway. Live store legs were tested individually. |

## Failures Or Limitations

No failing checks in the final run.

Limitations:

- Chroma search and `query_with_filter` are live-functional but not response-shape identical. Gateway returns a wrapper shape with `results.ids/documents/metadatas/distances`; the direct adapter returns raw Chroma v2 query output with nested arrays.
- Gateway responses often include extra metadata such as `database`, `collection`, timing, or wrapper fields. Direct adapters preserve the core caller-facing fields but do not reproduce every Gateway metadata field.
- The live harness intentionally used direct adapters directly rather than flipping `PERSISTENCE_DIRECT_ENABLED=true`; this validates adapter parity without performing a runtime cutover.
- Direct MongoDB parity requires the Phase 0 connection lifecycle (`connectMongo()`) before direct adapter calls. The final harness explicitly mirrored that boot behavior.
- Chroma test documents remain in the isolated `s1_3_phase3_parity` Chroma collection as harmless verification artifacts. Mongo and Neo4j isolated records were cleaned up by the harness.

## Runtime Cutover Confirmation

Runtime cutover has not occurred.

- `PERSISTENCE_DIRECT_ENABLED=false` was used for the final verification run.
- `PERSISTENCE_MONGO_MODE=gateway`
- `PERSISTENCE_NEO4J_MODE=gateway`
- `PERSISTENCE_CHROMA_MODE=gateway`
- The Gateway HTTP path remains in `server/src/services/gateway.ts`.
- No caller sites were rewritten.
- No domain logic, route logic, frontend surfaces, ratified documents, or `.com` prospect-facing surfaces were modified.

## Mongo Direct Cutover Recommendation

Mongo direct cutover is safe to approve next as the first per-store cutover candidate, provided it remains behind the existing flags and is done as a controlled Mongo-only cutover.

Rationale:

- Live Mongo insert/query/update/delete/aggregate parity passed.
- Mongoose validation passed.
- Generated Mongo `$jsonSchema` determinism passed.
- Rollback flag behavior passed.
- The only Mongo-specific operational requirement observed is that the direct connection lifecycle must be active before direct adapter calls, which is already the intended boot behavior for direct mode.

Recommended next approval boundary:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=gateway
PERSISTENCE_CHROMA_MODE=gateway
```

Do not approve Chroma direct cutover until the direct adapter normalizes search and `query_with_filter` responses to the Gateway caller-facing shape or caller expectations are explicitly audited.
