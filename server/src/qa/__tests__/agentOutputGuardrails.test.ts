import { describe, expect, it } from 'vitest';
import { MCS_AGENT_SKILL_REGISTRY, MCS_AGENT_TEMPLATE_REGISTRY } from '@momentum/shared';
import { scanGeneratedCopyCompliance } from '../../domain/generatedCopyCompliance.js';

const SCORING = ['score', 'rank', 'qualification', 'prediction'];
const INCOME = ['income_claim', 'income_projection'];

describe('P1-61 cross-agent output guardrails', () => {
  it('blocks scoring, qualification, and income language at the generated-copy boundary', () => {
    const result = scanGeneratedCopyCompliance([
      'The AI qualified this prospect with a lead score and ranked them first.',
      'They will make $1,000 per month in seven months.',
    ]);
    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.id)).toEqual(
      expect.arrayContaining(['ai_qualification', 'income']),
    );
  });

  it('declares scoring or qualification forbidden for every human-guidance agent', () => {
    for (const agentKey of ['steve_success', 'michael_magnificent', 'ivory'] as const) {
      const skills = MCS_AGENT_SKILL_REGISTRY.filter((item) => item.ownerAgentKey === agentKey);
      const forbidden = skills.flatMap((item) => item.forbiddenOutputs);
      expect(forbidden.some((item) => SCORING.some((term) => item.includes(term)))).toBe(true);
    }
  });

  it('declares income claims forbidden for every agent that creates BA/prospect language', () => {
    for (const agentKey of ['michael_magnificent', 'ivory', 'scriptmaker'] as const) {
      const templates = MCS_AGENT_TEMPLATE_REGISTRY.filter((item) => item.ownerAgentKey === agentKey);
      const forbidden = templates.flatMap((item) => item.forbiddenOutputs);
      expect(forbidden.some((item) => INCOME.includes(item))).toBe(true);
    }
  });

  it('never permits prohibited concepts as an allowed output', () => {
    const prohibited = /score|rank|qualification|prediction|income|earnings|commission|placement_promise/i;
    for (const skill of MCS_AGENT_SKILL_REGISTRY) {
      expect(skill.allowedOutputs.join(' ')).not.toMatch(prohibited);
    }
    for (const template of MCS_AGENT_TEMPLATE_REGISTRY) {
      expect(template.allowedOutputs.join(' ')).not.toMatch(prohibited);
    }
  });

  it('keeps planned ScriptMaker opportunity thinking separate from prospect-facing claims', () => {
    const opportunity = MCS_AGENT_TEMPLATE_REGISTRY.find(
      (item) => item.templateId === 'scriptmaker_wdyk_opportunity',
    );
    expect(opportunity).toMatchObject({ status: 'planned' });
    expect(opportunity?.allowedInputs).toContain('leadership_approved_opportunity_context');
    expect(opportunity?.forbiddenOutputs).toEqual(
      expect.arrayContaining(['qualification', 'automatic_send', 'income_projection']),
    );
  });
});
