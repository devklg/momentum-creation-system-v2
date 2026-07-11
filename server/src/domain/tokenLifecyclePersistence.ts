import {
  writeGraphCritical,
  type TieredChromaWrite,
  type TieredWriteResult,
} from '../services/tieredWrite.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { enqueueProjection, extractCount, type Neo4jProjectionPayload } from '../services/projectionOutbox.js';

const MONGO_DB = 'momentum';
const TOKENS_COLLECTION = 'tmag_prospect_invite_tokens';

export interface ProspectTokenGraphWriteInput {
  token: string;
  prospectId: string;
  sponsorTmagId: string;
  mongoDoc: Record<string, unknown>;
  tokenProps: Record<string, unknown>;
  chroma?: TieredChromaWrite;
}

export interface VmLeadTokenGraphWriteInput {
  token: string;
  leadId: string;
  ownerTmagId: string;
  sponsorTmagId: string;
  mongoDoc: Record<string, unknown>;
  tokenProps: Record<string, unknown>;
  chroma?: TieredChromaWrite;
}

export interface TokenLifecyclePatchInput {
  token: string;
  patch: Record<string, unknown>;
}

function withoutUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function buildProspectTokenGraphCypher(): {
  cypher: string;
  verifyCypher: string;
} {
  return {
    cypher:
      'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
      'MERGE (t:TmagInviteToken {token: $id}) ' +
      'SET t += $tokenProps ' +
      'MERGE (t)-[:FOR_PROSPECT]->(p)',
    verifyCypher:
      'MATCH (t:TmagInviteToken {token: $id})-[:FOR_PROSPECT]->' +
      '(p:TmagProspect {prospectId: $prospectId}) RETURN count(t) AS n',
  };
}

export function buildVmLeadTokenGraphCypher(): {
  cypher: string;
  verifyCypher: string;
} {
  return {
    cypher:
      'MATCH (l:TmagVmBulkLead {leadId: $leadId}) ' +
      'MERGE (t:TmagInviteToken {token: $id}) ' +
      'SET t += $tokenProps ' +
      'MERGE (t)-[:FOR_VM_LEAD]->(l)',
    verifyCypher:
      'MATCH (t:TmagInviteToken {token: $id})-[:FOR_VM_LEAD]->' +
      '(l:TmagVmBulkLead {leadId: $leadId}) RETURN count(t) AS n',
  };
}

export function writeProspectTokenGraphCritical(
  input: ProspectTokenGraphWriteInput,
): Promise<TieredWriteResult> {
  const graph = buildProspectTokenGraphCypher();
  const tokenProps = withoutUndefined({
    token: input.token,
    prospectId: input.prospectId,
    sponsorTmagId: input.sponsorTmagId,
    ...input.tokenProps,
  });

  return writeGraphCritical({
    id: input.token,
    mongoCollection: TOKENS_COLLECTION,
    mongoDoc: input.mongoDoc,
    neo4j: {
      cypher: graph.cypher,
      params: {
        prospectId: input.prospectId,
        tokenProps,
      },
      verifyCypher: graph.verifyCypher,
      verifyParams: {
        prospectId: input.prospectId,
      },
    },
    ...(input.chroma ? { chroma: input.chroma } : {}),
  });
}

export function writeVmLeadTokenGraphCritical(
  input: VmLeadTokenGraphWriteInput,
): Promise<TieredWriteResult> {
  const graph = buildVmLeadTokenGraphCypher();
  const tokenProps = withoutUndefined({
    token: input.token,
    leadId: input.leadId,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    ...input.tokenProps,
  });

  return writeGraphCritical({
    id: input.token,
    mongoCollection: TOKENS_COLLECTION,
    mongoDoc: input.mongoDoc,
    neo4j: {
      cypher: graph.cypher,
      params: {
        leadId: input.leadId,
        tokenProps,
      },
      verifyCypher: graph.verifyCypher,
      verifyParams: {
        leadId: input.leadId,
      },
    },
    ...(input.chroma ? { chroma: input.chroma } : {}),
  });
}

async function verifyTokenPatch(token: string, expected: Record<string, unknown>): Promise<void> {
  const result = await persistenceCall<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    filter: { token },
    limit: 1,
  });
  const doc = result.documents?.[0];
  if (!doc) throw new Error(`token_lifecycle_readback_missing:${token}`);
  for (const [key, value] of Object.entries(expected)) {
    if (doc[key] !== value) {
      throw new Error(`token_lifecycle_readback_mismatch:${token}:${key}`);
    }
  }
}

async function projectTokenPatchToNeo4j(token: string, patch: Record<string, unknown>): Promise<void> {
  const payload: Neo4jProjectionPayload = {
    cypher:
      'MATCH (t:TmagInviteToken {token: $id}) ' +
      'SET t += $tokenProps',
    params: {
      tokenProps: patch,
    },
    verifyCypher:
      'MATCH (t:TmagInviteToken {token: $id}) ' +
      'RETURN count(t) AS n',
  };

  try {
    await persistenceCall('neo4j', 'cypher', {
      query: payload.cypher,
      params: { id: token, ...(payload.params ?? {}) },
    });
    const check = await persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: payload.verifyCypher,
      params: { id: token, ...(payload.verifyParams ?? {}) },
    });
    if (extractCount(check) < 1) throw new Error('token graph read-back returned 0');
  } catch (err) {
    await enqueueProjection({
      tier: 'operational',
      target: 'neo4j',
      entityId: token,
      mongoCollection: TOKENS_COLLECTION,
      payload,
      lastError: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function updateTokenLifecycleOperational(
  input: TokenLifecyclePatchInput,
): Promise<void> {
  const patch = withoutUndefined(input.patch);
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    filter: { token: input.token },
    update: { $set: patch },
  });
  await verifyTokenPatch(input.token, patch);
  await projectTokenPatchToNeo4j(input.token, patch);
}
