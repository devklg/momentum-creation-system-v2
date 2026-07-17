import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SteveSuccessInterviewPage } from '../steve-success-interview';

const fields = [
  'why_statement',
  'success_vision',
  'support_obstacles',
  'michael_handoff_summary',
] as const;

const CONSENT_LABELS_FOR_TEST: Record<(typeof fields)[number], string> = {
  why_statement: 'Primary why',
  success_vision: 'Success vision',
  support_obstacles: 'Potential obstacles',
  michael_handoff_summary: 'Michael handoff summary',
};

function privacy(grantedField?: (typeof fields)[number], status = 'active') {
  return {
    policyVersion: 'acr-0031.v1',
    status,
    withdrawnAt: status === 'withdrawn' ? '2026-07-16T01:00:00.000Z' : null,
    sponsorConsent: Object.fromEntries(
      fields.map((field) => [
        field,
        {
          field,
          granted: field === grantedField,
          sponsorTmagId: field === grantedField ? 'TMAG-SPONSOR' : null,
          grantedAt: field === grantedField ? '2026-07-16T00:30:00.000Z' : null,
          revokedAt: null,
        },
      ]),
    ),
  };
}

const artifact = {
  tmagId: 'TMAG-BA',
  sponsorTmagId: 'TMAG-SPONSOR',
  callSid: null,
  startedAt: '2026-07-16T00:00:00.000Z',
  completedAt: '2026-07-16T00:10:00.000Z',
  transcript: [
    {
      sequence: 1,
      speaker: 'ba',
      text: 'Family',
      occurredAt: '2026-07-16T00:01:00.000Z',
    },
  ],
  answers: [],
  audioUrl: null,
  correctionRevision: 0,
  profileVersion: 1,
  lastCorrectedAt: null,
  successProfile: {
    tmagId: 'TMAG-BA',
    generatedAt: '2026-07-16T00:10:00.000Z',
    signedBy: 'Steve Success · non-scored discovery profile',
    primaryWhy: { statement: 'Family', who: 'family', whyNow: 'now' },
    successVision: { statement: 'Freedom', oneBigChange: 'time' },
    learningStyle: { modalities: ['doing'], feedbackPreference: 'direct', notes: '' },
    communicationPreferences: {
      preferredChannels: ['text'],
      cadence: 'weekly',
      bestTimes: 'evenings',
      notes: '',
    },
    supportNeeds: {
      areas: ['training'],
      potentialObstacles: ['time'],
      helpStyle: 'ask early',
      notes: '',
    },
    launchRecommendations: [],
    trainingRecommendations: [],
    michaelHandoffSummary: 'Small actions',
  },
};

const grantCopy =
  'Share this field with my current direct sponsor so they can support my training. I can turn sharing off later. This does not share my transcript, raw answers, audio, or the rest of my Success Profile.';
const revocationCopy =
  'Stop sharing this field with my direct sponsor. The sponsor view will remove it; a content-free audit fact will remain.';

function json(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

interface FakeSpeechArtifact {
  utterances: FakeSpeechUtterance[];
  recognitionInstances: {
    onresult?: ((e: {
      resultIndex: number;
      results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
    }) => void) | null;
    onend?: (() => void) | null;
    onerror?: ((event: { error?: string }) => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
  }[];
  startedRecognitionInstances: FakeSpeechArtifact['recognitionInstances'];
  speechRecognitionCtor: typeof SpeechRecognition;
  getCurrentUtterance: () => FakeSpeechArtifact['utterances'][number] | null;
}

interface FakeSpeechUtterance {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  onend: ((event?: { utterance: FakeSpeechUtterance }) => void) | null;
}

interface VoiceEnvOptions {
  autoSpeakEnd?: boolean;
}

function setupVoiceEnv(options: VoiceEnvOptions = {}) {
  const { autoSpeakEnd = true } = options;
  const recognitionInstances: FakeSpeechArtifact['recognitionInstances'] = [];
  const startedRecognitionInstances: FakeSpeechArtifact['recognitionInstances'] = [];
  const utterances: FakeSpeechArtifact['utterances'] = [];

  class FakeSpeechRecognition {
    lang = 'en-US';
    continuous = true;
    interimResults = true;
    processLocally = true;
    onresult: FakeSpeechArtifact['recognitionInstances'][number]['onresult'] = null;
    onend: FakeSpeechArtifact['recognitionInstances'][number]['onend'] = null;
    onerror: FakeSpeechArtifact['recognitionInstances'][number]['onerror'] = null;
    constructor() {
      recognitionInstances.push(this);
    }
    start() {
      startedRecognitionInstances.push(this);
      this.onresult?.({
        resultIndex: 0,
        results: {
          length: 0,
        },
      } as unknown as {
        resultIndex: number;
        results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
      });
    }
    stop() {
      this.onend?.();
    }
    abort() {
      this.onend?.();
    }
  }

  class FakeSpeechUtterance {
    text: string;
    lang = 'en-US';
    voice: SpeechSynthesisVoice | null = null;
    rate = 1;
    pitch = 1;
    onend: ((event?: { utterance: FakeSpeechUtterance }) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }

  let currentUtterance: FakeSpeechUtterance | null = null;
  const voices = [
    {
      name: 'Team Test',
      lang: 'en-US',
      localService: true,
      default: false,
    },
  ] as unknown as SpeechSynthesisVoice[];
  const speechSynthesisMock = {
    onvoiceschanged: null as (() => void) | null,
    speaking: false,
    cancel: vi.fn(() => {
      speechSynthesisMock.speaking = false;
    }),
    getVoices: vi.fn(() => voices),
    speak: vi.fn((utterance: FakeSpeechUtterance) => {
      currentUtterance = utterance;
      utterances.push(utterance);
      speechSynthesisMock.speaking = true;
      if (autoSpeakEnd) {
        speechSynthesisMock.speaking = false;
        utterance.onend?.({ utterance });
      }
    }),
    getCurrentUtterance: () => currentUtterance,
  };

  (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition =
    FakeSpeechRecognition as unknown as typeof SpeechRecognition;
  (globalThis as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
    FakeSpeechRecognition as unknown as typeof SpeechRecognition;
  (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
    FakeSpeechUtterance as unknown as typeof SpeechSynthesisUtterance;
  (globalThis as { speechSynthesis?: unknown }).speechSynthesis =
    speechSynthesisMock as unknown as SpeechSynthesis;

  vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition as unknown as typeof SpeechRecognition);
  vi.stubGlobal('webkitSpeechRecognition', FakeSpeechRecognition as unknown as typeof SpeechRecognition);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeSpeechUtterance as unknown as typeof SpeechSynthesisUtterance);
  vi.stubGlobal('speechSynthesis', speechSynthesisMock as unknown as SpeechSynthesis);

  return {
    recognitionInstances,
    startedRecognitionInstances,
    speechSynthesisMock,
    speechRecognitionCtor: FakeSpeechRecognition as unknown as typeof SpeechRecognition,
    utterances,
    getCurrentUtterance: () => currentUtterance,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Steve Success Profile privacy controls', () => {
  it('keeps typed conversation available when local-device voice is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/steve/discovery/state')) {
          return json({
            ok: true,
            view: {
              tmagId: 'TMAG-BA',
              phase: 'awaiting_call',
              transcript: [],
              artifact: null,
            },
          });
        }
        if (url.endsWith('/api/steve/discovery/conversation')) {
          return json({ ok: true, turns: [] });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        /Type is always available. Voice appears only when this browser reports both/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voice' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: "I'm ready — start my conversation" }),
    ).toBeInTheDocument();
  });

  it('renders four independent off-by-default controls and sends one exact field grant', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/steve/discovery/state')) {
        return json({
          ok: true,
          view: { tmagId: 'TMAG-BA', phase: 'complete', artifact },
        });
      }
      if (url.endsWith('/api/steve/discovery/privacy') && !init?.method) {
        return json({
          ok: true,
          privacy: privacy(),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }
      if (
        url.endsWith('/api/steve/discovery/privacy/consent') &&
        init?.method === 'PUT'
      ) {
        return json({
          ok: true,
          privacy: privacy('why_statement'),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
          auditEntryId: 'audit-1',
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Your Privacy Controls')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    });
    const privacyCheckboxes = fields.map((field) =>
      screen.getByRole('checkbox', {
        name: new RegExp(`^${CONSENT_LABELS_FOR_TEST[field]}`),
      }),
    );
    expect(
      privacyCheckboxes.every(
        (checkbox) => !(checkbox as HTMLInputElement).checked,
      ),
    ).toBe(true);
    expect(screen.getAllByText(grantCopy)).toHaveLength(4);

    fireEvent.click(screen.getByRole('checkbox', { name: /Primary why/ }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/steve/discovery/privacy/consent',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ field: 'why_statement', granted: true }),
        }),
      );
    });
    expect(
      screen.getByRole('checkbox', { name: /Primary why/ }),
    ).toBeChecked();
    expect(screen.getByText(revocationCopy)).toBeInTheDocument();
  });

  it('shows the one-way withdrawn state with self-copy preserved language', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/steve/discovery/state')) {
          return json({
            ok: true,
            view: { tmagId: 'TMAG-BA', phase: 'complete', artifact },
          });
        }
        return json({
          ok: true,
          privacy: privacy(undefined, 'withdrawn'),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }),
    );

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        /Personalization and sponsor sharing are off. Your current profile remains visible to you./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off personalization' })).not.toBeInTheDocument();
    expect(
      fields
        .map((field) =>
          screen.getByRole('checkbox', {
            name: new RegExp(`^${CONSENT_LABELS_FOR_TEST[field]}`),
          }),
        )
        .every((checkbox) => checkbox.hasAttribute('disabled')),
    ).toBe(true);
  });

  it('submits one confirmed exact correction and reloads the current artifact', async () => {
    let currentArtifact = structuredClone(artifact);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/steve/discovery/state')) {
        return json({
          ok: true,
          view: {
            tmagId: 'TMAG-BA',
            phase: 'complete',
            transcript: currentArtifact.transcript,
            artifact: currentArtifact,
          },
        });
      }
      if (url.endsWith('/api/steve/discovery/privacy') && !init?.method) {
        return json({
          ok: true,
          privacy: privacy(),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }
      if (
        url.endsWith('/api/steve/discovery/correction') &&
        init?.method === 'PUT'
      ) {
        const body = JSON.parse(String(init.body)) as {
          target: unknown;
          replacement: string;
          expectedRevision: number;
          confirmation: string;
        };
        expect(body).toMatchObject({
          target: { kind: 'profile_text', path: 'primaryWhy.statement' },
          replacement: 'Family and freedom',
          expectedRevision: 0,
          confirmation: 'I CONFIRM THIS STEVE CORRECTION',
        });
        currentArtifact = {
          ...currentArtifact,
          correctionRevision: 1,
          lastCorrectedAt: '2026-07-16T02:00:00.000Z',
          successProfile: {
            ...currentArtifact.successProfile,
            primaryWhy: {
              ...currentArtifact.successProfile.primaryWhy,
              statement: 'Family and freedom',
            },
          },
        };
        return json({
          ok: true,
          artifact: currentArtifact,
          correctionRevision: 1,
          correctedAt: '2026-07-16T02:00:00.000Z',
          changedFieldPaths: ['successProfile.primaryWhy.statement'],
          auditEntryId: 'audit-correction',
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Correct Your Private Record')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('steve-correction-target'), {
      target: { value: 'primary-why' },
    });
    fireEvent.change(screen.getByTestId('steve-correction-replacement'), {
      target: { value: 'Family and freedom' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /I confirm this replacement is the current private value/,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Save confirmed correction' }),
    );

    expect(
      await screen.findByText(
        'Your correction is saved. The prior confirmed version is preserved.',
      ),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Family and freedom')).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/steve/discovery/correction',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('starts a retake without deleting the current active profile', async () => {
    let retakeStarted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/steve/discovery/state')) {
        return json({
          ok: true,
          view: retakeStarted
            ? {
                tmagId: 'TMAG-BA',
                phase: 'call_in_progress',
                transcript: artifact.transcript,
                artifact,
                retakeInProgress: true,
              }
            : { tmagId: 'TMAG-BA', phase: 'complete', artifact },
        });
      }
      if (url.endsWith('/api/steve/discovery/privacy') && !init?.method) {
        return json({
          ok: true,
          privacy: privacy(),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }
      if (url.endsWith('/api/steve/discovery/retake') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          confirmation: 'START A NEW STEVE INTERVIEW',
        });
        retakeStarted = true;
        return json({
          ok: true,
          retakeSessionId: 'steve_retake_123',
          profileVersion: 1,
          startedAt: '2026-07-16T03:00:00.000Z',
          auditEntryId: 'audit-retake',
        });
      }
      if (url.endsWith('/api/steve/discovery/conversation')) {
        return json({ ok: true, turns: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Retake Your Interview')).toBeInTheDocument();
    expect(
      screen.getByText(/Version 1 stays active for your plan of action/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /current profile remains active until I complete/,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Start a new Steve interview' }),
    );

    expect(await screen.findByText('Your discovery conversation')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/steve/discovery/retake',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not advance to the next turn until a voice draft is explicitly submitted', async () => {
    const voice = setupVoiceEnv();
    const converseMessages: string[] = [];
    const conversation: { seq: number; role: 'ba' | 'steve'; text: string; at: string }[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/steve/discovery/state')) {
        return json({
          ok: true,
          view: {
            tmagId: 'TMAG-BA',
            phase: 'call_in_progress',
            transcript: conversation,
            artifact: null,
          },
        });
      }
      if (url.endsWith('/api/steve/discovery/conversation')) {
        return json({ ok: true, turns: [] });
      }
      if (url.endsWith('/api/steve/discovery/converse') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { message: string };
        converseMessages.push(body.message);
        if (body.message === '') {
          conversation.push({ seq: 1, role: 'steve', text: 'What do you most want to get from Team Magnificent?', at: '2026-07-16T00:00:00.000Z' });
          return json({
            ok: true,
            turns: conversation.slice(),
            done: false,
            extractionPending: false,
          });
        }
        conversation.push({ seq: 2, role: 'ba', text: body.message, at: '2026-07-16T00:01:00.000Z' });
        conversation.push({ seq: 3, role: 'steve', text: 'Thank you. Final one.', at: '2026-07-16T00:02:00.000Z' });
        return json({
          ok: true,
          turns: conversation.slice(),
          done: false,
          extractionPending: false,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: "I'm ready — start my conversation" }));
    expect(await screen.findByText(/What do you most want to get from/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Done/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeInTheDocument();
    await waitFor(() => {
      expect(converseMessages).toEqual(['']);
    });
    expect(voice.speechSynthesisMock.speak).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole('button', { name: 'Voice' }));
    expect(voice.recognitionInstances.length).toBeGreaterThan(0);

    const recognition = voice.recognitionInstances[voice.recognitionInstances.length - 1];
    voice.speechSynthesisMock.speaking = true;
    recognition.onend?.();
    expect(converseMessages).toEqual(['']);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I want momentum, accountability, and growth.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

    expect(
      await screen.findByText('Thank you. Final one.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/steve/discovery/converse',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ message: 'I want momentum, accountability, and growth.' }) }),
    );
    expect(converseMessages).toEqual(['', 'I want momentum, accountability, and growth.']);
  });

  it('aborts active voice recognition on submit and restarts listening after the Steve utterance ends', async () => {
    const voice = setupVoiceEnv({ autoSpeakEnd: false });
    const converseMessages: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/steve/discovery/state')) {
        return json({
          ok: true,
          view: {
            tmagId: 'TMAG-BA',
            phase: 'awaiting_call',
            transcript: [
              // no turns yet; will be seeded by the first /converse call
            ],
            artifact: null,
          },
        });
      }
      if (url.endsWith('/api/steve/discovery/conversation')) {
        return json({
          ok: true,
          turns: [],
        });
      }
      if (url.endsWith('/api/steve/discovery/converse') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { message: string };
        converseMessages.push(body.message);
        if (body.message === '') {
          return json({
            ok: true,
            turns: [
              {
                seq: 1,
                role: 'steve',
                text: 'Tell me what you are most motivated to build today.',
                at: '2026-07-16T00:00:00.000Z',
              },
            ],
            done: false,
            extractionPending: false,
          });
        }
        if (body.message === 'I want to share consistently and stay disciplined.') {
          return json({
            ok: true,
            turns: [
              { seq: 1, role: 'steve', text: 'Tell me what you are most motivated to build today.', at: '2026-07-16T00:00:00.000Z' },
              { seq: 2, role: 'ba', text: body.message, at: '2026-07-16T00:01:00.000Z' },
              { seq: 3, role: 'steve', text: 'Great. What helps your momentum stay consistent?', at: '2026-07-16T00:02:00.000Z' },
            ],
            done: false,
            extractionPending: false,
          });
        }
        throw new Error(`Unexpected message: ${body.message}`);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: "I'm ready — start my conversation" }));
    expect(await screen.findByText(/Tell me what you are most motivated to build today/)).toBeInTheDocument();
    await waitFor(() => {
      expect(voice.speechSynthesisMock.getVoices).toHaveBeenCalled();
    });
    voice.speechSynthesisMock.onvoiceschanged?.();

    const initialUtterance = voice.getCurrentUtterance();
    if (initialUtterance?.onend) {
      initialUtterance.onend?.({ utterance: initialUtterance });
    }
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Voice' })).toBeInTheDocument();
    });

    const startSpy = vi.spyOn(voice.speechRecognitionCtor.prototype, 'start');
    const abortSpy = vi.spyOn(voice.speechRecognitionCtor.prototype, 'abort');
    const startCountAtInit = startSpy.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Voice' }));
    await waitFor(() => {
      expect(startSpy).toHaveBeenCalledTimes(startCountAtInit + 1);
    });
    expect(voice.startedRecognitionInstances.length).toBeGreaterThan(0);
    const activeRecognition = voice.startedRecognitionInstances[voice.startedRecognitionInstances.length - 1];
    const startCountAfterFirstListen = startSpy.mock.calls.length;
    expect(startCountAfterFirstListen).toBeGreaterThan(startCountAtInit);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'I want to share consistently and stay disciplined.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));

    await waitFor(() => {
      expect(abortSpy).toHaveBeenCalled();
    });
    const abortCountAtSubmit = abortSpy.mock.calls.length;
    await waitFor(() => {
      expect(converseMessages).toEqual(['', 'I want to share consistently and stay disciplined.']);
      expect(screen.getByText('Great. What helps your momentum stay consistent?')).toBeInTheDocument();
      expect(voice.utterances.some((u) =>
        u.text === 'Great. What helps your momentum stay consistent?',
      )).toBe(true);
    });
    expect(startSpy).toHaveBeenCalledTimes(startCountAfterFirstListen);
    const recognitionCountBeforeSteveEnd = voice.startedRecognitionInstances.length;

    const steveUtterance = voice.utterances.find((u) =>
      u.text === 'Great. What helps your momentum stay consistent?',
    );
    expect(steveUtterance).toBeTruthy();
    voice.speechSynthesisMock.speaking = false;
    steveUtterance?.onend?.({ utterance: steveUtterance });

    await waitFor(() => {
      expect(startSpy).toHaveBeenCalledTimes(startCountAfterFirstListen + 1);
      expect(voice.startedRecognitionInstances.length).toBe(recognitionCountBeforeSteveEnd + 1);
    });
    const resumedRecognition = voice.startedRecognitionInstances[voice.startedRecognitionInstances.length - 1];
    expect(resumedRecognition).not.toBe(activeRecognition);
    expect(abortSpy).toHaveBeenCalledTimes(abortCountAtSubmit);
  });

  it('collapses completed transcript by default and keeps launch/cockpit navigation links clear', async () => {
    const completeArtifact = {
      ...artifact,
      answers: [{ questionId: 'q1', prompt: 'Why?', answerText: 'For the team and family.' }],
      transcript: [
        {
          sequence: 1,
          speaker: 'steve',
          text: 'Tell me why.',
          occurredAt: '2026-07-16T00:01:00.000Z',
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/steve/discovery/state')) {
          return json({ ok: true, view: { tmagId: 'TMAG-BA', phase: 'complete', artifact: completeArtifact } });
        }
        return json({
          ok: true,
          privacy: privacy(),
          currentSponsorTmagId: 'TMAG-SPONSOR',
          grantCopy,
          revocationCopy,
        });
      }),
    );

    render(
      <MemoryRouter>
        <SteveSuccessInterviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Your Discovery Conversation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View full conversation' })).toBeInTheDocument();
    expect(screen.queryByText('What you shared')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to Launch Center' })).toHaveAttribute('href', '/launch');
    expect(screen.getByRole('link', { name: '← Cockpit' })).toHaveAttribute('href', '/cockpit');

    fireEvent.click(screen.getByRole('button', { name: 'View full conversation' }));
    expect(await screen.findByText('What you shared')).toBeInTheDocument();
    expect(screen.getByText('Transcript')).toBeInTheDocument();
  });
});
