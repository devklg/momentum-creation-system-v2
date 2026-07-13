import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCS_KNOWLEDGE_WORKFLOW_EDGES, MCS_KNOWLEDGE_WORKFLOW_STAGES, knowledgeWorkflowOpenGaps } from '@momentum/shared';

const repoRoot = path.resolve(process.cwd(), '..');

describe('P1 candidate-to-approved knowledge workflow map', () => {
  it('anchors every stage to an existing source symbol and proof test', () => {
    for (const stage of MCS_KNOWLEDGE_WORKFLOW_STAGES) {
      const sourcePath = path.join(repoRoot, stage.sourceFile);
      expect(existsSync(sourcePath), stage.id).toBe(true);
      expect(readFileSync(sourcePath, 'utf8'), `${stage.id}:${stage.sourceSymbol}`).toContain(stage.sourceSymbol);
      expect(stage.proofTests.length).toBeGreaterThan(0);
      for (const test of stage.proofTests) expect(existsSync(path.join(repoRoot, test)), test).toBe(true);
    }
  });

  it('labels every edge honestly and gives every gap an owner and reason', () => {
    const ids = new Set(MCS_KNOWLEDGE_WORKFLOW_STAGES.map((stage) => stage.id));
    for (const edge of MCS_KNOWLEDGE_WORKFLOW_EDGES) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
      expect(edge.reason.length).toBeGreaterThan(20);
      expect(edge.ownerTask.length).toBeGreaterThan(3);
    }
    expect(knowledgeWorkflowOpenGaps().map((edge) => `${edge.from}->${edge.to}`)).toEqual([
      'runtime_review->evolution_start',
      'context_propose->runtime_detect',
      'context_confirm->evolution_start',
      'evolution_start->evolution_execute',
      'evolution_execute->resource_gate',
      'resource_gate->context_retrieval',
    ]);
  });

  it('proves candidate creation cannot mint approval and review emits no evolution event', () => {
    const source = readFileSync(path.join(repoRoot, 'server/src/domain/learningCandidates.ts'), 'utf8');
    const appendBlock = source.slice(source.indexOf('export async function appendLearningCandidate'), source.indexOf('export async function reviewLearningCandidate'));
    const reviewBlock = source.slice(source.indexOf('export async function reviewLearningCandidate'));
    expect(appendBlock).toContain("status: 'detected'");
    expect(appendBlock).not.toContain("status: 'approved'");
    expect(reviewBlock).toContain('reviewedByTmagId');
    expect(reviewBlock).not.toContain('knowledge.candidate.approved');
  });

  it('keeps the Kevin-authored fast lane distinct from candidate promotion', () => {
    const fastLane = MCS_KNOWLEDGE_WORKFLOW_STAGES.find((stage) => stage.id === 'kevin_intake');
    expect(fastLane).toMatchObject({ lane: 'kevin_admin_intake', inputState: 'Kevin/admin-authored source', outputState: 'active source and chunks', liveMount: true });
    expect(MCS_KNOWLEDGE_WORKFLOW_EDGES).toContainEqual(expect.objectContaining({ from: 'kevin_intake', to: 'context_retrieval', status: 'implemented' }));
  });
});
