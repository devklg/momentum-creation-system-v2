import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndexAwarenessPanel } from './IndexAwarenessPanel';

afterEach(() => vi.unstubAllGlobals());

describe('IndexAwarenessPanel', () => {
  it('labels the observation as verify-only and exposes honest states', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        mutationAuthorized: false,
        observedAt: '2026-07-14T00:00:00.000Z',
        summary: { required: 2, observed: 1, missing: 0, definitionMismatch: 0, notChecked: 1 },
        indexes: [
          { collection: 'members', name: 'admin_createdAt_tmagId', surface: 'ba_directory', state: 'observed' },
          { collection: 'audit', name: 'admin_timestamp_entryId', surface: 'audit_log', state: 'not_checked' },
        ],
      }),
    })));

    render(<IndexAwarenessPanel />);

    expect(screen.getByText('Verify only')).toBeInTheDocument();
    expect(await screen.findByText('admin_timestamp_entryId')).toBeInTheDocument();
    expect(screen.getByText('not checked')).toBeInTheDocument();
    expect(screen.getByText(/cannot create, apply, or change/i)).toBeInTheDocument();
  });
});
