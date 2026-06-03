# Implementation Tasks

Project: `momentum-creation-system-v2`

Purpose: split `MASTER_UX_IMPLEMENTATION_SPEC.md` into serial Codex tasks for
the v2 redesign. These tasks must run in order. Do not skip the safety audit.

Global rules for every task:

- Work only in `momentum-creation-system-v2`.
- Do not modify `momentum-creation-system-v1`.
- Keep v1 as the stable completed version.
- Preserve token placement, CRM ownership, invitation spine, source tracking,
  and compliance boundaries.
- Do not add AI lead qualification, automated prospecting, automated calling, or
  auto-sending.
- Do not place income, spillover, CV, cycle, rank, placement, or dollar claims
  on prospect-facing pages.
- Run the listed commands before reporting completion.

## 1. Safety Audit

### Goal

Map the current token, video, placement, invitation, CRM, and brand contracts
before any redesign implementation begins. Produce findings only unless a
verified blocker prevents later work.

### Files Allowed To Modify

- `docs/v2-redesign/audits/SAFETY_AUDIT.md`
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- `apps/**`
- `server/**`
- `packages/**`
- `assets/**`
- `.env*`
- `pnpm-lock.yaml`
- Any v1 files

### Acceptance Criteria

- Audit documents token resolution and click/video progress flow.
- Audit documents placement creation and dashboard gating.
- Audit documents cockpit/PMV projection gaps.
- Audit documents invitation source behavior for `self`, `ivory`, and
  `scriptmaker`.
- Audit documents CRM BA ownership checks.
- Audit documents current logo assets and CSS/Tailwind entry points.
- No application code changed.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
git status --short --branch
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- Git status shows only audit/checkpoint documentation changes.
- Report lists verified risks and exact next-task recommendations.

## 2. Shared Brand/Motion Primitives

### Goal

Create shared Team Magnificent brand, logo, motion, status, countdown, ticker,
counter, and progress primitives that later pages can reuse.

### Files Allowed To Modify

- `packages/shared/src/brand.ts`
- `packages/shared/src/brand.css`
- `packages/shared/src/types.ts`
- `apps/com/src/main.css`
- `apps/team/src/main.css`
- `apps/com/tailwind.config.ts`
- `apps/team/tailwind.config.ts`
- New shared brand/component files if the repo pattern supports them
- `MASTER_UX_IMPLEMENTATION_SPEC.md`
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- `server/**`
- `apps/com/src/routes/**`
- `apps/team/src/routes/**`
- `apps/team/src/components/cockpit/**`
- `assets/**`
- `.env*`
- `pnpm-lock.yaml` unless a package install is explicitly approved
- Any v1 files

### Acceptance Criteria

- Real logo asset usage is centralized or clearly documented.
- Gold is identity/ceremony; teal is live state/action/progress.
- Reduced-motion behavior is respected.
- Shared primitives are layout-stable on mobile and desktop.
- No feature page redesign is implemented yet.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- Report names the primitives created and where future tasks should import them.

## 3. Prospect Position & Momentum Center

### Goal

Refactor the prospect dashboard first viewport into a live Position & Momentum
Center while preserving all existing business content below it.

### Files Allowed To Modify

- `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/00-Ribbon.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/01-Arrival.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/02-Opportunity.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/06-YourNextMove.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/07-Footer.tsx`
- New dashboard component files under `apps/com/src/routes/tm-prospect-dashboard/`
- `apps/com/src/lib/usePlacementStream.ts` only for UX-derived display helpers
- `apps/com/src/lib/api.ts` only if a verified display need exists
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- `server/**`
- `apps/team/**`
- `packages/shared/**` except imports of primitives created by Task 2
- `assets/**`
- `.env*`
- Any v1 files

### Acceptance Criteria

- First viewport shows Team Magnificent brand, position, beneath-you counter,
  countdown, rolling ticker, and primary next action.
- Existing Arrival, Opportunity, Mechanic, Live Place, TM Advantage, Your Next
  Move, and Footer content remains available below the center.
- Dashboard does not render team line before placement exists.
- Video-complete flow does not force navigation away from the presentation.
- Prospect-facing copy contains no prohibited compliance claims.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- Report includes screenshots or a concise visual QA summary if browser testing
  is available.
- Report confirms no backend/token/placement logic was changed.

## 4. PMV Backend Projection

### Goal

Create or extend the BA-scoped PMV read projection so the cockpit can show
granular lifecycle, video progress, source, last signal, CRM summary, follow-up
state, Focus Queue data, and deterministic next actions.

### Files Allowed To Modify

- `server/src/domain/cockpit.ts`
- `server/src/routes/cockpit.ts`
- `server/src/domain/crm.ts`
- `server/src/routes/crm.ts`
- `server/src/domain/tokens.ts`
- `server/src/routes/p.ts`
- `server/src/domain/invitations.ts`
- `packages/shared/src/types.ts`
- Server/domain tests if test patterns exist
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- `apps/**` except type-only alignment required by shared contracts
- `assets/**`
- `.env*`
- Database seed files unless explicitly required
- Any v1 files

### Acceptance Criteria

- PMV projection is BA-scoped.
- Partial video states are visible or documented as unavailable with exact gap.
- Click/open state is stamped or documented as a confirmed future fix.
- `nextAction` is deterministic and explainable.
- Today’s Actions and PMV projection cannot disagree on priority rules.
- No AI lead qualification or automated sending is introduced.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- Report lists response shapes, lifecycle mapping, and any verified unresolved
  backend gaps.

## 5. PMV Cockpit Frontend

### Goal

Redesign the BA cockpit first viewport into a Prospect Momentum Viewer using
the backend projection from Task 4.

### Files Allowed To Modify

- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx`
- `apps/team/src/components/cockpit/MichaelEventCard.tsx` only to keep it
  visually compatible, not to mix BA interview scoring into PMV scoring
- New PMV component files under `apps/team/src/components/cockpit/` or
  `apps/team/src/components/pmv/`
- `apps/team/src/lib/**` if API wiring exists there
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- `server/**` except bug fixes explicitly traced to Task 4 contracts
- `apps/com/**`
- `packages/shared/**` except imports of existing shared types/primitives
- `assets/**`
- `.env*`
- Any v1 files

### Acceptance Criteria

- First viewport centers Focus Queue and Prospect Momentum Table.
- Collapsed rows show source, lifecycle/stage, video progress, last signal, next
  action, and follow-up state.
- CRM controls move into a drawer/detail surface without losing existing notes,
  reminders, disposition, scripts, re-invite, edit, or remove behavior.
- Sponsor, orientation, leadership, and track record become secondary surfaces.
- No automated outreach or AI qualification appears.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- Report summarizes PMV layout, mobile behavior, and preserved CRM actions.

## 6. Ivory Invitation Agent

### Goal

Convert Ivory into a relationship-first Invitation Agent that helps a BA name
one person, capture why they came to mind, draft one editable invitation, mint a
tokenized link through the existing invitation spine, and place the prospect in
PMV.

### Files Allowed To Modify

- `apps/team/src/routes/ivory.tsx`
- `apps/team/src/routes/invitations.tsx`
- `server/src/domain/ivory.ts`
- `server/src/routes/ivory.ts`
- `server/src/domain/generator.ts`
- `server/src/domain/invitations.ts`
- `server/src/domain/crm.ts`
- `server/src/routes/crm.ts`
- `packages/shared/src/types.ts`
- New Ivory component files under `apps/team/src/components/ivory/`
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- `apps/com/**`
- Token/placement backend files unless the Ivory mint path exposes a verified
  invitation-spine bug
- `assets/**`
- `.env*`
- Any v1 files

### Acceptance Criteria

- User-facing Ivory flow is no longer framed as `Roster + Coach + Generator`.
- Flow starts with relationship memory and one person.
- `relationshipReason` is captured before draft.
- BA can edit the draft before mint/send.
- Invitation uses the existing spine and stores `source: "ivory"`.
- Final screen supports copy message + link and "I sent this".
- Prospect appears in PMV with Ivory source/context.
- No placeholder CRM facts are stored.
- No auto-send or AI lead qualification is introduced.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- Report summarizes the Ivory state machine, stored fields, and invitation spine
  integration.

## 7. Team Launch Center

### Goal

Make `/cockpit` serve as the Team Magnificent Launch Center for new BAs before
it matures into the operational PMV.

### Files Allowed To Modify

- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx`
- `apps/team/src/routes/michael-schedule.tsx`
- `apps/team/src/routes/michael-interview.tsx`
- `apps/team/src/routes/invitations.tsx`
- New files under `apps/team/src/components/launch/`
- `server/src/routes/cockpit.ts`
- `server/src/domain/cockpit.ts`
- `packages/shared/src/types.ts`
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- `apps/com/**`
- Ivory-specific files except links into the existing invitation path
- Token/placement backend files
- `assets/**`
- `.env*`
- Any v1 files

### Acceptance Criteria

- New BA sees Launch Center language, progress, and one dominant next action.
- Checklist shows complete/current/locked/available/optional states.
- Michael state is visible from Launch Center.
- First Invitation mission appears before generic metrics for zero-invite BAs.
- Operational PMV remains available below or after launch milestones.
- Compliance copy keeps BA-owned manual outreach.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- Report lists launch steps, source of each step’s truth, and new-BA path.

## 8. Questionnaire Wizard / Welcome Shortening

### Goal

Shorten the welcome page into a strong ceremony plus Launch Center handoff, and
convert the questionnaire from one long form into a guided wizard while
preserving fields.

### Files Allowed To Modify

- `apps/team/src/routes/welcome.tsx`
- `apps/team/src/routes/onboarding/questionnaire.tsx`
- New files under `apps/team/src/routes/onboarding/`
- New files under `apps/team/src/components/launch/` if shared with Task 7
- `server/src/routes/**` and `server/src/domain/**` only if save/resume draft
  persistence is explicitly implemented
- `packages/shared/src/types.ts` only for wizard/save contracts
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- `apps/com/**`
- Token/placement backend files
- Ivory backend/files
- PMV backend projection files except launch-status read integration
- `assets/**`
- `.env*`
- Any v1 files

### Acceptance Criteria

- Welcome keeps Team Magnificent ceremony, Kevin/Paul credibility, and
  commitment tone while reducing long-page pressure.
- Welcome routes clearly into Launch Center or Michael scheduling.
- Questionnaire preserves existing fields unless a product decision changes
  them.
- Questionnaire has progress, step grouping, back/next navigation, and clear
  completion path to Launch Center.
- Save/resume is implemented only if backend persistence is added safely.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- Report lists wizard sections, preserved fields, and welcome handoff behavior.

## 9. QA and Compliance Pass

### Goal

Run the end-to-end visual, functional, mobile, reduced-motion, CRM ownership,
token journey, and compliance review before v2 redesign release.

### Files Allowed To Modify

- `docs/v2-redesign/qa/QA_REPORT.md`
- `docs/v2-redesign/qa/COMPLIANCE_AUDIT.md`
- Small app/server fixes only when a QA failure is verified and scoped
- `TRAVEL_CHECKPOINT.md`

### Files Not Allowed To Modify

- Broad refactors outside verified QA fixes
- New feature work
- `.env*`
- Any v1 files

### Acceptance Criteria

- Valid, invalid, expired, and unplaced token states are tested.
- Video start, 25, 50, 75, and complete states are tested or documented as not
  available with exact reason.
- Placement idempotency is tested.
- PMV BA ownership scoping is tested.
- Ivory create/draft/mint/send path is tested.
- Launch Center and questionnaire paths are tested.
- Mobile and desktop layouts are checked.
- Reduced-motion behavior is checked.
- Prospect-facing copy has no income, spillover, CV, cycle, rank, placement, or
  dollar claims.
- All failures are fixed or documented with exact file/route.

### Commands To Run

```powershell
pnpm typecheck
pnpm build
git status --short --branch
```

### Expected Output Summary

- Typecheck passes.
- Build passes.
- QA report lists tested paths, screenshots or browser notes where available,
  and remaining risks.
- Compliance audit explicitly confirms prospect-facing language boundaries.
