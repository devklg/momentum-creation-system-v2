# P5.1 — Production / Staging Environment Inventory

- Phase: Phase 5 — Michael Production Enablement and Operations
- Slice: P5.1 — environment inventory (documentation only)
- Status: **DOCUMENTATION ONLY.** No `.env` read from a real deployment, no secret value recorded,
  no config changed. Grounded in the tracked `.env.example` template, the port registry, and
  on-disk source. No secrets are transcribed — only variable **names**, **purpose**, and
  **prod-vs-dev posture**.
- Date: 2026-07-01
- Depends on: `SPRINT_005_P5_READINESS_AND_DEPENDENCY_GATE_ASSESSMENT.md` (gate lifted, doc mode).
- Owner: Agent C (documentation)

> This is a reference inventory for the Phase 5 runbook (P5.2), incident SOP (P5.4), rate-control
> design (P5.6), and monitoring review (P5.7). It lists **what an operator must set / verify** in a
> production or staging environment. It sets nothing.

---

## 1. Surfaces and ports

Locked in `PORT-REGISTRY.md`; do not change a port without updating the registry.

| Surface | Workspace | Port (env) | Public URL (env) | Audience |
|---|---|---|---|---|
| Express API | `server/` | `SERVER_PORT=7700` | (behind the three app domains via `/api`) | Shared |
| `teammagnificent.com` | `apps/com` | `COM_PORT=7701` | `COM_PUBLIC_URL=https://teammagnificent.com` | Prospects |
| `teammagnificent.team` | `apps/team` | `TEAM_PORT=7702` | `TEAM_PUBLIC_URL=https://teammagnificent.team` | Brand Ambassadors |
| `admin.teammagnificent.team` | `apps/admin` | `ADMIN_PORT=7703` | `ADMIN_PUBLIC_URL=https://admin.teammagnificent.team` | Kevin only |

Each Vite client proxies `/api → server`. JWT cookie is scoped to `.teammagnificent.team` so
`apps/team` and `apps/admin` share the session.

## 2. Michael runtime enablement flags (NOT in `.env.example` — by design)

The most operationally-critical production variables for Phase 5. They are **not** shipped in
`.env.example` because the route ships default-OFF and each axis is read directly from `process.env`
at call time (`server/src/config/michaelRuntimeFlags.ts`). An operator sets these **only** during a
controlled, approved enablement (P5.2 / P5.3).

| Variable | Axis | Default (unset) | Enabled by | Effect when off |
|---|---|---|---|---|
| `MICHAEL_RUNTIME_ROUTE_ENABLED` | 1 — route | OFF | exact string `"true"` | 503 `michael_runtime_disabled` |
| `MICHAEL_RUNTIME_RESPONSE_ENABLED` | 2 — response body | OFF | exact string `"true"` | 503 `michael_runtime_response_disabled` |
| `MICHAEL_RUNTIME_TRACE_ENABLED` | 3 — redacted trace | OFF | exact string `"true"` | success omits `trace` |

Only the exact four-character lowercase `true` enables an axis. `"TRUE"`, `" true "`, `"1"`, `"yes"`,
`""`, and any other value leave the axis **disabled** (fail-closed). **Prod/staging secret managers
must be able to set exactly `true`** — a near-miss silently keeps the axis off (safe, but surprising).

## 3. Persistence configuration (S1.3 direct-cutover surface)

Production runtime defaults to the Universal Gateway HTTP path; direct adapters exist but are
cutover-gated. **Note:** per the standing write-freeze, the MCS-V2 dedicated stores (the gateway's
`*2` tool set) remain empty and must not be written until approved schemas exist — direct cutover to
them cannot occur in Phase 5.

| Variable | `.env.example` default | Prod/staging note |
|---|---|---|
| `GATEWAY_URL` | `http://localhost:2526/api` | Dev tooling endpoint. **Gateway is not the production persistence layer** (prod topology: app writes direct to hosted stores). Point at the correct env's gateway only for dev/verification. |
| `MONGODB_URI` / `MONGODB_DB` | `mongodb://127.0.0.1:28000` / `momentum` | Prod → hosted (Atlas) URI; secret. |
| `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` | `bolt://127.0.0.1:7687` / `neo4j` / (empty) | Prod → hosted (Aura); password is a secret. |
| `CHROMA_URL` | `http://localhost:8100` | Prod → hosted Chroma Cloud. |
| `GPU_EMBEDDER_URL` / `GPU_EMBEDDER_REQUIRED` | `http://localhost:8300` / `true` | Chroma direct mode needs an embedder; **no CPU fallback**. Prod → hosted embeddings. |
| `PERSISTENCE_DIRECT_ENABLED` | `false` | Master switch for direct adapters. Leave `false` unless a cutover is approved. |
| `PERSISTENCE_MONGO_MODE` / `PERSISTENCE_NEO4J_MODE` / `PERSISTENCE_CHROMA_MODE` | `gateway` | Per-store `gateway` vs `direct`. |

## 4. Auth / admin gate

| Variable | `.env.example` value | Prod/staging note |
|---|---|---|
| `JWT_SECRET` | placeholder | **Must** be a long random secret per environment. Never shared/committed. |
| `JWT_COOKIE_DOMAIN` | `.teammagnificent.team` | Enables team↔admin session propagation. |
| `JWT_COOKIE_NAME` | `mcs_session` | — |
| `JWT_TTL_REMEMBER_DAYS` | `30` | — |
| `ADMIN_BA_IDS` | example placeholders | Comma-separated **real** TM BA IDs allowed into `apps/admin`. TM BA ID is the canonical login identifier. Hard 403 for all others. |

## 5. Domains / CORS / prospect links

| Variable | Prod value (template) | Note |
|---|---|---|
| `COM_PUBLIC_URL` / `TEAM_PUBLIC_URL` / `ADMIN_PUBLIC_URL` | the three prod domains | — |
| `PROSPECT_BASE_URL` | `https://teammagnificent.com` | **PRODUCTION MUST set this** to the public `.com` domain (no trailing slash) or every minted `/p/{token}` link points at localhost. |
| `CORS_ORIGINS` | localhost:7701–7703 + the three prod domains | Server accepts requests only from these origins. |

## 6. Wired-dormant surfaces (empty in dev; degrade, don't crash)

| Variable(s) | Surface | Dormant behavior when unset |
|---|---|---|
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` / `EMAIL_FROM` / `EMAIL_REPLY_TO` | Resend email | `emailDeliveryStatus='skipped'` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | ScriptMaker / Ivory LLM | Throws `AnthropicConfigError`, surface falls back to manual compose. Model default `claude-haiku-4-5-20251001`. **Phase 5 standing prohibition: no LLM calls** — this key must stay unset for anything Phase-5-scoped. |
| `WEBINAR_REGISTER_URL` | Webinar Zoom link | Seeder leaves `zoomUrl` unseeded. |

## 7. Telephony (Telnyx) — out of Phase 5 scope

`TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_FROM_NUMBER`,
`TELNYX_WEBHOOK_URL`. **Standing prohibition: no voice/Telnyx/PSTN/call-control in Phase 5.** These
stay unset for any Phase-5 enablement. Listed only so an operator does not set them believing they
are required for Michael runtime — they are not.

## 8. Operator pre-flight (what P5.2 will consume)

Before any controlled enablement, an operator confirms in the target environment:

1. The three `MICHAEL_RUNTIME_*` flags are **unset / off** at baseline (§2).
2. `ADMIN_BA_IDS` contains the real admin TM BA ID(s); `apps/admin` 403s everyone else (§4).
3. `JWT_SECRET` is a strong per-environment secret; cookie domain correct (§4).
4. `PROSPECT_BASE_URL` and `CORS_ORIGINS` are the correct prod/staging values (§5).
5. `ANTHROPIC_API_KEY` and all `TELNYX_*` are **unset** for Phase-5 scope (§6, §7).
6. Persistence stays on the approved path; no write to the write-frozen MCS-V2 `*2` stores (§3).
7. The deploy model re-reads `process.env` on restart (flags are call-time; a stale process would
   not observe a flag change).

## 9. Non-approval

This inventory records **no** secret value and authorizes **no** change to any environment. Setting
any variable above in a real environment — especially the `MICHAEL_RUNTIME_*` flags — requires the
P5.2 runbook and Kevin's explicit, recorded, execution-time approval (P5.3).
