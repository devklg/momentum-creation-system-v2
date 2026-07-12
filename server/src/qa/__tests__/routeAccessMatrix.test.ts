import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface RouteAccessMatrixRow {
  method: string;
  fullPath: string;
  accessClass: string;
  expected: {
    authGate: string;
    adminGate: string;
    steveGate: string;
    vmEntitlementGate: string;
    secretGate: string;
  };
  effectiveSteveException: string;
  tokenIdentity: string;
  notes: string[];
  declared: {
    requireAuth: boolean;
    requireAdmin: boolean;
    requireAdminOrHealthSecret: boolean;
    requireRuntimeInternal: boolean;
    requireSteveComplete: boolean;
    requireVmDialerAccess: boolean;
    hasRateLimit: boolean;
    customGuards: string[];
  };
  steveWhitelistMatch: boolean;
  findings: string[];
}

interface RouteAccessMatrix {
  summary: {
    routes: number;
    findings: number;
    byAccessClass: Record<string, number>;
    guardCoverage: Record<string, number>;
  };
  routes: RouteAccessMatrixRow[];
}

const repoRoot = path.resolve(process.cwd(), '..');
const matrixPath = path.join(repoRoot, 'engineering/sprints/platform-audit-p1/route-access-matrix.json');

function matrix(): RouteAccessMatrix {
  return JSON.parse(readFileSync(matrixPath, 'utf8')) as RouteAccessMatrix;
}

function route(method: string, fullPath: string): RouteAccessMatrixRow {
  const found = matrix().routes.find((item) => item.method === method && item.fullPath === fullPath);
  if (!found) throw new Error(`Missing route access matrix row: ${method} ${fullPath}`);
  return found;
}

describe('P1 route access matrix', () => {
  it('covers the full API route map with no generated findings', () => {
    const data = matrix();
    expect(data.summary.routes).toBe(210);
    expect(data.routes).toHaveLength(data.summary.routes);
    expect(data.summary.findings).toBe(0);
  });

  it('classifies admin routes and admin secret exceptions', () => {
    const admin = route('POST', '/api/admin/access-codes/');
    expect(admin.accessClass).toBe('admin');
    expect(admin.declared.requireAdmin).toBe(true);
    expect(admin.expected.adminGate).toBe('requireAdmin');

    const health = route('GET', '/api/admin/health/triple-stack');
    expect(health.accessClass).toBe('admin_or_health_secret');
    expect(health.declared.requireAdminOrHealthSecret).toBe(true);
    expect(health.expected.authGate).toBe('admin_session_or_shared_secret');
  });

  it('classifies BA Steve-gated, Steve-whitelisted, and VM-entitled routes', () => {
    const crm = route('POST', '/api/crm/:prospectId/notes');
    expect(crm.accessClass).toBe('ba_auth_steve_gated');
    expect(crm.expected.steveGate).toBe('requireSteveComplete');

    const launch = route('GET', '/api/cockpit/launch');
    expect(launch.accessClass).toBe('ba_auth_pre_steve');
    expect(launch.steveWhitelistMatch).toBe(true);

    const trainingState = route('POST', '/api/training/fast-start/modules/:id/state');
    expect(trainingState.accessClass).toBe('ba_auth_steve_gated');
    expect(trainingState.expected.steveGate).toBe('dynamic_by_module_id');
    expect(trainingState.effectiveSteveException).toBe('module_1_dynamic_whitelist_only');

    const profile = route('GET', '/api/profile/');
    expect(profile.accessClass).toBe('ba_auth_pre_steve');
    expect(profile.effectiveSteveException).toBe('profile_prefix_whitelist');

    const vm = route('GET', '/api/vm/lead-owners');
    expect(vm.accessClass).toBe('ba_auth_steve_vm_entitled');
    expect(vm.expected.vmEntitlementGate).toBe('requireVmDialerAccess');
  });

  it('classifies prospect-token and worker/webhook secret routes', () => {
    const prospect = route('GET', '/api/p/:token');
    expect(prospect.accessClass).toBe('prospect_token');
    expect(prospect.expected.authGate).toBe('token_in_path_or_magic_link');

    const reentry = route('POST', '/api/p/login/start');
    expect(reentry.accessClass).toBe('prospect_reentry');
    expect(reentry.tokenIdentity).toBe('prospect_reentry_cookie_or_link_token');

    const steveWorker = route('POST', '/api/steve/discovery/ingest');
    expect(steveWorker.accessClass).toBe('steve_worker_secret');
    expect(steveWorker.declared.customGuards).toContain('requireSteveWorker_inline');

    const vmWebhook = route('POST', '/api/vm/provider/:provider/webhook');
    expect(vmWebhook.accessClass).toBe('vm_provider_webhook');
    expect(vmWebhook.declared.customGuards).toContain('VM_WEBHOOK_SHARED_SECRET_inline');
    expect(vmWebhook.notes.join(' ')).toContain('conditional');
  });

  it('tracks required guard coverage for the P1 security follow-up tasks', () => {
    const coverage = matrix().summary.guardCoverage;
    expect(coverage.requireAdmin).toBeGreaterThan(70);
    expect(coverage.requireAuth).toBe(87);
    expect(coverage.requireSteveComplete).toBeGreaterThan(70);
    expect(coverage.requireVmDialerAccess).toBe(12);
    expect(coverage.customSecretGuard).toBeGreaterThanOrEqual(4);
  });
});
