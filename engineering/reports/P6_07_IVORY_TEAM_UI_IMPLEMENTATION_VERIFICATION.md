# P6.7 — Ivory .team UI Implementation Verification

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.7 — Ivory .team UI Implementation
- **Status:** VERIFICATION — code **DONE-ON-MAIN**; verifies conformance to P6.6
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a`
- **Date:** 2026-07-01
- **Depends on:** P6.6; `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)

---

## 1. Files verified

- `apps/team/src/routes/ivory.tsx` — `IvoryPage()` (Invitation Agent).
- `apps/team/src/routes/ivory-momentum.tsx` — `IvoryMomentumPage()` (Momentum Agent).

## 2. Invitation Agent conformance (`ivory.tsx`)

- Four-step state machine `person → reason → draft → ready` matches the P6.6 proposal.
- API calls: `GET /api/ivory` (roster), `POST /api/ivory` (create),
  `POST /api/ivory/invitation-agent/draft` (draft),
  `POST /api/ivory/invitation-agent/mint` (mint),
  `POST /api/invitations/:prospectId/sent` (mark sent). All `credentials:'include'`.
- **No `sponsorBaId` in any request body.** `baId` is implicit via the session cookie.
- Final step is copy-link / copy-message / mark-sent — **the BA sends manually**; the
  UI never triggers automatic sending.

## 3. Momentum Agent conformance (`ivory-momentum.tsx`)

- Sections: header, `CountsStrip` (8 lifecycle counts), `FocusQueue` (top-12 by
  signal), `FullCohort`, `Drawer`.
- API calls: `GET /api/ivory/momentum` (view),
  `POST /api/ivory/momentum/:prospectId/suggest` (follow-up). All `credentials:'include'`.
- `PriorityChip` renders the **signal** reason, not a person score. Drawer shows
  lifecycle + next action + relationship context + a copy-message suggestion.
- Uses local wire types (the documented `.team` TS6059 convention) mirroring
  `@momentum/shared` shapes.

## 4. Compliance (render-time)

- BA-facing only; no `.com` exposure; no income/placement/head-count language.
- No person scoring/ranking surfaced; priority is signal-based.
- LLM-derived text (draft/suggest) degrades to deterministic fallback when dormant,
  and the fallback text is compliance-safe.

## 5. Gate evidence

`pnpm --filter @momentum/team typecheck` ✅ (part of `pnpm typecheck`),
`pnpm build` ✅ (`apps/team` build Done — 1640 modules transformed). No runtime test
runner exists for the client workspaces; verification is typecheck + build + the
route/domain server tests that back these surfaces.

## 6. Recommendation

Record P6.7 as **DONE-ON-MAIN & VERIFIED**. The shipped UI conforms to the P6.6
proposal and the compliance rules. No UI changes made.
