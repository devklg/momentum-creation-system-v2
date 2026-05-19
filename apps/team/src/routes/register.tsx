import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface SponsorResolved {
  name: string;
  threeBaId: string;
  tmCode: string;
}

type CodeState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; sponsor: SponsorResolved }
  | { kind: 'err'; reason: string };

type Strength = 'weak' | 'ok' | 'strong' | null;

function scorePassword(v: string): Strength {
  if (!v) return null;
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return s <= 1 ? 'weak' : s <= 3 ? 'ok' : 'strong';
}

export function RegisterPage() {
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [codeState, setCodeState] = useState<CodeState>({ kind: 'idle' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [threeUser, setThreeUser] = useState('');
  const [threeBaId, setThreeBaId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Debounced live access-code validation.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setCodeState({ kind: 'idle' }); return; }
    setCodeState({ kind: 'checking' });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
        });
        const body = await res.json();
        if (res.ok && body.ok && body.sponsor) {
          setCodeState({ kind: 'ok', sponsor: body.sponsor });
        } else {
          setCodeState({ kind: 'err', reason: body.error ?? 'Code not recognized' });
        }
      } catch {
        setCodeState({ kind: 'err', reason: 'Could not reach server' });
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code]);

  const strength = scorePassword(password);
  const pwMatch = password.length > 0 && password === confirm;
  const pwOk = password.length >= 8;
  const allFilled = first && last && email && phone && threeUser && threeBaId;
  const ready = codeState.kind === 'ok' && !!allFilled && pwOk && pwMatch && terms && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accessCode: code.trim().toUpperCase(),
          firstName: first.trim(),
          lastName: last.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          threeUsername: threeUser.trim(),
          threeBaId: threeBaId.trim(),
          password,
          // IANA timezone read from the browser. Drives Michael's 18-hour
          // slot window (08:00–21:45 BA local). Fallback to UTC if the
          // runtime can't resolve it (extremely rare).
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          termsAccepted: true,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setSubmitError(body.error ?? 'Registration failed. Please try again.');
        setSubmitting(false);
        return;
      }
      navigate('/welcome');
    } catch {
      setSubmitError('Could not reach server. Check connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <img
            src="/logos/logo_dark_hero.png"
            alt="Team Magnificent"
            className="mx-auto h-20 w-auto mb-5"
          />
          <p className="font-display tracking-eyebrow text-[13px] text-gold mb-2.5">
            TEAM MAGNIFICENT · REGISTER
          </p>
          <h1 className="font-display text-[38px] leading-[1.05] text-cream mb-2">
            Welcome to the team.
          </h1>
          <p className="text-sm text-cream-mute max-w-md mx-auto">
            Your sponsor sent you an access code. Enter it below to claim your spot and start building.
          </p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="on" className="space-y-3.5">
          <div>
            <Label htmlFor="code">Access code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="TM-XXXX"
              maxLength={12}
              autoComplete="off"
            />
            <SponsorPanel state={codeState} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first">First name</Label>
              <Input id="first" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" />
            </div>
            <div>
              <Label htmlFor="last">Last name</Label>
              <Input id="last" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>

          <div>
            <Label htmlFor="phone">Mobile phone</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 555-5555" autoComplete="tel" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="three-user">THREE username</Label>
              <Input id="three-user" value={threeUser} onChange={(e) => setThreeUser(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="three-id">THREE BA ID</Label>
              <Input id="three-id" value={threeBaId} onChange={(e) => setThreeBaId(e.target.value)} placeholder="7-digit ID" autoComplete="off" />
            </div>
          </div>

          <div>
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            {strength && (
              <p className={`mt-1.5 text-[11px] font-mono tracking-[0.08em] ${strength === 'weak' ? 'text-red-400' : strength === 'ok' ? 'text-gold' : 'text-teal'}`}>
                {strength.toUpperCase()}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            {confirm && !pwMatch && (
              <p className="mt-1.5 text-[11px] font-mono tracking-[0.08em] text-red-400">PASSWORDS DO NOT MATCH</p>
            )}
          </div>

          <div className="flex items-start gap-2.5 pt-2">
            <Checkbox id="terms" checked={terms} onCheckedChange={(v) => setTerms(v === true)} />
            <Label htmlFor="terms" className="text-[13px] normal-case tracking-normal text-cream-mute leading-relaxed mb-0">
              I confirm my sponsor enrolled me in THREE International first, and I accept the{' '}
              <span className="text-gold underline cursor-pointer">Team Magnificent terms</span> and{' '}
              <span className="text-gold underline cursor-pointer">privacy policy</span>.
            </Label>
          </div>

          {submitError && (
            <div className="text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-2.5">
              {submitError}
            </div>
          )}

          <Button type="submit" disabled={!ready} className="w-full">
            {submitting ? 'Creating account…' : 'Create my account'}
          </Button>
          <p className="text-center text-[13px] text-cream-faint pt-2">
            Already have an account? <a href="/login" className="text-gold no-underline">Sign in</a>
          </p>
        </form>
      </div>
    </div>
  );
}

function SponsorPanel({ state }: { state: CodeState }) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'checking') {
    return (
      <div className="mt-2.5 bg-gold/5 border border-gold/20 rounded-md py-2.5 px-3 text-[12px] font-mono tracking-[0.04em] text-gold">
        Checking access code…
      </div>
    );
  }
  if (state.kind === 'err') {
    return (
      <div className="mt-2.5 bg-red-500/5 border border-red-500/30 rounded-md py-2.5 px-3 text-[12px] font-mono tracking-[0.04em] text-red-400">
        {state.reason}
      </div>
    );
  }
  const { sponsor } = state;
  return (
    <div className="mt-2.5 bg-teal/5 border border-teal/30 rounded-md py-3 px-3.5">
      <p className="font-display text-[11px] tracking-[0.18em] text-teal mb-2">SPONSOR CONFIRMED</p>
      <SponsorRow k="Name" v={sponsor.name} mono={false} />
      <SponsorRow k="THREE BA ID" v={sponsor.threeBaId} mono />
      <SponsorRow k="TM Code" v={sponsor.tmCode} mono />
    </div>
  );
}

function SponsorRow({ k, v, mono }: { k: string; v: string; mono: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1 text-[13px]">
      <span className="text-cream/56 text-[11px] uppercase tracking-label">{k}</span>
      <span className={mono ? 'text-cream font-mono tracking-[0.02em]' : 'text-cream font-body font-medium'}>{v}</span>
    </div>
  );
}
