# P2-143 Live Provider-Key Smoke

P2-143 adds explicit live-environment readiness checks for the two dormant-key
surfaces: Resend email and Anthropic LLM access.

## Safety boundary

- Provider contact requires the operator to pass `--live`.
- Both checks are authenticated `GET` requests only.
- The Resend check lists domains and requires the exact `EMAIL_FROM` domain to
  be verified with sending enabled. It does not create or send an email.
- The Anthropic check retrieves the exact `ANTHROPIC_MODEL`. It does not call
  the Messages API and sends no prompt, transcript, profile, or interview data.
- Output contains status codes and public target identifiers only. It never
  returns credentials or upstream response bodies.
- The runner performs no persistence write, production mutation, or external
  communication.

Provider contracts: [Resend List Domains](https://resend.com/docs/api-reference/domains/list-domains)
and [Anthropic Get a Model](https://platform.claude.com/docs/en/api/models/retrieve).

## Commands

Run both metadata checks in the intended live environment:

```powershell
pnpm --filter @momentum/server smoke:provider-keys -- --live
```

Run one provider:

```powershell
pnpm --filter @momentum/server smoke:provider-keys -- --live --provider=email
pnpm --filter @momentum/server smoke:provider-keys -- --live --provider=llm
```

Without `--live`, the runner refuses provider contact and exits non-zero.

## Pass conditions

- `email`: the API key authenticates, the exact `EMAIL_FROM` domain exists,
  and its Resend status/capability prove sending readiness.
- `llm`: the API key authenticates and the configured `ANTHROPIC_MODEL` can be
  retrieved for the account.

Passing these checks proves key/domain/model readiness. It does not authorize a
live email send, provider activation, or transfer of BA/interview data.
