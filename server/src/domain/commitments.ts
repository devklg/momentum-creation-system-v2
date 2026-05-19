/**
 * Commitments domain. The /welcome screen captures a single click-acknowledge
 * commitment per BA (J.3 locked Chat #94: click, not typed signature). Each
 * acceptance is a triple-stack record so it's audit-grade durable.
 *
 * Per TEAM Design Section C.4 (Locked Chat #82/#84).
 */

import { tripleStackWrite } from '../services/tripleStack.js';
import { gatewayCall } from '../services/gateway.js';

export const COMMITMENT_VERSION = 'v1_2026_05_18';

export interface CommitmentRecord {
  commitmentId: string;
  baId: string;
  threeBaId: string;
  email: string;
  version: string;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export async function commitmentExists(baId: string): Promise<boolean> {
  const result = await gatewayCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'ba_commitments',
    filter: { baId },
    limit: 1,
  });
  return result.count > 0;
}

export async function recordCommitment(
  input: Omit<CommitmentRecord, 'commitmentId' | 'acceptedAt' | 'version'>,
): Promise<CommitmentRecord> {
  const acceptedAt = new Date().toISOString();
  const commitmentId = `commit_${input.baId}_${Date.now().toString(36)}`;
  const record: CommitmentRecord = {
    commitmentId,
    baId: input.baId,
    threeBaId: input.threeBaId,
    email: input.email,
    version: COMMITMENT_VERSION,
    acceptedAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };

  await tripleStackWrite({
    id: commitmentId,
    mongoCollection: 'ba_commitments',
    mongoDoc: record as unknown as Record<string, unknown>,
    neo4j: {
      cypher:
        'MERGE (n:BA {baId: $baId}) ' +
        'MERGE (c:Commitment {commitmentId: $id}) ' +
        'SET c.version = $version, c.acceptedAt = $acceptedAt ' +
        'MERGE (n)-[:ACCEPTED]->(c)',
      params: {
        baId: input.baId,
        version: COMMITMENT_VERSION,
        acceptedAt,
      },
    },
    chroma: {
      collection: 'mcs_commitments',
      document: `BA ${input.baId} (${input.email}) accepted Team Magnificent commitment ${COMMITMENT_VERSION} at ${acceptedAt}.`,
      metadata: {
        baId: input.baId,
        threeBaId: input.threeBaId,
        version: COMMITMENT_VERSION,
        acceptedAt,
        kind: 'ba_commitment',
      },
    },
  });

  return record;
}

export async function markWelcomeSeen(baId: string): Promise<void> {
  const seenAt = new Date().toISOString();
  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId },
    update: { $set: { welcome_seen: true, welcome_seen_at: seenAt } },
  });
}

export async function markCommitmentAccepted(baId: string): Promise<void> {
  const acceptedAt = new Date().toISOString();
  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId },
    update: { $set: { commitment_accepted: true, commitment_accepted_at: acceptedAt } },
  });
}

export interface BaProfile {
  baId: string;
  firstName: string;
  lastName: string;
  email: string;
  threeBaId: string;
  welcome_seen?: boolean;
  commitment_accepted?: boolean;
}

export async function findBaById(baId: string): Promise<BaProfile | null> {
  const result = await gatewayCall<{ documents: BaProfile[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId },
    limit: 1,
  });
  return result.documents.length > 0 ? result.documents[0] ?? null : null;
}
