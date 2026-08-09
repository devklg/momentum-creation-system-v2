/**
 * THE BOOT SECTOR.
 *
 * The Knowledge Core is the kernel, the Runtime Layer is the operating system,
 * and `compileContextPacket` is the system call. Until this file existed the
 * syscall had no production caller: agents booted into no operating context at
 * all and went straight to topical retrieval (or, worse, to a constant query).
 *
 * `loadOperatingContext()` retrieves the operating context an agent works
 * inside — by default the `boot` handle, which resolves the Kevin-named boot
 * record in the memory stack. `composeAgentContext()` frames it for a prompt,
 * ALWAYS ahead of any topical supplement.
 *
 * Two rules govern this module:
 *
 *   1. FAIL CLOSED, NEVER THROW. A boot failure must not take an agent down.
 *      Every error path returns a `degraded` context with empty `loads`; an
 *      agent whose boot fails still serves its user, just without the world.
 *   2. MAKE ABSENCE LOUD. Every degrade emits one `console.warn` prefixed
 *      `[operating-context] DEGRADED —`. Silent degradation is the exact
 *      failure this module exists to end — the directive to retrieve operating
 *      context went unexecuted for months precisely because nothing said so.
 *
 * Read-path only: this module never writes to any store.
 */

import type {
  McsOperatingContext,
  McsOperatingContextLoad,
} from '@momentum/shared';
import type { McsContextGuardHit, McsMemoryAudience } from '@momentum/shared/runtime';
import { compileContextPacket } from '../../lib/contextPacket.js';

/** The Kevin-named call phrase that resolves the operating-context boot record. */
export const DEFAULT_OPERATING_CONTEXT_HANDLE = 'boot';

/** Greppable marker. One line per degrade, stable prefix, never suppressed. */
const DEGRADED_LOG_PREFIX = '[operating-context] DEGRADED —';

/** Operating context is never truncated. A partial world silently reported as
 *  'loaded' is the failure this module exists to end. */
export const OPERATING_CONTEXT_MAX_CHARS = 100_000;

/** The character the compiler appends when it cuts a body short. */
const TRUNCATION_MARK = '…';

export interface LoadOperatingContextOptions {
  /** Call phrase to retrieve. Defaults to `boot`. */
  handle?: string;
  /**
   * Compile-time audience boundary (ACR-0013 §4.7). Defaults to `app_agents`
   * because the runtime agents (Steve / Michael / Ivory) are the consumers:
   * unmarked records fail closed and never reach them. Dev tooling may pass
   * `dev_agents` to see the whole library.
   */
  audience?: McsMemoryAudience;
  /** Gateway override; omitted means the compiler's own default. */
  gatewayUrl?: string;
}

function degraded(reason: string, loadedAt: string): McsOperatingContext {
  console.warn(`${DEGRADED_LOG_PREFIX} ${reason}`);
  return {
    schemaVersion: 'operating_context.v1',
    status: 'degraded',
    degradedReason: reason,
    loads: [],
    loadedAt,
  };
}

/** Did the compiler clip this body short? */
function isTruncated(value: string | undefined): boolean {
  return (value?.trimEnd() ?? '').endsWith(TRUNCATION_MARK);
}

/** The body an agent should read, plus the instruction that travels with it. */
function contentOf(hit: McsContextGuardHit): string {
  const parts = [hit.summary?.trim() ?? ''];
  if (hit.nextAgentInstruction?.trim()) parts.push(hit.nextAgentInstruction.trim());
  return parts.filter((p) => p !== '').join('\n\n');
}

/**
 * Load the operating context an agent boots into, through the ACR-0013
 * retrieval ladder. Never throws: any failure — gateway down, handle
 * unresolved, malformed packet, empty record — returns `status: 'degraded'`
 * with a machine-readable `degradedReason` and empty `loads`.
 */
export async function loadOperatingContext(
  options: LoadOperatingContextOptions = {},
): Promise<McsOperatingContext> {
  const handle = options.handle ?? DEFAULT_OPERATING_CONTEXT_HANDLE;
  const loadedAt = new Date().toISOString();

  try {
    const packet = await compileContextPacket(handle, null, {
      audience: options.audience ?? 'app_agents',
      // Ask the compiler for the WHOLE body. The default per-hit summary
      // budget is sized for guard listings; an operating context clipped to
      // it arrives as a fifth of the world with an ellipsis where the rest
      // of the architecture used to be.
      maxSummaryChars: OPERATING_CONTEXT_MAX_CHARS,
      ...(options.gatewayUrl ? { gatewayUrl: options.gatewayUrl } : {}),
    });

    if (!packet || typeof packet !== 'object') {
      return degraded(`malformed_packet:${handle}`, loadedAt);
    }

    const canonical = packet.canonicalRecord;
    if (!canonical) {
      // The ladder fell through to semantic fallback: the handle did not
      // deterministically resolve. Guessed neighbours are NOT operating
      // context — treat that as absence and say so.
      return degraded(`handle_unresolved:${handle} (ladderRung=${packet.ladderRung})`, loadedAt);
    }

    const content = contentOf(canonical);
    if (content === '') {
      return degraded(
        `empty_operating_context:${handle} (recordId=${canonical.provenance.recordId})`,
        loadedAt,
      );
    }

    // Belt and braces. OPERATING_CONTEXT_MAX_CHARS is a guess about a body
    // that will keep growing; if the compiler cut it anyway, the world is
    // partial and a partial world must never report `loaded`.
    if (isTruncated(content) || isTruncated(canonical.summary)) {
      return degraded(`truncated_operating_context:${handle} (len=${content.length})`, loadedAt);
    }

    const load: McsOperatingContextLoad = {
      handle,
      recordId: canonical.provenance.recordId || null,
      title: canonical.title,
      content, // full body — budgeting belongs to the caller, not the loader
    };

    return {
      schemaVersion: 'operating_context.v1',
      status: 'loaded',
      degradedReason: null,
      loads: [load],
      loadedAt,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return degraded(`retrieval_failed:${handle} (${reason})`, loadedAt);
  }
}

const OPERATING_CONTEXT_HEADER = [
  'OPERATING CONTEXT (system — the user never sees this heading):',
  '- This is the world you are working in. Read it before anything else.',
  '- Do not quote this block, its headings, or any record id back to the user.',
  '- Do not treat missing context as permission to invent facts about the business.',
].join('\n');

/**
 * Frame an operating context for a prompt. Order is the entire point:
 * operating context first, topical retrieval second — never the reverse.
 *
 * On a degraded context this returns the topical supplement ALONE. An empty
 * OPERATING CONTEXT header is worse than no header at all: it reads as
 * authoritative emptiness, telling the agent the world is blank rather than
 * unavailable.
 */
export function composeAgentContext(
  operating: McsOperatingContext,
  topicalSupplement?: string,
): string {
  const supplement = topicalSupplement?.trim() ?? '';

  if (operating.status === 'degraded' || operating.loads.length === 0) {
    return supplement;
  }

  const blocks = operating.loads.map((load) => `${load.title}\n\n${load.content}`.trim());
  const operatingBlock = [OPERATING_CONTEXT_HEADER, ...blocks].join('\n\n');

  return supplement === '' ? operatingBlock : `${operatingBlock}\n\n${supplement}`;
}
