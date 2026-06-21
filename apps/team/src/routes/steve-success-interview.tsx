/**
 * /steve/discovery — Steve New BA Discovery & Success Interview surface.
 *
 * Reads /api/steve/discovery/state on mount. Pre-discovery shows an awaiting
 * state; once Steve's worker has ingested the artifact, this renders the
 * Success Profile (primary why, vision, learning style, communication
 * preferences, support needs, launch + training recommendations, and the
 * Michael handoff summary) plus the raw discovery answers.
 *
 * Steve is a SEPARATE agent from Michael and never scores or judges — this page
 * only reflects the BA's own words back to them.
 *
 * Wire types are declared locally (not imported from @momentum/shared) because
 * the shared `src` alias is outside this app's rootDir and importing it trips
 * TS6059 — same pattern as components/michael/_wire.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/* ─── Local wire shapes (mirror the Steve block in packages/shared/src/types.ts) ─── */

type SteveDiscoveryPhase =
  | 'awaiting_call'
  | 'call_in_progress'
  | 'complete'
  | 'no_answer'
  | 'invalid_number'
  | 'stt_failed';

interface SteveDiscoveryAnswer {
  questionId: string;
  prompt: string;
  answerText: string;
}

interface StevePrimaryWhy {
  statement: string;
  who: string;
  whyNow: string;
}

interface SteveSuccessVision {
  statement: string;
  oneBigChange: string;
}

interface SteveLearningStyle {
  modalities: string[];
  feedbackPreference: string;
  notes: string;
}

interface SteveCommunicationPreferences {
  preferredChannels: string[];
  cadence: string | null;
  bestTimes: string;
  notes: string;
}

interface SteveSupportNeeds {
  areas: string[];
  potentialObstacles: string[];
  helpStyle: string;
  notes: string;
}

interface SteveRecommendation {
  text: string;
  href?: string | null;
}

interface SteveSuccessProfile {
  baId: string;
  primaryWhy: StevePrimaryWhy;
  successVision: SteveSuccessVision;
  learningStyle: SteveLearningStyle;
  communicationPreferences: SteveCommunicationPreferences;
  supportNeeds: SteveSupportNeeds;
  launchRecommendations: SteveRecommendation[];
  trainingRecommendations: SteveRecommendation[];
  michaelHandoffSummary: string;
  generatedAt: string;
  signedBy: string;
}

interface SteveDiscoveryArtifact {
  baId: string;
  sponsorBaId: string | null;
  callSid: string | null;
  startedAt: string | null;
  completedAt: string | null;
  answers: SteveDiscoveryAnswer[];
  successProfile: SteveSuccessProfile;
  audioUrl: string | null;
}

interface SteveDiscoveryView {
  baId: string;
  phase: SteveDiscoveryPhase;
  artifact: SteveDiscoveryArtifact | null;
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; view: SteveDiscoveryView };

/* ─── Page ─── */

export function SteveSuccessInterviewPage() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/steve/discovery/state', { credentials: 'include' });
      const data = (await res.json()) as {
        ok: boolean;
        view?: SteveDiscoveryView;
        error?: string;
      };
      if (!data.ok || !data.view) {
        setState({ kind: 'error', message: data.error ?? 'Could not load discovery state.' });
        return;
      }
      setState({ kind: 'ready', view: data.view });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setState({ kind: 'error', message: `Network error: ${msg}` });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return <CenterMessage line="Loading…" />;
  }
  if (state.kind === 'error') {
    return <CenterMessage line={state.message} tone="error" />;
  }

  const { view } = state;
  if (view.phase !== 'complete' || !view.artifact) {
    return (
      <CenterMessage line="Steve hasn't completed your discovery conversation yet. Once it's done, your Success Profile will appear here." />
    );
  }

  return <ProfileView artifact={view.artifact} />;
}

/* ─── Complete state — the Success Profile ─── */

function ProfileView({ artifact }: { artifact: SteveDiscoveryArtifact }) {
  const p = artifact.successProfile;
  return (
    <div className="min-h-screen bg-ink text-cream px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gold">
            Steve · Success Profile
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-cream">
            How we'll support you
          </h1>
          <p className="mt-2 text-sm text-cream-mute">
            This is what you shared, reflected back — so your sponsor and the team
            can meet you where you are. Nothing here rates or ranks you.
          </p>
        </header>

        <Section title="Your Primary Why">
          <Field label="Why" value={p.primaryWhy.statement} />
          <Field label="Who it's for" value={p.primaryWhy.who} />
          <Field label="Why now" value={p.primaryWhy.whyNow} />
        </Section>

        <Section title="Your Vision of Success">
          <Field label="A year from now" value={p.successVision.statement} />
          <Field label="The one big change" value={p.successVision.oneBigChange} />
        </Section>

        <Section title="How You Learn">
          <Chips items={p.learningStyle.modalities} />
          <Field label="Feedback you like" value={p.learningStyle.feedbackPreference} />
          {p.learningStyle.notes ? <Field label="Notes" value={p.learningStyle.notes} /> : null}
        </Section>

        <Section title="How You Like to Stay in Touch">
          <Chips items={p.communicationPreferences.preferredChannels} />
          {p.communicationPreferences.cadence ? (
            <Field label="Cadence" value={p.communicationPreferences.cadence} />
          ) : null}
          <Field label="Best times" value={p.communicationPreferences.bestTimes} />
          {p.communicationPreferences.notes ? (
            <Field label="Notes" value={p.communicationPreferences.notes} />
          ) : null}
        </Section>

        <Section title="How We Can Support You">
          {p.supportNeeds.areas.length ? (
            <Field label="Where you'd like a hand" value={p.supportNeeds.areas.join(', ')} />
          ) : null}
          {p.supportNeeds.potentialObstacles.length ? (
            <Field label="What's gotten in the way before" value={p.supportNeeds.potentialObstacles.join(', ')} />
          ) : null}
          <Field label="How you like to be helped" value={p.supportNeeds.helpStyle} />
          {p.supportNeeds.notes ? <Field label="Notes" value={p.supportNeeds.notes} /> : null}
        </Section>

        {p.launchRecommendations.length ? (
          <Section title="Your Personalized First Steps">
            <Recs recs={p.launchRecommendations} />
          </Section>
        ) : null}

        {p.trainingRecommendations.length ? (
          <Section title="Training to Start With">
            <Recs recs={p.trainingRecommendations} />
          </Section>
        ) : null}

        {p.michaelHandoffSummary ? (
          <Section title="Context for Your Onboarding Call">
            <p className="text-sm leading-relaxed text-cream">{p.michaelHandoffSummary}</p>
          </Section>
        ) : null}

        {artifact.answers.length ? (
          <Section title="Your Discovery Conversation">
            <ul className="space-y-4">
              {artifact.answers.map((a) => (
                <li key={a.questionId}>
                  <p className="text-[13px] font-medium text-cream-faint">{a.prompt}</p>
                  <p className="mt-1 text-sm leading-relaxed text-cream">{a.answerText}</p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <p className="mt-10 text-[11px] font-mono uppercase tracking-[0.18em] text-cream-mute">
          {p.signedBy}
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8 rounded-xl border border-cream/10 bg-cream/[0.02] p-5">
      <h2 className="mb-3 text-[12px] font-mono uppercase tracking-[0.16em] text-teal">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-cream-mute">{label}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-cream">{value}</p>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <span
          key={it}
          className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[12px] text-gold"
        >
          {it.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

function Recs({ recs }: { recs: SteveRecommendation[] }) {
  return (
    <ul className="space-y-2">
      {recs.map((r, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-cream">
          <span className="text-teal">→</span>
          {r.href ? (
            <a href={r.href} className="underline decoration-cream/30 underline-offset-2 hover:text-gold">
              {r.text}
            </a>
          ) : (
            <span>{r.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function CenterMessage({ line, tone = 'mute' }: { line: string; tone?: 'mute' | 'error' }) {
  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <p
        className={
          tone === 'error'
            ? 'text-[14px] font-mono tracking-[0.14em] text-red-400 uppercase max-w-xl text-center'
            : 'text-[12px] font-mono tracking-[0.18em] text-cream-faint uppercase max-w-xl text-center'
        }
      >
        {line}
      </p>
    </div>
  );
}
