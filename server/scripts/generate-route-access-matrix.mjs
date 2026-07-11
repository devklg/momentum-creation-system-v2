#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const routeMapPath = path.join(outDir, 'api-route-map.json');
const jsonPath = path.join(outDir, 'route-access-matrix.json');
const mdPath = path.join(outDir, 'ROUTE_ACCESS_MATRIX.md');
const check = process.argv.includes('--check');

const STEVE_WHITELIST = [
  '/api/steve/discovery/state',
  '/api/steve/discovery/script',
  '/api/training/day-1',
  '/api/profile',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/health',
  '/api/cockpit/launch',
  '/api/training/fast-start/progress',
  '/api/training/fast-start/modules/1',
];

function readExistingGeneratedAt() {
  if (!existsSync(jsonPath)) return null;
  try {
    const existing = JSON.parse(readFileSync(jsonPath, 'utf8'));
    return typeof existing.generatedAt === 'string' ? existing.generatedAt : null;
  } catch {
    return null;
  }
}

function routePathMatches(prefix, fullPath) {
  return fullPath === prefix || fullPath.startsWith(`${prefix}/`);
}

function isSteveWhitelisted(fullPath) {
  return STEVE_WHITELIST.some((prefix) => routePathMatches(prefix, fullPath));
}

function isSteveWorkerRoute(fullPath) {
  return fullPath === '/api/steve/discovery/system-prompt' || fullPath === '/api/steve/discovery/ingest';
}

function isVmProviderWebhook(fullPath) {
  return fullPath === '/api/vm/provider/:provider/webhook';
}

function publicAuthRoute(fullPath) {
  return ['/api/auth/verify-code', '/api/auth/register', '/api/auth/login'].includes(fullPath);
}

function authSessionRoute(fullPath) {
  return ['/api/auth/me', '/api/auth/logout'].includes(fullPath);
}

function isProspectReentryRoute(row) {
  return row.mountPath === '/api/p/login';
}

function isProspectTokenRoute(row) {
  return row.mountPath === '/api/p' || row.mountPath === '/api/rvm';
}

function isDynamicFastStartModuleRoute(fullPath) {
  return fullPath === '/api/training/fast-start/modules/:id/state';
}

function effectiveSteveException(row) {
  if (!row.signals.requireAuth && !row.signals.requireSteveComplete) return 'none';
  if (row.fullPath.startsWith('/api/profile')) return 'profile_prefix_whitelist';
  if (isDynamicFastStartModuleRoute(row.fullPath)) return 'module_1_dynamic_whitelist_only';
  if (isSteveWhitelisted(row.fullPath)) return 'static_whitelist';
  return 'none';
}

function bodyLimit(row) {
  const middleware = [...row.mountMiddleware, ...row.localMiddleware];
  if (row.mountPath === '/api/admin/knowledge' && middleware.some((item) => item.startsWith('express.json('))) {
    return '25mb_json';
  }
  if (middleware.some((item) => item.startsWith('express.text('))) return '25mb_text';
  return 'global_256kb_json';
}

function tokenIdentity(row) {
  if (isProspectReentryRoute(row)) return 'prospect_reentry_cookie_or_link_token';
  if (isProspectTokenRoute(row)) return 'path_token';
  return 'none';
}

function classify(row) {
  const signals = row.signals;
  const allMiddleware = [...row.mountMiddleware, ...row.localMiddleware];
  const customGuards = [];
  const findings = [];
  const notes = [];
  const steveException = effectiveSteveException(row);
  const expected = {
    authGate: 'none',
    adminGate: 'none',
    steveGate: 'not_applicable',
    vmEntitlementGate: 'none',
    secretGate: 'none',
    rateLimit: signals.hasRateLimit ? 'present' : 'none',
  };

  let accessClass = 'public_or_pregate';
  if (row.fullPath === '/api/health/persistence') {
    notes.push('public persistence diagnostic; review before production exposure if ops-only detail is considered sensitive');
  }
  if (row.fullPath.startsWith('/api/profile')) {
    notes.push('Steve whitelist is prefix-based, so all profile settings routes bypass the Steve completion check effectively');
  }
  if (isDynamicFastStartModuleRoute(row.fullPath)) {
    notes.push('Static route path is dynamic: module 1 is Steve-whitelisted at runtime; modules 2-5 require Steve completion');
  }
  if (signals.requireAdminOrHealthSecret) {
    accessClass = 'admin_or_health_secret';
    expected.authGate = 'admin_session_or_shared_secret';
    expected.adminGate = 'requireAdminOrHealthSecret';
    expected.secretGate = 'health_secret_optional';
    customGuards.push('requireAdminOrHealthSecret');
  } else if (signals.requireAdmin) {
    accessClass = 'admin';
    expected.authGate = 'admin_session';
    expected.adminGate = 'requireAdmin';
  } else if (signals.requireRuntimeInternal) {
    accessClass = 'internal_runtime_admin_or_secret';
    expected.authGate = 'runtime_secret_or_admin_session';
    expected.adminGate = 'admin_fallback';
    expected.secretGate = 'x-mcs-runtime-secret_when_configured';
    customGuards.push('requireRuntimeInternal');
  } else if (signals.requireVmDialerAccess) {
    accessClass = 'ba_auth_steve_vm_entitled';
    expected.authGate = 'ba_session';
    expected.steveGate = steveException === 'none' ? 'requireSteveComplete' : 'whitelisted';
    expected.vmEntitlementGate = 'requireVmDialerAccess';
  } else if (signals.requireAuth && signals.requireSteveComplete) {
    accessClass =
      steveException === 'none' || steveException === 'module_1_dynamic_whitelist_only'
        ? 'ba_auth_steve_gated'
        : 'ba_auth_pre_steve';
    expected.authGate = 'ba_session';
    expected.steveGate =
      steveException === 'module_1_dynamic_whitelist_only'
        ? 'dynamic_by_module_id'
        : steveException === 'none'
          ? 'requireSteveComplete'
          : 'whitelisted';
  } else if (signals.requireAuth) {
    accessClass = authSessionRoute(row.fullPath) ? 'auth_session' : 'ba_auth_pre_steve';
    expected.authGate = 'ba_session';
    expected.steveGate = steveException === 'none' ? 'not_applied' : 'whitelisted';
  } else if (isProspectReentryRoute(row)) {
    accessClass = 'prospect_reentry';
    expected.authGate = 'magic_link_or_reentry_cookie';
  } else if (isProspectTokenRoute(row)) {
    accessClass = 'prospect_token';
    expected.authGate = 'token_in_path_or_magic_link';
  } else if (row.accessProfile === 'raw_body_webhook') {
    accessClass = 'raw_body_webhook';
    expected.secretGate = 'telnyx_signature';
    customGuards.push('verifyTelnyxWebhook');
  } else if (isSteveWorkerRoute(row.fullPath)) {
    accessClass = 'steve_worker_secret';
    expected.secretGate = 'x-steve-worker-secret';
    customGuards.push('requireSteveWorker_inline');
  } else if (isVmProviderWebhook(row.fullPath)) {
    accessClass = 'vm_provider_webhook';
    expected.secretGate = 'x-vm-provider-secret_when_configured';
    customGuards.push('VM_WEBHOOK_SHARED_SECRET_inline');
    notes.push('VM provider webhook secret is conditional; when VM_WEBHOOK_SHARED_SECRET is unset this route accepts provider payloads without auth');
  } else if (publicAuthRoute(row.fullPath)) {
    accessClass = 'auth_bootstrap';
    expected.rateLimit = signals.hasRateLimit ? 'present' : 'missing';
    if (!signals.hasRateLimit) findings.push('public_auth_without_rate_limit');
  } else if (authSessionRoute(row.fullPath)) {
    accessClass = 'auth_session';
  } else if (row.fullPath.startsWith('/api/health')) {
    accessClass = 'public_health';
  }

  if (row.accessProfile === 'admin' && !signals.requireAdmin && !signals.requireAdminOrHealthSecret) {
    findings.push('admin_mount_without_admin_gate');
  }
  if (
    row.accessProfile === 'ba_auth_steve_gated' &&
    !signals.requireAuth &&
    !isSteveWorkerRoute(row.fullPath)
  ) {
    findings.push('ba_mount_without_auth_gate');
  }
  if (
    row.accessProfile === 'ba_auth_steve_gated' &&
    !signals.requireSteveComplete &&
    !isSteveWhitelisted(row.fullPath)
  ) {
    findings.push('ba_mount_without_steve_gate_or_whitelist');
  }
  if (row.mountPath === '/api/vm' && !signals.requireVmDialerAccess) {
    findings.push('vm_app_route_without_vm_entitlement_gate');
  }
  if (row.fullPath.startsWith('/api/vm/provider') && !signals.requireAdmin && !isVmProviderWebhook(row.fullPath)) {
    findings.push('vm_provider_admin_utility_without_admin_gate');
  }

  return {
    id: `${row.method} ${row.fullPath}`,
    method: row.method,
    fullPath: row.fullPath,
    routeSource: row.source,
    mountPath: row.mountPath,
    mountPhase: row.mountPhase,
    routeAccessProfile: row.accessProfile,
    accessClass,
    accessCategory: accessClass,
    expected,
    declared: {
      middleware: allMiddleware,
      requireAuth: signals.requireAuth,
      requireAdmin: signals.requireAdmin,
      requireAdminOrHealthSecret: signals.requireAdminOrHealthSecret,
      requireRuntimeInternal: signals.requireRuntimeInternal,
      requireSteveComplete: signals.requireSteveComplete,
      requireVmDialerAccess: signals.requireVmDialerAccess,
      hasRateLimit: signals.hasRateLimit,
      hasRawBodyParser: signals.hasRawBodyParser,
      customGuards,
    },
    effectiveSteveException: steveException,
    steveWhitelistMatch: steveException !== 'none',
    tokenIdentity: tokenIdentity(row),
    machineSecret: expected.secretGate,
    rawBody: signals.hasRawBodyParser,
    rateLimit: signals.hasRateLimit,
    bodyLimit: bodyLimit(row),
    notes,
    findings,
  };
}

function buildMatrix(generatedAtOverride = null) {
  if (!existsSync(routeMapPath)) {
    throw new Error('API route map is missing. Run pnpm catalog:api-routes first.');
  }
  const routeMap = JSON.parse(readFileSync(routeMapPath, 'utf8'));
  const routes = routeMap.routes.map(classify);
  const byAccessClass = routes.reduce((acc, row) => {
    acc[row.accessClass] = (acc[row.accessClass] ?? 0) + 1;
    return acc;
  }, {});
  const byFinding = routes.flatMap((row) => row.findings).reduce((acc, finding) => {
    acc[finding] = (acc[finding] ?? 0) + 1;
    return acc;
  }, {});
  const guardCoverage = {
    requireAuth: routes.filter((row) => row.declared.requireAuth).length,
    requireAdmin: routes.filter((row) => row.declared.requireAdmin).length,
    requireAdminOrHealthSecret: routes.filter((row) => row.declared.requireAdminOrHealthSecret).length,
    requireRuntimeInternal: routes.filter((row) => row.declared.requireRuntimeInternal).length,
    requireSteveComplete: routes.filter((row) => row.declared.requireSteveComplete).length,
    requireVmDialerAccess: routes.filter((row) => row.declared.requireVmDialerAccess).length,
    rateLimited: routes.filter((row) => row.declared.hasRateLimit).length,
    rawBodyParser: routes.filter((row) => row.declared.hasRawBodyParser).length,
    customSecretGuard: routes.filter((row) => row.declared.customGuards.length > 0).length,
  };

  return {
    generatedAt: generatedAtOverride ?? new Date().toISOString(),
    sources: [
      'engineering/sprints/platform-audit-p1/api-route-map.json',
      'server/src/middleware/requireAuth.ts',
      'server/src/middleware/requireSteveComplete.ts',
      'server/src/middleware/requireVmDialerAccess.ts',
      'server/src/routes/steve.ts',
      'server/src/routes/vmProviderWebhooks.ts',
    ],
    steveWhitelist: STEVE_WHITELIST,
    summary: {
      routes: routes.length,
      byAccessClass,
      guardCoverage,
      findings: Object.values(byFinding).reduce((sum, count) => sum + count, 0),
      byFinding,
    },
    routes,
  };
}

function mdTable(rows) {
  return rows.join('\n');
}

function renderMarkdown(matrix) {
  const accessRows = Object.entries(matrix.summary.byAccessClass)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([accessClass, count]) => `| ${accessClass} | ${count} |`);
  const guardRows = Object.entries(matrix.summary.guardCoverage)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([guard, count]) => `| ${guard} | ${count} |`);
  const findingRows =
    Object.keys(matrix.summary.byFinding).length === 0
      ? ['| none | 0 |']
      : Object.entries(matrix.summary.byFinding)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([finding, count]) => `| ${finding} | ${count} |`);
  const routeRows = matrix.routes.map((row) => {
    const findings = row.findings.join(', ') || 'none';
    const notes = row.notes.join('; ') || 'none';
    return `| ${row.method} | \`${row.fullPath}\` | ${row.accessCategory} | ${row.expected.authGate} | ${row.expected.adminGate} | ${row.expected.steveGate} | ${row.effectiveSteveException} | ${row.expected.vmEntitlementGate} | ${row.tokenIdentity} | ${row.machineSecret} | ${row.rawBody ? 'yes' : 'no'} | ${row.rateLimit ? 'yes' : 'no'} | ${row.bodyLimit} | ${notes} | ${findings} | \`${row.routeSource}\` |`;
  });

  return `# Route Access Matrix

> Generated by \`node server/scripts/generate-route-access-matrix.mjs\`.

## Summary

- Generated: ${matrix.generatedAt}
- Routes: ${matrix.summary.routes}
- Findings: ${matrix.summary.findings}

## Routes By Access Category

| Access category | Routes |
| --- | ---: |
${mdTable(accessRows)}

## Guard Coverage

| Guard | Routes |
| --- | ---: |
${mdTable(guardRows)}

## Findings

| Finding | Count |
| --- | ---: |
${mdTable(findingRows)}

## Steve Whitelist

${matrix.steveWhitelist.map((entry) => `- \`${entry}\``).join('\n')}

## Matrix

| Method | Path | Access category | Auth gate | Admin gate | Steve gate | Steve exception | VM entitlement | Token identity | Machine secret | Raw body | Rate limit | Body limit | Notes | Findings | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${mdTable(routeRows)}
`;
}

function writeMatrix(matrix) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(matrix, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(matrix));
}

function assertCurrent(matrix) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('Route access matrix files are missing. Run the generator.');
  }
  const expectedJson = `${JSON.stringify(matrix, null, 2)}\n`;
  const expectedMd = renderMarkdown(matrix);
  if (readFileSync(jsonPath, 'utf8') !== expectedJson || readFileSync(mdPath, 'utf8') !== expectedMd) {
    throw new Error('Route access matrix is stale. Run node server/scripts/generate-route-access-matrix.mjs');
  }
}

if (check) {
  const matrix = buildMatrix(readExistingGeneratedAt());
  assertCurrent(matrix);
  console.log(`Route access matrix is current (${matrix.summary.routes} routes, ${matrix.summary.findings} findings).`);
} else {
  const matrix = buildMatrix();
  writeMatrix(matrix);
  console.log(`Wrote route access matrix (${matrix.summary.routes} routes, ${matrix.summary.findings} findings).`);
}
