import type { McsAuditSeverity, McsIsoTimestamp } from './types.js';

export type McsTenantSurface = 'com' | 'team' | 'admin' | 'system';

export const MCS_TENANT_SURFACES: readonly McsTenantSurface[] = [
  'com',
  'team',
  'admin',
  'system',
] as const;

export type McsTenantComplianceMode = 'fail_closed';

export type McsTenantRoleKey =
  | 'founder_admin'
  | 'leader'
  | 'brand_ambassador'
  | 'prospect'
  | 'system';

export interface McsTenantSettings {
  tenantId: string;
  tenantName: string;
  publicComDomain: string;
  teamDomain: string;
  adminDomain: string;
  complianceMode: McsTenantComplianceMode;
  contentInheritanceMode: 'code_default_master_override';
  updatedAt: McsIsoTimestamp | null;
  updatedBy: string | null;
}

export interface McsTenantSettingsVersion extends McsTenantSettings {
  settingsVersionId: string;
  version: number;
  reason: string;
  createdAt: McsIsoTimestamp;
}

export type McsTenantTemplateKey =
  | 'com.presentation.hero'
  | 'com.dashboard.callback_cta'
  // F.5 remaining .com dashboard sections (six locked sections; callback_cta
  // already covers Section 6's CTA, so these add Sections 1–5). TASK-147.
  | 'com.dashboard.arrival'
  | 'com.dashboard.opportunity'
  | 'com.dashboard.mechanic'
  | 'com.dashboard.live_place'
  | 'com.dashboard.advantage'
  | 'team.welcome.letter'
  | 'team.invitation.default_script'
  // F.5 fuller ScriptMaker invitation-seed library (was: only default_script).
  | 'team.invitation.product_anchored'
  | 'team.invitation.reconnect'
  | 'team.invitation.event_invite'
  // F.5 BA-facing training module copy.
  | 'team.training.fast_start_day1'
  | 'team.training.orientation_overview'
  // F.5 Michael training-support prompt scaffold (BA-facing sponsor context).
  | 'team.michael.training_support_prompt'
  // F.5 Ivory "who do you know" coach prompt library.
  | 'team.ivory.coach_prompt'
  | 'admin.broadcast.sms';

export interface McsTenantTemplateDefinition {
  templateKey: McsTenantTemplateKey;
  label: string;
  surface: McsTenantSurface;
  description: string;
  tokens: string[];
  defaultContent: string;
  editable: boolean;
}

export interface McsTenantTemplateVersion {
  templateVersionId: string;
  tenantId: string;
  templateKey: McsTenantTemplateKey;
  surface: McsTenantSurface;
  label: string;
  content: string;
  version: number;
  source: 'code_default' | 'master_override';
  createdAt: McsIsoTimestamp;
  createdBy: string | null;
  reason: string;
}

export type McsTenantPermissionKey =
  | 'admin.dashboard.view'
  | 'admin.audit.view'
  | 'admin.tenant.view'
  | 'admin.tenant.settings.write'
  | 'admin.tenant.templates.write'
  | 'admin.broadcast.send'
  | 'ba.invitation.create'
  | 'ba.crm.write'
  | 'prospect.page.view'
  | 'system.persistence.write';

export interface McsTenantRolePermission {
  permission: McsTenantPermissionKey;
  label: string;
  allowed: boolean;
}

export interface McsTenantRoleMatrixRow {
  role: McsTenantRoleKey;
  label: string;
  description: string;
  permissions: McsTenantRolePermission[];
}

export interface McsTenantInheritanceLayer {
  order: number;
  layer: string;
  owner: string;
  purpose: string;
  canOverride: boolean;
}

export interface McsTenantComplianceIssue {
  ruleId: string;
  severity: McsAuditSeverity;
  action: 'block' | 'warn' | 'log';
  message: string;
  matchedText: string | null;
}

export interface McsTenantComplianceValidation {
  ok: boolean;
  surface: McsTenantSurface;
  checkedAt: McsIsoTimestamp;
  issues: McsTenantComplianceIssue[];
}

export interface McsTenantOverview {
  settings: McsTenantSettings;
  templates: McsTenantTemplateVersion[];
  templateDefinitions: McsTenantTemplateDefinition[];
  roleMatrix: McsTenantRoleMatrixRow[];
  inheritance: McsTenantInheritanceLayer[];
  compliance: {
    mode: McsTenantComplianceMode;
    severityMapping: Array<{
      action: McsTenantComplianceIssue['action'];
      severity: McsAuditSeverity;
      meaning: string;
    }>;
  };
}

export interface McsTenantOverviewResponse {
  ok: true;
  overview: McsTenantOverview;
}

export interface McsUpdateTenantSettingsPayload {
  settings: Pick<
    McsTenantSettings,
    'tenantName' | 'publicComDomain' | 'teamDomain' | 'adminDomain'
  >;
  reason: string;
}

export interface McsUpdateTenantSettingsResponse {
  ok: true;
  settings: McsTenantSettings;
}

export interface McsSaveTenantTemplatePayload {
  content: string;
  reason: string;
}

export interface McsSaveTenantTemplateResponse {
  ok: true;
  template: McsTenantTemplateVersion;
  validation: McsTenantComplianceValidation;
}

export interface McsValidateTenantTemplatePayload {
  surface: McsTenantSurface;
  content: string;
}

export interface McsValidateTenantTemplateResponse {
  ok: true;
  validation: McsTenantComplianceValidation;
}
