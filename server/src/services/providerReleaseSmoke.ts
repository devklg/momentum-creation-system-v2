import { fetch } from 'undici';

const RESEND_DOMAINS_URL = 'https://api.resend.com/domains?limit=100';
const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 10_000;

export type ProviderReleaseSmokeTarget = 'email' | 'llm' | 'all';

export interface ProviderReleaseSmokeConfig {
  EMAIL_API_KEY: string;
  EMAIL_FROM: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
}

export type ProviderReleaseSmokeState =
  | 'ready'
  | 'not_configured'
  | 'invalid_config'
  | 'credential_rejected'
  | 'target_unavailable'
  | 'target_not_ready'
  | 'provider_unavailable'
  | 'request_rejected'
  | 'malformed_response';

export interface ProviderReleaseSmokeResult {
  provider: 'resend' | 'anthropic';
  ok: boolean;
  configured: boolean;
  state: ProviderReleaseSmokeState;
  target: string | null;
  resolvedTarget: string | null;
  providerStatus: string | null;
  httpStatus: number | null;
  request: {
    method: 'GET';
    bodyIncluded: false;
    sendsEmail: false;
    sendsLlmPrompt: false;
  };
  privacy: {
    syntheticOnly: true;
    interviewDataSent: false;
    credentialReturned: false;
    upstreamBodyReturned: false;
  };
}

type FetchLike = typeof fetch;

interface ResendDomain {
  name?: string;
  status?: string;
  capabilities?: { sending?: string };
}

interface ResendDomainListResponse {
  data?: ResendDomain[];
}

interface AnthropicModelResponse {
  id?: string;
  display_name?: string;
  type?: string;
}

const requestBoundary = {
  method: 'GET' as const,
  bodyIncluded: false as const,
  sendsEmail: false as const,
  sendsLlmPrompt: false as const,
};

const privacyBoundary = {
  syntheticOnly: true as const,
  interviewDataSent: false as const,
  credentialReturned: false as const,
  upstreamBodyReturned: false as const,
};

function result(
  provider: ProviderReleaseSmokeResult['provider'],
  fields: Omit<ProviderReleaseSmokeResult, 'provider' | 'request' | 'privacy'>,
): ProviderReleaseSmokeResult {
  return {
    provider,
    ...fields,
    request: { ...requestBoundary },
    privacy: { ...privacyBoundary },
  };
}

function statusFailure(
  provider: ProviderReleaseSmokeResult['provider'],
  target: string,
  status: number,
): ProviderReleaseSmokeResult {
  const state: ProviderReleaseSmokeState =
    status === 401 || status === 403
      ? 'credential_rejected'
      : status === 404
        ? 'target_unavailable'
        : status === 408 || status === 429 || status >= 500
          ? 'provider_unavailable'
          : 'request_rejected';
  return result(provider, {
    ok: false,
    configured: true,
    state,
    target,
    resolvedTarget: null,
    providerStatus: null,
    httpStatus: status,
  });
}

function emailDomain(from: string): string | null {
  const trimmed = from.trim();
  const bracketed = trimmed.match(/<([^<>]+)>$/)?.[1]?.trim();
  const address = bracketed ?? trimmed;
  const at = address.lastIndexOf('@');
  if (at <= 0 || at === address.length - 1) return null;
  const domain = address.slice(at + 1).trim().toLowerCase().replace(/\.$/, '');
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) && domain.includes('.')
    ? domain
    : null;
}

async function parseJson<T>(response: Awaited<ReturnType<FetchLike>>): Promise<T | null> {
  try {
    return JSON.parse(await response.text()) as T;
  } catch {
    return null;
  }
}

/**
 * Validate the Resend credential and configured sending-domain state without
 * creating or sending an email. The request is an authenticated GET only.
 */
export async function smokeResendReleaseKey(
  config: Pick<ProviderReleaseSmokeConfig, 'EMAIL_API_KEY' | 'EMAIL_FROM'>,
  fetchImpl: FetchLike = fetch,
): Promise<ProviderReleaseSmokeResult> {
  const domain = emailDomain(config.EMAIL_FROM);
  if (!config.EMAIL_API_KEY.trim()) {
    return result('resend', {
      ok: false,
      configured: false,
      state: 'not_configured',
      target: domain,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: null,
    });
  }
  if (!domain) {
    return result('resend', {
      ok: false,
      configured: true,
      state: 'invalid_config',
      target: null,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: null,
    });
  }

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(RESEND_DOMAINS_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${config.EMAIL_API_KEY}`,
        'User-Agent': 'momentum-creation-system-v2/provider-release-smoke',
      },
    });
  } catch {
    return result('resend', {
      ok: false,
      configured: true,
      state: 'provider_unavailable',
      target: domain,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: null,
    });
  }
  if (!response.ok) return statusFailure('resend', domain, response.status);

  const parsed = await parseJson<ResendDomainListResponse>(response);
  if (!Array.isArray(parsed?.data)) {
    return result('resend', {
      ok: false,
      configured: true,
      state: 'malformed_response',
      target: domain,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: response.status,
    });
  }

  const matched = parsed.data.find((entry) => entry.name?.toLowerCase() === domain);
  if (!matched) {
    return result('resend', {
      ok: false,
      configured: true,
      state: 'target_unavailable',
      target: domain,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: response.status,
    });
  }

  const status = matched.status ?? 'unknown';
  const sendingEnabled = matched.capabilities?.sending === 'enabled';
  const verifiedForSending = ['verified', 'partially_verified', 'partially_failed'].includes(status);
  const ready = sendingEnabled && verifiedForSending;
  return result('resend', {
    ok: ready,
    configured: true,
    state: ready ? 'ready' : 'target_not_ready',
    target: domain,
    resolvedTarget: matched.name ?? domain,
    providerStatus: status,
    httpStatus: response.status,
  });
}

/**
 * Validate the Anthropic credential and configured model entitlement without
 * submitting a Messages request. The request contains no prompt or BA data.
 */
export async function smokeAnthropicReleaseKey(
  config: Pick<ProviderReleaseSmokeConfig, 'ANTHROPIC_API_KEY' | 'ANTHROPIC_MODEL'>,
  fetchImpl: FetchLike = fetch,
): Promise<ProviderReleaseSmokeResult> {
  const model = config.ANTHROPIC_MODEL.trim();
  if (!config.ANTHROPIC_API_KEY.trim()) {
    return result('anthropic', {
      ok: false,
      configured: false,
      state: 'not_configured',
      target: model || null,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: null,
    });
  }
  if (!model) {
    return result('anthropic', {
      ok: false,
      configured: true,
      state: 'invalid_config',
      target: null,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: null,
    });
  }

  const url = `${ANTHROPIC_MODELS_URL}/${encodeURIComponent(model)}`;
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'x-api-key': config.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
    });
  } catch {
    return result('anthropic', {
      ok: false,
      configured: true,
      state: 'provider_unavailable',
      target: model,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: null,
    });
  }
  if (!response.ok) return statusFailure('anthropic', model, response.status);

  const parsed = await parseJson<AnthropicModelResponse>(response);
  if (!parsed?.id || parsed.type !== 'model') {
    return result('anthropic', {
      ok: false,
      configured: true,
      state: 'malformed_response',
      target: model,
      resolvedTarget: null,
      providerStatus: null,
      httpStatus: response.status,
    });
  }

  return result('anthropic', {
    ok: true,
    configured: true,
    state: 'ready',
    target: model,
    resolvedTarget: parsed.id,
    providerStatus: 'available',
    httpStatus: response.status,
  });
}

export async function runProviderReleaseSmoke(
  config: ProviderReleaseSmokeConfig,
  target: ProviderReleaseSmokeTarget = 'all',
  fetchImpl: FetchLike = fetch,
): Promise<ProviderReleaseSmokeResult[]> {
  const checks: Array<Promise<ProviderReleaseSmokeResult>> = [];
  if (target === 'email' || target === 'all') {
    checks.push(smokeResendReleaseKey(config, fetchImpl));
  }
  if (target === 'llm' || target === 'all') {
    checks.push(smokeAnthropicReleaseKey(config, fetchImpl));
  }
  return Promise.all(checks);
}
