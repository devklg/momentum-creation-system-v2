import { describe, expect, it, vi } from 'vitest';
vi.mock('../adminAgentMemory.js', () => ({
  buildAdminAgentOversight: vi.fn(async () => ({
    interactionSummary: [
      { agentId: 'steve', events7d: 2, lastEventAt: '2026-07-12T00:00:00.000Z' },
      { agentId: 'michael', events7d: 3, lastEventAt: null },
      { agentId: 'ivory', events7d: 4, lastEventAt: null },
    ], warnings: [],
  })),
}));
import { buildAdminAgentHealth } from '../adminAgentHealth.js';

describe('P1-64 admin agent health cards', () => {
  it('returns one explainable card for every platform agent', async () => {
    const result = await buildAdminAgentHealth();
    expect(result.cards.map((card) => card.agentKey)).toEqual([
      'steve_success', 'michael_magnificent', 'ivory', 'scriptmaker', 'admin_recommendations',
    ]);
    expect(result.cards.find((card) => card.agentKey === 'steve_success')).toMatchObject({ events7d: 2, status: 'healthy' });
    expect(result.cards.find((card) => card.agentKey === 'scriptmaker')).toMatchObject({ activeSkills: 1, plannedSkills: 1 });
    expect(result.summary.error).toBe(0);
  });
});
