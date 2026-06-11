<!-- converted from Team-Magnificent-TEAM-Design.docx -->

TEAM MAGNIFICENT
teammagnificent.team
Surface Design Document
Login, welcome, Michael, Fast Start, orientation, invitations, cockpit, .com preview, profile.
The Brand Ambassador-facing side of the system.
Prepared for: Kevin L. Gardner, Founder, Team Magnificent
Companion to the COM Design and Signup & Architecture documents

# How to read this document
This is a readback of the .team surface design as discussed across Chats #82, #84, and #85 and the verbatim BA-experience descriptions captured in project knowledge. It is not a build plan. Nothing in it is built until Kevin says it is right.
Kevin’s options after reading:
- Mark up the document with corrections, missing pieces, anything that is wrong.
- Answer the open questions in Section J, or leave them open with a note that they are unresolved.
- Decide which surface to build first — the cockpit (Section H), the invitation generator (Section G), or the welcome+Michael path (Sections C and D), since each can ship independently once the signup gate (Signup & Architecture document, Section A) is live.

## The standing rule, in Kevin’s words
and it should never conflict with three international only mirror. if there is a conflict or dispute three international is the final authority
THREE International is the single source of truth and the final authority on sponsorship, enrollment, placement, and compensation. Every record described in this document mirrors THREE’s records for Team Magnificent’s own operational visibility. The Team Magnificent app never disputes or overrides THREE. If at any point our records differ from THREE’s records, we update ours to match.
Compliance posture for .team. The .team surface is for already-enrolled Brand Ambassadors. Income, compensation, cycles, rank progression, and volume math may appear inside .team in a training context — because the audience has already enrolled under THREE’s policies and procedures. None of it appears on .com. The two surfaces are kept clean of each other.


# A.  The .team login page
Every returning Brand Ambassador hits this page first. Signup is covered in the Signup & Architecture document, Section A, and is not duplicated here. This section is only about returning users.
## A.1  Where it lives
- Route: teammagnificent.team/login.
- Public, no auth required.
- No SEO indexing — robots: noindex, nofollow.
- Linked from /register (“Already have an account? Sign in.”) and from the welcome email new BAs receive.
## A.2  Page sections, top to bottom
### Header strip
- Team Magnificent wordmark in gold, top-left.
- No nav. The page does one thing.
### Eyebrow + headline
- Eyebrow: “Team Magnificent · Brand Ambassador” in gold mono, uppercase, letter-spaced.
- Headline: “Sign in.” in Bebas Neue, very large.
- Sub-line: “Welcome back. Sign in to your Team Magnificent cockpit.”
### The form (single column, vertical stack)
- Email — email input. The login identifier. Validated for format.
- Password — password input with a show/hide toggle.
- Remember me — optional checkbox. When checked, the JWT cookie persists for 30 days; otherwise it expires when the browser session ends.
- Submit button — “Sign in” in gold. Disabled until both fields are non-empty.
### Below the form
- “Forgot password?” link → /forgot-password.
- “Have an access code? Create your account.” link → /register.
### Footer
- Single compliance line: “Team Magnificent is an independent operational team inside THREE International.”
## A.3  What happens when the form is submitted
Client POSTs to /api/auth/login. The server runs:
- Look up BA by email.
- If not found, return generic “invalid credentials” — do not reveal whether the email exists.
- Verify the password hash (bcrypt or argon2id).
- On success, issue a JWT and set it as an http-only cookie. Cookie lifetime depends on Remember me.
- Write a login event to the audit log: BA ID, IP, user agent, timestamp.
- Return success. Client redirects to /cockpit.
## A.4  Failure modes the user sees
- Invalid credentials — red banner at the top of the form, “Email or password is incorrect.” Generic message; do not differentiate.
- Account deactivated — specific message: “This account is no longer active. Contact your sponsor or Team Magnificent support.”
- Too many attempts — after 5 failed attempts in 10 minutes, lock the account for 15 minutes and show “Too many attempts. Try again in 15 minutes.” Audit-log every lockout.
- Network or server error — generic banner: “Something went wrong. Please try again.”
## A.5  Forgot password flow
Straightforward flow, dependent on the email provider choice (Signup & Architecture, Section E.6):
- User enters email at /forgot-password.
- Server always returns the same response — “If an account exists, we have sent a reset link.” — to avoid enumeration.
- If the account exists, send a reset email with a single-use, time-limited token in the URL.
- Reset URL: /reset-password?token=…. Token expires after 1 hour.
- User clicks the link, lands on the reset form, enters and confirms the new password.
- Server validates the token, hashes the new password, invalidates the token, audit-logs the reset, redirects to /login.


# B.  Signup
The .team signup page — every field, every validation, the access-code mechanism, and the submit-side server sequence — is specified in full in the Signup & Architecture document, Section A. It is not repeated here.
Two things to remember at the .team surface:
- Signup is invitation-only. Without a valid access code from a sponsoring BA, no signup is possible. There is no public marketing entry point to .team.
- Sponsor binding is immutable. The access code used at signup determines the new BA’s sponsor on Team Magnificent’s operational record. That sponsor cannot be edited later. Same rule as prospect sponsor immutability on .com.
See: Signup & Architecture, Section A. Field list, validation rules, real-time access-code verification, server sequence on submit, what the user sees on each failure mode, sponsor immutability, no-silent-partial-records rule.


# C.  The welcome screen
Immediately after a new BA submits the signup form successfully and receives their JWT, they land at /welcome. This is the first page the BA sees inside the authenticated app. It is the first piece of evidence — in their hands, on their screen — that Team Magnificent is real, that the system is theirs, and that something is already happening for them.
## C.1  Purpose
- Mark the moment. The BA just made a decision — acknowledge it with the weight it deserves.
- Set expectations for the next 30 minutes — Michael calls, Fast Start begins, the cockpit unlocks.
- Capture the BA’s commitment by having them read and accept a brief signed welcome note.
- Hand them off to the Michael interview path with zero confusion about what to do next.
## C.2  Page sections, top to bottom
### Hero strip
- Background: deep ink (#0A0A0A) with a single gold compass-rose mark, centered, softly glowing.
- Eyebrow: “Welcome to Team Magnificent · [BA First Name].”
- Headline (Bebas Neue, very large): “You just hit the lottery of network marketing success.”
- Sub-line: “You joined a team that builds people before it builds volume. Here is what happens next.”
### The signed welcome note
Below the hero, a centered, framed block in cream-on-ink that reads like a letter from Kevin and Paul:
You joined Team Magnificent. You are committed to magnificent results in compensation, ranks, leadership, and massive fast momentum. Professionals use tools. Amateurs are trying to sell. We do great deeds. We don’t just plan — we execute. We are in massive exponential growth and momentum. Welcome to 21st-century AI-empowered network marketing. The speed of the leader is the speed of the group. Success loves speed — run with alacrity. — Kevin L. Gardner and Paul Barrios.
- Below the note, a single primary action: “I accept. Let’s begin.”
- On click, the system writes an audit-logged commitment record: BA ID, timestamp, IP, user agent. This is the BA’s on-record agreement to the team’s working principles.
### What happens next — the path of the next 30 minutes
A three-step strip below the welcome note showing the immediate path forward. Each step is a card with a number, a title, and a one-line description.
- 1. Michael calls you. Within the next few minutes, Michael Magnificent will call your phone to welcome you to the team and conduct a short interview. Stay near your phone.
- 2. Your Fast Start Guide unlocks. A 72-hour guided path — product, compensation, the binary, your first prospect list, your first two candidates.
- 3. Your sponsor walks the 10-step orientation with you. Live with Kevin or Paul, scheduled from inside .team.
### Continue button
- A single primary CTA at the bottom: “Continue to my cockpit” in gold.
- Click sends the BA to /cockpit. The cockpit shows the new-BA shell (Section H) with the Fast Start Guide ready in the left rail and a banner across the top: “Michael will call you at [phone] in the next few minutes. Please stand by.”
## C.3  What the server does on /welcome load
- Enqueue the Michael outbound-call job, scheduled for [delay] after welcome-load timestamp.
- Trigger the welcome email (Signup & Architecture, Section A.4, step 9).
- Mark welcome_seen = true on the BA record with welcome_seen_at.
- Audit-log: welcome_screen_displayed.
## C.4  What the server does on “I accept” click
- Triple-stack write of a commitment record: MongoDB ba_commitments, Neo4j (:BA)-[:ACCEPTED]->(:Commitment{version, accepted_at}), ChromaDB indexed for retrieval.
- Mark commitment_accepted = true on the BA record with commitment_accepted_at.
- Audit-log: welcome_commitment_accepted.
Open question — J.4. Should the welcome screen require the BA to type their name as a signature, or is a click-acknowledge sufficient? Click is simpler; typed signature is heavier and more deliberate.


# D.  The Michael Magnificent interview — BA-facing surface
Michael is not a chat agent. Michael is the outbound voice that calls every new BA shortly after signup, conducts a short structured interview, and feeds the transcript and scoring back into the BA’s record and their upline cockpit. The BA-facing surface inside .team is the visual companion to that call — not a replacement for it.
## D.1  Michael, in the language of the system
Michael Magnificent is the onboarding voice. When a brand new BA gets enrolled, Michael calls them within minutes — not to teach the comp plan, but to teach Layer 1. “You joined Team Magnificent. Here’s how this works: you have two legs. You need to find two people. The team grows beneath you. Here are your tools. Your sponsor will help you with the rest.” Comp plan deferred until the BA has signed two people and earned enough conviction to want to know more.
Verbatim from project knowledge, captured in the locked description of the agents’ roles.
## D.2  Where Michael lives in .team
- Route: teammagnificent.team/michael.
- Authenticated. JWT required.
- Linked from the welcome screen continue path and from a persistent card in the cockpit until the interview is complete.
## D.3  Three states of the Michael page
### State 1 — Awaiting call
From the moment the BA accepts the welcome through the moment Michael’s outbound call rings their phone. The page shows:
- Status pill (gold): “Michael will call you shortly at [BA phone number].”
- A live waiting indicator — a soft pulsing dot, the kind of detail that signals “system is working, stand by.”
- A one-line context note: “Michael conducts a short voice interview to help your sponsor know how to support you best. The call usually takes 5 to 8 minutes.”
- A small button beneath: “My phone number is wrong — update it.” Links to the profile page.
### State 2 — Call in progress
From the moment Michael’s call connects (detected via Telnyx webhook) through the moment it disconnects. The page shows:
- Status pill (teal, pulsing): “Michael is on the line with you.”
- A live transcript view, populated in near-real-time from the speech-to-text stream. Each utterance appears as it is recognized, with speaker labels (Michael / You).
- No action buttons. The BA is on a phone call — the surface is observational, not interactive.
### State 3 — Call complete
From the moment the call ends. The page shows:
- Status pill (gold check): “Interview complete.”
- A summary block: the BA’s answers to each of Michael’s structured prompts, rendered as a clean readback.
- A signed-by line from Michael: “Captured by Michael Magnificent · [date/time].”
- A note: “Your sponsor [Sponsor Name] now has this context. They will reach out as part of the 10-step orientation.”
- A primary CTA: “Continue to the Fast Start Guide.” Links to /fast-start.
## D.4  What Michael captures
Michael’s script is locked separately and lives in the agent prompt store (kevin_library, id nwm_strategist_gateway_prompt_v1 family). The .team surface displays the captured answers, not the script itself. Captured fields include:
- Why are you doing this business? (open answer, voice transcribed)
- What does success in the next 12 months look like for you? (open answer)
- How many hours per week can you commit to building this? (open answer, normalized to a numeric range)
- Have you built a network marketing business before? (yes / no plus optional detail)
- Anything you want your sponsor to know about you that will help them support you well? (open answer)
Open question — J.5. Are these the right five prompts, or does Kevin have a script document already drafted that should replace this list verbatim?
## D.5  Fallbacks
- BA does not answer Michael’s call. Michael leaves a voicemail (script TBD) and tries again 30 minutes later. After two failed attempts, the system emails the BA a link to a written version of the same five prompts and sends an SMS link to the same form.
- BA phone number is invalid. Telnyx returns an undeliverable error. The system flags the BA record, surfaces a banner in their cockpit “We could not reach you at [phone]. Please update your number.”, and pauses Michael’s queue for that BA until the number is fixed.
- BA closes the page during the call. The transcript continues to capture server-side. Reopening /michael resumes State 2 with the transcript caught up. The call does not depend on the page being open.
- Speech-to-text fails. The call audio is captured to a Telnyx recording URL. The page shows “Transcript unavailable — your sponsor has the audio.” The audio is attached to the BA’s record and available to the upline cockpit.
## D.6  What the upline cockpit sees
- A new BA event card appears in the sponsor’s cockpit when Michael’s call completes: “[New BA Name] completed their Michael interview.”
- The card expands to show the captured answers and a link to the audio.
- Scoring (intent strength, time commitment classification, prior experience) is calculated by Michael and surfaced as small tags on the card.
Compliance. Scoring is internal context for the sponsor only. It never appears on the new BA’s own screen, in any prospect-facing surface, or in any compensation calculation. It is operational — not a rating, not a judgment, not a placement input.


# E.  The Fast Start Guide
The Fast Start Guide is the BA’s first 72 hours, structured. It is the path from “I just joined” to “I sent my first invitation.” Everything else in .team can wait — this cannot.
## E.1  Purpose, in one paragraph
A new BA who finishes Michael’s interview is fired up but has no operating procedure. The Fast Start Guide gives them five things in order: enough product knowledge to share without misrepresenting, enough comp-plan structure to know what they’re building, the binary explained as two legs not a tree, a tool to identify the first 20–30 names in their warm market, and a clear pointer to their first two candidates. By the end of 72 hours the BA has identified their first two people, sent their first invitations, and has prospects in the holding tank.
## E.2  Where it lives
- Route: teammagnificent.team/fast-start.
- Authenticated. Unlocked the moment the welcome screen is accepted.
- Visible as a persistent rail in the cockpit until all five modules are marked complete.
## E.3  Structure
Five modules, sequential but not gated. A BA can move freely between them — the system tracks completion and surfaces the next unfinished module on cockpit load. Each module is a single scrollable page with a defined start and end.
### Module 1 — The product
- Lead with Dr. Dan’s 17-minute video (same video the prospect sees — the BA needs to be fluent in it).
- Product detail: GLP-THREE, what it is, the six-pillar differentiation (patented, clinically tested, scientifically researched, all natural, first in marketplace, PDR listed).
- Dosage: 3/4 of a dropper, 30 minutes before a meal. Sourced directly from Dr. Dan transcripts; do not paraphrase.
- Kevin’s testimonial as the canonical example: 14 lbs in 6 weeks, inches off neck, belly, waist. “I ran out because it was working.”
- Compliance reminder: testimonials are personal results. No claims about average outcomes; no medical claims.
- Completion: a single-question check (“Can you tell someone in 30 seconds what GLP-THREE is and why it’s different?” — yes/no self-report) and the module is marked complete.
### Module 2 — The compensation plan, Layer 1 only
Compliance. The Fast Start Guide intentionally does not teach the comp plan in depth. Layer 1 (placement and structure) is taught here. Layer 2 (cycle math, rank progression, income strategy) is a separate progressive module the BA opens when they are ready — usually after their first cycle hits.
- You have two legs. Left leg, right leg. That’s it.
- Every new BA you sponsor goes into one of your two legs. You decide which leg, based on the team’s placement strategy.
- When your legs grow, you earn. The deeper the math is handled by THREE — you do not need to calculate it. THREE’s back office is the authoritative source for your numbers.
- Your job: find two people. Help them find two people. Repeat.
- Completion: a single-question check (“Can you draw the picture of two legs and explain it in 60 seconds?” — yes/no self-report).
### Module 3 — The products beyond GLP-THREE
- A short page introducing the rest of THREE’s product line at a glance, with a link out to THREE’s product catalog for detail.
- Focus stays on GLP-THREE as the lead product. The other products exist; the BA does not need to be an expert in them on day one.
- Completion: scroll-to-end + acknowledge.
### Module 4 — Building your prospect list
- The frame: “Who do you know that…?” — a structured exercise that produces a list of 20–30 names in 20 minutes. This is the BA’s warm market starting point.
- The actual exercise is run by Ivory in the invitation generator (Section G). Module 4 introduces the concept and prompts the BA to open Ivory.
- Completion: the BA opens Ivory at least once and starts a Who Do You Know list (any length).
### Module 5 — Identifying your first two candidates
- From the list in Module 4, the BA picks two people they will personally invite first.
- Criteria the system surfaces (drawn from Ivory’s guidance): people you already have a real relationship with, people who would benefit from the product, peo ple you would not be embarrassed to share this with.
- Completion: two prospects are marked as “first candidates” in the BA’s CRM. (This is also the BA’s first interaction with the invitation generator.)
## E.4  Progress and gating
- Modules are sequential in the rail but not hard-gated — a BA who wants to jump to Module 4 can.
- Completion is tracked per module with a percent indicator in the cockpit.
- The Fast Start Guide is considered complete when all five modules are marked complete AND the BA has sent at least one invitation. “Sent an invitation” is the operational definition of “started.”
## E.5  Training accelerates, never gates
From project knowledge, verbatim: Training accelerates conviction-to-action time. It doesn’t gate it. A BA can recruit on day one with nothing but the invite link and their sponsor’s phone number. The training is what makes day-thirty-BA twice as effective as day-one-BA without burning the sponsor’s phone calls.
A new BA who is fired up and ready to invite their cousin Marcus before they finish Module 1 should be able to do exactly that. The cockpit always shows the invitation generator. The Fast Start Guide is the path — not the toll booth.


# F.  The 10-step orientation
Once the BA has completed the Fast Start Guide — or sooner, if the sponsor schedules it earlier — the 10-step orientation runs live with Kevin or Paul over Zoom. This is the deepening pass. The Fast Start gave the BA enough to start. The 10-step gives them the architecture.
## F.1  Purpose
- Replace the new BA’s assumed mental model of “network marketing” with the actual Team Magnificent operating model.
- Establish the human relationship between the new BA and the top of the team. Every BA, eventually, has met Kevin or Paul live.
- Address the questions the Fast Start Guide could not anticipate.
- Set the next 30-, 60-, 90-day expectation.
## F.2  How it is scheduled
- From inside .team, the BA sees a scheduling card in their cockpit: “Schedule your 10-step orientation with Kevin or Paul.”
- Calendar slots are surfaced from Kevin’s and Paul’s availability (mechanism TBD — Calendly-style embed, custom slot picker, or manual outreach).
- Confirmation goes to the BA’s email and adds a Zoom link.
- Sponsor is notified that their downline BA has scheduled the orientation — they are welcome to attend (and usually do).
## F.3  The 10 steps
Content lock. The actual content of each of the 10 steps is Kevin’s curriculum. This document describes the surface and the scheduling — not the curriculum. The curriculum is loaded into the orientation by the host (Kevin or Paul) live on the call.
- Step 1 — Welcome and personal context.
- Step 2 — Why Team Magnificent inside THREE International (the team’s positioning).
- Step 3 — Product mastery deep dive (beyond Fast Start Module 1).
- Step 4 — The binary, explained again, in more depth.
- Step 5 — The Power of 2 — why two committed people change everything.
- Step 6 — 2 in 72 — the rhythm.
- Step 7 — Your warm market and how to think about it.
- Step 8 — Your tools — .team, ScriptMaker, Michael, Ivory, the invitation generator, the cockpit.
- Step 9 — Compliance — what we do and do not say, in conversation, on social media, in messaging.
- Step 10 — Your next 30 days — specific, written, agreed-to plan.
Open question — J.6. Are these the right 10 steps in this order, or does Kevin’s curriculum use different titles, different order, or a different count? The 10-step framing came from prior chats; the actual content list above is a placeholder.
## F.4  After the orientation
- The orientation host marks the orientation complete in the BA’s record.
- The new BA’s cockpit removes the scheduling card and shows a small badge: “10-step orientation complete · [Date].”
- A follow-up note is added to the BA’s record summarizing the agreed 30-day plan from Step 10.


# G.  The invitation generator — the heart of .team
Every BA, every day, opens .team for one reason more than any other: to invite someone. The invitation generator is the engine. It is where Who Do You Know, ScriptMaker, the token-mint, and the personalized link all meet.
## G.1  Where it lives
- Route: teammagnificent.team/invitations.
- Authenticated. Always visible in the cockpit nav. Never gated behind training completion.
## G.2  The flow at a glance
- 1. The BA opens the invitation generator.
- 2. They either pick a name from their Who Do You Know list (Ivory-built) or start a fresh invitation by name and relationship context.
- 3. ScriptMaker drafts a personalized message script for that specific prospect.
- 4. The BA reviews and edits the script.
- 5. The BA confirms they have spoken with the prospect first (per Kevin’s rule, real human contact precedes the link).
- 6. On confirm, the system creates the prospect record, mints the invite token, and returns the personalized .com link with the token in the URL.
- 7. The BA clicks “I sent this” after texting or messaging the prospect.
- 8. The prospect appears in the BA’s CRM with status “link-sent.”
- 9. Every subsequent event (link clicked, video started, video complete, callback requested) updates the CRM and fires an alert to the BA.
## G.3  Ivory — the Who Do You Know surface
Ivory is the relationship coach. Helps the BA think through who to invite. “Who do you know that’s frustrated with their weight?” — the Who Do You Know game. “How do I invite my pastor?” — relationship-specific scripts. None of this requires comp plan knowledge. It requires people knowledge, which Ivory amplifies.
Verbatim from project knowledge.
### How Ivory works on .team
- Embedded panel inside the invitation generator, also accessible as a standalone route /ivory.
- Ivory asks structured questions one at a time: “Who do you know that’s frustrated with their weight?”, “Who retired in the last two years?”, “Who has wanted to start a side business?”, “Who is the most respected person in your phone?” — categories drawn from Kevin’s warm market framework.
- Each name the BA types is added to the Who Do You Know list with the category as a tag.
- Names persist. The list is the BA’s ongoing warm market roster, not a one-time exercise. Names can be marked invited, customer, BA, not-interested, follow-up-later.
- Ivory can also coach relationship-specific scripts on demand: “How do I invite my pastor?” Ivory drafts a script that respects the relationship context.
### What Ivory does not do
- Ivory does not call, text, or message anyone on the BA’s behalf. Ivory is a coach, not a robot.
- Ivory does not qualify prospects. No scoring of warmth, no prediction of conversion likelihood, no AI lead qualification — THREE’s policies forbid it and so does Team Magnificent’s posture.
- Ivory does not produce compensation or income content for prospects. The scripts Ivory drafts are conversation openers and relationship bridges, not pitches.
## G.4  ScriptMaker — the comp-plan translator and invitation drafter
ScriptMaker is the comp-plan translator. A BA tells ScriptMaker about a prospect (a doctor, a friend, a coworker — whoever) and ScriptMaker pulls in the prospect’s relationship context, the BA’s market and position, the comp plan math the BA doesn’t know yet, and compliance constraints (no income guarantees). It outputs a personalized earnings strategy in language the BA can use in conversation — without the BA needing to do the cycle math themselves. ScriptMaker is “Kevin on the phone yesterday with Timettra,” available 24/7 to every BA.
Verbatim from project knowledge.
### How ScriptMaker works on .team
- Embedded panel inside the invitation generator. The BA picks a name from the Who Do You Know list (or types a new prospect with name + relationship context) and ScriptMaker drafts.
- Inputs ScriptMaker uses: prospect name, relationship to BA, any context the BA provided (occupation, life situation, what they care about, prior conversations).
- Inputs ScriptMaker pulls from system context: BA’s market and position inside the team, the locked compliance constraints, the locked product narrative, the canonical objection responses.
- Output: a personalized invitation script the BA can copy, edit, and send. The script is conversational — it is not a pitch deck.
- Output also includes (for the BA’s reference, not for sending): a short “what to say if they ask about the money” talking-point block, compliance-safe, drawn from the comp plan but never quoting income figures.
### Script substitution and the token-link injection
- The script includes a placeholder for the personalized .com link — e.g. “…watch this 17-minute video: {{personalLink}}”.
- When the BA confirms the prospect record is real and they have spoken with the person, the system mints the invite token and substitutes {{personalLink}} with the real URL: https://teammagnificent.com/p/{token}.
- The substituted script is returned to the BA along with the prospect’s CRM record. The BA copies the script and sends it from their own messaging app — the system never sends on their behalf.
## G.5  The “I sent this” confirmation
- After the script is delivered, the BA sees a clear primary action: “I sent this to [Prospect Name].”
- Clicking it logs the invitation as sent, sets the prospect’s status to “link-sent,” and starts the activity timeline.
- If the BA needs to log an invitation they sent outside the generator (typed the link by hand into iMessage, for example), there is a standalone “Log an invite I sent” entry point in the invitations page — same effect, same prospect record creation.
## G.6  What is rendered when the prospect clicks the link
- The .com client at /p/{token} renders the presentation page personalized to the inviting BA (their name appears, the callback CTA names them). After video_complete the prospect is silently placed in the team-wide holding tank and sees the locked six-section dashboard.
See: Team-Magnificent-COM-Design.docx. The full .com surface is specified separately. The .team side cares about three things from the .com side: that the link works, that the events come back to the BA’s CRM in real time, and that the callback CTA on the dashboard fires an alert correctly.
## G.7  Compliance locks the invitation generator enforces
- Real human contact precedes the link. The flow has a hard step where the BA confirms they have spoken (text or call) with the prospect first. Cold-blast invitations are not the model.
- No automated outbound. The system does not text, call, or DM anyone. The BA sends the message from their own device.
- No mass send. The generator drafts one script for one prospect at a time. No CSV upload of names, no broadcast.
- No income content in the prospect script. ScriptMaker’s output for the prospect contains no specific income figures, no “you can earn” language, no comp-plan math. The BA’s internal reference talking points are separate from the prospect-facing script.


# H.  The BA cockpit
The cockpit is what the BA sees every time they sign in. It is their operational dashboard — not a duplicate of THREE’s back office. THREE shows organizational truth (volume, rank, cycles, paycheck). The cockpit shows operational truth (who watched my video, who’s in my holding tank, who clicked call-me, what do I do today).
## H.1  The locked scope (Chat #85)
Locked in Chat #85, no deviation without Kevin’s approval. The BA cockpit on .team is stripped of all genealogy except one thing. THREE already shows downline / team / binary / volume / rank. Duplicating any of that in .team would create drift and confuse compliance.
Three elements, in this order:
- 1. My Sponsor card. Name + phone + a Send Message button. No photo, no email. For code-derived sponsors (every normal BA), pulled from the access-code owner’s BA record. For founders (Kevin and Paul), manually overridden on their profile. Kevin’s card shows My Sponsor = Paul Barrios + Paul’s phone. Paul’s card shows My Sponsor = Lance and Tracie Smith + their phone.
- 2. My Invites. Full list of personally invited prospects with the status pipeline visualized: link minted → clicked → video started → video completed → in holding tank → callback requested → webinar reserved → enrolled → expired.
- 3. CRM per invite. Activity timeline, notes, follow-up reminders, tags, prospect contact info, dispositions, and the option to re-invite when an invitation expires.
Nothing else genealogy-related on .team for regular BAs. Full team genealogy mirror lives only on /admin — Kevin’s operational tool, not BA-facing.
## H.2  The cockpit layout
### Top strip — identity and links
- Left: Team Magnificent wordmark in gold.
- Center: BA full name + role pill (Brand Ambassador).
- Right: profile / settings link and sign-out.
### Welcome banner (until Fast Start is complete)
- A persistent banner across the top of the cockpit while the new BA is still working through the Fast Start Guide. Shows: progress through the five modules (e.g. 3 of 5 complete), the immediate next module link, and the scheduling card for the 10-step orientation.
- Removed automatically once Fast Start is complete and the orientation is scheduled.
### Left rail — the surfaces
- Cockpit (the default landing view).
- My Invites (links to the full CRM view).
- Invitation Generator.
- Fast Start Guide (until complete).
- Michael (until interview complete).
- Orientation (until complete).
- Training (always available, optional, post-Fast Start).
- Replicated .com preview.
- Profile.
### Main column — the three locked elements
- Top card: My Sponsor (Section H.3).
- Middle card: today’s actions (Section H.4) — a derived view of the My Invites pipeline showing what needs the BA’s attention right now.
- Below: My Invites pipeline visualization (Section H.5).
## H.3  My Sponsor card — in detail
- Card title: “My Sponsor.”
- Body: full name (large), phone number (smaller, tap-to-call on mobile).
- Action: “Send [Sponsor First Name] a message” button — opens the device’s native SMS app (sms: link) prefilled with the sponsor’s number.
- No photo. No email. No title. No genealogy chain. Just the relationship that matters.
- For code-derived sponsors: data comes from the access-code owner’s BA record automatically.
- For Kevin: sponsor card is manually set to Paul Barrios with Paul’s phone.
- For Paul: sponsor card is manually set to Lance and Tracie Smith with their phone.
Open question — J.7. What happens if a sponsor leaves Team Magnificent or is removed? The downline BAs still need a real human upline contact. Does the card auto-roll up to the next active BA in the chain, or stay locked to the original sponsor and surface a separate “escalation contact” card?
## H.4  Today’s actions — derived from My Invites
- Not a separately maintained list — a computed view over the BA’s invitations. Shows up to 6 cards.
- Prospects who clicked the callback CTA in the last 24 hours — highest priority.
- Prospects who finished the video in the last 24 hours — high priority.
- Prospects who clicked the link but did not finish the video — medium priority, suggest a follow-up message.
- Prospects in the holding tank whose 8-week window is approaching expiry — medium priority.
- Prospects the BA tagged “follow up in [N] days” whose date is today.
- Each card carries a primary action: “Call [Prospect Name]”, “Send a follow-up message”, “Open ScriptMaker for [Prospect Name]”.
## H.5  My Invites — the pipeline view
- A horizontal pipeline visualization with the locked statuses: link-minted, clicked, video-started, video-complete, in-holding-tank, callback-requested, webinar-reserved, enrolled, expired.
- Each status shows the count of prospects currently in that state.
- Click any count to drill in to the list of those prospects — standard table view with name, last-activity timestamp, tags.
- Click any prospect to open their CRM detail page.
## H.6  CRM per invite — the prospect detail page
### Header
- Prospect name, status pill (current state in the pipeline), invite date, days since invite.
- Contact info (phone, email if known), best time to call (when the prospect supplied it via the callback form).
### Activity timeline
- Reverse-chronological list of every event on this prospect’s record: link minted, link clicked (with timestamp + UA fingerprint if available), video started, video milestones (25%, 50%, 75%, complete), holding tank placement (with position number), callback requested (with intent radio choice and best-time field), webinar reservation, BA-logged notes and follow-ups.
### Notes and follow-ups
- Free-text notes the BA adds about this prospect.
- A “follow up on [date]” reminder field. When the date comes due, the prospect appears in Today’s Actions.
- Disposition selector: in-progress / customer-only / committed-to-enroll / not-interested / lost-touch / re-engage-later. Disposition drives the cadence engine.
### Tags
- Free-form tags the BA assigns. Examples: “from-church”, “doctor”, “retired-this-year”, “prior-NWM”. Tags feed back into Ivory’s segmentation for future Who Do You Know exercises.
### Re-invite
- Available when an invite token expires (8 weeks). One click mints a new token, generates a fresh script via ScriptMaker (informed by the prior activity timeline), and returns a new link.
- The original prospect record is preserved; the new token is appended to the token history.
## H.7  What the cockpit does NOT show
- No team genealogy (THREE handles this).
- No downline list (THREE handles this).
- No binary leg structure (THREE handles this).
- No volume, rank, or compensation figures (THREE handles this).
- No cross-team holding tank view (Kevin only, on /admin).
- No access-code generation or management (Kevin only, on /admin).
- No Michael transcripts of other BAs (sponsor sees their downline’s; admin sees all).
The principle. THREE shows organizational truth. The cockpit shows operational truth. The two are complementary, not duplicative. A BA opens THREE’s back office to see what they earned. They open .team to see what to do next.


# I.  Replicated .com preview and profile
## I.1  Replicated .com preview
Every BA can preview what their prospects see when they click an invitation link — the .com presentation page, personalized to the BA. The preview is the BA’s own /p/{previewToken} rendered inside the .team app, with a sandboxed token that does not create a real prospect record on click.
### Where it lives
- Route: teammagnificent.team/preview.
- Authenticated. Linked from the cockpit left rail and from inside the invitation generator (“See what your prospects see”).
### What it shows
- The full .com presentation surface (Dr. Dan video, market opportunity, product, system explainer, 2-in-72 visualization, testimonials, callback CTA, webinar CTA).
- Personalized to the BA — their name appears wherever the prospect would see it.
- A persistent “PREVIEW MODE” ribbon across the top to remove any ambiguity about who is viewing what.
### What it does not do
- Does not write to the holding tank.
- Does not place a prospect record.
- Does not fire BA alerts.
- Does not increment any counter visible to other BAs or other prospects.
## I.2  Profile / settings
Standard account management surface for the BA.
### Where it lives
- Route: teammagnificent.team/profile.
- Authenticated.
### Fields the BA can edit
- First name, last name (with audit log on change).
- Email — requires re-verification via emailed link before the change takes effect.
- Phone — the number Michael uses for the interview call and the system uses for SMS alerts. Tap to update; immediate effect (no re-verification at this time — see open question J.8).
- Password — standard change-password flow (current password + new password twice).
- Photo — optional, displayed in the cockpit header (and nowhere on .com).
- Time zone — used for scheduling display only.
- Notification preferences — which BA alerts go to SMS, which go to email, which go to in-app only.
### Fields the BA cannot edit
- Sponsor — immutable, locked at signup by the access code used. Displayed for reference, not editable.
- THREE International BA ID — displayed for reference, editable only by Kevin from /admin (because changing it could break the link to THREE’s records).
- Team Magnificent BA ID — system-assigned at signup, immutable, displayed for reference.
- Access code held — displayed for reference (so the BA knows what code to give their downline). Code itself is generated by Kevin from /admin; the BA does not edit it.
### Sponsor-card override (founders only)
- For Kevin and Paul only: an admin override exists to set the My Sponsor card manually (Kevin’s = Paul Barrios + phone; Paul’s = Lance and Tracie Smith + phone). This override is not visible to or editable by regular BAs.


# J.  Open questions
Decisions that need Kevin before code is written. They are not assumptions — they are decisions for Kevin.
## J.1  Login — Remember me cookie lifetime
Proposed: 30 days when Remember me is checked, session-only otherwise. Is 30 days the right window, or shorter (7 days) or longer (90 days)?
## J.2  Login — lockout threshold
Proposed: 5 failed attempts in 10 minutes triggers a 15-minute lockout. Right numbers, or tighter (3 attempts, 30 minutes) or looser (10 attempts, 5 minutes)?
## J.3  Welcome — click vs typed signature
Should the welcome commitment be a click-acknowledge, or should the BA type their name as a signature? Click is simpler; typed signature is heavier and more deliberate.
## J.4  Welcome — immediate vs delayed Michael call
Should Michael call immediately on welcome acceptance, or after a short delay (e.g. “Michael will call you within the next 30 minutes”) so the BA can put the phone down and answer when it rings?
## J.5  Michael — the five interview prompts
Section D.4 lists five prompts as a placeholder. Does Kevin have a script document already drafted that should replace this list verbatim, or are these the right five?
## J.6  Orientation — the 10 steps
Section F.3 lists 10 steps as a placeholder. What is the actual curriculum, in Kevin’s words, in the order Kevin would teach it?
## J.7  Sponsor card — what happens when a sponsor leaves
If a sponsor leaves Team Magnificent or is removed, the downline BAs still need a real human upline contact. Does the My Sponsor card auto-roll up to the next active BA in the access-code chain, or stay locked to the original sponsor and surface a separate “escalation contact” card?
## J.8  Profile — phone change verification
Email change requires re-verification via emailed link. Should phone change require similar verification (SMS verification code), given that the phone is what Michael calls and where SMS alerts go? Higher friction, but prevents accidental misdirection of alerts to a wrong number.
## J.9  Fast Start — gating
Section E.4 says modules are sequential but not hard-gated — a BA can jump around. Is that the right design, or should certain modules (e.g. Module 2 comp-plan-Layer-1) gate access to others?
## J.10  Orientation — scheduling mechanism
Section F.2 names the surface but not the mechanism. Calendly-style embed (third-party tool, fast to ship)? Custom slot picker (in-house, more control)? Manual outreach via the sponsor (no tooling needed)?
## J.11  Re-invite — cooldown
Section H.6 allows a BA to re-invite an expired prospect with one click. Should there be a cooldown (no more than once per N days, or no more than M total re-invites) to prevent over-messaging?
## J.12  Notification preferences — defaults
Section I.2 lets BAs choose which alerts go to SMS, email, or in-app only. What are the defaults? High-priority callback-requested alerts probably default to SMS; lower-signal events probably default to in-app only. Confirm the matrix.


## End of .team design document

Next document in the series: Team-Magnificent-ADMIN-Design.docx — the Kevin-only surface. Code generator, code management, full team genealogy mirror, discrepancy review against THREE, BA list, holding tank cross-team view, Michael transcripts, audit log.
After admin: implementation kickoff. The three design documents (COM, TEAM, ADMIN) together specify the full app surface. Once all three are marked up and locked, the build sequence begins — most likely starting with the signup gate (Signup & Architecture, Section A) and the admin code generator, since one cannot work without the other.
Read this document. Mark it up. Tell Claude what is wrong. Nothing about .team gets built until you say it is right.