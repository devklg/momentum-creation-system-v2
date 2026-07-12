import { describe, expect, it } from 'vitest';
import { summarizeEntitlementAudit } from '../adminEntitlementAudit.js';

describe('summarizeEntitlementAudit', () => {
  it('reports recognized and unknown grants without mutating them', () => {
    const result = summarizeEntitlementAudit({
      adminIds: ['TMBA-ADMIN'],
      members: [{ tmagId: 'TMBA-1', threeBaId: 'THREE-1', firstName: 'Ada', lastName: 'Lovelace', entitlements: ['vm_dialer', 'mystery_access'] }],
      routes: [
        { id: 'GET /api/admin/x', permissions: { entitlements: ['admin_allowlist'], gates: ['requireAdmin'] } },
        { id: 'GET /api/vm/x', permissions: { entitlements: ['vm_dialer'], gates: ['requireVmDialerAccess'] } },
        { id: 'GET /api/p/:token', permissions: { entitlements: ['valid_prospect_identity'], gates: ['token_in_path'] } },
      ],
    });
    expect(result.policy).toBe('read_only_audit');
    expect(result.definitions.find((row) => row.entitlement === 'vm_dialer')).toMatchObject({ protectedRoutes: 1, grantedPrincipals: 1 });
    expect(result.unknownGrants).toHaveLength(1);
    expect(result.unknownGrants[0]?.entitlement).toBe('mystery_access');
  });
});
