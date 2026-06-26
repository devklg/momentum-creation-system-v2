import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const generatedAt = '2026-06-26';
// Documentation Compiler (ACR-001): compiles living docs into non-authoritative build artifacts.
// Source of truth stays in constitution/. This compiler must NOT write into constitution/.
// Output dir docs/reference-manuals/ is created and tracked in-repo (see its README).
const outDir = join(process.cwd(), 'docs', 'reference-manuals');
if (/constitution/i.test(outDir)) {
  throw new Error("Documentation Compiler (ACR-001) must not write into constitution/. Resolved outDir: " + outDir);
}

const sourceList = [
  'AGENTS.md',
  'docs/READ-ME-FIRST.md',
  'docs/AGENT-BRIEFING.md',
  'docs/locked-spec.md',
  'docs/build-registry.md',
  'docs/project-wireframe.md',
  'apps/admin/src/App.tsx',
  'apps/admin/src/components/admin-shell.tsx',
  'apps/admin/src/routes/dashboard.tsx',
  'apps/admin/src/routes/live-ops.tsx',
  'apps/admin/src/routes/reports.tsx',
  'apps/admin/src/routes/agents.tsx',
  'apps/admin/src/routes/vm.tsx',
  'server/src/domain/adminMetrics.ts',
  'server/src/domain/liveOps.ts',
  'server/src/domain/adminVm.ts',
  'server/src/domain/auditLog.ts',
];

const coverageTopics = [
  'Executive Briefing',
  'Mission Control',
  'Operations',
  'CRM',
  'PMV',
  'Holding Tank',
  'VM',
  'Training',
  'Events',
  'Notifications',
  'Team News',
  'AI Operations',
  'Knowledge Core',
  'Research',
  'Testing',
  'System Health',
  'Release Status',
  'Governance',
  'Architecture',
  'Constitution',
  'Analytics',
  'Widgets',
  'Cards',
  'Tabs',
  'Dashboards',
  'Metrics',
  'KPIs',
  'Alerts',
  'Executive Reports',
  'Recommendations',
  'Morning Briefing',
  'Decision Center',
  'Wireframes',
  'UI Diagrams',
  'Flowcharts',
  'State Machines',
  'Implementation Guidance',
  'Codex Prompt',
  'Claude Prompt',
  'QA Checklist',
];

const architectureCatalog = [
  ['Executive Briefing', 'The first screen opens with what Kevin needs to know now: mission pulse, active risks, decisions waiting, and recommended next actions. It does not celebrate generic metrics. It briefs the operator.'],
  ['Mission Control Doctrine', 'The existing Admin Dashboard becomes Mission Control. The system must not create a second dashboard, duplicate navigation, or split Kevin attention across parallel command centers.'],
  ['Admin Surface Renaming Rule', 'The route may stay /dashboard during implementation, but the product language changes to Mission Control. Legacy labels are technical aliases only.'],
  ['North Star', 'Mission Control exists to help Kevin see who is sharing, who needs help, what is moving, what is stuck, and what decision would create the most momentum today.'],
  ['Authority Boundary', 'Kevin remains human authority. Mission Control recommends, summarizes, alerts, audits, and routes. It does not make business judgments that belong to Kevin.'],
  ['Information Architecture', 'Mission Control becomes the top of the admin surface and links to every existing admin route as a command wing rather than a separate dashboard family.'],
  ['Command Map Diagram', 'Mission Control is the shell that connects operations, CRM, PMV, holding tank, VM, training, events, notifications, news, AI, knowledge, testing, health, releases, governance, analytics, reports, and decisions.'],
  ['Navigation Model', 'The left rail remains dense and operational. Labels should shift from back-office names to command names while preserving current routes and authorization.'],
  ['Home Grid', 'The Mission Control home grid combines executive briefing cards, live operations widgets, decision queue, alerts, and recommended actions.'],
  ['Non-Dashboard Rule', 'A dashboard displays status. Mission Control commands action. Every component must answer: what should Kevin see, decide, ask, approve, or inspect next?'],
  ['Operations Wing', 'Operations covers live activity, daily execution, event flow, broadcast status, gateway health, and operational exceptions.'],
  ['CRM Wing', 'CRM covers BA and prospect relationship memory, follow-up reminders, notes, tags, sponsor context, and respectful next steps.'],
  ['PMV Wing', 'PMV frames the business engine as People -> Momentum -> Volume -> Checks. Prospect-facing surfaces never show checks, CV math, or income claims. Mission Control can inspect PMV internally.'],
  ['Holding Tank Wing', 'Holding Tank command observes position movement, aging, flush windows, queue integrity, placement events, and intervention history without reshuffling monotonic positions.'],
  ['VM Wing', 'VM command observes video message campaigns, import batches, ownership, notification hooks, provider queues, failures, and admin correction requests.'],
  ['Training Wing', 'Training command shows Fast Start, orientation, Michael support, Steve discovery, completion, friction, and readiness for action.'],
  ['Events Wing', 'Events command shows webinars, orientation sessions, rosters, reservations, capacity, upcoming sessions, host assignments, and follow-up signals.'],
  ['Notifications Wing', 'Notifications command governs operational alerts, SMS, email, in-app notices, opt-outs, STOP rules, dormant providers, and failed sends.'],
  ['Team News Wing', 'Team News turns verified milestones into internal news candidates. It never invents results and never promotes claims that compliance would block.'],
  ['AI Operations Wing', 'AI Operations shows agent status, prompt versions, memory writes, handoffs, recommendation records, and escalation queues.'],
  ['Knowledge Core Wing', 'Knowledge Core exposes source authority, memory freshness, decision lineage, Chroma semantic recall, Neo4j relationships, Mongo operational truth, and schema enforcement.'],
  ['Research Wing', 'Research command manages source packages, product claim audits, market fact refresh, uncertainty flags, and citation readiness.'],
  ['Testing Wing', 'Testing command holds manual flow checks, typecheck status, smoke runs, visual QA, regression risks, and release gates.'],
  ['System Health Wing', 'System Health shows gateway, Mongo, Neo4j, Chroma, Surreal, Telnyx, Resend, Anthropic, SSE, background workers, and port status.'],
  ['Release Status Wing', 'Release Status tracks branches, commits, PRs, deployments, version notes, known gaps, rollback posture, and build readiness.'],
  ['Governance Wing', 'Governance holds decisions, constitutional rules, compliance severity, data boundaries, admin overrides, and source hierarchy.'],
  ['Architecture Wing', 'Architecture maps domains, routes, shared contracts, state machines, event streams, and persistence paths.'],
  ['Constitution Wing', 'Constitution turns Kevin rules into durable operating law. It does not override locked spec or the decision ledger.'],
  ['Analytics Wing', 'Analytics converts operational events into answerable questions: share velocity, activation, presentation completion, callback, enrollment, and follow-up aging.'],
  ['Widget System', 'Widgets are small command instruments with a source, freshness, action, confidence, and drilldown path.'],
  ['Card System', 'Cards summarize one operational truth and one next action. They should never become decorative status tiles.'],
  ['Tab System', 'Tabs divide mental modes inside a wing: overview, queue, exceptions, history, recommendations, and reports.'],
  ['Dashboard Legacy Handling', 'The word Dashboard may remain in file names where useful. The product concept is Mission Control, and new copy should say Mission Control.'],
  ['Metric Contract', 'Every metric must declare owner, numerator, denominator, time window, source collection, refresh mode, and whether it is leading or lagging.'],
  ['KPI Contract', 'KPIs are promoted metrics that Kevin uses to steer action. Leading KPIs outrank vanity numbers. Invitations sent per day remains the primary BA action metric.'],
  ['Alert Contract', 'Alerts must say what happened, why it matters, who owns it, how urgent it is, and what action is permitted. Alerts do not imply income, placement promises, or automated outreach.'],
  ['Executive Reports', 'Reports must be printable, source-hashed where appropriate, and written in decision language rather than dashboard language.'],
  ['Recommendations', 'Recommendations are evidence-backed proposals. They carry confidence, evidence, risk, reversible path, and required human approval.'],
  ['Morning Briefing', 'Morning Briefing is the daily executive package: overnight movement, today priorities, people needing support, live events, risks, and decisions.'],
  ['Decision Center', 'Decision Center is the queue where Mission Control asks Kevin for decisions with context, options, evidence, recommendation, and consequence.'],
  ['Wireframe Overview', 'Mission Control uses a command header, left rail, briefing lane, action lane, live lane, and drilldown drawers.'],
  ['UI Diagram', 'The layout should remain dense, adult, operational, and quiet. It should not use marketing hero structure inside admin.'],
  ['Flowchart Overview', 'Flows begin with an observed event, pass through classification and compliance checks, then surface as briefings, alerts, or recommendations.'],
  ['State Machine Overview', 'State machines govern tokens, placements, alerts, recommendations, releases, tests, reports, broadcasts, and agent messages.'],
  ['Implementation Guidance', 'Implementation should reuse existing admin routes and components. Add a Mission Control layer by composition before inventing new data models.'],
  ['Codex Prompt', 'Codex should inspect existing routes, preserve dirty worktree changes, rename and compose cautiously, run typecheck where feasible, and avoid broad refactors.'],
  ['Claude Prompt', 'Claude should use memory, decision ledger, locked spec, and Kevin context to preserve continuity, then produce executive synthesis without inventing facts.'],
  ['QA Checklist', 'QA verifies route preservation, admin gate, data freshness, no duplicate dashboard, compliance language, alert actions, mobile overflow, and report integrity.'],
  ['Executive Header Wireframe', 'Header contains mission date, system pulse, critical alert count, decision count, and one primary recommended action.'],
  ['Briefing Lane Wireframe', 'Briefing lane stacks Morning Briefing, Mission Pulse, People Needing Support, and Release Status.'],
  ['Action Lane Wireframe', 'Action lane stacks Decision Center, Recommendations, Alerts, and Approvals.'],
  ['Live Lane Wireframe', 'Live lane stacks Live Operations, Holding Tank, Events, Notifications, and System Health.'],
  ['Drilldown Drawer Pattern', 'Every high-level card opens a drawer before a full route jump. Drawers preserve context and prevent page churn.'],
  ['Mission Pulse Card', 'Mission Pulse shows share velocity, active BAs, prospects in flow, video completions, callbacks, enrollments, and training movement.'],
  ['Share Velocity Card', 'Share velocity is the operating heartbeat. It answers whether the team is doing the primary action today.'],
  ['People Needing Support Card', 'This card merges CRM, training, Michael, Steve, and follow-up signals to identify who needs human support.'],
  ['Risk Register Card', 'Risks include stale prospects, aging holding tank, failed sends, dormant providers, open decisions, release blockers, and memory drift.'],
  ['Opportunity Card', 'Opportunity surfaces momentum pockets: a BA sharing consistently, an event filling, a VM batch converting, or a product angle producing response.'],
  ['Decision Card', 'A decision card has context, evidence, recommended answer, defer consequence, and owner. It never presents six unfocused choices.'],
  ['Recommendation Card', 'A recommendation card includes why now, expected impact, reversible path, compliance check, and next step.'],
  ['Alert Card', 'An alert card is operational, not theatrical. It names severity, action, owner, and deadline if the deadline comes from real policy.'],
  ['KPI Strip', 'The KPI strip is compact: invitations today, video completions today, callbacks open, new BAs, training progress, system health.'],
  ['Executive Report Index', 'Mission Control links master report, BA activation, invite funnel, queue velocity, training completion, follow-up aging, and leader scorecards.'],
  ['Report Builder Boundary', 'Report building may filter and export. It must not expose raw PII without the existing redaction modal every export.'],
  ['PMV Analytics', 'PMV analytics is internal only. People are BAs and prospects. Momentum is sharing and video completion. Volume is mirrored from THREE when available. Checks are never prospect-facing.'],
  ['CRM Analytics', 'CRM analytics covers due follow-ups, stale notes, tag distribution, open callbacks, re-invite scripts, and conversion by relationship source.'],
  ['Holding Tank Analytics', 'Holding Tank analytics covers age buckets, flush candidates, movement, ticker window, vacant positions, and intervention history.'],
  ['Training Analytics', 'Training analytics covers modules started, modules completed, first invite after training, orientation seats, Michael support, and Steve profile completion.'],
  ['VM Analytics', 'VM analytics covers batches imported, send readiness, provider queue state, failed hooks, ownership conflicts, and admin correction requests.'],
  ['AI Operations Analytics', 'AI analytics covers prompt versions, agent outputs, memory writes, failed tool calls, blocked recommendations, and escalated uncertainties.'],
  ['Knowledge Core Analytics', 'Knowledge analytics covers stale source records, schema failures, unlinked decisions, Chroma gaps, Neo4j relationship drift, and unreconciled handoffs.'],
  ['Research Analytics', 'Research analytics covers source age, claim verification, product fact status, policy source status, and open uncertainty.'],
  ['Testing Analytics', 'Testing analytics covers green/red checks, smoke runs, manual verifications, visual QA, regression clusters, and release readiness.'],
  ['System Health Analytics', 'Health analytics covers latency, error rates, gateway stores, providers, stream subscribers, worker queues, and collection guards.'],
  ['Release Analytics', 'Release analytics covers branch status, merged changes, pending migrations, open defects, and deploy notes.'],
  ['Governance Analytics', 'Governance analytics covers overrides, policy blocks, export events, admin mutations, decisions, and constitutional amendments.'],
  ['Architecture Analytics', 'Architecture analytics covers route coverage, shared contract drift, duplicated logic, state machine gaps, and unowned domains.'],
  ['Mission Control Data Flow', 'Events land in operational stores, are projected into domain summaries, flow into cards and reports, and generate recommendations or alerts when rules match.'],
  ['Triple Stack Flow', 'Persistent writes must preserve Mongo operational truth, Neo4j relationship truth, and Chroma semantic recall through the governed gateway path.'],
  ['SSE Flow', 'Live streams feed prospect dashboards, queue mirrors, live operations, and Mission Control health without turning every card into a polling loop.'],
  ['Audit Flow', 'Every admin mutation, export, override, broadcast, and critical recommendation writes audit evidence with actor, entity, before, after, route, and severity.'],
  ['Notification Flow', 'Notifications move from event to channel eligibility to compliance guard to provider to delivery status to audit.'],
  ['Recommendation Flow', 'Recommendations move from signal to evidence package to risk check to human decision to action or dismissal.'],
  ['Decision Flow', 'Decisions move from open question to framed choice to Kevin answer to decision ledger to implementation task.'],
  ['Report Flow', 'Reports move from domain query to scoped filter to PDF or CSV rendering to audit record to executive archive.'],
  ['Release Flow', 'Release status moves from branch diff to typecheck to QA to known risks to commit or PR state to deployment readiness.'],
  ['Incident Flow', 'Incidents move from health signal to severity to containment action to owner to after-action note to constitutional lesson if needed.'],
  ['Token State Machine', 'Mission Control observes minted, clicked, video_started, video milestones, video_complete, callback, webinar, enrolled, and expired without mutating sponsor identity.'],
  ['Placement State Machine', 'Placement begins at video_complete, receives monotonic position, can enroll or expire, and never renumbers after flush.'],
  ['Alert State Machine', 'Alerts move from new to acknowledged to assigned to actioned to closed or stale, with critical alerts requiring explicit disposition.'],
  ['Recommendation State Machine', 'Recommendations move from drafted to reviewed to accepted, rejected, deferred, actioned, or archived.'],
  ['Decision State Machine', 'Decisions move from proposed to pending Kevin to active, superseded, declined, or needs reconciliation.'],
  ['Release State Machine', 'Releases move from scoped to implemented to verified to ready to merge to merged to deployed to observed.'],
  ['Report State Machine', 'Reports move from requested to generated to verified to delivered to archived, with PII choice recorded per export.'],
  ['Agent Message State Machine', 'Agent messages move from unread to read to actioned or stale, with replies as new messages rather than parent mutation.'],
  ['Mission Control API Map', 'API map preserves existing /api/admin/dashboard, /bas, /prospects, /queue, /live-ops, /reporting, /tenant, /broadcast, /vm, and /agents routes.'],
  ['Mission Control Component Map', 'Component map reuses MetricsRow, FilterBar, LiveEventStream, live-ops widgets, report export panels, and oversight drawers.'],
  ['Mission Control Schema Map', 'Schema map connects operational collections, audit collections, report projections, master content, VM entities, and agent memory records.'],
  ['Mission Control Permissions', 'Permissions remain server-side. ADMIN_BA_IDS and requireAdmin are the hard gate. UI affordances are not authorization.'],
  ['Mission Control Compliance', 'Compliance blocks prospect-facing risk, AI prospecting, automated outreach, income claims, placement promises, and unsupported product claims.'],
  ['Mission Control Privacy', 'Privacy preserves PII redaction, audit visibility, sponsor immutability, BA-private Ivory names, and role-appropriate access.'],
  ['Mission Control Accessibility', 'Dense admin UI still needs readable type, strong contrast, keyboard reachability, focus states, and non-overlapping text.'],
  ['Mission Control Mobile Posture', 'Mission Control is primarily desktop, but emergency mobile review must preserve card readability and critical action access.'],
  ['Mission Control Visual System', 'Use ink, gold, teal, cream, quiet lines, compact rows, and purposeful icon buttons. Avoid decorative marketing treatment.'],
  ['Mission Control Empty States', 'Empty states should tell Kevin whether nothing happened, data is loading, a provider is dormant, or the filter is too narrow.'],
  ['Mission Control Loading States', 'Loading states should preserve layout dimensions so the command surface does not jump while live data arrives.'],
  ['Mission Control Error States', 'Error states should name the failed source and offer a safe retry or investigation path without hiding partial truth.'],
  ['Mission Control Freshness States', 'Every major card needs last refreshed time, stream status, or data currency indicator.'],
  ['Mission Control Search', 'Search spans BAs, prospects, tokens, audit entries, decisions, reports, VM batches, and knowledge references with scoped permissions.'],
  ['Mission Control Command Palette', 'Command palette gives Kevin quick access to report generation, BA lookup, prospect lookup, event creation, broadcast draft, and knowledge search.'],
  ['Mission Control Morning Mode', 'Morning Mode compresses the whole system into the day-start brief and what needs action before anything else.'],
  ['Mission Control Evening Mode', 'Evening Mode summarizes what moved, what did not, what remains open, and what tomorrow should watch.'],
  ['Mission Control Review Mode', 'Review Mode supports weekly analysis, report printouts, release review, training progress, and leader support planning.'],
  ['Mission Control Incident Mode', 'Incident Mode suppresses decorative panels and foregrounds health, errors, owner, mitigation, and communication.'],
  ['Mission Control Research Mode', 'Research Mode turns source updates into claim reviews and content amendment proposals.'],
  ['Mission Control AI Mode', 'AI Mode shows agent work, prompts, memory status, recommendations, and handoff state without hiding uncertainty.'],
  ['Mission Control Knowledge Mode', 'Knowledge Mode lets Kevin inspect what the system believes, where it came from, and whether it is current.'],
  ['Mission Control Release Mode', 'Release Mode supports build readiness, QA evidence, pending docs, migration notes, and rollback posture.'],
  ['Mission Control Constitution Mode', 'Constitution Mode shows durable rules, amendments, open conflicts, and source hierarchy decisions.'],
  ['Mission Control Build Sequence', 'First rename and compose existing admin dashboard. Second add executive briefing data. Third add decision center. Fourth deepen knowledge and recommendation loops.'],
  ['Mission Control Migration Plan', 'Migration should not delete existing surfaces. It should reframe them under one command center, then gradually promote high-value cards.'],
  ['Mission Control Acceptance Criteria', 'Acceptance requires no duplicate dashboard, all admin routes reachable, briefing useful, alerts actionable, reports linked, and compliance preserved.'],
  ['Mission Control QA Matrix', 'QA covers auth, routing, card data, drilldowns, stream behavior, report exports, PII redaction, provider dormant states, and audit logging.'],
  ['Mission Control Launch Checklist', 'Launch checklist verifies copy, routes, data sources, visual density, responsiveness, error states, morning brief, decision center, and final Kevin review.'],
  ['Mission Control Future Expansion', 'Future expansion may add command palette, saved briefings, executive report archive, research watch, and AI recommendation scoring with human approval.'],
  ['Mission Control Constitutional Lock', 'The constitutional lock is simple: this is Kevin Gardner Mission Control. Existing Admin Dashboard becomes Mission Control. Do not build another dashboard.'],
];

const executiveCatalog = [
  ['Executive System Preamble', 'The Momentum Executive System is the daily operating system Kevin uses to command Mission Control without drowning in panels. It converts data into rhythm, rhythm into decisions, and decisions into motion.'],
  ['Executive Briefing Doctrine', 'A briefing is not a report dump. It is an edited executive readout: what changed, why it matters, what decision is needed, and what action is recommended.'],
  ['Daily Operating Rhythm', 'The system runs morning briefing, midday pulse, evening closeout, weekly review, release review, and incident review as repeatable operating loops.'],
  ['Morning Briefing Canon', 'Morning Briefing contains overnight movement, today events, top risks, people needing support, AI recommendations, release status, and the decision queue.'],
  ['Midday Pulse', 'Midday Pulse focuses on whether the primary action is happening: invitations sent, videos completed, callbacks raised, and BAs needing support.'],
  ['Evening Closeout', 'Evening Closeout captures what moved, what stalled, which alerts remain open, which decisions were made, and what tomorrow should open with.'],
  ['Weekly Executive Review', 'Weekly Review compares share velocity, BA activation, training movement, holding-tank flow, event performance, release movement, and recommendations actioned.'],
  ['Decision Center Canon', 'Decision Center exists to reduce re-explaining. It packages the facts, the options, the recommended answer, and the consequence of delay.'],
  ['Decision Record Shape', 'Every decision record has topic, status, source, context, alternatives, Kevin answer, active rule, superseded rules, and implementation impact.'],
  ['Recommendation Doctrine', 'Recommendations assist Kevin. They do not command Kevin. Every recommendation must show evidence, uncertainty, risk, and reversible action.'],
  ['Executive Reports Doctrine', 'Executive reports serve leadership judgment. They should print cleanly, source themselves, and state what is known without filling gaps.'],
  ['Mission Control Relationship', 'Mission Control is the command surface. The Executive System is the operating cadence that tells Mission Control what to surface and when.'],
  ['Operations Rhythm', 'Operations rhythm watches live activity, gateway health, provider state, broadcasts, events, and daily execution.'],
  ['CRM Rhythm', 'CRM rhythm watches who needs follow-up, who needs sponsor support, which relationships are moving, and which records are stale.'],
  ['PMV Rhythm', 'PMV rhythm observes People -> Momentum -> Volume -> Checks internally while protecting prospect-facing compliance boundaries.'],
  ['Holding Tank Rhythm', 'Holding Tank rhythm watches age, movement, flush candidates, placement integrity, and intervention history.'],
  ['VM Rhythm', 'VM rhythm watches campaigns, imports, ownership, queues, failed notifications, and correction requests.'],
  ['Training Rhythm', 'Training rhythm watches Fast Start, orientation, Steve discovery, Michael support, first invitation, and first duplication signals.'],
  ['Events Rhythm', 'Events rhythm watches upcoming webinars, orientation sessions, rosters, capacity, no-shows, and follow-up after attendance.'],
  ['Notifications Rhythm', 'Notifications rhythm watches failed sends, STOP exclusions, dormant email, live SMS, unread alerts, and provider queues.'],
  ['Team News Rhythm', 'Team News rhythm watches verified milestones that may deserve internal celebration or leadership attention.'],
  ['AI Operations Rhythm', 'AI Operations rhythm watches agent outputs, memory writes, prompt changes, tool failures, and escalations.'],
  ['Knowledge Core Rhythm', 'Knowledge Core rhythm watches stale sources, schema enforcement, unlinked records, and cross-store drift.'],
  ['Research Rhythm', 'Research rhythm watches product claims, policy changes, market facts, and source age.'],
  ['Testing Rhythm', 'Testing rhythm watches typecheck, smoke tests, QA checklists, manual flows, visual verification, and release gates.'],
  ['System Health Rhythm', 'System Health rhythm watches ports, providers, queues, latency, streams, stores, and background workers.'],
  ['Release Status Rhythm', 'Release Status rhythm watches branches, commits, pending files, build status, deploy notes, and rollback readiness.'],
  ['Governance Rhythm', 'Governance rhythm watches decisions, overrides, compliance events, constitutional amendments, and source conflicts.'],
  ['Architecture Rhythm', 'Architecture rhythm watches domains, contracts, state machines, routes, duplicated logic, and unresolved drift.'],
  ['Constitution Rhythm', 'Constitution rhythm watches whether operating rules are being followed and whether new rules need to be written.'],
  ['Analytics Rhythm', 'Analytics rhythm separates leading signals from lagging proof and keeps Kevin focused on action-producing data.'],
  ['Widget Governance', 'Widgets must have purpose, source, freshness, action, and owner. A widget without a decision or action path is noise.'],
  ['Card Governance', 'Cards must summarize one truth. If a card needs six unrelated metrics, it is a section, not a card.'],
  ['Tab Governance', 'Tabs are for mode changes, not hiding unrelated tools. Tabs should reflect how Kevin thinks during command.'],
  ['Dashboard Governance', 'The old dashboard becomes one Mission Control mode. The word dashboard should not create a second product idea.'],
  ['Metrics Governance', 'Metrics must be named, sourced, scoped, time-boxed, and interpreted. Ambiguous counts do not belong in executive briefings.'],
  ['KPI Governance', 'KPIs are few. The leading KPI is invitation activity because the system exists to help BAs share.'],
  ['Alert Governance', 'Alerts must be actionable and classified. Critical means Kevin must know or the system may harm trust, data, compliance, or momentum.'],
  ['Report Governance', 'Reports are evidence packages. They must avoid narrative inflation and preserve redaction, source hash, and filter scope.'],
  ['Morning Briefing Flowchart', 'Morning Briefing pulls from operations, CRM, PMV, holding tank, training, events, health, releases, AI, and decisions, then edits down to the executive readout.'],
  ['Decision Flowchart', 'Decision flow begins with an open question or conflict, gathers evidence, produces a recommendation, records Kevin answer, and updates implementation work.'],
  ['Recommendation Flowchart', 'Recommendation flow begins with signal detection, moves through evidence and risk checks, then enters Decision Center or direct action if already authorized.'],
  ['Executive Report Flowchart', 'Report flow begins with a question, resolves scope, queries domain data, renders PDF or CSV, audits export, and archives result.'],
  ['Incident Flowchart', 'Incident flow begins with health or user signal, classifies severity, assigns owner, communicates impact, fixes, verifies, and records lesson.'],
  ['Release Flowchart', 'Release flow begins with scoped change, passes implementation, verification, docs, commit, merge readiness, deploy, and observation.'],
  ['Governance Flowchart', 'Governance flow begins with rule conflict, source hierarchy check, Kevin decision, constitutional amendment, and task update.'],
  ['Knowledge Flowchart', 'Knowledge flow begins with source intake, authority classification, schema write, relationship edges, retrieval, and freshness review.'],
  ['Morning Briefing State Machine', 'Morning Briefing moves from collecting to drafting to reviewed to delivered to actioned to archived.'],
  ['Decision State Machine', 'Decision records move from proposed to pending to active, declined, superseded, or needs reconciliation.'],
  ['Recommendation State Machine', 'Recommendations move from generated to evidence-checked to presented to accepted, rejected, deferred, or actioned.'],
  ['Alert State Machine', 'Alerts move from detected to acknowledged to assigned to mitigated to closed, escalated, or stale.'],
  ['Report State Machine', 'Reports move from requested to generated to verified to delivered to archived.'],
  ['Release State Machine', 'Releases move from planning to implementation to verification to ready to merge to deployed to monitored.'],
  ['Testing State Machine', 'Tests move from planned to running to pass, fail, blocked, or waived with reason.'],
  ['Knowledge State Machine', 'Knowledge items move from candidate to sourced to stored to linked to active, stale, superseded, or rejected.'],
  ['AI Agent State Machine', 'Agent tasks move from assigned to in progress to tool verified to recommendation to escalation or complete.'],
  ['Executive Briefing Wireframe', 'Briefing page uses a top summary, three critical cards, decision queue, people support lane, operations pulse, and release strip.'],
  ['Morning Briefing Wireframe', 'Morning page orders information by urgency: overnight exceptions, today schedule, people, growth, systems, decisions, recommendations.'],
  ['Decision Center Wireframe', 'Decision Center uses one decision per row with status, topic, evidence count, recommended answer, impact, and due context.'],
  ['Reports Wireframe', 'Reports page groups standard reports, master report, exports, redaction choice, and archive.'],
  ['Recommendations Wireframe', 'Recommendations page groups by action type: support a BA, inspect a prospect, run a report, fix a system, make a decision.'],
  ['Alerts Wireframe', 'Alerts page groups critical, high, medium, and info with owner, action, entity, and age.'],
  ['People Support Wireframe', 'People support combines CRM, training, follow-up, Michael, Steve, and sponsor context.'],
  ['Operations Wireframe', 'Operations combines live usage, event stream, queue movement, provider status, and broadcast status.'],
  ['Knowledge Wireframe', 'Knowledge combines source hierarchy, memory health, decision lineage, and search.'],
  ['Research Wireframe', 'Research combines claim registry, source age, open uncertainty, and approved source packages.'],
  ['Testing Wireframe', 'Testing combines current checks, manual QA, failed flows, release gates, and regression inventory.'],
  ['System Health Wireframe', 'Health combines gateway, stores, providers, streams, queues, workers, and port registry.'],
  ['Release Status Wireframe', 'Release combines branch, diff, typecheck, QA, docs, migration, risks, and ready flag.'],
  ['Governance Wireframe', 'Governance combines rules, decisions, overrides, compliance events, amendments, and source conflicts.'],
  ['Constitution Wireframe', 'Constitution combines constitutional docs, amendments, rule lookup, and enforcement notes.'],
  ['Analytics Wireframe', 'Analytics combines KPI strips, trend cards, report links, and action notes.'],
  ['Executive Metrics Library', 'Metrics library defines invitation velocity, video completion, callback response, BA activation, training completion, queue movement, and system health.'],
  ['Executive KPI Library', 'KPI library promotes invitation velocity, first invite completion, follow-up aging, video completion, active sharers, and release readiness.'],
  ['Executive Alert Library', 'Alert library includes critical provider failure, missing Chroma collection, failed audit write, stale follow-up, aged placement, failed broadcast, and unresolved decision.'],
  ['Executive Report Library', 'Report library includes master report, BA activation, training completion, invite funnel, queue velocity, enrollment completion, follow-up aging, and leader scorecards.'],
  ['Executive Recommendation Library', 'Recommendation library includes support actions, content updates, training nudges, report requests, release holds, and data cleanup.'],
  ['People Support Reports', 'People support reports show BA activation, sponsor support needs, CRM aging, first invite progress, and training support.'],
  ['Momentum Reports', 'Momentum reports show invitations, video completions, callbacks, webinar reservations, orientation seats, and position movement.'],
  ['Volume Reports', 'Volume reports should mirror THREE-authoritative data when available and label any internal proxy clearly.'],
  ['Checks Reports Boundary', 'Checks remain internal and regulated. They never appear on prospect-facing pages and require careful context in BA-facing training.'],
  ['Compliance Reports', 'Compliance reports show blocked content, warnings, render-time guard activity, export redactions, and policy exceptions.'],
  ['AI Reports', 'AI reports show agent outputs, memory writes, prompt versions, failed tools, escalations, and recommendation outcomes.'],
  ['Research Reports', 'Research reports show claim status, source dates, uncertainty, and needed refreshes.'],
  ['Testing Reports', 'Testing reports show recent checks, failure history, affected surfaces, and release gate status.'],
  ['Health Reports', 'Health reports show service status, latency, error rates, streams, queues, and data-store integrity.'],
  ['Release Reports', 'Release reports show what changed, verification, known risk, docs changed, and next release candidates.'],
  ['Governance Reports', 'Governance reports show decisions made, decisions open, overrides, amendments, and source conflicts.'],
  ['Executive Report Tone', 'Tone is direct, plain, and source-grounded. No filler, no fake certainty, no invented narrative glue.'],
  ['Executive Report Print Standard', 'Reports must print with readable type, date, filter, source hash when possible, and redaction status.'],
  ['Executive Report Archive', 'Archive reports by date, scope, filters, and requester. Reports become evidence, not living truth.'],
  ['Executive Recommendations Ethics', 'Recommendations may guide effort but must not rank human worth, qualify prospects with AI, automate prospecting, or pressure relationships.'],
  ['AI Operations Guardrail', 'Agents assist with drafts, summaries, research, QA, and memory. They do not cold prospect, auto-call prospects, or make hidden business policy.'],
  ['Knowledge Core Guardrail', 'Knowledge Core distinguishes operational truth, semantic memory, graph relationships, source documents, and executive interpretation.'],
  ['Research Guardrail', 'Research must label source date, claim scope, uncertainty, and whether a claim is allowed on .com, .team, or admin only.'],
  ['Testing Guardrail', 'Testing may block release when critical behavior is unverified. Waivers require explicit reason and owner.'],
  ['System Health Guardrail', 'Health cards must not hide partial failure. If Chroma fails while Mongo succeeds, the system must say so.'],
  ['Release Guardrail', 'Release status must preserve dirty worktree awareness and never revert user changes outside the task.'],
  ['Governance Guardrail', 'Governance never lets convenience outrank source hierarchy, sponsor immutability, or compliance boundaries.'],
  ['Architecture Guardrail', 'Architecture prefers existing routes, shared contracts, and domain helpers before inventing new surfaces.'],
  ['Constitution Guardrail', 'Constitutional documents guide implementation but do not silently override locked spec or active ledger decisions.'],
  ['Analytics Guardrail', 'Analytics must separate observed facts from inferred meaning. Inference must be labeled.'],
  ['Widget QA Checklist', 'Verify source, loading, empty, error, freshness, drilldown, permissions, mobile, and action path.'],
  ['Card QA Checklist', 'Verify one truth per card, no overlap, no hidden mutation, and no unsourced claim.'],
  ['Tab QA Checklist', 'Verify tabs preserve state, deep links, keyboard navigation, and do not hide critical alerts.'],
  ['Dashboard QA Checklist', 'Verify the old dashboard is now Mission Control and no duplicate dashboard has been created.'],
  ['Metric QA Checklist', 'Verify numerator, denominator, filter scope, time window, source, and interpretation.'],
  ['KPI QA Checklist', 'Verify KPI status is intentional, leading or lagging is declared, and action path exists.'],
  ['Alert QA Checklist', 'Verify severity, owner, action, audit trail, close path, and no alert fatigue.'],
  ['Report QA Checklist', 'Verify filters, redaction, source hash, print layout, export audit, and empty data behavior.'],
  ['Recommendation QA Checklist', 'Verify evidence, confidence, risk, allowed action, human approval, and dismissal path.'],
  ['Morning Briefing QA Checklist', 'Verify it can be read fast, includes what changed, and produces clear next actions.'],
  ['Decision Center QA Checklist', 'Verify each decision has context, options, recommendation, consequence, and ledger write path.'],
  ['Wireframe QA Checklist', 'Verify density, hierarchy, text fit, non-overlap, and admin posture.'],
  ['UI Diagram QA Checklist', 'Verify diagrams match current routes and do not invent unreachable pages.'],
  ['Flowchart QA Checklist', 'Verify flow starts with real event and ends with action, audit, or archive.'],
  ['State Machine QA Checklist', 'Verify all terminal states, retries, stale states, and audit transitions.'],
  ['Implementation Guidance Checklist', 'Reuse existing admin routes, preserve auth, avoid broad refactors, and update docs only within scope.'],
  ['Codex Prompt Canon', 'Codex must read the repo, preserve user changes, implement narrowly, verify with commands, and report what changed.'],
  ['Claude Prompt Canon', 'Claude must use shared memory, obey source hierarchy, synthesize without fabrication, and create executive clarity.'],
  ['Executive System Acceptance', 'The system is accepted when Kevin can open Mission Control and know what matters, what needs a decision, what moved, what broke, and what to do next.'],
  ['Executive System Constitutional Lock', 'The final lock: this is Kevin Gardner Mission Control. The existing Admin Dashboard becomes Mission Control. Do not create another dashboard.'],
];

function pageNumber(n) {
  return String(n).padStart(3, '0');
}

function sourceBasis(title, pageTitle) {
  return [
    `# ${title}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    '<!-- PAGE 001 -->',
    `# Page 1 - ${pageTitle}`,
    '',
    `This handbook is grounded in the governing source set read on ${generatedAt}.`,
    '',
    ...sourceList.map((source) => `- ${source}`),
    '',
    'The governing precedence is: decision ledger, locked spec, design documents, build registry, git log, Gateway chat registry, then handoffs. This handbook does not override those sources. It translates them into the Mission Control operating architecture Kevin requested.',
    '',
    'The core command is explicit: do not create another dashboard. The existing Admin Dashboard becomes Mission Control.',
    '',
    'Mission Control operating principles:',
    '',
    ...missionControlPrinciples.map((principle) => `- ${principle}`),
    '',
    'Actual admin surfaces that become Mission Control wings:',
    '',
    linesForTable(actualAdminSurfaceMap.map(([name, route, file, detail]) => [name, `${route} / ${file}`, detail])),
    '',
    'Actual data contracts used by the second pass:',
    '',
    linesForTable(actualDataContracts.map(([name, file, detail]) => [name, file, detail])),
    '',
    'Coverage requirements included in this book:',
    '',
    ...coverageTopics.map((topic) => `- ${topic}`),
    '',
    '---',
    '',
  ].join('\n');
}

const actualAdminSurfaceMap = [
  ['Mission Control Home', '/dashboard', 'apps/admin/src/routes/dashboard.tsx', 'Composes FilterBar, MetricsRow, DrilldownPanel, and LiveEventStream. This is the current Core Dashboard and becomes the Mission Control home.'],
  ['BA Oversight', '/bas', 'apps/admin/src/routes/bas.tsx', 'BA directory, profile drawer, sponsor override flow, leader tag, notes, create/edit/delete/restore.'],
  ['Prospect Oversight', '/prospects', 'apps/admin/src/routes/prospects.tsx', 'Cross-team prospect directory, detail panel, sandbox preview, notes, interventions, create/edit/delete/restore.'],
  ['Queue Oversight', '/queue', 'apps/admin/src/routes/queue.tsx', 'Queue depth, queue numbers, visible ticker window, queue rules, admin ticker mirror.'],
  ['Live Operations', '/live-ops', 'apps/admin/src/routes/live-ops.tsx', 'UsageStrip, GrowthCards, HoldingTankGrid, ConversionFunnel; current file has USE_MOCKS=true and should be flipped only when server endpoints are proven live.'],
  ['Reports', '/reports', 'apps/admin/src/routes/reports.tsx', 'ExportPanel for standard-report CSV exports with per-export PII redaction; Master Report PDF exists server-side.'],
  ['Audit Log', '/audit', 'apps/admin/src/routes/audit.tsx', 'Append-only audit view over mcs_audit_log. Audit entries are written by every admin mutation and important read.'],
  ['Tenant Architecture', '/tenant', 'apps/admin/src/routes/tenant.tsx', 'Master settings, permission matrix, master-content editor, compliance validation, inheritance controls.'],
  ['Broadcast', '/broadcast', 'apps/admin/src/routes/broadcast.tsx', 'Kevin-only broadcast composer, audience selector, channel selector, send-test-to-Kevin, queue status.'],
  ['Orientation', '/orientation', 'apps/admin/src/routes/orientation.tsx', 'Founder/admin roster and session creation for group orientation seats.'],
  ['VM Campaigns', '/vm', 'apps/admin/src/routes/vm.tsx', 'VM campaign oversight: cards, BA analytics, lead batches, campaigns, provider health, hooks, audited ownership-correction intake.'],
  ['Agent Oversight', '/agents', 'apps/admin/src/routes/agents.tsx', 'Success Profiles, agent interaction summary, memory health, and GraphRAG bridge drafts.'],
];

const actualDataContracts = [
  ['Core metrics', 'server/src/domain/adminMetrics.ts', 'Reads brand_ambassadors, pool_placements, and fast_start_progress. Computes active BAs, total BAs, prospects in flow, queue movement 24h, enrollments 24h, and Fast Start completion percentage.'],
  ['Live operations', 'server/src/domain/liveOps.ts', 'Reads in-memory SSE counters plus Mongo projections for growth cards, live grid, and prospect or BA-activation conversion funnels.'],
  ['Audit substrate', 'server/src/domain/auditLog.ts', 'Append-only writer appendAuditEntry() triple-stacks entries to Mongo mcs_audit_log, Neo4j AuditEntry, and Chroma mcs_audit_log. No update/delete exports exist.'],
  ['VM oversight', 'server/src/domain/adminVm.ts', 'Reads vm_lead_batches, vm_bulk_leads, vm_campaigns, vm_delivery_events, prospect_crm_records, and vm_suppression_list. Degrades with warnings when collections are absent.'],
  ['Reports', 'server/src/domain/reports/*', 'Standard reports cover BA activation, training completion, invite funnel, queue velocity, enrollment completion, follow-up aging, leader scorecards, and CSV export.'],
  ['Tenant architecture', 'server/src/domain/adminTenantArchitecture.ts', 'Controls tenant settings, permission display, master-content versions, validation, and inheritance.'],
  ['BA oversight', 'server/src/domain/adminBaOversight.ts', 'Owns BA directory/profile read model, sponsor override audit path, curated leader tagging, and admin notes.'],
  ['Prospect oversight', 'server/src/domain/adminProspectOversight.ts', 'Owns cross-team prospect read model, sponsor-routed URL inspection, notes, and intervention actions.'],
  ['Queue oversight', 'server/src/domain/adminQueueOversight.ts', 'Owns queue summary, lookup, visible window, rules, and ticker mirror.'],
  ['Broadcast', 'server/src/domain/broadcast.ts', 'Owns audience resolution, template interpolation, queue creation, per-recipient rows, STOP exclusion, and send-test flow.'],
];

const missionControlPrinciples = [
  'Do not create another dashboard. The existing /dashboard route is renamed conceptually and promoted into Mission Control.',
  'The first screen must answer: what moved, what broke, who needs support, what decision is waiting, and what Kevin should inspect next.',
  'Every command card must have evidence, freshness, and an action path. If a card cannot produce action or decision, it should be a report footnote, not a Mission Control card.',
  'Admin authorization remains server-side. The UI can hide, guide, or explain, but requireAdmin and ADMIN_BA_IDS are the hard gate.',
  'The Mission Control surface must stay dense and operational. No marketing hero, no decorative card collage, no second "executive dashboard" page.',
  'Compliance boundaries do not loosen because the surface is executive. Prospect-facing rules still govern anything that can reach .com, ScriptMaker, Ivory, notifications, or public preview.',
];

function linesForTable(rows) {
  return [
    '| Item | Anchor | Detail |',
    '|---|---|---|',
    ...rows.map(([a, b, c]) => `| ${a} | ${b} | ${c} |`),
  ].join('\n');
}

function topicAnchors(title) {
  const rows = [];
  const add = (...items) => rows.push(...items);

  if (/Executive|Mission Control|Dashboard|Briefing|Morning|Decision|Recommendation/.test(title)) {
    add(
      ['Core Dashboard becomes Mission Control', '/dashboard', 'Keep the route and data foundation; update product framing, home composition, and labels so this is the executive command center.'],
      ['MetricsRow', 'apps/admin/src/components/dashboard/MetricsRow.tsx', 'Five current tiles become the first Mission Pulse strip: active BAs, prospects in flow, queue movement, enrollments, and training percentage.'],
      ['LiveEventStream', 'apps/admin/src/components/dashboard/LiveEventStream.tsx', 'Placement and audit-tail stream become the right-now pulse inside Mission Control.'],
    );
  }
  if (/Operations|System Health|Incident|Live|Testing|Release/.test(title)) {
    add(
      ['Live Operations', '/live-ops', 'Usage strip, growth windows, holding-tank grid, and conversion funnels supply the live operating lane.'],
      ['Gateway health', 'server/src/services/gatewayLatency.ts', 'p50/p95 latency feeds the usage strip and should graduate into System Health cards.'],
      ['Mock warning', 'apps/admin/src/routes/live-ops.tsx', 'USE_MOCKS=true means the page must visibly disclose mock mode until live endpoints are proven.'],
    );
  }
  if (/CRM|People|BA|Sponsor|Prospect|Support/.test(title)) {
    add(
      ['BA Oversight', '/bas', 'BA profile drawer, notes, sponsor override, leader tag, and lifecycle actions are the people command backbone.'],
      ['Prospect Oversight', '/prospects', 'Prospect detail, activity, notes, sponsor-routed URL inspection, and interventions are the prospect command backbone.'],
      ['Cockpit CRM', 'server/src/domain/crm.ts', 'BA-facing CRM context must feed Mission Control support recommendations without violating sponsor boundaries.'],
    );
  }
  if (/PMV|Metric|KPI|Analytics|Volume|Checks/.test(title)) {
    add(
      ['People', 'brand_ambassadors and prospects', 'People are operational records, not AI-qualified leads.'],
      ['Momentum', 'invitation_activity and pool_placements', 'Momentum is sharing, video movement, callbacks, reservations, and first invite progress.'],
      ['Volume and Checks', 'THREE-authoritative mirror when available', 'Volume and checks are internal-only, clearly labeled, and never leak to .com.'],
    );
  }
  if (/Holding|Queue|Placement|Ticker/.test(title)) {
    add(
      ['Queue Oversight', '/queue', 'Queue depth, fixed position lookup, visible-window config, rule management, and admin ticker mirror.'],
      ['Placement model', 'server/src/domain/holdingTank.ts', 'Positions are monotonic at video_complete; flushes vacate slots and never renumber.'],
      ['Live grid', '/live-ops', 'HoldingTankGrid gives color-coded age buckets and deep-links to prospect detail.'],
    );
  }
  if (/VM|Team News|Notifications/.test(title)) {
    add(
      ['VM Campaigns', '/vm', 'Campaign cards, BA analytics, lead batches, provider health, notification hooks, and team-news hooks.'],
      ['Suppression summary', 'server/src/domain/adminVm.ts', 'Suppressed leads, opt-outs, DNC flags, invalid phones/emails, and compliance holds are explicit.'],
      ['Ownership correction', '/api/admin/vm/ownership-correction', 'Current flow logs a critical audit request; multi-record mutation waits for the ownership service.'],
    );
  }
  if (/Training|Events|Orientation|Michael|Steve/.test(title)) {
    add(
      ['Training progress', 'fast_start_progress', 'Fast Start completion and first-invite requirement define activation movement.'],
      ['Orientation', '/orientation', 'Founder/admin group orientation sessions reuse event/reservation patterns and show rosters.'],
      ['Agents', '/agents', 'Success Profiles and Michael/Steve memory should support humans without classification or scoring.'],
    );
  }
  if (/AI|Agent|Knowledge|Research|Prompt|Claude|Codex/.test(title)) {
    add(
      ['Agent Oversight', '/agents', 'Success Profiles, agent interaction summary, memory health, and GraphRAG bridge drafts.'],
      ['Knowledge Core', 'decision ledger + locked spec + memory stores', 'Decision ledger and locked spec govern truth; Chroma helps recall but is not authority.'],
      ['Prompt governance', 'AGENT_PROMPT_GOVERNANCE.md', 'Prompts are versioned operating assets and must preserve compliance, evidence, and human approval boundaries.'],
    );
  }
  if (/Report|Export/.test(title)) {
    add(
      ['Reports', '/reports', 'ExportPanel issues CSV exports for standard reports. Redaction choice is required every export.'],
      ['Master Report', '/api/admin/reporting/master-report.pdf', 'PDF composites the core dashboard and report library with verifiability footer.'],
      ['PII redaction', 'server/src/services/piiRedact.ts', 'Prospect first/last name, phone, and email are redacted when Kevin chooses redacted export.'],
    );
  }
  if (/Governance|Constitution|Audit|Compliance|Architecture/.test(title)) {
    add(
      ['Audit Log', '/audit', 'Append-only operational evidence for admin requests, mutations, exports, overrides, content saves, and blocks.'],
      ['Tenant Architecture', '/tenant', 'Master content, tenant settings, permission matrix, and compliance validation live here.'],
      ['Source hierarchy', 'docs/READ-ME-FIRST.md', 'Decision ledger > locked spec > design docs > build registry > git log > chat registry > handoffs.'],
    );
  }
  if (/Wireframe|UI Diagram|Flowchart|State Machine|Widget|Card|Tab|QA/.test(title)) {
    add(
      ['Admin shell', 'apps/admin/src/components/admin-shell.tsx', 'Persistent left rail and dense main slot are the frame for Mission Control.'],
      ['Drilldown pattern', 'apps/admin/src/components/dashboard/DrilldownPanel.tsx', 'High-level cards open drilldowns before forcing route changes.'],
      ['Shared contracts', 'packages/shared/src', 'Admin contracts should live in shared types when both server and UI consume them.'],
    );
  }

  return rows.length > 0 ? rows : actualAdminSurfaceMap.slice(0, 3);
}

function operatorQuestions(title) {
  const questions = [
    'What changed since Kevin last looked?',
    'What is the evidence source and how fresh is it?',
    'What action is permitted from here?',
  ];
  if (/Decision/.test(title)) questions.push('What answer is needed from Kevin, and what happens if it is deferred?');
  if (/Alert|Incident|Health/.test(title)) questions.push('What is broken, who owns mitigation, and what is the close condition?');
  if (/CRM|People|BA|Prospect|Training/.test(title)) questions.push('Who needs human support, and who is the right human to provide it?');
  if (/Report|Metric|KPI|Analytics/.test(title)) questions.push('What does this number cause Kevin to do differently today?');
  if (/AI|Knowledge|Research/.test(title)) questions.push('Which claim is sourced, which is inferred, and which is uncertain?');
  if (/Release|Testing/.test(title)) questions.push('What verification exists, what risk remains, and what must be held?');
  return questions;
}

function implementationNotes(title) {
  const notes = [
    'Preserve current route access and server-side admin authorization while changing product language.',
    'Prefer composition over rewrites: promote current widgets into Mission Control lanes before inventing new data models.',
    'Every card needs loading, empty, stale, partial-failure, and drilldown states.',
  ];
  if (/Live Operations|Operations|Health/.test(title)) notes.push('Do not hide USE_MOCKS or provider dormant states; Mission Control must display degraded truth.');
  if (/Report|Export/.test(title)) notes.push('Keep the per-export redaction modal; never persist a raw-export preference.');
  if (/Broadcast|Notifications|VM/.test(title)) notes.push('STOP exclusions and suppression checks are server-side requirements, not UI conveniences.');
  if (/CRM|Prospect|BA|Sponsor/.test(title)) notes.push('Sponsor immutability survives every lookup, recommendation, and re-entry path.');
  if (/AI|Prompt|Recommendation/.test(title)) notes.push('AI output must enter as a draft, recommendation, or evidence package unless a human-approved automation already exists.');
  if (/Audit|Governance|Constitution/.test(title)) notes.push('If a rule conflicts with code, surface the conflict; do not silently make code the precedent.');
  return notes;
}

function qaBullets(title) {
  const checks = [
    'Auth: non-admin BA receives server-side 403, not just hidden navigation.',
    'Source: card shows current data source or clear degraded state.',
    'Action: primary action routes to an existing surface or audited mutation.',
    'Layout: dense desktop view has no overlapping text and remains readable.',
  ];
  if (/Metric|KPI|Analytics/.test(title)) checks.push('Math: numerator, denominator, time window, filter scope, and null behavior are documented.');
  if (/Report|Export/.test(title)) checks.push('Export: redaction choice is audited and CSV/PDF output opens cleanly.');
  if (/Alert|Notification/.test(title)) checks.push('Alert: severity, owner, action, and close state are visible.');
  if (/State Machine/.test(title)) checks.push('States: every terminal, retry, stale, and error state has a named behavior.');
  if (/Prompt|AI|Claude|Codex/.test(title)) checks.push('Prompt: no fabrication, no autonomous prospecting, no hidden policy, and uncertainty is explicit.');
  return checks;
}

function architectureBody(index, title, statement) {
  const routeHint = missionRouteHint(title);
  const metricHint = missionMetricHint(title);
  const actionHint = missionActionHint(title);
  const anchors = topicAnchors(title);
  const questions = operatorQuestions(title);
  const notes = implementationNotes(title);
  const checks = qaBullets(title);
  return [
    statement,
    '',
    '## Concrete Mission Control Anchors',
    linesForTable(anchors),
    '',
    '## Command Intent',
    `Mission Control treats "${title}" as an executive command area, not as a passive information block. The operator should be able to see the current state, inspect the evidence, and move to the next permitted action without leaving the command context unless a full route is needed. ${routeHint}`,
    '',
    '## Data Contract',
    `The data behind this page must identify its source, freshness, owner, and failure mode. MongoDB remains the operational truth, Neo4j supplies relationship context, ChromaDB supplies semantic recall, and the audit log preserves accountable administrative actions. ${metricHint}`,
    '',
    '## Operator Questions',
    ...questions.map((q) => `- ${q}`),
    '',
    '## UI Contract',
    'The UI should use dense admin composition: compact cards, readable tables, drilldown drawers, clear badges, restrained color, and source-aware empty states. Mission Control should use the current admin shell as the frame: left rail for command wings, top header for mission pulse, center lane for executive briefing, right lane for live actions and alerts.',
    '',
    '## Operating Contract',
    `${actionHint} If an action changes a record, sends communication, exports data, overrides sponsor or placement state, or changes master content, it must be audited with actor, entity, route, before and after state when available, and severity.`,
    '',
    '## Implementation Notes',
    ...notes.map((note) => `- ${note}`),
    '',
    '## Compliance Contract',
    'Prospect-facing boundaries remain hard: no income claims, no placement promises, no AI prospecting, no automated prospect calling, no current team head count, and no THREE branding on .com. BA-facing and admin-only surfaces may include training and internal metrics when they remain properly scoped.',
    '',
    '## QA Checks',
    ...checks.map((check) => `- ${check}`),
    '',
    maybeArchitectureDiagram(index, title),
  ].filter(Boolean).join('\n');
}

function executiveBody(index, title, statement) {
  const cadence = executiveCadenceHint(title);
  const artifact = executiveArtifactHint(title);
  const qa = executiveQaHint(title);
  const anchors = topicAnchors(title);
  const questions = operatorQuestions(title);
  const notes = implementationNotes(title);
  const checks = qaBullets(title);
  return [
    statement,
    '',
    '## Mission Control Inputs',
    linesForTable(anchors),
    '',
    '## Executive Purpose',
    `The executive purpose of "${title}" is to reduce Kevin's cognitive load while preserving control. It should surface the smallest useful set of facts, frame the decision or action, and make the next move clear.`,
    '',
    '## Executive Questions',
    ...questions.map((q) => `- ${q}`),
    '',
    '## Inputs',
    `Inputs may include admin metrics, CRM records, holding-tank state, VM state, training progress, event reservations, notification outcomes, AI operations, knowledge records, tests, health checks, release data, governance records, and audit entries. ${cadence}`,
    '',
    '## Output',
    `${artifact} The output must distinguish observed fact from inference. When confidence is low, the system should say what is missing rather than inventing a conclusion.`,
    '',
    '## Operating Notes',
    ...notes.map((note) => `- ${note}`),
    '',
    '## Review Rule',
    'Human judgment remains final. Recommendations, reports, alerts, and briefings support Kevin; they do not replace Kevin. Any action that affects people, compliance, data integrity, or external communication must stay inside its permission boundary.',
    '',
    '## QA Rule',
    qa,
    '',
    '## Page-Level QA',
    ...checks.map((check) => `- ${check}`),
    '',
    maybeExecutiveDiagram(index, title),
  ].filter(Boolean).join('\n');
}

function missionRouteHint(title) {
  if (/CRM|BA|People|Sponsor/.test(title)) return 'Primary drilldowns should route through /bas, /prospects, cockpit records, and CRM drawers.';
  if (/Holding|Queue|Placement|Ticker/.test(title)) return 'Primary drilldowns should route through /queue, holding-tank records, placement history, and ticker mirrors.';
  if (/VM/.test(title)) return 'Primary drilldowns should route through /vm, VM batches, provider queues, and ownership correction flows.';
  if (/Training|Michael|Steve|Orientation/.test(title)) return 'Primary drilldowns should route through training, orientation, Steve, Michael, and cockpit support cards.';
  if (/Report|Analytics|Metric|KPI/.test(title)) return 'Primary drilldowns should route through /reports, report exports, master report PDFs, and analytics projections.';
  if (/Health|Incident|Testing|Release/.test(title)) return 'Primary drilldowns should route through system health, release status, test logs, and known-risk panels.';
  if (/AI|Agent|Knowledge|Research/.test(title)) return 'Primary drilldowns should route through /agents, Knowledge Core, research records, memory lineage, and recommendation queues.';
  return 'Primary drilldowns should preserve the current Mission Control context and then open the relevant existing admin route.';
}

function missionMetricHint(title) {
  if (/PMV/.test(title)) return 'PMV metrics must label People, Momentum, Volume, and Checks distinctly; Checks never bleed to prospect-facing surfaces.';
  if (/Metric|KPI|Analytics/.test(title)) return 'Every number needs a numerator, denominator, time window, filter scope, and source collection.';
  if (/Alert|Incident/.test(title)) return 'Every alert needs severity, owner, permitted action, and close condition.';
  if (/Report|Export/.test(title)) return 'Every report needs filter scope, generated time, redaction state when applicable, and audit proof.';
  if (/Decision|Recommendation/.test(title)) return 'Every decision or recommendation needs evidence references, confidence, risk, and disposition.';
  return 'If the source is degraded, the card should show partial truth rather than false certainty.';
}

function missionActionHint(title) {
  if (/Decision/.test(title)) return 'The primary action is to accept, reject, amend, or defer a decision and write the result to the decision ledger.';
  if (/Recommendation/.test(title)) return 'The primary action is to review the evidence, approve a next step, dismiss it, or request more research.';
  if (/Alert|Incident/.test(title)) return 'The primary action is to acknowledge, assign, mitigate, close, or escalate the alert.';
  if (/Report/.test(title)) return 'The primary action is to generate, inspect, print, export, or archive the report with the correct redaction choice.';
  if (/Release/.test(title)) return 'The primary action is to verify release readiness, hold the release, or mark the release ready for Kevin-directed merge.';
  if (/Training|CRM|People/.test(title)) return 'The primary action is to identify who needs human support and route that support through the correct sponsor or founder path.';
  return 'The primary action is visible on the card and repeated in the drilldown.';
}

function executiveCadenceHint(title) {
  if (/Morning/.test(title)) return 'Morning inputs should be collected before any optional analysis so the daily brief is ready first.';
  if (/Weekly/.test(title)) return 'Weekly inputs compare this week with the prior relevant window and explain variance.';
  if (/Release/.test(title)) return 'Release inputs must include dirty worktree awareness and verification evidence.';
  if (/Incident|Health/.test(title)) return 'Incident and health inputs must prioritize live status over historical summary.';
  return 'Inputs should be scoped to the current executive cadence: morning, midday, evening, weekly, incident, release, or research mode.';
}

function executiveArtifactHint(title) {
  if (/Briefing/.test(title)) return 'The output is an executive briefing with facts, implications, decisions, and recommended actions.';
  if (/Report/.test(title)) return 'The output is a report or export package that can be printed, audited, and revisited.';
  if (/Decision/.test(title)) return 'The output is a decision card ready for Kevin with context, options, recommendation, and impact.';
  if (/Recommendation/.test(title)) return 'The output is a recommendation card with evidence, confidence, risk, and a safe next action.';
  if (/Checklist|QA/.test(title)) return 'The output is a checklist that can be executed and verified, not a vague reminder.';
  return 'The output is a concise executive artifact stored or linked where future sessions can retrieve it.';
}

function executiveQaHint(title) {
  if (/Prompt/.test(title)) return 'Prompt QA verifies source hierarchy, no fabrication, no overreach, no hidden authority, and explicit handoff to human approval when needed.';
  if (/Wireframe|UI/.test(title)) return 'UI QA verifies text fit, no overlap, keyboard reachability, desktop density, emergency mobile readability, and no duplicate dashboard.';
  if (/Flowchart|State Machine/.test(title)) return 'Process QA verifies all start states, terminal states, retries, stale states, audit paths, and owner transitions.';
  if (/Report|Export/.test(title)) return 'Report QA verifies filter scope, source calculation, redaction, generated timestamp, export audit, and print quality.';
  if (/Alert/.test(title)) return 'Alert QA verifies severity, owner, action, close condition, and that alert volume does not dilute critical signals.';
  return 'QA verifies source accuracy, permission boundaries, compliance boundaries, audit requirements, and whether the artifact actually helps Kevin decide or act.';
}

function maybeArchitectureDiagram(index, title) {
  if (index === 7) {
    return [
      '```mermaid',
      'flowchart TD',
      '  MC[Mission Control] --> Ops[Operations]',
      '  MC --> CRM[CRM]',
      '  MC --> PMV[PMV]',
      '  MC --> Tank[Holding Tank]',
      '  MC --> VM[VM]',
      '  MC --> AI[AI Operations]',
      '  MC --> Knowledge[Knowledge Core]',
      '  MC --> Reports[Executive Reports]',
      '  MC --> Decisions[Decision Center]',
      '```',
    ].join('\n');
  }
  if (/Flow|State Machine/.test(title)) {
    return [
      '```mermaid',
      'flowchart LR',
      '  Signal[Signal] --> Evidence[Evidence]',
      '  Evidence --> Guardrail[Guardrail Check]',
      '  Guardrail --> Surface[Mission Control Surface]',
      '  Surface --> Action[Permitted Action]',
      '  Action --> Audit[Audit or Archive]',
      '```',
    ].join('\n');
  }
  if (/Wireframe|UI/.test(title)) {
    return [
      '```text',
      '+--------------------------------------------------------------+',
      '| Mission Header: pulse | critical alerts | decisions | action |',
      '+----------------------+-------------------+-------------------+',
      '| Briefing Lane        | Action Lane       | Live Lane         |',
      '| Morning Brief        | Decision Center   | Operations        |',
      '| Mission Pulse        | Recommendations   | Holding Tank      |',
      '| People Support       | Alerts            | Health            |',
      '+----------------------+-------------------+-------------------+',
      '```',
    ].join('\n');
  }
  return '';
}

function maybeExecutiveDiagram(index, title) {
  if (/Flowchart/.test(title)) {
    return [
      '```mermaid',
      'flowchart TD',
      '  Collect[Collect Signals] --> Edit[Executive Edit]',
      '  Edit --> Decide{Decision Needed?}',
      '  Decide -->|Yes| Decision[Decision Center]',
      '  Decide -->|No| Brief[Briefing]',
      '  Decision --> Ledger[Decision Ledger]',
      '  Brief --> Actions[Action Queue]',
      '```',
    ].join('\n');
  }
  if (/State Machine/.test(title)) {
    return [
      '```mermaid',
      'stateDiagram-v2',
      '  [*] --> Draft',
      '  Draft --> Reviewed',
      '  Reviewed --> Delivered',
      '  Delivered --> Actioned',
      '  Delivered --> Deferred',
      '  Actioned --> Archived',
      '  Deferred --> Reviewed',
      '  Archived --> [*]',
      '```',
    ].join('\n');
  }
  if (/Wireframe/.test(title)) {
    return [
      '```text',
      '+------------------------------------------------------------+',
      '| Executive Mode                                             |',
      '+------------------+------------------+----------------------+',
      '| What changed     | What matters     | What Kevin decides   |',
      '| People support   | System risks     | Recommended actions  |',
      '| Reports          | Release status   | Governance notes     |',
      '+------------------+------------------+----------------------+',
      '```',
    ].join('\n');
  }
  return '';
}

function buildBook({ title, basisTitle, catalog, bodyFactory }) {
  let md = sourceBasis(title, basisTitle);
  catalog.forEach(([pageTitle, statement], i) => {
    const n = i + 2;
    md += `<!-- PAGE ${pageNumber(n)} -->\n`;
    md += `# Page ${n} - ${pageTitle}\n\n`;
    md += bodyFactory(n, pageTitle, statement);
    md += '\n\n---\n\n';
  });
  return md;
}

mkdirSync(outDir, { recursive: true });

const architecture = buildBook({
  title: 'Mission Control Architecture',
  basisTitle: 'Mission Control Source Basis',
  catalog: architectureCatalog,
  bodyFactory: architectureBody,
});

const executive = buildBook({
  title: 'Momentum Executive System',
  basisTitle: 'Executive System Source Basis',
  catalog: executiveCatalog,
  bodyFactory: executiveBody,
});

const ARTIFACT_BANNER = `> **Generated Reference Manual — Not Constitutional Authority.** Source-of-truth documents live in \`constitution/\` and governing architecture documents.\n\n`;
writeFileSync(join(outDir, 'MISSION_CONTROL_ARCHITECTURE.md'), ARTIFACT_BANNER + architecture, 'utf8');
writeFileSync(join(outDir, 'MOMENTUM_EXECUTIVE_SYSTEM.md'), ARTIFACT_BANNER + executive, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  files: [
    {
      path: join(outDir, 'MISSION_CONTROL_ARCHITECTURE.md'),
      pages: (architecture.match(/<!-- PAGE /g) || []).length,
      bytes: Buffer.byteLength(architecture),
    },
    {
      path: join(outDir, 'MOMENTUM_EXECUTIVE_SYSTEM.md'),
      pages: (executive.match(/<!-- PAGE /g) || []).length,
      bytes: Buffer.byteLength(executive),
    },
  ],
}, null, 2));
