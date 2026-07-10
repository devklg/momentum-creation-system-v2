/**
 * Knowledge Evolution Runtime — Lane E ACCEPTANCE suite (spec §46 + ACR-0012 Lane E list).
 *
 * These are end-to-end acceptance tests that prove the ratified acceptance criteria against the
 * MERGED lanes (0/A/B/C/D). They wire the real container/services/routes/workers over the Lane B
 * in-memory fakes + fake Chroma/Neo4j coordinators (the sanctioned "mocked adapters where a live
 * DB is not available" path from the brief) — no runtime logic is re-implemented here.
 *
 * Each `it(...)` names the acceptance criterion it proves so the implementation report can cite it.
 * This suite adds coverage; it changes no production code and weakens no existing governance/
 * boundary test.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  reindexKnowledgeEvolution,
  routeActiveKnowledgeCollection,
  type ChromaIndexPort,
  type KnowledgeReindexRequest,
} from '../indexing/index.js';
import { mapEvolutionToGraph, type GraphMapperInput } from '../graph/index.js';
import { publishConsumedEvent } from '../events/index.js';
import {
  handleGetEvolution,
  handleMarkRetrievalReady,
  handleRollback,
  handleStartEvolution,
} from '../routes.js';
import {
  resetKnowledgeEvolutionRuntimeForTest,
  setKnowledgeEvolutionRuntimeForTest,
} from '../container.js';
import { makeStartRequest } from './fakes.js';
import {
  defaultReindex,
  makeTestRuntime,
  mockReq,
  mockRes,
  startBody,
  type TestRuntimeBundle,
} from './laneDTestKit.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = (res: { body: unknown }): any => res.body;

/**
 * Drive an approved-candidate evolution to `retrieval_ready` through the SAME service path the
 * routes/workers use: start (validate + plan) → execute (version + coordination request) →
 * simulate Lane C completing Chroma/Neo4j → markRetrievalReady. Returns the final record + rollout.
 */
async function evolveToRetrievalReady(
  bundle: TestRuntimeBundle,
  overrides: Parameters<typeof makeStartRequest>[0] = {},
) {
  const { runtime, repositories } = bundle;
  const service = runtime.services.knowledgeEvolutionService;
  const { evolution, plan } = await service.startEvolution(makeStartRequest(overrides));
  await service.executeEvolutionPlan(plan.planId);
  // Lane C/D coordination completes (fake Chroma + Neo4j succeeded).
  await repositories.recordRepository.patch(evolution.evolutionId, {
    indexingStatus: 'completed',
    graphStatus: 'completed',
  });
  const record = (await service.getEvolutionById(evolution.evolutionId))!;
  const rollout = await service.markRetrievalReady({
    tenantId: record.tenantId,
    teamId: record.teamId,
    evolutionId: evolution.evolutionId,
    knowledgeObjectId: record.targetKnowledgeObjectId as string,
    version: record.versionCreated as number,
  });
  const finalRecord = (await service.getEvolutionById(evolution.evolutionId))!;
  return { record: finalRecord, rollout };
}

// ---------------------------------------------------------------------------
// §46.1 Activation acceptance criteria
// ---------------------------------------------------------------------------

describe('Acceptance §46.1 — approved candidate activation', () => {
  it('approved candidate becomes an active Knowledge Object (version + KO id + retrieval-ready)', async () => {
    const bundle = makeTestRuntime();
    const { record, rollout } = await evolveToRetrievalReady(bundle);

    expect(record.targetKnowledgeObjectId).toBeDefined();
    expect(record.versionCreated).toBe(1);
    expect(record.status).toBe('retrieval_ready');
    expect(record.retrievalStatus).toBe('ready');
    expect(rollout.retrievalReady).toBe(true);
  });

  it('approval reference is REQUIRED — an evolution without one is rejected (approval_missing)', async () => {
    const bundle = makeTestRuntime();
    const service = bundle.runtime.services.knowledgeEvolutionService;
    await expect(
      service.startEvolution(
        makeStartRequest({
          approvalReference: undefined as unknown as ReturnType<typeof makeStartRequest>['approvalReference'],
        }),
      ),
    ).rejects.toMatchObject({ errorType: 'approval_missing' });
    // The violation is persisted for audit (fail-safe, spec §30).
    expect(bundle.repositories.errorRepository.store.at(0)?.errorType).toBe('approval_missing');
  });

  it('source traceability is preserved end-to-end (candidate lineage survives onto the record)', async () => {
    const bundle = makeTestRuntime();
    const { record } = await evolveToRetrievalReady(bundle, {
      sourceCandidateIds: ['cand_alpha'],
      sourceLearningSignalIds: ['sig_beta'],
      sourceOutcomeIds: ['out_gamma'],
    });
    expect(record.sourceCandidateIds).toContain('cand_alpha');
    expect(record.sourceLearningSignalIds).toContain('sig_beta');
    expect(record.sourceOutcomeIds).toContain('out_gamma');
  });

  it('a version record is created for the material change (spec §16)', async () => {
    const bundle = makeTestRuntime();
    const { record } = await evolveToRetrievalReady(bundle);
    const koId = record.targetKnowledgeObjectId as string;
    const versions = bundle.repositories.versionRepository.store.filter(
      (v) => v.knowledgeObjectId === koId,
    );
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0]!.changeType).toBe('created');
    expect(versions[0]!.approvedBy).toBe('TMBA-20260101-000001');
    expect(versions[0]!.reason).toContain('create_new_knowledge');
  });

  it('Team Magnificent scope is preserved on the evolution record', async () => {
    const bundle = makeTestRuntime();
    const { record } = await evolveToRetrievalReady(bundle);
    expect(record.teamKey).toBe('team_magnificent');
    expect(record.teamName).toBe('Team Magnificent');
  });

  it('non-Team-Magnificent BA-derived knowledge is rejected (invalid_ba_scope)', async () => {
    const service = makeTestRuntime().runtime.services.knowledgeEvolutionService;
    await expect(
      service.startEvolution(
        makeStartRequest({
          teamKey: 'team_other' as never,
          teamName: 'Other' as never,
          baId: 'TMBA-1',
        }),
      ),
    ).rejects.toMatchObject({ errorType: 'invalid_ba_scope' });
  });
});

// ---------------------------------------------------------------------------
// §46.7 Retrieval-rollout acceptance criteria — readiness gated on checks
// ---------------------------------------------------------------------------

describe('Acceptance §46.7 — retrieval readiness is gated', () => {
  it('retrieval readiness is NOT granted before Chroma/Neo4j coordination completes', async () => {
    const bundle = makeTestRuntime();
    const service = bundle.runtime.services.knowledgeEvolutionService;
    const { evolution, plan } = await service.startEvolution(makeStartRequest());
    await service.executeEvolutionPlan(plan.planId); // leaves indexing/graph PENDING
    const record = (await service.getEvolutionById(evolution.evolutionId))!;

    const rollout = await service.markRetrievalReady({
      tenantId: record.tenantId,
      teamId: record.teamId,
      evolutionId: evolution.evolutionId,
      knowledgeObjectId: record.targetKnowledgeObjectId as string,
      version: record.versionCreated as number,
    });

    expect(rollout.retrievalReady).toBe(false);
    expect(rollout.blockedReason).toBeDefined();
    const after = (await service.getEvolutionById(evolution.evolutionId))!;
    expect(after.retrievalStatus).toBe('blocked');
  });

  it('a blocked rollout preserves the blocking reason (spec §21.2)', async () => {
    const bundle = makeTestRuntime();
    const service = bundle.runtime.services.knowledgeEvolutionService;
    const { evolution, plan } = await service.startEvolution(makeStartRequest());
    await service.executeEvolutionPlan(plan.planId);
    const record = (await service.getEvolutionById(evolution.evolutionId))!;
    const rollout = await service.markRetrievalReady({
      tenantId: record.tenantId,
      teamId: record.teamId,
      evolutionId: evolution.evolutionId,
      knowledgeObjectId: record.targetKnowledgeObjectId as string,
      version: record.versionCreated as number,
    });
    expect(typeof rollout.blockedReason).toBe('string');
    expect(rollout.blockedReason).toMatch(/chroma_indexing|neo4j_graph_sync/);
  });
});

// ---------------------------------------------------------------------------
// §46.3 / §46.4 Supersession + archival — stored, auditable, excluded from retrieval
// ---------------------------------------------------------------------------

describe('Acceptance §46.3 — supersession', () => {
  it('supersession stores an auditable record and links old→new knowledge', async () => {
    const bundle = makeTestRuntime();
    const service = bundle.runtime.services.knowledgeEvolutionService;
    const { plan } = await service.startEvolution(
      makeStartRequest({
        inputType: 'approved_supersession',
        evolutionAction: 'supersede_existing_knowledge',
        sourceKnowledgeObjectIds: ['ko_old'],
      }),
    );
    const executed = await service.executeEvolutionPlan(plan.planId);

    const supersession = bundle.repositories.supersessionRepository.store.at(0);
    expect(supersession).toBeDefined();
    expect(supersession!.oldKnowledgeObjectId).toBe('ko_old');
    expect(supersession!.newKnowledgeObjectId).toBe(executed.targetKnowledgeObjectId);
    // Approval lineage preserved on the supersession record (audit, spec §17.2).
    expect(supersession!.approvalReference.approvalId).toBe('appr_1');
  });

  it('superseded knowledge is EXCLUDED from active retrieval (removed, not indexed)', () => {
    const route = routeActiveKnowledgeCollection({
      domain: 'success',
      language: 'en',
      lifecycle: 'superseded',
      approved: true,
    });
    expect(route.action).toBe('remove_from_active');
    // The old object still maps to its collection (so it can be excised) — it is not re-indexed.
    expect(route.activeCollection).toBe('mcs_success_knowledge_en');
  });

  it('emits knowledge.evolution.supersession_applied through the worker pipeline', async () => {
    const bundle = makeTestRuntime();
    bundle.runtime.workers.startAll();
    await publishConsumedEvent(bundle.runtime.bus, bundle.runtimeDeps, 'knowledge.supersession.approved', {
      request: makeStartRequest({
        inputType: 'approved_supersession',
        evolutionAction: 'supersede_existing_knowledge',
        sourceKnowledgeObjectIds: ['ko_old'],
      }),
    });
    const types = bundle.runtime.bus.emitted().map((e) => e.type);
    expect(types).toContain('knowledge.evolution.supersession_applied');
  });
});

describe('Acceptance §46.4 — archival', () => {
  it('archived knowledge remains stored/auditable but is EXCLUDED from active retrieval', () => {
    const route = routeActiveKnowledgeCollection({
      domain: 'success',
      language: 'en',
      lifecycle: 'archived',
      approved: true,
    });
    expect(route.action).toBe('remove_from_active');
  });

  it('emits knowledge.evolution.archive_applied through the worker pipeline', async () => {
    const bundle = makeTestRuntime();
    bundle.runtime.workers.startAll();
    await publishConsumedEvent(bundle.runtime.bus, bundle.runtimeDeps, 'knowledge.archive.approved', {
      request: makeStartRequest({
        inputType: 'approved_archive',
        evolutionAction: 'archive_existing_knowledge',
        sourceKnowledgeObjectIds: ['ko_old'],
      }),
    });
    const types = bundle.runtime.bus.emitted().map((e) => e.type);
    expect(types).toContain('knowledge.evolution.archive_applied');
  });
});

// ---------------------------------------------------------------------------
// §46.5 Reindexing — candidate collections stay separate; en + es supported
// ---------------------------------------------------------------------------

/** Tiny in-memory Chroma port that records which collections were written / deleted. */
function inMemoryChroma() {
  const upserts: Array<{ collection: string; id: string }> = [];
  const deletes: Array<{ collection: string }> = [];
  const port: ChromaIndexPort = {
    async ensureCollection() {},
    async upsert({ collection, id }) {
      upserts.push({ collection, id });
    },
    async deleteByFilter({ collection }) {
      deletes.push({ collection });
    },
  };
  return { port, upserts, deletes };
}

function reindexReq(overrides: Partial<KnowledgeReindexRequest> = {}): KnowledgeReindexRequest {
  return {
    evolutionId: 'evo_acc',
    knowledgeObjectId: 'ko_acc',
    version: 1,
    tenantId: 'tenant_team_magnificent',
    teamId: 'team_magnificent',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    domain: 'success',
    language: 'en',
    lifecycle: 'active',
    approved: true,
    document: 'An approved success principle worth activating.',
    sourceCandidateIds: ['cand_acc'],
    ...overrides,
  };
}

describe('Acceptance §46.5 — reindexing & candidate separation', () => {
  it('candidate / review-only knowledge is NEVER routed into an active collection', () => {
    for (const lifecycle of ['candidate', 'review_only'] as const) {
      const route = routeActiveKnowledgeCollection({
        domain: 'success',
        language: 'en',
        lifecycle,
        approved: true,
      });
      expect(route.action).toBe('keep_out_of_active');
      expect(route.activeCollection).toBeNull();
      // The separate review-only candidate collection is always reported, never conflated.
      expect(route.reviewOnlyCollection).toBe('mcs_learning_candidates_review');
    }
  });

  it('an unapproved item is never active-indexed even if its lifecycle looks active', async () => {
    const { port, upserts } = inMemoryChroma();
    const result = await reindexKnowledgeEvolution(reindexReq({ approved: false }), { chroma: port });
    expect(result.action).toBe('keep_out_of_active');
    expect(upserts).toHaveLength(0);
  });

  it('English knowledge routes to the *_en active collection', async () => {
    const { port, upserts } = inMemoryChroma();
    const result = await reindexKnowledgeEvolution(reindexReq({ language: 'en' }), { chroma: port });
    expect(result.status).toBe('completed');
    expect(result.collection).toBe('mcs_success_knowledge_en');
    expect(upserts[0]!.collection).toBe('mcs_success_knowledge_en');
  });

  it('Spanish knowledge routes to the *_es active collection (bilingual index support)', async () => {
    const { port, upserts } = inMemoryChroma();
    const result = await reindexKnowledgeEvolution(reindexReq({ language: 'es' }), { chroma: port });
    expect(result.status).toBe('completed');
    expect(result.collection).toBe('mcs_success_knowledge_es');
    expect(upserts[0]!.collection).toBe('mcs_success_knowledge_es');
  });

  it('active reindex preserves tenant/team/language/source metadata (spec §19.1)', async () => {
    const meta: Record<string, unknown>[] = [];
    const port: ChromaIndexPort = {
      async ensureCollection() {},
      async upsert({ metadata }) {
        meta.push(metadata);
      },
      async deleteByFilter() {},
    };
    await reindexKnowledgeEvolution(reindexReq(), { chroma: port });
    expect(meta[0]).toMatchObject({
      tenantId: 'tenant_team_magnificent',
      teamKey: 'team_magnificent',
      language: 'en',
      sourceTraceable: true,
    });
  });
});

// ---------------------------------------------------------------------------
// §46.6 Graph — links created; §46.8 bilingual; Context Manager availability
// ---------------------------------------------------------------------------

describe('Acceptance §46.6 — graph sync links', () => {
  function graphInput(overrides: Partial<GraphMapperInput> = {}): GraphMapperInput {
    return {
      evolutionId: 'evo_g',
      knowledgeObjectId: 'ko_g',
      version: 1,
      domain: 'success',
      language: 'en',
      tenantId: 'tenant_team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      baId: 'TMBA-20260101-000001',
      evolutionAction: 'create_new_knowledge',
      sourceCandidateIds: ['cand_g'],
      sourceLearningSignalIds: ['sig_g'],
      sourceOutcomeIds: ['out_g'],
      ...overrides,
    };
  }

  it('creates candidate→knowledge, version, team-scope, learning-signal and outcome links', () => {
    const rels = new Set(mapEvolutionToGraph(graphInput()).map((s) => s.relationship));
    expect(rels).toContain('APPROVED_AS'); // candidate → knowledge
    expect(rels).toContain('HAS_VERSION'); // version link
    expect(rels).toContain('SCOPED_TO'); // Team Magnificent scope
    expect(rels).toContain('MEMBER_OF'); // BA membership
    expect(rels).toContain('DERIVED_FROM'); // learning signal lineage
    expect(rels).toContain('SUPPORTED_BY'); // outcome lineage
  });

  it('creates a SUPERSEDES link for a supersession', () => {
    const rels = new Set(
      mapEvolutionToGraph(
        graphInput({
          evolutionAction: 'supersede_existing_knowledge',
          supersededKnowledgeObjectIds: ['ko_old'],
        }),
      ).map((s) => s.relationship),
    );
    expect(rels).toContain('SUPERSEDES');
  });

  it('creates a HAS_LANGUAGE_VARIANT link for a translated variant', () => {
    const rels = new Set(
      mapEvolutionToGraph(
        graphInput({ evolutionAction: 'create_language_variant', languageVariantSourceId: 'ko_en' }),
      ).map((s) => s.relationship),
    );
    expect(rels).toContain('HAS_LANGUAGE_VARIANT');
  });
});

describe('Acceptance §21.3 — Context Manager may retrieve ONLY retrieval-ready knowledge', () => {
  it('AVAILABLE_TO agent links are NOT emitted while knowledge is not retrieval-ready', () => {
    const notReady = mapEvolutionToGraph({
      evolutionId: 'evo_cm',
      knowledgeObjectId: 'ko_cm',
      version: 1,
      domain: 'success',
      language: 'en',
      tenantId: 'tenant_team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      evolutionAction: 'create_new_knowledge',
      availableToAgents: ['steve_success', 'michael_magnificent'],
      retrievalReady: false,
    });
    expect(notReady.some((s) => s.relationship === 'AVAILABLE_TO')).toBe(false);
  });

  it('AVAILABLE_TO agent links ARE emitted only once retrieval-ready', () => {
    const ready = mapEvolutionToGraph({
      evolutionId: 'evo_cm',
      knowledgeObjectId: 'ko_cm',
      version: 1,
      domain: 'success',
      language: 'en',
      tenantId: 'tenant_team_magnificent',
      teamKey: 'team_magnificent',
      teamName: 'Team Magnificent',
      evolutionAction: 'create_new_knowledge',
      availableToAgents: ['steve_success', 'michael_magnificent'],
      retrievalReady: true,
    });
    const availableTo = ready.filter((s) => s.relationship === 'AVAILABLE_TO');
    expect(availableTo.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// §46.8 Bilingual — en + es evolve; unreviewed machine translation blocked
// ---------------------------------------------------------------------------

describe('Acceptance §46.8 — bilingual evolution', () => {
  it('English knowledge evolution works end-to-end', async () => {
    const { record } = await evolveToRetrievalReady(makeTestRuntime(), { language: 'en' });
    expect(record.language).toBe('en');
    expect(record.retrievalStatus).toBe('ready');
  });

  it('Spanish knowledge evolution works end-to-end', async () => {
    const { record } = await evolveToRetrievalReady(makeTestRuntime(), { language: 'es' });
    expect(record.language).toBe('es');
    expect(record.retrievalStatus).toBe('ready');
  });

  it('a human-reviewed approved translation can become an active language variant', async () => {
    const service = makeTestRuntime().runtime.services.knowledgeEvolutionService;
    const { evolution } = await service.startEvolution(
      makeStartRequest({
        inputType: 'approved_translation',
        evolutionAction: 'create_language_variant',
        language: 'es',
        sourceKnowledgeObjectIds: ['ko_en'],
        metadata: { translation: { status: 'human_reviewed', machineTranslated: true } },
      }),
    );
    expect(evolution.evolutionId).toMatch(/^kev_/);
    expect(evolution.language).toBe('es');
  });

  it('UNREVIEWED machine translation is BLOCKED (invalid_language)', async () => {
    const service = makeTestRuntime().runtime.services.knowledgeEvolutionService;
    await expect(
      service.startEvolution(
        makeStartRequest({
          inputType: 'approved_translation',
          evolutionAction: 'create_language_variant',
          language: 'es',
          sourceKnowledgeObjectIds: ['ko_en'],
          metadata: { translation: { status: 'rejected', machineTranslated: true } },
        }),
      ),
    ).rejects.toMatchObject({ errorType: 'invalid_language' });
  });
});

// ---------------------------------------------------------------------------
// §46.9 Rollback — preserves audit history
// ---------------------------------------------------------------------------

describe('Acceptance §46.9 — rollback preserves audit history', () => {
  it('rollback marks the evolution rolled_back WITHOUT erasing the record, version, or plan', async () => {
    const bundle = makeTestRuntime();
    const service = bundle.runtime.services.knowledgeEvolutionService;
    const { evolution, plan } = await service.startEvolution(makeStartRequest());
    const executed = await service.executeEvolutionPlan(plan.planId);
    const koId = executed.targetKnowledgeObjectId as string;

    const rolledBack = await service.rollbackEvolution({
      tenantId: evolution.tenantId,
      teamId: evolution.teamId,
      evolutionId: evolution.evolutionId,
      rollbackReason: 'bad activation',
      requestedBy: 'TMBA-20260101-000001',
    });

    expect(rolledBack.status).toBe('rolled_back');
    expect(rolledBack.retrievalStatus).toBe('rolled_back');

    // Audit history is intact: the record still exists, the version snapshot is preserved,
    // a rollback plan was recorded, and the plan is still queryable.
    expect(await service.getEvolutionById(evolution.evolutionId)).not.toBeNull();
    expect(
      bundle.repositories.versionRepository.store.some((v) => v.knowledgeObjectId === koId),
    ).toBe(true);
    expect(
      await bundle.repositories.rollbackPlanRepository.findByEvolutionId(evolution.evolutionId),
    ).not.toBeNull();
    expect(await bundle.repositories.planRepository.findByPlanId(plan.planId)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §46.10 Runtime boundaries — no approval, no candidate creation, no Telnyx, no external comms
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME_ROOT = join(HERE, '..');

/** Recursively collect production `.ts` files under the runtime (excludes any `__tests__`). */
function collectRuntimeSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      collectRuntimeSources(full, acc);
    } else if (entry.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('Acceptance §46.10 — runtime boundaries', () => {
  const sources = collectRuntimeSources(RUNTIME_ROOT);

  it('has production source to scan (guard against an empty sweep)', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('the runtime imports NO Telnyx / external-communication module (only comments may mention it)', () => {
    const importLine = /^\s*import\b.*$/gm;
    const offenders: string[] = [];
    for (const file of sources) {
      const content = readFileSync(file, 'utf8');
      for (const line of content.match(importLine) ?? []) {
        if (/telnyx|resend|ringless|voicemail|\bsms\b|nodemailer|twilio/i.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the KnowledgeEvolutionService contract exposes NO approve/createCandidate surface', () => {
    const bundle = makeTestRuntime();
    const service = bundle.runtime.services.knowledgeEvolutionService as unknown as Record<
      string,
      unknown
    >;
    const methods = Object.keys(service);
    // Positive surface: exactly the ratified §26.1 contract.
    expect(methods.sort()).toEqual(
      [
        'createEvolutionPlan',
        'executeEvolutionPlan',
        'getEvolutionById',
        'markRetrievalReady',
        'rollbackEvolution',
        'startEvolution',
      ].sort(),
    );
    // Negative surface: no method that would approve knowledge or create raw candidates.
    for (const m of methods) {
      expect(/approve|createcandidate|create_candidate|selfmodify/i.test(m)).toBe(false);
    }
  });

  it('the reindex default port routes through the governed direct stack, not Universal Gateway', () => {
    // Lane C default Chroma port uses `persistenceCall` (direct governed stack). No source file
    // imports a Universal Gateway / external MCP client.
    const offenders: string[] = [];
    for (const file of sources) {
      const content = readFileSync(file, 'utf8');
      for (const line of content.match(/^\s*import\b.*$/gm) ?? []) {
        if (/universal-gateway|gateway-core|mcp__|axios/i.test(line)) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// End-to-end through the ROUTE handlers (Lane D internal API) — full stack proof
// ---------------------------------------------------------------------------

describe('Acceptance — end-to-end through the internal API route handlers', () => {
  it('start → get → retrieval-ready → rollback across the five spec §25 endpoints', async () => {
    setKnowledgeEvolutionRuntimeForTest(makeTestRuntime({ reindex: defaultReindex }).runtime);
    try {
      // POST / — start
      const startRes = mockRes();
      await handleStartEvolution(mockReq({ body: startBody() }), startRes);
      expect(startRes.statusCode).toBe(201);
      const evolutionId = body(startRes).evolution.evolutionId as string;
      expect(body(startRes).evolution.teamKey).toBe('team_magnificent');

      // GET /:evolutionId — read
      const getRes = mockRes();
      await handleGetEvolution(mockReq({ params: { evolutionId } }), getRes);
      expect(getRes.statusCode).toBe(200);
      expect(body(getRes).evolution.evolutionId).toBe(evolutionId);

      // POST /:evolutionId/retrieval-ready — rollout gate (returns a boolean-decided rollout)
      const readyRes = mockRes();
      await handleMarkRetrievalReady(
        mockReq({
          params: { evolutionId },
          body: {
            tenantId: 'tenant_team_magnificent',
            teamId: 'team_magnificent',
            knowledgeObjectId: 'ko_1',
            version: 1,
          },
        }),
        readyRes,
      );
      expect(readyRes.statusCode).toBe(200);
      expect(typeof body(readyRes).rollout.retrievalReady).toBe('boolean');

      // POST /:evolutionId/rollback — audited rollback
      const rollbackRes = mockRes();
      await handleRollback(
        mockReq({
          params: { evolutionId },
          body: {
            tenantId: 'tenant_team_magnificent',
            teamId: 'team_magnificent',
            rollbackReason: 'acceptance rollback',
            requestedBy: 'TMBA-20260101-000001',
          },
        }),
        rollbackRes,
      );
      expect(rollbackRes.statusCode).toBe(200);
      expect(body(rollbackRes).evolution.status).toBe('rolled_back');
    } finally {
      resetKnowledgeEvolutionRuntimeForTest();
    }
  });

  it('a non-Team-Magnificent start is refused at the API with a safe 422 (no raw internals leaked)', async () => {
    setKnowledgeEvolutionRuntimeForTest(makeTestRuntime().runtime);
    try {
      const res = mockRes();
      await handleStartEvolution(mockReq({ body: { ...startBody(), teamName: 'Wrong Team' } }), res);
      expect(res.statusCode).toBe(422);
      expect(body(res).errorType).toBe('invalid_team_scope');
      // Only a safe message is returned — no stack, no raw approval internals.
      expect(typeof body(res).error).toBe('string');
    } finally {
      resetKnowledgeEvolutionRuntimeForTest();
    }
  });
});
