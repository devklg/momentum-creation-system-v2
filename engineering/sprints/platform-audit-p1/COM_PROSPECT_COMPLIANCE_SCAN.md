# COM Prospect Compliance Scan

Generated: 2026-07-12T18:24:26.204Z

## Summary

- Scope: `apps/com/src visible strings plus shared compliance constants`
- Files scanned: 34
- Visible strings scanned: 411
- Blocking violations: 0
- Allowed signals: 68
- Status: pass

## Blocking Rules

| Rule | Description |
| --- | --- |
| `income_or_compensation_claim` | No income, earnings, compensation, commission, rank, cycle, CV, bonus, or payout claims. |
| `placement_or_spillover_promise` | No placement guarantees, spillover promises, binary-leg promises, or downline projections. |
| `ai_prospecting_or_qualification` | No AI prospecting, automated calling, AI lead qualification, scoring, or ranking language. |
| `current_team_headcount` | No current team head count; the 100,000 goal is allowed. |
| `three_company_branding` | No THREE International company branding, logo references, or promoter disclaimers. |
| `programmatic_three_handoff` | No programmatic enrollment, registration, or company handoff route language. |

## Allowed Signal Counts

| Signal | Count | Description |
| --- | ---: | --- |
| `glp_three_product_context` | 13 | GLP-THREE product naming is allowed when it does not name THREE International. |
| `public_market_or_cost_context` | 7 | Public market figures and product-category cost context are allowed when not tied to earnings. |
| `team_goal_context` | 5 | The 100,000 team goal is allowed; current team head count is not. |
| `pmv_language_context` | 17 | Prospect-facing PMV language is People, Momentum, Volume, and Checks. |
| `placement_demo_context` | 24 | Queue, placement, and beneath-you language is allowed only as team activity demonstration. |
| `canonical_disclaimer` | 2 | The canonical .com disclaimer is allowed only through packages/shared/src/compliance.ts. |

## Violations

None.

## Allowed Signal Samples

| Signal | Source | Text |
| --- | --- | --- |
| `glp_three_product_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/02-Opportunity.tsx:29` | GLP-THREE is a natural alternative in one of the fastest-expanding wellness categories on the planet. The numbers aren&rsquo;t ours — they&rsquo;re public. We&rsquo;re just standing where they point. |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/00-TickerStrip.tsx:32` | GLP-THREE launched January 2026 · trademark and patent pending |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/03-DrDanVideo.tsx:423` | Dr. Dan Gubler GLP-THREE product video |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/03-DrDanVideo.tsx:431` | Dr. Dan Gubler — GLP-THREE product video |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/03-DrDanVideo.tsx:446` | Open Dr. Dan's GLP-THREE video in YouTube, then come back and continue. |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/06-NaturalPath.tsx:69` | GLP-THREE was built for the same outcome the category is chasing — through a different door. Same destination. Different mechanism. Different profile. Different cost. |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/06-NaturalPath.tsx:93` | GLP-THREE |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/07-Dossier.tsx:43` | GLP-THREE is built around MBC-267, a patented peptide complex found naturally in salmon and certain mushrooms. |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/07-Dossier.tsx:68` | GLP-THREE is taken as a liquid dropper. |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/07-Dossier.tsx:77` | Is GLP-THREE a drug? No. It is a dietary supplement designed to support your body's own GLP-1 signaling. It is not a prescription drug, not an injection, and not a GLP-1 receptor agonist. |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/07-Dossier.tsx:79` | Can I take it with other medications? Talk to your physician before combining any supplement with prescribed medication — including GLP-THREE. |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/08-KevinStory.tsx:42` | Kevin Gardner before and after using GLP-THREE — down 19 lbs, no injections, with measurements |
| `glp_three_product_context` | `apps/com/src/routes/tm-video-presentation/sections/09-Timing.tsx:49` | GLP-THREE launched in the third week of January 2026 with trademark and patent pending. The first all-natural GLP-1 replacement on the market. The window is opening, not closing. |
| `public_market_or_cost_context` | `apps/com/src/routes/tm-video-presentation/sections/00-TickerStrip.tsx:34` | $6.8T global wellness economy · the category is moving |
| `public_market_or_cost_context` | `apps/com/src/routes/tm-video-presentation/sections/04-Market.tsx:42` | $6.8T |
| `public_market_or_cost_context` | `apps/com/src/routes/tm-video-presentation/sections/04-Market.tsx:50` | $200B |
| `public_market_or_cost_context` | `apps/com/src/routes/tm-video-presentation/sections/04-Market.tsx:100` | A $6.8 Trillion Market. |
| `public_market_or_cost_context` | `apps/com/src/routes/tm-video-presentation/sections/05-PharmaceuticalSolution.tsx:56` | Out-of-pocket cost runs roughly $1,000 to $1,500 per month. Many insurance plans do not cover weight management on these drugs, leaving the cost on the patient. |
| `public_market_or_cost_context` | `apps/com/src/routes/tm-video-presentation/sections/06-NaturalPath.tsx:45` | $1,000–$1,500 out of pocket without coverage. |
| `public_market_or_cost_context` | `apps/com/src/routes/tm-video-presentation/sections/07-Dossier.tsx:53` | Dr. Dan Gubler — Chief Scientific Officer and Chief Formulator — developed the product. His scientific record: Caltech PhD in Organic Chemistry, sixteen patents, more than seventy supplements formulated across his career, a top-50 podcast on supplement science, and a public following of 1.3 million. |
| `team_goal_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx:84` | 100,000 |
| `team_goal_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx:86` | Qualified Brand Ambassadors. That&rsquo;s the team we&rsquo;re building. |
| `team_goal_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx:83` | 100,000 |
| `team_goal_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx:85` | Qualified Brand Ambassadors on Team Magnificent |
| `team_goal_context` | `packages/shared/src/compliance.ts:15` | A current head count of the team (the 100,000 goal is named, the current count is not) |
| `pmv_language_context` | `apps/com/src/routes/p-login.tsx:139` | We only text people whose phone was used to invite them and who have asked for their sponsor to reach out. If that's not you, ask whoever invited you for a fresh link. |
| `pmv_language_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx:51` | Two people. Then they find two. |
| `pmv_language_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx:96` | Find your first two people in 72 hours. It&rsquo;s not a deadline — it&rsquo;s a rhythm. The team moves at the speed of its leaders. |
| `pmv_language_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx:121` | invited you, that invitation didn&rsquo;t move alone. It moved alongside every other Brand Ambassador on Team Magnificent — feeding the same dashboard, the same momentum, the same proof you&rsquo;re seeing right now. The team&rsquo;s velocity is the sum of every BA&rsquo;s work, made visible through the same shared OS. |
| `pmv_language_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx:129` | Every prospect who lands here sees more team than the prospect who landed an hour ago. The momentum compounds. Your placement at # |
| `pmv_language_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/06-YourNextMove.tsx:268` | Hosted by Kevin L. Gardner and Paul Barrios. Open conversation, real team, real momentum — see for yourself. |
| `pmv_language_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/07-Footer.tsx:38` | We build people before we build volume. |
| `pmv_language_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:257` | Team momentum tape |
| `pmv_language_context` | `apps/com/src/routes/tm-video-presentation/presentationCopy.ts:71` | Once the video is complete, this page opens a private team view so you can see the momentum this message is connected to. |
| `pmv_language_context` | `apps/com/src/routes/tm-video-presentation/sections/00-TickerStrip.tsx:36` | Real people. Real results. No injections, no prescription. |
| `pmv_language_context` | `apps/com/src/routes/tm-video-presentation/sections/04-Market.tsx:112` | You are watching a generational shift in how people manage weight. It has already started. It is accelerating. |
| `pmv_language_context` | `apps/com/src/routes/tm-video-presentation/sections/05-PharmaceuticalSolution.tsx:40` | Ozempic, Wegovy, Mounjaro and others belong to a class called GLP-1 receptor agonists. They mimic a hormone the body makes naturally and signal the brain that you are full. Appetite quiets. Stomach emptying slows. People lose weight. |
| `pmv_language_context` | `apps/com/src/routes/tm-video-presentation/sections/08-KevinStory.tsx:49` | Real people. Real results. |
| `pmv_language_context` | `apps/com/src/routes/tm-video-presentation/sections/09-Timing.tsx:85` | Five years from now, everyone will know about this category. The people who moved first will have built something that runs without them. The people who waited will have watched. |
| `pmv_language_context` | `packages/shared/src/compliance.ts:7` | it shows really how it works, and people are signing up |
| `pmv_language_context` | `packages/shared/src/compliance.ts:14` | Compensation cycle math, volume math, or rank math |
| `pmv_language_context` | `packages/shared/src/compliance.ts:22` | Queue positions and momentum displays demonstrate team activity in real time and |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/00-Ribbon.tsx:46` | Live · holding tank |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/01-Arrival.tsx:63` | Your position |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/01-Arrival.tsx:72` | You&rsquo;ve been placed in the Team Magnificent holding tank — the live demonstration of how the team is forming around you, in real time. |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/01-Arrival.tsx:78` | Placement |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx:78` | The team is forming beneath you. Right now. |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx:82` | You&rsquo;re position # |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx:99` | Placed beneath you · live |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx:103` | Joining the team beneath your position as Team Magnificent grows. |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx:118` | You&rsquo;re first in line. The next placement will land here. |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx:129` | Every prospect who lands here sees more team than the prospect who landed an hour ago. The momentum compounds. Your placement at # |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:206` | Live position center |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:217` | Your video is complete, your position is live, and the team is still moving beneath you. The next step is simple: talk with |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:232` | Your position |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:235` | Placed |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:240` | Beneath you · live |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:243` | New placements joining the team after your position as Team Magnificent grows. |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:264` | Connecting to the live position stream. |
| `placement_demo_context` | `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx:265` | The next team placement will appear here. |
| `placement_demo_context` | `apps/com/src/routes/tm-video-presentation/presentationCopy.ts:43` | Here is something you may not have noticed. While you were watching, you were placed into our team's line. Not enrolled, not signed up - placed, so we could show you something real. |
| `placement_demo_context` | `apps/com/src/routes/tm-video-presentation/sections/03-DrDanVideo.tsx:468` | When the video finishes, continue to your live team position. |
| `placement_demo_context` | `packages/shared/src/compliance.ts:12` | Placement or queue-position-equals-leg-position promises |
| `placement_demo_context` | `packages/shared/src/compliance.ts:22` | Queue positions and momentum displays demonstrate team activity in real time and |
| `placement_demo_context` | `packages/shared/src/compliance.ts:23` | do not guarantee any final placement, compensation, or earnings outcome. |
| `placement_demo_context` | `packages/shared/src/compliance.ts:25` | This page contains no income claims, placement promises, or guarantees of any kind. |
| `canonical_disclaimer` | `packages/shared/src/compliance.ts:23` | do not guarantee any final placement, compensation, or earnings outcome. |
| `canonical_disclaimer` | `packages/shared/src/compliance.ts:25` | This page contains no income claims, placement promises, or guarantees of any kind. |
