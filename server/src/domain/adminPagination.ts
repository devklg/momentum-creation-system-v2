import { createHmac, timingSafeEqual } from 'node:crypto';
import type { McsAdminPageInfo } from '@momentum/shared';
import { env } from '../env.js';

export type AdminPageInfo = McsAdminPageInfo;

interface CursorPayload {
  v: 1;
  scope: string;
  contract: string;
  keys: Record<string, string>;
}

export class AdminCursorError extends Error {
  readonly code = 'invalid_cursor';

  constructor(message = 'The pagination cursor is invalid for this view.') {
    super(message);
    this.name = 'AdminCursorError';
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function contractSignature(contract: unknown): string {
  return createHmac('sha256', env.JWT_SECRET)
    .update(JSON.stringify(stableValue(contract)))
    .digest('base64url');
}

function tokenSignature(encoded: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(encoded).digest('base64url');
}

export function encodeAdminCursor(input: {
  scope: string;
  contract: unknown;
  keys: Record<string, string>;
}): string {
  const payload: CursorPayload = {
    v: 1,
    scope: input.scope,
    contract: contractSignature(input.contract),
    keys: input.keys,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${tokenSignature(encoded)}`;
}

export function decodeAdminCursor(input: {
  token: string;
  scope: string;
  contract: unknown;
  requiredKeys: readonly string[];
}): Record<string, string> {
  const parts = input.token.split('.');
  const encoded = parts[0];
  const suppliedSignature = parts[1];
  if (!encoded || !suppliedSignature || parts.length !== 2) throw new AdminCursorError();

  const expectedSignature = tokenSignature(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new AdminCursorError();
  }

  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as CursorPayload;
  } catch {
    throw new AdminCursorError();
  }

  if (
    payload.v !== 1 ||
    payload.scope !== input.scope ||
    payload.contract !== contractSignature(input.contract) ||
    !payload.keys ||
    typeof payload.keys !== 'object'
  ) {
    throw new AdminCursorError();
  }
  for (const key of input.requiredKeys) {
    if (typeof payload.keys[key] !== 'string' || payload.keys[key].length === 0) {
      throw new AdminCursorError();
    }
  }
  return payload.keys;
}

export function descendingKeysetFilter(
  timestampField: string,
  idField: string,
  timestamp: string,
  id: string,
): Record<string, unknown> {
  return {
    $or: [
      { [timestampField]: { $lt: timestamp } },
      { [timestampField]: timestamp, [idField]: { $lt: id } },
    ],
  };
}

export function combineMongoFilters(
  ...filters: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const populated = filters.filter(
    (filter): filter is Record<string, unknown> => !!filter && Object.keys(filter).length > 0,
  );
  if (populated.length === 0) return {};
  if (populated.length === 1) return populated[0]!;
  return { $and: populated };
}
