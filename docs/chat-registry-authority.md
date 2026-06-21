# Gateway Chat Registry Authority

> Phase 0 correction after Chat #135+ memory audit. This file supersedes any
> claim that ARCHIE, Perry, `session_handoffs`, or GraphRAG search is the
> canonical source for chat identity.

## Authority Rule

The canonical chat/session authority is:

```text
MongoDB: universal_gateway.chat_registry
Neo4j:   (:ChatRegistry {id})
Chroma:  chat_registry
```

Every Claude chat, Codex thread, imported transcript, handoff, summary, learning
note, decision, and derived GraphRAG record must link to `chat_registry.id`.

## Standards Basis

The registry follows current provenance and lineage practice:

- W3C PROV: keep `entity`, `activity`, and `agent` distinct so trust can be
  assessed from lineage, not guessed from text search.
- OpenLineage: model imports and agent sessions as jobs/runs with inputs and
  outputs, not just final records.
- JSON Schema 2020-12: validate the registry envelope before any new authority
  record is written.
- RFC 9562 UUIDv7: use time-sortable registry ids for new generated records
  where a provider-native id is unavailable.

## Provider vs Importer vs Memory

Do not collapse these concepts:

| Concept | Examples | Authority role |
|---|---|---|
| Provider | `claude`, `codex`, `chatgpt` | Creates the original conversation/thread. |
| Importer/tool | `archie_browser_console`, `codex_thread_import`, `perry_handoff` | Moves or summarizes provider content. |
| Registry | `universal_gateway.chat_registry` | Assigns canonical identity and chat number. |
| Memory | Chroma/GraphRAG/Neo4j derived views | Searchable mirrors, never identity authority. |

Claude and Codex are the active chat providers. ARCHIE is a Claude transcript
import pipeline. Perry is a handoff/summarization tool. Ulyses is a gateway
specialist role/tool when invoked. Those tools/layers have no autonomous session
identity and no authority over chat numbering.

## Registry Shape

```ts
interface ChatRegistryEntry {
  _id: string;
  id: string;
  type: 'chat_registry_entry';
  schema_version: 1;

  chat_number: number | null;
  chat_number_source:
    | 'gateway_auto'
    | 'provider_native'
    | 'migration_inferred'
    | 'kevin_override'
    | 'not_assigned';
  chat_number_confidence: 'canonical' | 'high' | 'medium' | 'low' | 'none';

  provider: 'claude' | 'codex' | 'chatgpt' | 'unknown';
  provider_thread_id: string | null;
  provider_conversation_id: string | null;
  provider_url: string | null;

  project: string;
  cwd: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  registered_at: string;
  registered_by: string;

  registration_status:
    | 'registered'
    | 'needs_reconciliation'
    | 'duplicate_candidate'
    | 'deprecated';

  source_kind:
    | 'raw_chat'
    | 'thread_metadata'
    | 'transcript'
    | 'handoff'
    | 'summary'
    | 'derived_index';
  ingest_method:
    | 'provider_native'
    | 'archie_browser_console'
    | 'codex_thread_import'
    | 'perry_handoff'
    | 'migration'
    | 'manual';
  canonicality: 'canonical' | 'transcribed' | 'summary' | 'derived' | 'unknown';

  provenance: {
    entity_id: string;
    was_generated_by: string;
    was_attributed_to: string;
    generated_at: string;
    used_entities: string[];
  };

  lineage: {
    job_namespace: string;
    job_name: string;
    run_id: string;
    inputs: string[];
    outputs: string[];
  };

  override_history: Array<{
    field: string;
    from: unknown;
    to: unknown;
    corrected_by: string;
    corrected_at: string;
    reason: string;
  }>;
}
```

## Numbering Rules

1. `chat_number` is numeric only. Never store task slugs or dates there.
2. The registry allocator assigns new numbers. Kevin corrections are audited
   overrides, not the normal source of numbering.
3. Existing uncertain records get `chat_number: null` and
   `registration_status: 'needs_reconciliation'`.
4. `session_handoffs.chat_number` must mirror the registry when known; it does
   not create the authority.
5. No importer may backfill a number from title text unless it marks
   `chat_number_source: 'migration_inferred'`.

## Linkage Rules

All new memory records should carry:

```ts
{
  chat_registry_id: string,
  chat_number?: number,
  provider: 'claude' | 'codex' | 'chatgpt' | 'unknown',
  source_kind: 'raw_chat' | 'transcript' | 'handoff' | 'summary' | 'derived_index',
  ingest_method: string,
  canonicality: string
}
```

For schema-enforced `quadstack.write`, put the GraphRAG base envelope in `base`
and the registry lineage fields in the Mongo doc, Neo4j props, and Chroma
metadata.

## Phase 0 Policy

Phase 0 may:

- create the registry contract record;
- add registry rows for high-confidence numbered chats;
- add `needs_reconciliation` rows for Codex threads and task-slug handoffs;
- link handoffs/transcripts to registry rows where confidence is high.

Phase 0 may not:

- delete legacy handoff collections;
- merge databases;
- overwrite raw chat/transcript content;
- assign guessed numbers to unnumbered Codex threads;
- treat ARCHIE or Perry as source truth.
