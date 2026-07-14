import { describe, expect, it } from 'vitest';
import {
  MCS_AGENT_SKILL_REGISTRY,
  MCS_AGENT_TEMPLATE_REGISTRY,
  MCS_PLATFORM_AGENT_KEYS,
  validateAgentSkillTemplateRegistries,
} from '@momentum/shared';

describe('P1-60 agent skill and template governance', () => {
  it('has referentially valid, versioned, test-backed registries', () => {
    expect(validateAgentSkillTemplateRegistries()).toEqual([]);
  });

  it('gives every platform agent an explicit skill set', () => {
    for (const agentKey of MCS_PLATFORM_AGENT_KEYS) {
      expect(MCS_AGENT_SKILL_REGISTRY.some((skill) => skill.ownerAgentKey === agentKey)).toBe(true);
    }
  });

  it('distinguishes implemented behavior from planned training and duplication work', () => {
    expect(MCS_AGENT_SKILL_REGISTRY.find((skill) => skill.skillKey === 'scriptmaker.draft_product_invitation')?.status).toBe('implemented');
    expect(MCS_AGENT_SKILL_REGISTRY.find((skill) => skill.skillKey === 'scriptmaker.who_do_you_know_and_mint')?.status).toBe('planned');
    expect(MCS_AGENT_SKILL_REGISTRY.find((skill) => skill.skillKey === 'michael.sponsor_assisted_debrief')?.status).toBe('planned');
  });

  it('gives every planned skill an implementation-ready prompt', () => {
    const planned = MCS_AGENT_SKILL_REGISTRY.filter((skill) => skill.status === 'planned');
    expect(planned).not.toHaveLength(0);
    expect(planned.every((skill) => (skill.implementationPrompts?.length ?? 0) > 0)).toBe(true);
  });

  it('requires declared degradation behavior without broadening output authority', () => {
    for (const skill of MCS_AGENT_SKILL_REGISTRY) {
      expect(skill.degradation.behavior.length).toBeGreaterThan(0);
      expect(skill.forbiddenOutputs.length).toBeGreaterThan(0);
    }
    for (const template of MCS_AGENT_TEMPLATE_REGISTRY) {
      expect(template.degradation.fallbackSource.length).toBeGreaterThan(0);
      expect(template.forbiddenOutputs.length).toBeGreaterThan(0);
    }
  });

  it('keeps BA sending manual in every ScriptMaker template', () => {
    const templates = MCS_AGENT_TEMPLATE_REGISTRY.filter((item) => item.ownerAgentKey === 'scriptmaker');
    expect(templates).not.toHaveLength(0);
    expect(templates.every((item) => item.forbiddenOutputs.includes('automatic_send'))).toBe(true);
  });

  it('allows only approved templates to be active', () => {
    expect(MCS_AGENT_TEMPLATE_REGISTRY.filter((item) => item.status === 'active')
      .every((item) => item.approval.state === 'approved' && item.approval.activatedAt !== null)).toBe(true);
  });

  it('registers current Steve templates and keeps extraction pending approval', () => {
    const templates = MCS_AGENT_TEMPLATE_REGISTRY.filter(
      (item) => item.ownerAgentKey === 'steve_success',
    );
    expect(templates.map((item) => `${item.templateId}@${item.version}`).sort()).toEqual([
      'steve_success_discovery@1.0.0',
      'steve_success_profile@1.0.0',
      'steve_success_profile_extraction@1.0.0',
    ]);

    expect(templates.find((item) => item.templateId === 'steve_success_discovery')).toMatchObject({
      status: 'active',
      behaviorSource: 'server/src/domain/steve-success-interview.ts#buildSteveSystemPrompt',
      testIds: ['steveConversationRuntime.test.ts'],
      degradation: { mode: 'block_substantive', fallbackSource: 'steve_conversation_retry' },
      approval: { state: 'approved', authority: 'locked-spec-3.12' },
    });
    expect(templates.find((item) => item.templateId === 'steve_success_profile')).toMatchObject({
      status: 'active',
      behaviorSource: 'server/src/domain/steve-success-interview.ts#assembleSuccessProfile',
      testIds: ['steveDiscoveryPersistence.test.ts'],
      degradation: { mode: 'block_substantive', fallbackSource: 'incomplete_profile_block' },
      approval: { state: 'approved', authority: 'locked-spec-3.12' },
    });
    expect(templates.find((item) => item.templateId === 'steve_success_profile_extraction')).toMatchObject({
      status: 'planned',
      behaviorSource: 'server/src/domain/steveConversationRuntime.ts#extractionSystem',
      testIds: ['steveConversationRuntime.test.ts', 'stevePromptPlaybook.test.ts'],
      degradation: { mode: 'block_substantive', fallbackSource: 'steve_extraction_retry_then_pending' },
      approval: { state: 'planned', authority: 'ACR-0022-pending', activatedAt: null },
    });

    const forbidden = templates.flatMap((item) => item.forbiddenOutputs);
    expect(forbidden).toEqual(
      expect.arrayContaining(['score', 'rank', 'qualification', 'prediction']),
    );
  });
});
