/**
 * Commitments domain. The /welcome screen captures a single click-acknowledge
 * commitment per BA (J.3 locked Chat #94: click, not typed signature). Each
 * acceptance is a triple-stack record so it's audit-grade durable.
 *
 * Per TEAM Design Section C.4 (Locked Chat #82/#84).
 */

import { tripleStackWrite } from '../services/tripleStack.js';
import { persistenceCall } from '../services/persistence/dispatch.js';

export const COMMITMENT_VERSION = 'v1_2026_05_18';

export interface CommitmentRecord {
  commitmentId: string;
  tmagId: string;
  threeBaId: string;
  email: string;
  version: string;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export async function commitmentExists(tmagId: string): Promise<boolean> {
  const result = await persistenceCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'tmag_commitments',
    filter: { tmagId },
    limit: 1,
  });
  return result.count > 0;
}

export async function recordCommitment(
  input: Omit<CommitmentRecord, 'commitmentId' | 'acceptedAt' | 'version'>,
): Promise<CommitmentRecord> {
  const acceptedAt = new Date().toISOString();
  const commitmentId = `commit_${input.tmagId}_${Date.now().toString(36)}`;
  const record: CommitmentRecord = {
    commitmentId,
    tmagId: input.tmagId,
    threeBaId: input.threeBaId,
    email: input.email,
    version: COMMITMENT_VERSION,
    acceptedAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };

  await tripleStackWrite({
    id: commitmentId,
    mongoCollection: 'tmag_commitments',
    mongoDoc: record as unknown as Record<string, unknown>,
    neo4j: {
      cypher:
        'MERGE (n:TeamMagnificentMember {tmagId: $tmagId}) ' +
        'MERGE (c:TmagCommitment {commitmentId: $id}) ' +
        'SET c.version = $version, c.acceptedAt = $acceptedAt ' +
        'MERGE (n)-[:ACCEPTED]->(c)',
      params: {
        tmagId: input.tmagId,
        version: COMMITMENT_VERSION,
        acceptedAt,
      },
    },
    chroma: {
      collection: 'tmag_commitments',
      document: `BA ${input.tmagId} (${input.email}) accepted Team Magnificent commitment ${COMMITMENT_VERSION} at ${acceptedAt}.`,
      metadata: {
        tmagId: input.tmagId,
        threeBaId: input.threeBaId,
        version: COMMITMENT_VERSION,
        acceptedAt,
        kind: 'ba_commitment',
      },
    },
  });

  return record;
}

export async function markWelcomeSeen(tmagId: string): Promise<void> {
  const seenAt = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { tmagId },
    update: { $set: { welcome_seen: true, welcome_seen_at: seenAt } },
  });
}

export async function markCommitmentAccepted(tmagId: string): Promise<void> {
  const acceptedAt = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { tmagId },
    update: { $set: { commitment_accepted: true, commitment_accepted_at: acceptedAt } },
  });
}

export interface BaProfile {
  tmagId: string;
  firstName: string;
  lastName: string;
  email: string;
  threeBaId: string;
  welcome_seen?: boolean;
  commitment_accepted?: boolean;
}

export async function findBaById(tmagId: string): Promise<BaProfile | null> {
  const result = await persistenceCall<{ documents: BaProfile[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { tmagId },
    limit: 1,
  });
  return result.documents.length > 0 ? result.documents[0] ?? null : null;
}
