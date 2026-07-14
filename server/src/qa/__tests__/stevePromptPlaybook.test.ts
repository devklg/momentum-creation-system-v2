import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '..');
const playbook = readFileSync(path.join(repoRoot, 'AI_AGENT_PLAYBOOK.md'), 'utf8');

describe('P2-120 Steve prompt playbook', () => {
  it('maps both governed Steve templates to their current behavior sources', () => {
    expect(playbook).toContain('`steve_success_discovery@1.0.0`');
    expect(playbook).toContain('`steve_success_profile@1.0.0`');
    expect(playbook).toContain(
      '`server/src/domain/steve-success-interview.ts#buildSteveSystemPrompt`',
    );
    expect(playbook).toContain(
      '`server/src/domain/steve-success-interview.ts#assembleSuccessProfile`',
    );
  });

  it('records the completion, degradation, and human-dignity boundaries', () => {
    expect(playbook).toContain('`[[DISCOVERY_COMPLETE]]`');
    expect(playbook).toContain('block substantive invention');
    expect(playbook).toContain('sole New BA Discovery interviewer');
    expect(playbook).toMatch(
      /may not score, rank,\s+classify, qualify, predict, compare, pressure, or infer human potential/,
    );
    expect(playbook).toContain('never edit an approved active');
  });
});
