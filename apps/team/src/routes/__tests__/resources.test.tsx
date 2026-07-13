import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResourcesPage } from '../resources';

afterEach(() => vi.unstubAllGlobals());

function response(items: Array<Record<string, unknown>>) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      schemaVersion: 'resource_center.v1',
      items,
      categories: ['Product knowledge', 'Training'],
      kinds: ['content_video', 'static_resource'],
    }),
  };
}

const ITEMS = [
  {
    resourceId: 'video_1', resourceVersionId: 'video_1_v1', title: 'Product Story',
    summary: 'Learn the product story.', kind: 'content_video', categories: ['Product knowledge'],
    tags: ['product'], languageCode: 'en', version: 1, sourceSystem: 'product_gallery',
    openTarget: '/video-library', updatedAt: '2026-07-13T09:30:00.000Z',
  },
  {
    resourceId: 'guide_1', resourceVersionId: 'guide_1_v2', title: 'Sharing Guide',
    summary: 'A practical member guide.', kind: 'static_resource', categories: ['Training'],
    tags: ['sharing'], languageCode: 'en', version: 2, sourceSystem: 'training',
    openTarget: null, updatedAt: '2026-07-13T09:30:00.000Z',
  },
];

describe('Resource Center page', () => {
  it('renders the honest empty state and source-owner shortcuts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([])));
    render(<MemoryRouter><ResourcesPage /></MemoryRouter>);
    expect(await screen.findByText(/No resources have completed version verification yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Product Gallery/ })).toHaveAttribute('href', '/video-library');
    expect(screen.getByRole('link', { name: /Fast Start/ })).toHaveAttribute('href', '/training/fast-start');
  });

  it('searches verified title, summary, categories, and tags', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(ITEMS)));
    render(<MemoryRouter><ResourcesPage /></MemoryRouter>);
    expect(await screen.findByText('Product Story')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search resources'), { target: { value: 'sharing' } });
    await waitFor(() => expect(screen.queryByText('Product Story')).not.toBeInTheDocument());
    expect(screen.getByText('Sharing Guide')).toBeInTheDocument();
  });

  it('filters by category and resource type', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(ITEMS)));
    render(<MemoryRouter><ResourcesPage /></MemoryRouter>);
    await screen.findByText('Product Story');
    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'Training' } });
    expect(screen.queryByText('Product Story')).not.toBeInTheDocument();
    expect(screen.getByText('Sharing Guide')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter by resource type'), { target: { value: 'content_video' } });
    expect(await screen.findByText('No approved resources match those filters.')).toBeInTheDocument();
  });

  it('shows a recoverable catalog-unavailable state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    render(<MemoryRouter><ResourcesPage /></MemoryRouter>);
    expect(await screen.findByText(/verified catalog is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /10-Step Orientation/ })).toBeInTheDocument();
  });
});
