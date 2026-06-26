# Universal Gateway V2 Standard

Universal Gateway V2 is the standard gateway for Momentum Creation System V2.

## Canonical Runtime

- Gateway V2 repo/path: `D:/server-gateway-mcp-v2`
- Gateway V2 API: `http://localhost:2526/api`
- Execute endpoint: `http://localhost:2526/api/execute`
- Dashboard: `http://localhost:3102`
- ChromaDB: `http://localhost:8100`
- GPU FastAPI embedding service: `http://127.0.0.1:8300`

Gateway V1 on `2525` is legacy context for older personal-memory infrastructure and historical documents. MCS V2 app runtime, local `.env`, scripts, and active docs should point to Gateway V2 on `2526`.

## Persistence Rule

Every persistent MCS V2 write that belongs in the app data layer must land in MongoDB, Neo4j, and ChromaDB through Gateway V2. The app helper is:

- `server/src/services/gateway.ts`
- `server/src/services/tripleStack.ts`

Gateway V2 currently exposes MongoDB, Neo4j, and ChromaDB as individual connector actions. It does not expose the old V1 `quadstack` connector by default, so app code should keep using `tripleStackWrite()` unless/until V2 adds a schema-enforced quadstack connector.

## Chroma Requirement

Chroma writes require the GPU FastAPI embedding service on port `8300`. The repo preflight is:

- `scripts/ensure-gpu-service.ps1`

Gateway V2 also has its own startup guard outside this repo:

- `D:/server-gateway-mcp-v2/scripts/ensure-gpu-fastapi.ps1`
- `D:/server-gateway-mcp-v2/START-ALL-SERVICES-V2.bat`

## Current Non-Repo Status

`D:/server-gateway-mcp-v2` is not currently tracked by this Git repository. Changes made there are local infrastructure changes until that folder is placed under version control or copied into a tracked infrastructure repo.
