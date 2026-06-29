# Sprint 3 · S3.9 — `.team` Michael Runtime UI · Final Integration & Verification

**Agent:** Agent E (final integrator)
**Date:** 2026-06-28
**Slice:** S3.9 — read-only Michael Runtime Support card in `/cockpit` (`.team` BA-facing)
**Scope discipline:** no production code modified by this integration, no flags flipped, no commit/push performed. Only this report file was created.

---

## 1. Executive result

**PASS WITH CONDITIONS.**

S3.9 shipped a compliant, read-only, leak-free Michael runtime *training support* card rendered in the `.team` cockpit. The full gate suite is green: repo-wide `build:shared` / `typecheck` / `build` succeed, the explicit `apps/team` typecheck succeeds, the entire server vitest suite passes (75 files / 872 tests), and the new S3.9 server-side static governance boundary passes 21/21. Git status shows exactly the four expected files and nothing else (no `.com`, no flag/env edits, no `server/src/index.ts` change).

Two conditions are carried forward and must be stated plainly:

- **Condition A — the live call is intentionally NOT wired (turn-source blocker, S3.8).** There is currently no client-safe producer of a valid `runtimeTurn`. A hand-authored/flat turn yields a 422 contract failure; a valid 200 came only from a test-only fixture harness. Per the S3.9 Critical Data Contract Rule, the UI must not fabricate a Context Packet or turn, so the card renders the calm DISABLED placeholder by default and never auto-invokes `resolveMichaelRuntimeTurn`. The typed helper is implemented and ready, but deliberately left un-invoked until a **server-owned turn source** exists.
- **Condition B — `apps/team` has no behavioral test runner.** There is no `test` script, no `vitest`, and no `@testing-library/react` in `apps/team`. Behavioral UI states are therefore documented manually (Agent C checklist), and executable enforcement of the UI boundary lives SERVER-side as a static source scan (Agent D, 21/21). This is the brief's anticipated fallback: "If no team test command exists, document that honestly and rely on typecheck/build."

Neither condition is a defect — both are documented, intentional design constraints. No gate revealed a real defect; no STOP condition was triggered.

## 2. Files added

- `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx` — the read-only card plus its co-located, leak-free client helper `resolveMichaelRuntimeTurn` (Agent A/B implementation).
- `server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts` — executable static governance boundary (Agent D, 21 assertions).
- `engineering/reports/S3_9_UI_MANUAL_VERIFICATION_CHECKLIST.md` — manual behavioral checklist (Agent C), since `apps/team` has no test runner.
- `engineering/reports/SPRINT_003_S3_9_TEAM_MICHAEL_RUNTIME_UI_VERIFICATION.md` — this report.

## 3. Files modified

- `apps/team/src/routes/cockpit.tsx` — purely additive: one import line and one `<MichaelRuntimeSupportCard />` render line placed immediately after `<AgentSupportPanel />`. No existing line was edited, reordered, or removed (verified by `git diff`: two added lines only).

No other production file was touched. `packages/shared/src/types.ts`, `server/src/index.ts`, `.env`, the flag config, and `apps/com` are all unmodified.

## 4. UI placement

The card renders in `/cockpit` (`apps/team/src/routes/cockpit.tsx`), inside the right-hand `<aside>`, **immediately after `<AgentSupportPanel />`** and before the "My Sponsor" block. It is part of the existing cockpit layout — no new layout container, no relocation of existing content.

## 5. No new route / page

No new route, page, nav entry, or navigation target was added. The card is a component rendered inside the existing cockpit page. `apps/team` routing is unchanged.

## 6. No `.com`

Nothing was added to or imported from `apps/com`. Boundary assertion #20 confirms neither the card nor cockpit imports an `apps/com` / `@momentum/com` surface. Michael remains BA-facing only and never appears on the prospect-facing `.com` surface.

## 7. No admin observability exposed to a BA

The card does not call `/api/admin`, does not pair "admin" with "observability," and surfaces no enforcement counters or metrics. Boundary assertion #7 enforces this on the stripped source. The BA sees only BA-language training guidance, never operational/observability internals.

## 8. No flags flipped

No feature flag was changed. The three-axis kill switch in `server/src/config/michaelRuntimeFlags.ts` remains default-OFF (each axis enabled only by the exact env string `"true"`). No `.env` change appears in git status. This integration did not enable the route, response, or trace axes.

## 9. Route remains default-off

`michaelRuntimeRouteEnabled()`, `michaelRuntimeResponseEnabled()`, and `michaelRuntimeTraceEnabled()` all read env at call time and default to disabled. With the route off and no client-safe turn source, the card's default (and only) live state today is the calm DISABLED placeholder — it does not attempt a resolve.

## 10. Disabled handled calmly

`kind: 'disabled'` (route kill switch / no turn source) renders a calm explanation — "Michael is your training guide. When it's switched on, this is where your next suggested training step shows up…" — plus a muted "Not available yet" label. No error tone, no status code, no internals.

## 11. Response-disabled handled calmly

`kind: 'response_disabled'` (response kill switch, HTTP 503 `reason: michael_runtime_response_disabled`) renders "Michael is on, but training guidance is paused right now. Check back a little later…" — calm, BA-language, no internals.

## 12. Success handled

`kind: 'success'` renders only the safe subset: `text`, the "Your next step" block (`nextStep.title` / `instruction` / `label`), and a `Guidance · {language}` footer. Mapped from a 200 response's `responseType` of `next_training_step` or `clarification_question`.

## 13. Safe fallback

`kind: 'safe_fallback'` (response `responseType: safe_fallback`) renders the safe `text`, with a calm default if empty ("No specific step to suggest right now — keep working your usual training rhythm.").

## 14. Safe close

`kind: 'safe_close'` (response `responseType: safe_close`) renders the safe `text`, with a calm default if empty ("Nothing more to add for now. You're good to keep going.").

## 15. Errors generic

`kind: 'error'` renders a single reassuring line — "Couldn't load a training step just now. Nothing's wrong on your end — try again a little later." All non-200 statuses (400 `MISSING_RUNTIME_TURN` / `BODY_BA_SCOPE_NOT_ALLOWED`, 401, 403 `STEVE_GATE_CLOSED`, 422 contract failure, network failure, malformed JSON, unknown discriminator) collapse to this generic error. No status code, `code`, `issues`, or `reason` string ever reaches the BA.

## 16. Data contract

- **Endpoint:** `POST /api/michael-runtime/resolve` (boundary assertion #1).
- **Request body:** `{ turn }` and nothing else (`JSON.stringify({ turn })`).
- **No BA-authority fields:** the body never includes `baId` / `sponsorBaId` / `targetBaId` / `downlineBaId` / `prospectId` / `token` / `sessionId` / `correlationId`. BA scope is derived server-side from `req.session.baId`; the server additionally rejects any body-supplied BA authority (`BODY_BA_SCOPE_NOT_ALLOWED`). Boundary assertion #2 enforces the client-side absence on stripped source.
- **No raw Context Packet:** the client never assembles or sends a Context Packet — that is exactly the turn-source blocker.
- **Credentials:** `credentials: 'include'` (boundary assertion #3) so the JWT cookie scopes the BA.

The server response carries `selectionRequest`, `catalogKey`, `response`, and optionally `trace`; the helper reads **only** `payload.ok` and `payload.response`'s safe fields and ignores the rest.

## 17. No response persisted

The helper writes nothing to `localStorage` / `sessionStorage` / `IndexedDB` (boundary assertion #8) and stores nothing server-side from the client. The card holds the result only in a local render-scoped value. No persistence path exists.

## 18. No trace stored

`trace` lives at the response top level and is never read by the helper. It is neither stored nor referenced. Boundary assertion #10 confirms no code token references `.trace`/`correlationId`/`contextPacketId` after comment+string stripping.

## 19. No raw trace rendered

No render path maps `trace` (or any redacted-trace field) into JSX. Only the safe display subset is rendered.

## 20. No raw Context Packet rendered

No Context Packet, `selectionRequest`, or `catalogKey` is rendered. Boundary assertion #10 enforces the absence of `selectionRequest` / `catalogKey` code tokens.

## 21. No admin counters

No enforcement counters, success/failure metrics, or observability aggregates are read or rendered. The observability recorders are server-internal only; the card has no access to them.

## 22. No PII / tokens / IDs

No `sessionId`, `turnId`, `correlationId`, `contextPacketId`, prospect/BA IDs, tokens, phone, or email is rendered. The safe subset is strictly `text` / `responseType` / `language` / `nextStep.{title,instruction,label}`.

## 23. No LLM / dynamic generation

The card imports no LLM client and generates no text. Boundary assertion #9 confirms no `openai` / `anthropic` / `@anthropic-ai` / `claude` import or token. All displayed copy is either static authored strings or the contract-validated fixture subset returned by reference from the inert S2.20 facade.

## 24. No voice

No telephony/voice path. Boundary assertion #9 confirms no `telnyx` / `pstn` / `callControlId` / `createCallControl` / `startCall` / `placeCall` token. Michael here is a read-only text guide.

## 25. No send / call / schedule / prospect controls

The card wires no automatic-action handler. Boundary assertion #12 confirms no `sendMessage` / `autoSend` / `autoSubmit` / `scheduleCall` / `callProspect` / `dialProspect` / `autoResolve` / `autoInvoke`. The card frames Michael strictly as a "next training step" guide — it never sends, calls, schedules, or prospects on the BA's behalf, and there is no button that does so.

## 26. No income / compensation / placement language

No income / commission / compensation / placement / cycle / earnings / payout vocabulary appears in user-facing copy or code. Boundary assertion #11 enforces this with a copy-tone scan (comments stripped, string literals retained).

## 27. Accessibility

The card uses a semantic `<section>` with `aria-label="Michael runtime training support"`, a real `<h3>` heading, and `aria-hidden="true"` on the decorative icon. It is non-interactive in its default state (no focus traps, no keyboard hazards); future live states render plain text/structure only. Keyboard-safe by construction.

## 28. Static governance tests + manual checklist + no-team-runner reality

- **Executable enforcement (Agent D):** `server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts` — 21/21 passing. It reads `apps/team` source off disk and scans (comments + string literals stripped for code-token scans; comments-only for copy-tone scans) so the card's defensive doc-comments and string copy never trip a wiring regex. Groups: target-sources-exist (#0), card boundary (#1–#13), cockpit placement (#14–#16), server-invariant regression (#17–#20).
- **Manual behavioral checklist (Agent C):** `engineering/reports/S3_9_UI_MANUAL_VERIFICATION_CHECKLIST.md` documents the per-state behavioral expectations that a behavioral runner would assert.
- **No-team-runner reality:** `apps/team/package.json` has scripts `dev`, `build`, `preview`, `typecheck` only — no `test` script, no `vitest`, no `@testing-library/react`. `pnpm --filter @momentum/team test` is a no-op (exit 0, nothing to run). Behavioral UI assertions therefore rely on the server-side static scan plus the manual checklist, with typecheck/build proving the card compiles and type-checks. This is the brief's anticipated and accepted fallback.

## 29. Gates run and results (ACTUAL)

All gates run from repo root via the Bash tool; counts are verbatim, not fabricated.

| # | Command | Result | Counts |
|---|---------|--------|--------|
| 1 | `pnpm build:shared` | PASS | `@momentum/shared` `tsc -p tsconfig.json` clean |
| 2 | `pnpm typecheck` | PASS | 5 projects: shared, admin, team, com, server — all Done, 0 errors |
| 3 | `pnpm build` | PASS | shared/com/admin/team/server all Done (Vite chunk-size + dynamic-import warnings only; no errors) |
| 4 | `pnpm --filter @momentum/team typecheck` | PASS | `tsc -b` clean, 0 errors |
| 5 | `pnpm --filter @momentum/server test` | PASS | 75 files / 872 tests passed |
| 6 | `pnpm --filter @momentum/server test -- michael-runtime s34MichaelRuntimeRouteGovernanceBoundary s36MichaelRuntimeObservabilityGovernanceBoundary s39MichaelRuntimeUiServerBoundary` | PASS | 8 files / 154 tests passed |
| 6a | `pnpm --filter @momentum/server test -- s39MichaelRuntimeUiServerBoundary` (isolated confirm) | PASS | 1 file / 21 tests passed |
| 7 | `pnpm --filter @momentum/server test -- michaelRuntimeObservability michael-runtime-observability` | PASS | 3 files / 64 tests passed |
| 8 | `pnpm --filter @momentum/server test -- michaelRuntimeResolutionFacade michaelResponseSelectionRequest michaelResponseCatalogSelector michaelResponseCatalog michaelRuntimeAdapterContract michaelResponseContract s220MichaelRuntimeResolutionFacadeGovernanceBoundary` | PASS | 22 files / 306 tests passed |
| 9 | `pnpm --filter @momentum/server test -- michaelResponseContractEsGuardrails michaelResponseContractFailedStrictness` | PASS | 2 files / 34 tests passed |
| 10 | `pnpm --filter @momentum/server test -- mongoAdapter` | PASS | 1 file / 2 tests passed |
| 11 | `pnpm --filter @momentum/team test` | N/A (expected) | no `test` script in `apps/team` — no-op, exit 0 |

**Git status (`git status --short`) — only the expected files:**

```
 M apps/team/src/routes/cockpit.tsx
?? apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx
?? engineering/reports/S3_9_UI_MANUAL_VERIFICATION_CHECKLIST.md
?? server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts
```

No `apps/com` change, no flag/env change, no `server/src/index.ts` change, no `packages/shared/src/types.ts` change. (This report adds a fifth `??` entry once written; it is the only file this integration step created.)

## 30. Recommendation for next slice

1. **Server-owned turn source (prerequisite to wiring the live call).** The single thing standing between this read-only card and a live resolve is a server-owned producer of a valid `runtimeTurn` / Context Packet. Until that exists, fabricating a turn client-side is forbidden. Build the server-owned turn source as its own separately-gated slice; only then flip `resolveMichaelRuntimeTurn` from un-invoked to mounted, behind the existing route/response kill switches.
2. **Targeted body-BA-rejection canary.** Add a focused canary that confirms a body-supplied BA-authority field is rejected end-to-end (`BODY_BA_SCOPE_NOT_ALLOWED`) when the route is enabled, complementing the existing static scan and route unit tests.
3. **(Optional) Add a behavioral test runner to `apps/team`.** Introducing `vitest` + `@testing-library/react` to `apps/team` would let the card's state-rendering and leak-free helper be asserted behaviorally rather than only via the server-side static scan + manual checklist. This is independent of the above and should be its own gated slice.

These are recommendations only — none is in scope for S3.9, and S3.10 is explicitly not implemented here.

---

### Cross-references

- `engineering/reports/S3_9_UI_MANUAL_VERIFICATION_CHECKLIST.md` — Agent C manual behavioral checklist.
- `server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts` — Agent D executable static governance (21/21).
- `engineering/reports/SPRINT_003_S3_8_TEAM_MICHAEL_RUNTIME_UI_PROPOSAL.md` — S3.8 UI proposal (turn-source blocker origin).
- `engineering/reports/SPRINT_003_S3_7_CONTROLLED_CANARY_EXECUTION_RECORD.md` — S3.7 canary record.
- `engineering/reports/SPRINT_003_S3_6_MINIMAL_IN_MEMORY_OBSERVABILITY_VERIFICATION.md` — S3.6 observability verification.
- `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx` — card + helper under verification.
- `apps/team/src/routes/cockpit.tsx` — placement (additive, after `AgentSupportPanel`).
- `server/src/routes/michael-runtime.ts` — server route (`POST /api/michael-runtime/resolve`, session-derived BA scope, three-axis kill switch).
- `server/src/config/michaelRuntimeFlags.ts` — default-off three-axis flags.
