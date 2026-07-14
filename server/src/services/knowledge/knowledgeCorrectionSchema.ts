export const KNOWLEDGE_CORRECTION_COLLECTION = 'mcs_knowledge_corrections' as const;

export interface KnowledgeCorrectionIndexDefinition {
  name: string;
  collection: string;
  keys: Record<string, 1 | -1>;
  unique: boolean;
  purpose: string;
  liveApplyAuthorized: false;
}

/** Definitions only. ACR-0029 does not authorize creating these on the live stack. */
export const KNOWLEDGE_CORRECTION_INDEX_DEFINITIONS: readonly KnowledgeCorrectionIndexDefinition[] = [
  {
    name: 'unique_knowledge_correction_idempotency',
    collection: KNOWLEDGE_CORRECTION_COLLECTION,
    keys: { idempotencyKey: 1 },
    unique: true,
    purpose: 'Bind one correction workflow to one immutable apply key.',
    liveApplyAuthorized: false,
  },
  {
    name: 'knowledge_correction_state_updated',
    collection: KNOWLEDGE_CORRECTION_COLLECTION,
    keys: { state: 1, updatedAt: 1 },
    unique: false,
    purpose: 'Bound retry and operations status scans.',
    liveApplyAuthorized: false,
  },
  {
    name: 'knowledge_source_version_list',
    collection: 'mcs_knowledge_sources',
    keys: { status: 1, createdAt: -1, _id: -1 },
    unique: false,
    purpose: 'Kevin-only keyset source-version list.',
    liveApplyAuthorized: false,
  },
  {
    name: 'knowledge_chunk_source_version_lifecycle',
    collection: 'mcs_knowledge_chunks',
    keys: { sourceId: 1, sourceVersion: 1, status: 1 },
    unique: false,
    purpose: 'Exclusive old/new chunk lifecycle readback.',
    liveApplyAuthorized: false,
  },
] as const;
