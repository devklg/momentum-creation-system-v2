# Momentum Creation System v2

**Team Magnificent Marketing Momentum Creation System.** Founded by Kevin L. Gardner, co-led with Paul Barrios, operating inside THREE International around GLP-THREE.

Three clients, one server, one governed triple-stack.

## Surfaces

| Surface | URL | Audience | Port (dev) |
|---|---|---|---|
| `apps/com` | `teammagnificent.com` | Prospect-facing | `7701` |
| `apps/team` | `teammagnificent.team` | Brand Ambassador | `7702` |
| `apps/admin` | `admin.teammagnificent.team` | Kevin only | `7703` |
| `server` | `localhost:7700/api` | Shared API | `7700` |

## Architecture

Every persistent write lands in MongoDB + Neo4j + ChromaDB **directly**, through the server's own persistence adapters (`server/src/services/persistence/`) — Mongo `:30000`, Neo4j `:7710`, Chroma `:8200` (the dedicated governed stack). Per **ACR-0007**, the Universal Gateway V2 (`localhost:2526`) is **developer tooling only** — an MCP server for AI agents (Claude Desktop, Claude Code, Codex) that saves tokens during development; it is never a production runtime dependency and is not part of the app's persistence path. THREE International is the final authority on sponsorship, enrollment, placement, and compensation — this system mirrors THREE for operational visibility, never overrides it. See `organization/ACR-0007-runtime-persistence-direct-not-gateway.md` and `docs/UNIVERSAL_GATEWAY_V2_STANDARD.md`.

For full architecture, see `docs/locked-spec.md` (condensed authoritative reference) and the five design `.docx` files in `docs/`.

## Compliance — never on `.com`

No income claims. No placement promises. No AI prospecting (Michael is BA-facing only). No compensation cycle / volume / rank math. No current head count (the 100,000 goal is named, the current count is not). No THREE branding. The marketing layer shows reality without making promises.

## Repo layout

```
.
├── apps/
│   ├── com/        # prospect-facing client (Vite + React + TS)
│   ├── team/       # BA-facing client (Vite + React + TS)
│   └── admin/      # Kevin-only client (Vite + React + TS)
├── server/         # Node + Express + TypeScript API
├── packages/
│   └── shared/     # brand tokens, compliance constants, shared types
├── docs/           # the locked consultation — 5 .docx + supporting .md
└── assets/         # logos and other static assets
```

## Development

```bash
pnpm install
pnpm dev:all
```

Runs server (7700) and all three clients (7701/7702/7703) in parallel. Requires Node ≥22 and pnpm ≥9 (`packageManager: pnpm@9.15.0`). `pnpm dev` runs only server + team.

## License

UNLICENSED — internal project. Do not distribute.
