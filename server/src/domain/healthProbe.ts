import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tripleStackWrite, type TripleStackInput } from '../services/tripleStack.js';
import { persistenceCall } from '../services/persistence/dispatch.js';

const MONGO_DB = 'momentum';
const HEALTH_MONGO_COLLECTION = 'tmag_health_heartbeat';
const HEALTH_CHROMA_COLLECTION = 'mcs_health_heartbeat';
const BROADCASTS_COLLECTION = 'broadcasts';
const BROADCAST_RECIPIENTS_COLLECTION = 'broadcast_recipients';
const BROADCAST_CHROMA_COLLECTION = 'mcs_broadcasts';
const HEALTH_ALERT_PHONE = '+13233519758';
const MAX_ALERT_BODY_CHARS = 520;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type HealthOverall = 'green' | 'red';

export interface HealthStatusCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface HealthStatusFile {
  checkedAt: string;
  overall: HealthOverall;
  checks: HealthStatusCheck[];
}

export interface TripleStackLegs {
  mongo: boolean;
  neo4j: boolean;
  chroma: boolean;
}

export interface TripleStackProbeResult {
  ok: boolean;
  checkedAt: string;
  heartbeatId: string;
  legs: TripleStackLegs;
  legDetails: Record<keyof TripleStackLegs, string>;
}

type Persistence = typeof persistenceCall;
type TripleWrite = typeof tripleStackWrite;

export interface TripleStackProbeDeps {
  now?: () => Date;
  id?: () => string;
  write?: TripleWrite;
  persistence?: Persistence;
}

export async function runTripleStackHealthProbe(
  deps: TripleStackProbeDeps = {},
): Promise<TripleStackProbeResult> {
  const now = deps.now?.() ?? new Date();
  const checkedAt = now.toISOString();
  const checkedAtEpochMs = now.getTime();
  const heartbeatId = deps.id?.() ?? `health_${checkedAt.replace(/[^0-9]/g, '')}_${randomUUID()}`;
  const write = deps.write ?? tripleStackWrite;
  const persistence = deps.persistence ?? persistenceCall;
  const legs: TripleStackLegs = { mongo: false, neo4j: false, chroma: false };
  const legDetails: Record<keyof TripleStackLegs, string> = {
    mongo: 'not_checked',
    neo4j: 'not_checked',
    chroma: 'not_checked',
  };

  const heartbeat = {
    heartbeatId,
    checkedAt,
    checkedAtEpochMs,
    source: 'production_health_probe',
  };

  try {
    await write({
      id: heartbeatId,
      mongoCollection: HEALTH_MONGO_COLLECTION,
      mongoDoc: { ...heartbeat },
      neo4j: {
        cypher:
          'MERGE (h:TmagHealthHeartbeat {heartbeatId: $heartbeatId}) ' +
          'SET h.checkedAt = $checkedAt, h.checkedAtEpochMs = $checkedAtEpochMs, h.source = $source',
        params: heartbeat,
      },
      chroma: {
        collection: HEALTH_CHROMA_COLLECTION,
        document: `MCS production health heartbeat ${heartbeatId} checked at ${checkedAt}`,
        metadata: {
          ...heartbeat,
          kind: 'health_heartbeat',
        },
      },
    });
  } catch (err) {
    const failedLeg = classifyPersistenceLeg(err);
    if (failedLeg) {
      legDetails[failedLeg] = err instanceof Error ? err.message : String(err);
    } else {
      legDetails.mongo = legDetails.neo4j = legDetails.chroma =
        err instanceof Error ? err.message : String(err);
    }
    return { ok: false, checkedAt, heartbeatId, legs, legDetails };
  }

  const cutoffMs = checkedAtEpochMs - SEVEN_DAYS_MS;
  const readChecks = await Promise.allSettled([
    readMongoHeartbeat(persistence, heartbeatId),
    readNeo4jHeartbeat(persistence, heartbeatId),
    readChromaHeartbeat(persistence, heartbeatId),
  ]);
  applySettledLeg(readChecks[0], 'mongo', legs, legDetails, 'readback_ok');
  applySettledLeg(readChecks[1], 'neo4j', legs, legDetails, 'readback_ok');
  applySettledLeg(readChecks[2], 'chroma', legs, legDetails, 'readback_ok');

  const pruneChecks = await Promise.allSettled([
    pruneMongoHeartbeats(persistence, cutoffMs),
    pruneNeo4jHeartbeats(persistence, cutoffMs),
    pruneChromaHeartbeats(persistence, cutoffMs),
  ]);
  applyPruneResult(pruneChecks[0], 'mongo', legs, legDetails);
  applyPruneResult(pruneChecks[1], 'neo4j', legs, legDetails);
  applyPruneResult(pruneChecks[2], 'chroma', legs, legDetails);

  return {
    ok: legs.mongo && legs.neo4j && legs.chroma,
    checkedAt,
    heartbeatId,
    legs,
    legDetails,
  };
}

function classifyPersistenceLeg(err: unknown): keyof TripleStackLegs | null {
  const message = err instanceof Error ? err.message : String(err);
  if (/mongodb|mongo/i.test(message)) return 'mongo';
  if (/neo4j/i.test(message)) return 'neo4j';
  if (/chromadb|chroma/i.test(message)) return 'chroma';
  return null;
}

async function readMongoHeartbeat(persistence: Persistence, heartbeatId: string): Promise<boolean> {
  const result = await persistence<{ count?: number; documents?: unknown[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: HEALTH_MONGO_COLLECTION,
    filter: { _id: heartbeatId },
    limit: 1,
  });
  return (result.count ?? result.documents?.length ?? 0) > 0;
}

async function readNeo4jHeartbeat(persistence: Persistence, heartbeatId: string): Promise<boolean> {
  const result = await persistence<{ records?: unknown[] }>('neo4j', 'cypher', {
    query: 'MATCH (h:TmagHealthHeartbeat {heartbeatId: $heartbeatId}) RETURN h LIMIT 1',
    params: { heartbeatId },
  });
  return (result.records ?? []).length > 0;
}

async function readChromaHeartbeat(persistence: Persistence, heartbeatId: string): Promise<boolean> {
  const result = await persistence<{
    results?: { ids?: string[]; metadatas?: Array<Record<string, unknown> | null> };
  }>('chromadb', 'query_with_filter', {
    collection: HEALTH_CHROMA_COLLECTION,
    query: `health heartbeat ${heartbeatId}`,
    n_results: 1,
    where: { healthHeartbeatId: heartbeatId },
  });
  const ids = result.results?.ids ?? [];
  if (ids.includes(heartbeatId)) return true;
  return (result.results?.metadatas ?? []).some((m) => m?.healthHeartbeatId === heartbeatId);
}

async function pruneMongoHeartbeats(persistence: Persistence, cutoffMs: number): Promise<boolean> {
  await persistence('mongodb', 'delete', {
    database: MONGO_DB,
    collection: HEALTH_MONGO_COLLECTION,
    filter: { checkedAtEpochMs: { $lt: cutoffMs } },
  });
  return true;
}

async function pruneNeo4jHeartbeats(persistence: Persistence, cutoffMs: number): Promise<boolean> {
  await persistence('neo4j', 'cypher', {
    query:
      'MATCH (h:TmagHealthHeartbeat) ' +
      'WHERE h.checkedAtEpochMs < $cutoffMs ' +
      'DETACH DELETE h',
    params: { cutoffMs },
  });
  return true;
}

async function pruneChromaHeartbeats(persistence: Persistence, cutoffMs: number): Promise<boolean> {
  await persistence('chromadb', 'delete', {
    collection: HEALTH_CHROMA_COLLECTION,
    where: { checkedAtEpochMs: { $lt: cutoffMs } },
  });
  return true;
}

function applySettledLeg(
  result: PromiseSettledResult<boolean>,
  leg: keyof TripleStackLegs,
  legs: TripleStackLegs,
  details: Record<keyof TripleStackLegs, string>,
  okDetail: string,
): void {
  if (result.status === 'fulfilled' && result.value) {
    legs[leg] = true;
    details[leg] = okDetail;
    return;
  }
  legs[leg] = false;
  details[leg] =
    result.status === 'rejected'
      ? result.reason instanceof Error
        ? result.reason.message
        : String(result.reason)
      : 'readback_missing';
}

function applyPruneResult(
  result: PromiseSettledResult<boolean>,
  leg: keyof TripleStackLegs,
  legs: TripleStackLegs,
  details: Record<keyof TripleStackLegs, string>,
): void {
  if (result.status === 'fulfilled' && result.value) return;
  legs[leg] = false;
  details[leg] =
    result.status === 'rejected'
      ? `prune_failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
      : 'prune_failed';
}

export async function readHealthStatusFile(
  filePath: string,
  reader: Pick<typeof fs, 'readFile'> = fs,
): Promise<{ ok: boolean; status: HealthStatusFile | null; error: string | null }> {
  try {
    const raw = await reader.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const status = parseHealthStatus(parsed);
    return { ok: true, status, error: null };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function parseHealthStatus(value: unknown): HealthStatusFile {
  if (!value || typeof value !== 'object') throw new Error('health status must be an object');
  const v = value as Record<string, unknown>;
  if (typeof v.checkedAt !== 'string') throw new Error('health status missing checkedAt');
  if (v.overall !== 'green' && v.overall !== 'red') {
    throw new Error('health status overall must be green or red');
  }
  if (!Array.isArray(v.checks)) throw new Error('health status checks must be an array');
  const checks = v.checks.map((c) => {
    if (!c || typeof c !== 'object') throw new Error('health check must be an object');
    const row = c as Record<string, unknown>;
    if (typeof row.name !== 'string') throw new Error('health check missing name');
    if (typeof row.ok !== 'boolean') throw new Error('health check missing ok');
    return {
      name: row.name,
      ok: row.ok,
      detail: typeof row.detail === 'string' ? row.detail : '',
    };
  });
  return { checkedAt: v.checkedAt, overall: v.overall, checks };
}

export interface HealthAlertDeps {
  readFile?: typeof fs.readFile;
  writeFile?: typeof fs.writeFile;
  mkdir?: typeof fs.mkdir;
  now?: () => Date;
  id?: () => string;
  write?: TripleWrite;
  persistence?: Persistence;
}

export async function handleHealthStatusTransition(
  status: HealthStatusFile,
  stateFilePath: string,
  deps: HealthAlertDeps = {},
): Promise<{ alertQueued: boolean; reason: string; previousOverall: HealthOverall | null }> {
  const readFile = deps.readFile ?? fs.readFile;
  const writeFile = deps.writeFile ?? fs.writeFile;
  const mkdir = deps.mkdir ?? fs.mkdir;
  let previousOverall: HealthOverall | null = null;

  try {
    const raw = await readFile(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as { lastOverall?: unknown };
    if (parsed.lastOverall === 'green' || parsed.lastOverall === 'red') {
      previousOverall = parsed.lastOverall;
    }
  } catch {
    previousOverall = null;
  }

  let alertQueued = false;
  let reason = 'no_transition';
  if (previousOverall === 'green' && status.overall === 'red') {
    await enqueueHealthRedAlert(status, deps);
    alertQueued = true;
    reason = 'green_to_red';
  }

  await mkdir(path.dirname(stateFilePath), { recursive: true });
  await writeFile(
    stateFilePath,
    JSON.stringify(
      {
        lastOverall: status.overall,
        lastCheckedAt: status.checkedAt,
        lastTransitionAlertAt: alertQueued ? (deps.now?.() ?? new Date()).toISOString() : null,
      },
      null,
      2,
    ),
    'utf8',
  );

  return { alertQueued, reason, previousOverall };
}

export async function enqueueHealthRedAlert(
  status: HealthStatusFile,
  deps: HealthAlertDeps = {},
): Promise<{ broadcastId: string; rowId: string }> {
  const write = deps.write ?? tripleStackWrite;
  const persistence = deps.persistence ?? persistenceCall;
  const now = deps.now?.() ?? new Date();
  const createdAt = now.toISOString();
  const id = deps.id?.() ?? randomUUID();
  const broadcastId = `health_alert_${id}`;
  const rowId = `${broadcastId}::kevin`;
  const smsRendered = buildHealthAlertText(status);

  await write({
    id: broadcastId,
    mongoCollection: BROADCASTS_COLLECTION,
    mongoDoc: {
      broadcastId,
      createdByTmagId: 'system',
      createdByDisplayName: 'MCS health probe',
      createdAt,
      isTestSend: false,
      audiencePreset: 'custom',
      customAudienceTmagIds: ['TMAG-01'],
      channel: 'sms',
      template: { smsText: smsRendered, emailSubject: null, emailText: null },
      recipientCount: 1,
      status: 'queued',
      completedAt: null,
      systemKind: 'health_alert',
    },
    neo4j: {
      cypher:
        'MERGE (b:TmagBroadcast {broadcastId: $broadcastId}) ' +
        'SET b.createdAt = $createdAt, b.channel = "sms", b.systemKind = "health_alert", b.recipientCount = 1',
      params: { broadcastId, createdAt },
    },
    chroma: {
      collection: BROADCAST_CHROMA_COLLECTION,
      document: smsRendered,
      metadata: { broadcastId, createdAt, systemKind: 'health_alert', channel: 'sms' },
    },
  } satisfies TripleStackInput);

  await persistence('mongodb', 'insert', {
    database: MONGO_DB,
    collection: BROADCAST_RECIPIENTS_COLLECTION,
    documents: [
      {
        _id: rowId,
        rowId,
        broadcastId,
        recipientTmagId: 'TMAG-01',
        recipientFullName: 'Kevin L. Gardner',
        recipientFirstName: 'Kevin',
        recipientEmail: null,
        recipientPhone: HEALTH_ALERT_PHONE,
        channel: 'sms',
        smsRendered,
        emailSubjectRendered: null,
        emailTextRendered: null,
        status: 'queued',
        smsMessageId: null,
        emailMessageId: null,
        failureReason: null,
        attempts: 0,
        queuedAt: createdAt,
        startedAt: null,
        finishedAt: null,
      },
    ],
  });

  return { broadcastId, rowId };
}

function buildHealthAlertText(status: HealthStatusFile): string {
  const failed = status.checks
    .filter((c) => !c.ok)
    .map((c) => `${c.name}: ${c.detail || 'failed'}`)
    .join('; ');
  const body =
    `MCS health RED at ${status.checkedAt}. Failed checks: ` +
    (failed || 'unknown');
  return body.length > MAX_ALERT_BODY_CHARS
    ? `${body.slice(0, MAX_ALERT_BODY_CHARS - 3)}...`
    : body;
}
