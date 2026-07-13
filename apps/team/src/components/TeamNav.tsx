/**
 * TeamNav — shared navigation bar for the .team client.
 *
 * Gap fix (Chat, 2026-07-06): every route in apps/team was an island — no
 * navigation links anywhere in the app. This bar gives every authenticated
 * BA-facing surface a persistent way to move between Cockpit (PMV),
 * Invitations, CRM, Ivory, Training, Video Library, Leadership, and Profile.
 *
 * Compliance (locked-spec): BA-facing .team surface only. Labels are
 * operational — no income, placement, or rank language. The .com prospect
 * funnel intentionally has NO navigation; do not reuse this component there.
 *
 * VM Dialer link is entitlement-gated with the same GET /api/auth/me check
 * the /vm-campaigns route guard uses (App.tsx VmDialerRoute), so BAs without
 * the vm_dialer entitlement never see a dead link.
 */

import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

type NavItem = { to: string; label: string; end?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: '/cockpit', label: 'Cockpit' },
  { to: '/launch', label: 'Launch' },
  { to: '/invitations', label: 'Invitations' },
  { to: '/crm', label: 'CRM' },
  { to: '/ivory', label: 'Ivory', end: true },
  { to: '/training/fast-start', label: 'Training' },
  { to: '/video-library', label: 'Videos' },
  { to: '/resources', label: 'Resources' },
  { to: '/leadership', label: 'Leadership' },
  { to: '/profile', label: 'Profile' },
];

function linkClass(isActive: boolean): string {
  return [
    'whitespace-nowrap px-3 py-2 text-xs font-body tracking-label uppercase transition-colors',
    isActive
      ? 'text-gold border-b-2 border-gold'
      : 'text-cream-mute border-b-2 border-transparent hover:text-cream',
  ].join(' ');
}

export function TeamNav() {
  const [vmDialer, setVmDialer] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = (await res.json()) as { ok?: boolean; me?: { entitlements?: string[] } };
        return data.ok === true && (data.me?.entitlements ?? []).includes('vm_dialer');
      })
      .then((next) => {
        if (!cancelled) setVmDialer(next);
      })
      .catch(() => {
        if (!cancelled) setVmDialer(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items: NavItem[] = vmDialer
    ? [...NAV_ITEMS.slice(0, 3), { to: '/vm-campaigns', label: 'VM Dialer' }, ...NAV_ITEMS.slice(3)]
    : NAV_ITEMS;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4">
        <Link
          to="/cockpit"
          className="flex shrink-0 items-baseline gap-2 py-3"
          aria-label="Team Magnificent — Cockpit"
        >
          <span className="font-display text-xl leading-none tracking-wide2 text-gold">
            TEAM MAGNIFICENT
          </span>
        </Link>

        {/* Desktop links */}
        <nav aria-label="Primary" className="hidden flex-1 items-center md:flex">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => linkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          className="ml-auto p-2 text-cream-mute hover:text-cream md:hidden"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile links */}
      {open ? (
        <nav aria-label="Primary mobile" className="border-t border-line md:hidden">
          <div className="flex flex-col px-2 py-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  [
                    'px-3 py-2.5 text-sm font-body tracking-label uppercase transition-colors',
                    isActive ? 'text-gold' : 'text-cream-mute hover:text-cream',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
