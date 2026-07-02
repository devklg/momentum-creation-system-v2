import { randomInt } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';

const TMAG_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MEMBER_COLLECTION = 'team_magnificent_members';
const MEMBER_ID_LENGTH = 6;
const MAX_MINT_ATTEMPTS = 25;

export const FOUNDER_TMAG_IDS = new Set(['TMAG-01', 'TMAG-02']);

function mintTmagIdCandidate(): string {
  let suffix = '';
  for (let i = 0; i < MEMBER_ID_LENGTH; i += 1) {
    suffix += TMAG_ID_ALPHABET[randomInt(TMAG_ID_ALPHABET.length)];
  }
  return `TMAG-${suffix}`;
}

async function tmagIdExists(tmagId: string): Promise<boolean> {
  const result = await persistenceCall<{ count?: number; documents?: unknown[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: MEMBER_COLLECTION,
    filter: { tmagId },
    limit: 1,
  });
  return (result.count ?? result.documents?.length ?? 0) > 0;
}

export async function mintUniqueTmagId(): Promise<string> {
  for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS; attempt += 1) {
    const tmagId = mintTmagIdCandidate();
    if (FOUNDER_TMAG_IDS.has(tmagId)) continue;
    if (!(await tmagIdExists(tmagId))) return tmagId;
  }
  throw new Error('tmag_id_collision_exhausted');
}
