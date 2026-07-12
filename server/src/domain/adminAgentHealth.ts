import type { McsAdminAgentHealthResponse, McsAdminAgentHealthStatus, McsPlatformAgentKey } from '@momentum/shared';
import {
  MCS_AGENT_SKILL_REGISTRY,
  MCS_AGENT_TEMPLATE_REGISTRY,
  MCS_PLATFORM_AGENT_KEYS,
  MCS_PLATFORM_AGENT_REGISTRY,
  validateAgentSkillTemplateRegistries,
} from '@momentum/shared';
import { buildAdminAgentOversight } from './adminAgentMemory.js';

const EVENT_AGENT: Partial<Record<McsPlatformAgentKey, string>> = {
  steve_success: 'steve', michael_magnificent: 'michael', ivory: 'ivory',
};

export async function buildAdminAgentHealth(): Promise<McsAdminAgentHealthResponse> {
  const oversight = await buildAdminAgentOversight();
  const registryErrors = validateAgentSkillTemplateRegistries();
  const cards = MCS_PLATFORM_AGENT_KEYS.map((agentKey) => {
    const descriptor = MCS_PLATFORM_AGENT_REGISTRY[agentKey];
    const skills = MCS_AGENT_SKILL_REGISTRY.filter((item) => item.ownerAgentKey === agentKey);
    const templates = MCS_AGENT_TEMPLATE_REGISTRY.filter((item) => item.ownerAgentKey === agentKey);
    const eventAgent = EVENT_AGENT[agentKey];
    const interaction = oversight.interactionSummary.find((item) => item.agentId === eventAgent);
    const issues = registryErrors.filter((error) => error.includes(agentKey));
    const plannedSkills = skills.filter((item) => item.status === 'planned').length;
    const activeTemplates = templates.filter((item) => item.status === 'active').length;
    const status: McsAdminAgentHealthStatus = issues.length > 0 ? 'error' : activeTemplates === 0 ? 'planned' : oversight.warnings.length > 0 ? 'degraded' : 'healthy';
    return {
      agentKey, displayName: descriptor.displayName, kind: descriptor.kind, status,
      activeSkills: skills.length - plannedSkills, plannedSkills, activeTemplates,
      plannedTemplates: templates.length - activeTemplates,
      events7d: interaction?.events7d ?? 0, lastEventAt: interaction?.lastEventAt ?? null,
      behaviorSource: descriptor.behaviorSource,
      issues,
      debug: {
        humanActionOwner: descriptor.humanActionOwner,
        surfaces: descriptor.surfaces,
        owns: descriptor.owns,
        doesNotOwn: descriptor.doesNotOwn,
      },
    };
  });
  return {
    ok: true, generatedAt: new Date().toISOString(), cards,
    summary: {
      healthy: cards.filter((item) => item.status === 'healthy').length,
      degraded: cards.filter((item) => item.status === 'degraded').length,
      planned: cards.filter((item) => item.status === 'planned').length,
      error: cards.filter((item) => item.status === 'error').length,
    },
    warnings: oversight.warnings,
  };
}
