export interface McsAdminSensitiveActionControl {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  route: string;
  auditActions: string[];
  actionSource: string;
  risk: 'destructive' | 'governance_sensitive';
  requiresReason: boolean;
  requiresBeforeAfter: boolean;
}

export const MCS_ADMIN_SENSITIVE_ACTIONS: readonly McsAdminSensitiveActionControl[] = [
  { id: 'ba_delete', method: 'DELETE', route: '/api/admin/bas/:tmagId', auditActions: ['admin.ba.delete'], actionSource: 'server/src/domain/adminBaCrud.ts', risk: 'destructive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'ba_restore', method: 'POST', route: '/api/admin/bas/:tmagId/restore', auditActions: ['admin.ba.restore'], actionSource: 'server/src/domain/adminBaCrud.ts', risk: 'governance_sensitive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'sponsor_override', method: 'POST', route: '/api/admin/bas/:tmagId/sponsor-override', auditActions: ['admin.sponsor.override'], actionSource: 'server/src/domain/adminBaOversight.ts', risk: 'governance_sensitive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'entitlement_change', method: 'POST', route: '/api/admin/bas/:tmagId/entitlements', auditActions: ['admin.ba.entitlement_granted', 'admin.ba.entitlement_revoked'], actionSource: 'server/src/domain/entitlements.ts', risk: 'governance_sensitive', requiresReason: false, requiresBeforeAfter: true },
  { id: 'prospect_delete', method: 'DELETE', route: '/api/admin/prospects/:prospectId', auditActions: ['admin.prospect.delete'], actionSource: 'server/src/domain/adminProspectCrud.ts', risk: 'destructive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'prospect_restore', method: 'POST', route: '/api/admin/prospects/:prospectId/restore', auditActions: ['admin.prospect.restore'], actionSource: 'server/src/domain/adminProspectCrud.ts', risk: 'governance_sensitive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'prospect_move', method: 'POST', route: '/api/admin/prospects/:prospectId/move', auditActions: ['admin.prospect.move'], actionSource: 'server/src/domain/adminProspectOversight.ts', risk: 'governance_sensitive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'prospect_sponsor_reassign', method: 'POST', route: '/api/admin/prospects/:prospectId/reassign-sponsor', auditActions: ['admin.prospect.sponsor.reassigned'], actionSource: 'server/src/domain/adminProspectOversight.ts', risk: 'governance_sensitive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'prospect_manual_flush', method: 'POST', route: '/api/admin/prospects/:prospectId/manual-flush', auditActions: ['admin.prospect.manual_flush'], actionSource: 'server/src/domain/adminProspectOversight.ts', risk: 'destructive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'prospect_force_enroll', method: 'POST', route: '/api/admin/prospects/:prospectId/force-enroll', auditActions: ['admin.prospect.force_enroll'], actionSource: 'server/src/domain/adminProspectOversight.ts', risk: 'destructive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'queue_window_change', method: 'PUT', route: '/api/admin/queue/visible-window', auditActions: ['admin.queue.visible_window.changed'], actionSource: 'server/src/routes/admin/queue.ts', risk: 'governance_sensitive', requiresReason: false, requiresBeforeAfter: true },
  { id: 'queue_rule_change', method: 'PUT', route: '/api/admin/queue/rules/:key', auditActions: ['admin.queue.rule.changed'], actionSource: 'server/src/routes/admin/queue.ts', risk: 'governance_sensitive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'tenant_settings_change', method: 'PATCH', route: '/api/admin/tenant/settings', auditActions: ['admin.tenant.settings.changed'], actionSource: 'server/src/routes/admin/tenant.ts', risk: 'governance_sensitive', requiresReason: false, requiresBeforeAfter: true },
  { id: 'master_content_save', method: 'PUT', route: '/api/admin/tenant/templates/:templateKey', auditActions: ['admin.tenant.master_content.saved', 'admin.tenant.master_content.blocked'], actionSource: 'server/src/routes/admin/tenant.ts', risk: 'governance_sensitive', requiresReason: false, requiresBeforeAfter: true },
  { id: 'vm_live_approval', method: 'POST', route: '/api/admin/vm/campaigns/:vmCampaignId/live-approval', auditActions: ['admin.vm.live_delivery.approved', 'admin.vm.live_delivery.revoked'], actionSource: 'server/src/routes/admin/vm.ts', risk: 'governance_sensitive', requiresReason: true, requiresBeforeAfter: true },
  { id: 'broadcast_send', method: 'POST', route: '/api/admin/broadcast/', auditActions: ['admin.broadcast_send'], actionSource: 'server/src/domain/broadcast.ts', risk: 'governance_sensitive', requiresReason: false, requiresBeforeAfter: false },
] as const;
