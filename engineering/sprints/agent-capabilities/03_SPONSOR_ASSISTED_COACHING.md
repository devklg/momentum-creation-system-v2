# Prompt 03 — Sponsor-Assisted Coaching and Three-Way Support

## Mission

Let a BA request human sponsor/upline help with a prospect-list session,
invitation, coaching call, or three-way conversation. Extend the existing
three-way system; do not build AI calling.

## Reuse

- `server/src/domain/threeWayCalls.ts`
- existing three-way routes and `ThreeWayCallWorkspace.tsx`
- immutable sponsorship relationships
- Personal Prospect List and token flow

## Required behavior

- Actions: ask sponsor for help, request upline escalation, prepare call, book,
  cancel, complete, record outcome.
- BA explicitly shares only the context needed for the session.
- Sponsor/upline availability and permissions remain server-authoritative.
- Preparation view shows person, authentic reason, selected lane, approved script,
  token, and clear BA/sponsor roles.
- BA initiates the human call; agents do not dial or speak to prospects.
- Post-call handoff records notes, next BA-owned action, and outcome.

## Acceptance tests

- Only the BA, direct authorized sponsor/upline, and admin can access a session.
- No unrelated prospect/private note leakage.
- Booking cannot alter sponsor genealogy.
- No telephony automation is introduced.
- Existing three-way scheduling tests remain green.

## Deliverables

Extended domain/schema/routes/workspace, permission tests, audit events, and
documentation. Keep training-development language supportive rather than punitive.

