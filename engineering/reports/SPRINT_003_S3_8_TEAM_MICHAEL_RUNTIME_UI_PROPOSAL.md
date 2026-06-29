# Sprint 3 S3.8 — `.team` Michael Runtime UI Proposal (Final Integrated)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.8 multi-agent **PLANNING-ONLY** slice. Final integration of Agents A/B/C/D into a single
  proposal for a future `.team` BA-facing UI over the S3.4 minimal Michael runtime route
  (`POST /api/michael-runtime/resolve`), under the S3.6 in-memory observability layer and on the
  strength of the S3.7 LOCAL controlled-canary record.
- Status: **PROPOSAL ONLY — NOT AUTHORIZED FOR IMPLEMENTATION.** No UI built, no React/TSX added or
  edited, no client API-call code, no route enabled, no flag flipped, no persistence, no LLM, no
  commit, no git. This document is the sole new artifact produced by the integrator (Agent E).
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent E (final integrator)
- Integrates (by reference, not re-pasted):
  - `engineering/reports/S3_8_TEAM_UI_PLACEMENT_PROPOSAL.md` (Agent A — placement)
  - `engineering/reports/S3_8_UI_DATA_CONTRACT_PROPOSAL.md` (Agent B — data contract)
  - `engineering/reports/S3_8_UI_COMPLIANCE_UX_GUARDRAILS.md` (Agent C — compliance/copy/UX)
  - `engineering/reports/S3_8_UI_BOUNDARY_IMPLEMENTATION_READINESS_REVIEW.md` (Agent D — boundary/readiness)
  - `engineering/reports/SPRINT_003_S3_7_CONTROLLED_CANARY_EXECUTION_RECORD.md` (S3.7 canary record)
  - `engineering/reports/SPRINT_003_S3_6_MINIMAL_IN_MEMORY_OBSERVABILITY_VERIFICATION.md` (S3.6 observability)

---

## 1. Executive result

**PASS WITH CONDITIONS.**

The full gate suite is green (see gate ledger below) and the four sub-reports converge cleanly on a
single, well-bounded placement, data contract, compliance posture, and readiness verdict. This is a
clean **proposal** — but it carries two conditions that block any actual UI implementation:

1. **BLOCKER (load-bearing):** there is **no client-safe, production producer of a valid
   `runtimeTurn` / `ResolvedRuntimeTurn`** for the route to consume. In S3.7 a valid `200` came only
   from the test-only fixture harness. A `.team` UI cannot obtain a body that yields `200` until a
   separately-approved, server-owned turn-source/helper exists (Agent B §1.3; Agent D item 27). This
   is the single most important gating fact for S3.9.
2. **CAVEAT (empirical gap):** the `400 BODY_BA_SCOPE_NOT_ALLOWED` body-BA rejection path is proven
   in source but was **not** empirically exercised by the S3.7 canary (Agent D item 21; S3.7 §17 C3).

Verdict: proceed to a UI **proposal** track only. Do **not** begin UI implementation, flip any flag,
or touch `.com`. The kill switch remains the sole, default-closed gate; all three `MICHAEL_RUNTIME_*`
axes remain off.

### Gate ledger (observed this slice, repo root, no fabrication)

| Gate command | Result |
|---|---|
| `pnpm build:shared` | PASS (tsc clean) |
| `pnpm typecheck` | PASS — 5 of 5 projects (shared, admin, com, team, server) |
| `pnpm build` | PASS — all workspaces built (shared/com/admin/team/server) |
| `pnpm --filter @momentum/server test` | PASS — 74 files / 851 tests, 0 fail |
| `… test -- michael-runtime s34MichaelRuntimeRouteGovernanceBoundary s36MichaelRuntimeObservabilityGovernanceBoundary` | PASS — 7 files / 133 tests |
| `… test -- michaelRuntimeObservability michael-runtime-observability` | PASS — 3 files / 64 tests |
| `… test -- michaelRuntimeResolutionFacade michaelResponseSelectionRequest michaelResponseCatalogSelector michaelResponseCatalog michaelRuntimeAdapterContract michaelResponseContract s220MichaelRuntimeResolutionFacadeGovernanceBoundary` | PASS — 22 files / 306 tests |
| `… test -- michaelResponseContractEsGuardrails michaelResponseContractFailedStrictness` | PASS — 2 files / 34 tests |
| `… test -- mongoAdapter` | PASS — 1 file / 2 tests |

> Note: the originating brief's Michael-chain token `s220MichaelRuntimeFacadeGovernanceBoundary` was
> a typo; the real test is `s220MichaelRuntimeResolutionFacadeGovernanceBoundary` and is the one run
> above (PASS).

`git status --short` shows ONLY untracked S3_8 report `.md` files — no code changes.

## 2. Confirmation: proposal-only

This is a documentation-only deliverable. The integrator built no UI, added no React/TSX component,
wrote no client API-call code, touched no file under `apps/team/` or `apps/com/`, registered no
route, changed no env, and flipped no flag. It integrates four planning sub-reports and records a
final proposal. Nothing here authorizes implementation; the recommended UI work is explicitly
deferred to a future, separately-gated slice (suggested S3.9, §27) that begins only on Kevin's
recorded approval.

## 3. No UI implemented

No component, hook, fetch, or render targeting `/api/michael-runtime/resolve` was created or edited.
Agent D item 13 confirms (via grep) the clean slate persists: `apps/team` contains no file pointed at
the S3.4 runtime route. This slice leaves that true.

## 4. No flags flipped

The three axes (`MICHAEL_RUNTIME_ROUTE_ENABLED`, `MICHAEL_RUNTIME_RESPONSE_ENABLED`,
`MICHAEL_RUNTIME_TRACE_ENABLED`) remain off; none was set to `"true"` in any environment, and no
`.env` was changed (Agent D items 4, 14; S3.7 §15; S3.6 §24). The kill switch remains the sole
default-closed gate.

## 5. No runtime behavior changed

No server route, middleware, facade, fixture, or observability counter was modified. The full suite
green (851/851) and the unchanged git tree confirm the route remains the inert, default-off,
fixtures-only, non-persistent, LLM-free, voice-free one-call consumer of the S2.20 facade.

## 6. Recommended `.team` UI placement

**Inside the existing `/cockpit` BA dashboard (`apps/team/src/routes/cockpit.tsx`), as a read-only
self-view card rendered within / immediately adjacent to the existing `AgentSupportPanel` aside
("What should I do next? · Steve + Ivory + Michael").** (Agent A §3, §5.)

Rationale (grounded in the real on-disk inventory): the route returns
`michael_next_training_step_en` — a single "next training step" for the authenticated BA, which is
exactly the question `AgentSupportPanel` already exists to answer; that panel already names Michael
in its eyebrow. The route is BA-self-scoped from `req.session.baId`, matching the cockpit's own
self-view. The cockpit's operational view already renders only after Steve completes, mirroring the
route's `requireAuth` + `requireSteveComplete` gate, so placement and route gate agree without new
gating logic. `/cockpit` is an established BA-facing, Steve-gated, non-`.com` surface with no
income/placement/THREE content. Lowest blast radius: one card in one aside, not a new route, nav
entry, or inventory page.

## 7. Rejected placements (and why)

- **`apps/com` / any `/p/{token}` prospect surface — REJECTED, hard rule.** Michael is BA-facing only
  and never appears on `.com` (locked-spec §3.11/§3.12; `NEVER_ON_COM[2]`). Non-negotiable.
- **The existing `MichaelTrainingSupportCard.tsx` (sponsor-only downline card) — REJECTED.** This is
  a **different** Michael surface fed by `GET /api/michael/training-support/:downlineBaId` — a
  sponsor-scoped read of *someone else's* (a downline BA's) guidance, server-enforced 403 unless the
  viewer is the direct sponsor. The S3.4 route is a **self**-view scoped from the session. Reusing
  this card would cross the self-vs-downline scope boundary and risk leaking the new route into a
  sponsor context. Keep the two distinct (Agent A §2, §4; Agent D item 13).
- **`/admin` (admin cockpit / observability) — REJECTED for the BA response.** Admin is Kevin-only
  (`ADMIN_BA_IDS`); a BA must see their own next step from their own cockpit. `/admin` is the home for
  the *observability counters* and any redacted trace (§21), never the BA-facing card (Agent A §9).
- **`/training/fast-start` hub — REJECTED as primary (weak secondary).** A curriculum-module surface,
  not a coached next-action surface; reachable pre-Steve for Module 1 whereas the route is
  Steve-gated — a mismatch forcing extra conditional gating (Agent A §4).
- **`/ivory`, `/crm`, `/vm-campaigns`, `/invitations` — REJECTED.** Message-writing / prospect-ops
  surfaces; Michael is training/coaching, not prospect messaging (Agent A §4).
- **A new dedicated `/michael` route/page — REJECTED.** Adds a page outside the canonical inventory
  and an empty nav destination for a single fixture card; premature (Agent A §4).

## 8. Future UI purpose

A single, bounded purpose: **display one safe, pre-authored Michael training-support next step for
the signed-in BA**, framed as guidance — never as an automated action. The text is the verbatim
`michael_next_training_step_en` fixture returned by reference; nothing is generated client-side. The
only forward action is navigation into existing training/launch surfaces. The card never mints a
link, references a prospect, surfaces income/placement/headcount, or exposes anything prospect-facing
(Agent A §6; Agent C §1).

## 9. Future UI user

**Authenticated BA only, onboarding (Steve) complete only.** The route requires `requireAuth` +
`requireSteveComplete` (the canonical onboarding gate — not the nonexistent `requireMichaelComplete`).
The cockpit already renders a locked state until `steve.phase === 'complete'`, so the card naturally
appears only for Steve-complete BAs; the existing locked state is the correct pre-Steve empty surface
(Agent A §7; Agent D item 5).

## 10. Data contract — endpoint, request, response handling

- **Endpoint:** `POST /api/michael-runtime/resolve` (`handleMichaelRuntimeResolve`), middleware
  `requireAuth` → `requireSteveComplete`, mounted below the BA-FACING GATED banner.
- **Request body:** exactly `{ "turn": <server-approved runtime turn object> }` and nothing else.
  `turn` must be a non-null object or the route returns `400 MISSING_RUNTIME_TURN`. **`turn` is not
  flat JSON the UI may hand-author** — it must satisfy the adapter contract whose `runtimeTurn` is a
  resolved-orchestration artifact (see §12 and the §1 BLOCKER).
- **Response handling per status** (Agent B §2; Agent A §11–§16):

| Status | Body shape | UI handling |
|---|---|---|
| `503 michael_runtime_disabled` | `{ ok:false, disabled:true, reason }` | Calm "not available yet" disabled state (§14). Default shipped state. No retry storm. |
| `503 michael_runtime_response_disabled` | `{ ok:false, disabled:true, reason }` | Same calm state, worded as "getting ready" (§15); distinguish only in internal logging, never in user copy. |
| `400 MISSING_RUNTIME_TURN` | `{ ok:false, error, code }` | Client bug; generic error, log for engineering. Never surface raw `code`/`error` verbatim. |
| `400 BODY_BA_SCOPE_NOT_ALLOWED` | `{ ok:false, error, code }` | UI must **never** trigger this; if seen, a forbidden BA field leaked — treat as defect, generic error. |
| `401` | `{ ok:false, error }` | Route to `.team` re-login (§19). |
| `403 STEVE_GATE_CLOSED` | `{ ok:false, error, code }` | Route BA to Steve discovery completion. |
| `422` (facade issues / thrown or malformed turn) | `{ ok:false, issues:[{code,message}] }` | Safe fallback (§17). Do **not** render `issues[].code`/`message` to the BA. A hand-authored/flat turn lands here. |
| `200 ok:true` (trace ABSENT, axis-3 off) | `{ ok:true, selectionRequest, catalogKey, response }` | Render safe display fields of `response` only (§13). Ignore `selectionRequest`/`catalogKey`. |
| `200 ok:true` (trace PRESENT, axis-3 on) | `{ ok:true, selectionRequest, catalogKey, response, trace }` | Render identically to trace-absent. **Never render `trace`** (§20). |
| `500` | generic | Transient error state (§19). |

## 11. Explicit prohibition on body BA authority

The UI **MUST NOT** place `baId`, `sponsorBaId`, `targetBaId` (the `FORBIDDEN_BODY_BA_FIELDS` set), or
any other authoritative BA-scope field, in the request body — nor a prospect token, `.com` token,
`/p/:token` value, or access code. BA scope comes **only** from the authenticated session: the handler
forces `turn.identity.scope.baId = req.session.baId` server-side; the client cannot set or override
it. This is sponsor immutability (locked-spec §3.5). Any forbidden field present returns
`400 BODY_BA_SCOPE_NOT_ALLOWED` (Agent B §1.2; Agent D items 15, 22).

## 12. Explicit prohibition on raw Context Packet assembly

The UI **MUST NOT** construct, send, or render a raw Context Packet, raw retrieval output, or raw
Gateway/store output. The route is a one-call consumer of the inert S2.20 facade and never assembles a
Context Packet; the trace exposes only `contextPacketStatus` (status, never content). The contract
forbids `rawStoreResults` / `rawGraphRagResults` / `rawGatewayFallbackResponse`; the UI must not
reconstruct or request them. Note that the current `body.turn` contract edges close to this
constraint — `runtimeTurn` is itself a resolved-orchestration artifact — which is precisely why the
turn-source must be server-owned, not client-assembled (Agent B §1.2; Agent D items 16, 27).

## 13. Render contract (allowed vs prohibited fields)

**MAY render (the ONLY safe display fields):**

| Field | Type | Render use |
|---|---|---|
| `response.text` | string | Primary body copy — the safe display string. |
| `response.responseType` | enum: `next_training_step` \| `clarification_question` \| `safe_fallback` \| `safe_close` | Presentation **discriminator** (choose UI variant). Not display prose. |
| `response.language` | `'en'` \| `'es'` | Locale of the copy (direction/labels, §24). |
| `response.nextStep` (present **only** when `responseType === 'next_training_step'`) | object | Render the **string** sub-fields `nextStep.title`, `nextStep.instruction`, `nextStep.label` as the action card. |

`response.nextStep` is an **object**, not a scalar, and present only for `next_training_step` (Agent B
§3.1 discrepancy flag). Its four boolean flags (`baOwned`, `automaticSending`, `automaticCalling`,
`externalSideEffect`) are **guarantees, not toggles** — no control may be bound to them.

**MUST NOT render** (Agent B §3.2; Agent A §13, §16): the whole `trace` object; top-level
`selectionRequest` and `catalogKey`; identifier fields `response.sessionId` / `turnId` /
`correlationId` / `contextPacketId`; `response.safety` internals (`validationStatus`, `guardrailIds`,
`blockedReasonCodes`); `response.schemaVersion` / `generatedAt` / `agentKey` / `taskType` /
`persistence` / `agentResponseGenerated` / `contextPacketStatus`; the four `nextStep` boolean flags as
controls; any raw Context Packet / retrieval / Gateway output; tokens, IDs, PII; and any
compensation/income/placement/THREE-authority value. The render is read-only.

## 14. Disabled-state UX (route flag OFF → `503 michael_runtime_disabled`)

The default shipped state. Present as a calm, non-error "not available yet" — never red, never a
failure of the BA's action. Quiet muted placeholder consistent with `AgentSupportPanel` styling; the
existing static three-suggestion panel stays so the BA is never left with a dead panel. A single
non-alarming "Check again" control is acceptable; no retry storm (Agent A §11; Agent C §22).

## 15. Response-disabled UX (axis-2 OFF → `503 michael_runtime_response_disabled`)

Route reachable but no content returned. To the BA, indistinguishable from "available soon" and read
the same calm way ("Michael is getting ready"). Distinct from route-disabled only in internal
logging, never in user copy; the UI must not fabricate or cache a prior response (Agent B §2; Agent C
§23; Agent D item 24).

## 16. Success UX (`200 ok:true`, valid turn)

Render the resolved fixture's BA-safe training-support content (`response.text`, and the
`nextStep.{title,instruction,label}` strings for `next_training_step`) as a short coached next step in
Michael's existing eyebrow/branding. Provide a single forward navigation action into an existing
training surface — no new behavior, no side effect. Do not render `selectionRequest`, `catalogKey`,
or any internal field; render no trace even when present (Agent A §13; Agent B §3.1; Agent C §14–§15).

## 17. Safe fallback UX (`responseType: safe_fallback`, or `422` / malformed / network error)

Fail closed to a calm, BA-owned default — never a raw error body, stack, issue code, or internal
message. A single neutral line ("You're all caught up for the moment…" / "Michael doesn't have a step
for you right now — keep moving through your Fast Start.") with the existing static suggestions still
visible. Network errors degrade identically; the cockpit stays fully usable regardless of route
outcome (Agent A §14; Agent C §24).

## 18. Safe close UX (`responseType: safe_close`, or BA dismiss/collapse)

Dismissal reads as the BA's choice and implies nothing was sent, scheduled, or acted on. Use "Close"
(not "Done", which can imply a task executed). Closing performs **no** write, persistence, follow-up
call, or state mutation beyond local UI visibility (the route stores nothing); reopening simply
re-requests the fixture. Safe-close server copy is contract-validated to exclude substantive training
guidance (Agent A §15; Agent C §25; Agent B §3.1).

## 19. Error UX (`401`, other 4xx/5xx)

No technical leakage — no `code` values (`MISSING_RUNTIME_TURN`, `BODY_BA_SCOPE_NOT_ALLOWED`,
`resolution_error`), no trace, no stack — and no alarm. Generic "Something went sideways / try again"
for transient errors. `401` routes to re-login ("Your session timed out. Please sign in again…"), not
a Michael error (Agent B §2; Agent C §26).

## 20. Trace policy

**Hidden from the BA by default; no raw trace body, ever, in the BA card.** The redacted trace
(`payload.trace`) is present only when axis-3 `MICHAEL_RUNTIME_TRACE_ENABLED` is on; default-off it is
absent. The UI must never request the trace axis and must never render `trace` even if present — it
carries internal classification/selection/metadata, not BA-facing content. If ever surfaced for
diagnostics, it belongs on the Kevin-only `/admin` surface, not `/cockpit`, and only under a separate
explicit approval. This preserves the redaction posture verified in S3.7 §12 / S3.6 §12 (Agent A §16;
Agent B §3.2; Agent C §19; Agent D item 18).

## 21. Admin observability policy

**Admin-only; never shown to a BA.** The observability snapshot
(`GET /api/admin/michael-runtime/observability`, `requireAdmin`, Kevin-only via `ADMIN_BA_IDS`) returns
six aggregate counters (`routeDisabledSkips`, `responseDisabledSkips`, `successfulFacadeResolutions`,
`facadeFailures`, `bodyBaOverrideRejections`, `missingTurnRejections`) plus three evaluated flag
booleans. The BA-facing `.team` UI never reads, mirrors, or displays counters, flag states, or
success/failure tallies (Agent B §4; Agent C §20; Agent D items 12, 19).

## 22. Compliance guardrails

Michael's render is BA-facing training-support only and must honor every standing compliance rule
(Agent C §2–§4):

- **Never on `.com` / never prospect-facing** — render only inside `.team` behind auth + Steve gate;
  not importable by `apps/com`; no deep link, share link, OG image, or token path exposes it to a
  prospect.
- **No income/compensation/placement/ranking** — no earnings, projections, commission, cycle/volume/
  rank math (even client-side, even "for context"); no queue/leg-position language; no scoring,
  grading, or "qualifying" of prospects.
- **No automated action** — no send/text/email, call/dial/click-to-call, schedule/booking/reminder,
  approve/publish, or any side-effecting control. All copy is BA-owned next-step framing ("Your next
  training step", "When you're ready, you might…"); the BA is the actor, Michael the coach. A
  persistent honesty line states Michael takes no action.
- **No LLM/generation, no voice** — no regenerate/rewrite/prompt box, no mic/TTS/dictation; the
  fixture is verbatim (`agentResponseGenerated:false`, `persistence:"disabled"`).
- **THREE remains upstream authority** — the UI never presents itself as enrollment/registration/
  genealogy/patronage and offers no handoff-to-THREE; enrollment/placement steps direct the BA to
  THREE off-app, BA-to-BA. No THREE branding.
- **Vocabulary discipline** — "sharer"/"share", never "salesperson"/"sell"/"lead"/"pitch"/
  "prospecting".

All draft state strings in Agent C §5 are proposals subject to a dedicated copy review (§27); none
appears in any code file.

## 23. Accessibility guardrails (WCAG 2.1 AA)

Per Agent C §7: semantic headings/landmarks (`role="region"` + `aria-labelledby`, real `h2`/`h3`
hierarchy, not styled divs); logical focus order with no traps; screen-reader labeling with the
"takes no action" honesty line in the accessible name/description (not icon-only) and explicit
`aria-label`s on close/nav controls; state transitions announced via `aria-live="polite"`. Brand-color
contrast: cream-on-ink body copy is AA-safe; reserve `gold`/`teal` for headings/large labels/non-text
accents (borderline as small body text); `creamMute`/`creamFaint` must not carry essential small copy.
No color-only signaling (status distinguished by text/label, not hue alone); honor
`prefers-reduced-motion`; copy reflows at 200% zoom without clipping.

## 24. Spanish/English display considerations

Per Agent C §6: **content language follows the fixture** (`…_en` / `…_es` sibling resolved by the
route, surfaced as `response.language`); the UI must not machine-translate, regenerate, or "improve"
it client-side (that would violate `agentResponseGenerated:false`). Chrome strings are localized
separately via the standard `.team` i18n layer, keyed to the same language signal, using whole-sentence
keys (no concatenated fragments). Both languages get an **independent** native-fluent compliance review
(a string compliant in English can drift in Spanish into action/placement/income phrasing). Layout
tolerates ~15–30% Spanish length variance — no fixed-height single-line copy containers. Any language
toggle re-fetches the sibling fixture; it never transforms displayed text. ES-safe-path guardrails are
already enforced server-side (`michaelResponseContractEsGuardrails`, gate PASS above).

## 25. Boundary readiness result

**READY-WITH-CONDITIONS** (Agent D §0, §28). The route and observability are present, inert, and
boundary-clean (Agent D items 1–20 CONFIRMED); no `.team` Michael-runtime UI exists yet (clean slate,
item 13). The verdict authorizes proceeding to a UI **implementation proposal** — NOT to UI
implementation and NOT to enablement. Blocker count: 1 (turn-source, item 27). UNCONFIRMED count: 0.
Plus 1 carried non-blocking empirical caveat (body-BA, item 21).

## 26. Body-BA rejection caveat (S3.7) and how future implementation must test it

S3.7 §17 Caveat C3 / Agent D item 21: the `400 BODY_BA_SCOPE_NOT_ALLOWED` path is proven in source
but was **not** empirically exercised — the canary sent only `{ turn }`, so `bodyBaOverrideRejections`
stayed 0 across all stages (masked at Stage 1 by the axis-2 short-circuit). This is a transparency
gap, not a defect. The future implementation must close it on both sides:

- **Server/canary side:** run a targeted body-BA rejection canary (ROUTE+RESPONSE axes on) that POSTs
  a body containing `baId` and observes `400 BODY_BA_SCOPE_NOT_ALLOWED` with
  `bodyBaOverrideRejections +1` (Agent D §28 step 1).
- **UI side:** carry a test asserting the request body sent to `POST /api/michael-runtime/resolve`
  contains **none** of `baId` / `sponsorBaId` / `targetBaId` — the client must never even *attempt*
  body-BA scope (Agent D items 22, 15). Alongside it, the UI test set must include disabled-state
  (item 23), response-disabled (item 24), trace-hidden-by-default (item 25), and no-`.com` boundary
  (item 26) tests.

## 27. Recommendation for the next slice (suggested S3.9)

Two separately-gated steps, each beginning only on Kevin's explicit, recorded approval (sequencing
per Agent D §28, S3.6 §29 / S3.7 §17 — observability → canary → `.team` UI):

1. **Targeted body-BA rejection canary first** — a short LOCAL canary that closes S3.7 Caveat C3 /
   item 21 before any UI depends on the body-BA constraint. Cheap, de-risks items 15/22 empirically.
2. **Then a `.team` UI implementation *proposal* (design doc, not code)** whose **first deliverable
   must resolve the turn-source BLOCKER (item 27)** — define the server-owned production path that
   yields a valid `runtimeTurn` for the calling BA (or refactor the route to take intent-only and
   derive the turn server-side), so the client never assembles orchestration state or imports the test
   harness. That proposal must bake in constraints 14–20 and ship the tests in items 22–26, place the
   card per §6 (cockpit `AgentSupportPanel` self-view), follow the §13 render contract, and pass the
   §22 copy review (EN + ES) as a build precondition.

**Do NOT begin UI implementation** until item 27 is resolved on paper and the targeted canary is on
record. The single most important gating fact for S3.9: **there is no client-safe production producer
of a valid `runtimeTurn` today** — until a server-owned turn-source exists, a `.team` UI can only ever
observe `422`, never `200`.

## 28. Explicit non-approval statement

This proposal authorizes **nothing**. No UI is approved or built; no React/TSX component, hook, fetch,
or client API-call code is written; no persistence; no LLM call; no dynamic text generation; no voice;
no `.com` exposure; no admin-observability exposure to a BA; no broader route scope; no new route, nav
entry, or inventory page. No `MICHAEL_RUNTIME_*` flag may be set to `"true"` in any environment; no env
changed; no deployment; no commit; no git. The route remains the inert, default-off, fixtures-only,
authenticated, BA-scoped, non-persistent, LLM-free, voice-free, returned-only one-call consumer of the
S2.20 facade, behind the three-axis kill switch (all axes off). A `.team` UI implementation proposal
and the targeted body-BA canary proceed only on Kevin Gardner's separate, explicit, recorded approval,
and that proposal must resolve the item-27 turn-source blocker before any implementation begins.

---

This is the Sprint 3 S3.8 final integrated `.team` Michael runtime UI proposal (Agent E,
planning-only). It integrates Agents A/B/C/D by reference, records the full gate suite green, and
makes the turn-source blocker the load-bearing prerequisite for S3.9. It builds nothing, enables
nothing, and changes no flag.
