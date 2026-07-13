# Complete App Visual Test Audit

**Status:** Production visual-QA checklist

**Scope:** `teammagnificent.com`, `teammagnificent.team`, `admin.teammagnificent.team`

**Inventory authority:** Implemented client route trees at the tested commit
**Last assembled:** 2026-07-13

This document is the complete visual inspection checklist for the production app. It is a QA instrument, not a product specification and not an implementation-priority list. `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` continues to control implementation priority. When this checklist conflicts with approved product behavior, the locked specification, decision ledger, and approved ACRs win.

The historical `docs/page-inventory.md` is useful design context, but it does not include every currently implemented route. The route tables below are derived from the active `App.tsx` files.

## 1. Pass record

Complete this block for every audit run.

| Field | Record |
|---|---|
| Date and time (Pacific) | |
| Tester | |
| Production release / Git SHA | |
| `.com` deployment version | |
| `.team` deployment version | |
| Admin deployment version | |
| Browser and version | |
| Operating system | |
| Test identities used | |
| Screenshot/evidence folder | |
| Overall result | `PASS / PASS WITH DEFECTS / FAIL / BLOCKED` |

For each defect record: surface, route, role, viewport, data state, exact steps, expected result, actual result, screenshot/video ID, console error, failed request, severity, and retest result.

## 2. Production-safety rules

- [ ] Use designated test BA, prospect, token, and admin records. Do not expose real prospect information in screenshots.
- [ ] Blur or crop phone numbers, email addresses, tokens, access codes, TM IDs, and message content before sharing evidence outside the authorized team.
- [ ] A visual-only pass must not send broadcasts, email, SMS, voicemail, place calls, mint production codes, move placements, or alter tenant settings.
- [ ] Test a live mutation only when that action is separately authorized and its cleanup path is known.
- [ ] Never test VM/RVM live delivery merely to inspect a visual state. Use dry-run/test data and confirm live-delivery controls remain off unless separately approved.
- [ ] Do not classify, vet, approve, or reject knowledge on Kevin's behalf. Kevin attaching a source is approval; categorization remains Kevin's decision.
- [ ] Record the production release identifier before the first screenshot so evidence cannot be confused with a later deployment.

## 3. Required test identities and data fixtures

- [ ] New visitor with no session.
- [ ] Valid unused access code tied to a known sponsor.
- [ ] Newly registered BA before completing the welcome/Steve gate.
- [ ] Active BA with Steve complete and no prospects.
- [ ] Active BA with populated invitations, CRM activity, training progress, resources, and events.
- [ ] Active BA without the `vm_dialer` entitlement.
- [ ] Active BA with the `vm_dialer` entitlement.
- [ ] Valid BA who is not an admin.
- [ ] Kevin-authorized admin identity.
- [ ] Prospect tokens representing minted/pre-video, video progress, video complete, callback requested, webinar reserved, enrolled, expired, and invalid states.
- [ ] Prospect re-entry link in valid, expired, used, and malformed states.
- [ ] RVM token in valid, invalid, expired, and already-resolved states where supported.
- [ ] Empty, normally populated, and high-volume admin datasets.
- [ ] Event data with orientation available, webinar available, one source unavailable, both sources empty, and both sources unavailable.
- [ ] Resource data with approved resources, uncategorized approved resources, no matching contextual resources, and stale-review warnings.

## 4. Viewport and browser matrix

Run the smoke pass on every column. Run the complete route pass on the primary supported desktop and mobile browsers.

| Class | Required size | Primary checks |
|---|---:|---|
| Small mobile | 360 × 800 | No horizontal clipping; controls remain tappable; mobile navigation works |
| Modern mobile | 390 × 844 | Intended phone layout, safe-area spacing, keyboard behavior |
| Large mobile | 430 × 932 | Lines do not become awkwardly short; cards do not over-expand |
| Tablet portrait | 768 × 1024 | Breakpoints, tables, menus, two-column transitions |
| Laptop | 1280 × 720 | Above-fold content, sticky navigation, modal fit |
| Desktop | 1440 × 900 | Primary visual baseline |
| Wide desktop | 1920 × 1080 | Max-width behavior and excessive whitespace |
| Accessibility zoom | 200% browser zoom | Reflow without lost content or controls |

Browsers: current Chrome/Edge desktop, Safari on iPhone, and Chrome on Android. Add Firefox desktop when a release changes layout, media, forms, SSE, or browser APIs.

## 5. Global visual system — every surface

### Brand and layout

- [ ] Bebas Neue display text, DM Sans body text, and DM Mono metadata load without a flash that permanently changes layout.
- [ ] Gold, ink, cream, teal, borders, muted text, and status colors match the shared brand system.
- [ ] Logos and Team Magnificent naming are sharp, correctly proportioned, and not duplicated.
- [ ] Page titles, section headings, body copy, metadata, and buttons have a consistent hierarchy.
- [ ] Content aligns to a coherent grid; gutters and vertical rhythm remain consistent between routes.
- [ ] Cards, panels, tables, forms, badges, dialogs, and notifications use consistent radii, borders, shadows, and spacing.
- [ ] Long names, long titles, URLs, error messages, and large numbers wrap or truncate intentionally.
- [ ] No content is hidden under sticky navigation, browser chrome, or the mobile keyboard.
- [ ] No unintended horizontal page scroll occurs. Intentional table scrolling has a visible, usable scroll area.
- [ ] Images and video retain aspect ratio and do not become blurry or stretched.
- [ ] Icons are visually aligned, consistently sized, and accompanied by accessible labels where their meaning is not obvious.

### Interaction states

- [ ] Every link and button has default, hover, focus, active, disabled, and busy behavior where applicable.
- [ ] The first click produces immediate visual feedback and cannot accidentally double-submit.
- [ ] Validation appears next to the relevant field and does not erase entered values.
- [ ] Success messages are visible, specific, and persist long enough to understand.
- [ ] Destructive or externally visible actions have the intended confirmation step.
- [ ] Modals fit the viewport, trap focus, close predictably, and restore focus to the launcher.
- [ ] Dropdowns and popovers stay inside the viewport and are not clipped by parent overflow.
- [ ] Back, refresh, deep-link, and browser-history behavior preserve an understandable state.

### Data and system states

- [ ] Initial loading state appears without broken or misleading content.
- [ ] Empty state explains what is empty and, when appropriate, gives a valid next action.
- [ ] Populated state remains readable at normal volume.
- [ ] Dense/high-volume state does not overlap, clip, or become unusably tall.
- [ ] API/network error state is visible and does not masquerade as an empty state.
- [ ] Unauthorized, forbidden, expired, enrolled/conflict, and not-found states use the correct message and destination.
- [ ] Partial-source failures show which source is unavailable while preserving valid data from other sources.
- [ ] Refresh/retry does not duplicate rows, alerts, cards, or optimistic updates.
- [ ] Dates and times identify or consistently apply Pacific/local time; daylight-saving boundaries do not produce surprising labels.

## 6. Prospect surface — `teammagnificent.com`

The `.com` experience intentionally has no Team navigation. Test with direct URLs and controlled tokens.

| Route / view | Required visual checks | Required states/evidence |
|---|---|---|
| `/p/:token` loader and resolver | Brand-locked loader, no layout flash, transition into resolved view | Slow response, valid token, malformed token, network failure |
| `/p/:token` presentation | Personal opening, invitation, Dr. Dan video, market, pharmaceutical solution, natural path, dossier, Kevin story, timing, next move, leadership, footer | Mobile and desktop full-page captures; video unloaded/loading/playing/paused/ended; milestone transitions |
| `/p/:token` post-video dashboard | Ribbon, arrival, opportunity, mechanic, live place, Team Magnificent advantage, next move, footer | Before placement, placed, SSE update, reconnect, callback available/requested, webinar available/reserved |
| `/p/:token` invalid | Clear invalid state without leaking token or internal details | `/p/invalid` and random malformed token |
| `/p/:token` expired | Expired explanation and correct BA contact path | HTTP 410 evidence |
| `/p/:token` enrolled | Enrolled-state message and correct next step | HTTP 409 evidence |
| `/p/:token` server/offline | Calm recovery message, retry behavior, no false success | API 500, offline, timeout |
| `/p/login` | Phone-entry form, formatting, instructions, rate-limit and recovery states | Empty, incomplete, valid, not found, rate limited, offline |
| `/p/login/r/:linkToken` | Redeem progress and redirect, no link-token exposure | Valid, expired, already used, malformed, offline |
| `/rvm/:token` | RVM landing content, media/player, action controls, resolved state | Valid, invalid, expired, resolved, slow media, media error |
| Catch-all | Intentional redirect to invalid prospect state | Unknown root and nested paths |

### `.com` presentation sweep

- [ ] Scroll the entire presentation without skipping a section; record one desktop video and one mobile video.
- [ ] Personalized BA/prospect names remain grammatical and safe with missing, short, and long values.
- [ ] Video poster, controls, captions, loading, buffering, error, and completion behavior are visually understandable.
- [ ] Milestone changes do not jump the page or expose duplicate controls.
- [ ] Callback and webinar actions distinguish selected, submitting, confirmed, full/unavailable, and failed states.
- [ ] The live placement display never visually implies a guaranteed binary-leg position.
- [ ] SSE reconnect or stale data never produces duplicate placement/activity elements.
- [ ] Prospect re-entry works cleanly across phone keyboard opening, autofill, paste, and browser back.

### `.com` compliance inspection

- [ ] No income claim, earnings projection, commission figure, cycle math, CV amount, or dollar promise appears.
- [ ] No spillover promise, placement guarantee, or implication that queue position equals binary-leg position appears.
- [ ] No AI prospecting, AI qualification, Michael, or automated-calling language appears.
- [ ] No current team head count appears; the approved 100,000 goal may appear only in its approved context.
- [ ] No THREE International company branding, logo, or programmatic enrollment handoff appears.
- [ ] People → Momentum → Volume → Checks language stays within the approved presentation and does not become a promise.
- [ ] Contact copy uses the correct BA identity and never hard-codes Kevin for another BA's prospect.

## 7. Brand Ambassador surface — `teammagnificent.team`

### Public and onboarding routes

| Route | Required visual checks | Required states/evidence |
|---|---|---|
| `/` | Redirect is clean and does not flash protected content | Logged out and logged in |
| `/register` | Access code, sponsor confirmation, account fields, validation, progress | Empty, bad/used code, valid code, long sponsor name, duplicate account, submitting, success, API failure |
| `/login` | Credentials, show/hide behavior, forgot/recovery affordances if present, errors | Empty, invalid, valid, expired session, offline |
| `/welcome` | Ceremony layout, communication-boundary acknowledgment, next action | First visit, acknowledged, reload, already complete |
| `/steve/discovery` | Immersive interview flow without TeamNav, progress, recording/input controls | Permission prompt, denied permission, active, paused/retry, completion, API failure |

### Authenticated route inventory

| Route | What to inspect completely |
|---|---|
| `/cockpit` | PMV summary, invitation rows, filters, calendar, CRM details/drawers, empty invites, re-invite tools, loading/error states, dense data |
| `/launch` | Recruiting-cycle dashboard, step progress, cards, status language, next actions, empty and complete cycles |
| `/invitations` | Single and bulk invitation forms, token/result display, copy/share actions, validations, history, success/failure |
| `/video-library` | Gallery grid/list, thumbnails, player/modal, categories, empty/error/loading, long titles |
| `/resources` | Approved resource cards, filters/context, uncategorized approved resources, empty matching state, loading/offline |
| `/resources/:resourceVersionId` | Resource title/version/metadata, media or document rendering, back path, missing version, stale review indication where intended |
| `/events` | Orientation and webinar sections, registration state, source availability, normalized truth labels, empty and partial-source states |
| `/ivory` | Coach/conversation layout, prompts, generated-copy state, manual fallback, compliance error, long conversation, loading |
| `/ivory/momentum` | Prospect context, follow-up suggestions, PMV signal display, save/copy actions, no automated-send implication |
| `/crm` | List/detail responsiveness, filters, lifecycle states, notes, follow-up controls, dispositions, empty/error/large dataset |
| `/vm-campaigns` | Entitlement gate, campaign list/details, provider/dry-run states, safe disabled live-delivery controls, errors |
| `/profile` | Identity/contact fields, validation, save/saved/error, sponsor/immutable fields presented correctly |
| `/leadership` | Leader content, hierarchy/rollups where present, empty and access-limited states |
| `/training/10-steps` | All steps, progress state, completed/current/locked styling, mobile navigation |
| `/training/fast-start` | Hub cards, progress, module ordering, resume behavior |
| `/training/fast-start/product` | Product module content, media, checks/completion, long-form mobile layout |
| `/training/fast-start/comp-layer-1` | Compensation-training content remains BA-only, diagrams/tables, completion |
| `/training/fast-start/binary` | Binary-plan diagrams and labels, zoom/reflow, completion |
| `/training/fast-start/prospect-list` | Worksheet/form density, entry/edit/remove behavior, empty and long lists |
| `/training/fast-start/team` | Team module content, completion and navigation |
| `/sponsor/interview-workbook/:tmagId` | Correct member context, question/answer layout, long responses, save/error, unauthorized/missing member |
| `/preview` | Preview-only presentation framing, viewport behavior, exit/back path, no accidental production mutation |
| Catch-all | Branded `404 · not found`, readable with and without an existing session |

### Team shell and navigation

- [ ] Desktop navigation exposes Cockpit, Launch, Invitations, CRM, Ivory, Training, Videos, Resources, Events, Leadership, and Profile.
- [ ] Active-route styling is correct, including exact matching for `/ivory` versus `/ivory/momentum`.
- [ ] The mobile menu opens, closes, scrolls when necessary, announces expanded state, and closes after navigation.
- [ ] The VM Dialer link appears only for entitled BAs; direct access without entitlement returns to Cockpit without a confusing flash.
- [ ] Sticky navigation does not cover anchors, headings, dialogs, or browser focus targets.
- [ ] Direct-only routes (resource detail, workbook, preview, individual training modules) have an understandable route back.

## 8. Kevin admin surface — `admin.teammagnificent.team`

The current admin shell uses a fixed 220 px sidebar and dense tables. Mobile/tablet behavior must be explicitly inspected; a desktop-only assumption is not an automatic pass.

### Authentication and shell

- [ ] Initial admin-auth loading state is centered and does not expose admin data.
- [ ] Logged-out login form is readable and complete.
- [ ] A valid BA who is not an admin sees a clear forbidden explanation, not a blank page or redirect loop.
- [ ] Admin login success loads the shell without a stale error.
- [ ] Sidebar remains usable at laptop height, including lower navigation and sign-out controls.
- [ ] Active navigation, signed-in identity, TM ID, and sign-out are visually correct.
- [ ] At narrow viewports, sidebar and main content remain reachable without permanently hiding controls.

### Admin route inventory

| Route | What to inspect completely |
|---|---|
| `/dashboard` | Filter controls, metric cards, date ranges, loading/error, zero and large values |
| `/access-codes` | Code list, mint form, sponsor selection, copy/result, used/unused status, confirmations, error states |
| `/bas` | Directory, search/filter, leader tags, long names/IDs, empty/loading/error, mutation feedback |
| `/prospects` | Filters, dense oversight rows, lifecycle/status labels, pagination, empty/error/loading |
| `/queue` | Shared-pool summary, monotonic positions, vacated/active rows, empty/loading/error; no placement promise language |
| `/live-ops` | Persistence, delivery, agent, knowledge cards; growth, holding-tank, funnel, stream status; partial loading/failure |
| `/audit` | Filters, event rows, before/after detail, pagination/load more, long JSON/text, empty and API failure |
| `/reports` | Direct route rendering, report cards/links, empty and unavailable states; note it is currently not in sidebar navigation |
| `/tenant` | Architecture map, settings forms, template validation, save/saved/error, dangerous-change confirmations |
| `/orientation` | Session creation, capacity, roster, status, dates/time zones, full session, empty/loading/error |
| `/vm` | Campaign/provider/queue/webhook/health panels, dry-run/live status distinction, dense rows, failures |
| `/agents` | Agent health cards, projection outbox, dead letters, worker status, long errors, empty/loading/error |
| `/knowledge` | Stack status, retrieval readiness, approved-source URL/file attachment, upload progress/result, existing source state |
| `/content-videos` | Gallery list/editor, thumbnail/media fields, ordering, save/saved/error, empty/loading |
| `/consistency` | Half-writes, stale/dead-letter projections, orphan and CRM findings, category failures, empty clean report |
| `/entitlements` | BA entitlement rows, enabled/disabled distinctions, empty/error/loading, long identities |
| `/resource-center` | Usage/review health, open counts, unique users, last-opened dates, stale-review warnings, empty/error/loading |
| `/events` | Orientation/webinar source status, tables, normalized model, capacity, registration, reminders, attendance, follow-up |
| `/broadcast` | Audience controls, compose form, preview, enqueue confirmation, progress/status, failed sends, recent broadcasts |
| Catch-all | Branded admin 404 inside the authenticated shell |

### Admin truth and authority checks

- [ ] Knowledge attachment copy never implies an agent vets or approves Kevin's source.
- [ ] Approved-but-uncategorized knowledge remains visible as uncategorized and is not silently agent-classified.
- [ ] Resource Center displays only Kevin-approved material where the product contract requires approved resources.
- [ ] Event Center states reminders as `not configured` when absent.
- [ ] Event Center states attendance as `not recorded` and never infers attendance from a reservation.
- [ ] Event Center states follow-up as human CRM / `not connected` and does not imply automated follow-up.
- [ ] Source-unavailable Event Center panels identify the unavailable source without erasing the available source.
- [ ] Consistency and agent-oversight failures are readable and actionable without presenting a false all-green state.
- [ ] VM live/dry-run controls cannot be visually confused.

## 9. End-to-end visual journeys

Record a continuous screen capture plus key screenshots for each journey.

### A. BA entry and onboarding

- [ ] Access code entry → sponsor confirmation → account creation → login → welcome acknowledgment → Steve discovery → Cockpit.
- [ ] Confirm the sponsor identity never changes between steps.
- [ ] Confirm protected Team navigation does not appear before the gate is complete.
- [ ] Refresh and browser-back at each boundary; no protected-content flash or progress loss beyond the approved behavior.

### B. Invitation to prospect action

- [ ] BA creates invitation → copies/opens token → prospect presentation → video milestones → post-video dashboard.
- [ ] Prospect requests callback; BA Cockpit/CRM shows the correct visual update.
- [ ] Prospect reserves webinar; both prospect confirmation and BA/admin event views remain consistent.
- [ ] Confirm prospect-facing copy names the sponsoring BA and uses “[BA name] will reach out” behavior.

### C. Token edge cases

- [ ] Invalid token → invalid state.
- [ ] Expired token → 410 expired state and valid recovery/contact path.
- [ ] Enrolled token → 409 enrolled state.
- [ ] Re-entry request → magic link → redeem → original prospect state.
- [ ] Used/expired/malformed re-entry link → safe explanation without account or token leakage.

### D. Resource knowledge flow

- [ ] Kevin attaches an approved URL or file in Admin Knowledge.
- [ ] The UI confirms attachment without claiming agent vetting, approval, or categorization.
- [ ] Approved uncategorized content remains visibly available for Kevin to classify.
- [ ] A contextual Resource Center location displays only material permitted by the approved metadata/state.
- [ ] Open/usage evidence appears in Admin Resource Center without exposing member-private content.

### E. Event Center flow

- [ ] Orientation session created in its source view → visible in Team Events → visible in Admin Event Center.
- [ ] Prospect webinar available to an invitation token → reservation confirmation → aggregate reservation count.
- [ ] Reservation does not display as attendance.
- [ ] Reminder and follow-up fields remain explicitly unconfigured/not connected until their source truth changes.
- [ ] Simulated source failure produces a partial-availability view, not a false empty state.

### F. VM entitlement and safety

- [ ] Non-entitled BA sees no VM navigation and cannot remain on the direct VM route.
- [ ] Entitled BA sees VM navigation and the campaign surface.
- [ ] Admin and BA states agree about dry-run/live-delivery status.
- [ ] Error and disabled states cannot be mistaken for a successful send or completed campaign.

## 10. Accessibility visual audit

- [ ] Each page has one clear primary heading and a logical visible heading hierarchy.
- [ ] Skip/landmark navigation and page regions are understandable to keyboard and screen-reader users.
- [ ] Every form control has a persistent accessible name; placeholder text is not the only label.
- [ ] Keyboard focus order matches the visual order.
- [ ] Focus is always visible on dark, gold, cream, teal, and error backgrounds.
- [ ] Color is never the only indicator of status, error, selection, completion, or availability.
- [ ] Text and essential UI meet contrast requirements in normal, muted, disabled, and hover states.
- [ ] Tap targets are at least comfortably usable on mobile and have adequate separation.
- [ ] Status messages, validation, loading completion, and live updates are announced without moving focus unexpectedly.
- [ ] Tables have understandable headers; horizontal scrolling does not detach the user from row meaning.
- [ ] Video has captions/transcript controls where required; meaningful images have alt text and decorative images do not create noise.
- [ ] Reduced-motion preference removes nonessential animation without hiding content.
- [ ] At 200% zoom, content reflows and all actions remain available.

## 11. Browser, media, network, and deployment inspection

- [ ] No uncaught console errors on initial load or primary interactions.
- [ ] No failed font, image, video, source-map, manifest, favicon, or API requests that affect the experience.
- [ ] No mixed-content, CSP, CORS, cookie-domain, or authentication-loop errors.
- [ ] Hard refresh and direct deep-link work on every route family.
- [ ] Session cookies work across `.team` and admin exactly as intended, without authenticating `.com` prospect routes.
- [ ] SSE snapshot, update, heartbeat, disconnect, and reconnect states do not duplicate or freeze visible data.
- [ ] Slow 3G/4G simulation preserves loaders and prevents accidental repeat actions.
- [ ] Offline → online recovery works or clearly instructs the user to retry.
- [ ] Video/audio controls work with autoplay blocked, media delayed, media failed, and device rotation.
- [ ] Production HTML/assets/API all correspond to the release SHA recorded in the pass record.

## 12. Defect severity

| Severity | Definition | Examples |
|---|---|---|
| Blocker | Prevents a critical journey, exposes protected data, violates compliance, or risks an unintended production action | Cannot log in; admin data visible without authorization; prospect income claim; live send looks disabled but fires |
| High | Major route or state is unusable, materially misleading, or inaccessible with no reasonable workaround | Mobile navigation inaccessible; wrong sponsor shown; reservation shown as attendance |
| Medium | Important visual or interaction defect with a usable workaround | Table clipping; focus lost after dialog; error copy displaced |
| Low | Cosmetic inconsistency that does not impede understanding or completion | Minor spacing, alignment, wrapping, or nonessential animation issue |

Any compliance violation, identity/sponsor mismatch, protected-data exposure, or visual state that falsely claims a write/send/attendance/approval succeeded is at least High and may be a Blocker depending on impact.

## 13. Recommended audit order

1. Production identity: record SHA/version, browser, and test accounts.
2. Five-minute smoke: `.com` valid token, Team login/Cockpit, admin login/Dashboard, console/network scan.
3. Critical journeys: BA onboarding, invitation-to-dashboard, callback/webinar, Event Center, Resource Center.
4. Complete route sweep: every row in sections 6–8 at desktop baseline.
5. State sweep: loading, empty, populated, dense, partial failure, full failure, unauthorized, forbidden, 404, 409, and 410.
6. Responsive sweep: mobile, tablet, laptop, wide desktop, 200% zoom.
7. Accessibility and keyboard sweep.
8. Browser/media/network sweep.
9. Defect retest on the exact release candidate.
10. Sign-off with unresolved defects and explicit release decision.

## 14. Final sign-off

- [ ] Every implemented client route has a recorded result.
- [ ] Every critical journey has video evidence.
- [ ] Mobile and desktop evidence exists for `.com`, `.team`, and admin.
- [ ] Compliance checklist passed on every `.com` state.
- [ ] Knowledge approval/categorization authority is represented correctly.
- [ ] Event reminders, attendance, and follow-up truth are represented correctly.
- [ ] No Blocker defects remain.
- [ ] Every open High defect has an owner and explicit release decision.
- [ ] Retests reference the same build or clearly identify the replacement build.

| Sign-off | Name | Date | Result / notes |
|---|---|---|---|
| Visual QA | | | |
| Product authority (Kevin) | | | |
| Production release | | | |
