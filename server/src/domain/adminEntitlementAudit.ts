import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { McsAdminEntitlementAuditResponse } from '@momentum/shared';
import { env } from '../env.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { normalizeEntitlements, VM_DIALER_ENTITLEMENT } from './entitlements.js';

interface MemberRow { tmagId?: string; threeBaId?: string; firstName?: string; lastName?: string; entitlements?: unknown }
interface PermissionRow { id?: string; permissions?: { entitlements?: string[]; gates?: string[] } }

export function summarizeEntitlementAudit(args: { members: MemberRow[]; adminIds: string[]; routes: PermissionRow[]; warnings?: string[] }): McsAdminEntitlementAuditResponse {
  const known = new Set([VM_DIALER_ENTITLEMENT]);
  const grants = args.members.flatMap((member) => normalizeEntitlements(member.entitlements).map((entitlement) => ({
    tmagId: member.tmagId ?? 'unknown', threeBaId: member.threeBaId ?? null,
    fullName: `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || 'Unknown member', entitlement,
    recognized: known.has(entitlement), source: 'member_record' as const,
  })));
  const unknown = grants.filter((row) => !row.recognized);
  const routeCount = (entitlement: string) => args.routes.filter((row) => row.permissions?.entitlements?.includes(entitlement)).length;
  return {
    ok: true, generatedAt: new Date().toISOString(), policy: 'read_only_audit',
    definitions: [
      { entitlement: 'admin_allowlist', storage: 'ADMIN_TMAG_IDS environment allowlist', gate: 'requireAdmin', protectedRoutes: routeCount('admin_allowlist'), grantedPrincipals: args.adminIds.length },
      { entitlement: VM_DIALER_ENTITLEMENT, storage: 'team_magnificent_members.entitlements', gate: 'requireVmDialerAccess', protectedRoutes: routeCount(VM_DIALER_ENTITLEMENT), grantedPrincipals: grants.filter((row) => row.entitlement === VM_DIALER_ENTITLEMENT).length },
      { entitlement: 'valid_prospect_identity', storage: 'path token, magic link, or prospect re-entry cookie', gate: 'token resolver / prospect session', protectedRoutes: routeCount('valid_prospect_identity'), grantedPrincipals: null },
      { entitlement: 'machine_credential', storage: 'configured shared secrets or provider signatures', gate: 'route-specific machine guard', protectedRoutes: routeCount('machine_credential'), grantedPrincipals: null },
    ],
    adminAllowlist: args.adminIds,
    memberGrants: grants,
    unknownGrants: unknown,
    totals: { membersScanned: args.members.length, memberGrants: grants.length, unknownGrants: unknown.length, routesClassified: args.routes.length },
    warnings: args.warnings ?? [],
  };
}

async function readPermissionRows(): Promise<{ rows: PermissionRow[]; warning?: string }> {
  try {
    const file = path.resolve(process.cwd(), '../engineering/sprints/platform-audit-p1/route-access-matrix.json');
    const parsed = JSON.parse(await readFile(file, 'utf8')) as { routes?: PermissionRow[] };
    return { rows: parsed.routes ?? [] };
  } catch (err) {
    return { rows: [], warning: `Route permission artifact unavailable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function buildAdminEntitlementAudit(): Promise<McsAdminEntitlementAuditResponse> {
  const [membersResult, permissions] = await Promise.all([
    persistenceCall<{ documents?: MemberRow[] }>('mongodb', 'query', { database: 'momentum', collection: 'team_magnificent_members', filter: {}, projection: { tmagId: 1, threeBaId: 1, firstName: 1, lastName: 1, entitlements: 1 }, limit: 5000 }),
    readPermissionRows(),
  ]);
  return summarizeEntitlementAudit({ members: membersResult.documents ?? [], adminIds: env.ADMIN_TMAG_IDS, routes: permissions.rows, warnings: permissions.warning ? [permissions.warning] : [] });
}
