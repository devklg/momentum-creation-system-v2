#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const ownershipPath = path.join(outDir, 'mongo-ownership-map.json');
const jsonPath = path.join(outDir, 'mongo-index-audit-plan.json');
const mdPath = path.join(outDir, 'MONGO_INDEX_AUDIT_PLAN.md');
const check = process.argv.includes('--check');

const INDEX_PLAN = [
  idx('team_magnificent_members', 'unique_tmagId', { tmagId: 1 }, { unique: true }, 'Canonical BA login/member id.'),
  idx('team_magnificent_members', 'unique_email', { email: 1 }, { unique: true, sparse: true }, 'Admin/member lookup by email.'),
  idx('team_magnificent_members', 'unique_threeBaId', { threeBaId: 1 }, { unique: true, sparse: true }, 'THREE id mirror should not duplicate.'),
  idx('team_magnificent_members', 'sponsor_createdAt', { sponsorTmagId: 1, createdAt: -1 }, {}, 'Downline listing.'),
  idx('team_magnificent_members', 'lastLoginAt', { lastLoginAt: -1 }, {}, 'Admin activity review.'),
  idx('tmag_access_codes', 'unique_code', { code: 1 }, { unique: true }, 'Access codes are one-per-BA reusable keys.'),
  idx('tmag_access_codes', 'sponsorTmagId', { sponsorTmagId: 1 }, {}, 'Admin code lookup by owner.'),
  idx('tmag_prospects', 'unique_prospectId', { prospectId: 1 }, { unique: true }, 'Prospect canonical id.'),
  idx('tmag_prospects', 'sponsor_state_createdAt', { sponsorTmagId: 1, state: 1, createdAt: -1 }, {}, 'BA cockpit prospect list.'),
  idx('tmag_prospects', 'expiresAt', { expiresAt: 1 }, {}, 'Expiry/lazy flush lookups.'),
  idx('tmag_prospect_invite_tokens', 'unique_token', { token: 1 }, { unique: true }, 'Token resolver.'),
  idx('tmag_prospect_invite_tokens', 'prospectId', { prospectId: 1 }, {}, 'Token/prospect join.'),
  idx('tmag_prospect_invite_tokens', 'sponsor_state', { sponsorTmagId: 1, state: 1 }, {}, 'Sponsor token state scans.'),
  idx('tmag_prospect_invite_tokens', 'expiresAt', { expiresAt: 1 }, {}, 'Token expiry checks.'),
  idx('tmag_prospect_htank_placements', 'unique_prospectId', { prospectId: 1 }, { unique: true }, 'One placement per prospect.'),
  idx('tmag_prospect_htank_placements', 'unique_positionNumber', { positionNumber: 1 }, { unique: true }, 'Monotonic team pool position.'),
  idx('tmag_prospect_htank_placements', 'expires_flushed', { expiresAt: 1, flushedAt: 1 }, {}, 'Flush sweep.'),
  idx('tmag_prospect_htank_placements', 'sponsor_placedAt', { sponsorTmagId: 1, placedAt: -1 }, {}, 'Sponsor pool history.'),
  idx('tmag_prospect_htank_accounts', 'unique_accountId', { accountId: 1 }, { unique: true }, 'Prospect account id.'),
  idx('tmag_prospect_htank_accounts', 'unique_tokenId', { tokenId: 1 }, { unique: true }, 'One account per invite token.'),
  idx('tmag_prospect_htank_accounts', 'phoneHash', { phoneHash: 1 }, {}, 'Prospect re-entry by phone hash.'),
  idx('tmag_prospect_magic_links', 'unique_linkToken', { linkToken: 1 }, { unique: true }, 'Magic-link redemption.'),
  idx('tmag_prospect_magic_links', 'account_expires', { accountId: 1, expiresAt: 1 }, {}, 'Account-scoped link validity.'),
  idx('tmag_prospect_callback_requests', 'prospect_createdAt', { prospectId: 1, createdAt: -1 }, {}, 'Prospect callback history.'),
  idx('tmag_prospect_callback_requests', 'sponsor_createdAt', { sponsorTmagId: 1, createdAt: -1 }, {}, 'BA callback queue.'),
  idx('tmag_prospect_webinar_reservations', 'prospect_createdAt', { prospectId: 1, createdAt: -1 }, {}, 'Prospect webinar history.'),
  idx('tmag_prospect_invitation_activity', 'prospect_at', { prospectId: 1, at: -1 }, {}, 'Invitation activity timeline.'),
  idx('tmag_prospect_crm_records', 'unique_crmRecordId', { crmRecordId: 1 }, { unique: true }, 'CRM record id.', 'vm_registry_declared'),
  idx('tmag_prospect_crm_records', 'unique_owner_prospect', { ownerTmagId: 1, prospectId: 1 }, { unique: true }, 'One active owner/prospect CRM row.', 'vm_registry_declared'),
  idx('tmag_prospect_crm_records', 'owner_status_followup', { ownerTmagId: 1, status: 1, followUpDueAt: 1 }, {}, 'BA follow-up queue.', 'vm_registry_declared'),
  idx('tmag_prospect_crm_notes', 'prospect_createdAt', { prospectId: 1, createdAt: -1 }, {}, 'CRM notes timeline.'),
  idx('tmag_prospect_crm_followups', 'dueAt_status', { dueAt: 1, status: 1 }, {}, 'Due follow-up sweep.'),
  idx('tmag_prospect_crm_followups', 'prospect_dueAt', { prospectId: 1, dueAt: 1 }, {}, 'Prospect follow-up history.'),
  idx('mcs_audit_log', 'timestamp', { timestamp: -1 }, {}, 'Admin audit log chronological view.'),
  idx('mcs_audit_log', 'severity_timestamp', { severity: 1, timestamp: -1 }, {}, 'Audit severity filtering.'),
  idx('mcs_audit_log', 'entity', { 'entity.kind': 1, 'entity.id': 1, timestamp: -1 }, {}, 'Entity audit drill-down.'),
  idx('tmag_projection_outbox', 'status_nextAttemptAt', { status: 1, nextAttemptAt: 1 }, {}, 'Projection retry worker due-row scan.'),
  idx('tmag_projection_outbox', 'entityId', { entityId: 1 }, {}, 'Trace pending projections for a source record.'),
  idx('broadcast_recipients', 'broadcast_status', { broadcastId: 1, status: 1 }, {}, 'Broadcast reconciliation.'),
  idx('broadcast_recipients', 'status_queuedAt', { status: 1, queuedAt: 1 }, {}, 'Broadcast worker queue.'),
  idx('broadcast_optouts', 'unique_ba_channel', { baId: 1, channel: 1 }, { unique: true }, 'STOP-list uniqueness.'),
  idx('tmag_vm_lead_owners', 'unique_leadOwnerId', { leadOwnerId: 1 }, { unique: true }, 'VM owner id.', 'vm_registry_declared'),
  idx('tmag_vm_bulk_leads', 'unique_leadId', { leadId: 1 }, { unique: true }, 'VM lead id.', 'vm_registry_declared'),
  idx('tmag_vm_campaigns', 'unique_vmCampaignId', { vmCampaignId: 1 }, { unique: true }, 'VM campaign id.', 'vm_registry_declared'),
  idx('tmag_vm_queue_jobs', 'status_nextAttemptAt', { status: 1, nextAttemptAt: 1 }, {}, 'VM provider queue due-row scan.'),
  idx('tmag_vm_provider_webhook_events', 'provider_event', { provider: 1, providerEventId: 1 }, {}, 'Provider webhook idempotency plan.'),
];

const HIGH_VOLUME_COLLECTIONS = new Set([
  'team_magnificent_members',
  'tmag_prospects',
  'tmag_prospect_invite_tokens',
  'tmag_prospect_htank_placements',
  'tmag_prospect_htank_accounts',
  'tmag_prospect_magic_links',
  'tmag_prospect_callback_requests',
  'tmag_prospect_webinar_reservations',
  'tmag_prospect_invitation_activity',
  'tmag_prospect_crm_records',
  'tmag_prospect_crm_notes',
  'tmag_prospect_crm_followups',
  'mcs_audit_log',
  'tmag_projection_outbox',
  'broadcast_recipients',
  'broadcast_optouts',
  'tmag_vm_lead_owners',
  'tmag_vm_bulk_leads',
  'tmag_vm_campaigns',
  'tmag_vm_queue_jobs',
  'tmag_vm_provider_webhook_events',
]);

function idx(collection, name, keys, options, rationale, status = 'planned_missing_enforcement') {
  return { collection, name, keys, options, rationale, status };
}

function readExistingGeneratedAt() {
  if (!existsSync(jsonPath)) return null;
  try {
    const existing = JSON.parse(readFileSync(jsonPath, 'utf8'));
    return typeof existing.generatedAt === 'string' ? existing.generatedAt : null;
  } catch {
    return null;
  }
}

function buildAudit(generatedAtOverride = null) {
  if (!existsSync(ownershipPath)) {
    throw new Error('Mongo ownership map is missing. Run pnpm catalog:mongo-ownership first.');
  }
  const ownership = JSON.parse(readFileSync(ownershipPath, 'utf8'));
  const ownershipByCollection = new Map(
    (ownership.collections ?? []).map((row) => [row.collection, row]),
  );
  const plannedCollections = new Set(INDEX_PLAN.map((row) => row.collection));
  const highVolumeWithoutPlan = (ownership.collections ?? [])
    .filter((row) => HIGH_VOLUME_COLLECTIONS.has(row.collection))
    .filter((row) => row.resolved && !plannedCollections.has(row.collection))
    .map((row) => row.collection)
    .sort();

  const indexes = INDEX_PLAN.map((row) => {
    const owner = ownershipByCollection.get(row.collection);
    return {
      ...row,
      ownerId: owner?.ownerId ?? 'unknown',
      steward: owner?.steward ?? 'unknown',
      primarySurface: owner?.primarySurface ?? 'unknown',
    };
  });

  const byStatus = indexes.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: generatedAtOverride ?? new Date().toISOString(),
    sources: [
      'docs/app-data-model-contract.md §9',
      'engineering/sprints/platform-audit-p1/mongo-ownership-map.json',
      'server/src/domain/vmSchemas.ts',
      'server/src/runtime/knowledge-evolution/persistence/indexes.ts',
    ],
    currentAudit: {
      generalEnsureIndexes: 'not_present',
      knowledgeEvolutionEnsureIndexes: 'present_for_knowledge_evolution_only',
      vmIndexDefinitions: 'declared_in_schema_registry_not_generally_applied',
    },
    indexCount: indexes.length,
    byStatus,
    highVolumeWithoutPlan,
    indexes,
  };
}

function renderKeys(keys) {
  return Object.entries(keys)
    .map(([key, direction]) => `${key}:${direction}`)
    .join(', ');
}

function renderMarkdown(audit) {
  const rows = audit.indexes
    .map(
      (row) =>
        `| \`${row.collection}\` | \`${row.name}\` | \`${renderKeys(row.keys)}\` | ` +
        `${row.options.unique ? 'yes' : 'no'} | ${row.status} | ${row.steward} | ${row.rationale} |`,
    )
    .join('\n');
  const statusRows = Object.entries(audit.byStatus)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `| ${status} | ${count} |`)
    .join('\n');
  const missing = audit.highVolumeWithoutPlan.map((collection) => `- \`${collection}\``).join('\n') || '- none';

  return `# Mongo Index Audit And Plan

> Generated by \`node server/scripts/generate-mongo-index-audit.mjs\`.

## Summary

- Generated: ${audit.generatedAt}
- Planned/audited indexes: ${audit.indexCount}
- General ensureIndexes runner: ${audit.currentAudit.generalEnsureIndexes}
- Knowledge Evolution ensureIndexes: ${audit.currentAudit.knowledgeEvolutionEnsureIndexes}
- VM index definitions: ${audit.currentAudit.vmIndexDefinitions}

## Indexes By Status

| Status | Count |
| --- | ---: |
${statusRows}

## High-Volume Collections Without A Specific Plan Row

${missing}

## Index Plan

| Collection | Index | Keys | Unique | Status | Steward | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
${rows}
`;
}

function writeAudit(audit) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(audit));
}

function assertCurrent(audit) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('Mongo index audit files are missing. Run the generator.');
  }
  const expectedJson = `${JSON.stringify(audit, null, 2)}\n`;
  const expectedMd = renderMarkdown(audit);
  if (readFileSync(jsonPath, 'utf8') !== expectedJson || readFileSync(mdPath, 'utf8') !== expectedMd) {
    throw new Error('Mongo index audit is stale. Run node server/scripts/generate-mongo-index-audit.mjs');
  }
}

if (check) {
  const audit = buildAudit(readExistingGeneratedAt());
  assertCurrent(audit);
  console.log(`Mongo index audit is current (${audit.indexCount} index plan rows).`);
} else {
  const audit = buildAudit();
  writeAudit(audit);
  console.log(`Wrote Mongo index audit (${audit.indexCount} index plan rows).`);
}
