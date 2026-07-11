import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface ApiRouteMapRow {
  method: string;
  fullPath: string;
  mountPhase: string;
  accessProfile: string;
  mountMiddleware: string[];
  localMiddleware: string[];
  routeSource: string;
  signals: {
    requireAuth: boolean;
    requireAdmin: boolean;
    requireSteveComplete: boolean;
    requireVmDialerAccess: boolean;
    requireRuntimeInternal: boolean;
    requireAdminOrHealthSecret: boolean;
    hasRateLimit: boolean;
    hasRawBodyParser: boolean;
  };
}

interface ApiRouteMap {
  summary: {
    mounts: number;
    routeFiles: number;
    routes: number;
    byPhase: Record<string, number>;
    byAccessProfile: Record<string, number>;
  };
  routes: ApiRouteMapRow[];
}

const repoRoot = path.resolve(process.cwd(), '..');
const routeMapPath = path.join(repoRoot, 'engineering/sprints/platform-audit-p1/api-route-map.json');

function routeMap(): ApiRouteMap {
  return JSON.parse(readFileSync(routeMapPath, 'utf8')) as ApiRouteMap;
}

function route(method: string, fullPath: string): ApiRouteMapRow {
  const found = routeMap().routes.find((item) => item.method === method && item.fullPath === fullPath);
  if (!found) throw new Error(`Missing API route map row: ${method} ${fullPath}`);
  return found;
}

describe('P1 API route map', () => {
  it('summarizes mounted routers and static route declarations from source', () => {
    const data = routeMap();
    expect(data.summary.mounts).toBeGreaterThanOrEqual(35);
    expect(data.summary.routeFiles).toBeGreaterThanOrEqual(35);
    expect(data.summary.routes).toBe(data.routes.length);
    expect(data.summary.byPhase.raw_body_before_json).toBeGreaterThanOrEqual(1);
    expect(data.summary.byPhase.ba_facing_gated).toBeGreaterThanOrEqual(1);
    expect(data.summary.byAccessProfile.admin).toBeGreaterThanOrEqual(1);
  });

  it('records raw-body webhook placement before JSON parsing', () => {
    const webhook = route('POST', '/api/telnyx/webhook');
    expect(webhook.mountPhase).toBe('raw_body_before_json');
    expect(webhook.accessProfile).toBe('raw_body_webhook');
    expect(webhook.signals.hasRawBodyParser).toBe(true);
  });

  it('records Kevin-only admin routes and the admin health secret exception', () => {
    const accessCodes = route('POST', '/api/admin/access-codes/');
    expect(accessCodes.signals.requireAdmin).toBe(true);
    expect(accessCodes.accessProfile).toBe('admin');

    const tripleStackHealth = route('GET', '/api/admin/health/triple-stack');
    expect(tripleStackHealth.signals.requireAdminOrHealthSecret).toBe(true);
    expect(tripleStackHealth.signals.requireAdmin).toBe(false);
  });

  it('records BA gated route signals including Steve and VM entitlement guards', () => {
    const crm = route('POST', '/api/crm/:prospectId/notes');
    expect(crm.mountPhase).toBe('ba_facing_gated');
    expect(crm.signals.requireAuth).toBe(true);
    expect(crm.signals.requireSteveComplete).toBe(true);

    const profile = route('GET', '/api/profile/');
    expect(profile.accessProfile).toBe('ba_auth_steve_gated');

    const vm = route('GET', '/api/vm/lead-owners');
    expect(vm.signals.requireVmDialerAccess).toBe(true);
  });

  it('records prospect-token and internal runtime route families separately', () => {
    const prospect = route('GET', '/api/p/:token');
    expect(prospect.accessProfile).toBe('prospect_token');
    expect(prospect.signals.requireAuth).toBe(false);

    const runtime = route('POST', '/api/runtime/knowledge-evolution/');
    expect(runtime.accessProfile).toBe('internal_runtime');
    expect(runtime.signals.requireRuntimeInternal).toBe(true);
  });
});
