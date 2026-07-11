/**
 * Admin agent-memory oversight.
 *
 * Success Profile remains admin/database/GraphRAG/agent-memory territory. This
 * module reads the existing Steve discovery artifacts and prepares
 * schema-enforced GraphRAG bridge drafts without writing them through the
 * repo-local tripleStack helper. Real memory writes must use Universal
 * PERSISTENCE quadstack.write with enforce_schema=true.
 */

import { persistenceCall } from '../services/persistence/dispatch.js';
import type {
  McsAdminAgentInteractionSummary,
  McsAdminAgentMemoryStatus,
  McsAdminAgentOversightResponse,
  McsAdminProjectionOutboxDeadLetter,
  McsAdminSuccessProfileMemoryBridgeDraft,
  McsAdminSuccessProfileSummary,
  McsAgentId,
  McsSteveDiscoveryArtifact,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'team_magnificent_members';
const COLL_STEVE = 'tmag_steve_success_interview';
// Agent events are split per agent in Mongo; Chroma uses the mcs_ prefix.
const AGENT_EVENT_COLLECTIONS = [
  'tmag_agent_ivory_events',
  'tmag_agent_michael_events',
  'tmag_agent_steve_events',
  'tmag_agent_system_events',
] as const;
const AGENT_EVENTS_DISPLAY = 'tmag_agent_{ivory,michael,steve,system}_events';
const COLL_OUTBOX = 'tmag_projection_outbox';
const CHROMA_STEVE = 'mcs_steve_success_interview';
const CHROMA_AGENT_EVENT_COLLECTIONS = [
  'mcs_agent_ivory_events',
  'mcs_agent_michael_events',
  'mcs_agent_steve_events',
  'mcs_agent_system_events',
] as const;

interface PersistedSteveDiscovery extends McsSteveDiscoveryArtifact {
  _id: string;
}

interface BaDoc {
  tmagId: string;
  firstName?: string;
  lastName?: string;
  sponsorTmagId?: string | null;
}

interface AgentEventDoc {
  agentId?: McsAgentId;
  createdAt?: string;
}

interface OutboxDoc {
  tier?: string;
  target?: string;
  status?: string;
  outboxId?: string;
  entityId?: string;
  mongoCollection?: string;
  attempts?: number;
  maxAttempts?: number;
  lastError?: string | null;
  nextAttemptAt?: string | null;
  updatedAt?: string | null;
}

async function safeQuery<T>(
  collection: string,
  warnings: string[],
  filter: Record<string, unknown> = {},
  limit = 50_000,
): Promise<T[]> {
  try {
    const result = await persistenceCall<{ documents?: T[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection,
      filter,
      limit,
    });
    return result.documents ?? [];
  } catch (err) {
    warnings.push(
      `${collection} unavailable; agent oversight using empty set (${
        err instanceof Error ? err.message : String(err)
      }).`,
    );
    return [];
  }
}

async function listChromaCollections(warnings: string[]): Promise<Set<string> | null> {
  try {
    const result = await persistenceCall<{ collections?: Array<{ name?: string }> }>(
      'chromadb',
      'list_collections',
      {},
    );
    return new Set(
      (result.collections ?? [])
        .map((c) => c.name)
        .filter((name): name is string => typeof name === 'string'),
    );
  } catch (err) {
    warnings.push(
      `Chroma collection list unavailable (${
        err instanceof Error ? err.message : String(err)
      }).`,
    );
    return null;
  }
}

function baName(ba: BaDoc | undefined, fallback: string): string {
  if (!ba) return fallback;
  const name = `${ba.firstName ?? ''} ${ba.lastName ?? ''}`.trim();
  return name || fallback;
}

function summarizeSuccessProfiles(
  discoveries: PersistedSteveDiscovery[],
  bas: BaDoc[],
): McsAdminSuccessProfileSummary[] {
  const baById = new Map(bas.map((b) => [b.tmagId, b]));
  return discoveries.map((d) => {
    const profile = d.successProfile;
    return {
      tmagId: d.tmagId,
      baName: baName(baById.get(d.tmagId), d.tmagId),
      sponsorTmagId: d.sponsorTmagId ?? baById.get(d.tmagId)?.sponsorTmagId ?? null,
      generatedAt: profile.generatedAt ?? d.completedAt ?? null,
      primaryWhy: profile.primaryWhy?.statement ?? null,
      learningStyle: profile.learningStyle?.modalities ?? [],
      supportAreas: profile.supportNeeds?.areas ?? [],
      signedBy: profile.signedBy ?? null,
    };
  });
}

function buildInteractionSummary(events: AgentEventDoc[]): McsAdminAgentInteractionSummary[] {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const agentIds: McsAgentId[] = ['michael', 'ivory', 'steve', 'system'];
  return agentIds.map((agentId) => {
    const matching = events.filter((event) => event.agentId === agentId);
    const recent = matching.filter((event) => (event.createdAt ?? '') >= sevenDaysAgo);
    const lastEventAt = matching.reduce<string | null>((latest, event) => {
      const at = event.createdAt ?? null;
      if (!at) return latest;
      if (!latest || at > latest) return at;
      return latest;
    }, null);
    return { agentId, events7d: recent.length, lastEventAt };
  });
}

function memoryStatus(args: {
  chromaCollections: Set<string> | null;
  discoveries: PersistedSteveDiscovery[];
  events: AgentEventDoc[];
  outbox: OutboxDoc[];
}): McsAdminAgentMemoryStatus[] {
  const chroma = args.chromaCollections;
  const pendingKnowledge = args.outbox.filter(
    (row) => row.tier === 'knowledge' && row.status === 'pending',
  ).length;
  const failedOutbox = args.outbox.filter((row) => row.status === 'failed').length;

  return [
    {
      collection: COLL_STEVE,
      purpose: 'Canonical Steve Success Profile artifacts in MongoDB.',
      status: 'present',
      recordCount: args.discoveries.length,
      note: 'Read-only admin surface; BA profile remains separate.',
    },
    {
      collection: CHROMA_STEVE,
      purpose: 'Semantic retrieval for Success Profiles.',
      status: chroma === null ? 'unknown' : chroma.has(CHROMA_STEVE) ? 'present' : 'missing',
      recordCount: null,
      note: 'Existing Steve ingest writes here through tripleStackWrite.',
    },
    {
      collection: AGENT_EVENTS_DISPLAY,
      purpose: 'Append-only BA-facing agent interaction telemetry (split per agent).',
      status: 'present',
      recordCount: args.events.length,
      note: 'Events come from /api/agents/events; routed to tmag_agent_<agentId>_events.',
    },
    {
      collection: AGENT_EVENTS_DISPLAY,
      purpose: 'Semantic lookup for agent interaction events (split per agent).',
      status:
        chroma === null
          ? 'unknown'
          : CHROMA_AGENT_EVENT_COLLECTIONS.every((c) => chroma.has(c))
            ? 'present'
            : 'missing',
      recordCount: null,
      note: 'Registered in the Chroma boot guard.',
    },
    {
      collection: COLL_OUTBOX,
      purpose: 'Durable retry queue for knowledge/operational projections.',
      status: 'present',
      recordCount: pendingKnowledge + failedOutbox,
      note: `${pendingKnowledge} pending knowledge projection(s); ${failedOutbox} dead-letter projection(s).`,
    },
  ];
}

function projectionOutboxDeadLetters(outbox: OutboxDoc[]): McsAdminProjectionOutboxDeadLetter[] {
  return outbox
    .filter((row) => row.status === 'failed')
    .map((row) => ({
      outboxId: row.outboxId ?? 'unknown',
      tier: row.tier ?? 'unknown',
      target: row.target ?? 'unknown',
      entityId: row.entityId ?? 'unknown',
      mongoCollection: row.mongoCollection ?? 'unknown',
      attempts: typeof row.attempts === 'number' ? row.attempts : 0,
      maxAttempts: typeof row.maxAttempts === 'number' ? row.maxAttempts : 0,
      lastError: row.lastError ?? null,
      nextAttemptAt: row.nextAttemptAt ?? null,
      updatedAt: row.updatedAt ?? null,
    }))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, 50);
}

function bridgeDraft(discovery: PersistedSteveDiscovery): McsAdminSuccessProfileMemoryBridgeDraft {
  const now = new Date().toISOString();
  const id = `graphrag_success_profile_${discovery.tmagId}`;
  const profile = discovery.successProfile;
  const learning = profile.learningStyle.modalities.join(', ') || 'not captured';
  const support = profile.supportNeeds.areas.join(', ') || 'not captured';
  const primaryWhy = profile.primaryWhy.statement || 'not captured';

  return {
    tmagId: discovery.tmagId,
    ready: true,
    base: {
      id,
      type: 'document',
      schema_version: 1,
      namespace: 'momentum',
      source: 'momentum_admin_agent_memory_bridge',
      created_at: now,
      title: `Success Profile agent memory for ${discovery.tmagId}`,
      origin_kind: 'system',
      service_name: 'admin_agent_memory_bridge',
    },
    semanticDocument: [
      `Success Profile for BA ${discovery.tmagId}.`,
      `Primary why: ${primaryWhy}.`,
      `Learning style: ${learning}.`,
      `Support areas: ${support}.`,
      `Signed by: ${profile.signedBy}.`,
    ].join(' '),
    requiredWritePath: 'quadstack.write',
    options: { require: ['mongo', 'neo4j', 'chroma'], enforce_schema: true },
    note:
      'Draft only. Persist with external MCP tool server quadstack.write and enforce_schema=true; do not use repo-local tripleStackWrite for new GraphRAG lineage records.',
  };
}

export async function buildAdminAgentOversight(): Promise<McsAdminAgentOversightResponse> {
  const warnings: string[] = [];
  const [discoveries, bas, events, outbox, chromaCollections] = await Promise.all([
    safeQuery<PersistedSteveDiscovery>(COLL_STEVE, warnings),
    safeQuery<BaDoc>(COLL_BAS, warnings),
    Promise.all(
      AGENT_EVENT_COLLECTIONS.map((c) => safeQuery<AgentEventDoc>(c, warnings)),
    ).then((r) => r.flat()),
    safeQuery<OutboxDoc>(COLL_OUTBOX, warnings),
    listChromaCollections(warnings),
  ]);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    successProfiles: summarizeSuccessProfiles(discoveries, bas),
    memoryStatus: memoryStatus({ chromaCollections, discoveries, events, outbox }),
    interactionSummary: buildInteractionSummary(events),
    projectionOutboxDeadLetters: projectionOutboxDeadLetters(outbox),
    bridgeDrafts: discoveries.slice(0, 25).map(bridgeDraft),
    warnings,
  };
}
