# External MCP Tooling Standard

This document standardizes the external MCP developer-tooling surface used by Claude, Codex, operator scripts, and inspection tasks during build sessions.

> **Scope.** This is tooling outside the Momentum Creation System app. It is not a production runtime dependency, not the app persistence edge, and not the app memory layer. The app runtime persists to MongoDB, Neo4j, and ChromaDB directly through dedicated adapters and service layers.

## Canonical Boundary

- App runtime persistence lives in this repo under `server/src/services/persistence/`.
- App writes go through `tripleStackWrite()` and the direct persistence dispatch surface.
- External MCP tooling may inspect stores or write agent-operations memory, but it must never sit in the app request path.
- App configuration must not require a tooling-server URL.

## Runtime Persistence Rule

The app's runtime persistence rule is:

```text
MCS app runtime -> server persistence services -> MongoDB + Neo4j + ChromaDB
```

The external MCP tool server is deliberately outside that flow:

```text
Claude/Codex/operator scripts -> external MCP tool server -> inspection or agent-operations tasks
```

## Startup Boundary

The app may require:

- MongoDB
- Neo4j
- ChromaDB
- GPU embedding service

The app must not require external MCP tooling to boot, serve users, or write app data.

## Source Control Boundary

External MCP tooling lives outside this repository. Changes to that tooling are infrastructure changes until they are placed under a tracked infrastructure repo. App code must not import, call, or configure that tooling as a persistence dependency.
