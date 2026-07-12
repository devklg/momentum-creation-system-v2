/**
 * ACR-0013 §5 — the handle manifest. Every call phrase and alias in here is
 * verified by the retrieval regression suite; a failing handle FAILS THE
 * BUILD, not a warning. Kevin will say these words and trust what comes
 * back — a silently-broken handle is worse than no handle.
 *
 * When Kevin names a new handle (writeHandle / writeAnchor), ADD IT HERE.
 *
 * `minSeparation` values are floors derived from live measurements on
 * 2026-07-11 (see PR body); they assert the separation stays VISIBLE, not
 * that it stays identical. Reference: `voice mailer reality` = 0.576 vs
 * runner-up 1.102 on the memory stack.
 */

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

/** Semantic leg — the phrase must return its record as the TOP hit with
 * visible separation from the runner-up. */
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
] as const;

/** Invocation leg — rung 1 exact lookup must resolve each phrase to its
 * record. cdx-001's aliases live here (its 2026-07-06 vectors predate this
 * lane and were deliberately not mutated; deterministic invocation is their
 * contract, not semantic distance). */
export const INVOCATION_HANDLE_CHECKS: readonly InvocationHandleCheck[] = [
  { phrase: "kevin's real turning point", expectedRecordId: 'kevins_real_turning_point_2026_07_05' },
  { phrase: 'krtp-mem', expectedRecordId: 'kevins_real_turning_point_2026_07_05' },
  { phrase: 'Digital Memory Discovery', expectedRecordId: 'digital_memory_discovery_20260706' },
  { phrase: 'voice mailer reality', expectedRecordId: 'voicemail-dialer-reality-2026-07-11' },
  { phrase: 'cdx-001', expectedRecordId: 'cdx-001' },
  { phrase: 'codex message 1', expectedRecordId: 'cdx-001' },
  { phrase: 'memory-context-compiler', expectedRecordId: 'cdx-001' },
  { phrase: 'mcc-v1', expectedRecordId: 'cdx-001' },
  { phrase: 'go to intervector agent message', expectedRecordId: 'cdx-001' },
] as const;
