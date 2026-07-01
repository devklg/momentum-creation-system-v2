/**
 * Phase 7 Neo4j constraints + indexes (governed doors — P7.12 §3).
 *
 * DRAFTED, NOT APPLIED. These define the uniqueness constraints and lookup
 * indexes for the new Phase 7 node labels. They are pure DATA here — nothing in
 * this module executes Cypher or touches Neo4j. Applying them (iterating and
 * running each `cypher` via the neo4j adapter) is the separately-approved
 * application step (write-freeze / Non-Destructive Rule; P10 §6 notes zero
 * constraints exist in-repo today).
 *
 * All statements are idempotent (`IF NOT EXISTS`), so applying twice is safe and
 * applying is reversible via the paired `DROP CONSTRAINT/INDEX … IF EXISTS`.
 * One constraint per label on its business key; specific-verb relationships only
 * (declared in the domain writers, not constrained here).
 */

export interface Neo4jSchemaStatement {
  /** Stable name — matches the `IF NOT EXISTS` constraint/index name. */
  readonly name: string;
  /** The label this applies to. */
  readonly label: string;
  /** The idempotent CREATE statement. */
  readonly cypher: string;
  /** The paired teardown (for reversibility). */
  readonly drop: string;
  /** Why this exists. */
  readonly purpose: string;
}

/** Uniqueness constraints — one per new Phase 7 label on its shared `id`/key. */
export const PHASE7_NEO4J_CONSTRAINTS: readonly Neo4jSchemaStatement[] = [
  {
    name: 'outcome_id',
    label: 'Outcome',
    cypher: 'CREATE CONSTRAINT outcome_id IF NOT EXISTS FOR (o:Outcome) REQUIRE o.id IS UNIQUE',
    drop: 'DROP CONSTRAINT outcome_id IF EXISTS',
    purpose: 'R1 outcome nodes keyed on the shared app-memory id (Mongo _id == Chroma id).',
  },
  {
    name: 'learning_candidate_id',
    label: 'LearningCandidate',
    cypher:
      'CREATE CONSTRAINT learning_candidate_id IF NOT EXISTS FOR (c:LearningCandidate) REQUIRE c.id IS UNIQUE',
    drop: 'DROP CONSTRAINT learning_candidate_id IF EXISTS',
    purpose: 'R2 review-only learning candidates keyed on the shared id.',
  },
  {
    name: 'knowledge_id',
    label: 'Knowledge',
    cypher:
      'CREATE CONSTRAINT knowledge_id IF NOT EXISTS FOR (k:Knowledge) REQUIRE k.id IS UNIQUE',
    drop: 'DROP CONSTRAINT knowledge_id IF EXISTS',
    purpose: 'R3 GraphRAG active-knowledge nodes keyed on the shared id.',
  },
  {
    name: 'team_magnificent_key',
    label: 'TeamMagnificent',
    cypher:
      "CREATE CONSTRAINT team_magnificent_key IF NOT EXISTS FOR (t:TeamMagnificent) REQUIRE t.teamKey IS UNIQUE",
    drop: 'DROP CONSTRAINT team_magnificent_key IF EXISTS',
    purpose: 'Single Team Magnificent scope node (:SCOPED_TO target for R2/R3).',
  },
];

/** Lookup indexes on non-key properties the domain reads by. */
export const PHASE7_NEO4J_INDEXES: readonly Neo4jSchemaStatement[] = [
  {
    name: 'outcome_ba',
    label: 'Outcome',
    cypher: 'CREATE INDEX outcome_ba IF NOT EXISTS FOR (o:Outcome) ON (o.baId)',
    drop: 'DROP INDEX outcome_ba IF EXISTS',
    purpose: 'BA-scoped outcome lookups.',
  },
  {
    name: 'candidate_status',
    label: 'LearningCandidate',
    cypher:
      'CREATE INDEX candidate_status IF NOT EXISTS FOR (c:LearningCandidate) ON (c.status)',
    drop: 'DROP INDEX candidate_status IF EXISTS',
    purpose: 'Review-queue lookups by candidate status.',
  },
  {
    name: 'knowledge_ready',
    label: 'Knowledge',
    cypher:
      'CREATE INDEX knowledge_ready IF NOT EXISTS FOR (k:Knowledge) ON (k.retrievalReady)',
    drop: 'DROP INDEX knowledge_ready IF EXISTS',
    purpose: 'Retrieval-ready gate filtering.',
  },
];

/** Everything to apply, in order (constraints before indexes). NOT executed here. */
export const PHASE7_NEO4J_SCHEMA: readonly Neo4jSchemaStatement[] = [
  ...PHASE7_NEO4J_CONSTRAINTS,
  ...PHASE7_NEO4J_INDEXES,
];

/**
 * Dependency note: the `(:Outcome)-[:CONFIRMED_BY]->(:BrandAmbassador)` edge
 * assumes the `BA` vs `BrandAmbassador` label reconciliation (P10 §5.1) is
 * settled before these are applied; and `AuditEntry.entryId` (R0) is part of the
 * P10 §6 canonical constraint set applied alongside this, not duplicated here.
 */
