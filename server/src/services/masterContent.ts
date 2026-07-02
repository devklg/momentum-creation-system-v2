/**
 * masterContent — the master-content READ PATH (TASK-147 keystone, F.5).
 *
 * Wave-2 consumers (.com renderers, ScriptMaker, Ivory, Michael) call this
 * INSTEAD of their hardcoded copy constants. It resolves a template's current
 * content through the master-content inheritance chain:
 *
 *   code default  →  master override (master_content_versions, latest version)
 *
 * Today (Wave 1) saved overrides land in `master_content_versions` but the
 * consumers still read code defaults, so a saved override is functionally
 * inert. This helper is the leg that makes inheritance *able* to inherit; the
 * actual consumer rewires are Wave 2 (inherit-com / inherit-scriptmaker /
 * inherit-ivory / inherit-michael). This file is the contract they bind to —
 * once it lands and freezes, Wave 2 can start.
 *
 * RESILIENCE CONTRACT: live consumer surfaces must never hard-fail on a
 * PERSISTENCE/Mongo hiccup. getTenantTemplate() already falls back to the code
 * default when no override exists, but it THROWS if the PERSISTENCE query itself
 * fails. This wrapper catches that and returns the code default, so a
 * master-content read degrades to the safe baseline shipped with the app
 * rather than 500ing the prospect page or the BA cockpit.
 */

import {
  getTenantTemplate,
  TENANT_TEMPLATE_DEFINITIONS,
} from '../domain/adminTenantArchitecture.js';
import type { McsTenantTemplateKey, McsTenantTemplateVersion } from '@momentum/shared';

const TENANT_ID = 'team-magnificent';

/**
 * The code-default version for a template — the safe baseline shipped with the
 * app. Returned when there is no master override OR when the PERSISTENCE read
 * fails. Mirrors the shape of a persisted TenantTemplateVersion so consumers
 * can treat both paths uniformly.
 */
function codeDefaultVersion(templateKey: McsTenantTemplateKey): McsTenantTemplateVersion {
  const def = TENANT_TEMPLATE_DEFINITIONS.find((t) => t.templateKey === templateKey);
  if (!def) throw new Error(`unknown_template_key: ${templateKey}`);
  return {
    templateVersionId: `code_default_${templateKey}`,
    tenantId: TENANT_ID,
    templateKey,
    surface: def.surface,
    label: def.label,
    content: def.defaultContent,
    version: 0,
    source: 'code_default',
    createdAt: '1970-01-01T00:00:00.000Z',
    createdBy: null,
    reason: 'Code default (no master override, or master-content read failed).',
  };
}

/**
 * Resolve the full current template version (master override if one exists and
 * the read succeeds, otherwise the code default). Use this when you need the
 * source/version/label for telemetry or audit; use readMasterContent() when
 * you only need the copy string.
 */
export async function readMasterTemplate(
  templateKey: McsTenantTemplateKey,
): Promise<McsTenantTemplateVersion> {
  try {
    return await getTenantTemplate(templateKey);
  } catch {
    return codeDefaultVersion(templateKey);
  }
}

/**
 * Resolve the current content string for a template through the inheritance
 * chain, with a guaranteed code-default fallback. This is the call Wave-2
 * consumers make in place of their hardcoded copy constants.
 */
export async function readMasterContent(
  templateKey: McsTenantTemplateKey,
): Promise<string> {
  return (await readMasterTemplate(templateKey)).content;
}

/**
 * Interpolate `{{token}}` placeholders with server-resolved values. Tokens with
 * no supplied (or empty/null) value are left intact rather than blanked, so a
 * partial value set never silently erases copy. Server-side only — values come
 * from the token-bound prospect/BA records per locked-spec 3.9.
 */
export function interpolateMasterContent(
  content: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key: string) => {
    const v = values[key];
    if (v == null || v === '') return whole;
    return String(v);
  });
}
