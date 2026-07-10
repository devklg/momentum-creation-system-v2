/**
 * Knowledge Evolution Runtime — Neo4j graph barrel (Lane C).
 *
 * Stable import surface for downstream lanes (D routes/workers). Re-exports the pure graph mapper
 * and the graph-sync coordination service. No behavior of its own.
 */

export * from './knowledgeEvolutionGraphMapper.js';
export * from './knowledgeEvolutionGraphSync.service.js';
