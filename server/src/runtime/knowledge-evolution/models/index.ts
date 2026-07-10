/**
 * Knowledge Evolution — canonical model barrel (Lane A).
 *
 * Re-exports the nine collection models (collection-name constant, protected-field
 * lists, and pure `validate*` functions) plus the shared validation primitives.
 * Models validate the domain contract; they never touch persistence.
 */

export * from './validation.js';
export * from './knowledgeEvolutionRecord.model.js';
export * from './knowledgeEvolutionPlan.model.js';
export * from './knowledgeEvolutionVersion.model.js';
export * from './knowledgeSupersession.model.js';
export * from './knowledgeRetrievalRollout.model.js';
export * from './knowledgeLanguageEvolution.model.js';
export * from './knowledgeRollbackPlan.model.js';
export * from './knowledgeEvolutionError.model.js';
export * from './knowledgeEvolutionMetrics.model.js';
