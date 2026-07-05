/**
 * Product Gallery content videos (Brief 9).
 *
 * Canonical Mongo collection: tmag_content_videos
 * Chroma mirror: mcs_content_videos
 * Neo4j node: TmagContentVideo
 *
 * Create goes through tripleStackWrite. Updates/reorders fan out directly to
 * Mongo + Neo4j + Chroma because tripleStackWrite is insert-only.
 */

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  McsContentVideoAudience,
  McsContentVideoRecord,
  McsContentVideoReorderItem,
  McsContentVideoSection,
  McsContentVideoUpsertPayload,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLLECTION = 'tmag_content_videos';
const CHROMA_COLLECTION = 'mcs_content_videos';

export type ContentVideoInput = McsContentVideoUpsertPayload & {
  source?: string | null;
};

export type ContentVideoActor = {
  tmagId: string | null;
};

export type ContentVideoError =
  | { kind: 'not_found' }
  | { kind: 'invalid_payload'; message: string };

export type ContentVideoResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ContentVideoError };

export function normalizeYoutubeId(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const watch = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watch) return watch[1] ?? null;
  const short = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (short) return short[1] ?? null;
  const embed = raw.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (embed) return embed[1] ?? null;
  if (/^[a-zA-Z0-9_-]{6,}$/.test(raw)) return raw;
  return null;
}

export function buildYoutubeUrl(youtubeId: string | null): string | null {
  return youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null;
}

export function validateContentVideoInput(
  input: ContentVideoInput,
): ContentVideoResult<Omit<McsContentVideoRecord, 'contentVideoId' | 'createdAt' | 'createdByTmagId' | 'updatedAt' | 'updatedByTmagId'>> {
  const section = input.section.trim();
  const title = input.title.trim();
  const description = input.description.trim();
  const youtubeId = normalizeYoutubeId(input.youtubeId ?? input.url ?? null);
  const rawUrl = (input.url ?? '').trim();
  const url = rawUrl || buildYoutubeUrl(youtubeId);
  const audience = input.audience;
  const sortOrder = Number(input.sortOrder);

  if (!section) return { ok: false, error: { kind: 'invalid_payload', message: 'section_required' } };
  if (!title) return { ok: false, error: { kind: 'invalid_payload', message: 'title_required' } };
  if (!description) return { ok: false, error: { kind: 'invalid_payload', message: 'description_required' } };
  if (!youtubeId && !url) return { ok: false, error: { kind: 'invalid_payload', message: 'youtube_or_url_required' } };
  if (!['member', 'prospect', 'both'].includes(audience)) {
    return { ok: false, error: { kind: 'invalid_payload', message: 'invalid_audience' } };
  }
  if (!Number.isFinite(sortOrder) || sortOrder < 0) {
    return { ok: false, error: { kind: 'invalid_payload', message: 'invalid_sort_order' } };
  }

  return {
    ok: true,
    value: {
      section,
      title,
      youtubeId,
      url: url || null,
      description,
      sortOrder,
      audience: audience as McsContentVideoAudience,
      active: input.active ?? true,
      source: input.source ?? null,
    },
  };
}

export async function listContentVideos(options?: {
  includeInactive?: boolean;
}): Promise<McsContentVideoSection[]> {
  const filter = options?.includeInactive ? {} : { active: true };
  const result = await persistenceCall<{ documents?: McsContentVideoRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLLECTION,
      filter,
      sort: { sortOrder: 1, title: 1 },
      limit: 1000,
    },
  );

  const sections = new Map<string, McsContentVideoRecord[]>();
  for (const doc of result.documents ?? []) {
    const bucket = sections.get(doc.section) ?? [];
    bucket.push(doc);
    sections.set(doc.section, bucket);
  }

  return [...sections.entries()].map(([section, videos]) => ({
    section,
    videos: videos.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
  }));
}

export async function findContentVideo(
  contentVideoId: string,
): Promise<McsContentVideoRecord | null> {
  const result = await persistenceCall<{ documents?: McsContentVideoRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLLECTION,
      filter: { contentVideoId },
      limit: 1,
    },
  );
  return result.documents?.[0] ?? null;
}

export async function createContentVideo(args: {
  input: ContentVideoInput;
  actor: ContentVideoActor;
  now?: string;
}): Promise<ContentVideoResult<McsContentVideoRecord>> {
  const parsed = validateContentVideoInput(args.input);
  if (!parsed.ok) return parsed;

  const now = args.now ?? new Date().toISOString();
  const contentVideoId = `content_video_${randomUUID()}`;
  const doc: McsContentVideoRecord = {
    contentVideoId,
    ...parsed.value,
    createdAt: now,
    createdByTmagId: args.actor.tmagId,
    updatedAt: now,
    updatedByTmagId: args.actor.tmagId,
  };

  await tripleStackWrite({
    id: contentVideoId,
    mongoCollection: COLLECTION,
    mongoDoc: doc as unknown as Record<string, unknown>,
    neo4j: {
      cypher: contentVideoMergeCypher(),
      params: contentVideoNeo4jParams(doc),
    },
    chroma: contentVideoChroma(doc),
  });

  return { ok: true, value: doc };
}

export async function updateContentVideo(args: {
  contentVideoId: string;
  input: ContentVideoInput;
  actor: ContentVideoActor;
  now?: string;
}): Promise<ContentVideoResult<McsContentVideoRecord>> {
  const existing = await findContentVideo(args.contentVideoId);
  if (!existing) return { ok: false, error: { kind: 'not_found' } };

  const parsed = validateContentVideoInput(args.input);
  if (!parsed.ok) return parsed;

  const now = args.now ?? new Date().toISOString();
  const next: McsContentVideoRecord = {
    ...existing,
    ...parsed.value,
    updatedAt: now,
    updatedByTmagId: args.actor.tmagId,
  };

  await persistContentVideoUpdate(next);
  return { ok: true, value: next };
}

export async function reorderContentVideos(args: {
  items: McsContentVideoReorderItem[];
  actor: ContentVideoActor;
  now?: string;
}): Promise<ContentVideoResult<McsContentVideoRecord[]>> {
  const now = args.now ?? new Date().toISOString();
  const changed: McsContentVideoRecord[] = [];

  for (const item of args.items) {
    const existing = await findContentVideo(item.contentVideoId);
    if (!existing) return { ok: false, error: { kind: 'not_found' } };
    if (!Number.isFinite(item.sortOrder) || item.sortOrder < 0) {
      return { ok: false, error: { kind: 'invalid_payload', message: 'invalid_sort_order' } };
    }
    const next: McsContentVideoRecord = {
      ...existing,
      sortOrder: item.sortOrder,
      updatedAt: now,
      updatedByTmagId: args.actor.tmagId,
    };
    await persistContentVideoUpdate(next);
    changed.push(next);
  }

  return { ok: true, value: changed };
}

async function persistContentVideoUpdate(doc: McsContentVideoRecord): Promise<void> {
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { contentVideoId: doc.contentVideoId },
    update: {
      $set: {
        section: doc.section,
        title: doc.title,
        youtubeId: doc.youtubeId,
        url: doc.url,
        description: doc.description,
        sortOrder: doc.sortOrder,
        audience: doc.audience,
        active: doc.active,
        source: doc.source,
        updatedAt: doc.updatedAt,
        updatedByTmagId: doc.updatedByTmagId,
      },
    },
  });

  await persistenceCall('neo4j', 'cypher', {
    query: contentVideoMergeCypher(),
    params: contentVideoNeo4jParams(doc),
  });

  await persistenceCall('chromadb', 'add', {
    collection: CHROMA_COLLECTION,
    ids: [doc.contentVideoId],
    documents: [contentVideoDocument(doc)],
    metadatas: [contentVideoMetadata(doc)],
  });
}

function contentVideoMergeCypher(): string {
  return `
    MERGE (v:TmagContentVideo {contentVideoId: $id})
    SET v.section = $section,
        v.title = $title,
        v.youtubeId = $youtubeId,
        v.url = $url,
        v.description = $description,
        v.sortOrder = $sortOrder,
        v.audience = $audience,
        v.active = $active,
        v.updatedAt = datetime($updatedAt),
        v.source = $source
    RETURN v.contentVideoId AS contentVideoId
  `;
}

function contentVideoNeo4jParams(doc: McsContentVideoRecord): Record<string, unknown> {
  return {
    id: doc.contentVideoId,
    section: doc.section,
    title: doc.title,
    youtubeId: doc.youtubeId,
    url: doc.url,
    description: doc.description,
    sortOrder: doc.sortOrder,
    audience: doc.audience,
    active: doc.active,
    updatedAt: doc.updatedAt,
    source: doc.source,
  };
}

function contentVideoDocument(doc: McsContentVideoRecord): string {
  return `${doc.section}: ${doc.title}. ${doc.description} Audience: ${doc.audience}.`;
}

function contentVideoMetadata(doc: McsContentVideoRecord): Record<string, unknown> {
  return {
    contentVideoId: doc.contentVideoId,
    section: doc.section,
    title: doc.title,
    youtubeId: doc.youtubeId,
    url: doc.url,
    audience: doc.audience,
    active: doc.active,
    sortOrder: doc.sortOrder,
    source: doc.source,
    updatedAt: doc.updatedAt,
  };
}

function contentVideoChroma(doc: McsContentVideoRecord) {
  return {
    collection: CHROMA_COLLECTION,
    document: contentVideoDocument(doc),
    metadata: contentVideoMetadata(doc),
  };
}
