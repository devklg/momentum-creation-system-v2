/**
 * The summary budget boundary on `compileContextPacket`.
 *
 * Two things are pinned here, and they pull against each other on purpose:
 *
 *   1. NO REGRESSION. A caller that passes no `maxSummaryChars` gets exactly
 *      what it got before the option existed — 1200 chars plus an ellipsis.
 *      Every guard listing, drift report, and packet on disk depends on it.
 *   2. THE ESCAPE HATCH IS REAL. A caller that asks for the whole body gets
 *      the whole body. The operating-context boot is that caller: a world
 *      clipped to a fifth of itself, reported as loaded, is the failure the
 *      boot sector exists to end.
 *
 * Agents still never query stores directly — the full body arrives through
 * the compiler, which is the architectural point.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileContextPacket } from '../contextPacket.js';

/** Longer than the 1200 default, roughly the size of the real boot record. */
const LONG_BODY = 'LOAD 1 — the world you are working in. '.repeat(160).trim();

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Minimal gateway: `boot` resolves deterministically out of
 * `universal_gateway.memory_index`; the graph and coverage queries answer
 * empty so the packet is nothing but the canonical record.
 */
function stubGatewayWithBootRecord() {
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    const { tool, params } = JSON.parse(init.body) as {
      tool: string;
      action: string;
      params: Record<string, unknown>;
    };
    let data: unknown = {};
    if (tool === 'mongodb' || tool === 'mongodb2') {
      data =
        params.collection === 'memory_index'
          ? {
              documents: [
                {
                  _id: 'boot_operating_context_20260808',
                  type: 'memory_index_entry',
                  call_phrase: 'boot',
                  human_handle: 'boot',
                  title: 'Boot the OS',
                  audience: 'both',
                  named_by: 'Kevin L. Gardner',
                  created_at: '2026-08-08T00:00:00.000Z',
                  content: LONG_BODY,
                },
              ],
            }
          : { documents: [] };
    } else if (tool === 'neo4j' || tool === 'neo4j2') {
      data = { records: [] };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data }),
    };
  });
}

describe('compileContextPacket — hit summary budget', () => {
  it('truncates hit summaries at 1200 chars when no maxSummaryChars is given', async () => {
    stubGatewayWithBootRecord();

    const packet = await compileContextPacket('boot');

    const summary = packet.canonicalRecord?.summary ?? '';
    expect(packet.ladderRung).toBe('invocation');
    expect(summary.endsWith('…')).toBe(true);
    expect(summary).toBe(`${LONG_BODY.slice(0, 1200)}…`);
    expect(summary.length).toBe(1201); // 1200 body chars + the truncation mark
  });

  it('returns the untruncated body when the caller asks for one', async () => {
    stubGatewayWithBootRecord();

    const packet = await compileContextPacket('boot', null, { maxSummaryChars: 100_000 });

    const summary = packet.canonicalRecord?.summary ?? '';
    expect(summary).toBe(LONG_BODY);
    expect(summary.length).toBe(LONG_BODY.length);
    expect(summary.endsWith('…')).toBe(false);
  });
});
