import type {
  BrowserInterimTranscript,
  BrowserTextTurnWirePayload,
  BrowserTranscriptTurn,
  BrowserVoiceAgentTurnWirePayload,
  BrowserVoiceState,
  RuntimeRequestScope,
} from '@momentum/shared/runtime';
import { defineRuntimeBoundary } from '../common.js';
import type { BackendRuntimeBoundaryDescriptor } from '../common.js';

export interface BrowserVoiceTextRuntimeBoundaryPort {
  finalizeVoiceTurn(
    scope: RuntimeRequestScope,
    transcript: BrowserTranscriptTurn,
  ): Promise<BrowserVoiceAgentTurnWirePayload>;
  acceptTextTurn(
    scope: RuntimeRequestScope,
    turn: BrowserTextTurnWirePayload,
  ): Promise<BrowserTextTurnWirePayload>;
  captureInterimTranscript?(
    scope: RuntimeRequestScope,
    transcript: BrowserInterimTranscript,
  ): Promise<BrowserVoiceState>;
}

export const browserVoiceTextRuntimeBoundary = defineRuntimeBoundary({
  key: 'browser_voice_text_runtime',
  label: 'Browser Voice/Text Runtime',
  status: 'skeleton_only',
  activated: false,
  apiMounted: false,
  behaviorEnabled: false,
  persistenceAccess: 'service_boundary_only',
  sharedContractImport: '@momentum/shared/runtime',
  notes: [
    'Internal browser voice/text boundary placeholder only; external telephony stays outside this runtime.',
    'Future implementations must remain BA-facing and must keep text fallback available.',
  ],
} satisfies BackendRuntimeBoundaryDescriptor<'browser_voice_text_runtime'>);
