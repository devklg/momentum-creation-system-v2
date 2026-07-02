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

describe('direct-only triple-stack readiness', () => {
  it('keeps caller rewrites unnecessary while every store remains direct', () => {
    const fullDirect = config({ mongodb: 'direct', neo4j: 'direct', chromadb: 'direct' });

    expect(resolveModeFromConfig(fullDirect, 'mongodb')).toBe('direct');
    expect(resolveModeFromConfig(fullDirect, 'neo4j')).toBe('direct');
    expect(resolveModeFromConfig(fullDirect, 'chromadb')).toBe('direct');
  });

  it('uses disabled as the explicit kill-switch mode', () => {
    const disabled = config({ mongodb: 'direct', neo4j: 'direct', chromadb: 'direct' }, false);

    expect(resolveModeFromConfig(disabled, 'mongodb')).toBe('disabled');
    expect(resolveModeFromConfig(disabled, 'neo4j')).toBe('disabled');
    expect(resolveModeFromConfig(disabled, 'chromadb')).toBe('disabled');
  });
});
