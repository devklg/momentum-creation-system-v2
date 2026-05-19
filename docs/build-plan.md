# Build Plan — Momentum Creation System

No time estimates. Phases ship in order. Each phase ends with a working deliverable.

## Phase 0 — Scaffolding (current)

Fresh repo, monorepo layout, locked-spec docs, gateway client wired, first triple-stack write.

**Build:**
- npm workspaces: `apps/com`, `apps/team`, `server`, `packages/shared`
- Brand tokens and compliance constants in `packages/shared`
- Gateway client in `server/src/services/tripleStack.ts`
- Initial commit and push to `devklg/momentum-creation-system`

**Acceptance:**
- Repo cloned at `D:/momentum-creation-system`, pushed to GitHub
- A bootstrap record exists in MongoDB + Neo4j + ChromaDB confirming triple-stack works
- `npm run typecheck` passes across all workspaces

## Phase 1 — Prospect flow on `.com` (pages 1, 2, 3, 4, 5, 6, 7)

The complete prospect demonstration end to end. This is the part Kevin has been trying to build for a year.

**Build:**
- `server/src/domain/inviteToken.ts` — mint, resolve, expire; sponsor immutable at mint
- `server/src/domain/pool.ts` — monotonic position assignment on `video_complete`; never reshuffles
- `server/src/domain/prospect.ts` — holding-tank record with 8-week flush
- `server/src/domain/callbackRequest.ts` — the only explicit prospect form action
- `server/src/routes/p.ts` — `GET /api/p/:token`, `POST /api/p/:token/video-complete`, `GET /api/p/:token/pool-state`, `POST /api/p/:token/callback-request`
- `server/src/services/realtime.ts` — WebSocket for the "behind you" counter
- `apps/com` Vite client with seven pages: public landing, `/p/{token}` (two states), `/p/{token}/sent`, expired/invalid, system error, 404

**Acceptance:**
- A token minted by the gateway resolves to a BA replicated site at `/p/{token}` pre-placement
- `POST /api/p/:token/video-complete` writes a pool entry with a monotonic position, triple-stack
- The dashboard at `/p/{token}` post-placement renders all six locked sections
- `/p/{token}/sent` confirms after `POST /api/p/:token/callback-request`
- 8-week flush job purges expired prospects
- No income claims, no placement promises, no AI prospecting, no comp math, no current head count on any `.com` page

## Phase 2 — BA enters the system (pages 8–16)

Access-code signup, sponsor confirmation, account creation, email verification, login, password reset.

**Build:** TBD when Phase 1 ships.

## Phase 3 — Welcome, Michael, training (pages 17–26)

Welcome gate, onboarding walkthrough, Michael voice agent integration, training surfaces.

**Build:** TBD when Phase 2 ships.

## Phase 4 — Operational tools (pages 27–32)

BA cockpit, prospect detail view, Launch Studio, holding tank BA view, Relationship Engine, BA profile editor.

**Build:** TBD when Phase 3 ships.

## Phase 5 — Admin & leadership (pages 33–37)

Admin cockpit, tenant & compliance settings, access codes panel, leader rollup, broadcast.

**Build:** TBD when Phase 4 ships.

## Phase 6 — Memory, system states, account, support (pages 38–46)

Agent memory interface, empty states, error states, account settings, help, compliance reference.

**Build:** TBD when Phase 5 ships.
