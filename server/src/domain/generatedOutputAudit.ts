import {
  MCS_AGENT_TEMPLATE_REGISTRY,
  type McsAuditContext,
  type McsTaxonomizedAuditLogEntry,
} from '@momentum/shared';
import { appendAuditEntry } from './auditLog.js';
import { scanGeneratedCopyCompliance } from './generatedCopyCompliance.js';

export type McsGeneratedOutputTemplateId =
  | 'ivory_wdyk_coach'
  | 'ivory_personal_invitation'
  | 'ivory_momentum_followup'
  | 'scriptmaker_product_invitation';

type GeneratedOutputInputAudit =
  | {
      classification: 'ivory_wdyk_coach';
      angle: 'do_the_business' | 'make_money' | 'lose_fat' | 'unspecified';
      rosterSize: number;
      productNameProvided: boolean;
      askProvided: boolean;
      askLength: number;
    }
  | {
      classification: 'ivory_personal_invitation';
      ivoryRecordProvided: true;
      relationshipReasonProvided: true;
      relationshipReasonLength: number;
      productNameProvided: boolean;
    }
  | {
      classification: 'ivory_momentum_followup';
      ownedProspectProvided: true;
      askProvided: boolean;
      askLength: number;
    }
  | {
      classification: 'scriptmaker_product_invitation';
      scriptKind: 'default_script' | 'product_anchored' | 'reconnect' | 'event_invite';
      productNameLength: number;
      videoTitleLength: number;
      prospectFirstNameLength: number;
      prospectContextProvided: boolean;
      prospectContextLength: number;
      eventDayProvided: boolean;
      eventTimeProvided: boolean;
    };

export interface McsAppendGeneratedOutputAuditInput {
  templateId: McsGeneratedOutputTemplateId;
  tmagId: string;
  input: GeneratedOutputInputAudit;
  output: string | readonly string[];
  degraded: boolean;
  context?: McsAuditContext | null;
}

export class GeneratedOutputComplianceAuditError extends Error {
  constructor(public readonly violationIds: readonly string[]) {
    super(`Generated output failed the audit compliance gate: ${violationIds.join(', ')}`);
    this.name = 'GeneratedOutputComplianceAuditError';
  }
}

const IVORY_ANGLES = new Set(['do_the_business', 'make_money', 'lose_fat', 'unspecified']);
const SCRIPT_KINDS = new Set(['default_script', 'product_anchored', 'reconnect', 'event_invite']);

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function sanitizeInputMetadata(input: GeneratedOutputInputAudit): Record<string, unknown> {
  switch (input.classification) {
    case 'ivory_wdyk_coach':
      return {
        classification: input.classification,
        angle: IVORY_ANGLES.has(input.angle) ? input.angle : 'unspecified',
        rosterSize: safeCount(input.rosterSize),
        productNameProvided: Boolean(input.productNameProvided),
        askProvided: Boolean(input.askProvided),
        askLength: safeCount(input.askLength),
      };
    case 'ivory_personal_invitation':
      return {
        classification: input.classification,
        ivoryRecordProvided: true,
        relationshipReasonProvided: true,
        relationshipReasonLength: safeCount(input.relationshipReasonLength),
        productNameProvided: Boolean(input.productNameProvided),
      };
    case 'ivory_momentum_followup':
      return {
        classification: input.classification,
        ownedProspectProvided: true,
        askProvided: Boolean(input.askProvided),
        askLength: safeCount(input.askLength),
      };
    case 'scriptmaker_product_invitation':
      return {
        classification: input.classification,
        scriptKind: SCRIPT_KINDS.has(input.scriptKind) ? input.scriptKind : 'product_anchored',
        productNameLength: safeCount(input.productNameLength),
        videoTitleLength: safeCount(input.videoTitleLength),
        prospectFirstNameLength: safeCount(input.prospectFirstNameLength),
        prospectContextProvided: Boolean(input.prospectContextProvided),
        prospectContextLength: safeCount(input.prospectContextLength),
        eventDayProvided: Boolean(input.eventDayProvided),
        eventTimeProvided: Boolean(input.eventTimeProvided),
      };
  }
}

function activeTemplate(templateId: McsGeneratedOutputTemplateId) {
  const template = MCS_AGENT_TEMPLATE_REGISTRY.find(
    (entry) => entry.templateId === templateId && entry.status === 'active',
  );
  if (!template || template.approval.state !== 'approved') {
    throw new Error(`Generated output template is not approved and active: ${templateId}`);
  }
  return template;
}

/**
 * Append one privacy-minimal audit row for copy that is about to be returned to
 * an authenticated BA. Raw input text and generated output are deliberately not
 * persisted: the row records input classification/presence/length metadata and
 * independently recomputes the delivered-output compliance result.
 */
export async function appendGeneratedOutputAudit(
  input: McsAppendGeneratedOutputAuditInput,
): Promise<McsTaxonomizedAuditLogEntry> {
  const template = activeTemplate(input.templateId);
  const segments = (Array.isArray(input.output) ? input.output : [input.output]) as readonly string[];
  const characterCount = segments.reduce((total, value) => total + value.length, 0);
  const complianceScan = scanGeneratedCopyCompliance(segments);
  const violationIds: string[] = complianceScan.violations.map((violation) => violation.id);
  if (characterCount === 0) violationIds.push('empty_output');
  const complianceOk = complianceScan.ok && characterCount > 0;
  const safeInput = sanitizeInputMetadata(input.input);

  const entry = await appendAuditEntry({
    actor: { kind: 'ba', tmagId: input.tmagId, displayName: 'Authenticated BA' },
    action: complianceOk ? 'prompt.output.generated' : 'prompt.output.rejected',
    entity: {
      kind: 'compliance_rule',
      id: `${template.templateId}@${template.version}`,
      displayLabel: template.templateId,
    },
    severity: complianceOk ? 'info' : 'critical',
    after: {
      schemaVersion: 1,
      prompt: {
        templateId: template.templateId,
        version: template.version,
        ownerAgentKey: template.ownerAgentKey,
        behaviorSource: template.behaviorSource,
      },
      input: {
        ...safeInput,
        privacy: 'metadata_only',
        rawInputStored: false,
      },
      user: { tmagId: input.tmagId },
      output: {
        source: input.degraded ? 'deterministic_fallback' : 'provider',
        degraded: input.degraded,
        segmentCount: segments.length,
        characterCount,
        contentStored: false,
      },
      compliance: {
        scanner: 'generated_copy_compliance_v1',
        ok: complianceOk,
        violationIds,
      },
    },
    reason: complianceOk ? null : `Generated output rejected: ${violationIds.join(', ')}`,
    context: input.context ?? null,
  });

  if (!complianceOk) throw new GeneratedOutputComplianceAuditError(violationIds);
  return entry;
}
