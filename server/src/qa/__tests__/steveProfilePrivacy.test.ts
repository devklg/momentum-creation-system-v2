import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function source(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('P2-141 Steve Success Profile privacy boundary', () => {
  it('keeps private profile responses non-cacheable and internal errors content-free', () => {
    const steve = source('server/src/routes/steve.ts');
    const michael = source('server/src/routes/michael.ts');
    const admin = source('server/src/routes/admin/agents.ts');

    for (const text of [steve, michael, admin]) {
      expect(text).toContain("private, no-store");
    }
    expect(steve).not.toContain('Could not load discovery state: ${msg}');
    expect(steve).not.toContain('Discovery ingest failed: ${msg}');
    expect(steve).not.toContain('Profile read failed: ${msg}');
    expect(steve).not.toContain('Conversation read failed: ${msg}');
    expect(steve).not.toContain('Steve conversation failed: ${msg}');
    expect(steve).toContain("code: 'PROFILE_UNAVAILABLE'");
    expect(michael).toContain("code: 'TRAINING_SUPPORT_UNAVAILABLE'");
    expect(steve).not.toContain('error: err.message, code: err.code');
    expect(michael).not.toContain('error: err.message, code: err.code');
  });

  it('never uses raw BA turn text as an approved-knowledge query or plaintext cache key', () => {
    const foundation = source(
      'server/src/runtime/context/steveRuntimeContextFoundation.ts',
    );
    const store = source(
      'server/src/services/knowledge/approvedKnowledgeStore.ts',
    );

    expect(foundation).toContain('_turnContent: string | undefined');
    expect(foundation).not.toContain('if (normalizedTurn) return normalizedTurn');
    expect(store).toContain("createHash('sha256')");
    expect(store).toContain("])).digest('hex')");
    expect(store).not.toContain('return JSON.stringify([');
  });

  it('minimizes new relationship and semantic projections without changing canonical Mongo', () => {
    const domain = source('server/src/domain/steve-success-interview.ts');

    expect(domain).not.toContain('d.callSid = $callSid');
    expect(domain).not.toContain('d.audioUrl = $audioUrl');
    expect(domain).not.toContain('`Primary why: ${sp.primaryWhy.statement}.`');
    expect(domain).not.toContain('`Success vision: ${sp.successVision.statement}.`');
    expect(domain).not.toContain('`Learns by: ${learn}.');
    expect(domain).not.toContain('`Support areas: ${sp.supportNeeds.areas.join');
    expect(domain).toContain('Profile content is canonical in MongoDB.');
    expect(domain).toContain('retrievalEligible: false');
    expect(domain).toContain('callSid: null');
    expect(domain).toContain('audioUrl: null');
    expect(domain).not.toContain('VISIBLE_TO_SPONSOR');
    expect(domain).toContain("'ALREADY_EXISTS'");
  });

  it('uses a bounded base sponsor projection and exact conditional private reads', () => {
    const michael = source('server/src/domain/michael-training-support.ts');
    const baseProjection = michael.slice(
      michael.indexOf('async function getSteveDiscoveryByTmagId'),
      michael.indexOf('interface ConsentedPrivateFields'),
    );

    expect(baseProjection).toContain("'successProfile.trainingRecommendations.text': 1");
    expect(baseProjection).not.toContain("'successProfile.trainingRecommendations': 1");
    expect(baseProjection).not.toContain("'successProfile.learningStyle.notes': 1");
    expect(baseProjection).not.toContain("'successProfile.supportNeeds.notes': 1");
    expect(baseProjection).not.toContain("'successProfile.launchRecommendations': 1");
    expect(baseProjection).not.toContain("'successProfile.primaryWhy.statement': 1");
    expect(baseProjection).not.toContain("'successProfile.successVision.statement': 1");
    expect(baseProjection).not.toContain("'successProfile.supportNeeds.potentialObstacles': 1");
    expect(baseProjection).not.toContain("'successProfile.michaelHandoffSummary': 1");
    expect(michael).toContain("projection['successProfile.primaryWhy.statement'] = 1");
    expect(michael).toContain("projection['successProfile.successVision.statement'] = 1");
    expect(michael).toContain(
      "projection['successProfile.supportNeeds.potentialObstacles'] = 1",
    );
    expect(michael).toContain(
      "projection['successProfile.michaelHandoffSummary'] = 1",
    );
    expect(michael).toContain('effectiveSteveSponsorConsentFields(');
    expect(michael).toContain("primaryWhy: ''");
    expect(michael).toContain("successVision: ''");
    expect(michael).toContain("michaelHandoffSummary: ''");
  });

  it('exposes BA-owned export, one-way withdrawal, and four exact consent controls', () => {
    const route = source('server/src/routes/steve.ts');
    const shared = source('packages/shared/src/steve-privacy.ts');
    const page = source('apps/team/src/routes/steve-success-interview.tsx');
    const cockpit = source('server/src/domain/cockpit.ts');
    const recruitingCycle = source('server/src/domain/recruitingCycle.ts');

    for (const path of [
      '/discovery/privacy',
      '/discovery/export',
      '/discovery/privacy/consent',
      '/discovery/privacy/withdraw',
    ]) {
      expect(route).toContain(path);
    }
    for (const field of [
      'why_statement',
      'success_vision',
      'support_obstacles',
      'michael_handoff_summary',
    ]) {
      expect(shared).toContain(`'${field}'`);
      expect(page).toContain(`${field}:`);
    }
    expect(shared).toContain("'WITHDRAW STEVE PERSONALIZATION'");
    expect(page).toContain('Sponsor sharing is off for private fields');
    expect(page).toContain('Export my profile');
    expect(page).toContain('Turn off personalization');
    expect(cockpit).toContain('personalizationActive');
    expect(cockpit).toContain('normalizeStevePrivacyState(rawProfile?.privacy)');
    expect(recruitingCycle).toContain(
      "normalizeStevePrivacyState(discovery?.privacy).status === 'withdrawn'",
    );
  });

  it('fails the legacy raw sponsor route closed and nulls provider/audio fields', () => {
    const domain = source('server/src/domain/steve-success-interview.ts');

    expect(domain).toContain("'CONSENT_REQUIRED'");
    expect(domain).not.toContain('answers: artifact.answers');
    expect(domain).not.toContain('successProfile: artifact.successProfile');
    expect(domain).toContain('callSid: null');
    expect(domain).toContain('audioUrl: null');
    expect(domain).not.toContain('callSid: a.callSid');
    expect(domain).not.toContain('audioUrl: a.audioUrl');
  });

  it('uses first-name-only member projections for Steve prompt personalization', () => {
    const workerRoute = source('server/src/routes/steve.ts');
    const browserRuntime = source('server/src/domain/steveConversationRuntime.ts');

    for (const text of [workerRoute, browserRuntime]) {
      expect(text).toContain('projection: { firstName: 1 }');
      expect(text).toContain('limit: 1');
    }
  });

  it('keeps Steve private data out of the prospect-facing application', () => {
    const comFiles = [
      source('apps/com/src/App.tsx'),
      source('apps/com/src/routes/p-token.tsx'),
    ];
    for (const text of comFiles) {
      expect(text).not.toMatch(/success profile|steve discovery|primary why|audioUrl/i);
    }
  });
});
