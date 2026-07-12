/**
 * Minimal Universal Gateway HTTP client for AGENT TOOLING modules
 * (agentMemory, contextGuard, contextPacket, memoryContextIndex, contextAgent).
 *
 * NOT for app runtime. App-runtime persistence goes through
 * tripleStackWrite / the persistence adapters — never through the gateway.
 */

export interface GatewayEnvelope {
  success?: boolean;
  error?: string;
  data?: unknown;
}

export class GatewayCallError extends Error {
  constructor(
    public readonly tool: string,
    public readonly action: string,
    message: string,
  ) {
    super(`${tool}.${action} failed: ${message}`);
    this.name = 'GatewayCallError';
  }
}

export const DEFAULT_GATEWAY_URL =
  process.env.AGENT_MEMORY_GATEWAY_URL || 'http://localhost:2526';

/** POST /api/execute. Throws on HTTP failure or `success: false` — a gateway
 * call that "succeeds" with an error body must never look like data. */
export async function callGateway<T>(
  gatewayUrl: string,
  tool: string,
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${gatewayUrl}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, action, params }),
  });
  const raw = await res.text();
  let body: GatewayEnvelope;
  try {
    body = JSON.parse(raw) as GatewayEnvelope;
  } catch {
    throw new GatewayCallError(tool, action, `HTTP ${res.status}: ${raw.slice(0, 400)}`);
  }
  if (!res.ok || body.success === false) {
    throw new GatewayCallError(tool, action, `HTTP ${res.status}: ${body.error ?? raw.slice(0, 400)}`);
  }
  return body.data as T;
}
