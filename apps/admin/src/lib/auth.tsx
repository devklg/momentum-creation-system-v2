/**
 * Admin auth context.
 *
 * Single login surface (POST /api/auth/login — same endpoint as .team).
 * Server-side middleware on /api/admin/* enforces the ADMIN_BA_IDS env-var allowlist
 * per locked-spec.md Part 3.1 + ADMIN Design Section A.2.
 *
 * This context calls GET /api/auth/me on mount; if the BA is not in the admin
 * allowlist, the server returns isAdmin: false and we redirect to /login.
 * Non-admin BAs cannot reach any /admin/* route at runtime.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface AdminMe {
  baId: string;
  threeBaId: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
}

interface AdminAuthState {
  status: 'loading' | 'authed' | 'unauthed' | 'forbidden';
  me: AdminMe | null;
  /** Re-fetch /api/auth/me. Call after login. */
  refresh: () => Promise<void>;
  /** Clear session client-side and hit /api/auth/logout. */
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminAuthState['status']>('loading');
  const [me, setMe] = useState<AdminMe | null>(null);

  const refresh = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.status === 401) {
        setMe(null);
        setStatus('unauthed');
        return;
      }
      if (!res.ok) {
        setMe(null);
        setStatus('unauthed');
        return;
      }
      const data = (await res.json()) as { ok: boolean; me?: AdminMe };
      if (!data.ok || !data.me) {
        setMe(null);
        setStatus('unauthed');
        return;
      }
      setMe(data.me);
      setStatus(data.me.isAdmin ? 'authed' : 'forbidden');
    } catch {
      setMe(null);
      setStatus('unauthed');
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // swallow; we clear client state regardless
    }
    setMe(null);
    setStatus('unauthed');
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AdminAuthState>(
    () => ({ status, me, refresh, logout }),
    [status, me],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
