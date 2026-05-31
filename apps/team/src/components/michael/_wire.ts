/**
 * Local wire shapes for the .team Michael interview surface.
 *
 * Mirrors the #134 block at the bottom of packages/shared/src/types.ts.
 * Declared locally because @momentum/shared's `src` alias is outside this
 * app's rootDir and importing it trips TS6059 (see _wire.ts in fast-start,
 * and cockpit.tsx / invitations.tsx / video-library.tsx for the same
 * pattern). Keep this file in sync when the shared #134 block changes.
 */

export type MichaelInterviewPhase =
  | 'awaiting_call'
  | 'call_in_progress'
  | 'complete'
  | 'no_answer'
  | 'invalid_number'
  | 'stt_failed';

export interface MichaelTranscriptChunk {
  sequence: number;
  speaker: 'michael' | 'ba';
  text: string;
  occurredAt: string;
}

export interface MichaelInterviewAnswer {
  questionId: string;
  prompt: string;
  answerText: string;
  scoringTags: string[];
}

export interface MichaelScoringSummary {
  overallTone: 'positive' | 'neutral' | 'guarded' | null;
  highlightTags: string[];
  signedBy: string;
}

export interface MichaelInterviewArtifact {
  baId: string;
  sponsorBaId: string | null;
  callSid: string | null;
  startedAt: string | null;
  completedAt: string | null;
  transcript: MichaelTranscriptChunk[];
  answers: MichaelInterviewAnswer[];
  scoring: MichaelScoringSummary;
  audioUrl: string | null;
}

export interface MichaelInterviewView {
  baId: string;
  phase: MichaelInterviewPhase;
  scheduledFor: string | null;
  timezone: string | null;
  call: { startedAt: string | null; sid: string | null };
  transcript: MichaelTranscriptChunk[];
  artifact: MichaelInterviewArtifact | null;
  wrongNumberFlaggedAt: string | null;
}

export type MichaelInterviewSseEvent =
  | { type: 'snapshot'; chunks: MichaelTranscriptChunk[]; phase: MichaelInterviewPhase }
  | { type: 'chunk'; chunk: MichaelTranscriptChunk }
  | { type: 'phase'; phase: MichaelInterviewPhase }
  | { type: 'heartbeat' };

export interface MichaelCockpitCardData {
  downlineBaId: string;
  downlineFirstName: string;
  completedAt: string;
  answers: MichaelInterviewAnswer[];
  scoring: MichaelScoringSummary;
  audioUrl: string | null;
  signedBy: string;
  // #147 — classification + success profile (intel tags only). Optional so the
  // mirror tolerates a pre-#147 artifact ingested without rubric scoring.
  classification?: MichaelClassification | null;
  successProfile?: MichaelSuccessProfile | null;
}

/* ─── #147 Michael classification + success profile (mirror of shared) ─── */

export type MichaelClassificationTier =
  | 'builder'
  | 'emerging_leader'
  | 'part_time_producer'
  | 'casual_participant';

export interface MichaelCategoryScores {
  vision: number;
  commitment: number;
  coachability: number;
  availableTime: number;
  network: number;
  experience: number;
}

export interface MichaelClassification {
  categoryScores: MichaelCategoryScores;
  weightedTotal: number;
  tier: MichaelClassificationTier;
  tierLabel: string;
  band: string;
  signedBy: string;
}

export interface MichaelSuccessProfile {
  baId: string;
  classification: MichaelClassification;
  headline: string;
  strengths: string[];
  sponsorFocus: string[];
  generatedAt: string;
  signedBy: string;
}
