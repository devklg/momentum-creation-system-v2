# Sprint 3 S3.9 — `.team` Michael Runtime UI: Manual Verification Checklist (Agent C)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.9 — `.team` Michael runtime support card implementation verification
- Agent: Agent C (behavioral / visual verification)
- Date: 2026-06-28
- Status: **Documentation-only.** No code, no `.tsx`, no test runner added. This file is the sole artifact.
- Component under verification: [`apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx`](../../apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx)
- Mount point: [`apps/team/src/routes/cockpit.tsx`](../../apps/team/src/routes/cockpit.tsx) (rendered in the cockpit `aside`, immediately after `<AgentSupportPanel />`, line ~784)
- Implements: [`engineering/reports/SPRINT_003_S3_8_TEAM_MICHAEL_RUNTIME_UI_PROPOSAL.md`](SPRINT_003_S3_8_TEAM_MICHAEL_RUNTIME_UI_PROPOSAL.md)

---

## Preamble — why this is a manual checklist, not executable tests

`apps/team` has **no automated test runner**. Its `package.json` scripts are `dev` / `build` / `typecheck` / `preview` only — there is no `vitest`, no `@testing-library/react`, no `jsdom`. Adding a `*.test.tsx` that imports a non-existent runner would be type-checked by `tsc -b` (the typecheck/build gate) and **break the gate**. Therefore Agent C ships **no executable UI tests** this slice; doing so is explicitly out of scope and a build-gate risk.

Executable enforcement of the boundary is instead provided **server-side** by Agent D's static-governance test, **`server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts`**, which runs under the server's existing `vitest`. That test statically scans the `.team` component source (and import graph) for forbidden patterns — it does not render the component. (At the time of writing, Agent D's test is a sibling deliverable in this same slice; cross-references below describe the coverage it provides by static scan.)

**This document** covers the assertions Agent D's static scan **cannot** prove — the behavioral and visual ones that require a human reviewer running the dev server, or a future in-app test runner: does each state actually render the expected copy, is the card visually placed where intended, is the keyboard/screen-reader experience sound, does it look right at zoom. Each item below is grounded in the real component source as it exists on disk; no state, copy string, or field is claimed that the component does not contain.

### How to set up the live environment

```bash
pnpm install
pnpm dev:team        # apps/team on :7702 (proxies /api -> :7700)
pnpm dev:server      # server on :7700 (separate shell) — needed for the cockpit data loads
```

Sign in as a **Steve-complete** BA and open `/cockpit`. The operational cockpit (and therefore the Michael card in the aside) renders only after `launch.steve.phase === 'complete'`; pre-Steve, the cockpit shows `OperationalPmvLocked` and the aside is not rendered.

### Important runtime reality (read before testing states)

The component **does not fetch on mount**. Per the S3.8 turn-source blocker, `MichaelRuntimeSupportCard()` hard-codes `const result = { kind: 'disabled' }` and never invokes `resolveMichaelRuntimeTurn()`. So with the three `MICHAEL_RUNTIME_*` flags off and **no client-safe turn source**, the **live, default, only reachable state is `disabled`**. All other states (`response_disabled`, `loading`, `success`, `safe_fallback`, `safe_close`, `error`) live in the `renderRuntimeResult` switch and are wired for a **future server-owned turn source**. They are reachable for verification **only** by temporarily editing the hard-coded `result` to the target kind in a local working copy — a **throwaway stub that MUST NOT be committed or shipped**. Note this on every non-`disabled` state item below.

---

## The 32 Agent-C assertions → manual verification steps

Legend: `[ ]` = to verify manually. **Auto (D):** assertion is *also* covered executably by Agent D's server-side static scan (see §"Automated vs manual coverage" below). **Manual-only:** requires a human or a future in-app runner.

### A. Rendering / placement (1–4)

- [ ] **1. Card renders in `/cockpit`.** _Manual-only._ As a Steve-complete BA, load `/cockpit`. Confirm a section titled **"Michael · Training Support"** (mono, uppercase, gold Bot icon) appears in the right-hand `aside`.
- [ ] **2. Placed immediately adjacent to Agent Support.** _Manual-only._ Confirm the Michael card renders **directly below the "Agent Support" panel** ("What should I do next? · Steve + Ivory + Michael") in the same `aside`, above "My Sponsor". (Source: `cockpit.tsx` renders `<MichaelRuntimeSupportCard />` on the line after `<AgentSupportPanel ... />`.)
- [ ] **3. Never on `.com` / not importable by prospect surface.** _Auto (D) + Manual._ Static side (Agent D): no `apps/com` file imports `MichaelRuntimeSupportCard`. Manual side: walk every `apps/com` `/p/{token}` face (presentation page + six-section dashboard) and confirm no "Michael / Training Support" card, copy, or link appears anywhere prospect-facing.
- [ ] **4. Gated behind Steve completion.** _Manual-only._ Load `/cockpit` as a **pre-Steve** BA; confirm `OperationalPmvLocked` shows and **no** Michael card renders (the aside is absent). Complete Steve, reload, confirm the card now appears.

### B. State coverage — all 7 `MichaelRuntimeResult` kinds (5–11)

> The switch in `renderRuntimeResult` handles exactly these seven kinds. Verify the **copy** matches the source verbatim. For every non-`disabled` kind, trigger by **temporarily** setting `result` to that kind in a local copy of the component (DO NOT COMMIT), or via the future server turn source once it exists.

- [ ] **5. `disabled` (`michael_runtime_disabled`) — the LIVE DEFAULT.** _Manual-only._ No edit needed; this is what ships today. Confirm: a calm two-paragraph placeholder — body "Michael is your training guide. When it's switched on, this is where your next suggested training step shows up — a calm pointer to what to learn or practice next." followed by the mono eyebrow **"Not available yet"**. Confirm it reads as calm/neutral, **not** an error (no red).
- [ ] **6. `response_disabled` (`michael_runtime_response_disabled`).** _Manual-only (stub)._ Confirm single line: "Michael is on, but training guidance is paused right now. Check back a little later for your next suggested step." Confirm it is **indistinguishable in tone** from "available soon" — no error styling, no internal reason leaked.
- [ ] **7. `loading`.** _Manual-only (stub)._ Confirm single muted line: "Bringing up your next training step…". No spinner is in the source — verify copy only.
- [ ] **8. `success`.** _Manual-only (stub)._ Set `result` to `{ kind: 'success', data: { text: '…', responseType: 'next_training_step', language: 'en', nextStep: { title: '…', instruction: '…', label: '…' } } }`. Confirm: `text` renders as body; a gold-bordered block with eyebrow **"Your next step"**, the `nextStep.title` in display font, `nextStep.instruction` below, `nextStep.label` as a mono eyebrow; and a footer mono line **"Guidance · en"** (the `language` value). Confirm **no** other field renders.
- [ ] **9. `safe_fallback`.** _Manual-only (stub)._ With `text` set, confirm it renders that text. With empty `text`, confirm the fallback default: "No specific step to suggest right now — keep working your usual training rhythm."
- [ ] **10. `safe_close`.** _Manual-only (stub)._ With `text` set, confirm it renders that text. With empty `text`, confirm the default close copy: "Nothing more to add for now. You're good to keep going."
- [ ] **11. `error` (generic).** _Manual-only (stub)._ Confirm single line: "Couldn't load a training step just now. Nothing's wrong on your end — try again a little later." Confirm **no** status code, reason, or internal string appears (the helper collapses 400/401/403/422/500 and network failure all to this one state).

### C. Safety / no-leak (12–18)

> The component maps only a **safe subset** of the response (`text`, `responseType`, `language`, and the three `nextStep` *strings*). Verify nothing else can reach the screen — including in the `success` stub from item 8, where you should add extra fields to the mock response object and confirm they are ignored.

- [ ] **12. No raw `trace`.** _Auto (D) + Manual._ Static: component never reads `payload.trace`. Manual: in the success stub, the response object passed to the render path carries no `trace`; confirm nothing trace-like ever appears even if axis-3 were on.
- [ ] **13. No raw Context Packet.** _Auto (D) + Manual._ Static: no `contextPacket` / `rawStoreResults` / `rawGraphRagResults` / `rawGatewayFallbackResponse` reference. Manual: confirm no packet/retrieval/Gateway dump renders in any state.
- [ ] **14. No admin observability counters.** _Auto (D) + Manual._ Static: no `routeDisabledSkips` / `responseDisabledSkips` / `successfulFacadeResolutions` / `facadeFailures` / `bodyBaOverrideRejections` / `missingTurnRejections` strings. Manual: confirm no counter, tally, or flag-state badge renders.
- [ ] **15. No token / session / correlation IDs.** _Auto (D) + Manual._ Static: no `sessionId` / `turnId` / `correlationId` / `contextPacketId` read. Manual: add these to the success mock response; confirm none render.
- [ ] **16. No PII rendered.** _Manual-only._ Confirm no BA name, email, phone, prospect name, or address appears in any Michael state — the card is BA-self training copy only; it carries no person fields.
- [ ] **17. `agentResponseGenerated` / `persistence` not surfaced.** _Auto (D) + Manual._ Static: neither field is read. Manual: add both to the success mock; confirm neither renders and no "generated"/"saved"/"persisted" wording appears.
- [ ] **18. No safety internals / `nextStep` boolean flags.** _Auto (D) + Manual._ Static: `safety` (`validationStatus`/`guardrailIds`/`blockedReasonCodes`) is never read; `extractSafeNextStep` deliberately drops `baOwned`/`automaticSending`/`automaticCalling`/`externalSideEffect`. Manual: add those booleans to `nextStep` in the success stub; confirm no control or text is bound to them.

### D. No automation (19–21)

- [ ] **19. No send / call / schedule / prospect buttons.** _Auto (D) + Manual._ Static: component has no `<button>` / `fetch` action beyond the (currently un-invoked) resolve helper; no `tel:` / `mailto:` / clipboard / schedule call. Manual: confirm the card contains **no** action control in any state — it is read-only (no "Send", "Call", "Schedule", "Book", "Invite", "Approve").
- [ ] **20. No income / compensation / placement language.** _Auto (D) + Manual._ Static: no earnings/commission/cycle/CV/rank/queue/leg/position vocabulary in the copy. Manual: read every state's copy and confirm only training-guidance framing; no "$", no projection, no placement/position promise.
- [ ] **21. BA-owned framing — Michael is the coach, not an actor.** _Manual-only._ Confirm copy frames Michael as a guide that **points to** a next training step ("Michael is your training guide", "your next suggested training step") and never claims to send/call/schedule/prospect on the BA's behalf.

### E. Data contract (22–27)

- [ ] **22. Request body is `{ turn }` only.** _Auto (D) + Manual._ Static: the only `fetch` body in `resolveMichaelRuntimeTurn` is `JSON.stringify({ turn })`. Manual (future, once turn source exists): with DevTools Network open, trigger a resolve and confirm the request payload is exactly `{ "turn": … }` and nothing else. (Today the call is un-invoked, so there is no live request to inspect.)
- [ ] **23. No `baId` / `sponsorBaId` / `targetBaId` / `downlineBaId` in body.** _Auto (D) + Manual._ Static: none of these identifiers appear in the request construction. Manual (future): confirm the Network payload contains none of them — BA scope is session-derived server-side (sponsor immutability, locked-spec §3.5).
- [ ] **24. Never calls `/api/runtime/*`.** _Auto (D) + Manual._ Static: the only endpoint string is `/api/michael-runtime/resolve`. Manual: confirm no `/api/runtime/...` request is ever issued by the card.
- [ ] **25. Never calls `/api/michael/training-support/:downlineBaId`.** _Auto (D) + Manual._ Static: that sponsor-scoped downline endpoint (the *different* `MichaelTrainingSupportCard` surface) is not referenced. Manual: confirm no downline-scoped request is issued — this card is a **self**-view, not a sponsor read of someone else's guidance.
- [ ] **26. Never calls the admin observability endpoint.** _Auto (D) + Manual._ Static: `/api/admin/michael-runtime/observability` is not referenced. Manual: confirm no admin/counter request is issued from `.team`.
- [ ] **27. Only ever calls `/api/michael-runtime/resolve`.** _Auto (D) + Manual._ Static: exactly one endpoint string in the file. Manual (future): across all states/interactions, the only Michael request is the single resolve POST.

### F. No client persistence (28–30)

- [ ] **28. No `localStorage` of the response.** _Auto (D) + Manual._ Static: no `localStorage` reference. Manual (future): after a resolve, inspect Application → Local Storage; confirm no Michael response/turn/trace is written.
- [ ] **29. No `sessionStorage` of the response.** _Auto (D) + Manual._ Static: no `sessionStorage` reference. Manual: inspect Session Storage; confirm nothing cached.
- [ ] **30. No `IndexedDB` of the response.** _Auto (D) + Manual._ Static: no `indexedDB` reference. Manual: inspect IndexedDB; confirm no Michael store/object.

### G. Accessibility (31–32)

- [ ] **31. Semantic structure + labels, keyboard-safe, not color-only.** _Manual-only._ Confirm the card root is a `<section>` with `aria-label="Michael runtime training support"`; the heading is a real `<h3>` ("Michael · Training Support"); the decorative Bot icon is `aria-hidden="true"`. Confirm there are no focus traps and (today) no interactive controls to mis-order. Confirm state is conveyed by **text** (e.g. "Not available yet"), never by color alone.
- [ ] **32. Readable contrast + reflow.** _Manual-only._ Confirm body copy (`cream-mute` on `ink`) is legible; confirm gold/cream-faint are used only for eyebrows/labels, not essential small body text. Zoom to 200% and confirm copy reflows without clipping; confirm `prefers-reduced-motion` is respected (the card has no animation today — verify none is introduced).

---

## Automated vs manual coverage (cross-reference to Agent D)

Agent D's `server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts` is a **static source scan** running in the server `vitest`. It can prove anything expressible as "this string/import does (not) appear in the component source or its import graph," but it **cannot** render the component, so it cannot prove visual placement, state copy, accessibility, or runtime network payloads.

**Covered executably by Agent D's static scan (the source-pattern assertions):**

| # | Assertion | How D covers it (static) |
|---|---|---|
| 3 | Not imported by `apps/com` | import-graph scan |
| 12 | No `trace` read | absence of `trace` access |
| 13 | No raw Context Packet | absence of packet/raw-store identifiers |
| 14 | No admin counters | absence of the six counter names |
| 15 | No session/turn/correlation IDs | absence of those id reads |
| 17 | No `agentResponseGenerated`/`persistence` | absence of those reads |
| 18 | No safety internals / nextStep booleans | `extractSafeNextStep` drops them; no `safety` read |
| 19 | No automation controls | absence of action `fetch`/`tel:`/`mailto:` patterns |
| 20 | No income/placement vocabulary | forbidden-token scan of copy |
| 22 | Body is `{ turn }` only | body-construction scan |
| 23 | No BA-id fields in body | forbidden-field scan |
| 24–27 | Endpoint allowlist (`/api/michael-runtime/resolve` only) | endpoint-string scan |
| 28–30 | No localStorage/sessionStorage/IndexedDB | storage-API scan |

That is roughly **18 of 32** assertions with an executable static backstop (some only partially — the static half of a "static + manual" item).

**Manual-only (no executable backstop this slice) — require a human or a future in-app runner:**

- 1, 2, 4 — visual rendering and placement in the cockpit aside, Steve-gate behavior.
- 5–11 — that each of the seven states renders its exact copy (the live default `disabled`; the other six only via the throwaway stub or a future turn source).
- 16 — no PII on screen.
- 21 — BA-owned coach framing reads correctly.
- 31, 32 — accessibility (semantics, keyboard, contrast, reflow, reduced-motion).
- The **runtime** halves of 22–23 and 27–30 (actual Network/storage inspection) — currently unobservable because the resolve call is intentionally un-invoked (turn-source blocker).

**Coverage split:** ~18/32 have an executable static backstop via Agent D's server-side scan; ~14/32 are behavioral/visual/accessibility assertions that remain manual until a `.team` in-app runner exists.

---

## Recommendation — future slice: add an in-app test runner to `apps/team`

The manual-only assertions above (state rendering, placement, a11y, runtime payloads) become executable once `apps/team` has a component test runner. A **separate, Kevin-approved slice** should:

1. Add `vitest` + `@testing-library/react` + `jsdom` to `apps/team` (devDependencies + a `test` script + `vitest.config.ts`), isolated so `tsc -b` and the build gate stay green.
2. Port items 5–11 to render assertions (mount the card with each `MichaelRuntimeResult` kind via the exported `MichaelRuntimeResult` type and assert the exact copy), items 1–2/4 to render-tree placement assertions, and 31–32 to `jest-axe`/role queries.
3. Add the runtime-payload assertions (22–23, 27–30) **once the server-owned turn source exists** — mock `fetch`, invoke `resolveMichaelRuntimeTurn`, and assert the request body is exactly `{ turn }` with no BA-id fields and that no web-storage is written.

Until then, this checklist + Agent D's static scan are the verification of record. Do **not** add `*.test.tsx` to `apps/team` under the current scope — it would break the typecheck/build gate.
