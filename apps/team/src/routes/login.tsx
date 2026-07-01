/**
 * /login — the returning-BA + founder sign-in surface (Chat #125).
 *
 * Spec: locked-spec Part 3.1 (single login surface for .team and admin),
 * auth.ts POST /api/auth/login (the endpoint existed since Chat #102; this
 * page is the front-end door that was never built — surfaced live in Chat
 * #125 when the founder hit /register, which is signup-only).
 *
 * Identity contract (auth.ts): TM BA ID + password. ONLY the TM BA ID
 * (TMAG-...) authenticates — THREE BA ID and email are operational facts on
 * the record, not credentials. New BAs are auto-sessioned at /register and
 * never see this page; this is for returning BAs and founders.
 *
 * On success the server sets the session cookie (setSessionCookie) and we
 * route to /cockpit — the home base /invitations already routes "Back to
 * cockpit" to. On failure the server returns a deliberately generic 401
 * (no user-not-found vs wrong-password distinction — credential-stuffing
 * defense); this page mirrors that and shows one generic error.
 *
 * .team convention: form primitives from @/components/ui, brand tokens via
 * Tailwind classes, no @momentum/shared import (TS6059 — lesson chat120).
 * Mirrors register.tsx's centered-card layout exactly.
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginResponse {
  ok: true;
  tmagId: string;
}

export function LoginPage() {
  const navigate = useNavigate();

  const [tmagId, setTmagId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ready = tmagId.trim() !== '' && password !== '' && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tmagId: tmagId.trim(), password }),
      });
      const body = (await res.json()) as LoginResponse | { ok: false; error?: string };
      if (!res.ok || !body.ok) {
        // The server returns a generic 401 by design; surface it as-is.
        setError(
          ('error' in body && body.error) ||
            'Invalid credentials. Check your BA ID and password.',
        );
        setSubmitting(false);
        return;
      }
      navigate('/cockpit');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
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
            TEAM MAGNIFICENT · SIGN IN
          </p>
          <h1 className="font-display text-[38px] leading-[1.05] text-cream mb-2">
            Welcome back.
          </h1>
          <p className="text-sm text-cream-mute max-w-md mx-auto">
            Sign in with your Team Magnificent BA ID to reach your cockpit.
          </p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="on" className="space-y-3.5">
          <div>
            <Label htmlFor="tmagId">BA ID</Label>
            <Input
              id="tmagId"
              value={tmagId}
              onChange={(e) => setTmagId(e.target.value)}
              placeholder="TMAG-..."
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>

          <div>
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-[12px] font-mono tracking-[0.04em] text-red-400 bg-red-500/5 border border-red-500/30 rounded-md p-2.5">
              {error}
            </div>
          )}

          <Button type="submit" disabled={!ready} className="w-full">
            {submitting ? 'Signing in\u2026' : 'Sign in'}
          </Button>
          <p className="text-center text-[13px] text-cream-faint pt-2">
            Have an access code? <a href="/register" className="text-gold no-underline">Register</a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
