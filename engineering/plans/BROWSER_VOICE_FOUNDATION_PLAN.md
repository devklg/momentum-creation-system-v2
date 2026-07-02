# S1.6 - Browser Voice/Text Foundation Plan

Report date: 2026-06-27

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

Status: Planning document only. No production browser voice/text runtime code is implemented in this artifact.

---

## 1. Purpose

The Browser Voice/Text Foundation defines the implementation foundation for the internal `.team` browser runtime where Team Magnificent Brand Ambassadors can interact with Steve Success, Michael Magnificent, and Ivory through browser text, browser voice, or mixed browser mode.

This plan does not implement the runtime. It translates the ratified v1.0 runtime specifications into an engineering-ready foundation for future implementation.

The foundation must preserve these facts:

- S1.3 Runtime Persistence Direct Adapter Migration is CLOSED / VERIFIED.
- Direct persistence is verified for MongoDB, Neo4j, and ChromaDB.
- Gateway HTTP fallback remains in place.
- Gateway fallback removal is not approved.
- Remaining Sprint 1 work is planning/governance only.

---

## 2. Scope

This plan defines:

- `.team`-only browser voice/text runtime boundaries.
- Future frontend runtime layout for browser voice, browser text, and mixed mode.
- Text fallback requirements.
- Microphone permission timing.
- English/Spanish language selector strategy.
- Runtime event relationship.
- Context Packet relationship.
- Telnyx exclusion boundary.
- Privacy, consent, identity, accessibility, compatibility, and QA requirements.

This plan is scoped to planning. It does not add runtime files, routes, adapters, tests, or UI components.

---

## 3. Out Of Scope

The following are explicitly out of scope for S1.6:

- Production voice/text implementation.
- Agent behavior implementation.
- Context Manager implementation.
- Runtime Event Service implementation.
- Knowledge Ingestion implementation.
- Persistence adapter changes.
- Gateway fallback removal.
- Telnyx integration for internal browser runtime.
- `.com` prospect-facing changes.
- Momentum redesign.
- Sprint 2 work.
- Ratified document edits.
- Organization governance-record edits.

---

## 4. `.team`-Only Boundary

Browser voice/text runtime belongs only inside the internal Brand Ambassador app:

```text
apps/team
```

The runtime is for authenticated Team Magnificent Brand Ambassadors. Every session, turn, event, and context request must preserve:

```text
tenantId
teamId
teamKey = "team_magnificent"
teamName = "Team Magnificent"
baId
sessionId
agentKey
language
mode
```

No browser voice/text session may treat a BA as a floating user outside Team Magnificent scope.

---

## 5. Explicit `.com` Exclusion

The `.com` prospect-facing surface is excluded.

S1.6 must not modify, mount, or expose browser voice/text runtime in:

```text
apps/com
teammagnificent.com
/p/:token
prospect dashboard
prospect presentation page
```

Internal coaching agents are BA-facing only. Browser voice/text runtime must never become prospect-facing, must never introduce AI prospecting language to `.com`, and must never alter the prospect funnel.

---

## 6. Browser Voice/Text Runtime Layout

Future implementation should use an additive `.team` layout consistent with the ratified runtime specification:

```text
apps/team/src/runtime/browserVoice/
  browserVoice.types.ts
  browserVoiceController.ts
  browserVoiceStateMachine.ts
  useBrowserVoice.ts
  speechLanguage.ts
  browserVoiceEvents.ts
  transcriptUtils.ts
  browserVoiceErrors.ts

apps/team/src/components/runtime/
  VoiceControls.tsx
  TranscriptPanel.tsx
  TextFallbackInput.tsx
  AgentResponsePanel.tsx
  BrowserAgentSession.tsx
  LanguageSelector.tsx
  VoicePermissionMessage.tsx
  VoiceStatusIndicator.tsx
```

Candidate internal routes remain `.team` routes only:

```text
/michael/interview
/ivory
/steve/interview
```

Exact route and file placement may adapt to repository structure during implementation, but behavior must remain additive and `.team` scoped.

---

## 7. Runtime Modes

The foundation must support three internal modes:

```text
browser_text
browser_voice
mixed
```

Text mode is the baseline. Voice mode is progressive enhancement. Mixed mode allows a BA to switch between voice and text without losing session continuity, context, language, event correlation, or outcome capture.

---

## 8. Text Fallback Strategy

Text fallback is mandatory and must always remain available.

Text fallback must work when:

- The BA chooses text.
- Speech recognition is unsupported.
- Speech synthesis is unsupported.
- Microphone permission is denied.
- Voice capture fails.
- Mobile browser behavior is unreliable.
- Transcript confidence is low.
- The BA pauses, stops, mutes, or exits voice mode.

Text fallback must not require microphone permission. It must submit the BA's typed turn to Agent Runtime as `browser_text` or `mixed`, display the agent response as text, and preserve all session/event/context identifiers.

---

## 9. Voice Permission-After-Action Strategy

Microphone permission must be requested only after an explicit BA action, such as clicking `Start Voice`.

The runtime must not:

- Request microphone permission on page load.
- Listen before permission is granted.
- Continue listening after pause, stop, fallback, or session end.
- Hide listening state.
- Store raw audio in the MVP.

The permission flow must emit the appropriate browser voice events and fall back to text on denial.

---

## 10. EN/ES Language Selector Strategy

English and Spanish are first-class runtime languages.

Every browser voice/text session must include a visible language selector with:

```text
en
es
```

The selected language controls:

- Browser speech-recognition locale.
- Browser speech-synthesis locale.
- Agent Runtime language.
- Context Packet language.
- Transcript metadata.
- Runtime events.

Spanish locale preference should follow:

```text
es-US
es-MX
es-ES
```

Language changes must emit a runtime event and trigger fresh context through Agent Runtime when template language or task context changes.

---

## 11. Agent Interaction Flow

The foundation flow is:

```text
BA opens browser runtime inside .team
  -> BA chooses text or voice
  -> Browser runtime creates or resumes an authenticated agent session
  -> BA submits typed text or a final browser voice transcript
  -> Agent Runtime requests context
  -> Context Manager builds context_packet.v1
  -> Agent Runtime produces the response
  -> Browser surface displays response as text
  -> Browser may speak response through browser TTS when enabled
  -> Event runtime records interaction
  -> Outcome capture is preserved for learning and follow-up
```

Browser Voice/Text must not assemble context, retrieve knowledge, approve knowledge, or create candidates directly. It captures interaction turns and presents responses.

---

## 11a. La'Mont Local Voice Provider Addendum

Recorded 2026-07-01: La'Mont is the approved Windows-local voice companion for
MCS V2. This extends the provider strategy without replacing browser voice/text
or text fallback.

Provider model:

```text
browser_text       typed input inside .team
browser_voice      browser speech recognition/synthesis where available
lamont_voice       La'Mont local STT/TTS companion
mixed              BA can move between voice and text without losing session
```

La'Mont belongs to the same `.team` internal runtime boundary. It may provide
speech-to-text and text-to-speech for Steve, Michael, Ivory, admin capture, and
future BA-facing agent workflows. It is not an agent, not a Context Manager,
not a persistence adapter, and not a knowledge approval path.

La'Mont-originated transcripts must enter MCS as authenticated runtime turns or
interview artifacts. MCS owns session identity, member scope, persistence,
Context Packet assembly, knowledge ingestion, learning signals, and audit.
Text fallback remains mandatory.

Implementation must preserve these exclusions:

- no `.com` / prospect-facing La'Mont voice integration;
- no hidden microphone capture;
- no direct MongoDB, Neo4j, ChromaDB, or GraphRAG writes from La'Mont;
- no knowledge approval by La'Mont or by the learning pipeline;
- no bypass of MCS authentication, `team_magnificent` scope, or session IDs.

Related decision: `organization/DECISION_lamont_local_voice_layer.md`.

---

## 12. Telnyx Boundary

Telnyx is external telephony only.

Telnyx must not be used for the internal browser voice/text runtime.

Allowed Telnyx scope remains external runtime only:

- SMS.
- Ringless voicemail.
- Future callback workflows.

Internal browser runtime must use browser capabilities:

- Web Speech API or `webkitSpeechRecognition` where available.
- Browser `SpeechSynthesis` where available.
- Text fallback everywhere.

No internal browser voice/text module may import, call, depend on, or configure Telnyx.

---

## 13. Privacy And Consent Considerations

The foundation must protect BA privacy:

- Microphone permission after BA action only.
- Visible listening state whenever capture is active.
- No hidden capture.
- No raw audio storage in MVP.
- Transcript text scoped to tenant, Team Magnificent, BA, session, and agent.
- Event payloads avoid unnecessary transcript body text.
- Journal content remains private by default.
- Relationship context is shown only inside authorized BA scope.
- Safe errors must not expose stack traces, credentials, provider details, or private transcript text.

If spoken input becomes Momentum Journal material or relationship context, the downstream runtime must preserve the existing privacy rules and require BA-owned action.

---

## 14. Session Identity And `baId` Scoping

Every runtime action must be session-scoped and BA-scoped.

Required identity invariants:

- `baId` comes from the authenticated `.team` session.
- The frontend must not be trusted to select another BA.
- `teamKey` must remain `team_magnificent`.
- Transcript records must not be visible to another BA.
- Runtime events must include or reference `sessionId`, `baId`, `teamId`, `agentKey`, and `correlationId`.
- Text fallback must preserve the same identity envelope as voice.

---

## 15. Accessibility Requirements

A BA must be able to complete the same workflow without voice.

The future implementation must provide:

- Text responses for every agent response.
- Keyboard-accessible controls.
- Accessible labels for voice controls.
- Visible and screen-reader-friendly listening state.
- Pause, stop, mute, cancel speech, and end session controls.
- Text fallback on desktop and mobile.
- Reduced-motion support.
- Non-color-only state indicators.
- Readable, actionable error messages.

Voice is a convenience layer. Text is the accessible baseline.

---

## 16. Browser Compatibility Considerations

Browser voice must be progressive enhancement.

The runtime must detect support before use:

- Speech recognition support.
- Speech synthesis support.
- Microphone permission state where available.
- Mobile reliability limitations.

Unsupported or unreliable browsers must enter text fallback without blocking the BA workflow.

Compatibility checks must not require microphone permission. Capability results should be recorded as privacy-safe runtime events.

---

## 17. Runtime Event Relationship

Browser Voice/Text must emit through the runtime event foundation, not external telephony events.

Expected event family:

```text
browser_voice.capability_checked
browser_voice.permission_requested
browser_voice.permission_granted
browser_voice.permission_denied
browser_voice.listening_started
browser_voice.interim_transcript
browser_voice.final_transcript
browser_voice.transcript_corrected
browser_voice.language_changed
browser_voice.speech_started
browser_voice.speech_completed
browser_voice.fallback_to_text
browser_voice.error
```

Events must preserve correlation and causation IDs so a session timeline can be reconstructed. Events should reference transcript IDs and hashes instead of carrying full transcript text unless a narrow event contract explicitly requires otherwise.

---

## 18. Context Packet Relationship

Browser Voice/Text does not build Context Packets.

The relationship is:

```text
Browser Voice/Text
  -> Agent Runtime
  -> Context Manager
  -> context_packet.v1
  -> Agent Runtime
  -> Browser Voice/Text surface
```

The browser runtime must preserve enough metadata for Agent Runtime to request correct context:

- Team Magnificent identity.
- `baId`.
- `sessionId`.
- `agentKey`.
- Runtime mode.
- Language.
- Task type.
- Current state.
- User input or final transcript.

If the Context Packet is degraded, the browser surface may show a safe degraded-context notice. If the packet fails, the browser surface must avoid continuing substantive guidance and must show safe fallback text.

---

## 19. QA Harness Requirements

S1.6 does not select or implement the full QA harness. That belongs to S1.7. The S1.6 plan requires the future QA harness to cover:

- `pnpm typecheck`.
- `pnpm build`.
- Unit tests for support detection, state transitions, permission handling, language mapping, transcript correction, mute/pause/stop, text fallback, and identity validation.
- Integration tests for session creation, final transcript submission, agent response display, text fallback, language changes, event emission, and session completion.
- Accessibility tests proving full workflow completion without voice.
- Privacy tests proving permission-after-action, visible listening, no raw audio storage, scoped transcript access, and journal privacy.
- Bilingual tests for English and Spanish recognition/synthesis configuration and metadata preservation.
- Static boundary tests proving no Telnyx import, call, or dependency exists in internal browser runtime modules.
- `.com` exclusion tests proving no browser voice/text runtime code is mounted in prospect-facing surfaces.

---

## 20. Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Browser speech APIs differ across browsers. | Use progressive enhancement and mandatory text fallback. |
| Permission prompts fire too early. | Request microphone permission only from explicit BA action. |
| Voice becomes treated as required. | Keep text fallback visible and fully functional in every state. |
| Telnyx leaks into internal runtime. | Add static import checks and runtime boundary tests. |
| Transcript privacy leaks through events. | Events carry IDs/hashes and metadata, not broad transcript text. |
| Language switching creates stale context. | Emit language-change event and request fresh context when template language changes. |
| BA identity is spoofed from frontend payload. | Server derives `baId` from authenticated session and validates Team Magnificent scope. |
| `.com` surface accidentally imports runtime code. | Add `.com` exclusion checks and keep runtime files under `apps/team`. |
| Gateway fallback gets removed during related persistence work. | Treat fallback removal as explicitly not approved; S1.6 does not touch persistence. |

---

## 21. Required Acceptance Criteria

S1.6 planning is accepted when:

- This plan exists at `engineering/plans/BROWSER_VOICE_FOUNDATION_PLAN.md`.
- The plan states the `.team`-only boundary.
- The plan explicitly excludes `.com` prospect-facing surfaces.
- The plan defines browser voice/text runtime layout.
- The plan defines mandatory text fallback.
- The plan requires microphone permission only after BA action.
- The plan includes English/Spanish language selector strategy.
- The plan includes the full agent interaction flow from BA opening runtime through outcome capture.
- The plan states Telnyx is external telephony only and not used for internal browser runtime.
- The plan covers privacy, consent, session identity, `baId` scoping, accessibility, browser compatibility, runtime events, Context Packets, QA harness expectations, risks, and mitigations.
- The plan references S1.3 CLOSED / VERIFIED status, direct MongoDB/Neo4j/ChromaDB verification, Gateway HTTP fallback preservation, and the fact that Gateway fallback removal is not approved.
- The plan confirms remaining Sprint 1 work is planning/governance only.
- No production code was changed.
- No ratified documents were modified.

---

## 22. Confirmation

No production code was changed by S1.6.

No ratified documents were modified by S1.6.

No organization governance records were modified by S1.6.

No `.com` prospect-facing surfaces were modified by S1.6.

Gateway HTTP fallback remains in place.

Gateway fallback removal remains not approved.

Sprint 2 was not started.
