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
    },
  }).trim();
  return output ? JSON.parse(output) as Record<string, unknown> : null;
}

function contextOf(result: Record<string, unknown> | null): string {
  const hookSpecific = result?.hookSpecificOutput as Record<string, unknown> | undefined;
  return String(hookSpecific?.additionalContext ?? '');
}

describe('ACR-0017 automatic Context Agent lifecycle hook', () => {
  it('injects the continuation foundation at session start within the platform limit', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    const result = runHook({
      session_id: 'session-start',
      hook_event_name: 'SessionStart',
      source: 'startup',
      model: 'gpt-test',
    }, stateDir);
    const context = contextOf(result);
    expect(context).toContain('AUTOMATIC CONTEXT AGENT — SESSION FOUNDATION');
    expect(context).toContain('P2-107 — Build a unified follow-up queue');
    expect(context.length).toBeLessThanOrEqual(9_200);
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

  it('uses the continuation front_of_line when the first prompt is only continue', () => {
    const stateDir = mkdtempSync(join(tmpdir(), 'mcs-context-hook-'));
    const result = runHook({
      session_id: 'continue-prompt',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'continue',
    }, stateDir);
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
    expect(contextOf(greeting)).toContain('Topic: P2-107 — Build a unified follow-up queue.');
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
    expect(context).toContain('P2-107 — Build a unified follow-up queue');
  });
});
