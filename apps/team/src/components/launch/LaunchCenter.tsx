/**
 * Launch Rail — the compact launch-path strip.
 *
 * Locked spec (TEAM design E.2): the Fast Start launch path is "a persistent
 * rail in the cockpit until all five modules are marked complete" — a rail,
 * not the page hero. The PMV owns the cockpit's prime real estate; this strip
 * carries progress + the single next action in one row, expandable to the
 * step list on demand, and renders NOTHING once the launch is complete.
 *
 * Removed from the old Launch Center (Kevin, Chat 2026-07-07):
 * - the full-viewport hero, mission card, side cards, and 10-card step grid
 * - the onboarding questionnaire step (drift — Michael's voice interview is
 *   the locked capture mechanism, TEAM design D)
 * Added: the Michael interview step surfaces when launch.michael.enabled
 * (runtime live or a record exists) — TEAM design D.2.
 *
 * Wire shapes declared locally per .team convention (TS6059 — see cockpit.tsx
 * header note). Source of truth: packages/shared/src/types.ts.
 */

import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type LaunchStepState =
  | 'complete'
  | 'current'
  | 'available'
  | 'locked'
  | 'optional';

export type LaunchStepId =
  | 'welcome_accepted'
  | 'steve_discovery_completed'
  | 'michael_interview_completed'
  | 'day_1_started'
  | 'day_1_completed'
  | 'who_do_you_know_started'
  | 'first_invitation_drafted'
  | 'first_invitation_minted'
  | 'first_invitation_sent'
  | 'sponsor_connection_confirmed';

export interface LaunchStep {
  id: LaunchStepId;
  label: string;
  state: LaunchStepState;
  source: string;
  href: string | null;
  completedAt: string | null;
  detail: string;
}

export interface TeamLaunchCenter {
  ok: true;
  generatedAt: string;
  baFirstName: string;
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  nextAction: {
    stepId: LaunchStepId | null;
    label: string;
    href: string | null;
    reason: string;
  };
  steps: LaunchStep[];
  steve: {
    phase: 'awaiting_call' | 'in_progress' | 'complete';
    completedAt: string | null;
  };
  michael: {
    enabled: boolean;
    complete: boolean;
    completedAt: string | null;
  };
  firstInvitation: {
    ivoryNames: number;
    draftedCount: number;
    mintedCount: number;
    sentCount: number;
  };
  fastStart: {
    day1State: 'not_started' | 'in_progress' | 'completed';
    day1StartedAt: string | null;
    day1CompletedAt: string | null;
    complete: boolean;
  };
  launchComplete: boolean;
}

interface LaunchCenterProps {
  launch: TeamLaunchCenter;
  onNavigate: (href: string) => void;
  /** Expanded step list shown by default (used on the locked pre-PMV view). */
  defaultExpanded?: boolean;
}

function stepIcon(state: LaunchStepState) {
  if (state === 'complete')
    return <CheckCircle2 className="h-4 w-4 text-teal shrink-0" aria-hidden="true" />;
  if (state === 'locked')
    return <Lock className="h-4 w-4 text-cream-faint shrink-0" aria-hidden="true" />;
  if (state === 'current')
    return <Circle className="h-4 w-4 text-gold shrink-0" aria-hidden="true" />;
  return <Circle className="h-4 w-4 text-cream-faint shrink-0" aria-hidden="true" />;
}

export function LaunchCenter({ launch, onNavigate, defaultExpanded = false }: LaunchCenterProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Locked spec E.2: the rail exists until launch completes, then it is gone.
  if (launch.launchComplete) return null;

  return (
    <section
      aria-label="Launch path"
      className="mb-6 border border-gold/25 bg-gold/[0.04] rounded-md"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-[170px]">
          <span className="font-mono tracking-[0.18em] text-[10px] text-gold uppercase">
            Launch
          </span>
          <div className="w-20 h-1.5 rounded-full bg-ink/60 border border-cream/10 overflow-hidden">
            <div
              className="h-full bg-gold"
              style={{ width: `${Math.max(0, Math.min(100, launch.progress.percent))}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-cream-faint">
            {launch.progress.completed}/{launch.progress.total}
          </span>
        </div>

        <p className="flex-1 min-w-[200px] text-cream text-[14px] leading-snug">
          <span className="text-cream-faint font-mono text-[10px] tracking-[0.14em] uppercase mr-2">
            Next
          </span>
          {launch.nextAction.label}
        </p>

        <div className="flex items-center gap-2">
          {launch.nextAction.href && (
            <Button
              onClick={() => onNavigate(launch.nextAction.href!)}
              className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-4 py-2 h-9"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse launch steps' : 'Show launch steps'}
            className="p-2 text-cream-mute hover:text-cream"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <ul className="border-t border-cream/10 px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
          {launch.steps.map((step) => (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => step.href && onNavigate(step.href)}
                disabled={!step.href || step.state === 'locked'}
                className="w-full flex items-center gap-2.5 py-1 text-left text-[13px] disabled:cursor-default group"
              >
                {stepIcon(step.state)}
                <span
                  className={
                    step.state === 'complete'
                      ? 'text-cream-faint line-through decoration-cream/20'
                      : step.state === 'current'
                        ? 'text-gold'
                        : step.state === 'locked'
                          ? 'text-cream-faint'
                          : 'text-cream-mute group-hover:text-cream'
                  }
                >
                  {step.label}
                </span>
                {step.id === 'who_do_you_know_started' && launch.firstInvitation.ivoryNames > 0 && (
                  <span className="font-mono text-[10px] text-teal ml-auto shrink-0">
                    {launch.firstInvitation.ivoryNames} names
                  </span>
                )}
                {step.id === 'first_invitation_minted' && launch.firstInvitation.mintedCount > 0 && (
                  <span className="font-mono text-[10px] text-teal ml-auto shrink-0">
                    {launch.firstInvitation.mintedCount} minted
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
