/**
 * Behavioral tests for the Michael Runtime Support card (Phase 3 / P3.14–P3.15).
 *
 * This is the FIRST apps/team behavioral test. It exercises two surfaces of the
 * `.team` cockpit's Michael runtime support card:
 *
 *   1. resolveMichaelRuntimeTrainingStep() — the client helper that calls the
 *      server-owned /api/michael-runtime/resolve route and maps every HTTP
 *      status to a typed, leak-free result. Tests here pin the SERVER-OWNED
 *      request contract (body is at most `{ language, ask }`, never BA authority),
 *      the kill-switch mapping (503 → disabled / response_disabled), and the
 *      fail-closed behavior for every non-200 / malformed path.
 *
 *   2. MichaelRuntimeSupportCard — the read-only render. Tests assert what a
 *      Brand Ambassador actually sees in each state and that server internals
 *      (trace, ids, counters, nextStep boolean flags) NEVER reach the DOM.
 *
 * Governance: these tests assert the standing prohibitions hold at the UI edge —
 * no BA authority is ever sent, no LLM/voice/persistence is invoked by the card,
 * and nothing leaks into the prospect-invisible BA render.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import {
  resolveMichaelRuntimeTrainingStep,
  MichaelRuntimeSupportCard,
} from '../MichaelRuntimeSupportCard';

// ── fetch mock plumbing ──────────────────────────────────────────────────────

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A minimal Response-like object: only `.status` and `.json()` are used. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    json: async () => body,
  } as unknown as Response;
}

/** A 200 response whose body cannot be parsed as JSON (json() rejects). */
function unparseableResponse(status: number): Response {
  return {
    status,
    json: async () => {
      throw new SyntaxError('unexpected token');
    },
  } as unknown as Response;
}

/** Read the JSON body the helper posted on the Nth (default last) fetch call. */
function lastPostedBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

// ── resolveMichaelRuntimeTrainingStep: request contract ──────────────────────

describe('resolveMichaelRuntimeTrainingStep — server-owned request contract', () => {
  it('POSTs to the server-owned route with credentials and an empty body when no language hint is given', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));

    await resolveMichaelRuntimeTrainingStep();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/michael-runtime/resolve');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(lastPostedBody()).toEqual({});
  });

  it('sends ONLY a language hint when provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));

    await resolveMichaelRuntimeTrainingStep({ language: 'es' });

    expect(lastPostedBody()).toEqual({ language: 'es' });
  });

  it('sends a short BA-owned ask when provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));

    await resolveMichaelRuntimeTrainingStep({ ask: '  What should I practice next?  ' });

    expect(lastPostedBody()).toEqual({ ask: 'What should I practice next?' });
  });

  it('NEVER sends BA authority or turn/context fields (sponsor immutability at the UI edge)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));

    await resolveMichaelRuntimeTrainingStep({ language: 'en' });

    const body = lastPostedBody();
    const forbidden = [
      'tmagId',
      'sponsorTmagId',
      'targetTmagId',
      'downlineTmagId',
      'prospectId',
      'token',
      'sessionId',
      'turnId',
      'correlationId',
      'turn',
      'runtimeTurn',
      'contextPacket',
    ];
    for (const key of forbidden) {
      expect(body).not.toHaveProperty(key);
    }
    // Whatever else changes, the body may carry at most `language` and `ask`.
    expect(Object.keys(body).every((k) => k === 'language' || k === 'ask')).toBe(true);
  });
});

// ── resolveMichaelRuntimeTrainingStep: kill-switch + status mapping ───────────

describe('resolveMichaelRuntimeTrainingStep — status mapping', () => {
  it('maps 503 michael_runtime_disabled → disabled', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'disabled' });
  });

  it('maps 503 michael_runtime_response_disabled → response_disabled', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, { reason: 'michael_runtime_response_disabled' }),
    );
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({
      kind: 'response_disabled',
    });
  });

  it('maps a 503 with an unknown reason → generic error (no leak)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'something_else' }));
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'error' });
  });

  it('maps a 503 whose body cannot be parsed → generic error', async () => {
    fetchMock.mockResolvedValue(unparseableResponse(503));
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'error' });
  });

  it.each([400, 401, 403, 422, 500])(
    'maps non-200 status %i → generic error (no codes/issues surfaced)',
    async (status) => {
      fetchMock.mockResolvedValue(
        jsonResponse(status, { ok: false, code: 'CLIENT_RUNTIME_INPUT_NOT_ALLOWED' }),
      );
      await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'error' });
    },
  );

  it('maps a thrown fetch (network failure) → generic error', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'error' });
  });

  it('maps a 200 whose body cannot be parsed → generic error', async () => {
    fetchMock.mockResolvedValue(unparseableResponse(200));
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'error' });
  });
});

// ── resolveMichaelRuntimeTrainingStep: 200 response shaping ──────────────────

describe('resolveMichaelRuntimeTrainingStep — safe response shaping', () => {
  it('maps a safe_fallback response, preserving its BA-language text', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: { responseType: 'safe_fallback', text: 'Keep your rhythm.' },
      }),
    );
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({
      kind: 'safe_fallback',
      text: 'Keep your rhythm.',
    });
  });

  it('maps a safe_close response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: { responseType: 'safe_close', text: "You're good to go." },
      }),
    );
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({
      kind: 'safe_close',
      text: "You're good to go.",
    });
  });

  it('maps a next_training_step and strips nextStep boolean flags, keeping only display strings', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        // The server response intentionally carries internals + boolean flags
        // that must NOT survive into the safe result.
        trace: { redacted: true },
        response: {
          responseType: 'next_training_step',
          text: 'Here is your next step.',
          language: 'en',
          sessionId: 'sess-123',
          turnId: 'turn-456',
          nextStep: {
            title: 'Watch module 2',
            instruction: 'Then practice the intro.',
            label: 'Training',
            baOwned: true,
            automaticSending: false,
            automaticCalling: false,
            externalSideEffect: false,
          },
        },
        supportingContext: [
          {
            title: 'Training rhythm',
            summary: 'Use one small action to keep momentum simple.',
            packetId: 'ctx-should-not-survive',
          },
        ],
      }),
    );

    const result = await resolveMichaelRuntimeTrainingStep();

    expect(result).toEqual({
      kind: 'success',
      data: {
        text: 'Here is your next step.',
        responseType: 'next_training_step',
        language: 'en',
        nextStep: {
          title: 'Watch module 2',
          instruction: 'Then practice the intro.',
          label: 'Training',
        },
        supportingContext: [
          {
            title: 'Training rhythm',
            summary: 'Use one small action to keep momentum simple.',
          },
        ],
      },
    });
    // Defense-in-depth: the success payload must not carry any server internal.
    if (result.kind === 'success' && result.data.nextStep) {
      expect(result.data.nextStep).not.toHaveProperty('baOwned');
      expect(result.data.nextStep).not.toHaveProperty('automaticSending');
      expect(result.data.nextStep).not.toHaveProperty('automaticCalling');
      expect(result.data.nextStep).not.toHaveProperty('externalSideEffect');
    }
  });

  it('maps a clarification_question response as success', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: {
          responseType: 'clarification_question',
          text: 'Which area do you want to focus on?',
          language: 'en',
        },
      }),
    );
    const result = await resolveMichaelRuntimeTrainingStep();
    expect(result.kind).toBe('success');
  });

  it('fails closed on an unknown responseType discriminator', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        response: { responseType: 'totally_unknown', text: 'x' },
      }),
    );
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'error' });
  });

  it('fails closed when ok is false or response is missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: false }));
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'error' });

    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await expect(resolveMichaelRuntimeTrainingStep()).resolves.toEqual({ kind: 'error' });
  });
});

// ── MichaelRuntimeSupportCard: render behavior ───────────────────────────────

describe('MichaelRuntimeSupportCard — render behavior', () => {
  it('calls the resolve route exactly once on mount', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));

    render(<MichaelRuntimeSupportCard />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/michael-runtime/resolve');
  });

  it('shows the calm "Not available yet" placeholder when the route kill switch is off', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText(/not available yet/i)).toBeInTheDocument();
  });

  it('shows the paused message when the response kill switch is off', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, { reason: 'michael_runtime_response_disabled' }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText(/training guidance is paused/i)).toBeInTheDocument();
  });

  it('renders the next training step and language read-back on success, leaking no internals', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        trace: { redacted: true },
        response: {
          responseType: 'next_training_step',
          text: 'Nice momentum this week.',
          language: 'en',
          sessionId: 'sess-should-not-render',
          turnId: 'turn-should-not-render',
          nextStep: {
            title: 'Invite one person',
            instruction: 'Share your link with someone today.',
            baOwned: true,
            automaticSending: false,
          },
        },
        supportingContext: [
          {
            title: 'Layer 1',
            summary: 'Keep the next step simple and BA-owned.',
            contextPacketId: 'ctx-should-not-render',
          },
        ],
      }),
    );

    render(<MichaelRuntimeSupportCard />);

    expect(await screen.findByText('Invite one person')).toBeInTheDocument();
    expect(screen.getByText(/share your link with someone today/i)).toBeInTheDocument();
    expect(screen.getByText(/guidance · en/i)).toBeInTheDocument();
    expect(screen.getByText('Layer 1')).toBeInTheDocument();
    expect(screen.getByText(/keep the next step simple/i)).toBeInTheDocument();

    // Governance: no ids, trace, or boolean-flag internals reach the DOM.
    expect(screen.queryByText(/sess-should-not-render/)).not.toBeInTheDocument();
    expect(screen.queryByText(/turn-should-not-render/)).not.toBeInTheDocument();
    expect(screen.queryByText(/baOwned/)).not.toBeInTheDocument();
    expect(screen.queryByText(/automaticSending/)).not.toBeInTheDocument();
    expect(screen.queryByText(/redacted/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ctx-should-not-render/)).not.toBeInTheDocument();
  });

  it('submits a BA ask from the card without sending authority fields', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { reason: 'michael_runtime_disabled' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          response: {
            responseType: 'safe_fallback',
            text: 'Keep your training rhythm simple.',
          },
        }),
      );

    render(<MichaelRuntimeSupportCard />);
    await screen.findByText(/not available yet/i);

    fireEvent.change(screen.getByLabelText(/ask michael about training/i), {
      target: { value: 'What do I practice?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send training question/i }));

    await screen.findByText(/keep your training rhythm simple/i);
    const body = lastPostedBody();
    expect(body).toEqual({ ask: 'What do I practice?' });
    expect(body).not.toHaveProperty('tmagId');
    expect(body).not.toHaveProperty('contextPacket');
  });

  it('shows a generic error with a "Try again" affordance, and re-runs resolve on click', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { ok: false }));

    render(<MichaelRuntimeSupportCard />);

    const tryAgain = await screen.findByRole('button', { name: /try again/i });
    expect(tryAgain).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second attempt succeeds — the card recovers without a remount.
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        response: {
          responseType: 'safe_fallback',
          text: 'Back online — keep your rhythm.',
        },
      }),
    );

    fireEvent.click(tryAgain);

    expect(await screen.findByText(/back online — keep your rhythm/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never renders prospect-forbidden / income-style copy in any state', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { reason: 'michael_runtime_disabled' }));

    render(<MichaelRuntimeSupportCard />);
    await screen.findByText(/not available yet/i);

    const body = document.body.textContent ?? '';
    // The card is BA-facing training support — never compensation/placement copy.
    expect(body).not.toMatch(/income|commission|cycle|payout|earnings|guarantee/i);
  });
});
