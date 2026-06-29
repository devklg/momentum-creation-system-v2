/**
 * S3.4 — Michael runtime route feature flags (three-axis kill switch).
 *
 * Three INDEPENDENT, default-OFF, env-driven, fail-closed axes. Only the exact
 * string "true" enables an axis; anything else — missing, empty, "TRUE",
 * "false", or any malformed value — leaves the axis disabled. Flags are read at
 * call time (not memoized at import) so a deploy-time env change takes effect
 * without code change, and so the value can never be sourced from a request
 * body, query param, header, or database. Never hardcoded enabled.
 */

function flagEnabled(name: string): boolean {
  return process.env[name] === 'true';
}

/** Axis 1 — whether the route does any work at all (else fail-closed 503). */
export function michaelRuntimeRouteEnabled(): boolean {
  return flagEnabled('MICHAEL_RUNTIME_ROUTE_ENABLED');
}

/** Axis 2 — whether a resolved response body may be returned. */
export function michaelRuntimeResponseEnabled(): boolean {
  return flagEnabled('MICHAEL_RUNTIME_RESPONSE_ENABLED');
}

/** Axis 3 — whether the redacted trace may be included in a success response. */
export function michaelRuntimeTraceEnabled(): boolean {
  return flagEnabled('MICHAEL_RUNTIME_TRACE_ENABLED');
}
