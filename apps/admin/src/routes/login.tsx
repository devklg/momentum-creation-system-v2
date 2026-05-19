/**
 * /login — Admin login.
 *
 * Hits POST /api/auth/login (same endpoint as .team). On success, refreshes
 * /api/auth/me. If the returned BA is in ADMIN_BA_IDS, AdminAuthProvider
 * flips status to 'authed' and the gate in App.tsx renders the shell.
 * If they're a valid BA but not an admin, status flips to 'forbidden' and
 * we show a clear message; we do NOT silently dump them on the .team app.
 */

import { useState, type FormEvent } from 'react';
import { useAdminAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginPage() {
  const { status, refresh } = useAdminAuth();
  const [baId, setBaId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baId: baId.trim(), password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? 'Sign in failed.');
        return;
      }
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setError(`Network error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-3">
          Team Magnificent
        </p>
        <h1 className="font-display text-[44px] leading-none mb-2">Admin</h1>
        <p className="text-cream-mute text-sm mb-8">
          Restricted access. Sign in with your BA credentials.
        </p>

        {status === 'forbidden' && (
          <div className="mb-6 p-4 border border-line rounded-md bg-cream/[0.025]">
            <p className="text-[11px] font-mono tracking-label text-gold uppercase mb-1">
              Not authorized
            </p>
            <p className="text-sm text-cream-mute">
              Your BA account is valid but does not have admin access. Contact Kevin if this is
              wrong.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="baId">TM BA ID</Label>
            <Input
              id="baId"
              value={baId}
              onChange={(e) => setBaId(e.target.value)}
              placeholder="TMBA-XXXX"
              autoComplete="username"
              required
              disabled={submitting}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">{error}</p>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Signing in\u2026' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
