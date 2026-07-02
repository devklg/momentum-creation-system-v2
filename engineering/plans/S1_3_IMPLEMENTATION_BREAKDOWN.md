# S1.3 Implementation Breakdown

Report date: 2026-06-27

Status: Planning only. No production code is changed by this document.

Decision source: Kevin confirmed Option C.

## Decision Summary

Runtime persistence moves to direct store adapters:

- MongoDB uses Mongoose models as the single schema source of truth.
- Mongo `$jsonSchema` validators are generated from Mongoose schemas as the database-level enforcement backstop.
- `$jsonSchema` is never hand-maintained separately.
- Neo4j remains direct through `neo4j-driver` and Cypher.
- ChromaDB remains direct through the Chroma adapter using the local GPU embedder with no CPU fallback.
- The Universal Gateway remains MCP developer tooling only and is not the production runtime database access path.

## 1. Files Expected To Change

Expected implementation files, when implementation begins:

- `server/src/env.ts`
- `server/src/services/gateway.ts`
- `server/src/services/tripleStack.ts`
- `server/src/services/tieredWrite.ts`
- `server/src/services/projectionOutbox.ts`
- `server/src/services/chromaCollections.ts`
- `server/src/services/persistence/flags.ts`
- `server/src/services/persistence/mongo/connection.ts`
- `server/src/services/persistence/mongo/models/*`
- `server/src/services/persistence/mongo/jsonSchema/*`
- `server/src/services/persistence/mongo/adapter.ts`
- `server/src/services/persistence/neo4j/connection.ts`
- `server/src/services/persistence/neo4j/adapter.ts`
- `server/src/services/persistence/chroma/connection.ts`
- `server/src/services/persistence/chroma/embedder.ts`
- `server/src/services/persistence/chroma/adapter.ts`
- `server/src/services/persistence/index.ts`
- `server/package.json`
- `package.json` if root scripts are needed for validator generation or verification
- implementation tests under the selected Sprint 1 test harness

Expected generated or migration-support files:

- generated Mongo validator artifacts under `server/src/services/persistence/mongo/jsonSchema/generated/` or a parallel generated directory selected during implementation
- validator application script under `server/scripts/` if approved in the implementation sprint

## 2. Files That Must Not Change

Do not change during S1.3 implementation unless Kevin separately approves:

- `FOUNDATION_v1.0_FREEZE.md`
- `runtime/*`
- `constitution/*`
- `organization/ACR-REGISTER.md`
- proposed ACR files other than the already-approved persistence decision path
- `docs/locked-spec.md`
- `docs/project-wireframe.md`
- `.com` prospect presentation/dashboard files
- caller-site domain logic across `server/src/domain/*` and `server/src/routes/*`
- `apps/*` frontend production surfaces

The purpose of S1.3 is to move persistence behind the existing service seam, not rewrite application behavior.

## 3. Adapter Layout

Recommended layout:

```text
server/src/services/persistence/
  flags.ts
  index.ts
  mongo/
    connection.ts
    adapter.ts
    models/
    jsonSchema/
      generate.ts
      apply.ts
      generated/
  neo4j/
    connection.ts
    adapter.ts
  chroma/
    connection.ts
    embedder.ts
    adapter.ts
```

The public dispatch contract remains:

```ts
gatewayCall(tool, action, params)
```

Implementation changes its internals only. Caller sites are not rewritten.

## 4. Mongoose Model Strategy

Mongoose is the schema authoring layer for MongoDB.

Strategy:

- Create one Mongoose model per Mongo collection used by runtime and existing persistence callers.
- Preserve existing collection names.
- Preserve existing document IDs and `_id` conventions.
- Model schemas from actual write shapes already used in the repo.
- Include Team Magnificent scope fields in new runtime BA-scoped models.
- Keep legacy operational models permissive enough to avoid rejecting valid current writes during cutover.
- Prefer strict runtime schemas for new Package 001 models.
- Use model-level timestamps only where existing data shape allows it.
- Map Mongoose results back to the current gateway response shapes.

Required response-shape parity:

- `insert` returns `{ insertedCount, insertedIds }`
- `query` returns `{ documents, count }`
- `delete` returns `{ deletedCount }`
- `update` returns `{ matchedCount, modifiedCount, upsertedCount }`
- `aggregate` returns `{ results, count }`

## 5. Generated `$jsonSchema` Strategy

Mongo validators are generated from Mongoose schemas.

Rules:

- Mongoose schema is the only source of truth.
- Generated `$jsonSchema` is a build artifact.
- Do not hand-maintain `$jsonSchema`.
- Do not allow schema drift between Mongoose and Mongo validators.
- Generated validators should be deterministic and reviewable.
- Applying validators should be an explicit operation, not an accidental side effect of app boot.

Implementation approach:

1. Define Mongoose schemas.
2. Generate `$jsonSchema` validators from those schemas.
3. Compare generated output to committed/generated artifacts in tests.
4. Apply validators with `collMod` or collection creation logic.
5. Fail if generated validator differs from committed validator output during verification.

Validator rollout:

- Start permissive for legacy collections where needed.
- Start strict for new runtime collections.
- Apply in dev/test first.
- Preserve Kevin's login data.
- Re-seed disposable test data if non-conforming legacy documents are encountered.

## 6. Neo4j Adapter Contract

Neo4j uses `neo4j-driver` directly.

Contract:

- Accept action `cypher` with `{ query, params }`.
- Return `{ records, summary: { counters } }`.
- Preserve existing Cypher semantics.
- Preserve existing read-back verification queries.
- Preserve MATCH-based failure behavior where code relies on missing-anchor detection.
- Do not introduce an ORM layer for Neo4j.
- Manage sessions safely per operation.
- Close driver on server shutdown.

Error behavior:

- Surface Neo4j errors through the existing `GatewayError(tool, action, message)` compatibility surface while caller sites remain unchanged.

## 7. Chroma Adapter Contract

ChromaDB uses a direct adapter and local GPU embeddings.

Contract:

- Support existing actions: `add`, `search`, `query_with_filter`, `get_collection`, `list_collections`, `create_collection`.
- Preserve plural `add` inputs: `ids`, `documents`, `metadatas`.
- Define explicit overwrite semantics for `add` on an existing id: the direct adapter must actually upsert (true overwrite, or delete-then-add with re-embed) and never silently no-op. NOTE: the MCP gateway's `chromadb.add` does NOT overwrite an existing id — it returns success while leaving the stored document and embedding unchanged. The production adapter must not inherit that behavior; any update to an existing id must be read-back-verified.
- Generate embeddings by calling the local GPU embedder before Chroma writes/searches.
- Do not use Chroma's CPU embedding fallback.
- Do not auto-create collections during `add`.
- Preserve `chromaCollections.ts` explicit collection registry and write-time guard.

Embedding contract:

- GPU embedder is required.
- Expected vector dimensionality must be verified.
- Embedder failure fails the Chroma leg loud.

## 8. GPU Embedder Startup/Failure Behavior

Startup:

- Server startup checks GPU embedder health before Chroma direct mode is enabled.
- `pnpm ensure:gpu` remains the local dev startup helper unless replaced by an approved direct equivalent.
- The Chroma adapter records health status for verification.

Failure behavior:

- No CPU fallback.
- No silent degraded mode for Chroma writes.
- If embedder is down, the Chroma leg fails loud before a false-success write is reported.
- Tiered writes preserve their configured semantics: graph-critical remains protected, knowledge/operational projection behavior follows the tiered-write contract.
- Monitoring should distinguish "embedder unavailable" from "Chroma unavailable" and "collection missing."

## 9. Per-Store Cutover Flags

Recommended flags:

```env
PERSISTENCE_MONGO_MODE=gateway|direct
PERSISTENCE_NEO4J_MODE=gateway|direct
PERSISTENCE_CHROMA_MODE=gateway|direct
PERSISTENCE_DIRECT_ENABLED=false|true
GPU_EMBEDDER_REQUIRED=true
```

Rollout order:

1. Mongo direct.
2. Neo4j direct.
3. Chroma direct.
4. Remove gateway runtime path after verification.

Each store can roll back independently during the mixed-mode window.

## 10. Mixed-Mode Triple-Stack Test Plan

Test the exact transition state where stores are split across modes.

Required scenarios:

- Mongo direct, Neo4j gateway, Chroma gateway.
- Mongo direct, Neo4j direct, Chroma gateway.
- Mongo direct, Neo4j direct, Chroma direct.
- Mongo gateway rollback while Neo4j/Chroma remain direct.
- Chroma embedder failure during mixed mode.
- Missing Chroma collection during mixed mode.
- Neo4j verification query returns zero rows during mixed mode.
- Mongo validator rejects malformed write during mixed mode.
- Update an existing Chroma doc (same id) actually overwrites its document and embedding — verified by read-back; no silent no-op.

Assertions:

- Caller site behavior does not change.
- `tripleStackWrite()` response shape remains compatible.
- `tieredWrite()` rollback and outbox semantics remain intact.
- Read-back verification proves each store landed the expected record.
- Errors are loud and actionable.

## 11. Rollback Plan

During mixed mode:

- Flip the affected per-store flag back to `gateway`.
- Leave other stores in their current verified mode.
- Re-run triple-stack read-back for the affected flow.
- Inspect projection outbox for pending/dead-letter rows.
- Do not rewrite caller sites as rollback.

After gateway runtime path removal (completed by ACR-0009):

- Rollback requires reverting the removal commit.
- Do not reintroduce the gateway runtime path; all direct adapters passed verification and Kevin approved the final cutover in ACR-0009.

Data rollback:

- Preserve Kevin login credentials.
- Disposable dev/test data may be wiped and re-seeded.
- For validator failures, fix the Mongoose schema or data shape, regenerate `$jsonSchema`, and re-apply. Do not hand-edit validators.

## 12. Verification Gates

Before implementation:

- Claude governance confirms Option C is planning-compatible.
- Kevin approves execution.
- Test harness selected.

During implementation:

- `pnpm typecheck`
- `pnpm build`
- adapter unit tests
- generated validator determinism test
- Mongo validator apply/read-back test
- Neo4j Cypher response-shape test
- Chroma GPU embedding test
- mixed-mode triple-stack tests
- static check that runtime production code does not call Universal Gateway as persistence

Before cutover:

- all three direct adapters green
- read-back verified across Mongo, Neo4j, Chroma
- GPU embedder required/failure behavior verified
- rollback flags verified

## 13. Caller Sites Are Not Rewritten

Confirmed.

S1.3 implementation must not rewrite the existing caller sites. The seam remains the existing persistence service boundary, especially:

- `gatewayCall(tool, action, params)`
- `tripleStackWrite()`
- `tieredWrite()`
- `projectionOutbox`
- Chroma collection guard helpers

The migration changes internals behind the seam first. Domain/routes/app code should continue to call the same helpers until a later, separately approved cleanup.

## 14. Universal Gateway Remains MCP Tooling Only

Confirmed.

The Universal Gateway is not the production runtime database access path under Option C.

Allowed:

- MCP developer tooling
- audits
- ad hoc inspection
- migration verification support when explicitly used as tooling

Not allowed:

- production runtime persistence dependency
- production triple-stack write path
- hidden fallback when direct adapters fail
- replacement for Mongoose model validation
- replacement for direct Neo4j/Chroma adapters

The production runtime must use direct adapters: Mongoose/MongoDB, `neo4j-driver`, and Chroma with the local GPU embedder.
