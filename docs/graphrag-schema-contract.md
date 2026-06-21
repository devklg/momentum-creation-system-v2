# GraphRAG Schema Contract

> Adapted from Chat #135's `GraphRAG-Schema-Reference-Chat135.docx` and
> `amb_chat135_graphrag_schema_research`.
>
> Scope of this file: Universal Gateway memory, provenance, lineage, and
> derived GraphRAG records.
> Gateway-owned mirror: `D:/server-gateway-mcp/docs/GRAPHRAG-SCHEMA-CONTRACT.md`.
>
> This does not authorize destructive cleanup, database merging, or legacy
> migration.

## Why This Exists

The current ecosystem correctly insists on triple-stack persistence, but
"write to MongoDB + Neo4j + ChromaDB" is not enough. Chat #135 found that the
same concept was being written with different field names, timestamps, database
names, and Neo4j labels. That drift made exact retrieval fail even when the data
was present.

The fix is a small enforced schema that every new Universal Gateway memory or
lineage record can inherit.
GraphRAG needs three things to stay useful:

1. A shared id that stitches MongoDB, Neo4j, and ChromaDB.
2. A lexical layer that preserves source text and provenance.
3. A lineage layer that explains where memory came from and what it derives
   from.

## Current Baseline

Universal Gateway already has useful pieces:

- `D:/server-gateway-mcp/gateway-core/src/connectors/QuadStackConnector.js`
  is the gateway-wide fan-out choke point. It can require MongoDB, Neo4j, and
  ChromaDB legs, but it does not yet validate or inject a canonical envelope.
- `D:/server-gateway-mcp/gateway-core/src/services/graphSchema.js` defines an
  older MCP-tool graph schema around `MCPServer`, `Tool`, `Category`,
  `Service`, `Technology`, and `UseCase`.
- `D:/server-gateway-mcp/gateway-core/src/services/vectorCollections.js`
  defines older Chroma collections for MCP documentation and learnings.
- `docs/chat-registry-authority.md` is now the identity authority for Claude
  chats, Codex threads, imports, handoffs, and derived memory. Handoffs attach
  to the registry; they do not assign canonical chat identity.

The missing piece is a universal contract for all forward writes.

## Chat Identity Authority

For chat-origin memory, the Universal Gateway Chat Registry is authoritative:

```text
MongoDB: universal_gateway.chat_registry
Neo4j:   (:ChatRegistry {id})
Chroma:  chat_registry
```

`chat_number` is an integer assigned by the registry allocator. Do not store
task slugs, dates, or titles in `chat_number`. If a Claude/Codex record cannot
be confidently mapped yet, write `chat_number: null`,
`registration_status: "needs_reconciliation"`, and preserve the provider id,
thread id, title, and import lineage.

Claude and Codex are the active chat providers. ARCHIE is a Claude transcript
import pipeline. Perry is a handoff/summarization tool. Ulyses is a gateway
specialist role/tool when invoked. GraphRAG is a derived search/memory layer.
Those tools/layers have no autonomous session identity and no authority over
chat numbering.

## Authority Boundary

The memory schema has one job: govern shared memory records.

## Non-Destructive Rule

Until Kevin reopens database cleanup:

- Do not delete legacy collections.
- Do not merge hyphen/underscore duplicate databases.
- Do not rename Neo4j labels in place.
- Do not backfill ARCHIE or Chroma records in this repo task.

This contract governs new writes and future migration design.

## Universal Gateway Base Envelope

Every new Universal Gateway memory/lineage record should carry this envelope in
MongoDB, Neo4j, and Chroma metadata.

| Field | Type | Rule |
|---|---:|---|
| `id` | string | Canonical id shared across all stores. Mongo `_id`, Neo4j `id`, Chroma id all match. |
| `type` | string enum | Memory/lineage type, not a UI label. Example: `conversation`, `decision`, `handoff`, `document`. |
| `schema_version` | int | Starts at `1`. Increment only through a decision. |
| `namespace` | string | Memory namespace. Example: `universal_gateway`, `chat_history`, `research_library`. |
| `source` | string | Writer, importer, or source system. Example: `perry`, `archie`, `codex_thread_import`. |
| `created_at` | ISO string | UTC `...Z`. No `date`, `timestamp`, or `start_time` aliases for new writes. |
| `title` | string | Human-readable label for search and admin views. |
| `origin_kind` | enum | `chat`, `system`, or `import`. |

### Conditional Origin Fields

Do not invent a chat number for non-chat records. The Chat #135 bug was
missing chat numbers on chat-origin records.

| Origin | Required fields |
|---|---|
| `chat` | `chat_number` as an int. Never `chat`, `synced_chat`, string, or title-only. |
| `system` | `job_id` or `service_name`. |
| `import` | `import_batch_id` and source file or collection. |

## Universal Gateway Canonical Types

These are global types the gateway can use across memory namespaces.

Records:

- `conversation`
- `handoff`
- `decision`
- `learning_note`
- `agent_message`
- `document`
- `chunk`
- `reference`
- `tool`
- `connector`
- `artifact`
- `audit_event`
- `import_batch`
- `schema_contract`

Neo4j labels:

- `Conversation`
- `Handoff`
- `Decision`
- `LearningNote`
- `AgentMessage`
- `Document`
- `Chunk`
- `Reference`
- `Tool`
- `Connector`
- `Artifact`
- `AuditEvent`
- `ImportBatch`
- `SchemaContract`

Relationships:

- `(:Document)-[:HAS_CHUNK]->(:Chunk)`
- `(:Chunk)-[:NEXT_CHUNK]->(:Chunk)`
- `(:Chunk)-[:MENTIONS]->(:Entity)`
- `(:Reference)-[:EVIDENCES]->(:Decision)`
- `(:Handoff)-[:FROM_CHAT]->(:Conversation)`
- `(:Decision)-[:FROM_CHAT]->(:Conversation)`
- `(:Decision)-[:SUPERSEDES]->(:Decision)`
- `(:LearningNote)-[:DERIVED_FROM]->(:Conversation)`
- `(:AgentMessage)-[:REFERENCES]->(:Artifact)`
- `(:Tool)-[:CONNECTS_TO]->(:Connector)`

This is the layer that should retire future ad hoc labels like
`ClaudeSession`, `PersistedSession`, and generic `Chat`. Legacy labels can stay
until migration, but new writes should converge on this set.

## Store Mapping

### MongoDB

Mongo owns the full document.

```ts
{
  _id: id,
  id,
  type,
  schema_version: 1,
  namespace,
  source,
  created_at,
  title,
  origin_kind,
  ...memoryFields
}
```

New cross-store envelope fields use snake_case.

### Neo4j

Every memory node gets a universal `id` property.

```cypher
MERGE (d:Decision {id: $id})
SET d += $base,
    d.topic = $topic,
    d.status = $status
```

Relationship names must be specific verbs. Do not add `RELATED`,
`CONNECTED_TO`, or generic relationship labels.

### ChromaDB

Chroma ids match the canonical `id`. Metadata carries the same base envelope
plus compact memory filters.

```ts
{
  id,
  type,
  schema_version: 1,
  namespace: "universal_gateway",
  source,
  created_at,
  title,
  origin_kind,
  chat_registry_id,
  source_kind
}
```

Chroma documents should be short semantic summaries, not JSON dumps.

## Two-Layer GraphRAG Model

### Lexical Layer

Use this for source material across the whole gateway: transcripts, handoffs,
decisions, uploaded references, generated documents, tool docs, and imported
conversations.

Nodes:

- `Document`
- `Chunk`
- `Reference`
- `Transcript`

Edges:

- `(:Document)-[:HAS_CHUNK]->(:Chunk)`
- `(:Chunk)-[:NEXT_CHUNK]->(:Chunk)`
- `(:Chunk)-[:MENTIONS]->(:Entity)`
- `(:Reference)-[:EVIDENCES]->(:Decision)`

Rules:

- Chunks preserve provenance: source file, source collection, page/line/offset
  when known.
- Facts used by agents should be traceable back to a chunk or source artifact.
- Mentioned entities can be extracted as text entities.

### Derived Semantic Layer

The derived semantic layer is for memory records created from source material:
chat transcripts, handoffs, decisions, learning notes, documents, and imported
references.

## Enforcement Plan

### Phase 1: Contract Only

This file and the gateway-owned mirror are Phase 1. They give agents one
schema target for memory records.

### Phase 2: Gateway Envelope Validator

Add a small schema service in Universal Gateway, for example:

```text
D:/server-gateway-mcp/gateway-core/src/services/graphRecordSchema.js
```

Responsibilities:

- Validate the base envelope.
- Require `chat_number` only when `origin_kind === "chat"`.
- Reject legacy aliases on new writes: `chat`, `synced_chat`, `date`,
  `timestamp`, `start_time`.
- Normalize Chroma metadata by copying the base envelope into every metadata
  row.
- Return a structured `GRAPH_RECORD_SCHEMA_INVALID` error before any store
  mutates.

### Phase 3: QuadStack Enforcement

Extend `QuadStackConnector.write` with a backwards-compatible opt-in:

```ts
quadstack.write({
  base: {
    id,
    type,
    schema_version: 1,
    namespace,
    source,
    created_at,
    title,
    origin_kind,
  },
  mongo,
  neo4j,
  chroma,
  options: {
    require: ["mongo", "neo4j", "chroma"],
    enforce_schema: true
  }
});
```

When `enforce_schema` is true, QuadStack should:

- Validate `base` before fan-out.
- Ensure `mongo.doc` gets `_id: base.id`, `id: base.id`, and the base fields.
- Ensure `neo4j.params` receives `id: base.id` and `base`.
- Ensure all `chroma.ids` equal `base.id` for single-record writes.
- Merge the base envelope into every Chroma metadata object.
- Fail before Mongo if the schema is invalid.

After enough callers migrate, `enforce_schema` can become the default for
Universal Gateway memory and lineage writes.

### Phase 4: New Memory Writes Only

Move new memory/lineage writes onto schema-enforced `quadstack.write` as they
are touched. Do not retrofit every existing file in one broad pass.

Priority write families:

1. `session_handoffs`, decisions, and agent message board records, because
   exact retrieval depends on chat provenance.
2. imported transcripts and source-document chunks, because they anchor memory
   to original evidence.
3. learning notes and derived GraphRAG summaries, because they drive future
   agent recall.

## Open Engineering Questions

These should be decided before enforcement:

1. Whether `Conversation` should be introduced in this repo or reserved for
   the shared memory layer. This contract keeps `Handoff` and `Decision` in
   repo scope and leaves `Conversation` to the shared layer.
2. Whether Universal Gateway should expose a new `graphrecord.write` connector
   or keep enforcement inside `quadstack.write`. This contract recommends
   `quadstack.write` first because it is already the fan-out choke point.

## Rule Of Thumb

If a future query needs to answer "where did this fact come from?", the record
belongs in the lexical layer or must link to it.

If a future query needs exact lookup across stores, the answer starts with the
shared `id`.
