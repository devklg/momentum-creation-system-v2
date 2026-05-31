/**
 * /welcome — first authenticated screen after register.
 * Spec: TEAM Design Section C (locked Chat #82/#84/#94/#95/#96).
 *
 * Chat #96 amendments to the Chat #94 implementation:
 *   - Headline becomes "WELCOME TO THE TEAM." stacked three lines (Chat #95)
 *   - Gold commitment band strip across the page (Chat #95)
 *   - Salutation block addresses BA by first name (Chat #95)
 *   - Three-step strip becomes: Schedule Michael / Day 1 unlocks / Days 2-7 follow (Chat #96)
 *   - Two signatures with name + ID + phone pattern (Chat #95; phones still placeholder)
 *   - Accept routes to /michael/schedule (Chat #96), not /cockpit
 *   - Hard gate: cockpit + Days 2-7 + invitation generator locked until Michael interview complete
 *
 * On mount: POST /api/welcome/load — marks welcome_seen=true, returns BA's first name.
 * On accept click: POST /api/welcome/accept — triple-stack commitment record.
 *   (J.3 locked Chat #94: click-acknowledge, not typed signature.)
 */

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface WelcomeLoadResponse {
  ok: boolean;
  baFirstName?: string;
  error?: string;
}

type AcceptState =
  | { kind: 'idle' }
  | { kind: 'accepting' }
  | { kind: 'accepted' }
  | { kind: 'err'; reason: string };

export function WelcomePage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState<string>('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [accept, setAccept] = useState<AcceptState>({ kind: 'idle' });

  // On mount: signal welcome-screen-displayed; server marks welcome_seen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/welcome/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const body = (await res.json()) as WelcomeLoadResponse;
        if (cancelled) return;
        if (!res.ok || !body.ok) {
          setLoadErr(body.error ?? 'Could not load welcome.');
          return;
        }
        setFirstName(body.baFirstName ?? '');
      } catch {
        if (!cancelled) setLoadErr('Could not reach server.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAccept() {
    if (accept.kind === 'accepting' || accept.kind === 'accepted') return;
    setAccept({ kind: 'accepting' });
    try {
      const res = await fetch('/api/welcome/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setAccept({ kind: 'err', reason: body.error ?? 'Could not record your commitment.' });
        return;
      }
      setAccept({ kind: 'accepted' });
      // Brief pause so the "COMMITMENT RECORDED" confirmation lands, then route.
      setTimeout(() => navigate('/michael/schedule'), 900);
    } catch {
      setAccept({ kind: 'err', reason: 'Could not reach server. Try again.' });
    }
  }

  return (
    <div className="min-h-screen bg-ink text-cream relative overflow-hidden">
      {/* Atmospheric mesh — fixed, behind everything */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(900px circle at 12% 8%, rgba(201,168,76,0.06), transparent 60%), radial-gradient(900px circle at 88% 92%, rgba(45,212,191,0.04), transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* Top brand strip */}
      <header className="relative z-10 px-6 md:px-10 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logos/logo_icon.png"
            alt=""
            aria-hidden="true"
            className="h-7 w-auto"
          />
          <span className="font-display tracking-[0.18em] text-[15px] text-gold">
            TEAM MAGNIFICENT
          </span>
        </div>
        <span className="font-mono tracking-[0.22em] text-[10px] text-cream-mute uppercase">
          Brand Ambassador · Onboarding
        </span>
      </header>

      {/* HERO STRIP — "WELCOME TO THE TEAM." stacked three lines */}
      <section className="relative z-10 px-4 pt-14 pb-10 text-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
          <img
            src="/logos/logo_icon.png"
            alt=""
            aria-hidden="true"
            className="h-[18rem] w-auto md:h-[20rem]"
            style={{
              filter: 'drop-shadow(0 0 80px rgba(201, 168, 76, 0.45))',
              animation: 'glow 4s ease-in-out infinite alternate',
            }}
          />
        </div>
        <div className="relative">
          <p className="font-mono tracking-[0.28em] text-[11px] text-gold mb-8 uppercase">
            Official Welcome · THREE International
          </p>
          <h1 className="font-display leading-[0.92] text-cream">
            <span className="block text-[clamp(56px,11vw,128px)]">WELCOME</span>
            <span className="block text-[clamp(56px,11vw,128px)]">TO THE</span>
            <span className="block text-[clamp(56px,11vw,128px)] text-gold">TEAM.</span>
          </h1>
          <p className="font-mono tracking-[0.22em] text-[11px] text-cream-faint mt-8 uppercase">
            Magnificent Worldwide Marketing &amp; Sales Group · THREE International · Est. 2026
          </p>
        </div>
      </section>

      {/* GOLD COMMITMENT BAND — institutional Kevin-voice strip */}
      <section className="relative z-10 mt-2 mb-12">
        <div
          className="border-y border-gold/40 py-5 px-4"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.10) 50%, transparent 100%)',
          }}
        >
          <p className="font-display tracking-[0.18em] text-[clamp(14px,1.4vw,18px)] text-gold text-center max-w-5xl mx-auto leading-snug">
            COMMITTED TO MAGNIFICENT RESULTS — IN COMPENSATION, RANKS, LEADERSHIP, AND MASSIVE FAST MOMENTUM
          </p>
        </div>
      </section>

      {/* SALUTATION BLOCK */}
      <section className="relative z-10 px-4 pb-8">
        <div className="max-w-2xl mx-auto">
          <p className="font-display text-[clamp(20px,2.4vw,28px)] text-cream leading-snug">
            {firstName ? `${firstName},` : 'Welcome,'} you made the decision. That puts you ahead
            of almost everyone you know.
          </p>
        </div>
      </section>

      {/* THE LETTER BODY — short form per Chat #96 */}
      <section className="relative z-10 px-4 pb-10">
        <div className="max-w-2xl mx-auto space-y-5 text-cream font-body text-[16px] leading-[1.7]">
          <p>
            Welcome to Team Magnificent. You didn’t just join a company — you joined the fastest
            moving team inside THREE International, at the moment the wave is just starting to
            crest. The timing is not an accident. It is the advantage.
          </p>

          <p>
            A few things to know, right now.
          </p>

          <div className="pl-5 border-l-2 border-gold/40 space-y-4">
            <p>
              <strong className="text-gold font-display tracking-wide block mb-1">You are not alone.</strong>
              Paul Barrios and I are your co-leaders. We have been doing this for decades. Paul
              has earned tens of millions in binary network marketing. I have built teams of
              thousands. We are not theorizing — we are practicing alongside you.
            </p>
            <p>
              <strong className="text-gold font-display tracking-wide block mb-1">The product is real.</strong>
              GLP-THREE is the only trademarked, patented, all-natural GLP-1 alternative in the
              market. No needle. No prescription. No side effects. I am 60+ years old and 19
              pounds lighter on this product. I sell what I use. I use what I believe in.
            </p>
            <p>
              <strong className="text-gold font-display tracking-wide block mb-1">The job is simple.</strong>
              Share the video. Respect the decision. Move on. Repeat. You don’t have to convince
              anyone. The market — 72% of Americans overweight, $200 billion category, six months
              into the launch — is doing the convincing. You just share.
            </p>
            <p>
              <strong className="text-gold font-display tracking-wide block mb-1">The tools are built for you.</strong>
              Michael will call you shortly to learn how we can support you best. Your Fast Start
              Guide will walk you through your first seven days. Your sponsor is one tap away.
              Speed of the leader is the speed of the group — and you are now one of the leaders.
              Run with alacrity.
            </p>
          </div>

          <p className="text-cream pt-2">Welcome home.</p>
        </div>
      </section>

      {/* SIGNATURES */}
      <section className="relative z-10 px-4 pb-10">
        <div className="max-w-2xl mx-auto grid md:grid-cols-2 gap-6">
          <SignatureBlock
            name="Kevin L. Gardner"
            role="Co-Leader, Team Magnificent"
            threeBaId="1845964"
            phone="323-351-9758"
          />
          <SignatureBlock
            name="Paul Barrios"
            role="Co-Leader, Team Magnificent"
            threeBaId="892390"
            phone="949-257-6899"
          />
        </div>
      </section>

      {/* THE NEXT 30 MINUTES — three-step strip, Chat #96 amendments */}
      <section className="relative z-10 px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono tracking-[0.28em] text-[11px] text-gold mb-5 text-center uppercase">
            What happens next
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <StepCard
              n="1"
              title="Schedule your Michael interview."
              body="A 15-minute call within the next 12 hours. Michael learns how we can support you. Required — the rest of your tools unlock after this call."
            />
            <StepCard
              n="2"
              title="Day 1 of training opens."
              body="While you wait, start Day 1 — The Product. Learn what GLP-THREE is and the science behind it."
              to="/training/fast-start"
            />
            <StepCard
              n="3"
              title="Days 2 through 7 follow."
              body="Product, team, prep, and then the 2-in-72 game. By Day 7, you are in motion."
            />
          </div>
        </div>
      </section>

      {/* THE WEEK AHEAD — the 7-day arc strip (Chat #147, leaf wf_0037).
          A different time scale than "What happens next": that strip is the next
          30 minutes; this is the full first seven days, grounded in the locked
          Fast Start modules + Michael + the 2-in-72 cadence. */}
      <section className="relative z-10 px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono tracking-[0.28em] text-[11px] text-gold mb-3 text-center uppercase">
            The week ahead · your first seven days
          </p>
          <p className="text-center text-cream-mute font-body text-[14px] leading-[1.7] max-w-2xl mx-auto mb-10">
            One move a day. By Day 7 you are not learning the business — you are running it.
          </p>
          <ol className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-x-3 gap-y-9">
            {SEVEN_DAY_ARC.map((d) => (
              <DayNode key={d.n} {...d} />
            ))}
          </ol>
        </div>
      </section>

      {/* ACCEPT — single primary action */}
      <section className="relative z-10 px-4 pb-24">
        <div className="max-w-md mx-auto text-center">
          {accept.kind !== 'accepted' ? (
            <>
              <Button
                onClick={handleAccept}
                disabled={accept.kind === 'accepting' || !!loadErr}
                className="min-w-[280px] h-12 text-[15px] tracking-wide"
              >
                {accept.kind === 'accepting' ? 'Recording…' : 'I accept. Let’s begin.'}
              </Button>
              {accept.kind === 'err' && (
                <p className="mt-4 text-[12px] font-mono tracking-[0.04em] text-red-400">
                  {accept.reason}
                </p>
              )}
              {loadErr && (
                <p className="mt-4 text-[12px] font-mono tracking-[0.04em] text-red-400">
                  {loadErr}
                </p>
              )}
              <p className="mt-4 text-[11px] font-mono tracking-[0.22em] text-cream-faint uppercase">
                Next: Schedule Michael
              </p>
            </>
          ) : (
            <>
              <p className="font-display tracking-[0.18em] text-[14px] text-teal">
                COMMITMENT RECORDED
              </p>
              <p className="mt-3 text-[12px] font-mono tracking-[0.04em] text-cream-mute">
                Routing to Michael scheduler…
              </p>
            </>
          )}
        </div>
      </section>

      {/* Compass-glow keyframe */}
      <style>{`
        @keyframes glow {
          0%   { filter: drop-shadow(0 0 60px rgba(201, 168, 76, 0.35)); }
          100% { filter: drop-shadow(0 0 100px rgba(201, 168, 76, 0.60)); }
        }
      `}</style>
    </div>
  );
}

/**
 * The 7-day arc. Content is grounded in the locked Fast Start curriculum
 * (FAST_START_MODULES, see apps/team/.../fast-start/_wire.ts) + the Michael
 * interview + the 2-in-72 cadence — not invented copy. Day 1 is the "now"
 * node (teal). `.team` is BA-facing, so the comp/CV references are legitimate
 * here; the five .com bans do not apply on this surface.
 */
const SEVEN_DAY_ARC: { n: number; title: string; body: string; now?: boolean }[] = [
  { n: 1, title: 'Welcome & Michael', body: 'Your interview call, then Module 1 — the product you’ll share.', now: true },
  { n: 2, title: 'How it pays', body: 'Comp Plan Layer 1 — Active, Qualified, and the 900 CV cycle.' },
  { n: 3, title: 'Two legs', body: 'The binary as two legs, not a tree. First-mover is structural math.' },
  { n: 4, title: 'Your list', body: 'Name your warm market. Ivory turns it into your first asks.' },
  { n: 5, title: 'Your team', body: 'Not “find two and stop.” Your first two activate you.' },
  { n: 6, title: 'First invites', body: 'You share the video. The market does the convincing.' },
  { n: 7, title: 'In motion', body: 'Prospects in the tank, two candidates named. You’re running.' },
];

function DayNode({
  n,
  title,
  body,
  now,
}: {
  n: number;
  title: string;
  body: string;
  now?: boolean;
}) {
  return (
    <li className="relative pt-8 text-center px-1">
      {/* arc segment — the dotted gold rule the nodes sit on */}
      <span
        className="absolute top-3 left-0 right-0 h-px bg-gradient-to-r from-gold/0 via-gold/40 to-gold/0"
        aria-hidden="true"
      />
      {/* node dot */}
      <span
        className={[
          'absolute top-[5px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full',
          now ? 'bg-teal' : 'bg-gold',
        ].join(' ')}
        style={now ? { boxShadow: '0 0 0 4px rgba(45,212,191,0.18)' } : undefined}
        aria-hidden="true"
      />
      <p
        className={[
          'font-mono tracking-[0.25em] text-[9px] uppercase mb-1.5',
          now ? 'text-teal' : 'text-gold',
        ].join(' ')}
      >
        {now ? 'Today' : `Day ${n}`}
      </p>
      <p className="font-display tracking-[0.03em] text-[16px] text-cream leading-tight mb-1.5">
        {title}
      </p>
      <p className="text-[11px] text-cream-mute leading-[1.5] font-body">{body}</p>
    </li>
  );
}

function StepCard({
  n,
  title,
  body,
  to,
}: {
  n: string;
  title: string;
  body: string;
  /** Optional link — when set the card is interactive. Used to wire the
   *  "Day 1 of training opens." card to /training/fast-start since the
   *  Fast Start hub + Module 1 are whitelisted pre-Michael. */
  to?: string;
}) {
  const className =
    'bg-cream/[0.025] border border-cream/10 rounded-md p-5 hover:border-gold/30 transition-colors block';
  const body_ = (
    <>
      <p className="font-display text-[40px] leading-none text-gold mb-3">{n}</p>
      <p className="font-display tracking-[0.04em] text-[16px] text-cream mb-2 leading-tight">
        {title}
      </p>
      <p className="text-[13px] text-cream-mute leading-[1.55]">{body}</p>
      {to && (
        <p className="font-mono tracking-[0.18em] text-[10px] text-gold uppercase mt-3">
          Open Fast Start →
        </p>
      )}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {body_}
      </Link>
    );
  }
  return <div className={className}>{body_}</div>;
}

function SignatureBlock({
  name,
  role,
  threeBaId,
  phone,
}: {
  name: string;
  role: string;
  threeBaId: string;
  phone: string;
}) {
  return (
    <div className="border-t border-gold/30 pt-4">
      <p className="font-display text-[22px] text-cream tracking-wide">{name}</p>
      <p className="text-[13px] text-cream-mute mt-1">{role}</p>
      <p className="font-mono text-[12px] tracking-[0.08em] text-cream-faint mt-1">
        THREE BA ID {threeBaId}
      </p>
      <p className="font-mono text-[12px] tracking-[0.08em] text-gold mt-1">{phone}</p>
    </div>
  );
}
