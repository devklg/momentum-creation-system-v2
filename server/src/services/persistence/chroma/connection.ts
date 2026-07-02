import { fetch } from 'undici';
import { env } from '../../../env.js';

/**
 * Chroma connection — local (default_tenant/default_database, no auth) and
 * Chroma Cloud (tenant UUID + named database + x-chroma-token) via env:
 * CHROMA_URL · CHROMA_TENANT · CHROMA_DATABASE · CHROMA_API_KEY.
 */
export const CHROMA_TENANT = env.CHROMA_TENANT;
export const CHROMA_DATABASE = env.CHROMA_DATABASE;

/** Auth/content headers for every Chroma request; token only when configured. */
export function chromaHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (env.CHROMA_API_KEY) headers['x-chroma-token'] = env.CHROMA_API_KEY;
  return headers;
}

export function chromaCollectionsUrl(): string {
  return `${env.CHROMA_URL}/api/v2/tenants/${CHROMA_TENANT}/databases/${CHROMA_DATABASE}/collections`;
}

export async function chromaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${env.CHROMA_URL}/api/v2/heartbeat`, { headers: chromaHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}
