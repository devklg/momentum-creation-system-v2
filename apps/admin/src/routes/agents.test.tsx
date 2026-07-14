import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/admin/MichaelRuntimeObservabilityPanel', () => ({
  MichaelRuntimeObservabilityPanel: () => (
    <section aria-label="Michael runtime health and debugger">Michael debugger mounted</section>
  ),
}));

import { AgentsPage } from './agents';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({ ok: false, error: 'Expected test response.' }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AgentsPage — Michael runtime debugger integration', () => {
  it('mounts the debugger independently of the agent overview response', () => {
    render(<AgentsPage />);

    expect(
      screen.getByRole('region', { name: /michael runtime health and debugger/i }),
    ).toHaveTextContent('Michael debugger mounted');
  });
});
