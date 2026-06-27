import { fetch } from 'undici';
import { GatewayError } from '../../gateway.js';
import { embed } from './embedder.js';
import { chromaCollectionsUrl } from './connection.js';

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
  const res = await fetch(path, init);
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
  if (!found) throw new GatewayError('chromadb', 'get_collection', `collection not found: ${name}`);
  return found;
}

function collectionEndpoint(collection: ChromaCollection, suffix: string): string {
  const id = collection.id ?? collection.name;
  if (!id) throw new GatewayError('chromadb', suffix, 'collection has no id or name');
  return `${chromaCollectionsUrl()}/${encodeURIComponent(id)}/${suffix}`;
}

export async function createCollection(params: ChromaParams): Promise<unknown> {
  const name = params.name ?? params.collection;
  if (!name) throw new GatewayError('chromadb', 'create_collection', 'collection name required');
  return request(chromaCollectionsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, metadata: params.metadata ?? {}, get_or_create: true }),
  });
}

export async function add(params: ChromaParams): Promise<{ ok: true; count: number }> {
  if (!params.collection) throw new GatewayError('chromadb', 'add', 'collection required');
  const ids = params.ids ?? [];
  const documents = params.documents ?? [];
  if (ids.length !== documents.length) {
    throw new GatewayError('chromadb', 'add', '`ids` and `documents` length mismatch');
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

export async function query(params: ChromaParams): Promise<unknown> {
  if (!params.collection) throw new GatewayError('chromadb', 'query_with_filter', 'collection required');
  const queryTexts = params.query_texts ?? (params.query ? [params.query] : []);
  if (queryTexts.length === 0) {
    throw new GatewayError('chromadb', 'query_with_filter', 'query text required');
  }
  const collection = await getCollection(params.collection);
  const queryEmbeddings = await embed(queryTexts);
  return request(collectionEndpoint(collection, 'query'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_embeddings: queryEmbeddings,
      n_results: params.n_results ?? 5,
      where: params.where ?? params.filter,
    }),
  });
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
      case 'search':
      case 'query_with_filter':
        return await query(p);
      default:
        throw new GatewayError('chromadb', action, `unsupported chromadb action: ${action}`);
    }
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    throw new GatewayError('chromadb', action, err instanceof Error ? err.message : String(err));
  }
}
