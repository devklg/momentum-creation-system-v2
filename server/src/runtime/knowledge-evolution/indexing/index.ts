/**
 * Knowledge Evolution Runtime — Chroma indexing barrel (Lane C).
 *
 * Stable import surface for downstream lanes (D routes/workers). Re-exports the active-collection
 * router and the reindex coordination service. No behavior of its own.
 */

export * from './activeKnowledgeCollectionRouter.js';
export * from './knowledgeEvolutionReindex.service.js';
