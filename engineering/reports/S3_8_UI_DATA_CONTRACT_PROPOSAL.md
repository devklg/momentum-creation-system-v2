# Sprint 3 S3.8 — `.team` Michael Runtime UI Data-Contract Proposal (Agent B)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.8 multi-agent **PLANNING-ONLY** slice. Proposes the request/response/render
  data contract a future `.team` BA-facing UI would use to consume the S3.4 minimal Michael
  runtime route. **DOCUMENTATION ONLY** — no UI, no client API-call code, no code change, no
  commit, no flag flip. This file is the sole deliverable.
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent B (UI data-contract proposal)
- Status: **PROPOSAL — NOT AUTHORIZED FOR IMPLEMENTATION.** All three `MICHAEL_RUNTIME_*`
  axes remain off (`server/src/config/michaelRuntimeFlags.ts`). UI implementation is **BLOCKED**
  on the client-safe-turn-source dependency in §1.3 and on Kevin's separate, recorded approval.

> Grounding note: every field name, status code, and response shape below is transcribed from
> source read on disk this slice — not from the prior briefs' assumed names. Where the brief's
> assumed names (`response.text` / `response.nextStep` / `response.responseType`) differ from the
> actual fixture, the actual shape is stated and the discrepancy is flagged in §3.1.

Sources read (verbatim, on disk):
- `server/src/routes/michael-runtime.ts` (request handling + success payload shape)
- `server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts` (S2.20 facade; success/issue result + trace)
- `server/src/runtime/orchestration/michaelResponseContract.ts` (the response contract field set + forbidden fields)
- `server/src/runtime/orchestration/michaelResponseCatalog.ts` (catalog → fixture mapping; `michael_next_training_step_en`)
- `server/src/runtime/orchestration/fixtures/michaelResponseFixtures.ts` (`baseFixture` + `michaelResponseFixtureNextTrainingStepEn`)
- `server/src/config/michaelRuntimeFlags.ts` (three-axis kill switch)
- `server/src/middleware/requireAuth.ts`, `server/src/middleware/requireSteveComplete.ts` (401/403 shapes)
- `engineering/reports/SPRINT_003_S3_7_CONTROLLED_CANARY_EXECUTION_RECORD.md` (observed Stage 0–3)
- `engineering/reports/S3_7_CANARY_EXECUTION_CHECKLIST_AND_REQUEST_PLAN.md` (Agent B §2.1–§2.3: harness-turn requirement)

---

## 0. Endpoint summary

- **Route:** `POST /api/michael-runtime/resolve`
- **Handler:** `handleMichaelRuntimeResolve` (`server/src/routes/michael-runtime.ts:52`)
- **Middleware chain (in order):** `requireAuth`, `requireSteveComplete` (`michael-runtime.ts:156-161`),
  mounted below the BA-FACING GATED banner in `server/src/index.ts`.
- **Surface:** `.team` only (BA-facing). Never `.com`, never prospect-facing (Michael is BA-facing only).
- **Posture:** fixtures-only, non-persistent, LLM-free, voice-free, fail-closed behind the three-axis
  kill switch (route / response / trace), all default-OFF.

---

## 1. Request Contract

### 1.1 Shape

The UI sends exactly one body field:

```jsonc
POST /api/michael-runtime/resolve
{ "turn": { /* server-approved runtime turn object — see §1.3 */ } }
```

The handler reads `body.turn` and requires it to be a **non-null object**, else `400
MISSING_RUNTIME_TURN` (`michael-runtime.ts:90-96`). No other body field is consumed.

### 1.2 MUST NOT include — BA-scope and prospect fields are forbidden in the body

The route hard-rejects body-supplied BA authority. `FORBIDDEN_BODY_BA_FIELDS = ['baId',
'sponsorBaId', 'targetBaId']` (`michael-runtime.ts:43`); any present (even `null`/`undefined`-checked
as `!== undefined`) returns `400 BODY_BA_SCOPE_NOT_ALLOWED` (`michael-runtime.ts:79-88`). The UI
**MUST NOT** place in the body:

- `baId`, `sponsorBaId`, `targetBaId` — or any other authoritative BA-scope field.
- prospect token, `.com` token, `/p/:token` value, access code.
- a raw/hand-assembled Context Packet, or any store/Gateway/retrieval payload.

**BA scope comes only from the authenticated session.** The handler forces
`turn.identity.scope.baId = req.session.baId` server-side (`michael-runtime.ts:98-113`); the
client cannot set or override it. This is **sponsor immutability** (locked-spec 3.5; route header
comment lines 16-18): sponsor/BA scope is captured at session/token mint and is **never** recomputed
from a request body. The body-BA rejection path is the enforcement.

> Caveat (carried from S3.7 §17 C3): the `400 BODY_BA_SCOPE_NOT_ALLOWED` path is proven in source
> but was **not** empirically exercised by the S3.7 canary (the canary sent only `{ turn }`). It is
> a contract guarantee for the UI, not yet an observed one.

### 1.3 The `turn` value MUST come from a server-approved source — UI is BLOCKED until one exists

The `turn` is **not** flat JSON the UI may hand-author. Per Agent B's S3.7 finding
(`S3_7_CANARY_EXECUTION_CHECKLIST_AND_REQUEST_PLAN.md` §2.1–§2.3): `turn` must satisfy
`MichaelRuntimeAdapterContractInput`, whose heavy member `runtimeTurn` is a
`RuntimeTurnFixtureHarnessResult` — the **output of the S2 runtime-turn harness**
(`runRuntimeTurnFixtureScenario(...)` in `fixtures/runtimeTurnHarness.ts`), not a literal. The
adapter immediately reads `input.runtimeTurn.result` and classifies on nested
`consumption`/`contextRequestResult`/`metadata`. A flat/hand-authored `turn` therefore throws inside
the adapter and the route maps it to **`422`** (`michael-runtime.ts:118-126`) — **never a `200`**.
A valid `200 ok:true` requires a **real harness-produced `runtimeTurn`** (S3.7 §9, §2.2).

**Implication for the UI:** the only known producer of a valid `runtimeTurn` today is the S2 **test**
harness (`fixtures/runtimeTurnHarness.ts`). There is **no client-safe, production turn source** a
browser client may call. Therefore:

> **UI implementation is BLOCKED** until a **separately-approved, server-generated turn helper**
> exists — an authenticated, session-scoped server endpoint (or server-side composition step) that
> produces a valid `runtimeTurn` for the calling BA without the client assembling a Context Packet
> or importing a test harness. Until that helper is approved and built, a `.team` UI cannot obtain a
> body that yields `200`; it can only ever observe `422`. Designing the turn helper is **out of
> scope for S3.8** and must be its own gated slice.

---

## 2. Response Contract — handling per status (cited to route source)

The UI must handle every status below. All non-200 bodies carry `ok:false`.

| Status | Body (verbatim shape) | Source | UI handling |
|---|---|---|---|
| **503 `michael_runtime_disabled`** | `{ ok:false, disabled:true, reason:"michael_runtime_disabled" }` | `michael-runtime.ts:55-60` (Axis 1 route kill switch, before any work) | Treat Michael as unavailable. Render neutral "Michael isn't available right now" empty-state. No retry storm. This is the **default shipped state** (S3.7 Stage 0). |
| **503 `michael_runtime_response_disabled`** | `{ ok:false, disabled:true, reason:"michael_runtime_response_disabled" }` | `michael-runtime.ts:64-69` (Axis 2 response kill switch) | Same neutral unavailable state as above. Distinguish only in internal logging if needed, never in user copy (S3.7 Stage 1). |
| **400 `MISSING_RUNTIME_TURN`** | `{ ok:false, error:"Missing runtime turn.", code:"MISSING_RUNTIME_TURN" }` | `michael-runtime.ts:90-96` | Client bug — the UI omitted/sent a non-object `turn`. Show generic error; log for engineering. Do not surface raw `error` text verbatim if it could confuse a BA. |
| **400 `BODY_BA_SCOPE_NOT_ALLOWED`** | `{ ok:false, error:"BA scope must come from the authenticated session.", code:"BODY_BA_SCOPE_NOT_ALLOWED" }` | `michael-runtime.ts:79-88` | Client bug — the UI must **never** trigger this. If seen, it means a forbidden BA field leaked into the body; treat as a defect, generic error to the BA. |
| **401 (unauthenticated)** | `{ ok:false, error:"Not authenticated." }` or `{ ok:false, error:"Session invalid or expired." }` | `requireAuth` (`requireAuth.ts:34-42`); also handler fallback `michael-runtime.ts:71-74` | Redirect to `.team` login / re-auth. Session cookie scoped to `.teammagnificent.team`. |
| **403 `STEVE_GATE_CLOSED`** | `{ ok:false, error:"Locked. Complete your Steve discovery first.", code:"STEVE_GATE_CLOSED" }` | `requireSteveComplete` (`requireSteveComplete.ts:53-59`) | Route BA to Steve discovery completion. Michael is gated behind onboarding completion. |
| **422 (facade issues)** | `{ ok:false, issues:[ { code, message }, … ] }` (route also emits `{ ok:false, issues:[{ code:'resolution_error', message:'Runtime resolution failed.' }] }` on a thrown/malformed turn) | `michael-runtime.ts:121-130` (try/catch + `!result.ok`) | Resolution failed — generic "couldn't load Michael's guidance" state. **Do not render `issues[].code`/`message` to the BA** (internal codes). Log for engineering. A hand-authored/flat turn lands here (§1.3). |
| **200 `ok:true`, response present, trace ABSENT** | `{ ok:true, selectionRequest, catalogKey, response }` | `michael-runtime.ts:133-153`; trace omitted when Axis 3 off (S3.7 Stage 2) | Render the **safe display fields** of `response` only (§3). Ignore `selectionRequest`/`catalogKey` for display (internal routing metadata). |
| **200 `ok:true`, response present, trace PRESENT** | `{ ok:true, selectionRequest, catalogKey, response, trace }` | `michael-runtime.ts:148-150` (Axis 3 trace kill switch on) (S3.7 Stage 3) | Render exactly as the trace-absent case. **`trace` is for admin/observability only — never render it** (§3.2). Its presence is a response-shape change, not new display data. |

Notes:
- The success payload keys are exactly `{ ok, selectionRequest, catalogKey, response, trace? }`
  (`michael-runtime.ts:133-150`). `selectionRequest` and `catalogKey` are server-internal routing
  metadata — not display surfaces.
- `500` is possible only from `requireSteveComplete` if the gate check throws
  (`requireSteveComplete.ts:62-65`); treat as a generic transient error.

---

## 3. Render Contract

### 3.1 MAY render — the real safe display fields (actual fixture shape)

The `response` is a `michael_response_contract.v1` returned **by reference** from the catalog
fixture (`michaelRuntimeResolutionFacade.ts:118-121`). For the canary's observed entry
`catalogKey: "michael_next_training_step_en"` → fixture
`michaelResponseFixtureNextTrainingStepEn` (`michaelResponseFixtures.ts:64-80`), the **actual**
top-level fields are (from `baseFixture`, `michaelResponseFixtures.ts:22-39`, and the contract's
`TOP_LEVEL_FIELDS`, `michaelResponseContract.ts:157-174`):

```
schemaVersion, responseType, agentKey, taskType, sessionId, turnId, correlationId,
contextPacketStatus, language, text, safety, persistence, generatedAt,
agentResponseGenerated, contextPacketId?, nextStep?
```

**Safe-to-render fields (the ONLY ones the UI should display):**

| Field | Type / value | Render use |
|---|---|---|
| `response.text` | string — e.g. *"Review the next training step, then write down one question you want your sponsor to help you practice."* | Primary body copy. **This is the safe display string.** |
| `response.responseType` | enum: `next_training_step` \| `clarification_question` \| `safe_fallback` \| `safe_close` (`michaelResponseContract.ts:9-14`) | Presentation **discriminator** — pick the UI variant (training-step card vs. clarification vs. safe fallback/close). Not display text itself. |
| `response.language` | `'en'` \| `'es'` | Locale of the copy; for direction/labels. |
| `response.nextStep` (present **only** when `responseType === 'next_training_step'`) | object: `{ label?, title?, instruction?, baOwned, automaticSending, automaticCalling, externalSideEffect }` (`michaelResponseContract.ts:182-190`) | Render the **string** sub-fields `nextStep.title`, `nextStep.instruction`, `nextStep.label` as the action card. e.g. title *"Review the next training step"*, instruction *"Open the next training step and make one private note about what you want to practice."* The four booleans (`baOwned:true`, `automaticSending:false`, `automaticCalling:false`, `externalSideEffect:false`) are guarantees — **do not render any control bound to them**; they exist to prove no automated action. |

Plus, optionally, **server-provided safe fallback copy** (`responseType:'safe_fallback'`, `text`) and
**safe close copy** (`responseType:'safe_close'`, `text`) — both already contract-validated to exclude
substantive training guidance (`validateSafeCloseTextContent`, `michaelResponseContract.ts:487-507`).

**Discrepancy flag (brief's assumed names vs. actual):**
- `response.text` — **MATCHES.** Real field; it is the safe display string. ✔
- `response.responseType` — **MATCHES** as a field name, but it is an **enum discriminator**, not
  display prose. Use it to choose the UI variant, not to print. ⚠ clarification
- `response.nextStep` — **MATCHES** as a field name, but it is **NOT a string** (the brief's phrasing
  could read as a scalar). It is an **object** with `title` / `instruction` / `label` strings plus
  four boolean safety flags, and it is **present only for `next_training_step`**. ⚠ clarification
- There is **no** top-level `nextStep` scalar and no `response.message`/`response.body` alias. The
  display string is `response.text` (top level) and the nested `nextStep.{title,instruction,label}`.

### 3.2 MUST NOT render — anything outside the safe display set

The UI **must not** render, log to the DOM, or expose:

- **`trace`** (the whole object when Axis 3 is on). Admin/observability only. It carries
  `classification`, `selectionRequest`, `catalogKey`, `responseType`, `contextPacketStatus`,
  `language`, `persistence`, `agentResponseGenerated` (`michaelRuntimeResolutionFacade.ts:53-73`) —
  internal metadata, never a BA surface.
- **`selectionRequest`** and **`catalogKey`** from the top-level payload — internal routing metadata.
- **The response's identifier fields:** `response.sessionId`, `response.turnId`,
  `response.correlationId`, `response.contextPacketId` — IDs; redact, never render (S3.7 §12 shows
  these are redacted even in internal capture).
- **`response.safety`** internals (`validationStatus`, `guardrailIds`, `blockedReasonCodes`),
  `response.schemaVersion`, `response.generatedAt`, `response.agentKey`, `response.taskType`,
  `response.persistence`, `response.agentResponseGenerated`, `response.contextPacketStatus` —
  control-plane metadata, not user copy.
- **The four `nextStep` boolean flags** as interactive controls (`baOwned`, `automaticSending`,
  `automaticCalling`, `externalSideEffect`). No "send", "call", "schedule", or any
  **automated-action control** may be bound to Michael output — these flags are `false`/`true`
  guarantees that no such action exists, not feature toggles.
- **Any raw Context Packet, raw retrieval output, raw Gateway/store output** — the route never
  emits these and the contract forbids `rawStoreResults`, `rawGraphRagResults`,
  `rawGatewayFallbackResponse` (`michaelResponseContract.ts:57-59`); the UI must not reconstruct or
  request them.
- **Tokens, IDs, PII** of any kind.
- **Compensation / income / commission / cycle math**, **placement promises**, **prospect-facing
  text**, **THREE authority claims** — all are contract-forbidden fields/patterns
  (`MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS` + `PROHIBITED_TEXT_PATTERNS`,
  `michaelResponseContract.ts:33-103`). The UI inherits this prohibition: never derive, compute, or
  annotate any such value around Michael's output.

The render is **read-only**. Michael is BA-facing only and must never appear on `.com` or any
prospect-facing surface.

---

## 4. Counter / Observability boundary

- The `.team` UI **MUST NOT** display admin counters or any observability snapshot.
- Admin observability stays admin-only: `GET /api/admin/michael-runtime/observability`, registered
  `requireAdmin` (Kevin-only via `ADMIN_BA_IDS`), returning `{ ok:true, michaelRuntime: <snapshot> }`
  with the six aggregate counters (`routeDisabledSkips`, `responseDisabledSkips`,
  `successfulFacadeResolutions`, `facadeFailures`, `bodyBaOverrideRejections`,
  `missingTurnRejections`) plus the three evaluated flag booleans (S3.7 §6). This is an `/admin`
  surface — the BA-facing `.team` UI never reads it, never mirrors it, and never shows counts,
  flag states, or success/failure tallies to a BA.

---

## 5. Non-authorization statement

This proposal authorizes **no** activation and **no** UI build. No `MICHAEL_RUNTIME_*` flag may be
set to `"true"` in any environment; no env changed; no client API-call code or UI component written;
no commit. UI implementation is **BLOCKED** on (a) the separately-approved server-generated
client-safe turn source (§1.3), and (b) Kevin Gardner's separate, explicit, recorded authorization.
The route remains the inert, default-off, fixtures-only one-call consumer of the S2.20 facade.
