/**
 * P3.15 — broader Michael runtime UI behavioral coverage.
 *
 * The P3.14 suite (MichaelRuntimeSupportCard.test.tsx) pinned the helper's
 * status mapping and the headline render states. This file deepens coverage of
 * the card's *render-state branches* and *side-effect governance* that the first
 * suite did not reach:
 *
 *   - the transient loading state on first paint,
 *   - the empty-text default copy for safe_fallback / safe_close,
 *   - success variants (text-only, nextStep title-only, nextStep label, no
 *     nextStep, non-English language read-back),
 *   - accessibility landmarks (section label + heading),
 *   - the "Try again" affordance being gated to the error state only,
 *   - and the standing-prohibition guarantee that the card performs NO client
 *     persistence (localStorage / sessionStorage) and emits no analytics beacon.
 *
 * As in P3.14, the card is driven end-to-end through a stubbed `fetch`, so these
 * are true behavioral assertions over the helper + component together.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MichaelRuntimeSupportCard } from '../MichaelRuntimeSupportCard';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    json: async () => body,
  } as unknown as Response;
}

/** A fetch that never resolves — lets us observe the transient loading paint. */
function pendingResponse(): Promise<Response> {
  return new Promise<Response>(() => {
    /* never resolves */
  });
}

// ── Loading + accessibility ──────────────────────────────────────────────────

describe('MichaelRuntimeSupportCard — loading & landmarks', () => {
  it('paints the loading copy before the resolve settles', () => {
    fetchMock.mockReturnValue(pendingResponse());

    render(<MichaelRuntimeSupportCard />);

    expect(screen.getByText(/bringing up your next training step/i)).toBeInTheDocument();
  });

  it('exposes a labelled region and the Michael training-support heading', () => {
    fetchMock.mockReturnValue(pendingResponse());

    render(<MichaelRuntimeSupportCard />);

    expect(
      screen.getByRole('region', { name: /michael runtime training support/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /michael · training support/i }),
    ).toBeInTheDocument();
  });

  it('does not show a "Try again" affordance while loading', () => {
    fetchMock.mockReturnValue(pendingResponse());

    render(<MichaelRuntimeSupportCard />);

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

// ── safe_fallback / safe_close default copy ──────────────────────────────────

describe('MichaelRuntimeSupportCard — fallback/close defaults', () => {
  it('renders default safe_fallback copy when the server text is empty', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: { responseType: 'safe_fallback', text: '' },
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(
      await screen.findByText(/no specific step to suggest right now/i),
    ).toBeInTheDocument();
  });

  it('renders default safe_close copy when the server text is empty', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: { responseType: 'safe_close', text: '' },
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText(/nothing more to add for now/i)).toBeInTheDocument();
  });

  it('prefers the server-provided safe_close text over the default', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: { responseType: 'safe_close', text: 'All set for today.' },
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText('All set for today.')).toBeInTheDocument();
    expect(screen.queryByText(/nothing more to add for now/i)).not.toBeInTheDocument();
  });
});

// ── success render variants ──────────────────────────────────────────────────

describe('MichaelRuntimeSupportCard — success variants', () => {
  it('renders text only (no "Your next step" block) when nextStep is absent', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: {
          responseType: 'next_training_step',
          text: 'Steady progress this week.',
          language: 'en',
        },
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText('Steady progress this week.')).toBeInTheDocument();
    expect(screen.queryByText(/your next step/i)).not.toBeInTheDocument();
  });

  it('renders the "Your next step" block with a title-only nextStep', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: {
          responseType: 'next_training_step',
          text: 'Keep going.',
          language: 'en',
          nextStep: { title: 'Review your invite list' },
        },
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText(/your next step/i)).toBeInTheDocument();
    expect(screen.getByText('Review your invite list')).toBeInTheDocument();
  });

  it('renders the optional nextStep label when present', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: {
          responseType: 'next_training_step',
          text: 'Onwards.',
          language: 'en',
          nextStep: {
            title: 'Watch module 3',
            instruction: 'Then take the quiz.',
            label: 'Fast Start',
          },
        },
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText('Watch module 3')).toBeInTheDocument();
    expect(screen.getByText('Then take the quiz.')).toBeInTheDocument();
    expect(screen.getByText('Fast Start')).toBeInTheDocument();
  });

  it('reads back a non-English guidance language', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: {
          responseType: 'next_training_step',
          text: 'Buen ritmo.',
          language: 'es',
        },
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText(/guidance · es/i)).toBeInTheDocument();
  });

  it('renders a clarification_question like a success state', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: {
          responseType: 'clarification_question',
          text: 'Which area should we focus on?',
          language: 'en',
        },
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText('Which area should we focus on?')).toBeInTheDocument();
    expect(screen.getByText(/guidance · en/i)).toBeInTheDocument();
  });
});

// ── "Try again" gating ───────────────────────────────────────────────────────

describe('MichaelRuntimeSupportCard — Try again gating', () => {
  it('shows "Try again" only in the error state, and not after a successful recovery', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { ok: false }));

    render(<MichaelRuntimeSupportCard />);

    const tryAgain = await screen.findByRole('button', { name: /try again/i });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        response: { responseType: 'safe_fallback', text: 'Recovered.' },
      }),
    );
    fireEvent.click(tryAgain);

    expect(await screen.findByText('Recovered.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('does not show "Try again" in the disabled state', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));

    render(<MichaelRuntimeSupportCard />);

    await screen.findByText(/not available yet/i);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

// ── Side-effect governance ───────────────────────────────────────────────────

describe('MichaelRuntimeSupportCard — no client persistence / analytics', () => {
  it('writes nothing to localStorage or sessionStorage across a successful resolve', async () => {
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: {
          responseType: 'next_training_step',
          text: 'No storage writes please.',
          language: 'en',
          nextStep: { title: 'Do the thing', instruction: 'Then rest.' },
        },
      }),
    );

    render(<MichaelRuntimeSupportCard />);
    await screen.findByText('Do the thing');

    expect(localSet).not.toHaveBeenCalled();
    localSet.mockRestore();
  });

  it('makes exactly one network call (no analytics beacon / second request) on mount', async () => {
    const sendBeacon = vi.fn();
    vi.stubGlobal('navigator', { ...globalThis.navigator, sendBeacon });
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: { responseType: 'safe_fallback', text: 'One call only.' },
      }),
    );

    render(<MichaelRuntimeSupportCard />);
    await screen.findByText('One call only.');

    // Give any stray async effect a tick to misbehave before asserting.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
