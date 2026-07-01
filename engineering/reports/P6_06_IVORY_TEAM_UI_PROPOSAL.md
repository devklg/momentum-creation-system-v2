# P6.6 — Ivory .team UI Proposal (Retro-Documentation of Shipped UI)

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.6 — Ivory .team UI Proposal
- **Status:** DOCUMENTATION-ONLY — records UI **already implemented** on `main`
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a`
- **Date:** 2026-07-01
- **Depends on:** P6.4; `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)

---

## 1. Surfaces (as shipped)

Two `.team` routes deliver Ivory to Brand Ambassadors:

- **`apps/team/src/routes/ivory.tsx`** — the **Invitation Agent**: a relationship-first
  flow to invite a warm-market contact.
- **`apps/team/src/routes/ivory-momentum.tsx`** — the **Momentum Agent**: a post-mint
  cohort view with per-prospect follow-up suggestions.

Both are BA-facing only, behind `requireAuth + requireSteveComplete`, and call
`/api/ivory/*` with `credentials: 'include'`. No `sponsorBaId` is ever sent from the
client.

## 2. Invitation Agent — intended UX (matches shipped `ivory.tsx`)

A four-step linear flow (`Step: 'person' | 'reason' | 'draft' | 'ready'`):

1. **person** — pick an existing roster name or create one (first/last name, notes).
2. **reason** — capture the relationship reason (+ optional product name).
3. **draft** — review the drafted warm message and enter contact details
   (city, state/region, phone, optional email). Draft is LLM-generated with a
   deterministic fallback when the key is dormant.
4. **ready** — copy the link / copy message+link / mark sent.

Compliance intent: no income/placement/scoring language; the message is a warm,
personal invitation, never a pitch; the system never claims it will send/call for the BA.

## 3. Momentum Agent — intended UX (matches shipped `ivory-momentum.tsx`)

A read-model dashboard:

- **CountsStrip** — lifecycle cohort counts (cohort, callback, watched, watching,
  opened, sent, draft, expired).
- **FocusQueue** — top-12 rows ordered by **signal** priority (not person scoring).
- **FullCohort** — all Ivory-sourced prospects, newest first.
- **Drawer** — one prospect: lifecycle + next action, relationship context,
  categories/preferred angle, and a suggested follow-up (LLM or fallback) with a
  copy-message button.

Compliance intent: the follow-up suggestion names no scoring/ranking of the person,
no income/placement language; priority chips describe the **signal**, not a verdict on
the prospect.

## 4. Standing prohibitions preserved

`.team`-only (no `.com`); BA-private (`baId` from session); no scoring/ranking of
people in the UI (signal-only priority); LLM drafting is wired-dormant + guarded; no
automatic sending (the BA copies and sends themselves).

## 5. Recommendation

Record P6.6 as **DONE-ON-MAIN**. The shipped UI matches this proposal; no UI proposal
work remains. Implementation conformance is verified in P6.7.
