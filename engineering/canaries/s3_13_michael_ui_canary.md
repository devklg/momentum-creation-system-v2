# S3.13 — Michael Runtime UI Canary (Local-Only Operator Guide)

**Sprint 3 · S3.13 · Agent C · Documentation only.**

A hand-run, local-only smoke check that the Michael runtime UI path
(`POST /api/michael-runtime/resolve`, consumed by the cockpit
`MichaelRuntimeSupportCard`) behaves at a **high level** when its kill-switch
flags are enabled **locally**. This is an operator aid, not a script.

> Repo convention note: this repo runs engineering checks as Node `.cjs`/`.mjs`
> and pnpm scripts (and `apps/team` uses inline `fetch`), **not** `.sh`. So this
> canary is a Markdown operator guide with copy-paste `curl`, not a shell script.

---

## What this is NOT — read first

- **NOT for production.** Local dev only. Never point at a deployed host.
- **No deployment automation. No CI. No CI secret requirements.** Nothing here
  belongs in a pipeline; there are no secrets to register anywhere.
- **No hardcoded cookies, BA IDs, tokens, or secrets.** The operator supplies a
  controlled local auth cookie and host **manually**, at the terminal, every
  time. Nothing sensitive is committed.
- **No output files by default. No evidence persistence.** Do not redirect
  responses to disk, do not log cookies, and do not paste full response bodies
  (they can carry internals) into any tracked artifact.
- **Not a forbidden-input canary.** Body-BA / forbidden-field rejection is
  **S3.12's** domain — do not duplicate it here. See
  [`../reports/S3_12_BODY_BA_REJECTION_CONTROLLED_CANARY_CHECKLIST.md`](../reports/S3_12_BODY_BA_REJECTION_CONTROLLED_CANARY_CHECKLIST.md).

---

## Preconditions (operator sets these, locally, by hand)

The route is `.team`-only and gated by `requireAuth` + `requireSteveComplete`,
and is fail-closed behind three independent **default-off** env flags
(`server/src/config/michaelRuntimeFlags.ts` — only the exact string `"true"`
enables an axis; flags are read at call time):

| Axis | Env var | Effect when `=true` |
|---|---|---|
| Route | `MICHAEL_RUNTIME_ROUTE_ENABLED` | route does work (else `503 michael_runtime_disabled`) |
| Response | `MICHAEL_RUNTIME_RESPONSE_ENABLED` | a resolved body may return (else `503 michael_runtime_response_disabled`) |
| Trace | `MICHAEL_RUNTIME_TRACE_ENABLED` | redacted trace included on success (**leave OFF** for this canary) |

To exercise a 200 you must enable **route + response locally** in your `.env`
(default-off in code; never enable in production), then restart the server.
**Leave the trace flag OFF** — this canary never wants trace output.

Supply these two values yourself in your shell — **never commit them**:

```bash
# Operator-supplied, local-only. Do NOT echo these into any tracked file.
export MCS_LOCAL_HOST="http://localhost:7700"   # your local server only
export MCS_LOCAL_COOKIE="<paste your controlled local session cookie here>"
```

The cookie is a real, controlled local BA session you obtained by logging into
your local `.team` dev app. It is a secret: keep it in your shell only, never in
git, chat, or a file.

---

## Safe payloads — the ONLY three this canary sends

The server owns the runtime turn. The accepted body is `{}` or
`{ "language": "en" | "es" }` and nothing else. This canary sends exactly:

1. `{}`
2. `{ "language": "en" }`
3. `{ "language": "es" }`

(Any other field, or a bad `language`, is an S3.12 concern — not exercised here.)

---

## How to read the result — HIGH-LEVEL ONLY

Confirm only these, and **only** these:

- **HTTP status** (e.g. `200`, or `503` when a flag is off).
- **`ok`** boolean.
- **`response.responseType`** — one of `next_training_step`,
  `clarification_question`, `safe_fallback`, `safe_close`.
- **`catalogKey`** — only if you judge it safe to display; otherwise skip it.

**Do NOT** dump or persist: `trace`, the Context Packet / `contextPacketId`,
`sessionId` / `turnId` / `correlationId`, `selectionRequest`, the `nextStep`
boolean flags, BA IDs, or the full `response` text. Do not `tee`/redirect to a
file. Do not log the cookie. Keep eyes on status + a couple of safe fields.

The `jq` filters below extract **only** the safe high-level fields, so the raw
internal-bearing body never lands in your scrollback or on disk.

---

## The checks

> `-s` silent, `-o` discards nothing to disk; we pipe through `jq` to a tiny safe
> projection. `-w` prints just the status line. No `-v`, no body dump, no `>file`.

### Check 1 — empty body `{}`

```bash
curl -s -X POST "$MCS_LOCAL_HOST/api/michael-runtime/resolve" \
  -H "Content-Type: application/json" \
  -H "Cookie: $MCS_LOCAL_COOKIE" \
  -d '{}' \
  -w '\nHTTP %{http_code}\n' \
  | jq '{ ok: .ok, responseType: .response.responseType, catalogKey: .catalogKey }'
```

### Check 2 — `{ "language": "en" }`

```bash
curl -s -X POST "$MCS_LOCAL_HOST/api/michael-runtime/resolve" \
  -H "Content-Type: application/json" \
  -H "Cookie: $MCS_LOCAL_COOKIE" \
  -d '{ "language": "en" }' \
  -w '\nHTTP %{http_code}\n' \
  | jq '{ ok: .ok, responseType: .response.responseType, catalogKey: .catalogKey }'
```

### Check 3 — `{ "language": "es" }`

```bash
curl -s -X POST "$MCS_LOCAL_HOST/api/michael-runtime/resolve" \
  -H "Content-Type: application/json" \
  -H "Cookie: $MCS_LOCAL_COOKIE" \
  -d '{ "language": "es" }' \
  -w '\nHTTP %{http_code}\n' \
  | jq '{ ok: .ok, responseType: .response.responseType, catalogKey: .catalogKey }'
```

> If you don't have `jq`, just read the `HTTP %{http_code}` line and skip the
> body — do **not** print the raw body to inspect it by eye.

### Expected (flags on, locally)

- `HTTP 200`, `ok: true`, and a `responseType` from the set above. With the
  degraded fixture path, `safe_fallback` is a normal, healthy result.
- The cockpit card (`MichaelRuntimeSupportCard`) renders the matching calm
  state. It reads only the safe subset (text / responseType / language /
  nextStep display strings) and never the trace or IDs — so a healthy 200 here
  means the card has a healthy source.

### Expected (flags off — the default)

- Route flag off → `HTTP 503`, `{ ok: false, reason: "michael_runtime_disabled" }`
  → card shows the calm "Not available yet" state.
- Route on, response off → `HTTP 503`,
  `{ ok: false, reason: "michael_runtime_response_disabled" }` → card shows the
  "training guidance is paused" state.

---

## Rollback / restore default-off (do this when finished)

The safe resting state is **all flags off**. To roll back your local enablement:

1. In your local `.env`, unset (or remove) `MICHAEL_RUNTIME_ROUTE_ENABLED` and
   `MICHAEL_RUNTIME_RESPONSE_ENABLED` (and `MICHAEL_RUNTIME_TRACE_ENABLED` if you
   ever touched it). Anything other than the exact string `"true"` is off.
2. Restart the local server so the new env is picked up.
3. Re-run **Check 1** and confirm you now get
   `HTTP 503` with `{ ok: false, reason: "michael_runtime_disabled" }`.

That 503 confirms the kill switch is back to fail-closed default. Then clear your
shell session: `unset MCS_LOCAL_COOKIE MCS_LOCAL_HOST`.

---

## Operator hygiene checklist

- [ ] Host + cookie supplied **manually** this session; neither committed.
- [ ] Only `{}`, `{ "language": "en" }`, `{ "language": "es" }` sent.
- [ ] Only status / `ok` / `responseType` / (optional) `catalogKey` inspected.
- [ ] No `trace`, Context Packet, IDs, or full bodies printed or saved.
- [ ] No files written; no evidence persisted; no CI/secret wiring touched.
- [ ] Flags returned to default-off, server restarted, 503 reconfirmed.
- [ ] Forbidden-input behavior left to S3.12's checklist (not run here).
