#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Node, Project } from 'ts-morph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const jsonPath = path.join(outDir, 'api-route-map.json');
const mdPath = path.join(outDir, 'API_ROUTE_MAP.md');
const indexPath = 'server/src/index.ts';
const check = process.argv.includes('--check');

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all']);
const APP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'use']);

function readExistingGeneratedAt() {
  if (!existsSync(jsonPath)) return null;
  try {
    const existing = JSON.parse(readFileSync(jsonPath, 'utf8'));
    return typeof existing.generatedAt === 'string' ? existing.generatedAt : null;
  } catch {
    return null;
  }
}

function unwrapExpression(node) {
  if (!node) return null;
  if (Node.isAsExpression(node) || Node.isSatisfiesExpression?.(node)) return unwrapExpression(node.getExpression());
  return node;
}

function stringLiteralValue(node) {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) return null;
  if (Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.getLiteralText();
  }
  return null;
}

function expressionName(node) {
  const unwrapped = unwrapExpression(node);
  if (!unwrapped) return '';
  if (Node.isIdentifier(unwrapped)) return unwrapped.getText();
  if (Node.isPropertyAccessExpression(unwrapped)) return unwrapped.getText();
  if (Node.isCallExpression(unwrapped)) return `${expressionName(unwrapped.getExpression())}(...)`;
  if (Node.isArrowFunction(unwrapped) || Node.isFunctionExpression(unwrapped)) return 'handler';
  return unwrapped.getText().replace(/\s+/g, ' ');
}

function joinRoutePath(base, child) {
  const normalizedBase = base === '/' ? '' : base.replace(/\/+$/g, '');
  const normalizedChild = child === '/' ? '' : child.replace(/^\/+/g, '');
  const joined = `${normalizedBase}/${normalizedChild}`.replace(/\/+/g, '/');
  return joined || '/';
}

function importMap(sourceFile) {
  const imports = new Map();
  for (const declaration of sourceFile.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    for (const named of declaration.getNamedImports()) {
      const name = named.getNameNode().getText();
      const alias = named.getAliasNode()?.getText() ?? name;
      imports.set(alias, specifier);
    }
  }
  return imports;
}

function resolveImportFile(importSpecifier) {
  if (!importSpecifier || !importSpecifier.startsWith('.')) return null;
  const withoutExt = importSpecifier.replace(/\.js$/, '.ts');
  return path.normalize(path.join(path.dirname(indexPath), withoutExt)).replaceAll('\\', '/');
}

function sourceLine(sourceFile, needle) {
  const index = sourceFile.getFullText().indexOf(needle);
  if (index < 0) throw new Error(`Route-map phase anchor missing from ${indexPath}: ${needle}`);
  return sourceFile.getLineAndColumnAtPos(index).line;
}

function phaseBoundaries(indexFile) {
  return {
    cookieParser: sourceLine(indexFile, 'app.use(cookieParser())'),
    globalJson: sourceLine(indexFile, "app.use(express.json({ limit: '256kb' }))"),
    baFacing: sourceLine(indexFile, "app.use('/api/invitations', invitationRoutes)"),
    fallback: sourceLine(indexFile, 'app.use((_req, res) => res.status(404)'),
  };
}

function mountPhase(line, boundaries) {
  if (line < boundaries.cookieParser) return 'raw_body_before_json';
  if (line < boundaries.globalJson) return 'pre_json_admin_body_limit';
  if (line < boundaries.baFacing) return 'pre_gate';
  if (line < boundaries.fallback) return 'ba_facing_gated';
  return 'server_middleware_or_fallback';
}

function mountAccessProfile(mountPath, phase) {
  if (phase === 'raw_body_before_json') return 'raw_body_webhook';
  if (mountPath.startsWith('/api/admin')) return 'admin';
  if (/^\/api\/p(\/|$)/.test(mountPath) || /^\/api\/rvm(\/|$)/.test(mountPath)) return 'prospect_token';
  if (mountPath.startsWith('/api/runtime')) return 'internal_runtime';
  if (phase === 'ba_facing_gated') return 'ba_auth_steve_gated';
  return 'pre_gate_or_public';
}

function discoverMounts(indexFile) {
  const imports = importMap(indexFile);
  const boundaries = phaseBoundaries(indexFile);
  const mounts = [];
  indexFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return;
    if (expression.getExpression().getText() !== 'app') return;
    const method = expression.getName();
    if (!APP_METHODS.has(method)) return;
    const args = node.getArguments();
    const mountPath = stringLiteralValue(args[0]);
    if (!mountPath) return;
    const routerArg = [...args].reverse().find((arg) => Node.isIdentifier(unwrapExpression(arg)));
    if (!routerArg) return;
    const routerIdentifier = routerArg.getText();
    const importSpecifier = imports.get(routerIdentifier);
    const routeFile = resolveImportFile(importSpecifier);
    if (!routeFile) return;
    const middlewares = args
      .slice(1, args.indexOf(routerArg))
      .map((arg) => expressionName(arg))
      .filter(Boolean);
    const line = node.getStartLineNumber();
    const phase = mountPhase(line, boundaries);
    mounts.push({
      mountPath,
      routerIdentifier,
      routeFile,
      line,
      phase,
      accessProfile: mountAccessProfile(mountPath, phase),
      mountMiddleware: middlewares,
    });
  });
  return mounts.sort((a, b) => a.line - b.line);
}

function discoverRouteDeclarations(sourceFile, routerIdentifier) {
  const routes = [];
  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expression = node.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return;
    if (expression.getExpression().getText() !== routerIdentifier) return;
    const method = expression.getName();
    if (!ROUTE_METHODS.has(method)) return;
    const args = node.getArguments();
    const routePath = stringLiteralValue(args[0]);
    if (!routePath) return;
    const chain = args.slice(1).map((arg) => expressionName(arg)).filter(Boolean);
    routes.push({
      method: method.toUpperCase(),
      routePath,
      localMiddleware: chain.slice(0, Math.max(0, chain.length - 1)),
      handler: chain[chain.length - 1] ?? '',
      line: node.getStartLineNumber(),
    });
  });
  return routes.sort((a, b) => a.line - b.line);
}

function accessSignals(route) {
  const chain = [...route.mountMiddleware, ...route.localMiddleware];
  return {
    requireAuth: chain.includes('requireAuth'),
    requireAdmin: chain.includes('requireAdmin'),
    requireSteveComplete: chain.includes('requireSteveComplete'),
    requireVmDialerAccess: chain.includes('requireVmDialerAccess'),
    requireRuntimeInternal: chain.includes('requireRuntimeInternal'),
    requireAdminOrHealthSecret: chain.includes('requireAdminOrHealthSecret'),
    hasRateLimit: chain.some((item) => item.startsWith('ipRateLimit(')),
    hasRawBodyParser: chain.some((item) => item.startsWith('express.raw(')),
  };
}

function buildCatalog(generatedAtOverride = null) {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const indexFile = project.addSourceFileAtPath(path.join(repoRoot, indexPath));
  const mounts = discoverMounts(indexFile);
  const routeRows = [];
  const routeFiles = new Map();

  for (const mount of mounts) {
    const absoluteRouteFile = path.join(repoRoot, mount.routeFile);
    if (!existsSync(absoluteRouteFile)) {
      routeRows.push({
        method: 'USE',
        fullPath: `${mount.mountPath}/*`,
        mountPath: mount.mountPath,
        localPath: '(route file missing)',
        mountPhase: mount.phase,
        accessProfile: mount.accessProfile,
        mountMiddleware: mount.mountMiddleware,
        localMiddleware: [],
        handler: '',
        source: `${indexPath}:${mount.line}`,
        routeSource: mount.routeFile,
        signals: accessSignals({ ...mount, localMiddleware: [] }),
        staticAnalysisStatus: 'missing_route_file',
      });
      continue;
    }
    const routeFile = project.addSourceFileAtPathIfExists(absoluteRouteFile);
    const declarations = routeFile
      ? discoverRouteDeclarations(routeFile, mount.routerIdentifier)
      : [];
    routeFiles.set(mount.routeFile, (routeFiles.get(mount.routeFile) ?? 0) + declarations.length);
    if (declarations.length === 0) {
      routeRows.push({
        method: 'USE',
        fullPath: `${mount.mountPath}/*`,
        mountPath: mount.mountPath,
        localPath: '(no static router.method declarations found)',
        mountPhase: mount.phase,
        accessProfile: mount.accessProfile,
        mountMiddleware: mount.mountMiddleware,
        localMiddleware: [],
        handler: '',
        source: `${indexPath}:${mount.line}`,
        routeSource: mount.routeFile,
        signals: accessSignals({ ...mount, localMiddleware: [] }),
        staticAnalysisStatus: 'no_static_declarations',
      });
      continue;
    }
    for (const declaration of declarations) {
      const row = {
        method: declaration.method,
        fullPath: joinRoutePath(mount.mountPath, declaration.routePath),
        mountPath: mount.mountPath,
        localPath: declaration.routePath,
        mountPhase: mount.phase,
        accessProfile: mount.accessProfile,
        mountMiddleware: mount.mountMiddleware,
        localMiddleware: declaration.localMiddleware,
        handler: declaration.handler,
        source: `${mount.routeFile}:${declaration.line}`,
        routeSource: mount.routeFile,
        signals: accessSignals({ ...mount, localMiddleware: declaration.localMiddleware }),
        staticAnalysisStatus: 'ok',
      };
      routeRows.push(row);
    }
  }

  const byPhase = routeRows.reduce((acc, row) => {
    acc[row.mountPhase] = (acc[row.mountPhase] ?? 0) + 1;
    return acc;
  }, {});
  const byAccessProfile = routeRows.reduce((acc, row) => {
    acc[row.accessProfile] = (acc[row.accessProfile] ?? 0) + 1;
    return acc;
  }, {});
  const byMethod = routeRows.reduce((acc, row) => {
    acc[row.method] = (acc[row.method] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: generatedAtOverride ?? new Date().toISOString(),
    sources: [indexPath, 'server/src/routes/**/*.ts', 'server/src/runtime/knowledge-evolution/routes.ts'],
    summary: {
      mounts: mounts.length,
      routeFiles: routeFiles.size,
      routes: routeRows.length,
      byPhase,
      byAccessProfile,
      byMethod,
    },
    mounts,
    routes: routeRows,
  };
}

function mdTable(rows) {
  return rows.join('\n');
}

function renderMarkdown(catalog) {
  const phaseRows = Object.entries(catalog.summary.byPhase)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([phase, count]) => `| ${phase} | ${count} |`);
  const accessRows = Object.entries(catalog.summary.byAccessProfile)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([profile, count]) => `| ${profile} | ${count} |`);
  const methodRows = Object.entries(catalog.summary.byMethod)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([method, count]) => `| ${method} | ${count} |`);
  const mountRows = catalog.mounts.map(
    (row) =>
      `| \`${row.mountPath}\` | \`${row.routerIdentifier}\` | ${row.phase} | ${row.accessProfile} | \`${indexPath}:${row.line}\` |`,
  );
  const routeRows = catalog.routes.map((row) => {
    const guards = [
      row.signals.requireAdmin ? 'admin' : null,
      row.signals.requireAdminOrHealthSecret ? 'admin-or-secret' : null,
      row.signals.requireRuntimeInternal ? 'runtime-internal' : null,
      row.signals.requireAuth ? 'auth' : null,
      row.signals.requireSteveComplete ? 'steve' : null,
      row.signals.requireVmDialerAccess ? 'vm-entitlement' : null,
      row.signals.hasRateLimit ? 'rate-limit' : null,
      row.signals.hasRawBodyParser ? 'raw-body' : null,
    ]
      .filter(Boolean)
      .join(', ');
    return `| ${row.method} | \`${row.fullPath}\` | ${row.mountPhase} | ${row.accessProfile} | ${guards || 'none'} | \`${row.source}\` |`;
  });

  return `# API Route Map

> Generated by \`node server/scripts/generate-api-route-map.mjs\`.

## Summary

- Generated: ${catalog.generatedAt}
- Mounted routers: ${catalog.summary.mounts}
- Route files: ${catalog.summary.routeFiles}
- Static route rows: ${catalog.summary.routes}

## Routes By Phase

| Phase | Routes |
| --- | ---: |
${mdTable(phaseRows)}

## Routes By Access Profile

| Access profile | Routes |
| --- | ---: |
${mdTable(accessRows)}

## Routes By Method

| Method | Routes |
| --- | ---: |
${mdTable(methodRows)}

## Mounts

| Mount path | Router | Phase | Access profile | Source |
| --- | --- | --- | --- | --- |
${mdTable(mountRows)}

## Routes

| Method | Full path | Phase | Access profile | Guard signals | Source |
| --- | --- | --- | --- | --- | --- |
${mdTable(routeRows)}
`;
}

function writeCatalog(catalog) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(catalog));
}

function assertCurrent(catalog) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('API route map files are missing. Run the generator.');
  }
  const expectedJson = `${JSON.stringify(catalog, null, 2)}\n`;
  const expectedMd = renderMarkdown(catalog);
  if (readFileSync(jsonPath, 'utf8') !== expectedJson || readFileSync(mdPath, 'utf8') !== expectedMd) {
    throw new Error('API route map is stale. Run node server/scripts/generate-api-route-map.mjs');
  }
}

if (check) {
  const catalog = buildCatalog(readExistingGeneratedAt());
  assertCurrent(catalog);
  console.log(`API route map is current (${catalog.summary.routes} routes across ${catalog.summary.mounts} mounts).`);
} else {
  const catalog = buildCatalog();
  writeCatalog(catalog);
  console.log(`Wrote API route map (${catalog.summary.routes} routes across ${catalog.summary.mounts} mounts).`);
}
