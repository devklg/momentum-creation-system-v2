import type { McsSteveDiscoveryArtifact } from '@momentum/shared';
import type {
  McsApprovedKnowledgeContextItem,
  McsContextPacketV1,
  McsMemoryContextComparisonReport,
  McsMemoryContextCoverageStatus,
  McsMemoryContextGraphEdge,
  McsMemoryContextGraphQuestion,
  McsMemoryContextSignalCoverage,
  McsMemoryContextSignalKey,
} from '@momentum/shared/runtime';
import { MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION } from '@momentum/shared/runtime';

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'because',
  'but',
  'can',
  'for',
  'from',
  'have',
  'how',
  'into',
  'just',
  'like',
  'not',
  'now',
  'our',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'this',
  'through',
  'what',
  'when',
  'where',
  'with',
  'you',
  'your',
]);

export function compareSteveInterviewToContext(input: {
  artifact: McsSteveDiscoveryArtifact;
  packet: McsContextPacketV1;
  comparedAt?: string;
}): McsMemoryContextComparisonReport {
  const signals = buildSteveContextSignals(input.artifact);
  const knowledge = input.packet.approvedKnowledge;
  const compared = signals.map((signal) => compareSignal(signal, knowledge));
  const retrievalAudit = input.packet.retrievalAudit;
  const graphQuestions = buildGraphQuestions();
  const graphEdges = buildGraphEdges(input.artifact, compared);
  const missingSignals = compared
    .filter((signal) => signal.status === 'missing')
    .map((signal) => signal.key);
  const warnings: string[] = [];

  if (input.packet.packetStatus !== 'complete') {
    warnings.push(`Context Packet is ${input.packet.packetStatus}; approved knowledge coverage may be incomplete.`);
  }
  if (knowledge.length === 0) {
    warnings.push('No approved knowledge was present in the Context Packet.');
  }

  return {
    schemaVersion: MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION,
    compiledShape: {
      schemaVersion: MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION,
      compiler: {
        compilerName: 'memory_context_compiler',
        schemaVersion: MCS_MEMORY_CONTEXT_COMPILER_SCHEMA_VERSION,
        compiledAt: input.comparedAt ?? new Date().toISOString(),
        purpose: 'context_comparison',
        agentKeys: ['steve_success'],
      },
      subject: {
        tmagId: input.artifact.tmagId as McsMemoryContextComparisonReport['compiledShape']['subject']['tmagId'],
        discoveryId: `SD-${input.artifact.tmagId}`,
        contextPacketId: input.packet.packetId,
        sourceTitle: 'Steve Success discovery artifact',
      },
      status: resolveShapeStatus(input.packet, compared),
      persistenceStatus: 'not_persisted',
      storeContributions: [
        {
          store: 'mongo',
          function: 'canonical_memory',
          present: true,
          sourceIds: [`SD-${input.artifact.tmagId}`],
          note: 'Steve discovery artifact supplies canonical profile and transcript memory.',
        },
        {
          store: 'neo4j',
          function: 'relationship_graph',
          present: (retrievalAudit?.retrievalMethods ?? []).includes('graph_expansion'),
          sourceIds: (retrievalAudit?.includedItems ?? [])
            .filter((item) => item.method === 'graph_expansion')
            .map((item) => String(item.sourceId)),
          note: 'Graph contribution is present when Context Packet retrieval includes graph expansion.',
        },
        {
          store: 'chroma',
          function: 'semantic_meaning',
          present: input.packet.approvedKnowledge.length > 0,
          sourceIds: input.packet.approvedKnowledge.map((item) => String(item.knowledgeId)),
          note: 'Approved knowledge in the Context Packet represents semantic retrieval usable by Steve.',
        },
      ],
      ingredients: [
        {
          ingredientId: `steve_discovery_${input.artifact.tmagId}`,
          kind: 'canonical_record',
          sourceStore: 'mongo',
          sourceId: `SD-${input.artifact.tmagId}`,
          title: 'Steve Success discovery artifact',
          summary: 'Canonical saved Steve discovery artifact and Success Profile.',
          weight: 1,
        },
        ...compared.map((signal) => ({
          ingredientId: `steve_signal_${signal.key}`,
          kind: 'profile_signal' as const,
          sourceStore: 'mongo' as const,
          sourceId: `SD-${input.artifact.tmagId}`,
          title: signal.label,
          summary: signal.summary,
          weight: signal.status === 'covered' ? 1 : signal.status === 'partial' ? 0.5 : 0,
        })),
        ...input.packet.approvedKnowledge.map((item) => ({
          ingredientId: `approved_knowledge_${String(item.knowledgeId)}`,
          kind: 'approved_knowledge' as const,
          sourceStore: 'chroma' as const,
          sourceId: String(item.sourceTraceability?.sourceId ?? item.knowledgeId),
          knowledgeId: item.knowledgeId,
          title: item.title,
          summary: item.summary,
          weight: 1,
        })),
      ],
      graphQuestions,
      graphEdges,
      warnings,
    },
    comparisonMethods: ['lexical_overlap'],
    summary: {
      approvedKnowledgeCount: knowledge.length,
      coveredSignalCount: compared.filter((signal) => signal.status === 'covered').length,
      partialSignalCount: compared.filter((signal) => signal.status === 'partial').length,
      missingSignalCount: missingSignals.length,
      notEvaluatedSignalCount: compared.filter((signal) => signal.status === 'not_evaluated').length,
    },
    signals: compared,
    missingSignals,
    recommendedContextQuery: buildRecommendedContextQuery(input.artifact),
    warnings,
  };
}

export function buildRecommendedContextQuery(artifact: McsSteveDiscoveryArtifact): string {
  return buildSteveContextSignals(artifact)
    .map((signal) => signal.text)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2500);
}

function buildGraphQuestions(): McsMemoryContextGraphQuestion[] {
  return [
    {
      key: 'what_created_this_memory',
      question: 'What canonical event or record created this memory?',
      expectedVerbs: ['captures'],
    },
    {
      key: 'what_does_this_memory_mean',
      question: 'What meaning does this memory express?',
      expectedVerbs: ['expresses', 'relates_to'],
    },
    {
      key: 'what_does_this_memory_support',
      question: 'What approved knowledge or context supports this memory?',
      expectedVerbs: ['supports', 'grounds'],
    },
    {
      key: 'what_context_does_this_memory_require',
      question: 'What context does the agent need before acting from this memory?',
      expectedVerbs: ['requires_context', 'retrieves'],
    },
    {
      key: 'what_agent_action_does_this_memory_guide',
      question: 'What agent action should this memory guide?',
      expectedVerbs: ['guides'],
    },
    {
      key: 'what_should_this_memory_retrieve',
      question: 'What should this memory retrieve by meaning or relationship?',
      expectedVerbs: ['retrieves', 'relates_to'],
    },
    {
      key: 'what_does_this_memory_protect_or_exclude',
      question: 'What boundaries does this memory protect or exclude?',
      expectedVerbs: ['protects', 'excludes'],
    },
    {
      key: 'what_does_this_memory_handoff_to',
      question: 'What other agent or workflow should this memory hand off to?',
      expectedVerbs: ['hands_off_to'],
    },
  ];
}

function buildGraphEdges(
  artifact: McsSteveDiscoveryArtifact,
  signals: McsMemoryContextSignalCoverage[],
): McsMemoryContextGraphEdge[] {
  const discoveryIngredientId = `steve_discovery_${artifact.tmagId}`;
  const edges: McsMemoryContextGraphEdge[] = signals.map((signal) => ({
    edgeId: `edge_${discoveryIngredientId}_captures_${signal.key}`,
    questionKey: 'what_created_this_memory',
    fromIngredientId: discoveryIngredientId,
    verb: 'captures',
    toIngredientId: `steve_signal_${signal.key}`,
    summary: `Steve discovery captures ${signal.label}.`,
    confidence: signal.tokenCount > 0 ? 1 : 0.4,
    evidence: signal.summary ? [signal.summary] : [],
  }));

  for (const signal of signals) {
    if (signal.summary) {
      edges.push({
        edgeId: `edge_steve_signal_${signal.key}_expresses_meaning`,
        questionKey: 'what_does_this_memory_mean',
        fromIngredientId: `steve_signal_${signal.key}`,
        verb: 'expresses',
        summary: `${signal.label} expresses part of the BA memory context.`,
        confidence: signal.status === 'covered' ? 0.9 : signal.status === 'partial' ? 0.6 : 0.3,
        evidence: [signal.summary],
      });
    }

    for (const match of signal.matches) {
      edges.push({
        edgeId: `edge_steve_signal_${signal.key}_supports_${String(match.knowledgeId)}`,
        questionKey: 'what_does_this_memory_support',
        fromIngredientId: `steve_signal_${signal.key}`,
        verb: 'supports',
        toIngredientId: `approved_knowledge_${String(match.knowledgeId)}`,
        toKnowledgeId: match.knowledgeId,
        summary: `${signal.label} is supported by approved knowledge: ${match.title}.`,
        confidence: Math.min(1, match.score / 5),
        evidence: match.sharedTerms ?? [],
      });
    }
  }

  const michaelHandoff = signals.find((signal) => signal.key === 'michael_handoff');
  if (michaelHandoff?.summary) {
    edges.push({
      edgeId: 'edge_steve_signal_michael_handoff_hands_off_to_michael',
      questionKey: 'what_does_this_memory_handoff_to',
      fromIngredientId: 'steve_signal_michael_handoff',
      verb: 'hands_off_to',
      summary: 'Steve handoff memory should guide Michael training/support context.',
      confidence: 0.9,
      evidence: [michaelHandoff.summary],
    });
  }

  return edges;
}

function buildSteveContextSignals(
  artifact: McsSteveDiscoveryArtifact,
): Array<{ key: McsMemoryContextSignalKey; label: string; text: string }> {
  const p = artifact.successProfile;
  return [
    {
      key: 'primary_why',
      label: 'Primary why',
      text: joinText(p.primaryWhy.statement, p.primaryWhy.who, p.primaryWhy.whyNow),
    },
    {
      key: 'success_vision',
      label: 'Success vision',
      text: joinText(p.successVision.statement, p.successVision.oneBigChange),
    },
    {
      key: 'learning_style',
      label: 'Learning style',
      text: joinText(p.learningStyle.modalities.join(' '), p.learningStyle.feedbackPreference, p.learningStyle.notes),
    },
    {
      key: 'communication_preferences',
      label: 'Communication preferences',
      text: joinText(
        p.communicationPreferences.preferredChannels.join(' '),
        p.communicationPreferences.cadence ?? '',
        p.communicationPreferences.bestTimes,
        p.communicationPreferences.notes,
      ),
    },
    {
      key: 'support_needs',
      label: 'Support needs',
      text: joinText(
        p.supportNeeds.areas.join(' '),
        p.supportNeeds.potentialObstacles.join(' '),
        p.supportNeeds.helpStyle,
        p.supportNeeds.notes,
      ),
    },
    {
      key: 'launch_recommendations',
      label: 'Launch recommendations',
      text: joinText(...p.launchRecommendations.map((item) => item.text)),
    },
    {
      key: 'training_recommendations',
      label: 'Training recommendations',
      text: joinText(...p.trainingRecommendations.map((item) => item.text)),
    },
    {
      key: 'michael_handoff',
      label: 'Michael handoff',
      text: p.michaelHandoffSummary,
    },
    {
      key: 'discovery_answers',
      label: 'Discovery answers',
      text: joinText(...artifact.answers.map((answer) => answer.answerText)),
    },
  ];
}

function compareSignal(
  signal: { key: McsMemoryContextSignalKey; label: string; text: string },
  knowledge: McsApprovedKnowledgeContextItem[],
): McsMemoryContextSignalCoverage {
  const signalTerms = tokenize(signal.text);
  const matches = knowledge
    .map((item) => {
      const knowledgeTerms = tokenize(`${item.title} ${item.summary}`);
      const sharedTerms = [...signalTerms].filter((term) => knowledgeTerms.has(term)).sort();
      const match = {
        knowledgeId: item.knowledgeId,
        title: item.title,
        method: 'lexical_overlap' as const,
        score: sharedTerms.length,
        sharedTerms: sharedTerms.slice(0, 12),
        reason: sharedTerms.length > 0
          ? `Shared terms: ${sharedTerms.slice(0, 6).join(', ')}`
          : 'No shared terms.',
      };
      return match;
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const status = resolveSignalStatus(signalTerms.size, knowledge.length, matches[0]?.score ?? 0);

  return {
    key: signal.key,
    label: signal.label,
    summary: cleanSummary(signal.text),
    tokenCount: signalTerms.size,
    status,
    matches,
    ...(status === 'missing'
      ? {
          gapReason:
            signalTerms.size === 0
              ? 'no_signal_text'
              : knowledge.length === 0
                ? 'no_approved_knowledge'
                : 'below_threshold',
        }
      : {}),
  };
}

function resolveSignalStatus(
  tokenCount: number,
  knowledgeCount: number,
  bestScore: number,
): McsMemoryContextCoverageStatus {
  if (tokenCount === 0) return 'not_evaluated';
  if (knowledgeCount === 0) return 'missing';
  if (bestScore >= 3) return 'covered';
  if (bestScore >= 1) return 'partial';
  return 'missing';
}

function tokenize(text: string): Set<string> {
  const terms = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.trim().replace(/_/g, ''))
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
  return new Set(terms);
}

function joinText(...values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join(' ');
}

function cleanSummary(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function resolveShapeStatus(
  packet: McsContextPacketV1,
  signals: McsMemoryContextSignalCoverage[],
): McsMemoryContextComparisonReport['compiledShape']['status'] {
  if (packet.packetStatus === 'failed') return 'failed';
  if (packet.packetStatus === 'degraded') return 'degraded';
  if (signals.some((signal) => signal.status === 'missing')) return 'partial';
  return 'complete';
}
