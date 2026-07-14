import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCS_AGENT_TEMPLATE_REGISTRY } from '@momentum/shared';

const repoRoot = path.resolve(process.cwd(), '..');
const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

const playbook = readRepoFile('AI_AGENT_PLAYBOOK.md');
const domainDir = path.join(repoRoot, 'server/src/domain');

function liveIvoryScriptMakerProviderCalls(): string[] {
  const calls: string[] = [];
  for (const file of readdirSync(domainDir).filter((name) =>
    /^(ivory|scriptmaker).*\.ts$/.test(name) && !name.includes('.test.'),
  )) {
    const source = readRepoFile(`server/src/domain/${file}`);
    for (const match of source.matchAll(/complete\(\{\s*system:\s*([^,\n]+)/g)) {
      calls.push(`${file}#${match[1]?.trim()}`);
    }
  }
  return calls.sort();
}

describe('P2-123 Ivory and ScriptMaker prompt registry', () => {
  it('maps every live provider system prompt to one approved active template', () => {
    const activeTemplates = MCS_AGENT_TEMPLATE_REGISTRY.filter(
      (item) =>
        (item.ownerAgentKey === 'ivory' || item.ownerAgentKey === 'scriptmaker') &&
        item.status === 'active',
    );

    expect(activeTemplates.map((item) => item.behaviorSource).sort()).toEqual([
      'server/src/domain/ivory-momentum.ts#SUGGEST_SYSTEM_PREFIX+buildSuggestUserTurn',
      'server/src/domain/ivory.ts#INVITATION_DRAFT_SYSTEM+buildInvitationDraftUserTurn',
      'server/src/domain/ivory.ts#buildCoachSystem+buildCoachUserTurn',
      'server/src/domain/scriptmaker.ts#SYSTEM_PREFIX+resolveSeed+buildUserTurn',
    ]);
    expect(activeTemplates.every((item) => item.approval.state === 'approved')).toBe(true);
    expect(activeTemplates.every((item) => item.approval.authority.startsWith('Kevin'))).toBe(true);
  });

  it('discovers every provider call across Ivory/ScriptMaker domain files', () => {
    expect(liveIvoryScriptMakerProviderCalls()).toEqual([
      'ivory-momentum.ts#SUGGEST_SYSTEM_PREFIX',
      'ivory.ts#INVITATION_DRAFT_SYSTEM',
      'ivory.ts#await buildCoachSystem(input)',
      'scriptmaker.ts#SYSTEM_PREFIX',
    ]);
  });

  it('records the composite prompt inputs and compliance boundaries', () => {
    const byId = new Map(MCS_AGENT_TEMPLATE_REGISTRY.map((item) => [item.templateId, item]));

    expect(byId.get('ivory_wdyk_coach')?.allowedInputs).toEqual([
      'ba_angle', 'product_name', 'roster_size', 'ba_ask', 'admin_master_content',
    ]);
    expect(byId.get('ivory_personal_invitation')?.allowedInputs).toContain(
      'private_relationship_context',
    );
    expect(byId.get('ivory_momentum_followup')?.allowedInputs).toEqual(
      expect.arrayContaining(['pmv_lifecycle', 'last_signal', 'private_relationship_context', 'ba_ask']),
    );
    expect(byId.get('scriptmaker_product_invitation')?.allowedInputs).toEqual(
      expect.arrayContaining(['script_kind', 'event_day', 'event_time', 'admin_master_content_seed']),
    );

    for (const templateId of [
      'ivory_wdyk_coach',
      'ivory_personal_invitation',
      'ivory_momentum_followup',
      'scriptmaker_product_invitation',
    ]) {
      expect(byId.get(templateId)?.forbiddenOutputs).toEqual(
        expect.arrayContaining([
          'automatic_send', 'prospect_selection', 'qualification',
          'income_claim', 'medical_claim', 'placement_promise',
        ]),
      );
    }
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
