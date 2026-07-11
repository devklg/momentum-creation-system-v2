# LANE 1 - P0 Michael Runtime Contract

Final signal: `LANE1 COMPLETE PR:<number>` or `LANE1 FAILED: <reason>`

## Owned P0 Items

- 1. Resolve the Michael runtime contract decision: degraded `safe_fallback` versus `next_training_step` for server-owned turns.
- 2. Update either the Michael implementation or the tests so the contract is explicit and no longer drifted.
- 3. Add regression coverage for empty body, explicit English, and explicit Spanish Michael runtime requests.
- 4. Rerun the full server Vitest suite until the Michael runtime failure cluster is green.

## Dependency

Start after Lane 0 has merged. Rebase onto `origin/main` before editing.

## Required Reads

- `AGENT_ARCHITECTURE.md`
- `AGENT_PROMPT_GOVERNANCE.md`
- Michael runtime reports under `engineering/reports/` that mention `safe_fallback`, `next_training_step`, runtime adapter contract, or activation boundary.
- Relevant server route/domain/test files discovered by `rg "safe_fallback|next_training_step|Michael runtime|michael" server`.

## Decision Rule

If existing docs/architecture already state the active contract, implement that. If the active contract is genuinely undecidable from current sources, do not improvise. Document the conflict in the active P0 tracker and return `LANE1 FAILED: Michael runtime contract requires Kevin decision`.

## Guardrails

- Michael does not score, classify, rank, qualify, pressure, or prospect.
- Steve owns Discovery and Success Profile. Michael is Training Agent / Daily Success Coach.
- Keep English and Spanish parity.
- Do not enable GraphRAG or Context Manager live flags.

## Verification

Required:

```powershell
pnpm --filter @momentum/server test
```

Also run server typecheck if implementation files changed:

```powershell
pnpm --filter @momentum/server typecheck
```
