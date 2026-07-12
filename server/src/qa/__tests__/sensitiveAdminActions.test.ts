import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCS_ADMIN_SENSITIVE_ACTIONS } from '@momentum/shared';
import { classifyAuditAction } from '../../domain/auditTaxonomy.js';

const repoRoot = path.resolve(process.cwd(), '..');
const matrix = JSON.parse(readFileSync(path.join(repoRoot, 'engineering/sprints/platform-audit-p1/route-access-matrix.json'), 'utf8')) as { routes: Array<{ method: string; fullPath: string; declared: { requireAdmin: boolean }; permissions: { roles: string[]; entitlements: string[] } }> };

describe('P1 sensitive admin action controls', () => {
  it('catalogs unique actions whose routes remain founder-admin gated', () => {
    expect(new Set(MCS_ADMIN_SENSITIVE_ACTIONS.map((row) => row.id)).size).toBe(MCS_ADMIN_SENSITIVE_ACTIONS.length);
    for (const control of MCS_ADMIN_SENSITIVE_ACTIONS) {
      const route = matrix.routes.find((row) => row.method === control.method && row.fullPath === control.route);
      expect(route, `${control.id} route missing`).toBeDefined();
      expect(route?.declared.requireAdmin, `${control.id} lost requireAdmin`).toBe(true);
      expect(route?.permissions.roles).toContain('founder_admin');
      expect(route?.permissions.entitlements).toContain('admin_allowlist');
    }
  });

  it('requires every cataloged action to remain audited with declared evidence controls', () => {
    for (const control of MCS_ADMIN_SENSITIVE_ACTIONS) {
      const source = readFileSync(path.join(repoRoot, control.actionSource), 'utf8');
      expect(source, `${control.id} lost appendAuditEntry`).toContain('appendAuditEntry');
      for (const action of control.auditActions) {
        const dynamicSuffix = action.slice(action.indexOf('.'));
        expect(source.includes(action) || source.includes(dynamicSuffix), `${control.id} lost ${action}`).toBe(true);
      }
      if (control.requiresReason) expect(source, `${control.id} lost reason capture`).toContain('reason');
      if (control.requiresBeforeAfter) {
        expect(source, `${control.id} lost before evidence`).toContain('before');
        expect(source, `${control.id} lost after evidence`).toContain('after');
      }
    }
  });

  it('classifies destructive actions as governance-critical and reason-required', () => {
    for (const control of MCS_ADMIN_SENSITIVE_ACTIONS.filter((row) => row.risk === 'destructive')) {
      for (const action of control.auditActions) expect(classifyAuditAction(action, 'critical')).toMatchObject({ impact: 'destructive', sensitivity: 'governance_critical', reasonRequired: true });
    }
  });
});
