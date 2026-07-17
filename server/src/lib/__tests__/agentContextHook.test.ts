import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../../../');
const hookPath = join(repoRoot, 'server', 'scripts', 'agent-context-hook.mjs');

function runHook(
  input: Record<string, unknown>,
  stateDir: string,
  guardFixture = 'Prior context exists for fixture — 1 hit.',
  continuationMainFixture?: string,
): Record<string, unknown> | null {
  const output = execFileSync(process.execPath, [hookPath], {
    cwd: repoRoot,
    input: JSON.stringify({ cwd: repoRoot, ...input }),
    encoding: 'utf8',
    env: {
      ...process.env,
      MCS_AGENT_CONTEXT_STATE_DIR: stateDir,
      MCS_AGENT_CONTEXT_HOOK_SKIP_REMOTE: '1',
      MCS_AGENT_CONTEXT_HOOK_GUARD_FIXTURE: guardFixture,
      ...(continuationMainFixture
        ? { MCS_AGENT_CONTEXT_HOOK_MAIN_FIXTURE: continuationMainFixture }
        : {}),
    },
  }).trim();
  return output ? JSON.parse(output) as Record<string, unknown> : null;
}

function contextOf(result: Record<string, unknown> | null): string {
  const hookSpecific = result?.hookSpecificOutput as Record<string, unknown> | undefined;
  return String(hookSpecific?.additionalContext ?? '');
}

describe('ACR-0017 automatic Context Agent lifecycle hook', () => {
  it('withholds a stale continuation task pointer at session start', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    const result = runHook({
      session_id: 'session-start-stale',
      hook_event_name: 'SessionStart',
      source: 'startup',
      model: 'gpt-test',
    }, stateDir);
    const context = contextOf(result);
    expect(context).toContain('AUTOMATIC CONTEXT AGENT — SESSION FOUNDATION');
    expect(context).toContain('CONTINUATION FOUNDATION STALE');
    expect(context).not.toContain('P2-107 — Build a unified follow-up queue');
    expect(context.length).toBeLessThanOrEqual(9_200);
  });

  it('injects a continuation only when its declared main commit is current', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    const result = runHook({
      session_id: 'session-start-current',
      hook_event_name: 'SessionStart',
      source: 'startup',
      model: 'gpt-test',
    }, stateDir, undefined, '12dfcfb7');
    const context = contextOf(result);
    expect(context).toContain('P2-107 — Build a unified follow-up queue');
    expect(context).toContain('The continuation commit matches origin/main');
  });

  it('runs the topic guard exactly once for the first user prompt', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    runHook({ session_id: 'first-prompt', hook_event_name: 'SessionStart' }, stateDir);
    const first = runHook({
      session_id: 'first-prompt',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'build the unified follow-up queue',
    }, stateDir);
    const second = runHook({
      session_id: 'first-prompt',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'another instruction',
    }, stateDir);
    expect(contextOf(first)).toContain('FIRST-PROMPT MEMORY GUARD');
    expect(contextOf(first)).toContain('Prior context exists for fixture');
    expect(second).toBeNull();
  });

  it('does not use a stale front_of_line when the first prompt is only continue', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    const result = runHook({
      session_id: 'continue-prompt-stale',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'continue',
    }, stateDir);
    expect(contextOf(result)).toContain('Topic: current user-directed task and active decision ledger');
    expect(contextOf(result)).not.toContain('P2-107');
  });

  it('uses a verified-current front_of_line when the first prompt is only continue', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    const result = runHook({
      session_id: 'continue-prompt-current',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'continue',
    }, stateDir, undefined, '12dfcfb7');
    expect(contextOf(result)).toContain('Topic: P2-107 — Build a unified follow-up queue.');
  });

  it('does not consume the first substantive guard when the session opens with a greeting', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    const greeting = runHook({
      session_id: 'greeting-first',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'hello',
    }, stateDir);
    const substantive = runHook({
      session_id: 'greeting-first',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'inspect the CRM follow-up queue',
    }, stateDir);
    expect(greeting).toBeNull();
    expect(contextOf(substantive)).toContain('Topic: inspect the CRM follow-up queue');
  });

  it('injects the same durable foundation into subagents', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    const result = runHook({
      session_id: 'subagent',
      hook_event_name: 'SubagentStart',
      agent_type: 'reviewer',
    }, stateDir);
    const context = contextOf(result);
    expect(context).toContain('SUBAGENT FOUNDATION');
    expect(context).toContain('CONTINUATION FOUNDATION STALE');
    expect(context).not.toContain('P2-107 — Build a unified follow-up queue');
    expect(context).toContain('Do not use a stale task pointer');
  });
});
