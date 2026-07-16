import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeApprovalReference } from '@momentum/shared/runtime';
import { createEvolutionApprovalService } from '../services/EvolutionApproval.service.js';

const reference: KnowledgeApprovalReference = {
  approvalId: 'dec_correction_1',
  approvedBy: 'kevin_gardner',
  approvalType: 'admin_decision',
  approvedAt: new Date('2026-07-14T00:00:00.000Z'),
};

describe('Knowledge Evolution canonical approval authority', () => {
  it('rejects a well-shaped reference when canonical readback fails', async () => {
    const authority = { verify: vi.fn(async () => false) };
    const service = createEvolutionApprovalService(authority);

    const result = await service.verifyCanonical({
      approvalReference: reference,
      inputType: 'approved_supersession',
      sourceCandidateIds: [],
    });

    expect(result).toMatchObject({ ok: false, errorType: 'approval_missing' });
    expect(authority.verify).toHaveBeenCalledWith(reference);
  });

  it('accepts only after the configured authority confirms readback', async () => {
    const authority = { verify: vi.fn(async () => true) };
    const service = createEvolutionApprovalService(authority);
    await expect(service.verifyCanonical({
      approvalReference: reference,
      inputType: 'approved_supersession',
      sourceCandidateIds: [],
    })).resolves.toEqual({ ok: true });
  });
});
