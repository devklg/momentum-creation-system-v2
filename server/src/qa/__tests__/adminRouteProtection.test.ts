import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface RouteAccessMatrixRow {
  method: string;
  fullPath: string;
  accessCategory: string;
  expected: {
    authGate: string;
    adminGate: string;
  };
  declared: {
    requireAdmin: boolean;
    requireAdminOrHealthSecret: boolean;
  };
  findings: string[];
}

interface RouteAccessMatrix {
  summary: {
    routes: number;
    byAccessClass: Record<string, number>;
  };
  routes: RouteAccessMatrixRow[];
}

const repoRoot = path.resolve(process.cwd(), '..');
const matrixPath = path.join(repoRoot, 'engineering/sprints/platform-audit-p1/route-access-matrix.json');

function matrix(): RouteAccessMatrix {
  return JSON.parse(readFileSync(matrixPath, 'utf8')) as RouteAccessMatrix;
}

function adminRoutes(): RouteAccessMatrixRow[] {
  return matrix().routes.filter((route) => route.fullPath.startsWith('/api/admin/'));
}

describe('P1 admin route protection', () => {
  it('covers the current admin surface from the generated route access matrix', () => {
    const routes = adminRoutes();
    expect(routes.length).toBeGreaterThan(80);
    expect(routes.some((route) => route.fullPath === '/api/admin/access-codes/')).toBe(true);
    expect(routes.some((route) => route.fullPath === '/api/admin/health/triple-stack')).toBe(true);
  });

  it('requires the admin gate on every /api/admin route except the health-secret endpoint', () => {
    const unprotected = adminRoutes().filter(
      (route) => !route.declared.requireAdmin && !route.declared.requireAdminOrHealthSecret,
    );
    expect(unprotected).toEqual([]);
  });

  it('keeps the admin health secret exception explicit and narrow', () => {
    const exceptions = adminRoutes().filter((route) => route.declared.requireAdminOrHealthSecret);
    expect(exceptions).toEqual([
      expect.objectContaining({
        method: 'GET',
        fullPath: '/api/admin/health/triple-stack',
        accessCategory: 'admin_or_health_secret',
      }),
    ]);
    expect(exceptions[0]?.expected.adminGate).toBe('requireAdminOrHealthSecret');
  });

  it('classifies all ordinary admin routes as admin-session only', () => {
    const ordinaryAdminRoutes = adminRoutes().filter((route) => route.accessCategory === 'admin');
    expect(ordinaryAdminRoutes.length).toBeGreaterThan(80);
    for (const route of ordinaryAdminRoutes) {
      expect(route.declared.requireAdmin).toBe(true);
      expect(route.expected.authGate).toBe('admin_session');
      expect(route.expected.adminGate).toBe('requireAdmin');
      expect(route.findings).toEqual([]);
    }
  });
});
