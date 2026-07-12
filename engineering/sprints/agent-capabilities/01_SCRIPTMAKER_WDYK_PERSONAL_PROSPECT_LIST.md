# Prompt 01 — ScriptMaker Who Do You Know + Personal Prospect List

## Mission

Implement ScriptMaker’s guided product/opportunity/both Who Do You Know game and
a private BA-authored Personal Prospect List. ScriptMaker helps memory; it never
scrapes contacts, qualifies people, or decides who should be approached.

## Reuse

- `server/src/domain/ivory.ts` roster CRUD and existing Ivory collections
- `server/src/routes/ivory.ts`
- `apps/team/src/routes/ivory.tsx`
- `server/src/domain/scriptmaker.ts`
- `packages/shared/src/agent-skills.ts`

Reconcile ownership without duplicating data: migrate/rename only with an
approved decision. Prefer a shared personal-prospect domain that Ivory and
ScriptMaker both consume while preserving existing Ivory API compatibility.

## Required behavior

- Start with product, opportunity, or both.
- Ask one approved contextual prompt at a time.
- Capture only a person the BA identifies and the authentic reason they came to mind.
- Store relationship, context lane, approved topic, status, private notes, and timestamps.
- Support private thinking prompts; never copy hypothetical income numbers into invitations.
- Provide list/search/detail/update/archive with sponsor sharing off by default.
- Emit traceable `personal_prospect.*` and `scriptmaker.wdyk.*` events.

## Acceptance tests

- Ownership is forced from the authenticated BA.
- No request can inject sponsor identity, score, rank, qualification, or prediction.
- Duplicate names are surfaced for BA review, not silently merged.
- Missing model/knowledge returns deterministic prompts and does not invent names.
- Existing Ivory roster and invitation tests remain green.

## Deliverables

Domain, shared types, authenticated routes, `.team` UI, migration/compatibility
note, tests, and registry status update for the implemented WDYK portion.

