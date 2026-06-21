# Handoff Contract

> Decision ledger: `momentum.decisions/_id=dec_handoff_contract` (seq 17, Chat #132, **active**).
> This file is the human-readable mirror of that row, amended by the Chat
> Registry Authority correction after the Chat #135+ memory audit.

## The Authority Rule

There is **ONE** canonical chat identity location:

```
MongoDB  ->  database: universal_gateway   collection: chat_registry
```

`session_handoffs` is no longer the identity authority. It is the canonical
handoff artifact collection, and every handoff must attach to a registry row.

See [chat-registry-authority.md](chat-registry-authority.md).

## Handoff Document Shape

| field            | type    | rule |
|------------------|---------|------|
| `_id`            | string  | MUST be `handoff_chat_{N}` |
| `chat_number`    | int     | MUST equal `{N}` |
| `chat_registry_id` | string | MUST point to `universal_gateway.chat_registry.id` |
| `created_at`     | string  | ISO-8601 UTC, `...Z` |
| `updated_at`     | string  | ISO-8601 UTC, `...Z` |
| `title`          | string  | `Chat #{N} — <what shipped>` |
| `summary`        | string  | what happened, plain language |
| `next_priorities`| array   | ordered open items |
| `front_of_line`  | string  | the single next move |
| `created_by`     | string  | which agent wrote it |

### The invariant that was broken

`_id` and `chat_number` **must agree**. The bug that motivated this contract
(Chat #132): a Chat #131 handoff lived under `_id: handoff_chat_127` with a
title saying "#130" — three different numbers in one record. Opening a session
then meant triangulating across four collections to find the real latest. Never
again: `handoff_chat_131` carries `chat_number: 131`, titled `Chat #131 — ...`.

The newer invariant is stronger: `_id`, `chat_number`, title, and
`chat_registry_id` must all agree with `chat_registry`. If there is a conflict,
the registry wins and the handoff becomes evidence to reconcile.

## Read path (start of session)

```
mongodb aggregate chat_registry
  pipeline: [
    { $match: { registration_status: "registered", chat_number: { $type: "int" } } },
    { $sort: { chat_number: -1 } },
    { $limit: 1 }
  ]
```

Then read the matching handoff by `chat_registry_id` or `chat_number`. Do
**NOT** trust Perry `get_latest_handoff` as identity authority; Perry is a
handoff/summarization tool.

## Semantic mirror (not a second primary)

Chroma `perry_handoffs` may be written **in the same operation** as a semantic
search mirror. It is never the source of truth and never read as the canonical
latest. `chat_registry` wins on identity conflicts; `session_handoffs` supplies
the handoff content.

## Deprecated — do NOT write handoffs here

Frozen for handoffs (leave existing rows; write nothing new):
`chat_handoffs`, `PerryHandoff`, `perry_sessions`, `persisted_sessions`,
`team_magnificent_sessions`.

## Session end (capture honestly)

1. Register or resolve the chat/thread in `chat_registry`.
2. Write the handoff to `session_handoffs` with `chat_registry_id` (+ Chroma
   mirror in the same op).
3. **Read both records back** before claiming they landed.
4. If any live persistence leg fails, STOP and report the real error — never
   close green on a partial.
5. ARCHIE is run by Kevin externally (console-injected JS). Claude/Codex may
   remind Kevin or process ARCHIE outputs, but must never log ARCHIE as done
   unless Kevin actually ran it.
