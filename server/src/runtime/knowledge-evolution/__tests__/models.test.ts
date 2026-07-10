import { describe, expect, it } from 'vitest';
import {
  assertNoProtectedFields,
  KnowledgeEvolutionValidationError,
  validateKnowledgeEvolutionError,
  validateKnowledgeEvolutionMetricsSnapshot,
  validateKnowledgeEvolutionPlan,
  validateKnowledgeEvolutionRecord,
  validateKnowledgeEvolutionVersion,
  validateKnowledgeLanguageEvolutionRecord,
  validateKnowledgeRetrievalRollout,
  validateKnowledgeRollbackPlan,
  validateKnowledgeSupersessionRecord,
  KNOWLEDGE_EVOLUTION_RECORD_PROTECTED_FIELDS,
} from '../models/index.js';
import {
  evolutionError,
  evolutionPlan,
  evolutionRecord,
  evolutionVersion,
  languageEvolutionRecord,
  metricsSnapshot,
  retrievalRollout,
  rollbackPlan,
  supersessionRecord,
} from './fixtures.js';

describe('knowledge evolution model validation', () => {
  describe('evolution record', () => {
    it('accepts a well-formed record', () => {
      expect(validateKnowledgeEvolutionRecord(evolutionRecord()).ok).toBe(true);
    });

    it('rejects a missing approval reference (never acts without approval)', () => {
      const { approvalReference: _omit, ...rest } = evolutionRecord();
      const res = validateKnowledgeEvolutionRecord(rest);
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('approvalReference');
    });

    it('rejects a non-Team-Magnificent scope', () => {
      const res = validateKnowledgeEvolutionRecord(
        evolutionRecord({ teamKey: 'other_team' as never, teamName: 'Other' as never }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('teamKey');
      expect(res.errors.join(' ')).toContain('teamName');
    });

    it('rejects an unsupported language', () => {
      const res = validateKnowledgeEvolutionRecord(
        evolutionRecord({ language: 'fr' as never }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('language');
    });

    it('rejects an out-of-vocabulary status', () => {
      const res = validateKnowledgeEvolutionRecord(
        evolutionRecord({ status: 'active' as never }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('status');
    });

    it('rejects missing source lineage arrays', () => {
      const res = validateKnowledgeEvolutionRecord(
        evolutionRecord({ sourceCandidateIds: undefined as never }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('sourceCandidateIds');
    });
  });

  describe('evolution plan', () => {
    it('accepts a well-formed plan', () => {
      expect(validateKnowledgeEvolutionPlan(evolutionPlan()).ok).toBe(true);
    });

    it('rejects an invalid step key', () => {
      const res = validateKnowledgeEvolutionPlan(
        evolutionPlan({
          requiredSteps: [{ stepKey: 'nope' as never, required: true, status: 'pending' }],
        }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('stepKey');
    });
  });

  describe('version', () => {
    it('accepts a well-formed version', () => {
      expect(validateKnowledgeEvolutionVersion(evolutionVersion()).ok).toBe(true);
    });

    it('requires version >= 1', () => {
      const res = validateKnowledgeEvolutionVersion(evolutionVersion({ version: 0 }));
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('version');
    });

    it('requires a snapshotAfter object', () => {
      const res = validateKnowledgeEvolutionVersion(
        evolutionVersion({ snapshotAfter: undefined as never }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('snapshotAfter');
    });
  });

  describe('supersession', () => {
    it('accepts a well-formed record', () => {
      expect(validateKnowledgeSupersessionRecord(supersessionRecord()).ok).toBe(true);
    });

    it('rejects identical old/new object ids', () => {
      const res = validateKnowledgeSupersessionRecord(
        supersessionRecord({ oldKnowledgeObjectId: 'same', newKnowledgeObjectId: 'same' }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('must differ');
    });
  });

  describe('retrieval rollout', () => {
    it('accepts a well-formed rollout', () => {
      expect(validateKnowledgeRetrievalRollout(retrievalRollout()).ok).toBe(true);
    });

    it('rejects an unknown agent key', () => {
      const res = validateKnowledgeRetrievalRollout(
        retrievalRollout({ availableToAgents: ['ghost' as never] }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('availableToAgents');
    });
  });

  describe('language evolution', () => {
    it('accepts a human-reviewed variant', () => {
      expect(validateKnowledgeLanguageEvolutionRecord(languageEvolutionRecord()).ok).toBe(true);
    });

    it('rejects same source/target language', () => {
      const res = validateKnowledgeLanguageEvolutionRecord(
        languageEvolutionRecord({ sourceLanguage: 'en', targetLanguage: 'en' }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('must differ');
    });

    it('rejects an active variant without activatedAt (activation must be auditable)', () => {
      const res = validateKnowledgeLanguageEvolutionRecord(
        languageEvolutionRecord({ translationStatus: 'active' }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('activatedAt');
    });
  });

  describe('rollback plan', () => {
    it('accepts a well-formed plan', () => {
      expect(validateKnowledgeRollbackPlan(rollbackPlan()).ok).toBe(true);
    });

    it('rejects a bad rollback type', () => {
      const res = validateKnowledgeRollbackPlan(
        rollbackPlan({ rollbackType: 'delete_everything' as never }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('rollbackType');
    });
  });

  describe('error record', () => {
    it('accepts a well-formed error', () => {
      expect(validateKnowledgeEvolutionError(evolutionError()).ok).toBe(true);
    });

    it('requires both raw and safe messages', () => {
      const res = validateKnowledgeEvolutionError(
        evolutionError({ safeMessage: '' as never }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('safeMessage');
    });
  });

  describe('metrics snapshot', () => {
    it('accepts a well-formed snapshot', () => {
      expect(validateKnowledgeEvolutionMetricsSnapshot(metricsSnapshot()).ok).toBe(true);
    });

    it('rejects a period whose end precedes its start', () => {
      const res = validateKnowledgeEvolutionMetricsSnapshot(
        metricsSnapshot({
          periodStart: new Date('2026-07-08T00:00:00.000Z'),
          periodEnd: new Date('2026-07-01T00:00:00.000Z'),
        }),
      );
      expect(res.ok).toBe(false);
      expect(res.errors.join(' ')).toContain('periodEnd');
    });
  });

  describe('assertNoProtectedFields', () => {
    it('throws when a patch touches an immutable field', () => {
      expect(() =>
        assertNoProtectedFields('record', { evolutionId: 'x' }, KNOWLEDGE_EVOLUTION_RECORD_PROTECTED_FIELDS),
      ).toThrow(KnowledgeEvolutionValidationError);
    });

    it('permits a patch on mutable fields', () => {
      expect(() =>
        assertNoProtectedFields('record', { status: 'completed' }, KNOWLEDGE_EVOLUTION_RECORD_PROTECTED_FIELDS),
      ).not.toThrow();
    });
  });
});
