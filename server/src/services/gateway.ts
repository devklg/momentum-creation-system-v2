/**
 * Universal Gateway client. All persistence happens through this.
 * Single endpoint: POST {GATEWAY_URL}/execute with { tool, action, params }.
 * The gateway fans writes to MongoDB + Neo4j + ChromaDB so a single logical
 * operation lands in all three stores. See docs/locked-spec.md.
 */

import { fetch } from 'undici';
import { env } from '../env.js';

export interface GatewayResponse<T = unknown> {
  success: boolean;
  tool: string;
  action: string;
  data: T;
  error?: string;
  executionTime?: number;
}

export class GatewayError extends Error {
  constructor(
    public readonly tool: string,
    public readonly action: string,
    message: string,
  ) {
    super(`[gateway:${tool}.${action}] ${message}`);
    this.name = 'GatewayError';
  }
}

export async function gatewayCall<T = unknown>(
  tool: string,
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${env.GATEWAY_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, action, params }),
  });

  if (!res.ok) {
    throw new GatewayError(tool, action, `HTTP ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as GatewayResponse<T>;
  if (!body.success) {
    throw new GatewayError(tool, action, body.error ?? 'unknown error');
  }
  return body.data;
}
