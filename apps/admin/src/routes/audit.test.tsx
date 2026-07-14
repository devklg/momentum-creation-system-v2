import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuditPage } from './audit';
import type { McsAuditLogEntry } from '@momentum/shared';

afterEach(() => vi.unstubAllGlobals());

function entry(entryId: string): McsAuditLogEntry {
  return {
    entryId,
    timestamp: '2026-07-13T00:00:00.000Z',
    createdAt: '2026-07-13T00:00:00.000Z',
    role: 'admin',
    actor: { kind: 'admin', tmagId: 'TMBA-ADMIN', displayName: 'Kevin' },
    action: `admin.test.${entryId}`,
    entity: { kind: 'admin_session', id: 'TMBA-ADMIN', displayLabel: null },
    severity: 'info',
    before: null,
    after: null,
    reason: null,
    context: null,
  };
}

describe('Audit admin bounded list', () => {
  it('deduplicates appended pages and states bounded-result truth', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const second = String(input).includes('before=cursor-2');
      return {
        json: async () => second
          ? { ok: true, entries: [entry('audit-1'), entry('audit-2')], nextCursor: null }
          : { ok: true, entries: [entry('audit-1')], nextCursor: 'cursor-2' },
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<AuditPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await screen.findByText('admin.test.audit-2');
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(2);
    expect(screen.getByText(/matched total omitted/i)).toHaveTextContent('2 loaded');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
