# P6.3 Ivory Response Contract and Catalog

- Sprint: Sprint 6 — Multi-Agent Runtime Expansion
- Slice: P6.3 (Agent B — Architecture) Ivory Response Contract and Catalog
- Status: PLANNING / GOVERNANCE / SPECIFICATION ONLY — NON-AUTHORIZING DRAFT
- Architecture version: v1.0 frozen (S2.1 orchestration skeleton)
- Branch: feature/phase-06-multi-agent-runtime-expansion
- Base SHA: d39ab149ef41baf23f370bead4b54a83d3e1433a (HEAD verified to match)
- Date: 2026-06-29
- Depends on: P6.1 Charter, P6.2 Ivory Runtime Proposal
- Owner: Phase 6 worktree (Codex CLI Instance 1)

---

## 1. Executive Verdict

This document **specifies** (does not implement) the proposed `ivory_response_contract.v1`
response envelope and a fixture-indexed, returned-only Ivory response **catalog** for the
first activation objective (`relationship_coaching`, per P6.2). It mirrors Michael's
`michael_response_contract.v1` (S2.11/S2.14) and `MICHAEL_RESPONSE_CATALOG` (S2.17), with
domain fields adjusted from `training` to `relationship`.

Recommendation: adopt this contract and catalog **as the specification** for a future,
gated implementation slice. **No types, fixtures, or selector code are added in this
session** — this is a non-authorizing spec. `agentResponseGenerated: false` and
`persistence: 'disabled'` hold throughout.

---

## 2. Explicit NON-AUTHORIZING Status

This specification authorizes nothing. It does **not** add code, mount a route, persist
anything, call an LLM, or generate text. The TypeScript shown below is a **proposed shape
for a future, separate decision** — it is illustrative, not committed source.

---

## 3. Proposed Response Contract — `ivory_response_contract.v1`

Modeled directly on `MichaelResponseContractV1` (`runtime/orchestration/types.ts`). All
inert markers are mandatory and fixed-literal.

```ts
// PROPOSED — NOT IMPLEMENTED THIS SESSION (spec only)

export type IvoryResponseContractSchemaVersion = 'ivory_response_contract.v1';

// First slice (relationship_coaching) response types:
export type IvoryResponseType =
  | 'relationship_prompt'    // substantive WDYK coaching prompt (complete packet only)
  | 'clarifying_question'    // one focused question (complete packet only)
  | 'safe_fallback'          // limited response on degraded/missing packet
  | 'safe_close';            // non-substantive close on failed/rejected packet

export type IvoryResponseSafetyValidationStatus = 'passed' | 'blocked' | 'degraded';

export type IvoryResponseContextPacketStatus =
  | ContextPacketV1['packetStatus']
  | 'missing'
  | 'rejected';

export interface IvoryResponseSafety {
  validationStatus: IvoryResponseSafetyValidationStatus;
  guardrailIds: string[];        // e.g. 'no_auto_send', 'ba_owned_action', …
  blockedReasonCodes: string[];
}

// First slice carries NO sendable next step. A reflection prompt is text only.
export interface IvoryResponseReflectionStep {
  label?: string;
  prompt?: string;               // a question the BA reflects on — never a message to send
  baOwned: true;
  automaticSending: false;
  automaticCalling: false;
  externalSideEffect: false;
}

export interface IvoryResponseContractV1 {
  schemaVersion: IvoryResponseContractSchemaVersion;
  responseType: IvoryResponseType;
  agentKey: 'ivory';
  taskType: 'relationship_coaching';     // first slice only
  sessionId: SessionId;
  turnId: RuntimeTurnId;
  correlationId: CorrelationId;
  contextPacketStatus: IvoryResponseContextPacketStatus;
  language: 'en' | 'es';
  text: string;                          // pre-authored fixture text; never generated
  safety: IvoryResponseSafety;
  persistence: 'disabled';
  generatedAt: string;
  agentResponseGenerated: false;
  contextPacketId?: string;              // present only with a valid (complete) packet
  reflectionStep?: IvoryResponseReflectionStep; // only for relationship_prompt
}
```

### 3.1 Required fields

`schemaVersion`, `responseType`, `agentKey`, `taskType`, `sessionId`, `turnId`,
`correlationId`, `contextPacketStatus`, `language`, `text`, `safety`, `persistence`,
`generatedAt`, `agentResponseGenerated`.

### 3.2 Fixed-literal fields (must equal exactly)

- `agentKey` = `'ivory'`
- `taskType` = `'relationship_coaching'` (first slice)
- `persistence` = `'disabled'`
- `agentResponseGenerated` = `false`
- `schemaVersion` = `'ivory_response_contract.v1'`

### 3.3 Conditional rules (mirror Michael's validator)

- `reflectionStep` is allowed **only** for `responseType: 'relationship_prompt'`; it is
  forbidden on `clarifying_question`, `safe_fallback`, and `safe_close`.
- `contextPacketId` may be present **only** when the packet is valid/complete (not on
  `missing` / `failed` / `rejected`).
- Substantive responses (`relationship_prompt`, `clarifying_question`) require a
  **complete** Context Packet.
- `degraded` / `missing` → must be `safe_fallback`.
- `failed` / `rejected` → must be `safe_close`.

---

## 4. Forbidden Fields

The Ivory response envelope must **not** contain (validator rejects on presence):

- `score`
- `rank`
- `classification`
- `readinessClassification`
- `prediction`
- `prospectScore`
- `leadQualification`
- `qualification`
- `incomeProjection`
- `placementPromise`
- `recipientList`
- `recipients`
- `bulkOutreachList`
- `automatedProspectingList`
- `tokenizedLink`
- `prospectToken`
- `sentMessage`
- `autoSend`
- `placedCall`
- `medicalAdvice`
- `threeAuthorityClaim`

---

## 5. Proposed Validation Codes

Mirror `MichaelResponseContractValidationCode`, adjusted for Ivory's first-slice rules:

```ts
// PROPOSED — NOT IMPLEMENTED THIS SESSION (spec only)
export type IvoryResponseContractValidationCode =
  | 'not_object'
  | 'missing_required_field'
  | 'invalid_literal'
  | 'invalid_enum'
  | 'invalid_type'
  | 'invalid_timestamp'
  | 'forbidden_field'
  | 'unexpected_field'
  | 'context_packet_id_without_valid_packet'
  | 'substantive_response_not_allowed'
  | 'rejected_context_requires_safe_close'
  | 'failed_context_requires_safe_close'
  | 'reflection_step_not_allowed'      // reflectionStep on a non-relationship_prompt type
  | 'reflection_step_must_be_ba_owned' // baOwned/automatic flags violated
  | 'prohibited_text';                 // banned phrase (income/placement/medical/outreach)
```

---

## 6. Proposed Catalog — `IVORY_RESPONSE_CATALOG`

A read-only catalog wrapper over pre-authored EN/ES Ivory fixtures, mirroring
`MichaelResponseCatalogEntry` and the S2.17 verification pattern. It generates **no** text,
calls **no** LLM, mounts **no** route, and performs **no** persistence or data access — it
only lists and looks up fixtures that already validate against `ivory_response_contract.v1`.

```ts
// PROPOSED — NOT IMPLEMENTED THIS SESSION (spec only)

export type IvoryResponseScenarioFamily =
  | 'complete'    // complete Context Packet, substantive response
  | 'degraded'    // partial Context Packet, safe fallback
  | 'missing'     // no Context Manager boundary
  | 'failed'      // Context Packet validation failed
  | 'rejected';   // candidate-review-only / rejected packet

export interface IvoryResponseCatalogEntry {
  readonly catalogKey: string;            // e.g. 'ivory_relationship_prompt_en'
  readonly language: 'en' | 'es';
  readonly responseType: IvoryResponseType;
  readonly contextPacketStatus: IvoryResponseContextPacketStatus;
  readonly scenarioFamily: IvoryResponseScenarioFamily;
  readonly isSubstantive: boolean;        // true only for complete + substantive
  readonly isSafePath: boolean;           // true for safe_fallback / safe_close
  readonly allowedForFirstIvorySlice: boolean;
  readonly response: IvoryResponseContractV1;
}
```

### 6.1 Proposed catalog entries (12 — symmetric EN/ES, mirrors Michael's 12)

| catalogKey | language | responseType | packetStatus | scenarioFamily | substantive |
|---|---|---|---|---|---|
| `ivory_relationship_prompt_en` | en | relationship_prompt | complete | complete | yes |
| `ivory_relationship_prompt_es` | es | relationship_prompt | complete | complete | yes |
| `ivory_clarifying_question_en` | en | clarifying_question | complete | complete | yes |
| `ivory_clarifying_question_es` | es | clarifying_question | complete | complete | yes |
| `ivory_safe_fallback_degraded_en` | en | safe_fallback | degraded | degraded | no |
| `ivory_safe_fallback_degraded_es` | es | safe_fallback | degraded | degraded | no |
| `ivory_safe_fallback_missing_en` | en | safe_fallback | missing | missing | no |
| `ivory_safe_fallback_missing_es` | es | safe_fallback | missing | missing | no |
| `ivory_safe_close_failed_en` | en | safe_close | failed | failed | no |
| `ivory_safe_close_failed_es` | es | safe_close | failed | failed | no |
| `ivory_safe_close_rejected_en` | en | safe_close | rejected | rejected | no |
| `ivory_safe_close_rejected_es` | es | safe_close | rejected | rejected | no |

`reflectionStep` appears only on the two `relationship_prompt` entries; all safe-path
entries omit it. Only the four `complete` entries set `isSubstantive: true`; the eight
safe-path entries set `isSafePath: true`.

### 6.2 Proposed selector (pure, returned-only)

Mirror `MichaelResponseCatalogSelectionRequest` / `...SelectionResult`: a deterministic
request `(agentKey, taskType, language, responseType, scenarioFamily, contextPacketStatus?)`
resolves to exactly one `catalogKey`/entry, or returns issues
(`wrong_agent` / `wrong_task` / `unsupported_language` / `invalid_response_type` /
`invalid_scenario_family` / `inconsistent_context_status` / `invalid_combination` /
`catalog_key_not_found` / `invalid_contract`). The selector generates no text and mutates
no entry.

---

## 7. Catalog-Level Validation (Spec)

A future implementation's catalog validator must assert, mirroring
`MichaelResponseCatalogValidationResult`:

- every entry validates against `ivory_response_contract.v1`;
- every entry has `agentKey: 'ivory'` and `taskType: 'relationship_coaching'`;
- every entry has `persistence: 'disabled'` and `agentResponseGenerated: false`;
- no safe-path entry carries a `reflectionStep`;
- EN/ES symmetry (every responseType/scenarioFamily present in both languages);
- no entry contains any forbidden field or prohibited text.

Issue codes mirror Michael's: `invalid_contract`, `wrong_agent`, `wrong_task`,
`persistence_not_disabled`, `agent_response_generated`, `reflection_step_on_safe_path`.

---

## 8. Inert-State Markers (Restated)

Whether described here or implemented later, every Ivory response/catalog artifact carries:

- `behavior: 'not_implemented'` (at the orchestration layer)
- `agentResponseGenerated: false`
- `persistence: 'disabled'` (and all per-axis persistence disabled)
- route-free (no mount)
- fixture-only (pre-authored, contract-valid; no dynamic text, no LLM)

---

## 9. Required Tests (For The Future, Gated Implementation Slice)

When the contract/catalog is implemented (a separate, approved slice), it must add — before
any further gate — tests mirroring Michael's:

- contract-validator unit tests (required fields, fixed literals, conditional rules,
  forbidden fields, prohibited text), EN and ES;
- catalog symmetry + per-entry contract validity tests;
- selector resolution + rejection tests;
- static boundary tests: no prohibited imports, no dynamic text generation, no persistence
  wiring, no route mount, no LLM client import.

None of these are added in this session (spec only, no code).

---

## 10. Standing Prohibitions Preserved

- No `.com` exposure — Ivory responses are `.team` BA-facing only.
- No `/api/runtime/*` route family.
- No unapproved persistence.
- No LLM calls / no dynamic generation — all text is pre-authored fixtures.
- No voice / Telnyx / PSTN / call-control.
- No automatic sending / calling / scheduling / prospecting / scoring / ranking /
  qualification.
- No income / compensation / cycle / placement guarantees.
- No agent may approve knowledge.
- Context Manager remains the sole Context Packet assembler.

---

## 11. Recommendation To Kevin

Approve **as the specification only**:

- `ivory_response_contract.v1` shape (§3) with its forbidden-field and validation-code
  sets (§4–§5).
- The 12-entry, EN/ES-symmetric, returned-only `IVORY_RESPONSE_CATALOG` + selector
  spec (§6) for the `relationship_coaching` first slice.

Do **not** approve (separate, future, gated decisions):

- Implementing the types, fixtures, catalog, or selector (a later approved slice).
- Any route, persistence, LLM call, dynamic generation, or behavior activation.
- `invitation_drafting` response shapes (deferred to its own slice).

This document specifies a contract and catalog. It implements and activates nothing.
