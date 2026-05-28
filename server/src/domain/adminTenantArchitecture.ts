/**
 * Admin Section F - Tenant Architecture.
 *
 * This is the master control plane for Team Magnificent's single-tenant v1:
 * tenant settings, master content templates, role/permission visibility, and
 * content inheritance. Master content writes validate compliance at save time
 * and fail closed for .com content per locked-spec 3.11.
 */

import { randomBytes } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  AuditActor,
  TenantComplianceIssue,
  TenantComplianceValidation,
  TenantInheritanceLayer,
  TenantOverview,
  TenantRoleMatrixRow,
  TenantSettings,
  TenantSettingsVersion,
  TenantSurface,
  TenantTemplateDefinition,
  TenantTemplateKey,
  TenantTemplateVersion,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const SETTINGS_COLLECTION = 'tenant_settings_versions';
const TEMPLATE_COLLECTION = 'master_content_versions';
const SETTINGS_CHROMA = 'mcs_tenant_settings';
const TEMPLATE_CHROMA = 'mcs_master_content';
const TENANT_ID = 'team-magnificent';

const DEFAULT_SETTINGS: TenantSettings = {
  tenantId: TENANT_ID,
  tenantName: 'Team Magnificent',
  publicComDomain: 'teammagnificent.com',
  teamDomain: 'teammagnificent.team',
  adminDomain: 'admin.teammagnificent.team',
  complianceMode: 'fail_closed',
  contentInheritanceMode: 'code_default_master_override',
  updatedAt: null,
  updatedBy: null,
};

export const TENANT_TEMPLATE_DEFINITIONS: readonly TenantTemplateDefinition[] = [
  {
    templateKey: 'com.presentation.hero',
    label: '.com presentation hero',
    surface: 'com',
    description:
      'Opening prospect-facing copy personalized to the prospect and inviting BA.',
    tokens: ['{{prospectFirstName}}', '{{baFirstName}}', '{{baFullName}}'],
    defaultContent:
      '{{prospectFirstName}}, {{baFullName}} invited you to see the Team Magnificent momentum forming around GLP-THREE.',
    editable: true,
  },
  {
    templateKey: 'com.dashboard.callback_cta',
    label: '.com dashboard callback CTA',
    surface: 'com',
    description:
      'Prospect dashboard action copy after the video completes and the holding-tank position is visible.',
    tokens: ['{{prospectFirstName}}', '{{baFirstName}}'],
    defaultContent:
      '{{prospectFirstName}}, choose the next step that fits. {{baFirstName}} will reach out.',
    editable: true,
  },
  {
    templateKey: 'team.welcome.letter',
    label: '.team welcome letter',
    surface: 'team',
    description:
      'BA-facing first-login orientation letter. This surface may mention THREE operationally.',
    tokens: ['{{baFirstName}}', '{{sponsorFirstName}}'],
    defaultContent:
      '{{baFirstName}}, welcome to Team Magnificent. Your first seven days are about product belief, clean invitations, and working with {{sponsorFirstName}}.',
    editable: true,
  },
  {
    templateKey: 'team.invitation.default_script',
    label: '.team invitation seed',
    surface: 'team',
    description:
      'BA-facing seed language for compliant, human-carried invitation drafts.',
    tokens: ['{{prospectFirstName}}', '{{productName}}'],
    defaultContent:
      'I thought of you when I saw the {{productName}} overview. Can I send you a quick page and get your honest feedback?',
    editable: true,
  },
  {
    templateKey: 'admin.broadcast.sms',
    label: 'Admin broadcast SMS seed',
    surface: 'admin',
    description:
      'Kevin-only starter copy for BA broadcasts. Broadcasts never target prospects.',
    tokens: ['{{firstName}}'],
    defaultContent:
      '{{firstName}}, Team Magnificent update: check your cockpit for today’s next best action.',
    editable: true,
  },
] as const;

export class TenantComplianceError extends Error {
  constructor(
    message: string,
    public readonly validation: TenantComplianceValidation,
  ) {
    super(message);
    this.name = 'TenantComplianceError';
  }
}

export async function getTenantOverview(): Promise<TenantOverview> {
  const [settings, templates] = await Promise.all([
    getTenantSettings(),
    listTenantTemplates(),
  ]);
  return {
    settings,
    templates,
    templateDefinitions: [...TENANT_TEMPLATE_DEFINITIONS],
    roleMatrix: buildRoleMatrix(),
    inheritance: buildInheritanceLayers(),
    compliance: {
      mode: 'fail_closed',
      severityMapping: [
        {
          action: 'block',
          severity: 'critical',
          meaning:
            'Noncompliant master content cannot be saved; .com never receives it.',
        },
        {
          action: 'warn',
          severity: 'warn',
          meaning:
            'Operational copy may save, but the warning is returned and audited.',
        },
        {
          action: 'log',
          severity: 'info',
          meaning:
            'Allowed content is logged only through the normal master-content audit entry.',
        },
      ],
    },
  };
}

export async function getTenantSettings(): Promise<TenantSettings> {
  const result = await gatewayCall<{ documents: TenantSettingsVersion[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: SETTINGS_COLLECTION,
      filter: { tenantId: TENANT_ID },
      sort: { version: -1, createdAt: -1 },
      limit: 1,
    },
  );
  const latest = result.documents[0];
  if (!latest) return DEFAULT_SETTINGS;
  return {
    tenantId: latest.tenantId,
    tenantName: latest.tenantName,
    publicComDomain: latest.publicComDomain,
    teamDomain: latest.teamDomain,
    adminDomain: latest.adminDomain,
    complianceMode: latest.complianceMode,
    contentInheritanceMode: latest.contentInheritanceMode,
    updatedAt: latest.updatedAt,
    updatedBy: latest.updatedBy,
  };
}

export async function saveTenantSettings(input: {
  settings: Pick<
    TenantSettings,
    'tenantName' | 'publicComDomain' | 'teamDomain' | 'adminDomain'
  >;
  actor: AuditActor & { kind: 'admin' };
  reason: string;
}): Promise<{ before: TenantSettings; after: TenantSettings; version: TenantSettingsVersion }> {
  const before = await getTenantSettings();
  const now = new Date().toISOString();
  const nextVersion = (await getLatestSettingsVersionNumber()) + 1;
  const after: TenantSettings = {
    ...before,
    tenantName: input.settings.tenantName.trim(),
    publicComDomain: normalizeDomain(input.settings.publicComDomain),
    teamDomain: normalizeDomain(input.settings.teamDomain),
    adminDomain: normalizeDomain(input.settings.adminDomain),
    complianceMode: 'fail_closed',
    contentInheritanceMode: 'code_default_master_override',
    updatedAt: now,
    updatedBy: input.actor.baId,
  };

  const version: TenantSettingsVersion = {
    ...after,
    settingsVersionId: `tenant_settings_${toIdPart(now)}_${randomBytes(3).toString('hex')}`,
    version: nextVersion,
    reason: input.reason,
    createdAt: now,
  };

  await tripleStackWrite({
    id: version.settingsVersionId,
    mongoCollection: SETTINGS_COLLECTION,
    mongoDoc: version as unknown as Record<string, unknown>,
    neo4j: {
      cypher: `
        MERGE (t:Tenant {tenantId: $tenantId})
        SET t.name = $tenantName,
            t.publicComDomain = $publicComDomain,
            t.teamDomain = $teamDomain,
            t.adminDomain = $adminDomain,
            t.updatedAt = datetime($updatedAt)
        MERGE (v:TenantSettingsVersion {settingsVersionId: $id})
        SET v.version = $version, v.createdAt = datetime($createdAt), v.reason = $reason
        MERGE (t)-[:HAS_SETTINGS_VERSION]->(v)
        RETURN v.settingsVersionId AS settingsVersionId
      `,
      params: version as unknown as Record<string, unknown>,
    },
    chroma: {
      collection: SETTINGS_CHROMA,
      document: `Tenant settings v${version.version}: ${after.tenantName} domains ${after.publicComDomain}, ${after.teamDomain}, ${after.adminDomain}. Reason: ${input.reason}`,
      metadata: {
        tenantId: TENANT_ID,
        version: version.version,
        updatedBy: input.actor.baId,
      },
    },
  });

  return { before, after, version };
}

export async function listTenantTemplates(): Promise<TenantTemplateVersion[]> {
  const out: TenantTemplateVersion[] = [];
  for (const def of TENANT_TEMPLATE_DEFINITIONS) {
    out.push(await getTenantTemplate(def.templateKey));
  }
  return out;
}

export async function getTenantTemplate(
  templateKey: TenantTemplateKey,
): Promise<TenantTemplateVersion> {
  const def = findTemplateDefinition(templateKey);
  const result = await gatewayCall<{ documents: TenantTemplateVersion[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: TEMPLATE_COLLECTION,
      filter: { tenantId: TENANT_ID, templateKey },
      sort: { version: -1, createdAt: -1 },
      limit: 1,
    },
  );
  const latest = result.documents[0];
  if (latest) return latest;
  return defaultTemplateVersion(def);
}

export async function saveTenantTemplate(input: {
  templateKey: TenantTemplateKey;
  content: string;
  actor: AuditActor & { kind: 'admin' };
  reason: string;
}): Promise<{
  before: TenantTemplateVersion;
  after: TenantTemplateVersion;
  validation: TenantComplianceValidation;
}> {
  const def = findTemplateDefinition(input.templateKey);
  if (!def.editable) {
    throw new Error(`template_not_editable: ${input.templateKey}`);
  }
  const content = input.content.trim();
  const validation = validateMasterContent(def.surface, content);
  if (!validation.ok) {
    throw new TenantComplianceError('Master content failed compliance validation.', validation);
  }

  const before = await getTenantTemplate(input.templateKey);
  const now = new Date().toISOString();
  const after: TenantTemplateVersion = {
    templateVersionId: `master_content_${sanitizeKey(input.templateKey)}_${toIdPart(now)}_${randomBytes(3).toString('hex')}`,
    tenantId: TENANT_ID,
    templateKey: input.templateKey,
    surface: def.surface,
    label: def.label,
    content,
    version: before.source === 'code_default' ? 1 : before.version + 1,
    source: 'master_override',
    createdAt: now,
    createdBy: input.actor.baId,
    reason: input.reason,
  };

  await tripleStackWrite({
    id: after.templateVersionId,
    mongoCollection: TEMPLATE_COLLECTION,
    mongoDoc: after as unknown as Record<string, unknown>,
    neo4j: {
      cypher: `
        MERGE (t:Tenant {tenantId: $tenantId})
        MERGE (m:MasterContent {templateKey: $templateKey})
        SET m.label = $label, m.surface = $surface
        MERGE (v:MasterContentVersion {templateVersionId: $id})
        SET v.version = $version,
            v.surface = $surface,
            v.createdAt = datetime($createdAt),
            v.createdBy = $createdBy,
            v.reason = $reason
        MERGE (t)-[:OWNS_MASTER_CONTENT]->(m)
        MERGE (m)-[:HAS_VERSION]->(v)
        RETURN v.templateVersionId AS templateVersionId
      `,
      params: after as unknown as Record<string, unknown>,
    },
    chroma: {
      collection: TEMPLATE_CHROMA,
      document: `${after.label} (${after.surface}) v${after.version}: ${after.content}`,
      metadata: {
        tenantId: TENANT_ID,
        templateKey: after.templateKey,
        surface: after.surface,
        version: after.version,
      },
    },
  });

  return { before, after, validation };
}

export function validateMasterContent(
  surface: TenantSurface,
  content: string,
): TenantComplianceValidation {
  const issues: TenantComplianceIssue[] = [];

  if (!content.trim()) {
    issues.push({
      ruleId: 'content.required',
      severity: 'critical',
      action: 'block',
      message: 'Master content cannot be blank.',
      matchedText: null,
    });
  }

  if (surface === 'com') {
    const blockRules: Array<{ ruleId: string; message: string; pattern: RegExp }> = [
      {
        ruleId: 'com.no_three_branding',
        message: 'Prospect-facing .com content cannot mention THREE International.',
        pattern: /\bthree(?:\s+international)?\b/i,
      },
      {
        ruleId: 'com.no_income_claims',
        message: 'Prospect-facing .com content cannot include income claims or earnings projections.',
        pattern: /\b(income|earnings?|commissions?|paycheck|checks?|six[-\s]?figure|seven[-\s]?figure|\$\s?\d+)/i,
      },
      {
        ruleId: 'com.no_comp_math',
        message: 'Prospect-facing .com content cannot include compensation, CV, cycle, volume, or rank math.',
        pattern: /\b(cv|commissionable volume|cycle|binary|rank|pay leg|power leg|300|600|900)\b/i,
      },
      {
        ruleId: 'com.no_placement_promises',
        message: 'Prospect-facing .com content cannot promise placement, spillover, or queue outcomes.',
        pattern: /\b(guarantee|guaranteed|spillover|placement promise|locked spot|binary position|leg position)\b/i,
      },
      {
        ruleId: 'com.no_ai_prospecting',
        message: 'Michael and AI prospecting cannot appear on prospect-facing .com content.',
        pattern: /\b(michael|ai prospecting|automated prospecting|voice agent)\b/i,
      },
    ];
    for (const rule of blockRules) {
      const match = content.match(rule.pattern);
      if (match) {
        issues.push({
          ruleId: rule.ruleId,
          severity: 'critical',
          action: 'block',
          message: rule.message,
          matchedText: match[0],
        });
      }
    }

  } else if (/\bguaranteed income|guaranteed earnings\b/i.test(content)) {
    issues.push({
      ruleId: 'team.warn.income_language',
      severity: 'warn',
      action: 'warn',
      message:
        'Operational content can be saved, but guaranteed-income wording should be revised.',
      matchedText: content.match(/\bguaranteed income|guaranteed earnings\b/i)?.[0] ?? null,
    });
  }

  const blocked = issues.some((i) => i.action === 'block');
  return {
    ok: !blocked,
    surface,
    checkedAt: new Date().toISOString(),
    issues,
  };
}

function findTemplateDefinition(templateKey: TenantTemplateKey): TenantTemplateDefinition {
  const def = TENANT_TEMPLATE_DEFINITIONS.find((t) => t.templateKey === templateKey);
  if (!def) throw new Error(`unknown_template_key: ${templateKey}`);
  return def;
}

async function getLatestSettingsVersionNumber(): Promise<number> {
  const result = await gatewayCall<{ documents: Array<{ version?: number }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: SETTINGS_COLLECTION,
      filter: { tenantId: TENANT_ID },
      sort: { version: -1, createdAt: -1 },
      limit: 1,
    },
  );
  return result.documents[0]?.version ?? 0;
}

function defaultTemplateVersion(def: TenantTemplateDefinition): TenantTemplateVersion {
  return {
    templateVersionId: `code_default_${def.templateKey}`,
    tenantId: TENANT_ID,
    templateKey: def.templateKey,
    surface: def.surface,
    label: def.label,
    content: def.defaultContent,
    version: 0,
    source: 'code_default',
    createdAt: '1970-01-01T00:00:00.000Z',
    createdBy: null,
    reason: 'Code default. No master override saved yet.',
  };
}

function buildInheritanceLayers(): TenantInheritanceLayer[] {
  return [
    {
      order: 1,
      layer: 'Code default',
      owner: 'Engineering deploy',
      purpose: 'Safe baseline shipped with the app.',
      canOverride: false,
    },
    {
      order: 2,
      layer: 'Master content',
      owner: 'Kevin-only admin',
      purpose: 'Tenant-wide copy and template overrides validated before save.',
      canOverride: true,
    },
    {
      order: 3,
      layer: 'Runtime interpolation',
      owner: 'Server render',
      purpose: 'Injects prospect, BA, product, and event values after token resolution.',
      canOverride: false,
    },
    {
      order: 4,
      layer: 'Compliance guard',
      owner: 'Platform',
      purpose: 'Blocks unsafe .com content before save or render.',
      canOverride: false,
    },
  ];
}

function buildRoleMatrix(): TenantRoleMatrixRow[] {
  const permissions: ReadonlyArray<{
    permission: TenantRoleMatrixRow['permissions'][number]['permission'];
    label: string;
  }> = [
    { permission: 'admin.dashboard.view', label: 'View admin dashboard' },
    { permission: 'admin.audit.view', label: 'View audit log' },
    { permission: 'admin.tenant.view', label: 'View tenant architecture' },
    { permission: 'admin.tenant.settings.write', label: 'Change tenant settings' },
    { permission: 'admin.tenant.templates.write', label: 'Save master content' },
    { permission: 'admin.broadcast.send', label: 'Send BA broadcasts' },
    { permission: 'ba.invitation.create', label: 'Create BA invitations' },
    { permission: 'ba.crm.write', label: 'Write BA CRM notes and follow-ups' },
    { permission: 'prospect.page.view', label: 'View prospect pages' },
    { permission: 'system.persistence.write', label: 'Write persistence records' },
  ] as const;

  const allow: Record<
    TenantRoleMatrixRow['role'],
    ReadonlyArray<TenantRoleMatrixRow['permissions'][number]['permission']>
  > = {
    founder_admin: permissions.map((p) => p.permission),
    leader: ['ba.invitation.create', 'ba.crm.write'],
    brand_ambassador: ['ba.invitation.create', 'ba.crm.write'],
    prospect: ['prospect.page.view'],
    system: ['system.persistence.write'],
  };

  const rows: Array<Omit<TenantRoleMatrixRow, 'permissions'>> = [
    {
      role: 'founder_admin',
      label: 'Founder admin',
      description: 'Kevin-only control plane for all admin surfaces.',
    },
    {
      role: 'leader',
      label: 'Leader',
      description: 'Operational BA/upline context without admin mutation rights.',
    },
    {
      role: 'brand_ambassador',
      label: 'Brand Ambassador',
      description: 'Own cockpit, invitations, CRM, profile, and training.',
    },
    {
      role: 'prospect',
      label: 'Prospect',
      description: 'Token-scoped .com presentation and dashboard only.',
    },
    {
      role: 'system',
      label: 'System',
      description: 'Workers, render guards, and persistence automations.',
    },
  ];

  return rows.map((row) => ({
    ...row,
    permissions: permissions.map(({ permission, label }) => ({
      permission,
      label,
      allowed: allow[row.role].includes(permission),
    })),
  }));
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
    .toLowerCase();
}

function toIdPart(iso: string): string {
  return iso.replace(/[-:.TZ]/g, '');
}

function sanitizeKey(key: string): string {
  return key.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}
