# S2.14 QA / Rollback / Implementation Gate Review

## Executive Verdict

PASS for planning/governance only.

S2.15 should be allowed only as a route-free, persistence-free, LLM-free, voice-free, `.com`-free inert Michael runtime adapter contract slice. It may connect the existing S2.13 validated Michael response contract fixture path to the existing inert Michael adapter boundary, but it must not activate live Michael behavior.

## Inputs Reviewed

- `engineering/reports/SPRINT_002_S2_13_MICHAEL_RESPONSE_CONTRACT_RUNTIME_FIXTURE_INTEGRATION_VERIFICATION.md`
- `engineering/reports/SPRINT_002_S2_12_MICHAEL_RESPONSE_CONTRACT_FIXTURE_EVALUATION_VERIFICATION.md`
- `server/src/runtime/orchestration/__tests__/`
- `server/src/qa/`
- `.github/workflows/ci.yml`

## 1. Required Gate Commands

Future S2.15 work must pass all existing merge gates:

```bash
pnpm build:shared
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```

Future S2.15 must also add and pass a focused server test gate covering Michael adapter contract behavior:

```bash
pnpm --filter @momentum/server test -- michaelMagnificentAdapter michaelRuntimeResponse michaelResponse s215
```

The CI gate in `.github/workflows/ci.yml` already enforces `build:shared`, `typecheck`, `build`, and full server tests on PRs to `main` and pushes to `main`.

## 2. Required Test Count Baseline From S2.13

S2.15 must not regress below the S2.13 verified baseline:

- Full server suite baseline: `39 test files, 269 tests`.
- Focused S2.13 baseline: `4 test files, 27 tests` for `michaelRuntimeResponse` plus `s213MichaelRuntimeResponseGovernanceBoundary`.

The S2.15 report must state the new full server test count and the focused S2.15 count. Any lower count is a stop condition unless explained by an intentional test deletion approved by Kevin.

## 3. Required New Tests For Future Adapter-Contract Slice

S2.15 must add focused tests proving the Michael adapter contract path handles every scenario below without activation:

- Complete `training_support` maps to validated `next_training_step`.
- Complete ambiguous `training_support` maps to validated `clarification_question`.
- Degraded Context Packet maps to validated `safe_fallback`.
- Failed Context Packet maps to validated `safe_close`.
- Missing Context Manager boundary maps to validated `safe_fallback`.
- Rejected Context Packet maps to validated `safe_close`.
- Candidate/review-only rejection maps to validated `safe_close`.
- Invalid objective maps to validated `safe_close`.
- Unknown agent maps to validated `safe_close`.
- Wrong task type maps to validated `safe_close`.
- Non-Michael agent maps to validated `safe_close`.
- Unsupported language maps to validated `safe_close`.
- Every adapter-returned Michael response passes `validateMichaelResponseContract(...)`.
- Forbidden-field guardrail rejects scoring, ranking, qualification, income, placement, cycle math, prospect-facing fields, automatic send/call/schedule/prospecting fields, knowledge approval, persistence instructions, raw store results, raw GraphRAG results, and raw Gateway fallback responses.
- No route mount is introduced, including no `/api/runtime/*`.
- No persistence is introduced for events, outcomes, Guided Actions, envelopes, or responses.
- No LLM calls are introduced.
- No `.com` files are touched or referenced by the adapter-contract path.
- No direct store, GraphRAG, Gateway fallback, raw retrieval, or Context Packet builder access is introduced.
- No automatic actions are introduced.

## 4. Required Static Boundary Checks

S2.15 must add or extend static governance tests against only the files it touches. The checks must scan executable code and imports for:

- MongoDB, Mongoose, Neo4j, ChromaDB, GraphRAG, direct persistence adapters, Gateway fallback clients, raw retrieval helpers, and repository/store patterns.
- Context Packet builder calls such as `buildContextPacket` or `prepareContextPacketFoundation`.
- OpenAI, Anthropic, Claude, or generic response-generation calls.
- Express/Fastify/router handlers, middleware, and `/api/runtime` strings.
- `.com` references and runtime orchestration references inside `apps/com/src`.
- Telnyx, PSTN, call-control, SMS/email send, scheduling, calling, prospecting, scoring, ranking, income prediction, commission calculation, placement prediction, and knowledge approval.

The future static test should preserve the existing Gateway fallback source file but prove S2.15 does not import or call it.

## 5. Required Safe-Disabled Behavior

Every S2.15 adapter-contract result must remain returned-only and safe-disabled:

- `behavior: "not_implemented"`
- `agentResponseGenerated: false`
- `eventPersistence: "disabled"`
- `outcomePersistence: "disabled"`
- `guidedActionPersistence: "disabled"`
- `envelopePersistence: "disabled"`
- `responsePersistence: "disabled"`
- `persistence: "disabled"` on the Michael response contract
- no `agentResponse`, `responseText`, `generatedText`, `llmOutput`, or live response field

Substantive responses are allowed only for Michael `training_support` and only as pre-authored, validated fixtures. All wrong-agent, wrong-task, invalid, rejected, unsupported, or failed paths must safe-close or safe-fallback.

## 6. Required Rollback / Kill-Switch Expectations

Even though S2.15 must remain route-free, rollback must be explicit:

- All S2.15 changes must be isolated to runtime orchestration adapter-contract files, fixtures, tests, and index exports.
- No route, worker, scheduler, queue, SSE stream, webhook, or background process may depend on S2.15.
- Removing the S2.15 adapter-contract export must restore S2.13 behavior.
- If an unexpected validation or boundary failure occurs, the adapter must return the existing safe-close fixture, not throw into runtime activation.
- No data migration, database collection, Chroma collection, audit event, or persisted flag may be required to roll back.
- No environment variable may silently turn live behavior on.

## 7. Required Observability / Logging Rules Without Persistence

S2.15 may expose in-memory/test-visible diagnostics only:

- Scenario name.
- Runtime turn decision.
- Response fixture key.
- Validation status.
- Boundary reason code for safe-close or safe-fallback.

It must not write logs to MongoDB, Neo4j, ChromaDB, SurrealDB, Gateway, GraphRAG, audit logs, event outboxes, files, or queues. Console output should be limited to tests or explicit local verification and must not contain PII or raw Context Packet payloads.

## 8. Required Redaction Rules

If S2.15 diagnostics include sample data, redact before display:

- BA names, prospect names, phone numbers, emails, free-text answers, transcripts, Context Packet raw payloads, sponsor contact data, token values, session IDs, request IDs, and correlation IDs.
- Preserve only non-sensitive labels needed for verification: scenario name, response type, packet status, validation result, and safe-close reason code.

The contract path must never return raw store results, raw GraphRAG results, raw Gateway fallback responses, raw retrieval output, or full Context Packet payloads.

## 9. Required Owner Verification Checklist

Before Kevin accepts S2.15, the owner must confirm:

- All required gate commands passed.
- Full server test count is at or above `39 files / 269 tests`.
- Focused S2.15 test count is reported.
- Complete, degraded, failed, missing, rejected, candidate/review-only, invalid objective, unknown agent, wrong task, non-Michael, and unsupported language paths are tested.
- Every returned Michael response validates with `validateMichaelResponseContract(...)`.
- Static checks prove no route mount, no persistence, no LLM, no `.com`, no direct store, no GraphRAG, no Gateway fallback, no retrieval, no telephony, and no automatic action.
- `agentResponseGenerated` remains false everywhere.
- Persistence remains disabled everywhere.
- Rollback is a code-only revert with no data cleanup.
- Report states explicitly that S2.15 does not activate live Michael.

## 10. Recommendation To Kevin

Approve S2.15 only if it is framed as an inert adapter-contract bridge: Michael adapter in, validated S2.12/S2.13 contract fixture out, no live generation, no routes, no persistence, no LLM, no voice, no `.com`, and no automatic action.

Do not approve any S2.15 proposal that introduces runtime exposure, stored events, response generation, telephony, prospect-facing behavior, Gateway/GraphRAG/retrieval access, or automatic BA/prospect action.
