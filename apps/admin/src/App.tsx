/**
 * Admin app shell.
 *
 * Auth gate model:
 *  - status === 'loading'      → spinner
 *  - status === 'unauthed'     → /login route only
 *  - status === 'forbidden'    → /login with explanation (BA is valid but not admin)
 *  - status === 'authed'       → full admin shell with nav
 *
 * Routes mounted under authed shell:
 *  - / → redirect to /access-codes (the most-used surface)
 *  - /access-codes
 *  - /bas
 *
 * Server-side authorization is the actual gate; this is a UX layer.
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from '@/lib/auth';
import { AdminShell } from '@/components/admin-shell';
import { LoginPage } from '@/routes/login';
import { AccessCodesPage } from '@/routes/access-codes';
import { BAsPage } from '@/routes/bas';
import { ProspectsPage } from '@/routes/prospects';
import { QueuePage } from '@/routes/queue';
import { AuditPage } from '@/routes/audit';
import { DashboardPage } from '@/routes/dashboard';
import { LiveOpsPage } from '@/routes/live-ops';
import { ReportsPage } from '@/routes/reports';
import { BroadcastPage } from '@/routes/broadcast';

export function App() {
  return (
    <AdminAuthProvider>
      <Inner />
    </AdminAuthProvider>
  );
}

function Inner() {
  const { status } = useAdminAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-ink text-cream flex items-center justify-center">
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          Loading…
        </p>
      </div>
    );
  }

  if (status !== 'authed') {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/access-codes" element={<AccessCodesPage />} />
        <Route path="/bas" element={<BAsPage />} />
        <Route path="/prospects" element={<ProspectsPage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/live-ops" element={<LiveOpsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/broadcast" element={<BroadcastPage />} />
        <Route
          path="*"
          element={
            <div className="text-cream-mute font-mono text-sm">404 · not found</div>
          }
        />
      </Route>
    </Routes>
  );
}
