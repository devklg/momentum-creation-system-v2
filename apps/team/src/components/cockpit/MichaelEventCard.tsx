/**
 * wf_0042 — Upline cockpit event card.
 *
 * Sponsor-only render of a downline BA's Michael Training Agent + Daily Success Coach conversation:
 * the parsed answers, support tags, audio link, signed-by. The sponsor uses
 * this to lead with the BA's own context on first sponsor call.
 *
 * Access is enforced SERVER-SIDE — GET /api/michael/interview/cockpit/:downlineBaId
 * returns 403 with code=NOT_SPONSOR unless the requesting session's BA is the
 * direct sponsor of the downline. This component never receives card data for
 * a downline the user isn't entitled to read.
 *
 * Compliance: only the BA's own answers + lightweight support tags. No
 * income/placement/comp language enters via this card.
 */

import { useCallback, useEffect, useState } from 'react';
import type { MichaelCockpitCardData, MichaelInterviewAnswer } from './../michael/_wire';

interface MichaelEventCardProps {
  downlineBaId: string;
}

type CardState =
  | { kind: 'loading' }
  | { kind: 'not_complete' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; card: MichaelCockpitCardData };

export function MichaelEventCard({ downlineBaId }: MichaelEventCardProps) {
  const [state, setState] = useState<CardState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/michael/interview/cockpit/${encodeURIComponent(downlineBaId)}`,
        { credentials: 'include' },
      );
      if (res.status === 403) {
        setState({ kind: 'forbidden' });
        return;
      }
      if (res.status === 404) {
        // Either no artifact yet or no downline — treat both as not-complete
        // from the sponsor's POV; the cockpit just shows "interview pending."
        setState({ kind: 'not_complete' });
        return;
      }
      const data = (await res.json()) as {
        ok: boolean;
        card?: MichaelCockpitCardData;
        error?: string;
      };
      if (!data.ok || !data.card) {
        setState({ kind: 'error', message: data.error ?? 'Could not load card.' });
        return;
      }
      setState({ kind: 'ready', card: data.card });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setState({ kind: 'error', message: `Network error: ${msg}` });
    }
  }, [downlineBaId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return <CardShell><CardEyebrow text="Loading…" tone="mute" /></CardShell>;
  }
  if (state.kind === 'forbidden') {
    return (
      <CardShell>
        <CardEyebrow text="Sponsor-only" tone="mute" />
        <p className="text-cream-mute text-[13px] mt-2">
          This card is visible to the direct sponsor only.
        </p>
      </CardShell>
    );
  }
  if (state.kind === 'not_complete') {
    return (
      <CardShell>
        <CardEyebrow text="Interview pending" tone="mute" />
        <p className="text-cream-mute text-[13px] mt-2">
          Michael hasn't called this BA yet, or the artifact is still being prepared.
        </p>
      </CardShell>
    );
  }
  if (state.kind === 'error') {
    return (
      <CardShell>
        <CardEyebrow text="Card error" tone="error" />
        <p className="text-red-400 text-[13px] mt-2">{state.message}</p>
      </CardShell>
    );
  }

  const { card } = state;
  return (
    <CardShell>
      <div className="flex items-center justify-between mb-4 gap-4">
        <CardEyebrow text="Michael interview" tone="gold" />
        <span className="font-mono tracking-[0.06em] text-[11px] text-cream-faint">
          {formatCompletedAt(card.completedAt)}
        </span>
      </div>
      <h3 className="font-display text-[22px] text-cream leading-tight mb-1">
        {card.downlineFirstName || card.downlineBaId}
      </h3>
      {card.scoring.overallTone && (
        <p className="font-mono tracking-[0.18em] text-[11px] text-gold mb-4 uppercase">
          Tone · {card.scoring.overallTone}
        </p>
      )}

      {card.scoring.highlightTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {card.scoring.highlightTags.map((t) => (
            <span
              key={t}
              className="font-mono tracking-[0.06em] text-[10px] text-cream-mute bg-cream/[0.04] border border-cream/10 px-2 py-0.5 rounded uppercase"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-4 mb-5">
        {card.answers.map((a) => (
          <AnswerRow key={a.questionId} answer={a} />
        ))}
      </div>

      {card.audioUrl ? (
        <a
          href={card.audioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono tracking-[0.14em] text-[11px] text-teal hover:text-gold uppercase underline underline-offset-4"
        >
          Listen to call →
        </a>
      ) : (
        <span className="font-mono tracking-[0.12em] text-[11px] text-cream-faint uppercase">
          Audio not posted
        </span>
      )}

      <p className="mt-4 font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase">
        Signed: {card.signedBy}
      </p>
    </CardShell>
  );
}

function AnswerRow({ answer }: { answer: MichaelInterviewAnswer }) {
  return (
    <div className="border-l border-gold/30 pl-4">
      <p className="font-mono tracking-[0.14em] text-[10px] text-gold uppercase mb-1">
        {answer.prompt}
      </p>
      <p className="text-cream text-[14px] leading-[1.5]">{answer.answerText || '—'}</p>
      {answer.scoringTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {answer.scoringTags.map((t) => (
            <span
              key={t}
              className="font-mono tracking-[0.04em] text-[9px] text-cream-faint bg-cream/[0.03] px-1.5 py-0.5 rounded uppercase"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-cream/[0.025] border border-cream/10 rounded-md p-5">
      {children}
    </div>
  );
}

function CardEyebrow({
  text,
  tone,
}: {
  text: string;
  tone: 'gold' | 'mute' | 'error';
}) {
  const color =
    tone === 'gold'
      ? 'text-gold'
      : tone === 'error'
        ? 'text-red-400'
        : 'text-cream-faint';
  return (
    <p className={`font-mono tracking-[0.22em] text-[11px] uppercase ${color}`}>
      {text}
    </p>
  );
}

function formatCompletedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return iso;
  }
}
