/**
 * Track Record card (Chat #147) — the BA's own invitation track-record on
 * .team. Authority: dec_leadership_credibility_and_track_record (seq 25),
 * surface (2): the .team BA TRACK-RECORD = each BA's own invitation activity
 * (invitations generated + who they're bringing in) as their personal success
 * indicator. The thesis the card makes visible: more invitations → more of the
 * team finding you.
 *
 * DISPLAY LAYER, not new capture. This component derives everything from the
 * invites array the cockpit has ALREADY loaded (GET /api/cockpit/invites) — no
 * new route, no new persistent write. It reframes that same spine data as a
 * record-of-activity narrative the counts strip can't show: momentum over time
 * + the named people the BA is bringing in.
 *
 * COMPLIANCE (decision seq 25, locked-spec 3.10): this is an ACTIVITY metric —
 * counts of invitations and sign-ups — NEVER income, earnings, comp math, or
 * placement promises. It lives on .team precisely so a brand-new BA's low count
 * is never exposed raw to a prospect as a weak-credibility signal; .com
 * credibility is the founders (Paul/Kevin) surface, a separate lane. No
 * dollars, no projections, no queue-position guarantees appear here.
 *
 * Per .team convention (cockpit.tsx, TodaysActions.tsx): wire shapes are
 * declared locally rather than imported from @momentum/shared (the shared `src`
 * alias is outside this app's rootDir and trips TS6059). Source of truth for
 * InviteSummary is packages/shared/src/types.ts.
 */

import { useMemo } from 'react';

// ── Local wire shape (subset of InviteSummary the card needs) ──────────────

type InviteDisplayStatus =
  | 'draft'
  | 'sent'
  | 'opened'
  | 'watched'
  | 'callback'
  | 'enrolled'
  | 'expired';

interface TrackRecordInvite {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  status: InviteDisplayStatus;
  positionNumber: number | null;
  becameCustomer: boolean;
  sentAt: string | null;
  createdAt: string;
}

// ── Derivation helpers ─────────────────────────────────────────────────────

// A prospect reached video_complete if they were placed in the team pool
// (positionNumber is anchored at video_complete) or progressed past it.
function reachedComplete(i: TrackRecordInvite): boolean {
  return (
    i.positionNumber !== null ||
    i.status === 'watched' ||
    i.status === 'callback' ||
    i.status === 'enrolled'
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS_SHOWN = 8;

// Monday-anchored start of the week containing `d`, in local time.
function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}

interface WeekBucket {
  start: number; // ms epoch at week start
  label: string; // short month/day for the axis
  count: number;
}

function buildWeeks(invites: TrackRecordInvite[]): WeekBucket[] {
  const thisWeek = startOfWeek(new Date()).getTime();
  const buckets: WeekBucket[] = [];
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    const start = thisWeek - i * WEEK_MS;
    buckets.push({
      start,
      label: new Date(start).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      count: 0,
    });
  }
  const earliest = buckets[0]!.start;
  for (const inv of invites) {
    const t = new Date(inv.createdAt).getTime();
    if (Number.isNaN(t) || t < earliest) continue;
    // Find the bucket whose window contains this timestamp.
    const idx = Math.min(
      WEEKS_SHOWN - 1,
      Math.floor((t - earliest) / WEEK_MS),
    );
    if (idx >= 0) buckets[idx]!.count += 1;
  }
  return buckets;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ── Card ───────────────────────────────────────────────────────────────────

export function TrackRecordCard({ invites }: { invites: TrackRecordInvite[] }) {
  const stats = useMemo(() => {
    const generated = invites.length;
    const sent = invites.filter((i) => i.sentAt !== null).length;
    const watched = invites.filter(reachedComplete).length;
    const broughtIn = invites.filter((i) => i.status === 'enrolled');
    const customers = invites.filter(
      (i) => i.becameCustomer && i.status !== 'enrolled',
    ).length;
    const weeks = buildWeeks(invites);
    const last30 = invites.filter((i) => {
      const t = new Date(i.createdAt).getTime();
      return !Number.isNaN(t) && t >= Date.now() - 30 * 24 * 60 * 60 * 1000;
    }).length;
    return { generated, sent, watched, broughtIn, customers, weeks, last30 };
  }, [invites]);

  // Nothing generated yet — a forward-looking empty state, not a zero wall.
  if (stats.generated === 0) {
    return (
      <section className="mt-12">
        <SectionLabel>Your track record</SectionLabel>
        <div className="bg-cream/[0.02] border border-cream/10 rounded-md py-8 px-6">
          <p className="text-cream-mute text-[15px] leading-[1.6] max-w-xl">
            This is where your record builds. Every invitation you generate is
            logged here — and as people watch and join, you&rsquo;ll see exactly
            who you&rsquo;re bringing into the team. The record starts with your
            first link.
          </p>
        </div>
      </section>
    );
  }

  const maxWeek = Math.max(1, ...stats.weeks.map((w) => w.count));

  return (
    <section className="mt-12">
      <SectionLabel>Your track record</SectionLabel>

      <div className="bg-cream/[0.02] border border-cream/10 rounded-md p-6 space-y-7">
        {/* Headline: the activity metric the BA controls. */}
        <div>
          <p className="font-display text-[clamp(44px,8vw,72px)] leading-[0.9] text-gold">
            {stats.generated}
          </p>
          <p className="font-mono tracking-[0.12em] text-[11px] text-cream-mute uppercase mt-2">
            Invitations generated
          </p>
          <p className="text-cream-mute text-[14px] leading-[1.6] mt-3 max-w-xl">
            This is your record. More invitations is the one thing that
            compounds &mdash; every link is a person you reached, and the team
            forms around the people who keep generating them.
            {stats.last30 > 0 && (
              <>
                {' '}
                <span className="text-teal">
                  {stats.last30} in the last 30 days.
                </span>
              </>
            )}
          </p>
        </div>

        {/* Funnel-as-proof: generated → watched → brought in. Activity only. */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sent" value={stats.sent} />
          <Stat label="Watched it through" value={stats.watched} />
          <Stat
            label="Joining you"
            value={stats.broughtIn.length}
            accent
          />
        </div>

        {/* Momentum: invitations generated per week, last 8 weeks. */}
        <div>
          <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mb-3">
            Invitations per week
          </p>
          <div className="flex items-end gap-1.5 h-24">
            {stats.weeks.map((w) => (
              <div
                key={w.start}
                className="flex-1 flex flex-col items-center justify-end h-full"
                title={`${w.count} the week of ${w.label}`}
              >
                <span className="font-mono text-[10px] text-cream-faint mb-1">
                  {w.count > 0 ? w.count : ''}
                </span>
                <div
                  className={
                    'w-full rounded-sm ' +
                    (w.count > 0 ? 'bg-gold/70' : 'bg-cream/[0.06]')
                  }
                  style={{
                    height: `${Math.max(w.count > 0 ? 6 : 2, (w.count / maxWeek) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {stats.weeks.map((w, idx) => (
              <span
                key={w.start}
                className="flex-1 text-center font-mono text-[9px] text-cream-faint tracking-[0.02em]"
              >
                {idx % 2 === 0 ? w.label : ''}
              </span>
            ))}
          </div>
        </div>

        {/* Who you're bringing in — the named result, the heart of the record. */}
        <div className="border-t border-cream/10 pt-6">
          <p className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase mb-3">
            Who you&rsquo;re bringing in
          </p>
          {stats.broughtIn.length === 0 ? (
            <p className="text-cream-mute text-[14px] leading-[1.6] max-w-xl">
              The first person you bring in shows up here by name. It starts
              with the next invitation &mdash; keep the record moving.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {stats.broughtIn.map((p) => (
                <li
                  key={p.prospectId}
                  className="inline-flex items-center gap-2 bg-teal/[0.06] border border-teal/30 rounded-md px-3 py-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-teal shrink-0" />
                  <span className="text-cream text-[14px]">
                    {p.firstName} {p.lastInitial}.
                  </span>
                  <span className="font-mono text-[10px] text-cream-faint tracking-[0.04em]">
                    {formatDate(p.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {stats.customers > 0 && (
            <p className="text-cream-faint text-[13px] leading-[1.55] mt-3">
              Plus {stats.customers}{' '}
              {stats.customers === 1 ? 'person' : 'people'} you&rsquo;ve brought
              on as {stats.customers === 1 ? 'a customer' : 'customers'}.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono tracking-[0.18em] text-[11px] text-cream-mute uppercase mb-4">
      {children}
    </p>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-cream/[0.02] border border-cream/10 rounded-md py-4 px-4">
      <p
        className={
          'font-display text-[30px] leading-none ' +
          (accent ? 'text-teal' : 'text-cream')
        }
      >
        {value}
      </p>
      <p className="font-mono tracking-[0.08em] text-[10px] text-cream-faint uppercase mt-2 leading-[1.3]">
        {label}
      </p>
    </div>
  );
}
