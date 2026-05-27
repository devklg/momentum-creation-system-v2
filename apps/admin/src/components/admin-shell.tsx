/**
 * Admin shell layout. Persistent sidebar nav, top bar, content slot.
 * Used by every authenticated /admin route.
 *
 * Density: this is the back-office surface, not the cinematic .com or the
 * focused .team. Tight type, dense rows, low chrome.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { useAdminAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  label: string;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Core Dashboard' },
  { to: '/access-codes', label: 'Access Codes' },
  { to: '/bas', label: 'Brand Ambassadors' },
  { to: '/prospects', label: 'Prospect Oversight' },
  { to: '/queue', label: 'Queue Oversight' },
  { to: '/audit', label: 'Audit Log' },
  { to: '/broadcast', label: 'Broadcast' },
];

export function AdminShell() {
  const { me, logout } = useAdminAuth();

  return (
    <div className="min-h-screen bg-ink text-cream grid grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <aside className="border-r border-line flex flex-col">
        <div className="px-5 py-6 border-b border-line">
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">
            Team Magnificent
          </p>
          <p className="font-display tracking-wide text-[22px] text-cream mt-1">Admin</p>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'block px-5 py-2.5 text-sm font-body transition-colors',
                  isActive
                    ? 'bg-cream/[0.04] text-cream border-l-2 border-gold'
                    : 'text-cream-mute hover:text-cream border-l-2 border-transparent',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-5 py-4">
          {me && (
            <>
              <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase mb-1">
                Signed in
              </p>
              <p className="text-sm text-cream mb-3">{me.fullName}</p>
              <p className="text-[11px] font-mono text-cream-mute mb-3">{me.baId}</p>
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                Sign Out
              </Button>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
