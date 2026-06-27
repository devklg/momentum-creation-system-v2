# Frontend Alignment Audit

Report date: 2026-06-27

Agent: Frontend Alignment Agent

Architecture version: v1.0 frozen

## Scope

This audit reviews the three Vite clients for alignment with frozen app boundaries, runtime MVP needs, compliance constraints, and Sprint 1 planning. It is audit-only.

## Sources Read

- `FOUNDATION_v1.0_FREEZE.md`
- `docs/AGENT-BRIEFING.md`
- `docs/project-wireframe.md`
- `MASTER_UX_IMPLEMENTATION_SPEC.md`
- `apps/com/src/`
- `apps/team/src/`
- `apps/admin/src/`
- `packages/shared/src/brand.ts`
- `packages/shared/src/compliance.ts`
- `packages/shared/src/rules.ts`
- workspace package manifests

## Surface Map

- `apps/com`: prospect-facing `/p/:token`, `/p/login`, dashboard/presentation, RVM token path, and prospect API helpers.
- `apps/team`: BA-facing login/register/welcome/cockpit/CRM/Ivory/invitations/training/profile/preview/Steve/video-library/VM routes.
- `apps/admin`: Kevin-only admin shell with access codes, dashboard, BA/prospect oversight, queue, live ops, reporting, tenant, broadcast, VM, orientation, agents, and audit routes.

## Alignment Findings

1. Three-client architecture is present.
   The app layout matches the frozen boundary: .com prospect, .team BA, admin Kevin-only.

2. The current .team agent surfaces are application-specific, not the full browser runtime shell.
   Existing Ivory, Steve, Michael-adjacent support, and cockpit components are substantial, but Package 001 requires reusable Browser Voice runtime components and agent UI routes that include language selection, transcript, text fallback, and context-packet-backed responses.

3. No dedicated `apps/team/src/runtime/browserVoice/` tree was located.
   Package 001 requires browser voice controller, state machine, hook, events, transcript utilities, errors, and common runtime components.

4. Bilingual runtime UI is not yet visible as a first-class pattern.
   Existing routes are English-first. Package 001 requires English and Spanish templates and runtime operation.

5. Compliance boundaries remain important for .com.
   The current .com tree includes Team Magnificent-only prospect surfaces and compliance-safe copy areas. Sprint 1 should avoid touching .com production surfaces until runtime internal-agent boundaries are separated.

6. Shared type usage is broad but runtime-specific shared exports are missing.
   `packages/shared/src/types.ts` includes current app contracts, including agent recommendation/event types, but Package 001 expects runtime submodules for team scope, context packets, agent events, agent sessions, knowledge, journal, learning, knowledge evolution, and browser voice.

## UX/Compliance Risks

- Internal Browser Voice must live in .team, not .com.
- Ivory drafts must remain editable and BA-owned; no auto-send workflow may be introduced.
- Any .team comp/training content must not bleed to .com.
- Browser microphone permission must be initiated only after BA action.

## Frontend Blockers

- No runtime UI component library exists for Browser Voice/Text fallback.
- No route-level evidence of Spanish runtime mode was found.
- No `context_packet.v1` request/response UI contract is present.

## Recommended Frontend Sequencing

1. Plan shared runtime type exports before UI implementation.
2. Add Browser Voice runtime scaffolding in a future implementation sprint before adapting Steve/Michael/Ivory routes.
3. Keep Package 001 UI under .team internal routes.
4. Add bilingual/language-selector requirements to Sprint 1 acceptance before building UI.
5. Do not alter .com prospect surfaces during platform-alignment Sprint 1 unless a runtime boundary bug is discovered and approved.
