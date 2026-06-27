/**
 * GPU embedder client (S1.3 Phase 1, ACR-0007 / Option C).
 *
 * Calls the local CUDA embedding service (all-MiniLM-L6-v2, 384-dim) at
 * GPU_EMBEDDER_URL. Verified contract:
 *   POST /embeddings  body { texts: string[], truncate?: number }
 *                     -> { embeddings: number[][], dimensions, count }
 *   GET  /health      -> { status: 'healthy', ... }
 *
 * NO CPU fallback: if the embedder is unreachable, errors, or returns the
 * wrong dimensionality, this throws so the Chroma leg fails loud and never
 * silently degrades (S1_3_IMPLEMENTATION_BREAKDOWN §8).
 */
import { fetch } from 'undici';
import { env } from '../../../env.js';

export const EMBEDDING_DIM = 384;

export class EmbedderError extends Error {
  constructor(message: string) {
    super(`[gpu-embedder] ${message}`);
    this.name = 'EmbedderError';
  }
}

interface EmbeddingsResponse {
  embeddings: number[][];
  dimensions: number;
  count: number;
  processing_time_ms?: number;
}

/** Health probe — true iff the embedder reports healthy. */
export async function embedderHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${env.GPU_EMBEDDER_URL}/health`, { method: 'GET' });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body?.status === 'healthy';
  } catch {
    return false;
  }
}

/**
 * Embed one or more texts on the GPU. Throws (no CPU fallback) on any failure
 * or dimensionality mismatch. Returns one 384-dim vector per input text.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  let res;
  try {
    res = await fetch(`${env.GPU_EMBEDDER_URL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
  } catch (err) {
    throw new EmbedderError(
      `unreachable at ${env.GPU_EMBEDDER_URL} — no CPU fallback. ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!res.ok) {
    throw new EmbedderError(`HTTP ${res.status} ${res.statusText} from /embeddings — no CPU fallback`);
  }

  const body = (await res.json()) as EmbeddingsResponse;
  if (!Array.isArray(body.embeddings) || body.embeddings.length !== texts.length) {
    throw new EmbedderError(
      `expected ${texts.length} vectors, got ${body.embeddings?.length ?? 'none'}`,
    );
  }
  if (body.dimensions !== EMBEDDING_DIM || body.embeddings[0]?.length !== EMBEDDING_DIM) {
    throw new EmbedderError(
      `expected ${EMBEDDING_DIM}-dim vectors, got dimensions=${body.dimensions} len=${body.embeddings[0]?.length}`,
    );
  }
  return body.embeddings;
}
