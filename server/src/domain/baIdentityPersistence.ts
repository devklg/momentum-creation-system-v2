import {
  writeGraphCritical,
  type TieredChromaWrite,
  type TieredWriteResult,
} from '../services/tieredWrite.js';

const BA_COLLECTION = 'team_magnificent_members';

export interface BaIdentityGraphWriteInput {
  id: string;
  mongoDoc: Record<string, unknown>;
  sponsorTmagId: string | null;
  nodeProps: Record<string, unknown>;
  chroma?: TieredChromaWrite;
}

function withoutUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function buildBaIdentityGraphCypher(sponsorTmagId: string | null): {
  cypher: string;
  verifyCypher: string;
} {
  if (sponsorTmagId) {
    return {
      cypher:
        'MATCH (s:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
        'MERGE (n:TeamMagnificentMember {tmagId: $id}) ' +
        'SET n += $nodeProps ' +
        'MERGE (n)-[:SPONSORED_BY]->(s)',
      verifyCypher:
        'MATCH (n:TeamMagnificentMember {tmagId: $id})-[:SPONSORED_BY]->' +
        '(s:TeamMagnificentMember {tmagId: $sponsorTmagId}) RETURN count(n) AS n',
    };
  }

  return {
    cypher:
      'MERGE (n:TeamMagnificentMember {tmagId: $id}) ' +
      'SET n += $nodeProps',
    verifyCypher:
      'MATCH (n:TeamMagnificentMember {tmagId: $id}) RETURN count(n) AS n',
  };
}

export function writeBaIdentityGraphCritical(
  input: BaIdentityGraphWriteInput,
): Promise<TieredWriteResult> {
  const graph = buildBaIdentityGraphCypher(input.sponsorTmagId);
  const nodeProps = withoutUndefined({
    tmagId: input.id,
    ...input.nodeProps,
  });

  return writeGraphCritical({
    id: input.id,
    mongoCollection: BA_COLLECTION,
    mongoDoc: input.mongoDoc,
    neo4j: {
      cypher: graph.cypher,
      params: {
        sponsorTmagId: input.sponsorTmagId,
        nodeProps,
      },
      verifyCypher: graph.verifyCypher,
      verifyParams: {
        sponsorTmagId: input.sponsorTmagId,
      },
    },
    ...(input.chroma ? { chroma: input.chroma } : {}),
  });
}
