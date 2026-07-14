import { describe, expect, it } from 'vitest';
import { classifyAuditAction } from '../auditTaxonomy.js';

describe('unified audit event taxonomy', () => {
  it.each([
    ['admin.dashboard.metrics.viewed', 'read', 'observation', 'succeeded'],
    ['admin.ba.delete', 'delete', 'destructive', 'succeeded'],
    ['admin.tenant.master_content.blocked', 'security', 'control', 'blocked'],
    ['vm.queue.retry_scheduled', 'delivery', 'mutation', 'queued'],
    ['runtime.gate.denied', 'runtime', 'control', 'blocked'],
    ['prompt.output.generated', 'runtime', 'mutation', 'succeeded'],
    ['prompt.output.rejected', 'runtime', 'mutation', 'blocked'],
    ['system.crm.status_changed', 'update', 'mutation', 'succeeded'],
  ])('%s has stable category, impact, and outcome', (action, category, impact, outcome) => {
    expect(classifyAuditAction(action, 'info')).toMatchObject({ version: 1, category, impact, outcome });
  });

  it('requires reasons for destructive and critical governance events', () => {
    expect(classifyAuditAction('admin.prospect.manual_flush', 'critical')).toMatchObject({ sensitivity: 'governance_critical', reasonRequired: true });
    expect(classifyAuditAction('admin.agents.overview.viewed', 'info')).toMatchObject({ sensitivity: 'routine', reasonRequired: false });
  });
});
