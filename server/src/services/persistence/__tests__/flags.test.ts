import { describe, expect, it } from 'vitest';
import {
  resolveModeFromConfig,
  type PersistenceFlagConfig,
} from '../flags.js';

describe('persistence flags', () => {
  const mixedConfig: PersistenceFlagConfig = {
    directEnabled: true,
    storeModes: {
      mongodb: 'direct',
      neo4j: 'gateway',
      chromadb: 'direct',
    },
  };

  it('keeps every store on gateway when the master direct flag is disabled', () => {
    const disabledConfig: PersistenceFlagConfig = {
      ...mixedConfig,
      directEnabled: false,
    };

    expect(resolveModeFromConfig(disabledConfig, 'mongodb')).toBe('gateway');
    expect(resolveModeFromConfig(disabledConfig, 'neo4j')).toBe('gateway');
    expect(resolveModeFromConfig(disabledConfig, 'chromadb')).toBe('gateway');
  });

  it('allows per-store mixed mode only when direct mode is globally enabled', () => {
    expect(resolveModeFromConfig(mixedConfig, 'mongodb')).toBe('direct');
    expect(resolveModeFromConfig(mixedConfig, 'neo4j')).toBe('gateway');
    expect(resolveModeFromConfig(mixedConfig, 'chromadb')).toBe('direct');
  });
});
