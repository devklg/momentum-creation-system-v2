import { describe, expect, it } from 'vitest';
import { PMV_FORBIDDEN_LANGUAGE_CATEGORIES } from '@momentum/shared';
import {
  COCKPIT_NEXT_ACTION_POLICY_VERSION,
  COCKPIT_NEXT_ACTION_RULES,
  projectCockpitNextAction,
  type CockpitNextActionInput,
} from '../cockpit-next-action.js';

const NOW = Date.parse('2026-07-13T20:00:00.000Z');

function input(overrides: Partial<CockpitNextActionInput> = {}): CockpitNextActionInput {
  return {
    lifecycle: 'draft',
    firstName: 'Maria',
    sentAt: null,
    expiresAt: '2026-08-01T20:00:00.000Z',
    followUpDueAt: null,
    followUpIsDue: false,
    lastSignalAt: '2026-07-13T19:00:00.000Z',
    nowMs: NOW,
    ...overrides,
  };
}

describe('P2-127 cockpit next-action policy', () => {
  it('is versioned, ordered, unique, and manual-only', () => {
    expect(COCKPIT_NEXT_ACTION_POLICY_VERSION).toBe('p2-127.2026-07-13');
    expect(new Set(COCKPIT_NEXT_ACTION_RULES.map((rule) => rule.id)).size).toBe(
      COCKPIT_NEXT_ACTION_RULES.length,
    );
    expect(COCKPIT_NEXT_ACTION_RULES.every((rule) => rule.manualOnly)).toBe(true);
    expect(COCKPIT_NEXT_ACTION_RULES.map((rule) => rule.id).slice(0, 4)).toEqual([
      'terminal_none',
      'callback_reply',
      'ba_follow_up_due',
      'watched_call',
    ]);
  });

  it.each([
    ['draft', 'send_invite'],
    ['clicked', 'ask_if_video_played'],
    ['video_started', 'send_soft_nudge'],
    ['video_25', 'send_soft_nudge'],
    ['video_50', 'send_soft_nudge'],
    ['video_75', 'send_soft_nudge'],
    ['watched', 'call_now'],
    ['callback_requested', 'reply_to_callback'],
    ['customer', 'none'],
    ['enrolled', 'none'],
    ['expired', 'reinvite'],
    ['archived', 'none'],
  ] as const)('maps %s to %s', (lifecycle, kind) => {
    expect(projectCockpitNextAction(input({ lifecycle })).kind).toBe(kind);
  });

  it('waits before the 48-hour sent-unopened boundary and suggests a nudge at it', () => {
    const sentAt = '2026-07-11T20:00:00.000Z';
    expect(
      projectCockpitNextAction(
        input({ lifecycle: 'sent_unopened', sentAt, nowMs: NOW - 1 }),
      ),
    ).toMatchObject({ kind: 'wait', priority: 0, dueAt: '2026-07-13T20:00:00.000Z' });
    expect(
      projectCockpitNextAction(input({ lifecycle: 'sent_unopened', sentAt })),
    ).toMatchObject({
      kind: 'send_soft_nudge',
      priority: 2,
      dueAt: '2026-07-13T20:00:00.000Z',
    });
  });

  it('applies terminal, callback, and BA-reminder precedence in that order', () => {
    const overdue = {
      followUpDueAt: '2026-07-12T20:00:00.000Z',
      followUpIsDue: true,
    } as const;
    expect(projectCockpitNextAction(input({ lifecycle: 'enrolled', ...overdue })).kind).toBe(
      'none',
    );
    expect(
      projectCockpitNextAction(input({ lifecycle: 'callback_requested', ...overdue })).kind,
    ).toBe('reply_to_callback');
    expect(projectCockpitNextAction(input({ lifecycle: 'watched', ...overdue })).kind).toBe(
      'follow_up_due',
    );
  });

  it('returns the same explainable result for the same explicit inputs', () => {
    const state = input({ lifecycle: 'clicked' });
    const first = projectCockpitNextAction(state);
    const second = projectCockpitNextAction({ ...state });
    expect(first).toEqual(second);
    expect(first.reason).toContain('opened the link');
  });

  it('keeps rule and rendered suggestion language outside PMV forbidden phrases', () => {
    const copy = [
      ...COCKPIT_NEXT_ACTION_RULES.flatMap((rule) => [rule.label, rule.trigger]),
      ...COCKPIT_NEXT_ACTION_RULES.map((_, index) =>
        projectCockpitNextAction(
          input({
            lifecycle: index % 2 === 0 ? 'clicked' : 'watched',
          }),
        ).reason,
      ),
    ].join(' ');

    for (const category of PMV_FORBIDDEN_LANGUAGE_CATEGORIES) {
      for (const phrase of category.phrases) {
        expect(copy.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    }
  });
});
