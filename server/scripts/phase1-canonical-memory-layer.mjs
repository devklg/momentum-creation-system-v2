#!/usr/bin/env node
/**
 * Phase 1 Canonical Memory Layer.
 *
 * Creates memory-only canonical containers and imports legacy records as
 * provenance-backed source material. It does not delete, edit, merge, or trust
 * legacy rows in place.
 *
 * Dry-run by default.
 *
 * Usage:
 *   node server/scripts/phase1-canonical-memory-layer.mjs
 *   node server/scripts/phase1-canonical-memory-layer.mjs --apply --limit-per-source=50
 *   node server/scripts/phase1-canonical-memory-layer.mjs --apply --limit-per-source=all
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const GATEWAY_URL = valueArg('--gateway-url') || process.env.GATEWAY_URL || 'http://localhost:2525';
const APPLY = process.argv.includes('--apply');
const limitArg = valueArg('--limit-per-source') || '50';
const LIMIT_PER_SOURCE = limitArg.toLowerCase() === 'all' ? null : Number(limitArg);
const LOG_DIR = process.env.PHASE1_LOG_DIR || path.resolve('.logs');
const DATABASE = 'universal_gateway';
const NAMESPACE = 'universal_gateway';

const startedAt = new Date().toISOString();
const runId = `canonical_memory_${startedAt.replace(/[-:.]/g, '').replace('T', '_').replace('Z', 'Z')}`;

const CANONICAL_CONTAINERS = [
  { collection: 'memory_imports', chroma: 'memory_imports', label: 'MemoryImport', type: 'import_batch' },
  { collection: 'memory_sources', chroma: 'memory_sources', label: 'MemorySource', type: 'source_record' },
  { collection: 'memory_conversations', chroma: 'memory_conversations', label: 'Conversation', type: 'conversation' },
  { collection: 'memory_transcripts', chroma: 'memory_transcripts', label: 'Transcript', type: 'transcript' },
  { collection: 'memory_handoffs', chroma: 'memory_handoffs', label: 'Handoff', type: 'handoff' },
  { collection: 'memory_decisions', chroma: 'memory_decisions', label: 'Decision', type: 'decision' },
  { collection: 'memory_learning_notes', chroma: 'memory_learning_notes', label: 'LearningNote', type: 'learning_note' },
  { collection: 'memory_documents', chroma: 'memory_documents', label: 'Document', type: 'document' },
  { collection: 'memory_chunks', chroma: 'memory_chunks', label: 'Chunk', type: 'chunk' },
  { collection: 'memory_entities', chroma: 'memory_entities', label: 'Entity', type: 'entity' },
];

const LEGACY_SOURCES = [
  { collection: 'session_handoffs', target: 'memory_handoffs', type: 'handoff', label: 'Handoff' },
  { collection: 'PerryHandoff', target: 'memory_handoffs', type: 'handoff', label: 'Handoff' },
  { collection: 'chat_handoffs', target: 'memory_handoffs', type: 'handoff', label: 'Handoff' },
  { collection: 'perry_handoffs', target: 'memory_handoffs', type: 'handoff', label: 'Handoff' },
  { collection: 'persisted_sessions', target: 'memory_conversations', type: 'conversation', label: 'Conversation' },
  { collection: 'perry_sessions', target: 'memory_conversations', type: 'conversation', label: 'Conversation' },
  { collection: 'perry_conversations', target: 'memory_conversations', type: 'conversation', label: 'Conversation' },
  { collection: 'kevin_memory_chats', target: 'memory_conversations', type: 'conversation', label: 'Conversation' },
  { collection: 'foundational_chats', target: 'memory_conversations', type: 'conversation', label: 'Conversation' },
  { collection: 'kevin_milestone_chats', target: 'memory_conversations', type: 'conversation', label: 'Conversation' },
  { collection: 'chatgpt_conversations', target: 'memory_conversations', type: 'conversation', label: 'Conversation' },
  { collection: 'chatgpt_messages', target: 'memory_transcripts', type: 'transcript', label: 'Transcript' },
  { collection: 'codex_session_notes', target: 'memory_sources', type: 'source_record', label: 'MemorySource' },
  { collection: 'claude_learning_notes', target: 'memory_learning_notes', type: 'learning_note', label: 'LearningNote' },
  { collection: 'kevin_decisions', target: 'memory_decisions', type: 'decision', label: 'Decision' },
  { collection: 'agent_message_board', target: 'memory_sources', type: 'source_record', label: 'MemorySource' },
  { collection: 'schema_contracts', target: 'memory_documents', type: 'document', label: 'Document' },
  { collection: 'archie_documents', target: 'memory_documents', type: 'document', label: 'Document' },
  { collection: 'kevin_library', target: 'memory_documents', type: 'document', label: 'Document' },
];

const report = {
  run_id: runId,
  started_at: startedAt,
  mode: APPLY ? 'apply' : 'dry_run',
  gateway_url: GATEWAY_URL,
  database: DATABASE,
  namespace: NAMESPACE,
  containers: { planned: CANONICAL_CONTAINERS.length, chroma_created: 0, manifest_written: 0, skipped_existing: 0, failures: [] },
  imports: { sources_scanned: 0, legacy_rows_scanned: 0, planned: 0, written: 0, skipped_existing: 0, failures: [] },
  checks: {},
  warnings: [],
};

function valueArg(name) {
  const found = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

function stableJson(value) {
  return JSON.stringify(value, (key, child) => {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return Object.keys(child).sort().reduce((out, objectKey) => {
        out[objectKey] = child[objectKey];
        return out;
      }, {});
    }
    return child;
  });
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function shortHash(value) {
  return hash(value).slice(0, 24);
}

function iso(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

function text(value, max = 12000) {
  if (value == null) return '';
  if (typeof value === 'string') return value.slice(0, max);
  return stableJson(value).slice(0, max);
}

function embeddingText(value, max = 12000) {
  return text(value, max)
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .slice(0, max);
}

function titleFrom(doc, collection) {
  return text(
    doc.title ||
    doc.name ||
    doc.subject ||
    doc.summary ||
    doc.content?.slice?.(0, 120) ||
    doc._id ||
    `${collection} record`,
    240,
  );
}

function createdAtFrom(doc) {
  return iso(doc.created_at || doc.createdAt || doc.timestamp || doc.date || doc.updated_at || doc.updatedAt, new Date(startedAt));
}

function sourceKey(collection, doc) {
  const rawId = doc._id || doc.id || doc.uuid || doc.conversation_id || doc.session_id || stableJson(doc).slice(0, 500);
  return `${DATABASE}.${collection}:${String(rawId)}`;
}

function memoryId(collection, doc, type) {
  return `mem_${type}_${shortHash(sourceKey(collection, doc))}`;
}

function neo4jProps(record) {
  const props = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      props[key] = value;
    } else if (Array.isArray(value) && value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
      props[key] = value;
    } else {
      props[`${key}_json`] = JSON.stringify(value).slice(0, 8000);
    }
  }
  return props;
}

function chromaMetadata(record) {
  return {
    id: record.id,
    type: record.type,
    namespace: record.namespace,
    source: record.source,
    origin_kind: record.origin_kind,
    source_collection: record.legacy?.collection || '',
    legacy_id: String(record.legacy?.id || ''),
    chat_registry_id: record.chat_registry_id || '',
    import_batch_id: record.import_batch_id || '',
  };
}

function chromaText(record) {
  return embeddingText([
    record.title,
    `Type: ${record.type}`,
    `Source: ${record.legacy?.database || DATABASE}.${record.legacy?.collection || record.source}`,
    record.chat_number ? `Chat: ${record.chat_number}` : '',
    record.summary || '',
    record.excerpt || '',
  ].filter(Boolean).join('\n\n'), 12000);
}

async function gw(tool, action, params = {}) {
  const response = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, action, params }),
  });
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(`${tool}.${action} returned HTTP ${response.status}: ${raw.slice(0, 500)}`);
  }
  if (!response.ok || body.success === false) {
    throw new Error(`${tool}.${action} failed HTTP ${response.status}: ${body.error || raw.slice(0, 500)}`);
  }
  return body.data;
}

async function healthCheck() {
  const health = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/health`).then((r) => r.json());
  report.checks.gateway_health = health.status;
  const tools = await fetch(`${GATEWAY_URL.replace(/\/$/, '')}/api/tools`).then((r) => r.json());
  const toolList = tools.data || tools.tools || [];
  const names = new Set(toolList.map((tool) => tool.name));
  for (const required of ['mongodb', 'neo4j', 'chromadb', 'quadstack']) {
    report.checks[`${required}_available`] = names.has(required);
  }
}

async function listMongoCollections() {
  const data = await gw('mongodb', 'list_collections', { database: DATABASE });
  return new Set((data.collections || []).map((collection) => collection.name || collection));
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
  await gw('chromadb', 'create_collection', { name, metadata: { namespace: NAMESPACE, purpose: 'canonical_memory' } });
  report.containers.chroma_created += 1;
}

async function exists(collection, id) {
  const found = await gw('mongodb', 'query', {
    database: DATABASE,
    collection,
    filter: { _id: id },
    limit: 1,
  });
  return (found.documents || []).length > 0;
}

async function writeCanonical(record, collection, label, chromaCollection) {
  return gw('quadstack', 'write', {
    base: {
      id: record.id,
      type: record.type,
      schema_version: 1,
      namespace: NAMESPACE,
      source: 'phase1-canonical-memory-layer',
      created_at: record.created_at || startedAt,
      title: record.title,
      origin_kind: record.origin_kind,
      import_batch_id: record.import_batch_id || runId,
      ...(record.chat_number ? { chat_number: record.chat_number } : {}),
      ...(record.service_name ? { service_name: record.service_name } : {}),
    },
    mongo: { database: DATABASE, collection, doc: record },
    neo4j: {
      query: `MERGE (n:${label} {id:$id}) SET n += $props RETURN n.id AS id`,
      params: { id: record.id, props: neo4jProps(record) },
    },
    chroma: {
      collection: chromaCollection,
      ids: [record.id],
      documents: [chromaText(record)],
      metadatas: [chromaMetadata(record)],
    },
    options: { require: ['mongo', 'neo4j', 'chroma'], enforce_schema: true },
  });
}

function manifestRecord(container) {
  const id = `memory_container_${container.collection}`;
  return {
    _id: id,
    id,
    type: 'schema_contract',
    schema_version: 1,
    namespace: NAMESPACE,
    source: 'phase1-canonical-memory-layer',
    created_at: startedAt,
    title: `Canonical memory container: ${container.collection}`,
    origin_kind: 'system',
    service_name: 'canonical_memory_layer',
    collection: container.collection,
    chroma_collection: container.chroma,
    neo4j_label: container.label,
    record_type: container.type,
    import_batch_id: runId,
    policy: [
      'canonical memory only',
      'legacy rows remain source evidence',
      'stable ids derived from source database, collection, and source id',
    ],
  };
}

function importBatchRecord() {
  const id = `memory_import_${runId}`;
  return {
    _id: id,
    id,
    type: 'import_batch',
    schema_version: 1,
    namespace: NAMESPACE,
    source: 'phase1-canonical-memory-layer',
    created_at: startedAt,
    title: `Canonical memory import ${runId}`,
    origin_kind: 'import',
    import_batch_id: runId,
    source_collections: LEGACY_SOURCES.map((source) => `${DATABASE}.${source.collection}`),
    target_collections: CANONICAL_CONTAINERS.map((container) => `${DATABASE}.${container.collection}`),
    mode: APPLY ? 'apply' : 'dry_run',
  };
}

function normalizeLegacyRecord(source, doc) {
  const id = memoryId(source.collection, doc, source.type);
  const rawText = text(doc.content || doc.summary || doc.messages || doc.transcript || doc, 16000);
  const sourceId = doc._id || doc.id || doc.uuid || doc.conversation_id || doc.session_id || null;
  const rawTitle = titleFrom(doc, source.collection);
  const safeTitle = embeddingText(rawTitle, 240).trim() || `${source.collection} record`;
  return {
    _id: id,
    id,
    type: source.type,
    schema_version: 1,
    namespace: NAMESPACE,
    source: 'phase1-canonical-memory-layer',
    created_at: createdAtFrom(doc),
    title: safeTitle,
    legacy_title: rawTitle === safeTitle ? null : rawTitle,
    origin_kind: 'import',
    import_batch_id: runId,
    chat_registry_id: doc.chat_registry_id || null,
    chat_number: Number.isInteger(doc.chat_number) ? doc.chat_number : null,
    summary: text(doc.summary || doc.content || doc.title || '', 2000),
    excerpt: rawText.slice(0, 3000),
    content_hash: hash(stableJson(doc)),
    legacy: {
      database: DATABASE,
      collection: source.collection,
      id: sourceId == null ? null : String(sourceId),
      source_key: sourceKey(source.collection, doc),
      imported_at: startedAt,
      import_batch_id: runId,
    },
    provenance: {
      entity_id: id,
      was_generated_by: runId,
      was_attributed_to: 'phase1-canonical-memory-layer',
      generated_at: startedAt,
      used_entities: [sourceKey(source.collection, doc)],
    },
    lineage: {
      job_namespace: NAMESPACE,
      job_name: 'phase1-canonical-memory-layer',
      run_id: runId,
      inputs: [`${DATABASE}.${source.collection}`],
      outputs: [`${DATABASE}.${source.target}`, `neo4j.${source.label}`, `chroma.${source.target}`],
    },
  };
}

async function ensureContainers() {
  for (const container of CANONICAL_CONTAINERS) {
    await ensureChromaCollection(container.chroma);
    const record = manifestRecord(container);
    const existsInMongo = await exists('schema_contracts', record.id);
    if (existsInMongo) {
      report.containers.skipped_existing += 1;
      continue;
    }
    if (!APPLY) continue;
    try {
      await writeCanonical(record, 'schema_contracts', 'SchemaContract', 'schema_contracts');
      report.containers.manifest_written += 1;
    } catch (error) {
      report.containers.failures.push({ id: record.id, error: error.message });
    }
  }

  const batch = importBatchRecord();
  if (!(await exists('memory_imports', batch.id))) {
    if (APPLY) {
      try {
        await writeCanonical(batch, 'memory_imports', 'MemoryImport', 'memory_imports');
        report.containers.manifest_written += 1;
      } catch (error) {
        report.containers.failures.push({ id: batch.id, error: error.message });
      }
    }
  } else {
    report.containers.skipped_existing += 1;
  }
}

async function importLegacySources(collections) {
  for (const source of LEGACY_SOURCES) {
    if (!collections.has(source.collection)) {
      report.warnings.push(`legacy source missing: ${DATABASE}.${source.collection}`);
      continue;
    }
    report.imports.sources_scanned += 1;
    const data = await gw('mongodb', 'query', {
      database: DATABASE,
      collection: source.collection,
      filter: {},
      sort: { created_at: -1, updated_at: -1 },
      ...(LIMIT_PER_SOURCE == null ? {} : { limit: LIMIT_PER_SOURCE }),
    });
    for (const doc of data.documents || []) {
      report.imports.legacy_rows_scanned += 1;
      const record = normalizeLegacyRecord(source, doc);
      report.imports.planned += 1;
      if (await exists(source.target, record.id)) {
        report.imports.skipped_existing += 1;
        continue;
      }
      if (!APPLY) continue;
      try {
        await writeCanonical(record, source.target, source.label, source.target);
        report.imports.written += 1;
      } catch (error) {
        report.imports.failures.push({ id: record.id, source: source.collection, error: error.message });
      }
    }
  }
}

async function main() {
  await healthCheck();
  const collections = await listMongoCollections();
  await ensureChromaCollection('schema_contracts');
  await ensureContainers();
  await importLegacySources(collections);
  await fs.mkdir(LOG_DIR, { recursive: true });
  const reportPath = path.join(LOG_DIR, `${runId}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...report, report_path: reportPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
