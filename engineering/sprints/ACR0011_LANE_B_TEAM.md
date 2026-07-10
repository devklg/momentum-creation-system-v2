# ACR-0011 — LANE B: Team App (launch checklist dashboard + sponsor attestation UI)

You are an autonomous implementation agent in a dedicated git worktree of Momentum Creation System V2. Your branch: `feat/acr0011-team`. Base: `origin/main` AFTER the Lane 0 shared-foundation PR is merged — `packages/shared` contains the recruiting-cycle types, LOCKED constants, and the API contract types for `GET /recruiting-cycle/me` and `POST /recruiting-cycle/:tmagId/attest`. Build against those contract types; the server lane implements them in parallel — use the typed contract, not guesses.

Read FIRST: `organization/ACR-0011-five-point-recruiting-cycle.md` (§2.8 is your surface), `ACR0011_MASTER_BRIEF.md` (worktree root — you own its task 7), and the existing launch-rail/cockpit components in `apps/team/src/components/`.

## Your scope

1. **Launch checklist dashboard** (new-BA home surface, following the existing launch-rail/cockpit patterns and the Team Magnificent design system — do NOT invent new design tokens): the 5 Point cycle with live state — names progress (x/100, tranche y/5), current step with that step's daily actions, 48h five-step and 72h QBA countdown chips, the BA's why pinned, Michael's latest coaching touch, step-attached resources. **Countdown copy is supportive momentum framing — never failure/shame language** (ratified as written; Launch/Fast Start philosophy binds tone). Handle pre-Steve state (no cycle yet) and post-launch state gracefully.
2. **Sponsor view + attestation UI**: sponsor sees the recruiting-cycle status of their enrollees and pending attestations; attest left leg / right leg / CORE 3 via the contract's POST. Confirmation before submit; render server rejection (non-sponsor) cleanly.
3. **Component tests** matching the app's existing test approach, plus typecheck.

## Hard constraints

No server code, no shared type redefinition (import from `@momentum/shared`), no ratified-doc edits, no `.com` changes, no new design system. Mock the API at the typed contract boundary for tests/dev if the server lane hasn't landed. `pnpm install` first if needed. No time estimates.

## Close (required)

- `pnpm --filter @momentum/team typecheck` green; team tests green.
- Commit, `git push -u origin feat/acr0011-team`, `gh pr create --base main`. DO NOT merge.
- Final line: `LANEB COMPLETE PR:<number>` (or `LANEB FAILED: <reason>`).
