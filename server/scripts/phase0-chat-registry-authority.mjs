#!/usr/bin/env node
/**
 * Phase 0 Chat Registry Authority.
 *
 * Dry-run by default. In --apply mode it only adds registry/contract records;
 * it does not delete legacy rows, merge databases, or assign guessed chat
 * numbers to uncertain Codex/Claude records.
 *
 * Usage:
 *   node server/scripts/phase0-chat-registry-authority.mjs
 *   node server/scripts/phase0-chat-registry-authority.mjs --apply --limit=250
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const GATEWAY_URL = valueArg('--gateway-url') || process.env.GATEWAY_URL || 'http://localhost:2525';
const APPLY = process.argv.includes('--apply');
const LIMIT = Number(valueArg('--limit') || 250);
const LOG_DIR = process.env.PHASE0_LOG_DIR || path.resolve('.logs');

const startedAt = new Date().toISOString();
const runId = `chat_registry_authority_${startedAt.replace(/[-:.]/g, '').replace('T', '_').replace('Z', 'Z')}`;

const report = {
  run_id: runId,
  started_at: startedAt,
  mode: APPLY ? 'apply' : 'dry_run',
  gateway_url: GATEWAY_URL,
  standards: ['W3C PROV', 'OpenLineage', 'JSON Schema 2020-12', 'RFC 9562 UUIDv7'],
  checks: {},
  contract: { planned: true, written: false, skipped_existing: false, error: null },
  candidates: { scanned: 0, planned: 0, registered: 0, needs_reconciliation: 0, skipped_existing: 0, failures: [] },
  mirrors: { existing_mongo: 0, neo4j_repaired: 0, chroma_refreshed: 0, failures: [] },
  warnings: [],
};

function valueArg(name) {
  const found = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

function iso(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

function intOrNull(value) {
  if (Number.isInteger(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function slug(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'unknown';
}

function shortHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function uuidv7() {
  const bytes = crypto.randomBytes(16);
  const ms = BigInt(Date.now());
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function gw(tool, action, params = {}) {
  const response = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, action, params }),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${tool}.${action} returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!response.ok || body.success === false) {
    throw new Error(`${tool}.${action} failed HTTP ${response.status}: ${body.error || text.slice(0, 500)}`);
  }
  return body.data;
}

async function healthCheck() {
  const health = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/health`).then((r) => r.json());
  report.checks.gateway_health = health.status;
  const tools = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/api/tools`).then((r) => r.json());
  const names = new Set((tools.data || []).map((tool) => tool.name));
  for (const required of ['mongodb', 'neo4j', 'chromadb', 'quadstack']) {
    report.checks[`${required}_available`] = names.has(required);
  }
}

async function ensureChromaCollection(name) {
  const data = await gw('chromadb', 'list_collections', {});
  const collections = data.collections || data || [];
  const names = new Set(collections.map((item) => item.name || item));
  if (names.has(name)) return;
  if (!APPLY) {
    report.warnings.push(`would create Chroma collection ${name}`);
    return;
  }
  await gw('chromadb', 'create_collection', { name, metadata: { authority: 'gateway_chat_registry' } });
}

async function exists(collection, id) {
  const found = await gw('mongodb', 'query', {
    database: 'universal_gateway',
    collection,
    filter: { _id: id },
    limit: 1,
  });
  return (found.documents || []).length > 0;
}

function neo4jProps(record) {
  const props = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      props[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
      props[key] = value;
      continue;
    }
    props[`${key}_json`] = JSON.stringify(value).slice(0, 8000);
  }
  return props;
}

function chromaText(record) {
  return [
    record.title,
    `Provider: ${record.provider || record.source || 'unknown'}`,
    `Status: ${record.registration_status || record.authority_rule || ''}`,
    record.task_id ? `Task: ${record.task_id}` : '',
  ].filter(Boolean).join('\n');
}

function chromaMetadata(record) {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    chat_number: record.chat_number ?? '',
    registration_status: record.registration_status || '',
    provider: record.provider || '',
    source: 'phase0-chat-registry-authority',
  };
}

function makeContractRecord() {
  const id = 'schema_contract_chat_registry_authority_v1';
  return {
    _id: id,
    id,
    type: 'schema_contract',
    schema_version: 1,
    namespace: 'universal_gateway',
    source: 'phase0-chat-registry-authority',
    created_at: startedAt,
    title: 'Gateway Chat Registry Authority v1',
    origin_kind: 'system',
    service_name: 'chat_registry',
    authority_collection: 'universal_gateway.chat_registry',
    authority_rule: 'chat_registry owns chat identity; handoffs, ARCHIE import pipeline, Perry handoff tool, Ulyses gateway role/tool, and GraphRAG attach to it but do not act as identity authorities',
    standards_basis: report.standards,
    required_policy: [
      'chat_number is integer-only',
      'provider and importer are separate fields',
      'unknown records use needs_reconciliation without guessed numbers',
      'Kevin corrections are audited overrides',
      'new memory records carry chat_registry_id when chat-origin',
    ],
    docs: ['docs/chat-registry-authority.md', 'docs/graphrag-schema-contract.md', 'docs/handoff-contract.md'],
  };
}

function makeRegistryEntryFromHandoff(doc) {
  const directNumber = intOrNull(doc.chat_number);
  const idText = doc._id || doc.id || doc.title || crypto.randomUUID();
  const titleNumber = String(doc.title || '').match(/\bChat\s*#\s*(\d{1,6})\b/i)?.[1];
  const titleInt = intOrNull(titleNumber);
  const hasTaskSlug = doc.chat_number && directNumber === null;
  const consistent = directNumber && (!titleInt || titleInt === directNumber) && (!String(doc._id || '').startsWith('handoff_chat_') || String(doc._id) === `handoff_chat_${directNumber}`);
  const status = consistent ? 'registered' : 'needs_reconciliation';
  const chatNumber = consistent ? directNumber : null;
  const registryId = chatNumber
    ? `chatreg_${chatNumber}`
    : `chatreg_unresolved_${slug(doc.chat_number || doc._id || doc.title)}_${shortHash(idText)}`;
  const createdAt = iso(doc.created_at || doc.date || doc.updated_at, new Date(startedAt));

  return {
    _id: registryId,
    id: registryId,
    registry_uuid: uuidv7(),
    type: 'chat_registry_entry',
    schema_version: 1,
    chat_number: chatNumber,
    chat_number_source: chatNumber ? 'migration_inferred' : 'not_assigned',
    chat_number_confidence: chatNumber ? 'high' : 'none',
    provider: doc.session_id?.startsWith('tm_codex_session') ? 'codex' : 'unknown',
    provider_thread_id: null,
    provider_conversation_id: null,
    provider_url: null,
    namespace: 'universal_gateway',
    cwd: null,
    title: doc.title || (chatNumber ? `Chat #${chatNumber}` : `Unreconciled handoff ${doc._id || doc.chat_number || ''}`.trim()),
    created_at: createdAt,
    updated_at: iso(doc.updated_at || doc.created_at || doc.date, new Date(startedAt)),
    registered_at: startedAt,
    registered_by: 'phase0-chat-registry-authority',
    registration_status: status,
    source_kind: 'handoff',
    ingest_method: 'migration',
    canonicality: status === 'registered' ? 'summary' : 'unknown',
    task_id: hasTaskSlug ? String(doc.chat_number) : null,
    evidence: {
      handoff_id: doc._id || null,
      session_id: doc.session_id || null,
      title_chat_number: titleInt,
      original_chat_number_value: doc.chat_number ?? null,
    },
    provenance: {
      entity_id: registryId,
      was_generated_by: runId,
      was_attributed_to: 'codex',
      generated_at: startedAt,
      used_entities: [String(doc._id || '')].filter(Boolean),
    },
    lineage: {
      job_namespace: 'universal_gateway',
      job_name: 'phase0-chat-registry-authority',
      run_id: runId,
      inputs: ['universal_gateway.session_handoffs'],
      outputs: ['universal_gateway.chat_registry', 'neo4j.ChatRegistry', 'chroma.chat_registry'],
    },
    override_history: [],
  };
}

async function writeViaQuadstack(record, collection, label) {
  return await gw('quadstack', 'write', {
    base: {
      id: record.id,
      type: record.type,
      schema_version: 1,
      namespace: 'universal_gateway',
      source: 'phase0-chat-registry-authority',
      created_at: record.created_at || startedAt,
      title: record.title,
      origin_kind: 'import',
      import_batch_id: runId,
    },
    mongo: { database: 'universal_gateway', collection, doc: record },
    neo4j: {
      query: `MERGE (n:${label} {id:$id}) SET n += $props RETURN n.id AS id`,
      params: { id: record.id, props: neo4jProps(record) },
    },
    chroma: {
      collection: collection === 'chat_registry' ? 'chat_registry' : 'schema_contracts',
      ids: [record.id],
      documents: [chromaText(record)],
      metadatas: [chromaMetadata(record)],
    },
    options: { require: ['mongo', 'neo4j', 'chroma'], enforce_schema: true },
  });
}

async function repairMirrors(record, collection, label) {
  await gw('neo4j', 'cypher', {
    query: `MERGE (n:${label} {id:$id}) SET n += $props RETURN n.id AS id`,
    params: { id: record.id, props: neo4jProps(record) },
  });
  report.mirrors.neo4j_repaired += 1;

  const chromaCollection = collection === 'chat_registry' ? 'chat_registry' : 'schema_contracts';
  await gw('chromadb', 'delete', { collection: chromaCollection, ids: [record.id] }).catch(() => null);
  await gw('chromadb', 'add', {
    collection: chromaCollection,
    ids: [record.id],
    documents: [chromaText(record)],
    metadatas: [chromaMetadata(record)],
  });
  report.mirrors.chroma_refreshed += 1;
}

async function writeContract() {
  const record = makeContractRecord();
  if (await exists('schema_contracts', record.id)) {
    report.contract.skipped_existing = true;
    return;
  }
  if (!APPLY) return;
  try {
    await writeViaQuadstack(record, 'schema_contracts', 'SchemaContract');
    report.contract.written = true;
  } catch (error) {
    report.contract.error = error.message;
  }
}

async function scanHandoffs() {
  const data = await gw('mongodb', 'query', {
    database: 'universal_gateway',
    collection: 'session_handoffs',
    filter: {},
    sort: { created_at: -1 },
    limit: LIMIT,
  });

  for (const doc of data.documents || []) {
    report.candidates.scanned += 1;
    const entry = makeRegistryEntryFromHandoff(doc);
    report.candidates.planned += 1;
    if (entry.registration_status === 'registered') report.candidates.registered += 1;
    if (entry.registration_status === 'needs_reconciliation') report.candidates.needs_reconciliation += 1;

    const existsInMongo = await exists('chat_registry', entry.id);
    if (existsInMongo) {
      report.candidates.skipped_existing += 1;
      report.mirrors.existing_mongo += 1;
      if (APPLY) {
        try {
          await repairMirrors(entry, 'chat_registry', 'ChatRegistry');
        } catch (error) {
          report.mirrors.failures.push({ id: entry.id, error: error.message });
        }
      }
      continue;
    }
    if (!APPLY) continue;
    try {
      await writeViaQuadstack(entry, 'chat_registry', 'ChatRegistry');
    } catch (error) {
      report.candidates.failures.push({ id: entry.id, error: error.message });
    }
  }
}

async function main() {
  await healthCheck();
  await ensureChromaCollection('chat_registry');
  await ensureChromaCollection('schema_contracts');
  await writeContract();
  await scanHandoffs();
  await fs.mkdir(LOG_DIR, { recursive: true });
  const reportPath = path.join(LOG_DIR, `${runId}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...report, report_path: reportPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
