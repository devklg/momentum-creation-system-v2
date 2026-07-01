/**
 * Deterministic id derivation for the knowledge intake pipeline (Phase 4 — P4.5A).
 *
 * Ids are pure functions of stable inputs (sourceId, version, chunkIndex) so the same raw
 * source re-parsed yields identical document/chunk/index ids — traceability is reproducible,
 * not run-dependent. No randomness, no clock, no persistence.
 */

import type { McsSourceId } from '@momentum/shared/runtime';

/** FNV-1a 32-bit hash → 8-char zero-padded hex. Deterministic and dependency-free. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function deriveDocumentId(sourceId: McsSourceId, version: number): string {
  return `kdoc_${fnv1a(`${String(sourceId)}:${version}`)}`;
}

export function deriveChunkId(sourceId: McsSourceId, version: number, chunkIndex: number): string {
  return `kchunk_${fnv1a(`${String(sourceId)}:${version}:${chunkIndex}`)}`;
}

export function deriveKnowledgeId(chunkId: string): string {
  return `knw_${fnv1a(`knowledge:${chunkId}`)}`;
}

export function deriveIndexRecordId(chunkId: string): string {
  return `kidx_${chunkId}`;
}
