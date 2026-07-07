import { describe, expect, it } from 'vitest';
import type { McsSteveDiscoveryArtifact } from '@momentum/shared';
import type { McsContextPacketV1 } from '@momentum/shared/runtime';
import { MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION } from '@momentum/shared/runtime';
import {
  buildRecommendedContextQuery,
  compareSteveInterviewToContext,
} from '../steveContextComparison.js';

const artifact: McsSteveDiscoveryArtifact = {
  tmagId: 'TMAG-1',
  sponsorTmagId: 'TMAG-0',
  callSid: null,
  startedAt: '2026-07-06T00:00:00.000Z',
  completedAt: '2026-07-06T00:10:00.000Z',
  transcript: [],
  answers: [
    {
      questionId: 'q_learn_modality',
      prompt: 'How do you learn?',
      answerText: 'I learn best by doing and with weekly text check-ins.',
    },
  ],
  successProfile: {
    tmagId: 'TMAG-1',
    primaryWhy: {
      statement: 'I want more time with my family.',
      who: 'my family',
      whyNow: 'I need a practical change now.',
    },
    successVision: {
      statement: 'I want a calmer schedule.',
      oneBigChange: 'More evenings home.',
    },
    learningStyle: {
      modalities: ['doing', 'watching'],
      feedbackPreference: 'Direct examples help me learn.',
      notes: 'Hands-on learner.',
    },
    communicationPreferences: {
      preferredChannels: ['text'],
      cadence: 'weekly',
      bestTimes: 'evenings',
      notes: 'Short check-ins are best.',
    },
    supportNeeds: {
      areas: ['first invitations'],
      potentialObstacles: ['time'],
      helpStyle: 'Give me one simple next step.',
      notes: '',
    },
    launchRecommendations: [{ text: 'Start with a warm list.', href: null }],
    trainingRecommendations: [{ text: 'Review the first invitation training.', href: null }],
    michaelHandoffSummary: 'Hands-on learner who prefers weekly text check-ins.',
    generatedAt: '2026-07-06T00:10:00.000Z',
    signedBy: 'Steve Success',
  },
  audioUrl: null,
};

function packet(overrides: Partial<McsContextPacketV1> = {}): McsContextPacketV1 {
  return {
    packetStatus: 'complete',
    approvedKnowledge: [
      {
        knowledgeId: 'knowledge_learning' as never,
        title: 'Learning support',
        summary: 'Hands-on learners benefit from doing, examples, and simple next steps.',
        retrieval: { reasonCodes: [], retrievalMethod: 'direct_reference', language: 'en', translationStatus: 'same_language' },
      },
      {
        knowledgeId: 'knowledge_communication' as never,
        title: 'Sponsor communication',
        summary: 'Weekly text check-ins help sponsors support members who prefer short contact.',
        retrieval: { reasonCodes: [], retrievalMethod: 'direct_reference', language: 'en', translationStatus: 'same_language' },
      },
    ],
    ...overrides,
  } as never;
}

describe('Steve context comparison', () => {
  it('compares a saved Steve interview artifact to approved Context Packet knowledge', () => {
    const report = compareSteveInterviewToContext({
      artifact,
      packet: packet(),
      comparedAt: '2026-07-06T01:00:00.000Z',
    });

    expect(report.schemaVersion).toBe(MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION);
    expect(report.compiledShape.compiler.compilerName).toBe('memory_context_compiler');
    expect(report.compiledShape.subject.tmagId).toBe('TMAG-1');
    expect(report.summary.approvedKnowledgeCount).toBe(2);
    expect(report.compiledShape.persistenceStatus).toBe('not_persisted');
    expect(report.compiledShape.storeContributions.map((item) => item.function)).toEqual([
      'canonical_memory',
      'relationship_graph',
      'semantic_meaning',
    ]);
    expect(report.compiledShape.graphQuestions.map((item) => item.key)).toContain(
      'what_does_this_memory_mean',
    );
    expect(report.compiledShape.graphEdges.map((item) => item.verb)).toEqual(
      expect.arrayContaining(['captures', 'expresses', 'supports', 'hands_off_to']),
    );
    expect(report.compiledShape.graphEdges.some((edge) =>
      edge.fromIngredientId === 'steve_signal_learning_style' &&
      edge.toIngredientId === 'approved_knowledge_knowledge_learning',
    )).toBe(true);
    expect(report.signals.find((signal) => signal.key === 'learning_style')?.status).toBe('covered');
    expect(report.signals.find((signal) => signal.key === 'communication_preferences')?.status).toBe('covered');
    expect(report.recommendedContextQuery).toContain('Hands-on learner');
  });

  it('marks missing coverage when the packet has no approved knowledge', () => {
    const report = compareSteveInterviewToContext({
      artifact,
      packet: packet({ packetStatus: 'degraded', approvedKnowledge: [] }),
    });

    expect(report.summary.missingSignalCount).toBeGreaterThan(0);
    expect(report.warnings).toContain('No approved knowledge was present in the Context Packet.');
    expect(report.warnings[0]).toContain('degraded');
  });

  it('builds a reusable semantic query from the whole interview profile', () => {
    const query = buildRecommendedContextQuery(artifact);

    expect(query).toContain('weekly text check-ins');
    expect(query).toContain('first invitation training');
    expect(query.length).toBeLessThanOrEqual(2500);
  });
});
