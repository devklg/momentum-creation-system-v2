/**
 * Seed Kevin's TMAG-KEVN and a TMAG-TEST access code for end-to-end testing.
 * Idempotent — safe to re-run.
 *
 * Usage:  pnpm --filter @momentum/server seed:codes
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { connectMongo } from '../src/services/persistence/mongo/connection.js';

interface SeedCode {
  code: string;
  sponsorTmagId: string;
  sponsorThreeBaId: string;
  sponsorFirstName: string;
  sponsorLastName: string;
}

const CODES: SeedCode[] = [
  {
    code: 'TMAG-KEVN',
    sponsorTmagId: 'TMAG-01',
    sponsorThreeBaId: '1845964',
    sponsorFirstName: 'Kevin',
    sponsorLastName: 'Gardner',
  },
  {
    code: 'TMAG-TEST',
    sponsorTmagId: 'TMAG-01',
    sponsorThreeBaId: '1845964',
    sponsorFirstName: 'Kevin',
    sponsorLastName: 'Gardner',
  },
];

async function main(): Promise<void> {
  await connectMongo();
  for (const c of CODES) {
    const existing = await persistenceCall<{ count: number }>('mongodb', 'query', {
      database: 'momentum',
      collection: 'tmag_access_codes',
      filter: { code: c.code },
      limit: 1,
    });

    if (existing.count > 0) {
      console.log(`[seed] ${c.code} already exists — skipping`);
      continue;
    }

    await persistenceCall('mongodb', 'insert', {
      database: 'momentum',
      collection: 'tmag_access_codes',
      documents: [{ _id: c.code, ...c, active: true, createdAt: new Date().toISOString() }],
    });
    console.log(`[seed] inserted ${c.code} (sponsor: ${c.sponsorFirstName} ${c.sponsorLastName} / THREE ${c.sponsorThreeBaId})`);
  }
  console.log('[seed] done.');
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
