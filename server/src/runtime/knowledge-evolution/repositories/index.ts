/**
 * Knowledge Evolution — repository barrel (Lane A).
 *
 * The ONLY sanctioned write path to the nine canonical Mongo collections. Each
 * repository validates through the model layer before persisting, is idempotent
 * where re-processing is expected, and preserves audit history (append-only
 * collections expose no patch/delete). Route handlers must NOT call these
 * directly — services (Lane B) own the callers.
 */

export * from './knowledgeEvolutionRecord.repository.js';
export * from './knowledgeEvolutionPlan.repository.js';
export * from './knowledgeEvolutionVersion.repository.js';
export * from './knowledgeSupersession.repository.js';
export * from './knowledgeRetrievalRollout.repository.js';
export * from './knowledgeLanguageEvolution.repository.js';
export * from './knowledgeRollbackPlan.repository.js';
export * from './knowledgeEvolutionError.repository.js';
export * from './knowledgeEvolutionMetrics.repository.js';
