# S1.3 Neo4j-Only Direct Cutover Verification

Date: 2026-06-27
Scope: Sprint 1 S1.3 Neo4j-only direct cutover.

Kevin-approved runtime flags were applied to the local untracked `.env`:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=gateway
```

MongoDB remains on the verified direct Mongoose adapter path. Neo4j is cut over to the direct `neo4j-driver` adapter path. ChromaDB remains on the Gateway path. The Gateway HTTP fallback remains in place.

## Commands Run

```powershell
git status -sb
Select-String -Path .env -Pattern '^(PERSISTENCE_DIRECT_ENABLED|PERSISTENCE_MONGO_MODE|PERSISTENCE_NEO4J_MODE|PERSISTENCE_CHROMA_MODE|GATEWAY_URL)=' -ErrorAction SilentlyContinue
& .\server\node_modules\.bin\tsx.CMD .logs/s1_3_neo4j_direct_cutover_verification.ts | Tee-Object -FilePath .logs/s1_3_neo4j_direct_cutover_verification.json
```

The harness used the normal `gatewayCall('neo4j', 'cypher', params)` runtime dispatcher. It did not rewrite caller sites and did not modify production code.

## Environment Flags Used

Final verification run:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=gateway
```

Resolved runtime snapshot:

```text
mongodb=direct
neo4j=direct
chromadb=gateway
```

## Live Stores Tested

- Neo4j direct through `neo4j-driver` using normal `gatewayCall('neo4j', 'cypher', ...)` runtime dispatch.
- MongoDB direct through the already verified Mongoose adapter path.
- ChromaDB through the Gateway path.

## Results

Final run ID: `s13neo4j_1782602290506`

Summary:

```text
pass: 8
limited: 0
fail: 0
```

| Check | Result | Notes |
|---|---:|---|
| Approved runtime flags resolved | PASS | MongoDB and Neo4j resolved direct; Chroma resolved gateway. |
| Live Neo4j Cypher write through normal runtime dispatcher | PASS | `gatewayCall('neo4j','cypher',...)` returned direct adapter shape with `records` and `summary.counters`. |
| Neo4j response-shape compatibility | PASS | Returned `records` and `summary.counters` after update operation. |
| Neo4j read-back verification | PASS | Read back one node with `status=updated` and `count=2`. |
| MongoDB remains direct | PASS | `gatewayCall('mongodb','insert',...)` returned direct adapter shape: `insertedCount`, `insertedIds`, without Gateway wrapper metadata. |
| Chroma remains on Gateway path | PASS | `gatewayCall('chromadb','list_collections',...)` returned Gateway collection shape. |
| Rollback to `PERSISTENCE_NEO4J_MODE=gateway` works | PASS | Child-process rollback probe returned Gateway Neo4j summary shape including `queryType` and timing keys. |
| No caller sites rewritten | PASS | Harness used the existing `gatewayCall('neo4j', 'cypher', params)` signature; no production files were modified. |

## Files Changed

Tracked files changed:

- `engineering/reports/S1_3_NEO4J_DIRECT_CUTOVER_VERIFICATION.md`

Untracked local runtime config changed:

- `.env` received the approved Neo4j direct cutover flag while keeping Chroma gateway.

No domain logic, route logic, frontend surfaces, ratified documents, or `.com` prospect-facing surfaces were modified.

## Rollback

Rollback flag verified:

```text
PERSISTENCE_NEO4J_MODE=gateway
```

With `PERSISTENCE_DIRECT_ENABLED=true`, `PERSISTENCE_MONGO_MODE=direct`, and `PERSISTENCE_NEO4J_MODE=gateway`, Neo4j calls returned the Gateway-shaped response from the HTTP path, including `summary.queryType`, `resultAvailableAfter`, and `resultConsumedAfter`. This confirms rollback can be performed by returning the Neo4j per-store flag to `gateway`; no caller-site changes are required.

Full rollback to all-Gateway mode remains:

```text
PERSISTENCE_DIRECT_ENABLED=false
PERSISTENCE_MONGO_MODE=gateway
PERSISTENCE_NEO4J_MODE=gateway
PERSISTENCE_CHROMA_MODE=gateway
```

## Confirmation

- Neo4j-only direct cutover was verified through the normal runtime `gatewayCall()` dispatcher.
- MongoDB remains on the verified direct Mongoose path.
- ChromaDB remains Gateway-only.
- Gateway HTTP fallback remains in place.
- Caller sites were not rewritten.
- Chroma direct cutover is not approved.

## Recommendation

Neo4j direct cutover is verified and acceptable to keep under the approved flags.

Do not proceed to Chroma direct cutover yet. Chroma direct should remain blocked until search and `query_with_filter` response normalization is implemented and re-verified.
