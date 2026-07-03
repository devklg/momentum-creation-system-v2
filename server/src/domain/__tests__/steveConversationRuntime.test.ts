import { describe, expect, it } from 'vitest';
import {
  ExtractionSchema,
  parseExtractionJson,
  splitCompletionMarker,
} from '../steveConversationRuntime.js';

describe('steveConversationRuntime helpers', () => {
  it('detects and strips the completion marker', () => {
    const r = splitCompletionMarker('Thank you, Kevin. Welcome aboard.\n[[DISCOVERY_COMPLETE]]');
    expect(r.done).toBe(true);
    expect(r.text).toBe('Thank you, Kevin. Welcome aboard.');
  });

  it('passes normal replies through untouched', () => {
    const r = splitCompletionMarker('Tell me more about that.');
    expect(r.done).toBe(false);
    expect(r.text).toBe('Tell me more about that.');
  });

  it('parses fenced extraction JSON and validates the shape', () => {
    const raw = [
      '```json',
      JSON.stringify({
        answers: [{ questionId: 'q1', answerText: 'Freedom for my family.' }],
        profile: {
          primaryWhy: { statement: 'Freedom', who: 'my kids', whyNow: 'timing is right' },
          successVision: { statement: 'Debt-free in a year', oneBigChange: 'quit my second job' },
          learningStyle: { modalities: ['doing', 'watching'], feedbackPreference: 'direct', notes: '' },
          communicationPreferences: {
            preferredChannels: ['text', 'call'],
            cadence: 'weekly',
            bestTimes: 'evenings',
            notes: '',
          },
          supportNeeds: { areas: ['first invitations'], potentialObstacles: ['time'], helpStyle: 'ask early', notes: '' },
          launchRecommendations: [{ text: 'Start with your warm list.', href: null }],
          trainingRecommendations: [],
          michaelHandoffSummary: 'Hands-on learner, weekly check-ins.',
        },
      }),
      '```',
    ].join('\n');
    const parsed = ExtractionSchema.parse(parseExtractionJson(raw));
    expect(parsed.profile.primaryWhy.statement).toBe('Freedom');
    expect(parsed.profile.communicationPreferences.cadence).toBe('weekly');
    expect(parsed.answers).toHaveLength(1);
  });

  it('rejects invalid enum values so the retry path fires', () => {
    const bad = {
      answers: [],
      profile: {
        primaryWhy: { statement: 'x', who: '', whyNow: '' },
        successVision: { statement: 'y', oneBigChange: '' },
        learningStyle: { modalities: ['osmosis'], feedbackPreference: '', notes: '' },
        communicationPreferences: { preferredChannels: [], cadence: null, bestTimes: '', notes: '' },
        supportNeeds: { areas: [], potentialObstacles: [], helpStyle: '', notes: '' },
        launchRecommendations: [],
        trainingRecommendations: [],
        michaelHandoffSummary: '',
      },
    };
    expect(ExtractionSchema.safeParse(bad).success).toBe(false);
  });
});
