# Handoff Contract

> Decision ledger: `momentum.decisions/_id=dec_handoff_contract` (seq 17, Chat #132, **active**).
> This file is the human-readable mirror of that row. The ledger row is canonical.

## The one rule

There is **ONE** canonical handoff location. Every agent — Claude (web/desktop),
Claude Code, Perry — writes the session handoff there and **only** there.

```
MongoDB  ->  database: universal_gateway   collection: session_handoffs
```

## Document shape (required)

| field            | type    | rule |
|------------------|---------|------|
| `_id`            | string  | MUST be `handoff_chat_{N}` |
| `chat_number`    | int     | MUST equal `{N}` |
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

## Read path (start of session)

```
mongodb aggregate session_handoffs
  pipeline: [ { $sort: { created_at: -1 } }, { $limit: 1 } ]
```

Do **NOT** trust Perry `get_latest_handoff` — it sorts wrong and returns stale
docs (observed returning a May-14 record over the true latest). Read the
collection directly.

## Semantic mirror (not a second primary)

Chroma `perry_handoffs` may be written **in the same operation** as a semantic
search mirror. It is never the source of truth and never read as the canonical
latest. Mongo `session_handoffs` wins on every conflict.

## Deprecated — do NOT write handoffs here

Frozen for handoffs (leave existing rows; write nothing new):
`chat_handoffs`, `PerryHandoff`, `perry_sessions`, `persisted_sessions`,
`team_magnificent_sessions`.

## Session end (capture honestly)

1. Write the handoff to `session_handoffs` (+ Chroma mirror in the same op).
2. **Read it back** before claiming it landed.
3. If any live persistence leg fails, STOP and report the real error — never
   close green on a partial.
4. ARCHIE is run by Kevin externally (console-injected JS). No agent can run it.
   At session end, **remind Kevin to run ARCHIE** — never log it as done.
