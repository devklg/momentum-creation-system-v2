/**
 * Michael interview event bus — in-process pub/sub for live transcript chunks
 * and phase transitions, keyed by callSid. Mirrors the poolEvents.ts pattern.
 *
 * Why callSid keying: every BA on the platform may simultaneously be on their
 * own Michael interview. The SSE subscriber for a given BA needs only the
 * chunks for THEIR call, not the firehose. callSid is the natural partition.
 *
 * Persistence remains in `domain/michaelScoring.ts` (triple-stacked). This
 * emitter is fan-out for live viewers only — if the process restarts the
 * client reconnects and rehydrates from the persisted snapshot.
 */

import { EventEmitter } from 'node:events';
import type {
  MichaelInterviewPhase,
  MichaelTranscriptChunk,
} from '@momentum/shared';

const CHUNK_EVENT = 'michael_chunk' as const;
const PHASE_EVENT = 'michael_phase' as const;

class MichaelEventBus extends EventEmitter {}

const bus = new MichaelEventBus();
bus.setMaxListeners(10_000);

export interface MichaelChunkEnvelope {
  callSid: string;
  chunk: MichaelTranscriptChunk;
}

export interface MichaelPhaseEnvelope {
  callSid: string;
  baId: string;
  phase: MichaelInterviewPhase;
}

export interface MichaelSubscription {
  unsubscribe: () => void;
}

export function publishChunk(envelope: MichaelChunkEnvelope): void {
  bus.emit(CHUNK_EVENT, envelope);
}

export function publishPhase(envelope: MichaelPhaseEnvelope): void {
  bus.emit(PHASE_EVENT, envelope);
}

/** Subscribe to chunks for a single callSid. Filters at the listener so the
 *  subscriber only sees its own call's chunks. The unsubscribe MUST be called
 *  in the SSE `close` handler or listeners leak. */
export function subscribeChunksForCall(
  callSid: string,
  handler: (chunk: MichaelTranscriptChunk) => void,
): MichaelSubscription {
  const filtered = (env: MichaelChunkEnvelope): void => {
    if (env.callSid === callSid) handler(env.chunk);
  };
  bus.on(CHUNK_EVENT, filtered);
  let detached = false;
  return {
    unsubscribe: () => {
      if (detached) return;
      detached = true;
      bus.off(CHUNK_EVENT, filtered);
    },
  };
}

export function subscribePhaseForBa(
  baId: string,
  handler: (phase: MichaelInterviewPhase) => void,
): MichaelSubscription {
  const filtered = (env: MichaelPhaseEnvelope): void => {
    if (env.baId === baId) handler(env.phase);
  };
  bus.on(PHASE_EVENT, filtered);
  let detached = false;
  return {
    unsubscribe: () => {
      if (detached) return;
      detached = true;
      bus.off(PHASE_EVENT, filtered);
    },
  };
}

export function activeMichaelSubscriberCount(): number {
  return bus.listenerCount(CHUNK_EVENT) + bus.listenerCount(PHASE_EVENT);
}
