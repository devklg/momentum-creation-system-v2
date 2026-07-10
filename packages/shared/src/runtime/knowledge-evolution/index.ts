/**
 * Knowledge Evolution Runtime — shared contract barrel (Lane 0 foundation).
 *
 * Stable import surface for downstream lanes. Types + constants only; no behavior.
 * Consumed by server code via the `@momentum/shared/runtime` subpath export.
 */

export type * from './types.js';
export * from './constants.js';
