<!-- converted from Team-Magnificent-COM-Design.docx -->

TEAM MAGNIFICENT
teammagnificent.com
Prospect-facing surface design
Companion to the Signup & Architecture and App Description documents
Document series: .com (this), then .team, then /admin.
Read it. Mark it up. Tell Claude what is wrong. Nothing gets built until you say it is right.

# Executive summary

Standing rule. THREE International is the single source of truth and the final authority on all sponsorship, enrollment, placement, and compensation. Every record in this design mirrors THREE’s records for Team Magnificent’s own operational visibility. The Team Magnificent app never disputes or overrides THREE. If at any point our records differ, we update ours to match THREE.
Compliance posture for .com. The marketing layer (presentation page, post-video dashboard, powerline visualization) shows reality without making promises. The compensation layer (binary leg, spillover, income) operates inside THREE’s regulated structure. The two never overlap on prospect-facing surfaces. Never on .com: income claims or earnings projections, placement or queue-position-equals-leg-position promises, AI prospecting (Michael is BA-facing only), compensation cycle math, volume math, rank math, current head count of the team, THREE International branding (logo, name, eyebrow, or footer disclaimer). The 100,000 goal is named. The current count is not. Team Magnificent is the only brand on the page.
This document describes every screen, every section, and every behavior on teammagnificent.com — the prospect-facing surface of the Team Magnificent Marketing Momentum Creation System. The .com site is where prospects arrive, watch the GLP-THREE product video by Dr. Dan Gubler, see the team’s momentum demonstrated in real time, and make their next move.
The .com site is replicated per Brand Ambassador. Every prospect arrives via a unique /p/{token} URL minted by the inviting BA from their .team invitation generator. The token resolves the inviting BA on the server side so that all routing — callback requests, webinar reservations, signal events — flows back to the right BA, AND so that the prospect-facing copy on the page is personalized to that BA. The page names the inviting BA throughout — in the hero, in the position card, in the callback CTA. Personalization is the rule. The page is never anonymous. The personal nature of the invitation is reinforced by the page declaring it, alongside the human SMS or message that delivered the link.
Sections of this document. Section A: information architecture and routing. Section B: the presentation page — every section top to bottom, what it does, what it shows. Section C: the post-video dashboard — six locked sections including the powerline visualization. Section D: the conversion flow — callback request and webinar reservation. Section E: token lifecycle and return-to-link behavior. Section F: error states. Section G: brand application, tone, and brand isolation from THREE International. Section H: open questions for Kevin.

# A. Information architecture and routing

## A.1  The one route that matters
Every prospect-facing page on teammagnificent.com is served from a single route pattern: /p/{token}. The token is an opaque identifier minted by the inviting BA when they use the invitation generator on .team. The token does two things on the server side:
- Resolves to the inviting BA, so callback requests and webinar reservations route to the right BA’s cockpit.
- Tracks the prospect’s state through the funnel — link minted, link clicked, video started, video completed, callback requested, webinar reserved, enrolled, or expired.
## A.2  The two faces of /p/{token}
What the prospect sees at /p/{token} depends on the funnel state of their token. The URL stays the same; the rendering changes.
### Pre-video state — the presentation page
When the prospect arrives at the link for the first time, they see the presentation page. This is the marketing layer — Dr. Dan’s product video, the market opportunity, the GLP-THREE product detail, the team’s story. The presentation page ends when the prospect completes Dr. Dan’s video.
### Post-video state — the dashboard
At the moment the video reaches its completion event, the server silently records video_complete for this token, places the prospect in the team’s shared holding tank pool, and the page transitions to the post-video dashboard. No interstitial. No “you’re now in” form to fill out. The transition is the demonstration.
### Return visits
If the prospect closes the browser and returns to /p/{token} later, the server resolves the token to its current state and serves the appropriate page. If the prospect had completed the video, they see the dashboard. If they hadn’t, they see the presentation page picking up where they left off (the video remembers its playback position via the YouTube iframe API).
## A.3  What the URL never carries
- No BA name in the URL parameters — the token resolves on the server, not in the URL string.
- No prospect personal information in the URL — the token is opaque, not a base64 of an email address.
- No sponsor identification in the URL — the prospect doesn’t see who their sponsor would be in the URL string itself. The inviting BA is named in the page copy, not in the URL.

# B. The presentation page

The presentation page is what loads when a prospect arrives at /p/{token} in its pre-video state. Its single purpose is to deliver the Dr. Dan Gubler GLP-THREE video and the supporting context that makes the video land. Conversion does not happen here — conversion happens on the post-video dashboard. The presentation page exists to earn the right to show the dashboard.
Reference source. The existing file tm-prospect-glp3-v3-UPDATED.html is a working sketch of the presentation page. Its layout, brand application, and section structure are the reference. Its specific copy is not final — Kevin will handle the final compliance and copywriting pass. This document describes each section’s purpose, what it shows, what behavior it has, and what it never contains.
## B.1  Section order, top to bottom
- Ticker strip — thin teal bar at the very top of the viewport. Animated horizontal scroll of short messages reinforcing the moment: GLP-THREE launched, the wellness category, the team’s motion. Brand voice. No income, no comp. May include the inviting BA’s name as part of the reinforcement (“[BA first name] personally invited you”), consistent with the rest of the page’s personalization rule.
- Hero — the page’s opening statement. “[Prospect first name], you were personally invited by [BA full name].” Bebas Neue display headline in cream with the BA name in gold. Both names are interpolated server-side from the token-resolved prospect record and inviting BA record. Beneath: a body paragraph in the inviting BA’s voice that names them once more. A live pulse badge in teal: “[BA first name] personally invited you.” Two call-to-action buttons: gold “Watch The Product Video” scrolling to the Dr. Dan section, and a ghost “See The Team” scrolling to the market section.
- Part 1 — Watch Dr. Dan — the product video. 16:9 embedded YouTube iframe. The video is the foundation; everything else on the page is supporting material. Eyebrow label in mono: “Part 1 — The Product”. Headline: “Watch Dr. Dan. Then Everything Makes Sense.”
- Part 2 — The Market Opportunity — the macro frame. Headline: “A $6.8 Trillion Market. And A Problem Nobody Has Solved.” Followed by a grid of public-source statistics: $6.8T global wellness economy, 72% of American adults overweight, $1,200/mo synthetic drug cost, 10M+ Americans on GLP-1, 70% accessibility gap, $200B GLP-1 market by 2033. Each stat carries its source. Below the grid, a problem card framed in orange that names what GLP-THREE addresses.
- Part 3 — The Science of the Product — GLP-THREE specifics. Headline: “Natural. Patented. No Needle. No Prescription.” Body copy explaining MBC-267, the natural peptide complex, the GLP-1 receptor mechanism, the cellular absorption delivery. A Dr. Dan credentials card naming him as Chief Scientific Officer and Chief Formulator of the product, with his credentials (Caltech PhD in Organic Chemistry, 16 patents, 70+ supplements formulated, 1.3M followers, top-50 podcast). The card does not name his employer — the credentials speak. Two product cards in a grid: “How It Works” and “What It Does.”
- Part 4 — The Team in Motion — the bridge into the team. Eyebrow: “Part 4 — How The Team Moves.” Headline that emphasizes momentum and team unity. Body copy describes the Team Magnificent OS at a high level — personalized invitations, live team momentum, shared system. The inviting BA may be named here as the human voice behind the invitation. No income figures, no commission language. The story Kevin will write for this section is the one that hands the prospect off to the dashboard moment after they complete the video.
- Part 5 — Real Results — testimonials. As BAs use GLP-THREE and post results, their results appear here. At launch this section will be sparse — Kevin’s testimony as the first card, and cards marked “Team results being collected” for the rest. The section grows as the team grows.
- Final strip — the closing moment before the video completes and the page transitions. A short, decisive headline. A single gold CTA button: “Continue — See The Team.” This button is only relevant if the prospect didn’t watch the video to completion — video_complete from the iframe API is what actually triggers the dashboard transition. The button is a fallback.
- Footer — minimal. Team Magnificent wordmark in teal, the URL teammagnificent.com, and the Team Magnificent compliance disclaimer (see G.5). No THREE International branding, no “independent promoter tool” disclaimer, no logo other than Team Magnificent’s. No BA name in the footer.
## B.2  What every section avoids
- No income claims, no earnings projections, no commission figures, no cycle math.
- No promises about placement in THREE’s binary, queue position, or leg position. The page never claims the inviting BA will be the prospect’s binary sponsor in THREE — that decision happens off-app at enrollment time, per the team’s placement strategy. The page DOES name the inviting BA throughout as the human who personally invited the prospect; that personalization is the rule, not the exception.
- No current head count of the team. The 100,000 goal is named on the dashboard, not on the presentation page.
- No interactive binary tree visualization with weekly income estimates — the earlier working sketch contains one; the final page will not.
- No save-spot form. Conversion happens on the dashboard, not here.
## B.3  Behavior
- Token capture. On first load, the server records that this token was clicked, with timestamp and any available browser context (no fingerprinting beyond what a normal request carries).
- Scroll-triggered animations. Section reveals fade in as the prospect scrolls. Subtle. Brand-quiet.
- Video tracking. The YouTube iframe API reports started, 25%, 50%, 75%, and complete events back to the server. These become signal events the inviting BA can see in their cockpit — “your prospect watched 75% of Dr. Dan.”
- Video completion is the trigger. When the video reaches its end (or the prospect manually skips to and past 95% of its duration), the page silently begins the transition to the dashboard. The token state advances to video_complete. The prospect is placed in the team’s shared holding tank pool with a monotonic position number.
- Transition. The presentation page fades out. The dashboard fades in. The URL does not change — it stays /p/{token}. The prospect did not click anything to enter the dashboard — they earned it by completing the video.

# C. The post-video dashboard

The dashboard is what loads at /p/{token} once the token has reached the video_complete state. It is six locked sections in fixed order. The dashboard is the conversion engine of teammagnificent.com — it is where the prospect sees the team forming, sees their position, and makes their next move.
Reference source. The existing file dashboard-prototype.html is the locked design for these six sections. Its layout, copy structure, brand application, and animation behavior are authoritative. This document transcribes that design and notes the specific adaptations to match the powerline-adapted-to-binary mechanic Kevin has confirmed.
## C.1  Section 1 — Arrival
### Purpose
The first thing the prospect sees after completing Dr. Dan’s video. Confirms the moment. Establishes that the prospect is now part of something already in motion.
### Layout
- Invited-by line at the top, small, in gold mono: “Invited by [BA Name].” This is the only place on the dashboard where the inviting BA is named by name. The naming is operational — the prospect knows the link came from this person, and the line confirms it.
- Massive Bebas Neue headline in cream: “You saw it. You’re in.” With “in.” in gold.
- A subtitle in cream-mute confirming the video did its work and the prospect is part of the team.
- A position card — a horizontal three-part card that is the visual anchor of this section:
- Left: “Your position” label and a massive Bebas Neue number with a # prefix. Position numbers are monotonic and assigned at the moment of video_complete. Position #347 means 346 prospects entered the team’s shared holding tank pool before this one.
- Center: A short copy block. “Held in [BA Name]’s leg” as the heading. Body copy explaining that the prospect has been placed in the Team Magnificent shared holding tank — a live demonstration of how the team is forming around them in real time.
- Right: A timestamp stamp — “Placement / [HH:MM PT] · today” — anchoring the moment.
On the position card heading. The current prototype text “Held in [BA Name]’s leg” is the locked design intent. The leg referenced here is the operational concept — the team momentum the prospect now belongs to. The page does not claim this corresponds to a specific binary leg in THREE. The leg the prospect actually enters in THREE’s binary is determined by the inviting BA at enrollment time, off-app. The dashboard’s “leg” is the visible representation of team motion, not a binary placement promise. Kevin will tune the final copy for this card to be unmistakably non-promissory.
### Behavior
- The position number assigned at video_complete is permanent. It never reshuffles. Position numbers are monotonic.
- The timestamp shows the prospect’s local time zone, resolved client-side from the browser.
- This section does not animate beyond the initial fade-in — it’s a stable anchor.
## C.2  Section 2 — Opportunity
### Purpose
Establish the market context. The prospect just watched a 17-minute video about a single product — this section zooms out to the market that product addresses.
### Layout
- Eyebrow in teal mono: “The market you just stepped into.”
- Headline in Bebas Neue: “This isn’t a small room.”
- Lead paragraph: GLP-THREE is a natural alternative in one of the fastest-expanding wellness categories. Public numbers, public sources.
- A four-cell market grid — each cell shows a stat, a label, and a source:
- $6.8T — Global wellness market — GWI · 2025
- $200B — GLP-1 alternatives by 2033 — Industry projection
- 72% — Americans overweight — CDC · 2024
- $1,200/mo — Cost of synthetic alternatives — Average retail · 2025
### Behavior
- Static. Stats fade in on scroll. Sources are always visible — every claim carries a citation.
- The stats themselves are factual and public. Compliance-safe.
## C.3  Section 3 — The Mechanic
### Purpose
Show the prospect how teams build in this market. This is the cascading rhythm — each person finds two, those two each find two, the team doubles. The mechanic is universal to network marketing; the demonstration here is the visual cascade animation.
### Layout
- Eyebrow: “How teams build in this market.”
- Headline: “Two people. Then they find two.”
- Lead paragraph describing the doubling math and the 72-hour rhythm.
- A cascade visualization in the center — an animated tree that builds out as the prospect watches. Bebas Neue typography on the nodes. Subtle gold and teal accents.
- Below the cascade, a destination card: “The math points here → 100,000 — Qualified Brand Ambassadors. That’s the team we’re building.”
- Three principle cards in a row:
- Power of 2 — the doubling explained.
- 2 in 72 — the rhythm explained.
- One bite at a time — the daily action discipline.
### Behavior
- The cascade animates on scroll-into-view. Three iterations of doubling. Visual demonstration, not interactive.
- The 100,000 number is named here as the goal. The current team count is not shown.
- No income figures attached to any of the cascade nodes. The cascade shows people, not dollars.
## C.4  Section 4 — Your Place in the Live Team
### Purpose
The FOMO engine. The prospect sees their position and watches the team form around them in real time. This is the section that converts the abstract mechanic from C.3 into the concrete demonstration the prospect is now part of.
### Layout
- Eyebrow: “Your place in the live team.”
- Headline: “The team is forming around you. Right now.”
- Lead paragraph telling the prospect their position number and inviting them to watch what happens when they stay on the page.
- A live board with two parts:
- Left: two large counters. “Ahead of you” shows the count of prospects placed before this one (static — the prospect’s position minus one). “Behind you · live” shows the count of prospects placed after this one, with a teal pulse dot, and increments in real time as new prospects elsewhere on the team complete their own videos.
- Right: a position stack — a vertical list of recent placements. Each entry shows a position number, a city/state, and a relative timestamp. The stack updates live, new entries appearing at the top with a brief gold flash animation.
### The powerline mechanic, made visible
This is where the powerline-adapted-to-binary mechanic Kevin designed becomes visible to the prospect. What the prospect sees in this section is a generic demonstration of team momentum — one shared team leg growing as Brand Ambassadors across Team Magnificent send their invitations and their prospects complete the video. The visualization shows arrivals and growth as the team reaches out; it does not show binary leg structure, does not show actual placement decisions, does not show sponsor identity, does not show compensation flow.
Behind the scenes, the inviting BA will, at the prospect’s enrollment moment, place the new BA into either the left or right side of THREE’s binary structure per the team’s placement strategy. That happens off-app, in THREE’s tools. The dashboard visualization is the marketing demonstration that the team is moving; the binary placement is the operational reality that happens after.
Compliance frame for the live section. The position number, the ahead/behind counters, and the position stack are the visible team motion. They are factual — they describe the real holding tank pool of prospects across all of Team Magnificent at any moment. They do not promise placement in THREE’s binary. They do not promise a sponsor identity. They do not promise compensation. The position is a marketing position in the demonstration, not a placement guarantee.
### Behavior
- The behind-you counter updates via a server-sent events stream or short-poll. New increments animate with a subtle pulse.
- The position stack receives new entries as other prospects across the team complete their videos. The newest entry appears at the top; older entries push down and eventually fade off the bottom of the visible window.
- City/state is included with each entry for human texture, but no personal identifiers (no names, no emails, no phones).
- The stack is not editable. The prospect can’t click an entry. It is presentation, not interaction.
## C.5  Section 5 — The Team Magnificent Advantage
### Purpose
Differentiate Team Magnificent from generic network marketing experiences. The system itself — the technology, the shared OS, the unified BA effort — is what makes the team move faster than a typical team would.
### Layout
- Eyebrow: “Why Team Magnificent moves faster.”
- Headline: “We work together. With the same goal.”
- Lead paragraph contrasting Team Magnificent with the typical recruiting-alone pattern in network marketing.
- A quote card — Kevin Gardner as founding co-leader. “We’ve harnessed the power of our team using technology so we’re working together with the same goal — to win.”
- A mission board displaying the 100,000 goal in massive type. The current count is not shown.
- A pool grid — four operational stats that describe team activity in motion:
- Brand Ambassadors active in the last 24 hours (e.g. 47).
- Invitations sent across the team today (e.g. 213).
- New placements added to the team in 24h (e.g. 89).
- Recruitment velocity through shared OS (e.g. +38%).
- A compounding closer card — “One team. One pool. One system.” Body copy that ties the prospect’s position number back to the team’s velocity. The team’s growth is the sum of every BA’s work, made visible through the same shared OS.
- A signature line at the bottom of the closer: “Operational architecture · numbers of record · no performance promise.” Compliance acknowledgement that what’s shown is operational reality, not earnings claims.
### Behavior
- The four pool-grid stats refresh on page load. They reflect actual operational counts pulled from the server.
- The mission board is static. The 100,000 goal is the public commitment.
- The quote card is fixed copy attributed to Kevin Gardner as founding co-leader.
On the pool-grid stats. These numbers are operational reality — they describe what BAs are actually doing across Team Magnificent in a 24-hour window. They are not promises about what the prospect will do. They are not promises about outcomes. They are not promises about earnings. They demonstrate that the team is moving, with the signature line at the bottom of the section reinforcing that what is shown is operational, not performance-projecting.
## C.6  Section 6 — Your Next Move
### Purpose
Conversion. Two paths, both leading to a human conversation. Either a personal callback from the inviting BA, or a reserved seat at the Tuesday 7pm Pacific live webinar.
### Layout
- Eyebrow: “Your next move.”
- Headline: “Let’s have a real conversation about this unfolding new opportunity.”
- Lead paragraph: two ways to take the next step — a personal call with the inviting BA, or the live team event Tuesday night.
- A two-column CTA grid. Left column is the personal-callback CTA (primary). Right column is the webinar-reservation CTA (secondary).
### CTA 1 — Personal callback
- Label tag at the top: “A real conversation with [BA Name].”
- Headline: “I’m ready to talk with [BA Name].” BA name in gold accent.
- Body copy framing the call as the human moment.
- Three radio buttons — the intent picker:
- “I’m interested — I want to understand more.”
- “I’m ready to join Team Magnificent.”
- “I have specific questions to work through.”
- Two form fields: Phone (best number to reach) and Best time (free-text).
- Gold submit button: “Yes — let’s talk.”
### CTA 2 — Webinar reservation
- Label tag at the top: “Join us live.”
- Headline: “The next Team Magnificent live, in [countdown].” Countdown in teal accent.
- Event details: “Tuesday · 7:00 PM Pacific · Zoom.”
- Hosts: “Hosted by Kevin L. Gardner and Paul Barrios. Open conversation, real team, real momentum.”
- A live countdown timer in four cells: Days, Hours, Min, Sec. Counts down to the next Tuesday 7pm Pacific occurrence.
- Two form fields: Name and Email (where to send the Zoom link).
- Teal submit button: “Reserve my seat.”
### Behavior on CTA 1 submit
- Intent radio is required; submit is disabled until one is selected.
- Phone is required and validated (format flexibility — accept various formats).
- Best time is optional but encouraged.
- On submit, the server records a callback_request signal event tied to the token and the inviting BA. The inviting BA gets an SMS via Telnyx alerting them. The event appears in the BA’s .team cockpit as a new event on this prospect’s CRM timeline.
- The page transitions to a confirmation state — “[BA Name] will call you back. Watch for a call from [area code].” The dashboard remains visible underneath; the confirmation is a soft inline state, not a new page.
### Behavior on CTA 2 submit
- Name and Email are required.
- On submit, the server records a webinar_reservation signal event tied to the token. An email goes out with the Zoom link and the event details.
- The page transitions to a confirmation state — “Your seat is reserved. Check [email] for the link.”
- The inviting BA is notified via their cockpit that this prospect reserved a seat.

# D. The conversion flow, end to end

This section walks through what happens from the moment the prospect arrives at /p/{token} to the moment they enroll in THREE International — the off-app step that closes the loop.
## D.1  Phase 1 — Arrival and video
- Prospect clicks the /p/{token} link from the BA’s SMS or message.
- Server resolves the token: status = clicked. Records timestamp.
- Presentation page loads. Prospect scrolls, reads, eventually starts Dr. Dan’s video.
- Video iframe API reports started, 25%, 50%, 75% events back to the server. Each becomes a signal event on the prospect’s timeline visible to the inviting BA.
## D.2  Phase 2 — Video complete and silent placement
- Video reaches its end (or the prospect manually advances past 95% of its duration).
- Server records video_complete for this token. Status advances to video_complete.
- Server silently assigns this prospect a monotonic position number in the team’s shared holding tank pool. The position is timestamp-anchored and never reshuffles.
- Server writes the placement record to MongoDB, Neo4j, and ChromaDB via the Universal Gateway (triple-stack persistence).
- The presentation page fades; the dashboard fades in. URL stays /p/{token}.
## D.3  Phase 3 — Dashboard engagement
- Prospect sees the six dashboard sections in order: Arrival, Opportunity, Mechanic, Live, Advantage, Next Move.
- The live section’s behind-you counter and position stack update in real time. The prospect can stay on the page and watch the team move.
- If the prospect engages with Section 6 (Your Next Move), one of two CTAs fires.
## D.4  Phase 4 — Conversion intent captured
### If callback request
- Inviting BA receives an SMS via Telnyx within seconds with prospect intent, phone, and best time.
- Event appears in the BA’s .team cockpit on this prospect’s CRM timeline.
- Status advances to callback_requested.
### If webinar reservation
- Email goes to the prospect with Zoom link and event time.
- Inviting BA notified in their cockpit that this prospect reserved a seat.
- Status advances to webinar_reserved.
## D.5  Phase 5 — The off-app step (the human conversation)
This phase happens entirely outside the app. The inviting BA calls the prospect (if callback requested) or attends the webinar with the prospect (if seat reserved). The conversation determines whether the prospect is ready to enroll in THREE International under the BA as their sponsor.
The app does not participate in this conversation. There is no call recording on the prospect side. There is no AI prospecting. Michael, the voice agent, is BA-facing only and never speaks with prospects.
## D.6  Phase 6 — Enrollment in THREE (off-app, BA-to-BA)
If the prospect decides to enroll, the BA walks them into THREE International through THREE’s own enrollment tools, off-app. The BA decides, per the team’s powerline-adapted-to-binary placement strategy, which leg in THREE’s binary the new BA enters (left or right under the BA, or deeper if the strategy calls for it).
THREE records the enrollment and the sponsorship binding. THREE is the final authority on this record.
## D.7  Phase 7 — Closing the loop
- The BA, back in their .team cockpit, marks the prospect’s CRM record as enrolled. Optional: the BA enters the new BA’s THREE BA ID for reference.
- The prospect’s holding tank record flushes — they are no longer a prospect, they are now a new BA. Their position number in the holding tank is no longer relevant.
- If the prospect never enrolls, their holding tank record flushes when the 8-week consideration window expires.
On position monotonicity after flush. Position numbers are timestamp-anchored. When a prospect’s holding tank record flushes (enrollment or 8-week expiry), the numerical position is vacated, but the numbers of remaining prospects do not reshuffle. The team line is monotonic and stable. If position #347 flushes, position #348 is still position #348 — they do not become #347. The visible team line is honest — the absence of #347 is allowed. The alternative (renumbering) would violate the monotonic rule and create the impression that positions are negotiable.

# E. Token lifecycle and return behavior

## E.1  Token states
- minted — BA generated the link from the invitation generator on .team but it hasn’t been clicked yet.
- clicked — prospect opened /p/{token}; presentation page loaded.
- video_started — prospect started Dr. Dan’s video.
- video_quarter / video_half / video_three_quarter — progressive watch milestones.
- video_complete — prospect watched to completion (or past 95%); placed in holding tank pool with a position number.
- callback_requested — prospect submitted the callback CTA.
- webinar_reserved — prospect reserved a webinar seat.
- enrolled — BA marked the prospect as enrolled in THREE (off-app step).
- expired — 8 weeks have passed since video_complete without enrollment; record flushes.
## E.2  How return visits work
A prospect can leave the page and come back to /p/{token} at any point. The server resolves the token to its current state and renders the appropriate view.
- If state is clicked or any video_* state, the presentation page loads. The YouTube iframe restores playback position if the prospect was mid-video.
- If state is video_complete or beyond, the dashboard loads. The position number is the one assigned at original video_complete — it does not change.
- If state is callback_requested or webinar_reserved, the dashboard loads with the confirmation state visible.
- If state is enrolled, the token redirects to a brief welcome page acknowledging the prospect is now part of Team Magnificent. Their access to .team will come through their separately-issued BA access code, not through this token.
- If state is expired, /p/{token} resolves to an expired state page prompting the prospect to ask their inviting BA to renew it.
## E.3  Why tokens never become URLs with personal data
- The token is opaque (random string, e.g. 12-character base32 or similar).
- It is not a base64 of the prospect’s email, not a hash of their phone, not a slug of their name.
- The mapping from token to prospect lives on the server. The URL carries nothing about who the prospect is.
- If a token leaks to a third party, the third party sees only the same page the prospect would see — not the prospect’s personal data.

# F. Error states

## F.1  Invalid token
Prospect arrives at /p/{token} with a token the server does not recognize. The page shows a minimal Team Magnificent branded message asking them to check the link or ask the person who invited them for a fresh one.
## F.2  Expired token
Token reached the 8-week window without enrollment. The server resolves the token but its state is expired. The page shows a message prompting the prospect to reach out to their inviting BA to renew.
## F.3  Video fails to load
YouTube iframe fails. The video container shows a placeholder with a retry button. After three failed retries, the page suggests reaching out to the inviter.
## F.4  Server unreachable for live counters
The behind-you counter and position stack rely on a live data stream. If the stream fails, the section gracefully degrades: counters show their last known values with a steady gold dot replacing the pulse, and a small mono note reads “live updates paused.” The dashboard otherwise functions normally.
## F.5  Callback or webinar submit fails
Form submit returns an error from the server. The button shows “Something went wrong — try again.” in orange. The form fields remain populated. After three consecutive failures, a fallback message prompts the prospect to reach out to their inviter directly.
## F.6  Prospect on a slow connection
Heavy assets (video iframe, animations, live counter stream) load after the initial paint. On slow connections, the prospect sees the hero, the eyebrow, the headline first. The video loads when scrolled into view. The animations defer. The page is usable from the first paint forward.

# G. Brand, tone, and visual application

## G.1  Color palette
- Ink — #0A0A0A. Primary background of the dashboard. The deep, considered canvas.
- Gold — #C9A84C. Brand primary accent. Headlines, position numbers, primary CTAs, the powerline visualization, the inviting-BA name on the dashboard.
- Gold bright — #F5C030. Energetic gold for emphasis — highlighted words in headlines, the position number, the 100,000 mission number.
- Teal — #2DD4BF. Live-data color. The live pulse dot, behind-you counter, the webinar countdown, the eyebrow labels.
- Cream — #F5EFE6. Primary text color against ink backgrounds. Slightly warm white.
- Cream-mute — secondary text. Lead paragraphs, supporting copy.
- Cream-faint — tertiary text. Timestamps, sources, signatures.
## G.2  Typography
- Bebas Neue — the display family. All section headlines. The position number. The 100,000 mission number.
- DM Sans — the body family. All paragraphs, labels, button text. Weights 400, 500, 700.
- DM Mono — the operational family. Eyebrow labels, timestamps, source citations, the ticker on the presentation page.
## G.3  Tone
- The .com voice is alive. Confident without being loud. Direct without being aggressive. The prospect is treated as a thoughtful adult being invited into something specific, not pitched at.
- No marketing fluff. No exclamation points piled on. No “amazing” or “incredible.” The energy comes from the demonstration — the team is moving — not from adjectives.
- Where copy is direct, it’s short. Where copy needs to be considered, it’s spacious. The page never crowds.
- Compliance is enforced by what the page does not say. Disclaimers exist where required, but the absence of comp language, placement promises, and income figures is the actual mechanism.
## G.4  Animation philosophy
- Animation is the demonstration, not decoration. The behind-you counter moves because the team is actually moving. The position stack updates because prospects elsewhere are actually completing their videos.
- Section reveals on scroll are subtle — fade in over 400ms, no parallax, no bouncing.
- Hover effects on buttons: 2px lift, soft shadow shift. Nothing else.
- The atmospheric background gradient on the dashboard (gold and teal radial gradients on ink) is fixed. It is the canvas, not a special effect.
## G.5  Brand isolation from THREE International
Locked 2026-05-17. The .com surface carries Team Magnificent branding only. No THREE International logo, no THREE International name in the navigation, no THREE International eyebrow on any section, no “independent operational team inside THREE International” disclaimer in the footer, no “independent promoter tool” language anywhere. The prospect sees one brand: Team Magnificent. THREE International is the regulated structure the BA walks the prospect into after the human conversation — it is operational, not marketed. THREE references stay inside .team (where the BA needs to know their THREE BA ID, log into THREE’s back office, etc.) and inside /admin (for genealogy reconciliation). They do not appear on .com.
Implications for every section above:
- Eyebrows on the presentation page never read “Team Magnificent · THREE International.” They read “Team Magnificent” alone, or the section-specific eyebrow.
- The Dr. Dan credentials card names him as Chief Scientific Officer and Chief Formulator with his credentials (Caltech PhD, 16 patents, 70+ supplements, 1.3M followers, top-50 podcast). It does not name his employer. The credentials speak for the science.
- The footer is Team Magnificent only — wordmark, URL, compliance disclaimer in Team Magnificent’s voice. No THREE branding.
- The dashboard compliance signature in Section 5 (“Operational architecture · numbers of record · no performance promise”) and the Section 6 closing compliance frame both speak in Team Magnificent’s voice. They do not name THREE.
- The Team Magnificent compliance disclaimer paragraph that appears at the bottom of the dashboard reads: “Queue positions and momentum displays demonstrate team activity in real time and do not guarantee any final placement, compensation, or earnings outcome. Market figures cited from public sources are for context only. This page contains no income claims, placement promises, or guarantees of any kind.” Period. No mention of THREE.
What this does NOT change:
- The architectural fact that THREE International owns enrollment, compensation, and the binary stays true. The BA walks the prospect into THREE off-app after the human conversation. That step is not marketed on .com because it does not happen on .com.
- Inside .team, THREE references stay where they are operational — BA ID at signup, THREE username, BA training that mentions THREE’s comp plan in a regulated context.
- Inside /admin, genealogy reconciliation against THREE’s records stays as the Kevin-only operational tool it is.

# H. Open questions for Kevin

These are points where the design needs Kevin’s decision before code is written. Listed in priority order — the answers shape downstream design and engineering choices.
## H.1  Inviting BA naming on the presentation page — RESOLVED 2026-05-17
Locked. The presentation page is never anonymous. It is always personalized to the prospect and always names the inviting BA. The hero names both. The body copy names the inviting BA. The Part 4 bridge-to-team section may name the inviting BA again as the human voice behind the invitation. The token resolves both the prospect record (for the prospect’s first name) and the inviting BA record (for the BA’s full name) server-side at page render. This rule applies to the entire .com surface. No section is anonymous.
## H.2  Final copy for the presentation page
The existing tm-prospect-glp3-v3-UPDATED.html contains copy that won’t be in the final version (the binary tree weekly-income widget, the $21k/week language, the save-spot form). Kevin will write the final copy for each section. This document describes what each section does; the final copy is Kevin’s.
## H.3  Webinar timing and cadence
The dashboard names Tuesday 7:00 PM Pacific as the webinar slot, and the countdown ticks to the next Tuesday occurrence. Is the every-week cadence the locked answer? The current prototype text says “Every 72 hours” in the host copy, which conflicts with weekly Tuesday.
## H.4  Email provider
The webinar reservation flow sends an email with the Zoom link. Email provider not yet chosen — candidates are Resend, Postmark, SendGrid, or AWS SES. Kevin to decide before wiring.
## H.5  Position stack — city/state granularity
Each entry in the live position stack shows a city/state for human texture. How is it derived? Options: prospect IP geolocation, BA-supplied region at token mint, or the inviting BA’s region as a stand-in.
## H.6  Behind-you counter — update interval
Server-sent events (real-time, more infrastructure) vs short-poll every 5 seconds (simpler, slightly delayed). Visual effect similar; engineering cost differs.
## H.7  Expired token — should it auto-renew?
When a prospect with an expired token returns, current design shows them an expiry message and prompts them to ask the BA for a new link. Alternative: auto-renew on click if the BA still has the prospect in their CRM as active. Auto-renew is more friction-free for the prospect but bypasses the BA’s decision to extend.
## H.8  Holding tank flush — 8-week window
The 8-week consideration window is the locked design. Is the window adaptive (different for different BAs, different prospect intent types) or fixed at exactly 8 weeks for everyone? The architecture document calls it adaptive; this design assumes fixed-at-8-weeks for now.
## H.9  Position stack — max visible entries
How many recent placements show in the position stack — 5, 10, 20? Each new entry pushes older ones down. The number affects perceived activity density.

## End of .com design document

Next document in the series: Team-Magnificent-TEAM-Design.docx — the Brand Ambassador-facing surface. Login, signup, welcome, Michael interview, Fast Start Guide, orientation, invitation generator, BA cockpit (My Sponsor card, My Invites, CRM), replicated .com preview, profile.
After .team: Team-Magnificent-ADMIN-Design.docx — the Kevin-only surface. Code generator, code management, full team genealogy mirror, discrepancy review against THREE, BA list, holding tank cross-team view, Michael transcripts, audit log.
Read this document. Mark it up. Tell Claude what is wrong. Nothing about .com gets built until you say it is right.