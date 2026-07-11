import {
  writeGraphCritical,
  type TieredChromaWrite,
  type TieredWriteResult,
} from '../services/tieredWrite.js';

const CRM_COLLECTION = 'tmag_prospect_crm_records';

export type CrmOwnershipTarget =
  | { kind: 'prospect'; prospectId: string }
  | { kind: 'vm_lead'; leadId: string };

export interface CrmOwnershipGraphWriteInput {
  id: string;
  mongoDoc: Record<string, unknown>;
  ownerTmagId: string;
  crmProps: Record<string, unknown>;
  target: CrmOwnershipTarget;
  chroma?: TieredChromaWrite;
}

function withoutUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function buildCrmOwnershipGraphCypher(target: CrmOwnershipTarget): {
  cypher: string;
  verifyCypher: string;
} {
  if (target.kind === 'vm_lead') {
    return {
      cypher:
        'MATCH (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'MATCH (l:TmagVmBulkLead {leadId: $leadId}) ' +
        'MERGE (c:TmagProspectCrmRecord {crmRecordId: $id}) ' +
        'SET c += $crmProps ' +
        'MERGE (b)-[:OWNS_CRM_RECORD]->(c) ' +
        'MERGE (l)-[:HAS_CRM_RECORD]->(c)',
      verifyCypher:
        'MATCH (b:TeamMagnificentMember {tmagId: $ownerTmagId})-[:OWNS_CRM_RECORD]->' +
        '(c:TmagProspectCrmRecord {crmRecordId: $id})<-[:HAS_CRM_RECORD]-' +
        '(l:TmagVmBulkLead {leadId: $leadId}) RETURN count(c) AS n',
    };
  }

  return {
    cypher:
      'MATCH (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
      'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
      'MERGE (c:TmagProspectCrmRecord {crmRecordId: $id}) ' +
      'SET c += $crmProps ' +
      'MERGE (b)-[:OWNS_CRM_RECORD]->(c) ' +
      'MERGE (c)-[:FOR_PROSPECT]->(p)',
    verifyCypher:
      'MATCH (b:TeamMagnificentMember {tmagId: $ownerTmagId})-[:OWNS_CRM_RECORD]->' +
      '(c:TmagProspectCrmRecord {crmRecordId: $id})-[:FOR_PROSPECT]->' +
      '(p:TmagProspect {prospectId: $prospectId}) RETURN count(c) AS n',
  };
}

export function writeCrmOwnershipGraphCritical(
  input: CrmOwnershipGraphWriteInput,
): Promise<TieredWriteResult> {
  const graph = buildCrmOwnershipGraphCypher(input.target);
  const crmProps = withoutUndefined({
    crmRecordId: input.id,
    ownerTmagId: input.ownerTmagId,
    ...input.crmProps,
  });

  return writeGraphCritical({
    id: input.id,
    mongoCollection: CRM_COLLECTION,
    mongoDoc: input.mongoDoc,
    neo4j: {
      cypher: graph.cypher,
      params: {
        ownerTmagId: input.ownerTmagId,
        prospectId: input.target.kind === 'prospect' ? input.target.prospectId : null,
        leadId: input.target.kind === 'vm_lead' ? input.target.leadId : null,
        crmProps,
      },
      verifyCypher: graph.verifyCypher,
      verifyParams: {
        ownerTmagId: input.ownerTmagId,
        prospectId: input.target.kind === 'prospect' ? input.target.prospectId : null,
        leadId: input.target.kind === 'vm_lead' ? input.target.leadId : null,
      },
    },
    ...(input.chroma ? { chroma: input.chroma } : {}),
  });
}
