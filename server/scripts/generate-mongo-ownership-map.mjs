#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const schemaPath = path.join(outDir, 'schema-catalog.json');
const jsonPath = path.join(outDir, 'mongo-ownership-map.json');
const mdPath = path.join(outDir, 'MONGO_COLLECTION_OWNERSHIP_MAP.md');
const check = process.argv.includes('--check');

const OWNER_RULES = [
  {
    id: 'membership_identity',
    label: 'Membership identity and sponsor governance',
    steward: 'Admin / BA identity',
    surface: 'team + admin',
    tier: 'mixed',
    match: (c) =>
      c === 'team_magnificent_members' ||
      c === 'tmag_access_codes' ||
      c === 'tmag_admin_sponsor_overrides' ||
      c === 'tmag_admin_curated_leader_tags' ||
      c === 'tmag_admin_member_notes' ||
      c === 'tmag_profile_change_challenges',
  },
  {
    id: 'prospect_invitation_flow',
    label: 'Prospect invitation and PMV flow',
    steward: 'Prospect / invitation domain',
    surface: 'com + team + admin',
    tier: 'mixed',
    match: (c) =>
      c === 'tmag_prospects' ||
      c === 'tmag_prospect_invite_tokens' ||
      c === 'tmag_prospect_invitation_activity' ||
      c === 'tmag_prospect_sessions' ||
      c === 'tmag_prospect_callback_requests',
  },
  {
    id: 'holding_tank_and_reentry',
    label: 'Holding tank, prospect account, and re-entry',
    steward: 'Prospect access / pool placement',
    surface: 'com + admin',
    tier: 'mixed',
    match: (c) =>
      c.startsWith('tmag_prospect_htank_') ||
      c === 'tmag_prospect_magic_links' ||
      c === 'tmag_prospect_webinar_events' ||
      c === 'tmag_prospect_webinar_reservations',
  },
  {
    id: 'prospect_crm',
    label: 'Prospect CRM and follow-up trail',
    steward: 'CRM domain',
    surface: 'team + admin',
    tier: 'mixed',
    match: (c) => c.startsWith('tmag_prospect_crm_') || c === 'tmag_prospect_timeline_events',
  },
  {
    id: 'vm_rvm',
    label: 'VM/RVM import, ownership, queue, and provider events',
    steward: 'VM/RVM domain',
    surface: 'admin + workers',
    tier: 'operational',
    match: (c) => c.startsWith('tmag_vm_'),
  },
  {
    id: 'agents_training_success',
    label: 'BA agents, training, success profile, and commitments',
    steward: 'Agent / training domain',
    surface: 'team + admin',
    tier: 'mixed',
    match: (c) =>
      c.startsWith('tmag_agent_') ||
      c === 'tmag_ivory_prospect_names' ||
      c === 'tmag_steve_success_interview' ||
      c === 'tmag_recruiting_cycles' ||
      c === 'tmag_fast_start_progress' ||
      c === 'tmag_commitments' ||
      c === 'tmag_questionnaires' ||
      c === 'tmag_workbooks' ||
      c === 'mcs_questionnaires' ||
      c === 'mcs_workbooks',
  },
  {
    id: 'knowledge_content',
    label: 'Knowledge, content, and retrieval governance',
    steward: 'Knowledge / content domain',
    surface: 'admin + runtime',
    tier: 'knowledge',
    match: (c) =>
      c.includes('knowledge') ||
      c.includes('graphrag') ||
      c.includes('learning_candidate') ||
      c === 'decisions' ||
      c === 'tmag_content_templates' ||
      c === 'tmag_content_videos' ||
      c === 'tmag_invitation_generator_runs',
  },
  {
    id: 'events_orientation_and_calls',
    label: 'Events, orientation, webinars, and three-way calls',
    steward: 'Events / orientation domain',
    surface: 'team + admin + workers',
    tier: 'operational',
    match: (c) =>
      c === 'webinar_events' ||
      c.includes('event_attendance') ||
      c.includes('orientation') ||
      c.includes('three_way') ||
      c === 'tmag_sponsor_availability',
  },
  {
    id: 'broadcast_delivery',
    label: 'Broadcast delivery and opt-out state',
    steward: 'Broadcast domain',
    surface: 'admin + workers',
    tier: 'operational',
    match: (c) => c.startsWith('broadcast'),
  },
  {
    id: 'operations_governance',
    label: 'Operations, audit, tenant, settings, and projection health',
    steward: 'Operations / governance',
    surface: 'admin + system',
    tier: 'operational',
    match: (c) =>
      c.includes('audit') ||
      c.includes('settings') ||
      c.includes('tenant') ||
      c === 'tmag_projection_outbox' ||
      c === 'mcs_outcomes' ||
      c === 'mcs_audit_log' ||
      c === 'tmag_admin_settings' ||
      c === 'tmag_admin_prospect_notes',
  },
  {
    id: 'dynamic_helper',
    label: 'Dynamic helper expression',
    steward: 'Owning caller resolves at runtime',
    surface: 'system',
    tier: 'mixed',
    match: (c, row) => !row.resolved,
  },
];

function ownerFor(row) {
  const collection = row.collection;
  const rule = OWNER_RULES.find((candidate) => candidate.match(collection, row));
  return (
    rule ?? {
      id: 'unclassified',
      label: 'Unclassified collection',
      steward: 'Needs owner assignment',
      surface: 'unknown',
      tier: 'unknown',
    }
  );
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

function buildMap(generatedAtOverride = null) {
  if (!existsSync(schemaPath)) {
    throw new Error('Schema catalog is missing. Run pnpm catalog:schema first.');
  }
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const collections = (schema.mongoCollections ?? []).map((row) => {
    const owner = ownerFor(row);
    return {
      collection: row.collection,
      ownerId: owner.id,
      owner: owner.label,
      steward: owner.steward,
      primarySurface: owner.surface,
      persistenceTier: owner.tier,
      schemaMode: row.schemaMode,
      resolved: row.resolved,
      sourceCount: row.sources?.length ?? 0,
      sourceFiles: [...new Set((row.sources ?? []).map((source) => source.file))].sort(),
    };
  });
  const unclassified = collections.filter((row) => row.ownerId === 'unclassified');
  const byOwner = collections.reduce((acc, row) => {
    acc[row.ownerId] = (acc[row.ownerId] ?? 0) + 1;
    return acc;
  }, {});
  return {
    generatedAt: generatedAtOverride ?? new Date().toISOString(),
    source: 'engineering/sprints/platform-audit-p1/schema-catalog.json',
    collectionCount: collections.length,
    unclassifiedCount: unclassified.length,
    byOwner,
    collections,
  };
}

function renderMarkdown(map) {
  const rows = map.collections
    .map(
      (row) =>
        `| \`${row.collection}\` | ${row.owner} | ${row.steward} | ${row.primarySurface} | ` +
        `${row.persistenceTier} | ${row.schemaMode} | ${row.resolved ? 'yes' : 'expression'} | ${row.sourceCount} |`,
    )
    .join('\n');
  const ownerRows = Object.entries(map.byOwner)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([owner, count]) => `| ${owner} | ${count} |`)
    .join('\n');

  return `# Mongo Collection Ownership Map

> Generated by \`node server/scripts/generate-mongo-ownership-map.mjs\`.
> Source: \`${map.source}\`.

## Summary

- Generated: ${map.generatedAt}
- Collections: ${map.collectionCount}
- Unclassified: ${map.unclassifiedCount}

## Collections By Owner

| Owner id | Collections |
| --- | ---: |
${ownerRows}

## Collection Ownership

| Collection | Owner | Steward | Primary surface | Persistence tier | Schema mode | Resolved string | Source count |
| --- | --- | --- | --- | --- | --- | --- | ---: |
${rows}
`;
}

function writeMap(map) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(map, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(map));
}

function assertCurrent(map) {
  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('Mongo ownership map files are missing. Run the generator.');
  }
  const expectedJson = `${JSON.stringify(map, null, 2)}\n`;
  const expectedMd = renderMarkdown(map);
  if (readFileSync(jsonPath, 'utf8') !== expectedJson || readFileSync(mdPath, 'utf8') !== expectedMd) {
    throw new Error('Mongo ownership map is stale. Run node server/scripts/generate-mongo-ownership-map.mjs');
  }
}

if (check) {
  const map = buildMap(readExistingGeneratedAt());
  assertCurrent(map);
  console.log(`Mongo ownership map is current (${map.collectionCount} collections, ${map.unclassifiedCount} unclassified).`);
} else {
  const map = buildMap();
  writeMap(map);
  console.log(`Wrote Mongo ownership map (${map.collectionCount} collections, ${map.unclassifiedCount} unclassified).`);
}
