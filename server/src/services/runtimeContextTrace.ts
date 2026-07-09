import { randomUUID } from 'node:crypto';
import type {
  McsAgentKey,
  McsContextPacketV1,
  McsKnowledgeId,
  McsRuntimeTaskType,
  McsSourceId,
  TmagId,
} from '@momentum/shared/runtime';
import { tripleStackWrite } from './tripleStack.js';
import { persistenceCall } from './persistence/dispatch.js';
import { env } from '../env.js';

export const RUNTIME_CONTEXT_TRACE_COLLECTION = 'mcs_runtime_context_traces';
export const RUNTIME_CONTEXT_TRACE_CHROMA_COLLECTION = 'mcs_runtime_context_traces';
export const RUNTIME_CONTEXT_TRACE_SCHEMA_VERSION = 'runtime_context_trace.v1' as const;

export interface RuntimeContextTraceRecord {
  _id?: string;
  traceId: string;
  schemaVersion: typeof RUNTIME_CONTEXT_TRACE_SCHEMA_VERSION;
  agentKey: McsAgentKey;
  taskType: McsRuntimeTaskType;
  runtimeSurface: 'michael-runtime' | 'steve-discovery';
  tmagId: TmagId | string;
  contextPacketId: string | null;
  contextRequestId: string | null;
  packetStatus: McsContextPacketV1['packetStatus'] | 'missing';
  approvedKnowledgeCount: number;
  approvedKnowledgeIds: string[];
  approvedSourceIds: string[];
  excludedSourceIds: string[];
  candidateKnowledgeExcluded: boolean;
  retrievalMethods: string[];
  queryHint: string;
  routeDecision?: string;
  catalogKey?: string;
  responseType?: string;
  createdAt: string;
}

export interface AppendRuntimeContextTraceInput {
  agentKey: McsAgentKey;
  taskType: McsRuntimeTaskType;
  runtimeSurface: RuntimeContextTraceRecord['runtimeSurface'];
  tmagId: TmagId | string;
  packet: McsContextPacketV1 | null | undefined;
  queryHint?: string;
  routeDecision?: string;
  catalogKey?: string;
  responseType?: string;
  createdAt?: string;
}

interface MongoTraceQueryResult {
  documents?: RuntimeContextTraceRecord[];
}

export async function appendRuntimeContextTrace(
  input: AppendRuntimeContextTraceInput,
): Promise<RuntimeContextTraceRecord> {
  const traceId = `ctx_trace_${randomUUID()}`;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const packet = input.packet ?? null;
  const approvedKnowledge = packet?.approvedKnowledge ?? [];
  const approvedKnowledgeIds = approvedKnowledge
    .map((item) => String(item.knowledgeId))
    .filter(Boolean);
  const approvedSourceIds = approvedKnowledge
    .map((item) => String(item.sourceTraceability?.sourceId ?? ''))
    .filter(Boolean);
  const excludedSourceIds = (packet?.retrievalAudit.excludedSourceIds ?? [])
    .map((id) => String(id))
    .filter(Boolean);

  const record: RuntimeContextTraceRecord = {
    traceId,
    schemaVersion: RUNTIME_CONTEXT_TRACE_SCHEMA_VERSION,
    agentKey: input.agentKey,
    taskType: input.taskType,
    runtimeSurface: input.runtimeSurface,
    tmagId: input.tmagId,
    contextPacketId: packet ? String(packet.packetId) : null,
    contextRequestId: packet ? String(packet.requestId) : null,
    packetStatus: packet?.packetStatus ?? 'missing',
    approvedKnowledgeCount: approvedKnowledgeIds.length,
    approvedKnowledgeIds,
    approvedSourceIds,
    excludedSourceIds,
    candidateKnowledgeExcluded: packet?.retrievalAudit.candidateKnowledgeExcluded ?? true,
    retrievalMethods: (packet?.retrievalAudit.retrievalMethods ?? []).map(String),
    queryHint: sanitizeQueryHint(input.queryHint),
    ...(input.routeDecision ? { routeDecision: input.routeDecision } : {}),
    ...(input.catalogKey ? { catalogKey: input.catalogKey } : {}),
    ...(input.responseType ? { responseType: input.responseType } : {}),
    createdAt,
  };

  await withTraceWriteTimeout(tripleStackWrite({
    id: traceId,
    mongoCollection: RUNTIME_CONTEXT_TRACE_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher: [
        'MERGE (t:RuntimeContextTrace {id:$id})',
        'SET t += $props',
        'WITH t',
        'UNWIND $knowledgeIds AS kid',
        'MERGE (k:KnowledgeReference {id:kid})',
        'MERGE (t)-[:USED_KNOWLEDGE]->(k)',
        'WITH DISTINCT t',
        'UNWIND $sourceIds AS sid',
        'OPTIONAL MATCH (s:KnowledgeSource {id:sid})',
        'FOREACH (_ IN CASE WHEN s IS NULL THEN [] ELSE [1] END | MERGE (t)-[:USED_SOURCE]->(s))',
      ].join(' '),
      params: {
        props: {
          traceId,
          schemaVersion: record.schemaVersion,
          agentKey: record.agentKey,
          taskType: record.taskType,
          runtimeSurface: record.runtimeSurface,
          tmagId: record.tmagId,
          contextPacketId: record.contextPacketId,
          contextRequestId: record.contextRequestId,
          packetStatus: record.packetStatus,
          approvedKnowledgeCount: record.approvedKnowledgeCount,
          candidateKnowledgeExcluded: record.candidateKnowledgeExcluded,
          routeDecision: record.routeDecision ?? null,
          catalogKey: record.catalogKey ?? null,
          responseType: record.responseType ?? null,
          createdAt: record.createdAt,
        },
        knowledgeIds: approvedKnowledgeIds,
        sourceIds: approvedSourceIds,
      },
    },
    chroma: {
      collection: RUNTIME_CONTEXT_TRACE_CHROMA_COLLECTION,
      document: [
        record.runtimeSurface,
        record.agentKey,
        record.taskType,
        `packet:${record.packetStatus}`,
        `approved:${record.approvedKnowledgeCount}`,
        record.queryHint,
      ].filter(Boolean).join(' '),
      metadata: {
        kind: 'runtime_context_trace',
        traceId,
        agentKey: record.agentKey,
        taskType: record.taskType,
        runtimeSurface: record.runtimeSurface,
        packetStatus: record.packetStatus,
        approvedKnowledgeCount: record.approvedKnowledgeCount,
        approvedKnowledgeIds: record.approvedKnowledgeIds.join('|'),
        approvedSourceIds: record.approvedSourceIds.join('|'),
        createdAt: record.createdAt,
      },
    },
  }));

  return record;
}

export async function listRuntimeContextTraces(
  options: { limit?: number; agentKey?: McsAgentKey } = {},
): Promise<RuntimeContextTraceRecord[]> {
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 10)));
  const filter: Record<string, unknown> = {
    schemaVersion: RUNTIME_CONTEXT_TRACE_SCHEMA_VERSION,
  };
  if (options.agentKey) filter.agentKey = options.agentKey;

  const result = await persistenceCall<MongoTraceQueryResult>('mongodb', 'query', {
    database: 'momentum',
    collection: RUNTIME_CONTEXT_TRACE_COLLECTION,
    filter,
    sort: { createdAt: -1 },
    limit,
  });

  return result.documents ?? [];
}

export function packetFromMichaelAdapterInput(input: {
  runtimeTurn: {
    result: unknown;
  };
}): McsContextPacketV1 | null {
  const result = input.runtimeTurn.result;
  if (!isRecord(result)) return null;
  if (result.decision !== 'proceed' && result.decision !== 'degraded') return null;
  if (!isRecord(result.consumption)) return null;
  const packet = result.consumption.packet;
  return isRecord(packet) ? packet as unknown as McsContextPacketV1 : null;
}

function sanitizeQueryHint(value: string | undefined): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function withTraceWriteTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeoutMs = env.RUNTIME_CONTEXT_TRACE_WRITE_TIMEOUT_MS;
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`runtime context trace write timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type RuntimeContextKnowledgeId = McsKnowledgeId;
export type RuntimeContextSourceId = McsSourceId;
