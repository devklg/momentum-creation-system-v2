# Browser Voice Runtime

Status: Canonical runtime source-of-truth  
Layer: `/runtime`

## Purpose

The Browser Voice Runtime defines how Steve Success, Michael Magnificent, and Ivory use browser-based voice with text fallback.

## Core rule

```text
Internal coaching agents use browser voice and text fallback.
Internal coaching agents do not use Telnyx PSTN.
```

Telnyx remains reserved for ringless voicemail, SMS, and future callback workflows.

## Runtime modes

| Mode | Description |
|---|---|
| `browser_voice` | BA speaks through browser microphone; transcript is captured; agent response appears as text and may be spoken by browser TTS |
| `text` | BA types and reads responses |
| `mixed` | BA can switch between voice and text |

Text fallback is mandatory.

## Browser strategy

Use progressive enhancement:

- Web Speech API for speech recognition when available;
- SpeechSynthesis API for browser TTS when available;
- text input fallback when unsupported or denied;
- manual transcript correction for low-confidence turns.

MVP stores transcripts, not raw audio.

## State machine

```ts
type BrowserVoiceState =
  | 'unsupported'
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused'
  | 'text_fallback'
  | 'error';
```

Transitions:

```text
idle -> requesting_permission -> listening
requesting_permission -> permission_denied -> text_fallback
unsupported -> text_fallback
listening -> processing -> speaking -> listening
any -> error -> text_fallback
```

## Controller interface

```ts
interface BrowserVoiceController {
  isSpeechRecognitionSupported(): boolean;
  isSpeechSynthesisSupported(): boolean;
  requestMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'>;
  startListening(options: StartListeningOptions): void;
  stopListening(): void;
  pause(): void;
  resume(): void;
  speak(text: string, options: SpeakOptions): Promise<void>;
  cancelSpeech(): void;
  setLanguage(language: 'en' | 'es'): void;
}
```

```ts
interface StartListeningOptions {
  language: 'en' | 'es';
  onInterimTranscript: (text: string, confidence?: number) => void;
  onFinalTranscript: (text: string, confidence?: number) => void;
  onError: (error: BrowserVoiceError) => void;
}
```

## Transcript model

```ts
interface BrowserTranscriptTurn {
  sessionId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  baId: string;
  inputMode: 'voice';
  language: 'en' | 'es';
  originalText: string;
  correctedText?: string;
  confidence?: number;
  isFinal: true;
  capturedAt: string;
}
```

Interim transcripts may display on screen but should not create final conversation turns.

## Bilingual behavior

```ts
const speechLanguageMap = {
  en: ['en-US'],
  es: ['es-US', 'es-MX', 'es-ES']
};
```

When language changes, emit `browser_voice.language_changed`, update speech recognition language, request fresh context if the template language changes, and preserve transcript language metadata.

## UI requirements

Each agent page includes agent name, English/Spanish selector, start voice button, pause/stop button, mute toggle, text fallback input, transcript panel, agent response panel, journal prompt card when relevant, microphone permission messages, and end session button.

## Accessibility

Voice is never the only path. Responses always appear as text. Controls are keyboard accessible. User can pause, stop, or mute. Text fallback works on mobile. Reduced-motion settings are respected.

## Privacy

Request microphone permission only when the BA starts voice. Show clear listening status. Do not secretly record audio. Store transcript text, not raw audio, for MVP. Do not expose session transcripts to other BAs. Preserve journal privacy.

## Events

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

## Frontend files

```text
apps/team/src/runtime/browserVoice/browserVoice.types.ts
apps/team/src/runtime/browserVoice/browserVoiceController.ts
apps/team/src/runtime/browserVoice/useBrowserVoice.ts
apps/team/src/runtime/browserVoice/speechLanguage.ts
apps/team/src/components/runtime/VoiceControls.tsx
apps/team/src/components/runtime/TranscriptPanel.tsx
apps/team/src/components/runtime/TextFallbackInput.tsx
apps/team/src/components/runtime/AgentResponsePanel.tsx
apps/team/src/components/runtime/BrowserAgentSession.tsx
```

## Routes

Use existing `.team` patterns:

```text
/michael/interview
/ivory
/steve/interview
```

If `/steve/interview` does not exist, Codex may add it under `.team` as an MVP runtime route.

## Acceptance criteria

Voice support detection works; text fallback always works; English and Spanish recognition settings exist; final transcripts submit to Agent Runtime; agent response displays as text and may be spoken; user can pause/mute/end; no Telnyx/PSTN code path is used for internal agents.
