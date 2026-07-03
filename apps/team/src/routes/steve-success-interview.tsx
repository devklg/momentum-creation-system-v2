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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

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
  tmagId: string;
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
  tmagId: string;
  sponsorTmagId: string | null;
  callSid: string | null;
  startedAt: string | null;
  completedAt: string | null;
  answers: SteveDiscoveryAnswer[];
  successProfile: SteveSuccessProfile;
  audioUrl: string | null;
}

interface SteveDiscoveryView {
  tmagId: string;
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
    return <DiscoveryChat onComplete={load} />;
  }

  return <ProfileView artifact={view.artifact} />;
}

/* ─── In-flight state — the live discovery conversation with Steve ─── */

interface ChatTurn {
  seq: number;
  role: 'ba' | 'steve';
  text: string;
  at: string;
}

/* ─── Browser voice (S1.6 completion) — Web Speech STT/TTS, browser-only,
       no Telnyx/PSTN per the amended locked spec. The voice layer is purely
       client-side: speech → text → the SAME /converse endpoint → text →
       speech. The event-sourced transcript is identical either way. ─── */

interface SpeechAlt {
  transcript: string;
}
interface SpeechResult {
  0: SpeechAlt;
  isFinal: boolean;
}
interface SpeechEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
}
interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function speechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Strip emoji + markdown emphasis so TTS reads clean sentences. */
function speakableText(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\*+/g, '')
    .trim();
}

function DiscoveryChat({ onComplete }: { onComplete: () => void | Promise<void> }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const voiceOnRef = useRef(false);
  const doneRef = useRef(false);
  const busyRef = useRef(false);
  const recRef = useRef<SpeechRec | null>(null);
  const voiceSupported = speechRecognitionCtor() !== null;

  const send = useCallback(
    async (message: string) => {
      setBusy(true);
      busyRef.current = true;
      setError(null);
      try {
        const res = await fetch('/api/steve/discovery/converse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          error?: string;
          done?: boolean;
          extractionPending?: boolean;
          turns?: ChatTurn[];
        };
        if (!data.ok) {
          setError(data.error ?? 'Steve could not respond. Try again.');
          return;
        }
        if (data.turns) setTurns(data.turns);
        const lastSteve = data.turns?.filter((t) => t.role === 'steve').slice(-1)[0]?.text ?? '';
        if (data.done) {
          doneRef.current = true;
          stopVoice();
        }
        if (voiceOnRef.current && lastSteve) speak(lastSteve);
        if (data.extractionPending) {
          setError('Steve is wrapping up your profile — send one more short message to finish.');
        }
        if (data.done) {
          await onComplete();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        setError(`Network error: ${msg}`);
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    },
    [onComplete],
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/steve/discovery/conversation', { credentials: 'include' });
        const data = (await res.json()) as { ok: boolean; turns?: ChatTurn[] };
        if (data.ok && data.turns && data.turns.length > 0) {
          setTurns(data.turns);
          setBusy(false);
          return;
        }
      } catch {
        /* fall through to greeting */
      }
      await send('');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft('');
    submitMessage(message);
  }

  function submitMessage(message: string) {
    setTurns((prev) => [
      ...prev,
      { seq: prev.length, role: 'ba', text: message, at: new Date().toISOString() },
    ]);
    void send(message);
  }

  /* ── voice controls ── */

  function speak(text: string) {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(speakableText(text));
    utter.lang = 'en-US';
    utter.rate = 1.02;
    utter.onend = () => {
      if (voiceOnRef.current && !doneRef.current && !busyRef.current) startListening();
    };
    speechSynthesis.speak(utter);
  }

  function startListening() {
    if (!voiceOnRef.current || doneRef.current) return;
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    try { recRef.current?.abort(); } catch { /* noop */ }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setDraft(finalText + interim);
    };
    rec.onend = () => {
      setListening(false);
      const message = finalText.trim();
      setDraft('');
      if (message && !busyRef.current) {
        submitMessage(message);
      } else if (voiceOnRef.current && !doneRef.current && !busyRef.current && typeof speechSynthesis !== 'undefined' && !speechSynthesis.speaking) {
        startListening(); // silence timeout — keep the mic warm, hands-free
      }
    };
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  function stopVoice() {
    voiceOnRef.current = false;
    setVoiceOn(false);
    setListening(false);
    try { recRef.current?.abort(); } catch { /* noop */ }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  function toggleVoice() {
    if (voiceOn) {
      stopVoice();
      return;
    }
    voiceOnRef.current = true;
    setVoiceOn(true);
    if (!busy) startListening();
  }

  return (
    <div className="min-h-screen bg-ink text-cream px-6 py-10">
      <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-2xl flex-col">
        <header className="mb-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gold">
            Steve · New BA Discovery
          </p>
          <h1 className="mt-1 text-xl font-semibold">Your discovery conversation</h1>
          <p className="mt-1 text-sm text-cream-mute">
            A relaxed get-to-know-you — nothing here is scored or judged. Your answers
            shape how your sponsor and the team support you.
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-cream/10 bg-black/20 p-4">
          {turns.map((t) => (
            <div
              key={`${t.seq}-${t.role}`}
              className={t.role === 'steve' ? 'flex justify-start' : 'flex justify-end'}
            >
              <div
                className={
                  t.role === 'steve'
                    ? 'max-w-[85%] whitespace-pre-wrap rounded-lg bg-cream/10 px-4 py-2 text-sm'
                    : 'max-w-[85%] whitespace-pre-wrap rounded-lg bg-gold/20 px-4 py-2 text-sm'
                }
              >
                {t.text}
              </div>
            </div>
          ))}
          {busy ? (
            <p className="text-xs font-mono uppercase tracking-widest text-cream-mute">
              Steve is typing…
            </p>
          ) : null}
          <div ref={endRef} />
        </div>

        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          {voiceSupported ? (
            <button
              type="button"
              onClick={toggleVoice}
              title={voiceOn ? 'Turn voice off' : 'Talk to Steve'}
              className={
                voiceOn
                  ? 'rounded-lg border border-gold bg-gold/20 px-4 py-3 text-sm font-semibold text-gold'
                  : 'rounded-lg border border-cream/20 bg-black/30 px-4 py-3 text-sm text-cream-mute hover:border-gold hover:text-gold'
              }
            >
              {listening ? '● Listening…' : voiceOn ? '🎙 Voice on' : '🎙 Voice'}
            </button>
          ) : null}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={listening ? 'Listening — just talk…' : 'Type your answer…'}
            disabled={busy}
            className="flex-1 rounded-lg border border-cream/20 bg-black/30 px-4 py-3 text-sm text-cream placeholder:text-cream-mute focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
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
