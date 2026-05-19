// Build: Team-Magnificent-TEAM-Design.docx
// Surface design document for teammagnificent.team (Brand Ambassador-facing)
// Locked sources: Chat #85 decisions (docs/chat-85-decisions.md),
// Team-Magnificent-Signup-Architecture.docx (Section A signup spec is referenced, not duplicated),
// Team-Magnificent-COM-Design.docx (powerline mechanic, six-section dashboard for the BA preview),
// project-knowledge verbatim chunks for Michael Magnificent / Ivory / ScriptMaker roles,
// Stage 6-8 of the recruitment chain (Timettra -> doctor -> Marcus example),
// and the Layer 1 / Layer 2 framing (placement-and-momentum first, comp plan deferred).

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

// ----- helpers (match build-com-design.cjs exactly) -----

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

const quote = (text) => new Paragraph({
  spacing: { before: 120, after: 160, line: 320 },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 8 } },
  indent: { left: 360, right: 360 },
  children: [new TextRun({ text, italics: true, color: BLACK })],
});

// ----- content -----

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
    children: [new TextRun({ text: 'teammagnificent.team', bold: true, size: 64, color: GOLD })],
  }),
  new Paragraph({
    spacing: { after: 600 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Surface Design Document', bold: true, size: 32, color: GREY })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Login, welcome, Michael, Fast Start, orientation, invitations, cockpit, .com preview, profile.', size: 22, italics: true, color: GREY })],
  }),
  new Paragraph({
    spacing: { after: 1200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'The Brand Ambassador-facing side of the system.', size: 22, italics: true, color: GREY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Prepared for: Kevin L. Gardner, Founder, Team Magnificent', size: 22, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Companion to the COM Design and Signup & Architecture documents', size: 20, italics: true, color: GREY })],
  }),
  pageBreak(),

  // ===== HOW TO READ =====
  h1('How to read this document'),
  p('This is a readback of the .team surface design as discussed across Chats #82, #84, and #85 and the verbatim BA-experience descriptions captured in project knowledge. It is not a build plan. Nothing in it is built until Kevin says it is right.'),
  p('Kevin\u2019s options after reading:'),
  bullet('Mark up the document with corrections, missing pieces, anything that is wrong.'),
  bullet('Answer the open questions in Section J, or leave them open with a note that they are unresolved.'),
  bullet('Decide which surface to build first \u2014 the cockpit (Section H), the invitation generator (Section G), or the welcome+Michael path (Sections C and D), since each can ship independently once the signup gate (Signup & Architecture document, Section A) is live.'),
  rule(),

  // ===== STANDING RULE =====
  h2('The standing rule, in Kevin\u2019s words'),
  quote('and it should never conflict with three international only mirror. if there is a conflict or dispute three international is the final authority'),
  p('THREE International is the single source of truth and the final authority on sponsorship, enrollment, placement, and compensation. Every record described in this document mirrors THREE\u2019s records for Team Magnificent\u2019s own operational visibility. The Team Magnificent app never disputes or overrides THREE. If at any point our records differ from THREE\u2019s records, we update ours to match.'),
  callout('Compliance posture for .team.', 'The .team surface is for already-enrolled Brand Ambassadors. Income, compensation, cycles, rank progression, and volume math may appear inside .team in a training context \u2014 because the audience has already enrolled under THREE\u2019s policies and procedures. None of it appears on .com. The two surfaces are kept clean of each other.'),
  rule(),
  pageBreak(),

  // ===== SECTION A — LOGIN =====
  h1('A.  The .team login page'),
  p('Every returning Brand Ambassador hits this page first. Signup is covered in the Signup & Architecture document, Section A, and is not duplicated here. This section is only about returning users.'),

  h2('A.1  Where it lives'),
  bullet('Route: teammagnificent.team/login.'),
  bullet('Public, no auth required.'),
  bullet('No SEO indexing \u2014 robots: noindex, nofollow.'),
  bullet('Linked from /register (\u201CAlready have an account? Sign in.\u201D) and from the welcome email new BAs receive.'),

  h2('A.2  Page sections, top to bottom'),
  h3('Header strip'),
  bullet('Team Magnificent wordmark in gold, top-left.'),
  bullet('No nav. The page does one thing.'),

  h3('Eyebrow + headline'),
  bullet('Eyebrow: \u201CTeam Magnificent \u00B7 Brand Ambassador\u201D in gold mono, uppercase, letter-spaced.'),
  bullet('Headline: \u201CSign in.\u201D in Bebas Neue, very large.'),
  bullet('Sub-line: \u201CWelcome back. Sign in to your Team Magnificent cockpit.\u201D'),

  h3('The form (single column, vertical stack)'),
  bulletBold('Email \u2014 ', 'email input. The login identifier. Validated for format.'),
  bulletBold('Password \u2014 ', 'password input with a show/hide toggle.'),
  bulletBold('Remember me \u2014 ', 'optional checkbox. When checked, the JWT cookie persists for 30 days; otherwise it expires when the browser session ends.'),
  bulletBold('Submit button \u2014 ', '\u201CSign in\u201D in gold. Disabled until both fields are non-empty.'),

  h3('Below the form'),
  bullet('\u201CForgot password?\u201D link \u2192 /forgot-password.'),
  bullet('\u201CHave an access code? Create your account.\u201D link \u2192 /register.'),

  h3('Footer'),
  bullet('Single compliance line: \u201CTeam Magnificent is an independent operational team inside THREE International.\u201D'),

  h2('A.3  What happens when the form is submitted'),
  p('Client POSTs to /api/auth/login. The server runs:'),
  bullet('Look up BA by email.'),
  bullet('If not found, return generic \u201Cinvalid credentials\u201D \u2014 do not reveal whether the email exists.'),
  bullet('Verify the password hash (bcrypt or argon2id).'),
  bullet('On success, issue a JWT and set it as an http-only cookie. Cookie lifetime depends on Remember me.'),
  bullet('Write a login event to the audit log: BA ID, IP, user agent, timestamp.'),
  bullet('Return success. Client redirects to /cockpit.'),

  h2('A.4  Failure modes the user sees'),
  bulletBold('Invalid credentials \u2014 ', 'red banner at the top of the form, \u201CEmail or password is incorrect.\u201D Generic message; do not differentiate.'),
  bulletBold('Account deactivated \u2014 ', 'specific message: \u201CThis account is no longer active. Contact your sponsor or Team Magnificent support.\u201D'),
  bulletBold('Too many attempts \u2014 ', 'after 5 failed attempts in 10 minutes, lock the account for 15 minutes and show \u201CToo many attempts. Try again in 15 minutes.\u201D Audit-log every lockout.'),
  bulletBold('Network or server error \u2014 ', 'generic banner: \u201CSomething went wrong. Please try again.\u201D'),

  h2('A.5  Forgot password flow'),
  p('Straightforward flow, dependent on the email provider choice (Signup & Architecture, Section E.6):'),
  bullet('User enters email at /forgot-password.'),
  bullet('Server always returns the same response \u2014 \u201CIf an account exists, we have sent a reset link.\u201D \u2014 to avoid enumeration.'),
  bullet('If the account exists, send a reset email with a single-use, time-limited token in the URL.'),
  bullet('Reset URL: /reset-password?token=\u2026. Token expires after 1 hour.'),
  bullet('User clicks the link, lands on the reset form, enters and confirms the new password.'),
  bullet('Server validates the token, hashes the new password, invalidates the token, audit-logs the reset, redirects to /login.'),

  rule(),
  pageBreak(),

  // ===== SECTION B — SIGNUP REFERENCE =====
  h1('B.  Signup'),
  p('The .team signup page \u2014 every field, every validation, the access-code mechanism, and the submit-side server sequence \u2014 is specified in full in the Signup & Architecture document, Section A. It is not repeated here.'),
  p('Two things to remember at the .team surface:'),
  bulletBold('Signup is invitation-only. ', 'Without a valid access code from a sponsoring BA, no signup is possible. There is no public marketing entry point to .team.'),
  bulletBold('Sponsor binding is immutable. ', 'The access code used at signup determines the new BA\u2019s sponsor on Team Magnificent\u2019s operational record. That sponsor cannot be edited later. Same rule as prospect sponsor immutability on .com.'),
  callout('See: Signup & Architecture, Section A.', 'Field list, validation rules, real-time access-code verification, server sequence on submit, what the user sees on each failure mode, sponsor immutability, no-silent-partial-records rule.'),
  rule(),
  pageBreak(),

  // ===== SECTION C — WELCOME =====
  h1('C.  The welcome screen'),
  p('Immediately after a new BA submits the signup form successfully and receives their JWT, they land at /welcome. This is the first page the BA sees inside the authenticated app. It is the first piece of evidence \u2014 in their hands, on their screen \u2014 that Team Magnificent is real, that the system is theirs, and that something is already happening for them.'),

  h2('C.1  Purpose'),
  bullet('Mark the moment. The BA just made a decision \u2014 acknowledge it with the weight it deserves.'),
  bullet('Set expectations for the next 30 minutes \u2014 Michael calls, Fast Start begins, the cockpit unlocks.'),
  bullet('Capture the BA\u2019s commitment by having them read and accept a brief signed welcome note.'),
  bullet('Hand them off to the Michael interview path with zero confusion about what to do next.'),

  h2('C.2  Page sections, top to bottom'),
  h3('Hero strip'),
  bullet('Background: deep ink (#0A0A0A) with a single gold compass-rose mark, centered, softly glowing.'),
  bullet('Eyebrow: \u201CWelcome to Team Magnificent \u00B7 [BA First Name].\u201D'),
  bullet('Headline (Bebas Neue, very large): \u201CYou just hit the lottery of network marketing success.\u201D'),
  bullet('Sub-line: \u201CYou joined a team that builds people before it builds volume. Here is what happens next.\u201D'),

  h3('The signed welcome note'),
  p('Below the hero, a centered, framed block in cream-on-ink that reads like a letter from Kevin and Paul:'),
  quote('You joined Team Magnificent. You are committed to magnificent results in compensation, ranks, leadership, and massive fast momentum. Professionals use tools. Amateurs are trying to sell. We do great deeds. We don\u2019t just plan \u2014 we execute. We are in massive exponential growth and momentum. Welcome to 21st-century AI-empowered network marketing. The speed of the leader is the speed of the group. Success loves speed \u2014 run with alacrity. \u2014 Kevin L. Gardner and Paul Barrios.'),
  bullet('Below the note, a single primary action: \u201CI accept. Let\u2019s begin.\u201D'),
  bullet('On click, the system writes an audit-logged commitment record: BA ID, timestamp, IP, user agent. This is the BA\u2019s on-record agreement to the team\u2019s working principles.'),

  h3('What happens next \u2014 the path of the next 30 minutes'),
  p('A three-step strip below the welcome note showing the immediate path forward. Each step is a card with a number, a title, and a one-line description.'),
  bulletBold('1. Michael calls you. ', 'Within the next few minutes, Michael Magnificent will call your phone to welcome you to the team and conduct a short interview. Stay near your phone.'),
  bulletBold('2. Your Fast Start Guide unlocks. ', 'A 72-hour guided path \u2014 product, compensation, the binary, your first prospect list, your first two candidates.'),
  bulletBold('3. Your sponsor walks the 10-step orientation with you. ', 'Live with Kevin or Paul, scheduled from inside .team.'),

  h3('Continue button'),
  bullet('A single primary CTA at the bottom: \u201CContinue to my cockpit\u201D in gold.'),
  bullet('Click sends the BA to /cockpit. The cockpit shows the new-BA shell (Section H) with the Fast Start Guide ready in the left rail and a banner across the top: \u201CMichael will call you at [phone] in the next few minutes. Please stand by.\u201D'),

  h2('C.3  What the server does on /welcome load'),
  bullet('Enqueue the Michael outbound-call job, scheduled for [delay] after welcome-load timestamp.'),
  bullet('Trigger the welcome email (Signup & Architecture, Section A.4, step 9).'),
  bullet('Mark welcome_seen = true on the BA record with welcome_seen_at.'),
  bullet('Audit-log: welcome_screen_displayed.'),

  h2('C.4  What the server does on \u201CI accept\u201D click'),
  bullet('Triple-stack write of a commitment record: MongoDB ba_commitments, Neo4j (:BA)-[:ACCEPTED]->(:Commitment{version, accepted_at}), ChromaDB indexed for retrieval.'),
  bullet('Mark commitment_accepted = true on the BA record with commitment_accepted_at.'),
  bullet('Audit-log: welcome_commitment_accepted.'),
  callout('Open question \u2014 J.4.', 'Should the welcome screen require the BA to type their name as a signature, or is a click-acknowledge sufficient? Click is simpler; typed signature is heavier and more deliberate.'),

  rule(),
  pageBreak(),

  // ===== SECTION D — MICHAEL INTERVIEW UI =====
  h1('D.  The Michael Magnificent interview \u2014 BA-facing surface'),
  p('Michael is not a chat agent. Michael is the outbound voice that calls every new BA shortly after signup, conducts a short structured interview, and feeds the transcript and scoring back into the BA\u2019s record and their upline cockpit. The BA-facing surface inside .team is the visual companion to that call \u2014 not a replacement for it.'),

  h2('D.1  Michael, in the language of the system'),
  quote('Michael Magnificent is the onboarding voice. When a brand new BA gets enrolled, Michael calls them within minutes \u2014 not to teach the comp plan, but to teach Layer 1. \u201CYou joined Team Magnificent. Here\u2019s how this works: you have two legs. You need to find two people. The team grows beneath you. Here are your tools. Your sponsor will help you with the rest.\u201D Comp plan deferred until the BA has signed two people and earned enough conviction to want to know more.'),
  note('Verbatim from project knowledge, captured in the locked description of the agents\u2019 roles.'),

  h2('D.2  Where Michael lives in .team'),
  bullet('Route: teammagnificent.team/michael.'),
  bullet('Authenticated. JWT required.'),
  bullet('Linked from the welcome screen continue path and from a persistent card in the cockpit until the interview is complete.'),

  h2('D.3  Three states of the Michael page'),
  h3('State 1 \u2014 Awaiting call'),
  p('From the moment the BA accepts the welcome through the moment Michael\u2019s outbound call rings their phone. The page shows:'),
  bullet('Status pill (gold): \u201CMichael will call you shortly at [BA phone number].\u201D'),
  bullet('A live waiting indicator \u2014 a soft pulsing dot, the kind of detail that signals \u201Csystem is working, stand by.\u201D'),
  bullet('A one-line context note: \u201CMichael conducts a short voice interview to help your sponsor know how to support you best. The call usually takes 5 to 8 minutes.\u201D'),
  bullet('A small button beneath: \u201CMy phone number is wrong \u2014 update it.\u201D Links to the profile page.'),

  h3('State 2 \u2014 Call in progress'),
  p('From the moment Michael\u2019s call connects (detected via Telnyx webhook) through the moment it disconnects. The page shows:'),
  bullet('Status pill (teal, pulsing): \u201CMichael is on the line with you.\u201D'),
  bullet('A live transcript view, populated in near-real-time from the speech-to-text stream. Each utterance appears as it is recognized, with speaker labels (Michael / You).'),
  bullet('No action buttons. The BA is on a phone call \u2014 the surface is observational, not interactive.'),

  h3('State 3 \u2014 Call complete'),
  p('From the moment the call ends. The page shows:'),
  bullet('Status pill (gold check): \u201CInterview complete.\u201D'),
  bullet('A summary block: the BA\u2019s answers to each of Michael\u2019s structured prompts, rendered as a clean readback.'),
  bullet('A signed-by line from Michael: \u201CCaptured by Michael Magnificent \u00B7 [date/time].\u201D'),
  bullet('A note: \u201CYour sponsor [Sponsor Name] now has this context. They will reach out as part of the 10-step orientation.\u201D'),
  bullet('A primary CTA: \u201CContinue to the Fast Start Guide.\u201D Links to /fast-start.'),

  h2('D.4  What Michael captures'),
  p('Michael\u2019s script is locked separately and lives in the agent prompt store (kevin_library, id nwm_strategist_gateway_prompt_v1 family). The .team surface displays the captured answers, not the script itself. Captured fields include:'),
  bullet('Why are you doing this business? (open answer, voice transcribed)'),
  bullet('What does success in the next 12 months look like for you? (open answer)'),
  bullet('How many hours per week can you commit to building this? (open answer, normalized to a numeric range)'),
  bullet('Have you built a network marketing business before? (yes / no plus optional detail)'),
  bullet('Anything you want your sponsor to know about you that will help them support you well? (open answer)'),
  callout('Open question \u2014 J.5.', 'Are these the right five prompts, or does Kevin have a script document already drafted that should replace this list verbatim?'),

  h2('D.5  Fallbacks'),
  bulletBold('BA does not answer Michael\u2019s call. ', 'Michael leaves a voicemail (script TBD) and tries again 30 minutes later. After two failed attempts, the system emails the BA a link to a written version of the same five prompts and sends an SMS link to the same form.'),
  bulletBold('BA phone number is invalid. ', 'Telnyx returns an undeliverable error. The system flags the BA record, surfaces a banner in their cockpit \u201CWe could not reach you at [phone]. Please update your number.\u201D, and pauses Michael\u2019s queue for that BA until the number is fixed.'),
  bulletBold('BA closes the page during the call. ', 'The transcript continues to capture server-side. Reopening /michael resumes State 2 with the transcript caught up. The call does not depend on the page being open.'),
  bulletBold('Speech-to-text fails. ', 'The call audio is captured to a Telnyx recording URL. The page shows \u201CTranscript unavailable \u2014 your sponsor has the audio.\u201D The audio is attached to the BA\u2019s record and available to the upline cockpit.'),

  h2('D.6  What the upline cockpit sees'),
  bullet('A new BA event card appears in the sponsor\u2019s cockpit when Michael\u2019s call completes: \u201C[New BA Name] completed their Michael interview.\u201D'),
  bullet('The card expands to show the captured answers and a link to the audio.'),
  bullet('Scoring (intent strength, time commitment classification, prior experience) is calculated by Michael and surfaced as small tags on the card.'),
  callout('Compliance.', 'Scoring is internal context for the sponsor only. It never appears on the new BA\u2019s own screen, in any prospect-facing surface, or in any compensation calculation. It is operational \u2014 not a rating, not a judgment, not a placement input.'),

  rule(),
  pageBreak(),

  // ===== SECTION E — FAST START GUIDE =====
  h1('E.  The Fast Start Guide'),
  p('The Fast Start Guide is the BA\u2019s first 72 hours, structured. It is the path from \u201CI just joined\u201D to \u201CI sent my first invitation.\u201D Everything else in .team can wait \u2014 this cannot.'),

  h2('E.1  Purpose, in one paragraph'),
  p('A new BA who finishes Michael\u2019s interview is fired up but has no operating procedure. The Fast Start Guide gives them five things in order: enough product knowledge to share without misrepresenting, enough comp-plan structure to know what they\u2019re building, the binary explained as two legs not a tree, a tool to identify the first 20\u201330 names in their warm market, and a clear pointer to their first two candidates. By the end of 72 hours the BA has identified their first two people, sent their first invitations, and has prospects in the holding tank.'),

  h2('E.2  Where it lives'),
  bullet('Route: teammagnificent.team/fast-start.'),
  bullet('Authenticated. Unlocked the moment the welcome screen is accepted.'),
  bullet('Visible as a persistent rail in the cockpit until all five modules are marked complete.'),

  h2('E.3  Structure'),
  p('Five modules, sequential but not gated. A BA can move freely between them \u2014 the system tracks completion and surfaces the next unfinished module on cockpit load. Each module is a single scrollable page with a defined start and end.'),

  h3('Module 1 \u2014 The product'),
  bullet('Lead with Dr. Dan\u2019s 17-minute video (same video the prospect sees \u2014 the BA needs to be fluent in it).'),
  bullet('Product detail: GLP-THREE, what it is, the six-pillar differentiation (patented, clinically tested, scientifically researched, all natural, first in marketplace, PDR listed).'),
  bullet('Dosage: 3/4 of a dropper, 30 minutes before a meal. Sourced directly from Dr. Dan transcripts; do not paraphrase.'),
  bullet('Kevin\u2019s testimonial as the canonical example: 14 lbs in 6 weeks, inches off neck, belly, waist. \u201CI ran out because it was working.\u201D'),
  bullet('Compliance reminder: testimonials are personal results. No claims about average outcomes; no medical claims.'),
  bullet('Completion: a single-question check (\u201CCan you tell someone in 30 seconds what GLP-THREE is and why it\u2019s different?\u201D \u2014 yes/no self-report) and the module is marked complete.'),

  h3('Module 2 \u2014 The compensation plan, Layer 1 only'),
  callout('Compliance.', 'The Fast Start Guide intentionally does not teach the comp plan in depth. Layer 1 (placement and structure) is taught here. Layer 2 (cycle math, rank progression, income strategy) is a separate progressive module the BA opens when they are ready \u2014 usually after their first cycle hits.'),
  bullet('You have two legs. Left leg, right leg. That\u2019s it.'),
  bullet('Every new BA you sponsor goes into one of your two legs. You decide which leg, based on the team\u2019s placement strategy.'),
  bullet('When your legs grow, you earn. The deeper the math is handled by THREE \u2014 you do not need to calculate it. THREE\u2019s back office is the authoritative source for your numbers.'),
  bullet('Your job: find two people. Help them find two people. Repeat.'),
  bullet('Completion: a single-question check (\u201CCan you draw the picture of two legs and explain it in 60 seconds?\u201D \u2014 yes/no self-report).'),

  h3('Module 3 \u2014 The products beyond GLP-THREE'),
  bullet('A short page introducing the rest of THREE\u2019s product line at a glance, with a link out to THREE\u2019s product catalog for detail.'),
  bullet('Focus stays on GLP-THREE as the lead product. The other products exist; the BA does not need to be an expert in them on day one.'),
  bullet('Completion: scroll-to-end + acknowledge.'),

  h3('Module 4 \u2014 Building your prospect list'),
  bullet('The frame: \u201CWho do you know that\u2026?\u201D \u2014 a structured exercise that produces a list of 20\u201330 names in 20 minutes. This is the BA\u2019s warm market starting point.'),
  bullet('The actual exercise is run by Ivory in the invitation generator (Section G). Module 4 introduces the concept and prompts the BA to open Ivory.'),
  bullet('Completion: the BA opens Ivory at least once and starts a Who Do You Know list (any length).'),

  h3('Module 5 \u2014 Identifying your first two candidates'),
  bullet('From the list in Module 4, the BA picks two people they will personally invite first.'),
  bullet('Criteria the system surfaces (drawn from Ivory\u2019s guidance): people you already have a real relationship with, people who would benefit from the product, people you would not be embarrassed to share this with.'),
  bullet('Completion: two prospects are marked as \u201Cfirst candidates\u201D in the BA\u2019s CRM. (This is also the BA\u2019s first interaction with the invitation generator.)'),

  h2('E.4  Progress and gating'),
  bullet('Modules are sequential in the rail but not hard-gated \u2014 a BA who wants to jump to Module 4 can.'),
  bullet('Completion is tracked per module with a percent indicator in the cockpit.'),
  bullet('The Fast Start Guide is considered complete when all five modules are marked complete AND the BA has sent at least one invitation. \u201CSent an invitation\u201D is the operational definition of \u201Cstarted.\u201D'),

  h2('E.5  Training accelerates, never gates'),
  callout('From project knowledge, verbatim:', 'Training accelerates conviction-to-action time. It doesn\u2019t gate it. A BA can recruit on day one with nothing but the invite link and their sponsor\u2019s phone number. The training is what makes day-thirty-BA twice as effective as day-one-BA without burning the sponsor\u2019s phone calls.'),
  p('A new BA who is fired up and ready to invite their cousin Marcus before they finish Module 1 should be able to do exactly that. The cockpit always shows the invitation generator. The Fast Start Guide is the path \u2014 not the toll booth.'),

  rule(),
  pageBreak(),

  // ===== SECTION F — 10-STEP ORIENTATION =====
  h1('F.  The 10-step orientation'),
  p('Once the BA has completed the Fast Start Guide \u2014 or sooner, if the sponsor schedules it earlier \u2014 the 10-step orientation runs live with Kevin or Paul over Zoom. This is the deepening pass. The Fast Start gave the BA enough to start. The 10-step gives them the architecture.'),

  h2('F.1  Purpose'),
  bullet('Replace the new BA\u2019s assumed mental model of \u201Cnetwork marketing\u201D with the actual Team Magnificent operating model.'),
  bullet('Establish the human relationship between the new BA and the top of the team. Every BA, eventually, has met Kevin or Paul live.'),
  bullet('Address the questions the Fast Start Guide could not anticipate.'),
  bullet('Set the next 30-, 60-, 90-day expectation.'),

  h2('F.2  How it is scheduled'),
  bullet('From inside .team, the BA sees a scheduling card in their cockpit: \u201CSchedule your 10-step orientation with Kevin or Paul.\u201D'),
  bullet('Calendar slots are surfaced from Kevin\u2019s and Paul\u2019s availability (mechanism TBD \u2014 Calendly-style embed, custom slot picker, or manual outreach).'),
  bullet('Confirmation goes to the BA\u2019s email and adds a Zoom link.'),
  bullet('Sponsor is notified that their downline BA has scheduled the orientation \u2014 they are welcome to attend (and usually do).'),

  h2('F.3  The 10 steps'),
  callout('Content lock.', 'The actual content of each of the 10 steps is Kevin\u2019s curriculum. This document describes the surface and the scheduling \u2014 not the curriculum. The curriculum is loaded into the orientation by the host (Kevin or Paul) live on the call.'),
  bullet('Step 1 \u2014 Welcome and personal context.'),
  bullet('Step 2 \u2014 Why Team Magnificent inside THREE International (the team\u2019s positioning).'),
  bullet('Step 3 \u2014 Product mastery deep dive (beyond Fast Start Module 1).'),
  bullet('Step 4 \u2014 The binary, explained again, in more depth.'),
  bullet('Step 5 \u2014 The Power of 2 \u2014 why two committed people change everything.'),
  bullet('Step 6 \u2014 2 in 72 \u2014 the rhythm.'),
  bullet('Step 7 \u2014 Your warm market and how to think about it.'),
  bullet('Step 8 \u2014 Your tools \u2014 .team, ScriptMaker, Michael, Ivory, the invitation generator, the cockpit.'),
  bullet('Step 9 \u2014 Compliance \u2014 what we do and do not say, in conversation, on social media, in messaging.'),
  bullet('Step 10 \u2014 Your next 30 days \u2014 specific, written, agreed-to plan.'),
  callout('Open question \u2014 J.6.', 'Are these the right 10 steps in this order, or does Kevin\u2019s curriculum use different titles, different order, or a different count? The 10-step framing came from prior chats; the actual content list above is a placeholder.'),

  h2('F.4  After the orientation'),
  bullet('The orientation host marks the orientation complete in the BA\u2019s record.'),
  bullet('The new BA\u2019s cockpit removes the scheduling card and shows a small badge: \u201C10-step orientation complete \u00B7 [Date].\u201D'),
  bullet('A follow-up note is added to the BA\u2019s record summarizing the agreed 30-day plan from Step 10.'),

  rule(),
  pageBreak(),

  // ===== SECTION G — INVITATIONS =====
  h1('G.  The invitation generator \u2014 the heart of .team'),
  p('Every BA, every day, opens .team for one reason more than any other: to invite someone. The invitation generator is the engine. It is where Who Do You Know, ScriptMaker, the token-mint, and the personalized link all meet.'),

  h2('G.1  Where it lives'),
  bullet('Route: teammagnificent.team/invitations.'),
  bullet('Authenticated. Always visible in the cockpit nav. Never gated behind training completion.'),

  h2('G.2  The flow at a glance'),
  bullet('1. The BA opens the invitation generator.'),
  bullet('2. They either pick a name from their Who Do You Know list (Ivory-built) or start a fresh invitation by name and relationship context.'),
  bullet('3. ScriptMaker drafts a personalized message script for that specific prospect.'),
  bullet('4. The BA reviews and edits the script.'),
  bullet('5. The BA confirms they have spoken with the prospect first (per Kevin\u2019s rule, real human contact precedes the link).'),
  bullet('6. On confirm, the system creates the prospect record, mints the invite token, and returns the personalized .com link with the token in the URL.'),
  bullet('7. The BA clicks \u201CI sent this\u201D after texting or messaging the prospect.'),
  bullet('8. The prospect appears in the BA\u2019s CRM with status \u201Clink-sent.\u201D'),
  bullet('9. Every subsequent event (link clicked, video started, video complete, callback requested) updates the CRM and fires an alert to the BA.'),

  h2('G.3  Ivory \u2014 the Who Do You Know surface'),
  quote('Ivory is the relationship coach. Helps the BA think through who to invite. \u201CWho do you know that\u2019s frustrated with their weight?\u201D \u2014 the Who Do You Know game. \u201CHow do I invite my pastor?\u201D \u2014 relationship-specific scripts. None of this requires comp plan knowledge. It requires people knowledge, which Ivory amplifies.'),
  note('Verbatim from project knowledge.'),

  h3('How Ivory works on .team'),
  bullet('Embedded panel inside the invitation generator, also accessible as a standalone route /ivory.'),
  bullet('Ivory asks structured questions one at a time: \u201CWho do you know that\u2019s frustrated with their weight?\u201D, \u201CWho retired in the last two years?\u201D, \u201CWho has wanted to start a side business?\u201D, \u201CWho is the most respected person in your phone?\u201D \u2014 categories drawn from Kevin\u2019s warm market framework.'),
  bullet('Each name the BA types is added to the Who Do You Know list with the category as a tag.'),
  bullet('Names persist. The list is the BA\u2019s ongoing warm market roster, not a one-time exercise. Names can be marked invited, customer, BA, not-interested, follow-up-later.'),
  bullet('Ivory can also coach relationship-specific scripts on demand: \u201CHow do I invite my pastor?\u201D Ivory drafts a script that respects the relationship context.'),

  h3('What Ivory does not do'),
  bullet('Ivory does not call, text, or message anyone on the BA\u2019s behalf. Ivory is a coach, not a robot.'),
  bullet('Ivory does not qualify prospects. No scoring of warmth, no prediction of conversion likelihood, no AI lead qualification \u2014 THREE\u2019s policies forbid it and so does Team Magnificent\u2019s posture.'),
  bullet('Ivory does not produce compensation or income content for prospects. The scripts Ivory drafts are conversation openers and relationship bridges, not pitches.'),

  h2('G.4  ScriptMaker \u2014 the comp-plan translator and invitation drafter'),
  quote('ScriptMaker is the comp-plan translator. A BA tells ScriptMaker about a prospect (a doctor, a friend, a coworker \u2014 whoever) and ScriptMaker pulls in the prospect\u2019s relationship context, the BA\u2019s market and position, the comp plan math the BA doesn\u2019t know yet, and compliance constraints (no income guarantees). It outputs a personalized earnings strategy in language the BA can use in conversation \u2014 without the BA needing to do the cycle math themselves. ScriptMaker is \u201CKevin on the phone yesterday with Timettra,\u201D available 24/7 to every BA.'),
  note('Verbatim from project knowledge.'),

  h3('How ScriptMaker works on .team'),
  bullet('Embedded panel inside the invitation generator. The BA picks a name from the Who Do You Know list (or types a new prospect with name + relationship context) and ScriptMaker drafts.'),
  bullet('Inputs ScriptMaker uses: prospect name, relationship to BA, any context the BA provided (occupation, life situation, what they care about, prior conversations).'),
  bullet('Inputs ScriptMaker pulls from system context: BA\u2019s market and position inside the team, the locked compliance constraints, the locked product narrative, the canonical objection responses.'),
  bullet('Output: a personalized invitation script the BA can copy, edit, and send. The script is conversational \u2014 it is not a pitch deck.'),
  bullet('Output also includes (for the BA\u2019s reference, not for sending): a short \u201Cwhat to say if they ask about the money\u201D talking-point block, compliance-safe, drawn from the comp plan but never quoting income figures.'),

  h3('Script substitution and the token-link injection'),
  bullet('The script includes a placeholder for the personalized .com link \u2014 e.g. \u201C\u2026watch this 17-minute video: {{personalLink}}\u201D.'),
  bullet('When the BA confirms the prospect record is real and they have spoken with the person, the system mints the invite token and substitutes {{personalLink}} with the real URL: https://teammagnificent.com/p/{token}.'),
  bullet('The substituted script is returned to the BA along with the prospect\u2019s CRM record. The BA copies the script and sends it from their own messaging app \u2014 the system never sends on their behalf.'),

  h2('G.5  The \u201CI sent this\u201D confirmation'),
  bullet('After the script is delivered, the BA sees a clear primary action: \u201CI sent this to [Prospect Name].\u201D'),
  bullet('Clicking it logs the invitation as sent, sets the prospect\u2019s status to \u201Clink-sent,\u201D and starts the activity timeline.'),
  bullet('If the BA needs to log an invitation they sent outside the generator (typed the link by hand into iMessage, for example), there is a standalone \u201CLog an invite I sent\u201D entry point in the invitations page \u2014 same effect, same prospect record creation.'),

  h2('G.6  What is rendered when the prospect clicks the link'),
  bullet('The .com client at /p/{token} renders the presentation page personalized to the inviting BA (their name appears, the callback CTA names them). After video_complete the prospect is silently placed in the team-wide holding tank and sees the locked six-section dashboard.'),
  callout('See: Team-Magnificent-COM-Design.docx.', 'The full .com surface is specified separately. The .team side cares about three things from the .com side: that the link works, that the events come back to the BA\u2019s CRM in real time, and that the callback CTA on the dashboard fires an alert correctly.'),

  h2('G.7  Compliance locks the invitation generator enforces'),
  bulletBold('Real human contact precedes the link. ', 'The flow has a hard step where the BA confirms they have spoken (text or call) with the prospect first. Cold-blast invitations are not the model.'),
  bulletBold('No automated outbound. ', 'The system does not text, call, or DM anyone. The BA sends the message from their own device.'),
  bulletBold('No mass send. ', 'The generator drafts one script for one prospect at a time. No CSV upload of names, no broadcast.'),
  bulletBold('No income content in the prospect script. ', 'ScriptMaker\u2019s output for the prospect contains no specific income figures, no \u201Cyou can earn\u201D language, no comp-plan math. The BA\u2019s internal reference talking points are separate from the prospect-facing script.'),

  rule(),
  pageBreak(),

  // ===== SECTION H — BA COCKPIT =====
  h1('H.  The BA cockpit'),
  p('The cockpit is what the BA sees every time they sign in. It is their operational dashboard \u2014 not a duplicate of THREE\u2019s back office. THREE shows organizational truth (volume, rank, cycles, paycheck). The cockpit shows operational truth (who watched my video, who\u2019s in my holding tank, who clicked call-me, what do I do today).'),

  h2('H.1  The locked scope (Chat #85)'),
  callout('Locked in Chat #85, no deviation without Kevin\u2019s approval.', 'The BA cockpit on .team is stripped of all genealogy except one thing. THREE already shows downline / team / binary / volume / rank. Duplicating any of that in .team would create drift and confuse compliance.'),
  p('Three elements, in this order:'),
  bulletBold('1. My Sponsor card. ', 'Name + phone + a Send Message button. No photo, no email. For code-derived sponsors (every normal BA), pulled from the access-code owner\u2019s BA record. For founders (Kevin and Paul), manually overridden on their profile. Kevin\u2019s card shows My Sponsor = Paul Barrios + Paul\u2019s phone. Paul\u2019s card shows My Sponsor = Lance and Tracie Smith + their phone.'),
  bulletBold('2. My Invites. ', 'Full list of personally invited prospects with the status pipeline visualized: link minted \u2192 clicked \u2192 video started \u2192 video completed \u2192 in holding tank \u2192 callback requested \u2192 webinar reserved \u2192 enrolled \u2192 expired.'),
  bulletBold('3. CRM per invite. ', 'Activity timeline, notes, follow-up reminders, tags, prospect contact info, dispositions, and the option to re-invite when an invitation expires.'),
  p('Nothing else genealogy-related on .team for regular BAs. Full team genealogy mirror lives only on /admin \u2014 Kevin\u2019s operational tool, not BA-facing.'),

  h2('H.2  The cockpit layout'),
  h3('Top strip \u2014 identity and links'),
  bullet('Left: Team Magnificent wordmark in gold.'),
  bullet('Center: BA full name + role pill (Brand Ambassador).'),
  bullet('Right: profile / settings link and sign-out.'),

  h3('Welcome banner (until Fast Start is complete)'),
  bullet('A persistent banner across the top of the cockpit while the new BA is still working through the Fast Start Guide. Shows: progress through the five modules (e.g. 3 of 5 complete), the immediate next module link, and the scheduling card for the 10-step orientation.'),
  bullet('Removed automatically once Fast Start is complete and the orientation is scheduled.'),

  h3('Left rail \u2014 the surfaces'),
  bullet('Cockpit (the default landing view).'),
  bullet('My Invites (links to the full CRM view).'),
  bullet('Invitation Generator.'),
  bullet('Fast Start Guide (until complete).'),
  bullet('Michael (until interview complete).'),
  bullet('Orientation (until complete).'),
  bullet('Training (always available, optional, post-Fast Start).'),
  bullet('Replicated .com preview.'),
  bullet('Profile.'),

  h3('Main column \u2014 the three locked elements'),
  bullet('Top card: My Sponsor (Section H.3).'),
  bullet('Middle card: today\u2019s actions (Section H.4) \u2014 a derived view of the My Invites pipeline showing what needs the BA\u2019s attention right now.'),
  bullet('Below: My Invites pipeline visualization (Section H.5).'),

  h2('H.3  My Sponsor card \u2014 in detail'),
  bullet('Card title: \u201CMy Sponsor.\u201D'),
  bullet('Body: full name (large), phone number (smaller, tap-to-call on mobile).'),
  bullet('Action: \u201CSend [Sponsor First Name] a message\u201D button \u2014 opens the device\u2019s native SMS app (sms: link) prefilled with the sponsor\u2019s number.'),
  bullet('No photo. No email. No title. No genealogy chain. Just the relationship that matters.'),
  bullet('For code-derived sponsors: data comes from the access-code owner\u2019s BA record automatically.'),
  bullet('For Kevin: sponsor card is manually set to Paul Barrios with Paul\u2019s phone.'),
  bullet('For Paul: sponsor card is manually set to Lance and Tracie Smith with their phone.'),
  callout('Open question \u2014 J.7.', 'What happens if a sponsor leaves Team Magnificent or is removed? The downline BAs still need a real human upline contact. Does the card auto-roll up to the next active BA in the chain, or stay locked to the original sponsor and surface a separate \u201Cescalation contact\u201D card?'),

  h2('H.4  Today\u2019s actions \u2014 derived from My Invites'),
  bullet('Not a separately maintained list \u2014 a computed view over the BA\u2019s invitations. Shows up to 6 cards.'),
  bullet('Prospects who clicked the callback CTA in the last 24 hours \u2014 highest priority.'),
  bullet('Prospects who finished the video in the last 24 hours \u2014 high priority.'),
  bullet('Prospects who clicked the link but did not finish the video \u2014 medium priority, suggest a follow-up message.'),
  bullet('Prospects in the holding tank whose 8-week window is approaching expiry \u2014 medium priority.'),
  bullet('Prospects the BA tagged \u201Cfollow up in [N] days\u201D whose date is today.'),
  bullet('Each card carries a primary action: \u201CCall [Prospect Name]\u201D, \u201CSend a follow-up message\u201D, \u201COpen ScriptMaker for [Prospect Name]\u201D.'),

  h2('H.5  My Invites \u2014 the pipeline view'),
  bullet('A horizontal pipeline visualization with the locked statuses: link-minted, clicked, video-started, video-complete, in-holding-tank, callback-requested, webinar-reserved, enrolled, expired.'),
  bullet('Each status shows the count of prospects currently in that state.'),
  bullet('Click any count to drill in to the list of those prospects \u2014 standard table view with name, last-activity timestamp, tags.'),
  bullet('Click any prospect to open their CRM detail page.'),

  h2('H.6  CRM per invite \u2014 the prospect detail page'),
  h3('Header'),
  bullet('Prospect name, status pill (current state in the pipeline), invite date, days since invite.'),
  bullet('Contact info (phone, email if known), best time to call (when the prospect supplied it via the callback form).'),

  h3('Activity timeline'),
  bullet('Reverse-chronological list of every event on this prospect\u2019s record: link minted, link clicked (with timestamp + UA fingerprint if available), video started, video milestones (25%, 50%, 75%, complete), holding tank placement (with position number), callback requested (with intent radio choice and best-time field), webinar reservation, BA-logged notes and follow-ups.'),

  h3('Notes and follow-ups'),
  bullet('Free-text notes the BA adds about this prospect.'),
  bullet('A \u201Cfollow up on [date]\u201D reminder field. When the date comes due, the prospect appears in Today\u2019s Actions.'),
  bullet('Disposition selector: in-progress / customer-only / committed-to-enroll / not-interested / lost-touch / re-engage-later. Disposition drives the cadence engine.'),

  h3('Tags'),
  bullet('Free-form tags the BA assigns. Examples: \u201Cfrom-church\u201D, \u201Cdoctor\u201D, \u201Cretired-this-year\u201D, \u201Cprior-NWM\u201D. Tags feed back into Ivory\u2019s segmentation for future Who Do You Know exercises.'),

  h3('Re-invite'),
  bullet('Available when an invite token expires (8 weeks). One click mints a new token, generates a fresh script via ScriptMaker (informed by the prior activity timeline), and returns a new link.'),
  bullet('The original prospect record is preserved; the new token is appended to the token history.'),

  h2('H.7  What the cockpit does NOT show'),
  bullet('No team genealogy (THREE handles this).'),
  bullet('No downline list (THREE handles this).'),
  bullet('No binary leg structure (THREE handles this).'),
  bullet('No volume, rank, or compensation figures (THREE handles this).'),
  bullet('No cross-team holding tank view (Kevin only, on /admin).'),
  bullet('No access-code generation or management (Kevin only, on /admin).'),
  bullet('No Michael transcripts of other BAs (sponsor sees their downline\u2019s; admin sees all).'),
  callout('The principle.', 'THREE shows organizational truth. The cockpit shows operational truth. The two are complementary, not duplicative. A BA opens THREE\u2019s back office to see what they earned. They open .team to see what to do next.'),

  rule(),
  pageBreak(),

  // ===== SECTION I — REPLICATED .COM PREVIEW + PROFILE =====
  h1('I.  Replicated .com preview and profile'),

  h2('I.1  Replicated .com preview'),
  p('Every BA can preview what their prospects see when they click an invitation link \u2014 the .com presentation page, personalized to the BA. The preview is the BA\u2019s own /p/{previewToken} rendered inside the .team app, with a sandboxed token that does not create a real prospect record on click.'),

  h3('Where it lives'),
  bullet('Route: teammagnificent.team/preview.'),
  bullet('Authenticated. Linked from the cockpit left rail and from inside the invitation generator (\u201CSee what your prospects see\u201D).'),

  h3('What it shows'),
  bullet('The full .com presentation surface (Dr. Dan video, market opportunity, product, system explainer, 2-in-72 visualization, testimonials, callback CTA, webinar CTA).'),
  bullet('Personalized to the BA \u2014 their name appears wherever the prospect would see it.'),
  bullet('A persistent \u201CPREVIEW MODE\u201D ribbon across the top to remove any ambiguity about who is viewing what.'),

  h3('What it does not do'),
  bullet('Does not write to the holding tank.'),
  bullet('Does not place a prospect record.'),
  bullet('Does not fire BA alerts.'),
  bullet('Does not increment any counter visible to other BAs or other prospects.'),

  h2('I.2  Profile / settings'),
  p('Standard account management surface for the BA.'),

  h3('Where it lives'),
  bullet('Route: teammagnificent.team/profile.'),
  bullet('Authenticated.'),

  h3('Fields the BA can edit'),
  bullet('First name, last name (with audit log on change).'),
  bullet('Email \u2014 requires re-verification via emailed link before the change takes effect.'),
  bullet('Phone \u2014 the number Michael uses for the interview call and the system uses for SMS alerts. Tap to update; immediate effect (no re-verification at this time \u2014 see open question J.8).'),
  bullet('Password \u2014 standard change-password flow (current password + new password twice).'),
  bullet('Photo \u2014 optional, displayed in the cockpit header (and nowhere on .com).'),
  bullet('Time zone \u2014 used for scheduling display only.'),
  bullet('Notification preferences \u2014 which BA alerts go to SMS, which go to email, which go to in-app only.'),

  h3('Fields the BA cannot edit'),
  bulletBold('Sponsor \u2014 ', 'immutable, locked at signup by the access code used. Displayed for reference, not editable.'),
  bulletBold('THREE International BA ID \u2014 ', 'displayed for reference, editable only by Kevin from /admin (because changing it could break the link to THREE\u2019s records).'),
  bulletBold('Team Magnificent BA ID \u2014 ', 'system-assigned at signup, immutable, displayed for reference.'),
  bulletBold('Access code held \u2014 ', 'displayed for reference (so the BA knows what code to give their downline). Code itself is generated by Kevin from /admin; the BA does not edit it.'),

  h3('Sponsor-card override (founders only)'),
  bullet('For Kevin and Paul only: an admin override exists to set the My Sponsor card manually (Kevin\u2019s = Paul Barrios + phone; Paul\u2019s = Lance and Tracie Smith + phone). This override is not visible to or editable by regular BAs.'),

  rule(),
  pageBreak(),

  // ===== SECTION J — OPEN QUESTIONS =====
  h1('J.  Open questions'),
  p('Decisions that need Kevin before code is written. They are not assumptions \u2014 they are decisions for Kevin.'),

  h2('J.1  Login \u2014 Remember me cookie lifetime'),
  p('Proposed: 30 days when Remember me is checked, session-only otherwise. Is 30 days the right window, or shorter (7 days) or longer (90 days)?'),

  h2('J.2  Login \u2014 lockout threshold'),
  p('Proposed: 5 failed attempts in 10 minutes triggers a 15-minute lockout. Right numbers, or tighter (3 attempts, 30 minutes) or looser (10 attempts, 5 minutes)?'),

  h2('J.3  Welcome \u2014 click vs typed signature'),
  p('Should the welcome commitment be a click-acknowledge, or should the BA type their name as a signature? Click is simpler; typed signature is heavier and more deliberate.'),

  h2('J.4  Welcome \u2014 immediate vs delayed Michael call'),
  p('Should Michael call immediately on welcome acceptance, or after a short delay (e.g. \u201CMichael will call you within the next 30 minutes\u201D) so the BA can put the phone down and answer when it rings?'),

  h2('J.5  Michael \u2014 the five interview prompts'),
  p('Section D.4 lists five prompts as a placeholder. Does Kevin have a script document already drafted that should replace this list verbatim, or are these the right five?'),

  h2('J.6  Orientation \u2014 the 10 steps'),
  p('Section F.3 lists 10 steps as a placeholder. What is the actual curriculum, in Kevin\u2019s words, in the order Kevin would teach it?'),

  h2('J.7  Sponsor card \u2014 what happens when a sponsor leaves'),
  p('If a sponsor leaves Team Magnificent or is removed, the downline BAs still need a real human upline contact. Does the My Sponsor card auto-roll up to the next active BA in the access-code chain, or stay locked to the original sponsor and surface a separate \u201Cescalation contact\u201D card?'),

  h2('J.8  Profile \u2014 phone change verification'),
  p('Email change requires re-verification via emailed link. Should phone change require similar verification (SMS verification code), given that the phone is what Michael calls and where SMS alerts go? Higher friction, but prevents accidental misdirection of alerts to a wrong number.'),

  h2('J.9  Fast Start \u2014 gating'),
  p('Section E.4 says modules are sequential but not hard-gated \u2014 a BA can jump around. Is that the right design, or should certain modules (e.g. Module 2 comp-plan-Layer-1) gate access to others?'),

  h2('J.10  Orientation \u2014 scheduling mechanism'),
  p('Section F.2 names the surface but not the mechanism. Calendly-style embed (third-party tool, fast to ship)? Custom slot picker (in-house, more control)? Manual outreach via the sponsor (no tooling needed)?'),

  h2('J.11  Re-invite \u2014 cooldown'),
  p('Section H.6 allows a BA to re-invite an expired prospect with one click. Should there be a cooldown (no more than once per N days, or no more than M total re-invites) to prevent over-messaging?'),

  h2('J.12  Notification preferences \u2014 defaults'),
  p('Section I.2 lets BAs choose which alerts go to SMS, email, or in-app only. What are the defaults? High-priority callback-requested alerts probably default to SMS; lower-signal events probably default to in-app only. Confirm the matrix.'),

  rule(),
  pageBreak(),

  // ===== FOOTER =====
  h2('End of .team design document'),
  rule(),
  p('Next document in the series: Team-Magnificent-ADMIN-Design.docx \u2014 the Kevin-only surface. Code generator, code management, full team genealogy mirror, discrepancy review against THREE, BA list, holding tank cross-team view, Michael transcripts, audit log.'),
  p('After admin: implementation kickoff. The three design documents (COM, TEAM, ADMIN) together specify the full app surface. Once all three are marked up and locked, the build sequence begins \u2014 most likely starting with the signup gate (Signup & Architecture, Section A) and the admin code generator, since one cannot work without the other.'),
  note('Read this document. Mark it up. Tell Claude what is wrong. Nothing about .team gets built until you say it is right.'),
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
  const outPath = path.join(__dirname, 'Team-Magnificent-TEAM-Design.docx');
  fs.writeFileSync(outPath, buf);
  console.log('wrote', outPath, '(' + buf.length + ' bytes)');
});
