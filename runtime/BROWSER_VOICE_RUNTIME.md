# BROWSER_VOICE_RUNTIME.md

## Momentum Creation System V2

### Browser Voice Runtime Specification

#### Version 1.0

---

## 1. Document Status

**Document Name:** Browser Voice Runtime Specification
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Status:** Ratified Runtime Specification
**Owner:** Momentum Creation System
**Primary Upstream Dependencies:** Agent Runtime, Context Manager, Context Packet Schema, Agent Event Model
**Primary Downstream Consumers:** Steve Success, Michael Magnificent, Ivory, Browser Text Fallback, Knowledge Ingestion, Agent Events
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Team Scope:** Team Magnificent
**BA Scope:** Brand Ambassador inside Team Magnificent
**Internal Runtime Scope:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.

---

## 2. Purpose

The Browser Voice Runtime defines how Steve Success, Michael Magnificent, and Ivory use browser-based voice interaction with mandatory text fallback inside Momentum Creation System V2.

Browser Voice allows a Team Magnificent Brand Ambassador to speak through the browser microphone, have speech converted into transcript text, send final transcript turns to the Agent Runtime, receive agent responses as text, and optionally hear responses spoken by browser text-to-speech.

The Browser Voice Runtime answers this runtime question:

> How do internal Momentum agents support safe, accessible, bilingual voice interaction inside the browser?

Browser Voice is internal coaching runtime.

Browser Voice is not Telnyx.

Browser Voice is not PSTN calling.

Browser Voice is not outbound calling.

Browser Voice is not voicemail.

Browser Voice is not SMS.

Browser Voice is not a future callback workflow.

Browser Voice is the in-app voice interface for Team Magnificent Brand Ambassadors interacting with Steve, Michael, and Ivory.

---

## 3. Core Runtime Rule

The Browser Voice Runtime must enforce the following non-negotiable rule:

```text id="lh291n"
Internal coaching agents use browser voice and browser text fallback.

Internal coaching agents do not use Telnyx PSTN.

Telnyx is reserved for external runtime workflows only:
- Ringless voicemail
- SMS
- Future callback workflows
```

This rule must appear in relevant Context Packets, runtime guardrails, Browser Voice implementation, Agent Runtime validation, and acceptance tests.

---

## 4. Runtime Philosophy

Momentum is a knowledge-centric coaching platform for Team Magnificent.

Browser Voice is a human interface layer.

It does not create agent intelligence.

It does not retrieve knowledge.

It does not approve knowledge.

It does not store organizational truth.

It does not replace Browser Text.

It captures spoken Brand Ambassador input and converts it into agent session turns.

The runtime philosophy is:

```text id="el438k"
Brand Ambassador speaks
  ↓
Browser captures transcript
  ↓
Final transcript becomes a session turn
  ↓
Agent Runtime requests Context Packet
  ↓
Agent responds using governed context
  ↓
Response appears as text
  ↓
Browser may speak response aloud
  ↓
Turn is preserved for ingestion, events, and learning
```

Voice is convenience.

Text is always available.

Accessibility is mandatory.

Privacy is mandatory.

Team Magnificent scope is mandatory.

---

## 5. Identity Scope

Momentum Creation System V2 is implemented for Team Magnificent.

Within the app, a Brand Ambassador is not treated as a floating user.

Every Brand Ambassador is scoped to Team Magnificent.

The identity hierarchy is:

```text id="g0xpy0"
Momentum Creation System V2
  ↓
Team Magnificent
  ↓
Brand Ambassador
  ↓
Agent Session
  ↓
Browser Voice Turn
```

### 5.1 Required Team Magnificent Identity Fields

Every Browser Voice session, transcript, event, and Agent Runtime request must preserve:

```ts id="gd4aid"
teamId: string;
teamKey: "team_magnificent";
teamName: "Team Magnificent";
baId: string;
```

### 5.2 Required Identity Rule

```text id="x7yfj9"
All BA-scoped Browser Voice records must also be Team Magnificent scoped.
```

### 5.3 Team Magnificent Context

The application is for Kevin Gardner's personal Team Magnificent organization.

`baId` remains the correct Brand Ambassador identifier.

`teamId` and `teamKey` define the app/team boundary.

The Browser Voice Runtime must not create sessions without both Team Magnificent scope and Brand Ambassador scope.

---

## 6. Runtime Position

Browser Voice Runtime sits at the user interaction edge of the internal runtime.

```text id="narwsl"
Team Magnificent Brand Ambassador
  ↓
Browser Voice Runtime
  ↓
Agent Runtime
  ↓
Context Manager
  ↓
Context Packet
  ↓
Agent Response
  ↓
Browser Text Display / Browser Speech Output
  ↓
Knowledge Ingestion
  ↓
Agent Events
  ↓
Learning Pipeline
```

Browser Voice is upstream of:

- Agent Runtime turns
- Knowledge Ingestion capture
- Browser Voice events
- Agent events
- Session transcripts
- Learning traces

Browser Voice is downstream of:

- Agent Runtime response generation
- Context Packet language selection
- Agent output mode
- Browser capability detection
- Browser permission state

---

## 7. Scope

This document defines the Version 1.0 runtime specification for Browser Voice.

It defines:

- Purpose
- Core rule
- Team Magnificent identity scope
- Runtime modes
- Browser strategy
- Browser Voice state machine
- Controller interface
- React hook requirements
- Transcript model
- Bilingual behavior
- UI requirements
- Accessibility requirements
- Privacy requirements
- Event requirements
- Agent Runtime integration
- Context Packet integration
- Knowledge Ingestion integration
- Failure behavior
- Fallback behavior
- Frontend file structure
- Routes
- Testing requirements
- Acceptance criteria

This document does not define Agent Runtime behavior.

Agent Runtime behavior is defined in `AGENT_RUNTIME.md`.

This document does not define Context Packet schema.

Context Packet schema is defined in `CONTEXT_PACKET_SCHEMA.md`.

This document does not define event taxonomy.

Event taxonomy is defined in `AGENT_EVENT_MODEL.md`.

This document does not define external Telnyx workflows.

Telnyx workflows belong to external runtime implementation documents.

---

## 8. Non-Responsibilities

Browser Voice Runtime must not perform responsibilities assigned to other runtime components.

### 8.1 Browser Voice Does Not Retrieve Knowledge

Browser Voice does not access the Knowledge Core.

Browser Voice does not access MongoDB, Neo4j, Chroma, or GraphRAG.

### 8.2 Browser Voice Does Not Assemble Context

The Context Manager assembles Context Packets.

Browser Voice only initiates or continues an agent session that uses Context Packets.

### 8.3 Browser Voice Does Not Generate Agent Intelligence

Agent Runtime produces agent responses.

Browser Voice displays and optionally speaks responses.

### 8.4 Browser Voice Does Not Approve Knowledge

Browser Voice may capture spoken input.

Knowledge Ingestion prepares captured input.

Governance and review workflows approve knowledge.

### 8.5 Browser Voice Does Not Store Raw Audio in MVP

Version 1.0 stores transcript text, transcript metadata, confidence, language, and correction state.

Version 1.0 does not require raw audio storage.

### 8.6 Browser Voice Does Not Use Telnyx

Browser Voice is internal browser runtime.

Telnyx is reserved for external SMS, ringless voicemail, and future callback workflows.

### 8.7 Browser Voice Does Not Replace Text

Text fallback is mandatory.

Voice is never the only path.

---

## 9. Runtime Modes

Browser-enabled agent sessions support three internal modes.

```ts id="tm0bxn"
export type BrowserRuntimeMode = "browser_voice" | "browser_text" | "mixed";
```

For compatibility with existing route or API names, `text` may be accepted as an alias for `browser_text`, but canonical runtime documents and implementation types should use `browser_text`.

### 9.1 browser_voice

The Brand Ambassador speaks through the browser microphone.

The browser captures speech recognition transcript.

Final transcript turns are submitted to the Agent Runtime.

Agent responses appear as text and may be spoken by browser TTS.

### 9.2 browser_text

The Brand Ambassador types and reads responses.

Browser Text is always available as fallback.

### 9.3 mixed

The Brand Ambassador may switch between voice and text during the same session.

Mixed mode must preserve:

- Session continuity
- Agent state
- Language
- Team Magnificent scope
- BA scope
- Context Packet continuity
- Transcript history
- Event correlation

---

## 10. Browser Strategy

Browser Voice Runtime must use progressive enhancement.

The system should use the best available browser capability and fall back safely when unsupported.

### 10.1 Speech Recognition

Use browser speech recognition when available.

Preferred runtime source:

```text id="s0105z"
Web Speech API SpeechRecognition / webkitSpeechRecognition
```

The implementation must detect support before attempting voice capture.

### 10.2 Browser Text-to-Speech

Use browser speech synthesis when available.

Preferred runtime source:

```text id="onbcm4"
SpeechSynthesis API
```

Agent responses must always appear as text even when speech synthesis is available.

### 10.3 Text Fallback

Text fallback is mandatory.

Fallback must be available when:

- Browser speech recognition is unsupported.
- Microphone permission is denied.
- Microphone permission is unavailable.
- Speech recognition fails.
- Browser TTS is unsupported.
- User chooses text mode.
- User mutes voice.
- User pauses voice.
- User is on mobile and voice is unreliable.
- Confidence is too low and correction is needed.

### 10.4 Manual Transcript Correction

Manual correction must be supported for low-confidence final transcripts.

Correction flow:

```text id="zc9cqe"
Final transcript captured
  ↓
Confidence below threshold or user chooses edit
  ↓
Transcript displayed for correction
  ↓
BA edits transcript
  ↓
Corrected transcript submitted
  ↓
browser_voice.transcript_corrected emitted
  ↓
Corrected text becomes final agent turn
```

### 10.5 MVP Audio Storage Rule

Version 1.0 stores transcripts.

Version 1.0 does not store raw audio.

---

## 11. Browser Voice State Machine

### 11.1 State Type

```ts id="gdxzv1"
export type BrowserVoiceState =
  | "unsupported"
  | "idle"
  | "requesting_permission"
  | "permission_denied"
  | "listening"
  | "processing"
  | "speaking"
  | "paused"
  | "text_fallback"
  | "error";
```

### 11.2 State Meanings

#### unsupported

The browser does not support required voice features.

The runtime must use text fallback.

#### idle

Voice runtime is available but not currently listening.

#### requesting_permission

The runtime is requesting microphone permission.

#### permission_denied

The user denied microphone permission.

The runtime must switch to text fallback.

#### listening

The browser is actively listening for speech.

The UI must clearly show listening status.

#### processing

A final transcript has been captured and is being submitted to Agent Runtime.

#### speaking

The agent response is being spoken through browser TTS.

The response must also be visible as text.

#### paused

The voice session is paused.

No microphone capture should continue.

#### text_fallback

Voice is unavailable, denied, disabled, or intentionally bypassed.

Text input remains available.

#### error

An unexpected voice runtime error occurred.

The runtime must move to text fallback when safe.

### 11.3 Required Transitions

```text id="gm33la"
idle -> requesting_permission -> listening
requesting_permission -> permission_denied -> text_fallback
unsupported -> text_fallback
listening -> processing -> speaking -> listening
listening -> paused
speaking -> paused
paused -> listening
paused -> text_fallback
any -> error -> text_fallback
```

### 11.4 Transition Rules

The implementation must:

- Prevent listening without permission.
- Prevent hidden microphone capture.
- Stop listening before entering text fallback.
- Stop speech synthesis when muted or cancelled.
- Emit events for important state changes.
- Preserve session ID and BA ID across transitions.
- Preserve Team Magnificent scope across transitions.

---

## 12. Controller Interface

The Browser Voice Runtime must expose a controller interface.

```ts id="thl7l7"
export interface BrowserVoiceController {
  isSpeechRecognitionSupported(): boolean;

  isSpeechSynthesisSupported(): boolean;

  requestMicrophonePermission(): Promise<"granted" | "denied" | "prompt">;

  startListening(options: StartListeningOptions): void;

  stopListening(): void;

  pause(): void;

  resume(): void;

  speak(text: string, options: SpeakOptions): Promise<void>;

  cancelSpeech(): void;

  setLanguage(language: RuntimeLanguage): void;

  setMuted(muted: boolean): void;

  getState(): BrowserVoiceState;

  destroy(): void;
}
```

### 12.1 Start Listening Options

```ts id="a4m2i2"
export interface StartListeningOptions {
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  tenantId: string;
  baId: string;
  sessionId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  language: RuntimeLanguage;

  continuous?: boolean;

  interimResults?: boolean;

  onInterimTranscript: (text: string, confidence?: number) => void;

  onFinalTranscript: (text: string, confidence?: number) => void;

  onError: (error: BrowserVoiceError) => void;
}
```

### 12.2 Speak Options

```ts id="5inw84"
export interface SpeakOptions {
  language: RuntimeLanguage;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
  interruptCurrent?: boolean;
}
```

### 12.3 Browser Voice Error

```ts id="88n8fh"
export interface BrowserVoiceError {
  code:
    | "unsupported"
    | "permission_denied"
    | "no_microphone"
    | "recognition_error"
    | "synthesis_error"
    | "network_error"
    | "language_not_supported"
    | "unknown";

  message: string;

  safeMessage: string;

  retryable: boolean;

  occurredAt: string;
}
```

---

## 13. Runtime Language Types

```ts id="zhq68s"
export type RuntimeLanguage = "en" | "es";
```

English and Spanish are first-class runtime languages.

---

## 14. Speech Language Mapping

Browser speech APIs require locale codes.

Momentum runtime language codes must map to browser speech locales.

```ts id="ll3diy"
export const speechLanguageMap: Record<RuntimeLanguage, string[]> = {
  en: ["en-US"],
  es: ["es-US", "es-MX", "es-ES"]
};
```

### 14.1 Language Selection Rules

When runtime language is `en`, use `en-US` by default.

When runtime language is `es`, prefer `es-US`, then `es-MX`, then `es-ES` where available.

The selected browser locale must be stored in session metadata.

### 14.2 Language Change Behavior

When language changes, Browser Voice Runtime must:

1. Emit `browser_voice.language_changed`.
2. Update speech recognition language.
3. Update speech synthesis language.
4. Preserve transcript language metadata.
5. Request fresh context if template language changes.
6. Preserve Team Magnificent and BA scope.
7. Continue session state safely.

---

## 15. Transcript Model

Browser Voice stores final transcript turns.

Interim transcripts may display on screen but must not create final conversation turns.

### 15.1 Browser Transcript Turn

```ts id="w2xtmq"
export interface BrowserTranscriptTurn {
  transcriptTurnId: string;

  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  sessionId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  baId: string;

  inputMode: "voice";

  language: RuntimeLanguage;

  browserLocale?: string;

  originalText: string;

  correctedText?: string;

  finalText: string;

  confidence?: number;

  isFinal: true;

  transcriptHash: string;

  capturedAt: string;

  correctedAt?: string;

  metadata?: Record<string, unknown>;
}
```

### 15.2 Interim Transcript Model

```ts id="p35jti"
export interface BrowserInterimTranscript {
  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  sessionId: string;
  baId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  language: RuntimeLanguage;

  text: string;

  confidence?: number;

  capturedAt: string;
}
```

### 15.3 Transcript Rules

Final transcripts must:

- Preserve Team Magnificent scope.
- Preserve BA scope.
- Preserve session ID.
- Preserve agent key.
- Preserve language.
- Preserve original text.
- Preserve corrected text when edited.
- Preserve final text.
- Preserve confidence when available.
- Preserve transcript hash.
- Submit to Agent Runtime as conversation turns.
- Emit final transcript event.

Interim transcripts must:

- Display visually when useful.
- Not create final agent turns.
- Not trigger Knowledge Ingestion as final content.
- Not be treated as durable user intent.

---

## 16. Agent Runtime Integration

Browser Voice sends final transcript turns to Agent Runtime.

### 16.1 Final Transcript Submission

When a final transcript is ready, Browser Voice Runtime must call the Agent Runtime session turn endpoint.

```text id="cxvmsd"
POST /api/runtime/agents/:agentKey/sessions/:sessionId/turns
```

### 16.2 Final Transcript Request

```ts id="iqkxgf"
export interface SubmitVoiceTurnRequest {
  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  baId: string;

  text: string;

  language: RuntimeLanguage;

  mode: "browser_voice";

  transcriptMetadata: {
    transcriptTurnId: string;
    confidence?: number;
    isFinal: true;
    browserLocale?: string;
    transcriptHash: string;
    corrected: boolean;
  };

  metadata?: Record<string, unknown>;
}
```

### 16.3 Agent Response Handling

Agent Runtime returns an `AgentTurnResponse`.

Browser Voice Runtime must:

- Display the response as text.
- Speak the response if speech synthesis is enabled and not muted.
- Preserve output mode.
- Update UI state.
- Emit speech events when speaking.
- Allow interruption, pause, stop, and mute.
- Not alter the meaning of the response.

---

## 17. Context Packet Integration

Browser Voice does not request Context Packets directly unless routed through Agent Runtime.

Agent Runtime requests Context Packets from Context Manager.

Browser Voice must preserve enough metadata for Context Packet requests:

- Team Magnificent scope
- BA ID
- Session ID
- Agent key
- Language
- Mode
- Task type
- Current state
- User input text

### 17.1 Context Packet Boundary

Browser Voice must not:

- Query Context Manager directly from unauthenticated frontend code.
- Query Knowledge Core.
- Query vector stores.
- Query graph stores.
- Build its own context.
- Modify Context Packets.

---

## 18. Knowledge Ingestion Integration

Browser Voice final transcripts become source material for Knowledge Ingestion through Agent Runtime and events.

### 18.1 Ingestion Flow

```text id="p1u0zz"
Final browser transcript
  ↓
Agent Runtime conversation turn
  ↓
Agent Event emitted
  ↓
Knowledge Ingestion capture
  ↓
Normalize
  ↓
Classify
  ↓
Segment
  ↓
Risk-check
  ↓
Dedupe
  ↓
Candidate-create when appropriate
```

### 18.2 Ingestion Rule

Browser Voice must not directly create Knowledge Candidates.

Browser Voice captures transcript turns.

Agent Runtime and Knowledge Ingestion handle candidate pathways.

---

## 19. Event Requirements

Browser Voice Runtime must emit events through the Runtime Event Service.

### 19.1 Browser Voice Events

```text id="z7be08"
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

### 19.2 Required Event Identity Fields

Every Browser Voice event must include:

```ts id="ojbyar"
tenantId: string;
teamId: string;
teamKey: "team_magnificent";
teamName: "Team Magnificent";
baId: string;
sessionId: string;
agentKey: "steve_success" | "michael_magnificent" | "ivory";
```

If the underlying event envelope does not include `teamId` as a top-level field, Team Magnificent identity must appear in event payload metadata.

### 19.3 Browser Voice Event Payloads

#### Capability Checked

```ts id="r7ybhp"
export interface BrowserVoiceCapabilityCheckedPayload {
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";
  sessionId?: string;
  speechRecognitionSupported: boolean;
  speechSynthesisSupported: boolean;
  userAgent?: string;
}
```

#### Permission Requested

```ts id="b8bko8"
export interface BrowserVoicePermissionRequestedPayload {
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";
  sessionId: string;
  requestedAt: string;
}
```

#### Permission Result

```ts id="lkhnvl"
export interface BrowserVoicePermissionResultPayload {
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";
  sessionId: string;
  result: "granted" | "denied" | "prompt";
}
```

#### Final Transcript

```ts id="trvw4q"
export interface BrowserVoiceFinalTranscriptPayload {
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  sessionId: string;

  turnId?: string;

  transcriptTurnId: string;

  language: RuntimeLanguage;

  browserLocale?: string;

  transcriptHash: string;

  confidence?: number;

  segmentSequence?: number;

  isFinal: true;
}
```

#### Transcript Corrected

```ts id="alj1jj"
export interface BrowserVoiceTranscriptCorrectedPayload {
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  sessionId: string;

  transcriptTurnId: string;

  originalTranscriptHash: string;

  correctedTranscriptHash: string;

  correctedAt: string;
}
```

#### Fallback to Text

```ts id="v705cd"
export interface BrowserVoiceFallbackToTextPayload {
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  sessionId: string;

  reason:
    | "unsupported"
    | "permission_denied"
    | "speech_error"
    | "user_selected_text"
    | "low_confidence"
    | "mobile_unreliable"
    | "unknown";
}
```

### 19.4 Event Privacy Rule

Browser Voice events must not include unnecessary full transcript text.

Events should reference:

- `transcriptTurnId`
- `turnId`
- `transcriptHash`
- `sessionId`

Transcript text belongs in conversation turn records, not broad runtime event payloads.

---

## 20. User Interface Requirements

Every Browser Voice agent page must include the following UI elements.

### 20.1 Required UI Elements

Each agent page must include:

- Agent name
- Team Magnificent identity context where appropriate
- English / Spanish selector
- Start voice button
- Pause button
- Stop button
- Mute toggle
- Text fallback input
- Transcript panel
- Agent response panel
- Journal prompt card when relevant
- Microphone permission message area
- Listening status indicator
- Processing status indicator
- Speaking status indicator
- End session button

### 20.2 Agent Pages

Required internal agent routes:

```text id="c365el"
/michael/interview
/ivory
/steve/interview
```

If `/steve/interview` does not exist, Codex may add it under the `.team` application as an MVP runtime route.

### 20.3 Voice Controls

Voice controls must make current state obvious.

The BA must be able to see whether the browser is:

- Idle
- Requesting microphone permission
- Listening
- Processing
- Speaking
- Paused
- In text fallback
- In error state

### 20.4 Transcript Panel

The transcript panel must show:

- Interim transcript when available
- Final transcript before submission when correction is enabled
- Corrected transcript if edited
- Confidence warning when confidence is low
- Language indicator
- Timestamp when useful

### 20.5 Agent Response Panel

The agent response panel must show:

- Agent response text
- Suggested actions when available
- Journal prompt card when relevant
- Invitation draft card when Ivory creates a draft
- Guided action card when created
- Degraded context warning when applicable

---

## 21. Accessibility Requirements

Voice is never the only path.

Accessibility is mandatory.

### 21.1 Required Accessibility Features

The implementation must ensure:

- Responses always appear as text.
- Text fallback is always available.
- Controls are keyboard accessible.
- Buttons have accessible labels.
- Listening status is visible.
- Listening status is screen-reader friendly.
- User can pause.
- User can stop.
- User can mute.
- User can cancel speech output.
- Text fallback works on mobile.
- Reduced-motion settings are respected.
- Color is not the only state indicator.
- Error messages are readable and actionable.

### 21.2 Accessibility Rule

A Brand Ambassador must be able to complete the same workflow without voice.

---

## 22. Privacy Requirements

Browser Voice must protect user privacy.

### 22.1 Microphone Permission

Browser Voice must request microphone permission only when the BA starts voice.

It must not request microphone permission automatically on page load.

It must not secretly listen.

It must not continue listening after pause, stop, fallback, or session end.

### 22.2 Listening Status

The UI must clearly show when the browser is listening.

### 22.3 Audio Storage

Version 1.0 stores transcript text only.

Version 1.0 does not store raw audio.

### 22.4 Transcript Privacy

Session transcripts must not be exposed to other Brand Ambassadors.

Transcript records must be scoped to:

- Tenant
- Team Magnificent
- Brand Ambassador
- Session
- Agent

### 22.5 Journal Privacy

If spoken input becomes a Momentum Journal entry, it must follow Journal privacy rules.

Journal entries are private by default.

Browser Voice must not promote journal content automatically.

### 22.6 Sensitive Context

Browser Voice must not display or speak private context beyond the active BA session.

---

## 23. Bilingual Behavior

Browser Voice must support English and Spanish.

### 23.1 Language Selection

The BA may select English or Spanish.

The selected language must control:

- Speech recognition locale
- Agent Runtime language
- Context Packet language
- Browser TTS language
- Transcript metadata
- UI language where available

### 23.2 Language Change Flow

```text id="gx5wdl"
BA changes language
  ↓
Browser Voice emits language_changed
  ↓
Speech recognition locale updates
  ↓
Speech synthesis locale updates
  ↓
Agent Runtime session language updates if allowed
  ↓
Fresh Context Packet requested if template language changes
  ↓
Transcript metadata preserves new language
```

### 23.3 Spanish Locale Preference

For Spanish, Browser Voice should prefer:

```text id="uwy6d6"
es-US
es-MX
es-ES
```

### 23.4 Bilingual Acceptance

The runtime must prove:

- English recognition configuration exists.
- Spanish recognition configuration exists.
- English agent responses can be spoken.
- Spanish agent responses can be spoken.
- Language metadata is preserved in final transcripts.
- Language change emits an event.
- Language change can trigger fresh context.

---

## 24. Browser Voice Session Model

Browser Voice must maintain local and server-backed session state.

```ts id="yrfdv3"
export interface BrowserVoiceRuntimeSession {
  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  baId: string;

  sessionId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  language: RuntimeLanguage;

  mode: "browser_voice" | "mixed";

  state: BrowserVoiceState;

  muted: boolean;

  textFallbackAvailable: true;

  speechRecognitionSupported: boolean;

  speechSynthesisSupported: boolean;

  microphonePermission: "granted" | "denied" | "prompt" | "unknown";

  activeTranscript?: string;

  lastFinalTranscriptTurnId?: string;

  lastAgentResponseId?: string;

  createdAt: string;

  updatedAt: string;
}
```

---

## 25. React Hook Requirements

The frontend should expose a `useBrowserVoice` hook.

```ts id="df4tde"
export interface UseBrowserVoiceOptions {
  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  baId: string;

  sessionId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  language: RuntimeLanguage;

  onFinalTranscriptSubmit: (transcript: BrowserTranscriptTurn) => Promise<void>;

  onError?: (error: BrowserVoiceError) => void;
}
```

```ts id="jagzvz"
export interface UseBrowserVoiceResult {
  state: BrowserVoiceState;

  isSupported: boolean;

  speechRecognitionSupported: boolean;

  speechSynthesisSupported: boolean;

  permission: "granted" | "denied" | "prompt" | "unknown";

  interimTranscript: string;

  finalTranscript?: string;

  confidence?: number;

  muted: boolean;

  start: () => Promise<void>;

  stop: () => void;

  pause: () => void;

  resume: () => void;

  speak: (text: string) => Promise<void>;

  cancelSpeech: () => void;

  setMuted: (muted: boolean) => void;

  setLanguage: (language: RuntimeLanguage) => void;

  useTextFallback: () => void;
}
```

---

## 26. Text Fallback Requirements

Text fallback is mandatory.

### 26.1 Text Fallback Conditions

Text fallback must activate when:

- Browser voice is unsupported.
- Permission is denied.
- Speech recognition errors.
- User selects text fallback.
- Low confidence requires manual typing.
- Mobile browser behavior is unreliable.
- Voice runtime enters unrecoverable error.

### 26.2 Text Fallback UI

Text fallback must include:

- Text input
- Submit button
- Agent response panel
- Current agent name
- Current language
- Session state
- Optional transcript correction display

### 26.3 Text Fallback Events

When fallback is activated, emit:

```text id="vcuy89"
browser_voice.fallback_to_text
```

The event must preserve fallback reason.

---

## 27. Error Handling

Browser Voice Runtime must fail safely into text fallback.

### 27.1 Error Types

```ts id="ab2ia5"
export type BrowserVoiceErrorCode =
  | "unsupported"
  | "permission_denied"
  | "no_microphone"
  | "recognition_error"
  | "synthesis_error"
  | "network_error"
  | "language_not_supported"
  | "agent_runtime_unavailable"
  | "context_degraded"
  | "unknown";
```

### 27.2 Error Behavior

When an error occurs, the runtime must:

- Stop listening if active.
- Cancel speech if needed.
- Show safe error message.
- Offer text fallback.
- Emit `browser_voice.error`.
- Preserve session state when possible.
- Avoid losing final transcript if already captured.
- Avoid duplicate turn submission.

### 27.3 Safe Error Message Rule

Error messages must not expose internal stack traces, credentials, provider details, or private transcript content.

---

## 28. Output Behavior

Browser Voice displays agent output and may speak it.

### 28.1 Text Display

Every agent response must be displayed as text.

### 28.2 Speech Output

Speech output may occur when:

- Speech synthesis is supported.
- User has not muted.
- Response is safe to speak.
- Session is active.
- Language is supported.

### 28.3 Speech Output Prohibitions

The runtime must not:

- Speak private content when muted.
- Continue speaking after session end.
- Continue speaking after cancel.
- Speak over a new response without interruption handling.
- Use speech output as the only response format.

---

## 29. Runtime Data Flow

### 29.1 Voice Turn Flow

```text id="hpr8js"
BA clicks Start Voice
  ↓
Browser Voice checks support
  ↓
Microphone permission requested
  ↓
Listening begins
  ↓
Interim transcript displays
  ↓
Final transcript captured
  ↓
Transcript correction offered if needed
  ↓
Final transcript submitted to Agent Runtime
  ↓
Agent Runtime requests Context Packet
  ↓
Agent Runtime returns response
  ↓
Response displays as text
  ↓
Response may be spoken by browser TTS
  ↓
Events emitted
```

### 29.2 Text Fallback Flow

```text id="n3bn1v"
Voice unsupported / denied / failed / user selects text
  ↓
browser_voice.fallback_to_text emitted
  ↓
Text input displayed
  ↓
BA types message
  ↓
Message submitted to Agent Runtime as browser_text or mixed mode
  ↓
Agent response displayed
```

### 29.3 Low Confidence Flow

```text id="rw3i9b"
Final transcript captured
  ↓
Confidence below threshold
  ↓
Transcript correction UI displayed
  ↓
BA confirms or edits transcript
  ↓
Corrected transcript submitted
  ↓
browser_voice.transcript_corrected emitted if edited
```

---

## 30. API Integration

Browser Voice primarily uses Agent Runtime APIs.

### 30.1 Create Agent Session

```text id="nqck39"
POST /api/runtime/agents/:agentKey/sessions
```

### 30.2 Submit Voice Turn

```text id="imtk26"
POST /api/runtime/agents/:agentKey/sessions/:sessionId/turns
```

### 30.3 Complete Session

```text id="ab1fef"
POST /api/runtime/agents/:agentKey/sessions/:sessionId/complete
```

### 30.4 Event Emission

Browser Voice frontend may emit events through a frontend-safe runtime event endpoint or through Agent Runtime mediation.

The implementation must avoid exposing unrestricted event write access to unauthenticated clients.

---

## 31. Frontend File Structure

Recommended frontend files:

```text id="g91uaf"
apps/team/src/runtime/browserVoice/browserVoice.types.ts
apps/team/src/runtime/browserVoice/browserVoiceController.ts
apps/team/src/runtime/browserVoice/useBrowserVoice.ts
apps/team/src/runtime/browserVoice/speechLanguage.ts
apps/team/src/runtime/browserVoice/browserVoiceEvents.ts
apps/team/src/runtime/browserVoice/transcriptUtils.ts
apps/team/src/runtime/browserVoice/browserVoiceStateMachine.ts

apps/team/src/components/runtime/VoiceControls.tsx
apps/team/src/components/runtime/TranscriptPanel.tsx
apps/team/src/components/runtime/TextFallbackInput.tsx
apps/team/src/components/runtime/AgentResponsePanel.tsx
apps/team/src/components/runtime/BrowserAgentSession.tsx
apps/team/src/components/runtime/LanguageSelector.tsx
apps/team/src/components/runtime/VoicePermissionMessage.tsx
```

### 31.1 Required Routes

Use existing `.team` app route patterns:

```text id="zcbk0g"
/michael/interview
/ivory
/steve/interview
```

If `/steve/interview` does not exist, Codex may add it under `.team` as an MVP runtime route.

---

## 32. Persistence Requirements

Browser Voice transcript turns should be persisted through Agent Runtime conversation turn storage.

### 32.1 Required Records

The system must persist:

- Agent session
- Conversation turn
- Transcript metadata
- Language
- Team Magnificent scope
- BA scope
- Correction metadata
- Event references

### 32.2 Browser Voice-Specific Storage

If Browser Voice maintains a local or server record, required collection may include:

```text id="h47lks"
browser_voice_sessions
browser_transcript_turns
browser_voice_errors
```

### 32.3 Required Indexes

```text id="ys5d2z"
browser_transcript_turns.transcriptTurnId unique
browser_transcript_turns.sessionId
browser_transcript_turns.baId
browser_transcript_turns.teamId
browser_transcript_turns.agentKey
browser_transcript_turns.language
browser_transcript_turns.capturedAt

browser_voice_sessions.sessionId unique
browser_voice_sessions.baId
browser_voice_sessions.teamId
browser_voice_sessions.agentKey
browser_voice_sessions.state
```

---

## 33. Security Requirements

### 33.1 Frontend Security

The frontend must not expose:

- Database credentials
- Knowledge Core credentials
- Context Manager secrets
- Event bus secrets
- External provider secrets
- Telnyx credentials

### 33.2 Microphone Security

The runtime must:

- Request permission only after user action.
- Stop listening when requested.
- Show listening state.
- Never secretly record.
- Never store raw audio in MVP.

### 33.3 Transcript Security

Transcripts must:

- Be scoped to Team Magnificent.
- Be scoped to BA.
- Be scoped to session.
- Not be exposed to other BAs.
- Be sent over secure authenticated requests.
- Preserve privacy flags when journal-related.

### 33.4 External Runtime Boundary

Browser Voice must not include Telnyx PSTN code paths.

Any Telnyx usage belongs to external runtime services only.

---

## 34. Observability

Browser Voice Runtime must expose operational observability.

### 34.1 Required Metrics

The implementation must track:

- Capability checks
- Speech recognition supported count
- Speech synthesis supported count
- Permission requested count
- Permission granted count
- Permission denied count
- Voice sessions started
- Voice sessions completed
- Text fallback activations
- Interim transcripts captured
- Final transcripts captured
- Transcript corrections
- Language changes
- Speech started
- Speech completed
- Browser voice errors
- Average transcript confidence
- English voice sessions
- Spanish voice sessions

### 34.2 Required Logs

The implementation must log:

- Capability check result
- Permission request
- Permission result
- Listening started
- Final transcript captured
- Transcript corrected
- Fallback to text
- Language changed
- Speech synthesis started
- Speech synthesis completed
- Voice error

Logs must avoid unnecessary transcript text.

### 34.3 Required Health Checks

Browser Voice frontend health is capability-based.

Server-side health checks must include:

- Agent Runtime availability
- Event endpoint availability
- Session endpoint availability
- Text fallback availability

---

## 35. Relationship to Agent Runtime

Browser Voice depends on Agent Runtime.

Browser Voice creates or continues agent sessions.

Agent Runtime is responsible for:

- Context Packet request
- Agent response generation
- State transition
- Turn capture
- Journal creation
- Candidate proposal
- Guided Action creation
- Invitation draft creation

Browser Voice must not duplicate Agent Runtime responsibilities.

---

## 36. Relationship to Context Manager

Browser Voice does not directly assemble context.

Agent Runtime requests Context Packets.

Context Manager builds Context Packets.

Browser Voice must preserve language, mode, and session state so Context Manager can assemble correct packets through Agent Runtime.

---

## 37. Relationship to Context Packet

Browser Voice must respect packet-driven output behavior as mediated by Agent Runtime.

If Agent Runtime reports degraded context, Browser Voice may display a degraded context notice.

If Agent Runtime reports failed context, Browser Voice must display safe failure text and avoid continuing substantive guidance.

---

## 38. Relationship to Knowledge Ingestion

Browser Voice final transcripts become captured session turns.

Knowledge Ingestion may use those turns to create captured input, normalize, classify, segment, risk-check, dedupe, and create candidates where appropriate.

Browser Voice does not create candidates directly.

---

## 39. Relationship to Agent Events

Browser Voice emits browser voice events.

Agent Runtime emits agent events.

Events must preserve correlation IDs so a complete timeline can be reconstructed.

Browser Voice events must avoid unnecessary transcript body text.

---

## 40. Relationship to Learning Pipeline

Learning Pipeline may later evaluate:

- Voice session completion
- Agent responses
- Guided Actions created after voice turns
- Outcomes from those actions
- Whether voice or text fallback improved completion
- Whether language switching affected progress
- Whether transcript confidence affected quality

Browser Voice must preserve enough event and transcript metadata to support learning.

---

## 41. Relationship to External Runtime

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

External runtime may use Telnyx.

Browser Voice is internal and must not use Telnyx.

Browser Voice events must not be confused with external runtime events.

---

## 42. Testing Requirements

### 42.1 Unit Tests

Unit tests must cover:

- Speech support detection
- Speech synthesis support detection
- State machine transitions
- Permission handling
- Language mapping
- Transcript finalization
- Transcript correction
- Error fallback
- Mute behavior
- Pause behavior
- Text fallback activation
- Team Magnificent identity scope validation

### 42.2 Integration Tests

Integration tests must cover:

- Creating a Browser Voice agent session
- Submitting final transcript to Agent Runtime
- Receiving agent response
- Displaying response as text
- Speaking response when enabled
- Falling back to text when permission denied
- Falling back to text when unsupported
- Language change during session
- Transcript correction submission
- Event emission
- Session completion

### 42.3 Accessibility Tests

Accessibility tests must prove:

- Workflow can be completed without voice.
- Controls are keyboard accessible.
- Listening state is visible.
- Listening state is screen-reader available.
- Mute works.
- Pause works.
- Stop works.
- Text fallback works on mobile.
- Reduced motion is respected.

### 42.4 Privacy Tests

Privacy tests must prove:

- Microphone permission is requested only after user action.
- Listening state is visible.
- Listening stops after pause.
- Listening stops after stop.
- Listening stops after session end.
- Raw audio is not stored.
- Transcript is scoped to Team Magnificent and BA.
- Transcript is not visible to another BA.
- Journal privacy is preserved.

### 42.5 Bilingual Tests

Bilingual tests must prove:

- English recognition setting exists.
- Spanish recognition setting exists.
- English TTS setting exists.
- Spanish TTS setting exists.
- Language change emits event.
- Language metadata is preserved.
- Fresh context can be requested when template language changes.

### 42.6 Runtime Boundary Tests

Runtime boundary tests must prove:

- No Telnyx code path exists for Browser Voice.
- Browser Voice does not emit external runtime events.
- Internal voice events use `browser_voice.*`.
- Text fallback does not require voice permission.
- Agent Runtime, not Browser Voice, handles context and agent response.

---

## 43. Acceptance Criteria

The Browser Voice Runtime is complete only when all acceptance criteria are satisfied.

### 43.1 Capability Acceptance Criteria

- Voice support detection works.
- Speech synthesis support detection works.
- Unsupported browsers fall back to text.
- Text fallback always works.

### 43.2 Permission Acceptance Criteria

- Microphone permission is requested only after BA action.
- Permission granted starts listening.
- Permission denied triggers text fallback.
- Permission denied emits event.
- User can retry when appropriate.

### 43.3 Voice Interaction Acceptance Criteria

- BA can start voice session.
- BA can pause voice session.
- BA can stop voice session.
- BA can mute speech output.
- BA can end session.
- Interim transcripts can display.
- Final transcripts submit to Agent Runtime.
- Agent responses display as text.
- Agent responses may be spoken.

### 43.4 Transcript Acceptance Criteria

- Final transcripts create conversation turns.
- Interim transcripts do not create final turns.
- Transcript confidence is preserved when available.
- Transcript correction is supported.
- Corrected transcript is submitted.
- Transcript metadata is preserved.

### 43.5 Bilingual Acceptance Criteria

- English recognition settings exist.
- Spanish recognition settings exist.
- English speech output works when supported.
- Spanish speech output works when supported.
- Language changes update recognition and synthesis.
- Language change emits event.
- Language metadata is preserved.

### 43.6 Team Magnificent Identity Acceptance Criteria

- Browser Voice sessions include Team Magnificent scope.
- Transcript turns include Team Magnificent scope.
- Browser Voice events include Team Magnificent scope in payload or metadata.
- BA records are never treated as floating outside Team Magnificent.
- Team Magnificent scope is preserved when falling back to text.

### 43.7 Privacy Acceptance Criteria

- No secret audio recording occurs.
- Raw audio is not stored in MVP.
- Transcript text is stored securely.
- Session transcripts are not exposed to other BAs.
- Journal privacy is preserved.
- Event payloads avoid unnecessary transcript text.

### 43.8 Runtime Boundary Acceptance Criteria

- No Telnyx or PSTN code path is used for internal agents.
- Telnyx remains reserved for ringless voicemail, SMS, and future callback workflows.
- Browser Voice does not perform external communication.
- Browser Voice does not retrieve knowledge directly.
- Browser Voice does not create candidates directly.
- Browser Voice does not approve knowledge.

### 43.9 Agent Integration Acceptance Criteria

- Steve can use Browser Voice.
- Michael can use Browser Voice.
- Ivory can use Browser Voice.
- Each agent supports text fallback.
- Each agent supports English.
- Each agent supports Spanish.
- Final transcripts submit to Agent Runtime.
- Agent response displays correctly.

### 43.10 Event Acceptance Criteria

- Capability checked event emits.
- Permission requested event emits.
- Permission granted event emits.
- Permission denied event emits.
- Listening started event emits.
- Interim transcript event emits when used.
- Final transcript event emits.
- Transcript corrected event emits.
- Language changed event emits.
- Speech started event emits.
- Speech completed event emits.
- Fallback to text event emits.
- Error event emits.

---

## 44. Required Invariants

The following invariants must always hold.

1. Browser Voice is internal runtime.
2. Browser Voice does not use Telnyx.
3. Telnyx is reserved for SMS, ringless voicemail, and future callback workflows.
4. Voice is never the only path.
5. Text fallback is mandatory.
6. Microphone permission is requested only after BA action.
7. Listening status is visible.
8. Raw audio is not stored in MVP.
9. Final transcripts become conversation turns.
10. Interim transcripts do not become final turns.
11. Transcript language is preserved.
12. English is supported.
13. Spanish is supported.
14. Responses always appear as text.
15. Speech output can be muted.
16. Speech output can be cancelled.
17. User can pause, stop, and end.
18. Team Magnificent scope is required.
19. BA scope is required.
20. A BA is always scoped to Team Magnificent in this app.
21. Browser Voice does not retrieve knowledge directly.
22. Browser Voice does not create candidates directly.
23. Browser Voice does not approve knowledge.
24. Browser Voice emits runtime events.
25. Browser Voice events avoid unnecessary private transcript text.

---

## 45. Implementation Structure for Codex

Recommended implementation layout:

```text id="yog08n"
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

apps/team/src/routes/
  michael/interview.tsx
  ivory/index.tsx
  steve/interview.tsx
```

Server integration points:

```text id="fr01rn"
server/src/runtime/agents/routes.ts
server/src/runtime/events/event.service.ts
server/src/runtime/knowledge-ingestion/
```

---

## 46. Minimal Runtime Implementation Sequence

Codex should implement Browser Voice Runtime in this order.

### Step 1: Types

Implement Browser Voice types, transcript types, language types, error types, and Team Magnificent identity fields.

### Step 2: Speech Language Mapping

Implement English and Spanish browser locale mapping.

### Step 3: State Machine

Implement Browser Voice state machine and transition validation.

### Step 4: Controller

Implement Browser Voice Controller using progressive enhancement.

### Step 5: React Hook

Implement `useBrowserVoice`.

### Step 6: UI Components

Implement voice controls, transcript panel, text fallback input, response panel, language selector, and status messages.

### Step 7: Agent Runtime Integration

Submit final transcripts to Agent Runtime session turn endpoint.

### Step 8: Event Integration

Emit Browser Voice events.

### Step 9: Transcript Correction

Implement low-confidence correction flow.

### Step 10: Accessibility

Implement keyboard access, visible status, mute, pause, stop, and text fallback.

### Step 11: Privacy Guards

Ensure permission timing, no hidden listening, no raw audio storage, and scoped transcript storage.

### Step 12: Tests

Implement unit, integration, accessibility, privacy, bilingual, and boundary tests.

---

## 47. Completion Definition

The Browser Voice Runtime is considered Version 1.0 complete when:

- Browser voice support detection works.
- Browser speech synthesis detection works.
- Text fallback always works.
- Microphone permission is requested only after BA action.
- Listening state is visible.
- English and Spanish recognition settings exist.
- English and Spanish speech output settings exist.
- Final transcripts submit to Agent Runtime.
- Agent response displays as text.
- Agent response may be spoken when enabled.
- BA can pause, stop, mute, and end session.
- Transcript correction is supported.
- Events are emitted.
- Team Magnificent scope is preserved.
- BA scope is preserved.
- Journal privacy is preserved.
- No raw audio is stored in MVP.
- No Telnyx or PSTN code path is used for internal agents.
- Acceptance tests pass.

---

## 48. Final Runtime Statement

Browser Voice Runtime is the internal voice interface for Team Magnificent Brand Ambassadors.

It allows Steve Success, Michael Magnificent, and Ivory to operate through spoken interaction without becoming phone agents.

It keeps voice inside the browser.

It keeps text fallback always available.

It protects microphone privacy.

It stores transcripts, not raw audio, for MVP.

It preserves English and Spanish operation.

It preserves Team Magnificent scope.

It preserves Brand Ambassador ownership.

It sends final transcripts to Agent Runtime.

It emits events for traceability.

It never uses Telnyx for internal coaching.

Telnyx remains external.

Browser Voice is how Team Magnificent Brand Ambassadors can speak with Momentum agents safely, accessibly, privately, and bilingually inside the app.
