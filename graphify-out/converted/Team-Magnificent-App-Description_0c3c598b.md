<!-- converted from Team-Magnificent-App-Description.docx -->

TEAM MAGNIFICENT
App Description Document
Readback of the flow and pages, in Kevin's words.
Prepared for: Kevin L. Gardner, Founder, Team Magnificent
Source files reviewed:
tm-prospect-glp3-v3-UPDATED.html (presentation page)
dashboard-prototype.html (post-video dashboard)
This document is a readback. It is not a build plan.
Mark it up. Tell me what's wrong. Nothing gets built until you say it's right.

# 1.  What the app is for

The app is the operational backbone of Team Magnificent — used collectively by every Brand Ambassador on the team to share GLP-THREE with prospects, support new Brand Ambassadors from the moment they join, and create a structure for substantial growth and momentum.
It exists for two distinct audiences. The order of priority is set by Kevin and noted below.
## Two audiences, two surfaces
### teammagnificent.com — the prospect-facing surface
Where a prospect lands after a Brand Ambassador has personally spoken with them and sent them a personalized invitation link. The .com surface delivers the GLP-THREE story — product first, opportunity second — and after the video is viewed, places the prospect in a live demonstration of the team forming around them. The product leads because the product is what is compelling.
### teammagnificent.team — the Brand Ambassador-facing surface
Where a new BA goes after they have decided to join. The .team surface welcomes them, runs Michael (the voice agent interview), gives them the Fast Start Guide for their first 72 hours, delivers compensation plan and product training, and gives them the tool they use to send their first personalized invitations to their first prospects.
## What this app is designed to create
- Fear of missing out — every prospect sees, in real time, the team forming around their position. Other prospects are being placed beneath them while they are still on the page deciding.
- The structure for substantial growth — every Brand Ambassador on the team feeds the same pool. The dashboard a prospect sees reflects the activity of the whole team, not just their sponsor.
- An easier way to share GLP-THREE — Brand Ambassadors are not asked to convince. They have a real conversation, send a link, and let Dr. Dan and the live demonstration do the work that historically required hotel meetings, PowerPoint, and three-way calls.
## Kevin's adaptation of the powerline concept
The dashboard is Kevin’s adaptation of the powerline concept for this opportunity. As each Brand Ambassador on Team Magnificent shares with their personal prospects, those prospects are placed in a holding tank sequentially and given a spot in line. The purpose is to simulate placement in the actual binary leg, so the candidate can experience in real time the team-building efforts they will potentially benefit from — before they actually join.
The dashboard is a live demonstration of how the team operates. It is not the binary itself, and it does not promise placement, compensation, or income. It shows the team in motion so the prospect can see what they would be joining.

# 2.  The process the app supports

This is the actual recruitment process Kevin described — the same process every current member of Team Magnificent went through to decide to join the business.
## Step 1.  The Brand Ambassador speaks to the candidate first
Real human contact happens before any link is sent. This is by SMS text or a scripted phone call. The BA has a conversation with the candidate about GLP-THREE and the opportunity, in a personal voice.
## Step 2.  The BA sends a personalized invitation link
After the conversation, the BA uses the invitation tool inside the .team site to generate a personalized link. The link carries the BA’s name into the prospect’s experience — so the prospect sees “Kevin personally invited you” (or Paul, or whichever BA invited them), not a generic page.
## Step 3.  The prospect lands on the presentation page
The link opens the presentation page (tm-prospect-glp3-v3-UPDATED.html with minor tweaks). The prospect sees the hero with the BA’s name, reads the lead-in, and then watches Dr. Dan’s full 17-minute video. After the video, the prospect reads through the market opportunity, the product details, the system explainer, the binary 2-in-72 visualization, and the testimonials.
Order on the page is deliberate: product first (Dr. Dan, market, product), opportunity second (system, comp, save). The product is what is compelling. The opportunity follows once the product is understood.
## Step 4.  Video completion triggers an event
When the prospect has viewed Dr. Dan’s video, an event fires. This is the gate. Until the video has been viewed, no placement occurs. (Note: Claude will need to clarify with Kevin how strictly this gate is enforced — see Open Questions, section 7.)
## Step 5.  The prospect is placed in the holding tank
On video completion, the prospect is placed sequentially into the team-wide holding tank and given the next position number in line. The holding tank is one shared pool — every BA’s prospects flow into the same pool. Positions are assigned strictly in arrival order. Once assigned, a position number does not move.
## Step 6.  The prospect sees the dashboard
Immediately after placement, the prospect sees the dashboard (dashboard-prototype.html). The dashboard shows them their position, the live team forming around them, and the live demonstration of the powerline mechanic. The prospect can watch other prospects being placed behind them in real time.
## Step 7.  The prospect takes the next step
On the dashboard’s final section, the prospect chooses one of two paths: request a personal call back from their inviting Brand Ambassador, or reserve a seat at the next Team Magnificent live webinar (Tuesday 7pm Pacific, hosted by Kevin and Paul, every 72 hours). Both paths lead to a real human conversation.
## Step 8.  The Brand Ambassador walks the prospect into THREE
If the prospect decides to enroll, the BA walks them into THREE International through THREE’s own tools, off-app, BA-to-BA. The app does not handle the actual enrollment in THREE. Once enrolled, the new BA is now using the .team site for their own onboarding (returning the cycle to Step 1 from the new BA’s side).

# 3.  The presentation page — section by section

Source file: tm-prospect-glp3-v3-UPDATED.html. This is what the prospect sees when the BA’s invitation link opens. The page already exists; minor changes are required (see end of this section).
## Ticker bar (top)
A horizontal scrolling ticker across the very top of the page in teal. It carries six rotating messages — including a personalized line that swaps in the BA’s name (“Kevin personally invited you to see this opportunity”). The other messages cycle activity proof points: “David H. in Massachusetts — 3 prospects invited this week,” “Dr. Roni S. in New York — Week 1 momentum activated,” “72% of Americans overweight or obese — the market is wide open,” etc.
## Hero — “You Were Personally Invited”
- Eyebrow: “Team Magnificent” — Team Magnificent alone, per brand-isolation lock (2026-05-17); no THREE naming on .com eyebrows.
- Headline: “You Were Personally Invited.” — the word “Personally” in gold.
- Lead paragraph: “[BA name] looked at you and saw something — the drive, the character, the potential of a person who could build something extraordinary. They put your name on this invitation because of that. Not everyone gets this. You did.”
- Live badge: a pulsing teal dot next to “[BA name] personally invited you.”
- Two CTAs: a gold “Watch The Product Video” (jumps to the video section) and a ghost “Save My Spot” (jumps to the form). NOTE: the “Save My Spot” form is being removed — see end of section.
## Part 1 — The Product (Dr. Dan video)
- Section label: “Part 1 — The Product.” Headline: “Watch Dr. Dan. Then Everything Makes Sense.”
- Lead copy: “Dr. Dan Gubler is Chief Scientific Officer and Chief Formulator — Caltech-trained PhD in Organic Chemistry, 16 patents, 1.3 million followers, top-50 podcast. This is not marketing. This is peer-reviewed science delivered by the man who formulated GLP-THREE. Watch the full video before anything else on this page.”
- Embedded YouTube video: 17 minutes, Dr. Dan Gubler explaining GLP-THREE. Current embedded video ID: 1IZiV7RXdCY.
## Part 2 — The Market Opportunity
- Label: “Part 2 — The Market Opportunity.” Headline: “A $6.8 Trillion Market. And A Problem Nobody Has Solved.”
- Six market stat cards, each with a cited source:
- $6.8T — Global wellness economy in 2024, projected to reach $9.8T by 2029 (Global Wellness Institute, 2025)
- 72% — Of American adults overweight or obese (CDC National Health Statistics, 2024)
- $1,200 — Monthly out-of-pocket cost for Ozempic, Wegovy, or Mounjaro without insurance (WebMD / AMA Research, 2025)
- 10M+ — Americans currently on GLP-1 treatment, projected to reach 25M by 2030 (J.P. Morgan Research, 2026)
- 70% — Of Americans believe GLP-1 drugs are only accessible to the wealthy. They are right. (Health Management Academy, 2026)
- $200B — Projected GLP-1 receptor agonist market by 2033 (Grand View Research, 2025)
- Problem card: explains Ozempic / Wegovy / Mounjaro side effects, the $1,200/month price, and that more than 80% of overweight Americans received no GLP-1 treatment in 2024 because the drugs are priced out of reach. “That gap is exactly where GLP-THREE lives.”
## Product detail — “Natural. Patented. No Needle. No Prescription.”
- Section label: “The Science — The Product.”
- Lead: GLP-THREE is powered by MBC-267, a proprietary peptide complex discovered in Norwegian salmon and mushrooms. Binds to the same GLP-1 receptors as the injectable drugs — naturally, without pharmaceutical side effects. 100% natural, non-GMO, a dropper 30 minutes before meals.
- Dr. Dan card: names him as Chief Scientific Officer and Chief Formulator (employer not named, per brand-isolation lock) with full credentials — Caltech PhD, 15+ years cellular absorption formulation experience, 70+ supplements formulated, 16 patents, peer-reviewed publications, 1.3M followers, top-50 podcast.
- Two product cards: “How It Works” (MBC-267 binds GLP-1 receptors through a natural pathway via cellular absorption technology) and “What It Does” (feel fuller longer, curb cravings, support healthy weight management, decrease body fat while supporting muscle tone, all natural, ages 12 and up).
## Part 3 — The System
- Label: “Part 3 — Our System Technology.” Headline: “You’re Not Just Learning. You’re Inside The System Right Now.”
- Frames the live demonstration: “Most people learning about network marketing get TOLD how it works. PowerPoint slides. Hotel meetings. Three-way calls. Abstract concepts. You’re doing something different. Right now — while you’re reading this page — you’re being placed inside this organization. [BA name] invited you. When you save your spot below, you’ll see YOUR NAME in the binary tree. You will see people being placed underneath you. You’re not watching a presentation. You’re experiencing what it is to build a team in real time.”
- “Here’s What’s Happening Right Now” card: explains that the BA is placing others below the prospect while the prospect reads, and that everybody on the team is placing right now because everybody is using the system together.
- “We’re Not Offering You a Free Ride” story card: the benefit is the power of team-building plus the system — not passive income, not spillover, not “sit back and watch money roll in.” Everyone pulls their own weight, and everyone benefits when the whole team does.
- “Location, location, location” framing: first person in gets the best benefits, last person in gets the least. “Would you rather be first in line with 100 people behind you, or last in line with 100 people ahead of you — knowing thousands more are coming in?”
- “Real Story. Real Money. Real Difference.” Paul Barrios / Jim Bell story — Paul took the spot, made tens of millions; Jim Bell came in months later, missed out on millions. Same company, same product, same sponsor, same opportunity. The only difference was timing and position.
- “$110,000 AI-Powered Infrastructure” card: explains the system is what the prospect is currently experiencing — personalized invitations, live team momentum, instant placement, automated follow-up. “For the next 2 weeks: FREE enrollment when you come in with the 3-pack.” $200 for 3 bottles, 100 CV, $0 enrollment fee (normally $30, waived). Total ~$220 to plug into a $110,000 system. KFC franchise analogy: KFC costs $1.5M for the franchise; Team Magnificent costs $220 to plug into the infrastructure. THREE International pays up to $21,000 per week in binary commissions.
## Part 4 — Power of 2 / 2-in-72
- Label: “Part 4 — Power of 2 Demonstration.” Headline: “2 In 72. Simple. Duplicatable. It Compounds.”
- Lead: THREE International runs a binary compensation system — every BA builds two legs. When volume cycles on both sides, income is generated. The 2-in-72 challenge is how Team Magnificent activates fast momentum — every new BA introduces two people in their first 72 hours.
- Three-step explainer cards: (1) You Enroll, (2) Invite Two People, (3) They Do The Same.
- Interactive binary tree visualization with Week 1 / Week 2 / Week 3 / Week 4 selector buttons. Shows the tree growing each week with metrics: Total BAs, Cycles per Week, Weekly Estimate. Week 1 starts at 1 BA / 1 cycle / $35/week. Week 4 reaches 15 BAs / 56 cycles / $1,960/week.
- Note printed under the tree: “Illustration only. Income not guaranteed. Results vary based on individual effort, team activity, and compliance with THREE International Policies and Procedures.”
- Closer copy: “The earlier you get in, the more people end up below you as the team grows. Everyone below you contributes to volume flowing through your legs. That’s your powerline.”
## Save Your Spot form  —  TO BE REMOVED
REMOVE: This entire section will be removed in the new version. Currently it captures name, email, phone, with a button labeled “SAVE MY SPOT IN THE TREE” and writes to a MongoDB endpoint before redirecting to tm-binary-live.html.
In the new flow, the form is not on the presentation page. The conversion moment moves to the dashboard’s Section 6 (“Your Next Move”) after the prospect has watched the video and been placed in the holding tank.
## Testimonials
- Label: “Proof — Real Results.” Headline: “The Product Works. Real People. Real Results.”
- Currently shows Kevin Gardner’s testimonial (14 pounds in 6 weeks at 60+ years old) plus two “coming soon” placeholder cards. Will fill as the team grows.
## Final strip + footer
- Final strip repeats the Jim Bell / Paul story headline and a final “SAVE MY SPOT IN THE TREE” CTA. (CTA copy will need to change once the form is removed.)
- Footer: “Team Magnificent · Built by Kevin Gardner · teammagnificent.com” — Team Magnificent only, per brand-isolation lock (2026-05-17): no THREE branding, no promoter-tool disclaimer.
## Confirmed changes for the new version
- REMOVE — the Save Your Spot form section entirely.
- REMOVE / RELABEL — the secondary “SAVE MY SPOT” button in the hero (currently jumps to the form) and the duplicate at the end of the final strip.
- KEEP — the Dr. Dan video, market section, product detail, system section, Power of 2 visualization, testimonials.
- ADD — (implied by the flow Kevin described): an event that fires on video completion, triggering the prospect’s placement into the holding tank and navigating them to the dashboard.
- MINOR INFORMATION CHANGES — Kevin has mentioned minor changes are coming to the page content. The current text reflects what is in the HTML file as of this readback; specific tweaks have not been listed yet.

# 4.  The dashboard — section by section

Source file: dashboard-prototype.html. This is what the prospect sees after the Dr. Dan video has been viewed and they have been placed in the holding tank. It is the live demonstration of the team forming around them — Kevin’s adaptation of the powerline concept.
## Ribbon (sticky top bar)
A thin bar at the top, sticky as the prospect scrolls. Left side: the Team Magnificent brand mark (a small circle with a cross and teal dot) and the words “Team Magnificent” in gold. Right side: a pulsing teal dot and the words “Live · holding tank.” The bar uses a 70% black tint with backdrop blur — present but not loud.
## Section 1 — Arrival
- Eyebrow line: “Invited by [BA full name]” — the BA name highlighted in gold.
- Massive headline: “You saw it. You’re in.” — the word “in” in bright gold.
- Sub-headline: “The video did its work. You’re now part of the team that’s building the fastest-moving wellness movement in network marketing. Welcome.”
- Position card — three columns inside a gold-bordered card with a subtle gold/teal gradient:
- Left: “Your position” label, then a very large gold number — the prospect’s assigned position number (example in prototype: #347).
- Middle: “Held in [BA first name]’s leg” as a heading, with copy: “You’ve been placed in the Team Magnificent holding tank — the live demonstration of how the team is forming around you, in real time.”
- Right: “Placement” stamp showing the exact local time the prospect was placed (example: “02:47 PT · today”).
## Section 2 — Opportunity
- Eyebrow: “The market you just stepped into.”
- Headline: “This isn’t a small room.”
- Lead copy: “GLP-THREE is a natural alternative in one of the fastest-expanding wellness categories on the planet. The numbers aren’t ours — they’re public. We’re just standing where they point.”
- Four market stat cells in a horizontal grid:
- $6.8T — Global wellness market (GWI · 2025)
- $200B — GLP-1 alternatives by 2033 (industry projection)
- 72% — Americans overweight (CDC · 2024)
- $1,200/mo — Cost of synthetic alternatives (average retail · 2025)
## Section 3 — The Mechanic
- Eyebrow: “How teams build in this market.”
- Headline: “Two people. Then they find two.”
- Lead: “The math is simple and the rhythm is fast. Each person finds two. Those two each find two. The team doubles. We move on a 72-hour rhythm — speed is the multiplier, not the exception.”
- DOM cascade visualization: seven horizontal rows (1, 2, 4, 8, 16, 32, 64 squares) that light up in sequence as the section enters view. A vertical gold gradient line runs through the center of the cascade. Each row has a label to its right — “1 leader,” “2 builders,” “4 builders,” etc.
- Cascade destination: a downward arrow, the label “The math points here,” then a very large “100,000” in bright gold with the subtitle “Qualified Brand Ambassadors. That’s the team we’re building.”
- Three named principles below in a row:
- Power of 2 — “The team doubles when each person finds two. One becomes two, two becomes four, four becomes eight — that’s how speed compounds.”
- 2 in 72 — “Find your first two people in 72 hours. It’s not a deadline — it’s a rhythm. The team moves at the speed of its leaders.”
- One bite at a time — “Big movements get built one daily action at a time. The system handles the scale. You handle the relationships.”
## Section 4 — Live Place (this is the powerline demonstration)
- Eyebrow: “Your place in the live team.”
- Headline: “The team is forming around you. Right now.”
- Lead: “You’re position #[number]. The numbers below update live. Watch what happens when you stay on this page.”
- Two-column board:
- Left column — two counter cards. “Ahead of you” shows builders placed before this prospect’s position (static, since position doesn’t move). “Behind you · live” has a pulsing teal dot and a live-counting number of new prospects placed since this prospect arrived. Below each, a short sub-line of context.
- Right column — a live placement stack. A short feed of recent placements: position number, prospect first name and last initial, time-ago label (“just now,” “8s ago,” “22s ago”). The stack ages — older entries push down, time labels increment. Each new placement appears at the top with a fresh-tinted treatment. The list trims to about 9 visible at any time.
This is the section that creates the FOMO Kevin described. While the prospect reads, they see other prospects landing in real time, with names and timestamps. The team is visibly forming around their position.
## Section 5 — Team Magnificent Advantage
- Eyebrow: “Why Team Magnificent moves faster.”
- Headline: “We work together. With the same goal.”
- Lead: “Most teams in network marketing recruit alone — every Brand Ambassador running their own scattered tools, their own scattered process. Team Magnificent built the technology that changes that.”
- Kevin’s quote card: “We’ve harnessed the power of our team using technology so we’re working together with the same goal — to win.” — attributed: Kevin L. Gardner, founding co-leader.
- Mission board: large “100,000” figure with the label “Qualified Brand Ambassadors on Team Magnificent” and the mission philosophy: “Our mission is simple — empower every Brand Ambassador to build their business, and help each one find at minimum two qualified recruits who do the same. Until we reach one hundred thousand, together.”
- Pool grid — four activity stats showing the team in motion:
- 47 — Brand Ambassadors active in the last 24 hours (tagged Live)
- 213 — Invitations sent across the team today (tagged Pooled)
- 89 — New placements added to the team in 24h (tagged Compounding)
- +38% — Recruitment velocity through shared OS (tagged Operational)
- Compounding closer: “One team. One pool. One system.” + a longer paragraph explaining that when the BA invited this prospect, the invitation moved alongside every other BA’s invitation, feeding the same dashboard. “The momentum compounds. Your placement at #[N] is the result of every Brand Ambassador who came before you. The team at #500, #1,000, #5,000 will exist because of every Brand Ambassador who joins after.”
- Final line: “Built to win. Built to win together.”
- Compliance signature underneath: “Operational architecture · numbers of record · no performance promise.”
## Section 6 — Your Next Move
- Eyebrow: “Your next move.”
- Headline (locked from Chat #82): “Let’s have a real conversation about this unfolding new opportunity.”
- Lead: “Two ways to take the next step — a personal call with [BA first name], or the live team event Tuesday night. Both lead to the same place: two humans, an honest conversation, real context for your decision.”
- Two CTAs side by side:
- Left (gold) — “A real conversation with [BA].” Headline: “I’m ready to talk with [BA full name].” Three radio buttons: “I’m interested — I want to understand more,” “I’m ready to join Team Magnificent,” “I have specific questions to work through.” Two fields: Phone, Best time to call. Submit button (gold): “Yes — let’s talk.”
- Right (teal) — “Join us live.” Headline: “The next Team Magnificent live, in [N] hours.” Event line: Tuesday · 7:00 PM Pacific · Zoom. Hosts: Kevin L. Gardner and Paul Barrios. Every 72 hours. Live countdown timer (Days / Hours / Min / Sec). Two fields: Name, Email. Submit button (teal): “Reserve my seat.”
## Footer
- Brand mark: “Team Magnificent” in gold.
- Two brand lines: “An operational team inside THREE International.” + “We build people before we build volume.”
- Compliance disclaimer paragraph: “Queue positions and momentum displays demonstrate team activity in real time and do not guarantee any final placement, compensation, or earnings outcome. Market figures cited from public sources are for context only. This page contains no income claims, placement promises, or guarantees of any kind. Team Magnificent is an independent operational team. Official Brand Ambassador enrollment occurs through THREE International.”

# 5.  The .team site (for new and active Brand Ambassadors)

This is the BA-facing site — what a new BA uses after they have decided to join Team Magnificent. Kevin described five areas of functionality. The order below reflects what a new BA encounters in their first hours.
## 5.1  Welcome to the team
The first surface a new BA sees after enrollment. Welcomes them onto the team and into the system. Sets the tone for what comes next.
## 5.2  Michael — the voice agent interview
Michael is an outbound voice agent (Telnyx-based). When a new BA arrives, Michael calls them and conducts an interview to capture:
- Why they are doing the business.
- What financial goals they hope to attain.
- Their time commitment.
- General things that are useful for the sponsor to know in order to help the BA grow their business.
The transcript and scoring of the interview is captured and fed back to the BA’s own record and to the sponsor BA (their upline). Michael is BA-facing only — never prospect-facing, never anywhere on .com.
## 5.3  Fast Start Guide — first 72 hours
Structured guidance for the new BA’s first 72 hours. The goal is for the new BA to get qualified and paid in their first week, starting out with success and in a position to build a team and grow. The Fast Start Guide includes:
- Compensation plan training (written material, walked through).
- Understanding placement in the binary.
- Learning more about GLP-THREE and THREE International’s other products.
- Creating an initial list of people to share the product with — the new BA’s first prospects.
- Identifying the new BA’s two initial candidates who will join with them to build a THREE International business.
The Fast Start Guide drives toward a single milestone: the new BA gets their first two team members in the 72 hours after completing the first 72 hours of training. That earns qualification and a first paycheck in week one.
## 5.4  10-step new member orientation (live with Kevin or Paul)
Hosted live by Kevin or Paul. Ten steps walked through with the new BA in real time. (The .team site presents the schedule, materials, and the join link for the live session. The session itself happens off-site on Zoom or equivalent.)
## 5.5  Invitation generator
The tool the BA uses to send a personalized invitation link to a prospect — only after the BA has personally spoken with the candidate by SMS text or scripted phone call. The generator produces the personalized link that opens the presentation page with the BA’s name swapped in for the data-ba-name placeholders.
Kevin explicitly noted: the BA speaks to the candidate first, then sends the link. The generator is not a cold-outreach tool. It serves the warm conversation.

# 6.  Data exchange — what travels between the pieces

This section captures what the system needs to know and pass between surfaces. It is not a database schema. It is the information that has to flow for the experience Kevin described to work.
## Per invitation
- Which BA generated it.
- The BA’s full display name and first name (for the page personalization).
- A unique link/token that identifies this specific invitation.
- When the invitation was generated.
- Optionally: the prospect’s name and phone (captured by the BA when generating, since they have already spoken).
## Per prospect arrival on the presentation page
- Which invitation link they clicked.
- When they landed on the page.
- Whether they started the video. (Likely. To confirm with Kevin.)
- Whether they completed the video — the event that triggers placement.
## Per placement in the holding tank
- Which prospect was placed.
- Which BA sponsored them (locked at this moment, never changes).
- Their assigned position number (sequentially assigned across the entire team).
- The exact placement timestamp.
## Per next-move action on the dashboard
- If the prospect chose “real conversation”: their phone, their best time, which radio option they picked, which BA gets notified.
- If the prospect chose “reserve my seat”: their name, email, which upcoming webinar.
## What the BA sees on their side
- Every invitation they have sent, and what happened to each one.
- Who watched the video, who got placed, who requested a callback, who reserved a webinar seat.
- A callback alert (SMS text) when a prospect asks for a call.

# 7.  Open questions for Kevin

These are things Claude needs to confirm before writing any code. They are not assumptions to be made. They are decisions to be made by Kevin.
## On the presentation page
- Confirm: the Save Your Spot form is removed entirely. The page is information-only after the changes.
- Confirm: the two CTAs in the hero (“Watch The Product Video” and “Save My Spot”) — does the second one get removed, replaced, or repurposed?
- The final strip’s “SAVE MY SPOT IN THE TREE” button — remove, replace, or repurpose?
- What minor information changes are coming to the page content? (Stats updates, copy tweaks, new testimonials?)
- Should the page still show the Jim Bell / Paul story and the $110,000 system story — or are those moving / changing?
## On the video-completion event
- How strict is the gate? Three options: (a) anyone can advance to placement at any time, (b) the prospect must visibly play the video to the end before placement happens, (c) somewhere in between — for example, an “I’ve watched it” button after the video has been on screen for at least N minutes.
- What happens if the prospect tries to navigate to the dashboard URL directly without watching? Hard block? Redirect back to the video?
- Should the prospect be able to come back to the dashboard later (after closing the tab), or is the dashboard a one-time experience tied to that session?
## On the holding tank and position numbers
- Are position numbers across the entire team a single sequence (#1, #2, #3 … #347), or per-BA (each BA’s prospects numbered #1, #2, #3)?
- The prototype shows #347 as an example. Where does the count actually start? At #1 for the first prospect placed? Or is there a starting offset (representing existing team members)?
- Does the “Ahead of you” number include current Brand Ambassadors who have already enrolled, or only other prospects in the holding tank?
- Are the names shown in the “Live placements” stack on Section 4 real other prospects who arrived, or simulated/decorative? (This matters for compliance — “numbers of record” in the disclaimer needs to be accurate.)
- How long does a prospect stay in the holding tank if they don’t enroll? The system prompt mentioned an 8-week consideration window — is that still right?
## On the .team site
- What’s the priority order for the .team surfaces — welcome, Michael, Fast Start Guide, comp training, 10-step orientation, invitation generator? Which one ships first?
- Who actually writes the welcome content, the Fast Start Guide modules, the comp plan training material, and the product training? Does it already exist somewhere?
- What does Michael’s interview script say? Does the script exist? Who maintains it?
- How does a new BA get into the .team site in the first place? They have just enrolled in THREE — what is the handoff that gives them access here?
- Authentication: how does a BA prove who they are when they log in? Real password? Magic link? Single sign-on with something else?
## On the activity stats in Section 5
- The pool grid shows 47 / 213 / 89 / +38%. Are these computed from real activity? Or hand-curated weekly?
- Are these numbers visible to every prospect? If so, what happens on a slow day when the numbers would look small?
## On the webinar
- Is the webinar always Tuesday 7pm Pacific? Always hosted by Kevin and Paul? What happens to the countdown after the webinar starts — does it reset to the next one?
- Does “Reserve my seat” send a Zoom link to the email, write to a CRM, or both?
## On Telnyx / SMS
- Does the callback alert text actually get sent to the BA’s phone when a prospect submits the dashboard’s Section 6 form?
- Is Telnyx the chosen SMS provider, or is that still open?
## On compliance
- The disclaimer states: “no income claims, placement promises, or guarantees of any kind.” Does any current copy on either page need to be tightened to match? (Particularly the $1,960/week Week-4 estimate, the “up to $21,000 per week in binary commissions” line, and the Paul / Jim Bell millions framing.)
- RESOLVED by brand-isolation lock (2026-05-17): the .com footer is Team Magnificent branding only — no promoter-tool disclaimer, no THREE naming — on both the presentation page and the dashboard. The earlier footer-wording question is closed.

# 8.  What Claude built earlier in this conversation (for reference)

Claude already built a partial version of this app earlier in this conversation, before fully understanding the design. That code is sitting on Kevin’s machine and GitHub right now. This section exists so Kevin knows what is already there before any new work is done.
## On Kevin’s machine
- D:/momentum-creation-system/ — a Node + TypeScript monorepo with three workspaces.
- server/ — Express API server on port 4001.
- apps/com/ — a Vite + React prospect-facing site on port 5173. Does NOT match the presentation page or the dashboard documented in this readback. Built from a system-prompt summary, not from the actual files Kevin uploaded.
- apps/team/ — a Vite + React BA-facing site on port 5174. Five screens: a stub login, an empty cockpit, a mint-token form, a token list. Does NOT include welcome, Michael, Fast Start, training, or 10-step orientation.
- packages/shared/ — brand tokens and shared constants.
## On Kevin’s GitHub
- Public repo: devklg/momentum-creation-system, 10 commits on main.
## In Kevin’s databases (Universal Gateway, MongoDB / Neo4j / ChromaDB)
- MongoDB database “momentum_creation_system” with collections: bas, invite_tokens, prospects, callback_requests, ba_alerts, system. Most empty. The bas collection contains ba_kevin (Kevin L. Gardner) and ba_paul (Paul Barrios) records.
- Neo4j: (:BA) nodes for ba_kevin and ba_paul.
- ChromaDB: six new collections (mcs_invite_tokens, mcs_prospect_activity, mcs_callback_requests, mcs_system, mcs_bas, mcs_ba_alerts).
- Roughly 15 records were added to Kevin’s existing kevin_decisions and kevin_library collections, tagged with project momentum_creation_system.
## What Claude recommends
Once this readback is corrected and signed off, the right move is most likely to delete the existing momentum-creation-system code and database artifacts, and start from a foundation that fits the design Kevin actually has in mind. Some pieces (sponsor immutability in the data layer, the triple-stack write pattern, the brand tokens) may be salvageable; most of the front-end will not be.
But this is Kevin’s call, not Claude’s. Nothing gets deleted, kept, or rewritten until Kevin says so.

# 9.  Sign-off

This document is a readback of the Team Magnificent app as Kevin described it across the conversation on 2026-05-14 / 2026-05-15. It captures what Claude understands. It is not a build plan.
Kevin’s options after reading this:
- Mark up this document with corrections, missing pieces, and anything Claude got wrong.
- Send a corrected version back to Claude, or read the corrections out in a new conversation.
- Decide whether the existing momentum-creation-system code and database artifacts get deleted, salvaged, or left alone.
- Decide what the actual first piece of the app is that gets built — once this document is signed off and not before.
Kevin’s signature / date:
_____________________________________________	_______________________
Kevin L. Gardner	Date
— end of document —