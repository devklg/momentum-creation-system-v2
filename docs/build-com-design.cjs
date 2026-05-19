// Build: Team-Magnificent-COM-Design.docx
// Surface design document for teammagnificent.com (prospect-facing)
// Locked sources: tm-prospect-glp3-v3-UPDATED.html (working sketch only),
// dashboard-prototype.html (locked six-section design),
// Chat #82 / #84 architecture rules, and Kevin's powerline-adapted-to-binary mechanic.

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, PageBreak, LevelFormat, convertInchesToTwip,
} = require('docx');

const BLACK = '0A0A0A';
const GOLD = 'C9A84C';
const GOLD_B = 'F5C030';
const TEAL = '2DD4BF';
const GREY = '6B6B6B';
const RULE = 'C9A84C';
const RED = 'B00020';

// helpers

const p = (text, opts = {}) => new Paragraph({
  spacing: { before: 80, after: 120, line: 320 },
  children: [new TextRun({ text, ...opts })],
});

const pBold = (lead, rest) => new Paragraph({
  spacing: { before: 80, after: 120, line: 320 },
  children: [
    new TextRun({ text: lead, bold: true }),
    new TextRun({ text: rest }),
  ],
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 320, after: 160 },
  children: [new TextRun({ text, bold: true, size: 36, color: BLACK })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 140 },
  children: [new TextRun({ text, bold: true, size: 28, color: BLACK })],
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 220, after: 120 },
  children: [new TextRun({ text, bold: true, size: 24, color: BLACK })],
});

const h4 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_4,
  spacing: { before: 180, after: 100 },
  children: [new TextRun({ text, bold: true, size: 22, color: GOLD })],
});

const bullet = (text) => new Paragraph({
  bullet: { level: 0 },
  spacing: { before: 40, after: 60, line: 300 },
  children: [new TextRun({ text })],
});

const bulletBold = (lead, rest) => new Paragraph({
  bullet: { level: 0 },
  spacing: { before: 40, after: 60, line: 300 },
  children: [
    new TextRun({ text: lead, bold: true }),
    new TextRun({ text: rest }),
  ],
});

const bullet2 = (text) => new Paragraph({
  bullet: { level: 1 },
  spacing: { before: 30, after: 40, line: 280 },
  children: [new TextRun({ text })],
});

const rule = () => new Paragraph({
  spacing: { before: 80, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 4 } },
  children: [new TextRun({ text: '' })],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const callout = (label, body, color = GOLD) => new Paragraph({
  spacing: { before: 160, after: 160, line: 320 },
  border: { left: { style: BorderStyle.SINGLE, size: 24, color, space: 8 } },
  indent: { left: 240 },
  children: [
    new TextRun({ text: label + ' ', bold: true, color }),
    new TextRun({ text: body }),
  ],
});

const note = (text) => new Paragraph({
  spacing: { before: 80, after: 120, line: 300 },
  indent: { left: 200 },
  children: [new TextRun({ text, italics: true, color: GREY, size: 20 })],
});

// content

const children = [
  // ===== TITLE =====
  new Paragraph({
    spacing: { before: 2400, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'TEAM MAGNIFICENT', bold: true, size: 56, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'teammagnificent.com', bold: true, size: 64, color: GOLD })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Prospect-facing surface design', size: 28, color: TEAL })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Companion to the Signup & Architecture and App Description documents', size: 20, color: GREY, italics: true })],
  }),
  new Paragraph({
    spacing: { before: 1800 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Document series: .com (this), then .team, then /admin.', italics: true, color: GREY, size: 22 })],
  }),
  new Paragraph({
    spacing: { before: 600 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Read it. Mark it up. Tell Claude what is wrong. Nothing gets built until you say it is right.', italics: true, color: GREY, size: 22 })],
  }),
  pageBreak(),

  // ===== EXECUTIVE SUMMARY =====
  h1('Executive summary'), rule(),

  callout('Standing rule.', 'THREE International is the single source of truth and the final authority on all sponsorship, enrollment, placement, and compensation. Every record in this design mirrors THREE\u2019s records for Team Magnificent\u2019s own operational visibility. The Team Magnificent app never disputes or overrides THREE. If at any point our records differ, we update ours to match THREE.', RED),

  callout('Compliance posture for .com.', 'The marketing layer (presentation page, post-video dashboard, powerline visualization) shows reality without making promises. The compensation layer (binary leg, spillover, income) operates inside THREE\u2019s regulated structure. The two never overlap on prospect-facing surfaces. Never on .com: income claims or earnings projections, placement or queue-position-equals-leg-position promises, AI prospecting (Michael is BA-facing only), compensation cycle math, volume math, rank math, current head count of the team, THREE International branding (logo, name, eyebrow, or footer disclaimer). The 100,000 goal is named. The current count is not. Team Magnificent is the only brand on the page.', RED),

  p('This document describes every screen, every section, and every behavior on teammagnificent.com \u2014 the prospect-facing surface of the Team Magnificent Marketing Momentum Creation System. The .com site is where prospects arrive, watch the GLP-THREE product video by Dr. Dan Gubler, see the team\u2019s momentum demonstrated in real time, and make their next move.'),

  p('The .com site is replicated per Brand Ambassador. Every prospect arrives via a unique /p/{token} URL minted by the inviting BA from their .team invitation generator. The token resolves the inviting BA on the server side so that all routing \u2014 callback requests, webinar reservations, signal events \u2014 flows back to the right BA, AND so that the prospect-facing copy on the page is personalized to that BA. The page names the inviting BA throughout \u2014 in the hero, in the position card, in the callback CTA. Personalization is the rule. The page is never anonymous. The personal nature of the invitation is reinforced by the page declaring it, alongside the human SMS or message that delivered the link.'),

  pBold('Sections of this document. ', 'Section A: information architecture and routing. Section B: the presentation page \u2014 every section top to bottom, what it does, what it shows. Section C: the post-video dashboard \u2014 six locked sections including the powerline visualization. Section D: the conversion flow \u2014 callback request and webinar reservation. Section E: token lifecycle and return-to-link behavior. Section F: error states. Section G: brand application, tone, and brand isolation from THREE International. Section H: open questions for Kevin.'),

  pageBreak(),

  // ===== SECTION A =====
  h1('A. Information architecture and routing'), rule(),

  h2('A.1  The one route that matters'),
  p('Every prospect-facing page on teammagnificent.com is served from a single route pattern: /p/{token}. The token is an opaque identifier minted by the inviting BA when they use the invitation generator on .team. The token does two things on the server side:'),
  bullet('Resolves to the inviting BA, so callback requests and webinar reservations route to the right BA\u2019s cockpit.'),
  bullet('Tracks the prospect\u2019s state through the funnel \u2014 link minted, link clicked, video started, video completed, callback requested, webinar reserved, enrolled, or expired.'),

  h2('A.2  The two faces of /p/{token}'),
  p('What the prospect sees at /p/{token} depends on the funnel state of their token. The URL stays the same; the rendering changes.'),

  h3('Pre-video state \u2014 the presentation page'),
  p('When the prospect arrives at the link for the first time, they see the presentation page. This is the marketing layer \u2014 Dr. Dan\u2019s product video, the market opportunity, the GLP-THREE product detail, the team\u2019s story. The presentation page ends when the prospect completes Dr. Dan\u2019s video.'),

  h3('Post-video state \u2014 the dashboard'),
  p('At the moment the video reaches its completion event, the server silently records video_complete for this token, places the prospect in the team\u2019s shared holding tank pool, and the page transitions to the post-video dashboard. No interstitial. No \u201Cyou\u2019re now in\u201D form to fill out. The transition is the demonstration.'),

  h3('Return visits'),
  p('If the prospect closes the browser and returns to /p/{token} later, the server resolves the token to its current state and serves the appropriate page. If the prospect had completed the video, they see the dashboard. If they hadn\u2019t, they see the presentation page picking up where they left off (the video remembers its playback position via the YouTube iframe API).'),

  h2('A.3  What the URL never carries'),
  bullet('No BA name in the URL parameters \u2014 the token resolves on the server, not in the URL string.'),
  bullet('No prospect personal information in the URL \u2014 the token is opaque, not a base64 of an email address.'),
  bullet('No sponsor identification in the URL \u2014 the prospect doesn\u2019t see who their sponsor would be in the URL string itself. The inviting BA is named in the page copy, not in the URL.'),

  pageBreak(),

  // ===== SECTION B =====
  h1('B. The presentation page'), rule(),

  p('The presentation page is what loads when a prospect arrives at /p/{token} in its pre-video state. Its single purpose is to deliver the Dr. Dan Gubler GLP-THREE video and the supporting context that makes the video land. Conversion does not happen here \u2014 conversion happens on the post-video dashboard. The presentation page exists to earn the right to show the dashboard.'),

  callout('Reference source.', 'The existing file tm-prospect-glp3-v3-UPDATED.html is a working sketch of the presentation page. Its layout, brand application, and section structure are the reference. Its specific copy is not final \u2014 Kevin will handle the final compliance and copywriting pass. This document describes each section\u2019s purpose, what it shows, what behavior it has, and what it never contains.', GOLD),

  h2('B.1  Section order, top to bottom'),
  bulletBold('Ticker strip ', '\u2014 thin teal bar at the very top of the viewport. Animated horizontal scroll of short messages reinforcing the moment: GLP-THREE launched, the wellness category, the team\u2019s motion. Brand voice. No income, no comp. May include the inviting BA\u2019s name as part of the reinforcement (\u201C[BA first name] personally invited you\u201D), consistent with the rest of the page\u2019s personalization rule.'),
  bulletBold('Hero ', '\u2014 the page\u2019s opening statement. \u201C[Prospect first name], you were personally invited by [BA full name].\u201D Bebas Neue display headline in cream with the BA name in gold. Both names are interpolated server-side from the token-resolved prospect record and inviting BA record. Beneath: a body paragraph in the inviting BA\u2019s voice that names them once more. A live pulse badge in teal: \u201C[BA first name] personally invited you.\u201D Two call-to-action buttons: gold \u201CWatch The Product Video\u201D scrolling to the Dr. Dan section, and a ghost \u201CSee The Team\u201D scrolling to the market section.'),
  bulletBold('Part 1 \u2014 Watch Dr. Dan ', '\u2014 the product video. 16:9 embedded YouTube iframe. The video is the foundation; everything else on the page is supporting material. Eyebrow label in mono: \u201CPart 1 \u2014 The Product\u201D. Headline: \u201CWatch Dr. Dan. Then Everything Makes Sense.\u201D'),
  bulletBold('Part 2 \u2014 The Market Opportunity ', '\u2014 the macro frame. Headline: \u201CA $6.8 Trillion Market. And A Problem Nobody Has Solved.\u201D Followed by a grid of public-source statistics: $6.8T global wellness economy, 72% of American adults overweight, $1,200/mo synthetic drug cost, 10M+ Americans on GLP-1, 70% accessibility gap, $200B GLP-1 market by 2033. Each stat carries its source. Below the grid, a problem card framed in orange that names what GLP-THREE addresses.'),
  bulletBold('Part 3 \u2014 The Science of the Product ', '\u2014 GLP-THREE specifics. Headline: \u201CNatural. Patented. No Needle. No Prescription.\u201D Body copy explaining MBC-267, the natural peptide complex, the GLP-1 receptor mechanism, the cellular absorption delivery. A Dr. Dan credentials card naming him as Chief Scientific Officer and Chief Formulator of the product, with his credentials (Caltech PhD in Organic Chemistry, 16 patents, 70+ supplements formulated, 1.3M followers, top-50 podcast). The card does not name his employer \u2014 the credentials speak. Two product cards in a grid: \u201CHow It Works\u201D and \u201CWhat It Does.\u201D'),
  bulletBold('Part 4 \u2014 The Team in Motion ', '\u2014 the bridge into the team. Eyebrow: \u201CPart 4 \u2014 How The Team Moves.\u201D Headline that emphasizes momentum and team unity. Body copy describes the Team Magnificent OS at a high level \u2014 personalized invitations, live team momentum, shared system. The inviting BA may be named here as the human voice behind the invitation. No income figures, no commission language. The story Kevin will write for this section is the one that hands the prospect off to the dashboard moment after they complete the video.'),
  bulletBold('Part 5 \u2014 Real Results ', '\u2014 testimonials. As BAs use GLP-THREE and post results, their results appear here. At launch this section will be sparse \u2014 Kevin\u2019s testimony as the first card, and cards marked \u201CTeam results being collected\u201D for the rest. The section grows as the team grows.'),
  bulletBold('Final strip ', '\u2014 the closing moment before the video completes and the page transitions. A short, decisive headline. A single gold CTA button: \u201CContinue \u2014 See The Team.\u201D This button is only relevant if the prospect didn\u2019t watch the video to completion \u2014 video_complete from the iframe API is what actually triggers the dashboard transition. The button is a fallback.'),
  bulletBold('Footer ', '\u2014 minimal. Team Magnificent wordmark in teal, the URL teammagnificent.com, and the Team Magnificent compliance disclaimer (see G.5). No THREE International branding, no \u201Cindependent promoter tool\u201D disclaimer, no logo other than Team Magnificent\u2019s. No BA name in the footer.'),

  h2('B.2  What every section avoids'),
  bullet('No income claims, no earnings projections, no commission figures, no cycle math.'),
  bullet('No promises about placement in THREE\u2019s binary, queue position, or leg position. The page never claims the inviting BA will be the prospect\u2019s binary sponsor in THREE \u2014 that decision happens off-app at enrollment time, per the team\u2019s placement strategy. The page DOES name the inviting BA throughout as the human who personally invited the prospect; that personalization is the rule, not the exception.'),
  bullet('No current head count of the team. The 100,000 goal is named on the dashboard, not on the presentation page.'),
  bullet('No interactive binary tree visualization with weekly income estimates \u2014 the earlier working sketch contains one; the final page will not.'),
  bullet('No save-spot form. Conversion happens on the dashboard, not here.'),

  h2('B.3  Behavior'),
  bulletBold('Token capture. ', 'On first load, the server records that this token was clicked, with timestamp and any available browser context (no fingerprinting beyond what a normal request carries).'),
  bulletBold('Scroll-triggered animations. ', 'Section reveals fade in as the prospect scrolls. Subtle. Brand-quiet.'),
  bulletBold('Video tracking. ', 'The YouTube iframe API reports started, 25%, 50%, 75%, and complete events back to the server. These become signal events the inviting BA can see in their cockpit \u2014 \u201Cyour prospect watched 75% of Dr. Dan.\u201D'),
  bulletBold('Video completion is the trigger. ', 'When the video reaches its end (or the prospect manually skips to and past 95% of its duration), the page silently begins the transition to the dashboard. The token state advances to video_complete. The prospect is placed in the team\u2019s shared holding tank pool with a monotonic position number.'),
  bulletBold('Transition. ', 'The presentation page fades out. The dashboard fades in. The URL does not change \u2014 it stays /p/{token}. The prospect did not click anything to enter the dashboard \u2014 they earned it by completing the video.'),

  pageBreak(),

  // ===== SECTION C =====
  h1('C. The post-video dashboard'), rule(),

  p('The dashboard is what loads at /p/{token} once the token has reached the video_complete state. It is six locked sections in fixed order. The dashboard is the conversion engine of teammagnificent.com \u2014 it is where the prospect sees the team forming, sees their position, and makes their next move.'),

  callout('Reference source.', 'The existing file dashboard-prototype.html is the locked design for these six sections. Its layout, copy structure, brand application, and animation behavior are authoritative. This document transcribes that design and notes the specific adaptations to match the powerline-adapted-to-binary mechanic Kevin has confirmed.', GOLD),

  // C.1 Arrival
  h2('C.1  Section 1 \u2014 Arrival'),

  h3('Purpose'),
  p('The first thing the prospect sees after completing Dr. Dan\u2019s video. Confirms the moment. Establishes that the prospect is now part of something already in motion.'),

  h3('Layout'),
  bullet('Invited-by line at the top, small, in gold mono: \u201CInvited by [BA Name].\u201D This is the only place on the dashboard where the inviting BA is named by name. The naming is operational \u2014 the prospect knows the link came from this person, and the line confirms it.'),
  bullet('Massive Bebas Neue headline in cream: \u201CYou saw it. You\u2019re in.\u201D With \u201Cin.\u201D in gold.'),
  bullet('A subtitle in cream-mute confirming the video did its work and the prospect is part of the team.'),
  bullet('A position card \u2014 a horizontal three-part card that is the visual anchor of this section:'),
  bullet2('Left: \u201CYour position\u201D label and a massive Bebas Neue number with a # prefix. Position numbers are monotonic and assigned at the moment of video_complete. Position #347 means 346 prospects entered the team\u2019s shared holding tank pool before this one.'),
  bullet2('Center: A short copy block. \u201CHeld in [BA Name]\u2019s leg\u201D as the heading. Body copy explaining that the prospect has been placed in the Team Magnificent shared holding tank \u2014 a live demonstration of how the team is forming around them in real time.'),
  bullet2('Right: A timestamp stamp \u2014 \u201CPlacement / [HH:MM PT] \u00B7 today\u201D \u2014 anchoring the moment.'),

  callout('On the position card heading.', 'The current prototype text \u201CHeld in [BA Name]\u2019s leg\u201D is the locked design intent. The leg referenced here is the operational concept \u2014 the team momentum the prospect now belongs to. The page does not claim this corresponds to a specific binary leg in THREE. The leg the prospect actually enters in THREE\u2019s binary is determined by the inviting BA at enrollment time, off-app. The dashboard\u2019s \u201Cleg\u201D is the visible representation of team motion, not a binary placement promise. Kevin will tune the final copy for this card to be unmistakably non-promissory.', GOLD),

  h3('Behavior'),
  bullet('The position number assigned at video_complete is permanent. It never reshuffles. Position numbers are monotonic.'),
  bullet('The timestamp shows the prospect\u2019s local time zone, resolved client-side from the browser.'),
  bullet('This section does not animate beyond the initial fade-in \u2014 it\u2019s a stable anchor.'),

  // C.2 Opportunity
  h2('C.2  Section 2 \u2014 Opportunity'),

  h3('Purpose'),
  p('Establish the market context. The prospect just watched a 17-minute video about a single product \u2014 this section zooms out to the market that product addresses.'),

  h3('Layout'),
  bullet('Eyebrow in teal mono: \u201CThe market you just stepped into.\u201D'),
  bullet('Headline in Bebas Neue: \u201CThis isn\u2019t a small room.\u201D'),
  bullet('Lead paragraph: GLP-THREE is a natural alternative in one of the fastest-expanding wellness categories. Public numbers, public sources.'),
  bullet('A four-cell market grid \u2014 each cell shows a stat, a label, and a source:'),
  bullet2('$6.8T \u2014 Global wellness market \u2014 GWI \u00B7 2025'),
  bullet2('$200B \u2014 GLP-1 alternatives by 2033 \u2014 Industry projection'),
  bullet2('72% \u2014 Americans overweight \u2014 CDC \u00B7 2024'),
  bullet2('$1,200/mo \u2014 Cost of synthetic alternatives \u2014 Average retail \u00B7 2025'),

  h3('Behavior'),
  bullet('Static. Stats fade in on scroll. Sources are always visible \u2014 every claim carries a citation.'),
  bullet('The stats themselves are factual and public. Compliance-safe.'),

  // C.3 Mechanic
  h2('C.3  Section 3 \u2014 The Mechanic'),

  h3('Purpose'),
  p('Show the prospect how teams build in this market. This is the cascading rhythm \u2014 each person finds two, those two each find two, the team doubles. The mechanic is universal to network marketing; the demonstration here is the visual cascade animation.'),

  h3('Layout'),
  bullet('Eyebrow: \u201CHow teams build in this market.\u201D'),
  bullet('Headline: \u201CTwo people. Then they find two.\u201D'),
  bullet('Lead paragraph describing the doubling math and the 72-hour rhythm.'),
  bullet('A cascade visualization in the center \u2014 an animated tree that builds out as the prospect watches. Bebas Neue typography on the nodes. Subtle gold and teal accents.'),
  bullet('Below the cascade, a destination card: \u201CThe math points here \u2192 100,000 \u2014 Qualified Brand Ambassadors. That\u2019s the team we\u2019re building.\u201D'),
  bullet('Three principle cards in a row:'),
  bullet2('Power of 2 \u2014 the doubling explained.'),
  bullet2('2 in 72 \u2014 the rhythm explained.'),
  bullet2('One bite at a time \u2014 the daily action discipline.'),

  h3('Behavior'),
  bullet('The cascade animates on scroll-into-view. Three iterations of doubling. Visual demonstration, not interactive.'),
  bullet('The 100,000 number is named here as the goal. The current team count is not shown.'),
  bullet('No income figures attached to any of the cascade nodes. The cascade shows people, not dollars.'),

  // C.4 Live
  h2('C.4  Section 4 \u2014 Your Place in the Live Team'),

  h3('Purpose'),
  p('The FOMO engine. The prospect sees their position and watches the team form around them in real time. This is the section that converts the abstract mechanic from C.3 into the concrete demonstration the prospect is now part of.'),

  h3('Layout'),
  bullet('Eyebrow: \u201CYour place in the live team.\u201D'),
  bullet('Headline: \u201CThe team is forming around you. Right now.\u201D'),
  bullet('Lead paragraph telling the prospect their position number and inviting them to watch what happens when they stay on the page.'),
  bullet('A live board with two parts:'),
  bullet2('Left: two large counters. \u201CAhead of you\u201D shows the count of prospects placed before this one (static \u2014 the prospect\u2019s position minus one). \u201CBehind you \u00B7 live\u201D shows the count of prospects placed after this one, with a teal pulse dot, and increments in real time as new prospects elsewhere on the team complete their own videos.'),
  bullet2('Right: a position stack \u2014 a vertical list of recent placements. Each entry shows a position number, a city/state, and a relative timestamp. The stack updates live, new entries appearing at the top with a brief gold flash animation.'),

  h3('The powerline mechanic, made visible'),
  p('This is where the powerline-adapted-to-binary mechanic Kevin designed becomes visible to the prospect. What the prospect sees in this section is a generic demonstration of team momentum \u2014 one shared team leg growing as Brand Ambassadors across Team Magnificent send their invitations and their prospects complete the video. The visualization shows arrivals and growth as the team reaches out; it does not show binary leg structure, does not show actual placement decisions, does not show sponsor identity, does not show compensation flow.'),

  p('Behind the scenes, the inviting BA will, at the prospect\u2019s enrollment moment, place the new BA into either the left or right side of THREE\u2019s binary structure per the team\u2019s placement strategy. That happens off-app, in THREE\u2019s tools. The dashboard visualization is the marketing demonstration that the team is moving; the binary placement is the operational reality that happens after.'),

  callout('Compliance frame for the live section.', 'The position number, the ahead/behind counters, and the position stack are the visible team motion. They are factual \u2014 they describe the real holding tank pool of prospects across all of Team Magnificent at any moment. They do not promise placement in THREE\u2019s binary. They do not promise a sponsor identity. They do not promise compensation. The position is a marketing position in the demonstration, not a placement guarantee.', GOLD),

  h3('Behavior'),
  bullet('The behind-you counter updates via a server-sent events stream or short-poll. New increments animate with a subtle pulse.'),
  bullet('The position stack receives new entries as other prospects across the team complete their videos. The newest entry appears at the top; older entries push down and eventually fade off the bottom of the visible window.'),
  bullet('City/state is included with each entry for human texture, but no personal identifiers (no names, no emails, no phones).'),
  bullet('The stack is not editable. The prospect can\u2019t click an entry. It is presentation, not interaction.'),

  // C.5 Advantage
  h2('C.5  Section 5 \u2014 The Team Magnificent Advantage'),

  h3('Purpose'),
  p('Differentiate Team Magnificent from generic network marketing experiences. The system itself \u2014 the technology, the shared OS, the unified BA effort \u2014 is what makes the team move faster than a typical team would.'),

  h3('Layout'),
  bullet('Eyebrow: \u201CWhy Team Magnificent moves faster.\u201D'),
  bullet('Headline: \u201CWe work together. With the same goal.\u201D'),
  bullet('Lead paragraph contrasting Team Magnificent with the typical recruiting-alone pattern in network marketing.'),
  bullet('A quote card \u2014 Kevin Gardner as founding co-leader. \u201CWe\u2019ve harnessed the power of our team using technology so we\u2019re working together with the same goal \u2014 to win.\u201D'),
  bullet('A mission board displaying the 100,000 goal in massive type. The current count is not shown.'),
  bullet('A pool grid \u2014 four operational stats that describe team activity in motion:'),
  bullet2('Brand Ambassadors active in the last 24 hours (e.g. 47).'),
  bullet2('Invitations sent across the team today (e.g. 213).'),
  bullet2('New placements added to the team in 24h (e.g. 89).'),
  bullet2('Recruitment velocity through shared OS (e.g. +38%).'),
  bullet('A compounding closer card \u2014 \u201COne team. One pool. One system.\u201D Body copy that ties the prospect\u2019s position number back to the team\u2019s velocity. The team\u2019s growth is the sum of every BA\u2019s work, made visible through the same shared OS.'),
  bullet('A signature line at the bottom of the closer: \u201COperational architecture \u00B7 numbers of record \u00B7 no performance promise.\u201D Compliance acknowledgement that what\u2019s shown is operational reality, not earnings claims.'),

  h3('Behavior'),
  bullet('The four pool-grid stats refresh on page load. They reflect actual operational counts pulled from the server.'),
  bullet('The mission board is static. The 100,000 goal is the public commitment.'),
  bullet('The quote card is fixed copy attributed to Kevin Gardner as founding co-leader.'),

  callout('On the pool-grid stats.', 'These numbers are operational reality \u2014 they describe what BAs are actually doing across Team Magnificent in a 24-hour window. They are not promises about what the prospect will do. They are not promises about outcomes. They are not promises about earnings. They demonstrate that the team is moving, with the signature line at the bottom of the section reinforcing that what is shown is operational, not performance-projecting.', GOLD),

  // C.6 Next move
  h2('C.6  Section 6 \u2014 Your Next Move'),

  h3('Purpose'),
  p('Conversion. Two paths, both leading to a human conversation. Either a personal callback from the inviting BA, or a reserved seat at the Tuesday 7pm Pacific live webinar.'),

  h3('Layout'),
  bullet('Eyebrow: \u201CYour next move.\u201D'),
  bullet('Headline: \u201CLet\u2019s have a real conversation about this unfolding new opportunity.\u201D'),
  bullet('Lead paragraph: two ways to take the next step \u2014 a personal call with the inviting BA, or the live team event Tuesday night.'),
  bullet('A two-column CTA grid. Left column is the personal-callback CTA (primary). Right column is the webinar-reservation CTA (secondary).'),

  h3('CTA 1 \u2014 Personal callback'),
  bullet('Label tag at the top: \u201CA real conversation with [BA Name].\u201D'),
  bullet('Headline: \u201CI\u2019m ready to talk with [BA Name].\u201D BA name in gold accent.'),
  bullet('Body copy framing the call as the human moment.'),
  bullet('Three radio buttons \u2014 the intent picker:'),
  bullet2('\u201CI\u2019m interested \u2014 I want to understand more.\u201D'),
  bullet2('\u201CI\u2019m ready to join Team Magnificent.\u201D'),
  bullet2('\u201CI have specific questions to work through.\u201D'),
  bullet('Two form fields: Phone (best number to reach) and Best time (free-text).'),
  bullet('Gold submit button: \u201CYes \u2014 let\u2019s talk.\u201D'),

  h3('CTA 2 \u2014 Webinar reservation'),
  bullet('Label tag at the top: \u201CJoin us live.\u201D'),
  bullet('Headline: \u201CThe next Team Magnificent live, in [countdown].\u201D Countdown in teal accent.'),
  bullet('Event details: \u201CTuesday \u00B7 7:00 PM Pacific \u00B7 Zoom.\u201D'),
  bullet('Hosts: \u201CHosted by Kevin L. Gardner and Paul Barrios. Open conversation, real team, real momentum.\u201D'),
  bullet('A live countdown timer in four cells: Days, Hours, Min, Sec. Counts down to the next Tuesday 7pm Pacific occurrence.'),
  bullet('Two form fields: Name and Email (where to send the Zoom link).'),
  bullet('Teal submit button: \u201CReserve my seat.\u201D'),

  h3('Behavior on CTA 1 submit'),
  bullet('Intent radio is required; submit is disabled until one is selected.'),
  bullet('Phone is required and validated (format flexibility \u2014 accept various formats).'),
  bullet('Best time is optional but encouraged.'),
  bullet('On submit, the server records a callback_request signal event tied to the token and the inviting BA. The inviting BA gets an SMS via Telnyx alerting them. The event appears in the BA\u2019s .team cockpit as a new event on this prospect\u2019s CRM timeline.'),
  bullet('The page transitions to a confirmation state \u2014 \u201C[BA Name] will call you back. Watch for a call from [area code].\u201D The dashboard remains visible underneath; the confirmation is a soft inline state, not a new page.'),

  h3('Behavior on CTA 2 submit'),
  bullet('Name and Email are required.'),
  bullet('On submit, the server records a webinar_reservation signal event tied to the token. An email goes out with the Zoom link and the event details.'),
  bullet('The page transitions to a confirmation state \u2014 \u201CYour seat is reserved. Check [email] for the link.\u201D'),
  bullet('The inviting BA is notified via their cockpit that this prospect reserved a seat.'),

  pageBreak(),

  // ===== SECTION D =====
  h1('D. The conversion flow, end to end'), rule(),

  p('This section walks through what happens from the moment the prospect arrives at /p/{token} to the moment they enroll in THREE International \u2014 the off-app step that closes the loop.'),

  h2('D.1  Phase 1 \u2014 Arrival and video'),
  bullet('Prospect clicks the /p/{token} link from the BA\u2019s SMS or message.'),
  bullet('Server resolves the token: status = clicked. Records timestamp.'),
  bullet('Presentation page loads. Prospect scrolls, reads, eventually starts Dr. Dan\u2019s video.'),
  bullet('Video iframe API reports started, 25%, 50%, 75% events back to the server. Each becomes a signal event on the prospect\u2019s timeline visible to the inviting BA.'),

  h2('D.2  Phase 2 \u2014 Video complete and silent placement'),
  bullet('Video reaches its end (or the prospect manually advances past 95% of its duration).'),
  bullet('Server records video_complete for this token. Status advances to video_complete.'),
  bullet('Server silently assigns this prospect a monotonic position number in the team\u2019s shared holding tank pool. The position is timestamp-anchored and never reshuffles.'),
  bullet('Server writes the placement record to MongoDB, Neo4j, and ChromaDB via the Universal Gateway (triple-stack persistence).'),
  bullet('The presentation page fades; the dashboard fades in. URL stays /p/{token}.'),

  h2('D.3  Phase 3 \u2014 Dashboard engagement'),
  bullet('Prospect sees the six dashboard sections in order: Arrival, Opportunity, Mechanic, Live, Advantage, Next Move.'),
  bullet('The live section\u2019s behind-you counter and position stack update in real time. The prospect can stay on the page and watch the team move.'),
  bullet('If the prospect engages with Section 6 (Your Next Move), one of two CTAs fires.'),

  h2('D.4  Phase 4 \u2014 Conversion intent captured'),

  h3('If callback request'),
  bullet('Inviting BA receives an SMS via Telnyx within seconds with prospect intent, phone, and best time.'),
  bullet('Event appears in the BA\u2019s .team cockpit on this prospect\u2019s CRM timeline.'),
  bullet('Status advances to callback_requested.'),

  h3('If webinar reservation'),
  bullet('Email goes to the prospect with Zoom link and event time.'),
  bullet('Inviting BA notified in their cockpit that this prospect reserved a seat.'),
  bullet('Status advances to webinar_reserved.'),

  h2('D.5  Phase 5 \u2014 The off-app step (the human conversation)'),
  p('This phase happens entirely outside the app. The inviting BA calls the prospect (if callback requested) or attends the webinar with the prospect (if seat reserved). The conversation determines whether the prospect is ready to enroll in THREE International under the BA as their sponsor.'),
  p('The app does not participate in this conversation. There is no call recording on the prospect side. There is no AI prospecting. Michael, the voice agent, is BA-facing only and never speaks with prospects.'),

  h2('D.6  Phase 6 \u2014 Enrollment in THREE (off-app, BA-to-BA)'),
  p('If the prospect decides to enroll, the BA walks them into THREE International through THREE\u2019s own enrollment tools, off-app. The BA decides, per the team\u2019s powerline-adapted-to-binary placement strategy, which leg in THREE\u2019s binary the new BA enters (left or right under the BA, or deeper if the strategy calls for it).'),
  p('THREE records the enrollment and the sponsorship binding. THREE is the final authority on this record.'),

  h2('D.7  Phase 7 \u2014 Closing the loop'),
  bullet('The BA, back in their .team cockpit, marks the prospect\u2019s CRM record as enrolled. Optional: the BA enters the new BA\u2019s THREE BA ID for reference.'),
  bullet('The prospect\u2019s holding tank record flushes \u2014 they are no longer a prospect, they are now a new BA. Their position number in the holding tank is no longer relevant.'),
  bullet('If the prospect never enrolls, their holding tank record flushes when the 8-week consideration window expires.'),

  callout('On position monotonicity after flush.', 'Position numbers are timestamp-anchored. When a prospect\u2019s holding tank record flushes (enrollment or 8-week expiry), the numerical position is vacated, but the numbers of remaining prospects do not reshuffle. The team line is monotonic and stable. If position #347 flushes, position #348 is still position #348 \u2014 they do not become #347. The visible team line is honest \u2014 the absence of #347 is allowed. The alternative (renumbering) would violate the monotonic rule and create the impression that positions are negotiable.', GOLD),

  pageBreak(),

  // ===== SECTION E =====
  h1('E. Token lifecycle and return behavior'), rule(),

  h2('E.1  Token states'),
  bulletBold('minted ', '\u2014 BA generated the link from the invitation generator on .team but it hasn\u2019t been clicked yet.'),
  bulletBold('clicked ', '\u2014 prospect opened /p/{token}; presentation page loaded.'),
  bulletBold('video_started ', '\u2014 prospect started Dr. Dan\u2019s video.'),
  bulletBold('video_quarter / video_half / video_three_quarter ', '\u2014 progressive watch milestones.'),
  bulletBold('video_complete ', '\u2014 prospect watched to completion (or past 95%); placed in holding tank pool with a position number.'),
  bulletBold('callback_requested ', '\u2014 prospect submitted the callback CTA.'),
  bulletBold('webinar_reserved ', '\u2014 prospect reserved a webinar seat.'),
  bulletBold('enrolled ', '\u2014 BA marked the prospect as enrolled in THREE (off-app step).'),
  bulletBold('expired ', '\u2014 8 weeks have passed since video_complete without enrollment; record flushes.'),

  h2('E.2  How return visits work'),
  p('A prospect can leave the page and come back to /p/{token} at any point. The server resolves the token to its current state and renders the appropriate view.'),
  bullet('If state is clicked or any video_* state, the presentation page loads. The YouTube iframe restores playback position if the prospect was mid-video.'),
  bullet('If state is video_complete or beyond, the dashboard loads. The position number is the one assigned at original video_complete \u2014 it does not change.'),
  bullet('If state is callback_requested or webinar_reserved, the dashboard loads with the confirmation state visible.'),
  bullet('If state is enrolled, the token redirects to a brief welcome page acknowledging the prospect is now part of Team Magnificent. Their access to .team will come through their separately-issued BA access code, not through this token.'),
  bullet('If state is expired, /p/{token} resolves to an expired state page prompting the prospect to ask their inviting BA to renew it.'),

  h2('E.3  Why tokens never become URLs with personal data'),
  bullet('The token is opaque (random string, e.g. 12-character base32 or similar).'),
  bullet('It is not a base64 of the prospect\u2019s email, not a hash of their phone, not a slug of their name.'),
  bullet('The mapping from token to prospect lives on the server. The URL carries nothing about who the prospect is.'),
  bullet('If a token leaks to a third party, the third party sees only the same page the prospect would see \u2014 not the prospect\u2019s personal data.'),

  pageBreak(),

  // ===== SECTION F =====
  h1('F. Error states'), rule(),

  h2('F.1  Invalid token'),
  p('Prospect arrives at /p/{token} with a token the server does not recognize. The page shows a minimal Team Magnificent branded message asking them to check the link or ask the person who invited them for a fresh one.'),

  h2('F.2  Expired token'),
  p('Token reached the 8-week window without enrollment. The server resolves the token but its state is expired. The page shows a message prompting the prospect to reach out to their inviting BA to renew.'),

  h2('F.3  Video fails to load'),
  p('YouTube iframe fails. The video container shows a placeholder with a retry button. After three failed retries, the page suggests reaching out to the inviter.'),

  h2('F.4  Server unreachable for live counters'),
  p('The behind-you counter and position stack rely on a live data stream. If the stream fails, the section gracefully degrades: counters show their last known values with a steady gold dot replacing the pulse, and a small mono note reads \u201Clive updates paused.\u201D The dashboard otherwise functions normally.'),

  h2('F.5  Callback or webinar submit fails'),
  p('Form submit returns an error from the server. The button shows \u201CSomething went wrong \u2014 try again.\u201D in orange. The form fields remain populated. After three consecutive failures, a fallback message prompts the prospect to reach out to their inviter directly.'),

  h2('F.6  Prospect on a slow connection'),
  p('Heavy assets (video iframe, animations, live counter stream) load after the initial paint. On slow connections, the prospect sees the hero, the eyebrow, the headline first. The video loads when scrolled into view. The animations defer. The page is usable from the first paint forward.'),

  pageBreak(),

  // ===== SECTION G =====
  h1('G. Brand, tone, and visual application'), rule(),

  h2('G.1  Color palette'),
  bulletBold('Ink ', '\u2014 #0A0A0A. Primary background of the dashboard. The deep, considered canvas.'),
  bulletBold('Gold ', '\u2014 #C9A84C. Brand primary accent. Headlines, position numbers, primary CTAs, the powerline visualization, the inviting-BA name on the dashboard.'),
  bulletBold('Gold bright ', '\u2014 #F5C030. Energetic gold for emphasis \u2014 highlighted words in headlines, the position number, the 100,000 mission number.'),
  bulletBold('Teal ', '\u2014 #2DD4BF. Live-data color. The live pulse dot, behind-you counter, the webinar countdown, the eyebrow labels.'),
  bulletBold('Cream ', '\u2014 #F5EFE6. Primary text color against ink backgrounds. Slightly warm white.'),
  bulletBold('Cream-mute ', '\u2014 secondary text. Lead paragraphs, supporting copy.'),
  bulletBold('Cream-faint ', '\u2014 tertiary text. Timestamps, sources, signatures.'),

  h2('G.2  Typography'),
  bulletBold('Bebas Neue ', '\u2014 the display family. All section headlines. The position number. The 100,000 mission number.'),
  bulletBold('DM Sans ', '\u2014 the body family. All paragraphs, labels, button text. Weights 400, 500, 700.'),
  bulletBold('DM Mono ', '\u2014 the operational family. Eyebrow labels, timestamps, source citations, the ticker on the presentation page.'),

  h2('G.3  Tone'),
  bullet('The .com voice is alive. Confident without being loud. Direct without being aggressive. The prospect is treated as a thoughtful adult being invited into something specific, not pitched at.'),
  bullet('No marketing fluff. No exclamation points piled on. No \u201Camazing\u201D or \u201Cincredible.\u201D The energy comes from the demonstration \u2014 the team is moving \u2014 not from adjectives.'),
  bullet('Where copy is direct, it\u2019s short. Where copy needs to be considered, it\u2019s spacious. The page never crowds.'),
  bullet('Compliance is enforced by what the page does not say. Disclaimers exist where required, but the absence of comp language, placement promises, and income figures is the actual mechanism.'),

  h2('G.4  Animation philosophy'),
  bullet('Animation is the demonstration, not decoration. The behind-you counter moves because the team is actually moving. The position stack updates because prospects elsewhere are actually completing their videos.'),
  bullet('Section reveals on scroll are subtle \u2014 fade in over 400ms, no parallax, no bouncing.'),
  bullet('Hover effects on buttons: 2px lift, soft shadow shift. Nothing else.'),
  bullet('The atmospheric background gradient on the dashboard (gold and teal radial gradients on ink) is fixed. It is the canvas, not a special effect.'),

  h2('G.5  Brand isolation from THREE International'),
  callout('Locked 2026-05-17.', 'The .com surface carries Team Magnificent branding only. No THREE International logo, no THREE International name in the navigation, no THREE International eyebrow on any section, no \u201Cindependent operational team inside THREE International\u201D disclaimer in the footer, no \u201Cindependent promoter tool\u201D language anywhere. The prospect sees one brand: Team Magnificent. THREE International is the regulated structure the BA walks the prospect into after the human conversation \u2014 it is operational, not marketed. THREE references stay inside .team (where the BA needs to know their THREE BA ID, log into THREE\u2019s back office, etc.) and inside /admin (for genealogy reconciliation). They do not appear on .com.', GOLD),
  p('Implications for every section above:'),
  bullet('Eyebrows on the presentation page never read \u201CTeam Magnificent \u00b7 THREE International.\u201D They read \u201CTeam Magnificent\u201D alone, or the section-specific eyebrow.'),
  bullet('The Dr. Dan credentials card names him as Chief Scientific Officer and Chief Formulator with his credentials (Caltech PhD, 16 patents, 70+ supplements, 1.3M followers, top-50 podcast). It does not name his employer. The credentials speak for the science.'),
  bullet('The footer is Team Magnificent only \u2014 wordmark, URL, compliance disclaimer in Team Magnificent\u2019s voice. No THREE branding.'),
  bullet('The dashboard compliance signature in Section 5 (\u201COperational architecture \u00b7 numbers of record \u00b7 no performance promise\u201D) and the Section 6 closing compliance frame both speak in Team Magnificent\u2019s voice. They do not name THREE.'),
  bullet('The Team Magnificent compliance disclaimer paragraph that appears at the bottom of the dashboard reads: \u201CQueue positions and momentum displays demonstrate team activity in real time and do not guarantee any final placement, compensation, or earnings outcome. Market figures cited from public sources are for context only. This page contains no income claims, placement promises, or guarantees of any kind.\u201D Period. No mention of THREE.'),
  p('What this does NOT change:'),
  bullet('The architectural fact that THREE International owns enrollment, compensation, and the binary stays true. The BA walks the prospect into THREE off-app after the human conversation. That step is not marketed on .com because it does not happen on .com.'),
  bullet('Inside .team, THREE references stay where they are operational \u2014 BA ID at signup, THREE username, BA training that mentions THREE\u2019s comp plan in a regulated context.'),
  bullet('Inside /admin, genealogy reconciliation against THREE\u2019s records stays as the Kevin-only operational tool it is.'),

  pageBreak(),

  // ===== SECTION H =====
  h1('H. Open questions for Kevin'), rule(),

  p('These are points where the design needs Kevin\u2019s decision before code is written. Listed in priority order \u2014 the answers shape downstream design and engineering choices.'),

  h2('H.1  Inviting BA naming on the presentation page \u2014 RESOLVED 2026-05-17'),
  callout('Locked.', 'The presentation page is never anonymous. It is always personalized to the prospect and always names the inviting BA. The hero names both. The body copy names the inviting BA. The Part 4 bridge-to-team section may name the inviting BA again as the human voice behind the invitation. The token resolves both the prospect record (for the prospect\u2019s first name) and the inviting BA record (for the BA\u2019s full name) server-side at page render. This rule applies to the entire .com surface. No section is anonymous.', GOLD),

  h2('H.2  Final copy for the presentation page'),
  p('The existing tm-prospect-glp3-v3-UPDATED.html contains copy that won\u2019t be in the final version (the binary tree weekly-income widget, the $21k/week language, the save-spot form). Kevin will write the final copy for each section. This document describes what each section does; the final copy is Kevin\u2019s.'),

  h2('H.3  Webinar timing and cadence'),
  p('The dashboard names Tuesday 7:00 PM Pacific as the webinar slot, and the countdown ticks to the next Tuesday occurrence. Is the every-week cadence the locked answer? The current prototype text says \u201CEvery 72 hours\u201D in the host copy, which conflicts with weekly Tuesday.'),

  h2('H.4  Email provider'),
  p('The webinar reservation flow sends an email with the Zoom link. Email provider not yet chosen \u2014 candidates are Resend, Postmark, SendGrid, or AWS SES. Kevin to decide before wiring.'),

  h2('H.5  Position stack \u2014 city/state granularity'),
  p('Each entry in the live position stack shows a city/state for human texture. How is it derived? Options: prospect IP geolocation, BA-supplied region at token mint, or the inviting BA\u2019s region as a stand-in.'),

  h2('H.6  Behind-you counter \u2014 update interval'),
  p('Server-sent events (real-time, more infrastructure) vs short-poll every 5 seconds (simpler, slightly delayed). Visual effect similar; engineering cost differs.'),

  h2('H.7  Expired token \u2014 should it auto-renew?'),
  p('When a prospect with an expired token returns, current design shows them an expiry message and prompts them to ask the BA for a new link. Alternative: auto-renew on click if the BA still has the prospect in their CRM as active. Auto-renew is more friction-free for the prospect but bypasses the BA\u2019s decision to extend.'),

  h2('H.8  Holding tank flush \u2014 8-week window'),
  p('The 8-week consideration window is the locked design. Is the window adaptive (different for different BAs, different prospect intent types) or fixed at exactly 8 weeks for everyone? The architecture document calls it adaptive; this design assumes fixed-at-8-weeks for now.'),

  h2('H.9  Position stack \u2014 max visible entries'),
  p('How many recent placements show in the position stack \u2014 5, 10, 20? Each new entry pushes older ones down. The number affects perceived activity density.'),

  pageBreak(),

  // ===== FOOTER =====
  h2('End of .com design document'),
  rule(),
  p('Next document in the series: Team-Magnificent-TEAM-Design.docx \u2014 the Brand Ambassador-facing surface. Login, signup, welcome, Michael interview, Fast Start Guide, orientation, invitation generator, BA cockpit (My Sponsor card, My Invites, CRM), replicated .com preview, profile.'),
  p('After .team: Team-Magnificent-ADMIN-Design.docx \u2014 the Kevin-only surface. Code generator, code management, full team genealogy mirror, discrepancy review against THREE, BA list, holding tank cross-team view, Michael transcripts, audit log.'),
  note('Read this document. Mark it up. Tell Claude what is wrong. Nothing about .com gets built until you say it is right.'),
];

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22 } },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1),
          right: convertInchesToTwip(1),
        },
      },
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const outPath = path.join(__dirname, 'Team-Magnificent-COM-Design.docx');
  fs.writeFileSync(outPath, buf);
  console.log('wrote', outPath, '(' + buf.length + ' bytes)');
});
