# S1.3 Mongo-Only Direct Cutover Verification

Date: 2026-06-27
Scope: Sprint 1 S1.3 Mongo-only direct cutover.

Kevin-approved runtime flags were applied to the local untracked `.env`:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=gateway
PERSISTENCE_CHROMA_MODE=gateway
```

Neo4j direct cutover was not approved or performed. Chroma direct cutover was not approved or performed. The Gateway HTTP path remains in place.

## Commands Run

```powershell
git status -sb
Select-String -Path .env -Pattern '^(GATEWAY_URL|PERSISTENCE_DIRECT_ENABLED|PERSISTENCE_MONGO_MODE|PERSISTENCE_NEO4J_MODE|PERSISTENCE_CHROMA_MODE|MONGODB_URI|MONGODB_DB|CHROMA_URL|GPU_EMBEDDER_URL)=' -ErrorAction SilentlyContinue
& .\server\node_modules\.bin\tsx.CMD .logs/s1_3_mongo_direct_cutover_verification.ts | Tee-Object -FilePath .logs/s1_3_mongo_direct_cutover_verification.json
```

The harness used `gatewayCall(tool, action, params)` under the approved runtime flags. It did not rewrite caller sites and did not modify production code.

## Environment Flags Used

Final verification run:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=gateway
PERSISTENCE_CHROMA_MODE=gateway
```

Resolved runtime snapshot:

```text
mongodb=direct
neo4j=gateway
chromadb=gateway
```

## Live Stores Tested

- MongoDB direct through the Mongoose adapter using normal `gatewayCall('mongodb', ...)` runtime dispatch.
- Neo4j through the Gateway path using `gatewayCall('neo4j', 'cypher', ...)`.
- ChromaDB through the Gateway path using `gatewayCall('chromadb', 'list_collections', ...)`.

## Results

Final run ID: `s13mongo_1782601937287`

Summary:

```text
pass: 14
limited: 0
fail: 0
```

| Check | Result | Notes |
|---|---:|---|
| Approved runtime flags resolved | PASS | MongoDB resolved direct; Neo4j and Chroma resolved gateway. |
| Live Mongo insert through normal runtime path | PASS | `gatewayCall('mongodb','insert',...)` returned direct adapter shape: `insertedCount`, `insertedIds`; no Gateway `database`/`collection` wrapper fields. |
| Live Mongo query through normal runtime path | PASS | Inserted document read back through `gatewayCall('mongodb','query',...)`; returned `documents` and `count`. |
| Live Mongo update through normal runtime path | PASS | Returned `matchedCount`, `modifiedCount`, and `upsertedCount`. |
| Post-update read-back verification | PASS | Updated document read back with `status=updated` and `count=2`. |
| Live Mongo aggregate through normal runtime path | PASS | Returned `results` and `count`. |
| Live Mongo delete through normal runtime path | PASS | Returned `deletedCount`. |
| Post-delete read-back verification | PASS | Query after delete returned `count=0`. |
| Mongoose validation works | PASS | Missing required field was rejected by Mongoose validation. |
| Generated Mongo `$jsonSchema` remains deterministic | PASS | Repeated generation produced stable JSON; required field remained present. |
| Rollback to `PERSISTENCE_MONGO_MODE=gateway` works | PASS | Child-process rollback probe returned Gateway-shaped Mongo list result with `database` and `collections` keys. |
| Neo4j remains on Gateway path | PASS | `gatewayCall('neo4j','cypher',...)` returned Gateway summary shape including `queryType` and timing fields. |
| Chroma remains on Gateway path | PASS | `gatewayCall('chromadb','list_collections',...)` returned Gateway Chroma collection shape. |
| No caller sites rewritten | PASS | Harness used the existing `gatewayCall(tool, action, params)` signature; no production files were modified. |

## Files Changed

Tracked files changed:

- `engineering/reports/S1_3_MONGO_DIRECT_CUTOVER_VERIFICATION.md`

Untracked local runtime config changed:

- `.env` received the approved Mongo-only direct cutover flags.

No domain logic, route logic, frontend surfaces, ratified documents, or `.com` prospect-facing surfaces were modified.

## Rollback

Rollback flag verified:

```text
PERSISTENCE_MONGO_MODE=gateway
```

With `PERSISTENCE_DIRECT_ENABLED=true` and `PERSISTENCE_MONGO_MODE=gateway`, Mongo calls returned the Gateway-shaped response from the HTTP path. This confirms rollback can be performed by returning the Mongo per-store flag to `gateway`; no caller-site changes are required.

Full rollback to all-Gateway mode remains:

```text
PERSISTENCE_DIRECT_ENABLED=false
PERSISTENCE_MONGO_MODE=gateway
PERSISTENCE_NEO4J_MODE=gateway
PERSISTENCE_CHROMA_MODE=gateway
```

## Confirmation

- MongoDB-only direct cutover was verified through the normal runtime `gatewayCall()` dispatcher.
- Gateway HTTP fallback remains in place.
- Neo4j remains Gateway-only.
- Chroma remains Gateway-only.
- Caller sites were not rewritten.
- Neo4j direct cutover is not approved.
- Chroma direct cutover is not approved.

## Recommendation

Mongo-only direct cutover is verified and acceptable to keep under the approved flags.

Do not proceed to Neo4j direct cutover yet. Do not proceed to Chroma direct cutover yet. Chroma direct should remain blocked until search and `query_with_filter` response normalization is implemented and re-verified.
