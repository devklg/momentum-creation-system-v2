/**
 * Multi-agent support card for `.team` cockpit.
 *
 * Uses `/api/agents/support` to run Michael (training support) and/or Ivory
 * (warm-market/list-building prompts) in one BA-authenticated call.
 */

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Bot } from 'lucide-react';

type RequestedAgent = 'michael' | 'ivory' | 'both';
type MichaelResponseType = 'next_training_step' | 'clarification_question' | 'safe_fallback' | 'safe_close';
type IvoryAngle = 'do_the_business' | 'make_money' | 'lose_fat' | 'unspecified';

interface MichaelSupportResult {
  agent: 'michael';
  status: 'ready' | 'disabled' | 'response_disabled' | 'error';
  text: string;
  responseType?: MichaelResponseType;
  language?: 'en' | 'es';
  nextStep?: {
    title?: string;
    instruction?: string;
    label?: string;
  };
  supportingContext?: Array<{ title: string; summary: string }>;
}

interface IvorySupportResult {
  agent: 'ivory';
  status: 'ready' | 'error';
  coaching: string;
  prompts: string[];
  degraded: boolean;
  angle: IvoryAngle;
  rosterSize: number;
}

type AgentSupportItem = MichaelSupportResult | IvorySupportResult;

interface AgentSupportResponse {
  ok: true;
  generatedAt: string;
  requestedAgent: RequestedAgent;
  items: AgentSupportItem[];
}

const AGENT_PURPOSES = [
  {
    name: 'Michael',
    colorClass: 'text-gold',
    description:
      'Training agent for product and recruiting. Michael helps with education, coaching, and next best actions.',
  },
  {
    name: 'Ivory',
    colorClass: 'text-teal',
    description:
      'List-building and invitation agent for who you know. Ivory generates invite wording and supports invitation follow-through.',
  },
  {
    name: 'Steve',
    colorClass: 'text-cream-faint',
    description:
      'Success interviewer and success support. Steve checks progress, interviews milestones, and keeps your momentum steady.',
  },
] as const;

const AGENT_INTROS = [
  {
    name: 'Michael',
    role: 'Training Agent',
    intro:
      'Hi, I am Michael. I help you learn the product, recruiting basics, and how to keep your momentum strong through practical training prompts.',
    colorClass: 'text-gold',
  },
  {
    name: 'Ivory',
    role: 'List & Invite Agent',
    intro:
      'Hi, I am Ivory. I help you identify and build your invite list from people you know, then guide the outreach and next steps.',
    colorClass: 'text-teal',
  },
  {
    name: 'Steve',
    role: 'Success Interview & Support Agent',
    intro:
      'Hi, I am Steve. I check your progress, run success interviews, and help you remove momentum blockers so you keep moving.',
    colorClass: 'text-cream-faint',
  },
] as const;

const AGENT_BUSINESS_FLOW = [
  {
    step: 'Step 1',
    title: 'Get clear on what to do',
    agent: 'Michael',
    description:
      'Ask for training prompts on product and recruiting to start each work session with a focused action.',
    colorClass: 'text-gold',
  },
  {
    step: 'Step 2',
    title: 'Build your warm pipeline',
    agent: 'Ivory',
    description:
      'Turn people you know into invite-ready prospects, send invitations, and keep your list moving forward.',
    colorClass: 'text-teal',
  },
  {
    step: 'Step 3',
    title: 'Keep momentum',
    agent: 'Steve',
    description:
      'Use success interviews to review progress, unblock blockers, and stay consistent week after week.',
    colorClass: 'text-cream-faint',
  },
] as const;

function isMichael(item: AgentSupportItem): item is MichaelSupportResult {
  return item.agent === 'michael';
}

function isIvory(item: AgentSupportItem): item is IvorySupportResult {
  return item.agent === 'ivory';
}

async function resolveAgentSupport(args: {
  requestedAgent: RequestedAgent;
  ask: string;
  language: 'en' | 'es';
  angle: IvoryAngle;
  productName?: string;
  rosterSize?: number;
}): Promise<AgentSupportResponse | null> {
  const body: {
    agent: RequestedAgent;
    language: 'en' | 'es';
    ask: string;
    angle?: 'do_the_business' | 'make_money' | 'lose_fat' | 'unspecified';
    productName?: string;
    rosterSize?: number;
  } = {
    agent: args.requestedAgent,
    language: args.language,
    ask: args.ask,
  };
  if (args.angle) body.angle = args.angle;
  if (args.productName) body.productName = args.productName;
  if (args.rosterSize !== undefined) body.rosterSize = args.rosterSize;

  const res = await fetch('/api/agents/support', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;

  const payload = (await res.json()) as AgentSupportResponse;
  if (!payload.ok || !Array.isArray(payload.items)) return null;
  return payload;
}

export function AgentRuntimeSupportCard() {
  const [agent, setAgent] = useState<RequestedAgent>('both');
  const [ask, setAsk] = useState('');
  const [result, setResult] = useState<AgentSupportResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [showIntro, setShowIntro] = useState(false);
  const [introStorageKey, setIntroStorageKey] = useState('mcs-agent-intro-dismissed:default');
  const modeLabel =
    agent === 'both' ? 'Michael + Ivory' : agent === 'michael' ? 'Michael' : 'Ivory';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const value = window.localStorage.getItem(introStorageKey);
    setShowIntro(value !== '1');
  }, [introStorageKey]);

  function hideIntroPermanently() {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(introStorageKey, '1');
    setShowIntro(false);
  }

  function showIntroAgain() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(introStorageKey);
    setShowIntro(true);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;

    void (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Unable to load identity.');
        const payload = (await res.json()) as { tmagId?: string };
        const baId =
          typeof payload.tmagId === 'string' && payload.tmagId.trim() !== '' ? payload.tmagId.trim() : 'default';
        const key = `mcs-agent-intro-dismissed:${baId}`;
        if (!active) return;
        setIntroStorageKey(key);
      } catch {
        if (!active) return;
        setIntroStorageKey('mcs-agent-intro-dismissed:default');
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const load = useCallback((payload: { requestedAgent: RequestedAgent; ask: string }) => {
    setState('loading');
    void resolveAgentSupport({
      requestedAgent: payload.requestedAgent,
      language: 'en',
      ask: payload.ask,
      angle: 'unspecified',
    }).then((payload) => {
      if (!payload) {
        setState('error');
        return;
      }
      setResult(payload);
      setState('ready');
    });
  }, []);

  useEffect(() => {
    void load({ requestedAgent: 'both', ask: '' });
  }, [attempt, load]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedAsk = ask.replace(/\s+/g, ' ').trim();
    void load({ requestedAgent: agent, ask: normalizedAsk });
  }

  return (
    <section
      aria-label="Multi-agent support"
      className="bg-cream/[0.02] border border-gold/25 rounded-md p-5 space-y-4"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-gold/30 bg-gold/[0.06] text-gold">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-[24px] leading-none text-cream">Agent Support</p>
          <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mt-1">
            Michael • Ivory • Steve
          </p>
        </div>
      </div>

      {showIntro ? (
        <div className="border border-gold/20 rounded-md p-4 bg-ink/35 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-cream text-[13px] leading-[1.45]">
              This cockpit is your operating room for building your business: training, invitation
              execution, and momentum support live in one place.
            </p>
            <button
              type="button"
              onClick={hideIntroPermanently}
              className="font-mono uppercase tracking-[0.1em] text-[10px] text-gold hover:underline shrink-0"
            >
              Got it
            </button>
          </div>
          <p className="text-cream-mute text-[12px] leading-[1.45]">
            How to use it:
          </p>
          <ul className="space-y-1.5">
            {AGENT_BUSINESS_FLOW.map((step) => (
              <li key={step.step} className="text-[12px] leading-[1.45]">
                <span className={`font-mono uppercase tracking-[0.1em] text-[10px] ${step.colorClass} mr-2`}>
                  {step.step} · {step.agent}:
                </span>
                <span className="text-cream-mute">
                  {' '}
                  <strong>{step.title}:</strong> {step.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-cream-mute text-[11px] leading-[1.45]">
          Want a quick start on how the three agents work?{' '}
          <button
            type="button"
            onClick={showIntroAgain}
            className="font-mono uppercase tracking-[0.1em] text-[10px] text-gold hover:underline"
          >
            Show again
          </button>
        </p>
      )}

      <p className="text-cream-mute text-[12px] leading-[1.45]">
        New here? Each agent has one role:
      </p>
      <ul className="space-y-1.5">
        {AGENT_PURPOSES.map((agent) => (
          <li key={agent.name} className="text-[12px] leading-[1.45]">
            <span className={`font-mono uppercase tracking-[0.1em] text-[10px] ${agent.colorClass} mr-2`}>
              {agent.name}:
            </span>
            <span className="text-cream-mute">{agent.description}</span>
          </li>
        ))}
      </ul>

      <div className="border border-gold/20 rounded-md p-4 bg-ink/35 space-y-2">
        <p className="text-cream text-[12px] leading-[1.45]">
          New member intro:
        </p>
        <ul className="space-y-2">
          {AGENT_INTROS.map((agent) => (
            <li key={agent.name} className="text-[12px] leading-[1.45]">
              <span className={`font-mono uppercase tracking-[0.1em] text-[10px] ${agent.colorClass} mr-2`}>
                {agent.name} · {agent.role}
              </span>
              <span className="text-cream-mute"> {agent.intro}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAgent('both')}
          className={`px-3 py-2 text-[12px] border rounded ${
            agent === 'both'
              ? 'border-gold text-gold'
              : 'border-cream/20 text-cream-faint'
          }`}
        >
          Both
        </button>
        <button
          type="button"
          onClick={() => setAgent('michael')}
          className={`px-3 py-2 text-[12px] border rounded ${
            agent === 'michael'
              ? 'border-gold text-gold'
              : 'border-cream/20 text-cream-faint'
          }`}
        >
          Michael
        </button>
        <button
          type="button"
          onClick={() => setAgent('ivory')}
          className={`px-3 py-2 text-[12px] border rounded ${
            agent === 'ivory'
              ? 'border-gold text-gold'
              : 'border-cream/20 text-cream-faint'
          }`}
        >
          Ivory
        </button>
      </div>

      <form className="flex gap-2" onSubmit={submit}>
        <input
          value={ask}
          onChange={(event) => setAsk(event.target.value.slice(0, 500))}
          aria-label="What should I work on now?"
          placeholder="Tell agents what you want help with…"
          className="min-w-0 flex-1 rounded border border-gold/20 bg-ink/40 px-3 py-2 text-[13px] text-cream placeholder:text-cream-faint focus:border-gold/50 focus:outline-none"
        />
        <button
          type="submit"
          className="bg-gold text-ink rounded px-3 text-[13px] font-mono tracking-[0.12em] hover:bg-gold-bright"
          disabled={state === 'loading'}
        >
          Ask
        </button>
      </form>

      <p className="text-[11px] leading-[1.45] text-cream-faint">
        Steve guidance is available in the Steve discovery/support flow.
      </p>

      {state === 'loading' && (
        <p className="text-cream-mute text-[13px] leading-[1.45]">
          Generating your next moves from {modeLabel}…
        </p>
      )}
      {state === 'error' && (
        <>
          <p className="text-red-400 text-[13px] leading-[1.45]">
            Couldn&rsquo;t load support right now. Try again.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((prev) => prev + 1)}
            className="font-mono tracking-[0.12em] text-[10px] text-gold uppercase underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </>
      )}

      {state === 'ready' && result ? (
        <div className="space-y-4">
          {result.items.length === 0 ? (
            <p className="text-cream-mute text-[13px] leading-[1.5]">
              No guidance is available for this selection yet.
            </p>
          ) : (
            <>
              {result.items.filter(isMichael).map((item) => (
                <article key={item.agent} className="border border-gold/15 rounded p-4 bg-ink/30">
                  <p className="font-mono tracking-[0.14em] text-[10px] text-gold uppercase mb-2">
                    Michael — Training
                  </p>
                  {item.status === 'disabled' && (
                    <p className="text-cream-mute text-[13px] leading-[1.5]">
                      Michael support is not available yet.
                    </p>
                  )}
                  {item.status === 'response_disabled' && (
                    <p className="text-cream-mute text-[13px] leading-[1.5]">
                      Michael support is temporarily paused.
                    </p>
                  )}
                  {item.status === 'error' && (
                    <p className="text-cream-mute text-[13px] leading-[1.5]">
                      Couldn&rsquo;t load Michael support right now.
                    </p>
                  )}
                  {item.status === 'ready' && (
                    <>
                      {item.text && (
                        <p className="text-cream text-[13px] leading-[1.55] mb-3">
                          {item.text}
                        </p>
                      )}
                      {item.nextStep && (item.nextStep.title || item.nextStep.instruction) && (
                        <div className="border-l border-gold/30 pl-4">
                          {item.nextStep.title && (
                            <p className="text-gold font-mono text-[10px] uppercase">
                              {item.nextStep.title}
                            </p>
                          )}
                          {item.nextStep.instruction && (
                            <p className="text-cream-mute text-[12px] leading-[1.45] mt-1">
                              {item.nextStep.instruction}
                            </p>
                          )}
                          {item.nextStep.label && (
                            <p className="text-cream-faint font-mono text-[10px] uppercase mt-2">
                              {item.nextStep.label}
                            </p>
                          )}
                        </div>
                      )}
                      {item.supportingContext && item.supportingContext.length > 0 && (
                        <div className="mt-3 border-t border-gold/10 pt-3 space-y-2">
                          {item.supportingContext.map((entry) => (
                            <div key={`${entry.title}:${entry.summary}`}>
                              <p className="font-mono tracking-[0.12em] text-[10px] text-gold uppercase">
                                {entry.title}
                              </p>
                              <p className="text-cream-mute text-[12px] leading-[1.45]">
                                {entry.summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </article>
              ))}

              {result.items.filter(isIvory).map((item) => (
                <article key={item.agent} className="border border-teal/20 rounded p-4 bg-ink/30">
                  <p className="font-mono tracking-[0.14em] text-[10px] text-teal uppercase mb-2">
                    Ivory — List Building & Invites
                  </p>
                  {item.status === 'error' && (
                    <p className="text-cream-mute text-[13px] leading-[1.5]">
                      Couldn&rsquo;t load Ivory prompts right now.
                    </p>
                  )}
                  {item.status === 'ready' && (
                    <>
                      <p className="text-cream text-[13px] leading-[1.55] mb-2">
                        {item.coaching}
                      </p>
                      <p className="font-mono tracking-[0.12em] text-[10px] text-cream-faint uppercase mb-2">
                        Angle: {item.angle}, roster: {item.rosterSize}
                      </p>
                      {item.degraded && (
                        <p className="font-mono text-[10px] text-cream-faint uppercase mb-2">
                          Fallback wording (safe mode)
                        </p>
                      )}
                      {item.prompts.length > 0 && (
                        <ul className="space-y-1.5">
                          {item.prompts.map((line) => (
                            <li
                              key={line}
                              className="text-cream-mute text-[12px] leading-[1.45] list-disc list-inside"
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </article>
              ))}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
