# S3.8 — UI Compliance & UX Guardrails (Michael `.team` Render)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.8 multi-agent **PLANNING-ONLY** slice — Agent C deliverable
- Status: **DOCUMENTATION ONLY.** No UI, no code, no copy committed to any code file, no commit. This
  file is the sole artifact produced.
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent C (UI compliance / copy / UX guardrails)
- Grounded in (read on disk this slice):
  - `packages/shared/src/compliance.ts` — `NEVER_ON_COM`, `COM_DISCLAIMER`, `COMPLIANCE_FRAME`
  - `packages/shared/src/rules.ts` — `STANDING_RULE_THREE_AUTHORITATIVE`, `…_SPONSOR_IMMUTABLE`,
    `…_NO_PROGRAMMATIC_THREE_HANDOFF`, `…_POOL_MONOTONIC`
  - `packages/shared/src/brand.ts` — color tokens, `fonts` (Bebas Neue / DM Sans / DM Mono)
  - `CLAUDE.md` — "Compliance — never on `.com`" (the 5 prohibited things) + vocabulary discipline
  - `server/src/routes/michael-runtime.ts` — the S3.4 route behavior (the only Michael runtime route)
  - `engineering/reports/SPRINT_003_S3_7_CONTROLLED_CANARY_EXECUTION_RECORD.md` — canary outcomes,
    fixture `catalogKey: michael_next_training_step_en`, `agentResponseGenerated:false`,
    `persistence:"disabled"`

> Scope note. The S3.7 record names the next slice as a **read-only `.team` BA-facing UI proposal**,
> pointed at `POST /api/michael-runtime/resolve` only after the recorded stable canary, with the
> three-axis kill switch remaining the sole, default-closed gate. This document is the
> compliance / copy / UX **guardrail specification** for that future UI. It authorizes no build.
> All draft strings below are **PROPOSALS subject to review** (§29) and appear in this report only —
> never in a code file.

---

## 1. Purpose and what is being guard-railed

The future S3.8+ UI is a **read-only `.team` render** of one resolved fixture returned by the inert
S2.20 facade through the S3.4 route. The route generates no text, calls no LLM, persists nothing,
sends nothing, and is fully fail-closed behind ROUTE / RESPONSE / TRACE flags (all OFF; S3.7 §15).
Therefore the UI's job is narrow: **display a pre-authored training-support next step to the
signed-in Brand Ambassador (BA), framed as guidance — never as an automated action.** Everything in
this report exists to keep that narrow job from drifting into a prohibited surface.

The render consumes only the route's success payload: `selectionRequest`, `catalogKey`, and
`response` (and `trace` only if the trace axis is on — which the UI must never request or display;
see §19). The `response` already carries `agentResponseGenerated:false` and `persistence:"disabled"`;
the UI must **surface those facts honestly**, not hide them behind action-oriented chrome.

## 2. Behavioral guardrails (brief items 1–13) — what Michael's UI is and is NOT

Each row is a hard constraint the future UI must satisfy. "UI obligation" is what the render must do
or must never do to honor it; "Grounding" cites the source that makes it binding.

| # | Constraint | UI obligation | Grounding |
|---|---|---|---|
| 1 | **Michael is BA-facing only** | Render only inside `.team` (port 7702), behind `requireAuth` + `requireSteveComplete`. Never importable by `apps/com`. | CLAUDE.md "AI prospecting language… Michael is BA-facing only, never prospect-facing"; `NEVER_ON_COM[2]`; route is `.team`-only (S3.7 §13). |
| 2 | **Training-support only** | The only thing displayed is a single training-support next step. The fixture is `taskType: 'training_support'`, intent `clear_training_support`. No other task family is rendered. | S3.7 §9; route consumes the `training_support` fixture. |
| 3 | **Not prospect-facing** | No route, deep link, share link, OG image, or token path exposes this view to a prospect. No prospect data is shown. | `NEVER_ON_COM`; CLAUDE.md compliance section. |
| 4 | **No income claims** | No earnings, projections, commission figures, or cycle/volume/rank math anywhere on the surface — including microcopy, tooltips, and empty states. | `NEVER_ON_COM[0]`, `NEVER_ON_COM[3]`. |
| 5 | **No compensation calc** | The UI performs and displays no compensation, bonus, or volume calculation, even client-side, even "for context." | `NEVER_ON_COM[3]`. |
| 6 | **No placement promises** | No queue-position, leg-position, or placement-outcome language. The monotonic-pool UI lives elsewhere; Michael's render must not restate or imply placement. | `NEVER_ON_COM[1]`; `STANDING_RULE_POOL_MONOTONIC`; `COM_DISCLAIMER`. |
| 7 | **No ranking / qualifying prospects** | The UI never scores, ranks, grades, prioritizes, or "qualifies" a prospect. No "hot lead", "best fit", or lead-scoring affordance. | CLAUDE.md vocabulary discipline ("never 'leads', 'sales pipeline', 'pitch', or cold-outreach 'prospecting'"). |
| 8 | **Does not send messages** | No "send", "text", "email", or "message prospect" button is wired or even shown as disabled-pending. The render is read-only. | Route does no LLM/persistence/IO; `EMAIL_API_KEY` surface is out of scope. |
| 9 | **Does not call prospects** | No call, dial, click-to-call, or voice affordance. The fixture carries `nextStep.automaticCalling:false`, `externalSideEffect:false` (S3.7 §13). | `NEVER_ON_COM`; route is voice-free (S3.7 §13). |
| 10 | **Does not schedule** | No calendar, booking, reminder, or auto-schedule control. Scheduling of webinars/callbacks is a separate, BA-driven surface. | Route side-effect-free; S3.7 §13. |
| 11 | **Does not approve knowledge** | No "approve", "publish", "promote to knowledge base", or content-moderation control. Knowledge approval is not a runtime affordance. | Route is fixtures-only, non-persistent (S3.7 §13). |
| 12 | **Does not replace THREE International** | The UI never presents itself as an enrollment, registration, genealogy, or patronage system, and offers no handoff-to-THREE action. | `STANDING_RULE_NO_PROGRAMMATIC_THREE_HANDOFF`; CLAUDE.md "THREE… final authority… no programmatic enrollment handoff". |
| 13 | **THREE remains upstream authority** | Where the next step touches enrollment/placement, copy directs the BA to do it through THREE off-app, BA-to-BA — never in this UI. No THREE branding/logo appears (that is `.com`'s rule, but the UI must not imply it owns THREE's authority). | `STANDING_RULE_THREE_AUTHORITATIVE`; `NEVER_ON_COM[6]`. |

## 3. Affordance guardrails (brief items 14–20) — what may and may not appear

| # | Constraint | UI obligation | Grounding |
|---|---|---|---|
| 14 | **BA-owned next-step language only** | All step copy is framed as something the **BA** chooses to do next ("Your next training step", "When you're ready, you might…"), never something the system will do. The BA is the actor; Michael is the coach. | CLAUDE.md vocabulary ("BAs are **sharers**"); route is advisory-only. |
| 15 | **No automatic-action buttons** | No button performs a side effect. Any interactive control is limited to navigation (e.g. "Show another step" = re-fetch a fixture) or local UI state (expand/collapse). No "Do this for me" control exists. | Route does nothing but resolve a fixture (S3.4). |
| 16 | **No prospecting automation** | No automation to find, import, enrich, sequence, drip, or follow-up prospects. No campaign builder. | CLAUDE.md (no "sales pipeline", no "prospecting"); `NEVER_ON_COM[2]`. |
| 17 | **No voice controls** | No mic button, push-to-talk, dictation, TTS playback, or call control. The render is text-only. | Route is voice-free (S3.7 §13); S1.6 browser/voice foundation is not wired here. |
| 18 | **No LLM / generation controls** | No "regenerate", "rewrite", "make it shorter", temperature, or prompt box. Nothing implies text was or can be generated. The fixture is verbatim, returned by reference. | `agentResponseGenerated:false` (S3.7 §9/§10); route is LLM-free. |
| 19 | **No raw trace** | The UI must never request the trace axis and must never render `payload.trace` even if present. The redacted trace is an observability artifact, not BA-facing content. | Route gates trace behind axis-3 (`michael-runtime.ts:148-150`); trace is redacted internal metadata (S3.7 §10, §12). |
| 20 | **No admin observability** | The BA view shows no counters, flag states, snapshot, or `/api/admin/michael-runtime/observability` data. Observability is Kevin-only via `ADMIN_BA_IDS`. | S3.7 §6; admin surface is `requireAdmin`, distinct from this BA render. |

## 4. Copy labeling principle (brief item 21)

Every Michael surface element must be **labeled as coaching, not action.** The four allowed frames,
in priority order, are:

1. **Training support** — the section/banner identity ("Training support from Michael").
2. **Guidance** — the nature of the content ("Here's some guidance…").
3. **Next step** — the unit of content ("Your next step").
4. **NOT an automated action** — an explicit, persistent honesty line so no BA believes the app
   acted on their behalf ("Michael shares guidance only — he doesn't take any action for you.").

Forbidden framings anywhere in copy: "sending", "calling", "scheduling", "automating",
"qualifying", "lead", "pitch", "prospecting", any earnings/placement words. Use **"sharer" / "share"**
in place of "salesperson" / "sell". These map directly to CLAUDE.md vocabulary discipline and
`NEVER_ON_COM`.

## 5. State copy proposals (brief items 22–26) — DRAFT, SUBJECT TO REVIEW

> The strings below are **PROPOSALS for the future UI copy review (§29)**. They are illustrative,
> deliberately compliant (no income / placement / prospecting language; "sharer" not "salesperson"),
> and **are intentionally not placed in any code file.** Final wording, including the `_en` / `_es`
> pair (§6), is decided at implementation time after the copy review.

### 22 — Route/feature disabled state (axis-1, route flag OFF → HTTP 503 `michael_runtime_disabled`)
The route is the default-closed state for every BA until Kevin enables it. The UI should present
this as "not available yet", never as an error or a failure of the BA's action.

- Heading (proposal): **"Michael isn't available right now"**
- Body (proposal): "Training support from Michael is turned off for now. Nothing's wrong on your
  end — check back later."
- No retry-spam; a single, non-alarming "Check again" navigation control is acceptable.

### 23 — Response-disabled state (axis-2, response flag OFF → HTTP 503 `michael_runtime_response_disabled`)
Route is reachable but no content is returned. To the BA this is indistinguishable from "available
soon" and should read the same calm way.

- Heading (proposal): **"Michael is getting ready"**
- Body (proposal): "Training support is almost ready. There's nothing for you to do — it'll appear
  here when it's available."

### 24 — Safe fallback copy (success payload present but no usable next step, e.g. empty/edge fixture)
When the route returns `ok:true` but the render can't show a meaningful step, fail to a calm, BA-owned
default rather than a blank panel.

- Heading (proposal): **"No new step right now"**
- Body (proposal): "You're all caught up for the moment. When there's a next training step to share,
  Michael will show it here."

### 25 — Safe close copy (BA dismisses / collapses the Michael panel)
Dismissal must read as the BA's choice and imply nothing was sent, scheduled, or acted on.

- Action label (proposal): **"Close"** (not "Done", which can imply a task was completed/executed)
- Confirmation microcopy, if any (proposal): "Closed. Michael's guidance is here whenever you want
  it — nothing was sent or scheduled."

### 26 — Error copy (HTTP 4xx/5xx other than the two 503 disabled reasons; e.g. 401, 422 resolution_error)
Errors must avoid technical leakage (no codes, no trace, no stack) and avoid alarming the BA. Auth
expiry (401) should route to re-login, not show as a Michael error.

- Generic error heading (proposal): **"Something went sideways"**
- Body (proposal): "We couldn't load Michael's training support just now. Please try again in a
  moment."
- 401 case (proposal): "Your session timed out. Please sign in again to see Michael's training
  support." → link to login.
- The UI must **not** surface `code` values (`MISSING_RUNTIME_TURN`, `BODY_BA_SCOPE_NOT_ALLOWED`,
  `resolution_error`) to the BA; those are developer/observability concerns.

**Cross-state rule:** none of these strings may contain a number that reads as income, a position
that reads as placement, or a verb that reads as an automated action. That single rule is the
acceptance test for the §29 review.

## 6. Bilingual display considerations (brief item 27)

The platform serves bilingual BAs and the fixtures already carry a language suffix: the canary
resolved `catalogKey: michael_next_training_step_en` (S3.7 §9), and the facade chain carries a
`language` field in its trace (S3.7 §10) with documented ES-safe-path guardrails
(`s216` provenance / `michaelResponseContractEsGuardrails`, S3.7 §16). Localization approach
(without inventing strings):

- **Content language follows the fixture, not the chrome.** The displayed next-step text comes from
  the resolved catalog entry (`…_en` / `…_es` sibling). The UI must render the language the route
  resolved and must **not** machine-translate, regenerate, or "improve" it client-side (that would
  violate item 18 / `agentResponseGenerated:false`).
- **Chrome strings (headings, state copy in §5) are localized separately** via the standard `.team`
  i18n layer, keyed to the same language signal the route reports, so the frame matches the content
  language. Do not concatenate translated fragments — keep whole-sentence keys to preserve compliance
  review per language.
- **Both languages get the same compliance review.** A string that is compliant in English can drift
  in Spanish (e.g. a verb that reads as "I will send" rather than "you can share"). The §29 review
  must cover the `_es` strings with a native-fluent compliance reviewer, not a translation pass.
- **Layout must tolerate length variance.** Spanish copy typically runs 15–30% longer; headings and
  the "NOT an automated action" honesty line (§4) must not truncate or clip — no fixed-height single-
  line containers for copy.
- **No language toggle that implies regeneration.** If a language switch is offered, it must re-fetch
  the sibling fixture, not transform displayed text.

This report **does not author any `_es` string**; it specifies the approach so the implementation
slice and the copy review own the strings.

## 7. Accessibility requirements (brief item 28, WCAG 2.1 AA target)

The render is text-and-state UI, so AA is achievable cleanly. Requirements:

- **Semantic headings & landmarks.** The Michael panel is a labeled region (`role="region"` /
  `aria-labelledby`) with a real heading element; section order uses `h2`/`h3` hierarchy, not styled
  `div`s. Bebas Neue (`fonts.display`) is decorative-weight — never rely on it for meaning without a
  semantic element behind it.
- **Logical focus order.** Tab order follows visual order: heading → next-step content →
  navigation/close. No focus traps. The only interactive controls are navigation/close (item 15), so
  focus management stays simple; a newly-rendered step should move focus to its heading or be
  announced (see live region below).
- **Screen-reader labeling.** The honesty line ("not an automated action", §4) must be in the
  accessible name/description of the panel, not conveyed by an icon alone — a non-sighted BA must
  also know Michael takes no action. Close/navigation controls have explicit `aria-label`s
  ("Close Michael training support"). State transitions (disabled → available, §22/§23) use an
  `aria-live="polite"` region so the change is announced without stealing focus.
- **Contrast against brand colors.** Body copy is `colors.cream` (`#F5EFE6`) on `colors.ink`
  (`#0A0A0A`) / `ink2` (`#0F0F0F`) — very high contrast, AA-safe. Caution points to verify at
  implementation: `colors.gold` (`#C9A84C`) and `colors.teal` (`#2DD4BF`) as **text** on dark ink
  pass AA for large text but `gold` is borderline for small body text — reserve gold/teal for
  headings, large labels, and non-text accents, not small body copy. `creamMute` (0.72 alpha) and
  especially `creamFaint` (0.48 alpha) must **not** carry essential copy at small sizes — they fail
  AA as small body text; use them only for large or non-essential decoration.
- **No color-only signaling.** Disabled vs. available vs. error states must be distinguished by text
  and/or icon-with-label, never by color alone (e.g. the lifecycle/status badge classes in
  `brand.ts` must carry a text label, not just a hue). A red-only error or a gold-only "ready" badge
  is non-conforming.
- **Reduced motion.** Any animated counter/ticker/progress primitive (`brand.ts` `tm-animated-counter`,
  `tm-rolling-ticker`, `tm-progress-meter`) used near this panel must honor `prefers-reduced-motion`.
- **Text scaling.** Copy containers reflow at 200% zoom without clipping (reinforces the §6 length
  rule).

## 8. Recommendation — future UI copy review before implementation (brief item 29)

**Recommendation: a dedicated UI copy review must precede any S3.8+ implementation, and its sign-off
is a build precondition — not a post-hoc check.** Specifics:

1. **Scope.** Every BA-visible string: headings, the four-frame labeling (§4), all five state-copy
   families (§5, items 22–26), navigation/close labels, and accessible names/`aria-label`s (§7).
2. **Bilingual.** English and Spanish reviewed independently by a native-fluent reviewer for each
   language (§6); a translation that drifts into action/placement/income language fails the gate.
3. **Compliance checklist applied to copy.** Run each string against `NEVER_ON_COM`, the CLAUDE.md
   5-prohibited list, and the vocabulary discipline ("sharer" not "salesperson"; no
   "lead/pitch/prospecting"). The acceptance test from §5 applies: no income-reading number, no
   placement-reading position, no action-reading verb.
4. **Honesty-line verification.** Confirm the "Michael shares guidance only / takes no action"
   message is present, prominent, and in the accessible description on every state — including
   disabled and error states.
5. **No copy in code until reviewed.** Per this slice's constraint and the append-only shared-file
   rules, finalized strings land only after review, in the appropriate `.team` i18n/copy location —
   never hard-coded ad hoc, and never in `packages/shared/src/types.ts` or `server/src/index.ts`
   except per the append-only rule.
6. **Re-review on fixture change.** Because displayed content is the fixture itself (item 18), any
   new or edited `michael_next_training_step_*` catalog entry must go through the same compliance
   review before it can surface in the UI.

## 9. Out of scope / explicit non-actions (this slice)

Consistent with S3.7 §18, this report builds nothing and approves nothing. Specifically NOT done
here: no UI component, no copy committed to any code file, no i18n keys, no route change, no flag
flip, no `.env` change, no commit. The three `MICHAEL_RUNTIME_*` axes remain OFF and the kill switch
remains the sole default-closed gate. Implementation of the `.team` render, and authoring of final
(EN/ES) strings, remains gated on Kevin's separate, explicit, recorded authorization and on the
§8 copy review.

---

This is the Sprint 3 S3.8 UI compliance / copy / UX guardrails specification (Agent C,
planning-only). All draft strings are proposals subject to the §8 review and appear only in this
report.
