/**
 * Knowledge Evolution — persistence barrel (Lane A).
 *
 * Exposes the narrow Mongo primitives and the index catalog/ensure helper.
 * MongoDB is canonical (spec §27); Chroma/Neo4j projection coordination is
 * Lane C and is intentionally NOT reachable from here.
 */

export * from './mongoRepository.js';
export * from './indexes.js';
