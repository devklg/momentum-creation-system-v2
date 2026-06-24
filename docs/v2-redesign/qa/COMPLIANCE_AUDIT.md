# Task 9 Compliance Audit

Date: 2026-06-11
Branch: task-9-qa-compliance
Scope: Compliance boundary review for the v2 redesign after Tasks 1-8.

## Audit Method

Reviewed source and docs for:

- Prospect-facing `.com` pages and API copy.
- BA-facing `.team` surfaces for PMV, Ivory, Launch Center, welcome, and questionnaire.
- Server routes/domains for token resolution, placement, PMV, CRM, Ivory, ScriptMaker, questionnaire, and alerts.
- Shared type contracts that define compliance boundaries.

Searches included:

- `income|spillover|CV|cycle|rank|placement promise|placement-promise|guarantee|\$|dollar|earnings|commission|qualified|binary`
- `AI lead|lead qualification|qualif|prospect ranking|ranking|automated prospecting|automated calling|auto-send|auto-sending|auto send|system will send|send automatically|automated outreach|score|scoring|rate anyone|rank`
- `Kevin will reach out|will reach out|reach out`
- `prefers-reduced-motion|reduce`

## Prospect-Facing `.com` Findings

Prospect-facing prohibited categories were reviewed with Kevin's clarification that the researched market/cost figures are intentional informational context, not income, placement, or compensation claims.

- No AI lead qualification language found on `.com`.
- No prospect ranking or prospect scoring language found on `.com`.
- No automated prospecting, automated calling, or auto-sending language found on `.com`.
- No spillover, CV, cycle math, rank-advancement, compensation-plan, or placement-promise copy found as prospect-facing claims.
- Prospect follow-up language uses BA/sponsor-specific language, including `{baFirstName} will reach out personally`; no hard-coded `Kevin will reach out` found on `.com`.
- Sourced market/cost figures remain in `.com` as informational category context. They are not presented as earnings, compensation, downline value, placement value, or a personal financial outcome.

Intentional market/context examples retained:

- Presentation market section cites public category data and cost context.
- Prospect dashboard Opportunity section cites market/context data.
- Footer disclaimer states that momentum displays do not guarantee placement, compensation, or earnings outcomes and that market figures are for context.

## BA-Facing `.team` Findings

BA-facing surfaces contain some business, product, qualification, income-goal, CV, cycle, or rank language where the application intentionally trains or interviews Brand Ambassadors. These are not prospect-facing `.com` claims.

Reviewed examples:

- Fast Start training includes compensation/CV/cycle/rank education for BAs.
- Questionnaire asks BA-facing income-goal/readiness questions because the backend contract already requires those sponsor-coaching fields.
- Steve/Michael BA support context is not prospect lead qualification, and Michael scoring/classification has been retired.
- Admin leader/reporting language is admin-only and not prospect-facing.

These are within the documented BA/admin training scope and do not widen prospect-facing claims.

## Token Placement Boundary

Preserved:

- Prospect placement is earned only at `video_complete` through the token route.
- `placeProspect()` uses the token's `sponsorBaId` and is idempotent by `prospectId`.
- The `.com` dashboard remains gated until a placement exists.
- No source reviewed assigns placement during invitation minting, Ivory drafting, PMV display, CRM edits, questionnaire, or Launch Center onboarding.

## CRM Ownership Boundary

Preserved:

- PMV and CRM routes derive BA identity from `req.session.baId`.
- PMV reads filter by `sponsorBaId`.
- CRM writes assert ownership before notes, follow-ups, dispositions, re-invites, edits, and deletes.
- BA-created prospects force sponsor ownership from the session.

## Invitation Spine And Source Tracking

Preserved:

- Ivory mint uses the existing `createInvitation()` spine.
- Ivory-origin invitations are stamped `source: 'ivory'`.
- Relationship reason and BA-edited message are preserved through the spine.
- Send remains a BA manual action; the app does not auto-send.

## Alerts And Follow-Up Language

- `.com` uses sponsor/BA-specific follow-up language.
- Search found one hard-coded `Kevin will reach out` in `apps/team/src/components/michael/AwaitingCall.tsx`, which is BA-facing onboarding/Michael support copy, not prospect-facing `.com` copy.
- Prospect-facing master content default says `{{baFirstName}} will reach out`.

## AI / Automation Boundary

Preserved:

- Ivory Coach asks reflective WDYK prompts; it does not name people, score people, rank people, send, or call.
- Ivory Invitation Agent drafts editable copy only for a BA-selected person.
- PMV next actions are deterministic operational prompts from explicit events and BA-entered CRM facts.
- Re-invite script returns copy only; it does not send.
- No autonomous prospect selection, AI lead qualification, automated prospecting, automated calling, or auto-sending was added in Task 9.

## Conclusion

Task 9 compliance audit found no required code changes.

The `.com` market/cost numbers are retained as intentional, sourced, informational market context per Kevin's direction. They are not treated as income, compensation, placement, spillover, CV, cycle, rank, or dollar-earning claims.
