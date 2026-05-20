/**
 * /sponsor/interview-workbook/:baId
 *
 * Stage 3 of the three-stage onboarding spine (Chat #22, ported Chat #103):
 * the 30-45 min sponsor-led partnership conversation. The sponsor walks in
 * with the BA's questionnaire pre-loaded, runs the 20-question script,
 * captures notes inline, and lands on a partnership classification.
 *
 * Surfaces:
 *   - Top: BA identity strip + questionnaire context block (read-only)
 *   - Middle: 6 sections × 20 questions, each with prompt + listen-for +
 *             note textarea
 *   - Bottom: Classification panel (gogetter / consumer) + first actions +
 *             finalize button
 *
 * Autosave: 1s debounce after typing stops. Mongo-only via PUT /draft.
 * Finalize: irrevocable triple-stack write via POST /finalize. After
 *   finalize the surface renders read-only.
 *
 * Brand-locked: ink #0A0A0A, gold #C9A84C, teal #2DD4BF, cream #F5EFE6,
 * Bebas Neue + DM Sans + DM Mono.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ────────────────────────────────────────────────────────────────────────────
// Types (mirror the server's domain shape, narrowed for client use)
// ────────────────────────────────────────────────────────────────────────────

type NoteKey =
  | 'q1_biggest_win_followup'
  | 'q2_why_now_followup'
  | 'q3_income_goal_first_change'
  | 'q4_product_experience'
  | 'q5_best_friend_pitch'
  | 'q6_product_excitement_1_to_10'
  | 'q7_pushed_through_completion'
  | 'q8_falling_behind_response'
  | 'q9_hours_giving_up'
  | 'q10_uncomfortable_action_reaction'
  | 'q11_feedback_acceptance_speed'
  | 'q12_my_way_vs_their_way'
  | 'q13_biggest_fear'
  | 'q14_quitting_pattern'
  | 'q15_invest_500_reaction'
  | 'q16_90_days_no_money'
  | 'q17_dealbreaker_can_we_prevent'
  | 'q18_contract_agreement'
  | 'q19_accountability_acceptance'
  | 'q20_sell_me_on_you';

type Notes = Record<NoteKey, string>;
type Classification = 'gogetter' | 'consumer' | null;

interface Workbook {
  workbookId: string;
  forBaId: string;
  forThreeBaId: string;
  conductedByBaId: string;
  conductedByName: string;
  status: 'draft' | 'final';
  version: string;
  notes: Notes;
  classification: Classification;
  firstActions: string[];
  partnershipNotes: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

interface QuestionnaireSnapshot {
  questionnaireId: string;
  submittedAt: string;
  fullName: string;
  city: string;
  employmentStatus: string;
  biggestWin: string;
  whyNow: string;
  productStatus: string;
  incomeGoal: string;
  incomeImpact: string;
  last30Days: string;
  weeklyHours: string;
  availability: string;
  obstacleResponse: string;
  coachabilityTest: string;
  hardFeedback: string;
  nwmExperience: string;
  investmentReady: string;
  dealbreaker: string;
  whyYou: string;
}

interface BAIdentity {
  baId: string;
  threeBaId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: string;
}

type LoadState =
  | { kind: 'loading' }
  | {
      kind: 'loaded';
      ba: BAIdentity;
      workbook: Workbook;
      questionnaire: QuestionnaireSnapshot | null;
    }
  | { kind: 'err'; reason: string };

// ────────────────────────────────────────────────────────────────────────────
// The 20-question script. Each entry: section, question, listenFor, key,
// and an optional reference to a questionnaire field for inline context.
// Wording verbatim from the BA Interview Workbook (Chat #22 / Chat #103).
// ────────────────────────────────────────────────────────────────────────────

interface QuestionSpec {
  num: number;
  key: NoteKey;
  prompt: string;
  listenFor: string;
  // The questionnaire field whose value should appear inline as a prompt cue
  qContextField?: keyof QuestionnaireSnapshot;
}

interface SectionSpec {
  num: number;
  title: string;
  durationMinutes: number;
  questions: QuestionSpec[];
}

const SECTIONS: SectionSpec[] = [
  {
    num: 1,
    title: 'Opening & Connection',
    durationMinutes: 5,
    questions: [
      {
        num: 1,
        key: 'q1_biggest_win_followup',
        prompt: "Tell me about [their biggest win from questionnaire]. How did that feel?",
        listenFor:
          'Pride, details, execution capacity. Do they light up talking about achievement?',
        qContextField: 'biggestWin',
      },
      {
        num: 2,
        key: 'q2_why_now_followup',
        prompt:
          "You said you joined Team Magnificent because [their why now]. What finally pushed you to say yes?",
        listenFor: 'Urgency, pain point, real motivation vs vague dreams.',
        qContextField: 'whyNow',
      },
      {
        num: 3,
        key: 'q3_income_goal_first_change',
        prompt:
          "When you think about that [$X/month income goal], what's the FIRST thing that changes in your life?",
        listenFor:
          'Specific details. "Pay off car" is real. "Be happy" is vague.',
        qContextField: 'incomeGoal',
      },
    ],
  },
  {
    num: 2,
    title: 'Product Conviction',
    durationMinutes: 10,
    questions: [
      {
        num: 4,
        key: 'q4_product_experience',
        prompt:
          "You said you're [using / not using] GLP-THREE. Walk me through your experience so far.",
        listenFor:
          'Enthusiasm, belief, personal testimony. Users build empires. Opportunists build excuses.',
        qContextField: 'productStatus',
      },
      {
        num: 5,
        key: 'q5_best_friend_pitch',
        prompt:
          "If your best friend asked you RIGHT NOW, 'Should I try GLP-THREE?' \u2014 what would you say?",
        listenFor:
          'Conviction, clarity, storytelling ability. Can they sell without being taught?',
      },
      {
        num: 6,
        key: 'q6_product_excitement_1_to_10',
        prompt:
          "On a scale of 1\u201310, how excited are you about THIS PRODUCT specifically? Not the business \u2014 the product.",
        listenFor: 'Honesty. 7+ is good. Below 5 is a problem.',
      },
    ],
  },
  {
    num: 3,
    title: 'Execution & Follow-Through',
    durationMinutes: 10,
    questions: [
      {
        num: 7,
        key: 'q7_pushed_through_completion',
        prompt:
          "You mentioned finishing [project from last 30 days]. What made you push through to completion instead of quitting halfway?",
        listenFor:
          'Discipline, accountability, internal vs external motivation.',
        qContextField: 'last30Days',
      },
      {
        num: 8,
        key: 'q8_falling_behind_response',
        prompt:
          "When you get behind on a goal, what do you typically do? Give me a real example.",
        listenFor: 'Problem-solving, self-awareness, ownership vs excuses.',
      },
      {
        num: 9,
        key: 'q9_hours_giving_up',
        prompt:
          "You said you can commit [X hours/week]. Where are those hours coming from? What are you giving up?",
        listenFor:
          'Realism. "I\u2019ll find time" is fantasy. "I\u2019m cutting Netflix 7\u20139 PM" is real.',
        qContextField: 'weeklyHours',
      },
      {
        num: 10,
        key: 'q10_uncomfortable_action_reaction',
        prompt:
          "If I asked you to do something uncomfortable \u2014 like call 20 people this week \u2014 what's your honest reaction?",
        listenFor: 'Willingness, fear management, trust in your guidance.',
      },
    ],
  },
  {
    num: 4,
    title: 'Coachability & Partnership',
    durationMinutes: 10,
    questions: [
      {
        num: 11,
        key: 'q11_feedback_acceptance_speed',
        prompt:
          "Tell me more about that time you got feedback you didn't want to hear. How long did it take you to accept it?",
        listenFor: 'Ego management, growth mindset, speed of adaptation.',
        qContextField: 'hardFeedback',
      },
      {
        num: 12,
        key: 'q12_my_way_vs_their_way',
        prompt:
          "When I tell you to do something MY way and you think YOUR way is better \u2014 what's your move?",
        listenFor:
          'Trust, respect for experience, willingness to test and learn.',
        qContextField: 'coachabilityTest',
      },
      {
        num: 13,
        key: 'q13_biggest_fear',
        prompt:
          "What's your biggest fear about this business? The thing that keeps you up at night?",
        listenFor:
          'Honesty, vulnerability, what obstacles you need to help them overcome.',
      },
      {
        num: 14,
        key: 'q14_quitting_pattern',
        prompt: "Have you ever quit something you started? What made you walk away?",
        listenFor: 'Patterns, dealbreakers, red flags for future.',
      },
    ],
  },
  {
    num: 5,
    title: 'Financial Reality & Commitment',
    durationMinutes: 5,
    questions: [
      {
        num: 15,
        key: 'q15_invest_500_reaction',
        prompt:
          "You said you can invest [$200\u2013400] in [timeframe]. What if that number was $500? Does that change things?",
        listenFor: 'Financial capacity, skin in the game, reality vs hope.',
        qContextField: 'investmentReady',
      },
      {
        num: 16,
        key: 'q16_90_days_no_money',
        prompt:
          "If you're NOT making money in 90 days, what happens? Do you quit or do you double down?",
        listenFor:
          'Commitment level, patience, understanding this isn\u2019t lottery.',
      },
      {
        num: 17,
        key: 'q17_dealbreaker_can_we_prevent',
        prompt:
          "What would make you QUIT in the first 90 days? You said [their dealbreaker]. Can we prevent that?",
        listenFor:
          'Obstacles you can remove vs obstacles that are dealbreakers.',
        qContextField: 'dealbreaker',
      },
    ],
  },
  {
    num: 6,
    title: 'Establishing the Partnership',
    durationMinutes: 5,
    questions: [
      {
        num: 18,
        key: 'q18_contract_agreement',
        prompt:
          "Here's how I work: I tell you what to do, you do it, we build together. Does that work for you?",
        listenFor:
          'Agreement, clarity, no hesitation. This is the contract.',
      },
      {
        num: 19,
        key: 'q19_accountability_acceptance',
        prompt:
          "This questionnaire? These are your words. I'm going to hold you to them. When you said [reference commitment], I'm going to remind you of that when things get hard. Fair?",
        listenFor: 'Accountability acceptance, understanding the contract.',
      },
      {
        num: 20,
        key: 'q20_sell_me_on_you',
        prompt:
          "Last question: Why should I invest MY time and energy into YOUR success? Sell me on you.",
        listenFor: 'Confidence, self-awareness, hunger, worthiness.',
        qContextField: 'whyYou',
      },
    ],
  },
];

const EMPTY_NOTES: Notes = SECTIONS.flatMap((s) => s.questions).reduce(
  (acc, q) => ({ ...acc, [q.key]: '' }),
  {} as Notes,
);

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────

export function SponsorWorkbookPage() {
  const { baId } = useParams<{ baId: string }>();
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [notes, setNotes] = useState<Notes>(EMPTY_NOTES);
  const [classification, setClassification] = useState<Classification>(null);
  const [firstActions, setFirstActions] = useState<string[]>(['', '', '']);
  const [partnershipNotes, setPartnershipNotes] = useState('');
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'err'>(
    'idle',
  );
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeErr, setFinalizeErr] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReadOnly = load.kind === 'loaded' && load.workbook.status === 'final';

  // Initial load
  useEffect(() => {
    if (!baId) {
      setLoad({ kind: 'err', reason: 'No baId in URL.' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sponsor/workbook/${encodeURIComponent(baId)}`, {
          credentials: 'include',
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setLoad({ kind: 'err', reason: body.error ?? 'Could not load workbook.' });
          return;
        }
        setLoad({
          kind: 'loaded',
          ba: body.ba,
          workbook: body.workbook,
          questionnaire: body.questionnaire ?? null,
        });
        setNotes({ ...EMPTY_NOTES, ...(body.workbook.notes ?? {}) });
        setClassification(body.workbook.classification ?? null);
        const fa = Array.isArray(body.workbook.firstActions)
          ? body.workbook.firstActions
          : [];
        // Pad to 3 slots for gogetter typing UX; consumer uses just the first.
        setFirstActions([fa[0] ?? '', fa[1] ?? '', fa[2] ?? '']);
        setPartnershipNotes(body.workbook.partnershipNotes ?? '');
      } catch {
        if (!cancelled) setLoad({ kind: 'err', reason: 'Could not reach server.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baId]);

  // Debounced autosave (drafts only, never finals)
  function scheduleSave(payload: {
    notes?: Partial<Notes>;
    classification?: Classification;
    firstActions?: string[];
    partnershipNotes?: string;
  }) {
    if (isReadOnly || !baId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setAutosave('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/sponsor/workbook/${encodeURIComponent(baId)}/draft`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          },
        );
        const body = await res.json();
        if (!res.ok || !body.ok) {
          setAutosave('err');
          return;
        }
        setAutosave('saved');
        setTimeout(() => setAutosave('idle'), 1500);
      } catch {
        setAutosave('err');
      }
    }, 1000);
  }

  function updateNote(key: NoteKey, value: string) {
    if (isReadOnly) return;
    setNotes((n) => {
      const next = { ...n, [key]: value };
      scheduleSave({ notes: { [key]: value } });
      return next;
    });
  }

  function chooseClassification(c: Classification) {
    if (isReadOnly) return;
    setClassification(c);
    scheduleSave({ classification: c });
  }

  function updateFirstAction(idx: number, value: string) {
    if (isReadOnly) return;
    const next = [...firstActions];
    next[idx] = value;
    setFirstActions(next);
    scheduleSave({
      firstActions: next.map((s) => s.trim()).filter((s) => s.length > 0),
    });
  }

  function updatePartnershipNotes(value: string) {
    if (isReadOnly) return;
    setPartnershipNotes(value);
    scheduleSave({ partnershipNotes: value });
  }

  async function handleFinalize() {
    if (!baId || finalizing) return;
    if (!classification) {
      setFinalizeErr('Pick gogetter or consumer before finalizing.');
      return;
    }
    const cleanedActions = firstActions
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const minActions = classification === 'gogetter' ? 3 : 1;
    if (cleanedActions.length < minActions) {
      setFinalizeErr(
        `${classification === 'gogetter' ? 'Gogetter' : 'Consumer'} classification requires at least ${minActions} first action${
          minActions === 1 ? '' : 's'
        }.`,
      );
      return;
    }
    setFinalizing(true);
    setFinalizeErr(null);
    try {
      const res = await fetch(
        `/api/sponsor/workbook/${encodeURIComponent(baId)}/finalize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            classification,
            firstActions: cleanedActions,
            partnershipNotes,
            notes,
          }),
        },
      );
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setFinalizeErr(body.error ?? 'Finalize failed.');
        setFinalizing(false);
        return;
      }
      // Re-render in read-only mode.
      if (load.kind === 'loaded') {
        setLoad({
          ...load,
          workbook: body.workbook,
        });
      }
      setFinalizing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setFinalizeErr('Could not reach server.');
      setFinalizing(false);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────────
  if (load.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-cream-mute font-mono text-sm">
        Loading workbook…
      </div>
    );
  }
  if (load.kind === 'err') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-red-400 font-mono text-sm px-6 text-center gap-4">
        <p>{load.reason}</p>
        <Button onClick={() => navigate('/cockpit')}>Back to cockpit</Button>
      </div>
    );
  }

  const { ba, workbook, questionnaire } = load;

  return (
    <div className="min-h-screen bg-ink text-cream">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <TopStrip
          ba={ba}
          workbook={workbook}
          autosave={autosave}
          isReadOnly={isReadOnly}
          onBack={() => navigate('/cockpit')}
        />

        {isReadOnly && <FinalizedBanner workbook={workbook} />}

        {!isReadOnly && <InstructionsCard />}

        {questionnaire ? (
          <QuestionnaireContext q={questionnaire} />
        ) : (
          <MissingQuestionnaireWarning />
        )}

        <div className="space-y-8 mt-10">
          {SECTIONS.map((section) => (
            <SectionBlock
              key={section.num}
              section={section}
              notes={notes}
              questionnaire={questionnaire}
              isReadOnly={isReadOnly}
              onChange={updateNote}
            />
          ))}
        </div>

        <ClassificationPanel
          classification={classification}
          firstActions={firstActions}
          partnershipNotes={partnershipNotes}
          isReadOnly={isReadOnly}
          finalizing={finalizing}
          finalizeErr={finalizeErr}
          onChooseClass={chooseClassification}
          onChangeAction={updateFirstAction}
          onChangePartnershipNotes={updatePartnershipNotes}
          onFinalize={handleFinalize}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function TopStrip({
  ba,
  workbook,
  autosave,
  isReadOnly,
  onBack,
}: {
  ba: BAIdentity;
  workbook: Workbook;
  autosave: 'idle' | 'saving' | 'saved' | 'err';
  isReadOnly: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex items-start justify-between pb-6 mb-6 border-b border-gold/30">
      <div>
        <p className="font-mono tracking-[0.22em] text-[10px] text-gold uppercase">
          Sponsor Workbook · v{workbook.version}
        </p>
        <h1 className="font-display tracking-[0.06em] text-[clamp(28px,4vw,42px)] text-cream mt-2 leading-tight">
          Interview with {ba.firstName} {ba.lastName}
        </h1>
        <p className="font-mono text-[12px] text-cream-mute mt-2">
          BA {ba.baId} · THREE {ba.threeBaId} · {ba.email}
        </p>
      </div>
      <div className="text-right space-y-2">
        <button
          onClick={onBack}
          className="font-mono tracking-[0.18em] text-[11px] text-cream-mute hover:text-gold transition uppercase"
        >
          ← cockpit
        </button>
        {!isReadOnly && (
          <AutosaveBadge state={autosave} />
        )}
        {isReadOnly && (
          <p className="font-mono tracking-[0.18em] text-[11px] text-teal uppercase">
            Finalized
          </p>
        )}
      </div>
    </div>
  );
}

function AutosaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'err' }) {
  const map = {
    idle: { text: 'Ready', color: 'text-cream-faint' },
    saving: { text: 'Saving\u2026', color: 'text-gold' },
    saved: { text: 'Saved', color: 'text-teal' },
    err: { text: 'Save failed', color: 'text-red-400' },
  } as const;
  const m = map[state];
  return (
    <p className={`font-mono tracking-[0.18em] text-[11px] uppercase ${m.color}`}>
      {m.text}
    </p>
  );
}

function InstructionsCard() {
  return (
    <div className="bg-teal/[0.06] border-l-4 border-teal rounded-md px-5 py-4 text-[14px] leading-[1.7] text-cream-mute">
      <p>
        <strong className="text-teal">30\u201345 minutes. Uninterrupted.</strong>{' '}
        Reference their questionnaire answers as cues. Listen 80%, talk 20%.
        Take notes inline \u2014 every field autosaves. At the end, classify them as
        Gogetter or Consumer and finalize. <strong className="text-cream">Finalize is irrevocable.</strong>
      </p>
    </div>
  );
}

function FinalizedBanner({ workbook }: { workbook: Workbook }) {
  const when = workbook.finalizedAt
    ? new Date(workbook.finalizedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';
  return (
    <div className="bg-teal/[0.08] border-2 border-teal/40 rounded-lg px-5 py-4 mb-8">
      <p className="font-display tracking-[0.18em] text-[14px] text-teal uppercase">
        Workbook Finalized
      </p>
      <p className="text-[14px] text-cream-mute mt-2">
        Conducted by {workbook.conductedByName} on {when}. Classification:{' '}
        <strong className="text-cream font-display tracking-wide">
          {(workbook.classification ?? 'unclassified').toUpperCase()}
        </strong>
        . This record is read-only.
      </p>
    </div>
  );
}

function MissingQuestionnaireWarning() {
  return (
    <div className="bg-red-500/[0.06] border-l-4 border-red-500/60 rounded-md px-5 py-4 mt-6 text-[14px] leading-[1.7] text-cream-mute">
      <p>
        <strong className="text-red-400">No questionnaire on file yet.</strong>{' '}
        The BA hasn\u2019t submitted their interview questionnaire. You can
        still run this conversation, but the script will be missing context
        cues. Consider waiting until the BA submits before proceeding.
      </p>
    </div>
  );
}

function QuestionnaireContext({ q }: { q: QuestionnaireSnapshot }) {
  const when = new Date(q.submittedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <details
      className="bg-gold/[0.04] border border-gold/20 rounded-xl px-5 py-4 mt-6 group"
      open
    >
      <summary className="cursor-pointer list-none flex items-center justify-between">
        <span className="font-display tracking-[0.1em] text-[18px] text-gold">
          QUESTIONNAIRE CONTEXT
        </span>
        <span className="font-mono text-[11px] text-cream-faint tracking-[0.18em] uppercase">
          Submitted {when}
        </span>
      </summary>
      <div className="mt-4 grid md:grid-cols-2 gap-4 text-[14px] leading-[1.7] text-cream-mute">
        <ContextField label="Biggest win" value={q.biggestWin} />
        <ContextField label="Why now" value={q.whyNow} />
        <ContextField label="Income goal" value={q.incomeGoal} />
        <ContextField label="What that income changes" value={q.incomeImpact} />
        <ContextField label="Last 30 days finished" value={q.last30Days} />
        <ContextField
          label="Hours / week"
          value={q.weeklyHours + ' \u00b7 ' + q.availability}
        />
        <ContextField label="Obstacle response" value={q.obstacleResponse} />
        <ContextField label="Coachability default" value={q.coachabilityTest} />
        <ContextField label="Hard feedback story" value={q.hardFeedback} />
        <ContextField label="NWM experience" value={q.nwmExperience} />
        <ContextField
          label="Investment ready"
          value={q.investmentReady}
        />
        <ContextField label="Dealbreaker" value={q.dealbreaker} />
        <ContextField label="Why invest in them" value={q.whyYou} />
      </div>
    </details>
  );
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono tracking-[0.12em] text-[10px] uppercase text-gold mb-1">
        {label}
      </p>
      <p className="text-cream text-[14px]">{value || '\u2014'}</p>
    </div>
  );
}

function SectionBlock({
  section,
  notes,
  questionnaire,
  isReadOnly,
  onChange,
}: {
  section: SectionSpec;
  notes: Notes;
  questionnaire: QuestionnaireSnapshot | null;
  isReadOnly: boolean;
  onChange: (k: NoteKey, v: string) => void;
}) {
  return (
    <div className="bg-gold/[0.03] border-2 border-gold/20 rounded-xl p-6 md:p-7">
      <div className="flex items-baseline justify-between border-b border-teal/30 pb-3 mb-5">
        <h2 className="font-display tracking-[0.06em] text-[clamp(20px,2.4vw,26px)] text-gold">
          SECTION {section.num} · {section.title.toUpperCase()}
        </h2>
        <span className="font-mono text-[11px] tracking-[0.16em] text-cream-faint uppercase">
          ~{section.durationMinutes} min
        </span>
      </div>
      <div className="space-y-7">
        {section.questions.map((q) => (
          <QuestionBlock
            key={q.key}
            q={q}
            value={notes[q.key] ?? ''}
            contextValue={
              q.qContextField && questionnaire
                ? questionnaire[q.qContextField]
                : undefined
            }
            isReadOnly={isReadOnly}
            onChange={(v) => onChange(q.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionBlock({
  q,
  value,
  contextValue,
  isReadOnly,
  onChange,
}: {
  q: QuestionSpec;
  value: string;
  contextValue?: string;
  isReadOnly: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[28px] text-gold leading-none">
          {q.num}
        </span>
        <p className="text-cream text-[15px] leading-[1.6] flex-1">
          {q.prompt}
        </p>
      </div>
      {contextValue && (
        <div className="ml-11 pl-3 border-l-2 border-teal/40">
          <p className="font-mono tracking-[0.12em] text-[10px] uppercase text-teal mb-0.5">
            From questionnaire
          </p>
          <p className="text-[13px] text-cream-mute italic">{contextValue}</p>
        </div>
      )}
      <p className="ml-11 text-[12px] italic text-cream-mute/80">
        Listen for: {q.listenFor}
      </p>
      <div className="ml-11 pt-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={isReadOnly}
          placeholder={isReadOnly ? '(no notes captured)' : 'Notes\u2026'}
          rows={3}
          className={
            'w-full bg-ink/60 border-2 rounded-md px-3 py-2.5 text-cream text-[14px] leading-[1.55] resize-y min-h-[80px] focus:outline-none transition ' +
            (isReadOnly
              ? 'border-cream/10 cursor-default'
              : 'border-gold/30 focus:border-teal focus:shadow-[0_0_12px_rgba(45,212,191,0.25)]')
          }
        />
      </div>
    </div>
  );
}

function ClassificationPanel({
  classification,
  firstActions,
  partnershipNotes,
  isReadOnly,
  finalizing,
  finalizeErr,
  onChooseClass,
  onChangeAction,
  onChangePartnershipNotes,
  onFinalize,
}: {
  classification: Classification;
  firstActions: string[];
  partnershipNotes: string;
  isReadOnly: boolean;
  finalizing: boolean;
  finalizeErr: string | null;
  onChooseClass: (c: Classification) => void;
  onChangeAction: (idx: number, v: string) => void;
  onChangePartnershipNotes: (v: string) => void;
  onFinalize: () => void;
}) {
  const minSlots = classification === 'gogetter' ? 3 : 1;
  return (
    <div className="mt-12 bg-teal/[0.05] border-2 border-teal/30 rounded-xl p-6 md:p-8">
      <h2 className="font-display tracking-[0.08em] text-[clamp(22px,2.8vw,30px)] text-teal pb-4 border-b border-teal/30">
        PARTNERSHIP DECISION
      </h2>

      {/* Classification picker */}
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <ClassCard
          kind="gogetter"
          active={classification === 'gogetter'}
          isReadOnly={isReadOnly}
          onClick={() => onChooseClass('gogetter')}
        />
        <ClassCard
          kind="consumer"
          active={classification === 'consumer'}
          isReadOnly={isReadOnly}
          onClick={() => onChooseClass('consumer')}
        />
      </div>

      {/* First actions */}
      <div className="mt-8">
        <Label>
          First actions {classification === 'gogetter' ? '(3 required)' : '(at least 1)'}
        </Label>
        <div className="space-y-2 mt-2">
          {firstActions.slice(0, Math.max(minSlots, 3)).map((val, idx) => (
            <Input
              key={idx}
              value={val}
              onChange={(e) => onChangeAction(idx, e.target.value)}
              readOnly={isReadOnly}
              placeholder={
                idx === 0
                  ? 'e.g. Warm market list by Friday'
                  : idx === 1
                    ? 'e.g. Watch 10 Steps training'
                    : 'e.g. Schedule 5 invitation conversations'
              }
            />
          ))}
        </div>
      </div>

      {/* Partnership notes */}
      <div className="mt-6">
        <Label htmlFor="partnershipNotes">Overall partnership notes</Label>
        <textarea
          id="partnershipNotes"
          value={partnershipNotes}
          onChange={(e) => onChangePartnershipNotes(e.target.value)}
          readOnly={isReadOnly}
          rows={4}
          placeholder={
            isReadOnly
              ? '(no notes captured)'
              : 'Anything you want to remember about this conversation\u2026'
          }
          className={
            'w-full mt-2 bg-ink/60 border-2 rounded-md px-3.5 py-3 text-cream text-[15px] leading-[1.6] resize-y min-h-[100px] focus:outline-none transition ' +
            (isReadOnly
              ? 'border-cream/10 cursor-default'
              : 'border-teal/40 focus:border-teal focus:shadow-[0_0_15px_rgba(45,212,191,0.3)]')
          }
        />
      </div>

      {/* Finalize */}
      {!isReadOnly && (
        <div className="mt-8 pt-6 border-t border-teal/30 text-center">
          {finalizeErr && (
            <p className="mb-4 text-[12px] font-mono tracking-[0.04em] text-red-400">
              {finalizeErr}
            </p>
          )}
          <p className="text-[12px] font-mono tracking-[0.18em] text-cream-faint uppercase mb-4">
            Finalize is irrevocable
          </p>
          <Button
            onClick={onFinalize}
            disabled={finalizing || !classification}
            className="min-w-[280px] h-12 text-[15px] tracking-wide"
          >
            {finalizing ? 'Finalizing\u2026' : 'FINALIZE WORKBOOK'}
          </Button>
        </div>
      )}
    </div>
  );
}

function ClassCard({
  kind,
  active,
  isReadOnly,
  onClick,
}: {
  kind: 'gogetter' | 'consumer';
  active: boolean;
  isReadOnly: boolean;
  onClick: () => void;
}) {
  const isGo = kind === 'gogetter';
  const title = isGo ? 'GOGETTER' : 'CONSUMER';
  const subtitle = isGo ? 'Deep Investment' : 'System Only';
  const bullets = isGo
    ? [
        'Product conviction: HIGH',
        'Execution capacity: PROVEN',
        'Coachability: EXCELLENT',
        'Financial reality: READY',
        'Availability: COMMITTED',
      ]
    : [
        'Product conviction: LOW or opportunist',
        'Execution capacity: UNPROVEN or excuse-heavy',
        'Coachability: RESISTANT or know-it-all',
        'Financial reality: SHAKY',
        'Availability: BOUNDARY-HEAVY',
      ];
  const commitment = isGo
    ? 'Your commitment: weekly calls, personal coaching, build WITH them.'
    : 'Your commitment: system / resources / training only. Not personal time.';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isReadOnly}
      className={
        'text-left rounded-xl border-2 p-5 transition-all duration-200 ' +
        (active
          ? 'border-teal bg-teal/10 shadow-[0_0_25px_rgba(45,212,191,0.25)]'
          : 'border-gold/20 bg-ink/40 ' +
            (isReadOnly
              ? 'cursor-default opacity-60'
              : 'hover:border-teal/60 hover:bg-teal/[0.05]'))
      }
    >
      <p className="font-mono tracking-[0.2em] text-[11px] text-gold uppercase mb-2">
        {subtitle}
      </p>
      <p
        className={
          'font-display tracking-[0.08em] text-[28px] leading-none ' +
          (active ? 'text-teal' : 'text-cream')
        }
      >
        {title}
      </p>
      <ul className="mt-4 space-y-1 text-[12px] text-cream-mute">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-gold">·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12px] italic text-cream-mute leading-[1.5]">
        {commitment}
      </p>
    </button>
  );
}
