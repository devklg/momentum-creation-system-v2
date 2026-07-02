# MCS V2 — Database Architecture ERD

Entity-relationship view of the dedicated triple-stack, **canonical (Rev 2) names**
(`tmag_` app-domain · `mcs_` system/memory). Mongo `momentum`@30000 is the source of
truth; Neo4j@7710 mirrors relationships; Chroma@8200 mirrors vectors. The diagrams
below are the **relationship map** — the companion to `MCS_V2_CANONICAL_SCHEMAS.docx`
(which is the field-level list). Renders in GitHub / VS Code / any Mermaid viewer.

> Cross-store rule: every Mongo write is *projected* into Neo4j + Chroma via
> `tmag_projection_outbox` (durable retry). The same entity keeps the **same name**
> across all three stores.

---

## 1 · Identity & Membership (the downline)

```mermaid
erDiagram
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TEAM_MAGNIFICENT_MEMBERS : "sponsors (downline)"
  TEAM_MAGNIFICENT_MEMBERS ||--|| TMAG_ACCESS_CODES : "holds one for life"
  TMAG_ACCESS_CODES ||--o{ TMAG_PROSPECTS : "redeemed → sponsors"
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_COMMITMENTS : signs
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_QUESTIONNAIRES : submits
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_WORKBOOKS : "sponsor conducts"
  TEAM_MAGNIFICENT_MEMBERS ||--o| TMAG_STEVE_SUCCESS_INTERVIEW : completes
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_FAST_START_PROGRESS : progresses

  TEAM_MAGNIFICENT_MEMBERS {
    string tmagId PK "TMAG-YYYYMMDD-XXXXXX"
    string threeBaId "III credential (never authenticates)"
    string sponsorTmagId FK "immutable"
    string accessCodeHeld FK
  }
  TMAG_ACCESS_CODES {
    string code PK "TMAG-XXXX"
    string sponsorTmagId FK
    bool active
  }
```

*Eligibility is structural: only Kevin mints codes; each member reuses one code to
sponsor; sponsor is immutable → the member set **is** Kevin's downline.*

---

## 2 · Prospect funnel (holding tank → CRM → webinar)

```mermaid
erDiagram
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_PROSPECTS : "sponsors"
  TMAG_PROSPECTS ||--|| TMAG_PROSPECT_INVITE_TOKENS : "has token"
  TMAG_PROSPECTS ||--o| TMAG_PROSPECT_HTANK_PLACEMENTS : "placed in pool"
  TMAG_PROSPECTS ||--o| TMAG_PROSPECT_HTANK_ACCOUNTS : "re-entry"
  TMAG_PROSPECT_HTANK_ACCOUNTS ||--o{ TMAG_PROSPECT_MAGIC_LINKS : "SMS re-entry"
  TMAG_PROSPECTS ||--o{ TMAG_PROSPECT_CALLBACK_REQUESTS : "raises hand"
  TMAG_PROSPECTS ||--o{ TMAG_PROSPECT_INVITATION_ACTIVITY : timeline
  TMAG_PROSPECTS ||--o{ TMAG_PROSPECT_CRM_NOTES : notes
  TMAG_PROSPECTS ||--o{ TMAG_PROSPECT_CRM_FOLLOWUPS : reminders
  TMAG_PROSPECTS ||--o| TMAG_PROSPECT_CRM_DISPOSITIONS : disposition
  TMAG_PROSPECTS ||--o| TMAG_PROSPECT_CRM_RECORDS : "VM CRM"
  TMAG_PROSPECTS ||--o{ TMAG_PROSPECT_TIMELINE_EVENTS : "VM timeline"
  TMAG_PROSPECT_WEBINAR_EVENTS ||--o{ TMAG_PROSPECT_WEBINAR_RESERVATIONS : seats
  TMAG_PROSPECTS ||--o{ TMAG_PROSPECT_WEBINAR_RESERVATIONS : reserves

  TMAG_PROSPECTS {
    string prospectId PK
    string sponsorTmagId FK "immutable"
    string token FK
    string state "minted→…→enrolled|expired"
    bool becameCustomer
  }
  TMAG_PROSPECT_HTANK_PLACEMENTS {
    string prospectId PK
    int positionNumber "monotonic, never renumbered"
    date flushedAt
  }
  TMAG_PROSPECT_WEBINAR_RESERVATIONS {
    string reservationId PK
    string attendance "yes|no|missed|rescheduled"
    date scheduledFor
    date rescheduledTo
  }
```

*A single team-wide `TMAG_PROSPECT_HTANK_COUNTERS` singleton anchors pool position.*

---

## 3 · New-member onboarding

```mermaid
erDiagram
  TMAG_NEW_MEMBER_ORIENTATION_SESSIONS ||--o{ TMAG_NEW_MEMBER_ORIENTATION_RESERVATIONS : "seats (cap 10)"
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_NEW_MEMBER_ORIENTATION_RESERVATIONS : reserves
```

---

## 4 · Agents · Templates · Memory / Learning (the loop)

```mermaid
erDiagram
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_AGENT_IVORY_EVENTS : interacts
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_AGENT_MICHAEL_EVENTS : interacts
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_AGENT_STEVE_EVENTS : interacts
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_IVORY_PROSPECT_NAMES : "warm market"
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_INVITATION_GENERATOR_RUNS : generates

  TMAG_AGENT_TEMPLATES }o--o{ MCS_GRAPHRAG_RECORDS : "pull active knowledge"
  MCS_OUTCOMES }o--|| TEAM_MAGNIFICENT_MEMBERS : "confirmed by"
  MCS_OUTCOMES }o--o| TMAG_PROSPECTS : "about"
  MCS_LEARNING_CANDIDATES }o--o{ MCS_OUTCOMES : "derived from"
  MCS_LEARNING_CANDIDATES ||--o| MCS_GRAPHRAG_RECORDS : "Kevin approves →"
  MCS_AUDIT_LOG }o--|| TEAM_MAGNIFICENT_MEMBERS : "actor"

  TMAG_AGENT_TEMPLATES {
    string templateId PK
    string agentKey "ivory|michael|steve|…"
    string templateKind "learning|interviewing|invitation"
    string knowledgeDomains "pulled at runtime"
  }
  MCS_OUTCOMES {
    string id PK
    string kind "pending|enrolled_iii|became_customer|declined"
    string confirmedByTmagId FK
  }
  MCS_LEARNING_CANDIDATES {
    string id PK
    string status "proposed → (Kevin) approved"
    string sourceOutcomeIds "provenance"
  }
  MCS_GRAPHRAG_RECORDS {
    string id PK
    bool retrievalReady "active knowledge"
  }
```

**The learning loop:** outcomes (signal) → learning candidates (proposed, **Kevin
approves**) → GraphRAG active knowledge → the agent templates pull it → better agent
behavior → new outcomes. No agent may approve knowledge.

---

## 5 · Voicemail (VM/RVM) · Broadcast

```mermaid
erDiagram
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_VM_LEAD_BATCHES : owns
  TMAG_VM_LEAD_BATCHES ||--o{ TMAG_VM_CAMPAIGNS : "runs"
  TMAG_VM_LEAD_BATCHES ||--o{ TMAG_VM_BULK_LEADS : contains
  TMAG_VM_CAMPAIGNS ||--o{ TMAG_VM_BULK_LEADS : targets
  TMAG_VM_CAMPAIGNS ||--o{ TMAG_VM_DELIVERY_EVENTS : delivers
  TMAG_VM_QUEUE_JOBS ||--o{ TMAG_VM_DELIVERY_EVENTS : drives
  TMAG_VM_PROVIDER_WEBHOOK_EVENTS ||--o{ TMAG_VM_DELIVERY_EVENTS : "updates status"

  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_BROADCASTS : "Kevin sends"
  TMAG_BROADCASTS ||--o{ TMAG_BROADCAST_RECIPIENTS : "one row/recipient"
  TEAM_MAGNIFICENT_MEMBERS ||--o{ TMAG_BROADCAST_RECIPIENTS : receives
  TMAG_BROADCAST_OPTOUTS }o--|| TEAM_MAGNIFICENT_MEMBERS : "global STOP"
```

---

## 6 · Neo4j graph shape (relationship mirror)

```mermaid
erDiagram
  TeamMagnificentMember ||--o{ TeamMagnificentMember : SPONSORED_BY
  TeamMagnificentMember }o--|| TeamMagnificent : MEMBER_OF
  TmagProspect }o--|| TeamMagnificentMember : SPONSORED_BY
  TmagProspect ||--|| TmagInviteToken : HAS_TOKEN
  TmagOutcome }o--|| TeamMagnificentMember : CONFIRMED_BY
  TmagOutcome }o--o| TmagProspect : ABOUT_PROSPECT
  TmagLearningCandidate }o--o{ TmagOutcome : DERIVED_FROM
  TmagKnowledge }o--|| TeamMagnificent : SCOPED_TO
  TmagAuditEntry }o--|| TeamMagnificentMember : ACTED_FOR
```

*Business-key labels (`TmagInviteToken`, `TmagAccessCode`, `TmagWebinarEvent`,
`TmagIvoryName`, `TmagBroadcast`, `TmagVmCampaign`, …) each get a uniqueness
constraint; the set grows with features (P10 §6).*

---

### Legend
`||--o{` one-to-many · `||--||` one-to-one · `}o--||` many-to-one · `}o--o{` many-to-many.
PK = `_id` key · FK = reference to another collection. This ERD is the **relationship
companion** to the field-level `MCS_V2_CANONICAL_SCHEMAS.docx`; both use the Rev 2
canonical names and are the reference for M6 provisioning.
