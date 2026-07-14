import {
  KNOWLEDGE_EVOLUTION_ACTIVE_COLLECTIONS,
  KNOWLEDGE_EVOLUTION_COLLECTIONS,
} from '@momentum/shared/runtime';
import { CHROMA_COLLECTIONS } from '../chromaCollections.js';

export type ChromaRetentionClass =
  | 'indefinite'
  | 'canonical_lifecycle'
  | 'event_history_report_only'
  | 'unowned_excluded';

export type ChromaMaintenanceCapability = 'audit' | 'reindex' | 'age_out';
export type ChromaProjector = 'knowledge_evolution_active' | null;

export interface ChromaMaintenanceManifestEntry {
  collection: string;
  retentionClass: ChromaRetentionClass;
  capabilities: readonly ChromaMaintenanceCapability[];
  projector: ChromaProjector;
  canonicalMongoCollections: readonly string[];
  embeddingModel: 'all-MiniLM-L6-v2';
  embeddingDimension: 384;
  requiredMetadata: readonly string[];
  domain: string | null;
  language: 'en' | 'es' | null;
}

export const CHROMA_MAINTENANCE_EXCLUDED_COLLECTIONS = [
  'mcs_three_way_notifications',
  'mcs_three_way_reminders',
  'mcs_memory_context_index',
  'claude_learning_notes',
  'mcs_vm_control_actions',
  'mcs_michael_runtime_turns',
  'mcs_runtime_context_traces',
] as const;

const EXCLUDED_SET = new Set<string>(CHROMA_MAINTENANCE_EXCLUDED_COLLECTIONS);

const ACTIVE_COLLECTIONS = KNOWLEDGE_EVOLUTION_ACTIVE_COLLECTIONS.map(
  (logical) => `mcs_${logical}`,
);
const ACTIVE_SET = new Set<string>(ACTIVE_COLLECTIONS);

const INDEFINITE_COLLECTIONS = new Set<string>([
  'mcs_audit_log',
  'mcs_access_codes',
  'mcs_commitments',
  'mcs_members',
  'mcs_learning_candidates_review',
]);

const EVENT_HISTORY_COLLECTIONS = new Set<string>([
  'mcs_agent_ivory_events',
  'mcs_agent_michael_events',
  'mcs_agent_steve_events',
  'mcs_agent_system_events',
  'mcs_event_attendance',
  'mcs_prospect_htank_events',
  'mcs_prospect_invitation_activity',
  'mcs_prospect_timeline_events',
  'mcs_resource_usage_events',
  'mcs_vm_delivery_events',
]);

const ACTIVE_REQUIRED_METADATA = [
  'evolutionId',
  'knowledgeObjectId',
  'version',
  'domain',
  'language',
  'lifecycleStatus',
  'governanceStatus',
  'retrievalReady',
  'tenantId',
  'sourceTraceable',
] as const;

function activeDomainLanguage(collection: string): {
  domain: string;
  language: 'en' | 'es';
} | null {
  const match = /^mcs_(.+)_knowledge_(en|es)$/.exec(collection);
  if (!match?.[1] || (match[2] !== 'en' && match[2] !== 'es')) return null;
  return { domain: match[1], language: match[2] };
}

function manifestEntry(collection: string): ChromaMaintenanceManifestEntry {
  const active = ACTIVE_SET.has(collection);
  const parsed = active ? activeDomainLanguage(collection) : null;
  const retentionClass: ChromaRetentionClass = INDEFINITE_COLLECTIONS.has(collection)
    ? 'indefinite'
    : EVENT_HISTORY_COLLECTIONS.has(collection)
      ? 'event_history_report_only'
      : 'canonical_lifecycle';
  return {
    collection,
    retentionClass,
    capabilities: active ? ['audit', 'reindex', 'age_out'] : ['audit'],
    projector: active ? 'knowledge_evolution_active' : null,
    canonicalMongoCollections: active
      ? [
          KNOWLEDGE_EVOLUTION_COLLECTIONS.records,
          KNOWLEDGE_EVOLUTION_COLLECTIONS.versions,
          KNOWLEDGE_EVOLUTION_COLLECTIONS.supersessionRecords,
          KNOWLEDGE_EVOLUTION_COLLECTIONS.retrievalRollouts,
        ]
      : [],
    embeddingModel: 'all-MiniLM-L6-v2',
    embeddingDimension: 384,
    requiredMetadata: active ? ACTIVE_REQUIRED_METADATA : [],
    domain: parsed?.domain ?? null,
    language: parsed?.language ?? null,
  };
}

const MANIFEST_COLLECTIONS = [...new Set([...CHROMA_COLLECTIONS, ...ACTIVE_COLLECTIONS])]
  .sort((a, b) => a.localeCompare(b));

export const CHROMA_MAINTENANCE_MANIFEST: readonly ChromaMaintenanceManifestEntry[] =
  MANIFEST_COLLECTIONS.map(manifestEntry);

const MANIFEST_BY_COLLECTION = new Map(
  CHROMA_MAINTENANCE_MANIFEST.map((entry) => [entry.collection, entry]),
);

export function getChromaMaintenanceManifestEntry(
  collection: string,
): ChromaMaintenanceManifestEntry | null {
  return MANIFEST_BY_COLLECTION.get(collection) ?? null;
}

export function isExcludedChromaMaintenanceCollection(collection: string): boolean {
  return EXCLUDED_SET.has(collection);
}

export function assertChromaMaintenanceCapability(
  collection: string,
  capability: ChromaMaintenanceCapability,
): ChromaMaintenanceManifestEntry {
  if (isExcludedChromaMaintenanceCollection(collection)) {
    throw new Error(`collection '${collection}' is unowned_excluded`);
  }
  const entry = getChromaMaintenanceManifestEntry(collection);
  if (!entry) throw new Error(`collection '${collection}' is not in the maintenance manifest`);
  if (!entry.capabilities.includes(capability)) {
    throw new Error(`collection '${collection}' does not support ${capability}`);
  }
  return entry;
}
