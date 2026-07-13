import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContextResources } from '../ContextResources';

afterEach(() => vi.unstubAllGlobals());

describe('P2-101 contextual resources', () => {
  it('shows only verified catalog items with the exact explicit context tag', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        items: [
          {
            resourceVersionId: 'resource_1_v1',
            title: 'Product reference',
            summary: 'Approved product support.',
            tags: ['context:training:fast-start:1'],
            openTarget: '/resources/resource_1_v1',
            version: 1,
          },
          {
            resourceVersionId: 'resource_2_v1',
            title: 'Generic training reference',
            summary: 'Not explicitly connected.',
            tags: ['training', 'product-education'],
            openTarget: '/resources/resource_2_v1',
            version: 1,
          },
        ],
      }),
    })));

    render(
      <MemoryRouter>
        <ContextResources contextTag="context:training:fast-start:1" />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Product reference')).toBeInTheDocument();
    expect(screen.queryByText('Generic training reference')).not.toBeInTheDocument();
  });
});
