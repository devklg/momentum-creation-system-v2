/**
 * Admin agent-memory oversight.
 *
 * Success Profile remains admin/database/GraphRAG/agent-memory territory. This
 * module reads the existing Steve discovery artifacts and prepares
 * schema-enforced GraphRAG bridge drafts without writing them through the
 * repo-local tripleStack helper. Real memory writes must use Universal
 * Gateway quadstack.write with enforce_schema=true.
 */

import { gatewayCall } from '../services/gateway.js';
import type {
  AdminAgentInteractionSummary,
  AdminAgentMemoryStatus,
  AdminAgentOversightResponse,
  AdminSuccessProfileMemoryBridgeDraft,
  AdminSuccessProfileSummary,
  AgentId,
  SteveDiscoveryArtifact,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BAS = 'brand_ambassadors';
const COLL_STEVE = 'steve_discoveries';
const COLL_AGENT_EVENTS = 'agent_events';
const COLL_OUTBOX = 'projection_outbox';
const CHROMA_STEVE = 'mcs_steve_discoveries';
const CHROMA_AGENT_EVENTS = 'mcs_agent_events';

interface PersistedSteveDiscovery extends SteveDiscoveryArtifact {
  _id: string;
}

interface BaDoc {
  baId: string;
  firstName?: string;
  lastName?: string;
  sponsorBaId?: string | null;
}

interface AgentEventDoc {
  agentId?: AgentId;
  createdAt?: string;
}

interface OutboxDoc {
  tier?: string;
  status?: string;
}

async function safeQuery<T>(
  collection: string,
  warnings: string[],
  filter: Record<string, unknown> = {},
  limit = 50_000,
): Promise<T[]> {
  try {
    const result = await gatewayCall<{ documents?: T[] }>('mongodb', 'query', {
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
    const result = await gatewayCall<{ collections?: Array<{ name?: string }> }>(
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
): AdminSuccessProfileSummary[] {
  const baById = new Map(bas.map((b) => [b.baId, b]));
  return discoveries.map((d) => {
    const profile = d.successProfile;
    return {
      baId: d.baId,
      baName: baName(baById.get(d.baId), d.baId),
      sponsorBaId: d.sponsorBaId ?? baById.get(d.baId)?.sponsorBaId ?? null,
      generatedAt: profile.generatedAt ?? d.completedAt ?? null,
      primaryWhy: profile.primaryWhy?.statement ?? null,
      learningStyle: profile.learningStyle?.modalities ?? [],
      supportAreas: profile.supportNeeds?.areas ?? [],
      signedBy: profile.signedBy ?? null,
    };
  });
}

function buildInteractionSummary(events: AgentEventDoc[]): AdminAgentInteractionSummary[] {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const agentIds: AgentId[] = ['michael', 'ivory', 'steve', 'system'];
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
}): AdminAgentMemoryStatus[] {
  const chroma = args.chromaCollections;
  const pendingKnowledge = args.outbox.filter(
    (row) => row.tier === 'knowledge' && row.status === 'pending',
  ).length;

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
      collection: COLL_AGENT_EVENTS,
      purpose: 'Append-only BA-facing agent interaction telemetry.',
      status: 'present',
      recordCount: args.events.length,
      note: 'Events come from /api/agents/events.',
    },
    {
      collection: CHROMA_AGENT_EVENTS,
      purpose: 'Semantic lookup for agent interaction events.',
      status: chroma === null ? 'unknown' : chroma.has(CHROMA_AGENT_EVENTS) ? 'present' : 'missing',
      recordCount: null,
      note: 'Registered in the Chroma boot guard.',
    },
    {
      collection: COLL_OUTBOX,
      purpose: 'Durable retry queue for knowledge/operational projections.',
      status: 'present',
      recordCount: pendingKnowledge,
      note: `${pendingKnowledge} pending knowledge projection(s).`,
    },
  ];
}

function bridgeDraft(discovery: PersistedSteveDiscovery): AdminSuccessProfileMemoryBridgeDraft {
  const now = new Date().toISOString();
  const id = `graphrag_success_profile_${discovery.baId}`;
  const profile = discovery.successProfile;
  const learning = profile.learningStyle.modalities.join(', ') || 'not captured';
  const support = profile.supportNeeds.areas.join(', ') || 'not captured';
  const primaryWhy = profile.primaryWhy.statement || 'not captured';

  return {
    baId: discovery.baId,
    ready: true,
    base: {
      id,
      type: 'document',
      schema_version: 1,
      namespace: 'momentum',
      source: 'momentum_admin_agent_memory_bridge',
      created_at: now,
      title: `Success Profile agent memory for ${discovery.baId}`,
      origin_kind: 'system',
      service_name: 'admin_agent_memory_bridge',
    },
    semanticDocument: [
      `Success Profile for BA ${discovery.baId}.`,
      `Primary why: ${primaryWhy}.`,
      `Learning style: ${learning}.`,
      `Support areas: ${support}.`,
      `Signed by: ${profile.signedBy}.`,
    ].join(' '),
    requiredWritePath: 'quadstack.write',
    options: { require: ['mongo', 'neo4j', 'chroma'], enforce_schema: true },
    note:
      'Draft only. Persist with Universal Gateway quadstack.write and enforce_schema=true; do not use repo-local tripleStackWrite for new GraphRAG lineage records.',
  };
}

export async function buildAdminAgentOversight(): Promise<AdminAgentOversightResponse> {
  const warnings: string[] = [];
  const [discoveries, bas, events, outbox, chromaCollections] = await Promise.all([
    safeQuery<PersistedSteveDiscovery>(COLL_STEVE, warnings),
    safeQuery<BaDoc>(COLL_BAS, warnings),
    safeQuery<AgentEventDoc>(COLL_AGENT_EVENTS, warnings),
    safeQuery<OutboxDoc>(COLL_OUTBOX, warnings),
    listChromaCollections(warnings),
  ]);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    successProfiles: summarizeSuccessProfiles(discoveries, bas),
    memoryStatus: memoryStatus({ chromaCollections, discoveries, events, outbox }),
    interactionSummary: buildInteractionSummary(events),
    bridgeDrafts: discoveries.slice(0, 25).map(bridgeDraft),
    warnings,
  };
}
