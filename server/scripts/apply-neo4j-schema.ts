import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { closeDirectPersistence } from '../src/services/persistence/index.js';
import {
  buildNeo4jSchemaMigrationPlan,
  runNeo4jSchemaMigration,
  verifyNeo4jSchemaMigration,
  type Neo4jCatalog,
} from '../src/services/persistence/neo4j/schemaMigration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const defaultCatalogPath = path.join(
  repoRoot,
  'engineering/sprints/platform-audit-p1/neo4j-catalog.json',
);

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function readCatalog(): Neo4jCatalog {
  const catalogPath = argValue('--catalog') ?? defaultCatalogPath;
  return JSON.parse(readFileSync(catalogPath, 'utf8')) as Neo4jCatalog;
}

function printPlan(plan: ReturnType<typeof buildNeo4jSchemaMigrationPlan>): void {
  console.log(
    `[neo4j-schema] plan generatedAt=${plan.generatedAt ?? 'unknown'} total=${plan.summary.total} constraints=${plan.summary.constraints} indexes=${plan.summary.indexes}`,
  );
  for (const statement of plan.statements) {
    console.log(
      `[neo4j-schema] ${statement.order}. ${statement.kind} ${statement.name} (${statement.label}.${statement.property ?? 'n/a'})`,
    );
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const verify = process.argv.includes('--verify');
  const failOnError = process.argv.includes('--fail-on-error');
  const plan = buildNeo4jSchemaMigrationPlan(readCatalog());

  printPlan(plan);

  if (verify) {
    const result = await verifyNeo4jSchemaMigration(plan, persistenceCall);
    console.log(
      `[neo4j-schema] verify ok=${result.ok} missingConstraints=${result.missing.constraints.length} missingIndexes=${result.missing.indexes.length}`,
    );
    if (!result.ok) {
      if (result.missing.constraints.length) {
        console.log(`[neo4j-schema] missing constraints: ${result.missing.constraints.join(', ')}`);
      }
      if (result.missing.indexes.length) {
        console.log(`[neo4j-schema] missing indexes: ${result.missing.indexes.join(', ')}`);
      }
      process.exitCode = 1;
    }
    return;
  }

  const result = await runNeo4jSchemaMigration(plan, {
    mode: apply ? 'apply' : 'dry-run',
    runner: persistenceCall,
    failFast: failOnError,
  });
  console.log(
    `[neo4j-schema] mode=${result.mode} ok=${result.ok} planned=${result.summary.planned} applied=${result.summary.applied} failed=${result.summary.failed}`,
  );
  for (const row of result.results) {
    const suffix = row.error ? ` error=${row.error}` : '';
    console.log(`[neo4j-schema] ${row.status} ${row.kind} ${row.name}${suffix}`);
  }
  if (!result.ok) process.exitCode = 1;
}

try {
  await main();
} finally {
  await closeDirectPersistence();
}
