import { describe, expect, it } from 'vitest';
import type { McsSteveSuccessProfile } from '@momentum/shared';
import { projectSuccessProfileToCard } from '../michael-training-support.js';
import { projectSteveTailoredGuidance } from '../steve-tailored-guidance.js';

const profile = {
  tmagId: 'TMAG-001',
  generatedAt: '2026-07-13T00:00:00.000Z',
  signedBy: 'Steve Success · non-scored discovery profile',
  trainingRecommendations: [
    { text: '  Start with the product module.  ', href: '/training/fast-start/product' },
    { text: 'Use this unknown page.', href: '/training/not-real' },
    { text: 'Review the compensation plan with your sponsor.', href: null },
    { text: 'This guarantees income and a placement.', href: '/training/fast-start' },
  ],
  launchRecommendations: [
    { text: 'Write down the people you already know.', href: '/ivory' },
    { text: 'Use an external page.', href: 'https://example.com' },
  ],
} as unknown as McsSteveSuccessProfile;

describe('P2-118 Steve tailored guidance projection', () => {
  it('passes through bounded Steve guidance in source order and allowlists links', () => {
    const guidance = projectSteveTailoredGuidance({
      expectedTmagId: 'TMAG-001',
      steveComplete: true,
      profileRecordCount: 1,
      successProfile: profile,
    });

    expect(guidance.status).toBe('available');
    expect(guidance.training).toEqual([
      { text: 'Start with the product module.', href: '/training/fast-start/product' },
      { text: 'Use this unknown page.', href: null },
      { text: 'Review the compensation plan with your sponsor.', href: null },
    ]);
    expect(guidance.launch).toEqual([
      { text: 'Write down the people you already know.', href: '/ivory' },
      { text: 'Use an external page.', href: null },
    ]);
    expect(guidance.provenance).toEqual({
      generatedAt: '2026-07-13T00:00:00.000Z',
      signedBy: 'Steve Success · non-scored discovery profile',
    });
  });

  it('fails closed for incomplete, missing, duplicate, or mismatched profile evidence', () => {
    expect(projectSteveTailoredGuidance({
      expectedTmagId: 'TMAG-001', steveComplete: false, profileRecordCount: 1, successProfile: profile,
    })).toMatchObject({ status: 'unavailable', reason: 'profile_not_complete', training: [], launch: [] });
    expect(projectSteveTailoredGuidance({
      expectedTmagId: 'TMAG-001', steveComplete: true, profileRecordCount: 0, successProfile: null,
    })).toMatchObject({ status: 'unavailable', reason: 'profile_missing', training: [], launch: [] });
    expect(projectSteveTailoredGuidance({
      expectedTmagId: 'TMAG-001', steveComplete: true, profileRecordCount: 2, successProfile: profile,
    })).toMatchObject({ status: 'needs_attention', reason: 'profile_duplicate_or_identity_inconsistent' });
    expect(projectSteveTailoredGuidance({
      expectedTmagId: 'TMAG-OTHER', steveComplete: true, profileRecordCount: 1, successProfile: profile,
    })).toMatchObject({ status: 'needs_attention', reason: 'profile_duplicate_or_identity_inconsistent' });
    expect(projectSteveTailoredGuidance({
      expectedTmagId: 'TMAG-001',
      steveComplete: true,
      profileRecordCount: 1,
      successProfile: profile,
      personalizationActive: false,
    })).toMatchObject({
      status: 'unavailable',
      reason: 'profile_missing',
      training: [],
      launch: [],
    });
  });

  it('states that guidance never changes equal access, order, completion, or next action', () => {
    const guidance = projectSteveTailoredGuidance({
      expectedTmagId: 'TMAG-001', steveComplete: true, profileRecordCount: 1, successProfile: profile,
    });
    expect(guidance.policy).toEqual({
      guidanceNotRequirement: true,
      equalAccess: true,
      changesAccess: false,
      changesCurriculumOrder: false,
      changesCompletion: false,
      changesLaunchNextAction: false,
      approvedKnowledge: false,
      scoring: false,
      ranking: false,
      classification: false,
      qualification: false,
      prediction: false,
      comparison: false,
    });
  });

  it('keeps the default sponsor projection bounded to ACR-0031 training support', () => {
    const canonical = {
      ...profile,
      primaryWhy: { statement: 'Build a family legacy', who: 'family', whyNow: 'now' },
      successVision: { statement: 'Lead with confidence', oneBigChange: 'consistency' },
      learningStyle: { modalities: ['doing'], feedbackPreference: 'Directly', notes: '' },
      communicationPreferences: { preferredChannels: ['text'], cadence: 'weekly', bestTimes: 'Evenings', notes: '' },
      supportNeeds: {
        areas: ['inviting'],
        potentialObstacles: ['time'],
        helpStyle: 'Ask me early',
        notes: '',
      },
      michaelHandoffSummary: 'Support with small actions.',
    } as McsSteveSuccessProfile;

    const card = projectSuccessProfileToCard({
      downlineTmagId: 'TMAG-001',
      downlineFirstName: 'Alex',
      profile: canonical,
    });
    expect(card.trainingRecommendations).toEqual([
      'Start with the product module.',
      'Use this unknown page.',
      'Review the compensation plan with your sponsor.',
    ]);
    expect(card.primaryWhy).toBe('');
    expect(card.successVision).toBe('');
    expect(card.michaelHandoffSummary).toBe('');
    expect(card.supportFocus.bullets).not.toContain('They named: time.');
    expect(card.supportFocus.bullets).toEqual([
      'Where they want support early: inviting.',
      'When stuck: Ask me early.',
    ]);
  });

  it('adds only the exact private fields the BA consented to share', () => {
    const canonical = {
      ...profile,
      primaryWhy: { statement: 'Build a family legacy', who: 'family', whyNow: 'now' },
      successVision: { statement: 'Lead with confidence', oneBigChange: 'consistency' },
      learningStyle: { modalities: ['doing'], feedbackPreference: 'Directly', notes: '' },
      communicationPreferences: { preferredChannels: ['text'], cadence: 'weekly', bestTimes: 'Evenings', notes: '' },
      supportNeeds: {
        areas: ['inviting'],
        potentialObstacles: ['time', 'technology'],
        helpStyle: 'Ask me early',
        notes: '',
      },
      michaelHandoffSummary: 'Support with small actions.',
    } as McsSteveSuccessProfile;

    const card = projectSuccessProfileToCard({
      downlineTmagId: 'TMAG-001',
      downlineFirstName: 'Alex',
      profile: canonical,
      consentedFields: {
        primaryWhy: 'Build a family legacy',
        successVision: '',
        supportObstacles: ['time'],
        michaelHandoffSummary: 'Support with small actions.',
      },
    });

    expect(card.primaryWhy).toBe('Build a family legacy');
    expect(card.successVision).toBe('');
    expect(card.michaelHandoffSummary).toBe('Support with small actions.');
    expect(card.supportFocus.bullets).toContain(
      'Obstacles they chose to share: time.',
    );
    expect(card.supportFocus.bullets).not.toContain('technology');
  });
});
