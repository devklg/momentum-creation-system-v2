/**
 * Today's Actions — DERIVED cockpit card (Chat #134, wireframe 3.3).
 *
 * Renders at the TOP of the cockpit. Reads GET /api/cockpit/todays-actions
 * (urgency-ordered: callbacks > due follow-ups > expiring windows). On any
 * item click, calls onJump(prospectId) so the parent page expands & scrolls
 * to the matching invite row.
 *
 * Empty state: still renders, with the locked-spec 1.9 bias prompt — "Who
 * are you sharing with today?" The card's job is to keep the BA pointed at
 * the next share even when their pipeline is quiet.
 *
 * Compliance (locked-spec 3.10): no income/placement/comp language. Labels
 * are operational ("asked for a callback", "follow-up due", "window closes
 * soon").
 *
 * Per .team TS6059 convention (cockpit.tsx file header): API wire shapes
 * declared locally rather than imported from @momentum/shared — the shared
 * `src` alias is outside this app's rootDir. Source of truth lives in
 * packages/shared/src/types.ts (CockpitActionItem / CockpitTodaysActionsResponse).
 */

import { useCallback, useEffect, useState } from 'react';

// ── Local wire shapes (mirror packages/shared/src/types.ts #134 block) ──

type CallbackIntent =
  | 'interested_tell_me_more'
  | 'have_questions'
  | 'ready_to_join';

type CockpitActionItem =
  | {
      kind: 'callback';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: string;
      intent: CallbackIntent | null;
    }
  | {
      kind: 'followup';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: string;
      followUpDueAt: string;
    }
  | {
      kind: 'expiring';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: string;
      expiresAt: string;
    };

interface CockpitTodaysActionsResponse {
  ok: true;
  actions: CockpitActionItem[];
  biasPrompt: string;
}

const INTENT_LABEL: Record<CallbackIntent, string> = {
  interested_tell_me_more: 'interested — tell me more',
  have_questions: 'has questions',
  ready_to_join: 'ready to join',
};

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; payload: CockpitTodaysActionsResponse };

export function TodaysActions({
  onJump,
}: {
  onJump: (prospectId: string) => void;
}) {
  const [view, setView] = useState<View>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cockpit/todays-actions', {
        credentials: 'include',
      });
      if (!res.ok) {
        setView({ kind: 'error', message: "Couldn't load today's actions." });
        return;
      }
      const data = (await res.json()) as CockpitTodaysActionsResponse;
      setView({ kind: 'ready', payload: data });
    } catch {
      setView({ kind: 'error', message: 'Network error.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (view.kind === 'loading') {
    return (
      <div className="mt-10">
        <SectionLabel>Today&rsquo;s Actions</SectionLabel>
        <div className="bg-cream/[0.02] border border-cream/10 rounded-md py-4 px-4">
          <p className="text-cream-faint font-mono text-[12px] tracking-[0.04em]">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <div className="mt-10">
        <SectionLabel>Today&rsquo;s Actions</SectionLabel>
        <div className="bg-cream/[0.02] border border-cream/10 rounded-md py-4 px-4">
          <p className="text-red-400 font-mono text-[12px] tracking-[0.04em]">
            {view.message}
          </p>
        </div>
      </div>
    );
  }

  const { actions, biasPrompt } = view.payload;

  if (actions.length === 0) {
    return (
      <div className="mt-10">
        <SectionLabel>Today&rsquo;s Actions</SectionLabel>
        <div className="bg-cream/[0.02] border border-gold/20 rounded-md py-8 px-6 text-center">
          <p className="font-display text-[22px] leading-[1.2] text-cream mb-1">
            Nothing pressing.
          </p>
          <p className="text-gold font-display text-[18px] leading-[1.3]">
            {biasPrompt}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <SectionLabel>Today&rsquo;s Actions</SectionLabel>
      <ul className="bg-cream/[0.02] border border-gold/20 rounded-md divide-y divide-cream/10">
        {actions.map((a, i) => (
          <li key={`${a.kind}-${a.prospectId}-${i}`}>
            <button
              type="button"
              onClick={() => onJump(a.prospectId)}
              className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-cream/[0.03] transition-colors"
            >
              <ActionBadge kind={a.kind} />
              <span className="flex-1 min-w-0">
                <span className="text-cream text-[15px]">
                  {a.firstName} {a.lastInitial}.
                </span>
                <span className="text-cream-faint text-[13px] ml-2">
                  {actionLabel(a)}
                </span>
              </span>
              <span className="font-mono text-[11px] text-cream-faint tracking-[0.04em] shrink-0">
                {formatActionAt(a)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono tracking-[0.18em] text-[11px] text-cream-mute uppercase mb-4">
      {children}
    </p>
  );
}

function ActionBadge({ kind }: { kind: CockpitActionItem['kind'] }) {
  const cfg =
    kind === 'callback'
      ? { label: 'CALLBACK', cls: 'text-gold border-gold/40 bg-gold/[0.06]' }
      : kind === 'followup'
        ? { label: 'FOLLOW-UP', cls: 'text-teal border-teal/40 bg-teal/[0.06]' }
        : { label: 'EXPIRING', cls: 'text-cream border-cream/30 bg-cream/[0.05]' };
  return (
    <span
      className={
        'inline-block font-mono tracking-[0.08em] text-[10px] px-2 py-0.5 rounded border shrink-0 ' +
        cfg.cls
      }
    >
      {cfg.label}
    </span>
  );
}

function actionLabel(a: CockpitActionItem): string {
  if (a.kind === 'callback') {
    return a.intent ? `· ${INTENT_LABEL[a.intent]}` : '· asked for a callback';
  }
  if (a.kind === 'followup') {
    return '· follow-up due';
  }
  return '· window closes soon';
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

function formatActionAt(a: CockpitActionItem): string {
  if (a.kind === 'followup') return `due ${formatDate(a.followUpDueAt)}`;
  if (a.kind === 'expiring') return `closes ${formatDate(a.expiresAt)}`;
  return formatDate(a.at);
}
