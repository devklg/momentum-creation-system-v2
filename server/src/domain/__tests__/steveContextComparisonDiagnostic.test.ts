import { describe, expect, it } from 'vitest';
import type { McsSteveDiscoveryArtifact } from '@momentum/shared';
import type { McsContextPacketV1 } from '@momentum/shared/runtime';
import { compareSteveInterviewToContext } from '../steveContextComparison.js';
import { buildSteveContextComparisonDiagnostic } from '../steveContextComparisonDiagnostic.js';

const artifact: McsSteveDiscoveryArtifact = {
  tmagId: 'TMAG-FIXTURE-1',
  sponsorTmagId: 'TMAG-SPONSOR-1',
  callSid: null,
  startedAt: '2026-07-06T08:00:00.000Z',
  completedAt: '2026-07-06T08:20:00.000Z',
  transcript: [],
  answers: [
    {
      questionId: 'q_learn_modality',
      prompt: 'How do you learn best?',
      answerText: 'I learn by doing, with simple examples and weekly text check-ins.',
    },
  ],
  successProfile: {
    tmagId: 'TMAG-FIXTURE-1',
    primaryWhy: {
      statement: 'I want more time with my family.',
      who: 'my family',
      whyNow: 'I am ready for a practical change.',
    },
    successVision: {
      statement: 'I want a calmer weekly rhythm.',
      oneBigChange: 'More evenings home.',
    },
    learningStyle: {
      modalities: ['doing', 'watching'],
      feedbackPreference: 'Direct examples help.',
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
      helpStyle: 'Give me one next step.',
      notes: '',
    },
    launchRecommendations: [{ text: 'Start with a warm list.', href: null }],
    trainingRecommendations: [{ text: 'Review first invitation training.', href: null }],
    michaelHandoffSummary: 'Hands-on learner who prefers weekly text check-ins.',
    generatedAt: '2026-07-06T08:20:00.000Z',
    signedBy: 'Steve Success',
  },
  audioUrl: null,
};

const packet = {
  packetStatus: 'complete',
  approvedKnowledge: [
    {
      knowledgeId: 'knowledge_learning_support',
      title: 'Learning support',
      summary: 'Hands-on learners benefit from doing, examples, and simple next steps.',
      retrieval: {
        reasonCodes: [],
        retrievalMethod: 'direct_reference',
        language: 'en',
        translationStatus: 'same_language',
      },
    },
    {
      knowledgeId: 'knowledge_sponsor_checkins',
      title: 'Sponsor check-ins',
      summary: 'Weekly text check-ins help sponsors support members who prefer short contact.',
      retrieval: {
        reasonCodes: [],
        retrievalMethod: 'direct_reference',
        language: 'en',
        translationStatus: 'same_language',
      },
    },
  ],
} as unknown as McsContextPacketV1;

describe('Steve context comparison diagnostic', () => {
  it('summarizes a non-persistent compiler comparison for controlled fixture proof', () => {
    const report = compareSteveInterviewToContext({
      artifact,
      packet,
      comparedAt: '2026-07-06T09:00:00.000Z',
    });
    const diagnostic = buildSteveContextComparisonDiagnostic({
      report,
      artifactSource: 'controlled_fixture',
      generatedAt: '2026-07-06T09:01:00.000Z',
    });

    expect(diagnostic).toMatchObject({
      ok: true,
      artifactSource: 'controlled_fixture',
      tmagId: 'TMAG-FIXTURE-1',
      persistenceStatus: 'not_persisted',
      approvedKnowledgeCount: 2,
    });
    expect(diagnostic.includedKnowledgeIds).toEqual([
      'knowledge_learning_support',
      'knowledge_sponsor_checkins',
    ]);
    expect(diagnostic.graphQuestionKeys).toContain('what_created_this_memory');
    expect(diagnostic.graphVerbs).toEqual(
      expect.arrayContaining(['captures', 'expresses', 'supports', 'hands_off_to']),
    );
    expect(diagnostic.recommendedContextQueryPreview).toContain('Hands-on learner');
  });
});
