import { describe, expect, it } from 'vitest';
import {
  ACTIVE_RETRIEVAL_DOMAINS,
  REVIEW_ONLY_CANDIDATE_COLLECTION,
  activeKnowledgeCollection,
  isActiveRetrievalDomain,
  logicalActiveCollection,
  routeActiveKnowledgeCollection,
  type ActiveKnowledgeLifecycle,
} from '../activeKnowledgeCollectionRouter.js';

describe('activeKnowledgeCollectionRouter — collection naming', () => {
  it('produces mcs_-prefixed physical collections for every retrieval domain × language', () => {
    for (const domain of ACTIVE_RETRIEVAL_DOMAINS) {
      for (const language of ['en', 'es'] as const) {
        expect(activeKnowledgeCollection(domain, language)).toBe(
          `mcs_${domain}_knowledge_${language}`,
        );
        expect(logicalActiveCollection(domain, language)).toBe(
          `${domain}_knowledge_${language}`,
        );
      }
    }
  });

  it('treats personal as NOT retrieval-eligible and refuses an active collection for it', () => {
    expect(isActiveRetrievalDomain('personal')).toBe(false);
    // @ts-expect-error personal is not a KnowledgeRetrievalDomain — proven at runtime too
    expect(() => activeKnowledgeCollection('personal', 'en')).toThrow();
  });
});

describe('activeKnowledgeCollectionRouter — routing decisions', () => {
  it('routes active + approved knowledge into its domain/language active collection', () => {
    const route = routeActiveKnowledgeCollection({
      domain: 'success',
      language: 'es',
      lifecycle: 'active',
      approved: true,
    });
    expect(route.action).toBe('index_active');
    expect(route.activeCollection).toBe('mcs_success_knowledge_es');
    expect(route.reviewOnlyCollection).toBe(REVIEW_ONLY_CANDIDATE_COLLECTION);
  });

  it.each<ActiveKnowledgeLifecycle>(['candidate', 'review_only'])(
    'NEVER routes %s knowledge into active retrieval (candidate/active separation)',
    (lifecycle) => {
      const route = routeActiveKnowledgeCollection({
        domain: 'success',
        language: 'en',
        lifecycle,
        approved: true, // even if flagged approved, candidate/review-only stays out
      });
      expect(route.action).toBe('keep_out_of_active');
      expect(route.activeCollection).toBeNull();
      expect(route.reviewOnlyCollection).toBe('mcs_learning_candidates_review');
    },
  );

  it('keeps unapproved active-lifecycle knowledge out of active retrieval', () => {
    const route = routeActiveKnowledgeCollection({
      domain: 'training',
      language: 'en',
      lifecycle: 'active',
      approved: false,
    });
    expect(route.action).toBe('keep_out_of_active');
    expect(route.activeCollection).toBeNull();
  });

  it.each<ActiveKnowledgeLifecycle>(['superseded', 'archived'])(
    'excludes %s knowledge from active retrieval (removal from active collection)',
    (lifecycle) => {
      const route = routeActiveKnowledgeCollection({
        domain: 'organizational',
        language: 'en',
        lifecycle,
        approved: true,
      });
      expect(route.action).toBe('remove_from_active');
      expect(route.activeCollection).toBe('mcs_organizational_knowledge_en');
    },
  );

  it('keeps personal-domain knowledge out of active retrieval regardless of lifecycle', () => {
    const route = routeActiveKnowledgeCollection({
      domain: 'personal',
      language: 'en',
      lifecycle: 'active',
      approved: true,
    });
    expect(route.action).toBe('keep_out_of_active');
    expect(route.activeCollection).toBeNull();
  });
});
