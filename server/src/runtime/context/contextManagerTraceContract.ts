import type {
  McsApprovedKnowledgeQueryResult,
  McsContextManagerExecutionTraceV1,
  McsContextPacketV1,
} from '@momentum/shared/runtime';

export interface ContextManagerTraceValidationIssue { path: string; message: string }

export class ContextManagerTraceValidationError extends Error {
  constructor(public readonly issues: ContextManagerTraceValidationIssue[]) {
    super(`Invalid context_manager_trace.v1: ${issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
    this.name = 'ContextManagerTraceValidationError';
  }
}

export function validateContextManagerExecutionTraceV1(
  trace: unknown,
  linked?: { packet: McsContextPacketV1; retrieval: McsApprovedKnowledgeQueryResult },
): ContextManagerTraceValidationIssue[] {
  const issues: ContextManagerTraceValidationIssue[] = [];
  if (!isRecord(trace)) return [{ path: '$', message: 'must be an object' }];
  if (trace.schemaVersion !== 'context_manager_trace.v1') issues.push(issue('schemaVersion', 'must be context_manager_trace.v1'));
  for (const key of ['requestId', 'packetId', 'agentKey', 'taskType'] as const) if (!nonEmpty(trace[key])) issues.push(issue(key, 'must be a non-empty string'));
  if (!isRecord(trace.planner)) issues.push(issue('planner', 'must be an object'));
  if (!isRecord(trace.executor)) issues.push(issue('executor', 'must be an object'));
  if (!isRecord(trace.tracer)) issues.push(issue('tracer', 'must be an object'));
  const executor = isRecord(trace.executor) ? trace.executor : {};
  for (const key of ['approvedCount', 'candidateExcludedCount'] as const) if (!nonNegativeInteger(executor[key])) issues.push(issue(`executor.${key}`, 'must be a non-negative integer'));
  if (!stringArray(executor.degradeReasons)) issues.push(issue('executor.degradeReasons', 'must be a string array'));
  const tracer = isRecord(trace.tracer) ? trace.tracer : {};
  if (!['complete', 'degraded', 'failed'].includes(String(tracer.packetStatus))) issues.push(issue('tracer.packetStatus', 'must be complete, degraded, or failed'));
  for (const key of ['includedKnowledgeIds', 'excludedSourceIds', 'notes'] as const) if (!stringArray(tracer[key])) issues.push(issue(`tracer.${key}`, 'must be a string array'));
  if (linked) validateLinkage(trace, executor, tracer, linked, issues);
  return issues;
}

export function assertValidContextManagerExecutionTraceV1(
  trace: unknown,
  linked?: { packet: McsContextPacketV1; retrieval: McsApprovedKnowledgeQueryResult },
): asserts trace is McsContextManagerExecutionTraceV1 {
  const issues = validateContextManagerExecutionTraceV1(trace, linked);
  if (issues.length) throw new ContextManagerTraceValidationError(issues);
}

function validateLinkage(
  trace: Record<string, unknown>, executor: Record<string, unknown>, tracer: Record<string, unknown>,
  linked: { packet: McsContextPacketV1; retrieval: McsApprovedKnowledgeQueryResult }, issues: ContextManagerTraceValidationIssue[],
) {
  const { packet, retrieval } = linked;
  if (trace.requestId !== packet.requestId) issues.push(issue('requestId', 'must equal packet.requestId'));
  if (trace.packetId !== packet.packetId) issues.push(issue('packetId', 'must equal packet.packetId'));
  if (tracer.packetStatus !== packet.packetStatus) issues.push(issue('tracer.packetStatus', 'must equal packet.packetStatus'));
  if (executor.retrievalStatus !== retrieval.status) issues.push(issue('executor.retrievalStatus', 'must equal retrieval.status'));
  if (executor.approvedCount !== retrieval.metadata.approvedCount) issues.push(issue('executor.approvedCount', 'must equal retrieval approvedCount'));
  if (executor.candidateExcludedCount !== retrieval.metadata.candidateExcludedCount) issues.push(issue('executor.candidateExcludedCount', 'must equal retrieval candidateExcludedCount'));
  if (!sameStrings(tracer.includedKnowledgeIds, packet.retrievalAudit.includedKnowledgeIds.map(String))) issues.push(issue('tracer.includedKnowledgeIds', 'must equal packet retrieval audit'));
  if (!sameStrings(tracer.excludedSourceIds, packet.retrievalAudit.excludedSourceIds.map(String))) issues.push(issue('tracer.excludedSourceIds', 'must equal packet retrieval audit'));
  if (packet.requestId !== packet.retrievalAudit.requestId || packet.packetId !== packet.retrievalAudit.packetId) issues.push(issue('packet.retrievalAudit', 'identity must match packet'));
}

function issue(path: string, message: string) { return { path, message }; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function nonEmpty(value: unknown) { return typeof value === 'string' && value.trim().length > 0; }
function nonNegativeInteger(value: unknown) { return typeof value === 'number' && Number.isInteger(value) && value >= 0; }
function stringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === 'string'); }
function sameStrings(value: unknown, expected: readonly string[]) { return stringArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]); }
