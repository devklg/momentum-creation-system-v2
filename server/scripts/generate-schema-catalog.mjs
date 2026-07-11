#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Node, Project, SyntaxKind } from 'ts-morph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const jsonPath = path.join(outDir, 'schema-catalog.json');
const mdPath = path.join(outDir, 'SCHEMA_CATALOG.md');
const check = process.argv.includes('--check');

const SOURCE_GLOBS = ['server/src/**/*.ts', 'server/scripts/**/*.ts', 'packages/shared/src/**/*.ts'];
const EXCLUDE_PATTERNS = [/\/__tests__\//, /\.test\.ts$/, /\.spec\.ts$/, /\/dist\//, /\/node_modules\//];
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

function normalizePath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function shouldSkip(file) {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(`/${file}`));
}

function stringLiteralValue(node) {
  if (!node) return null;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  return null;
}

function sourceConstStrings(sourceFile) {
  const values = new Map();
  sourceFile.forEachDescendant((node) => {
    if (!Node.isVariableDeclaration(node)) return;
    const init = node.getInitializer();
    const value = stringLiteralValue(init);
    if (value) values.set(node.getName(), value);
  });
  return values;
}

function resolveStringExpression(node, consts) {
  const literal = stringLiteralValue(node);
  if (literal) return { value: literal, expression: node.getText() };
  if (Node.isIdentifier(node) && consts.has(node.getText())) {
    return { value: consts.get(node.getText()), expression: node.getText() };
  }
  return { value: null, expression: node?.getText() ?? '' };
}

function propertyInitializer(obj, name) {
  const prop = obj?.getProperty(name);
  if (!prop || !Node.isPropertyAssignment(prop)) return null;
  return prop.getInitializer() ?? null;
}

function unwrapExpression(node) {
  if (Node.isAsExpression(node) || Node.isSatisfiesExpression?.(node)) return unwrapExpression(node.getExpression());
  return node;
}

function addMapSet(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function projectSources() {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(SOURCE_GLOBS);
  return project.getSourceFiles().filter((sf) => !shouldSkip(normalizePath(sf.getFilePath())));
}

function discoverMongoCollections(sourceFiles) {
  const byCollection = new Map();

  for (const sourceFile of sourceFiles) {
    const file = normalizePath(sourceFile.getFilePath());
    if (!file.startsWith('server/')) continue;
    const consts = sourceConstStrings(sourceFile);

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      const exprText = expr.getText();
      const args = node.getArguments();

      let collectionNode = null;
      let source = null;
      if (
        ['writeGraphCritical', 'writeKnowledge', 'writeOperational', 'tieredWrite', 'tripleStackWrite'].includes(exprText)
      ) {
        const obj = Node.isObjectLiteralExpression(args[0]) ? args[0] : null;
        collectionNode = propertyInitializer(obj, 'mongoCollection');
        source = exprText;
      } else if (exprText === 'persistenceCall') {
        const tool = stringLiteralValue(args[0]);
        const action = stringLiteralValue(args[1]);
        const obj = Node.isObjectLiteralExpression(args[2]) ? args[2] : null;
        if (tool === 'mongodb' && ['insert', 'query', 'update', 'delete', 'aggregate'].includes(action ?? '')) {
          collectionNode = propertyInitializer(obj, 'collection');
          source = `persistenceCall.mongodb.${action}`;
        }
      }
      if (!collectionNode || !source) return;
      const resolved = resolveStringExpression(collectionNode, consts);
      const key = resolved.value ?? resolved.expression;
      if (!key) return;
      if (!byCollection.has(key)) {
        byCollection.set(key, {
          collection: key,
          resolved: Boolean(resolved.value),
          schemaMode: key === 'team_magnificent_members' ? 'explicit_mongoose_schema' : 'permissive_mongoose_schema',
          sources: [],
        });
      }
      byCollection.get(key).sources.push({ file, line: node.getStartLineNumber(), source });
    });
  }

  return [...byCollection.values()].sort((a, b) => a.collection.localeCompare(b.collection));
}

function discoverChromaCollections(sourceFiles) {
  const registryPath = 'server/src/services/chromaCollections.ts';
  const registry = sourceFiles.find((sf) => normalizePath(sf.getFilePath()) === registryPath);
  const collections = [];
  if (registry) {
    registry.forEachDescendant((node) => {
      if (!Node.isVariableDeclaration(node) || node.getName() !== 'CHROMA_COLLECTIONS') return;
      const rawInit = node.getInitializer();
      const init = rawInit ? unwrapExpression(rawInit) : null;
      if (!Node.isArrayLiteralExpression(init)) return;
      for (const element of init.getElements()) {
        const value = stringLiteralValue(element);
        if (value) collections.push({ collection: value, source: registryPath });
      }
    });
  }
  return collections.sort((a, b) => a.collection.localeCompare(b.collection));
}

function discoverNeo4j(sourceFiles) {
  const labels = new Map();
  const relationships = new Map();

  for (const sourceFile of sourceFiles) {
    const file = normalizePath(sourceFile.getFilePath());
    if (!file.startsWith('server/')) continue;
    sourceFile.forEachDescendant((node) => {
      if (
        !Node.isStringLiteral(node) &&
        !Node.isNoSubstitutionTemplateLiteral(node) &&
        !Node.isTemplateExpression(node)
      ) {
        return;
      }
      const text = Node.isTemplateExpression(node) ? node.getText() : node.getLiteralText();
      if (!text.includes(':')) return;
      for (const match of text.matchAll(/(?<!\[):([A-Z][A-Za-z0-9_]*)/g)) {
        addMapSet(labels, match[1], `${file}:${node.getStartLineNumber()}`);
      }
      for (const match of text.matchAll(/\[:([A-Z][A-Z0-9_]+)\b/g)) {
        addMapSet(relationships, match[1], `${file}:${node.getStartLineNumber()}`);
      }
    });
  }

  return {
    labels: [...labels.entries()].map(([label, sources]) => ({ label, sources: [...sources].sort() })).sort((a, b) => a.label.localeCompare(b.label)),
    relationships: [...relationships.entries()].map(([relationship, sources]) => ({ relationship, sources: [...sources].sort() })).sort((a, b) => a.relationship.localeCompare(b.relationship)),
  };
}

function routeMounts(sourceFiles) {
  const index = sourceFiles.find((sf) => normalizePath(sf.getFilePath()) === 'server/src/index.ts');
  const importByIdentifier = new Map();
  const mounts = new Map();
  if (!index) return mounts;

  for (const decl of index.getImportDeclarations()) {
    const module = decl.getModuleSpecifierValue();
    if (!module.startsWith('./routes/')) continue;
    const file = path.normalize(path.join('server/src', `${module.slice(2)}.ts`)).replaceAll('\\', '/');
    for (const named of decl.getNamedImports()) importByIdentifier.set(named.getName(), file);
  }

  index.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    if (node.getExpression().getText() !== 'app.use') return;
    const args = node.getArguments();
    const prefix = stringLiteralValue(args[0]);
    const identifier = args[1]?.getText();
    const file = identifier ? importByIdentifier.get(identifier) : null;
    if (prefix && file) mounts.set(file, prefix);
  });
  return mounts;
}

function discoverRoutes(sourceFiles) {
  const mounts = routeMounts(sourceFiles);
  const routes = [];
  for (const sourceFile of sourceFiles) {
    const file = normalizePath(sourceFile.getFilePath());
    if (!file.startsWith('server/src/routes/') || shouldSkip(file)) continue;
    const sharedImports = new Set();
    for (const decl of sourceFile.getImportDeclarations()) {
      if (decl.getModuleSpecifierValue() !== '@momentum/shared') continue;
      for (const named of decl.getNamedImports()) sharedImports.add(named.getName());
    }
    const localRoutes = [];
    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isPropertyAccessExpression(expr)) return;
      const method = expr.getName();
      if (!HTTP_METHODS.has(method)) return;
      const routePath = stringLiteralValue(node.getArguments()[0]);
      if (!routePath) return;
      localRoutes.push({ method: method.toUpperCase(), path: routePath, line: node.getStartLineNumber() });
    });
    if (localRoutes.length === 0) continue;
    routes.push({
      file,
      mount: mounts.get(file) ?? null,
      routes: localRoutes.sort((a, b) => a.line - b.line),
      sharedTypes: [...sharedImports].sort(),
    });
  }
  return routes.sort((a, b) => a.file.localeCompare(b.file));
}

function discoverSharedExports(sourceFiles) {
  const exports = [];
  for (const sourceFile of sourceFiles) {
    const file = normalizePath(sourceFile.getFilePath());
    if (!file.startsWith('packages/shared/src/')) continue;
    for (const statement of sourceFile.getStatements()) {
      const isExported = Node.isExportable(statement) && statement.isExported();
      if (!isExported) continue;
      let kind = null;
      let name = null;
      if (Node.isInterfaceDeclaration(statement)) {
        kind = 'interface';
        name = statement.getName();
      } else if (Node.isTypeAliasDeclaration(statement)) {
        kind = 'type';
        name = statement.getName();
      } else if (Node.isEnumDeclaration(statement)) {
        kind = 'enum';
        name = statement.getName();
      } else if (Node.isVariableStatement(statement)) {
        kind = 'const';
        name = statement.getDeclarations()[0]?.getName() ?? null;
      } else if (Node.isFunctionDeclaration(statement)) {
        kind = 'function';
        name = statement.getName() ?? null;
      }
      if (kind && name) exports.push({ name, kind, file });
    }
  }
  return exports.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
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
  const sourceFiles = projectSources();
  const mongoCollections = discoverMongoCollections(sourceFiles);
  const chromaCollections = discoverChromaCollections(sourceFiles);
  const neo4j = discoverNeo4j(sourceFiles);
  const routes = discoverRoutes(sourceFiles);
  const sharedExports = discoverSharedExports(sourceFiles);

  return {
    generatedAt: generatedAtOverride ?? new Date().toISOString(),
    sourceGlobs: SOURCE_GLOBS,
    mongoCollections,
    neo4j,
    chromaCollections,
    routes,
    sharedExports,
    summary: {
      mongoCollections: mongoCollections.length,
      neo4jLabels: neo4j.labels.length,
      neo4jRelationships: neo4j.relationships.length,
      chromaCollections: chromaCollections.length,
      routeModules: routes.length,
      routeHandlers: routes.reduce((sum, route) => sum + route.routes.length, 0),
      sharedExports: sharedExports.length,
    },
  };
}

function tableRows(rows) {
  return rows.join('\n');
}

function renderMarkdown(catalog) {
  const mongoRows = catalog.mongoCollections.map(
    (row) =>
      `| \`${row.collection}\` | ${row.schemaMode} | ${row.resolved ? 'yes' : 'expression'} | ${row.sources.length} |`,
  );
  const chromaRows = catalog.chromaCollections.map((row) => `| \`${row.collection}\` | \`${row.source}\` |`);
  const labelRows = catalog.neo4j.labels.map((row) => `| \`${row.label}\` | ${row.sources.length} |`);
  const relRows = catalog.neo4j.relationships.map((row) => `| \`${row.relationship}\` | ${row.sources.length} |`);
  const routeRows = catalog.routes.map((row) => {
    const handlers = row.routes.map((r) => `${r.method} ${r.path}`).join('<br>');
    const shared = row.sharedTypes.length > 0 ? row.sharedTypes.map((t) => `\`${t}\``).join(', ') : 'none';
    return `| \`${row.mount ?? '(unmounted)'}\` | \`${row.file}\` | ${handlers} | ${shared} |`;
  });
  const exportRows = catalog.sharedExports.map((row) => `| \`${row.name}\` | ${row.kind} | \`${row.file}\` |`);

  return `# Schema Catalog

> Generated by \`node server/scripts/generate-schema-catalog.mjs\`.
> Use \`--check\` to fail when this catalog is stale.

## Summary

- Generated: ${catalog.generatedAt}
- Mongo collections: ${catalog.summary.mongoCollections}
- Neo4j labels: ${catalog.summary.neo4jLabels}
- Neo4j relationships: ${catalog.summary.neo4jRelationships}
- Chroma collections: ${catalog.summary.chromaCollections}
- Route modules: ${catalog.summary.routeModules}
- Route handlers: ${catalog.summary.routeHandlers}
- Shared exports: ${catalog.summary.sharedExports}

## Mongo Collections

| Collection | Schema mode | Resolved string | Source count |
| --- | --- | --- | ---: |
${tableRows(mongoRows)}

## Neo4j Labels

| Label | Source count |
| --- | ---: |
${tableRows(labelRows)}

## Neo4j Relationships

| Relationship | Source count |
| --- | ---: |
${tableRows(relRows)}

## Chroma Collections

| Collection | Source |
| --- | --- |
${tableRows(chromaRows)}

## Route Payload Surface

| Mount | Route file | Handlers | Shared route/payload types imported |
| --- | --- | --- | --- |
${tableRows(routeRows)}

## Shared Type Exports

| Export | Kind | File |
| --- | --- | --- |
${tableRows(exportRows)}
`;
}

function writeCatalog(catalog) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(catalog));
}

function assertCurrent(catalog) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('Schema catalog files are missing. Run the generator.');
  }
  const expectedJson = `${JSON.stringify(catalog, null, 2)}\n`;
  const expectedMd = renderMarkdown(catalog);
  const actualJson = readFileSync(jsonPath, 'utf8');
  const actualMd = readFileSync(mdPath, 'utf8');
  if (actualJson !== expectedJson || actualMd !== expectedMd) {
    throw new Error('Schema catalog is stale. Run node server/scripts/generate-schema-catalog.mjs');
  }
}

if (check) {
  const catalog = buildCatalog(readExistingGeneratedAt());
  assertCurrent(catalog);
  console.log(
    `Schema catalog is current (${catalog.summary.mongoCollections} Mongo, ` +
      `${catalog.summary.neo4jLabels} Neo4j labels, ${catalog.summary.chromaCollections} Chroma).`,
  );
} else {
  const catalog = buildCatalog();
  writeCatalog(catalog);
  console.log(
    `Wrote schema catalog (${catalog.summary.mongoCollections} Mongo, ` +
      `${catalog.summary.neo4jLabels} Neo4j labels, ${catalog.summary.chromaCollections} Chroma).`,
  );
}
