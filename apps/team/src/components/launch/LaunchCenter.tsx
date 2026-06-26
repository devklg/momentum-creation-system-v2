import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  Lock,
  Send,
  UserRoundCheck,
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
  | 'day_1_started'
  | 'day_1_completed'
  | 'who_do_you_know_started'
  | 'first_invitation_drafted'
  | 'first_invitation_minted'
  | 'first_invitation_sent'
  | 'questionnaire_submitted'
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
  questionnaireSubmitted: boolean;
  launchComplete: boolean;
}

interface LaunchCenterProps {
  launch: TeamLaunchCenter;
  onNavigate: (href: string) => void;
}

const STATE_COPY: Record<LaunchStepState, { label: string; className: string }> = {
  complete: {
    label: 'Complete',
    className: 'border-teal/35 bg-teal/[0.08] text-teal',
  },
  current: {
    label: 'Current',
    className: 'border-gold/55 bg-gold/[0.1] text-gold',
  },
  available: {
    label: 'Available',
    className: 'border-cream/20 bg-cream/[0.04] text-cream',
  },
  locked: {
    label: 'Locked',
    className: 'border-cream/10 bg-transparent text-cream-faint',
  },
  optional: {
    label: 'Optional',
    className: 'border-cream/15 bg-cream/[0.02] text-cream-mute',
  },
};

function statusIcon(state: LaunchStepState) {
  if (state === 'complete') return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (state === 'locked') return <Lock className="h-4 w-4" aria-hidden="true" />;
  return <Circle className="h-4 w-4" aria-hidden="true" />;
}

function formatSteveStatus(phase: TeamLaunchCenter['steve']['phase']): string {
  switch (phase) {
    case 'awaiting_call':
      return 'Awaiting discovery';
    case 'in_progress':
      return 'In progress';
    case 'complete':
      return 'Complete';
  }
}

function navigateIfPossible(href: string | null, onNavigate: (href: string) => void) {
  if (href) onNavigate(href);
}

export function LaunchCenter({ launch, onNavigate }: LaunchCenterProps) {
  const showFirstInvitationMission = launch.firstInvitation.mintedCount === 0;
  const firstInvitationUnlocked = launch.steve.phase === 'complete';

  return (
    <section className="mb-10" aria-labelledby="launch-center-title">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="border border-gold/25 bg-gold/[0.045] rounded-md p-6 sm:p-8">
          <p className="font-mono tracking-[0.22em] text-[11px] text-gold uppercase mb-3">
            Team Magnificent Launch Center
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <h1
                id="launch-center-title"
                className="font-display text-[clamp(34px,5vw,58px)] leading-[0.98] text-cream"
              >
                {launch.baFirstName ? `${launch.baFirstName}, launch from here.` : 'Launch from here.'}
              </h1>
              <p className="text-cream-mute text-[15px] leading-[1.6] mt-4 max-w-2xl">
                One path, one next action. You own every relationship and every send.
              </p>
            </div>
            <div className="min-w-[190px]">
              <div className="h-2 rounded-full bg-ink/60 border border-cream/10 overflow-hidden">
                <div
                  className="h-full bg-gold"
                  style={{ width: `${Math.max(0, Math.min(100, launch.progress.percent))}%` }}
                />
              </div>
              <p className="font-mono tracking-[0.12em] text-[11px] text-cream-faint uppercase mt-3">
                {launch.progress.completed}/{launch.progress.total} launch steps
              </p>
            </div>
          </div>

          <div className="mt-7 border border-cream/10 bg-ink/45 rounded-md p-5">
            <p className="font-mono tracking-[0.16em] text-[11px] text-cream-faint uppercase mb-2">
              Next action
            </p>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-display text-[28px] leading-[1.05] text-cream">
                  {launch.nextAction.label}
                </h2>
                <p className="text-cream-mute text-[14px] leading-[1.55] mt-2">
                  {launch.nextAction.reason}
                </p>
              </div>
              {launch.nextAction.href && (
                <Button
                  onClick={() => onNavigate(launch.nextAction.href!)}
                  className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-6 py-5 shrink-0"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          {showFirstInvitationMission && (
            <div className="mt-5 border border-teal/25 bg-teal/[0.055] rounded-md p-5">
              <div className="flex items-start gap-3">
                <Send className="h-5 w-5 text-teal mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-mono tracking-[0.16em] text-[11px] text-teal uppercase mb-2">
                    First Invitation Mission
                  </p>
                  <h2 className="font-display text-[26px] leading-[1.08] text-cream">
                    Choose one real person and prepare one clean invitation.
                  </h2>
                  <p className="text-cream-mute text-[14px] leading-[1.6] mt-3 max-w-2xl">
                    Ivory can help you organize names and shape a message, but it does not
                    prospect, rank people, call anyone, or send for you.
                  </p>
                  <Button
                    onClick={() =>
                      onNavigate(
                        firstInvitationUnlocked
                          ? '/ivory'
                          : launch.nextAction.href ?? '/steve/discovery',
                      )
                    }
                    className="mt-5 bg-cream/[0.06] text-cream hover:bg-cream/[0.1] border border-cream/15 font-display tracking-[0.06em] text-[14px] px-5 py-4"
                  >
                    {firstInvitationUnlocked ? 'Open Ivory' : 'Finish launch gate'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="border border-cream/10 bg-cream/[0.02] rounded-md p-5">
            <div className="flex items-start gap-3">
              <UserRoundCheck className="h-5 w-5 text-gold mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-mono tracking-[0.16em] text-[11px] text-cream-faint uppercase mb-2">
                  Steve
                </p>
                <p className="font-display text-[25px] text-cream leading-tight">
                  {formatSteveStatus(launch.steve.phase)}
                </p>
                <p className="text-cream-mute text-[13px] leading-[1.5] mt-2">
                  {launch.steve.phase === 'complete'
                    ? 'Your Success Profile is ready.'
                    : 'Complete Steve before the launch path opens.'}
                </p>
              </div>
            </div>
          </div>

          <div className="border border-cream/10 bg-cream/[0.02] rounded-md p-5">
            <div className="flex items-start gap-3">
              <ClipboardList className="h-5 w-5 text-teal mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-mono tracking-[0.16em] text-[11px] text-cream-faint uppercase mb-2">
                  First invite
                </p>
                <p className="font-display text-[25px] text-cream leading-tight">
                  {launch.firstInvitation.sentCount > 0
                    ? 'Sent'
                    : launch.firstInvitation.mintedCount > 0
                      ? 'Ready to send'
                      : 'Not started'}
                </p>
                <p className="text-cream-mute text-[13px] leading-[1.5] mt-2">
                  {launch.firstInvitation.ivoryNames} Ivory names,{' '}
                  {launch.firstInvitation.mintedCount} invitation links.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {launch.steps.map((step) => {
          const meta = STATE_COPY[step.state];
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => navigateIfPossible(step.href, onNavigate)}
              disabled={!step.href || step.state === 'locked'}
              className="text-left border border-cream/10 bg-cream/[0.02] rounded-md p-4 hover:border-gold/35 transition-colors disabled:hover:border-cream/10 disabled:cursor-default"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-mono text-[10px] tracking-[0.08em] uppercase ${meta.className}`}>
                  {statusIcon(step.state)}
                  {meta.label}
                </span>
              </div>
              <p className="font-display text-[20px] leading-[1.08] text-cream">
                {step.label}
              </p>
              <p className="text-cream-faint text-[12px] leading-[1.45] mt-2">
                {step.detail}
              </p>
              <p className="font-mono tracking-[0.08em] text-[10px] text-cream-faint uppercase mt-3">
                {step.source}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
