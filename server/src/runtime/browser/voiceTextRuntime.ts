import type {
  McsBrowserInterimTranscript,
  McsBrowserTextTurnWirePayload,
  McsBrowserTranscriptTurn,
  McsBrowserVoiceAgentTurnWirePayload,
  McsBrowserVoiceState,
  McsRuntimeRequestScope,
} from '@momentum/shared/runtime';
import { defineRuntimeBoundary } from '../common.js';
import type { BackendRuntimeBoundaryDescriptor } from '../common.js';

export interface BrowserVoiceTextRuntimeBoundaryPort {
  finalizeVoiceTurn(
    scope: McsRuntimeRequestScope,
    transcript: McsBrowserTranscriptTurn,
  ): Promise<McsBrowserVoiceAgentTurnWirePayload>;
  acceptTextTurn(
    scope: McsRuntimeRequestScope,
    turn: McsBrowserTextTurnWirePayload,
  ): Promise<McsBrowserTextTurnWirePayload>;
  captureInterimTranscript?(
    scope: McsRuntimeRequestScope,
    transcript: McsBrowserInterimTranscript,
  ): Promise<McsBrowserVoiceState>;
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
