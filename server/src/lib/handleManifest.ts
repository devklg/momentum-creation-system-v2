/**
 * ACR-0013 §5 — the handle manifest. The COMMITTED FIXTURE of every handle
 * Kevin has named: handle, call phrase, aliases, expected memory_id, and
 * audience.
 *
 * Two suites consume it:
 *
 * - CI GATE (deterministic, no network, always runs) — every call phrase and
 *   alias must resolve through rung-1 invocation (exact match on
 *   call_phrase / alias / useWhen) against this fixture, and no dev handle
 *   may survive the app-agent audience filter. Fails if a handle is renamed,
 *   duplicated, or dropped. See handleManifest.test.ts.
 * - LOCAL LIVE (Kevin's machine only) — the semantic/distance assertions run
 *   against the Universal Gateway, which is LOCAL BY DESIGN and must never be
 *   reachable from GitHub runners. `pnpm memory:verify`, or
 *   RETRIEVAL_REGRESSION=live for the vitest suite.
 *
 * When Kevin names a new handle (writeHandle / writeAnchor), ADD IT HERE.
 *
 * `minSeparation` values are floors derived from live measurements (see PR
 * body); they assert the separation stays VISIBLE, not that it stays
 * identical. Reference: `voice mailer reality` = 0.576 vs runner-up 1.102 on
 * the memory stack.
 */

import type { McsMemoryAudience } from '@momentum/shared/runtime';

/** One Kevin-named handle, as committed fixture. */
export interface HandleManifestEntry {
  /** Record id in the context index / learning notes. */
  recordId: string;
  /** Kevin's exact words, when the record carries them. */
  humanHandle?: string;
  /** The primary phrase Kevin says. Some records (cdx-001) carry phrases
   * only as aliases. */
  callPhrase?: string;
  aliases: readonly string[];
  useWhen?: string;
  /** The canonical source record this handle points at, when distinct. */
  memoryId?: string;
  /** Compile-time boundary. Absent on disk fails closed to dev_agents. */
  audience: McsMemoryAudience;
  weight?: number;
  namedBy: string;
}

export const HANDLE_MANIFEST: readonly HandleManifestEntry[] = [
  {
    recordId: 'kevins_real_turning_point_2026_07_05',
    humanHandle: "kevin's real turning point",
    callPhrase: "kevin's real turning point",
    aliases: ['krtp-mem'],
    useWhen:
      "Use when Kevin says krtp-mem or kevin's real turning point. Canonical milestone: universal_gateway.kevin_milestone_chats/kevins_real_turning_point_2026_07_05 (preserve_for_perpetuity).",
    memoryId: 'kevins_real_turning_point_2026_07_05',
    audience: 'dev_agents',
    weight: 10,
    namedBy: 'Kevin L. Gardner',
  },
  {
    recordId: 'digital_memory_discovery_20260706',
    humanHandle: 'Digital Memory Discovery',
    callPhrase: 'Digital Memory Discovery',
    aliases: [],
    useWhen:
      'Use when Kevin says Digital Memory Discovery. Canonical record: universal_gateway.memory_decisions/digital_memory_discovery_20260706; index handle: universal_gateway.memory_index/memory_index_20260706_digital_memory_discovery.',
    memoryId: 'digital_memory_discovery_20260706',
    audience: 'dev_agents',
    weight: 10,
    namedBy: 'Kevin L. Gardner',
  },
  {
    recordId: 'voicemail-dialer-reality-2026-07-11',
    humanHandle: 'voice mailer reality',
    callPhrase: 'voice mailer reality',
    aliases: [],
    useWhen:
      'Use when Kevin says voice mailer reality, or when work touches the MCS v2 VM dialer, Telnyx/10DLC, the callback pivot, or AU phone coverage. Canonical note: universal_gateway.claude_learning_notes/voicemail-dialer-reality-2026-07-11 (memory stack).',
    memoryId: 'voicemail-dialer-reality-2026-07-11',
    audience: 'dev_agents',
    weight: 8,
    namedBy: 'Kevin L. Gardner',
  },
  {
    // cdx-001 predates this lane and is deliberately not mutated: its phrases
    // live in `aliases` only, its vectors are the 2026-07-06 originals, and
    // deterministic invocation is its contract, not semantic distance.
    recordId: 'cdx-001',
    aliases: [
      'cdx-001',
      'codex message 1',
      'digital-memory-discovery',
      'dmd-mem',
      'memory-context-compiler',
      'mcc-v1',
      'go to intervector agent message',
    ],
    useWhen:
      'Use when Kevin says cdx-001, codex message 1, go to intervector agent message, digital memory discovery, dmd-mem, or memory context compiler.',
    audience: 'dev_agents',
    weight: 10,
    namedBy: 'Kevin L. Gardner',
  },
  {
    // Named by Kevin 2026-07-11: SMS is for MEMBERS ONLY — permission-given
    // at entry, tracked first-party. Prospects are never texted by the system.
    recordId: 'member-sms-channel',
    humanHandle: 'member sms channel',
    callPhrase: 'member sms channel',
    aliases: [],
    useWhen:
      'Use when Kevin says member sms channel, or when work touches member SMS consent, STOP/HELP handling, 10DLC campaigns, or any texting surface. Canonical note: universal_gateway.claude_learning_notes/member-sms-channel (memory stack).',
    memoryId: 'member-sms-channel',
    audience: 'dev_agents',
    weight: 8,
    namedBy: 'Kevin L. Gardner',
  },
] as const;

/**
 * Project a manifest entry into the on-disk document shape the rung-1
 * matcher (`matchHandleDoc`) sees, so the deterministic test exercises the
 * REAL matching rule against the committed fixture — no network.
 */
export function toFixtureDoc(entry: HandleManifestEntry): Record<string, unknown> {
  return {
    _id: entry.recordId,
    id: entry.recordId,
    ...(entry.humanHandle ? { human_handle: entry.humanHandle } : {}),
    ...(entry.callPhrase ? { call_phrase: entry.callPhrase } : {}),
    aliases: [...entry.aliases],
    ...(entry.useWhen ? { useWhen: entry.useWhen } : {}),
    ...(entry.memoryId ? { memory_id: entry.memoryId } : {}),
    audience: entry.audience,
    ...(entry.weight !== undefined ? { weight: entry.weight } : {}),
    named_by: entry.namedBy,
  };
}

/** Every phrase a manifest entry answers to. */
export function entryPhrases(entry: HandleManifestEntry): string[] {
  return [...(entry.callPhrase ? [entry.callPhrase] : []), ...entry.aliases];
}

export interface SemanticHandleCheck {
  /** The words Kevin says. */
  phrase: string;
  connector: 'chromadb' | 'chromadb2';
  collection: string;
  expectedTopId: string;
  /** Floor for (runnerUpDistance - topDistance). */
  minSeparation: number;
  /** Measured at manifest time, for drift comparison. */
  measured: { distance: number; runnerUp: number };
}

export interface InvocationHandleCheck {
  /** Exact call_phrase / alias — rung 1 of the ladder, deterministic. */
  phrase: string;
  expectedRecordId: string;
}

/** Semantic leg — LIVE ONLY (local library). The phrase must return its
 * record as the TOP hit with visible separation from the runner-up. */
export const SEMANTIC_HANDLE_CHECKS: readonly SemanticHandleCheck[] = [
  {
    phrase: "kevin's real turning point",
    connector: 'chromadb2',
    collection: 'mcs_memory_context_index',
    expectedTopId: 'kevins_real_turning_point_2026_07_05',
    minSeparation: 0.5,
    measured: { distance: 0.477, runnerUp: 1.86 },
  },
  {
    phrase: 'krtp-mem',
    connector: 'chromadb2',
    collection: 'mcs_memory_context_index',
    expectedTopId: 'kevins_real_turning_point_2026_07_05',
    // A four-letter alias is semantically thin; the deterministic rung-1
    // lookup is its real invocation path. We still require it to win.
    minSeparation: 0.02,
    measured: { distance: 1.346, runnerUp: 1.417 },
  },
  {
    phrase: 'Digital Memory Discovery',
    connector: 'chromadb2',
    collection: 'mcs_memory_context_index',
    expectedTopId: 'digital_memory_discovery_20260706',
    minSeparation: 0.2,
    measured: { distance: 0.762, runnerUp: 1.155 },
  },
  {
    phrase: 'voice mailer reality',
    connector: 'chromadb2',
    collection: 'mcs_memory_context_index',
    expectedTopId: 'voicemail-dialer-reality-2026-07-11',
    minSeparation: 0.5,
    measured: { distance: 0.64, runnerUp: 1.541 },
  },
  {
    // The canonical anchor on the MEMORY stack (ACR-0012 §3.1 reference case).
    phrase: 'voice mailer reality',
    connector: 'chromadb',
    collection: 'claude_learning_notes',
    expectedTopId: 'voicemail-dialer-reality-2026-07-11',
    minSeparation: 0.3,
    measured: { distance: 0.576, runnerUp: 1.102 },
  },
  {
    // Named by Kevin 2026-07-11. Canonical anchor, memory stack.
    phrase: 'member sms channel',
    connector: 'chromadb',
    collection: 'claude_learning_notes',
    expectedTopId: 'member-sms-channel',
    minSeparation: 0.4,
    measured: { distance: 0.29, runnerUp: 1.145 },
  },
  {
    // App-stack context-index projection of the same handle.
    phrase: 'member sms channel',
    connector: 'chromadb2',
    collection: 'mcs_memory_context_index',
    expectedTopId: 'member-sms-channel',
    minSeparation: 0.5,
    measured: { distance: 0.484, runnerUp: 1.411 },
  },
] as const;

/** Invocation leg — rung 1 exact lookup must resolve each phrase to its
 * record. Derived from the manifest fixture; the deterministic CI test and
 * the live suite share these exact rows. */
export const INVOCATION_HANDLE_CHECKS: readonly InvocationHandleCheck[] = HANDLE_MANIFEST.flatMap((entry) =>
  entryPhrases(entry).map((phrase) => ({ phrase, expectedRecordId: entry.recordId })),
);
