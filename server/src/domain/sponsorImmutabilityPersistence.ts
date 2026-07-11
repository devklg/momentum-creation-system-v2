import {
  writeGraphCritical,
  type TieredChromaWrite,
  type TieredWriteResult,
} from '../services/tieredWrite.js';

const ACCESS_CODES_COLLECTION = 'tmag_access_codes';
const OVERRIDES_COLLECTION = 'tmag_admin_sponsor_overrides';

export type AccessCodeSponsorRelationship = 'HOLDS_CODE' | 'USES';

export interface AccessCodeGraphWriteInput {
  id: string;
  mongoDoc: Record<string, unknown>;
  sponsorTmagId: string;
  codeProps: Record<string, unknown>;
  relationship: AccessCodeSponsorRelationship;
  chroma?: TieredChromaWrite;
}

export interface SponsorOverrideGraphWriteInput {
  id: string;
  mongoDoc: Record<string, unknown>;
  tmagId: string;
  previousSponsorTmagId: string | null;
  newSponsorTmagId: string;
  overrideProps: Record<string, unknown>;
  chroma?: TieredChromaWrite;
}

function withoutUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function accessCodeRelationship(relationship: AccessCodeSponsorRelationship): string {
  if (relationship === 'USES') return 'USES';
  return 'HOLDS_CODE';
}

export function buildAccessCodeGraphCypher(
  relationship: AccessCodeSponsorRelationship,
): { cypher: string; verifyCypher: string } {
  const rel = accessCodeRelationship(relationship);
  return {
    cypher:
      'MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
      'MERGE (c:TmagAccessCode {code: $id}) ' +
      'SET c += $codeProps ' +
      `MERGE (b)-[:${rel}]->(c)`,
    verifyCypher:
      `MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId})-[:${rel}]->` +
      '(c:TmagAccessCode {code: $id}) RETURN count(c) AS n',
  };
}

export function writeAccessCodeGraphCritical(
  input: AccessCodeGraphWriteInput,
): Promise<TieredWriteResult> {
  const graph = buildAccessCodeGraphCypher(input.relationship);
  const codeProps = withoutUndefined({
    code: input.id,
    ...input.codeProps,
  });

  return writeGraphCritical({
    id: input.id,
    mongoCollection: ACCESS_CODES_COLLECTION,
    mongoDoc: input.mongoDoc,
    neo4j: {
      cypher: graph.cypher,
      params: {
        sponsorTmagId: input.sponsorTmagId,
        codeProps,
      },
      verifyCypher: graph.verifyCypher,
      verifyParams: {
        sponsorTmagId: input.sponsorTmagId,
      },
    },
    ...(input.chroma ? { chroma: input.chroma } : {}),
  });
}

export function buildSponsorOverrideGraphCypher(
  previousSponsorTmagId: string | null,
): { cypher: string; verifyCypher: string } {
  const hasPreviousSponsor = Boolean(previousSponsorTmagId);
  const previousSponsorMatch = hasPreviousSponsor
    ? 'MATCH (prevS:TeamMagnificentMember {tmagId: $previousSponsorTmagId}) '
    : '';
  const originalSponsorEdge = hasPreviousSponsor
    ? 'MERGE (n)-[:HAS_ORIGINAL_SPONSOR]->(prevS) '
    : '';
  const previousSponsorVerify = hasPreviousSponsor
    ? ', (n)-[:HAS_ORIGINAL_SPONSOR]->' +
      '(prevS:TeamMagnificentMember {tmagId: $previousSponsorTmagId})'
    : '';

  return {
    cypher:
      'MATCH (n:TeamMagnificentMember {tmagId: $tmagId}) ' +
      'MATCH (newS:TeamMagnificentMember {tmagId: $newSponsorTmagId}) ' +
      previousSponsorMatch +
      'OPTIONAL MATCH (n)-[oldSponsor:SPONSORED_BY {current: true}]->(:TeamMagnificentMember) ' +
      'SET oldSponsor.current = false, ' +
      'oldSponsor.supersededByOverrideId = $id, ' +
      'oldSponsor.supersededAt = datetime($performedAt) ' +
      'MERGE (o:TmagSponsorOverride {overrideId: $id}) ' +
      'SET o += $overrideProps, o.performedAt = datetime($performedAt) ' +
      'MERGE (n)-[:SPONSORED_BY {current: true}]->(newS) ' +
      originalSponsorEdge +
      'MERGE (n)-[:HAS_OVERRIDE]->(o)',
    verifyCypher:
      'MATCH (n:TeamMagnificentMember {tmagId: $tmagId})' +
      '-[:SPONSORED_BY {current: true}]->' +
      '(newS:TeamMagnificentMember {tmagId: $newSponsorTmagId}) ' +
      previousSponsorVerify +
      ' MATCH (n)-[:HAS_OVERRIDE]->(o:TmagSponsorOverride {overrideId: $id}) ' +
      'RETURN count(o) AS n',
  };
}

export function writeSponsorOverrideGraphCritical(
  input: SponsorOverrideGraphWriteInput,
): Promise<TieredWriteResult> {
  const graph = buildSponsorOverrideGraphCypher(input.previousSponsorTmagId);
  const overrideProps = withoutUndefined({
    overrideId: input.id,
    ...input.overrideProps,
  });

  return writeGraphCritical({
    id: input.id,
    mongoCollection: OVERRIDES_COLLECTION,
    mongoDoc: input.mongoDoc,
    neo4j: {
      cypher: graph.cypher,
      params: {
        tmagId: input.tmagId,
        previousSponsorTmagId: input.previousSponsorTmagId,
        newSponsorTmagId: input.newSponsorTmagId,
        performedAt: String(input.overrideProps.performedAt ?? ''),
        overrideProps,
      },
      verifyCypher: graph.verifyCypher,
      verifyParams: {
        tmagId: input.tmagId,
        previousSponsorTmagId: input.previousSponsorTmagId,
        newSponsorTmagId: input.newSponsorTmagId,
      },
    },
    ...(input.chroma ? { chroma: input.chroma } : {}),
  });
}
