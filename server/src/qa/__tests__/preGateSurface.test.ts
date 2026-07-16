import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface ApiRouteMapRow {
  method: string;
  fullPath: string;
  mountPhase: string;
  accessProfile: string;
  routeSource: string;
}

interface ApiRouteMap {
  routes: ApiRouteMapRow[];
}

interface RouteAccessMatrixRow {
  method: string;
  fullPath: string;
  accessClass: string;
  expected: {
    authGate: string;
    adminGate: string;
    secretGate: string;
  };
  declared: {
    requireAuth: boolean;
    requireAdmin: boolean;
    requireAdminOrHealthSecret: boolean;
    requireRuntimeInternal: boolean;
    customGuards: string[];
  };
  tokenIdentity: string;
  findings: string[];
}

interface RouteAccessMatrix {
  routes: RouteAccessMatrixRow[];
}

const repoRoot = path.resolve(process.cwd(), '..');
const routeMapPath = path.join(repoRoot, 'engineering/sprints/platform-audit-p1/api-route-map.json');
const matrixPath = path.join(repoRoot, 'engineering/sprints/platform-audit-p1/route-access-matrix.json');

const ALLOWED_PRE_GATE_CLASSES = new Set([
  'admin',
  'admin_or_health_secret',
  'auth_bootstrap',
  'auth_session',
  'ba_auth_pre_steve',
  'ba_auth_steve_gated',
  'internal_runtime_admin_or_secret',
  'prospect_reentry',
  'prospect_token',
  'public_health',
  'raw_body_webhook',
  'steve_worker_secret',
  'vm_provider_webhook',
]);

const ALLOWED_PRE_GATE_PREFIXES = [
  '/api/admin/',
  '/api/auth/',
  '/api/health',
  '/api/michael/training-support',
  '/api/onboarding/questionnaire',
  '/api/p',
  '/api/profile',
  '/api/rvm',
  '/api/runtime/knowledge-evolution',
  '/api/sponsor/workbook',
  '/api/steve/discovery',
  '/api/telnyx',
  '/api/training/fast-start',
  '/api/vm/provider',
  '/api/welcome',
  '/api/cockpit/launch',
];

const ALLOWED_STEVE_GATED_PRE_GATE_PATHS = new Set([
  '/api/michael/training-support/:downlineTmagId',
  '/api/steve/discovery/correction',
  '/api/steve/discovery/export',
  '/api/steve/discovery/privacy',
  '/api/steve/discovery/privacy/consent',
  '/api/steve/discovery/privacy/withdraw',
  '/api/steve/discovery/profile/:downlineTmagId',
]);

function routeMap(): ApiRouteMap {
  return JSON.parse(readFileSync(routeMapPath, 'utf8')) as ApiRouteMap;
}

function matrix(): RouteAccessMatrix {
  return JSON.parse(readFileSync(matrixPath, 'utf8')) as RouteAccessMatrix;
}

function keyOf(row: { method: string; fullPath: string }): string {
  return `${row.method} ${row.fullPath}`;
}

function matrixByKey(): Map<string, RouteAccessMatrixRow> {
  return new Map(matrix().routes.map((row) => [keyOf(row), row]));
}

function preGateRows(): Array<ApiRouteMapRow & { matrix: RouteAccessMatrixRow }> {
  const access = matrixByKey();
  return routeMap().routes
    .filter((row) =>
      ['raw_body_before_json', 'pre_json_admin_body_limit', 'pre_gate'].includes(row.mountPhase),
    )
    .map((row) => {
      const matrixRow = access.get(keyOf(row));
      if (!matrixRow) throw new Error(`Missing route-access row for ${keyOf(row)}`);
      return { ...row, matrix: matrixRow };
    });
}

describe('P1 pre-gate route surface', () => {
  it('keeps pre-gate routes limited to approved access classes', () => {
    const unexpected = preGateRows().filter((row) => !ALLOWED_PRE_GATE_CLASSES.has(row.matrix.accessClass));
    expect(unexpected).toEqual([]);
  });

  it('keeps pre-gate routes limited to approved route families', () => {
    const unexpected = preGateRows().filter(
      (row) => !ALLOWED_PRE_GATE_PREFIXES.some((prefix) => row.fullPath.startsWith(prefix)),
    );
    expect(unexpected).toEqual([]);
  });

  it('does not allow ordinary BA-gated app routes in the pre-gate mount phases', () => {
    const ordinaryGated = preGateRows().filter((row) =>
      ['ba_auth_steve_gated', 'ba_auth_steve_vm_entitled'].includes(row.matrix.accessClass) &&
      !ALLOWED_STEVE_GATED_PRE_GATE_PATHS.has(row.fullPath),
    );
    expect(ordinaryGated).toEqual([]);
  });

  it('requires every authenticated pre-Steve BA route to stay authenticated', () => {
    const preSteve = preGateRows().filter((row) => row.matrix.accessClass === 'ba_auth_pre_steve');
    expect(preSteve).toHaveLength(12);
    for (const row of preSteve) {
      expect(row.matrix.declared.requireAuth, row.fullPath).toBe(true);
      expect(row.matrix.expected.authGate, row.fullPath).toBe('ba_session');
      expect(row.matrix.findings, row.fullPath).toEqual([]);
    }
  });

  it('keeps unauthenticated pre-gate routes in token, bootstrap, health, or secret-guarded families', () => {
    const unauthenticated = preGateRows().filter((row) => !row.matrix.declared.requireAuth);
    const bad = unauthenticated.filter(
      (row) =>
        ![
          'auth_bootstrap',
          'public_health',
          'prospect_reentry',
          'prospect_token',
          'raw_body_webhook',
          'steve_worker_secret',
          'vm_provider_webhook',
          'auth_session',
        ].includes(row.matrix.accessClass) &&
        !row.matrix.declared.requireAdmin &&
        !row.matrix.declared.requireAdminOrHealthSecret &&
        !row.matrix.declared.requireRuntimeInternal,
    );
    expect(bad).toEqual([]);
  });
});
