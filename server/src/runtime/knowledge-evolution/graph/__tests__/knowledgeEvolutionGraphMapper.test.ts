import { describe, expect, it } from 'vitest';
import {
  graphMapperInputFromRecord,
  mapEvolutionToGraph,
  type GraphMapperInput,
  type KnowledgeGraphRelationship,
} from '../knowledgeEvolutionGraphMapper.js';
import type { KnowledgeEvolutionRecord } from '@momentum/shared/runtime';

function relationships(statements: ReturnType<typeof mapEvolutionToGraph>) {
  return statements.map((s) => s.relationship);
}

function statementFor(
  statements: ReturnType<typeof mapEvolutionToGraph>,
  rel: KnowledgeGraphRelationship | 'KNOWLEDGE_NODE',
) {
  return statements.filter((s) => s.relationship === rel);
}

const baseInput: GraphMapperInput = {
  evolutionId: 'evo_1',
  knowledgeObjectId: 'ko_new',
  version: 2,
  domain: 'success',
  language: 'en',
  tenantId: 'momentum',
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  baId: 'TMBA-20260101-ABCDEF',
  evolutionAction: 'create_new_knowledge',
  sourceCandidateIds: ['cand_1'],
  sourceLearningSignalIds: ['sig_1'],
  sourceOutcomeIds: ['out_1'],
};

describe('mapEvolutionToGraph — required §20.1 relationships', () => {
  it('emits the knowledge node, domain, scope, membership, candidate, version, and lineage links', () => {
    const statements = mapEvolutionToGraph(baseInput);
    const rels = relationships(statements);
    expect(rels).toEqual(
      expect.arrayContaining([
        'KNOWLEDGE_NODE',
        'BELONGS_TO_DOMAIN',
        'SCOPED_TO',
        'MEMBER_OF',
        'APPROVED_AS',
        'HAS_VERSION',
        'DERIVED_FROM',
        'SUPPORTED_BY',
      ]),
    );

    // every statement is an idempotent MERGE
    for (const s of statements) {
      expect(s.cypher).toContain('MERGE');
    }

    const scope = statementFor(statements, 'SCOPED_TO')[0]!;
    expect(scope.cypher).toContain('SCOPED_TO');
    expect(scope.params).toMatchObject({ teamKey: 'team_magnificent', teamName: 'Team Magnificent' });

    const candidate = statementFor(statements, 'APPROVED_AS')[0]!;
    expect(candidate.params).toMatchObject({ candidateId: 'cand_1', knowledgeObjectId: 'ko_new' });

    const version = statementFor(statements, 'HAS_VERSION')[0]!;
    expect(version.params).toMatchObject({ knowledgeObjectId: 'ko_new', version: 2 });
  });

  it('omits SCOPED_TO / MEMBER_OF when no team scope is present', () => {
    const statements = mapEvolutionToGraph({
      ...baseInput,
      teamKey: undefined,
      teamName: undefined,
      baId: undefined,
    });
    const rels = relationships(statements);
    expect(rels).not.toContain('SCOPED_TO');
    expect(rels).not.toContain('MEMBER_OF');
  });

  it('emits SUPERSEDES links for superseded knowledge objects', () => {
    const statements = mapEvolutionToGraph({
      ...baseInput,
      evolutionAction: 'supersede_existing_knowledge',
      supersededKnowledgeObjectIds: ['ko_old_a', 'ko_old_b'],
    });
    const sup = statementFor(statements, 'SUPERSEDES');
    expect(sup).toHaveLength(2);
    expect(sup[0]!.params).toMatchObject({
      knowledgeObjectId: 'ko_new',
      oldKnowledgeObjectId: 'ko_old_a',
    });
  });

  it('emits HAS_LANGUAGE_VARIANT for a language variant', () => {
    const statements = mapEvolutionToGraph({
      ...baseInput,
      language: 'es',
      evolutionAction: 'create_language_variant',
      languageVariantSourceId: 'ko_en_source',
    });
    const variant = statementFor(statements, 'HAS_LANGUAGE_VARIANT')[0]!;
    expect(variant.params).toMatchObject({
      sourceKnowledgeObjectId: 'ko_en_source',
      knowledgeObjectId: 'ko_new',
    });
  });

  it('only emits AVAILABLE_TO links once retrieval-ready', () => {
    const notReady = mapEvolutionToGraph({
      ...baseInput,
      availableToAgents: ['steve_success', 'ivory'],
      retrievalReady: false,
    });
    expect(relationships(notReady)).not.toContain('AVAILABLE_TO');

    const ready = mapEvolutionToGraph({
      ...baseInput,
      availableToAgents: ['steve_success', 'ivory'],
      retrievalReady: true,
    });
    expect(statementFor(ready, 'AVAILABLE_TO')).toHaveLength(2);
  });

  it('omits HAS_VERSION when no version is set', () => {
    const statements = mapEvolutionToGraph({ ...baseInput, version: undefined });
    expect(relationships(statements)).not.toContain('HAS_VERSION');
  });
});

describe('graphMapperInputFromRecord', () => {
  const record: KnowledgeEvolutionRecord = {
    evolutionId: 'evo_9',
    tenantId: 'momentum',
    teamId: 'team_1',
    teamKey: 'team_magnificent',
    teamName: 'Team Magnificent',
    inputType: 'approved_supersession',
    inputId: 'in_1',
    status: 'graph_syncing',
    domain: 'training',
    language: 'en',
    targetKnowledgeObjectId: 'ko_target',
    sourceKnowledgeObjectIds: ['ko_prev'],
    sourceCandidateIds: ['cand_9'],
    sourceOutcomeIds: [],
    sourceLearningSignalIds: [],
    sourceEventIds: [],
    evolutionAction: 'supersede_existing_knowledge',
    versionCreated: 4,
    approvalReference: {
      approvalId: 'appr_1',
      approvedBy: 'kevin',
      approvalType: 'review_workflow',
      approvedAt: new Date('2026-07-10T00:00:00Z'),
    },
    indexingStatus: 'completed',
    graphStatus: 'pending',
    retrievalStatus: 'not_ready',
    createdAt: new Date('2026-07-10T00:00:00Z'),
    updatedAt: new Date('2026-07-10T00:00:00Z'),
  };

  it('derives supersession links + knowledge object id from the canonical record', () => {
    const input = graphMapperInputFromRecord(record);
    expect(input.knowledgeObjectId).toBe('ko_target');
    expect(input.version).toBe(4);
    expect(input.supersededKnowledgeObjectIds).toEqual(['ko_prev']);
    const statements = mapEvolutionToGraph(input);
    expect(relationships(statements)).toContain('SUPERSEDES');
  });
});
