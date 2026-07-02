import { describe, expect, it } from 'vitest';
import {
  PHASE7_NEO4J_CONSTRAINTS,
  PHASE7_NEO4J_INDEXES,
  PHASE7_NEO4J_SCHEMA,
} from '../phase7Constraints.js';

/**
 * Phase 7 · P7.12 Neo4j governed-door tests. Asserts the drafted constraint /
 * index statements are well-formed and idempotent. Nothing is executed against
 * Neo4j — these are data-only drafts.
 */

describe('Phase 7 P7.12 — Neo4j constraints/indexes (data-only)', () => {
  it('covers the four new Phase 7 labels with unique constraints', () => {
    expect(PHASE7_NEO4J_CONSTRAINTS.map((s) => s.label).sort()).toEqual([
      'TeamMagnificent',
      'TmagKnowledge',
      'TmagLearningCandidate',
      'TmagOutcome',
    ]);
  });

  it('every statement is idempotent (IF NOT EXISTS) and reversible (paired drop)', () => {
    for (const s of PHASE7_NEO4J_SCHEMA) {
      expect(s.cypher).toContain('IF NOT EXISTS');
      expect(s.drop).toContain('IF EXISTS');
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.purpose.length).toBeGreaterThan(0);
    }
  });

  it('constraints REQUIRE uniqueness on a business key; indexes are ON a property', () => {
    for (const c of PHASE7_NEO4J_CONSTRAINTS) {
      expect(c.cypher).toMatch(/CREATE CONSTRAINT .* REQUIRE .* IS UNIQUE/);
    }
    for (const i of PHASE7_NEO4J_INDEXES) {
      expect(i.cypher).toMatch(/CREATE INDEX .* FOR .* ON \(/);
    }
  });

  it('statement names are unique across the whole schema set', () => {
    const names = PHASE7_NEO4J_SCHEMA.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
