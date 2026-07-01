# P6.8 — Steve Runtime Expansion Proposal (Retro-Documentation of Shipped Design)

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.8 — Steve Runtime Expansion Proposal
- **Status:** DOCUMENTATION-ONLY — records a design that is **already implemented and green on `main`**
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a` (HEAD verified to match)
- **Date:** 2026-07-01
- **Depends on:** P6.1 Charter; `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)

> **Reconciliation note.** The implementation prompt listed P6.8 as "NEW (implement)".
> Reconciliation found Steve already implemented on `main`
> (`c0090aa`, `bdc2ec0`, `2045cca`). Per the stop condition "about to rebuild
> existing code — STOP and reconcile", this proposal **documents the shipped design
> after the fact**; it authorizes and builds nothing new.

---

## 1. What Steve is

Steve is a **second, independent BA-facing agent**: the sole **New BA Discovery &
Success Interview** interviewer. He runs a warm discovery conversation with a
brand-new Brand Ambassador and produces a **Success Profile** artifact so the
sponsor and team can understand, personalize, support, and prepare for that BA.

Steve is **separate from Michael** and is now the onboarding **gate**: a new BA must
complete Steve discovery before the gated `.team` surface opens
(`requireSteveComplete`, `2045cca`).

## 2. Design as shipped

- **Self-contained script.** `server/src/domain/steve-success-interview.ts`
  defines `RAW_SECTIONS` — 6 sections (Welcome, Primary Why, Vision of Success,
  How You Learn, How You Like to Stay in Touch, How We Can Support You, Close) with
  sequential question numbering (`STEVE_DISCOVERY_SECTIONS`,
  `STEVE_DISCOVERY_QUESTIONS`). Unlike Michael, Steve depends on **no** master-content
  template key, so it can never throw on a missing tenant template.
- **System prompt builder.** `buildSteveSystemPrompt({ baFirstName })` returns a
  static system string for an **external** STT→LLM→TTS voice worker. The server
  itself makes **no** LLM call.
- **Profile assembly.** `assembleSuccessProfile(...)` is a **pure structural copy**
  that stamps `baId`/`generatedAt`/`signedBy` and passes the BA's own reads through
  verbatim — it "does NOT derive, weigh, re-order by importance, or grade anything."
- **Provenance literal.** `STEVE_SIGNED_BY = 'Steve Success · New BA Discovery &
  Success Interview'` stamped on every artifact.

## 3. Hard rules honored (design intent, verified in code)

- **No scoring / ranking / qualification / tone.** Every produced field reflects
  the BA's own words. There is no rubric, tier, weighted total, or tone read.
- **Michael isolation.** Steve reads/writes **no** `michael_*` collection or Michael
  graph data. The only coupling is a one-way `michaelHandoffSummary` **string** on
  Steve's own artifact, for training-support context; it never mutates Michael.
- **Compliance (locked-spec 3.10/3.12).** No earnings, commissions, cycle math, or
  placement/queue promises. Layer-1 framing only. BA-facing only; never on `.com`.
- **Persistence discipline.** Triple-stack write with a Mongo **read-back** before
  reporting success (detailed in P6.9/P6.10).

## 4. Runtime shape (implemented; detailed in P6.10)

- Domain module (above) + Express route family `/api/steve/*` +
  `apps/team/src/routes/steve-success-interview.tsx` +
  inert orchestration adapter `steveSuccessAdapter.ts` (S2.5) +
  registry descriptor `steve_success` (S2.1).
- The orchestration adapter is **inert** (`behaviorImplemented: false`); Steve's live
  behavior is delivered through the domain module + route + external worker, not
  through the orchestration spine.

## 5. Standing prohibitions preserved

No `.com`; no `/api/runtime/*` (uses sanctioned `/api/steve`); no unapproved
persistence (direct seam via `tripleStackWrite`); no LLM call from the server; no
dynamic generation (static script); no voice/call-control in-app; no
sending/scoring/ranking/qualification; no income/placement guarantees; no agent
approves knowledge; Context Manager remains sole packet assembler.

## 6. Recommendation

Record P6.8 as **DONE-ON-MAIN**. No further Steve proposal work is required; the
shipped design conforms to the charter and all standing prohibitions.
