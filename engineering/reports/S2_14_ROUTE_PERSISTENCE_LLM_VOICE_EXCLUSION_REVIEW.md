# S2.14 Route / Persistence / LLM / Voice Exclusion Review

## Mission

Confirm whether a future Michael adapter-contract slice can remain route-free, non-persistent, no-LLM, and no-voice.

## Inputs Reviewed

- `engineering/reports/SPRINT_002_S2_13_MICHAEL_RESPONSE_CONTRACT_RUNTIME_FIXTURE_INTEGRATION_VERIFICATION.md`
- `server/src/index.ts`
- `server/src/runtime/`
- `server/src/runtime/orchestration/`
- `apps/team/src/`
- `apps/com/src/`
- `.github/workflows/ci.yml`

## Executive Verdict

PASS with boundary discipline.

A future Michael adapter-contract slice can remain route-free, non-persistent, no-LLM, and no-voice if it stays inside the existing Sprint 2 runtime/orchestration pattern: exported TypeScript contracts, fixture/evaluation harnesses, validated pre-authored response fixtures, in-memory returned-only envelopes, and governance tests. It must not mount an HTTP route, expose UI, write to stores, call an LLM, activate browser voice, or connect to Telnyx/PSTN/call-control.

Important boundary note: the application already has unrelated production routes such as `/api/michael` and `/api/telnyx`. This review does not claim those do not exist. It confirms the Sprint 2 runtime/orchestration Michael response contract path does not mount or invoke a route family such as `/api/runtime/*`, does not activate those existing routes, and does not import telephony/call-control behavior.

## Findings

1. `/api/runtime/*` remains unmounted

   Confirmed. `server/src/index.ts` mounts many existing route families, including `/api/michael`, `/api/steve`, `/api/agents`, `/api/training`, `/api/telnyx`, and others, but no `/api/runtime` route is mounted. The runtime exports are TypeScript module exports from `server/src/runtime/index.ts`, not Express mounts.

2. No route-like runtime handler exists for Michael activation

   Confirmed. Runtime/orchestration source uses exported functions such as `coordinateRuntimeTurn(...)`, `dispatchAgentRuntimeAdapter(...)`, `runMichaelMagnificentRuntimeAdapter(...)`, and `runMichaelRuntimeResponseFixtureScenario(...)`. It does not define `Router(...)`, `express.Router`, `router.get/post`, request handlers, middleware, or an activation endpoint for Michael runtime behavior.

3. `.com` remains untouched

   Confirmed. No `.com` changes were made for this review, and the reviewed `.com` source does not reference the Sprint 2 runtime/orchestration fixture or Michael response contract path. Existing `.com` APIs remain prospect-token/dashboard/video flows, not Michael runtime activation.

4. No `.team` UI exposure exists yet

   Confirmed for the Sprint 2 runtime adapter-contract path. `.team` has existing product UI and existing app features, including `/api/michael/training-support/:downlineBaId` usage in the cockpit, but no `.team` source references `michaelRuntime`, `runMichaelRuntimeResponse...`, `/api/runtime`, or the S2.13 response-contract fixture harness.

5. No event persistence exists

   Confirmed. `server/src/runtime/orchestration/events.ts` builds and returns in-memory `agent_event.v1` envelopes. Its contract states it never persists, creates outbox records, replays, publishes to subscribers, or calls an event API. Returned results preserve `eventPersistence: "disabled"`.

6. No outcome persistence exists

   Confirmed. `draftOutcomeGuidedActionEnvelopes(...)` creates returned-only outcome draft envelopes and marks them `persistence: "disabled"`. Composition and coordinator results return `outcomePersistence: "disabled"`.

7. No Guided Action persistence exists

   Confirmed. Guided Action draft envelopes are returned in memory only, require BA approval, set `automaticSending: false`, `automaticCalling: false`, and `persistence: "disabled"`. Results preserve `guidedActionPersistence: "disabled"`.

8. No response persistence exists

   Confirmed. The S2.13 Michael runtime response harness returns `responsePersistence: "disabled"` and selects pre-authored validated fixtures. No response repository/store/write path is present in runtime/orchestration source.

9. No outbox/replay/subscriber/event API exists

   Confirmed. Runtime event capture is an in-memory buffer with `persisted: false`. Search found only governance tests asserting outbox/replay/subscriber/event API exclusions; no implementation path exists in runtime/orchestration source.

10. No LLM calls exist

   Confirmed for runtime/orchestration and the Michael response contract path. The reviewed runtime/orchestration source does not import or call OpenAI, Anthropic, Claude, `messages.create`, `responses.create`, or chat completion APIs. Existing ScriptMaker/Ivory app features are outside this runtime adapter-contract boundary.

11. No dynamic response-generation engine exists

   Confirmed. `agentResponseGenerated` remains `false` across the coordinator, adapters, outcome/guided action drafts, runtime turn fixture harness, Michael response fixtures, and S2.13 integration harness. The S2.13 path maps scenarios to pre-authored fixtures and validates them; it does not generate text at runtime.

12. No browser voice activation exists

   Confirmed for Michael adapter-contract activation. The runtime contains an S1.6 browser voice/text foundation and contract types, but the reviewed `.team` and `.com` source does not expose a Michael runtime voice UI, browser microphone flow, or `/api/runtime` voice activation path. The future slice can remain text/contract-only.

13. No Telnyx/PSTN/call-control exists

   Confirmed inside runtime/orchestration and the S2.13 Michael response contract path. The broader server already mounts `/api/telnyx` for existing webhook infrastructure, but runtime/orchestration does not import Telnyx, PSTN, call-control, dial, or call-start behavior.

14. What must remain excluded in a future implementation slice

   A future Michael adapter-contract slice must continue to exclude:

   - New route mounts, especially `/api/runtime/*`.
   - Express/Fastify routers, request handlers, middleware, or route-like activation handlers.
   - `.com` changes or prospect-facing Michael exposure.
   - `.team` UI exposure of the runtime adapter contract.
   - MongoDB, Neo4j, ChromaDB, GraphRAG, direct persistence adapters, gateway fallback, repositories, stores, or write helpers.
   - Event persistence, outbox, replay, subscriber registries, or event APIs.
   - Outcome, Guided Action, response, and envelope persistence.
   - OpenAI, Anthropic, Claude, or any other LLM provider call.
   - Dynamic response-generation engines or runtime-authored response text.
   - Browser microphone activation, SpeechRecognition, speech synthesis, or voice UI.
   - Telnyx, PSTN, call-control, dialing, or call automation.
   - Automatic sending/calling/prospecting, prospect scoring, ranking, qualification, placement prediction, income prediction, commission calculation, or knowledge approval.

15. Recommendation to Kevin

   Approve the next slice only as a governance-safe adapter-contract slice: TypeScript contract additions, inert fixtures, validation, and tests only. Do not approve route mounting, persistence, LLM calls, UI exposure, browser voice, or Telnyx/PSTN integration in the same slice. Keep first real activation behind a separate explicit decision gate after the adapter contract remains green under CI.

## CI Context

`.github/workflows/ci.yml` continues to run the merge gates: install, `pnpm build:shared`, `pnpm typecheck`, `pnpm build`, and `pnpm --filter @momentum/server test`. Existing S2.13 governance tests specifically guard against route handlers, `/api/runtime`, persistence, LLM calls, response generation, event API activation, and telephony/call-control in the Michael response fixture integration path.
