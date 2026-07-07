/**
 * Steve Context Compiler smoke proof.
 *
 * Run: pnpm --filter @momentum/server smoke:steve-context
 *
 * Steve has only recently been wired, so this smoke intentionally uses a
 * controlled fixture instead of expecting local saved Steve artifacts to exist.
 * It produces a non-persistent local report under the repo .logs directory.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McsSteveDiscoveryArtifact } from '@momentum/shared';
import type {
  McsContextPacketId,
  McsContextRequestId,
  McsKnowledgeId,
  McsSessionId,
  McsSourceId,
  McsTeamId,
  McsTenantId,
  TmagId,
} from '@momentum/shared/runtime';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from '../src/runtime/events/index.js';
import { buildContextPacket } from '../src/runtime/context/contextManager.js';
import { compareSteveInterviewToContext } from '../src/domain/steveContextComparison.js';
import { buildSteveContextComparisonDiagnostic } from '../src/domain/steveContextComparisonDiagnostic.js';

const generatedAt = new Date().toISOString();
const tmagId = 'TMAG-FIXTURE-STEVE-001' as TmagId;

const artifact: McsSteveDiscoveryArtifact = {
  tmagId,
  sponsorTmagId: 'TMAG-FIXTURE-SPONSOR-001',
  callSid: null,
  startedAt: '2026-07-06T08:00:00.000Z',
  completedAt: '2026-07-06T08:20:00.000Z',
  transcript: [],
  answers: [
    {
      questionId: 'q_learn_modality',
      prompt: 'How do you learn best?',
      answerText: 'I learn best by doing, with simple examples and weekly text check-ins.',
    },
    {
      questionId: 'q_support_areas',
      prompt: 'Where would extra support help most?',
      answerText: 'I need help with my first invitations and staying consistent with small daily action.',
    },
  ],
  successProfile: {
    tmagId,
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
      areas: ['first invitations', 'daily action'],
      potentialObstacles: ['time'],
      helpStyle: 'Give me one simple next step.',
      notes: '',
    },
    launchRecommendations: [
      { text: 'Start with a warm list and one simple invitation.', href: null },
    ],
    trainingRecommendations: [
      { text: 'Review invitation training and daily action rhythm.', href: null },
    ],
    michaelHandoffSummary:
      'Hands-on learner who prefers weekly text check-ins and needs simple daily action support.',
    generatedAt: '2026-07-06T08:20:00.000Z',
    signedBy: 'Steve Success',
  },
  audioUrl: null,
};

const packet = buildContextPacket({
  packetId: 'ctx_packet_steve_context_smoke' as McsContextPacketId,
  requestId: 'ctx_req_steve_context_smoke' as McsContextRequestId,
  tenant: {
    tenantId: 'tenant_team_magnificent' as McsTenantId,
    tenantName: 'Team Magnificent Tenant',
    brandName: TEAM_MAGNIFICENT_NAME,
    environment: 'development',
  },
  team: {
    teamId: 'team_magnificent' as McsTeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
  },
  ba: {
    tenantId: 'tenant_team_magnificent' as McsTenantId,
    teamId: 'team_magnificent' as McsTeamId,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId,
    journalEnabled: false,
    languagePreference: 'en',
    permissions: {
      canUsePrivateJournal: false,
      canSelectJournalForReview: false,
      canCreateKnowledgeCandidate: false,
      canAccessRelationshipContext: false,
      canUseBrowserVoice: false,
      canUseBrowserText: true,
    },
  },
  session: {
    sessionId: 'steve_context_smoke_session' as McsSessionId,
    mode: 'browser_text',
    status: 'active',
    taskType: 'success_interview',
    startedAt: generatedAt,
  },
  agentKey: 'steve_success',
  objective: 'success_interview',
  language: {
    primary: 'en',
    userPreference: 'en',
    translationAllowed: false,
    translationStatus: 'same_language',
    machineTranslationUsed: false,
    humanReviewed: true,
  },
  approvedKnowledge: [
    {
      knowledgeId: 'knowledge_steve_learning_support' as McsKnowledgeId,
      title: 'Steve learning support',
      summary: 'Hands-on learners benefit from doing, examples, and one simple next step.',
      status: 'active',
      governanceStatus: 'approved',
      language: 'en',
      sourceTraceability: {
        sourceId: 'source_steve_context_fixture_learning' as McsSourceId,
        sourceType: 'controlled_fixture',
        title: 'Controlled Steve context fixture',
        capturedAt: generatedAt,
      },
      retrieval: {
        retrievalMethod: 'direct_reference',
        reasonCodes: ['agent_task_match'],
        language: 'en',
        translationStatus: 'same_language',
      },
    },
    {
      knowledgeId: 'knowledge_steve_sponsor_checkins' as McsKnowledgeId,
      title: 'Sponsor check-ins',
      summary:
        'Weekly text check-ins help sponsors support members who prefer short contact and steady encouragement.',
      status: 'active',
      governanceStatus: 'approved',
      language: 'en',
      sourceTraceability: {
        sourceId: 'source_steve_context_fixture_checkins' as McsSourceId,
        sourceType: 'controlled_fixture',
        title: 'Controlled Steve context fixture',
        capturedAt: generatedAt,
      },
      retrieval: {
        retrievalMethod: 'direct_reference',
        reasonCodes: ['agent_task_match'],
        language: 'en',
        translationStatus: 'same_language',
      },
    },
  ],
  provenance: {
    assembledBy: 'context_manager',
    requestId: 'ctx_req_steve_context_smoke' as McsContextRequestId,
    componentVersion: 's1.5',
    traceId: 'steve-context-smoke',
  },
  createdAt: generatedAt,
});

function repoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (dir.endsWith(`${path.sep}server`)) return path.dirname(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

async function main(): Promise<void> {
  const report = compareSteveInterviewToContext({
    artifact,
    packet,
    comparedAt: generatedAt,
  });
  const diagnostic = buildSteveContextComparisonDiagnostic({
    report,
    artifactSource: 'controlled_fixture',
    generatedAt,
  });

  if (diagnostic.persistenceStatus !== 'not_persisted') {
    throw new Error(`Expected not_persisted, got ${diagnostic.persistenceStatus}`);
  }
  if (diagnostic.approvedKnowledgeCount < 1) {
    throw new Error('Expected approved Knowledge Base context in the fixture Context Packet.');
  }
  if (!diagnostic.graphVerbs.includes('supports')) {
    throw new Error('Expected graph verb "supports" in compiler comparison output.');
  }
  if (diagnostic.coverage.covered + diagnostic.coverage.partial < 1) {
    throw new Error('Expected at least one covered or partial Steve signal.');
  }

  const logDir = path.join(repoRoot(), '.logs');
  await mkdir(logDir, { recursive: true });
  const outPath = path.join(logDir, 'steve-context-comparison-smoke.json');
  await writeFile(
    outPath,
    `${JSON.stringify({ diagnostic, report }, null, 2)}\n`,
    'utf8',
  );

  console.log('[steve-context-smoke] PASS');
  console.log(`[steve-context-smoke] artifactSource=${diagnostic.artifactSource}`);
  console.log(`[steve-context-smoke] persistenceStatus=${diagnostic.persistenceStatus}`);
  console.log(`[steve-context-smoke] approvedKnowledgeCount=${diagnostic.approvedKnowledgeCount}`);
  console.log(`[steve-context-smoke] graphVerbs=${diagnostic.graphVerbs.join(',')}`);
  console.log(`[steve-context-smoke] report=${outPath}`);
}

main().catch((err) => {
  console.error('[steve-context-smoke] FAIL', err);
  process.exit(1);
});
