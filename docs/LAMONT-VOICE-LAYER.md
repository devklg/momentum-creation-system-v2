# La'Mont Voice Layer

## Fast Answer

La'Mont is the Windows-local voice companion for MCS V2.

It lives in a separate local repo:

```text
D:/handy-dictation
```

MCS V2 lives here:

```text
D:/momentum-creation-system-v2
```

La'Mont is **not** inside the MCS monorepo because it is a desktop app, not a
web workspace package. It is a Tauri/Rust/React app forked from Handy and
customized for Kevin's Windows dictation workflow.

## What La'Mont Does

La'Mont provides local voice input and output:

- speech-to-text for Kevin / BA spoken input;
- text-to-speech for agent responses;
- optional ordinary dictation into Codex, Claude, browser textareas, email, and
  other Windows apps;
- future structured handoff of final transcripts into authenticated MCS runtime
  endpoints.

## What La'Mont Is Not

La'Mont is not:

- an MCS agent;
- the Context Manager;
- a knowledge approver;
- a persistence adapter;
- a GraphRAG writer;
- a prospect-facing `.com` feature;
- a replacement for text fallback.

La'Mont must never write directly to MongoDB, Neo4j, ChromaDB, SurrealDB, or
GraphRAG. MCS remains the system of record.

## How It Relates To MCS

La'Mont is a local provider under the authenticated `.team` runtime boundary.

```text
Microphone
  -> La'Mont local STT
  -> final transcript text
  -> authenticated MCS runtime/interview endpoint
  -> Agent Runtime
  -> Context Manager
  -> governed persistence / candidate knowledge / learning pipeline

MCS agent response text
  -> La'Mont local TTS
  -> local speaker output
```

The same provider pattern should support Steve, Michael, Ivory, admin capture,
and future BA-facing agents. Do not hard-code La'Mont only to one interview
screen.

## Provider Names

Use these provider concepts when designing the integration:

```text
browser_text       typed input inside .team
browser_voice      browser speech recognition/synthesis where available
lamont_voice       La'Mont local STT/TTS companion
mixed              BA can move between voice and text without losing session
```

Exact TypeScript enums should be added only in the implementation slice that
wires the runtime contract.

## Current Local Development State

La'Mont local repo:

```text
D:/handy-dictation
```

La'Mont dev frontend ports are registered in the gateway port registry:

```text
4272  La'Mont dev frontend
4273  La'Mont dev frontend HMR
```

Dev launcher:

```powershell
D:/handy-dictation/scripts/start-lamont-dev.ps1
```

Desktop shortcut:

```text
C:/Users/email/OneDrive/Desktop/La'Mont Dev.lnk
```

Primary local settings file:

```text
C:/Users/email/AppData/Roaming/com.devklg.lamont/settings_store.json
```

Known selected microphone during setup:

```text
Microphone (Logitech BRIO)
```

## Current MCS Documentation Pointers

Authoritative decision:

```text
organization/DECISION_lamont_local_voice_layer.md
```

Architecture summary:

```text
AGENT_ARCHITECTURE.md
```

Implementation planning:

```text
engineering/plans/BROWSER_VOICE_FOUNDATION_PLAN.md
engineering/plans/IMPLEMENTATION_MASTER_PLAN.md
```

## Implementation To-Do

The MCS runtime integration is documented but not fully wired yet.

Remaining implementation work:

1. Add a La'Mont bridge contract for final transcripts and TTS requests.
2. Add runtime provider metadata for `lamont_voice`.
3. Add `.team` UI controls that detect/use La'Mont when available.
4. Preserve text fallback everywhere.
5. Route La'Mont final transcripts only through authenticated MCS endpoints.
6. Emit runtime events for connection, transcript, speech, fallback, and error.
7. Prove La'Mont cannot be used on `.com` and cannot write directly to stores.

## One-Sentence Context For Another Agent

La'Mont is the separate Windows desktop voice companion at `D:/handy-dictation`;
MCS V2 should treat it as the `lamont_voice` provider for authenticated `.team`
agent runtime turns, while MCS keeps all auth, scope, context, persistence,
knowledge ingestion, and governance.
