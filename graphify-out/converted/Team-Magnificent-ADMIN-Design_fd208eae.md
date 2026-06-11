<!-- converted from Team-Magnificent-ADMIN-Design.docx -->

TEAM MAGNIFICENT
/admin
Founder Command Surface
Kevin’s master command center for Team Magnificent. Not a normal BA dashboard.
Nine surfaces. Full visibility. Discretionary write authority on BA-requested emergencies.
Prepared for: Kevin L. Gardner, Founder, Team Magnificent
Companion to the COM, TEAM, and Signup & Architecture documents

# How to read this document
This is a readback of the /admin surface design as locked across Chats #82, #84, #85, and #89. The /admin route is mounted inside teammagnificent.team at /admin/*. Anyone who is not Kevin who reaches that path receives a hard 403 at middleware. The surface does not exist for any other Brand Ambassador.
Kevin’s options after reading:
- Mark up the document with corrections, missing pieces, anything that is wrong.
- Answer the open questions in Section J, or leave them open with a note that they are unresolved.
- Decide which of the nine surfaces to build first — each can ship independently once the BA-ID gate (Section A) is live.

## The standing rule, in Kevin’s words
and it should never conflict with three international only mirror. if there is a conflict or dispute three international is the final authority
THREE International is the single source of truth and the final authority on sponsorship, enrollment, placement, and compensation. Every record visible in /admin mirrors THREE’s records for operational visibility. The /admin surface exists to detect drift between Team Magnificent and THREE, and to update Team Magnificent’s records to match THREE when drift is detected. It does not exist to override THREE.
Compliance posture for /admin. The /admin surface is the most sensitive in the entire system. It contains cross-team prospect data, full BA directory, audit history, and discretionary write authority on records that the rest of the app treats as immutable. The surface never renders to the public, never renders to BAs other than Kevin, never logs request paths to public analytics, and never exposes its routes through any public API documentation. The middleware fails closed.


# The boundary
Analytics are for coaching and operational improvement only. The dashboard should not score prospects as qualified, rank prospects by income potential, or trigger automated outreach.
This boundary applies to every surface in /admin. No prospect scoring. No income-potential ranking. No automated outreach. The metrics exist for Kevin to read and make human judgments from. The system surfaces what is happening; Kevin decides what to do about it.
Two corollaries, locked Chat #89:
- No algorithmic flagging of BAs as "at-risk" or "needs support." The surface displays the underlying metrics — 2-in-72 progress, training completion, invite activity, follow-up aging, profile completeness — and Kevin reads them. No score column. No system-generated badge. Human judgment on both sides of the screen.
- No AI lead qualification of prospects. Michael is BA-facing only and never scores prospects. The Prospect Oversight surface (Section D) shows activity history without rating or ranking.


# Where compliance enforcement lives
Earlier versions of this document considered a Compliance Review surface inside /admin where Kevin would manually inspect message drafts and profile edits. Locked Chat #89: that surface is removed. Compliance enforcement does not live in /admin as a manual queue. It lives where it is actually generated.
### Enforcement at the invitation agent (script-time)
- When a BA uses ScriptMaker to draft an invitation, the agent enforces compliance rules at draft time — no income claims, no placement promises, no AI lead qualification language, no comp math.
- Risk flags are surfaced inline to the BA before they send. The BA cannot send a draft that fails compliance checks.
- The agent never escalates routine drafts to Kevin. Kevin sees aggregated metrics on this enforcement in Live Operations (Section H), not a queue of individual drafts to triage.
### Enforcement at the platform layer (render-time)
- Prospect-facing surfaces on .com enforce compliance on render. The locked rule set (Section F.6) is read at render time and validated against the content being rendered.
- Content that fails the compliance render check returns a server error before reaching the prospect. The platform fails closed.
- Master content (templates, scripts, prompts) is also validated at change-time in Tenant Architecture (Section F.5) so noncompliant content cannot be saved as master.
### What Kevin sees in /admin instead of a review queue
- Aggregate metrics: count of drafts auto-corrected, count of master-content saves blocked, count of render failures — visible in Live Operations and Reporting.
- Compliance rule changes: visible in Tenant Architecture (Section F.6) and tracked in Audit (Section J).
- Specific exception drilldowns: if Kevin wants to see the individual draft or content save that was blocked, he opens the audit log entry.
Why this is the right shape. Manual compliance review by the founder is slow, error-prone, and creates a backlog. Automated enforcement at the agent and platform layers is fast, consistent, and never sleeps. Kevin reviews patterns and trends in Live Operations, not individual drafts.


# The override framing
Two surfaces inside /admin carry write authority on records the rest of the system treats as immutable: the sponsor on a BA record (Section C.5) and the holding tank entries for prospects not invited by Kevin (Section D.4). The architecture supports both interventions because there are real situations where a Brand Ambassador may need help that only the founder can give. The discipline around when those interventions happen is locked here.
### What the override is
- A discretionary safety lever, not a routine tool.
- Triggered by a Brand Ambassador’s explicit request to Kevin — not initiated by Kevin alone.
- Used only when the situation cannot be resolved through normal BA action or THREE’s back office.
- Every use is captured in the audit log with the requesting BA’s ID, the reason in Kevin’s words, the before-state, the after-state, and a timestamp.
### What the override is not
- Not a tool for Kevin to reshuffle the team at will.
- Not a way to override THREE — THREE remains the final authority on placement and compensation regardless of what /admin records say.
- Not visible to any Brand Ambassador other than Kevin. The BA whose record was overridden sees the override’s effect in their cockpit but never sees the override mechanism itself.
- Not reversible without another override entry — every state change is a fresh audit entry. The audit log is append-only.
### Why this framing matters
Sponsor immutability is non-negotiable everywhere else in the system. The signup transaction rejects any attempt to set sponsor from anything other than the access code at signup. The BA cockpit treats sponsor as a non-editable profile field. The presentation page resolves sponsor from the token at mint time and never recomputes it. The override exists in /admin precisely because Kevin needs a way to honor a BA’s legitimate emergency request without weakening the rule everywhere else.
Cross-team holding tank intervention authority works the same way. A BA may call Kevin saying a prospect of theirs is in an emergency situation that needs founder-level help to resolve. Kevin can move, reassign, manually flush, or force-enroll that prospect. The action lands as an audit entry with the requesting BA’s ID and the reason.


# A.  Access and routing
Before any of the nine surfaces are reachable, the access model has to be exact. This section is the gate.
## A.1  Where it lives
- Route: teammagnificent.team/admin/*
- Mounted inside the .team client, not a separate subdomain.
- The .team auth runs first — if the visitor is not logged in as a Brand Ambassador, they redirect to /login.
- After .team auth, the /admin/* middleware runs the BA-ID gate.
- No SEO indexing. robots: noindex, nofollow on every /admin page.
- No /admin link appears in the BA cockpit navigation for any user. Kevin reaches it by typing the URL or by bookmark.
## A.2  The BA-ID gate
Locked Chat #85: hardcoded environment variable matched against the requesting BA’s ID.
- Server reads ADMIN_BA_IDS from .env at startup. Single ID for now (Kevin’s THREE BA ID).
- On every /admin/* request, the middleware compares the authenticated user’s BA ID against the ADMIN_BA_IDS list.
- Match → request proceeds.
- No match → hard 403. Response body returns the standard .team error page with no indication that /admin exists. Logs the attempt to the audit log with the requesting BA ID, timestamp, requested path, and user-agent.
- No client-side check is sufficient. The gate is server-side on every route, every request.
## A.3  Granting access to another BA later
- Add the BA’s THREE BA ID to ADMIN_BA_IDS in .env, redeploy.
- No UI flow inside /admin grants access. Granting access requires server access. This is deliberate.
- Paul currently does not have access. Paul logs in as a regular BA and sees the regular cockpit.
- If Kevin’s BA ID ever changes, ADMIN_BA_IDS must be updated immediately or Kevin loses access.
Why hardcoded env var, not a database role. A database role can be edited by anyone with database write access. An env var requires server access, which is harder to obtain and easier to audit. The /admin surface controls money-adjacent operations — the gate to it should be hard to flip.
## A.4  The nine surfaces
Listed in the order they appear in the left sidebar:
- A.4.1  Core Dashboard (Section B) — at-a-glance master metrics, live event stream, filters, drilldowns.
- A.4.2  BA Oversight (Section C) — BA directory, profile, BA-requested sponsor override.
- A.4.3  Prospect Oversight (Section D) — cross-team prospect view, sponsor-routed URL inspection, BA-requested holding tank intervention.
- A.4.4  Queue / Recruitment Leg Oversight (Section E) — fixed queue numbers, depth, ticker, queue rule management.
- A.4.5  Tenant Architecture (Section F) — master settings, template control, role/permission control, content inheritance.
- A.4.6  Kevin-Only Broadcast (Section G) — admin-only broadcast with audience selector, channels, audit guardrail.
- A.4.7  Live Operations (Section H) — deep operational view: prospects in process, holding tank state, conversion funnels.
- A.4.8  Reporting / Analytics (Section I) — BA activation, training, queue velocity, leader scorecards, export.
- A.4.9  Audit / Controls + Open Questions (Section J) — every event in the system, append-only, and the unresolved decisions.
## A.5  Layout pattern
- Left sidebar: nine surface names, current surface highlighted in gold.
- Top bar: Kevin’s name, BA ID, current session start time, link back to the regular .team cockpit.
- Main pane: the active surface.
- No prospect-facing content ever renders inside /admin. No marketing copy, no FOMO, no animation. The surface is dense, fast, operational.
- Brand stays Team Magnificent — same #0A0A0A ink, same #C9A84C gold accents, same Bebas Neue + DM Sans — but the energy is quieter. Closer to a back-office terminal than a marketing dashboard.


# B.  Core Dashboard
The home surface. Kevin lands here when he opens /admin. Designed to answer two questions on sight: what is the state of the team right now, and what just happened. The deep operational view with conversion funnels lives in Live Operations (Section H); the Core Dashboard is the at-a-glance.
## B.1  Master metrics row (top of screen)
- Active BAs — total BAs signed up in Team Magnificent, with the current count Kevin needs but never shows on .com.
- Prospects in flow — total prospects currently active in the holding tank (not yet enrolled, not yet flushed).
- Queue movement (last 24h) — net change in the queue (placements minus flushes).
- Registration handoffs (last 24h) — prospects marked as enrolled by their BAs.
- Training progress — percentage of active BAs who have completed the Fast Start Guide (Module 5).
- Each metric is a clickable tile that opens a drilldown panel scoped to that metric.
## B.2  Filter bar (below master metrics)
Filters apply globally to the dashboard’s drilldown panels.
- Filter by BA — search by name or BA ID; combine multiple selections.
- Filter by leader group — system-detected leaders by activity threshold, or Kevin-curated leader list (Section G.2).
- Filter by status — active / inactive / suspended / signed-up-but-not-onboarded.
- Filter by market — if and when geographic markets become a tracked dimension (open question J.4).
- Filter by training stage — not started / Module 1–5 / orientation complete.
- Filter by queue status — minted / clicked / video started / video complete / callback / webinar / enrolled / expired.
- Filter by handoff state — pending / enrolled / no-show / withdrew.
- Clear-all button. Active filter pills shown above the bar.
## B.3  Live event stream (left column, two-thirds width)
- Real-time scrollable feed of every triple-stack write in the system.
- Each entry: timestamp (relative + absolute on hover), event type, BA name, prospect name (if applicable), one-line summary, link to the relevant record.
- Event types: token minted, link clicked, video started, video milestone (25/50/75/complete), prospect placed in holding tank, callback requested, webinar reserved, prospect marked enrolled, access code generated, access code redeemed at signup, BA signed up, sponsor override applied, holding tank flush, manual intervention, discrepancy detected, Michael interview completed.
- Feed honors the active filters from B.2.
- Auto-scroll on by default, pauses when Kevin scrolls up, resumes when Kevin returns to top.
- Feed is server-sent events (SSE) from the gateway event firehose, not polling. Reconnects automatically on network drop.
## B.4  Daily aggregates (right column, one-third width)
- Today’s numbers, with the prior day in parentheses for comparison.
- New BAs signed up today.
- Prospects placed in the holding tank today.
- Callback requests submitted today.
- Webinar reservations submitted today.
- Prospects marked enrolled today.
- Access codes generated today (always low; visible to spot anomalies).
- Holding tank flushes today (expirations and manual flushes counted separately).
- Discrepancies detected against THREE today.
- Sponsor overrides applied today (always low; visible to confirm rarity).
- Below the tiles: sparkline charts for each metric showing the last 30 days. Hover for daily count, click to expand to Reporting (Section I).
## B.5  Drilldown panel
- Opens in a slide-out drawer from the right when Kevin clicks any master metric tile, event stream entry, or aggregate tile.
- Drawer contents depend on what was clicked.
- Drawer is dismissible. Multiple drawers stack if Kevin opens several drilldowns.
## B.6  Trend strip across the bottom
- Single line chart, full width, fixed to the bottom of the screen.
- Y-axis: total BAs in Team Magnificent. X-axis: time since Kevin’s signup as TM-01.
- The line climbs in real time as new BAs sign up. Tick at every multiple of 100. Annotation pin at 100,000 (the team’s named destination).
- Hover anywhere on the line to see the BA count at that timestamp and a tooltip listing the names of the BAs who signed up that day.
- This is the single chart that captures the entire team’s growth arc.


# C.  BA Oversight
View Brand Ambassador records. Flat sortable directory of every BA in Team Magnificent. Sorting and filtering replace the tree visualization considered and rejected Chat #89 — the list view scales to 100,000.
## C.1  The directory (default view)
Columns, left to right:
- BA name (first + last).
- THREE BA ID (clickable, opens BA profile, C.4).
- Access code (the code this BA owns and reuses).
- Sponsor (current; if an override was applied, the BA cockpit shows only this current value, but admin shows it alongside the original — C.5).
- Signed up (date).
- Welcome completion (yes/no with date).
- First login (date).
- 2-in-72 progress (the rolling 72-hour invite activity — C.2).
- Profile completeness (percentage — C.3).
- Personal invites count (lifetime; clickable, opens this BA’s prospect list).
- Follow-up aging (the oldest open follow-up reminder on this BA’s prospect list).
- Training stage (Module 1–5 / orientation complete).
- Status (active / inactive / suspended).
- Last activity (timestamp).
- Leader tags: system-detected (by activity threshold) and Kevin-curated (Section G.2). Visible as two small badges; toggleable from this row by Kevin.
Every column is sortable ascending or descending. Click a column header to sort. Click again to reverse.
## C.2  2-in-72 tracking
- Rolling-window count: how many personal invites the BA has minted in the trailing 72 hours.
- Displayed as a count with the window dates on hover. 2 or more = on rhythm. Less than 2 = visible but not flagged.
- Locked Chat #89: no system flag, no badge, no score. Kevin reads the number and decides whether to reach out.
## C.3  Profile completeness
Percentage of filled profile fields. Surfaced for Kevin to read; never used to algorithmically rank or flag BAs. Fields include first name, last name, email, phone, THREE username, THREE BA ID, profile photo (optional), bio (optional), market/region (optional), time zone (optional), preferred contact method (optional).
## C.4  BA profile panel
Opens when Kevin clicks a BA name or BA ID. Slide-out drawer or full-screen modal.
Sections inside the profile:
- Identity: name, BA ID, email, phone, signed-up date, last activity, status.
- Sponsor (with override history, C.5).
- Access code owned by this BA.
- Welcome completion + first login dates.
- 2-in-72 progress (current and last 30 days).
- Invite activity (count, recent invites, link to full prospect list filtered to this BA).
- Training progress (which modules complete, which open, orientation status, last training activity date).
- Michael interview transcript link (the recording lives in Audit — Section J — with this link for quick reference).
- Leader tags: system-detected and Kevin-curated badges, with toggle for Kevin to add or remove the curated tag here.
- Notes — Kevin’s private notes about this BA (free-text field, append-only).
## C.5  Sponsor field — BA-requested override
The sponsor on a BA record is normally derived from the access code used at signup and is immutable. Kevin’s admin override is a discretionary safety lever triggered by a BA’s explicit request to him (see "The override framing" earlier in this document).
### How the field displays in admin
- Current sponsor: the BA currently recorded as this BA’s sponsor.
- Original sponsor: the BA derived from the access code at signup. Shown alongside current only if it differs (i.e., an override was applied).
- Override history: a timestamped list of every override applied to this BA’s sponsor field, with the requesting BA’s ID and Kevin’s reason.
### How the field displays in the BA cockpit
- Only the current sponsor is shown. The BA never sees the original or the history.
- If no override has been applied, current = original, and the BA cockpit and admin view show the same value.
### Applying an override
- Friction-heavy flow. Not a one-click action.
- Kevin opens the BA profile, clicks Sponsor → Override.
- Form requires: the requesting BA’s ID (typed, validated), the new sponsor’s BA ID (typed, validated), and a reason field (free text, required).
- Confirmation modal lists the before and after side-by-side. Kevin re-confirms.
- On submit: triple-stack write, audit log entry, and the BA’s cockpit shows the new sponsor on next page load. The original sponsor remains in the admin view as historical record.


# D.  Prospect Oversight
View prospect records by sponsor / BA. Every prospect in every BA’s pipeline, cross-team visible to Kevin.
## D.1  The directory (default view)
Columns, left to right:
- Prospect name (first + last).
- Inviting BA.
- Presentation status: invited / link clicked / video started / video 25 / video 50 / video 75 / video complete / reading dossier / callback requested / webinar reserved / enrolled / expired.
- Queue position number (if the prospect has reached video_complete and been placed).
- Sponsor-routed URL (the /p/{token} URL the inviting BA sent; clickable, opens a sandboxed preview that does not fire as a real link click).
- First contact (date of token mint).
- Most recent activity (date and event type).
- Days in holding tank (counted from video_complete; visible only after placement).
- Follow-up needed (activity-recency threshold; surfaced as a date, never as a system flag).
- Registration handoff state: pending / enrolled / no-show / withdrew.
Sortable on every column. Filters from the dashboard B.2 carry over here.
## D.2  Prospect detail panel
Opens when Kevin clicks a prospect name.
- Identity: name, contact info, inviting BA, sponsor at invite, position in queue.
- Full activity timeline: every event in this prospect’s lifecycle in chronological order. Timestamps, event types, source IPs (for clicked events, used to detect duplicate-tab artifacts), referrer.
- Token details: the token itself (truncated for display), mint date, expiry date, current status.
- Sponsor-routed URL inspection: the full URL, the resolved BA at mint time, the resolved BA right now (these should match — if they don’t, it surfaces as a discrepancy).
- Callback request details (if any): the three radio choices, phone, best time, submitted timestamp.
- Webinar reservation details (if any): the event date, registration timestamp.
- Enrollment details (if marked enrolled): the date the BA marked it, link to the BA’s record.
- Notes — Kevin’s private notes on this prospect (free-text, append-only). Separate from the BA’s notes on the same prospect, which live in the BA’s cockpit and are not visible here.
## D.3  What is not shown
- No prospect score. No income-potential ranking. No qualification rating. No AI-generated coaching about this prospect.
- The activity history is the activity history. Kevin reads it; the system does not interpret it for him.
## D.4  Cross-team holding tank intervention — BA-requested
Kevin has full intervention authority over any prospect in any BA’s pipeline. The authority exists for BA-requested emergencies and is used only when the situation cannot be resolved through normal BA action.
Available interventions:
- Move a prospect from one BA’s pipeline to another’s. (Reassigns the inviting BA on the prospect record.)
- Reassign the sponsor on a prospect record. (Separate from the BA reassignment above.)
- Manually flush a prospect from the holding tank before the 8-week window expires.
- Force-enroll a prospect (mark them enrolled even if the BA has not yet marked them).
Every intervention follows the same flow:
- Kevin opens the prospect detail panel and selects the intervention.
- Form requires the requesting BA’s ID, the reason in Kevin’s words, and any intervention-specific fields.
- Confirmation modal with before-and-after.
- On submit: triple-stack write, audit log entry with full before-state, after-state, requesting BA, reason, and timestamp.
- Position number in the queue is preserved per the monotonic rule — a flush vacates the slot but no other positions reshuffle. A move keeps the same position number; only the inviting BA changes.


# E.  Queue / Recruitment Leg Oversight
Kevin’s view of the pool that prospects see on .com. Monitor placements, depth, ticker, and the rules that govern the queue.
## E.1  Queue depth and movement
- Current queue depth: total count of prospects currently in the holding tank.
- Today’s placements (count).
- Today’s flushes (expirations and manual flushes, counted separately).
- Today’s enrollments.
- Net queue movement (placements minus flushes minus enrollments).
## E.2  Fixed assigned queue numbers
Queue numbers are monotonic. The number is timestamp-anchored to the prospect’s entry into the team’s growth at video_complete and never reshuffles.
- Highest position number minted today.
- Highest position number ever minted (the running total of placements over the lifetime of the team).
- Vacant slots count (positions where a prospect was flushed or enrolled and the slot is now empty in the visible line).
- Position lookup: type a number, see the prospect at that position with full activity history.
## E.3  Visible window on .com
- The number of position cards that render on the prospect dashboard’s position stack (open question J.6 in COM Design: 5 / 10 / 20). Kevin sets this here; the .com surface reads the setting at page render.
- Preview link: a sandboxed preview of how the position stack looks right now with the current setting, against the current queue state.
## E.4  Recruitment Leg movement
- The "one huge growing team leg" visualization that fronts .com is generic and does not show binary leg structure (locked Chat #85).
- This admin surface, however, shows movement against Team Magnificent’s overall growth: rolling 7-day, 30-day, and lifetime counts of new placements, animated as a sparkline.
- No binary leg detail. No comparison to other teams. No comp math.
## E.5  Rolling ticker activity
- The same ticker that runs on the .com prospect dashboard, mirrored here for Kevin’s inspection.
- Difference: in /admin Kevin sees real names, not initials or anonymized city/state.
- Kevin can click any ticker entry to open the prospect detail panel (Section D.2).
## E.6  Queue rules (admin-managed)
- The 8-week flush window — the duration after video_complete that an unconverted prospect record is automatically flushed. Default 8 weeks. Open question whether this is adaptive or fixed (carried forward from COM Design).
- Position stack visible window (E.3).
- Ticker refresh cadence.
- Behind-you counter update interval (SSE versus short-poll, open question carried forward from COM Design).
- Each rule has Kevin’s current setting, a default, and an audit trail of when it was changed and why.
## E.7  Required disclaimer (always attached)
Queue positions and momentum displays demonstrate team activity in real time and do not guarantee any final placement, compensation, or earnings outcome. Market figures cited from public sources are for context only. This page contains no income claims, placement promises, or guarantees of any kind.
The disclaimer is shown on every prospect-facing queue view. The admin surface mirrors the disclaimer to make it visible to Kevin so he never forgets what the prospect-facing rules are.


# F.  Tenant Architecture
Single tenant. Team Magnificent is the only master tenant. There is no multi-tenant abstraction in the data model and no tenant scoping in routes. This section is where Kevin manages the one master tenant’s settings and the replication scope underneath it.
## F.1  Master tenant settings
- Tenant name: Team Magnificent.
- Tenant primary domain: teammagnificent.team.
- Tenant prospect-facing domain: teammagnificent.com.
- Compliance posture: locked, with a read-only display of the current rule set.
- Brand tokens: ink, gold, gold-bright, teal, cream, displayed with current values and a read-only flag (changing brand requires a deploy, not an admin click).
- Standing rules: THREE-final-authority, sponsor immutability, monotonic queue, 8-week flush, brand isolation on .com — displayed with last-confirmed-date.
- Leader detection threshold: the activity-level threshold that triggers system-detected leader tagging (Section G.2). Default values for invite count, training completion, and prospect conversion rate. Editable here; every change audited.
## F.2  Replicated BA sponsor-site templates
- The template that every BA’s replicated /p/{token} page is rendered from.
- Preview of the template (sandboxed).
- List of fields the template interpolates: prospect first name, inviting BA full name, inviting BA voice copy.
- No BA-level customization of the template is permitted (locked Chat #85). Kevin manages the master template here; all BAs inherit it.
- Audit log of every template change.
## F.3  Sponsor-routed URL structure
- Pattern: https://teammagnificent.com/p/{token}
- Token format and length (open question in Signup Architecture, referenced here).
- Token mint endpoint, server-side.
- Token resolution rules: which prospect record the token resolves to, which BA the token resolves to, what state-machine state the page renders in based on the token’s current status.
- Read-only in this surface; URL structure changes require a deploy.
## F.4  Role permissions and data boundaries
- Two roles: BA (regular Brand Ambassador) and Admin (Kevin only, currently).
- What BA role can do: covered in the TEAM Design document. Read-only summary here.
- What Admin role can do: covered in this document. Read-only summary here.
- Data boundaries: BA sees only their own prospect list, their own cockpit data, their own training progress, their own sponsor card. Admin sees everything.
- Role assignment: env var only (Section A.2). No UI flow.
## F.5  Master content inheritance
- Content every BA’s view inherits from the master: the presentation page copy, the dashboard six-section copy, the training module copy, the Michael interview prompts, the Ivory prompt library, the ScriptMaker templates.
- Content changes happen at the master level and propagate immediately to every BA’s view on the next page load.
- No BA can edit or override master content (locked Chat #89: limit BA-level personalization).
- Master content saves are validated against the compliance rule set at save time. Saves that fail validation are rejected with a specific reason.
- Audit log of every master-content change.
## F.6  Compliance rule inheritance
- The compliance rules (no income claims, no placement promises, no AI prospecting, no comp math, no current headcount on .com) live at the master tenant level.
- Every prospect-facing surface inherits the rules and enforces them on render. Content that fails the render check returns a server error before reaching the prospect.
- The invitation agent (ScriptMaker) reads the rule set at script-time and refuses to produce drafts that violate it.
- Rule changes are versioned. Audit log shows every change.


# G.  Kevin-Only Broadcast
Admin-only broadcast module. Not available to any BA, not even leaders. Kevin composes a message, picks an audience, picks channels, and sends.
## G.1  The composer
- Subject field (required for email, optional for text).
- Message body (rich text for email, plain text for SMS — character counter visible).
- Personalization tokens supported: {first_name}, {last_name}, {ba_id}, {access_code}. Server-side interpolation per recipient at send time.
- Preview pane: renders the message as one selected recipient would receive it.
## G.2  Audience selector
- All active BAs — every BA in Team Magnificent whose status is active.
- First-72-hour BAs — every BA whose signup timestamp is less than 72 hours old.
- Leaders only — dual-defined per Chat #89:
- System-detected leaders: BAs whose activity in the last 30 days crosses the configurable threshold set in F.1 (invite count, training completion, prospect conversion rate).
- Kevin-curated leader list: Kevin tags BAs as leaders in BA Oversight (a toggle on the BA profile, Section C.4). The tag persists until Kevin removes it.
- When Kevin picks "leaders only" for a broadcast, he sees both lists side-by-side and selects which one (or both, or a subset) receives this specific broadcast.
- At-risk BAs — Kevin-curated list per Chat #89 (no algorithmic flagging). BAs Kevin has tagged in BA Oversight as needing encouragement.
- Custom audience — hand-pick recipients by name from the BA directory.
- Recipient count is displayed live as Kevin builds the audience.
## G.3  Channel selector
- Email — sent via the chosen email provider (open question: Resend / Postmark / SendGrid / SES).
- Text — sent via Telnyx (the same channel that delivers callback alerts and signal events).
- Both — send the same message via both channels; recipient receives the email and the SMS.
## G.4  Send test to Kevin
- Sends one copy of the message, interpolated for Kevin, to his own email and/or phone.
- Always available before queuing the real broadcast.
- Test does not write to the broadcast audit log as a real send — logged separately as a test.
## G.5  Queue master broadcast
- Queues the broadcast for delivery. Confirmation modal lists audience count, channels, subject, and a final preview render.
- On confirm: triple-stack write of the broadcast record, an outbound queue entry per recipient per channel, and an audit log entry.
- Delivery is asynchronous — the queue processes recipients in batches.
- Delivery status is visible in real time in the broadcast detail view (per-recipient send / delivered / bounce / failed counts).
## G.6  Audit / consent guardrail
- Every broadcast is logged. Every draft, test, queue, and send is a separate audit entry.
- Consent guardrail: BAs gave consent to be contacted when they signed up. The signup consent terms are referenced in the broadcast confirmation modal so Kevin knows the recipients have consented.
- Unsubscribe / opt-out links are included on every email broadcast. SMS broadcasts include the STOP keyword instruction. Recipients who opt out are excluded from all future broadcasts automatically; the opt-out is permanent until they re-opt-in.


# H.  Live Operations
Replaces the earlier Compliance Review surface considered before Chat #89. Kevin’s deep operational view of the system as it runs: real-time usage, growth stats, prospects in process, holding tank state, and conversion rates with toggleable funnels. The Core Dashboard (Section B) is the at-a-glance view; Live Operations is the deep dive.
Compliance enforcement is not in this surface. Compliance is enforced at the invitation agent (script-time) and at the platform layer (render-time). Kevin sees aggregated metrics on enforcement here — not a queue of individual items to review. See the "Where compliance enforcement lives" section earlier in this document.
## H.1  Real-time usage strip (top of screen)
- Active users on .team right now (BAs logged in, with last-action-within-5-minutes).
- Active sessions on .com right now (prospects viewing presentation or dashboard).
- Events per minute (rolling 5-minute average): the rate of triple-stack writes across the system.
- Gateway response time (rolling 1-minute p50 and p95).
- Each metric is a live tile, updating via SSE.
## H.2  Growth stats (cards beneath the strip)
- Total BAs in Team Magnificent (live count).
- Prospects in process (currently in the holding tank).
- Prospects this week (placements over the last 7 days).
- Enrollments this week.
- Net growth this week (new BAs minus departures).
- Average prospects per active BA (current 30-day rolling).
- Average days from invite to enrollment (current 30-day rolling).
## H.3  Holding tank state (live grid)
- A grid of every prospect currently in the holding tank, color-coded by days-since-placement.
- Hover any cell to see prospect name, inviting BA, position number, and current status.
- Click any cell to open the prospect detail panel (Section D.2).
- Color thresholds (visual only, not algorithmic flagging): green = 0–7 days, gold = 8–28 days, deeper gold = 29–56 days. No prospect is hidden from view based on these thresholds.
- Sort options: by placement date, by inviting BA, by most recent activity, by registration handoff state.
## H.4  Conversion funnels — toggleable
Two funnels, toggle button at the top of the panel. Kevin picks which one he is looking at; both share the same chart pattern and the same time-window selector.
### H.4.1  Prospect funnel (toggle: Prospects)
- Stage 1: Invited (tokens minted).
- Stage 2: Link clicked (token resolved at /p/{token} for the first time).
- Stage 3: Video started.
- Stage 4: Video complete (placement in the holding tank).
- Stage 5: Callback requested OR webinar reserved (either signal converts).
- Stage 6: Enrolled (BA marked the prospect as enrolled).
- Funnel chart shows count and percent at each stage with conversion rate stage-to-stage on hover.
- Time-window selector: last 7 days, last 30 days, last 90 days, lifetime, custom range.
- Filter by inviting BA: scope the funnel to one BA’s prospects. Useful for coaching specific BAs.
### H.4.2  BA activation funnel (toggle: BAs)
- Stage 1: BA signed up.
- Stage 2: BA completed welcome.
- Stage 3: BA completed Michael interview.
- Stage 4: BA minted first invite.
- Stage 5: BA had a prospect reach video_complete.
- Stage 6: BA had a prospect enrolled.
- Funnel chart shows count and percent at each stage with conversion rate stage-to-stage on hover.
- Time-window selector: cohort by signup month, last 30 days, last 90 days, lifetime.
- Drilldown: click any stage to see the list of BAs at that stage who have not advanced.
## H.5  What Live Operations does not show
- No individual compliance-review queue items. Compliance is enforced upstream and Kevin reads aggregated metrics here.
- No prospect scoring. No BA scoring. No income-potential ranking. No automated outreach suggestions.
- No metrics that violate the boundary stated at the top of this document.


# I.  Reporting / Analytics
The reporting surface. Live Operations (Section H) is the live state; Reporting is the historical view with export. Same boundary applies: analytics are for coaching and operational improvement, never for prospect scoring or automated outreach.
## I.1  Report library (the standard reports)
- BA activation report: signups, welcome completion, Michael interview completion, first invite, first prospect to video_complete, first enrollment, with cohort-by-month breakdown.
- Training completion report: Fast Start Module 1–5 completion percent, 10-step orientation completion, average days from signup to each milestone.
- Invite-to-presentation movement: token mint → link clicked → video started → video_complete, with stage-to-stage conversion rates and average days at each stage.
- Queue velocity: placements per day, flushes per day, enrollments per day, net change per day, with rolling 7-day and 30-day averages.
- Registration handoff completion: prospects marked enrolled per BA, per day, per cohort.
- Follow-up aging report: open follow-up reminders across all BAs, bucketed by age (0–3 days, 4–7 days, 8–14 days, 15+ days).
- Compliance enforcement count: drafts auto-corrected by the invitation agent, master-content saves blocked, render failures — per day, per week.
- Exception dashboard: anything that triggered a discrepancy, an override, a manual intervention, or a compliance block. Searchable, filterable, exportable.
- Leader scorecards: per leader, the metrics that justify their leader status (system-detected and/or Kevin-curated) and their team’s downstream activity. Used for Kevin’s coaching conversations, not displayed to the leader.
## I.2  Basic vs advanced analytics
- Basic analytics: the standard reports above, run on demand against the live data.
- Advanced analytics: custom queries Kevin builds with a query builder UI (filter by any field combination, group by any field, time-window any range). Saved queries appear in the report library.
## I.3  Print master report
- Print-friendly composite of every standard report for a chosen time range.
- Renders as a single PDF, brand-locked Team Magnificent header, ready to share with Paul or to file as a snapshot.
- Includes a generation timestamp and a hash of the source data so the report can be verified later.
## I.4  CSV / export
- Every report supports CSV export of the underlying records.
- Exports are logged in the audit trail with the requesting BA (Kevin), the report name, the filters applied, the record count, and a hash of the exported file.
- Sensitive data in exports (prospect phone numbers, prospect email addresses) is redacted unless Kevin explicitly opts in per-export with a confirmation modal.
## I.5  What Reporting does not produce
- No prospect-scoring reports.
- No income-potential rankings.
- No automated outreach lists.
- No BA performance scores. The data is in the reports; Kevin reads it.


# J.  Audit / Controls + Open Questions
The audit log is the substrate every other surface writes against. Open questions are the decisions still unresolved.
## J.1  The audit log
- Append-only. Even Kevin cannot delete entries.
- Every triple-stack write generates an entry.
- Every /admin request (success or 403) generates an entry.
- Every action initiated from /admin that mutates a record generates an entry with full before-state, after-state, requesting BA (for BA-requested overrides), Kevin’s reason, and timestamp.
- Every report generation and export generates an entry.
- Every broadcast draft, test, queue, send, and per-recipient delivery generates an entry.
- Every queue rule change, compliance rule update, and master content save generates an entry.
- Every Michael interview completion generates an entry with a link to the transcript.
## J.2  Audit log views
- By actor: every entry where the actor was a specific BA (or Kevin).
- By role: every entry from BA-role actions or Admin-role actions.
- By action: filter to a specific action type (sponsor override, holding tank flush, master content save, etc.).
- By entity: every entry that touched a specific BA record, prospect record, queue position, broadcast, etc.
- By timestamp: range query.
## J.3  Before / after state on important edits
- Sponsor overrides: before sponsor, after sponsor, requesting BA, reason.
- Holding tank interventions: before state of the prospect record, after state, requesting BA, reason.
- Queue rule changes: rule name, before value, after value, Kevin’s reason.
- Compliance rule updates: rule version before, rule version after, change description.
- Master content saves: previous content hash, new content hash, content diff, validator result.
## J.4  Michael transcripts (linked from audit, not a separate tab)
- Earlier versions of this document considered a separate Michael Transcripts tab. Locked Chat #89: the transcripts are accessed by clicking the audit log entry for the corresponding interview completion event, or by clicking the link from the BA profile (Section C.4). No separate tab in the sidebar; the transcripts live as audit-log-linked records.
- Transcript view: full text, timestamps, audio playback if recording was retained, the scoring Michael captured (sponsor-visible only, never visible to the new BA themselves).
## J.5  Open questions
- J.5.1  Email provider — Resend, Postmark, SendGrid, or AWS SES. Carried forward from COM Design and Signup Architecture. Required before Broadcast (Section G) can be wired.
- J.5.2  Holding tank flush window — adaptive (varying by BA or prospect intent) or fixed for everyone. Carried forward from COM Design. Required before Queue rule management (Section E.6) is wired.
- J.5.3  Behind-you counter update interval — SSE versus short-poll. Carried forward from COM Design. Architectural choice affects Live Operations (Section H) live tiles too.
- J.5.4  Market / geographic tracking — do BAs and prospects carry market/region as a tracked dimension? Filters in dashboard (B.2) and reports (I.1) reference it; needs Kevin’s decision on whether to collect it.
- J.5.5  Access code format — 2, 3, or 4 chars wide. Carried forward from Signup Architecture. The Tenant Architecture URL structure (Section F.3) and the audit log entries for code generation depend on it.
- J.5.6  Position stack visible window — 5, 10, or 20 cards on .com. Carried forward from COM Design. Kevin sets this in Section E.3 once chosen.
- J.5.7  Leader detection threshold values — the activity thresholds (invite count, training completion, conversion rate) that trigger system-detected leader tagging. Default values needed before F.1 leader detection is wired.
- J.5.8  System-detected leader threshold lookback window — last 30 days is the working assumption, but could be 7, 14, 60. Kevin’s call.
- J.5.9  Compliance enforcement granularity — the invitation agent and platform-layer enforcement need a master rule list with severity (block, warn, log). The rule list and severities are the current locked-spec compliance posture, but the exact mapping of each rule to one of the three severities is open.
- J.5.10  Export PII redaction default — phone and email redacted by default with opt-in per export (locked in I.4) — should Kevin also be able to set a persistent "show me everything" preference, or always require the per-export confirmation?
## J.6  Build sequence recommendation
Each of the nine surfaces can ship independently once the BA-ID gate (Section A) is live. Kevin’s call on order, but the natural dependency chain is:
- 1. Section A (gate) — required before anything else.
- 2. Section J.1–J.3 (audit log substrate) — every other surface writes against it.
- 3. Section B (Core Dashboard) — the home surface, lowest-risk to ship.
- 4. Sections C and D (BA Oversight, Prospect Oversight) — the directory surfaces.
- 5. Section E (Queue Oversight) — builds on the prospect directory.
- 6. Section H (Live Operations) — depends on the audit log and the live event stream.
- 7. Section I (Reporting) — depends on the audit log and historical data accumulation.
- 8. Section F (Tenant Architecture) — can ship anytime; mostly read-only display.
- 9. Section G (Broadcast) — last, because email provider and Telnyx wiring must be in place.


# Closing
Nine surfaces. One operator. The /admin route exists so Kevin can see everything that is happening across Team Magnificent and intervene only when a Brand Ambassador asks him to. The boundary holds: analytics for coaching, no prospect scoring, no automated outreach, no algorithmic flagging of BAs. The override authority on sponsor and on holding tank entries exists as a safety lever for BA-requested emergencies, not as a routine tool. THREE International is the final authority on everything that touches placement and compensation; Team Magnificent’s records mirror THREE’s.
When this document is complete and the open questions in Section J.5 are resolved, the four-document set (App Description, COM Design, TEAM Design, Signup & Architecture, ADMIN Design) is the locked specification for the Team Magnificent Marketing Momentum Creation System.