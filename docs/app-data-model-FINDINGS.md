# MCS Data-Model Integrity — Session Findings (read-verified)

> Compaction-insurance capture. Every item below was verified by reading the
> actual file this session, not inferred. Line numbers are from the files as
> read on the date of writing. This is the evidence base for the rewrite of
> `app-data-model-contract.md` (§2 integrity model, §6 graph vocabulary, the
> A-vs-B reconciliation, and the finish-work list).

## The core conclusion

The app is **A-described, B-built**: the code carries the *language* of the
agentic/GraphRAG system ("triple-stack", "feed GraphRAG", "no DB is optional",
`VISIBLE_TO_SPONSOR`) but the *behavior* is incomplete. The gap is **finite and
systemic** — it reduces to four fixes plus one vocabulary cleanup, applied
uniformly. Nothing here requires re-architecting; it requires finishing what was
started. The newest files (training, audit, broadcast) already do it correctly,
which proves the correct version is achievable in this codebase.

Verified scope: the app has **never run**, nothing seeded/tested. The empty
stores therefore say nothing about intended behavior — the *code* is the only
ground truth, which is why every claim below is from a read.

## The four systemic fixes

1. **Fire-once writes, no retry, no rollback, not atomic.** The shared
   `server/src/services/tripleStack.ts` writes Mongo first (always), then Neo4j
   (optional), then Chroma (optional), sequentially. If a later leg throws after
   Mongo commits, you get a half-write + an error and no retry ever comes back.
   Header says "No DB is optional"; the code makes neo4j and chroma optional per
   call. Fix once in this shared helper → every caller inherits durable
   projection-with-retry + read-back verify.

2. **Vocabulary drift `:BA` vs `:BrandAmbassador`.** Six files write the wrong
   label `:BA`; three write the canonical `:BrandAmbassador`. Standardize on
   `:BrandAmbassador` (it's the one the newest files already use).
   - WRONG (`:BA`): `ba.ts` (registration, ~205), `invitations.ts` (205–206),
     `callbackRequest.ts` (130–131), `crm.ts` (164,267,374,396 + DISPOSED/
     HAS_FOLLOWUP edges), `codeGen.ts` (119), `orientationSession.ts` (461),
     `michael-founder-handoff.ts` (handoffCypher, `MERGE (b:BA)`),
     `michaelScoring.ts` (artifactCypher, `MERGE (b:BA)` + `MERGE (s:BA)`).
   - RIGHT (`:BrandAmbassador`): `training.ts` (MERGE b:BrandAmbassador),
     `auditLog.ts` (181, `OPTIONAL MATCH (ba:BrandAmbassador)` — correct pattern),
     `broadcast.ts` (448,592, `MATCH (a:BrandAmbassador)` — correct pattern).

3. **`MERGE` invents phantom nodes.** Sponsors/subjects are attached with
   `MERGE (b:BA {baId})` instead of `MATCH`, so a missing/typo'd sponsor
   silently creates a fake node. Present in invitations, callback, crm, codeGen,
   orientation, founder-handoff, scoring. The correct pattern already exists:
   `auditLog.ts` uses `OPTIONAL MATCH`, `broadcast.ts` uses `MATCH`. Change
   must-pre-exist nodes to `MATCH`.

4. **Master-content Wave 2 never wired.** `services/masterContent.ts` is the
   read path that resolves `code default → master override`. Its own comment:
   saved overrides land in `master_content_versions` but consumers still read
   code defaults, so **a saved override is functionally inert**. Editing Ivory/
   Michael/training agent voice in admin SAVES but does NOTHING until the Wave-2
   consumer rewires ship. This is the worst "expecting A, receiving B": every
   surface confirms the save while the agent delivers the old copy.

## Canonical graph edge vocabulary (confirm + unify)

Live/written edge names found: `UPLINE_IS` (210 live) but registration writes
`SPONSORED_BY`; holding tank writes `IN_HOLDING_TANK` (not `PLACED_IN`);
`INVITED`, `FOR_PROSPECT`, `HAS_FOLLOWUP`, `DISPOSED`, `USES` (access code),
`RESERVED_ORIENTATION`, `HAD_MICHAEL_INTERVIEW`, `VISIBLE_TO_SPONSOR`,
`READY_FOR_HANDOFF`, `HAS_PROGRESS`, `SENT_BY`, `ACTED_BY`. Pick canonical names
(esp. resolve sponsorship: `UPLINE_IS` vs `SPONSORED_BY`; placement:
`IN_HOLDING_TANK` vs `PLACED_IN`) and make all writers agree.

## Per-agent A-vs-B (the three agents that define the product)

- **Ivory** (sponsorship coach, `domain/ivory.ts`, 859 lines): real LLM coach,
  LIVE (Anthropic key set). Reads master content (`team.ivory.coach_prompt`),
  walks the graph (`MATCH (n:IvoryName)`). GAPS: create=fire-once; updates are
  separate Mongo-then-Neo4j (desync); coaching voice inert until Wave 2.
- **Michael** (Training Agent + Daily Success Coach artifact): `michaelScoring.ts` is sponsor-stamped
  and idempotent. The 2026-06-24 correction retires scoring/classification:
  legacy score fields are ignored and no founder handoff is created for new
  ingests. GAPS: `:BA` drift, transcript chunks Mongo-ONLY by design (never
  embedded — only a 500-char summary goes to Chroma), re-ingest silently skips
  Chroma (stale embedding), fire-once. `michael-founder-handoff.ts` remains
  legacy/historical-read code only.
- **Training** (`domain/training.ts`, 325): BEST FILE. Real writes, forward-only,
  idempotent, correct `:BrandAmbassador`, cross-checks invites from spine.
  `fast_start_progress` empty only because no BA has run. GAPS: same fire-once +
  phantom-MERGE. Training agent must read transcript + behavioral trail together.

## Key design decision locked this session

**The interview transcript is the foundation training grows from** (Kevin's
framing: the what/why/how of support comes from the interview). Therefore the
FULL transcript must be a first-class Tier-2 knowledge record: chunked +
embedded (per-BA, per-question) into `mcs_michael_interviews`, graph-linked,
and access-gated (`VISIBLE_TO_SPONSOR` enforced at READ — BA + sponsor + agents
only). Today only a 500-char summary reaches Chroma; the transcript itself is
Mongo-only. This is a build item.

## Three-tier integrity model (the target)

- **Tier 1 — Graph-critical (membership + agent-reasoned relations):** BA +
  `UPLINE_IS`, prospect + sponsor edge, Ivory edges. Mongo+Neo4j atomic-or-
  rollback; sponsor must pre-exist (`MATCH`); canonical vocabulary. A BA with no
  sponsor edge isn't "missing a projection" — they don't belong yet.
- **Tier 2 — Knowledge-critical (what agents learn from):** Michael interview +
  FULL transcript, master content, CRM notes, the BA behavioral trail. Mongo
  authoritative; projection MANDATORY via durable retry until it lands; alert if
  it can't. The training agent stands on this.
- **Tier 3 — Operational:** callbacks, fast-start ticks, webinar reservations.
  Mongo-commit-is-success; projections retry but never block.

Sorting test for any write: *would Michael, Ivory, or the training agent give
bad advice if this record half-wrote?* If yes → Tier 1 or 2.

## Status of keys (.env, verified — values not printed)

SET: ANTHROPIC_API_KEY (Ivory/ScriptMaker LIVE), ANTHROPIC_MODEL, all TELNYX_*,
JWT, ports, URLs, ADMIN_BA_IDS, CORS, EMAIL_PROVIDER, EMAIL_FROM.
EMPTY: EMAIL_API_KEY + EMAIL_REPLY_TO (Resend dormant — email stamps 'skipped').
NOT PRESENT: MICHAEL_WORKER_SECRET — so Michael interview-ingest endpoints stay
503; the voice worker loop can't close until it's set. Voice worker itself is
specced (see Michael_Voice_Worker_Architecture_Recommendation.docx — Telnyx
native first, LiveKit durable later), not yet built.

## How to work with the agent (Kevin's standing rule, made explicit)

Do NOT assume the agent has read for context — it does not auto-ingest docs.
Every factual claim about the system must be backed by a this-session read
(point to where) or explicitly flagged as unverified inference. The agent has a
built-in pull toward "enough to answer"; the tell is asserting without a read
behind it. Read everything pertinent before asserting.
