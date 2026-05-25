/**
 * wf_0039 — Michael interview State 2: call in progress.
 *
 * Render: teal pill with pulsing dot, near-real-time transcript via SSE from
 * /api/michael/interview/transcript/stream, speaker-labeled. NO buttons —
 * the BA is on a live call. The parent route handles phase transitions; this
 * component just renders + subscribes.
 *
 * Hydration: parent hands us the snapshot chunks. The SSE stream emits
 * additional chunks; we append and dedupe by sequence to tolerate any
 * snapshot/stream overlap on connect.
 *
 * Compliance: transcript content is what was spoken; we render verbatim. No
 * income/placement language enters via this component.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  MichaelInterviewPhase,
  MichaelInterviewSseEvent,
  MichaelTranscriptChunk,
} from './_wire';

interface CallInProgressProps {
  initialTranscript: MichaelTranscriptChunk[];
  onPhaseAdvance: (next: MichaelInterviewPhase) => void;
}

export function CallInProgress({
  initialTranscript,
  onPhaseAdvance,
}: CallInProgressProps) {
  const [chunks, setChunks] = useState<MichaelTranscriptChunk[]>(initialTranscript);
  const [connected, setConnected] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const source = new EventSource('/api/michael/interview/transcript/stream', {
      withCredentials: true,
    });

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (msg) => {
      try {
        const evt = JSON.parse(msg.data) as MichaelInterviewSseEvent;
        if (evt.type === 'snapshot') {
          setChunks(mergeChunks([], evt.chunks));
        } else if (evt.type === 'chunk') {
          setChunks((prev) => mergeChunks(prev, [evt.chunk]));
        } else if (evt.type === 'phase') {
          if (evt.phase !== 'call_in_progress') {
            onPhaseAdvance(evt.phase);
          }
        }
      } catch {
        // malformed event — ignore; SSE will retry on its own
      }
    };

    return () => {
      source.close();
    };
  }, [onPhaseAdvance]);

  // Auto-scroll transcript to bottom on new chunks.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chunks.length]);

  const grouped = useMemo(() => groupConsecutive(chunks), [chunks]);

  return (
    <div className="min-h-screen bg-ink text-cream py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-2.5 rounded-full bg-teal/15 border border-teal/40 px-4 py-1.5 mb-8">
          <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
          <span className="font-mono tracking-[0.22em] text-[11px] text-teal uppercase">
            Live call in progress
          </span>
        </span>
        <h1 className="font-display text-[clamp(32px,5.5vw,56px)] leading-[0.95] text-cream mb-4">
          You're on with Michael.
        </h1>
        <p className="text-cream-mute text-[14px] leading-[1.6] mb-8 max-w-xl">
          The transcript below updates as the call goes. This page will move on the
          moment the call wraps.
        </p>

        <div
          ref={transcriptRef}
          className="bg-cream/[0.025] border border-cream/10 rounded-md p-6 h-[55vh] overflow-y-auto space-y-5"
        >
          {grouped.length === 0 ? (
            <p className="font-mono tracking-[0.14em] text-[11px] text-cream-faint uppercase">
              {connected ? 'Listening…' : 'Connecting to the transcript stream…'}
            </p>
          ) : (
            grouped.map((g, i) => (
              <div key={`${g.speaker}-${g.firstSeq}-${i}`}>
                <p className="font-mono tracking-[0.18em] text-[10px] uppercase mb-1.5"
                   style={{ color: g.speaker === 'michael' ? '#C9A84C' : '#2DD4BF' }}>
                  {g.speaker === 'michael' ? 'Michael' : 'You'}
                </p>
                <p className="text-cream text-[15px] leading-[1.55]">{g.text}</p>
              </div>
            ))
          )}
        </div>

        {!connected && chunks.length > 0 && (
          <p className="mt-3 text-[11px] font-mono tracking-[0.08em] text-cream-faint">
            Reconnecting…
          </p>
        )}
      </div>
    </div>
  );
}

function mergeChunks(
  prev: MichaelTranscriptChunk[],
  incoming: MichaelTranscriptChunk[],
): MichaelTranscriptChunk[] {
  const seen = new Set<number>(prev.map((c) => c.sequence));
  const merged = [...prev];
  for (const c of incoming) {
    if (!seen.has(c.sequence)) {
      merged.push(c);
      seen.add(c.sequence);
    }
  }
  merged.sort((a, b) => a.sequence - b.sequence);
  return merged;
}

interface SpeakerTurn {
  speaker: 'michael' | 'ba';
  text: string;
  firstSeq: number;
}

function groupConsecutive(chunks: MichaelTranscriptChunk[]): SpeakerTurn[] {
  const out: SpeakerTurn[] = [];
  for (const c of chunks) {
    const last = out[out.length - 1];
    if (last && last.speaker === c.speaker) {
      last.text = `${last.text} ${c.text}`;
    } else {
      out.push({ speaker: c.speaker, text: c.text, firstSeq: c.sequence });
    }
  }
  return out;
}
