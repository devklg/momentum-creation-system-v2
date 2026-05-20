/**
 * /onboarding/questionnaire — BA Interview Questionnaire.
 *
 * Stage 2 of the three-stage onboarding spine (recovered Chat #22, ported Chat #103):
 *   1. Michael voice call  (T+1-4h)   — outbound, 3 discovery questions
 *   2. THIS surface         (T+0-48h)  — 19 self-serve questions
 *   3. Sponsor workbook     (T+24-72h) — 20-question partnership call
 *
 * Locked Chat #22: Mandatory within 48 hours post-enrollment. Completion
 * unlocks the sponsor workbook surface. Refusal = no Team Magnificent
 * mentorship investment from the sponsor.
 *
 * Brand-locked: ink #0A0A0A, gold #C9A84C, gold-bright #F5C030, teal
 * #2DD4BF, cream #F5EFE6. Bebas Neue + DM Sans + DM Mono.
 *
 * On mount: POST /api/onboarding/questionnaire/load (audit marker) +
 *   GET /api/onboarding/questionnaire/status ("already submitted?").
 * On submit: POST /api/onboarding/questionnaire/submit (triple-stack write).
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type StatusState =
  | { kind: 'loading' }
  | { kind: 'not_submitted' }
  | { kind: 'submitted'; submittedAt: string }
  | { kind: 'err'; reason: string };

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'submitted' }
  | { kind: 'err'; reason: string };

interface FormShape {
  // Basic identity
  fullName: string;
  email: string;
  phone: string;
  city: string;
  sponsor: string;
  // Section 1 — About You
  employmentStatus: '' | 'full_time' | 'part_time' | 'self_employed' | 'retired';
  biggestWin: string;
  whyNow: string;
  // Section 2 — Product & Goals
  productStatus:
    | ''
    | 'using_seeing_results'
    | 'using_just_started'
    | 'not_yet'
    | 'just_want_business';
  incomeGoal: string;
  incomeImpact: string;
  // Section 3 — Execution & Commitment
  last30Days: string;
  weeklyHours: '' | '5-10' | '10-20' | '20-30' | '30+';
  availability: '' | 'yes_always' | 'yes_usually' | 'depends' | 'no';
  obstacleResponse: string;
  // Section 4 — Coachability
  coachabilityTest:
    | ''
    | 'their_way_first'
    | 'discuss_together'
    | 'my_way'
    | 'test_both';
  hardFeedback: string;
  nwmExperience: '' | 'never' | 'tried_briefly' | 'some_success' | 'significant_success';
  // Section 5 — Financial Readiness
  investmentReady: '' | 'yes_today' | 'yes_7_days' | 'need_2_weeks' | 'need_to_earn';
  dealbreaker: string;
  whyYou: string;
}

const EMPTY_FORM: FormShape = {
  fullName: '',
  email: '',
  phone: '',
  city: '',
  sponsor: '',
  employmentStatus: '',
  biggestWin: '',
  whyNow: '',
  productStatus: '',
  incomeGoal: '',
  incomeImpact: '',
  last30Days: '',
  weeklyHours: '',
  availability: '',
  obstacleResponse: '',
  coachabilityTest: '',
  hardFeedback: '',
  nwmExperience: '',
  investmentReady: '',
  dealbreaker: '',
  whyYou: '',
};

export function QuestionnairePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusState>({ kind: 'loading' });
  const [form, setForm] = useState<FormShape>(EMPTY_FORM);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });

  // On mount: log surface displayed + check if already submitted.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch('/api/onboarding/questionnaire/load', {
          method: 'POST',
          credentials: 'include',
        });
        const res = await fetch('/api/onboarding/questionnaire/status', {
          credentials: 'include',
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setStatus({ kind: 'err', reason: body.error ?? 'Could not load.' });
          return;
        }
        if (body.submitted) {
          setStatus({ kind: 'submitted', submittedAt: body.submittedAt });
        } else {
          setStatus({ kind: 'not_submitted' });
        }
      } catch {
        if (!cancelled) setStatus({ kind: 'err', reason: 'Could not reach server.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof FormShape>(field: K, value: FormShape[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function allFilled(): boolean {
    return (Object.keys(EMPTY_FORM) as Array<keyof FormShape>).every(
      (k) => form[k] !== '',
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allFilled() || submitState.kind === 'submitting') return;
    setSubmitState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/onboarding/questionnaire/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setSubmitState({
          kind: 'err',
          reason: body.error ?? 'Submission failed. Try again.',
        });
        return;
      }
      setSubmitState({ kind: 'submitted' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitState({ kind: 'err', reason: 'Could not reach server.' });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────────
  if (status.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-cream-mute font-mono text-sm">
        Loading…
      </div>
    );
  }

  if (status.kind === 'err') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-red-400 font-mono text-sm px-6 text-center">
        {status.reason}
      </div>
    );
  }

  if (status.kind === 'submitted' || submitState.kind === 'submitted') {
    return (
      <div className="min-h-screen bg-ink text-cream relative overflow-hidden">
        <SuccessScreen
          submittedAt={
            status.kind === 'submitted' ? status.submittedAt : new Date().toISOString()
          }
          onContinue={() => navigate('/cockpit')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-cream">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Header />
        <IntroBlock />

        <form onSubmit={handleSubmit} className="space-y-6 mt-8">
          {/* BASIC INFORMATION */}
          <FormSection title="Basic Information">
            <FormGroup>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                autoComplete="name"
              />
            </FormGroup>
            <FormGroup>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                autoComplete="email"
              />
            </FormGroup>
            <FormGroup>
              <Label htmlFor="phone">Mobile phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="tel"
              />
              <Helper>We use SMS for urgent team updates</Helper>
            </FormGroup>
            <FormGroup>
              <Label htmlFor="city">City / State *</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Los Angeles, CA"
              />
            </FormGroup>
            <FormGroup>
              <Label htmlFor="sponsor">Who Invited You? (Sponsor Name) *</Label>
              <Input
                id="sponsor"
                value={form.sponsor}
                onChange={(e) => update('sponsor', e.target.value)}
              />
            </FormGroup>
          </FormSection>

          {/* ABOUT YOU */}
          <FormSection title="About You">
            <RadioField
              label="Current employment status: *"
              name="employmentStatus"
              value={form.employmentStatus}
              onChange={(v) => update('employmentStatus', v as FormShape['employmentStatus'])}
              options={[
                ['full_time', 'Full-time employed'],
                ['part_time', 'Part-time employed'],
                ['self_employed', 'Self-employed / Business owner'],
                ['retired', 'Retired'],
              ]}
            />
            <TextareaField
              label="What's your biggest WIN in the last 3 years? *"
              id="biggestWin"
              value={form.biggestWin}
              onChange={(v) => update('biggestWin', v)}
              placeholder="Business, personal, health, relationship — what are you most proud of?"
            />
            <TextareaField
              label="Why did you join Team Magnificent RIGHT NOW? *"
              id="whyNow"
              value={form.whyNow}
              onChange={(v) => update('whyNow', v)}
              placeholder="What changed? What made you say yes?"
            />
          </FormSection>

          {/* PRODUCT & GOALS */}
          <FormSection title="Product & Goals">
            <RadioField
              label="Are you using GLP-THREE? *"
              name="productStatus"
              value={form.productStatus}
              onChange={(v) => update('productStatus', v as FormShape['productStatus'])}
              options={[
                ['using_seeing_results', 'Yes — using it and seeing results'],
                ['using_just_started', 'Yes — just started'],
                ['not_yet', 'Not yet — starting soon'],
                ['just_want_business', 'No — only interested in business'],
              ]}
            />
            <FormGroup>
              <Label htmlFor="incomeGoal">
                What monthly income would be LIFE-CHANGING for you? *
              </Label>
              <Input
                id="incomeGoal"
                value={form.incomeGoal}
                onChange={(e) => update('incomeGoal', e.target.value)}
                placeholder="$500, $2,000, $5,000, $10,000…"
              />
            </FormGroup>
            <TextareaField
              label="If you hit that income goal, what ACTUALLY changes in your life? *"
              id="incomeImpact"
              value={form.incomeImpact}
              onChange={(v) => update('incomeImpact', v)}
              placeholder="Be specific: bills paid, debt gone, quit second job, save for kids' college…"
            />
          </FormSection>

          {/* EXECUTION & COMMITMENT */}
          <FormSection title="Execution & Commitment">
            <TextareaField
              label="Last 30 days: Something you STARTED and FINISHED? *"
              id="last30Days"
              value={form.last30Days}
              onChange={(v) => update('last30Days', v)}
              placeholder="A project, goal, commitment — show you can finish what you start."
            />
            <RadioField
              label="How many hours per week can you commit? *"
              name="weeklyHours"
              value={form.weeklyHours}
              onChange={(v) => update('weeklyHours', v as FormShape['weeklyHours'])}
              options={[
                ['5-10', '5–10 hours'],
                ['10-20', '10–20 hours'],
                ['20-30', '20–30 hours'],
                ['30+', '30+ hours'],
              ]}
            />
            <RadioField
              label="Your sponsor calls at 6 AM Saturday with an opportunity. Do you answer? *"
              name="availability"
              value={form.availability}
              onChange={(v) => update('availability', v as FormShape['availability'])}
              options={[
                ['yes_always', 'Yes — success doesn’t sleep'],
                ['yes_usually', 'Yes, unless there’s an emergency'],
                ['depends', 'Depends on the day'],
                ['no', 'No — I need boundaries'],
              ]}
            />
            <TextareaField
              label="Task: 'Contact 20 people this week.' Wednesday: You've only done 3. What do you do? *"
              id="obstacleResponse"
              value={form.obstacleResponse}
              onChange={(v) => update('obstacleResponse', v)}
              placeholder="Be specific. What's your move?"
            />
          </FormSection>

          {/* COACHABILITY */}
          <FormSection title="Coachability">
            <RadioField
              label="Your sponsor says 'Do it my way.' You think YOUR way is better. What do you do? *"
              name="coachabilityTest"
              value={form.coachabilityTest}
              onChange={(v) => update('coachabilityTest', v as FormShape['coachabilityTest'])}
              options={[
                ['their_way_first', 'Do it their way first, discuss after'],
                ['discuss_together', 'Discuss and decide together'],
                ['my_way', 'Do it my way — I know what works'],
                ['test_both', 'Test both and use data'],
              ]}
            />
            <TextareaField
              label="Tell me about a time you got feedback you DIDN'T want to hear. What happened? *"
              id="hardFeedback"
              value={form.hardFeedback}
              onChange={(v) => update('hardFeedback', v)}
              placeholder="The situation, the feedback, what you did."
            />
            <RadioField
              label="Have you done network marketing before? *"
              name="nwmExperience"
              value={form.nwmExperience}
              onChange={(v) => update('nwmExperience', v as FormShape['nwmExperience'])}
              options={[
                ['never', 'No, this is my first time'],
                ['tried_briefly', 'Yes, tried it briefly'],
                ['some_success', 'Yes, had some success'],
                ['significant_success', 'Yes, earned significant income'],
              ]}
            />
          </FormSection>

          {/* FINANCIAL READINESS */}
          <FormSection title="Financial Readiness">
            <RadioField
              label="Can you invest $200–$400 in product in the next 7 days? *"
              name="investmentReady"
              value={form.investmentReady}
              onChange={(v) => update('investmentReady', v as FormShape['investmentReady'])}
              options={[
                ['yes_today', 'Yes — today'],
                ['yes_7_days', 'Yes — within 7 days'],
                ['need_2_weeks', 'Need 2 weeks'],
                ['need_to_earn', 'Need to earn first'],
              ]}
            />
            <TextareaField
              label="What would make you QUIT in the first 90 days? *"
              id="dealbreaker"
              value={form.dealbreaker}
              onChange={(v) => update('dealbreaker', v)}
              placeholder="Be honest. What would be a dealbreaker?"
            />
            <TextareaField
              label="Why should YOUR SPONSOR invest time and energy into YOU? *"
              id="whyYou"
              value={form.whyYou}
              onChange={(v) => update('whyYou', v)}
              placeholder="Make your case. What makes you worth the investment?"
            />
          </FormSection>

          {/* SUBMIT */}
          <div className="pt-6 border-t border-gold/20 text-center">
            {submitState.kind === 'err' && (
              <p className="mb-4 text-[12px] font-mono tracking-[0.04em] text-red-400">
                {submitState.reason}
              </p>
            )}
            <Button
              type="submit"
              disabled={!allFilled() || submitState.kind === 'submitting'}
              className="min-w-[280px] h-12 text-[15px] tracking-wide"
            >
              {submitState.kind === 'submitting'
                ? 'Submitting…'
                : 'SUBMIT QUESTIONNAIRE'}
            </Button>
            {!allFilled() && (
              <p className="mt-3 text-[11px] font-mono tracking-[0.22em] text-cream-faint uppercase">
                All fields required
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="text-center pb-6 mb-8 border-b border-gold/30">
      <div className="mx-auto mb-5 w-20 h-20">
        <CompassRose />
      </div>
      <h1 className="font-display tracking-[0.12em] text-[clamp(36px,6vw,56px)] text-gold leading-none">
        BA INTERVIEW
      </h1>
      <p className="mt-2 text-teal font-medium text-[15px]">
        Team Magnificent Qualification Questionnaire
      </p>
    </div>
  );
}

function IntroBlock() {
  return (
    <div className="bg-teal/[0.08] border-l-4 border-teal rounded-md px-5 py-5 leading-[1.7]">
      <p className="text-cream">
        <strong className="text-teal">This is NOT a job application.</strong>
      </p>
      <p className="mt-3 text-cream-mute text-[15px]">
        This questionnaire separates the SERIOUS from the curious. Your sponsor is investing
        TIME, ENERGY, and RESOURCES into your success — they need to know if you’re WORTH IT.
        Answer honestly. Don’t tell us what you think we want to hear. We’ve seen it all. We
        want the REAL you — wins, losses, fire, and all.
      </p>
      <p className="mt-3 text-cream-mute text-[15px]">
        Your sponsor will review your responses within 24–48 hours and decide if Team
        Magnificent is the right fit for BOTH of you.
      </p>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gold/[0.04] border-2 border-gold/20 rounded-xl p-6 md:p-7 space-y-5">
      <h2 className="font-display tracking-[0.1em] text-[clamp(22px,2.6vw,28px)] text-gold pb-3 border-b border-teal/30">
        {title.toUpperCase()}
      </h2>
      {children}
    </div>
  );
}

function FormGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] italic text-cream-mute/70 mt-1">{children}</p>
  );
}

function TextareaField({
  label,
  id,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <FormGroup>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-ink/60 border-2 border-gold/30 rounded-md px-3.5 py-3 text-cream text-[15px] leading-[1.6] resize-y min-h-[120px] focus:outline-none focus:border-teal focus:shadow-[0_0_15px_rgba(45,212,191,0.3)] transition"
      />
    </FormGroup>
  );
}

function RadioField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <FormGroup>
      <Label>{label}</Label>
      <div className="flex flex-col gap-2.5 mt-1">
        {options.map(([val, text]) => {
          const selected = value === val;
          return (
            <label
              key={val}
              className={
                'flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer border-2 transition text-[15px] ' +
                (selected
                  ? 'border-teal bg-teal/10 text-cream'
                  : 'border-gold/20 bg-ink/40 text-cream hover:border-teal hover:bg-teal/[0.06]')
              }
            >
              <input
                type="radio"
                name={name}
                value={val}
                checked={selected}
                onChange={() => onChange(val)}
                className="w-5 h-5 cursor-pointer accent-teal"
              />
              <span>{text}</span>
            </label>
          );
        })}
      </div>
    </FormGroup>
  );
}

function SuccessScreen({
  submittedAt,
  onContinue,
}: {
  submittedAt: string;
  onContinue: () => void;
}) {
  const when = new Date(submittedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <div className="mx-auto mb-8 w-24 h-24">
        <CompassRose />
      </div>
      <p className="font-mono tracking-[0.28em] text-[11px] text-gold mb-4 uppercase">
        Submitted · {when}
      </p>
      <h1 className="font-display tracking-[0.1em] text-[clamp(36px,6vw,56px)] text-teal leading-none">
        QUESTIONNAIRE RECEIVED
      </h1>
      <div className="mt-8 space-y-4 text-cream text-[16px] leading-[1.7]">
        <p>Thank you for completing the Team Magnificent interview questionnaire.</p>
        <p>
          <strong className="text-cream">
            Your sponsor will review your responses and reach out within 24–48 hours
          </strong>{' '}
          to schedule a conversation.
        </p>
        <p className="text-teal font-semibold pt-2">
          Success loves speed. We’ll be in touch soon.
        </p>
      </div>
      <div className="pt-10">
        <Button onClick={onContinue} className="min-w-[240px] h-12 text-[15px]">
          Continue to cockpit
        </Button>
      </div>
    </div>
  );
}

function CompassRose() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: '#2DD4BF', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#2DD4BF', stopOpacity: 0.3 }} />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="85" fill="none" stroke="#4A90E2" strokeWidth="2" opacity="0.4" />
      <circle cx="100" cy="100" r="75" fill="none" stroke="#4A90E2" strokeWidth="1" opacity="0.3" />
      <polygon points="100,15 108,60 100,50 92,60" fill="#C9A84C" opacity="0.9" />
      <polygon points="185,100 140,108 150,100 140,92" fill="#C9A84C" opacity="0.9" />
      <polygon points="100,185 92,140 100,150 108,140" fill="#C9A84C" opacity="0.9" />
      <polygon points="15,100 60,92 50,100 60,108" fill="#C9A84C" opacity="0.9" />
      <polygon points="150,50 130,80 135,75 125,70" fill="#C9A84C" opacity="0.7" />
      <polygon points="150,150 125,130 130,135 120,125" fill="#C9A84C" opacity="0.7" />
      <polygon points="50,150 70,125 65,130 75,120" fill="#C9A84C" opacity="0.7" />
      <polygon points="50,50 75,70 70,65 80,75" fill="#C9A84C" opacity="0.7" />
      <circle cx="100" cy="100" r="12" fill="url(#centerGlow)" />
      <circle cx="100" cy="100" r="6" fill="#2DD4BF" />
    </svg>
  );
}
