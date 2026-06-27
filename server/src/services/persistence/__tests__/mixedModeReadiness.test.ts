import { describe, expect, it } from 'vitest';
import {
  resolveModeFromConfig,
  type PersistenceFlagConfig,
} from '../flags.js';

function config(
  storeModes: PersistenceFlagConfig['storeModes'],
  directEnabled = true,
): PersistenceFlagConfig {
  return { directEnabled, storeModes };
}

describe('mixed-mode triple-stack readiness', () => {
  it('supports staged per-store cutover without requiring caller rewrites', () => {
    const phase0 = config({ mongodb: 'gateway', neo4j: 'gateway', chromadb: 'gateway' });
    const mongoOnly = config({ mongodb: 'direct', neo4j: 'gateway', chromadb: 'gateway' });
    const graphAndMongo = config({ mongodb: 'direct', neo4j: 'direct', chromadb: 'gateway' });
    const fullDirect = config({ mongodb: 'direct', neo4j: 'direct', chromadb: 'direct' });

    expect(resolveModeFromConfig(phase0, 'mongodb')).toBe('gateway');
    expect(resolveModeFromConfig(mongoOnly, 'mongodb')).toBe('direct');
    expect(resolveModeFromConfig(mongoOnly, 'neo4j')).toBe('gateway');
    expect(resolveModeFromConfig(graphAndMongo, 'neo4j')).toBe('direct');
    expect(resolveModeFromConfig(graphAndMongo, 'chromadb')).toBe('gateway');
    expect(resolveModeFromConfig(fullDirect, 'chromadb')).toBe('direct');
  });
});
