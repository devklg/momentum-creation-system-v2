import { describe, expect, it } from 'vitest';
import type { AgentKey, RuntimeTaskType } from '@momentum/shared/runtime';
import {
  getAgentDescriptor,
  isKnownAgentKey,
  isTaskTypeAllowed,
} from '../registry.js';

/**
 * Guards for an agentKey cast from an external boundary (deserialized JSON, a
 * removed/typo'd key). The Record type reports the index as always-present, so
 * these can only be exercised by casting through `unknown`.
 */
describe('registry unknown-agentKey guards', () => {
  it('returns the descriptor for a known agent', () => {
    const descriptor = getAgentDescriptor('ivory');
    expect(descriptor.agentKey).toBe('ivory');
    expect(descriptor.allowedTaskTypes.length).toBeGreaterThan(0);
  });

  it('throws a clear error for an unknown agentKey instead of a TypeError', () => {
    const bogus = 'not_a_real_agent' as unknown as AgentKey;
    expect(() => getAgentDescriptor(bogus)).toThrowError(/unknown agentKey/i);
  });

  it('isTaskTypeAllowed returns false (no throw) for an unknown agentKey', () => {
    const bogus = 'not_a_real_agent' as unknown as AgentKey;
    const task = 'relationship_coaching' as RuntimeTaskType;
    expect(() => isTaskTypeAllowed(bogus, task)).not.toThrow();
    expect(isTaskTypeAllowed(bogus, task)).toBe(false);
  });

  it('isTaskTypeAllowed still resolves correctly for a known agent', () => {
    expect(isTaskTypeAllowed('ivory', 'relationship_coaching' as RuntimeTaskType)).toBe(
      true,
    );
    expect(isTaskTypeAllowed('ivory', 'training_support' as RuntimeTaskType)).toBe(false);
  });

  it('isKnownAgentKey narrows only real keys', () => {
    expect(isKnownAgentKey('ivory')).toBe(true);
    expect(isKnownAgentKey('steve_success')).toBe(true);
    expect(isKnownAgentKey('michael_magnificent')).toBe(true);
    expect(isKnownAgentKey('nope')).toBe(false);
    expect(isKnownAgentKey(undefined)).toBe(false);
  });
});
