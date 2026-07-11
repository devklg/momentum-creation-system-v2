#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const schemaPath = path.join(outDir, 'schema-catalog.json');
const jsonPath = path.join(outDir, 'neo4j-catalog.json');
const mdPath = path.join(outDir, 'NEO4J_CATALOG.md');
const phase7Path = path.join(repoRoot, 'server/src/services/persistence/neo4j/phase7Constraints.ts');
const check = process.argv.includes('--check');

const CORE_CONSTRAINTS = [
  core('team_member_tmagId', 'TeamMagnificentMember', 'tmagId', 'Member identity and sponsor graph anchor.'),
  core('prospect_prospectId', 'TmagProspect', 'prospectId', 'Prospect invitation and holding-tank anchor.'),
  core('invite_token_token', 'TmagInviteToken', 'token', 'Token lifecycle graph anchor.'),
  core('pool_id', 'TmagPool', 'id', 'Shared holding-tank pool node.'),
  core('access_code_code', 'TmagAccessCode', 'code', 'Access-code ownership graph anchor.'),
  core('steve_discovery_id', 'TmagSteveDiscovery', 'discoveryId', 'Steve Success Profile artifact.'),
  core('content_video_id', 'TmagContentVideo', 'contentVideoId', 'Admin content video artifact.'),
  core('crm_record_id', 'TmagProspectCrmRecord', 'crmRecordId', 'CRM record ownership graph anchor.'),
  core('vm_lead_owner_id', 'TmagVmLeadOwner', 'leadOwnerId', 'VM lead-owner graph anchor.'),
  core('vm_bulk_lead_id', 'TmagVmBulkLead', 'leadId', 'VM imported lead graph anchor.'),
  core('vm_campaign_id', 'TmagVmCampaign', 'vmCampaignId', 'VM campaign graph anchor.'),
];

function core(name, label, property, purpose) {
  return {
    name,
    label,
    property,
    kind: 'unique_constraint',
    status: 'planned_core_not_applied',
    cypher: `CREATE CONSTRAINT ${name} IF NOT EXISTS FOR (n:${label}) REQUIRE n.${property} IS UNIQUE`,
    drop: `DROP CONSTRAINT ${name} IF EXISTS`,
    purpose,
  };
}

function readExistingGeneratedAt() {
  if (!existsSync(jsonPath)) return null;
  try {
    const existing = JSON.parse(readFileSync(jsonPath, 'utf8'));
    return typeof existing.generatedAt === 'string' ? existing.generatedAt : null;
  } catch {
    return null;
  }
}

function parsePhase7Statements() {
  if (!existsSync(phase7Path)) return [];
  const text = readFileSync(phase7Path, 'utf8');
  const objects = [...text.matchAll(/\{\s*name:\s*'([^']+)',\s*label:\s*'([^']+)',\s*cypher:\s*([\s\S]*?)\s*drop:\s*'([^']+)',\s*purpose:\s*'([^']+)'/g)];
  return objects.map((match) => {
    const rawCypher = match[3] ?? '';
    const stringParts = [...rawCypher.matchAll(/(['"`])([\s\S]*?)\1/g)].map((m) => m[2]);
    const cypher = stringParts.join('');
    if (!cypher) {
      throw new Error(`Unable to parse Neo4j schema cypher for ${match[1]}`);
    }
    return {
      name: match[1],
      label: match[2],
      property: propertyFromCypher(cypher),
      kind: cypher.startsWith('CREATE INDEX') ? 'index' : 'unique_constraint',
      status: 'declared_phase7_not_applied',
      cypher,
      drop: match[4],
      purpose: match[5],
    };
  });
}

function propertyFromCypher(cypher) {
  const single = cypher.match(/REQUIRE\s+\w+\.([A-Za-z0-9_]+)\s+IS\s+UNIQUE/);
  if (single) return single[1];
  const index = cypher.match(/ON\s+\(\w+\.([A-Za-z0-9_]+)\)/);
  if (index) return index[1];
  return null;
}

function buildCatalog(generatedAtOverride = null) {
  if (!existsSync(schemaPath)) {
    throw new Error('Schema catalog is missing. Run pnpm catalog:schema first.');
  }
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const labels = (schema.neo4j?.labels ?? []).map((row) => ({
    label: row.label,
    sourceCount: row.sources?.length ?? 0,
    sources: row.sources ?? [],
  }));
  const relationships = (schema.neo4j?.relationships ?? []).map((row) => ({
    relationship: row.relationship,
    sourceCount: row.sources?.length ?? 0,
    sources: row.sources ?? [],
  }));
  const constraints = [...CORE_CONSTRAINTS, ...parsePhase7Statements()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const labelsWithoutConstraint = labels
    .filter((label) => !constraints.some((constraint) => constraint.label === label.label))
    .map((label) => label.label)
    .sort();
  const byStatus = constraints.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: generatedAtOverride ?? new Date().toISOString(),
    sources: [
      'engineering/sprints/platform-audit-p1/schema-catalog.json',
      'server/src/services/persistence/neo4j/phase7Constraints.ts',
      'server/src/domain/* Cypher writers',
    ],
    summary: {
      labels: labels.length,
      relationships: relationships.length,
      constraints: constraints.length,
      labelsWithoutConstraint: labelsWithoutConstraint.length,
    },
    byStatus,
    labels,
    relationships,
    constraints,
    labelsWithoutConstraint,
  };
}

function renderMarkdown(catalog) {
  const labelRows = catalog.labels.map((row) => `| \`${row.label}\` | ${row.sourceCount} |`);
  const relRows = catalog.relationships.map((row) => `| \`${row.relationship}\` | ${row.sourceCount} |`);
  const constraintRows = catalog.constraints.map(
    (row) =>
      `| \`${row.name}\` | ${row.kind} | \`${row.label}\` | \`${row.property ?? '(compound/unknown)'}\` | ${row.status} | ${row.purpose} |`,
  );
  const statusRows = Object.entries(catalog.byStatus)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `| ${status} | ${count} |`);
  const unconstrained = catalog.labelsWithoutConstraint.map((label) => `- \`${label}\``).join('\n') || '- none';

  return `# Neo4j Catalog

> Generated by \`node server/scripts/generate-neo4j-catalog.mjs\`.

## Summary

- Generated: ${catalog.generatedAt}
- Labels: ${catalog.summary.labels}
- Relationships: ${catalog.summary.relationships}
- Constraints/indexes cataloged: ${catalog.summary.constraints}
- Labels without a cataloged constraint/index: ${catalog.summary.labelsWithoutConstraint}

## Constraints By Status

| Status | Count |
| --- | ---: |
${statusRows.join('\n')}

## Labels

| Label | Source count |
| --- | ---: |
${labelRows.join('\n')}

## Relationships

| Relationship | Source count |
| --- | ---: |
${relRows.join('\n')}

## Constraints And Indexes

| Name | Kind | Label | Property | Status | Purpose |
| --- | --- | --- | --- | --- | --- |
${constraintRows.join('\n')}

## Labels Without Cataloged Constraint/Index

${unconstrained}
`;
}

function writeCatalog(catalog) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(catalog));
}

function assertCurrent(catalog) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('Neo4j catalog files are missing. Run the generator.');
  }
  const expectedJson = `${JSON.stringify(catalog, null, 2)}\n`;
  const expectedMd = renderMarkdown(catalog);
  if (readFileSync(jsonPath, 'utf8') !== expectedJson || readFileSync(mdPath, 'utf8') !== expectedMd) {
    throw new Error('Neo4j catalog is stale. Run node server/scripts/generate-neo4j-catalog.mjs');
  }
}

if (check) {
  const catalog = buildCatalog(readExistingGeneratedAt());
  assertCurrent(catalog);
  console.log(
    `Neo4j catalog is current (${catalog.summary.labels} labels, ${catalog.summary.relationships} relationships).`,
  );
} else {
  const catalog = buildCatalog();
  writeCatalog(catalog);
  console.log(
    `Wrote Neo4j catalog (${catalog.summary.labels} labels, ${catalog.summary.relationships} relationships).`,
  );
}
