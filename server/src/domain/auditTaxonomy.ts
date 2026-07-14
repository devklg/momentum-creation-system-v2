import type { McsAuditEventTaxonomy, McsAuditSeverity } from '@momentum/shared';

const READ_WORDS = /(?:viewed|read|lookup|overview|summary|stream\.opened|generated)$/;
const DESTRUCTIVE_WORDS = /(?:delete|deleted|manual_flush|flush_expired|force_enroll|reassigned|override)$/;
const SECURITY_WORDS = /(?:entitlement|gate|denied|blocked|approval|ownership_correction|sponsor\.override)/;
const DELIVERY_WORDS = /(?:delivery|broadcast|webhook|inbound|queue|import)/;
const CREATE_WORDS = /(?:create|created|scheduled|set|appended|added)$/;
const UPDATE_WORDS = /(?:edit|edited|changed|rescheduled|reordered|restore|restored|cleared|reconciled|reassigned|approved|revoked)$/;

export function classifyAuditAction(action: string, severity: McsAuditSeverity): McsAuditEventTaxonomy {
  const normalized = action.trim().toLowerCase();
  const namespace = normalized.split('.')[0] || 'unknown';
  const destructive = DESTRUCTIVE_WORDS.test(normalized);
  const security = SECURITY_WORDS.test(normalized);
  let category: McsAuditEventTaxonomy['category'] = 'unknown';
  if (normalized.startsWith('runtime.') || normalized.startsWith('prompt.')) category = 'runtime';
  else if (security) category = 'security';
  else if (READ_WORDS.test(normalized)) category = 'read';
  else if (normalized.includes('report') || normalized.includes('export') || normalized.includes('metrics')) category = 'reporting';
  else if (DELIVERY_WORDS.test(normalized)) category = 'delivery';
  else if (destructive) category = 'delete';
  else if (CREATE_WORDS.test(normalized)) category = 'create';
  else if (UPDATE_WORDS.test(normalized)) category = 'update';
  else if (normalized.includes('status') || normalized.includes('completed') || normalized.includes('closed')) category = 'lifecycle';
  else if (namespace === 'admin' || namespace === 'system') category = 'governance';

  const outcome: McsAuditEventTaxonomy['outcome'] = normalized.includes('blocked') || normalized.includes('denied') || normalized.includes('refused') || normalized.includes('rejected')
    ? 'blocked' : normalized.includes('failed') || normalized.includes('dead_lettered') ? 'failed'
      : normalized.includes('queued') || normalized.includes('retry_scheduled') ? 'queued' : 'succeeded';
  const impact: McsAuditEventTaxonomy['impact'] = destructive ? 'destructive' : security || category === 'governance' ? 'control' : category === 'read' || category === 'reporting' ? 'observation' : 'mutation';
  const sensitivity: McsAuditEventTaxonomy['sensitivity'] = severity === 'critical' || destructive ? 'governance_critical' : security || category === 'delivery' ? 'sensitive' : 'routine';
  return { version: 1, namespace, category, operation: normalized.split('.').slice(1).join('.') || normalized, impact, outcome, sensitivity, reasonRequired: sensitivity === 'governance_critical' };
}
