# P6.9 — Steve Runtime Contract (Retro-Documentation of Shipped Contract)

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.9 — Steve Runtime Contract
- **Status:** DOCUMENTATION-ONLY — records a contract **already implemented as code** on `main`
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a`
- **Date:** 2026-07-01
- **Depends on:** P6.8; `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)

> Unlike P6.3 (Ivory response contract, which is spec-only / fixture-response
> shaped), Steve's contract is **already realized in TypeScript types + a Zod
> ingest schema + a registry descriptor**. This report documents that shipped
> contract; it changes no code.

---

## 1. Data contract — shared types

Defined in `packages/shared/src/types.ts` (imported by the domain via
`@momentum/shared`):

- `SteveDiscoveryPhase` — UI phase (`awaiting_call` … `complete`); Steve has no
  scheduler of its own.
- `SteveTranscriptChunk` — `{ sequence, speaker: 'steve' | 'ba', text, occurredAt }`.
- `SteveDiscoveryAnswer` — `{ questionId, prompt, answerText }`. **No `scoringTags`**
  (explicit — Steve does not score).
- `SteveDiscoveryFocus`, `SteveLearningModality` — descriptive enums, no ranking.
- `SteveSuccessProfile` — `primaryWhy`, `successVision`, `learningStyle`,
  `communicationPreferences`, `supportNeeds`, `launchRecommendations`,
  `trainingRecommendations`, `michaelHandoffSummary`, `generatedAt`, `signedBy`.
- `SteveDiscoveryArtifact` — the persisted shape (baId, sponsorBaId, callSid,
  startedAt, completedAt, transcript, answers, successProfile, audioUrl).
- `SteveDiscoveryIngestPayload` — the worker→server ingest input.
- `SteveDiscoveryView`, `SteveProfileCard` — the BA self-read and sponsor-read views.

## 2. Wire contract — Zod ingest schema

`IngestBody` in `server/src/routes/steve.ts` validates the worker payload:

- `baId` (min 1), `callSid` (nullable), `startedAt` / `completedAt` (min-10 ISO),
  `transcript[]` (`sequence`, `speaker ∈ {steve, ba}`, `text`, `occurredAt`),
  `answers[]` (`questionId`, `prompt`, `answerText`),
  `audioUrl` (nullable), and `profile{…}` with typed sub-objects:
  - `primaryWhy { statement, who, whyNow }`
  - `successVision { statement, oneBigChange }`
  - `learningStyle { modalities[∈ watching|doing|step_by_step|reading|discussing|mixed], feedbackPreference, notes }`
  - `communicationPreferences { preferredChannels[∈ text|call|email|in_app|video|in_person], cadence ∈ {daily|few_times_week|weekly|as_needed}|null, bestTimes, notes }`
  - `supportNeeds { areas[], potentialObstacles[], helpStyle, notes }`
  - `launchRecommendations[]`, `trainingRecommendations[]` (`{ text, href? }`)
  - `michaelHandoffSummary` (string)

**`sponsorBaId` is NOT in the schema** — it is never accepted from the payload
(sponsor immutability, spec 3.5). It is server-stamped from `brand_ambassadors`.

## 3. Orchestration contract — registry descriptor

`steve_success` in `server/src/runtime/orchestration/registry.ts` declares:

- `allowedTaskTypes`: `success_interview`, `session_resume`, `guided_action_review`
- `supportedModes`: `browser_text`, `browser_voice`, `mixed`; `supportedLanguages`: `en`, `es`
- `guardrailSet`: `no_scoring`, `no_ranking`, `no_success_prediction`,
  `no_qualification`, `no_income_or_placement_claims`, `no_three_authority_claims`,
  `no_direct_store_access`
- `allowedOutputs`: interview/clarifying question, session summary, next-step /
  reflection prompt, guided-action suggestion
- **`forbiddenOutputs`**: `score`, `rank`, `readiness_classification`,
  `qualification_classification`, `income_projection`, `placement_promise`,
  `automated_prospecting_list`, `three_authority_decision`
- `requiresContextPacket: true`; **`behaviorImplemented: false`**

## 4. Invariants (contract obligations, verified in P6.10)

1. `sponsorBaId` server-stamped, never from payload.
2. Idempotent on `baId` (`_id = SD-{baId}`); re-ingest replaces the prior artifact.
3. Triple-stack write with Mongo read-back (`READBACK_FAILED` on miss).
4. Content truncated to the gateway's 5000-char cap defensively.
5. No field carries a score/rank/tier; profile is a verbatim structural copy.
6. Sponsor-only reads authorized server-side (`requestingBaId == downline.sponsorBaId`).

## 5. Recommendation

Record P6.9 as **DONE-ON-MAIN**. The Steve contract is fully expressed in shipped
types, the Zod ingest schema, and the registry descriptor, and conforms to the
charter and prohibitions.
