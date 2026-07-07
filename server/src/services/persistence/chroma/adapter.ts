import { fetch } from 'undici';
import { PersistenceError } from '../dispatch.js';
import { embed } from './embedder.js';
import { chromaCollectionsUrl, chromaHeaders } from './connection.js';

interface ChromaCollection {
  id?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

interface ChromaParams {
  collection?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  ids?: string[];
  documents?: string[];
  metadatas?: Array<Record<string, unknown>>;
  query?: string;
  query_texts?: string[];
  n_results?: number;
  filter?: Record<string, unknown>;
  where?: Record<string, unknown>;
}

interface ChromaQueryResponse {
  ids?: string[][];
  documents?: string[][];
  metadatas?: Array<Array<Record<string, unknown> | null>>;
  distances?: number[][];
}

interface PERSISTENCEChromaQueryResult {
  collection: string;
  query?: string;
  n_results: number;
  results: {
    ids: string[];
    documents: string[];
    metadatas: Array<Record<string, unknown> | null>;
    distances: number[];
  };
}

async function readJson(res: Awaited<ReturnType<typeof fetch>>): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

function normalizeCollections(body: unknown): ChromaCollection[] {
  if (Array.isArray(body)) return body as ChromaCollection[];
  if (body && typeof body === 'object' && Array.isArray((body as { collections?: unknown }).collections)) {
    return (body as { collections: ChromaCollection[] }).collections;
  }
  return [];
}

async function request(path: string, init?: Parameters<typeof fetch>[1]): Promise<unknown> {
  const headers = chromaHeaders((init?.headers ?? {}) as Record<string, string>);
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return readJson(res);
}

export async function listCollections(): Promise<{ collections: ChromaCollection[]; count: number }> {
  const collections = normalizeCollections(await request(chromaCollectionsUrl()));
  return { collections, count: collections.length };
}

export async function getCollection(name: string): Promise<ChromaCollection> {
  const { collections } = await listCollections();
  const found = collections.find((c) => c.name === name || c.id === name);
  if (!found) throw new PersistenceError('chromadb', 'get_collection', `collection not found: ${name}`);
  return found;
}

function collectionEndpoint(collection: ChromaCollection, suffix: string): string {
  const id = collection.id ?? collection.name;
  if (!id) throw new PersistenceError('chromadb', suffix, 'collection has no id or name');
  return `${chromaCollectionsUrl()}/${encodeURIComponent(id)}/${suffix}`;
}

export async function createCollection(params: ChromaParams): Promise<unknown> {
  const name = params.name ?? params.collection;
  if (!name) throw new PersistenceError('chromadb', 'create_collection', 'collection name required');
  return request(chromaCollectionsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, metadata: params.metadata ?? {}, get_or_create: true }),
  });
}

export async function add(params: ChromaParams): Promise<{ ok: true; count: number }> {
  if (!params.collection) throw new PersistenceError('chromadb', 'add', 'collection required');
  const ids = params.ids ?? [];
  const documents = params.documents ?? [];
  if (ids.length !== documents.length) {
    throw new PersistenceError('chromadb', 'add', '`ids` and `documents` length mismatch');
  }
  const collection = await getCollection(params.collection);
  const embeddings = await embed(documents);
  await request(collectionEndpoint(collection, 'upsert'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids,
      documents,
      metadatas: params.metadatas ?? documents.map(() => ({})),
      embeddings,
    }),
  });
  return { ok: true, count: ids.length };
}

export async function deleteRecords(params: ChromaParams): Promise<{ ok: true }> {
  if (!params.collection) throw new PersistenceError('chromadb', 'delete', 'collection required');
  const collection = await getCollection(params.collection);
  const where = normalizeWhere(params.where ?? params.filter);
  await request(collectionEndpoint(collection, 'delete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(params.ids ? { ids: params.ids } : {}),
      ...(where ? { where } : {}),
    }),
  });
  return { ok: true };
}

export async function query(params: ChromaParams): Promise<unknown> {
  if (!params.collection) throw new PersistenceError('chromadb', 'query_with_filter', 'collection required');
  const queryTexts = params.query_texts ?? (params.query ? [params.query] : []);
  if (queryTexts.length === 0) {
    throw new PersistenceError('chromadb', 'query_with_filter', 'query text required');
  }
  const collection = await getCollection(params.collection);
  const queryEmbeddings = await embed(queryTexts);
  return request(collectionEndpoint(collection, 'query'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_embeddings: queryEmbeddings,
      n_results: params.n_results ?? 5,
      where: normalizeWhere(params.where ?? params.filter),
    }),
  });
}

function normalizeWhere(where: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!where) return undefined;
  const keys = Object.keys(where);
  if (keys.length <= 1 || keys.some((key) => key.startsWith('$'))) return where;
  return {
    $and: keys.map((key) => ({ [key]: where[key] })),
  };
}

function flattenFirstQueryResult(body: unknown): PERSISTENCEChromaQueryResult['results'] {
  const response = body as ChromaQueryResponse;
  return {
    ids: response.ids?.[0] ?? [],
    documents: response.documents?.[0] ?? [],
    metadatas: response.metadatas?.[0] ?? [],
    distances: response.distances?.[0] ?? [],
  };
}

export async function queryPERSISTENCEShape(
  params: ChromaParams,
  options: { includeQuery: boolean },
): Promise<PERSISTENCEChromaQueryResult> {
  if (!params.collection) throw new PersistenceError('chromadb', 'query_with_filter', 'collection required');
  const queryText = params.query_texts?.[0] ?? params.query;
  if (!queryText) {
    throw new PersistenceError('chromadb', 'query_with_filter', 'query text required');
  }
  const body = await query(params);
  return {
    collection: params.collection,
    ...(options.includeQuery ? { query: queryText } : {}),
    n_results: params.n_results ?? 5,
    results: flattenFirstQueryResult(body),
  };
}

export async function chromaAdapter(
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  try {
    const p = params as ChromaParams;
    switch (action) {
      case 'list_collections':
        return await listCollections();
      case 'get_collection':
        return await getCollection(p.collection ?? p.name ?? '');
      case 'create_collection':
        return await createCollection(p);
      case 'add':
        return await add(p);
      case 'delete':
        return await deleteRecords(p);
      case 'search':
        return await queryPERSISTENCEShape(p, { includeQuery: true });
      case 'query_with_filter':
        return await queryPERSISTENCEShape(p, { includeQuery: false });
      default:
        throw new PersistenceError('chromadb', action, `unsupported chromadb action: ${action}`);
    }
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    throw new PersistenceError('chromadb', action, err instanceof Error ? err.message : String(err));
  }
}
