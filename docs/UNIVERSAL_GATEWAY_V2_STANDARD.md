# Universal Gateway V2 Standard

Universal Gateway V2 is the standard **MCP developer-tooling** gateway for Momentum Creation System V2 — the connector layer that Claude Desktop, Claude Code, Codex, and Codex CLI use to reach MongoDB, Neo4j, and ChromaDB during build sessions.

> **Scope (reconciled 2026-06-27).** This document standardizes the *developer tooling*. The Universal Gateway is **not** a production runtime dependency. Per the ratified Runtime layer and `docs/locked-spec.md` §3.14, the app runtime persists to MongoDB, Neo4j, and ChromaDB **directly**, through dedicated adapters and service layers. The current server still routes persistence through the gateway (405 call sites); that is implementation debt scheduled for migration under Sprint 1 item S1.3, not the target architecture.

## Canonical Runtime

- Gateway V2 repo/path: `D:/server-gateway-mcp-v2`
- Gateway V2 API: `http://localhost:2526/api`
- Execute endpoint: `http://localhost:2526/api/execute`
- Dashboard: `http://localhost:3102`
- ChromaDB: `http://localhost:8100`
- GPU FastAPI embedding service: `http://127.0.0.1:8300`

Gateway V1 on `2525` is legacy context for older personal-memory infrastructure and historical documents. MCS V2 developer tooling, local build/inspection scripts, and active docs should point to Gateway V2 on `2526`. (The app runtime does not point to the gateway — see Scope note above.)

## Persistence Rule

Every persistent MCS V2 write that belongs in the app data layer must land in **MongoDB, Neo4j, and ChromaDB** — no store optional, no store deferred. The **target** runtime accesses these three stores directly through dedicated adapters and service layers (per `docs/locked-spec.md` §3.14 and the ratified Runtime layer).

The current app helpers route through the gateway and are the **migration target** for Sprint 1 item S1.3 (repoint their internals at direct store adapters, callers unchanged):

- `server/src/services/gateway.ts`
- `server/src/services/tripleStack.ts`

Until that migration lands, `tripleStackWrite()` remains the app's write helper; the V1 `quadstack` connector is not used.

## Chroma Requirement

Chroma writes require the GPU FastAPI embedding service on port `8300`. The repo preflight is:

- `scripts/ensure-gpu-service.ps1`

Gateway V2 also has its own startup guard outside this repo:

- `D:/server-gateway-mcp-v2/scripts/ensure-gpu-fastapi.ps1`
- `D:/server-gateway-mcp-v2/START-ALL-SERVICES-V2.bat`

## Current Non-Repo Status

`D:/server-gateway-mcp-v2` is not currently tracked by this Git repository. Changes made there are local infrastructure changes until that folder is placed under version control or copied into a tracked infrastructure repo.
