#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Node, Project, SyntaxKind } from 'ts-morph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const jsonPath = path.join(outDir, 'persistence-write-catalog.json');
const mdPath = path.join(outDir, 'PERSISTENCE_WRITE_CATALOG.md');
const check = process.argv.includes('--check');

const SOURCE_GLOBS = ['server/src/**/*.ts', 'server/scripts/**/*.ts'];
const EXCLUDE_PATTERNS = [
  /\/__tests__\//,
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\/dist\//,
  /\/node_modules\//,
];

const CLASSIFICATION_RULES = [
  {
    tier: 'graph_critical',
    subsystem: 'ba_identity',
    rationale: 'BA membership identity and sponsor graph must land atomically.',
    match: ({ file, functionName, collection }) =>
      file.endsWith('/ba.ts') ||
      file.endsWith('/adminBaCrud.ts') ||
      (file.endsWith('/seed-founders.ts') && functionName === 'seedBaRecord') ||
      collection.includes('team_magnificent_members'),
  },
  {
    tier: 'graph_critical',
    subsystem: 'sponsor_immutability',
    rationale: 'Access-code and sponsor override writes anchor immutable sponsor relationships.',
    match: ({ file, functionName, collection }) =>
      file.endsWith('/codeGen.ts') ||
      (file.endsWith('/seed-founders.ts') && functionName === 'seedAccessCode') ||
      functionName === 'applySponsorOverride' ||
      collection.includes('access_codes'),
  },
  {
    tier: 'graph_critical',
    subsystem: 'prospect_sponsorship',
    rationale: 'Prospect creation and bulk-lead prospect mirrors define sponsor ownership.',
    match: ({ file, functionName }) =>
      (file.endsWith('/invitations.ts') && functionName === 'createInvitation') ||
      (file.endsWith('/bulkLeads.ts') && functionName === 'createBulkLeadRecord'),
  },
  {
    tier: 'graph_critical',
    subsystem: 'ivory_roster',
    rationale: 'Ivory roster edges are agent-reasoned BA-private relationship data.',
    match: ({ file, functionName }) => file.endsWith('/ivory.ts') && functionName === 'createIvoryName',
  },
  {
    tier: 'graph_critical',
    subsystem: 'vm_ownership',
    rationale: 'VM lead ownership ties imported recipients to accountable operators.',
    match: ({ file }) => file.endsWith('/vmLeadOwners.ts'),
  },
  {
    tier: 'knowledge',
    subsystem: 'approved_knowledge',
    rationale: 'Approved knowledge and candidate knowledge must project durably to graph/search.',
    match: ({ file }) =>
      file.endsWith('/approvedKnowledgeStore.ts') ||
      file.endsWith('/knowledgeCorrectionStore.ts') ||
      file.endsWith('/learningCandidates.ts') ||
      file.endsWith('/graphrag.ts'),
  },
  {
    tier: 'knowledge',
    subsystem: 'agent_context',
    rationale: 'Agent, Steve, Michael, questionnaire, and training artifacts feed coaching context.',
    match: ({ file }) =>
      file.endsWith('/agents/orchestrator.ts') ||
      file.endsWith('/recruitingCycle.ts') ||
      file.endsWith('/steve-success-interview.ts') ||
      file.endsWith('/steveVersioning.ts') ||
      file.endsWith('/questionnaire.ts') ||
      file.endsWith('/training.ts'),
  },
  {
    tier: 'knowledge',
    subsystem: 'crm_behavioral_trail',
    rationale: 'CRM notes, follow-ups, dispositions, activities, and prospect CRM records are agent-learning trail.',
    match: ({ file }) =>
      file.endsWith('/crm.ts') ||
      file.endsWith('/prospectCrm.ts') ||
      file.endsWith('/generator.ts') ||
      (file.endsWith('/invitations.ts') && !file.includes('createInvitation')),
  },
  {
    tier: 'knowledge',
    subsystem: 'content_governance',
    rationale: 'Master content, content videos, and tenant templates shape governed retrieval and generated copy.',
    match: ({ file, functionName }) =>
      file.endsWith('/contentVideos.ts') ||
      functionName === 'saveTenantTemplate',
  },
  {
    tier: 'operational',
    subsystem: 'audit_controls',
    rationale: 'Audit entries must persist, while graph/search projections can lag through the outbox.',
    match: ({ file, functionName }) =>
      file.endsWith('/auditLog.ts') ||
      functionName === 'vmAudit',
  },
  {
    tier: 'operational',
    subsystem: 'delivery_and_reservations',
    rationale: 'Callbacks, webinars, orientation, broadcasts, VM queue, and delivery events are operational flows.',
    match: ({ file }) =>
      file.endsWith('/callbackRequest.ts') ||
      file.endsWith('/webinarReservation.ts') ||
      file.endsWith('/seed-webinar-events.ts') ||
      file.endsWith('/orientationSession.ts') ||
      file.endsWith('/broadcast.ts') ||
      file.endsWith('/vmProviderQueue.ts') ||
      file.endsWith('/vmCampaigns.ts') ||
      file.endsWith('/threeWayCalls.ts'),
  },
  {
    tier: 'operational',
    subsystem: 'prospect_access',
    rationale: 'Prospect accounts and magic links are credentials/session operations; Mongo commit is the success boundary.',
    match: ({ file }) => file.endsWith('/prospectAccount.ts') || file.endsWith('/prospectMagicLink.ts'),
  },
  {
    tier: 'operational',
    subsystem: 'governance_records',
    rationale: 'Commitments, outcomes, tenant settings, and admin notes are operational/governance records.',
    match: ({ file, functionName }) =>
      file.endsWith('/commitments.ts') ||
      file.endsWith('/outcomes.ts') ||
      functionName === 'saveTenantSettings' ||
      functionName === 'appendProspectNote',
  },
];

function normalizePath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function stringProperty(obj, name) {
  const prop = obj?.getProperty(name);
  if (!prop || !Node.isPropertyAssignment(prop)) return '';
  return prop.getInitializer()?.getText() ?? '';
}

function enclosingFunctionName(call) {
  const fn = call.getFirstAncestor(
    (node) =>
      Node.isFunctionDeclaration(node) ||
      Node.isFunctionExpression(node) ||
      Node.isArrowFunction(node) ||
      Node.isMethodDeclaration(node),
  );
  const symbolName = fn?.getSymbol()?.getName();
  if (symbolName && symbolName !== '__function') return symbolName;
  const variable = fn?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return variable?.getName() ?? '<anonymous>';
}

function classify(site) {
  const matches = CLASSIFICATION_RULES.filter((rule) => rule.match(site));
  if (matches.length === 0) return null;
  return matches[0];
}

function discoverCallSites() {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(SOURCE_GLOBS);

  const sites = [];
  for (const sourceFile of project.getSourceFiles()) {
    const file = normalizePath(sourceFile.getFilePath());
    if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(`/${file}`))) continue;

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== 'tripleStackWrite') return;

      const arg = node.getArguments()[0];
      const obj = Node.isObjectLiteralExpression(arg) ? arg : undefined;
      const functionName = enclosingFunctionName(node);
      const site = {
        file,
        line: node.getStartLineNumber(),
        functionName,
        idExpression: stringProperty(obj, 'id'),
        mongoCollectionExpression: stringProperty(obj, 'mongoCollection'),
        hasNeo4j: Boolean(obj?.getProperty('neo4j')),
        hasChroma: Boolean(obj?.getProperty('chroma')),
      };
      const rule = classify({
        file,
        functionName,
        collection: site.mongoCollectionExpression,
      });
      if (!rule) {
        site.tier = 'UNCLASSIFIED';
        site.subsystem = 'UNCLASSIFIED';
        site.rationale = 'No classification rule matched this call site.';
      } else {
        site.tier = rule.tier;
        site.subsystem = rule.subsystem;
        site.rationale = rule.rationale;
      }
      sites.push(site);
    });
  }

  return sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
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

function buildCatalog(generatedAtOverride = null) {
  const callSites = discoverCallSites();
  const generatedAt = generatedAtOverride ?? new Date().toISOString();
  const countsByTier = callSites.reduce((acc, site) => {
    acc[site.tier] = (acc[site.tier] ?? 0) + 1;
    return acc;
  }, {});
  const unclassified = callSites.filter((site) => site.tier === 'UNCLASSIFIED');
  if (unclassified.length > 0) {
    const list = unclassified.map((site) => `${site.file}:${site.line}`).join(', ');
    throw new Error(`Unclassified tripleStackWrite call sites: ${list}`);
  }
  return {
    generatedAt,
    sourceGlobs: SOURCE_GLOBS,
    productionCallSiteCount: callSites.length,
    countsByTier,
    callSites,
  };
}

function renderMarkdown(catalog) {
  const rows = catalog.callSites
    .map(
      (site, idx) =>
        `| ${idx + 1} | ${site.tier} | ${site.subsystem} | \`${site.file}:${site.line}\` | ` +
        `\`${site.functionName}\` | \`${site.mongoCollectionExpression || '(dynamic)'}\` | ` +
        `${site.hasNeo4j ? 'yes' : 'no'} | ${site.hasChroma ? 'yes' : 'no'} | ${site.rationale} |`,
    )
    .join('\n');

  return `# Persistence Write Catalog

> Generated by \`node server/scripts/generate-persistence-write-catalog.mjs\`.
> Use \`--check\` in gates to fail when the checked-in catalog is stale or a new
> production \`tripleStackWrite\` call cannot be classified.

## Summary

- Generated: ${catalog.generatedAt}
- Production \`tripleStackWrite\` call sites: ${catalog.productionCallSiteCount}
- Graph-critical: ${catalog.countsByTier.graph_critical ?? 0}
- Knowledge: ${catalog.countsByTier.knowledge ?? 0}
- Operational: ${catalog.countsByTier.operational ?? 0}
- Excludes tests/spec files. Includes \`server/src/**/*.ts\` and \`server/scripts/**/*.ts\`.

## Tier Definitions

- \`graph_critical\`: membership, sponsor, prospect ownership, Ivory roster, and VM ownership facts that must not half-write.
- \`knowledge\`: records agents or retrieval workflows learn from; Mongo commits first, projections must land durably through the outbox.
- \`operational\`: workflow, audit, delivery, session, and governance records where Mongo commit is the success boundary and projections may lag.

## Call Sites

| # | Tier | Subsystem | Location | Function | Mongo collection expression | Neo4j | Chroma | Rationale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |${rows ? `\n${rows}` : ''}
`;
}

function writeCatalog(catalog) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(catalog));
}

function assertCurrent(catalog) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('Persistence write catalog files are missing. Run the generator.');
  }
  const expectedJson = `${JSON.stringify(catalog, null, 2)}\n`;
  const expectedMd = renderMarkdown(catalog);
  const actualJson = readFileSync(jsonPath, 'utf8');
  const actualMd = readFileSync(mdPath, 'utf8');
  if (actualJson !== expectedJson || actualMd !== expectedMd) {
    throw new Error('Persistence write catalog is stale. Run node server/scripts/generate-persistence-write-catalog.mjs');
  }
}

if (check) {
  const catalog = buildCatalog(readExistingGeneratedAt());
  assertCurrent(catalog);
  console.log(`Persistence write catalog is current (${catalog.productionCallSiteCount} call sites).`);
} else {
  const catalog = buildCatalog();
  writeCatalog(catalog);
  console.log(`Wrote persistence write catalog (${catalog.productionCallSiteCount} call sites).`);
}
