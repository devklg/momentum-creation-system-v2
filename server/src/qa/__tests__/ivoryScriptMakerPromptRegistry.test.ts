import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCS_AGENT_TEMPLATE_REGISTRY } from '@momentum/shared';

const repoRoot = path.resolve(process.cwd(), '..');
const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

const ivorySource = readRepoFile('server/src/domain/ivory.ts');
const ivoryMomentumSource = readRepoFile('server/src/domain/ivory-momentum.ts');
const scriptMakerSource = readRepoFile('server/src/domain/scriptmaker.ts');
const playbook = readRepoFile('AI_AGENT_PLAYBOOK.md');

describe('P2-123 Ivory and ScriptMaker prompt registry', () => {
  it('maps every live provider system prompt to one approved active template', () => {
    const activeTemplates = MCS_AGENT_TEMPLATE_REGISTRY.filter(
      (item) =>
        (item.ownerAgentKey === 'ivory' || item.ownerAgentKey === 'scriptmaker') &&
        item.status === 'active',
    );

    expect(activeTemplates.map((item) => item.behaviorSource).sort()).toEqual([
      'server/src/domain/ivory-momentum.ts#SUGGEST_SYSTEM_PREFIX',
      'server/src/domain/ivory.ts#COACH_SYSTEM_PREFIX',
      'server/src/domain/ivory.ts#INVITATION_DRAFT_SYSTEM',
      'server/src/domain/scriptmaker.ts#SYSTEM_PREFIX',
    ]);
    expect(activeTemplates.every((item) => item.approval.state === 'approved')).toBe(true);
  });

  it('keeps the runtime provider-call inventory explicit and complete', () => {
    expect(ivorySource.match(/complete\(\{/g)).toHaveLength(2);
    expect(ivorySource).toContain('system: await buildCoachSystem(input)');
    expect(ivorySource).toContain('system: INVITATION_DRAFT_SYSTEM');

    expect(ivoryMomentumSource.match(/complete\(\{/g)).toHaveLength(1);
    expect(ivoryMomentumSource).toContain('system: SUGGEST_SYSTEM_PREFIX');

    expect(scriptMakerSource.match(/complete\(\{/g)).toHaveLength(1);
    expect(scriptMakerSource).toContain('system: SYSTEM_PREFIX');
  });

  it('records the governed inventory, fallbacks, and human-send boundary in the playbook', () => {
    for (const identity of [
      'ivory_wdyk_coach@1.0.0',
      'ivory_personal_invitation@1.0.0',
      'ivory_momentum_followup@1.0.0',
      'scriptmaker_product_invitation@1.0.0',
      'scriptmaker_wdyk_product@0.1.0',
      'scriptmaker_wdyk_opportunity@0.1.0',
    ]) {
      expect(playbook).toContain(`\`${identity}\``);
    }
    expect(playbook).toContain('The BA remains the sender');
    expect(playbook).toContain('private relationship notes');
    expect(playbook).toContain('deterministic fallback');
  });
});
