# S1.3 Chroma Direct Cutover Verification

Date: 2026-06-27
Scope: Sprint 1 S1.3 Chroma-only direct cutover verification.

Kevin-approved runtime flags were applied to the local untracked `.env`:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=direct
```

MongoDB remains on the verified direct Mongoose adapter path. Neo4j remains on the verified direct `neo4j-driver` adapter path. ChromaDB is now verified through the direct Chroma adapter path. The Gateway HTTP fallback remains in place.

## Commands Run

```powershell
git status -sb
Select-String -Path .env -Pattern '^(PERSISTENCE_DIRECT_ENABLED|PERSISTENCE_MONGO_MODE|PERSISTENCE_NEO4J_MODE|PERSISTENCE_CHROMA_MODE|GATEWAY_URL)=' -ErrorAction SilentlyContinue
& .\server\node_modules\.bin\tsx.CMD .logs/s1_3_chroma_direct_cutover_verification.ts | Tee-Object -FilePath .logs/s1_3_chroma_direct_cutover_verification.json
```

The harness used normal runtime `gatewayCall('chromadb', action, params)` dispatch with `PERSISTENCE_CHROMA_MODE=direct`. It did not rewrite caller sites and did not modify production code.

## Environment Flags Used

Final verification run:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=direct
```

Resolved runtime snapshot:

```text
mongodb=direct
neo4j=direct
chromadb=direct
```

## Live Stores Tested

- ChromaDB direct through normal `gatewayCall('chromadb', ...)` runtime dispatch.
- MongoDB direct through normal `gatewayCall('mongodb', ...)` runtime dispatch.
- Neo4j direct through normal `gatewayCall('neo4j', ...)` runtime dispatch.
- Local GPU embedder through direct Chroma adapter embedding flow.

## Results

Final run ID: `s13chromacutover_1782603222546`

Summary:

```text
pass: 11
limited: 0
fail: 0
```

| Check | Result | Notes |
|---|---:|---|
| Approved runtime flags resolved | PASS | MongoDB, Neo4j, and ChromaDB resolved direct. |
| Chroma `add` through normal runtime dispatcher | PASS | `gatewayCall('chromadb','add',...)` returned `{ ok: true, count: 1 }`. |
| Chroma `search` through normal runtime dispatcher | PASS | Returned Gateway-compatible caller-facing shape: `collection`, `query`, `n_results`, and flat `results.*` arrays. |
| Chroma `query_with_filter` through normal runtime dispatcher | PASS | Returned Gateway-compatible caller-facing shape: `collection`, `n_results`, and flat `results.*` arrays. |
| GPU embedder is required | PASS | Live embed returned one 384-dimensional vector. |
| No CPU fallback exists | PASS | Invalid embedder URL probe failed loudly with no CPU fallback behavior. |
| MongoDB remains direct | PASS | `gatewayCall('mongodb','insert',...)` returned direct adapter shape without Gateway wrapper metadata. |
| Neo4j remains direct | PASS | `gatewayCall('neo4j','cypher',...)` returned direct adapter shape without Gateway `queryType`. |
| Rollback to `PERSISTENCE_CHROMA_MODE=gateway` works | PASS | Child-process rollback probe returned Gateway Chroma list shape with `collections` and `count`. |
| Gateway HTTP fallback remains available | PASS | Direct HTTP Gateway call to `chromadb.list_collections` succeeded. |
| No caller sites rewritten | PASS | Harness used existing `gatewayCall(tool, action, params)` signature. |

## Response Shape Notes

The normalized direct Chroma read operations now match the Gateway caller-facing read shape:

```text
{
  collection,
  query?,        // present for search
  n_results,
  results: {
    ids: string[],
    documents: string[],
    metadatas: object[],
    distances: number[]
  }
}
```

`add` remains functional through the direct adapter and returns `{ ok: true, count }`. Existing runtime Chroma add callers do not depend on Gateway wrapper metadata.

## Files Changed

Tracked files changed:

- `engineering/reports/S1_3_CHROMA_DIRECT_CUTOVER_VERIFICATION.md`

Untracked local runtime config changed:

- `.env` received the approved Chroma direct cutover flag.

No domain logic, route logic, frontend surfaces, ratified documents, or `.com` prospect-facing surfaces were modified.

## Rollback

Rollback flag verified:

```text
PERSISTENCE_CHROMA_MODE=gateway
```

With MongoDB and Neo4j still direct, returning Chroma to `gateway` routed Chroma calls back through the Gateway HTTP path and returned the Gateway collection shape. No caller-site changes are required.

Full rollback to all-Gateway mode remains:

```text
PERSISTENCE_DIRECT_ENABLED=false
PERSISTENCE_MONGO_MODE=gateway
PERSISTENCE_NEO4J_MODE=gateway
PERSISTENCE_CHROMA_MODE=gateway
```

## Confirmation

- Chroma direct cutover was verified through normal runtime `gatewayCall()` dispatcher calls.
- MongoDB remains direct.
- Neo4j remains direct.
- GPU embedder requirement is preserved.
- No CPU fallback exists.
- Gateway HTTP fallback remains in place.
- Caller sites were not rewritten.
- The Gateway runtime fallback was not removed.

## Recommendation

Chroma direct cutover is verified under the approved flags. Keep the Gateway HTTP fallback in place.
