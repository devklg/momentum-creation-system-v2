/**
 * wf_0040 — Michael interview State 3: complete.
 *
 * Render: gold check, answer readback (the BA's parsed answers from the
 * Training Agent + Daily Success Coach artifact), the "signed by" provenance, and a CTA to /training/fast-start.
 * The hard gate opens at this state (server-side, when markCallCompleted
 * fires); this is the BA's first post-Michael landing.
 *
 * Compliance: only the BA's own answers are shown — no income/placement
 * language is rendered. Answer text is whatever Michael's Training Agent + Daily Success Coach worker
 * captured; the script-time enforcement prevents non-compliant prompts in
 * the first place.
 */

import { useNavigate } from 'react-router-dom';
import type { MichaelInterviewArtifact } from './_wire';

interface CallCompleteProps {
  artifact: MichaelInterviewArtifact;
}

export function CallComplete({ artifact }: CallCompleteProps) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-ink text-cream py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <span
            className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gold/15 border border-gold/40 text-gold"
            aria-hidden
          >
            ✓
          </span>
          <span className="font-mono tracking-[0.22em] text-[11px] text-gold uppercase">
            Interview complete
          </span>
        </div>

        <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] text-cream mb-4">
          Welcome aboard.
        </h1>
        <p className="text-cream-mute text-[15px] leading-[1.6] mb-12 max-w-xl">
          Michael captured your context. Your sponsor will see the highlights in their
          cockpit. Here's what was logged on your side:
        </p>

        <div className="space-y-7 mb-12">
          {artifact.answers.length === 0 ? (
            <p className="font-mono tracking-[0.12em] text-[11px] text-cream-faint uppercase">
              No answers captured.
            </p>
          ) : (
            artifact.answers.map((a) => (
              <div
                key={a.questionId}
                className="border-l-2 border-gold/40 pl-5 py-1"
              >
                <p className="font-mono tracking-[0.16em] text-[11px] text-gold uppercase mb-1.5">
                  {a.prompt}
                </p>
                <p className="text-cream text-[15px] leading-[1.55] mb-2">
                  {a.answerText || '—'}
                </p>
                {a.scoringTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {a.scoringTags.map((t) => (
                      <span
                        key={t}
                        className="font-mono tracking-[0.06em] text-[10px] text-cream-mute bg-cream/[0.04] border border-cream/10 px-2 py-0.5 rounded uppercase"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <p className="font-mono tracking-[0.14em] text-[11px] text-cream-faint uppercase mb-10">
          Signed: {artifact.scoring.signedBy}
        </p>

        <button
          type="button"
          onClick={() => navigate('/training/fast-start')}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-8 py-4 rounded transition-colors"
        >
          Continue to Fast Start →
        </button>
      </div>
    </div>
  );
}
