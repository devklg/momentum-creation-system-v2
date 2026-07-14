import { KNOWLEDGE_EVOLUTION_ACTIVE_COLLECTIONS } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import { CHROMA_COLLECTIONS } from '../../chromaCollections.js';
import {
  assertChromaMaintenanceCapability,
  CHROMA_MAINTENANCE_EXCLUDED_COLLECTIONS,
  CHROMA_MAINTENANCE_MANIFEST,
  getChromaMaintenanceManifestEntry,
} from '../manifest.js';

describe('Chroma maintenance manifest', () => {
  it('covers every app-registered collection and every ratified active collection', () => {
    const names = new Set(CHROMA_MAINTENANCE_MANIFEST.map((entry) => entry.collection));
    for (const collection of CHROMA_COLLECTIONS) expect(names.has(collection)).toBe(true);
    for (const logical of KNOWLEDGE_EVOLUTION_ACTIVE_COLLECTIONS) {
      expect(names.has(`mcs_${logical}`)).toBe(true);
    }
  });

  it('keeps the seven live unowned collections outside the governed manifest', () => {
    expect(CHROMA_MAINTENANCE_EXCLUDED_COLLECTIONS).toHaveLength(7);
    for (const collection of CHROMA_MAINTENANCE_EXCLUDED_COLLECTIONS) {
      expect(getChromaMaintenanceManifestEntry(collection)).toBeNull();
      expect(() => assertChromaMaintenanceCapability(collection, 'audit'))
        .toThrow('unowned_excluded');
    }
  });

  it('allows mutations only for canonical Knowledge Evolution projectors', () => {
    const active = assertChromaMaintenanceCapability('mcs_success_knowledge_en', 'reindex');
    expect(active.projector).toBe('knowledge_evolution_active');
    expect(active.capabilities).toEqual(['audit', 'reindex', 'age_out']);

    expect(() => assertChromaMaintenanceCapability('mcs_audit_log', 'reindex'))
      .toThrow('does not support reindex');
    expect(() => assertChromaMaintenanceCapability('not_registered', 'audit'))
      .toThrow('not in the maintenance manifest');
  });
});
