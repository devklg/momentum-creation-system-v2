import type { AuditSeverity, IsoTimestamp } from './types.js';

export type TenantSurface = 'com' | 'team' | 'admin' | 'system';

export const TENANT_SURFACES: readonly TenantSurface[] = [
  'com',
  'team',
  'admin',
  'system',
] as const;

export type TenantComplianceMode = 'fail_closed';

export type TenantRoleKey =
  | 'founder_admin'
  | 'leader'
  | 'brand_ambassador'
  | 'prospect'
  | 'system';

export interface TenantSettings {
  tenantId: string;
  tenantName: string;
  publicComDomain: string;
  teamDomain: string;
  adminDomain: string;
  complianceMode: TenantComplianceMode;
  contentInheritanceMode: 'code_default_master_override';
  updatedAt: IsoTimestamp | null;
  updatedBy: string | null;
}

export interface TenantSettingsVersion extends TenantSettings {
  settingsVersionId: string;
  version: number;
  reason: string;
  createdAt: IsoTimestamp;
}

export type TenantTemplateKey =
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

export interface TenantTemplateDefinition {
  templateKey: TenantTemplateKey;
  label: string;
  surface: TenantSurface;
  description: string;
  tokens: string[];
  defaultContent: string;
  editable: boolean;
}

export interface TenantTemplateVersion {
  templateVersionId: string;
  tenantId: string;
  templateKey: TenantTemplateKey;
  surface: TenantSurface;
  label: string;
  content: string;
  version: number;
  source: 'code_default' | 'master_override';
  createdAt: IsoTimestamp;
  createdBy: string | null;
  reason: string;
}

export type TenantPermissionKey =
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

export interface TenantRolePermission {
  permission: TenantPermissionKey;
  label: string;
  allowed: boolean;
}

export interface TenantRoleMatrixRow {
  role: TenantRoleKey;
  label: string;
  description: string;
  permissions: TenantRolePermission[];
}

export interface TenantInheritanceLayer {
  order: number;
  layer: string;
  owner: string;
  purpose: string;
  canOverride: boolean;
}

export interface TenantComplianceIssue {
  ruleId: string;
  severity: AuditSeverity;
  action: 'block' | 'warn' | 'log';
  message: string;
  matchedText: string | null;
}

export interface TenantComplianceValidation {
  ok: boolean;
  surface: TenantSurface;
  checkedAt: IsoTimestamp;
  issues: TenantComplianceIssue[];
}

export interface TenantOverview {
  settings: TenantSettings;
  templates: TenantTemplateVersion[];
  templateDefinitions: TenantTemplateDefinition[];
  roleMatrix: TenantRoleMatrixRow[];
  inheritance: TenantInheritanceLayer[];
  compliance: {
    mode: TenantComplianceMode;
    severityMapping: Array<{
      action: TenantComplianceIssue['action'];
      severity: AuditSeverity;
      meaning: string;
    }>;
  };
}

export interface TenantOverviewResponse {
  ok: true;
  overview: TenantOverview;
}

export interface UpdateTenantSettingsPayload {
  settings: Pick<
    TenantSettings,
    'tenantName' | 'publicComDomain' | 'teamDomain' | 'adminDomain'
  >;
  reason: string;
}

export interface UpdateTenantSettingsResponse {
  ok: true;
  settings: TenantSettings;
}

export interface SaveTenantTemplatePayload {
  content: string;
  reason: string;
}

export interface SaveTenantTemplateResponse {
  ok: true;
  template: TenantTemplateVersion;
  validation: TenantComplianceValidation;
}

export interface ValidateTenantTemplatePayload {
  surface: TenantSurface;
  content: string;
}

export interface ValidateTenantTemplateResponse {
  ok: true;
  validation: TenantComplianceValidation;
}
