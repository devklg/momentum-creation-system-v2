/**
 * /welcome - first authenticated screen after register.
 *
 * Task 8 shortens the welcome into a ceremony plus Launch Center handoff.
 * The durable behavior stays the same: POST /api/welcome/load marks the
 * screen seen, and POST /api/welcome/accept records the click commitment.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, Compass, Users } from 'lucide-react';
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
      setTimeout(() => navigate('/cockpit'), 850);
    } catch {
      setAccept({ kind: 'err', reason: 'Could not reach server. Try again.' });
    }
  }

  return (
    <main className="min-h-screen bg-ink text-cream relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(900px circle at 18% 8%, rgba(201,168,76,0.08), transparent 62%), radial-gradient(820px circle at 88% 82%, rgba(45,212,191,0.055), transparent 60%)',
        }}
        aria-hidden="true"
      />

      <header className="relative z-10 px-6 md:px-10 pt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logos/logo_icon.png" alt="" aria-hidden="true" className="h-7 w-auto" />
          <span className="font-display tracking-[0.18em] text-[15px] text-gold truncate">
            TEAM MAGNIFICENT
          </span>
        </div>
        <span className="font-mono tracking-[0.18em] text-[10px] text-cream-mute uppercase text-right">
          Brand Ambassador Onboarding
        </span>
      </header>

      <section className="relative z-10 px-5 pt-16 pb-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-10 items-end">
          <div>
            <p className="font-mono tracking-[0.24em] text-[11px] text-gold uppercase mb-7">
              Official Welcome
            </p>
            <h1 className="font-display leading-[0.92] text-cream">
              <span className="block text-[clamp(58px,11vw,128px)]">Welcome</span>
              <span className="block text-[clamp(58px,11vw,128px)]">to the</span>
              <span className="block text-[clamp(58px,11vw,128px)] text-gold">Team.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-cream-mute text-[17px] leading-[1.65]">
              {firstName ? `${firstName}, ` : ''}you are inside Team Magnificent now.
              This is your starting line: commitment, one clear path, and a Launch Center
              that keeps the next move in front of you.
            </p>
          </div>

          <div className="border border-gold/25 bg-gold/[0.045] rounded-md p-5">
            <p className="font-mono tracking-[0.16em] text-[11px] text-gold uppercase mb-3">
              Your handoff
            </p>
            <p className="font-display text-[30px] leading-[1.05] text-cream">
              Accept once. Launch from cockpit.
            </p>
            <p className="text-cream-mute text-[14px] leading-[1.55] mt-3">
              After this page, the Launch Center will guide your discovery interview with
              Steve, Day 1, and your first invitation.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-10">
        <div className="max-w-5xl mx-auto border-y border-gold/35 py-5">
          <p className="font-display tracking-[0.14em] text-[18px] text-gold text-center leading-snug">
            COMMIT TO THE SYSTEM. MOVE WITH SPEED. STAY COACHABLE.
          </p>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <CeremonyCard
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title="Kevin and Paul lead from the field."
            body="Decades of team-building experience are behind the system you are stepping into."
          />
          <CeremonyCard
            icon={<Compass className="h-5 w-5" aria-hidden="true" />}
            title="The path is already mapped."
            body="Your job is to follow the Launch Center, complete each step, and keep relationships personal."
          />
          <CeremonyCard
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
            title="Steve comes first."
            body="Schedule your New BA Discovery interview with Steve, then your operating tools open in order."
          />
        </div>
      </section>

      <section className="relative z-10 px-5 pb-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
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

      <section className="relative z-10 px-5 pb-20">
        <div className="max-w-md mx-auto text-center">
          {accept.kind !== 'accepted' ? (
            <>
              <Button
                onClick={handleAccept}
                disabled={accept.kind === 'accepting' || !!loadErr}
                className="min-w-[280px] h-12 text-[15px] tracking-wide"
              >
                {accept.kind === 'accepting' ? 'Recording...' : 'I accept. Open my Launch Center.'}
                {accept.kind !== 'accepting' && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
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
              <p className="mt-4 text-[11px] font-mono tracking-[0.18em] text-cream-faint uppercase">
                Next: Launch Center
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-8 w-8 text-teal mb-4" aria-hidden="true" />
              <p className="font-display tracking-[0.18em] text-[14px] text-teal">
                COMMITMENT RECORDED
              </p>
              <p className="mt-3 text-[12px] font-mono tracking-[0.04em] text-cream-mute">
                Opening your Launch Center...
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function CeremonyCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="border border-cream/10 bg-cream/[0.025] rounded-md p-5">
      <div className="text-teal mb-4">{icon}</div>
      <p className="font-display text-[22px] text-cream leading-[1.08] mb-2">{title}</p>
      <p className="text-cream-mute text-[14px] leading-[1.55]">{body}</p>
    </div>
  );
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
      <p className="font-display text-[24px] text-cream tracking-wide">{name}</p>
      <p className="text-[13px] text-cream-mute mt-1">{role}</p>
      <p className="font-mono text-[12px] tracking-[0.08em] text-cream-faint mt-1">
        THREE BA ID {threeBaId}
      </p>
      <p className="font-mono text-[12px] tracking-[0.08em] text-gold mt-1">{phone}</p>
    </div>
  );
}
