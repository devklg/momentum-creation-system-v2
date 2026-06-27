import { fetch } from 'undici';
import { env } from '../../../env.js';

export const CHROMA_TENANT = 'default_tenant';
export const CHROMA_DATABASE = 'default_database';

export function chromaCollectionsUrl(): string {
  return `${env.CHROMA_URL}/api/v2/tenants/${CHROMA_TENANT}/databases/${CHROMA_DATABASE}/collections`;
}

export async function chromaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${env.CHROMA_URL}/api/v2/heartbeat`);
    return res.ok;
  } catch {
    return false;
  }
}
