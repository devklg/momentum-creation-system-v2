/**
 * Knowledge Evolution Runtime — Lane B runtime dependencies (clock + id factory).
 *
 * Services take these as injected deps so every test controls time and ids deterministically.
 * Defaults use the real clock and `randomUUID`; tests pass fakes. No persistence, no I/O beyond
 * the id source.
 */

import { randomUUID } from 'node:crypto';

/** Injectable wall clock. Tests supply a fixed/monotonic implementation. */
export interface EvolutionRuntimeClock {
  now(): Date;
}

/** Injectable id source. Ids are `<prefix>_<unique>` so records are self-describing. */
export interface EvolutionIdFactory {
  newId(prefix: string): string;
}

export interface EvolutionRuntimeDeps {
  clock: EvolutionRuntimeClock;
  ids: EvolutionIdFactory;
}

/** Real-clock, random-id deps for production wiring (Lane D). */
export function defaultEvolutionRuntimeDeps(): EvolutionRuntimeDeps {
  return {
    clock: { now: () => new Date() },
    ids: { newId: (prefix) => `${prefix}_${randomUUID()}` },
  };
}
