#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Node, Project } from 'ts-morph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const schemaPath = path.join(outDir, 'schema-catalog.json');
const jsonPath = path.join(outDir, 'chroma-collection-catalog.json');
const mdPath = path.join(outDir, 'CHROMA_COLLECTION_CATALOG.md');
const registryPath = 'server/src/services/chromaCollections.ts';
const rev3Path = 'server/scripts/provisioning/rev3-registry.mjs';
const check = process.argv.includes('--check');

const SOURCE_GLOBS = ['server/src/**/*.ts', 'server/scripts/**/*.ts', 'packages/shared/src/**/*.ts'];
const EXCLUDE_PATTERNS = [/\/__tests__\//, /\.test\.ts$/, /\.spec\.ts$/, /\/dist\//, /\/node_modules\//];

function normalizePath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function shouldSkip(file) {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(`/${file}`));
}

function projectSources() {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(SOURCE_GLOBS);
  return project.getSourceFiles().filter((sf) => !shouldSkip(normalizePath(sf.getFilePath())));
}

function unwrapExpression(node) {
  if (!node) return null;
  if (Node.isAsExpression(node) || Node.isSatisfiesExpression?.(node)) return unwrapExpression(node.getExpression());
  return node;
}

function stringLiteralValue(node) {
  if (!node) return null;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  return null;
}

function sourceConstStrings(sourceFile, inherited = new Map()) {
  const values = new Map();
  for (const [key, value] of inherited.entries()) values.set(key, value);
  sourceFile.forEachDescendant((node) => {
    if (!Node.isVariableDeclaration(node)) return;
    const init = unwrapExpression(node.getInitializer());
    const value = stringLiteralValue(init);
    if (value) {
      values.set(node.getName(), value);
      return;
    }
    if (Node.isIdentifier(init) && values.has(init.getText())) {
      values.set(node.getName(), values.get(init.getText()));
    }
  });
  return values;
}

function globalConstStrings(sourceFiles) {
  const values = new Map();
  for (const sourceFile of sourceFiles) {
    sourceFile.forEachDescendant((node) => {
      if (!Node.isVariableDeclaration(node)) return;
      const init = unwrapExpression(node.getInitializer());
      const value = stringLiteralValue(init);
      if (value) values.set(node.getName(), value);
    });
  }
  for (const sourceFile of sourceFiles) {
    sourceFile.forEachDescendant((node) => {
      if (!Node.isVariableDeclaration(node)) return;
      const init = unwrapExpression(node.getInitializer());
      if (Node.isIdentifier(init) && values.has(init.getText())) {
        values.set(node.getName(), values.get(init.getText()));
      }
    });
  }
  return values;
}

function resolveStringExpression(node, consts) {
  const unwrapped = unwrapExpression(node);
  const literal = stringLiteralValue(unwrapped);
  if (literal) return { value: literal, expression: unwrapped.getText() };
  if (Node.isIdentifier(unwrapped) && consts.has(unwrapped.getText())) {
    return { value: consts.get(unwrapped.getText()), expression: unwrapped.getText() };
  }
  return { value: null, expression: unwrapped?.getText() ?? '' };
}

function propertyInitializer(obj, name) {
  const prop = obj?.getProperty(name);
  if (!prop || !Node.isPropertyAssignment(prop)) return null;
  return prop.getInitializer() ?? null;
}

function collectObjectKeys(node) {
  const unwrapped = unwrapExpression(node);
  if (!Node.isObjectLiteralExpression(unwrapped)) return [];
  return unwrapped.getProperties().flatMap((prop) => {
    if (Node.isSpreadAssignment(prop)) return [];
    if (Node.isPropertyAssignment(prop)) return [prop.getName().replace(/^['"]|['"]$/g, '')];
    if (Node.isShorthandPropertyAssignment(prop)) return [prop.getName()];
    return [];
  });
}

function collectArrayObjectKeys(node) {
  const unwrapped = unwrapExpression(node);
  if (Node.isObjectLiteralExpression(unwrapped)) return collectObjectKeys(unwrapped);
  if (!Node.isArrayLiteralExpression(unwrapped)) return [];
  return unwrapped.getElements().flatMap((element) => collectObjectKeys(element));
}

function discoverRegistryCollections(sourceFiles) {
  const registry = sourceFiles.find((sf) => normalizePath(sf.getFilePath()) === registryPath);
  const rows = [];
  if (!registry) return rows;
  registry.forEachDescendant((node) => {
    if (!Node.isVariableDeclaration(node) || node.getName() !== 'CHROMA_COLLECTIONS') return;
    const init = unwrapExpression(node.getInitializer());
    if (!Node.isArrayLiteralExpression(init)) return;
    for (const element of init.getElements()) {
      const value = stringLiteralValue(element);
      if (value) rows.push({ collection: value, source: registryPath });
    }
  });
  return rows.sort((a, b) => a.collection.localeCompare(b.collection));
}

function readRev3Metadata() {
  const text = readFileSync(path.join(repoRoot, rev3Path), 'utf8');
  const block = text.match(/export const CHROMA_METADATA = \{([\s\S]*?)\};/);
  if (!block) return {};
  const metadata = {};
  for (const match of block[1].matchAll(/([A-Za-z0-9_]+):\s*([^,\n]+)/g)) {
    const raw = match[2].trim();
    metadata[match[1]] = raw.replace(/^['"]|['"]$/g, '');
  }
  return metadata;
}

function ensureUsage(usages, key) {
  if (!usages.has(key)) {
    usages.set(key, {
      collection: key,
      resolved: true,
      sources: [],
      actions: new Set(),
      metadataKeys: new Set(),
      filterKeys: new Set(),
    });
  }
  return usages.get(key);
}

function addUsage(usages, collection, source, action, metadataKeys = [], filterKeys = []) {
  const row = ensureUsage(usages, collection.value ?? collection.expression);
  row.resolved = row.resolved && Boolean(collection.value);
  row.sources.push(source);
  row.actions.add(action);
  for (const key of metadataKeys) row.metadataKeys.add(key);
  for (const key of filterKeys) row.filterKeys.add(key);
}

function discoverUsages(sourceFiles) {
  const usages = new Map();
  const inherited = globalConstStrings(sourceFiles);
  for (const sourceFile of sourceFiles) {
    const file = normalizePath(sourceFile.getFilePath());
    if (!file.startsWith('server/')) continue;
    const consts = sourceConstStrings(sourceFile, inherited);
    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const exprText = node.getExpression().getText();
      const args = node.getArguments();

      if (exprText === 'persistenceCall' && stringLiteralValue(args[0]) === 'chromadb') {
        const action = stringLiteralValue(args[1]) ?? 'unknown';
        const obj = Node.isObjectLiteralExpression(args[2]) ? args[2] : null;
        const collectionNode = propertyInitializer(obj, 'collection') ?? propertyInitializer(obj, 'name');
        if (!collectionNode) return;
        const collection = resolveStringExpression(collectionNode, consts);
        const metadataKeys = collectObjectKeys(propertyInitializer(obj, 'metadata'));
        const metadatasKeys = collectArrayObjectKeys(propertyInitializer(obj, 'metadatas'));
        const filterKeys = [
          ...collectObjectKeys(propertyInitializer(obj, 'filter')),
          ...collectObjectKeys(propertyInitializer(obj, 'where')),
        ];
        addUsage(
          usages,
          collection,
          { file, line: node.getStartLineNumber(), action: `persistenceCall.chromadb.${action}` },
          action,
          [...metadataKeys, ...metadatasKeys],
          filterKeys,
        );
        return;
      }

      if (['writeGraphCritical', 'writeKnowledge', 'writeOperational', 'tieredWrite', 'tripleStackWrite'].includes(exprText)) {
        const obj = Node.isObjectLiteralExpression(args[0]) ? args[0] : null;
        const chromaObj = unwrapExpression(propertyInitializer(obj, 'chroma'));
        if (!Node.isObjectLiteralExpression(chromaObj)) return;
        const collectionNode = propertyInitializer(chromaObj, 'collection');
        if (!collectionNode) return;
        const collection = resolveStringExpression(collectionNode, consts);
        const metadataKeys = collectObjectKeys(propertyInitializer(chromaObj, 'metadata'));
        addUsage(
          usages,
          collection,
          { file, line: node.getStartLineNumber(), action: exprText },
          exprText,
          metadataKeys,
        );
      }
    });
  }
  return usages;
}

function inferLanguage(collection, metadataKeys) {
  if (collection.endsWith('_en')) return 'en';
  if (collection.endsWith('_es')) return 'es';
  if (metadataKeys.includes('language')) return 'metadata.language';
  return 'not_language_scoped';
}

function inferDomain(collection) {
  if (collection.includes('_knowledge_') || collection.includes('knowledge')) return 'knowledge';
  if (collection.includes('learning_candidate')) return 'knowledge_review';
  if (collection.includes('agent_') || collection.includes('ivory')) return 'agents';
  if (collection.includes('vm_')) return 'vm_rvm';
  if (collection.includes('prospect_crm') || collection.includes('timeline')) return 'crm';
  if (collection.includes('prospect_htank')) return 'holding_tank';
  if (collection.includes('prospect_')) return 'prospect_funnel';
  if (collection.includes('member') || collection.includes('access_code') || collection.includes('commitment')) return 'identity_access';
  if (collection.includes('orientation') || collection.includes('fast_start') || collection.includes('steve_success')) return 'onboarding_training';
  if (collection.includes('webinar') || collection.includes('three_way') || collection.includes('sponsor_availability')) return 'events';
  if (collection.includes('content') || collection.includes('workbook')) return 'content_resources';
  if (collection.includes('broadcast')) return 'broadcast_delivery';
  if (collection.includes('audit')) return 'audit_governance';
  if (collection.includes('tenant')) return 'tenant_admin';
  if (collection.includes('health')) return 'operations';
  if (collection.includes('outcome')) return 'outcomes';
  return 'general';
}

function inferPurpose(collection) {
  if (/mcs_(success|training|relationship|performance|organizational)_knowledge_(en|es)$/.test(collection)) {
    return 'Active approved GraphRAG knowledge for a single domain/language.';
  }
  if (collection === 'mcs_knowledge_chunks') return 'Approved knowledge chunk retrieval index.';
  if (collection === 'mcs_knowledge_sources') return 'Approved knowledge source retrieval and source lookup.';
  if (collection === 'mcs_learning_candidates_review') return 'Review-only learning candidates; never active retrieval knowledge.';
  if (collection.includes('agent_')) return 'Agent event/template semantic memory.';
  if (collection.includes('vm_')) return 'VM/RVM ownership, campaign, lead, and delivery semantic records.';
  if (collection.includes('prospect_crm') || collection.includes('timeline')) return 'Prospect CRM and lifecycle semantic records.';
  if (collection.includes('prospect_htank')) return 'Holding-tank pool event/account semantic records.';
  if (collection.includes('prospect_')) return 'Prospect funnel semantic record.';
  if (collection.includes('member')) return 'Team Magnificent member identity semantic record.';
  if (collection.includes('steve') || collection.includes('fast_start')) return 'Onboarding/training semantic record.';
  if (collection.includes('content')) return 'Governed content/resource semantic record.';
  if (collection.includes('health')) return 'Operational health/readback heartbeat record.';
  return 'Registered app Chroma collection.';
}

function inferredRequiredMetadata(collection, metadataKeys) {
  const required = new Set();
  if (collection.includes('knowledge')) {
    required.add('domain');
    required.add('language');
  }
  if (/mcs_(success|training|relationship|performance|organizational)_knowledge_(en|es)$/.test(collection)) {
    required.add('tenantId');
    required.add('retrievalReady');
    required.add('knowledgeObjectId');
  }
  if (collection === 'mcs_knowledge_chunks') {
    required.add('sourceId');
    required.add('chunkId');
    required.add('status');
    required.add('retrievalEligible');
  }
  if (metadataKeys.some((key) => key.includes('TmagId') || key === 'tmagId')) required.add('tmagId');
  if (metadataKeys.some((key) => key === 'source' || key.endsWith('Id'))) {
    for (const key of metadataKeys.filter((candidate) => candidate.endsWith('Id') || candidate === 'source')) {
      required.add(key);
    }
  }
  return [...required].sort();
}

function buildCatalog(generatedAtOverride = null) {
  const sourceFiles = projectSources();
  const registry = discoverRegistryCollections(sourceFiles);
  const usageMap = discoverUsages(sourceFiles);
  const schemaCatalog = existsSync(schemaPath) ? JSON.parse(readFileSync(schemaPath, 'utf8')) : null;
  const schemaCollections = new Set((schemaCatalog?.chromaCollections ?? []).map((row) => row.collection));
  const rev3Metadata = readRev3Metadata();

  const collections = registry.map((row) => {
    const usage = usageMap.get(row.collection);
    const metadataKeys = [...(usage?.metadataKeys ?? new Set())].sort();
    const filterKeys = [...(usage?.filterKeys ?? new Set())].sort();
    const language = inferLanguage(row.collection, metadataKeys);
    return {
      collection: row.collection,
      registered: true,
      inSchemaCatalog: schemaCollections.has(row.collection),
      domain: inferDomain(row.collection),
      language,
      purpose: inferPurpose(row.collection),
      source: row.source,
      actions: [...(usage?.actions ?? new Set())].sort(),
      sourceCount: usage?.sources.length ?? 0,
      sources: usage?.sources ?? [],
      metadataContract: {
        collectionMetadata: rev3Metadata,
        observedMetadataKeys: metadataKeys,
        observedFilterKeys: filterKeys,
        inferredRequiredKeys: inferredRequiredMetadata(row.collection, metadataKeys),
        embeddingDimension: Number(rev3Metadata.expected_dim ?? 384),
        embeddingModel: String(rev3Metadata.embedding_model ?? 'all-MiniLM-L6-v2'),
      },
    };
  });
  const registeredNames = new Set(registry.map((row) => row.collection));
  const observedUnregisteredTargets = [...usageMap.values()]
    .filter((usage) => !registeredNames.has(usage.collection))
    .map((usage) => ({
      target: usage.collection,
      resolved: usage.resolved,
      actions: [...usage.actions].sort(),
      sourceCount: usage.sources.length,
      sources: usage.sources,
      observedMetadataKeys: [...usage.metadataKeys].sort(),
      observedFilterKeys: [...usage.filterKeys].sort(),
    }))
    .sort((a, b) => a.target.localeCompare(b.target));

  return {
    generatedAt: generatedAtOverride ?? new Date().toISOString(),
    sources: [registryPath, rev3Path, 'server/src/**/*.ts chromadb usage', 'engineering/sprints/platform-audit-p1/schema-catalog.json'],
    summary: {
      collections: collections.length,
      schemaCatalogCollections: schemaCollections.size,
      withObservedWrites: collections.filter((row) => row.sourceCount > 0).length,
      languageScopedCollections: collections.filter((row) => row.language === 'en' || row.language === 'es').length,
      metadataContractRows: collections.length,
      observedUnregisteredTargets: observedUnregisteredTargets.length,
    },
    byDomain: collections.reduce((acc, row) => {
      acc[row.domain] = (acc[row.domain] ?? 0) + 1;
      return acc;
    }, {}),
    collections,
    observedUnregisteredTargets,
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

function renderMarkdown(catalog) {
  const domainRows = Object.entries(catalog.byDomain)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, count]) => `| ${domain} | ${count} |`);
  const rows = catalog.collections.map((row) => {
    const actions = row.actions.length ? row.actions.map((action) => `\`${action}\``).join('<br>') : 'not observed';
    const metadata = row.metadataContract.observedMetadataKeys.length
      ? row.metadataContract.observedMetadataKeys.map((key) => `\`${key}\``).join(', ')
      : 'none observed';
    const filters = row.metadataContract.observedFilterKeys.length
      ? row.metadataContract.observedFilterKeys.map((key) => `\`${key}\``).join(', ')
      : 'none observed';
    const required = row.metadataContract.inferredRequiredKeys.length
      ? row.metadataContract.inferredRequiredKeys.map((key) => `\`${key}\``).join(', ')
      : 'none inferred';
    return `| \`${row.collection}\` | ${row.domain} | ${row.language} | ${row.purpose} | ${actions} | ${metadata} | ${filters} | ${required} |`;
  });
  const unregisteredRows = catalog.observedUnregisteredTargets.map((row) => {
    const actions = row.actions.length ? row.actions.map((action) => `\`${action}\``).join('<br>') : 'unknown';
    const sources = row.sources.map((source) => `\`${source.file}:${source.line}\``).join('<br>');
    return `| \`${row.target}\` | ${row.resolved ? 'literal/constant' : 'expression'} | ${actions} | ${row.sourceCount} | ${sources} |`;
  });

  return `# Chroma Collection Catalog

> Generated by \`node server/scripts/generate-chroma-catalog.mjs\`.
> Use \`--check\` to fail when this catalog is stale.

## Summary

- Generated: ${catalog.generatedAt}
- Registered collections: ${catalog.summary.collections}
- Schema-catalog collections: ${catalog.summary.schemaCatalogCollections}
- Collections with observed write/query usage: ${catalog.summary.withObservedWrites}
- Language-scoped collections: ${catalog.summary.languageScopedCollections}
- Metadata contract rows: ${catalog.summary.metadataContractRows}
- Observed unregistered/dynamic targets: ${catalog.summary.observedUnregisteredTargets}
- Embedding model: ${catalog.collections[0]?.metadataContract.embeddingModel ?? 'all-MiniLM-L6-v2'}
- Embedding dimension: ${catalog.collections[0]?.metadataContract.embeddingDimension ?? 384}

## Collections By Domain

| Domain | Count |
| --- | ---: |
${domainRows.join('\n')}

## Collection Contracts

| Collection | Domain | Language | Purpose | Observed actions | Observed metadata keys | Observed filter keys | Inferred required metadata keys |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Observed Unregistered Or Dynamic Targets

These are Chroma targets found in source calls but not resolved to a registered
\`CHROMA_COLLECTIONS\` row. Literal entries are drift candidates; expression
entries need explicit contract handling in P1-43.

| Target | Resolution | Actions | Source count | Sources |
| --- | --- | --- | ---: | --- |
${unregisteredRows.length ? unregisteredRows.join('\n') : '| none | - | - | 0 | - |'}
`;
}

function writeCatalog(catalog) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(catalog));
}

function assertCurrent(catalog) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('Chroma catalog files are missing. Run the generator.');
  }
  const expectedJson = `${JSON.stringify(catalog, null, 2)}\n`;
  const expectedMd = renderMarkdown(catalog);
  if (readFileSync(jsonPath, 'utf8') !== expectedJson || readFileSync(mdPath, 'utf8') !== expectedMd) {
    throw new Error('Chroma catalog is stale. Run node server/scripts/generate-chroma-catalog.mjs');
  }
}

if (check) {
  const catalog = buildCatalog(readExistingGeneratedAt());
  assertCurrent(catalog);
  console.log(
    `Chroma catalog is current (${catalog.summary.collections} collections, ${catalog.summary.metadataContractRows} contracts).`,
  );
} else {
  const catalog = buildCatalog();
  writeCatalog(catalog);
  console.log(
    `Wrote Chroma catalog (${catalog.summary.collections} collections, ${catalog.summary.metadataContractRows} contracts).`,
  );
}
