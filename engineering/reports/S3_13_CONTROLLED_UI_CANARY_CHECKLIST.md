# S3.13 — Controlled UI Canary Checklist (Michael Runtime Support Card)

**Slice:** Sprint 3 S3.13
**Route:** `POST /api/michael-runtime/resolve`
**Surface:** `apps/team` (`.team`) cockpit — `MichaelRuntimeSupportCard`
**Environment:** local / controlled non-production only

Cross-references:
- `engineering/reports/SPRINT_003_S3_11_SERVER_OWNED_ROUTE_UI_WIRING_VERIFICATION.md` (route/UI wiring — upstream)
- `engineering/reports/S3_12_BODY_BA_REJECTION_CONTROLLED_CANARY_CHECKLIST.md` (body/BA rejection canary — sibling)
- `server/src/routes/michael-runtime.ts` (route)
- `server/src/config/michaelRuntimeFlags.ts` (three-axis kill switch)
- `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx` (card)

---

## 1. Purpose

Provide a human-runnable, operator-facing canary that observes the live S3.11
server-owned Michael Runtime Support card end-to-end in a controlled local
environment. The canary confirms that, with the route + response flags enabled
**locally only**, the cockpit card auto-invokes the real
`POST /api/michael-runtime/resolve` route on mount and renders the degraded
`safe_fallback` fixture, while leaking no IDs, trace, counters, or internals to
the Brand Ambassador. With the flags off (default), the same card settles into
its calm disabled state driven by the real endpoint.

This is an observation artifact. It enables nothing in production or staging and
expands no Michael runtime capability.

## 2. Scope

The canary verifies only:

- The card loads in the `.team` cockpit.
- With flags default-off, the card shows the calm disabled state from the real
  503 endpoint.
- With route + response flags enabled **locally only**, the card calls the live
  route and renders the degraded `safe_fallback` fixture
  (`michael_safe_fallback_degraded_en`).
- The request body sent by the card contains no forbidden fields (only `{}` or
  `{ language }`).
- No IDs, trace, counters, persistence internals, or server internals reach the
  BA-facing render.

Out of scope: any real `next_training_step` (the retrieval path is deferred —
only `safe_fallback` resolves today), trace inspection, production/staging
enablement, persistence, LLM, or voice.

## 3. `.team` Only

Run this only against `apps/team` (the BA-facing surface). Michael is BA-facing
support only. Do **not** exercise this on `apps/com` (prospect-facing) — Michael
must never appear there.

## 4. Local / Controlled Non-Production Only

Run this only in a local or controlled non-production environment.

## 5. Do NOT Enable Production

Do **not** enable any Michael runtime flag in production. This canary never
touches production env, deployment config, or production data.

## 6. Do NOT Enable Staging Unless Kevin Separately Approves

Do **not** enable any Michael runtime flag in staging unless Kevin has
separately and explicitly approved a staging canary. Absent that approval,
staging stays default-off.

## 7. Required Starting State

Before starting, confirm:

- S3.11 wiring is verified (see the S3.11 verification report — PASS with
  conditions: degraded `safe_fallback` only; flags default-off).
- The S3.12 body/BA rejection canary has been run/verified (sibling checklist).
- `MICHAEL_RUNTIME_ROUTE_ENABLED`, `MICHAEL_RUNTIME_RESPONSE_ENABLED`, and
  `MICHAEL_RUNTIME_TRACE_ENABLED` are all default-off (unset / not `"true"`).
- You hold an authenticated `.team` BA session that has cleared the onboarding
  gate (`requireSteveComplete`) — the route is mounted behind
  `requireAuth + requireSteveComplete`.

## 8. Environment Setup

1. Start the local server on port `7700` (`pnpm dev:server`).
2. Start the local team app on port `7702` (`pnpm dev:team`), or `pnpm dev` for
   server + team together. The Vite dev server proxies `/api → localhost:7700`.
3. Enable the route + response axes **locally only** (see example values in
   section 18). Keep the trace axis OFF for this canary.
4. Restart the local server so the env is read (flags are read at call time, but
   restart guarantees a clean controlled state).
5. Sign in as a controlled local `.team` BA and clear the onboarding gate.

Flag axes (from `server/src/config/michaelRuntimeFlags.ts`) — each is
default-OFF and enabled only by the exact string `"true"`:

- `MICHAEL_RUNTIME_ROUTE_ENABLED` — Axis 1; route does any work at all.
- `MICHAEL_RUNTIME_RESPONSE_ENABLED` — Axis 2; a resolved response body may be
  returned.
- `MICHAEL_RUNTIME_TRACE_ENABLED` — Axis 3; redacted trace may be included. Keep
  OFF.

## 9. Canary Steps

1. Open the team cockpit at `http://localhost:7702/cockpit`.
2. Confirm the **Michael · Training Support** card loads (heading visible, no
   crash).
3. With flags default-off (before enabling), confirm the card shows the calm
   **disabled** state — "Michael is your training guide. When it's switched on…"
   plus "Not available yet". This is driven by the real 503
   `michael_runtime_disabled` response, not a hardcoded placeholder.
4. Enable `MICHAEL_RUNTIME_ROUTE_ENABLED=true` and
   `MICHAEL_RUNTIME_RESPONSE_ENABLED=true` **locally only**; keep
   `MICHAEL_RUNTIME_TRACE_ENABLED` off. Restart the local server.
5. Reload `/cockpit`.
6. Confirm the card calls the live route on mount (one `POST` to
   `/api/michael-runtime/resolve`).
7. Confirm the degraded `safe_fallback` text renders (calm guidance copy; no
   "next step" block, because the degraded fixture carries none).
8. Confirm no IDs, trace, counters, persistence internals, or other server
   internals are visible anywhere in the card.
9. Confirm the request body the card sends carries no forbidden fields — it must
   be `{}` (or `{ "language": "en" | "es" }` if a hint is set), never `turn`,
   `runtimeTurn`, `contextPacket`, `baId`, `sponsorBaId`, `targetBaId`, a token,
   or any id.

## 10. Expected UI Result

- **Flags off (step 3):** calm disabled state — guide framing + "Not available
  yet". Read-only.
- **Route + response on (step 7):** the degraded `safe_fallback` guidance
  paragraph renders (the card's `safe_fallback` branch). No "Your next step"
  block appears (the degraded fixture provides no `nextStep`). The trailing
  "Guidance · …" line is not shown for `safe_fallback` (that line is on the
  `success` branch only).
- In every state the card is read-only and leak-free. The only affordance is the
  read-only "Try again" button, which appears only on the generic error state.

## 11. Expected Network Result

The single `POST /api/michael-runtime/resolve`:

- HTTP **200**.
- JSON `ok: true`.
- `response.responseType` is `safe_fallback`.
- `catalogKey` corresponds to the degraded fixture
  (`michael_safe_fallback_degraded_en`).
- No `trace` key in the payload (trace axis is OFF).
- The request body observed on the wire is `{}` (or `{ "language": … }`) — no
  forbidden fields.

## 12. Expected Server Result

- The route passes both kill-switch axes (route + response enabled), validates
  the server-owned body, derives BA scope from `req.session.baId` alone, builds
  the server-owned degraded turn via the S3.10 turn source, and resolves through
  the inert S2.20 facade.
- The fixture is degraded and fail-closed: `agentResponseGenerated: false`,
  `persistence: "disabled"`. No persistence write occurs (no MongoDB / Neo4j /
  ChromaDB / Gateway / GraphRAG). No LLM call. No voice path. No text generated —
  the response is a pre-authored fixture returned by reference.

## 13. Expected Observability Counter Behavior

- A successful resolve increments the in-memory `successfulFacadeResolutions`
  counter (module-level integer; no PII, body, response, trace, or IDs stored).
- If you need to confirm the counter, read it via the admin-only endpoint
  `GET /api/admin/michael-runtime/observability`. This is **admin-only** (Kevin /
  operator) — do **not** expose it to the BA and do not surface counter values in
  the `.team` UI.
- Counter inspection is optional. The canary's primary evidence is the UI state
  and the 200 / `safe_fallback` network result.

## 14. Evidence To Collect

Collect only:

- The HTTP status code (`200` enabled; `503` / `michael_runtime_disabled`
  default-off).
- `response.responseType` (`safe_fallback`) and `catalogKey`.
- The visible UI state (disabled state, or degraded safe-fallback text rendered).
- Optionally, the admin-only `successfulFacadeResolutions` counter value
  (operator-side, not from the BA UI).

When recording UI state, describe it in words. If a screenshot is unavoidable,
capture only the card region and ensure it contains no PII, no real BA/prospect
identifiers, and no cookies/session data.

## 15. Evidence NOT To Collect

Do **not** collect or store:

- Cookies or auth headers.
- Session IDs, turn IDs, correlation IDs, context-packet IDs.
- Raw Context Packets.
- Raw traces.
- Request bodies containing real data.
- Prospect data or any PII.
- Screenshots containing real BA/prospect data.
- Server logs containing request/response bodies.

## 16. Rollback

1. Unset the local canary flags:

```bash
unset MICHAEL_RUNTIME_ROUTE_ENABLED
unset MICHAEL_RUNTIME_RESPONSE_ENABLED
unset MICHAEL_RUNTIME_TRACE_ENABLED
```

PowerShell equivalent:

```powershell
Remove-Item Env:\MICHAEL_RUNTIME_ROUTE_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:\MICHAEL_RUNTIME_RESPONSE_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:\MICHAEL_RUNTIME_TRACE_ENABLED -ErrorAction SilentlyContinue
```

2. Restart the local server so the default-off state is reloaded.
3. Reload `/cockpit` and confirm the card returns to the calm **disabled** state
   driven by the real 503 endpoint.
4. Do not commit any local environment change. Keep only status/state evidence in
   the verification notes.

## 17. Pass / Fail Table

| ID | Check | Expected | Observed | Pass? | Notes |
|---|---|---|---|---|---|
| C1 | Cockpit card loads (`/cockpit`) | Card visible, no crash | | | |
| C2 | Flags default-off → disabled state | Calm "Not available yet" via real 503 | | | |
| C3 | Enable route + response locally; reload | Card re-invokes route on mount | | | |
| C4 | Live network call | `POST /api/michael-runtime/resolve` → 200, `ok:true` | | | |
| C5 | Degraded fixture renders | `response.responseType` = `safe_fallback` text shown | | | |
| C6 | No IDs / trace / counters / internals in UI | None visible | | | |
| C7 | No `trace` key in payload (trace off) | Absent | | | |
| C8 | Request body has no forbidden fields | `{}` or `{language}` only | | | |
| C9 | (Optional) admin counter increments | `successfulFacadeResolutions` +1 (admin-only) | | | |
| C10 | Rollback restores disabled state | Calm disabled state returns | | | |

## 18. Stop Conditions

Stop immediately and do not proceed if the canary appears to require any of:

- Production or staging enablement (staging only if Kevin separately approves).
- Committing `.env` / deployment / flag changes.
- Adding these flags to `.env.example` (do **not** add unless Kevin explicitly
  approves).
- Logging real request/response bodies, cookies, or session data.
- Persisting request/response evidence or any PII.
- A real `next_training_step` (only degraded `safe_fallback` exists today).
- Reading or rendering trace, IDs, counters, or internals in the BA UI.
- LLM calls or dynamic text generation.
- Voice / Telnyx / PSTN / call-control.
- `.com` changes, or Michael appearing on any prospect-facing surface.
- Any `/api/runtime/*` route, or accepting a client `turn` / `runtimeTurn` /
  `contextPacket` / body BA authority.

---

### Example local env values (do NOT commit)

For the controlled local canary only — set these in your shell, not in a tracked
file:

```bash
# LOCAL CANARY ONLY — do not commit; do not add to .env.example unless Kevin approves.
MICHAEL_RUNTIME_ROUTE_ENABLED=true
MICHAEL_RUNTIME_RESPONSE_ENABLED=true
MICHAEL_RUNTIME_TRACE_ENABLED=false
```

Only the exact string `"true"` enables an axis; anything else leaves it
disabled. Keep `MICHAEL_RUNTIME_TRACE_ENABLED` off for this canary. Do **not**
commit these values and do **not** add them to `.env.example` unless Kevin
explicitly approves.
