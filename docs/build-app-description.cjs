/**
 * Builds the Team Magnificent app description document for Kevin.
 *
 * No code. No build plan. A plain-language readback of what the app is,
 * the flow, what each page does, what gets removed, and the questions Claude
 * still has — written so Kevin can read it on paper, mark it up, and tell
 * Claude what's wrong before any code is written.
 *
 * Run from the repo root:
 *   node docs/build-app-description.cjs
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  LevelFormat, PageNumber, PageBreak, Footer, Header, BorderStyle,
  TabStopType, TabStopPosition,
} = require('docx');

const BLACK = '000000';
const GREY = '555555';
const RULE = '2E75B6';

const p = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 160, before: 0, line: 320 },
    ...opts,
    children: [new TextRun({ text, ...(opts.run || {}) })],
  });

const pMulti = (runs, opts = {}) =>
  new Paragraph({
    spacing: { after: 160, before: 0, line: 320 },
    ...opts,
    children: runs.map((r) => (typeof r === 'string' ? new TextRun({ text: r }) : new TextRun(r))),
  });

const bullet = (text) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80, line: 300 },
    children: [new TextRun({ text })],
  });

const bulletStrong = (label, text) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80, line: 300 },
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: ' \u2014 ' + text }),
    ],
  });

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 200 },
  children: [new TextRun({ text })],
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 140 },
  children: [new TextRun({ text })],
});
const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 220, after: 120 },
  children: [new TextRun({ text })],
});

const rule = () => new Paragraph({
  spacing: { before: 80, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 4 } },
  children: [new TextRun({ text: '' })],
});
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// All section content kept in one array for readability.
const children = [
  // Title page
  new Paragraph({
    spacing: { before: 2400, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'TEAM MAGNIFICENT', bold: true, size: 56, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'App Description Document', size: 36, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Readback of the flow and pages, in Kevin's words.", italics: true, color: GREY, size: 22 })],
  }),
  new Paragraph({
    spacing: { before: 2400, after: 80 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Prepared for: Kevin L. Gardner, Founder, Team Magnificent', size: 22, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 80 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Source files reviewed:', size: 22, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 80 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'tm-prospect-glp3-v3-UPDATED.html (presentation page)', size: 20, color: GREY, italics: true })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'dashboard-prototype.html (post-video dashboard)', size: 20, color: GREY, italics: true })],
  }),
  new Paragraph({
    spacing: { before: 1600 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'This document is a readback. It is not a build plan.', italics: true, color: GREY, size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Mark it up. Tell me what's wrong. Nothing gets built until you say it's right.", italics: true, color: GREY, size: 22 })],
  }),
  pageBreak(),

  // Section 1
  h1('1.  What the app is for'), rule(),
  p('The app is the operational backbone of Team Magnificent \u2014 used collectively by every Brand Ambassador on the team to share GLP-THREE with prospects, support new Brand Ambassadors from the moment they join, and create a structure for substantial growth and momentum.'),
  p('It exists for two distinct audiences. The order of priority is set by Kevin and noted below.'),
  h2('Two audiences, two surfaces'),
  h3('teammagnificent.com \u2014 the prospect-facing surface'),
  p('Where a prospect lands after a Brand Ambassador has personally spoken with them and sent them a personalized invitation link. The .com surface delivers the GLP-THREE story \u2014 product first, opportunity second \u2014 and after the video is viewed, places the prospect in a live demonstration of the team forming around them. The product leads because the product is what is compelling.'),
  h3('teammagnificent.team \u2014 the Brand Ambassador-facing surface'),
  p('Where a new BA goes after they have decided to join. The .team surface welcomes them, runs Michael (the voice agent interview), gives them the Fast Start Guide for their first 72 hours, delivers compensation plan and product training, and gives them the tool they use to send their first personalized invitations to their first prospects.'),
  h2('What this app is designed to create'),
  bullet('Fear of missing out \u2014 every prospect sees, in real time, the team forming around their position. Other prospects are being placed beneath them while they are still on the page deciding.'),
  bullet('The structure for substantial growth \u2014 every Brand Ambassador on the team feeds the same pool. The dashboard a prospect sees reflects the activity of the whole team, not just their sponsor.'),
  bullet('An easier way to share GLP-THREE \u2014 Brand Ambassadors are not asked to convince. They have a real conversation, send a link, and let Dr. Dan and the live demonstration do the work that historically required hotel meetings, PowerPoint, and three-way calls.'),
  h2("Kevin's adaptation of the powerline concept"),
  p('The dashboard is Kevin\u2019s adaptation of the powerline concept for this opportunity. As each Brand Ambassador on Team Magnificent shares with their personal prospects, those prospects are placed in a holding tank sequentially and given a spot in line. The purpose is to simulate placement in the actual binary leg, so the candidate can experience in real time the team-building efforts they will potentially benefit from \u2014 before they actually join.'),
  p('The dashboard is a live demonstration of how the team operates. It is not the binary itself, and it does not promise placement, compensation, or income. It shows the team in motion so the prospect can see what they would be joining.'),
  pageBreak(),

  // Section 2
  h1('2.  The process the app supports'), rule(),
  p('This is the actual recruitment process Kevin described \u2014 the same process every current member of Team Magnificent went through to decide to join the business.'),
  h2('Step 1.  The Brand Ambassador speaks to the candidate first'),
  p('Real human contact happens before any link is sent. This is by SMS text or a scripted phone call. The BA has a conversation with the candidate about GLP-THREE and the opportunity, in a personal voice.'),
  h2('Step 2.  The BA sends a personalized invitation link'),
  p('After the conversation, the BA uses the invitation tool inside the .team site to generate a personalized link. The link carries the BA\u2019s name into the prospect\u2019s experience \u2014 so the prospect sees \u201CKevin personally invited you\u201D (or Paul, or whichever BA invited them), not a generic page.'),
  h2('Step 3.  The prospect lands on the presentation page'),
  p('The link opens the presentation page (tm-prospect-glp3-v3-UPDATED.html with minor tweaks). The prospect sees the hero with the BA\u2019s name, reads the lead-in, and then watches Dr. Dan\u2019s full 17-minute video. After the video, the prospect reads through the market opportunity, the product details, the system explainer, the binary 2-in-72 visualization, and the testimonials.'),
  p('Order on the page is deliberate: product first (Dr. Dan, market, product), opportunity second (system, comp, save). The product is what is compelling. The opportunity follows once the product is understood.'),
  h2('Step 4.  Video completion triggers an event'),
  p('When the prospect has viewed Dr. Dan\u2019s video, an event fires. This is the gate. Until the video has been viewed, no placement occurs. (Note: Claude will need to clarify with Kevin how strictly this gate is enforced \u2014 see Open Questions, section 7.)'),
  h2('Step 5.  The prospect is placed in the holding tank'),
  p('On video completion, the prospect is placed sequentially into the team-wide holding tank and given the next position number in line. The holding tank is one shared pool \u2014 every BA\u2019s prospects flow into the same pool. Positions are assigned strictly in arrival order. Once assigned, a position number does not move.'),
  h2('Step 6.  The prospect sees the dashboard'),
  p('Immediately after placement, the prospect sees the dashboard (dashboard-prototype.html). The dashboard shows them their position, the live team forming around them, and the live demonstration of the powerline mechanic. The prospect can watch other prospects being placed behind them in real time.'),
  h2('Step 7.  The prospect takes the next step'),
  p('On the dashboard\u2019s final section, the prospect chooses one of two paths: request a personal call back from their inviting Brand Ambassador, or reserve a seat at the next Team Magnificent live webinar (Tuesday 7pm Pacific, hosted by Kevin and Paul, every 72 hours). Both paths lead to a real human conversation.'),
  h2('Step 8.  The Brand Ambassador walks the prospect into THREE'),
  p('If the prospect decides to enroll, the BA walks them into THREE International through THREE\u2019s own tools, off-app, BA-to-BA. The app does not handle the actual enrollment in THREE. Once enrolled, the new BA is now using the .team site for their own onboarding (returning the cycle to Step 1 from the new BA\u2019s side).'),
  pageBreak(),

  // Section 3 — presentation page
  h1('3.  The presentation page \u2014 section by section'), rule(),
  p('Source file: tm-prospect-glp3-v3-UPDATED.html. This is what the prospect sees when the BA\u2019s invitation link opens. The page already exists; minor changes are required (see end of this section).'),
  h2('Ticker bar (top)'),
  p('A horizontal scrolling ticker across the very top of the page in teal. It carries six rotating messages \u2014 including a personalized line that swaps in the BA\u2019s name (\u201CKevin personally invited you to see this opportunity\u201D). The other messages cycle activity proof points: \u201CDavid H. in Massachusetts \u2014 3 prospects invited this week,\u201D \u201CDr. Roni S. in New York \u2014 Week 1 momentum activated,\u201D \u201C72% of Americans overweight or obese \u2014 the market is wide open,\u201D etc.'),
  h2('Hero \u2014 \u201CYou Were Personally Invited\u201D'),
  bullet('Eyebrow: \u201CTeam Magnificent\u201D \u2014 Team Magnificent alone, per brand-isolation lock (2026-05-17); no THREE naming on .com eyebrows.'),
  bullet('Headline: \u201CYou Were Personally Invited.\u201D \u2014 the word \u201CPersonally\u201D in gold.'),
  bullet('Lead paragraph: \u201C[BA name] looked at you and saw something \u2014 the drive, the character, the potential of a person who could build something extraordinary. They put your name on this invitation because of that. Not everyone gets this. You did.\u201D'),
  bullet('Live badge: a pulsing teal dot next to \u201C[BA name] personally invited you.\u201D'),
  bullet('Two CTAs: a gold \u201CWatch The Product Video\u201D (jumps to the video section) and a ghost \u201CSave My Spot\u201D (jumps to the form). NOTE: the \u201CSave My Spot\u201D form is being removed \u2014 see end of section.'),
  h2('Part 1 \u2014 The Product (Dr. Dan video)'),
  bullet('Section label: \u201CPart 1 \u2014 The Product.\u201D Headline: \u201CWatch Dr. Dan. Then Everything Makes Sense.\u201D'),
  bullet('Lead copy: \u201CDr. Dan Gubler is Chief Scientific Officer and Chief Formulator \u2014 Caltech-trained PhD in Organic Chemistry, 16 patents, 1.3 million followers, top-50 podcast. This is not marketing. This is peer-reviewed science delivered by the man who formulated GLP-THREE. Watch the full video before anything else on this page.\u201D'),
  bullet('Embedded YouTube video: 17 minutes, Dr. Dan Gubler explaining GLP-THREE. Current embedded video ID: 1IZiV7RXdCY.'),
  h2('Part 2 \u2014 The Market Opportunity'),
  bullet('Label: \u201CPart 2 \u2014 The Market Opportunity.\u201D Headline: \u201CA $6.8 Trillion Market. And A Problem Nobody Has Solved.\u201D'),
  bullet('Six market stat cards, each with a cited source:'),
  bullet('$6.8T \u2014 Global wellness economy in 2024, projected to reach $9.8T by 2029 (Global Wellness Institute, 2025)'),
  bullet('72% \u2014 Of American adults overweight or obese (CDC National Health Statistics, 2024)'),
  bullet('$1,200 \u2014 Monthly out-of-pocket cost for Ozempic, Wegovy, or Mounjaro without insurance (WebMD / AMA Research, 2025)'),
  bullet('10M+ \u2014 Americans currently on GLP-1 treatment, projected to reach 25M by 2030 (J.P. Morgan Research, 2026)'),
  bullet('70% \u2014 Of Americans believe GLP-1 drugs are only accessible to the wealthy. They are right. (Health Management Academy, 2026)'),
  bullet('$200B \u2014 Projected GLP-1 receptor agonist market by 2033 (Grand View Research, 2025)'),
  bullet('Problem card: explains Ozempic / Wegovy / Mounjaro side effects, the $1,200/month price, and that more than 80% of overweight Americans received no GLP-1 treatment in 2024 because the drugs are priced out of reach. \u201CThat gap is exactly where GLP-THREE lives.\u201D'),
  h2('Product detail \u2014 \u201CNatural. Patented. No Needle. No Prescription.\u201D'),
  bullet('Section label: \u201CThe Science \u2014 The Product.\u201D'),
  bullet('Lead: GLP-THREE is powered by MBC-267, a proprietary peptide complex discovered in Norwegian salmon and mushrooms. Binds to the same GLP-1 receptors as the injectable drugs \u2014 naturally, without pharmaceutical side effects. 100% natural, non-GMO, a dropper 30 minutes before meals.'),
  bullet('Dr. Dan card: names him as Chief Scientific Officer and Chief Formulator (employer not named, per brand-isolation lock) with full credentials \u2014 Caltech PhD, 15+ years cellular absorption formulation experience, 70+ supplements formulated, 16 patents, peer-reviewed publications, 1.3M followers, top-50 podcast.'),
  bullet('Two product cards: \u201CHow It Works\u201D (MBC-267 binds GLP-1 receptors through a natural pathway via cellular absorption technology) and \u201CWhat It Does\u201D (feel fuller longer, curb cravings, support healthy weight management, decrease body fat while supporting muscle tone, all natural, ages 12 and up).'),
  h2('Part 3 \u2014 The System'),
  bullet('Label: \u201CPart 3 \u2014 Our System Technology.\u201D Headline: \u201CYou\u2019re Not Just Learning. You\u2019re Inside The System Right Now.\u201D'),
  bullet('Frames the live demonstration: \u201CMost people learning about network marketing get TOLD how it works. PowerPoint slides. Hotel meetings. Three-way calls. Abstract concepts. You\u2019re doing something different. Right now \u2014 while you\u2019re reading this page \u2014 you\u2019re being placed inside this organization. [BA name] invited you. When you save your spot below, you\u2019ll see YOUR NAME in the binary tree. You will see people being placed underneath you. You\u2019re not watching a presentation. You\u2019re experiencing what it is to build a team in real time.\u201D'),
  bullet('\u201CHere\u2019s What\u2019s Happening Right Now\u201D card: explains that the BA is placing others below the prospect while the prospect reads, and that everybody on the team is placing right now because everybody is using the system together.'),
  bullet('\u201CWe\u2019re Not Offering You a Free Ride\u201D story card: the benefit is the power of team-building plus the system \u2014 not passive income, not spillover, not \u201Csit back and watch money roll in.\u201D Everyone pulls their own weight, and everyone benefits when the whole team does.'),
  bullet('\u201CLocation, location, location\u201D framing: first person in gets the best benefits, last person in gets the least. \u201CWould you rather be first in line with 100 people behind you, or last in line with 100 people ahead of you \u2014 knowing thousands more are coming in?\u201D'),
  bullet('\u201CReal Story. Real Money. Real Difference.\u201D Paul Barrios / Jim Bell story \u2014 Paul took the spot, made tens of millions; Jim Bell came in months later, missed out on millions. Same company, same product, same sponsor, same opportunity. The only difference was timing and position.'),
  bullet('\u201C$110,000 AI-Powered Infrastructure\u201D card: explains the system is what the prospect is currently experiencing \u2014 personalized invitations, live team momentum, instant placement, automated follow-up. \u201CFor the next 2 weeks: FREE enrollment when you come in with the 3-pack.\u201D $200 for 3 bottles, 100 CV, $0 enrollment fee (normally $30, waived). Total ~$220 to plug into a $110,000 system. KFC franchise analogy: KFC costs $1.5M for the franchise; Team Magnificent costs $220 to plug into the infrastructure. THREE International pays up to $21,000 per week in binary commissions.'),
  h2('Part 4 \u2014 Power of 2 / 2-in-72'),
  bullet('Label: \u201CPart 4 \u2014 Power of 2 Demonstration.\u201D Headline: \u201C2 In 72. Simple. Duplicatable. It Compounds.\u201D'),
  bullet('Lead: THREE International runs a binary compensation system \u2014 every BA builds two legs. When volume cycles on both sides, income is generated. The 2-in-72 challenge is how Team Magnificent activates fast momentum \u2014 every new BA introduces two people in their first 72 hours.'),
  bullet('Three-step explainer cards: (1) You Enroll, (2) Invite Two People, (3) They Do The Same.'),
  bullet('Interactive binary tree visualization with Week 1 / Week 2 / Week 3 / Week 4 selector buttons. Shows the tree growing each week with metrics: Total BAs, Cycles per Week, Weekly Estimate. Week 1 starts at 1 BA / 1 cycle / $35/week. Week 4 reaches 15 BAs / 56 cycles / $1,960/week.'),
  bullet('Note printed under the tree: \u201CIllustration only. Income not guaranteed. Results vary based on individual effort, team activity, and compliance with THREE International Policies and Procedures.\u201D'),
  bullet('Closer copy: \u201CThe earlier you get in, the more people end up below you as the team grows. Everyone below you contributes to volume flowing through your legs. That\u2019s your powerline.\u201D'),
  h2('Save Your Spot form  \u2014  TO BE REMOVED'),
  pMulti([
    { text: 'REMOVE: ', bold: true, color: 'B00020' },
    'This entire section will be removed in the new version. Currently it captures name, email, phone, with a button labeled \u201CSAVE MY SPOT IN THE TREE\u201D and writes to a MongoDB endpoint before redirecting to tm-binary-live.html. ',
  ]),
  p('In the new flow, the form is not on the presentation page. The conversion moment moves to the dashboard\u2019s Section 6 (\u201CYour Next Move\u201D) after the prospect has watched the video and been placed in the holding tank.'),
  h2('Testimonials'),
  bullet('Label: \u201CProof \u2014 Real Results.\u201D Headline: \u201CThe Product Works. Real People. Real Results.\u201D'),
  bullet('Currently shows Kevin Gardner\u2019s testimonial (14 pounds in 6 weeks at 60+ years old) plus two \u201Ccoming soon\u201D placeholder cards. Will fill as the team grows.'),
  h2('Final strip + footer'),
  bullet('Final strip repeats the Jim Bell / Paul story headline and a final \u201CSAVE MY SPOT IN THE TREE\u201D CTA. (CTA copy will need to change once the form is removed.)'),
  bullet('Footer: \u201CTeam Magnificent \u00b7 Built by Kevin Gardner \u00b7 teammagnificent.com\u201D \u2014 Team Magnificent only, per brand-isolation lock (2026-05-17): no THREE branding, no promoter-tool disclaimer.'),
  h2('Confirmed changes for the new version'),
  bulletStrong('REMOVE', 'the Save Your Spot form section entirely.'),
  bulletStrong('REMOVE / RELABEL', 'the secondary \u201CSAVE MY SPOT\u201D button in the hero (currently jumps to the form) and the duplicate at the end of the final strip.'),
  bulletStrong('KEEP', 'the Dr. Dan video, market section, product detail, system section, Power of 2 visualization, testimonials.'),
  bulletStrong('ADD', '(implied by the flow Kevin described): an event that fires on video completion, triggering the prospect\u2019s placement into the holding tank and navigating them to the dashboard.'),
  bulletStrong('MINOR INFORMATION CHANGES', 'Kevin has mentioned minor changes are coming to the page content. The current text reflects what is in the HTML file as of this readback; specific tweaks have not been listed yet.'),
  pageBreak(),

  // Section 4 — dashboard
  h1('4.  The dashboard \u2014 section by section'), rule(),
  p('Source file: dashboard-prototype.html. This is what the prospect sees after the Dr. Dan video has been viewed and they have been placed in the holding tank. It is the live demonstration of the team forming around them \u2014 Kevin\u2019s adaptation of the powerline concept.'),
  h2('Ribbon (sticky top bar)'),
  p('A thin bar at the top, sticky as the prospect scrolls. Left side: the Team Magnificent brand mark (a small circle with a cross and teal dot) and the words \u201CTeam Magnificent\u201D in gold. Right side: a pulsing teal dot and the words \u201CLive \u00b7 holding tank.\u201D The bar uses a 70% black tint with backdrop blur \u2014 present but not loud.'),
  h2('Section 1 \u2014 Arrival'),
  bullet('Eyebrow line: \u201CInvited by [BA full name]\u201D \u2014 the BA name highlighted in gold.'),
  bullet('Massive headline: \u201CYou saw it. You\u2019re in.\u201D \u2014 the word \u201Cin\u201D in bright gold.'),
  bullet('Sub-headline: \u201CThe video did its work. You\u2019re now part of the team that\u2019s building the fastest-moving wellness movement in network marketing. Welcome.\u201D'),
  bullet('Position card \u2014 three columns inside a gold-bordered card with a subtle gold/teal gradient:'),
  bullet('Left: \u201CYour position\u201D label, then a very large gold number \u2014 the prospect\u2019s assigned position number (example in prototype: #347).'),
  bullet('Middle: \u201CHeld in [BA first name]\u2019s leg\u201D as a heading, with copy: \u201CYou\u2019ve been placed in the Team Magnificent holding tank \u2014 the live demonstration of how the team is forming around you, in real time.\u201D'),
  bullet('Right: \u201CPlacement\u201D stamp showing the exact local time the prospect was placed (example: \u201C02:47 PT \u00b7 today\u201D).'),
  h2('Section 2 \u2014 Opportunity'),
  bullet('Eyebrow: \u201CThe market you just stepped into.\u201D'),
  bullet('Headline: \u201CThis isn\u2019t a small room.\u201D'),
  bullet('Lead copy: \u201CGLP-THREE is a natural alternative in one of the fastest-expanding wellness categories on the planet. The numbers aren\u2019t ours \u2014 they\u2019re public. We\u2019re just standing where they point.\u201D'),
  bullet('Four market stat cells in a horizontal grid:'),
  bullet('$6.8T \u2014 Global wellness market (GWI \u00b7 2025)'),
  bullet('$200B \u2014 GLP-1 alternatives by 2033 (industry projection)'),
  bullet('72% \u2014 Americans overweight (CDC \u00b7 2024)'),
  bullet('$1,200/mo \u2014 Cost of synthetic alternatives (average retail \u00b7 2025)'),
  h2('Section 3 \u2014 The Mechanic'),
  bullet('Eyebrow: \u201CHow teams build in this market.\u201D'),
  bullet('Headline: \u201CTwo people. Then they find two.\u201D'),
  bullet('Lead: \u201CThe math is simple and the rhythm is fast. Each person finds two. Those two each find two. The team doubles. We move on a 72-hour rhythm \u2014 speed is the multiplier, not the exception.\u201D'),
  bullet('DOM cascade visualization: seven horizontal rows (1, 2, 4, 8, 16, 32, 64 squares) that light up in sequence as the section enters view. A vertical gold gradient line runs through the center of the cascade. Each row has a label to its right \u2014 \u201C1 leader,\u201D \u201C2 builders,\u201D \u201C4 builders,\u201D etc.'),
  bullet('Cascade destination: a downward arrow, the label \u201CThe math points here,\u201D then a very large \u201C100,000\u201D in bright gold with the subtitle \u201CQualified Brand Ambassadors. That\u2019s the team we\u2019re building.\u201D'),
  bullet('Three named principles below in a row:'),
  bullet('Power of 2 \u2014 \u201CThe team doubles when each person finds two. One becomes two, two becomes four, four becomes eight \u2014 that\u2019s how speed compounds.\u201D'),
  bullet('2 in 72 \u2014 \u201CFind your first two people in 72 hours. It\u2019s not a deadline \u2014 it\u2019s a rhythm. The team moves at the speed of its leaders.\u201D'),
  bullet('One bite at a time \u2014 \u201CBig movements get built one daily action at a time. The system handles the scale. You handle the relationships.\u201D'),
  h2('Section 4 \u2014 Live Place (this is the powerline demonstration)'),
  bullet('Eyebrow: \u201CYour place in the live team.\u201D'),
  bullet('Headline: \u201CThe team is forming around you. Right now.\u201D'),
  bullet('Lead: \u201CYou\u2019re position #[number]. The numbers below update live. Watch what happens when you stay on this page.\u201D'),
  bullet('Two-column board:'),
  bullet('Left column \u2014 two counter cards. \u201CAhead of you\u201D shows builders placed before this prospect\u2019s position (static, since position doesn\u2019t move). \u201CBehind you \u00b7 live\u201D has a pulsing teal dot and a live-counting number of new prospects placed since this prospect arrived. Below each, a short sub-line of context.'),
  bullet('Right column \u2014 a live placement stack. A short feed of recent placements: position number, prospect first name and last initial, time-ago label (\u201Cjust now,\u201D \u201C8s ago,\u201D \u201C22s ago\u201D). The stack ages \u2014 older entries push down, time labels increment. Each new placement appears at the top with a fresh-tinted treatment. The list trims to about 9 visible at any time.'),
  p('This is the section that creates the FOMO Kevin described. While the prospect reads, they see other prospects landing in real time, with names and timestamps. The team is visibly forming around their position.'),
  h2('Section 5 \u2014 Team Magnificent Advantage'),
  bullet('Eyebrow: \u201CWhy Team Magnificent moves faster.\u201D'),
  bullet('Headline: \u201CWe work together. With the same goal.\u201D'),
  bullet('Lead: \u201CMost teams in network marketing recruit alone \u2014 every Brand Ambassador running their own scattered tools, their own scattered process. Team Magnificent built the technology that changes that.\u201D'),
  bullet('Kevin\u2019s quote card: \u201CWe\u2019ve harnessed the power of our team using technology so we\u2019re working together with the same goal \u2014 to win.\u201D \u2014 attributed: Kevin L. Gardner, founding co-leader.'),
  bullet('Mission board: large \u201C100,000\u201D figure with the label \u201CQualified Brand Ambassadors on Team Magnificent\u201D and the mission philosophy: \u201COur mission is simple \u2014 empower every Brand Ambassador to build their business, and help each one find at minimum two qualified recruits who do the same. Until we reach one hundred thousand, together.\u201D'),
  bullet('Pool grid \u2014 four activity stats showing the team in motion:'),
  bullet('47 \u2014 Brand Ambassadors active in the last 24 hours (tagged Live)'),
  bullet('213 \u2014 Invitations sent across the team today (tagged Pooled)'),
  bullet('89 \u2014 New placements added to the team in 24h (tagged Compounding)'),
  bullet('+38% \u2014 Recruitment velocity through shared OS (tagged Operational)'),
  bullet('Compounding closer: \u201COne team. One pool. One system.\u201D + a longer paragraph explaining that when the BA invited this prospect, the invitation moved alongside every other BA\u2019s invitation, feeding the same dashboard. \u201CThe momentum compounds. Your placement at #[N] is the result of every Brand Ambassador who came before you. The team at #500, #1,000, #5,000 will exist because of every Brand Ambassador who joins after.\u201D'),
  bullet('Final line: \u201CBuilt to win. Built to win together.\u201D'),
  bullet('Compliance signature underneath: \u201COperational architecture \u00b7 numbers of record \u00b7 no performance promise.\u201D'),
  h2('Section 6 \u2014 Your Next Move'),
  bullet('Eyebrow: \u201CYour next move.\u201D'),
  bullet('Headline (locked from Chat #82): \u201CLet\u2019s have a real conversation about this unfolding new opportunity.\u201D'),
  bullet('Lead: \u201CTwo ways to take the next step \u2014 a personal call with [BA first name], or the live team event Tuesday night. Both lead to the same place: two humans, an honest conversation, real context for your decision.\u201D'),
  bullet('Two CTAs side by side:'),
  bullet('Left (gold) \u2014 \u201CA real conversation with [BA].\u201D Headline: \u201CI\u2019m ready to talk with [BA full name].\u201D Three radio buttons: \u201CI\u2019m interested \u2014 I want to understand more,\u201D \u201CI\u2019m ready to join Team Magnificent,\u201D \u201CI have specific questions to work through.\u201D Two fields: Phone, Best time to call. Submit button (gold): \u201CYes \u2014 let\u2019s talk.\u201D'),
  bullet('Right (teal) \u2014 \u201CJoin us live.\u201D Headline: \u201CThe next Team Magnificent live, in [N] hours.\u201D Event line: Tuesday \u00b7 7:00 PM Pacific \u00b7 Zoom. Hosts: Kevin L. Gardner and Paul Barrios. Every 72 hours. Live countdown timer (Days / Hours / Min / Sec). Two fields: Name, Email. Submit button (teal): \u201CReserve my seat.\u201D'),
  h2('Footer'),
  bullet('Brand mark: \u201CTeam Magnificent\u201D in gold.'),
  bullet('Two brand lines: \u201CAn operational team inside THREE International.\u201D + \u201CWe build people before we build volume.\u201D'),
  bullet('Compliance disclaimer paragraph: \u201CQueue positions and momentum displays demonstrate team activity in real time and do not guarantee any final placement, compensation, or earnings outcome. Market figures cited from public sources are for context only. This page contains no income claims, placement promises, or guarantees of any kind. Team Magnificent is an independent operational team. Official Brand Ambassador enrollment occurs through THREE International.\u201D'),
  pageBreak(),

  // Section 5 — .team
  h1('5.  The .team site (for new and active Brand Ambassadors)'), rule(),
  p('This is the BA-facing site \u2014 what a new BA uses after they have decided to join Team Magnificent. Kevin described five areas of functionality. The order below reflects what a new BA encounters in their first hours.'),
  h2('5.1  Welcome to the team'),
  p('The first surface a new BA sees after enrollment. Welcomes them onto the team and into the system. Sets the tone for what comes next.'),
  h2('5.2  Michael \u2014 the voice agent interview'),
  p('Michael is an outbound voice agent (Telnyx-based). When a new BA arrives, Michael calls them and conducts an interview to capture:'),
  bullet('Why they are doing the business.'),
  bullet('What financial goals they hope to attain.'),
  bullet('Their time commitment.'),
  bullet('General things that are useful for the sponsor to know in order to help the BA grow their business.'),
  p('The transcript and scoring of the interview is captured and fed back to the BA\u2019s own record and to the sponsor BA (their upline). Michael is BA-facing only \u2014 never prospect-facing, never anywhere on .com.'),
  h2('5.3  Fast Start Guide \u2014 first 72 hours'),
  p('Structured guidance for the new BA\u2019s first 72 hours. The goal is for the new BA to get qualified and paid in their first week, starting out with success and in a position to build a team and grow. The Fast Start Guide includes:'),
  bullet('Compensation plan training (written material, walked through).'),
  bullet('Understanding placement in the binary.'),
  bullet('Learning more about GLP-THREE and THREE International\u2019s other products.'),
  bullet('Creating an initial list of people to share the product with \u2014 the new BA\u2019s first prospects.'),
  bullet('Identifying the new BA\u2019s two initial candidates who will join with them to build a THREE International business.'),
  p('The Fast Start Guide drives toward a single milestone: the new BA gets their first two team members in the 72 hours after completing the first 72 hours of training. That earns qualification and a first paycheck in week one.'),
  h2('5.4  10-step new member orientation (live with Kevin or Paul)'),
  p('Hosted live by Kevin or Paul. Ten steps walked through with the new BA in real time. (The .team site presents the schedule, materials, and the join link for the live session. The session itself happens off-site on Zoom or equivalent.)'),
  h2('5.5  Invitation generator'),
  p('The tool the BA uses to send a personalized invitation link to a prospect \u2014 only after the BA has personally spoken with the candidate by SMS text or scripted phone call. The generator produces the personalized link that opens the presentation page with the BA\u2019s name swapped in for the data-ba-name placeholders.'),
  p('Kevin explicitly noted: the BA speaks to the candidate first, then sends the link. The generator is not a cold-outreach tool. It serves the warm conversation.'),
  pageBreak(),

  // Section 6 — data
  h1('6.  Data exchange \u2014 what travels between the pieces'), rule(),
  p('This section captures what the system needs to know and pass between surfaces. It is not a database schema. It is the information that has to flow for the experience Kevin described to work.'),
  h2('Per invitation'),
  bullet('Which BA generated it.'),
  bullet('The BA\u2019s full display name and first name (for the page personalization).'),
  bullet('A unique link/token that identifies this specific invitation.'),
  bullet('When the invitation was generated.'),
  bullet('Optionally: the prospect\u2019s name and phone (captured by the BA when generating, since they have already spoken).'),
  h2('Per prospect arrival on the presentation page'),
  bullet('Which invitation link they clicked.'),
  bullet('When they landed on the page.'),
  bullet('Whether they started the video. (Likely. To confirm with Kevin.)'),
  bullet('Whether they completed the video \u2014 the event that triggers placement.'),
  h2('Per placement in the holding tank'),
  bullet('Which prospect was placed.'),
  bullet('Which BA sponsored them (locked at this moment, never changes).'),
  bullet('Their assigned position number (sequentially assigned across the entire team).'),
  bullet('The exact placement timestamp.'),
  h2('Per next-move action on the dashboard'),
  bullet('If the prospect chose \u201Creal conversation\u201D: their phone, their best time, which radio option they picked, which BA gets notified.'),
  bullet('If the prospect chose \u201Creserve my seat\u201D: their name, email, which upcoming webinar.'),
  h2('What the BA sees on their side'),
  bullet('Every invitation they have sent, and what happened to each one.'),
  bullet('Who watched the video, who got placed, who requested a callback, who reserved a webinar seat.'),
  bullet('A callback alert (SMS text) when a prospect asks for a call.'),
  pageBreak(),

  // Section 7 — open questions
  h1('7.  Open questions for Kevin'), rule(),
  p('These are things Claude needs to confirm before writing any code. They are not assumptions to be made. They are decisions to be made by Kevin.'),
  h2('On the presentation page'),
  bullet('Confirm: the Save Your Spot form is removed entirely. The page is information-only after the changes.'),
  bullet('Confirm: the two CTAs in the hero (\u201CWatch The Product Video\u201D and \u201CSave My Spot\u201D) \u2014 does the second one get removed, replaced, or repurposed?'),
  bullet('The final strip\u2019s \u201CSAVE MY SPOT IN THE TREE\u201D button \u2014 remove, replace, or repurpose?'),
  bullet('What minor information changes are coming to the page content? (Stats updates, copy tweaks, new testimonials?)'),
  bullet('Should the page still show the Jim Bell / Paul story and the $110,000 system story \u2014 or are those moving / changing?'),
  h2('On the video-completion event'),
  bullet('How strict is the gate? Three options: (a) anyone can advance to placement at any time, (b) the prospect must visibly play the video to the end before placement happens, (c) somewhere in between \u2014 for example, an \u201CI\u2019ve watched it\u201D button after the video has been on screen for at least N minutes.'),
  bullet('What happens if the prospect tries to navigate to the dashboard URL directly without watching? Hard block? Redirect back to the video?'),
  bullet('Should the prospect be able to come back to the dashboard later (after closing the tab), or is the dashboard a one-time experience tied to that session?'),
  h2('On the holding tank and position numbers'),
  bullet('Are position numbers across the entire team a single sequence (#1, #2, #3 \u2026 #347), or per-BA (each BA\u2019s prospects numbered #1, #2, #3)?'),
  bullet('The prototype shows #347 as an example. Where does the count actually start? At #1 for the first prospect placed? Or is there a starting offset (representing existing team members)?'),
  bullet('Does the \u201CAhead of you\u201D number include current Brand Ambassadors who have already enrolled, or only other prospects in the holding tank?'),
  bullet('Are the names shown in the \u201CLive placements\u201D stack on Section 4 real other prospects who arrived, or simulated/decorative? (This matters for compliance \u2014 \u201Cnumbers of record\u201D in the disclaimer needs to be accurate.)'),
  bullet('How long does a prospect stay in the holding tank if they don\u2019t enroll? The system prompt mentioned an 8-week consideration window \u2014 is that still right?'),
  h2('On the .team site'),
  bullet('What\u2019s the priority order for the .team surfaces \u2014 welcome, Michael, Fast Start Guide, comp training, 10-step orientation, invitation generator? Which one ships first?'),
  bullet('Who actually writes the welcome content, the Fast Start Guide modules, the comp plan training material, and the product training? Does it already exist somewhere?'),
  bullet('What does Michael\u2019s interview script say? Does the script exist? Who maintains it?'),
  bullet('How does a new BA get into the .team site in the first place? They have just enrolled in THREE \u2014 what is the handoff that gives them access here?'),
  bullet('Authentication: how does a BA prove who they are when they log in? Real password? Magic link? Single sign-on with something else?'),
  h2('On the activity stats in Section 5'),
  bullet('The pool grid shows 47 / 213 / 89 / +38%. Are these computed from real activity? Or hand-curated weekly?'),
  bullet('Are these numbers visible to every prospect? If so, what happens on a slow day when the numbers would look small?'),
  h2('On the webinar'),
  bullet('Is the webinar always Tuesday 7pm Pacific? Always hosted by Kevin and Paul? What happens to the countdown after the webinar starts \u2014 does it reset to the next one?'),
  bullet('Does \u201CReserve my seat\u201D send a Zoom link to the email, write to a CRM, or both?'),
  h2('On Telnyx / SMS'),
  bullet('Does the callback alert text actually get sent to the BA\u2019s phone when a prospect submits the dashboard\u2019s Section 6 form?'),
  bullet('Is Telnyx the chosen SMS provider, or is that still open?'),
  h2('On compliance'),
  bullet('The disclaimer states: \u201Cno income claims, placement promises, or guarantees of any kind.\u201D Does any current copy on either page need to be tightened to match? (Particularly the $1,960/week Week-4 estimate, the \u201Cup to $21,000 per week in binary commissions\u201D line, and the Paul / Jim Bell millions framing.)'),
  bullet('RESOLVED by brand-isolation lock (2026-05-17): the .com footer is Team Magnificent branding only \u2014 no promoter-tool disclaimer, no THREE naming \u2014 on both the presentation page and the dashboard. The earlier footer-wording question is closed.'),
  pageBreak(),

  // Section 8 — what claude built earlier
  h1('8.  What Claude built earlier in this conversation (for reference)'), rule(),
  p('Claude already built a partial version of this app earlier in this conversation, before fully understanding the design. That code is sitting on Kevin\u2019s machine and GitHub right now. This section exists so Kevin knows what is already there before any new work is done.'),
  h2('On Kevin\u2019s machine'),
  bullet('D:/momentum-creation-system/ \u2014 a Node + TypeScript monorepo with three workspaces.'),
  bullet('server/ \u2014 Express API server on port 4001.'),
  bullet('apps/com/ \u2014 a Vite + React prospect-facing site on port 5173. Does NOT match the presentation page or the dashboard documented in this readback. Built from a system-prompt summary, not from the actual files Kevin uploaded.'),
  bullet('apps/team/ \u2014 a Vite + React BA-facing site on port 5174. Five screens: a stub login, an empty cockpit, a mint-token form, a token list. Does NOT include welcome, Michael, Fast Start, training, or 10-step orientation.'),
  bullet('packages/shared/ \u2014 brand tokens and shared constants.'),
  h2('On Kevin\u2019s GitHub'),
  bullet('Public repo: devklg/momentum-creation-system, 10 commits on main.'),
  h2('In Kevin\u2019s databases (Universal Gateway, MongoDB / Neo4j / ChromaDB)'),
  bullet('MongoDB database \u201Cmomentum_creation_system\u201D with collections: bas, invite_tokens, prospects, callback_requests, ba_alerts, system. Most empty. The bas collection contains ba_kevin (Kevin L. Gardner) and ba_paul (Paul Barrios) records.'),
  bullet('Neo4j: (:BA) nodes for ba_kevin and ba_paul.'),
  bullet('ChromaDB: six new collections (mcs_invite_tokens, mcs_prospect_activity, mcs_callback_requests, mcs_system, mcs_bas, mcs_ba_alerts).'),
  bullet('Roughly 15 records were added to Kevin\u2019s existing kevin_decisions and kevin_library collections, tagged with project momentum_creation_system.'),
  h2('What Claude recommends'),
  p('Once this readback is corrected and signed off, the right move is most likely to delete the existing momentum-creation-system code and database artifacts, and start from a foundation that fits the design Kevin actually has in mind. Some pieces (sponsor immutability in the data layer, the triple-stack write pattern, the brand tokens) may be salvageable; most of the front-end will not be.'),
  p('But this is Kevin\u2019s call, not Claude\u2019s. Nothing gets deleted, kept, or rewritten until Kevin says so.'),
  pageBreak(),

  // Section 9 — sign-off
  h1('9.  Sign-off'), rule(),
  p('This document is a readback of the Team Magnificent app as Kevin described it across the conversation on 2026-05-14 / 2026-05-15. It captures what Claude understands. It is not a build plan.'),
  p('Kevin\u2019s options after reading this:'),
  bullet('Mark up this document with corrections, missing pieces, and anything Claude got wrong.'),
  bullet('Send a corrected version back to Claude, or read the corrections out in a new conversation.'),
  bullet('Decide whether the existing momentum-creation-system code and database artifacts get deleted, salvaged, or left alone.'),
  bullet('Decide what the actual first piece of the app is that gets built \u2014 once this document is signed off and not before.'),
  new Paragraph({
    spacing: { before: 600, after: 200 },
    children: [new TextRun({ text: "Kevin\u2019s signature / date:", italics: true, color: GREY })],
  }),
  new Paragraph({
    spacing: { before: 600, after: 200 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: '_____________________________________________' }),
      new TextRun({ text: '\t' }),
      new TextRun({ text: '_______________________' }),
    ],
  }),
  new Paragraph({
    spacing: { after: 200 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: 'Kevin L. Gardner', color: GREY, size: 18 }),
      new TextRun({ text: '\t' }),
      new TextRun({ text: 'Date', color: GREY, size: 18 }),
    ],
  }),
  new Paragraph({
    spacing: { before: 800, after: 80 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '\u2014 end of document \u2014', italics: true, color: GREY, size: 18 })],
  }),
];

const doc = new Document({
  creator: 'Claude',
  title: 'Team Magnificent \u2014 App Description Document',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: BLACK },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: BLACK },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: BLACK },
        paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: { default: new Header({ children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: 'Team Magnificent \u2014 App Description Document', italics: true, color: GREY, size: 18 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
    })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 18, color: GREY })],
    })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, 'Team-Magnificent-App-Description.docx');
  fs.writeFileSync(out, buf);
  console.log('wrote ' + out + ' (' + buf.length + ' bytes)');
});
