import { describe, expect, it } from 'vitest';
import {
  ExtractionSchema,
  extractionSystem,
  parseExtractionJson,
  splitCompletionMarker,
} from '../steveConversationRuntime.js';
import { buildSteveSystemPrompt } from '../steve-success-interview.js';

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

  it('preserves the member stated dollar goal in the extracted success vision', () => {
    const sample = {
      answers: [
        {
          questionId: 'q_success_vision',
          answerText: 'I want to create $5,000 a month so I can leave my second job.',
        },
      ],
      profile: {
        primaryWhy: {
          statement: 'Create $5,000 a month for my family.',
          who: 'my family',
          whyNow: 'I am tired of missing evenings at home.',
        },
        successVision: {
          statement: 'Create $5,000 a month and leave my second job.',
          oneBigChange: 'more evenings with my family',
        },
        learningStyle: { modalities: ['doing'], feedbackPreference: 'direct', notes: '' },
        communicationPreferences: {
          preferredChannels: ['text'],
          cadence: 'weekly',
          bestTimes: 'evenings',
          notes: '',
        },
        supportNeeds: { areas: ['first invitations'], potentialObstacles: ['time'], helpStyle: 'simple next step', notes: '' },
        launchRecommendations: [{ text: 'Start with a short warm list.', href: null }],
        trainingRecommendations: [{ text: 'Review the first invitation training.', href: null }],
        michaelHandoffSummary: 'Wants simple weekly support and practical first steps.',
      },
    };

    const parsed = ExtractionSchema.parse(sample);

    expect(parsed.profile.successVision.statement).toContain('$5,000 a month');
    expect(parsed.profile.primaryWhy.statement).toContain('$5,000 a month');
    expect(parsed.profile.launchRecommendations[0]?.text).not.toMatch(/\$|income|earnings/i);
    expect(parsed.profile.trainingRecommendations[0]?.text).not.toMatch(/\$|income|earnings/i);
  });

  it('scopes income restrictions to recommendations while preserving member goals', () => {
    const system = extractionSystem();

    expect(system).toContain('launchRecommendations');
    expect(system).toContain('trainingRecommendations');
    expect(system).toContain('primaryWhy and successVision MUST faithfully');
    expect(system).toContain('member-stated dollar goals');
    expect(system).not.toContain('earnings language anywhere');
  });

  it('welcomes member-authored income goals without letting Steve make income claims', () => {
    const prompt = buildSteveSystemPrompt({ baFirstName: 'Kevin' });

    expect(prompt).toContain('including a dollar amount or income');
    expect(prompt).toContain('capture it faithfully as THEIR goal');
    expect(prompt).toContain("I can't talk about income");
    expect(prompt).toContain('Never state, project, or imply earnings');
    expect(prompt).toContain('Never characterize a BA\'s stated income or dollar goal as achievable');
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
