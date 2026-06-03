# Ivory Invitation Agent Review

## 1. Current Workflow

Ivory currently behaves as three adjacent tools rather than one invitation agent.

1. `/ivory#roster` stores a BA-private warm-market list. A BA can add/edit first name, last name, categories, preferred angle, private notes, and disposition.
2. `/ivory#coach` asks the BA to choose an angle, optionally choose a product anchor, enter what is stuck, and receive "who do you know" prompts. The coach deliberately returns questions only; it does not select a person or write the invitation.
3. `/ivory#generator` asks the BA to pick a product, pick an angle, multi-select roster names, start a generator run, optionally write one shared invitation message, and mint `/p/{token}` links one name at a time.
4. `server/src/domain/generator.ts` creates a `generator_runs` record, then calls `createInvitation()` with `source: 'ivory'` for each selected Ivory name.
5. `server/src/domain/invitations.ts` creates the actual prospect record, invite token, prospect account, and `/p/{token}` link. It stores `message` and `source` on the prospect document.
6. `/invitations` is the stronger invitation spine UI. It supports seeded agent entry, message review, minting, copy message + link, "I sent this", and cockpit return. Current Ivory generator does not route through that screen.
7. `server/src/domain/crm.ts` assumes a prospect already exists. Notes, follow-ups, dispositions, re-invites, and Today's Actions attach after the invitation spine creates the prospect.

## 2. Why It Misses The Business Process

The current Ivory shape is product-first and run-based. The BA begins by choosing product/angle mechanics, then selects names from a roster. That is backwards for the intended business process.

The real workflow starts with relationship memory: "Who do you know?" and "Why did they come to mind?" The current system captures categories and notes, but it does not make the reason-for-this-person the central artifact that drives the message.

The generator message is shared across a run, so it cannot be deeply personal. A message for a cousin who asked about energy, a church friend who mentioned weight, and a former coworker looking for something different should not start from the same product-run text.

The coach is intentionally prompt-only. That protects compliance, but it also means the AI stops before the business action. Ivory should not stop at brainstorming; it should carry the BA from memory to message to CRM record to tokenized link to send screen.

Ivory also bypasses the best existing invitation UI. The `/invitations` minted view already has the right "copy message + link" and "I sent this" behavior. The generator instead shows a run list with individual links and no full send screen.

There is also a data mismatch. Ivory roster records only name/category/angle/notes/status. The invitation spine needs phone, city, and state; the generator fills city/state with placeholder dashes and phone/email as null unless provided. That weakens CRM quality and prospect account re-entry.

## 3. Recommended Workflow

Redesign Ivory as the Team Magnificent Invitation Agent, with one linear state machine:

1. **Who do you know?**
   Show relationship-memory prompts and a lightweight name capture surface. The first action is naming a person, not picking a product.

2. **Select person**
   The BA selects an existing Ivory/CRM person or creates a new person inline. The person record should include at least name, phone, city, state, relationship context, and private notes.

3. **Why did they come to mind?**
   Capture the relationship reason as a required prompt before AI drafting. Examples: what they said, what they are facing, how the BA knows them, why now, and what kind of opening would feel natural.

4. **AI writes invitation**
   Ivory drafts one personal, compliance-clean invitation for that one person. The output is editable by the BA and must not send anything.

5. **Create BA CRM record**
   Promote or merge the selected person into the BA's prospect CRM record before or during mint. Preserve the Ivory origin and relationship reason.

6. **Mint tokenized link**
   Use the existing invitation spine to create the prospect, token, prospect account, and `/p/{token}` link.

7. **Insert link into message**
   Combine the reviewed AI draft with the minted link into one send-ready text block.

8. **Show copy/send screen**
   Reuse or mirror `/invitations` minted behavior: copy link, copy message + link, "I sent this", invite another, and back to cockpit.

9. **Prospect appears in Prospect Momentum Viewer**
   The newly minted prospect should appear immediately in the BA's prospect/cockpit pipeline with source `ivory`, relationship reason, saved message, token, sent state, and CRM actions.

## 4. Required UI Changes

`apps/team/src/routes/ivory.tsx`

- Replace the three-tab mental model (`Roster`, `Coach`, `Generator`) with an Invitation Agent flow.
- Keep roster/search as supporting infrastructure, not the main concept.
- Remove "Generator" language from the user-facing flow.
- Make the primary CTA "Who came to mind?" or "Start an invitation".
- Add a person-selection step that supports existing roster/CRM search and inline creation.
- Add a required "Why did they come to mind?" step before drafting.
- Add person-detail fields needed by the invitation spine: phone, city, state/region, optional email.
- Add an AI draft step that displays the generated message in an editable textarea.
- Add a final review/send screen that shows the message with the tokenized link inserted.
- Add "I sent this" from the Ivory completion screen, not only from cockpit or `/invitations`.
- Preserve compliance copy: the BA sends from their own phone; the system does not auto-send.

`apps/team/src/routes/invitations.tsx`

- Keep this as the shared invitation spine, but make the seeded-agent path first-class.
- Accept richer Ivory seed state: prospect identity, phone/location, relationship reason, drafted message, source `ivory`, and optional existing `ivoryId`.
- Ensure the agent-prepared banner says this came from the Invitation Agent, not a generic generator.
- Consider extracting the minted copy/send view into a reusable component so Ivory can finish in-place without duplicating behavior.

## 5. Required Backend Changes

`server/src/domain/ivory.ts`

- Evolve `IvoryName` from a roster-only record into a relationship/person record.
- Add fields for phone, email, city, stateOrRegion, country, relationship type, relationship reason, last drafted message, last invitation source, and linked prospect IDs.
- Add a domain function for drafting an invitation from relationship context. This should be separate from the current coach prompt function.
- Keep coach prompts available as a memory-surfacing helper, but make the action path draft-and-invite.
- Persist durable Ivory events for: person surfaced, reason captured, draft generated, draft accepted/edited, invitation minted, message copied/sent.

`server/src/domain/generator.ts`

- Retire or narrow this module. The run-based generator should not be the primary Ivory path.
- If kept for historical compatibility, treat it as a legacy batch-product workflow and do not let it define the new Invitation Agent model.
- Stop using placeholder city/state defaults for Ivory mints. The new flow should collect real CRM fields before mint.

`server/src/routes/ivory.ts`

- Add endpoints for the agent flow:
  - `POST /api/ivory/people` or reuse `POST /api/ivory` with expanded person fields.
  - `POST /api/ivory/draft` to generate one message for one selected person and reason.
  - `POST /api/ivory/invite` to create/merge CRM prospect, mint token, store source/reason/message, and return send-ready text.
  - Optional `POST /api/ivory/:ivoryId/reason` to save why this person came to mind before drafting.
- Keep all routes BA-scoped from session `baId`.
- Validate message/reason lengths and compliance-safe source values.

`server/src/domain/invitations.ts`

- Preserve `createInvitation()` as the token/prospect spine.
- Extend stored prospect metadata for Ivory origin: `ivoryId`, `relationshipReason`, `draftedBy: 'ivory'`, and possibly `draftEditedByBa`.
- Ensure Chroma metadata includes `source: 'ivory'`, relationship reason, and person context for later comparison/reporting.
- Ensure invitation activity includes a minted-from-Ivory event, not only sent/video events.

`server/src/domain/crm.ts`

- Add or expose a BA-scoped create/merge path that Ivory can call before minting.
- Support an initial CRM note from the relationship reason.
- Support initial follow-up/disposition defaults after mint if needed.
- Make Prospect Momentum Viewer reads include Ivory-origin context.

## 6. CRM Integration Requirements

- The selected person must become a BA-owned prospect CRM record when the invitation is minted.
- If an Ivory person already has a linked prospect, the system should merge/update that prospect rather than creating duplicate records.
- CRM identity fields must be real, not placeholders: first name, last name, phone, city, state/region, country, optional email.
- Store `ivoryId` on the prospect record and create the graph edge `(:IvoryName)-[:INVITED_AS]->(:Prospect)`.
- Store the "why they came to mind" answer as a CRM note and/or first-class prospect metadata.
- The Prospect Momentum Viewer should show the prospect immediately after mint with source `ivory`, status `draft` or `sent`, saved message, link, and activity timeline.
- "I sent this" should set `sentAt` and append the existing `invitation_sent` activity entry.
- CRM follow-up actions should be available from the resulting prospect row without requiring a separate manual lookup.

## 7. Invitation Message Requirements

- The message must be written for one person at a time.
- The draft must be based primarily on relationship reason, not product angle.
- Product can be optional context, but it should not lead the flow.
- The message must be short enough to text naturally from the BA's own phone.
- It must include no income claims, compensation language, cycle/rank/placement math, medical claims, guarantees, urgency, scarcity, guilt, or AI-prospecting tone.
- It should sound like the BA thought of the person specifically.
- It should invite the prospect to watch and respond, not pressure them to buy or join.
- The BA must be able to edit before mint/send.
- The final copy block should insert the `/p/{token}` link cleanly after the message.
- Store both the generated draft and the final BA-edited message if comparison matters later.

## 8. Files To Modify

Primary files:

- `apps/team/src/routes/ivory.tsx`
- `apps/team/src/routes/invitations.tsx`
- `server/src/domain/ivory.ts`
- `server/src/routes/ivory.ts`
- `server/src/domain/invitations.ts`
- `server/src/domain/crm.ts`

Likely supporting files:

- `server/src/domain/generator.ts` for deprecation, compatibility, or removal from the main Ivory path.
- `packages/shared/src/types.ts` for expanded Ivory/person/draft/invite wire contracts.
- `apps/team/src/routes/cockpit.tsx` if Prospect Momentum Viewer context needs new Ivory fields.
- Any CRM route file that exposes `server/src/domain/crm.ts` actions to the team app.

Net recommendation: Ivory should no longer be framed as "Roster + Coach + Generator." It should be framed as "Invitation Agent": a relationship-first workflow that helps the BA remember one person, articulate why that person matters, draft a personal invitation, mint the tracked link, and move the prospect directly into the momentum viewer.
