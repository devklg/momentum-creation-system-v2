/**
 * PII redaction for ADMIN I.4/I.5 CSV exports (Chat #144).
 *
 * Pure functions over strings. No I/O, no side effects. Every export
 * (raw OR redacted) passes through `applyRedaction` — when `redact` is
 * false the row is returned as-is; when true the four PII fields below
 * are rewritten in place.
 *
 * Redacted fields and formats (locked by Kevin, Chat #144):
 *
 *   prospectFirstName, prospectLastName  →  first initial + "."  ("Marcus" → "M.")
 *   phone (E.164)                        →  "+<cc> ✱✱✱✱✱✱ <last4>" ("+15551234567" → "+1 ✱✱✱✱✱✱ 4567")
 *   email                                →  first local-char + "✱✱✱" + "@" + domain ("marcus@example.com" → "m✱✱✱@example.com")
 *
 * Fields explicitly KEPT (mentioned to be unambiguous):
 *
 *   city          — granularity is state-level; city alone is not PII
 *   prospectId, tokenId — opaque ids
 *   sponsorBaId, sponsorFullName — BAs are Team Magnificent members,
 *                                  not third-party PII
 *
 * Empty / null / non-string values pass through unchanged. The redactor
 * is intentionally conservative: anything it doesn't recognize as the
 * documented PII shape is returned verbatim so a future field-shape
 * change can't silently leak data.
 */

const MASK = '✱'; // ✱

/** Fields the redactor will rewrite when redact=true. Anything else passes through. */
export const REDACTED_FIELDS = [
  'prospectFirstName',
  'prospectLastName',
  'phone',
  'email',
] as const;
export type RedactedField = (typeof REDACTED_FIELDS)[number];

/**
 * Mask a personal name to its first initial + period ("Marcus" → "M.").
 * Empty / whitespace-only → "—" so the column is never an empty cell that
 * could be mistaken for missing data.
 */
export function maskName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '—'; // em-dash
  const first = trimmed.charAt(0).toUpperCase();
  return `${first}.`;
}

/**
 * Mask an E.164 phone to "+<countryCode> ✱✱✱✱✱✱ <last4>". Falls back to
 * a generic last-4 mask for any string that doesn't parse as E.164 (no
 * leading "+", or fewer than 5 digits total).
 */
export function maskPhone(value: string): string {
  const v = value.trim();
  if (v.length === 0) return v;

  // E.164 form: leading "+", then 1-3 digit country code, then subscriber digits.
  // Total digit count is 8-15 per the spec; we accept >=5 to be tolerant.
  const e164 = /^\+(\d{1,3})(\d{4,})$/.exec(v.replace(/\s+/g, ''));
  if (e164) {
    const cc = e164[1]!;
    const rest = e164[2]!;
    const last4 = rest.slice(-4);
    return `+${cc} ${MASK.repeat(6)} ${last4}`;
  }

  // Fallback: keep last 4 of whatever digits are there.
  const digits = v.replace(/\D/g, '');
  if (digits.length <= 4) return MASK.repeat(4);
  return `${MASK.repeat(6)} ${digits.slice(-4)}`;
}

/**
 * Mask an email to "<first-char>✱✱✱@<domain>". Preserves the domain so
 * aggregate domain breakdowns remain possible. Anything without exactly
 * one "@" or with an empty local part falls back to "✱✱✱✱".
 */
export function maskEmail(value: string): string {
  const v = value.trim();
  if (v.length === 0) return v;
  const at = v.indexOf('@');
  if (at <= 0 || at !== v.lastIndexOf('@')) {
    return MASK.repeat(4);
  }
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  if (local.length === 0 || domain.length === 0) return MASK.repeat(4);
  return `${local.charAt(0)}${MASK.repeat(3)}@${domain}`;
}

/** True if the field name should be rewritten when redact=true. */
export function isRedactedField(field: string): field is RedactedField {
  return (REDACTED_FIELDS as readonly string[]).includes(field);
}

/**
 * Redact a single value for a named field. Non-string values
 * (numbers, nulls, booleans) pass through unchanged — the only fields
 * we redact are name/phone/email and those are always strings.
 */
export function redactField(field: RedactedField, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  switch (field) {
    case 'prospectFirstName':
    case 'prospectLastName':
      return maskName(value);
    case 'phone':
      return maskPhone(value);
    case 'email':
      return maskEmail(value);
  }
}

/**
 * Return a shallow copy of `row` with REDACTED_FIELDS rewritten when
 * `redact` is true. When false the row is returned unchanged (same
 * reference — the caller is the only writer downstream).
 */
export function applyRedaction<T extends Record<string, unknown>>(
  row: T,
  redact: boolean,
): T {
  if (!redact) return row;
  const out: Record<string, unknown> = { ...row };
  for (const field of REDACTED_FIELDS) {
    if (field in out) {
      out[field] = redactField(field, out[field]);
    }
  }
  return out as T;
}
