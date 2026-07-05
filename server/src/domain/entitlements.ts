import { persistenceCall } from '../services/persistence/dispatch.js';
import { appendAuditEntry } from './auditLog.js';
import { findBAByTmagId } from './ba.js';

const MONGO_DB = 'momentum';
const BA_COLLECTION = 'team_magnificent_members';

export const VM_DIALER_ENTITLEMENT = 'vm_dialer';

export type MemberEntitlement = typeof VM_DIALER_ENTITLEMENT;
export type EntitlementAction = 'grant' | 'revoke';

export function normalizeEntitlements(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).sort();
}

export function hasVmDialerEntitlement(value: unknown): boolean {
  return normalizeEntitlements(value).includes(VM_DIALER_ENTITLEMENT);
}

export async function setMemberEntitlement(args: {
  tmagId: string;
  entitlement: MemberEntitlement;
  action: EntitlementAction;
  performedByTmagId: string;
  performedByDisplayName: string;
}): Promise<{ ok: true; entitlements: string[] } | { ok: false; error: 'ba_not_found' }> {
  const ba = await findBAByTmagId(args.tmagId);
  if (!ba) return { ok: false, error: 'ba_not_found' };

  const before = normalizeEntitlements((ba as unknown as { entitlements?: unknown }).entitlements);
  const set = new Set(before);
  if (args.action === 'grant') set.add(args.entitlement);
  else set.delete(args.entitlement);
  const after = Array.from(set).sort();

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: BA_COLLECTION,
    filter: { tmagId: args.tmagId },
    update: { $set: { entitlements: after } },
  });

  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (m:TeamMagnificentMember {tmagId: $tmagId}) ' +
      'SET m.entitlements = $entitlements, m.updatedAt = datetime($updatedAt)',
    params: { tmagId: args.tmagId, entitlements: after, updatedAt: new Date().toISOString() },
  });

  await persistenceCall('chromadb', 'add', {
    collection: 'mcs_members',
    ids: [args.tmagId],
    documents: [
      `Team Magnificent member ${ba.firstName} ${ba.lastName} (${ba.tmagId}) entitlements: ${
        after.length > 0 ? after.join(', ') : 'none'
      }.`,
    ],
    metadatas: [
      {
        tmagId: args.tmagId,
        threeBaId: ba.threeBaId,
        kind: 'team_magnificent_member',
        entitlements: after.join(','),
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  await appendAuditEntry({
    actor: {
      kind: 'admin',
      tmagId: args.performedByTmagId,
      displayName: args.performedByDisplayName,
    },
    action:
      args.action === 'grant'
        ? 'admin.ba.entitlement_granted'
        : 'admin.ba.entitlement_revoked',
    entity: {
      kind: 'brand_ambassador',
      id: args.tmagId,
      displayLabel: `${ba.firstName} ${ba.lastName}`.trim(),
    },
    severity: 'info',
    before: { entitlements: before },
    after: { entitlements: after },
    reason: `Kevin/admin ${args.action}ed ${args.entitlement}.`,
  });

  return { ok: true, entitlements: after };
}
