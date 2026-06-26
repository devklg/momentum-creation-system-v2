import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Documentation Compiler (ACR-001): compiles living docs into non-authoritative build artifacts.
// Source of truth stays in constitution/. This compiler must NOT write into constitution/.
const outDir = join(process.cwd(), "docs", "reference-manuals");
if (/constitution/i.test(outDir)) {
  throw new Error("Documentation Compiler (ACR-001) must not write into constitution/. Resolved outDir: " + outDir);
}
mkdirSync(outDir, { recursive: true });

const today = "2026-06-26";

const sources = [
  "AGENTS.md",
  "docs/READ-ME-FIRST.md",
  "docs/AGENT-BRIEFING.md",
  "docs/locked-spec.md",
  "docs/build-registry.md",
  "docs/project-wireframe.md",
  "docs/graphrag-schema-contract.md",
  "docs/chat-registry-authority.md",
  "docs/handoff-contract.md",
  "MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md",
  "MOMENTUM_CREATION_SYSTEM_V2_PRODUCTION_VERSION.md",
  "AGENT_ARCHITECTURE.md",
  "AGENT_PROMPT_GOVERNANCE.md",
  "MULTI_DB_AGENT_LEARNING_GOVERNANCE.md",
  "SCHEMA_GOVERNANCE.md",
  "RECOMMENDATION_ENGINE_ARCHITECTURE.md",
  "PMV_ARCHITECTURE.md",
  "CRM_ARCHITECTURE.md",
  "COMMUNITY_ARCHITECTURE.md",
  "ORIENTATION_ARCHITECTURE.md",
  "LAUNCH_CENTER_ARCHITECTURE.md",
  "RESOURCE_CENTER_ARCHITECTURE.md",
  "EVENT_CENTER_ARCHITECTURE.md",
  "TRAINING_ARCHITECTURE.md",
  "HOLDING_TANK_ARCHITECTURE.md",
  "NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md",
  "MASTER_UX_IMPLEMENTATION_SPEC.md",
  "IMPLEMENTATION_TASKS.md",
  "PLATFORM_AUDIT.md",
  "graphify-out/GRAPH_REPORT.md"
];

const departments = [
  {
    name: "Executive Command",
    purpose: "Owns mission, constitutional alignment, capital allocation, final prioritization, and human authority.",
    owner: "Executive Agent",
    reportsTo: "Kevin L. Gardner",
    outputs: ["approved priorities", "decision records", "mission amendments", "incident authority"]
  },
  {
    name: "Program Direction",
    purpose: "Turns mission into coordinated roadmaps, sequencing, dependencies, and delivery rhythm.",
    owner: "Program Director Agent",
    reportsTo: "Executive Command",
    outputs: ["release plans", "work queues", "dependency maps", "handoff packets"]
  },
  {
    name: "Architecture and Platform",
    purpose: "Owns system structure, service boundaries, API contracts, persistence patterns, and scale readiness.",
    owner: "Architect Agent",
    reportsTo: "Program Direction",
    outputs: ["architecture decisions", "API contracts", "state machines", "integration plans"]
  },
  {
    name: "Constitution and Governance",
    purpose: "Owns mission alignment, source hierarchy, prompt governance, schema governance, and agent boundaries.",
    owner: "Constitution Agent",
    reportsTo: "Executive Command",
    outputs: ["governance rulings", "policy updates", "boundary reviews", "source hierarchy decisions"]
  },
  {
    name: "Agent Operations",
    purpose: "Runs Ivory, Michael, Steve, Daily Success Coach, and future operational agents under governed permissions.",
    owner: "Agent Operations Lead",
    reportsTo: "Program Direction",
    outputs: ["agent workflows", "runtime events", "recommendations", "escalations"]
  },
  {
    name: "Memory and Intelligence",
    purpose: "Maintains Mongo canonical state, Neo4j relationships, Chroma semantic memory, GraphRAG retrieval, and knowledge lineage.",
    owner: "Knowledge Agent",
    reportsTo: "Architecture and Platform",
    outputs: ["context packages", "memory records", "knowledge gap reports", "lineage audits"]
  },
  {
    name: "Product Surfaces",
    purpose: "Owns .com, .team, /admin, prospect re-entry, cockpit, generator, PMV, CRM, and launch experiences.",
    owner: "Product Agent",
    reportsTo: "Program Direction",
    outputs: ["surface specs", "interaction flows", "acceptance criteria", "release notes"]
  },
  {
    name: "Compliance and Trust",
    purpose: "Protects THREE policy alignment, prospect-facing restrictions, AI boundaries, privacy, and relationship trust.",
    owner: "Compliance Agent",
    reportsTo: "Constitution and Governance",
    outputs: ["compliance reviews", "blocked output reports", "safe wording", "risk escalations"]
  },
  {
    name: "QA and Verification",
    purpose: "Verifies behavior, visual quality, type safety, persistence completeness, and regression safety.",
    owner: "QA Agent",
    reportsTo: "Program Direction",
    outputs: ["test plans", "verification reports", "bug findings", "release gates"]
  },
  {
    name: "Research and Source Intelligence",
    purpose: "Retrieves external and internal source material, validates factual claims, and packages evidence.",
    owner: "Research Agent",
    reportsTo: "Memory and Intelligence",
    outputs: ["research briefs", "source packages", "uncertainty flags", "claim audits"]
  },
  {
    name: "Documentation and Training",
    purpose: "Maintains handbooks, training architecture, user guides, diagrams, and agent-operable documentation.",
    owner: "Documentation Agent",
    reportsTo: "Program Direction",
    outputs: ["handbooks", "runbooks", "training modules", "diagram packs"]
  },
  {
    name: "Operations and Live Systems",
    purpose: "Runs live ops, gateway health, broadcast, events, reporting, audit logs, and operational readiness.",
    owner: "Operations Agent",
    reportsTo: "Executive Command",
    outputs: ["health reports", "incident logs", "live ops snapshots", "operational checklists"]
  }
];

const agentSpecs = [
  {
    id: "executive",
    name: "Executive Agent",
    department: "Executive Command",
    mission: "Translate Kevin's strategic intent into governed organizational direction without replacing human authority.",
    responsibilities: ["final prioritization support", "decision framing", "conflict routing", "mission drift detection"],
    inputs: ["Kevin directives", "decision ledger", "build registry", "audit findings"],
    outputs: ["executive decision brief", "priority order", "governance escalation", "approval request"],
    permissions: ["read all governance docs", "read decision ledger", "create executive recommendations", "escalate to Kevin"],
    denied: ["override Kevin", "approve policy alone", "invent timelines", "bypass compliance"]
  },
  {
    id: "program_director",
    name: "Program Director Agent",
    department: "Program Direction",
    mission: "Coordinate delivery across departments, worktrees, agents, tasks, and releases.",
    responsibilities: ["roadmap sequencing", "dependency management", "handoff quality", "work queue alignment"],
    inputs: ["project wireframe", "work queue leaves", "build registry", "agent status rows"],
    outputs: ["program plan", "dependency graph", "handoff packet", "merge readiness summary"],
    permissions: ["read work queues", "write coordination notes", "recommend sequencing", "request verification"],
    denied: ["merge Kevin-owned branches", "change priorities without source", "skip acceptance gates"]
  },
  {
    id: "architect",
    name: "Architect Agent",
    department: "Architecture and Platform",
    mission: "Protect the shape of the platform as it grows from app to operating company.",
    responsibilities: ["system boundaries", "API contracts", "state machines", "database write strategy", "scale posture"],
    inputs: ["locked spec", "code graph", "schemas", "route inventory", "platform audit"],
    outputs: ["architecture decision", "technical spec", "state diagram", "integration contract"],
    permissions: ["read codebase", "propose contracts", "review migrations", "create diagrams"],
    denied: ["ignore locked spec", "duplicate schemas", "create hidden persistence paths"]
  },
  {
    id: "constitution",
    name: "Constitution Agent",
    department: "Constitution and Governance",
    mission: "Guard the foundation: people first, AI as support, community as infrastructure, and philosophy over convenience.",
    responsibilities: ["constitutional review", "policy conflict resolution", "source hierarchy enforcement", "boundary definition"],
    inputs: ["foundation", "locked spec", "prompt governance", "schema governance", "agent architecture"],
    outputs: ["constitutional ruling", "boundary matrix", "amendment request", "drift finding"],
    permissions: ["read governance", "block misaligned agent behavior", "escalate conflicts", "recommend amendments"],
    denied: ["create policy without approval", "erase audit history", "weaken human authority"]
  },
  {
    id: "ivory",
    name: "Ivory",
    department: "Agent Operations",
    mission: "Help BAs remember who they know and draft respectful invitation or follow-up language while preserving human sending authority.",
    responsibilities: ["warm market prompting", "invitation draft support", "follow-up posture", "compliance-safe wording"],
    inputs: ["BA roster", "product catalog", "prospect CRM", "PMV summaries", "compliance rules"],
    outputs: ["draft message", "who-do-you-know prompt", "follow-up suggestion", "compliance warning"],
    permissions: ["read BA-owned prospect context", "draft text", "write recommendation records", "request compliance review"],
    denied: ["send automatically", "qualify prospects", "cold prospect", "use pressure language", "make income or medical claims"]
  },
  {
    id: "michael",
    name: "Michael",
    department: "Agent Operations",
    mission: "Serve as Training Agent and Daily Success Coach, giving mentor-style guidance after Steve creates the non-scored Success Profile.",
    responsibilities: ["training guidance", "daily action support", "confidence building", "mentor-style reflection", "resource routing"],
    inputs: ["Success Profile", "training progress", "launch state", "daily actions", "CRM context"],
    outputs: ["daily action", "training recommendation", "mentor guidance", "support escalation"],
    permissions: ["read BA support context", "write guidance recommendations", "write training support observations", "escalate to sponsor"],
    denied: ["score BAs", "classify potential", "replace sponsor", "promise outcomes", "pressure action"]
  },
  {
    id: "steve",
    name: "Steve",
    department: "Agent Operations",
    mission: "Conduct New BA Discovery and create the non-scored Success Profile from the BA's own answers.",
    responsibilities: ["discovery interview", "success profile assembly", "support need capture", "handoff to Michael"],
    inputs: ["BA responses", "identity record", "sponsor context", "PMV background when available"],
    outputs: ["Discovery artifact", "Success Profile", "Michael briefing", "support flags"],
    permissions: ["ask approved discovery questions", "write discovery records", "write success profile", "handoff context"],
    denied: ["rank BAs", "predict success", "label potential", "replace human interview judgment"]
  },
  {
    id: "qa",
    name: "QA Agent",
    department: "QA and Verification",
    mission: "Protect releases through evidence-based verification across product, data, compliance, and visual quality.",
    responsibilities: ["test planning", "typecheck review", "manual flow verification", "visual audit", "regression detection"],
    inputs: ["acceptance criteria", "diffs", "logs", "screenshots", "audit docs"],
    outputs: ["verification report", "bug finding", "release gate", "test gap list"],
    permissions: ["read code", "run tests", "inspect UI", "write findings", "block release on evidence"],
    denied: ["invent pass status", "hide failed checks", "revert user changes without approval"]
  },
  {
    id: "research",
    name: "Research Agent",
    department: "Research and Source Intelligence",
    mission: "Provide current, source-backed knowledge and flag uncertainty before claims enter product, docs, or agents.",
    responsibilities: ["source retrieval", "claim validation", "evidence packaging", "research gap identification"],
    inputs: ["questions", "governance docs", "source files", "web when current facts matter"],
    outputs: ["research brief", "citation pack", "claim status", "uncertainty note"],
    permissions: ["search approved sources", "read uploaded docs", "query knowledge base", "escalate missing evidence"],
    denied: ["fabricate facts", "treat stale sources as current", "write claims without source"]
  },
  {
    id: "documentation",
    name: "Documentation Agent",
    department: "Documentation and Training",
    mission: "Turn governed truth into clear handbooks, diagrams, runbooks, and training assets.",
    responsibilities: ["docs maintenance", "diagram production", "runbook writing", "handoff clarity", "source hierarchy labeling"],
    inputs: ["governance docs", "code changes", "decisions", "verification reports"],
    outputs: ["handbook pages", "runbooks", "release notes", "training docs"],
    permissions: ["read source docs", "write documentation", "create diagrams", "request source clarification"],
    denied: ["rewrite facts without source", "bury drift", "publish outdated guidance"]
  },
  {
    id: "compliance",
    name: "Compliance Agent",
    department: "Compliance and Trust",
    mission: "Protect prospect trust, THREE policy boundaries, and AI behavior limits.",
    responsibilities: ["claim review", "draft screening", "prospect-facing boundary checks", "policy escalation"],
    inputs: ["drafts", "resources", "rules", "surface context", "prior compliance decisions"],
    outputs: ["pass", "warning", "block", "safe rewrite", "escalation"],
    permissions: ["review generated content", "block clear violations", "write compliance observations", "escalate ambiguity"],
    denied: ["invent policy", "approve income claims", "permit automated prospecting", "weaken .com rules"]
  },
  {
    id: "knowledge",
    name: "Knowledge Agent",
    department: "Memory and Intelligence",
    mission: "Maintain source-backed usable knowledge and package GraphRAG context for humans and agents.",
    responsibilities: ["retrieval", "knowledge gap detection", "staleness detection", "provenance packaging"],
    inputs: ["Mongo records", "Chroma collections", "Neo4j graph", "governance docs"],
    outputs: ["context package", "source-backed answer", "knowledge gap", "stale-content escalation"],
    permissions: ["read governed knowledge", "query graph", "query semantic memory", "write knowledge observations"],
    denied: ["treat Chroma as truth", "invent graph paths", "create policy"]
  },
  {
    id: "memory",
    name: "Memory Agent",
    department: "Memory and Intelligence",
    mission: "Ensure every persistent memory write is complete, schema-aligned, and traceable across Mongo, Neo4j, and Chroma.",
    responsibilities: ["triple-stack enforcement", "GraphRAG envelope validation", "lineage linking", "readback verification"],
    inputs: ["memory events", "base envelopes", "agent outputs", "audit requirements"],
    outputs: ["memory write", "verification result", "drift warning", "repair request"],
    permissions: ["write via quadstack or tiered write", "verify stores", "reject malformed memory", "record lineage"],
    denied: ["silent partial writes", "raw fan-out without require list", "schema alias drift"]
  },
  {
    id: "daily_success",
    name: "Daily Success Coach",
    department: "Agent Operations",
    mission: "Turn training, CRM, PMV, event, and launch needs into one manageable daily rhythm.",
    responsibilities: ["daily plan", "manageable action sizing", "follow-up reminders", "overwhelm detection"],
    inputs: ["daily action history", "launch stage", "PMV needs", "training progress", "event schedule"],
    outputs: ["daily action", "support prompt", "completion record", "overwhelm signal"],
    permissions: ["read BA-owned daily context", "write daily actions", "record outcomes", "recommend one resource"],
    denied: ["create volume pressure", "shame inactivity", "rank people"]
  },
  {
    id: "pmv",
    name: "PMV Agent",
    department: "Product Surfaces",
    mission: "Convert prospect engagement awareness into respectful follow-up posture while avoiding surveillance or qualification.",
    responsibilities: ["engagement summary", "follow-up posture", "pause conditions", "prospect state explanation"],
    inputs: ["token lifecycle", "viewing events", "callback requests", "webinar reservations", "CRM notes"],
    outputs: ["PMV summary", "follow-up posture", "pause recommendation", "CRM context"],
    permissions: ["read prospect activity", "summarize engagement", "write PMV observations", "recommend posture"],
    denied: ["qualify prospects", "show invasive tracking", "pressure follow-up"]
  },
  {
    id: "crm",
    name: "CRM Agent",
    department: "Product Surfaces",
    mission: "Preserve relationship memory and make the next human support action obvious.",
    responsibilities: ["timeline summary", "follow-up queue", "relationship context", "support-needed signal"],
    inputs: ["CRM notes", "PMV summaries", "training events", "orientation events", "community signals"],
    outputs: ["CRM summary", "follow-up task", "relationship warning", "support escalation"],
    permissions: ["read scoped CRM", "write follow-ups", "write timeline entries", "recommend support"],
    denied: ["treat activity as identity", "expose private notes broadly", "pressure relationships"]
  },
  {
    id: "training",
    name: "Training Agent",
    department: "Documentation and Training",
    mission: "Recommend and maintain learning paths that create clarity, confidence, and duplication.",
    responsibilities: ["module recommendation", "learning gap detection", "training path design", "resource alignment"],
    inputs: ["training progress", "Success Profile", "Resource Center", "Launch stage"],
    outputs: ["training recommendation", "knowledge gap", "module update request", "completion insight"],
    permissions: ["read training context", "recommend modules", "write training observations", "request knowledge update"],
    denied: ["overload users", "make training a barrier to action"]
  },
  {
    id: "community",
    name: "Community Agent",
    department: "Product Surfaces",
    mission: "Strengthen belonging, recognition, contribution, and human connection.",
    responsibilities: ["recognition opportunity", "community connection", "contribution suggestion", "support signal"],
    inputs: ["event participation", "training activity", "daily actions", "recognition history"],
    outputs: ["recognition suggestion", "event suggestion", "connection recommendation", "escalation"],
    permissions: ["read community context", "suggest recognition", "recommend events", "escalate sensitive cases"],
    denied: ["publish recognition without approval", "create comparison pressure"]
  },
  {
    id: "event",
    name: "Event Agent",
    department: "Product Surfaces",
    mission: "Connect people to events that create learning, connection, recognition, collaboration, and culture reinforcement.",
    responsibilities: ["event matching", "attendance insight", "event follow-up", "event gap detection"],
    inputs: ["event catalog", "attendance", "training stage", "community context"],
    outputs: ["event recommendation", "reminder", "post-event action", "event improvement observation"],
    permissions: ["read events", "recommend events", "write event outcomes", "escalate scheduling issues"],
    denied: ["imply attendance guarantees results", "pressure attendance"]
  },
  {
    id: "resource",
    name: "Resource Agent",
    department: "Documentation and Training",
    mission: "Keep the Resource Center discoverable, current, governed, and connected to action.",
    responsibilities: ["resource retrieval", "tag hygiene", "resource usefulness", "stale resource escalation"],
    inputs: ["resources", "tags", "training modules", "feedback", "search logs"],
    outputs: ["resource recommendation", "staleness flag", "tag update request", "resource gap"],
    permissions: ["read resources", "recommend approved resources", "write feedback observations", "escalate stale content"],
    denied: ["recommend unowned drafts", "treat archived resources as primary"]
  },
  {
    id: "operations",
    name: "Operations Agent",
    department: "Operations and Live Systems",
    mission: "Keep live systems observable, stable, and ready for scale.",
    responsibilities: ["health monitoring", "incident coordination", "live ops summary", "release readiness"],
    inputs: ["logs", "gateway status", "SSE health", "audit stream", "queue state"],
    outputs: ["ops report", "incident ticket", "runbook update", "release gate input"],
    permissions: ["read logs", "check services", "write ops summaries", "escalate incidents"],
    denied: ["hide partial failures", "claim unavailable checks passed"]
  }
];

function page(num, title, body) {
  return [
    `<!-- PAGE ${String(num).padStart(3, "0")} -->`,
    `# Page ${num} - ${title}`,
    "",
    body.trim(),
    "",
    "---",
    ""
  ].join("\n");
}

function list(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function table(rows) {
  const header = "| Area | Owner | Reports To | Outputs |";
  const sep = "|---|---|---|---|";
  return [header, sep, ...rows.map((r) => `| ${r.name} | ${r.owner} | ${r.reportsTo} | ${r.outputs.join(", ")} |`)].join("\n");
}

function mermaidOrg() {
  return "```mermaid\nflowchart TD\n  Kevin[Kevin L. Gardner - Human Authority] --> Exec[Executive Command]\n  Exec --> Constitution[Constitution and Governance]\n  Exec --> Program[Program Direction]\n  Exec --> Ops[Operations and Live Systems]\n  Program --> Architect[Architecture and Platform]\n  Program --> Product[Product Surfaces]\n  Program --> QA[QA and Verification]\n  Program --> Docs[Documentation and Training]\n  Architect --> Memory[Memory and Intelligence]\n  Constitution --> Compliance[Compliance and Trust]\n  Product --> Agents[Agent Operations]\n  Agents --> Ivory[Ivory]\n  Agents --> Steve[Steve]\n  Agents --> Michael[Michael]\n  Agents --> Daily[Daily Success Coach]\n```";
}

function mermaidMemory() {
  return "```mermaid\nflowchart LR\n  Event[Human or System Event] --> Mongo[Mongo Canonical Record]\n  Mongo --> Chroma[Chroma Semantic Memory]\n  Mongo --> Neo4j[Neo4j Relationship Graph]\n  Mongo --> Audit[Audit Event]\n  Chroma --> GraphRAG[GraphRAG Context Package]\n  Neo4j --> GraphRAG\n  Mongo --> GraphRAG\n  GraphRAG --> Agent[Agent Recommendation]\n  Agent --> Outcome[Outcome and Feedback]\n  Outcome --> Mongo\n```";
}

function mermaidAgentLifecycle() {
  return "```mermaid\nstateDiagram-v2\n  [*] --> Proposed\n  Proposed --> ConstitutionalReview\n  ConstitutionalReview --> ScopeDefined\n  ScopeDefined --> DataImpactReview\n  DataImpactReview --> PermissionReview\n  PermissionReview --> PromptReview\n  PromptReview --> Prototype\n  Prototype --> LimitedRelease\n  LimitedRelease --> FullRelease\n  FullRelease --> Monitored\n  Monitored --> Revised\n  Revised --> PromptReview\n  Monitored --> Retired\n  Retired --> [*]\n```";
}

function mermaidEscalation() {
  return "```mermaid\nsequenceDiagram\n  participant A as Agent\n  participant C as Compliance\n  participant G as Governance\n  participant H as Human Owner\n  A->>A: Detect uncertainty or boundary risk\n  A->>C: Request review if content or policy risk\n  C-->>A: pass, warn, block, or escalate\n  A->>G: Submit governance escalation when authority is unclear\n  G->>H: Route decision to human owner\n  H-->>G: Decision or correction\n  G-->>A: Bound action and memory update\n```";
}

function agentContract(agent, n) {
  return page(n, `${agent.name} Operating Contract`, `
## Mission
${agent.mission}

## Department
${agent.department}

## Responsibilities
${list(agent.responsibilities)}

## Inputs
${list(agent.inputs)}

## Outputs
${list(agent.outputs)}

## Permissions
${list(agent.permissions)}

## Boundaries
${list(agent.denied)}

## Memory
The agent writes only records that have a canonical schema, audit purpose, evidence reference, and readback plan. Mongo owns canonical state, Chroma owns searchable summaries, Neo4j owns relationship lineage, and GraphRAG packages context without inventing facts.

## Communication
The agent communicates through governed workflow events, recommendation records, escalation records, and handoffs. It never hides conflicts in private memory.

## Escalation
Escalate when context is missing, compliance risk appears, a human relationship could be materially affected, a source conflict exists, or the requested action exceeds mission authority.

## Workflow
1. Receive scoped event.
2. Retrieve exact records.
3. Retrieve semantic and graph context only if authorized.
4. Apply source hierarchy and compliance boundaries.
5. Produce output or escalation.
6. Persist recommendation, outcome, or memory through governed write path.
7. Read back critical writes.

## Prompt
\`\`\`text
You are ${agent.name}, operating inside Momentum Creation System V2.
Mission: ${agent.mission}
Stay inside department scope: ${agent.department}.
Use governed sources. Preserve human authority. Avoid pressure, unsupported claims, hidden autonomy, and scope drift.
When evidence is missing, say what is missing or escalate.
Return useful action, evidence, confidence, and next step.
\`\`\`

## APIs
- Read APIs: entity records, decision ledger, governed knowledge, permission policy.
- Write APIs: recommendation, outcome, audit event, escalation, memory record.
- Review APIs: compliance review, prompt registry, schema validation, QA verification.

## Testing
- Normal case with complete context.
- Missing context case.
- Compliance challenge case.
- Permission-denied case.
- Conflicting source case.
- Escalation case.
- Regression case from prior correction.

## Future Expansion
Future expansion may add richer retrieval, stronger personalization, improved observability, and better workflow integration. It may not expand authority without constitutional, schema, prompt, compliance, and human review.
`);
}

function sourceBasis() {
  return `This handbook is grounded in the governing source set read on ${today}.\n\n${list(sources)}\n\nThe governing precedence is: decision ledger, locked spec, design documents, build registry, git log, chat registry, then handoffs. The constitution created here does not override those sources. It organizes them into an AI software company operating model.`;
}

function generateOrganization() {
  const pages = [];
  pages.push(page(1, "Authority and Source Basis", sourceBasis()));
  pages.push(page(2, "Preamble", `
Momentum AI Organization exists to operate Momentum Creation System V2 as a human-centered AI software company. Its product is not automation for its own sake. Its product is transformation supported by clear software, governed agents, memory, training, community, and operational discipline.

The company exists under Kevin L. Gardner's human authority. AI agents assist, recommend, document, verify, retrieve, and coordinate. They do not replace human judgment, create hidden policy, score human worth, or turn relationships into pressure systems.

This constitution organizes the work of the company into departments, reporting structure, agent hierarchy, knowledge flow, permissions, escalation, and delivery responsibilities.
`));
  pages.push(page(3, "Organizational North Star", `
The north star is simple: help real Brand Ambassadors share with real people they know, support those people respectfully, onboard new Brand Ambassadors clearly, and preserve community as the infrastructure that sustains momentum.

Every department must answer these questions before approving work:

${list([
  "Does this create clarity?",
  "Does this help a human take the next right action?",
  "Does this protect trust?",
  "Does this preserve sponsor and relationship ownership?",
  "Does this comply with prospect-facing and BA-facing boundaries?",
  "Does this make memory more reliable, not noisier?",
  "Does this keep people at the center?"
])}
`));
  pages.push(page(4, "Agency Structure Diagram", mermaidOrg()));
  pages.push(page(5, "Department Register", table(departments)));
  pages.push(page(6, "Reporting Structure", `
Kevin L. Gardner is the human authority. Executive Command reports to Kevin. Constitution and Governance protects mission alignment. Program Direction coordinates delivery. Architecture and Platform protects system shape. Memory and Intelligence protects the data substrate. Product Surfaces owns user-facing execution. Agent Operations owns runtime agents. Compliance and Trust protects policy and relationships. QA and Verification protects release confidence. Documentation and Training turns truth into usable knowledge. Operations and Live Systems keeps the company awake.

No department may create its own private authority. Authority is explicit, logged, and reviewable.
`));
  pages.push(page(7, "Company Operating Model", `
The company operates through six repeating loops:

${list([
  "Strategy loop: Kevin directive -> Executive framing -> decision record -> program plan.",
  "Delivery loop: work leaf -> implementation -> verification -> documentation -> handoff.",
  "Memory loop: event -> canonical write -> semantic summary -> graph relationship -> retrieval package.",
  "Agent loop: trigger -> context -> recommendation -> human action -> outcome -> feedback.",
  "Compliance loop: draft -> rule check -> pass/warn/block -> safe alternative -> audit.",
  "Learning loop: observation -> recommendation -> outcome -> feedback -> governed pattern update."
])}
`));
  pages.push(page(8, "Memory Architecture", mermaidMemory()));
  pages.push(page(9, "Agent Lifecycle", mermaidAgentLifecycle()));
  pages.push(page(10, "Escalation Sequence", mermaidEscalation()));

  departments.forEach((dept, idx) => {
    pages.push(page(11 + idx, `${dept.name} Charter`, `
## Purpose
${dept.purpose}

## Owner
${dept.owner}

## Reports To
${dept.reportsTo}

## Responsibilities
${list([
  `Maintain the operating standards for ${dept.name}.`,
  "Translate governing documents into executable procedures.",
  "Protect source hierarchy and auditability.",
  "Coordinate with dependent departments before changing shared behavior.",
  "Produce outputs that humans and agents can verify."
])}

## Inputs
${list(["Kevin directives", "locked spec", "decision ledger", "build registry", "wireframe leaves", "audit findings", "runtime events"])}

## Outputs
${list(dept.outputs)}

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.
`));
  });

  const operatingTopics = [
    "Human Authority",
    "Source Hierarchy",
    "Department Interfaces",
    "Decision Currency",
    "Work Queue Governance",
    "Release Governance",
    "Triple Stack Persistence",
    "GraphRAG Evidence",
    "Prompt Governance",
    "Schema Governance",
    "Compliance Boundaries",
    "Prospect Surface Restrictions",
    "BA Surface Responsibilities",
    "Admin Surface Responsibilities",
    "Sponsor Immutability",
    "Position Monotonicity",
    "Token Lifecycle",
    "Agent Recommendation Policy",
    "Audit Log Substrate",
    "Incident Governance",
    "Operational Metrics",
    "Visual Quality",
    "Documentation Discipline",
    "Research Discipline",
    "QA Gates",
    "Knowledge Flow",
    "Escalation Flow",
    "Collaboration Flow",
    "Memory Review",
    "Future Expansion"
  ];

  operatingTopics.forEach((topic, idx) => {
    pages.push(page(23 + idx, topic, `
## Constitutional Rule
${topic} exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: ${departments[idx % departments.length].name}. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
${list(["governing source", "canonical state", "agent event", "human correction", "runtime evidence"])}

## Outputs
${list(["decision", "recommendation", "audit entry", "handoff note", "documentation update"])}

## Rules
${list([
  "Do not proceed on memory alone when a source exists.",
  "Do not treat semantic similarity as proof.",
  "Do not create hidden or private state.",
  "Do not collapse human roles into agent authority.",
  "Do not weaken compliance to improve speed.",
  "Do not publish facts without source or uncertainty label."
])}

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.
`));
  });

  const workflows = [
    "Feature Intake",
    "Governance Review",
    "Architecture Review",
    "Prompt Review",
    "Schema Review",
    "Implementation Dispatch",
    "Agent Runtime Invocation",
    "Recommendation Creation",
    "Compliance Screening",
    "Memory Write",
    "QA Verification",
    "Release Readiness",
    "Incident Response",
    "Handoff Creation",
    "Learning Note Capture",
    "Documentation Update",
    "Research Claim Validation",
    "Admin Operational Review",
    "Live Ops Monitoring",
    "Future Agent Onboarding"
  ];

  workflows.forEach((wf, idx) => {
    pages.push(page(53 + idx, `${wf} Workflow`, `
## Purpose
The ${wf} workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
${list([
  "Classify the request or event.",
  "Identify owner and supporting departments.",
  "Retrieve governing sources and canonical records.",
  "Check permissions, compliance, and privacy.",
  "Produce the smallest complete output that satisfies the mission.",
  "Verify with tests, readback, or source review.",
  "Record outcome and any unresolved risk."
])}

## Inputs
${list(["source documents", "entity records", "runtime logs", "human instructions", "agent context"])}

## Outputs
${list(["workflow result", "audit event", "recommendation", "handoff item", "documentation change"])}

## State Machine
\`\`\`mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
\`\`\`
`));
  });

  const matrices = [
    "Department Permission Matrix",
    "Agent Permission Matrix",
    "Memory Permission Matrix",
    "Surface Boundary Matrix",
    "Compliance Boundary Matrix",
    "Escalation Severity Matrix",
    "Release Gate Matrix",
    "Data Ownership Matrix",
    "Prompt Ownership Matrix",
    "Future Expansion Matrix"
  ];

  matrices.forEach((m, idx) => {
    pages.push(page(73 + idx, m, `
| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named ${m} is deny-by-default. Permission expands only by explicit governance decision, not convenience.
`));
  });

  const expansionTopics = [
    "Future Department Creation",
    "Future Agent Creation",
    "Future Surface Creation",
    "Future Memory Collection",
    "Future Prompt Slot",
    "Future External Integration",
    "Future Compliance Rule",
    "Future Reporting Surface",
    "Future Tenant Expansion",
    "Future Governance Audit"
  ];

  expansionTopics.forEach((topic, idx) => {
    pages.push(page(83 + idx, topic, `
## Expansion Test
Before approving ${topic}, the organization must answer:

${list([
  "What human momentum problem does this solve?",
  "Which existing department owns it?",
  "Which schemas are affected?",
  "Which agents need permission changes?",
  "Which prompts change?",
  "Which stores receive writes?",
  "Which audit events prove what happened?",
  "Which compliance rules apply?",
  "Which QA gates verify it?",
  "How is rollback handled?"
])}

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.
`));
  });

  for (let n = 93; n <= 150; n++) {
    const dept = departments[(n - 93) % departments.length];
    pages.push(page(n, `Operational Handbook Article ${n}`, `
## Article Focus
This article applies ${dept.name} discipline to the full Momentum AI Organization.

## Principle
${dept.purpose}

## Standing Responsibilities
${list([
  "Protect human authority.",
  "Use the source hierarchy before acting.",
  "Preserve compliance and relationship trust.",
  "Keep memory traceable across Mongo, Neo4j, and Chroma.",
  "Escalate ambiguity instead of inventing certainty.",
  "Document decisions where future agents will look.",
  "Verify critical writes and release gates."
])}

## Inputs
${list(["Kevin directive", "decision ledger", "locked spec", "project wireframe", "runtime evidence", "human correction"])}

## Outputs
${list(["actionable decision", "verified artifact", "audit record", "agent-ready documentation", "handoff note"])}

## Interaction Diagram
\`\`\`mermaid
flowchart LR
  Human[Human Direction] --> Department[${dept.name}]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
\`\`\`

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.
`));
  }

  return `# Momentum AI Organization\n\nGenerated: ${today}\n\n${pages.join("\n")}`;
}

function generateDirectory() {
  const pages = [];
  pages.push(page(1, "Directory Source Basis", sourceBasis()));
  pages.push(page(2, "Agent Directory Purpose", `
This directory identifies every current and planned AI agent in the Momentum AI Organization. Each agent receives mission, responsibilities, inputs, outputs, permissions, memory, communication, escalation, workflows, prompt, APIs, testing, and future expansion.

The directory is not a personality catalog. It is an authority map.
`));
  pages.push(page(3, "Agent Hierarchy", `
${mermaidOrg()}

## Hierarchy Rule
Agents do not outrank humans. Agents do not approve their own expansion. Agents operate by mission, permission, evidence, and audit.
`));
  pages.push(page(4, "Universal Agent Contract", `
Every agent obeys this contract:

${list([
  "Mission is explicit.",
  "Permissions are deny-by-default.",
  "Outputs are recommendations or drafts unless human approval is explicit.",
  "Memory writes are governed and auditable.",
  "Chroma is semantic, not truth.",
  "Neo4j relationships must be real.",
  "Mongo canonical records win for operational state.",
  "Compliance and privacy boundaries outrank usefulness.",
  "Human correction outranks agent inference."
])}
`));
  pages.push(page(5, "Universal Testing Standard", `
Each agent must pass normal, edge, missing-context, compliance, permission, source-conflict, escalation, and regression tests. Any agent that cannot identify its sources, prompt version, permission policy, or escalation path is not production-ready.
`));

  let p = 6;
  agentSpecs.forEach((agent) => {
    pages.push(agentContract(agent, p++));
  });

  const futureAgents = [
    "Security Agent",
    "Privacy Agent",
    "Release Manager Agent",
    "Incident Commander Agent",
    "Data Steward Agent",
    "Schema Steward Agent",
    "Prompt Steward Agent",
    "GraphRAG Retrieval Agent",
    "Audit Agent",
    "Broadcast Agent",
    "Live Ops Agent",
    "Reporting Agent",
    "Tenant Agent",
    "Master Content Agent",
    "Prospect Reentry Agent",
    "Token Lifecycle Agent",
    "Webinar Agent",
    "Orientation Agent",
    "Launch Agent",
    "Leadership Agent",
    "Mentorship Agent",
    "Recognition Agent",
    "Customer Success Agent",
    "Support Agent",
    "Visual QA Agent",
    "Accessibility Agent",
    "Performance Agent",
    "Database Projection Agent",
    "Outbox Agent",
    "Sync Agent",
    "Route Inventory Agent",
    "UX Review Agent",
    "Training Curriculum Agent",
    "Product Knowledge Agent",
    "Market Intelligence Agent",
    "Legal Research Agent",
    "Handoff Agent",
    "Thread Registry Agent",
    "Agent Message Board Agent",
    "Learning Note Agent",
    "Archive Agent",
    "Migration Agent",
    "Retirement Agent"
  ];

  futureAgents.forEach((name) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    pages.push(agentContract({
      id,
      name,
      department: departments[p % departments.length].name,
      mission: `Provide governed support for ${name.replace(" Agent", "").toLowerCase()} responsibilities without exceeding explicit authority.`,
      responsibilities: ["observe scoped events", "retrieve governed context", "recommend safe action", "record outcome", "escalate ambiguity"],
      inputs: ["canonical records", "semantic context", "graph context", "governance rules", "human feedback"],
      outputs: ["recommendation", "observation", "escalation", "audit event", "knowledge gap"],
      permissions: ["read scoped context", "write governed observations", "request review", "record outcomes"],
      denied: ["create autonomous policy", "act without permission", "hide uncertainty", "write partial memory"]
    }, p++));
  });

  while (p <= 150) {
    const agent = agentSpecs[(p - 1) % agentSpecs.length];
    pages.push(page(p, `${agent.name} Expansion and Review Appendix`, `
## Expansion Review
${agent.name} may expand only when governance confirms that the expansion serves human transformation, preserves trust, and has a complete data, prompt, permission, and testing package.

## Required Expansion Packet
${list([
  "new mission or unchanged mission statement",
  "new inputs and outputs",
  "permission delta",
  "memory write plan",
  "prompt slot and version",
  "API contract",
  "QA plan",
  "compliance review",
  "rollback plan",
  "retirement criteria"
])}

## State Machine
\`\`\`mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Review
  Review --> Approved
  Review --> Rejected
  Approved --> Active
  Active --> Monitored
  Monitored --> Revised
  Revised --> Review
  Monitored --> Retired
  Retired --> [*]
\`\`\`

## Boundary
Expansion never means more autonomy by default. Expansion means better governed service.
`));
    p++;
  }

  return `# Momentum Agent Directory\n\nGenerated: ${today}\n\n${pages.join("\n")}`;
}

function generateProtocol() {
  const pages = [];
  pages.push(page(1, "Protocol Source Basis", sourceBasis()));
  pages.push(page(2, "Communication Protocol Purpose", `
This protocol defines how agents, departments, humans, memory systems, and product surfaces communicate. It covers agent messages, escalation, knowledge flow, collaboration, state machines, sequence diagrams, permissions, boundaries, APIs, testing, and future expansion.
`));
  pages.push(page(3, "Canonical Communication Channels", `
| Channel | Purpose | Authority |
|---|---|---|
| Human directive | Kevin or authorized human instruction | highest runtime priority |
| Decision ledger | active decisions | decision currency |
| Agent message board | asynchronous agent coordination | operational communication |
| Audit log | immutable operational evidence | accountability |
| Handoff | session continuity | artifact, not identity authority |
| Chat registry | chat/thread identity | identity authority |
| Recommendation record | agent guidance | support, not command |
| Escalation record | boundary or risk routing | governance flow |
`));
  pages.push(page(4, "Universal Message Envelope", `
\`\`\`json
{
  "message_id": "msg_...",
  "schema_version": 1,
  "from_agent": "",
  "to_agent": "",
  "department": "",
  "workflow_id": "",
  "entity_type": "",
  "entity_id": "",
  "message_type": "",
  "priority": "normal",
  "status": "unread",
  "purpose": "",
  "payload": {},
  "evidence_refs": [],
  "created_at": "ISO-8601Z",
  "read_at": null,
  "resolved_at": null
}
\`\`\`

Every durable agent-to-agent post must be written through a governed multi-store path when it becomes persistent memory.
`));
  pages.push(page(5, "Message State Machine", `
\`\`\`mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Posted
  Posted --> Unread
  Unread --> Read
  Read --> Actioned
  Read --> Replied
  Replied --> Actioned
  Unread --> Stale
  Actioned --> Archived
  Stale --> Archived
  Archived --> [*]
\`\`\`
`));
  pages.push(page(6, "Escalation Protocol", mermaidEscalation()));
  pages.push(page(7, "Knowledge Flow", mermaidMemory()));

  const messageTypes = [
    "agent_context_requested",
    "agent_context_returned",
    "agent_review_requested",
    "agent_review_completed",
    "agent_handoff_created",
    "agent_handoff_accepted",
    "agent_conflict_detected",
    "agent_escalation_requested",
    "agent_outcome_reported",
    "agent_feedback_reported",
    "compliance_review_requested",
    "compliance_block_issued",
    "qa_gate_requested",
    "qa_gate_completed",
    "memory_write_requested",
    "memory_write_verified",
    "source_conflict_detected",
    "decision_needed",
    "human_approval_requested",
    "incident_declared",
    "incident_resolved",
    "release_ready",
    "release_blocked",
    "prompt_review_requested",
    "schema_review_requested",
    "knowledge_gap_detected",
    "documentation_update_requested",
    "research_claim_requested",
    "agent_retirement_requested",
    "future_expansion_requested"
  ];

  let p = 8;
  messageTypes.forEach((type) => {
    pages.push(page(p++, `Message Type: ${type}`, `
## Purpose
${type} coordinates bounded work between agents or departments.

## Required Fields
${list(["message_id", "from_agent", "to_agent", "workflow_id", "entity reference", "purpose", "payload", "evidence_refs", "priority", "created_at"])}

## Allowed Senders
Any agent whose permission policy includes the related workflow.

## Allowed Recipients
The owning agent, department queue, governance queue, QA queue, or human approval queue.

## Processing Rules
${list([
  "Read highest priority first.",
  "Preserve parent message; replies are new messages with replies_to.",
  "Do not mutate evidence after posting.",
  "Mark read with read_at and read_by.",
  "Mark actioned only after the requested action or valid escalation occurs.",
  "Critical priority blocks dependent workflows until processed."
])}

## Output
An actioned message, reply, escalation, audit event, recommendation, or documented no-action rationale.
`));
  });

  const flows = [
    "Human Directive Intake",
    "Agent Context Request",
    "Compliance Review",
    "QA Release Gate",
    "Memory Write Verification",
    "Source Conflict Resolution",
    "Prompt Change Approval",
    "Schema Change Approval",
    "Feature Handoff",
    "Incident Escalation",
    "Research Claim Validation",
    "Documentation Publication",
    "Future Agent Onboarding",
    "Agent Retirement",
    "Learning Feedback Loop",
    "Recommendation Outcome Loop",
    "GraphRAG Retrieval Loop",
    "Session Start",
    "Session End",
    "Intervector Message Processing"
  ];

  flows.forEach((flow) => {
    pages.push(page(p++, `${flow} Sequence`, `
## Sequence Diagram
\`\`\`mermaid
sequenceDiagram
  participant H as Human or Trigger
  participant O as Orchestrator
  participant K as Knowledge Agent
  participant C as Compliance
  participant Q as QA
  participant M as Memory
  H->>O: ${flow} request
  O->>K: retrieve governed context
  K-->>O: evidence package
  O->>C: boundary check when needed
  C-->>O: pass, warn, block, or escalate
  O->>Q: verification request when artifact changes
  Q-->>O: verification result
  O->>M: persist audit, recommendation, or handoff
  M-->>O: readback verified
  O-->>H: result or escalation
\`\`\`

## Inputs
${list(["trigger", "source documents", "canonical records", "permission policy", "evidence package"])}

## Outputs
${list(["answer", "recommendation", "block", "escalation", "audit event", "verified memory"])}

## Boundary
The ${flow} sequence may not skip source retrieval, permission checks, compliance review when applicable, or critical readback.
`));
  });

  const states = [
    "Recommendation",
    "Escalation",
    "Prompt Version",
    "Schema Change",
    "Memory Record",
    "Audit Event",
    "Handoff",
    "Agent Runtime",
    "Incident",
    "Release Gate",
    "Research Brief",
    "Documentation Page",
    "Decision Record",
    "Work Queue Leaf",
    "Agent Message",
    "GraphRAG Package",
    "Compliance Review",
    "QA Finding",
    "Operational Alert",
    "Learning Note"
  ];

  states.forEach((state) => {
    pages.push(page(p++, `${state} State Machine`, `
\`\`\`mermaid
stateDiagram-v2
  [*] --> Created
  Created --> Validated
  Validated --> Active
  Active --> Reviewed
  Reviewed --> Accepted
  Reviewed --> Rejected
  Active --> Escalated
  Escalated --> Resolved
  Accepted --> Archived
  Rejected --> Archived
  Resolved --> Archived
  Archived --> [*]
\`\`\`

## Transition Rules
${list([
  "Created requires an owner.",
  "Validated requires schema and permission checks.",
  "Active requires a clear workflow purpose.",
  "Reviewed requires evidence.",
  "Accepted, rejected, or resolved requires an audit event.",
  "Archived preserves history and does not erase evidence."
])}
`));
  });

  const apiTopics = [
    "Agent Message API",
    "Recommendation API",
    "Escalation API",
    "Memory API",
    "GraphRAG API",
    "Prompt Registry API",
    "Schema Registry API",
    "Audit API",
    "QA API",
    "Research API",
    "Documentation API",
    "Operations API",
    "Compliance API",
    "Program Status API",
    "Agent Directory API"
  ];

  apiTopics.forEach((api) => {
    pages.push(page(p++, api, `
## Purpose
${api} gives the organization a governed interface for communication and traceability.

## Request Shape
\`\`\`json
{
  "request_id": "req_...",
  "actor": "",
  "purpose": "",
  "entity_refs": [],
  "payload": {},
  "evidence_refs": [],
  "created_at": "ISO-8601Z"
}
\`\`\`

## Response Shape
\`\`\`json
{
  "ok": true,
  "status": "",
  "result_ref": "",
  "warnings": [],
  "escalation_ref": null,
  "audit_ref": ""
}
\`\`\`

## Testing
Test success, malformed payload, permission denied, source conflict, partial persistence, compliance block, and readback verification.
`));
  });

  while (p <= 150) {
    pages.push(page(p, `Protocol Appendix ${p}`, `
## Operating Rule
Every communication must be purposeful, scoped, auditable, and linked to the human or workflow need it serves.

## Collaboration Rules
${list([
  "Use the message board for asynchronous agent coordination.",
  "Use replies rather than mutating parent messages.",
  "Use explicit priority and status.",
  "Use evidence references.",
  "Normalize legacy statuses on read.",
  "Escalate critical blocks before user-facing claims.",
  "Mention unresolved outbound messages in session handoff.",
  "Do not send secrets or raw tokens through messages."
])}

## Memory Rules
${list([
  "Mongo owns complete records.",
  "Neo4j owns relationships.",
  "Chroma owns semantic retrieval.",
  "GraphRAG packages context with evidence.",
  "Critical writes require readback.",
  "Schema-enforced envelopes are required for new memory lineage records."
])}

## Interaction Diagram
\`\`\`mermaid
flowchart TD
  Trigger[Trigger] --> Message[Governed Message]
  Message --> Permission[Permission Check]
  Permission --> Context[Context Retrieval]
  Context --> Boundary[Compliance and Privacy Boundary]
  Boundary --> Action[Action or Recommendation]
  Action --> Verify[Verification]
  Verify --> Persist[Memory and Audit]
  Persist --> Handoff[Handoff or Outcome]
\`\`\`
`));
    p++;
  }

  return `# Momentum Agent Communication Protocol\n\nGenerated: ${today}\n\n${pages.join("\n")}`;
}

const ARTIFACT_BANNER = `> **Generated Reference Manual — Not Constitutional Authority.** Source-of-truth documents live in \`constitution/\` and governing architecture documents.\n\n`;
writeFileSync(join(outDir, "MOMENTUM_AI_ORGANIZATION.md"), ARTIFACT_BANNER + generateOrganization(), "utf8");
writeFileSync(join(outDir, "MOMENTUM_AGENT_DIRECTORY.md"), ARTIFACT_BANNER + generateDirectory(), "utf8");
writeFileSync(join(outDir, "MOMENTUM_AGENT_COMMUNICATION_PROTOCOL.md"), ARTIFACT_BANNER + generateProtocol(), "utf8");

console.log("Compiled reference manuals (build artifacts) to docs/reference-manuals/:");
console.log("docs/reference-manuals/MOMENTUM_AI_ORGANIZATION.md");
console.log("docs/reference-manuals/MOMENTUM_AGENT_DIRECTORY.md");
console.log("docs/reference-manuals/MOMENTUM_AGENT_COMMUNICATION_PROTOCOL.md");
