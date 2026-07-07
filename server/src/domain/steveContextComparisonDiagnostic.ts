import type { McsMemoryContextComparisonReport } from '@momentum/shared/runtime';

export type SteveContextComparisonArtifactSource =
  | 'saved_steve_discovery'
  | 'controlled_fixture';

export interface SteveContextComparisonDiagnostic {
  ok: true;
  generatedAt: string;
  artifactSource: SteveContextComparisonArtifactSource;
  tmagId: string | null;
  discoveryId: string | null;
  shapeStatus: McsMemoryContextComparisonReport['compiledShape']['status'];
  persistenceStatus: McsMemoryContextComparisonReport['compiledShape']['persistenceStatus'];
  approvedKnowledgeCount: number;
  includedKnowledgeIds: string[];
  coverage: {
    covered: number;
    partial: number;
    missing: number;
    notEvaluated: number;
  };
  missingSignals: string[];
  graphQuestionKeys: string[];
  graphVerbs: string[];
  warnings: string[];
  recommendedContextQueryPreview: string;
}

export function buildSteveContextComparisonDiagnostic(input: {
  report: McsMemoryContextComparisonReport;
  artifactSource: SteveContextComparisonArtifactSource;
  generatedAt?: string;
}): SteveContextComparisonDiagnostic {
  const { report } = input;

  return {
    ok: true,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    artifactSource: input.artifactSource,
    tmagId: report.compiledShape.subject.tmagId ?? null,
    discoveryId: report.compiledShape.subject.discoveryId ?? null,
    shapeStatus: report.compiledShape.status,
    persistenceStatus: report.compiledShape.persistenceStatus,
    approvedKnowledgeCount: report.summary.approvedKnowledgeCount,
    includedKnowledgeIds: uniqueStrings(
      report.signals.flatMap((signal) => signal.matches.map((match) => String(match.knowledgeId))),
    ),
    coverage: {
      covered: report.summary.coveredSignalCount,
      partial: report.summary.partialSignalCount,
      missing: report.summary.missingSignalCount,
      notEvaluated: report.summary.notEvaluatedSignalCount,
    },
    missingSignals: report.missingSignals.map(String),
    graphQuestionKeys: report.compiledShape.graphQuestions.map((question) => question.key),
    graphVerbs: uniqueStrings(report.compiledShape.graphEdges.map((edge) => edge.verb)),
    warnings: [...report.warnings],
    recommendedContextQueryPreview: report.recommendedContextQuery.slice(0, 500),
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}
