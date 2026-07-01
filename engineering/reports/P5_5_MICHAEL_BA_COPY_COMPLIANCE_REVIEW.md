# P5.5 — Michael BA-Facing Copy Compliance Review

- Phase: **Phase 5 — Michael Production Enablement and Operations**
- Agent: **Agent D** (copy/fixture compliance review)
- Mode: **DOCUMENTATION ONLY / READ-ONLY.** No source changed, no `.env` edited, no flag flipped, no
  route enabled, no persistence written. This file is the sole artifact produced.
- Date: 2026-07-01
- Worktree: `D:\mcs-v2-phase-worktrees\phase-05-production-ops`
- Base: Phase 3 (Michael runtime) closeout — commit `d39ab149ef41baf23f370bead4b54a83d3e1433a`
- Phase anchor (consistency): `engineering/reports/SPRINT_005_P5_READINESS_AND_DEPENDENCY_GATE_ASSESSMENT.md`

> This review authorizes **nothing**. It does not enable Michael, flip a kill switch, or approve a
> deploy. It is a static, read-only assessment of the copy the Michael runtime *can* surface to a
> Brand Ambassador at this tree base. Any enablement remains gated on Kevin Gardner's separate,
> explicit, execution-time approval per the P5 readiness anchor.

---

## 1. Scope and Method

**In scope:** every BA-facing copy string the Michael runtime resolution path can return, plus a
verification that no prospect-facing (`.com`) path can surface Michael copy.

**Compliance rules read (authoritative source):**
- `packages/shared/src/compliance.ts` — `NEVER_ON_COM` list and `COM_DISCLAIMER`.
- `packages/shared/src/rules.ts` — standing rules (THREE authority, sponsor immutability, no
  programmatic THREE handoff, pool monotonicity).

The seven `NEVER_ON_COM` items (verbatim from `compliance.ts` lines 10–18): income claims / earnings
projections; placement or queue-position-equals-leg-position promises; **AI prospecting (Michael is
BA-facing only)**; compensation cycle/volume/rank math; current team head count; direct comparison to
other teams/companies; THREE International branding.

**Files read to locate and quote the actual copy (read-only):**
- `server/src/routes/michael-runtime.ts` — the runtime route. Confirmed it returns fixtures **by
  reference** (`result.response`) and never generates text.
- `server/src/runtime/orchestration/michaelResponseCatalog.ts` — the controlled catalog (12 entries)
  that maps `catalogKey` → fixture.
- `server/src/runtime/orchestration/fixtures/michaelResponseFixtures.ts` — the pre-authored fixture
  copy (the actual strings a BA would see).
- `server/src/runtime/orchestration/fixtures/index.ts` — fixture barrel export.
- `server/src/index.ts` — route mount context (line 246, gated BA route family).
- `server/src/routes/admin/michael-runtime-observability.ts` — admin observability read (counters
  only).
- `apps/com/**` — grepped for `michael`/`Michael` (prospect surface).

**Method:** Every string below was read directly from disk and is quoted verbatim (including the
Spanish accented characters as stored). No string was paraphrased into compliance.

---

## 2. BA-Facing Michael Copy — Enumerated and Assessed

The runtime returns a fixture verbatim as `response` (route `michael-runtime.ts` lines 166–177). The
catalog binds 12 `catalogKey`s to 12 valid fixtures (`michaelResponseCatalog.ts` lines 78–109). Each
fixture's `text` is the primary BA-visible string; the two `next_training_step` fixtures additionally
carry a `nextStep.title` and `nextStep.instruction` that are BA-visible. **16 distinct copy strings**
in total. Source for all: `server/src/runtime/orchestration/fixtures/michaelResponseFixtures.ts`.

### 2.1 Substantive — `next_training_step`

**S1** — `michael_next_training_step_en` (`text`, line 69):
> "Review the next training step, then write down one question you want your sponsor to help you practice."
- **PASS.** No income/placement/head-count/THREE/comparison language. BA-facing training coaching.

**S2** — `next_training_step_en` `nextStep.title` (line 72): "Review the next training step" — **PASS.**

**S3** — `next_training_step_en` `nextStep.instruction` (lines 73–74):
> "Open the next training step and make one private note about what you want to practice."
- **PASS.** BA-owned action, no automatic side effect (fixture sets `automaticSending/Calling/externalSideEffect: false`).

**S4** — `michael_next_training_step_es` (`text`, line 87):
> "Repasa el siguiente paso de entrenamiento y anota una pregunta para practicarla con tu patrocinador."
- **PASS.** Spanish mirror of S1; no forbidden content.

**S5** — `next_training_step_es` `nextStep.title` (line 90): "Repasa el siguiente paso" — **PASS.**

**S6** — `next_training_step_es` `nextStep.instruction` (lines 91–92):
> "Abre el siguiente paso de entrenamiento y escribe una nota privada sobre lo que quieres practicar."
- **PASS.**

### 2.2 Substantive — `clarification_question`

**S7** — `michael_clarification_question_en` (`text`, line 105):
> "Which part would help most right now: understanding the two-leg structure, practicing your words, or choosing the next training page?"
- **PASS (with note, see §4).** Mentions "the two-leg structure." This is **BA-facing** training
  language about the compensation structure, which is permitted for a BA-only surface. The
  `NEVER_ON_COM` placement rule forbids *placement/queue-position-equals-leg-position promises on
  `.com`*; this string makes no placement promise and is not on `.com`. No violation. Flagged in §4
  only because "leg structure" is the vocabulary the placement rule polices, so any future accidental
  prospect exposure would make it sensitive.

**S8** — `michael_clarification_question_es` (`text`, line 114):
> "¿Qué te ayudaría más ahora: entender la estructura de dos piernas, practicar tus palabras o elegir la próxima página de entrenamiento?"
- **PASS (with same note as S7).** Spanish mirror; "estructura de dos piernas" = "two-leg structure."

### 2.3 Safe-path — `safe_fallback`

**S9** — `michael_safe_fallback_degraded_en` (`text`, line 123):
> "I have limited context right now, so keep this simple: continue with the next training step and ask your sponsor before making any outside commitment."
- **PASS.** Degraded fallback; defers to sponsor; no forbidden content.

**S10** — `michael_safe_fallback_missing_en` (`text`, line 131):
> "I do not have the training context I need. Please return to the training page or ask your sponsor for the next step."
- **PASS.**

**S11** — `michael_safe_fallback_degraded_es` (`text`, line 164):
> "Ahora tengo contexto limitado, así que mantengámoslo sencillo: sigue con tu entrenamiento y consulta a tu patrocinador antes de cualquier compromiso externo."
- **PASS.** Spanish mirror of S9.

**S12** — `michael_safe_fallback_missing_es` (`text`, line 172):
> "No tengo el contexto de entrenamiento que necesito. Por favor regresa a la página de entrenamiento o pide a tu patrocinador el siguiente paso."
- **PASS.** Spanish mirror of S10.

### 2.4 Safe-path — `safe_close`

**S13** — `michael_safe_close_failed_en` (`text`, line 139):
> "I cannot continue this training turn without a valid Context Packet. Nothing was saved or sent."
- **PASS.** Fail-closed message; affirms no persistence/send.

**S14** — `michael_safe_close_rejected_en` (`text`, line 147):
> "I cannot use candidate or review-only context for this turn. Please continue from approved training context only."
- **PASS.**

**S15** — `michael_safe_close_failed_es` (`text`, line 180):
> "No puedo continuar este turno de entrenamiento sin un Context Packet válido. No se guardó ni se envió nada."
- **PASS.** Spanish mirror of S13.

**S16** — `michael_safe_close_rejected_es` (`text`, line 188):
> "No puedo usar contexto candidato o de solo revisión en este turno. Por favor continúa solo desde contexto de entrenamiento aprobado."
- **PASS.** Spanish mirror of S14.

### 2.5 Fixture-embedded safety metadata (corroborating, not user copy)

`michaelResponseFixtures.ts` lines 42–62 attach guardrail IDs to each fixture — notably
`'no_prospect_facing_language'`, `'no_income_or_placement_claims'`, and `'no_automatic_actions'`
(`validSafety`, lines 42–50). These are self-declared metadata, not proof, but they are consistent
with the copy assessment above. Negative-control fixtures also exist (lines 195–223) — e.g.
`prospectFacingMessage: 'Send this to your prospect.'` (line 202) — but these are **invalid** fixtures
used only to prove the contract validator rejects them; they are **not** in `MICHAEL_RESPONSE_CATALOG`
(the catalog binds only the 12 valid fixtures, `michaelResponseCatalog.ts` lines 78–109) and cannot be
returned by the route.

**Result: 16 of 16 BA-facing copy strings PASS. Zero FLAGS (zero rule violations).** Two strings
(S7/S8) carry an advisory note, not a flag.

---

## 3. No Prospect-Facing (`.com`) Path Can Surface Michael Copy — Evidence

Three independent findings, all confirmed on disk:

1. **`apps/com` contains no Michael reference at all.** Grep for `michael|Michael` across `apps/com`
   returned **no files**. The prospect surface neither imports nor renders any Michael fixture,
   catalog, or route client.

2. **The runtime route is a gated BA-only route.** `server/src/index.ts` line 246 mounts
   `michaelRuntimeRoutes` at `/api/michael-runtime`; the mount comment (lines 240–245) states it is a
   "gated BA route family." The route file `server/src/routes/michael-runtime.ts` registers `/resolve`
   behind `requireAuth, requireSteveComplete` (lines 189–196) and reads BA scope from
   `req.session.baId`, returning 401 when absent (lines 121–124). Prospects on `.com` have no BA
   session, so they cannot reach a 200. The route header (lines 1–14) documents it as `.team`-only,
   authenticated, BA-scoped, fixtures-only, non-persistent, LLM-free, and fail-closed behind a
   three-axis kill switch (route/response/trace), each defaulting off (`michael-runtime.ts` lines
   76–90).

3. **The admin observability read exposes no copy.** `server/src/routes/admin/michael-runtime-observability.ts`
   returns only the in-memory snapshot (booleans + counters), is `requireAdmin`-gated, and its header
   (lines 8–13) states "no PII, no tokens, no IDs, no raw env strings … Not BA-facing, never on
   `.com`." No fixture text passes through it.

**Conclusion: refutation attempted, none found.** No `.com`/prospect-facing path can surface Michael
copy at this tree base.

---

## 4. Gaps, Ambiguities, and Borderline Copy

1. **S7/S8 "two-leg structure" / "estructura de dos piernas" (advisory, not a flag).** Legitimate
   BA-facing training vocabulary and compliant on a BA surface. It is called out only because it is
   the exact placement/leg vocabulary the `NEVER_ON_COM` rule polices; it must never migrate to a
   prospect surface. No action required at this tree — the BA-only boundary (§3) holds.

2. **Runtime kill-switch state not verified here.** This review is copy-only. Whether the
   `MICHAEL_RUNTIME_*` flags are on/off is an env/runtime concern outside a read-only copy review and
   is deliberately not assessed (and, per worktree rules, not touched). Regardless of flag state, the
   returnable copy set is the 12 catalog fixtures assessed above.

3. **Onboarding `/api/michael` route not in scope.** `server/src/index.ts` distinguishes the
   pre-gate `/api/michael` onboarding route from `/api/michael-runtime` (mount comment lines 243–245).
   This review covers the **runtime** copy the catalog surfaces. Any copy in the separate onboarding
   route was not enumerated here and is a candidate for a follow-up review if it renders BA-visible
   strings.

4. **Nothing could not be located.** All 12 catalog fixtures resolved to concrete strings on disk;
   there were no dangling `catalogKey`s or missing fixture exports. The catalog-to-fixture binding is
   1:1 and complete (`michaelResponseCatalog.ts` lines 78–109 vs. fixture exports in
   `michaelResponseFixtures.ts`).

---

## 5. Overall Verdict

**PASS — BA-facing Michael copy is compliant at this tree base.** All 16 enumerated copy strings (12
fixture `text` + 4 `nextStep` sub-strings) clear every `NEVER_ON_COM` rule: no income/earnings/cycle
math, no placement promises, no head count, no THREE International branding, no team/company
comparison, and no prospect-facing/AI-prospecting exposure (Michael is architecturally BA-only, §3).
Zero rule violations were found; two strings carry an advisory note only.

**Caveat — this is the state of THIS worktree at Phase 3 closeout** (base `d39ab14`). It reflects the
12-entry controlled catalog as it exists on disk now. Any later addition to
`MICHAEL_RESPONSE_CATALOG` or its fixtures requires a fresh copy review before enablement; this
verdict does not pre-clear future copy.

---

## 6. Non-Approval Statement

This document is a read-only compliance review. It changes no source, config, `.env`, flag, route,
or persisted state, and it approves no enablement, deployment, or activation. It records findings
only. Any Michael runtime enablement remains gated on Kevin Gardner's separate, explicit,
execution-time approval, consistent with
`engineering/reports/SPRINT_005_P5_READINESS_AND_DEPENDENCY_GATE_ASSESSMENT.md`.
