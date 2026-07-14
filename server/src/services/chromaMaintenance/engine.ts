import type { KnowledgeReindexRequest } from '../../runtime/knowledge-evolution/indexing/knowledgeEvolutionReindex.service.js';
import {
  assertChromaMaintenanceCapability,
  CHROMA_MAINTENANCE_EXCLUDED_COLLECTIONS,
  getChromaMaintenanceManifestEntry,
  type ChromaMaintenanceManifestEntry,
} from './manifest.js';

export type ChromaMaintenanceMode = 'audit' | 'reindex' | 'age_out';
export type CanonicalMaintenanceAction = 'upsert' | 'remove' | 'blocked';

export interface CanonicalMaintenanceItem {
  cursor: string;
  action: CanonicalMaintenanceAction;
  reason: string;
  expectedId: string;
  request: KnowledgeReindexRequest;
}

export interface CanonicalMaintenanceBatch {
  items: CanonicalMaintenanceItem[];
  nextCursor: string | null;
}

export interface ChromaProjectionPage {
  count: number;
  metadatas: Array<Record<string, unknown> | null>;
}

export type ChromaVerificationState = 'match' | 'missing' | 'mismatch' | 'stale_present';

export interface ChromaMaintenancePort {
  listCollections(): Promise<Array<{
    name: string;
    metadata?: Record<string, unknown>;
    dimension?: number | null;
  }>>;
  listProjectionPage(input: {
    collection: string;
    offset: number;
    limit: number;
  }): Promise<ChromaProjectionPage>;
  loadCanonicalBatch(input: {
    entry: ChromaMaintenanceManifestEntry;
    cursor: string | null;
    limit: number;
  }): Promise<CanonicalMaintenanceBatch>;
  verify(item: CanonicalMaintenanceItem): Promise<ChromaVerificationState>;
  upsert(item: CanonicalMaintenanceItem): Promise<void>;
  remove(item: CanonicalMaintenanceItem): Promise<void>;
  assertApplyAuthorization(input: {
    decisionId: string;
    mode: Exclude<ChromaMaintenanceMode, 'audit'>;
    collections: string[];
    evidenceSha256: string;
  }): Promise<void>;
}

export interface ChromaMaintenanceOptions {
  mode: ChromaMaintenanceMode;
  collections: string[];
  apply?: boolean;
  confirm?: string;
  approvalRef?: string;
  evidenceSha256?: string;
  batchSize?: number;
  maxRecords?: number;
  cursor?: string | null;
  now?: Date;
}

export interface ChromaMaintenanceCollectionReport {
  collection: string;
  retentionClass: ChromaMaintenanceManifestEntry['retentionClass'];
  capabilities: readonly string[];
  liveCollectionPresent: boolean;
  liveMetadataModel: string | null;
  liveDimension: number | null;
  liveRecordsObserved: number;
  liveScanTruncated: boolean;
  ageBuckets: {
    under30Days: number;
    days30To90: number;
    over90Days: number;
    unknown: number;
  };
  canonicalRecordsExamined: number;
  reindexCandidates: number;
  ageOutCandidates: number;
  blockedCandidates: number;
  currentlyMatching: number;
  currentlyMissing: number;
  currentlyMismatched: number;
  stalePresent: number;
  appliedUpserts: number;
  appliedRemovals: number;
  nextCursor: string | null;
}

export interface ChromaMaintenanceReport {
  schemaVersion: 'chroma-maintenance-report.v1';
  generatedAt: string;
  mode: ChromaMaintenanceMode;
  apply: boolean;
  approvalRef: string | null;
  requestedCollections: string[];
  liveCollectionCount: number;
  unownedLiveCollections: string[];
  collections: ChromaMaintenanceCollectionReport[];
  summary: {
    liveRecordsObserved: number;
    canonicalRecordsExamined: number;
    reindexCandidates: number;
    ageOutCandidates: number;
    blockedCandidates: number;
    appliedUpserts: number;
    appliedRemovals: number;
  };
}

const TIMESTAMP_KEYS = [
  'indexedAt',
  'updatedAt',
  'createdAt',
  'timestamp',
  'occurredAt',
  'recordedAt',
] as const;

function boundedInteger(value: number | undefined, fallback: number, max: number): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > max) {
    throw new Error(`expected integer between 1 and ${max}, received ${resolved}`);
  }
  return resolved;
}

function assertApplyGate(options: ChromaMaintenanceOptions): void {
  if (!options.apply) return;
  if (options.mode === 'audit') throw new Error('audit mode never accepts --apply');
  if (options.confirm !== 'P2-133') {
    throw new Error("apply mode requires --confirm P2-133");
  }
  if (!options.approvalRef?.startsWith('dec_p2_133_chroma_live_apply_')) {
    throw new Error(
      'apply mode requires a dedicated --approval-ref dec_p2_133_chroma_live_apply_<timestamp>',
    );
  }
  if (!/^[a-f0-9]{64}$/i.test(options.evidenceSha256 ?? '')) {
    throw new Error('apply mode requires an exact --evidence-sha256 dry-run report digest');
  }
}

export function preflightChromaMaintenance(options: ChromaMaintenanceOptions): void {
  assertApplyGate(options);
  boundedInteger(options.batchSize, 50, 100);
  boundedInteger(options.maxRecords, 10_000, 100_000);
  const requestedCollections = [...new Set(options.collections)];
  if (requestedCollections.length === 0) throw new Error('at least one --collection is required');
  const capability = options.mode === 'age_out' ? 'age_out' : options.mode;
  for (const collection of requestedCollections) {
    assertChromaMaintenanceCapability(collection, capability);
  }
}

function duplicateCanonicalIdentity(items: CanonicalMaintenanceItem[]): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    const key = [item.request.domain, item.request.language,
      item.request.knowledgeObjectId, item.request.version].join(':');
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}

function ageBucket(
  metadata: Record<string, unknown> | null,
  now: Date,
): keyof ChromaMaintenanceCollectionReport['ageBuckets'] {
  if (!metadata) return 'unknown';
  let parsed: number | null = null;
  for (const key of TIMESTAMP_KEYS) {
    const value = metadata[key];
    if (typeof value !== 'string') continue;
    const candidate = Date.parse(value);
    if (Number.isFinite(candidate)) {
      parsed = candidate;
      break;
    }
  }
  if (parsed === null) return 'unknown';
  const days = Math.max(0, (now.getTime() - parsed) / 86_400_000);
  if (days < 30) return 'under30Days';
  if (days <= 90) return 'days30To90';
  return 'over90Days';
}

function blankCollectionReport(
  entry: ChromaMaintenanceManifestEntry,
): ChromaMaintenanceCollectionReport {
  return {
    collection: entry.collection,
    retentionClass: entry.retentionClass,
    capabilities: entry.capabilities,
    liveCollectionPresent: false,
    liveMetadataModel: null,
    liveDimension: null,
    liveRecordsObserved: 0,
    liveScanTruncated: false,
    ageBuckets: { under30Days: 0, days30To90: 0, over90Days: 0, unknown: 0 },
    canonicalRecordsExamined: 0,
    reindexCandidates: 0,
    ageOutCandidates: 0,
    blockedCandidates: 0,
    currentlyMatching: 0,
    currentlyMissing: 0,
    currentlyMismatched: 0,
    stalePresent: 0,
    appliedUpserts: 0,
    appliedRemovals: 0,
    nextCursor: null,
  };
}

async function scanLiveProjection(
  report: ChromaMaintenanceCollectionReport,
  port: ChromaMaintenancePort,
  batchSize: number,
  maxRecords: number,
  now: Date,
): Promise<void> {
  if (!report.liveCollectionPresent) return;
  let offset = 0;
  while (offset < maxRecords) {
    const limit = Math.min(batchSize, maxRecords - offset);
    const page = await port.listProjectionPage({
      collection: report.collection,
      offset,
      limit,
    });
    report.liveRecordsObserved += page.count;
    for (const metadata of page.metadatas) report.ageBuckets[ageBucket(metadata, now)] += 1;
    offset += page.count;
    if (page.count < limit) return;
  }
  report.liveScanTruncated = true;
}

async function loadCanonicalItems(
  entry: ChromaMaintenanceManifestEntry,
  port: ChromaMaintenancePort,
  batchSize: number,
  maxRecords: number,
  initialCursor: string | null,
): Promise<{ items: CanonicalMaintenanceItem[]; nextCursor: string | null }> {
  if (!entry.projector) return { items: [], nextCursor: null };
  const items: CanonicalMaintenanceItem[] = [];
  let cursor = initialCursor;
  while (items.length < maxRecords) {
    const limit = Math.min(batchSize, maxRecords - items.length);
    const batch = await port.loadCanonicalBatch({ entry, cursor, limit });
    items.push(...batch.items);
    if (!batch.nextCursor || batch.items.length === 0) return { items, nextCursor: null };
    if (batch.nextCursor === cursor) throw new Error('canonical cursor did not advance');
    cursor = batch.nextCursor;
  }
  return { items, nextCursor: cursor };
}

function recordVerification(
  report: ChromaMaintenanceCollectionReport,
  state: ChromaVerificationState,
): void {
  if (state === 'match') report.currentlyMatching += 1;
  else if (state === 'missing') report.currentlyMissing += 1;
  else if (state === 'mismatch') report.currentlyMismatched += 1;
  else report.stalePresent += 1;
}

export async function runChromaMaintenance(
  options: ChromaMaintenanceOptions,
  port: ChromaMaintenancePort,
): Promise<ChromaMaintenanceReport> {
  preflightChromaMaintenance(options);
  const batchSize = boundedInteger(options.batchSize, 50, 100);
  const maxRecords = boundedInteger(options.maxRecords, 10_000, 100_000);
  const requestedCollections = [...new Set(options.collections)];
  if (requestedCollections.length === 0) throw new Error('at least one --collection is required');
  if (requestedCollections.length > 1 && options.cursor) {
    throw new Error('--cursor is collection-specific; resume one collection at a time');
  }

  const capability = options.mode === 'age_out' ? 'age_out' : options.mode;
  const entries = requestedCollections.map((collection) =>
    assertChromaMaintenanceCapability(collection, capability),
  );

  if (options.apply) {
    await port.assertApplyAuthorization({
      decisionId: options.approvalRef as string,
      mode: options.mode as Exclude<ChromaMaintenanceMode, 'audit'>,
      collections: requestedCollections,
      evidenceSha256: options.evidenceSha256 as string,
    });
  }

  const liveCollections = await port.listCollections();
  const liveByName = new Map(liveCollections.map((collection) => [collection.name, collection]));
  const unownedLiveCollections = liveCollections
    .map((collection) => collection.name)
    .filter((name) => !getChromaMaintenanceManifestEntry(name)
      || (CHROMA_MAINTENANCE_EXCLUDED_COLLECTIONS as readonly string[]).includes(name))
    .sort((a, b) => a.localeCompare(b));

  const now = options.now ?? new Date();
  const collectionReports: ChromaMaintenanceCollectionReport[] = [];

  for (const entry of entries) {
    const report = blankCollectionReport(entry);
    const live = liveByName.get(entry.collection);
    report.liveCollectionPresent = Boolean(live);
    report.liveMetadataModel = typeof live?.metadata?.embedding_model === 'string'
      ? live.metadata.embedding_model
      : null;
    report.liveDimension = typeof live?.dimension === 'number' ? live.dimension : null;
    if (options.apply && live && (
      report.liveMetadataModel !== entry.embeddingModel
      || report.liveDimension !== entry.embeddingDimension
    )) {
      throw new Error(`apply blocked by embedding model or dimension drift for ${entry.collection}`);
    }
    await scanLiveProjection(report, port, batchSize, maxRecords, now);

    const canonical = await loadCanonicalItems(
      entry,
      port,
      batchSize,
      maxRecords,
      options.cursor ?? null,
    );
    report.nextCursor = canonical.nextCursor;
    report.canonicalRecordsExamined = canonical.items.length;
    report.reindexCandidates = canonical.items.filter((item) => item.action === 'upsert').length;
    report.ageOutCandidates = canonical.items.filter((item) => item.action === 'remove').length;
    report.blockedCandidates = canonical.items.filter((item) => item.action === 'blocked').length;

    if (options.apply) {
      const blocked = canonical.items.find((item) => item.action === 'blocked');
      if (blocked) throw new Error(`apply blocked by canonical evidence: ${blocked.reason}`);
      const duplicate = duplicateCanonicalIdentity(canonical.items);
      if (duplicate) throw new Error(`apply blocked by duplicate canonical projection identity: ${duplicate}`);
      if (report.liveScanTruncated || report.nextCursor) {
        throw new Error('apply requires complete live and canonical scans for the collection');
      }
    }

    const relevant = options.mode === 'age_out'
      ? canonical.items.filter((item) => item.action === 'remove')
      : canonical.items.filter((item) => item.action !== 'remove');

    for (const item of relevant) {
      if (item.action === 'blocked') continue;
      const before = await port.verify(item);
      recordVerification(report, before);
      if (!options.apply) continue;

      if (options.mode === 'reindex') {
        if (before === 'match') continue;
        await port.upsert(item);
        const after = await port.verify(item);
        if (after !== 'match') throw new Error(`reindex readback failed: ${after}`);
        report.appliedUpserts += 1;
      } else if (options.mode === 'age_out') {
        if (before === 'missing') continue;
        await port.remove(item);
        const after = await port.verify(item);
        if (after !== 'missing') throw new Error(`age-out readback failed: ${after}`);
        report.appliedRemovals += 1;
      }
    }
    collectionReports.push(report);
  }

  return {
    schemaVersion: 'chroma-maintenance-report.v1',
    generatedAt: now.toISOString(),
    mode: options.mode,
    apply: options.apply === true,
    approvalRef: options.apply ? options.approvalRef ?? null : null,
    requestedCollections,
    liveCollectionCount: liveCollections.length,
    unownedLiveCollections,
    collections: collectionReports,
    summary: {
      liveRecordsObserved: collectionReports.reduce((sum, row) => sum + row.liveRecordsObserved, 0),
      canonicalRecordsExamined: collectionReports.reduce((sum, row) => sum + row.canonicalRecordsExamined, 0),
      reindexCandidates: collectionReports.reduce((sum, row) => sum + row.reindexCandidates, 0),
      ageOutCandidates: collectionReports.reduce((sum, row) => sum + row.ageOutCandidates, 0),
      blockedCandidates: collectionReports.reduce((sum, row) => sum + row.blockedCandidates, 0),
      appliedUpserts: collectionReports.reduce((sum, row) => sum + row.appliedUpserts, 0),
      appliedRemovals: collectionReports.reduce((sum, row) => sum + row.appliedRemovals, 0),
    },
  };
}
