# Prompt 02 — ScriptMaker Personalized Invitation + Token

## Mission

Complete the selected-person flow: capture why the person came to mind, generate
an editable compliant script, create the prospect through the existing invitation
spine, mint the immutable-sponsor token, and return script plus tokenized link to
the BA. Never send automatically.

## Reuse

- `server/src/domain/scriptmaker.ts` and generated-copy compliance
- `server/src/domain/invitations.ts`
- `server/src/routes/invitations.ts` and `server/src/routes/scriptmaker.ts`
- existing invitation UI and `source='scriptmaker'`
- Personal Prospect List from Prompt 01

## Required transaction

1. Load an owned Personal Prospect entry.
2. Generate draft from product/opportunity/both and authentic reason.
3. Run the shared generated-copy compliance gate.
4. Return draft for BA review/edit.
5. On explicit BA approval, call the existing invitation mint domain.
6. Bind sponsor from session, never request body.
7. Link prospect/token back to the Personal Prospect entry.
8. Return message, prospect ID, token, and invite URL.

## Acceptance tests

- No mint occurs during brainstorming or draft generation.
- Approval is required; automatic send/call is structurally absent.
- Private financial thinking prompts never appear in generated copy.
- Retry/idempotency cannot create duplicate prospects/tokens.
- Sponsor injection is rejected and immutable binding is proven.
- Failure linking the list entry is reported/reconciled without corrupting mint truth.

## Deliverables

Domain orchestration, routes, UI states, audit/events, tests, documentation, and
activation of the two planned ScriptMaker WDYK templates only when fully proven.

