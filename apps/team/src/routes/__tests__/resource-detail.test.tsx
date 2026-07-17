import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResourceDetailPage } from '../resource-detail';

afterEach(() => vi.unstubAllGlobals());

describe('Resource Center document detail', () => {
  it('offers the governed original PDF for opening and printing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => ({ ok: true }) };
      return {
        ok: true,
        json: async () => ({
          ok: true,
          schemaVersion: 'resource_center.v1',
          item: {
            resourceVersionId: 'knowledge:source_1:v2',
            title: 'The PDR Position',
            summary: 'Approved product training report.',
            categories: ['training'],
            tags: ['pdr'],
            version: 2,
            updatedAt: '2026-07-17T20:23:29.508Z',
          },
          content: 'Structured Docling text.',
          document: {
            filename: 'The-PDR-Position.pdf',
            mimeType: 'application/pdf',
            originalBytes: 62288,
            sha256: 'a'.repeat(64),
            openTarget: '/api/resources/knowledge%3Asource_1%3Av2/document',
          },
        }),
      };
    }));

    render(
      <MemoryRouter initialEntries={['/resources/knowledge%3Asource_1%3Av2']}>
        <Routes>
          <Route path="/resources/:resourceVersionId" element={<ResourceDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /Open \/ Print PDF/i })).toHaveAttribute(
      'href',
      '/api/resources/knowledge%3Asource_1%3Av2/document',
    );
  });
});
