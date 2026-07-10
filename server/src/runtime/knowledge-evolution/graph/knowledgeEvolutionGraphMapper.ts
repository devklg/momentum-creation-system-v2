/**
 * Neo4j graph mapper (Knowledge Evolution Runtime · Lane C).
 *
 * PURE mapping from an evolution's lineage into the idempotent Cypher statements that keep
 * the knowledge graph in sync. No I/O — every function here is deterministic and unit-testable
 * on its output alone. Execution lives in `knowledgeEvolutionGraphSync.service.ts`.
 *
 * Ratified authority: `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` §8.7, §20.1 (required
 * relationships) and §20.2 (graph-sync requirements).
 *
 * Hard constraints (Lane C brief): Neo4j does NOT override Mongo canonical state; these are
 * additive `MERGE` statements that preserve lineage. Every statement is idempotent so a
 * replayed graph sync creates no duplicates.
 *
 * The relationship shapes are transcribed verbatim from §20.1:
 *   (:KnowledgeCandidate)-[:APPROVED_AS]->(:Knowledge)
 *   (:Knowledge)-[:HAS_VERSION]->(:KnowledgeVersion)
 *   (:Knowledge)-[:SUPERSEDES]->(:Knowledge)
 *   (:Knowledge)-[:HAS_LANGUAGE_VARIANT]->(:Knowledge)
 *   (:Knowledge)-[:DERIVED_FROM]->(:LearningSignal)
 *   (:Knowledge)-[:SUPPORTED_BY]->(:Outcome)
 *   (:Knowledge)-[:BELONGS_TO_DOMAIN]->(:KnowledgeDomain)
 *   (:Knowledge)-[:AVAILABLE_TO]->(:Agent)
 *   (:BrandAmbassador)-[:MEMBER_OF]->(:TeamMagnificent)
 *   (:Knowledge)-[:SCOPED_TO]->(:TeamMagnificent)
 */

import type {
  KnowledgeEvolutionAction,
  KnowledgeEvolutionAgentKey,
  KnowledgeEvolutionDomain,
  KnowledgeEvolutionLanguage,
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionTeamKey,
  KnowledgeEvolutionTeamName,
} from '@momentum/shared/runtime';

/** The graph relationships this runtime maintains (spec §20.1), for typing + telemetry. */
export type KnowledgeGraphRelationship =
  | 'APPROVED_AS'
  | 'HAS_VERSION'
  | 'SUPERSEDES'
  | 'HAS_LANGUAGE_VARIANT'
  | 'DERIVED_FROM'
  | 'SUPPORTED_BY'
  | 'BELONGS_TO_DOMAIN'
  | 'AVAILABLE_TO'
  | 'MEMBER_OF'
  | 'SCOPED_TO';

export interface GraphSyncStatement {
  /** Which §20.1 relationship (or the base node upsert) this statement writes. */
  relationship: KnowledgeGraphRelationship | 'KNOWLEDGE_NODE';
  cypher: string;
  params: Record<string, unknown>;
}

export interface GraphMapperInput {
  evolutionId: string;
  knowledgeObjectId: string;
  version?: number;

  domain: KnowledgeEvolutionDomain;
  language: KnowledgeEvolutionLanguage;

  tenantId: string;
  teamKey?: KnowledgeEvolutionTeamKey;
  teamName?: KnowledgeEvolutionTeamName;
  baId?: string;

  evolutionAction: KnowledgeEvolutionAction;

  /** Candidate(s) this knowledge was approved from → APPROVED_AS. */
  sourceCandidateIds?: string[];
  /** Learning signal(s) this knowledge derived from → DERIVED_FROM. */
  sourceLearningSignalIds?: string[];
  /** Outcome(s) supporting this knowledge → SUPPORTED_BY. */
  sourceOutcomeIds?: string[];

  /** Knowledge object(s) this new knowledge SUPERSEDES (old ← new). */
  supersededKnowledgeObjectIds?: string[];
  /** Source-language knowledge this is a HAS_LANGUAGE_VARIANT of. */
  languageVariantSourceId?: string;

  /** Agents this knowledge is AVAILABLE_TO (only meaningful once retrieval-ready). */
  availableToAgents?: KnowledgeEvolutionAgentKey[];
  retrievalReady?: boolean;
}

const KNOWLEDGE_KEY = 'knowledgeObjectId';

/** MERGE-on-key the primary Knowledge node so relationship order is irrelevant. */
function knowledgeNodeStatement(input: GraphMapperInput): GraphSyncStatement {
  return {
    relationship: 'KNOWLEDGE_NODE',
    cypher: `
      MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
      SET k += {
        tenantId: $tenantId,
        domain: $domain,
        language: $language,
        evolutionId: $evolutionId,
        retrievalReady: $retrievalReady
      }
      ${input.version !== undefined ? 'SET k.version = $version' : ''}
      RETURN k.${KNOWLEDGE_KEY} AS knowledgeObjectId
    `.trim(),
    params: {
      knowledgeObjectId: input.knowledgeObjectId,
      tenantId: input.tenantId,
      domain: input.domain,
      language: input.language,
      evolutionId: input.evolutionId,
      retrievalReady: input.retrievalReady ?? false,
      ...(input.version !== undefined ? { version: input.version } : {}),
    },
  };
}

/**
 * Map an evolution's lineage into idempotent graph-sync statements (spec §20.1).
 * Returns statements in a stable, dependency-free order; each MERGEs its own endpoints.
 */
export function mapEvolutionToGraph(input: GraphMapperInput): GraphSyncStatement[] {
  const statements: GraphSyncStatement[] = [knowledgeNodeStatement(input)];

  // (:Knowledge)-[:BELONGS_TO_DOMAIN]->(:KnowledgeDomain)
  statements.push({
    relationship: 'BELONGS_TO_DOMAIN',
    cypher: `
      MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
      MERGE (d:KnowledgeDomain {key: $domain})
      MERGE (k)-[:BELONGS_TO_DOMAIN]->(d)
    `.trim(),
    params: { knowledgeObjectId: input.knowledgeObjectId, domain: input.domain },
  });

  // (:Knowledge)-[:SCOPED_TO]->(:TeamMagnificent) — Team Magnificent scope (spec §5, §20.2).
  if (input.teamKey) {
    statements.push({
      relationship: 'SCOPED_TO',
      cypher: `
        MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
        MERGE (t:TeamMagnificent {teamKey: $teamKey})
        ${input.teamName ? 'SET t.teamName = $teamName' : ''}
        MERGE (k)-[:SCOPED_TO]->(t)
      `.trim(),
      params: {
        knowledgeObjectId: input.knowledgeObjectId,
        teamKey: input.teamKey,
        ...(input.teamName ? { teamName: input.teamName } : {}),
      },
    });

    // (:BrandAmbassador)-[:MEMBER_OF]->(:TeamMagnificent) — BA membership lineage.
    if (input.baId) {
      statements.push({
        relationship: 'MEMBER_OF',
        cypher: `
          MERGE (b:BrandAmbassador {baId: $baId})
          MERGE (t:TeamMagnificent {teamKey: $teamKey})
          MERGE (b)-[:MEMBER_OF]->(t)
        `.trim(),
        params: { baId: input.baId, teamKey: input.teamKey },
      });
    }
  }

  // (:KnowledgeCandidate)-[:APPROVED_AS]->(:Knowledge) — candidate lineage (spec §20.2).
  for (const candidateId of input.sourceCandidateIds ?? []) {
    statements.push({
      relationship: 'APPROVED_AS',
      cypher: `
        MERGE (c:KnowledgeCandidate {candidateId: $candidateId})
        MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
        MERGE (c)-[:APPROVED_AS]->(k)
      `.trim(),
      params: { candidateId, knowledgeObjectId: input.knowledgeObjectId },
    });
  }

  // (:Knowledge)-[:HAS_VERSION]->(:KnowledgeVersion) — version lineage.
  if (input.version !== undefined) {
    statements.push({
      relationship: 'HAS_VERSION',
      cypher: `
        MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
        MERGE (v:KnowledgeVersion {knowledgeObjectId: $knowledgeObjectId, version: $version})
        MERGE (k)-[:HAS_VERSION]->(v)
      `.trim(),
      params: { knowledgeObjectId: input.knowledgeObjectId, version: input.version },
    });
  }

  // (:Knowledge {new})-[:SUPERSEDES]->(:Knowledge {old}) — supersession links.
  for (const oldId of input.supersededKnowledgeObjectIds ?? []) {
    statements.push({
      relationship: 'SUPERSEDES',
      cypher: `
        MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
        MERGE (old:Knowledge {${KNOWLEDGE_KEY}: $oldKnowledgeObjectId})
        MERGE (k)-[:SUPERSEDES]->(old)
      `.trim(),
      params: { knowledgeObjectId: input.knowledgeObjectId, oldKnowledgeObjectId: oldId },
    });
  }

  // (:Knowledge {source})-[:HAS_LANGUAGE_VARIANT]->(:Knowledge {variant}) — bilingual link.
  if (input.languageVariantSourceId) {
    statements.push({
      relationship: 'HAS_LANGUAGE_VARIANT',
      cypher: `
        MERGE (src:Knowledge {${KNOWLEDGE_KEY}: $sourceKnowledgeObjectId})
        MERGE (variant:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
        MERGE (src)-[:HAS_LANGUAGE_VARIANT]->(variant)
      `.trim(),
      params: {
        sourceKnowledgeObjectId: input.languageVariantSourceId,
        knowledgeObjectId: input.knowledgeObjectId,
      },
    });
  }

  // (:Knowledge)-[:DERIVED_FROM]->(:LearningSignal) — learning-signal lineage.
  for (const signalId of input.sourceLearningSignalIds ?? []) {
    statements.push({
      relationship: 'DERIVED_FROM',
      cypher: `
        MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
        MERGE (s:LearningSignal {signalId: $signalId})
        MERGE (k)-[:DERIVED_FROM]->(s)
      `.trim(),
      params: { knowledgeObjectId: input.knowledgeObjectId, signalId },
    });
  }

  // (:Knowledge)-[:SUPPORTED_BY]->(:Outcome) — outcome lineage.
  for (const outcomeId of input.sourceOutcomeIds ?? []) {
    statements.push({
      relationship: 'SUPPORTED_BY',
      cypher: `
        MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
        MERGE (o:Outcome {outcomeId: $outcomeId})
        MERGE (k)-[:SUPPORTED_BY]->(o)
      `.trim(),
      params: { knowledgeObjectId: input.knowledgeObjectId, outcomeId },
    });
  }

  // (:Knowledge)-[:AVAILABLE_TO]->(:Agent) — only once retrieval-ready (spec §21.3 discipline).
  if (input.retrievalReady) {
    for (const agentKey of input.availableToAgents ?? []) {
      statements.push({
        relationship: 'AVAILABLE_TO',
        cypher: `
          MERGE (k:Knowledge {${KNOWLEDGE_KEY}: $knowledgeObjectId})
          MERGE (a:Agent {agentKey: $agentKey})
          MERGE (k)-[:AVAILABLE_TO]->(a)
        `.trim(),
        params: { knowledgeObjectId: input.knowledgeObjectId, agentKey },
      });
    }
  }

  return statements;
}

/** Adapt a canonical {@link KnowledgeEvolutionRecord} into mapper input (Lane D convenience). */
export function graphMapperInputFromRecord(
  record: KnowledgeEvolutionRecord,
  extra: {
    supersededKnowledgeObjectIds?: string[];
    languageVariantSourceId?: string;
    availableToAgents?: KnowledgeEvolutionAgentKey[];
    retrievalReady?: boolean;
  } = {},
): GraphMapperInput {
  const knowledgeObjectId = record.targetKnowledgeObjectId ?? record.evolutionId;
  return {
    evolutionId: record.evolutionId,
    knowledgeObjectId,
    version: record.versionCreated,
    domain: record.domain,
    language: record.language,
    tenantId: record.tenantId,
    teamKey: record.teamKey,
    teamName: record.teamName,
    baId: record.baId,
    evolutionAction: record.evolutionAction,
    sourceCandidateIds: record.sourceCandidateIds,
    sourceLearningSignalIds: record.sourceLearningSignalIds,
    sourceOutcomeIds: record.sourceOutcomeIds,
    supersededKnowledgeObjectIds:
      extra.supersededKnowledgeObjectIds ??
      (record.evolutionAction === 'supersede_existing_knowledge'
        ? record.sourceKnowledgeObjectIds
        : undefined),
    languageVariantSourceId:
      extra.languageVariantSourceId ??
      (record.evolutionAction === 'create_language_variant'
        ? record.sourceKnowledgeObjectIds[0]
        : undefined),
    availableToAgents: extra.availableToAgents,
    retrievalReady: extra.retrievalReady ?? record.retrievalStatus === 'ready',
  };
}
