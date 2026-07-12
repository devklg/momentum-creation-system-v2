import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface RouteAccessMatrixRow {
  method: string;
  fullPath: string;
  accessClass: string;
  expected: {
    authGate: string;
    steveGate: string;
    vmEntitlementGate: string;
  };
  declared: {
    requireAuth: boolean;
    requireSteveComplete: boolean;
    requireVmDialerAccess: boolean;
  };
  effectiveSteveException: string;
  findings: string[];
}

interface RouteAccessMatrix {
  summary: {
    byAccessClass: Record<string, number>;
  };
  routes: RouteAccessMatrixRow[];
}

const repoRoot = path.resolve(process.cwd(), '..');
const matrixPath = path.join(repoRoot, 'engineering/sprints/platform-audit-p1/route-access-matrix.json');

function matrix(): RouteAccessMatrix {
  return JSON.parse(readFileSync(matrixPath, 'utf8')) as RouteAccessMatrix;
}

function routesByClass(accessClass: string): RouteAccessMatrixRow[] {
  return matrix().routes.filter((route) => route.accessClass === accessClass);
}

function route(method: string, fullPath: string): RouteAccessMatrixRow {
  const found = matrix().routes.find((item) => item.method === method && item.fullPath === fullPath);
  if (!found) throw new Error(`Missing route access matrix row: ${method} ${fullPath}`);
  return found;
}

describe('P1 BA route gate protection', () => {
  it('covers every BA-facing class from the generated route access matrix', () => {
    expect(routesByClass('ba_auth_pre_steve')).toHaveLength(
      matrix().summary.byAccessClass.ba_auth_pre_steve ?? 0,
    );
    expect(routesByClass('ba_auth_steve_gated')).toHaveLength(
      matrix().summary.byAccessClass.ba_auth_steve_gated ?? 0,
    );
    expect(routesByClass('ba_auth_steve_vm_entitled')).toHaveLength(
      matrix().summary.byAccessClass.ba_auth_steve_vm_entitled ?? 0,
    );
  });

  it('requires auth and Steve completion on ordinary BA-gated routes', () => {
    for (const gated of routesByClass('ba_auth_steve_gated')) {
      expect(gated.declared.requireAuth, gated.fullPath).toBe(true);
      expect(gated.declared.requireSteveComplete, gated.fullPath).toBe(true);
      expect(gated.expected.authGate, gated.fullPath).toBe('ba_session');
      expect(['requireSteveComplete', 'dynamic_by_module_id']).toContain(gated.expected.steveGate);
      expect(gated.findings, gated.fullPath).toEqual([]);
    }
  });

  it('requires auth, Steve completion, and VM entitlement on VM BA routes', () => {
    const vmRoutes = routesByClass('ba_auth_steve_vm_entitled');
    expect(vmRoutes).toHaveLength(25);
    for (const vmRoute of vmRoutes) {
      expect(vmRoute.fullPath.startsWith('/api/vm/')).toBe(true);
      expect(vmRoute.declared.requireAuth, vmRoute.fullPath).toBe(true);
      expect(vmRoute.declared.requireSteveComplete, vmRoute.fullPath).toBe(true);
      expect(vmRoute.declared.requireVmDialerAccess, vmRoute.fullPath).toBe(true);
      expect(vmRoute.expected.vmEntitlementGate, vmRoute.fullPath).toBe('requireVmDialerAccess');
      expect(vmRoute.findings, vmRoute.fullPath).toEqual([]);
    }
  });

  it('keeps pre-Steve BA routes authenticated while documenting gate exceptions', () => {
    const preSteveRoutes = routesByClass('ba_auth_pre_steve');
    expect(preSteveRoutes.length).toBeGreaterThan(15);
    for (const preSteve of preSteveRoutes) {
      expect(preSteve.declared.requireAuth, preSteve.fullPath).toBe(true);
      expect(preSteve.expected.authGate, preSteve.fullPath).toBe('ba_session');
      expect(preSteve.expected.steveGate, preSteve.fullPath).toMatch(/^(not_applied|whitelisted)$/);
      expect(preSteve.findings, preSteve.fullPath).toEqual([]);
    }

    expect(route('GET', '/api/cockpit/launch').effectiveSteveException).toBe('static_whitelist');
    expect(route('GET', '/api/profile/').effectiveSteveException).toBe('profile_prefix_whitelist');
    expect(route('POST', '/api/training/fast-start/modules/:id/state').expected.steveGate).toBe(
      'dynamic_by_module_id',
    );
  });

  it('does not classify non-BA route families as BA-facing gates', () => {
    const baPaths = new Set(
      [
        ...routesByClass('ba_auth_pre_steve'),
        ...routesByClass('ba_auth_steve_gated'),
        ...routesByClass('ba_auth_steve_vm_entitled'),
      ].map((item) => item.fullPath),
    );
    expect(baPaths.has('/api/p/:token')).toBe(false);
    expect(baPaths.has('/api/admin/access-codes/')).toBe(false);
    expect(baPaths.has('/api/vm/provider/:provider/webhook')).toBe(false);
  });
});
