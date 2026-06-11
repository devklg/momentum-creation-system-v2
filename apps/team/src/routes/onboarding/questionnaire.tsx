/**
 * /onboarding/questionnaire - BA Interview Questionnaire.
 *
 * Task 8 converts the long form into a guided wizard while preserving the
 * existing submission payload and backend contract.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
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
  fullName: string;
  email: string;
  phone: string;
  city: string;
  sponsor: string;
  employmentStatus: '' | 'full_time' | 'part_time' | 'self_employed' | 'retired';
  biggestWin: string;
  whyNow: string;
  productStatus:
    | ''
    | 'using_seeing_results'
    | 'using_just_started'
    | 'not_yet'
    | 'just_want_business';
  incomeGoal: string;
  incomeImpact: string;
  last30Days: string;
  weeklyHours: '' | '5-10' | '10-20' | '20-30' | '30+';
  availability: '' | 'yes_always' | 'yes_usually' | 'depends' | 'no';
  obstacleResponse: string;
  coachabilityTest:
    | ''
    | 'their_way_first'
    | 'discuss_together'
    | 'my_way'
    | 'test_both';
  hardFeedback: string;
  nwmExperience: '' | 'never' | 'tried_briefly' | 'some_success' | 'significant_success';
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

type WizardStepId =
  | 'identity'
  | 'about'
  | 'product'
  | 'execution'
  | 'coachability'
  | 'readiness';

interface WizardStep {
  id: WizardStepId;
  eyebrow: string;
  title: string;
  body: string;
  fields: Array<keyof FormShape>;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'identity',
    eyebrow: 'Step 1',
    title: 'Your contact snapshot',
    body: 'Your sponsor needs clean contact context before the workbook conversation.',
    fields: ['fullName', 'email', 'phone', 'city', 'sponsor'],
  },
  {
    id: 'about',
    eyebrow: 'Step 2',
    title: 'Why you are here',
    body: 'This section captures your current season, recent wins, and why now matters.',
    fields: ['employmentStatus', 'biggestWin', 'whyNow'],
  },
  {
    id: 'product',
    eyebrow: 'Step 3',
    title: 'Product and goals',
    body: 'Keep this honest. Your sponsor can coach better when they know the real target.',
    fields: ['productStatus', 'incomeGoal', 'incomeImpact'],
  },
  {
    id: 'execution',
    eyebrow: 'Step 4',
    title: 'Execution pattern',
    body: 'Momentum comes from finished actions. This tells your sponsor how you move.',
    fields: ['last30Days', 'weeklyHours', 'availability', 'obstacleResponse'],
  },
  {
    id: 'coachability',
    eyebrow: 'Step 5',
    title: 'Coachability',
    body: 'The best support only works when both sides know how feedback will land.',
    fields: ['coachabilityTest', 'hardFeedback', 'nwmExperience'],
  },
  {
    id: 'readiness',
    eyebrow: 'Step 6',
    title: 'Readiness and commitment',
    body: 'Last pass. Be direct about capacity, blockers, and why your sponsor should lean in.',
    fields: ['investmentReady', 'dealbreaker', 'whyYou'],
  },
];

const ALL_FIELDS = WIZARD_STEPS.flatMap((step) => step.fields);

export function QuestionnairePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusState>({ kind: 'loading' });
  const [form, setForm] = useState<FormShape>(EMPTY_FORM);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const [stepIndex, setStepIndex] = useState(0);

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

  function fieldsFilled(fields: Array<keyof FormShape>): boolean {
    return fields.every((field) => form[field].trim() !== '');
  }

  function allFilled(): boolean {
    return fieldsFilled(ALL_FIELDS);
  }

  function answeredCount(): number {
    return ALL_FIELDS.filter((field) => form[field].trim() !== '').length;
  }

  function goToStep(nextIndex: number) {
    setStepIndex(Math.max(0, Math.min(WIZARD_STEPS.length - 1, nextIndex)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  if (status.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-cream-mute font-mono text-sm">
        Loading...
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

  const currentStep = WIZARD_STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WIZARD_STEPS.length - 1;
  const currentComplete = fieldsFilled(currentStep.fields);
  const progressPct = Math.round(((stepIndex + 1) / WIZARD_STEPS.length) * 100);

  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="max-w-6xl mx-auto px-4 py-10 lg:py-14">
        <Header />
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 items-start">
          <WizardRail
            activeIndex={stepIndex}
            answered={answeredCount()}
            total={ALL_FIELDS.length}
          />

          <section>
            <div className="mb-5">
              <div className="h-2 rounded-full bg-cream/10 overflow-hidden border border-cream/10">
                <div className="h-full bg-gold" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-3 font-mono tracking-[0.14em] text-[11px] text-cream-faint uppercase">
                {currentStep.eyebrow} of 6
              </p>
            </div>

            <form onSubmit={handleSubmit} className="border border-gold/20 bg-gold/[0.035] rounded-md p-5 sm:p-7">
              <div className="mb-7">
                <p className="font-mono tracking-[0.2em] text-[11px] text-gold uppercase mb-3">
                  {currentStep.eyebrow}
                </p>
                <h1 className="font-display text-[clamp(34px,6vw,58px)] leading-[0.96] text-cream">
                  {currentStep.title}
                </h1>
                <p className="mt-3 text-cream-mute text-[15px] leading-[1.6] max-w-2xl">
                  {currentStep.body}
                </p>
              </div>

              <div className="space-y-6">{renderStep(currentStep.id, form, update)}</div>

              <div className="mt-8 pt-6 border-t border-cream/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isFirst}
                  onClick={() => goToStep(stepIndex - 1)}
                  className="border-cream/20 text-cream hover:bg-cream/[0.05] font-mono tracking-[0.04em] text-[13px] px-5 py-5"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Back
                </Button>

                <div className="text-center sm:text-right">
                  {submitState.kind === 'err' && (
                    <p className="mb-3 text-[12px] font-mono tracking-[0.04em] text-red-400">
                      {submitState.reason}
                    </p>
                  )}
                  {!currentComplete && (
                    <p className="mb-3 text-[11px] font-mono tracking-[0.14em] text-cream-faint uppercase">
                      Complete this step to continue
                    </p>
                  )}
                  {isLast ? (
                    <Button
                      type="submit"
                      disabled={!allFilled() || submitState.kind === 'submitting'}
                      className="min-w-[230px] h-12 text-[15px] tracking-wide"
                    >
                      {submitState.kind === 'submitting' ? 'Submitting...' : 'Submit questionnaire'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={!currentComplete}
                      onClick={() => goToStep(stepIndex + 1)}
                      className="min-w-[180px] h-12 text-[15px] tracking-wide"
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function renderStep(
  step: WizardStepId,
  form: FormShape,
  update: <K extends keyof FormShape>(field: K, value: FormShape[K]) => void,
) {
  switch (step) {
    case 'identity':
      return (
        <>
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
            <Helper>We use SMS for urgent team updates.</Helper>
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
        </>
      );
    case 'about':
      return (
        <>
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
            placeholder="Business, personal, health, relationship - what are you most proud of?"
          />
          <TextareaField
            label="Why did you join Team Magnificent RIGHT NOW? *"
            id="whyNow"
            value={form.whyNow}
            onChange={(v) => update('whyNow', v)}
            placeholder="What changed? What made you say yes?"
          />
        </>
      );
    case 'product':
      return (
        <>
          <RadioField
            label="Are you using GLP-THREE? *"
            name="productStatus"
            value={form.productStatus}
            onChange={(v) => update('productStatus', v as FormShape['productStatus'])}
            options={[
              ['using_seeing_results', 'Yes - using it and seeing results'],
              ['using_just_started', 'Yes - just started'],
              ['not_yet', 'Not yet - starting soon'],
              ['just_want_business', 'No - only interested in business'],
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
              placeholder="$500, $2,000, $5,000, $10,000..."
            />
          </FormGroup>
          <TextareaField
            label="If you hit that income goal, what ACTUALLY changes in your life? *"
            id="incomeImpact"
            value={form.incomeImpact}
            onChange={(v) => update('incomeImpact', v)}
            placeholder="Be specific: bills paid, debt gone, quit second job, save for kids' college..."
          />
        </>
      );
    case 'execution':
      return (
        <>
          <TextareaField
            label="Last 30 days: Something you STARTED and FINISHED? *"
            id="last30Days"
            value={form.last30Days}
            onChange={(v) => update('last30Days', v)}
            placeholder="A project, goal, commitment - show you can finish what you start."
          />
          <RadioField
            label="How many hours per week can you commit? *"
            name="weeklyHours"
            value={form.weeklyHours}
            onChange={(v) => update('weeklyHours', v as FormShape['weeklyHours'])}
            options={[
              ['5-10', '5-10 hours'],
              ['10-20', '10-20 hours'],
              ['20-30', '20-30 hours'],
              ['30+', '30+ hours'],
            ]}
          />
          <RadioField
            label="Your sponsor calls at 6 AM Saturday with an opportunity. Do you answer? *"
            name="availability"
            value={form.availability}
            onChange={(v) => update('availability', v as FormShape['availability'])}
            options={[
              ['yes_always', "Yes - success doesn't sleep"],
              ['yes_usually', "Yes, unless there's an emergency"],
              ['depends', 'Depends on the day'],
              ['no', 'No - I need boundaries'],
            ]}
          />
          <TextareaField
            label="Task: 'Contact 20 people this week.' Wednesday: You've only done 3. What do you do? *"
            id="obstacleResponse"
            value={form.obstacleResponse}
            onChange={(v) => update('obstacleResponse', v)}
            placeholder="Be specific. What's your move?"
          />
        </>
      );
    case 'coachability':
      return (
        <>
          <RadioField
            label="Your sponsor says 'Do it my way.' You think YOUR way is better. What do you do? *"
            name="coachabilityTest"
            value={form.coachabilityTest}
            onChange={(v) => update('coachabilityTest', v as FormShape['coachabilityTest'])}
            options={[
              ['their_way_first', 'Do it their way first, discuss after'],
              ['discuss_together', 'Discuss and decide together'],
              ['my_way', 'Do it my way - I know what works'],
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
        </>
      );
    case 'readiness':
      return (
        <>
          <RadioField
            label="Can you invest $200-$400 in product in the next 7 days? *"
            name="investmentReady"
            value={form.investmentReady}
            onChange={(v) => update('investmentReady', v as FormShape['investmentReady'])}
            options={[
              ['yes_today', 'Yes - today'],
              ['yes_7_days', 'Yes - within 7 days'],
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
        </>
      );
  }
}

function Header() {
  return (
    <div className="mb-8 border-b border-gold/25 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <img src="/logos/logo_icon.png" alt="" aria-hidden="true" className="h-9 w-auto" />
        <p className="font-mono tracking-[0.22em] text-[11px] text-gold uppercase">
          Team Magnificent
        </p>
      </div>
      <h1 className="font-display text-[clamp(40px,7vw,76px)] leading-[0.94] text-cream">
        Sponsor context questionnaire
      </h1>
      <p className="mt-4 text-cream-mute text-[15px] leading-[1.6] max-w-2xl">
        Six focused steps. Same questions, less wall of form. Your answers help your
        sponsor coach you with context.
      </p>
    </div>
  );
}

function WizardRail({
  activeIndex,
  answered,
  total,
}: {
  activeIndex: number;
  answered: number;
  total: number;
}) {
  return (
    <aside className="lg:sticky lg:top-6 border border-cream/10 bg-cream/[0.02] rounded-md p-5">
      <p className="font-mono tracking-[0.16em] text-[11px] text-cream-faint uppercase mb-2">
        Progress
      </p>
      <p className="font-display text-[38px] text-gold leading-none mb-5">
        {answered}/{total}
      </p>
      <ol className="space-y-2">
        {WIZARD_STEPS.map((step, index) => {
          const state =
            index < activeIndex ? 'complete' : index === activeIndex ? 'current' : 'upcoming';
          return (
            <li key={step.id}>
              <div
                className={
                  'rounded border px-3 py-3 ' +
                  (state === 'current'
                    ? 'border-gold/55 bg-gold/[0.08]'
                    : state === 'complete'
                      ? 'border-teal/35 bg-teal/[0.055]'
                      : 'border-cream/10 bg-transparent')
                }
              >
                <p
                  className={
                    'font-mono tracking-[0.14em] text-[10px] uppercase ' +
                    (state === 'current'
                      ? 'text-gold'
                      : state === 'complete'
                        ? 'text-teal'
                        : 'text-cream-faint')
                  }
                >
                  {step.eyebrow}
                </p>
                <p className="text-cream text-[14px] leading-[1.25] mt-1">{step.title}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function FormGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Helper({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] italic text-cream-mute/70 mt-1">{children}</p>;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
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
      <img src="/logos/logo_icon.png" alt="" aria-hidden="true" className="mx-auto mb-8 h-20 w-auto" />
      <p className="font-mono tracking-[0.22em] text-[11px] text-gold mb-4 uppercase">
        Submitted · {when}
      </p>
      <CheckCircle2 className="mx-auto h-9 w-9 text-teal mb-5" aria-hidden="true" />
      <h1 className="font-display tracking-[0.08em] text-[clamp(34px,6vw,56px)] text-teal leading-none">
        QUESTIONNAIRE RECEIVED
      </h1>
      <div className="mt-8 space-y-4 text-cream text-[16px] leading-[1.7]">
        <p>Your sponsor can review your responses from here.</p>
        <p className="text-cream-mute">
          The Launch Center will keep the next action visible while your sponsor prepares
          the workbook conversation.
        </p>
      </div>
      <div className="pt-10">
        <Button onClick={onContinue} className="min-w-[240px] h-12 text-[15px]">
          Continue to Launch Center
        </Button>
      </div>
    </div>
  );
}
