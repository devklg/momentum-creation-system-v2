import { describe, expect, it } from 'vitest';
import {
  MCS_PLATFORM_AGENT_KEYS,
  MCS_PLATFORM_AGENT_REGISTRY,
  MCS_PLATFORM_CAPABILITY_REGISTRY,
  validateFutureAgentRegistration,
} from '@momentum/shared';

describe('P1-59 platform agent registry', () => {
  it('covers every required platform agent identity', () => {
    expect(MCS_PLATFORM_AGENT_KEYS).toEqual([
      'steve_success', 'michael_magnificent', 'ivory', 'scriptmaker', 'admin_recommendations',
    ]);
    expect(Object.keys(MCS_PLATFORM_AGENT_REGISTRY)).toEqual(MCS_PLATFORM_AGENT_KEYS);
  });

  it('keeps Daily Success Coach a Michael-owned capability', () => {
    expect(MCS_PLATFORM_CAPABILITY_REGISTRY).toContainEqual(expect.objectContaining({
      capabilityKey: 'daily_success_coach', ownerAgentKey: 'michael_magnificent',
      independentlyAddressableAgent: false,
    }));
  });

  it('keeps all external actions human-owned', () => {
    expect(Object.values(MCS_PLATFORM_AGENT_REGISTRY).every((entry) =>
      entry.humanActionOwner === 'brand_ambassador' || entry.humanActionOwner === 'sponsor_or_leadership',
    )).toBe(true);
    expect(MCS_PLATFORM_AGENT_REGISTRY.scriptmaker.doesNotOwn).toContain('automatic_sending');
    expect(MCS_PLATFORM_AGENT_REGISTRY.admin_recommendations.doesNotOwn).toContain('automatic_mutation');
  });

  it('requires future agents to be approved and inactive before registration', () => {
    const base = {
      agentKey: 'future_helper', displayName: 'Future Helper', kind: 'guided_agent' as const,
      surfaces: ['team'] as const, mission: 'Support an approved future workflow.',
      humanActionOwner: 'brand_ambassador' as const, behaviorSource: 'server/src/domain/future.ts',
      approvedByDecisionId: 'dec_future_helper', active: false as const,
    };
    expect(validateFutureAgentRegistration(base)).toEqual([]);
    expect(validateFutureAgentRegistration({ ...base, agentKey: 'ivory', approvedByDecisionId: '' }))
      .toEqual(['agent_key_already_registered', 'decision_approval_required']);
  });
});
