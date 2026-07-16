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
import { Link } from 'react-router-dom';

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

interface SteveTranscriptChunk {
  sequence: number;
  speaker: 'steve' | 'ba';
  text: string;
  occurredAt: string;
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
  transcript: SteveTranscriptChunk[];
  answers: SteveDiscoveryAnswer[];
  successProfile: SteveSuccessProfile;
  audioUrl: string | null;
  correctionRevision?: number;
  lastCorrectedAt?: string | null;
}

interface SteveDiscoveryView {
  tmagId: string;
  phase: SteveDiscoveryPhase;
  transcript: SteveTranscriptChunk[];
  artifact: SteveDiscoveryArtifact | null;
}

type SteveSponsorConsentField =
  | 'why_statement'
  | 'success_vision'
  | 'support_obstacles'
  | 'michael_handoff_summary';

interface SteveSponsorConsentGrant {
  field: SteveSponsorConsentField;
  granted: boolean;
  sponsorTmagId: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
}

interface StevePrivacyState {
  policyVersion: 'acr-0031.v1';
  status: 'active' | 'withdrawn';
  withdrawnAt: string | null;
  sponsorConsent: Record<SteveSponsorConsentField, SteveSponsorConsentGrant>;
}

interface StevePrivacyResponse {
  ok: boolean;
  privacy?: StevePrivacyState;
  currentSponsorTmagId?: string | null;
  grantCopy?: string;
  revocationCopy?: string;
  error?: string;
}

type SteveCorrectionTarget =
  | { kind: 'transcript_text'; sequence: number }
  | { kind: 'answer_text'; questionId: string }
  | {
      kind: 'profile_text';
      path:
        | 'primaryWhy.statement'
        | 'primaryWhy.who'
        | 'primaryWhy.whyNow'
        | 'successVision.statement'
        | 'successVision.oneBigChange'
        | 'learningStyle.feedbackPreference'
        | 'learningStyle.notes'
        | 'communicationPreferences.cadence'
        | 'communicationPreferences.bestTimes'
        | 'communicationPreferences.notes'
        | 'supportNeeds.helpStyle'
        | 'supportNeeds.notes'
        | 'michaelHandoffSummary';
    }
  | {
      kind: 'profile_list';
      path:
        | 'learningStyle.modalities'
        | 'communicationPreferences.preferredChannels'
        | 'supportNeeds.areas'
        | 'supportNeeds.potentialObstacles';
    }
  | {
      kind: 'recommendation_text';
      list: 'launch' | 'training';
      index: number;
    };

interface SteveCorrectionResponse {
  ok: boolean;
  artifact?: SteveDiscoveryArtifact;
  correctionRevision?: number;
  correctedAt?: string;
  changedFieldPaths?: string[];
  auditEntryId?: string;
  error?: string;
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

  return <ProfileView artifact={view.artifact} onReload={load} />;
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

function choosePreferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const enUsVoices = voices.filter((voice) => /^en[-_]US/i.test(voice.lang));
  const candidates = enUsVoices.length ? enUsVoices : voices.filter((voice) => /^en/i.test(voice.lang));

  const scored = candidates
    .map((voice) => {
      const name = voice.name.toLowerCase();
      let score = 0;
      if (voice.lang.toLowerCase() === 'en-us') score += 8;
      if (name.includes('natural')) score += 12;
      if (name.includes('google')) score += 10;
      if (name.includes('microsoft')) score += 9;
      if (name.includes('online')) score += 4;
      if (name.includes('neural')) score += 4;
      if (name.includes('default')) score -= 3;
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.voice ?? null;
}

function SteveShellHeader({ kicker }: { kicker: string }) {
  return (
    <header className="relative z-10 px-6 md:px-10 pt-6 pb-2">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <Link to="/cockpit" className="flex items-center gap-3">
          <img src="/logos/logo_icon.png" alt="" aria-hidden="true" className="h-7 w-auto" />
          <span className="font-display tracking-[0.18em] text-[15px] text-gold hover:opacity-80">
            TEAM MAGNIFICENT
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <span className="hidden font-mono tracking-[0.22em] text-[10px] text-cream-mute uppercase sm:inline">
            {kicker}
          </span>
          <Link
            to="/cockpit"
            className="font-mono tracking-[0.22em] text-[10px] text-cream-mute hover:text-gold uppercase"
          >
            ← Cockpit
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-4xl text-sm text-cream-mute">
        Your conversation saves as you go — you can leave and come back.
      </p>
    </header>
  );
}

function DiscoveryChat({ onComplete }: { onComplete: () => void | Promise<void> }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(true);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const voiceOnRef = useRef(false);
  const doneRef = useRef(false);
  const busyRef = useRef(false);
  const recRef = useRef<SpeechRec | null>(null);
  const pendingFinalRef = useRef('');
  const lastSpeechAtRef = useRef(0);
  const ignoreNextEndRef = useRef(false);
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
          setIntroOpen(false);
          setBusy(false);
          return;
        }
      } catch {
        /* fall through to ready state */
      }
      setBusy(false);
    })();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return undefined;

    const updateVoices = () => setPreferredVoice(choosePreferredVoice(speechSynthesis.getVoices()));
    updateVoices();
    speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (speechSynthesis.onvoiceschanged === updateVoices) {
        speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft('');
    submitMessage(message);
  }

  function submitMessage(message: string) {
    pendingFinalRef.current = '';
    setTurns((prev) => [
      ...prev,
      { seq: prev.length, role: 'ba', text: message, at: new Date().toISOString() },
    ]);
    void send(message);
  }

  async function startConversation() {
    if (busy) return;
    setIntroOpen(false);
    await send('');
  }

  /* ── voice controls ── */

  function speak(text: string) {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(speakableText(text));
    utter.lang = 'en-US';
    if (preferredVoice) utter.voice = preferredVoice;
    utter.rate = 1.0;
    utter.pitch = 0.92;
    utter.onend = () => {
      if (voiceOnRef.current && !doneRef.current && !busyRef.current) startListening();
    };
    speechSynthesis.speak(utter);
  }

  function startListening() {
    if (!voiceOnRef.current || doneRef.current) return;
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) return;
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    try { recRef.current?.abort(); } catch { /* noop */ }
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    let sessionFinalText = pendingFinalRef.current;
    rec.onresult = (e) => {
      let interim = '';
      lastSpeechAtRef.current = Date.now();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        if (r.isFinal) {
          sessionFinalText += `${r[0].transcript} `;
          pendingFinalRef.current = sessionFinalText;
        }
        else interim += r[0].transcript;
      }
      setDraft(`${sessionFinalText}${interim}`.trimStart());
    };
    rec.onend = () => {
      setListening(false);
      if (ignoreNextEndRef.current) {
        ignoreNextEndRef.current = false;
        return;
      }
      const message = pendingFinalRef.current.trim();
      const quietLongEnough = Date.now() - lastSpeechAtRef.current >= 2500;
      if (message && quietLongEnough && !busyRef.current) {
        pendingFinalRef.current = '';
        setDraft('');
        submitMessage(message);
      } else if (voiceOnRef.current && !doneRef.current && !busyRef.current && typeof speechSynthesis !== 'undefined' && !speechSynthesis.speaking) {
        startListening();
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
    pendingFinalRef.current = '';
    lastSpeechAtRef.current = 0;
    ignoreNextEndRef.current = true;
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

  function sendVoiceDraft() {
    const message = draft.trim();
    if (!message || busy) return;
    ignoreNextEndRef.current = true;
    try { recRef.current?.abort(); } catch { /* noop */ }
    setListening(false);
    setDraft('');
    pendingFinalRef.current = '';
    submitMessage(message);
  }

  const started = turns.length > 0;

  return (
    <div className="min-h-screen bg-ink text-cream">
      <SteveShellHeader kicker="Steve · New BA Discovery" />
      <div className="mx-auto flex min-h-[calc(100vh-7.5rem)] max-w-2xl flex-col px-6 py-8">
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

        {!started || introOpen ? (
          <IntroPanel
            started={started}
            busy={busy}
            onStart={startConversation}
            onCollapse={() => setIntroOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIntroOpen(true)}
            className="mb-3 self-start font-mono text-[10px] uppercase tracking-[0.18em] text-cream-mute hover:text-gold"
          >
            Show discovery intro
          </button>
        )}

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
              disabled={!started || busy}
              title={voiceOn ? 'Turn voice off' : 'Talk to Steve'}
              className={
                voiceOn
                  ? 'rounded-lg border border-gold bg-gold/20 px-4 py-3 text-sm font-semibold text-gold'
                  : 'rounded-lg border border-cream/20 bg-black/30 px-4 py-3 text-sm text-cream-mute hover:border-gold hover:text-gold disabled:opacity-40'
              }
            >
              {listening ? 'Listening…' : voiceOn ? 'Voice on' : 'Voice'}
            </button>
          ) : null}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              !started
                ? "Press I'm ready to begin with Steve."
                : listening
                  ? 'Listening — just talk…'
                  : 'Type your answer…'
            }
            disabled={busy || !started}
            className="flex-1 rounded-lg border border-cream/20 bg-black/30 px-4 py-3 text-sm text-cream placeholder:text-cream-mute focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !started || !draft.trim()}
            className="rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40"
          >
            Send
          </button>
          {started && listening && draft.trim() ? (
            <button
              type="button"
              onClick={sendVoiceDraft}
              className="rounded-lg border border-gold bg-gold/20 px-4 py-3 text-sm font-semibold text-gold"
            >
              Done — send
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function IntroPanel({
  started,
  busy,
  onStart,
  onCollapse,
}: {
  started: boolean;
  busy: boolean;
  onStart: () => void | Promise<void>;
  onCollapse: () => void;
}) {
  return (
    <section className="mb-5 rounded-lg border border-gold/25 bg-[#111]/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <img
        src="/logos/logo_navbar.png"
        alt="Team Magnificent"
        className="mb-5 h-auto w-full max-w-[360px]"
      />
      <div className="space-y-3 text-sm leading-relaxed text-cream-mute">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          TEAM MAGNIFICENT · NEW MEMBER DISCOVERY
        </p>
        <p className="text-lg font-semibold text-cream">Before you build, we listen.</p>
        <p>
          Every member of Team Magnificent starts here — not with a pitch, not with a form, but
          with a conversation…
        </p>
        <p>
          Meet Steve. Steve is Team Magnificent's discovery interviewer — an AI, and we're upfront
          about that… He never scores you, never ranks you…
        </p>
        <p>
          What happens with your answers: they become your Success Profile… You already belong.
        </p>
        <p>Takes about ten minutes. Talk or type. Your conversation saves as you go.</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        {!started ? (
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            className="rounded-lg bg-gold px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40"
          >
            I'm ready — start my conversation
          </button>
        ) : (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-lg border border-cream/20 bg-black/30 px-5 py-3 text-sm text-cream-mute hover:border-gold hover:text-gold"
          >
            Hide intro
          </button>
        )}
      </div>
    </section>
  );
}

/* ─── Complete state — the Success Profile ─── */

function ProfileView({
  artifact,
  onReload,
}: {
  artifact: SteveDiscoveryArtifact;
  onReload: () => Promise<void>;
}) {
  const p = artifact.successProfile;
  return (
    <div className="min-h-screen bg-ink text-cream">
      <SteveShellHeader kicker="Steve · Success Profile" />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-10">
          <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-gold">
            Steve · Success Profile
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-cream">
            How we'll support you
          </h1>
          <p className="mt-2 text-sm text-cream-mute">
            This is what you shared, reflected back for you. Nothing here rates or
            ranks you. Sponsor sharing is off for private fields unless you turn on
            each field below.
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

        {artifact.transcript.length ? (
          <Section title="Your Transcript">
            <ol className="space-y-3">
              {artifact.transcript.map((turn) => (
                <li
                  key={`${turn.sequence}-${turn.speaker}`}
                  className="rounded-lg border border-cream/10 bg-black/20 p-3"
                >
                  <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-cream-mute">
                    {turn.speaker === 'ba' ? 'You' : 'Steve'} · turn {turn.sequence}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-cream">
                    {turn.text}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        <SteveCorrectionControls artifact={artifact} onReload={onReload} />
        <StevePrivacyControls tmagId={artifact.tmagId} />

        <p className="mt-10 text-[11px] font-mono uppercase tracking-[0.18em] text-cream-mute">
          {p.signedBy}
        </p>
      </div>
    </div>
  );
}

interface SteveCorrectionChoice {
  id: string;
  label: string;
  currentValue: string;
  kind: 'text' | 'list';
  target: SteveCorrectionTarget;
}

const CORRECTION_CONFIRMATION = 'I CONFIRM THIS STEVE CORRECTION';

function correctionChoices(
  artifact: SteveDiscoveryArtifact,
): SteveCorrectionChoice[] {
  const profile = artifact.successProfile;
  const choices: SteveCorrectionChoice[] = [];
  const addText = (
    id: string,
    label: string,
    currentValue: string,
    target: SteveCorrectionTarget,
  ) => {
    choices.push({ id, label, currentValue, kind: 'text', target });
  };
  const addList = (
    id: string,
    label: string,
    currentValue: string[],
    target: SteveCorrectionTarget,
  ) => {
    choices.push({
      id,
      label,
      currentValue: currentValue.join(', '),
      kind: 'list',
      target,
    });
  };

  for (const turn of artifact.transcript) {
    addText(
      `transcript-${turn.sequence}`,
      `Transcript · ${turn.speaker === 'ba' ? 'You' : 'Steve'} · turn ${turn.sequence}`,
      turn.text,
      { kind: 'transcript_text', sequence: turn.sequence },
    );
  }
  for (const answer of artifact.answers) {
    addText(
      `answer-${answer.questionId}`,
      `Answer · ${answer.prompt}`,
      answer.answerText,
      { kind: 'answer_text', questionId: answer.questionId },
    );
  }

  const profileText: Array<{
    id: string;
    label: string;
    value: string;
    path: Extract<SteveCorrectionTarget, { kind: 'profile_text' }>['path'];
  }> = [
    {
      id: 'primary-why',
      label: 'Success Profile · Primary why',
      value: profile.primaryWhy.statement,
      path: 'primaryWhy.statement',
    },
    {
      id: 'primary-who',
      label: "Success Profile · Who it's for",
      value: profile.primaryWhy.who,
      path: 'primaryWhy.who',
    },
    {
      id: 'primary-why-now',
      label: 'Success Profile · Why now',
      value: profile.primaryWhy.whyNow,
      path: 'primaryWhy.whyNow',
    },
    {
      id: 'success-vision',
      label: 'Success Profile · Success vision',
      value: profile.successVision.statement,
      path: 'successVision.statement',
    },
    {
      id: 'success-change',
      label: 'Success Profile · One big change',
      value: profile.successVision.oneBigChange,
      path: 'successVision.oneBigChange',
    },
    {
      id: 'learning-feedback',
      label: 'Success Profile · Feedback preference',
      value: profile.learningStyle.feedbackPreference,
      path: 'learningStyle.feedbackPreference',
    },
    {
      id: 'learning-notes',
      label: 'Success Profile · Learning notes',
      value: profile.learningStyle.notes,
      path: 'learningStyle.notes',
    },
    {
      id: 'communication-cadence',
      label: 'Success Profile · Contact cadence',
      value: profile.communicationPreferences.cadence ?? '',
      path: 'communicationPreferences.cadence',
    },
    {
      id: 'communication-best-times',
      label: 'Success Profile · Best contact times',
      value: profile.communicationPreferences.bestTimes,
      path: 'communicationPreferences.bestTimes',
    },
    {
      id: 'communication-notes',
      label: 'Success Profile · Communication notes',
      value: profile.communicationPreferences.notes,
      path: 'communicationPreferences.notes',
    },
    {
      id: 'support-help-style',
      label: 'Success Profile · Help style',
      value: profile.supportNeeds.helpStyle,
      path: 'supportNeeds.helpStyle',
    },
    {
      id: 'support-notes',
      label: 'Success Profile · Support notes',
      value: profile.supportNeeds.notes,
      path: 'supportNeeds.notes',
    },
    {
      id: 'michael-handoff',
      label: 'Success Profile · Michael handoff summary',
      value: profile.michaelHandoffSummary,
      path: 'michaelHandoffSummary',
    },
  ];
  for (const field of profileText) {
    addText(field.id, field.label, field.value, {
      kind: 'profile_text',
      path: field.path,
    });
  }

  addList(
    'learning-modalities',
    'Success Profile · Learning modalities',
    profile.learningStyle.modalities,
    { kind: 'profile_list', path: 'learningStyle.modalities' },
  );
  addList(
    'communication-channels',
    'Success Profile · Preferred contact channels',
    profile.communicationPreferences.preferredChannels,
    {
      kind: 'profile_list',
      path: 'communicationPreferences.preferredChannels',
    },
  );
  addList(
    'support-areas',
    'Success Profile · Support areas',
    profile.supportNeeds.areas,
    { kind: 'profile_list', path: 'supportNeeds.areas' },
  );
  addList(
    'support-obstacles',
    'Success Profile · Potential obstacles',
    profile.supportNeeds.potentialObstacles,
    { kind: 'profile_list', path: 'supportNeeds.potentialObstacles' },
  );

  profile.launchRecommendations.forEach((recommendation, index) => {
    addText(
      `launch-${index}`,
      `Success Profile · Launch recommendation ${index + 1}`,
      recommendation.text,
      { kind: 'recommendation_text', list: 'launch', index },
    );
  });
  profile.trainingRecommendations.forEach((recommendation, index) => {
    addText(
      `training-${index}`,
      `Success Profile · Training recommendation ${index + 1}`,
      recommendation.text,
      { kind: 'recommendation_text', list: 'training', index },
    );
  });

  return choices;
}

function SteveCorrectionControls({
  artifact,
  onReload,
}: {
  artifact: SteveDiscoveryArtifact;
  onReload: () => Promise<void>;
}) {
  const choices = correctionChoices(artifact);
  const [selectedId, setSelectedId] = useState(choices[0]?.id ?? '');
  const selected =
    choices.find((choice) => choice.id === selectedId) ?? choices[0] ?? null;
  const [replacement, setReplacement] = useState(
    selected?.currentValue ?? '',
  );
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selected) return;
    setReplacement(selected.currentValue);
  }, [selected?.id, selected?.currentValue]);

  const submitCorrection = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !confirmed) return;

    const normalizedReplacement =
      selected.kind === 'list'
        ? replacement
            .split(/[,\n]/)
            .map((item) => item.trim())
            .filter(Boolean)
        : replacement;
    if (
      selected.kind === 'text' &&
      normalizedReplacement === selected.currentValue
    ) {
      setError('Enter a replacement that differs from the current value.');
      return;
    }
    if (
      selected.kind === 'list' &&
      JSON.stringify(normalizedReplacement) ===
        JSON.stringify(
          selected.currentValue
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        )
    ) {
      setError('Enter a replacement that differs from the current list.');
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/steve/discovery/correction', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: selected.target,
          replacement: normalizedReplacement,
          expectedRevision: artifact.correctionRevision ?? 0,
          confirmation: CORRECTION_CONFIRMATION,
        }),
      });
      const data = (await res.json()) as SteveCorrectionResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Could not correct your private record.');
      }
      setConfirmed(false);
      setMessage('Your correction is saved. The previous private value was not retained.');
      await onReload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not correct your private record.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!selected) return null;

  return (
    <Section title="Correct Your Private Record">
      <p className="text-sm leading-relaxed text-cream-mute">
        Choose one current value and replace it after confirmation. The audit
        records only the field path and revision — never the old or new private
        text. Identity, timestamps, Steve&apos;s signature, provider details,
        and internal resource links cannot be edited here.
      </p>

      <form onSubmit={submitCorrection} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-cream">
            Value to correct
          </span>
          <select
            data-testid="steve-correction-target"
            value={selected.id}
            disabled={busy}
            onChange={(event) => {
              const next = choices.find(
                (choice) => choice.id === event.currentTarget.value,
              );
              setSelectedId(event.currentTarget.value);
              setReplacement(next?.currentValue ?? '');
              setConfirmed(false);
              setMessage('');
              setError('');
            }}
            className="w-full rounded-lg border border-cream/20 bg-ink px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none"
          >
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-cream">
            Replacement
          </span>
          <textarea
            data-testid="steve-correction-replacement"
            rows={selected.kind === 'list' ? 3 : 5}
            value={replacement}
            disabled={busy}
            onChange={(event) => setReplacement(event.currentTarget.value)}
            className="w-full rounded-lg border border-cream/20 bg-black/30 px-3 py-2 text-sm leading-relaxed text-cream focus:border-gold focus:outline-none"
          />
          {selected.kind === 'list' ? (
            <span className="mt-1 block text-xs text-cream-mute">
              Separate list items with commas or new lines.
            </span>
          ) : null}
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-gold/20 bg-gold/5 p-3">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
            className="mt-1 h-4 w-4 accent-[#C9A84C]"
          />
          <span className="text-xs leading-relaxed text-cream-mute">
            I confirm this replacement is the current private value I want
            saved. I understand the prior private value will not be retained.
          </span>
        </label>

        <button
          type="submit"
          disabled={busy || !confirmed}
          className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/15 disabled:opacity-50"
        >
          {busy ? 'Saving correction…' : 'Save confirmed correction'}
        </button>
      </form>

      {message ? <p className="text-sm text-teal">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </Section>
  );
}

const CONSENT_LABELS: Record<SteveSponsorConsentField, string> = {
  why_statement: 'Primary why',
  success_vision: 'Success vision',
  support_obstacles: 'Potential obstacles',
  michael_handoff_summary: 'Michael handoff summary',
};

const CONSENT_FIELDS = Object.keys(CONSENT_LABELS) as SteveSponsorConsentField[];
const WITHDRAW_CONFIRMATION = 'WITHDRAW STEVE PERSONALIZATION';

function StevePrivacyControls({ tmagId }: { tmagId: string }) {
  const [privacy, setPrivacy] = useState<StevePrivacyState | null>(null);
  const [currentSponsorTmagId, setCurrentSponsorTmagId] = useState<string | null>(null);
  const [grantCopy, setGrantCopy] = useState('');
  const [revocationCopy, setRevocationCopy] = useState('');
  const [busyField, setBusyField] = useState<SteveSponsorConsentField | null>(null);
  const [busyAction, setBusyAction] = useState<'export' | 'withdraw' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const applyPrivacyResponse = useCallback((data: StevePrivacyResponse) => {
    if (!data.ok || !data.privacy) {
      throw new Error(data.error ?? 'Could not load privacy controls.');
    }
    setPrivacy(data.privacy);
    setCurrentSponsorTmagId(data.currentSponsorTmagId ?? null);
    setGrantCopy(data.grantCopy ?? '');
    setRevocationCopy(data.revocationCopy ?? '');
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch('/api/steve/discovery/privacy', {
          credentials: 'include',
        });
        const data = (await res.json()) as StevePrivacyResponse;
        if (!live) return;
        applyPrivacyResponse(data);
      } catch (err) {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Could not load privacy controls.');
      }
    })();
    return () => {
      live = false;
    };
  }, [applyPrivacyResponse]);

  const updateConsent = async (
    field: SteveSponsorConsentField,
    granted: boolean,
  ) => {
    setBusyField(field);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/steve/discovery/privacy/consent', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, granted }),
      });
      const data = (await res.json()) as StevePrivacyResponse;
      applyPrivacyResponse(data);
      setMessage(granted ? `${CONSENT_LABELS[field]} shared.` : `${CONSENT_LABELS[field]} sharing stopped.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing.');
    } finally {
      setBusyField(null);
    }
  };

  const exportProfile = async () => {
    setBusyAction('export');
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/steve/discovery/export', {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Could not export your profile.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `steve-success-profile-${tmagId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage('Your private profile export is ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export your profile.');
    } finally {
      setBusyAction(null);
    }
  };

  const withdraw = async () => {
    const confirmed = window.confirm(
      'Turn off Steve personalization and all sponsor sharing? You will keep your self-visible copy. This action does not delete it.',
    );
    if (!confirmed) return;

    setBusyAction('withdraw');
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/steve/discovery/privacy/withdraw', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: WITHDRAW_CONFIRMATION }),
      });
      const data = (await res.json()) as StevePrivacyResponse;
      applyPrivacyResponse(data);
      setMessage('Personalization and sponsor sharing are now off.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not withdraw personalization.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Section title="Your Privacy Controls">
      <p className="text-sm leading-relaxed text-cream-mute">
        Your transcript, raw answers, full Success Profile, notes, audio, and
        provider details are never shared with your sponsor. The training-support
        card uses bounded guidance by default. You choose whether to share each
        private field below with your current direct sponsor.
      </p>

      {privacy ? (
        <>
          {privacy.status === 'withdrawn' ? (
            <div className="rounded-lg border border-teal/30 bg-teal/10 p-4 text-sm text-cream">
              Personalization and sponsor sharing are off. Your current profile
              remains visible to you.
            </div>
          ) : null}

          <div className="space-y-3">
            {CONSENT_FIELDS.map((field) => {
              const grant = privacy.sponsorConsent[field];
              const disabled =
                privacy.status === 'withdrawn' ||
                !currentSponsorTmagId ||
                busyField !== null ||
                busyAction !== null;
              return (
                <label
                  key={field}
                  className="flex items-start gap-3 rounded-lg border border-cream/10 bg-black/20 p-4"
                >
                  <input
                    type="checkbox"
                    checked={grant.granted}
                    disabled={disabled}
                    onChange={(event) => {
                      void updateConsent(field, event.currentTarget.checked);
                    }}
                    className="mt-1 h-4 w-4 accent-[#C9A84C]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-cream">
                      {CONSENT_LABELS[field]}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-cream-mute">
                      {grant.granted ? revocationCopy : grantCopy}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {!currentSponsorTmagId && privacy.status === 'active' ? (
            <p className="text-xs text-cream-mute">
              Sharing stays off because no current direct sponsor is recorded.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void exportProfile()}
              disabled={busyAction !== null}
              className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/15 disabled:opacity-50"
            >
              {busyAction === 'export' ? 'Preparing…' : 'Export my profile'}
            </button>
            {privacy.status === 'active' ? (
              <button
                type="button"
                onClick={() => void withdraw()}
                disabled={busyAction !== null || busyField !== null}
                className="rounded-lg border border-cream/20 bg-black/30 px-4 py-2 text-sm text-cream-mute hover:border-teal/50 hover:text-cream disabled:opacity-50"
              >
                {busyAction === 'withdraw' ? 'Withdrawing…' : 'Turn off personalization'}
              </button>
            ) : null}
          </div>
        </>
      ) : error ? null : (
        <p className="text-sm text-cream-mute">Loading privacy controls…</p>
      )}

      {message ? <p className="text-sm text-teal">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </Section>
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
