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
    expect(domain).toContain('callSid: a.callSid');
    expect(domain).toContain('audioUrl: a.audioUrl');
  });

  it('projects only the sponsor-support fields Michael actually consumes', () => {
    const michael = source('server/src/domain/michael-training-support.ts');

    expect(michael).toContain("'successProfile.trainingRecommendations.text': 1");
    expect(michael).not.toContain("'successProfile.trainingRecommendations': 1");
    expect(michael).not.toContain("'successProfile.learningStyle.notes': 1");
    expect(michael).not.toContain("'successProfile.supportNeeds.notes': 1");
    expect(michael).not.toContain("'successProfile.launchRecommendations': 1");
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
