# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Automatic context lifecycle

ACR-0017 project hooks in `.codex/hooks.json` inject the living continuation
foundation at session and subagent start, then run the ACR-0014 memory guard on
the first user prompt. Review and trust the project hook through `/hooks` after
its definition changes. If the injected context says the inbox or guard is
unavailable, do not treat that as absence; run the documented session-start
query and `pnpm memory:guard "<topic>"` manually before substantive work.

## Repo orientation — read these first

Before writing code in this repo, read in this order:

1. `docs/READ-ME-FIRST.md` — 60-second orientation. Names the four artifacts that hold "what's built / what's next" so you don't have to ask Kevin.
2. `docs/AGENT-BRIEFING.md` — three-layer orientation (identity, architecture, pointers). End-to-end. Do not skip.
3. `docs/locked-spec.md` — the authoritative spec. Read **only** the Part(s) you're touching. When this file conflicts with the codebase, the file wins.
4. `docs/build-registry.md` — what's done, what's pending, what supersedes what. Consult before asking "is X done?"
5. `docs/project-wireframe.md` — the build map. Leaf-level status (`[x] / [~] / [ ]`) grounded in disk AND section-numbered (e.g. "4.J audit-log substrate") that worktree task briefs reference. Tick leaves when work lands.

**Worktree task brief — read before anything else.** Worktrees often carry a chat-numbered brief (`TASK-134.md`, `TASK-130.md`, etc.) that supersedes the repo-tracked `TASK.md` (which may be a stale brief from a prior branch that shipped on `main`). If both exist, the chat-numbered one wins — it states branch scope, what already exists (don't rebuild), the leaves you own in `docs/project-wireframe.md`, shared-file append-only rules, and the heartbeat row (see "Parallel-batch coordination" below). When in doubt, the brief itself usually says which to read.

The five `.docx` design files (`Team-Magnificent-ADMIN-Design.docx`, `Team-Magnificent-COM-Design.docx`, `Team-Magnificent-TEAM-Design.docx`, `Team-Magnificent-App-Description.docx`, `Team-Magnificent-Signup-Architecture.docx`) are the surface-level design references — read the one that covers the surface you're changing.

Additional reference material in [docs/](docs/) — pull these in when relevant, not by default:

- `chat-XX-decisions.md` and `chat84-vs-docs.md`, `chat-94-locked-spec-rewrite.txt` — historical record of decisions from past chat sessions. Useful when "why was this done this way" matters and the answer isn't in `build-registry.md`.
- `page-inventory.md` — canonical list of routes/pages per surface.
- `dashboard-prototype.md` — early prototype notes for the prospect dashboard (still a useful intent reference).
- `Team-Magnificent-App-Style-Guide.html` — rendered style guide; brand truth lives in [packages/shared/src/brand.ts](packages/shared/src/brand.ts), this is the visual companion.
- `build-*.cjs`, `render-flow.cjs` — generators that produce the `.docx` design files from source. Don't edit the `.docx` directly; edit the source and regen.
- `build-plan.md`, `build-checklist.html` — older planning artifacts; `project-wireframe.md` is the live successor.
- `chat-registry-authority.md` and `handoff-contract.md` — registry identity authority plus attached handoff shape. See "Decision currency, mirrored queues, and handoffs" below.

## Decision currency, mirrored queues, and handoffs

The wireframe is the source; everything else is a mirror. When sources disagree, the precedence (from `docs/READ-ME-FIRST.md`) is:

> decision ledger (currency) > `docs/locked-spec.md` (state) > design docs > `docs/build-registry.md` > git log > agent chat registry > handoffs.

Three Mongo collections back this up — query them through approved agent tooling, don't try to read the wireframe by hand when you need a list:

- `momentum.work_queue_leaves` — 1 row per leaf in `docs/project-wireframe.md`. Pull next work with `{status:"pending", surface:"team"}` sorted by `seq`. Regenerated from the wireframe by `node server/scripts/sync-queue-from-wireframe.mjs`; never hand-edit it independently of the wireframe.
- `momentum.decisions` — append-only decision ledger. Resolve "which version is current?" with `{topic:X, status:"active"}`. The `handoff-contract` row (`_id=dec_handoff_contract`) is the canonical example.
- `momentum.agent_status` — heartbeat row per parallel-batch agent (e.g. `_id:"agent_michael"`). When a worktree brief gives you a row id, `$set` your `state` (`in_progress | typecheck_green | ready_to_merge | blocked`), `current_leaf`, `last_commit`, `note`, and `updated_at` at: start, each leaf done, typecheck green, ready to merge, and on block. Update only — never upsert; the row is pre-seeded by the chat that dispatched the batch.

**When you finish a leaf:** (1) tick the checkbox in `docs/project-wireframe.md`, (2) run `node server/scripts/sync-queue-from-wireframe.mjs` to regenerate the leaf queue, (3) run `node server/scripts/build-checklist.mjs` to regenerate the printable checklist. Don't tick the queue separately — that drift is exactly the disease this system was built to cure.

**Chat registry authority:** canonical chat/thread identity lives in the external agent-operations registry, mirrored to graph and vector stores for retrieval. Claude chats, Codex threads, ARCHIE transcripts, Perry handoffs, decisions, learning notes, and derived memory must link to a registry row. Claude and Codex are the active chat providers. Perry and `session_handoffs` are handoff tools/layers, ARCHIE is a Claude transcript import pipeline, specialist tools are invoked roles/tools, and GraphRAG is derived memory. Those tools/layers have no autonomous session identity and no authority over chat numbering. See `docs/chat-registry-authority.md`.

**Session handoff:** every handoff writes to the external agent-operations handoff store, with `_id: handoff_chat_{N}`, matching numeric `chat_number: {N}`, and `chat_registry_id`. The contract is `docs/handoff-contract.md`; if a handoff conflicts with `chat_registry`, the registry wins and the handoff is evidence to reconcile.

## Worktree / parallel-branch model

Feature work happens in parallel git worktrees. Each worktree root has a scoped `TASK.md` defining: what to build, what already exists (don't rebuild), open questions to ask Kevin, and merge order vs. other in-flight branches. Read it FIRST.

**Append-only rule on shared files to prevent merge collisions:**
- `packages/shared/src/types.ts` — only APPEND new exports; never edit existing ones.
- `server/src/index.ts` — only add new route imports/mounts; touch no existing line.

Commits are tagged with the originating chat number (`Chat #130 - <summary>`), mirroring the chat-indexed history in [docs/build-registry.md](docs/build-registry.md). Kevin merges; agents commit to the feature branch and stop.

## Common commands

This is a **pnpm 9 workspace, Node ≥ 22**. The default `pnpm dev` script only starts `apps/team` + `server` — use `dev:all` for everything.

```bash
pnpm install
pnpm dev              # server (7700) + apps/team (7702)
pnpm dev:all          # all four (server + com + team + admin)
pnpm dev:server       # server only — port 7700
pnpm dev:com          # apps/com only — port 7701 (prospect-facing)
pnpm dev:team         # apps/team only — port 7702 (BA-facing)
pnpm dev:admin        # apps/admin only — port 7703 (Kevin-only)

pnpm typecheck        # repo-wide (-r)
pnpm build            # repo-wide (-r) — runs in package topo order
pnpm build:shared     # @momentum/shared must build before consumers

pnpm clean            # rm -rf dist node_modules in every workspace
```

Per-workspace filters use `pnpm --filter @momentum/<name>` (path-glob filters break on Windows PowerShell — always use the package name).

### Server-side seeders and one-shots

Run from `server/` (or via `pnpm --filter @momentum/server <script>`):

```bash
pnpm seed:codes                       # seed access codes
pnpm seed:founders                    # seed TM-01 Kevin + TM-02 Paul
pnpm backfill:founder-timezones       # backfill timezone field on founder records
pnpm seed:webinar-events              # idempotent rolling-8-week webinar seeder (Mon/Thu 5pm Pacific)
pnpm setup:founder-access             # founder access scaffolding
```

There is no test runner wired in this repo yet — verification happens via `pnpm typecheck` and end-to-end manual flows against the running dev server.

## High-level architecture

### Three clients, one server, direct persistence

| Surface | Workspace | Port | Audience |
|---|---|---|---|
| `teammagnificent.com` | `apps/com` | 7701 | Prospects — single route `/p/{token}` with two faces |
| `teammagnificent.team` | `apps/team` | 7702 | Brand Ambassadors (login, cockpit, invitations) |
| `admin.teammagnificent.team` | `apps/admin` | 7703 | Kevin only — hard 403 via `ADMIN_BA_IDS` env allowlist |
| Express API | `server/` | 7700 | Shared, mounted at `/api` |
| Shared types/brand/compliance | `packages/shared` | — | `@momentum/shared` workspace |

Each Vite client proxies `/api → localhost:7700`. JWT cookie is scoped to `.teammagnificent.team` so apps/team and apps/admin share the session.

### Server layout

`server/src/` is split: `routes/` (thin Express handlers), `domain/` (pure logic — cockpit projections, schedule windows, code gen, holding-tank), `services/` (direct persistence adapters plus wrappers for telnyx, anthropic, resend, JWT session, in-process SSE pub/sub), `middleware/` (auth, michael-gate, telnyx-verify, og-injection). Runtime is `tsx watch` — edits hot-reload directly; don't compile-then-run.

### The triple-stack persistence rule

**Every app-runtime persistent write lands in the dedicated MCS MongoDB + Neo4j + ChromaDB stack through direct server adapters.** None of the three is optional. The canonical helper is `tripleStackWrite()` in [server/src/services/tripleStack.ts](server/src/services/tripleStack.ts), which calls the dispatch surface in [server/src/services/persistence/dispatch.ts](server/src/services/persistence/dispatch.ts). When adding new persistent app state, write through the app helper/adapters; do not route app runtime writes through external MCP tooling.

**Agent-memory/tooling protocol (Chat #135+):** when Codex/Claude/operator tooling writes external agent memory or lineage records — handoffs, decisions, learning notes, transcripts, imports, derived agent memory — use the schema-enforced multi-store write path required by the agent tooling layer. The write must include the canonical `base` envelope from [docs/graphrag-schema-contract.md](docs/graphrag-schema-contract.md): `id`, `type`, `schema_version`, `namespace`, `source`, `created_at`, `title`, and `origin_kind`, plus the origin-specific field (`chat_number`, `job_id`/`service_name`, or `import_batch_id`). Do not create ad hoc `date`, `timestamp`, `chat`, `synced_chat`, or `start_time` aliases on memory records. This protocol governs external agent memory, not app-runtime persistence.

**Registry numbering rule:** `chat_number` is integer-only. Never put task slugs, dates, or provider titles in `chat_number`. If a Claude/Codex record cannot be proven, register it with `chat_number: null`, `registration_status: "needs_reconciliation"`, provider/thread metadata, and provenance. Kevin corrections are audited overrides, not the normal source of numbering.

Known external-tooling gotchas (for MCP/operator calls, not app runtime dispatch):
- `mongodb.insert` takes `documents:` (plural array), not `document:`
- `mongodb.update` does **not** honor `upsert: true` — branch on existence
- `mongodb.query` parameter is `filter:`, not `query:`; returns `{count, documents}` not the array directly
- `neo4j.cypher` action is `cypher`, parameter is `query`
- ChromaDB `add()` does not auto-create collections — ensure the collection exists first
- ChromaDB requires the Maxwell GPU embedding service on `localhost:8300` for writes

### THREE International is the upstream authority

THREE is the final authority on enrollment, registration, genealogy, and patronage. This system **mirrors** THREE for the slice that is Kevin's downline — never overrides. There is **no programmatic enrollment handoff to THREE** and no registration-handoff route family. BAs walk prospects into THREE off-app, BA-to-BA. (See locked-spec Part 2; standing rules in [packages/shared/src/rules.ts](packages/shared/src/rules.ts).)

### Server boot order is load-bearing

In [server/src/index.ts](server/src/index.ts):

1. **Raw-body routes mount FIRST.** `/api/telnyx` must mount before `express.json()` — Telnyx webhooks are Ed25519-signed over raw bytes; if JSON parses first the signature is unverifiable. Do not reorder.
2. **Pre-gate routes** (`/api/health`, `/api/auth`, `/api/welcome`, `/api/michael`, `/api/admin/*`, `/api/p`) must **not** use `requireSteveComplete`. These are how a new BA opens the gate (or, for `/api/p`, are prospect-facing with no auth at all).
3. **BA-facing gated routes** mount below the marked banner and must apply `(requireAuth, requireSteveComplete)` inside the route file. The canonical mount pattern is documented at [server/src/middleware/requireSteveComplete.ts](server/src/middleware/requireSteveComplete.ts) — apply it per-route, never globally. Whitelist lives in `MICHAEL_GATE_WHITELIST` in `domain/michael-schedule.ts`.

> **Onboarding-gate naming:** the on-disk onboarding-complete gate is `requireSteveComplete` ([server/src/middleware/requireSteveComplete.ts](server/src/middleware/requireSteveComplete.ts)). Historical engineering reports may still mention `requireMichaelComplete`; that middleware does not exist. Do not create or assume a `requireMichaelComplete` middleware unless a future approved rename/migration slice explicitly introduces one.

### The pool mechanic and token lifecycle

There is **one shared team-wide pool** (not per-BA). Position in that pool is **monotonic**: timestamps anchor positions at `video_complete`; flushes vacate slots but never renumber. The token states are:

`minted → clicked → video_started → video_quarter → video_half → video_three_quarter → video_complete → callback_requested | webinar_reserved → enrolled | expired`

The `/api/p/:token` endpoint resolves the token to a `ResolvedTokenPayload` and drives whether `apps/com` renders the presentation page or the six-section dashboard. Token-lifecycle edge cases return 409 (enrolled) and 410 (expired) with `EnrolledResponse` / `ExpiredResponse` shapes in `@momentum/shared`. Lazy-flush happens at read time in [server/src/routes/p.ts](server/src/routes/p.ts). Real-time updates to the dashboard use SSE via `services/poolEvents.ts` (in-process EventEmitter, snapshot + placement + 30s heartbeat).

### Sponsor immutability

Sponsor is captured at the moment the invite token is minted (prospects) or the access code is used (BAs) and is **never recomputed**. Any route that accepts a `sponsorBaId` in the body must reject it and use the token-derived or code-derived value instead. The one exception is Kevin's BA-requested admin override (audited).

### Access codes

Format: `TM-XXXX` — 4 chars from a 31-char alphabet (no `0/O/1/I/L`). One per BA for life. Reused for every BA they sponsor. **Only Kevin can mint codes**, only from `/admin`.

### Two LLM/email surfaces are wired-dormant

`EMAIL_API_KEY` (Resend) and `ANTHROPIC_API_KEY` (ScriptMaker / Ivory) are intentionally empty in dev. When unset, the surfaces degrade — Resend records `emailDeliveryStatus='skipped'` and ScriptMaker falls back to manual compose — rather than crashing boot. Sends/drafts begin the moment the key lands in `.env`; no code change required.

## Compliance — never on `.com`

The five things that must never appear on `apps/com` (prospect-facing):

1. Income claims, earnings projections, commission figures, cycle math
2. Placement promises (queue position ≠ binary leg position)
3. AI prospecting language (Michael is BA-facing only, never prospect-facing)
4. Current team head count (the 100,000 goal is named; the count is not)
5. THREE International branding (no logo, no name, no "independent promoter" disclaimer)

Enforcement lives at script-time (ScriptMaker refuses noncompliant drafts) and render-time (fail closed). `/admin` shows aggregated enforcement metrics — never a manual review queue. Compliance constants are in [packages/shared/src/compliance.ts](packages/shared/src/compliance.ts) and [packages/shared/src/rules.ts](packages/shared/src/rules.ts).

## Parallel worktrees — append-only at merge points

Multiple feature branches run in parallel worktrees against the same `main`. To prevent merge collisions, changes to high-traffic shared files must be **append-only**:

- `packages/shared/src/types.ts` — append new type blocks at the bottom. Never edit, rename, or reorder existing exports.
- `server/src/index.ts` — add only your route import line and mount line (between the marked banners). Never touch existing lines.
- Commit to the feature branch only. Kevin merges to `main` — agents never do.

When a worktree task lands, it usually carries these rules verbatim in its `TASK.md`. Follow them even if a "cleaner" edit looks tempting.

## Conventions

- **TypeScript strict mode + `noUncheckedIndexedAccess`** is on repo-wide via [tsconfig.base.json](tsconfig.base.json).
- Shared types live in [packages/shared/src/types.ts](packages/shared/src/types.ts) — import via `@momentum/shared`. The team app sometimes uses local wire types ("`.team` TS6059 convention") to sidestep cross-workspace type composition issues.
- Brand tokens are exact and verbatim — never paraphrase. Defined in [packages/shared/src/brand.ts](packages/shared/src/brand.ts) and `brand.css`. Display font Bebas Neue, body DM Sans, mono DM Mono.
- Vocabulary discipline: never "leads," "sales pipeline," "pitch," or cold-outreach "prospecting" in user-facing copy. BAs are **sharers**, not salespeople.
- Don't pre-read design docs as authorization to scaffold from them. Ask Kevin what to build first.

## Environment

- `.env` is gitignored. Copy `.env.example` to `.env` for local dev. The env loader walks up from the running module to the `pnpm-workspace.yaml` marker — never trust `import.meta.url` path math for env loading.
- `ADMIN_BA_IDS` is a comma-separated allowlist of TM BA IDs (e.g. `TMBA-YYYYMMDD-XXXXXX`) that gate access to `apps/admin`. The TM BA ID is the canonical login identifier — THREE BA ID and email are tracked on the record but never authenticate.
- `.handoff/` and `.build/` are gitignored — they hold per-session throwaway tooling (Perry handoffs, build scripts). Do not commit anything in them.
