# Sprint 3 S3.8 — `.team` Michael Runtime UI Placement Proposal

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.8 multi-agent **PLANNING-ONLY** slice — propose where a future BA-facing `.team` UI for the
  S3.4 minimal Michael runtime route (`POST /api/michael-runtime/resolve`) should live.
- Status: **PROPOSAL ONLY.** No UI built, no React/TSX added or edited, no route enabled, no flag flipped,
  no commit. This document recommends a placement; it authorizes nothing.
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent A (placement proposal)
- Reviewed read-only to ground every recommendation:
  - `apps/team/src/App.tsx` (router), `apps/team/src/routes/*`, `apps/team/src/components/cockpit/*`
  - `docs/page-inventory.md` (canonical `.team` routes/pages)
  - `docs/project-wireframe.md` (`.team` leaf status, §3.1–§3.6)
  - `docs/locked-spec.md` §3.11 compliance, §3.12 Steve and Michael
  - `engineering/reports/SPRINT_003_S3_7_CONTROLLED_CANARY_EXECUTION_RECORD.md`
  - `engineering/reports/SPRINT_003_S3_6_MINIMAL_IN_MEMORY_OBSERVABILITY_VERIFICATION.md`
  - `server/src/routes/michael-runtime.ts` (the route the future UI would consume)

---

## 1. Confirmation: this is proposal-only

This is a **documentation-only** deliverable. Agent A built no UI, added no React component, touched no file
under `apps/team/`, registered no route, changed no env, and flipped no flag. The three `MICHAEL_RUNTIME_*`
axes remain off (per S3.7 §15, S3.6 §24). Nothing here is an authorization to implement; the recommended
work is explicitly deferred to a future, separately-gated slice (§17) that begins only on Kevin's recorded
approval. The kill switch remains the sole, default-closed gate.

This proposal also makes no claim that the route should be enabled. UI placement and route enablement are
independent decisions; this document addresses placement only and assumes the route stays default-off until
Kevin authorizes otherwise.

## 2. Current `.team` route / page inventory (real, on-disk)

From `apps/team/src/App.tsx` (the live React Router table) cross-checked against `docs/page-inventory.md`
(canonical 39-page `.team` inventory) and `docs/project-wireframe.md` §3. The **routes that actually exist
on disk** today:

| Route (App.tsx) | Page component | Surface group | Audience / gate |
|---|---|---|---|
| `/register` | `RegisterPage` | Signup/auth | Pre-gate (opens the gate) |
| `/login` | `LoginPage` | Signup/auth | Pre-gate |
| `/welcome` | `WelcomePage` | Onboarding | Pre-gate, post-auth |
| `/steve/discovery` | `SteveSuccessInterviewPage` | Onboarding (Steve) | Auth; the discovery gate itself |
| `/cockpit` | `CockpitPage` | **Operational BA dashboard** | Auth; operational PMV unlocks after Steve |
| `/invitations` | `InvitationsPage` | Operational tools | Auth + Steve-gated |
| `/video-library` | `VideoLibraryPage` | Training/tools | Auth |
| `/ivory` | `IvoryPage` | Operational tools (Ivory writer) | Auth + Steve-gated |
| `/ivory/momentum` | `IvoryMomentumPage` | Operational tools | Auth + Steve-gated |
| `/crm` | `CrmPage` | Operational tools (CRM hub) | Auth + Steve-gated |
| `/vm-campaigns` | `VmCampaignsPage` | Operational tools | Auth + Steve-gated |
| `/profile` | `ProfilePage` | Account | Auth |
| `/leadership` | `LeadershipPage` | Leadership/credibility | Auth |
| `/training/10-steps` | `TenStepsPage` | Training | Auth |
| `/training/fast-start` | `FastStartHubPage` | **Training hub** (5 modules) | Auth; Modules 2–5 Steve-gated |
| `/training/fast-start/{product,comp-layer-1,binary,prospect-list,team}` | module pages | Training | Auth / Steve-gated |
| `/onboarding/questionnaire` | `QuestionnairePage` | Onboarding | Auth |
| `/sponsor/interview-workbook/:baId` | `SponsorWorkbookPage` | Sponsor (downline) | Auth (sponsor-only server-enforced) |
| `/preview` | `PreviewPage` | Preview (BA-as-prospect) | Auth |
| `*` | inline 404 | System state | — |

Relevant existing **components / sub-surfaces inside `/cockpit`** (`apps/team/src/routes/cockpit.tsx` +
`apps/team/src/components/cockpit/*`):

- `AgentSupportPanel` (aside) — a card titled **"What should I do next?"** with the eyebrow
  **"Steve + Ivory + Michael"**, currently rendering three static next-action suggestions. Michael is already
  named here.
- `CockpitModuleCard` grid — Prospect CRM / PMV / VM Campaigns / Ivory entry tiles.
- `OrientationCard`, `TrackRecordCard`, `SponsorCard`, Leadership tile, Focus Queue, Prospect Momentum Table.
- `MichaelTrainingSupportCard` (`components/cockpit/MichaelTrainingSupportCard.tsx`) — **a separate, existing
  Michael surface**: a *sponsor-only* read of a **downline** BA's training-support guidance, fed by
  `GET /api/michael/training-support/:downlineBaId` (the #134/#147 `michaelScoring` artifact). This is **not**
  the S3.4 runtime route and must not be conflated with it (see §3 and §4).

**Note on the two distinct "Michael" surfaces.** `GET /api/michael/training-support/:downlineBaId` is the
existing sponsor-facing card about *someone else* (a downline). The S3.4 route
`POST /api/michael-runtime/resolve` is BA-scoped from `req.session.baId` and resolves **the signed-in BA's
own** next training-support step (catalog key `michael_next_training_step_en`, task type `training_support`).
The future UI is a *self*-view, not a downline card — this distinction drives the placement below.

## 3. Recommended UI placement

**Place the future Michael runtime UI inside the existing `/cockpit` BA dashboard
(`apps/team/src/routes/cockpit.tsx`), specifically as a card rendered within / immediately adjacent to the
existing `AgentSupportPanel` aside ("What should I do next? · Steve + Ivory + Michael").**

Justification, grounded in the real inventory:

1. **Content match.** The route returns `michael_next_training_step_en` — a single "next training step" for the
   authenticated BA. That is exactly what the `AgentSupportPanel` already exists to answer ("What should I do
   next?"). It is the only existing `.team` surface whose stated job *is* a coached next action and that
   already names Michael in its eyebrow.
2. **Scope match.** The route is BA-self-scoped from the session (`server/src/routes/michael-runtime.ts:71`,
   sponsor immutability enforced, body BA fields rejected). The cockpit Agent Support panel is likewise the
   BA's own self-view — no downline, no sponsor-of-someone-else semantics.
3. **Gate match.** Locked-spec §3.12 makes Michael the Training Agent / Daily Success Coach, BA-facing only.
   The cockpit's operational view already renders only after Steve completes (`cockpit.tsx` branches on
   `launch.steve.phase !== 'complete'` → locked state), which mirrors the route's server gate
   (`requireAuth` + `requireSteveComplete`). Placement and route gate agree without new gating logic.
4. **Compliance match.** `/cockpit` is an established BA-facing, Steve-gated, non-`.com` surface that already
   carries no income/placement/THREE-branding content. Adding one read-only Michael card introduces no new
   compliance boundary.
5. **Lowest blast radius.** The panel already exists with the right framing; the future slice adds one card to
   one aside rather than a new route, new nav entry, or new page in the 39-page inventory.

## 4. Rejected placements and why

- **`apps/com` / any `/p/{token}` prospect surface — REJECTED, hard rule.** Locked-spec §3.11/§3.12: Michael is
  BA-facing only and *never* appears on `.com`. Non-negotiable (see §8).
- **`/admin` (admin cockpit / observability) — REJECTED.** Admin is Kevin-only (`ADMIN_BA_IDS`). The route is a
  *BA-facing* training-support surface; a BA must be able to see their own next step. The admin surface is the
  right home for the *observability counters and raw trace* (§16), not for the BA-facing response (see §9).
- **`MichaelTrainingSupportCard` (the existing sponsor-only downline card) — REJECTED for this route.** It is
  fed by a *different* endpoint (`/api/michael/training-support/:downlineBaId`), is *sponsor-scoped to a
  downline*, and is server-enforced 403 unless the viewer is the direct sponsor. Reusing it would cross the
  self-vs-downline scope boundary and risk leaking the new route into a sponsor context. Keep them distinct.
- **`/training/fast-start` hub — REJECTED as primary (viable secondary).** The Fast Start hub is a
  *curriculum-module* surface (5 fixed modules + progress strip), not a coached next-action surface. A
  "Michael's next step" card *could* live there in a later iteration, but the curriculum framing is a weaker
  match than the cockpit's "what should I do next" panel, and the hub is reachable pre-Steve for Module 1
  whereas the route is Steve-gated — a mismatch that would force extra conditional gating.
- **`/ivory`, `/crm`, `/vm-campaigns`, `/invitations` — REJECTED.** These are message-writing / prospect-ops
  surfaces. Michael is training/coaching, not prospect messaging; placing him here blurs the agent's role.
- **A brand-new dedicated `/michael` route/page — REJECTED.** Adds a page outside the canonical 39-page
  inventory and an empty nav destination for a single fixture card. Premature; revisit only if the surface
  grows beyond one card.

## 5. Which surface kind: cockpit / training support / BA dashboard / Michael-specific panel / other

**Chosen: the BA cockpit — i.e. the operational BA dashboard (`/cockpit`) — reusing its existing Agent Support
panel rather than a new standalone Michael panel.**

Reasoning from the real surfaces: among the five candidate kinds, "BA dashboard" and "Michael-specific panel"
both describe a self-scoped coaching home, but a *new* Michael-specific panel duplicates an aside that already
exists and already names Michael. The cockpit dashboard is the live, Steve-gated, self-scoped surface; the
Agent Support panel within it is the narrowest correct host. So: **cockpit dashboard surface, expressed as a
Michael card inside the existing Agent Support panel** — not a separate page, not the sponsor-only downline
card, not the training-curriculum hub.

## 6. UI purpose

The future card has a single, bounded purpose:

- **Show one safe Michael training-support response** for the signed-in BA — the verbatim
  `michael_next_training_step_en` fixture returned by reference from the route (`response.*`), rendered as a
  short "your next training step" prompt. No text is generated client-side; the UI renders only what the route
  returns.
- **Let the BA continue training** — the card's only forward action is a link into existing training/launch
  surfaces (e.g. `/training/fast-start` or the relevant module), reusing existing navigation. It coaches a next
  step; it does not itself perform one.
- **No prospect-facing actions.** The card never mints a link, never references a prospect by identity, never
  surfaces income/placement/headcount, and never exposes anything that could appear to a prospect. It is a
  read-only training nudge.

## 7. User role

- **Authenticated BA only.** The route requires `requireAuth`; the UI is reachable only from `/cockpit`, itself
  post-auth. Unauthenticated users get the existing redirect-to-register behavior already in `cockpit.tsx`.
- **Onboarding-complete only.** The route requires `requireSteveComplete`
  (`server/src/middleware/requireSteveComplete.ts`). The cockpit's operational view already renders the locked
  state until `steve.phase === 'complete'`, so the card naturally appears only for Steve-complete BAs. The UI
  must not attempt to call the route before Steve is complete; the existing locked state is the correct
  pre-Steve empty surface.

## 8. No `.com`

The card must never be imported, rendered, or referenced from `apps/com` or any `/p/{token}` prospect surface.
This is a locked-spec §3.11/§3.12 hard rule: Michael is BA-facing only and never appears on `.com`. The future
slice touches `apps/team/` only and must add zero `apps/com` import. (S3.7 §13 / S3.6 §20 confirm the route
itself carries no `apps/com` coupling; the UI must preserve that.)

## 9. No admin-only surface

The BA-facing response must not be hidden behind `/admin`. A BA must be able to see their own next training
step from their own cockpit. `/admin` remains Kevin-only (`ADMIN_BA_IDS`) and is reserved for the *operational
observability* of the route (the in-memory counters at
`GET /api/admin/michael-runtime/observability`, S3.6 §6) and, if ever surfaced, the raw redacted trace (§16) —
never the BA-facing card.

## 10. No general public surface

The card must not appear on any unauthenticated or public surface — no public landing, no logged-out state, no
shared/preview link reachable without a BA session. It lives strictly behind auth + Steve gate inside
`/cockpit`.

## 11. Proposed empty / disabled state (default, route off)

Because all three `MICHAEL_RUNTIME_*` flags are off by default, the route returns
`503 { ok:false, disabled:true, reason:"michael_runtime_disabled" }` (S3.7 §7). The card's default state must
therefore be a **calm, non-error "not available yet" state**, not a failure:

- Render a quiet, muted placeholder consistent with the existing `AgentSupportPanel` styling (e.g. an eyebrow
  "Michael · training support" and a one-line "Your daily training step from Michael will appear here.").
- Treat HTTP 503 with `reason: michael_runtime_disabled` / `michael_runtime_response_disabled` as the
  **disabled state**, identical in appearance to "no content yet" — never a red error. The kill switch being
  closed is the expected default, not a fault.
- The existing static three-suggestion Agent Support panel can remain as the surrounding content so the BA is
  never left with a dead panel while Michael is off.

## 12. Loading state

While the `POST /api/michael-runtime/resolve` call is in flight, show a lightweight inline loading affordance
matching the cockpit's existing pattern (e.g. a muted "Loading…" eyebrow as used by `MichaelTrainingSupportCard`
and `CrmPanel`). No spinner-blocking of the rest of the cockpit; the card loads independently of the PMV/CRM
loads already on the page.

## 13. Success state (route on, valid turn)

On `200 { ok:true, response, catalogKey, selectionRequest }` (S3.7 §9):

- Render the resolved fixture's BA-safe training-support content (the `michael_next_training_step_en` body) as a
  short coached next step, in Michael's eyebrow/branding already present in the panel.
- Provide a single forward action that links into an existing training surface (no new behavior).
- Do **not** render `selectionRequest`, `catalogKey`, or any internal field to the BA — those are diagnostic,
  not BA-facing copy.
- Render **no** trace, even when present in the payload (see §16).

## 14. Safe fallback state (route on, but error / malformed)

For `422` (facade failure / malformed turn) or any other non-200 from the route, the card must **fail closed to
the same calm empty state** as §11 — never surface a raw error body, stack, issue codes, or internal message to
the BA. A single neutral line ("Michael doesn't have a step for you right now — keep moving through your Fast
Start.") with the existing static suggestions still visible. Network errors degrade identically. The BA's
cockpit must remain fully usable regardless of the route's outcome.

## 15. Safe close state

The card must be dismissable/closable without side effects: closing it performs **no** write, no persistence, no
follow-up call, and no state mutation beyond local UI visibility (consistent with the route being non-persistent
— S3.7 §13). Reopening simply re-requests the fixture. There is nothing to "save" because the route stores
nothing; closing is purely a view concern.

## 16. Trace visibility

- **Default hidden from the BA.** The redacted trace (`payload.trace`, present only when the trace axis is on —
  `michael-runtime.ts:148`) must **never** be rendered in the BA-facing card. The BA sees only the safe
  response copy.
- **Trace is admin/dev-only.** If the trace is ever surfaced for diagnostics, it belongs on the Kevin-only
  `/admin` Michael-runtime surface alongside the existing observability counters — not in `/cockpit`.
- **No raw trace body to the BA** under any flag combination, unless a *separate, explicit* future approval
  authorizes it. Even then it would be an admin/dev affordance, not BA-facing. This preserves the redaction
  posture verified in S3.7 §12 and S3.6 §12 (no token/sessionId/turnId/correlationId/PII ever shown).

## 17. Recommendation for a future implementation slice (S3.9)

A future, separately-gated **S3.9** slice would build the card proposed here, with these guardrails:

1. **Scope:** add ONE read-only Michael training-support card to `apps/team/src/routes/cockpit.tsx`, rendered
   within / adjacent to the existing `AgentSupportPanel`. New component under
   `apps/team/src/components/cockpit/` (e.g. `MichaelRuntimeStepCard.tsx`), consuming
   `POST /api/michael-runtime/resolve` only. No new route, no nav change, no new inventory page.
2. **States:** implement all five states above (§11 empty/disabled, §12 loading, §13 success, §14 safe
   fallback, §15 safe close), defaulting to the calm disabled state because the route ships off.
3. **Gate posture unchanged:** the route stays default-off behind the three-axis kill switch; the UI must
   behave correctly with all flags off (renders the disabled state) and must not assume enablement. Shipping the
   UI does **not** require or imply flipping any flag.
4. **Hard boundaries (carry verbatim):** `.team`-only, never `.com` (§8); never the sponsor-only downline card
   (§4); no trace shown to BA (§16); no persistence, no LLM call, no dynamic text generation, no voice — the UI
   renders the fixture by reference exactly as the route returns it.
5. **Append-only discipline:** if any shared type is needed, append to `packages/shared/src/types.ts`; do not
   edit existing exports. `server/src/index.ts` is untouched (route already mounted). Tick the relevant
   `docs/project-wireframe.md` §3.2 Michael leaf and regenerate the queue/checklist on landing.
6. **Sequencing:** S3.9 proceeds only after the S3.7 canary (already on record, PASS) and only on Kevin's
   explicit, recorded approval — matching the S3.6 §29 / S3.7 §17 sequencing (observability → canary → `.team`
   UI). No implementation begins without that approval.

This proposal recommends placement and shape only. It builds nothing, enables nothing, and changes no flag.
