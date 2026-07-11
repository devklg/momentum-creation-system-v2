import type { persistenceCall } from '../dispatch.js';

export type Neo4jSchemaKind = 'unique_constraint' | 'index';
export type Neo4jSchemaStatementStatus = 'planned_core_not_applied' | 'declared_phase7_not_applied';

export interface Neo4jCatalogSchemaStatement {
  name: string;
  label: string;
  property: string | null;
  kind: Neo4jSchemaKind;
  status: Neo4jSchemaStatementStatus | string;
  cypher: string;
  drop: string;
  purpose: string;
}

export interface Neo4jCatalog {
  generatedAt?: string;
  constraints?: Neo4jCatalogSchemaStatement[];
}

export interface Neo4jSchemaPlanEntry extends Neo4jCatalogSchemaStatement {
  order: number;
}

export interface Neo4jSchemaMigrationPlan {
  generatedAt: string | null;
  statements: Neo4jSchemaPlanEntry[];
  summary: {
    constraints: number;
    indexes: number;
    total: number;
  };
}

export interface Neo4jSchemaStatementResult {
  name: string;
  kind: Neo4jSchemaKind;
  label: string;
  property: string | null;
  status: 'planned' | 'applied' | 'failed';
  error?: string;
}

export interface Neo4jSchemaMigrationResult {
  mode: 'dry-run' | 'apply';
  ok: boolean;
  summary: {
    planned: number;
    applied: number;
    failed: number;
  };
  results: Neo4jSchemaStatementResult[];
}

export interface Neo4jSchemaVerificationResult {
  ok: boolean;
  expected: {
    constraints: string[];
    indexes: string[];
  };
  observed: {
    constraints: string[];
    indexes: string[];
  };
  missing: {
    constraints: string[];
    indexes: string[];
  };
}

type PersistenceRunner = typeof persistenceCall;

const SAFE_CREATE_PATTERN = /^CREATE\s+(CONSTRAINT|INDEX)\s+[A-Za-z0-9_]+\s+IF\s+NOT\s+EXISTS\s+/i;

function statementOrder(kind: Neo4jSchemaKind): number {
  return kind === 'unique_constraint' ? 0 : 1;
}

function validateStatement(statement: Neo4jCatalogSchemaStatement): void {
  const cypher = statement.cypher.trim();
  if (!SAFE_CREATE_PATTERN.test(cypher)) {
    throw new Error(
      `Neo4j schema statement ${statement.name} is not an idempotent CREATE CONSTRAINT/INDEX statement`,
    );
  }
  if (/[;\r\n]/.test(cypher)) {
    throw new Error(`Neo4j schema statement ${statement.name} must be a single Cypher statement`);
  }
  if (!cypher.includes(statement.name)) {
    throw new Error(`Neo4j schema statement ${statement.name} does not include its cataloged name`);
  }
}

export function buildNeo4jSchemaMigrationPlan(catalog: Neo4jCatalog): Neo4jSchemaMigrationPlan {
  const statements = [...(catalog.constraints ?? [])]
    .map((statement) => {
      validateStatement(statement);
      return statement;
    })
    .sort((a, b) => statementOrder(a.kind) - statementOrder(b.kind) || a.name.localeCompare(b.name))
    .map((statement, index) => ({ ...statement, order: index + 1 }));

  const constraints = statements.filter((statement) => statement.kind === 'unique_constraint').length;
  const indexes = statements.filter((statement) => statement.kind === 'index').length;
  return {
    generatedAt: catalog.generatedAt ?? null,
    statements,
    summary: {
      constraints,
      indexes,
      total: statements.length,
    },
  };
}

export async function runNeo4jSchemaMigration(
  plan: Neo4jSchemaMigrationPlan,
  options: {
    mode: 'dry-run' | 'apply';
    runner: PersistenceRunner;
    failFast?: boolean;
  },
): Promise<Neo4jSchemaMigrationResult> {
  const results: Neo4jSchemaStatementResult[] = [];

  for (const statement of plan.statements) {
    if (options.mode === 'dry-run') {
      results.push({
        name: statement.name,
        kind: statement.kind,
        label: statement.label,
        property: statement.property,
        status: 'planned',
      });
      continue;
    }

    try {
      await options.runner('neo4j', 'cypher', { query: statement.cypher });
      results.push({
        name: statement.name,
        kind: statement.kind,
        label: statement.label,
        property: statement.property,
        status: 'applied',
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({
        name: statement.name,
        kind: statement.kind,
        label: statement.label,
        property: statement.property,
        status: 'failed',
        error,
      });
      if (options.failFast) break;
    }
  }

  const applied = results.filter((result) => result.status === 'applied').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const planned = results.filter((result) => result.status === 'planned').length;
  return {
    mode: options.mode,
    ok: failed === 0,
    summary: { planned, applied, failed },
    results,
  };
}

function namesFromRecord(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((name): name is string => typeof name === 'string').sort();
}

export async function verifyNeo4jSchemaMigration(
  plan: Neo4jSchemaMigrationPlan,
  runner: PersistenceRunner,
): Promise<Neo4jSchemaVerificationResult> {
  const [constraintsResult, indexesResult] = await Promise.all([
    runner<{ records?: Array<{ names?: unknown }> }>('neo4j', 'cypher', {
      query: 'SHOW CONSTRAINTS YIELD name RETURN collect(name) AS names',
    }),
    runner<{ records?: Array<{ names?: unknown }> }>('neo4j', 'cypher', {
      query: 'SHOW INDEXES YIELD name RETURN collect(name) AS names',
    }),
  ]);

  const expectedConstraints = plan.statements
    .filter((statement) => statement.kind === 'unique_constraint')
    .map((statement) => statement.name)
    .sort();
  const expectedIndexes = plan.statements
    .filter((statement) => statement.kind === 'index')
    .map((statement) => statement.name)
    .sort();
  const observedConstraints = namesFromRecord(constraintsResult.records?.[0]?.names);
  const observedIndexes = namesFromRecord(indexesResult.records?.[0]?.names);
  const missingConstraints = expectedConstraints.filter((name) => !observedConstraints.includes(name));
  const missingIndexes = expectedIndexes.filter((name) => !observedIndexes.includes(name));

  return {
    ok: missingConstraints.length === 0 && missingIndexes.length === 0,
    expected: {
      constraints: expectedConstraints,
      indexes: expectedIndexes,
    },
    observed: {
      constraints: observedConstraints,
      indexes: observedIndexes,
    },
    missing: {
      constraints: missingConstraints,
      indexes: missingIndexes,
    },
  };
}
