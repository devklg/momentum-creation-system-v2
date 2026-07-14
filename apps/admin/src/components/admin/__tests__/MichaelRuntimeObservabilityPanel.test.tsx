/**
 * Behavioral tests for the Michael Runtime Health & Debugger panel.
 *
 * First apps/admin behavioral test. Exercises both surfaces:
 *   1. fetchMichaelRuntimeObservability() — the read-only client helper that
 *      GETs /api/admin/michael-runtime/observability and maps every status /
 *      malformed shape to a typed, leak-free result.
 *   2. MichaelRuntimeObservabilityPanel — the read-only render of flags +
 *      counters, with a manual Refresh, asserting governance at the UI edge
 *      (GET only, no body, no storage writes, no leaked internals).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  fetchMichaelRuntimeObservability,
  deriveMichaelRuntimeHealth,
  MichaelRuntimeObservabilityPanel,
} from '../MichaelRuntimeObservabilityPanel';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

describe('deriveMichaelRuntimeHealth — kill-switch interpretation', () => {
  it.each([
    [true, true, 'available', 'Available'],
    [false, false, 'dormant', 'Dormant by configuration'],
    [true, false, 'attention', 'Configuration mismatch'],
    [false, true, 'attention', 'Configuration mismatch'],
  ] as const)(
    'maps route=%s response=%s to %s',
    (routeEnabled, responseEnabled, state, label) => {
      expect(deriveMichaelRuntimeHealth({ routeEnabled, responseEnabled })).toMatchObject({
        state,
        label,
      });
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return { status, json: async () => body } as unknown as Response;
}

function unparseableResponse(status: number): Response {
  return {
    status,
    json: async () => {
      throw new SyntaxError('bad json');
    },
  } as unknown as Response;
}

function snapshotBody(overrides?: {
  routeEnabled?: boolean;
  responseEnabled?: boolean;
  traceEnabled?: boolean;
  counters?: Partial<Record<string, unknown>>;
}) {
  return {
    ok: true,
    michaelRuntime: {
      routeEnabled: overrides?.routeEnabled ?? false,
      responseEnabled: overrides?.responseEnabled ?? false,
      traceEnabled: overrides?.traceEnabled ?? false,
      counters: {
        routeDisabledSkips: 0,
        responseDisabledSkips: 0,
        successfulFacadeResolutions: 0,
        facadeFailures: 0,
        bodyBaOverrideRejections: 0,
        missingTurnRejections: 0,
        ...(overrides?.counters ?? {}),
      },
    },
  };
}

// ── helper: request contract + status mapping ────────────────────────────────

describe('fetchMichaelRuntimeObservability — request contract', () => {
  it('issues a credentialed GET (no body) to the admin observability route', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, snapshotBody()));

    await fetchMichaelRuntimeObservability();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe('/api/admin/michael-runtime/observability');
    expect(init?.credentials).toBe('include');
    // Read-only: never a write verb, never a body.
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body).toBeUndefined();
  });
});

describe('fetchMichaelRuntimeObservability — status mapping', () => {
  it('maps a valid 200 snapshot → ok with parsed flags + counters', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        200,
        snapshotBody({
          routeEnabled: true,
          responseEnabled: true,
          traceEnabled: false,
          counters: { successfulFacadeResolutions: 7, facadeFailures: 2 },
        }),
      ),
    );

    const result = await fetchMichaelRuntimeObservability();

    expect(result).toEqual({
      kind: 'ok',
      snapshot: {
        routeEnabled: true,
        responseEnabled: true,
        traceEnabled: false,
        counters: {
          routeDisabledSkips: 0,
          responseDisabledSkips: 0,
          successfulFacadeResolutions: 7,
          facadeFailures: 2,
          bodyBaOverrideRejections: 0,
          missingTurnRejections: 0,
        },
      },
    });
  });

  it.each([401, 403])('maps %i → unauthorized', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { ok: false }));
    await expect(fetchMichaelRuntimeObservability()).resolves.toEqual({ kind: 'unauthorized' });
  });

  it.each([400, 404, 500, 503])('maps other non-200 status %i → error', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { ok: false }));
    await expect(fetchMichaelRuntimeObservability()).resolves.toEqual({ kind: 'error' });
  });

  it('maps a thrown fetch → error', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await expect(fetchMichaelRuntimeObservability()).resolves.toEqual({ kind: 'error' });
  });

  it('maps an unparseable 200 body → error', async () => {
    fetchMock.mockResolvedValue(unparseableResponse(200));
    await expect(fetchMichaelRuntimeObservability()).resolves.toEqual({ kind: 'error' });
  });

  it('fails closed when ok is not true', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: false, michaelRuntime: {} }));
    await expect(fetchMichaelRuntimeObservability()).resolves.toEqual({ kind: 'error' });
  });

  it('fails closed when flags are missing or non-boolean', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ok: true, michaelRuntime: { routeEnabled: 'yes', counters: {} } }),
    );
    await expect(fetchMichaelRuntimeObservability()).resolves.toEqual({ kind: 'error' });
  });

  it('coerces missing/garbage counter fields to 0 rather than crashing', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        michaelRuntime: {
          routeEnabled: false,
          responseEnabled: false,
          traceEnabled: false,
          counters: { successfulFacadeResolutions: 'NaN', facadeFailures: 3 },
        },
      }),
    );

    const result = await fetchMichaelRuntimeObservability();
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.snapshot.counters.successfulFacadeResolutions).toBe(0);
      expect(result.snapshot.counters.facadeFailures).toBe(3);
      expect(result.snapshot.counters.routeDisabledSkips).toBe(0);
    }
  });
});

// ── component: render behavior ───────────────────────────────────────────────

describe('MichaelRuntimeObservabilityPanel — render behavior', () => {
  it('paints loading then the labelled region + heading', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, snapshotBody()));

    render(<MichaelRuntimeObservabilityPanel />);

    expect(screen.getByText(/loading runtime observability/i)).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /michael runtime health and debugger/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /michael · runtime health & debugger/i }),
    ).toBeInTheDocument();
  });

  it('renders the interpreted runtime health and trace diagnostic state', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        200,
        snapshotBody({ routeEnabled: true, responseEnabled: false, traceEnabled: true }),
      ),
    );

    render(<MichaelRuntimeObservabilityPanel />);

    expect(
      await screen.findByRole('status', { name: /michael runtime health: configuration mismatch/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/route is enabled while generated responses are disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/trace diagnostics enabled/i)).toBeInTheDocument();
  });

  it('renders flag states and counter values from the snapshot', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        200,
        snapshotBody({
          routeEnabled: true,
          responseEnabled: false,
          traceEnabled: false,
          counters: { successfulFacadeResolutions: 12, bodyBaOverrideRejections: 5 },
        }),
      ),
    );

    render(<MichaelRuntimeObservabilityPanel />);

    expect(await screen.findByText('Successful resolutions')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Body BA-override rejections')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    // Route enabled, Response disabled → both labels present with distinct states.
    expect(screen.getByText('Route')).toBeInTheDocument();
    expect(screen.getByText('Response')).toBeInTheDocument();
    expect(screen.getAllByText(/^Enabled$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^Disabled$/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows an admin-access message on unauthorized', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { ok: false }));

    render(<MichaelRuntimeObservabilityPanel />);

    expect(await screen.findByText(/admin access is required/i)).toBeInTheDocument();
  });

  it('shows an error message when the snapshot cannot be loaded', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { ok: false }));

    render(<MichaelRuntimeObservabilityPanel />);

    expect(await screen.findByText(/couldn.t load runtime observability/i)).toBeInTheDocument();
  });

  it('re-fetches when Refresh is clicked', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, snapshotBody({ counters: { facadeFailures: 1 } })),
    );

    render(<MichaelRuntimeObservabilityPanel />);

    await screen.findByText('Facade failures');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, snapshotBody({ counters: { facadeFailures: 9 } })),
    );
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ── component: governance ────────────────────────────────────────────────────

describe('MichaelRuntimeObservabilityPanel — governance', () => {
  it('only ever issues read (GET) requests — never a write verb', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, snapshotBody()));

    render(<MichaelRuntimeObservabilityPanel />);
    await screen.findByRole('heading', { name: /runtime health & debugger/i });

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.method ?? 'GET').toBe('GET');
      expect(init?.body).toBeUndefined();
    }
  });

  it('writes nothing to localStorage / sessionStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    fetchMock.mockResolvedValue(jsonResponse(200, snapshotBody()));

    render(<MichaelRuntimeObservabilityPanel />);
    await screen.findByText('Successful resolutions');

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('does not render any income / compensation / placement copy', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, snapshotBody({ routeEnabled: true })));

    render(<MichaelRuntimeObservabilityPanel />);
    await screen.findByText('Successful resolutions');

    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/income|commission|cycle|payout|earnings|placement|guarantee/i);
  });
});
