/**
 * Builds the Team Magnificent Signup & Architecture document.
 *
 * Word doc, US Letter, print-ready, with two embedded PNG diagrams.
 * Four sections: A) the signup page in detail, B) the full app flow with
 * the rendered flow diagram, C) the technical architecture with the
 * rendered system diagram, D) access codes specifically, E) open questions.
 *
 * Run from the repo root:
 *   node docs/build-signup-architecture.cjs
 *
 * Requires flow.png and system.png to exist next to this script.
 */

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  LevelFormat, PageNumber, PageBreak, Footer, Header, BorderStyle,
  TabStopType, TabStopPosition, ImageRun,
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

const pBold = (label, rest) =>
  new Paragraph({
    spacing: { after: 160, line: 320 },
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: rest }),
    ],
  });

const bullet = (text) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80, line: 300 },
    children: [new TextRun({ text })],
  });

const bulletBold = (label, rest) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80, line: 300 },
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: ' \u2014 ' + rest }),
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

const SKIP_IMAGES = process.env.SKIP_IMAGES === '1';
const flowImage = SKIP_IMAGES ? null : fs.readFileSync(path.join(__dirname, 'flow.png'));
const systemImage = SKIP_IMAGES ? null : fs.readFileSync(path.join(__dirname, 'system.png'));

const placeholder = (label) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 240 },
  border: { top: { style: BorderStyle.SINGLE, size: 6, color: GREY }, bottom: { style: BorderStyle.SINGLE, size: 6, color: GREY }, left: { style: BorderStyle.SINGLE, size: 6, color: GREY }, right: { style: BorderStyle.SINGLE, size: 6, color: GREY } },
  children: [new TextRun({ text: '[ Diagram placeholder: ' + label + ' — to be added in next pass via Excalidraw ]', italics: true, color: GREY, size: 20 })],
});

const imageFlow = SKIP_IMAGES ? placeholder('full BA cycle and access code genealogy') : new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 240 },
  children: [
    new ImageRun({
      data: flowImage,
      type: 'png',
      transformation: { width: 624, height: 832 },
    }),
  ],
});

const imageSystem = SKIP_IMAGES ? placeholder('system architecture: clients, server, gateway, three databases, external services') : new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 240 },
  children: [
    new ImageRun({
      data: systemImage,
      type: 'png',
      transformation: { width: 624, height: 485 },
    }),
  ],
});

const children = [
  new Paragraph({
    spacing: { before: 2400, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'TEAM MAGNIFICENT', bold: true, size: 56, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Signup & Architecture Document', size: 36, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'The .team signup page, the app flow, and the technical architecture.', italics: true, color: GREY, size: 22 })],
  }),
  new Paragraph({
    spacing: { before: 2400, after: 80 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Prepared for: Kevin L. Gardner, Founder, Team Magnificent', size: 22, color: BLACK })],
  }),
  new Paragraph({
    spacing: { after: 200 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Companion to the App Description Document', size: 20, color: GREY, italics: true })],
  }),
  new Paragraph({
    spacing: { before: 1800 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'This document captures the signup design, the full BA cycle, and the system architecture.', italics: true, color: GREY, size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Read it. Mark it up. Tell Claude what is wrong. Nothing gets built until you say it is right.', italics: true, color: GREY, size: 22 })],
  }),
  pageBreak(),

  h1('Executive summary'), rule(),
  new Paragraph({
    spacing: { before: 0, after: 200, line: 320 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'B00020', space: 8 } },
    indent: { left: 240 },
    children: [
      new TextRun({ text: 'Standing rule. ', bold: true, color: 'B00020' }),
      new TextRun({ text: 'THREE International is the single source of truth and the final authority on all sponsorship, enrollment, placement, and compensation. Every record described in this document mirrors THREE\u2019s records for Team Magnificent\u2019s own operational visibility. The Team Magnificent app never disputes or overrides THREE. If at any point our records differ from THREE\u2019s records, we update ours to match.' }),
    ],
  }),
  p('Team Magnificent is invitation-only. Entry to the .team site requires an access code, generated by Kevin from the admin dashboard and assigned to a sponsoring Brand Ambassador. The access code is the gate, and it also mirrors THREE International\u2019s genealogy for Team Magnificent\u2019s own operational visibility \u2014 every code traces back through the team to TM-01 (Kevin). THREE International is the single source of truth and the final authority on all sponsorship, enrollment, and compensation matters. The Team Magnificent record mirrors THREE\u2019s genealogy for internal use; it never competes with it.'),
  p('The app has three client surfaces (admin, .team, .com), one server, three databases written through a single gateway, and a small set of external services (Telnyx for SMS and voice, an email provider, YouTube for the Dr. Dan video). This document describes how they fit together and what the signup page does.'),
  pBold('Section A.', ' The signup/registration page on .team \u2014 every field, every validation, what the user sees, what happens on submit.'),
  pBold('Section B.', ' The full app flow on both sides \u2014 from Kevin generating a code through a new BA going through onboarding and inviting their first prospect, back around the cycle. Includes a rendered flow diagram.'),
  pBold('Section C.', ' The technical system architecture \u2014 clients, server, gateway, three databases, external services. Includes a rendered system diagram.'),
  pBold('Section D.', ' Access codes specifically \u2014 how they work, how they mirror THREE\u2019s genealogy, and the rules they obey.'),
  pBold('Section E.', ' Open questions \u2014 details that still need a decision from Kevin before code is written.'),
  pageBreak(),

  h1('A.  The .team signup page'), rule(),
  h2('A.1  Purpose'),
  p('The signup page exists so a new BA who has just enrolled in THREE International under a Team Magnificent sponsor can create their account on teammagnificent.team. The page is the only public entry point to .team. Without a valid access code, no one can sign up. There is no public marketing entry to .team \u2014 access is exclusive.'),
  h2('A.2  Where it lives'),
  bullet('Route: teammagnificent.team/register'),
  bullet('Linked from the .team login page (\u201CHave an access code? Create your account.\u201D)'),
  bullet('No SEO indexing \u2014 robots: noindex, nofollow.'),
  h2('A.3  Page sections, top to bottom'),
  h3('Header strip'),
  bullet('Team Magnificent wordmark in gold, top-left.'),
  bullet('No nav. The page does only one thing.'),
  h3('Eyebrow + headline'),
  bullet('Eyebrow: \u201CTeam Magnificent \u00b7 Brand Ambassador\u201D in gold mono, uppercase, letter-spaced.'),
  bullet('Headline: \u201CCreate your account.\u201D in Bebas Neue, very large.'),
  bullet('Sub-line: \u201CYou have been personally sponsored onto Team Magnificent. Enter the access code your sponsor gave you to create your account and begin your first 72 hours.\u201D'),
  h3('The form (single column, vertical stack)'),
  bullet('Access code \u2014 single text input, monospace font, auto-uppercase, placeholder \u201CTM-XX\u201D. Validated live: as the user types, the page hits /api/auth/verify-code in real time. When the code is valid, the field shows a green check and a line below reads \u201CSponsored by: [BA full name]\u201D. When invalid, red border and \u201CCode not recognized. Check with your sponsor.\u201D'),
  bullet('First name \u2014 text input.'),
  bullet('Last name \u2014 text input.'),
  bullet('Email \u2014 email input. Validated for format. Required for login and password reset.'),
  bullet('Phone \u2014 tel input with formatting (auto-formats as the user types). Required \u2014 Michael calls this number to conduct the BA interview.'),
  bullet('THREE International username \u2014 text input. The username the BA uses to log into back-office at THREE.'),
  bullet('THREE International BA ID \u2014 text input. The numeric or alphanumeric BA ID assigned by THREE at enrollment.'),
  bullet('Password \u2014 password input, with strength indicator. Minimum 8 characters, at least one number and one letter.'),
  bullet('Confirm password \u2014 password input. Must match.'),
  bullet('Checkbox: \u201CI agree to the Team Magnificent terms and to be contacted by my sponsor and by Team Magnificent communications.\u201D'),
  bullet('Submit button: \u201CCreate my account\u201D in gold. Disabled until the access code is verified and all required fields are filled.'),
  h3('Footer'),
  bullet('Single line: \u201CAlready have an account? Sign in.\u201D'),
  bullet('Compliance line below: \u201CTeam Magnificent is an independent operational team inside THREE International.\u201D'),
  h2('A.4  What happens when the form is submitted'),
  p('On submit, the .team client posts the form payload to POST /api/auth/register. The server runs the following sequence in order. Any step that fails returns an error and aborts the rest \u2014 the BA record is not created unless every step passes.'),
  bullet('1. Validate access code exists and is currently active.'),
  bullet('2. Resolve the sponsor BA from the access code. This is the BA who owns the code; this becomes the new BA\u2019s sponsor on Team Magnificent.'),
  bullet('3. Validate email is not already in use by another BA on .team.'),
  bullet('4. Validate THREE International BA ID is not already in use by another .team account.'),
  bullet('5. Hash the password (bcrypt or argon2id).'),
  bullet('6. Generate a new internal BA ID for Team Magnificent\u2019s own records.'),
  bullet('7. Triple-stack write: insert the new BA into MongoDB (bas collection), create a (:BA) node in Neo4j with a SPONSORED relationship to the sponsor BA, write an identity blob to ChromaDB for future semantic retrieval.'),
  bullet('8. Issue a JWT and set it as an http-only cookie.'),
  bullet('9. Trigger the welcome flow \u2014 enqueue Michael to call this number, send the welcome email.'),
  bullet('10. Return success, redirect the client to /welcome.'),
  h2('A.5  Validation rules in plain language'),
  bulletBold('Sponsor immutability', 'Once the access code resolves at step 2, that sponsor is locked in the new BA\u2019s record. It cannot change later. Same principle as prospect sponsor immutability on .com, just applied to BA-to-BA.'),
  bulletBold('One-way email lookup', 'Email and THREE BA ID both must be unique per .team account.'),
  bulletBold('No silent partial records', 'If any step from 7 onward fails, the whole transaction rolls back. The new BA either fully exists or does not exist at all. No half-created accounts.'),
  bulletBold('Access code stays valid', 'After signup, the same code remains active. The next BA the same sponsor brings in uses the same code.'),
  h2('A.6  What the user sees if something goes wrong'),
  bullet('Invalid access code: red border on the code field, \u201CCode not recognized. Check with your sponsor.\u201D Submit button stays disabled.'),
  bullet('Email already in use: red border on the email field, \u201CAn account already exists with this email. Sign in instead.\u201D with a link to /login.'),
  bullet('THREE ID already in use: red border on the THREE BA ID field, \u201CThis THREE BA ID is already registered on Team Magnificent.\u201D'),
  bullet('Password too weak: red border on the password field with the specific reason.'),
  bullet('Network or server error: a banner at the top of the form, \u201CSomething went wrong. Please try again, or contact your sponsor.\u201D'),
  pageBreak(),

  h1('B.  The full app flow'), rule(),
  p('Below is the diagram of the full BA cycle. Left lane is the .team side (the BA experience). Right lane is the .com side (the prospect experience). The center column traces the access code genealogy back to TM-01. The dashed gold curve along the left edge shows that the cycle repeats \u2014 every new BA eventually starts another cycle one level down.'),
  imageFlow,
  h2('B.1  Phase 1 \u2014 Kevin controls the gate'),
  p('Kevin generates an access code from the admin dashboard \u2014 the only place codes can be created. The code is assigned to a sponsor BA. From that point forward, the code is permanently tied to that BA. Paul holds TM-07 for life. Every new BA Paul sponsors uses TM-07.'),
  h2('B.2  Phase 2 \u2014 The sponsor enrolls the new BA into THREE International (off-app)'),
  p('Sponsorship into THREE itself happens entirely outside Team Magnificent\u2019s app, using THREE\u2019s own enrollment tools. This is what makes the new BA an actual THREE BA on the company\u2019s books, in the company\u2019s genealogy, in the company\u2019s binary. After enrollment, the sponsor gives the new BA their access code by text or phone.'),
  h2('B.3  Phase 3 \u2014 The new BA signs up on .team'),
  p('The new BA goes to teammagnificent.team, follows the link to /register, and creates their .team account using the access code. The signup process (Section A above) records the sponsor binding in Team Magnificent\u2019s own data \u2014 the operational record that mirrors THREE\u2019s genealogy for our team\u2019s use. The new BA then enters the welcome flow.'),
  p('After welcome, Steve conducts Discovery and creates a non-scored Success Profile. Michael then calls as the Training Agent and Daily Success Coach \u2014 clarifies the path, answers questions, teaches Layer 1, and captures training/daily-success context for the sponsor. No BA is scored, ranked, classified, or predicted. After Michael, the new BA enters the Fast Start Guide for the first 72 hours: compensation plan training, binary placement, GLP-THREE plus other THREE products, building their initial prospect list, identifying their first two candidates. The 10-step new member orientation happens live with Kevin or Paul on Zoom, scheduled from inside .team.'),
  h2('B.4  Phase 4 \u2014 The new BA invites their first prospect'),
  p('After the orientation, the new BA opens the invitation generator inside .team. Per the rule established in the App Description Document: the BA speaks with the candidate first \u2014 SMS or scripted phone call, real human contact \u2014 then generates a personalized link from the tool. The link opens the presentation page (tm-prospect-glp3-v3-UPDATED.html), which leads with Dr. Dan\u2019s 17-minute video, followed by market opportunity, product detail, the system explainer, the 2-in-72 visualization, and testimonials. When the prospect watches the video to completion, the video_complete event fires, the server places the prospect in the team-wide holding tank with a position number, and the prospect is shown the six-section dashboard. From the dashboard\u2019s Section 6, they choose their next move: callback from their inviting BA, or seat at the next Tuesday 7pm Pacific live with Kevin and Paul.'),
  h2('B.5  The cycle completes'),
  p('When the prospect enrolls in THREE through their sponsoring BA, that BA requests their own access code from Kevin. Kevin generates the next TM-NN code from the admin dashboard, assigns it to the new BA, and Phase 1 begins again \u2014 one level down the tree. The same loop runs at every level, with every BA, forever.'),
  p('The access code chain is a record of this. TM-01 is Kevin. TM-07 is Paul (in the example diagram). Each TM-NN traces back through the chain to TM-01. Each BA who holds a code carries our operational mirror of THREE\u2019s sponsorship record. THREE International remains the final authority on the actual genealogy; the access code chain reflects it for Team Magnificent\u2019s own visibility.'),
  pageBreak(),

  h1('C.  Technical system architecture'), rule(),
  p('Below is the system architecture diagram. Three client surfaces sit at the top: the admin dashboard (Kevin only), the .team client (BA-facing), and the .com client (prospect-facing). All three call into a single application server, which writes through a single persistence gateway that fans every write to three databases simultaneously. External services (Telnyx, an email provider, YouTube\u2019s IFrame API, and THREE International itself) sit at the bottom.'),
  imageSystem,
  h2('C.1  Client surfaces'),
  p('Three separate clients, identical stack, distinct purposes.'),
  h3('Admin Dashboard \u2014 teammagnificent.team/admin'),
  bullet('Audience: Kevin only (eventually also Paul). Access-controlled at the route level \u2014 only specific BA IDs can reach the /admin tree.'),
  bullet('Generates access codes \u2014 the only place codes can be created.'),
  bullet('Views the entire team tree, both through the access-code genealogy and through THREE\u2019s data when available.'),
  bullet('Sees pending callback requests, Michael interview transcripts, the full audit log.'),
  h3('.team client \u2014 teammagnificent.team'),
  bullet('Audience: every Brand Ambassador on Team Magnificent.'),
  bullet('Public route: /register (the signup page).'),
  bullet('Authenticated routes: /welcome, /michael, /fast-start, /training, /orientation, /invitations.'),
  bullet('Login via email + password, returning a JWT in an http-only cookie.'),
  h3('.com client \u2014 teammagnificent.com'),
  bullet('Audience: prospects who clicked an invitation link.'),
  bullet('Token-gated routes: /p/{token} resolves to the presentation page; after video_complete, the dashboard for that prospect.'),
  bullet('No login. The token in the URL is the identity.'),
  h3('Stack details'),
  bullet('All three clients use the same stack: Vite + React 19 + TypeScript + Tailwind 3 + shadcn primitives.'),
  bullet('Brand tokens shared via a packages/shared workspace: gold (#C9A84C), teal (#2DD4BF), cream (#F5EFE6), on near-black (#0A0A0A).'),
  bullet('Typography: Bebas Neue for display, DM Sans for body, DM Mono for monospace.'),
  h2('C.2  Application server'),
  p('One Node + Express + TypeScript server, mounted at /api, hosts every endpoint the three clients call. It is divided into six domain modules:'),
  bulletBold('Auth', 'Access-code validation, signup, login, JWT issuance, password hashing, password reset flow.'),
  bulletBold('BA domain', 'Brand Ambassador profile, sponsor relationship (immutable after first set), THREE ID mapping, profile updates.'),
  bulletBold('Invitations', 'Invitation token mint and resolve, status tracking, /p/{token} resolution for the .com client.'),
  bulletBold('Placement', 'Holding tank logic, video_complete event handling, position assignment (monotonic, never reshuffled, team-wide pool).'),
  bulletBold('Realtime', 'Server-Sent Events stream for the dashboard\u2019s live placement section. New prospects arriving cause an event to fan out to every connected dashboard.'),
  bulletBold('Notifications', 'Callback alert SMS to BAs (via Telnyx), welcome email, webinar reservation confirmation, audit logging.'),
  h2('C.3  Persistence gateway and the triple stack'),
  p('Every write that needs to persist hits Universal Gateway V2 at localhost:2526. The gateway fans the write to MongoDB, Neo4j, and ChromaDB. This is the standard MCS V2 gateway path.'),
  h3('MongoDB \u2014 the system of record'),
  bullet('access_codes \u2014 every code Kevin has generated, who it is assigned to, when, and its current state.'),
  bullet('bas \u2014 every Brand Ambassador profile: name, email, phone, THREE username and ID, password hash, sponsor BA ID, photo, etc.'),
  bullet('invitations \u2014 every invitation token a BA has generated, status, prospect data when known.'),
  bullet('prospects \u2014 the holding tank: every prospect placed, position number, sponsor BA ID, status, timestamps.'),
  bullet('callback_requests \u2014 every callback request from the .com dashboard, the prospect data, the intent radio choice.'),
  bullet('ba_alerts \u2014 every SMS dispatch to a BA, audited.'),
  bullet('michael_interviews \u2014 every Daily Success Coach transcript and support context, linked to the BA record.'),
  h3('Neo4j \u2014 the operational genealogy graph'),
  p('Neo4j stores the relationships for Team Magnificent\u2019s own operational queries. This is what makes our team\u2019s genealogy mirror queryable in any direction \u2014 ancestors, descendants, distance to root. THREE International remains the source of truth; Neo4j gives us our own view.'),
  bullet('(:BA)-[:SPONSORED]->(:BA) \u2014 captures who sponsored whom across our team. Set at signup. If THREE\u2019s record ever differs, we update ours to match THREE.'),
  bullet('(:BA)-[:USES]->(:AccessCode) \u2014 the code each BA owns and gives to their downline.'),
  bullet('(:BA)-[:SPONSORS]->(:Prospect) \u2014 every prospect a BA invited.'),
  bullet('(:Prospect)-[:PLACED_AT]->(:Position) \u2014 the holding tank position record.'),
  bullet('Queries answer: \u201CWho is in Paul\u2019s downline?\u201D \u201CHow many generations between Kevin and BA X?\u201D \u201CWho sponsored the person who sponsored BA Y?\u201D'),
  h3('ChromaDB \u2014 semantic search'),
  p('ChromaDB stores embeddings of text content, used for fuzzy lookups and future agent retrieval. Not the system of record \u2014 a lookup layer.'),
  bullet('tm_bas \u2014 BA identity blobs (name, role, sponsor, location), searchable by free text.'),
  bullet('tm_michael_transcripts \u2014 the voice agent interviews, searchable by topic.'),
  bullet('tm_prospect_activity \u2014 prospect placement events and callback notes.'),
  bullet('tm_audit_log \u2014 system events for retrospective debugging and pattern detection.'),
  h2('C.4  External services'),
  bulletBold('Telnyx', 'SMS to BAs (callback alerts) and outbound voice (powers Michael\u2019s interview calls). Already used in the existing partial build; pattern proven.'),
  bulletBold('Email provider (TBD)', 'For welcome emails, webinar confirmations, password resets. Open between Resend, Postmark, SendGrid, or SES. Decision deferred until first email is needed.'),
  bulletBold('YouTube IFrame API', 'Hosts Dr. Dan\u2019s 17-minute video. The IFrame API\u2019s \u201Cended\u201D event is what fires video_complete on the .com client.'),
  bulletBold('THREE International', 'The final authority and single source of truth for all sponsorship, enrollment, placement, and compensation. Off-app. Sponsorship and enrollment happen there. Team Magnificent does not have an API integration with THREE \u2014 the connection is manual, BA-to-BA. The THREE BA ID captured at signup is the link. If our records ever differ from THREE\u2019s, we update ours to match.'),
  h2('C.5  How a single user action travels through the system'),
  p('Two end-to-end examples to make the architecture concrete.'),
  h3('Example 1: A new BA signs up'),
  bullet('User clicks \u201CCreate my account\u201D on /register in the .team client.'),
  bullet('Browser POSTs to /api/auth/register with the form payload.'),
  bullet('Server\u2019s Auth module validates the access code, looks up the sponsor BA, validates email and THREE BA ID uniqueness, hashes the password.'),
  bullet('Server\u2019s BA domain module creates the new BA record by calling the persistence gateway.'),
  bullet('Gateway writes to MongoDB (insert bas row), Neo4j (MERGE the new (:BA) node and the [:SPONSORED] edge from sponsor to new BA), and ChromaDB (add identity blob).'),
  bullet('Server\u2019s Notifications module enqueues Michael\u2019s outbound call and sends the welcome email.'),
  bullet('Server returns success + Set-Cookie with JWT.'),
  bullet('Client redirects to /welcome.'),
  h3('Example 2: A prospect finishes the Dr. Dan video'),
  bullet('YouTube IFrame fires the \u201Cended\u201D event in the .com client.'),
  bullet('Client POSTs to /api/placement/video-complete with the invitation token.'),
  bullet('Server\u2019s Invitations module resolves the token, looks up the sponsor BA and the prospect record (or creates it).'),
  bullet('Server\u2019s Placement module assigns the next sequential position number.'),
  bullet('Gateway writes to MongoDB (update prospect with position), Neo4j (create [:PLACED_AT] edge), ChromaDB (add prospect activity record).'),
  bullet('Server\u2019s Realtime module pushes the new placement to every connected dashboard via SSE.'),
  bullet('Server returns the position number to the prospect\u2019s client.'),
  bullet('Client transitions from presentation page to dashboard, showing position #N.'),
  bullet('Every other prospect currently viewing the dashboard sees a new card appear in their Live Placements section (with name and timestamp).'),
  pageBreak(),

  h1('D.  Access codes'), rule(),
  p('Access codes are the gate, the genealogy record, and the trust mechanism that keeps Team Magnificent exclusive. Their behavior is precise and intentional.'),
  h2('D.1  Format'),
  bullet('Pattern: TM-XX where XX is 2 to 4 alphanumeric characters.'),
  bullet('First wave: TM-01 (Kevin), TM-02, TM-03, etc. Sequential.'),
  bullet('Codes are uppercase, hyphenated. Short enough to say over the phone, write on paper, text in a single line.'),
  bullet('Codes contain no PII \u2014 they are opaque identifiers.'),
  h2('D.2  Lifecycle'),
  bulletBold('Generation', 'Kevin generates each code from the admin dashboard. No other path \u2014 not the .team client, not by API call from sponsors. Always Kevin. Always the admin dashboard.'),
  bulletBold('Assignment', 'At generation, Kevin assigns the code to a specific BA. That BA owns the code from that moment forward, for life.'),
  bulletBold('First use', 'When a new BA uses the code at signup, the code is not consumed. The system records the new BA as sponsored by the code\u2019s owning BA, and the code remains active.'),
  bulletBold('Reuse', 'The same code is used by the same BA for every new BA they ever sponsor. Paul gives TM-07 to every person he brings into Team Magnificent.'),
  bulletBold('Revocation', 'Kevin can deactivate a code from the admin dashboard if it is being misused. Already-signed-up BAs keep their sponsor binding \u2014 only future signups are blocked.'),
  h2('D.3  Genealogy \u2014 the second confirmation'),
  p('Every code traces back through the chain to TM-01. The chain is a directed path in Neo4j: KEVIN (TM-01) \u2192 PAUL (TM-07) \u2192 NEW BA \u2192 NEW BA\u2019s downline \u2014 each step recorded by the [:SPONSORED] edge created at signup.'),
  p('This becomes an independent record of who sponsored whom on Team Magnificent. THREE International keeps its own genealogy in its own systems. Team Magnificent keeps its own. If the two ever diverge \u2014 data error, dispute, ambiguity \u2014 the Team Magnificent record stands as a separate source of truth, anchored to who held the code at signup. This is what Kevin meant when he said \u201Cthis will be another confirmation of genealogy.\u201D'),
  h2('D.4  Rules the system enforces'),
  bullet('A code must exist and be active before any signup using it can complete.'),
  bullet('A code\u2019s owning BA is set at generation and cannot change.'),
  bullet('A new BA\u2019s sponsor is determined entirely by the code used at signup. The sponsor field cannot be edited later. Same principle as prospect sponsor immutability, applied to BA-to-BA.'),
  bullet('A BA may hold exactly one access code at any time.'),
  bullet('Codes are not transferable between BAs. If a BA leaves or is removed, their code is deactivated and any future BA they would have sponsored must come in through someone else\u2019s code.'),
  h2('D.5  What the admin dashboard does with codes'),
  bullet('Generate a new code, assign to a named BA, enter a note. The system shows the generated TM-XX value.'),
  bullet('View every code: code, owning BA, sponsor of owning BA (one level up the chain), status, when generated, count of BAs signed up under it.'),
  bullet('View the full genealogy tree, rooted at TM-01 (Kevin), expandable level by level.'),
  bullet('Compare any BA\u2019s genealogy in the access-code system against their reported sponsor in THREE \u2014 catches discrepancies.'),
  bullet('Deactivate a code (does not affect existing signups; only blocks new ones).'),
  pageBreak(),

  h1('E.  Open questions'), rule(),
  p('Details that need decisions before code is written. They are not assumptions. They are decisions for Kevin.'),
  h2('E.1  On access codes'),
  bullet('Exact format width: TM-XX (2 chars), TM-XXX (3 chars), or TM-XXXX (4 chars)? Kevin\u2019s example was TM-01 (2-char numeric). At scale, where the team is 100,000 BAs, codes would need to be longer than 2 chars. Confirm the chosen width.'),
  bullet('Alphabet: numeric only (0-9), alphanumeric (0-9 + A-Z), or excluding visually ambiguous characters (no 0/O, no 1/I)?'),
  bullet('How does a BA request their access code from Kevin in practice? Two options confirmed in conversation: (a) inside the .team site \u2014 a \u201CRequest my access code\u201D button surfaces in their cockpit, you see it pending in admin, you approve and the code is assigned; (b) outside the app entirely \u2014 they text/call/message you. Both/either?'),
  h2('E.2  On the signup form'),
  bullet('Does the BA enter their THREE International BA ID at signup, or can it be filled in later from the BA profile page? The system needs it eventually to confirm genealogy against THREE\u2019s records \u2014 but is requiring it at signup a friction point that should be relaxed?'),
  bullet('Email verification before account is fully active \u2014 yes or no? If yes, what is the verification email and what does it link to?'),
  bullet('Should the page show the sponsor\u2019s photo when a valid code is entered (\u201CSponsored by Paul Barrios [photo]\u201D)? Adds warmth and a check on the BA\u2019s end that they got the right code.'),
  bullet('Password requirements \u2014 the proposed minimum is 8 characters with at least one letter and one number. Is that the right bar?'),
  h2('E.3  On the admin dashboard'),
  bullet('First version of admin \u2014 what does it absolutely need on day one? Likely: a code generator (form to assign codes to BAs), a code list, a view of new signups.'),
  bullet('Who is in admin besides Kevin? Paul also? Just Kevin? Eventually a small support team?'),
  bullet('When a BA requests their access code via option (a) above, what should the approval action be \u2014 one click to approve and auto-generate? A code-entry field? Something else?'),
  h2('E.4  On the welcome and Michael flow'),
  bullet('What does the welcome screen actually say, in your words?'),
  bullet('Does Michael call immediately on signup, or after a delay (e.g. \u201CMichael will call you within the next 30 minutes\u201D so the BA can put the phone down and answer when it rings)?'),
  bullet('What is Michael\u2019s opening line, his question script, his closing? Is there an existing script document, or does this need to be written?'),
  bullet('If the new BA does not answer Michael\u2019s call, what is the fallback? A second attempt? An email? A SMS link to a written version of the same intake?'),
  h2('E.5  On the Fast Start Guide'),
  bullet('Who writes the comp plan training, the binary placement explainer, the product training, the initial-list builder? Does this content already exist somewhere (a Google Doc, a PDF, an old website)?'),
  bullet('Is the Fast Start Guide a single long page the BA scrolls through, a set of modules with checkmarks, a sequence of videos, or a mix?'),
  bullet('Does the BA need to complete each step before moving to the next, or can they move freely?'),
  h2('E.6  On infrastructure'),
  bullet('Email provider: Resend, Postmark, SendGrid, or SES? Decision deferred until first email is sent. Resend tends to be the fastest to integrate.'),
  bullet('Where does the app run in production? Local for now, eventually on a VPS or PaaS? Domain DNS already pointing somewhere?'),
  bullet('Should the existing momentum-creation-system repo be salvaged, archived, or deleted entirely as Team Magnificent moves to a fresh foundation?'),
  pageBreak(),

  h1('Sign-off'), rule(),
  p('This document captures the .team signup page design, the full BA cycle, and the technical architecture as discussed with Kevin on 2026-05-15 and 2026-05-16. It is a readback, not a build plan. Nothing in it is built until Kevin signs off.'),
  p('Kevin\u2019s options after reading this:'),
  bullet('Mark up the document with corrections, missing pieces, anything Claude got wrong.'),
  bullet('Answer the open questions in Section E, or leave them open with a note that they are unresolved.'),
  bullet('Decide whether the existing momentum-creation-system repo should be salvaged, archived, or deleted.'),
  bullet('Decide what the first piece of the app to actually build is \u2014 most likely either the signup page (Section A) or the admin dashboard\u2019s code generator (Section D.5), since one cannot work without the other.'),
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
  title: 'Team Magnificent \u2014 Signup & Architecture Document',
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
      children: [new TextRun({ text: 'Team Magnificent \u2014 Signup & Architecture Document', italics: true, color: GREY, size: 18 })],
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
  const out = path.join(__dirname, 'Team-Magnificent-Signup-Architecture.docx');
  fs.writeFileSync(out, buf);
  console.log('wrote ' + out + ' (' + buf.length + ' bytes)');
});
