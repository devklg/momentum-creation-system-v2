# Prompt 06 — Daily Success Coach Three-Action Model

## Mission

Extend the existing cockpit Today’s Actions into a Michael-owned Daily Success
Coach capability that returns up to three useful, explainable, BA-owned actions
from leadership guidance and current state.

## Reuse

- `getCockpitTodaysActions` and `TodaysActions.tsx`
- Steve Success Profile
- Michael training support
- training progress
- Personal Prospect List and ScriptMaker state
- PMV/CRM/follow-up signals
- sponsor-assisted coaching requests

## Action lanes

Prefer a balanced set when evidence exists:

1. learning/product/training
2. relationship/community/team-development
3. personal prospect/share/follow-up

Return fewer than three when evidence does not support three. Leadership-owned
Fast Start, Momentum Level, and Solid 3-Star activity targets may guide selection
but are never converted into outcome guarantees.

## Required output

Each action includes ID, lane, title, reason, evidence references, CTA/route,
human owner, expiry, completion signal, and template/version provenance.

## Acceptance tests

- Deterministic priority and stable ordering.
- No invented actions when context is missing.
- No pressure, shame, scoring, income projection, or rank guarantee.
- BA/sponsor completion is explicit; agent never completes an action automatically.
- Existing callbacks/follow-ups/expiry behavior remains represented.
- Acceptance/dismissal/completion outcomes are traceable.

## Deliverables

Shared contract, domain projection, route/UI evolution, event/outcome persistence,
tests, docs, and activation of the governed Daily Success template after proof.

