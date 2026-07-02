import { describe, expect, it } from 'vitest';
import {
  resolveModeFromConfig,
  type PersistenceFlagConfig,
} from '../flags.js';

describe('persistence flags', () => {
  const directConfig: PersistenceFlagConfig = {
    directEnabled: true,
    storeModes: {
      mongodb: 'direct',
      neo4j: 'direct',
      chromadb: 'direct',
    },
  };

  it('disables every store when the master direct flag is disabled', () => {
    const disabledConfig: PersistenceFlagConfig = {
      ...directConfig,
      directEnabled: false,
    };

    expect(resolveModeFromConfig(disabledConfig, 'mongodb')).toBe('disabled');
    expect(resolveModeFromConfig(disabledConfig, 'neo4j')).toBe('disabled');
    expect(resolveModeFromConfig(disabledConfig, 'chromadb')).toBe('disabled');
  });

  it('keeps every store direct when direct mode is globally enabled', () => {
    expect(resolveModeFromConfig(directConfig, 'mongodb')).toBe('direct');
    expect(resolveModeFromConfig(directConfig, 'neo4j')).toBe('direct');
    expect(resolveModeFromConfig(directConfig, 'chromadb')).toBe('direct');
  });
});
