// MCS v2 Rev 3 reidentification migration.
//
// Idempotent Mongo migration for the signed 2026-07-02 canonical schema:
// - old collection names -> Rev 3 names
// - member IDs -> TMAG-XXXXXX, preserving founder exceptions TMAG-01/TMAG-02
// - leadBatchId -> leadOwnerId
// - vmlead_* -> lead_<uuid>
// - agent_events -> tmag_agent_<agent>_events split

import { randomInt, randomUUID } from 'node:crypto';
import { closeMomentumMongo, connectMomentumMongo } from './lib/momentum-mongo.mjs';

const AMBIGUITY_FREE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FOUNDER_IDS = new Set(['TMAG-01', 'TMAG-02']);
const MEMBER_ID_RE = /^TMAG-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const LEAD_ID_RE = /^lead_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COLLECTION_RENAMES = [
  ['brand_ambassadors', 'team_magnificent_members'],
  ['access_codes', 'tmag_access_codes'],
  ['steve_discoveries', 'tmag_steve_success_interview'],
  ['vm_lead_batches', 'tmag_vm_lead_owners'],
  ['vm_bulk_leads', 'tmag_vm_bulk_leads'],
  ['master_content_versions', 'tmag_content_templates'],
];

const TMAG_REFERENCE_FIELDS = [
  'tmagId',
  'baId',
  'sponsorTmagId',
  'sponsorBaId',
  'ownerTmagId',
  'ownerBaId',
  'forTmagId',
  'conductedByTmagId',
  'recipientTmagId',
  'createdByTmagId',
  'mintedByTmagId',
  'performedByTmagId',
  'confirmedByTmagId',
  'oldOwnerTmagId',
  'newOwnerTmagId',
  'oldSponsorTmagId',
  'newSponsorTmagId',
  'previousSponsorTmagId',
];

const LEAD_OWNER_REFERENCE_COLLECTIONS = [
  'tmag_vm_lead_owners',
  'tmag_vm_campaigns',
  'tmag_vm_bulk_leads',
  'tmag_prospects',
  'tmag_prospect_invite_tokens',
  'tmag_prospect_crm_records',
  'tmag_prospect_timeline_events',
  'tmag_vm_delivery_events',
  'tmag_vm_audit_events',
];

const LEAD_REFERENCE_COLLECTIONS = [
  'tmag_vm_bulk_leads',
  'tmag_prospects',
  'tmag_prospect_invite_tokens',
  'tmag_prospect_crm_records',
  'tmag_prospect_timeline_events',
  'tmag_vm_delivery_events',
  'tmag_vm_audit_events',
  'tmag_vm_provider_webhook_events',
];

function mintCandidate() {
  let out = 'TMAG-';
  for (let i = 0; i < 6; i += 1) out += AMBIGUITY_FREE[randomInt(AMBIGUITY_FREE.length)];
  return out;
}

async function collectionNames(db) {
  return new Set((await db.listCollections().toArray()).map((c) => c.name));
}

async function ensureCollection(db, name) {
  const names = await collectionNames(db);
  if (!names.has(name)) await db.createCollection(name);
}

async function renameCollectionIfNeeded(db, from, to) {
  const names = await collectionNames(db);
  if (!names.has(from)) return false;
  if (!names.has(to)) {
    await db.collection(from).rename(to);
    return true;
  }

  const docs = await db.collection(from).find({}).toArray();
  if (docs.length > 0) {
    await db.collection(to).bulkWrite(
      docs.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  return false;
}

function canonicalAgentKey(doc) {
  const raw = String(doc.agentId ?? doc.agentKey ?? doc.agent ?? '').toLowerCase();
  if (raw.includes('ivory')) return 'ivory';
  if (raw.includes('michael')) return 'michael';
  if (raw.includes('steve')) return 'steve';
  if (raw.includes('system')) return 'system';
  return 'system';
}

async function splitAgentEvents(db) {
  const names = await collectionNames(db);
  if (!names.has('agent_events')) return 0;
  const docs = await db.collection('agent_events').find({}).toArray();
  let copied = 0;
  for (const doc of docs) {
    const agentKey = canonicalAgentKey(doc);
    const target = `tmag_agent_${agentKey}_events`;
    await ensureCollection(db, target);
    await db.collection(target).updateOne(
      { _id: doc._id },
      { $setOnInsert: { ...doc, agentId: doc.agentId ?? agentKey } },
      { upsert: true },
    );
    copied += 1;
  }
  return copied;
}

async function buildMemberIdMap(db) {
  await ensureCollection(db, 'team_magnificent_members');
  const members = await db.collection('team_magnificent_members').find({}).toArray();
  const used = new Set(
    members
      .map((m) => m.tmagId ?? m.baId)
      .filter((id) => typeof id === 'string' && (FOUNDER_IDS.has(id) || MEMBER_ID_RE.test(id))),
  );
  const map = new Map();

  for (const member of members) {
    const oldId = member.tmagId ?? member.baId;
    if (typeof oldId !== 'string' || oldId.length === 0) continue;
    if (FOUNDER_IDS.has(oldId) || MEMBER_ID_RE.test(oldId)) continue;

    let next = mintCandidate();
    while (used.has(next)) next = mintCandidate();
    used.add(next);
    map.set(oldId, next);
  }
  return map;
}

async function applyMemberIdMap(db, idMap) {
  if (idMap.size === 0) return 0;
  let updates = 0;
  const names = await collectionNames(db);

  for (const [oldId, newId] of idMap.entries()) {
    const memberUpdates = await db.collection('team_magnificent_members').updateMany(
      { $or: [{ tmagId: oldId }, { baId: oldId }] },
      [
        {
          $set: {
            tmagId: newId,
            legacyTmagId: oldId,
            updatedAt: { $ifNull: ['$updatedAt', '$createdAt'] },
          },
        },
        { $unset: ['baId'] },
      ],
    );
    updates += memberUpdates.modifiedCount ?? 0;

    for (const name of names) {
      const collection = db.collection(name);
      for (const field of TMAG_REFERENCE_FIELDS) {
        const result = await collection.updateMany({ [field]: oldId }, { $set: { [field]: newId } });
        updates += result.modifiedCount ?? 0;
      }
    }
  }
  return updates;
}

async function renameLeadOwnerFields(db) {
  let updates = 0;
  for (const name of LEAD_OWNER_REFERENCE_COLLECTIONS) {
    await ensureCollection(db, name);
    const result = await db.collection(name).updateMany(
      { leadBatchId: { $exists: true } },
      [{ $set: { leadOwnerId: '$leadBatchId' } }, { $unset: ['leadBatchId'] }],
    );
    updates += result.modifiedCount ?? 0;
  }
  return updates;
}

async function buildLeadIdMap(db) {
  await ensureCollection(db, 'tmag_vm_bulk_leads');
  const docs = await db.collection('tmag_vm_bulk_leads').find({ leadId: { $type: 'string' } }).toArray();
  const map = new Map();
  for (const doc of docs) {
    const oldId = doc.leadId;
    if (LEAD_ID_RE.test(oldId)) continue;
    if (oldId.startsWith('vmlead_') && LEAD_ID_RE.test(`lead_${oldId.slice('vmlead_'.length)}`)) {
      map.set(oldId, `lead_${oldId.slice('vmlead_'.length)}`);
    } else if (oldId.startsWith('lead_') && !LEAD_ID_RE.test(oldId)) {
      map.set(oldId, `lead_${randomUUID()}`);
    } else if (oldId.startsWith('vmlead_')) {
      map.set(oldId, `lead_${randomUUID()}`);
    }
  }
  return map;
}

async function applyLeadIdMap(db, leadIdMap) {
  let updates = 0;
  for (const [oldId, newId] of leadIdMap.entries()) {
    for (const name of LEAD_REFERENCE_COLLECTIONS) {
      await ensureCollection(db, name);
      const result = await db.collection(name).updateMany({ leadId: oldId }, { $set: { leadId: newId, legacyLeadId: oldId } });
      updates += result.modifiedCount ?? 0;
    }
  }
  return updates;
}

async function main() {
  const db = await connectMomentumMongo();
  const renamed = [];
  for (const [from, to] of COLLECTION_RENAMES) {
    if (await renameCollectionIfNeeded(db, from, to)) renamed.push(`${from}->${to}`);
  }

  const agentEventsCopied = await splitAgentEvents(db);
  const memberIdMap = await buildMemberIdMap(db);
  const memberUpdates = await applyMemberIdMap(db, memberIdMap);
  const leadOwnerFieldUpdates = await renameLeadOwnerFields(db);
  const leadIdMap = await buildLeadIdMap(db);
  const leadIdUpdates = await applyLeadIdMap(db, leadIdMap);

  await db.collection('mcs_migrations').updateOne(
    { _id: 'rev3_reidentification_2026_07_02' },
    {
      $set: {
        _id: 'rev3_reidentification_2026_07_02',
        schemaRev: 'rev3-signed-2026-07-02',
        ranAt: new Date().toISOString(),
        renamed,
        agentEventsCopied,
        memberIdsReidentified: memberIdMap.size,
        memberReferenceUpdates: memberUpdates,
        leadOwnerFieldUpdates,
        leadIdsReidentified: leadIdMap.size,
        leadReferenceUpdates: leadIdUpdates,
      },
    },
    { upsert: true },
  );

  console.log('[rev3-reidentification] OK', {
    renamed,
    agentEventsCopied,
    memberIdsReidentified: memberIdMap.size,
    memberReferenceUpdates: memberUpdates,
    leadOwnerFieldUpdates,
    leadIdsReidentified: leadIdMap.size,
    leadReferenceUpdates: leadIdUpdates,
  });
}

try {
  await main();
} finally {
  await closeMomentumMongo();
}
