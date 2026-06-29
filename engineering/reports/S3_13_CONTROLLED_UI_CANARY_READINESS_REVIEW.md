# Sprint 3 · S3.13 — Controlled UI Canary Readiness Review

**Slice:** S3.13 — controlled UI canary readiness review (documentation-only readiness gate)
**Role:** Agent A (readiness reviewer / canary scope author)
**Date:** 2026-06-29
**Type:** CANARY / readiness slice — **documentation only**. No production code, tests, flags, env, or git mutation in this slice.

---

## 1. Latest verified main commit

Verified against the repository, not chat memory:

- **`main` HEAD:** `9670d32` — *"Merge pull request #66 from devklg/codex/s3-12-body-ba-rejection-canary"*.
- **Working tree:** clean (`git status --short` empty at start of this slice).

S3.12 is committed to `main`. Its verification report is present on disk:
`engineering/reports/SPRINT_003_S3_12_BODY_BA_REJECTION_CANARY_VERIFICATION.md`.

## 2. Prior slice (S3.12) status

- **Prior slice:** S3.12 — Body-BA / Client Runtime Input Rejection Canary.
- **Prior report path:** `engineering/reports/SPRINT_003_S3_12_BODY_BA_REJECTION_CANARY_VERIFICATION.md`.
- **Prior status / verdict:** **`PASS WITH CONDITIONS`** (stated in report §1 Executive Result and report header).

S3.12 followed the S3.11 recommendation #1 exactly — a targeted body-BA / client-runtime-input rejection canary. From the S3.12 report (§2 "Repo Recommendation Followed"):

> "The S3.11 recommendation named the next slice as a targeted body-BA/client-runtime-input rejection canary. S3.12 follows that recommendation exactly and does not move into approved-knowledge retrieval, production/staging enablement, persistence, LLM, voice, or `.com`."

The two conditions bounding the S3.12 PASS (report §1):

> "The optional live/local curl canary was documented as a checklist, not executed against a real authenticated local browser session in this slice."

> "The root `pnpm build:shared` script hit the Codex runtime pnpm wrapper preflight (`ERR_PNPM_IGNORED_BUILDS`) before the build ran; the equivalent direct workspace command through Kevin's fnm pnpm completed successfully."

## 3. Recommendation used — the controlled UI canary points to this S3.13

The recommendation order that authorizes S3.13 originates in the S3.11 report (§31 "Recommendation for next slice"). Recommendation #1 was the body-BA rejection canary (consumed by S3.12). The **next** recommendation in that ordered list is the controlled UI canary — quoted exactly:

> "2. **Controlled UI canary with route + response flags enabled** — Kevin-owned, `.team` only, to observe the live degraded `safe_fallback` end-to-end render before broader enablement."

The S3.11 conditions reinforce that this is the Kevin-owned next step (S3.11 §1 condition (b) and §30 condition (b)):

> "(b) Flags remain default-off. No production or staging enablement was performed. Route, response, and trace kill switches are all default-off. A controlled UI canary with route + response flags enabled is the next step and is Kevin-owned."

S3.12 itself, having consumed S3.11 recommendation #1, leaves the controlled UI canary as the remaining near-term step. From the S3.12 report (§9 Remaining Conditions and §10 Next Recommendation):

> "Optional operator-local controlled canary can be run from the checklist with a controlled authenticated `.team` session."

> "1. Run the optional controlled local canary checklist if desired. 2. Keep flags default-off unless Kevin explicitly approves a controlled enablement. 3. Plan approved Context Manager retrieval separately if the next slice is to move beyond degraded `safe_fallback`."

S3.12's closing guardrail (report §10) bounds what the next slice must NOT do:

> "Do not use the next slice to flip defaults, enable prod/staging, persist runtime data, call LLMs, activate voice, touch `.com`, create `/api/runtime/*`, or accept client runtime/body-authority input."

## 4. Exact reason S3.13 may proceed

S3.13 **may proceed as a canary-only slice** for the following grounded reason:

- The latest verified `main` commit is `9670d32` with a clean working tree.
- S3.12 is committed to `main` and verified **`PASS WITH CONDITIONS`**.
- S3.12 consumed S3.11 recommendation #1 (body-BA rejection canary), so the **next** ordered recommendation — the **controlled UI canary with route + response flags enabled, Kevin-owned, `.team` only** — is the sanctioned next step.
- That step is explicitly canary-scoped: observe the live degraded `safe_fallback` end-to-end render in a controlled environment **before broader enablement** — it requires **no architecture redesign**, no new route family, no retrieval path, no flag-default change.

Therefore S3.13 proceeds strictly inside the canary envelope below. It does **not** open approved-knowledge retrieval, persistence, LLM, voice, `.com`, `/api/runtime/*`, or any production/staging enablement.

## 5. Canary scope (binding)

S3.13 is confined to:

- **Surface:** `.team` only. Michael remains BA-facing training support only — never prospect-facing, never on `.com`.
- **Environment:** local / controlled **non-production only**. No staging, no production enablement of any kind.
- **Runtime behavior:** degraded **`safe_fallback` only**. The server-owned turn remains degraded and fail-closed; only the `michael_safe_fallback_degraded_en` fixture resolves. No real `next_training_step` is produced or promised.
- **Flags:** **no prod/staging enablement** and **no flag-flip-by-default**. Repo defaults stay default-off. The route/response flags are toggled only within an operator's local controlled session per the canary checklist, never as a committed default change to `server/src/config/michaelRuntimeFlags.ts`.
- **Explicitly out of scope (must NOT be introduced):** persistence (Mongo/Neo4j/Chroma/Gateway/GraphRAG), LLM (Anthropic/ScriptMaker/Ivory), dynamic / generated text, voice (Telnyx/TTS/STT/call-control), `.com`, approved-knowledge / candidate-knowledge retrieval, any `/api/runtime/*` route, and any acceptance of client runtime input or body-authority fields.

## 6. Allowed files (this slice may add)

New artifacts only — additive, non-production:

- New S3.13 reports / readiness review (this file: `engineering/reports/S3_13_CONTROLLED_UI_CANARY_READINESS_REVIEW.md`).
- A new S3.13 controlled-canary checklist doc under `engineering/reports/` (e.g. `S3_13_CONTROLLED_UI_CANARY_CHECKLIST.md`) — local/controlled only, prohibiting prod/staging enablement and request-body/PII logging, with the exact toggle/observe/rollback steps.
- A new S3.13 canary verification report under `engineering/reports/` when the slice is verified.
- A **new** S3.13 static governance test (e.g. `server/src/routes/__tests__/s313*GovernanceBoundary.test.ts`) that pins the canary boundary additively — without weakening any existing S3.x test.

## 7. Prohibited files (this slice must not touch)

- `apps/com/**` (`.com` / prospect-facing) — untouched.
- `server/src/index.ts` — no edits (append-only mount rule is irrelevant here; no new mount is needed).
- `.env`, `.env.example`, and any deployment / environment / infra config — untouched.
- `server/src/config/michaelRuntimeFlags.ts` — flag **defaults** must not change.
- Ratified governance docs (locked-spec, build-registry, wireframe, decision ledger, handoff-contract, etc.) — not rewritten by this canary slice.
- Existing S3.x tests — **must not be weakened, relaxed, deleted, or have assertions removed**. The S3.4/S3.6/S3.9/S3.10/S3.11/S3.12 behavioral and governance suites stay green and intact.
- Production runtime code: `server/src/routes/michael-runtime.ts`, `server/src/runtime/**`, `server/src/services/michaelRuntimeObservability.ts`, and `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx` — untouched.

## 8. Stop conditions (from the brief)

Halt the canary and do not proceed (revert to default-off, leave a note for Kevin) if any of the following arise:

- A `.com` / prospect-facing change would be required.
- Editing `server/src/index.ts`, `.env`, deployment config, or any ratified governance doc would be required.
- A change to flag **defaults** (committed default-on) would be required.
- The canary would require persistence, an LLM call, dynamic/generated text, voice, approved-knowledge retrieval, a new `/api/runtime/*` route, or acceptance of client runtime / body-authority input.
- An existing S3.x test would need to be weakened or removed to make the slice pass.
- The route returns anything other than the expected canary evidence (see §9) — e.g. a non-`safe_fallback` responseType, a real `next_training_step`, leaked IDs/trace/internals, or any `agentResponseGenerated: true` / persistence-enabled signal.
- Production or staging enablement would be needed to observe the behavior.

## 9. Expected evidence (canary observation matrix)

The controlled UI canary, run locally on `.team` only, is expected to produce exactly:

- **Flags OFF (default):** `POST /api/michael-runtime/resolve` → **`503`** with `reason: michael_runtime_disabled`. The card renders the calm `disabled` placeholder driven by the real endpoint. (Route kill switch, Axis 1.)
- **Route + response flags ON (controlled local session):** route → **`200`** resolving to the degraded **`safe_fallback`**:
  - `catalogKey` = **`michael_safe_fallback_degraded_en`** (EN fixture).
  - `responseType` = **`safe_fallback`**.
  - `agentResponseGenerated` = **`false`**.
  - persistence = **disabled** (no Mongo/Neo4j/Chroma/Gateway/GraphRAG write).
  - **No trace, no IDs, no internals** surfaced to the BA — the card maps only the safe subset (`text`, `responseType`, `language`, display-only `nextStep` strings). `trace` is only present in the payload when the trace flag is explicitly on, and is never rendered.
- **Negative guards unchanged:** missing session → `401`; any client runtime-input / body-authority field → `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`; body allowlist remains exactly `{ language?: 'en' | 'es' }`.

These expectations are consistent with the on-disk route (`server/src/routes/michael-runtime.ts`) and card (`apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx`) as reviewed for this readiness gate.

## 10. Readiness verdict

- Latest verified `main` commit: **`9670d32`** (PR #66), working tree clean.
- Prior slice S3.12 status: **`PASS WITH CONDITIONS`**.
- Recommendation used: **controlled UI canary with route + response flags enabled (Kevin-owned, `.team` only, observe degraded `safe_fallback` before broader enablement)**.
- **S3.13 may proceed: YES** — as a canary-only, documentation-grounded slice within the §5 envelope. No architecture redesign, no flag-default flip, no prod/staging enablement, no persistence/LLM/voice/`.com`/retrieval.
