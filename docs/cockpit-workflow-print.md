# Team Magnificent Cockpit Workflow

Print companion for `docs/cockpit-workflow-print.html`.

## Saved Screens

- `docs/screenshots/team-cockpit-crm-notes-preview.png` - cockpit invite row expanded to CRM notes, disposition, follow-up, and re-invite.
- `docs/screenshots/team-cockpit-track-record-preview.png` - cockpit track record section.

## Kevin's Notes From The Cockpit

1. Script generation should serve the new BA, not only create a link. The agent should ask key questions about the prospect and the BA's context, then create the invitation for the BA.
2. CRM is useful and should become a separate tab or tool inside the app with CRUD capabilities.

## Current Cockpit Workflow

```mermaid
flowchart TD
  Login["/login or /register"] --> Cockpit["/cockpit"]
  Cockpit --> Counts["Counts strip: invited, sent, watched, callbacks, enrolled"]
  Cockpit --> Actions["Today's Actions: callbacks, due follow-ups, expiring windows"]
  Actions --> InviteRow["Jump to invite row"]
  Cockpit --> Track["Track Record: invitations generated, sent, watched, joining you, weekly chart"]
  Cockpit --> Invites["My Invites list"]
  Invites --> Details["Expand prospect row"]
  Details --> Link["Their link + copy"]
  Details --> Message["Saved message + source"]
  Details --> Activity["Activity timeline"]
  Details --> Sent["I sent this"]
  Details --> CRM["Inline CRM panel"]
  CRM --> Tags["Where this stands tags"]
  CRM --> Followup["Follow-up reminder"]
  CRM --> Notes["Private notes"]
  CRM --> Reinvite["Re-invite + re-invite script"]
  CRM --> Edit["Edit details"]
  CRM --> Delete["Remove prospect"]
  Cockpit --> Sponsor["My Sponsor card"]
  Cockpit --> Orientation["New-member orientation scheduler"]
  Cockpit --> Leadership["Leadership card -> /leadership"]
  Cockpit --> InviteCTA["Invite someone -> /invitations"]
```

## Invitation And Prospect Workflow

```mermaid
flowchart TD
  Source["Entry source"] --> Manual["/invitations self-written message"]
  Source --> ScriptMaker["/video-library ScriptMaker draft"]
  Source --> Ivory["/ivory relationship engine"]
  Manual --> Mint["POST /api/invitations"]
  ScriptMaker --> Draft["POST /api/scriptmaker/draft"]
  Draft --> Mint
  Ivory --> Mint
  Mint --> LinkReady["Link Ready: copy link, mark sent, invite someone else"]
  LinkReady --> Prospect["Prospect opens /p/:token"]
  Prospect --> Watch["Video events"]
  Prospect --> Callback["Callback request"]
  Watch --> CockpitUpdate["Cockpit status and activity update"]
  Callback --> TodaysActions["Today's Actions callback item"]
  LinkReady --> Sent["POST /api/invitations/:prospectId/sent"]
  Sent --> CockpitUpdate
```

## Recommended Next Shape

```mermaid
flowchart LR
  Cockpit["/cockpit home"] --> CRMTab["/crm tab or cockpit tab"]
  CRMTab --> Table["Prospect table: search, filters, status, due date"]
  CRMTab --> Detail["Prospect detail drawer/page"]
  Detail --> CRUD["Create, read, update, delete"]
  Detail --> Notes["Notes"]
  Detail --> Followups["Follow-ups"]
  Detail --> Scripts["Invite/re-invite scripts"]
  Scripts --> Questions["Agent asks prospect + BA context questions"]
  Questions --> Draft["Agent creates invitation"]
  Draft --> Mint["Send to /invitations for BA approval + link mint"]
```

## API Surfaces Behind The Cockpit

- `GET /api/cockpit/summary`
- `GET /api/cockpit/invites`
- `GET /api/cockpit/todays-actions`
- `POST /api/invitations`
- `POST /api/invitations/:prospectId/sent`
- `GET /api/crm/:prospectId`
- `POST /api/crm/:prospectId/notes`
- `POST /api/crm/:prospectId/followup`
- `DELETE /api/crm/:prospectId/followup`
- `POST /api/crm/:prospectId/disposition`
- `POST /api/crm/:prospectId/reinvite`
- `POST /api/crm/:prospectId/reinvite-script`
- `PUT /api/crm/:prospectId`
- `DELETE /api/crm/:prospectId`
- `POST /api/scriptmaker/draft`
- `GET /api/orientation/sessions`
- `POST /api/orientation/sessions/:id/reserve`
- `DELETE /api/orientation/sessions/:id/reserve`

