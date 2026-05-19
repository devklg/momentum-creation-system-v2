# Momentum Creation System v1

**Team Magnificent Marketing Momentum Creation System.** Founded by Kevin L. Gardner, co-led with Paul Barrios, operating inside THREE International around GLP-THREE.

Three clients, one server, one gateway.

## Surfaces

| Surface | URL | Audience | Port (dev) |
|---|---|---|---|
| `apps/com` | `teammagnificent.com` | Prospect-facing | `7701` |
| `apps/team` | `teammagnificent.team` | Brand Ambassador | `7702` |
| `apps/admin` | `admin.teammagnificent.team` | Kevin only | `7703` |
| `server` | `localhost:7700/api` | Shared API | `7700` |

## Architecture

Every persistent write fans to MongoDB + Neo4j + ChromaDB through the Universal Gateway at `localhost:2525`. THREE International is the final authority on sponsorship, enrollment, placement, and compensation — this system mirrors THREE for operational visibility, never overrides it.

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
npm install
npm run dev
```

Runs server (7700) and all three clients (7701/7702/7703) in parallel.

## License

UNLICENSED — internal project. Do not distribute.
