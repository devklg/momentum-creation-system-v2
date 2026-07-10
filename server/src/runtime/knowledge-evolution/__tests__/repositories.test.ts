import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMemoryPersistence } from './fixtures.js';

const memory = vi.hoisted(() => {
  // Lazily constructed inside the mock factory to avoid hoist-order issues.
  const ref: { current: ReturnType<typeof import('./fixtures.js').makeMemoryPersistence> | null } = {
    current: null,
  };
  return ref;
});

vi.mock('../../../services/persistence/dispatch.js', () => ({
  persistenceCall: (tool: string, action: string, params: Record<string, unknown>) =>
    memory.current!.call(tool, action, params),
  PersistenceError: class PersistenceError extends Error {},
}));

import {
  appendSupersessionRecord,
  appendVersion,
  createEvolutionPlan,
  createEvolutionRecord,
  createRetrievalRollout,
  createRollbackPlan,
  ensureEvolutionRecord,
  ensureSupersessionRecord,
  getEvolutionRecordById,
  getLatestVersion,
  listVersionsForKnowledgeObject,
  markEvolutionCompleted,
  markRetrievalBlocked,
  markRetrievalReady,
  patchEvolutionRecord,
  recordEvolutionError,
  recordMetricsSnapshot,
  updateEvolutionStatus,
  updateTranslationStatus,
  createLanguageEvolutionRecord,
} from '../repositories/index.js';
import { KnowledgeEvolutionValidationError } from '../models/index.js';
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
import { KNOWLEDGE_EVOLUTION_RECORD_COLLECTION } from '../models/index.js';

beforeEach(() => {
  memory.current = makeMemoryPersistence();
});

describe('evolution record repository', () => {
  it('creates and reads back a record (canonical _id = evolutionId)', async () => {
    await createEvolutionRecord(evolutionRecord());
    const got = await getEvolutionRecordById('evo_1');
    expect(got?.evolutionId).toBe('evo_1');
    const stored = memory.current!.collection(KNOWLEDGE_EVOLUTION_RECORD_COLLECTION);
    expect(stored[0]?._id).toBe('evo_1');
  });

  it('rejects an invalid record before persisting', async () => {
    await expect(
      createEvolutionRecord(evolutionRecord({ teamKey: 'nope' as never })),
    ).rejects.toBeInstanceOf(KnowledgeEvolutionValidationError);
    expect(memory.current!.collection(KNOWLEDGE_EVOLUTION_RECORD_COLLECTION)).toHaveLength(0);
  });

  it('createEvolutionRecord throws on duplicate id', async () => {
    await createEvolutionRecord(evolutionRecord());
    await expect(createEvolutionRecord(evolutionRecord())).rejects.toBeInstanceOf(
      KnowledgeEvolutionValidationError,
    );
  });

  it('ensureEvolutionRecord is idempotent under replay (no duplicate)', async () => {
    await ensureEvolutionRecord(evolutionRecord({ status: 'received' }));
    await ensureEvolutionRecord(evolutionRecord({ status: 'planning' }));
    const rows = memory.current!.collection(KNOWLEDGE_EVOLUTION_RECORD_COLLECTION);
    expect(rows).toHaveLength(1);
    // Returns the FIRST record unchanged — replay does not overwrite state.
    expect(rows[0]?.status).toBe('received');
  });

  it('patch advances status and stamps updatedAt without erasing lineage', async () => {
    await createEvolutionRecord(evolutionRecord());
    await updateEvolutionStatus('evo_1', 'completed', new Date('2026-07-05T00:00:00.000Z'));
    const got = await getEvolutionRecordById('evo_1');
    expect(got?.status).toBe('completed');
    expect(got?.updatedAt).toEqual(new Date('2026-07-05T00:00:00.000Z'));
    // Immutable lineage survives the patch.
    expect(got?.sourceCandidateIds).toEqual(['cand_1']);
    expect(got?.approvalReference.approvalId).toBe('appr_1');
    expect(got?.createdAt).toEqual(new Date('2026-07-02T00:00:00.000Z'));
  });

  it('patch refuses to modify immutable identity/lineage fields', async () => {
    await createEvolutionRecord(evolutionRecord());
    await expect(patchEvolutionRecord('evo_1', { evolutionId: 'evo_hijack' })).rejects.toBeInstanceOf(
      KnowledgeEvolutionValidationError,
    );
    await expect(
      patchEvolutionRecord('evo_1', { approvalReference: {} as never }),
    ).rejects.toBeInstanceOf(KnowledgeEvolutionValidationError);
  });

  it('markEvolutionCompleted sets status + completedAt', async () => {
    await createEvolutionRecord(evolutionRecord());
    await markEvolutionCompleted('evo_1', new Date('2026-07-06T00:00:00.000Z'));
    const got = await getEvolutionRecordById('evo_1');
    expect(got?.status).toBe('completed');
    expect(got?.completedAt).toEqual(new Date('2026-07-06T00:00:00.000Z'));
  });
});

describe('version repository (append-only audit history)', () => {
  it('appends versions and lists newest first', async () => {
    await appendVersion(evolutionVersion({ versionRecordId: 'ver_1', version: 1 }));
    await appendVersion(
      evolutionVersion({ versionRecordId: 'ver_2', version: 2, previousVersion: 1, changeType: 'updated' }),
    );
    const list = await listVersionsForKnowledgeObject('ko_1');
    expect(list.map((v) => v.version)).toEqual([2, 1]);
    const latest = await getLatestVersion('ko_1');
    expect(latest?.version).toBe(2);
  });

  it('refuses to overwrite an existing (knowledgeObjectId, version) pair', async () => {
    await appendVersion(evolutionVersion({ versionRecordId: 'ver_1', version: 1 }));
    await expect(
      appendVersion(evolutionVersion({ versionRecordId: 'ver_dup', version: 1 })),
    ).rejects.toBeInstanceOf(KnowledgeEvolutionValidationError);
    // The prior version is still there, untouched.
    const list = await listVersionsForKnowledgeObject('ko_1');
    expect(list).toHaveLength(1);
  });

  it('exposes no update/delete path (audit history is immutable)', async () => {
    const mod = await import('../repositories/knowledgeEvolutionVersion.repository.js');
    expect(Object.keys(mod)).not.toContain('patchVersion');
    expect(Object.keys(mod)).not.toContain('deleteVersion');
  });
});

describe('supersession repository', () => {
  it('appends and is idempotent via ensure', async () => {
    await appendSupersessionRecord(supersessionRecord());
    await ensureSupersessionRecord(supersessionRecord({ reason: 'changed reason' }));
    const rows = memory.current!.collection('knowledge_supersession_records');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe('refined guidance replaces prior version');
  });
});

describe('retrieval rollout repository', () => {
  it('creates a rollout that is NOT retrieval-ready by default', async () => {
    await createRetrievalRollout(retrievalRollout());
    const rows = memory.current!.collection('knowledge_retrieval_rollouts');
    expect(rows[0]?.retrievalReady).toBe(false);
  });

  it('markRetrievalReady flips the flag and stamps readyAt', async () => {
    await createRetrievalRollout(retrievalRollout());
    await markRetrievalReady('roll_1', new Date('2026-07-07T00:00:00.000Z'));
    const rows = memory.current!.collection('knowledge_retrieval_rollouts');
    expect(rows[0]?.retrievalReady).toBe(true);
    expect(rows[0]?.readyAt).toEqual(new Date('2026-07-07T00:00:00.000Z'));
  });

  it('markRetrievalBlocked keeps retrieval off with a reason', async () => {
    await createRetrievalRollout(retrievalRollout());
    await markRetrievalBlocked('roll_1', 'graph sync not complete');
    const rows = memory.current!.collection('knowledge_retrieval_rollouts');
    expect(rows[0]?.retrievalReady).toBe(false);
    expect(rows[0]?.blockedReason).toBe('graph sync not complete');
  });
});

describe('language evolution repository', () => {
  it('activates a variant and stamps activatedAt', async () => {
    await createLanguageEvolutionRecord(languageEvolutionRecord());
    await updateTranslationStatus('lang_1', 'active', new Date('2026-07-07T00:00:00.000Z'));
    const rows = memory.current!.collection('knowledge_language_evolution_records');
    expect(rows[0]?.translationStatus).toBe('active');
    expect(rows[0]?.activatedAt).toEqual(new Date('2026-07-07T00:00:00.000Z'));
  });
});

describe('plan / rollback / error / metrics repositories', () => {
  it('persists a plan, rollback plan, error, and metrics snapshot', async () => {
    await createEvolutionPlan(evolutionPlan());
    await createRollbackPlan(rollbackPlan());
    await recordEvolutionError(evolutionError());
    await recordMetricsSnapshot(metricsSnapshot());

    expect(memory.current!.collection('knowledge_evolution_plans')).toHaveLength(1);
    expect(memory.current!.collection('knowledge_rollback_plans')).toHaveLength(1);
    expect(memory.current!.collection('knowledge_evolution_errors')).toHaveLength(1);
    expect(memory.current!.collection('knowledge_evolution_metrics')).toHaveLength(1);
  });

  it('rejects a duplicate metrics snapshot id', async () => {
    await recordMetricsSnapshot(metricsSnapshot());
    await expect(recordMetricsSnapshot(metricsSnapshot())).rejects.toBeInstanceOf(
      KnowledgeEvolutionValidationError,
    );
  });
});
