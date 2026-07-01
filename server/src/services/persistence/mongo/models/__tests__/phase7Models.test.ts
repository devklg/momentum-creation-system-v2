import { describe, expect, it } from 'vitest';
import { generateMongoJsonSchema } from '../../jsonSchema/generate.js';
import {
  PHASE7_MONGO_SCHEMA_BUILDERS,
  buildGraphRagRecordSchema,
  buildLearningCandidateSchema,
  buildOutcomeSchema,
} from '../phase7Models.js';

/**
 * Phase 7 · P7.12 governed-door tests. Proves the drafted Mongoose models
 * produce the intended first-pass `$jsonSchema` through the existing generator.
 * Nothing is applied to any store here.
 */

const NUMBER_BSON = ['double', 'int', 'long', 'decimal'];
const ENVELOPE_CORE = [
  'createdAt',
  'id',
  'namespace',
  'originKind',
  'schemaVersion',
  'serviceName',
  'source',
  'teamKey',
  'tenantId',
  'title',
  'type',
];

describe('Phase 7 P7.12 — governed doors (first-pass $jsonSchema)', () => {
  it('mcs_outcomes: required core + string timestamps + additionalProperties true', () => {
    const js = generateMongoJsonSchema(buildOutcomeSchema());
    expect(js.additionalProperties).toBe(true);
    for (const field of [...ENVELOPE_CORE, 'kind', 'confirmedByBaId', 'outcomeAt']) {
      expect(js.required).toContain(field);
    }
    // Timestamps are ISO strings, never BSON Date (P10 §3.3).
    expect((js.properties.createdAt as { bsonType: string }).bsonType).toBe('string');
    expect((js.properties.outcomeAt as { bsonType: string }).bsonType).toBe('string');
    expect((js.properties.schemaVersion as { bsonType: string[] }).bsonType).toEqual(NUMBER_BSON);
    // No gateway-only fields are declared on the app door.
    expect(js.properties).not.toHaveProperty('chat_number');
    expect(js.properties).not.toHaveProperty('chat_registry_id');
  });

  it('mcs_learning_candidates: required core + array provenance + review object', () => {
    const js = generateMongoJsonSchema(buildLearningCandidateSchema());
    expect(js.additionalProperties).toBe(true);
    for (const field of [...ENVELOPE_CORE, 'status', 'domain', 'language', 'proposedSummary', 'sourceOutcomeIds', 'sourceSignalIds', 'teamKey']) {
      expect(js.required).toContain(field);
    }
    expect((js.properties.sourceOutcomeIds as { bsonType: string }).bsonType).toBe('array');
    expect((js.properties.sourceSignalIds as { bsonType: string }).bsonType).toBe('array');
    // review is optional (not in required-core).
    expect(js.required).not.toContain('review');
  });

  it('mcs_graphrag_records: required core + numeric version + bool retrievalReady', () => {
    const js = generateMongoJsonSchema(buildGraphRagRecordSchema());
    expect(js.additionalProperties).toBe(true);
    for (const field of [...ENVELOPE_CORE, 'knowledgeObjectId', 'version', 'domain', 'language', 'summary', 'model', 'modelVersion', 'retrievalReady']) {
      expect(js.required).toContain(field);
    }
    expect((js.properties.version as { bsonType: string[] }).bsonType).toEqual(NUMBER_BSON);
    expect((js.properties.retrievalReady as { bsonType: string }).bsonType).toBe('bool');
  });

  it('exposes all three builders in the registry map', () => {
    expect(Object.keys(PHASE7_MONGO_SCHEMA_BUILDERS).sort()).toEqual([
      'mcs_graphrag_records',
      'mcs_learning_candidates',
      'mcs_outcomes',
    ]);
  });
});
