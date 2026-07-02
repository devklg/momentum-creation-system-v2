# DECISION — La'Mont Is the Local Voice Layer for MCS V2

## Momentum Creation System V2

Status: **Recorded — implementation direction approved by Kevin in working session, 2026-07-01.**

Type: Runtime Input/Output Boundary / Local Companion App / Agent UX.

Risk: Medium-high. Voice capture touches privacy, consent, transcripts, agent context, and knowledge ingestion. The decision authorizes planning and implementation routing only; it does not authorize hidden capture, prospect-facing voice, direct store writes, or automatic knowledge approval.

---

## 1. Decision

La'Mont is the approved **local voice layer** for Momentum Creation System V2.

La'Mont is not a MCS agent. La'Mont is a Windows-local companion app that provides:

- speech-to-text for BA/user input;
- text-to-speech for agent responses, prompts, summaries, and confirmations;
- optional dictation into ordinary text fields;
- future structured handoff of final transcripts into MCS runtime endpoints.

MCS V2 remains the system of record. MCS owns authentication, authorization, session identity, persistence, Context Manager retrieval, GraphRAG/knowledge ingestion, audit, and governance.

---

## 2. Boundary

La'Mont handles local voice I/O only:

```text
microphone -> La'Mont STT -> transcript text -> MCS runtime endpoint
MCS agent response text -> La'Mont TTS -> local speaker output
```

La'Mont must not:

- write directly to MongoDB, Neo4j, ChromaDB, or GraphRAG;
- assemble Context Packets;
- approve knowledge;
- create active knowledge;
- bypass MCS authentication or member scope;
- run hidden microphone capture;
- become prospect-facing on `.com`;
- replace required text fallback.

Every MCS-bound voice turn must preserve the same identity envelope as browser text/voice:

```text
tenantId
teamId
teamKey = "team_magnificent"
tmagId / baId pre-migration alias
sessionId
agentKey
language
mode
correlationId
```

---

## 3. Relationship To Existing Browser Voice/Text Runtime

The existing Browser Voice/Text foundation remains valid.

La'Mont adds a second input/output provider:

- **Browser provider:** browser speech recognition/synthesis where available.
- **La'Mont provider:** Windows-local STT/TTS companion for Kevin and Windows users.
- **Text fallback:** always available and always sufficient to complete the workflow.

MCS should model this as a provider choice under the internal `.team` runtime, not as separate agent behavior.

Candidate mode naming:

```text
browser_text
browser_voice
lamont_voice
mixed
```

Exact enum changes are deferred to the implementation slice; this decision fixes the boundary and intent.

---

## 4. Agent Coverage

La'Mont may serve all authenticated BA-facing agent workflows:

- Steve Success discovery / success-profile conversations;
- Michael Magnificent training and daily-success support;
- Ivory invitation/script drafting;
- admin-only notes, review, and operational capture;
- future BA-facing agents that interview, coach, gather notes, or ask clarifying questions.

The integration must be system-wide. It must not be hard-coded only to one interview page.

---

## 5. Knowledge And Learning Pipeline

Voice conversations are valuable raw knowledge inputs, but only through governed MCS paths.

Required flow:

```text
La'Mont final transcript
  -> MCS runtime turn / interview endpoint
  -> raw transcript preserved
  -> structured artifact when applicable
  -> governed ingestion/candidate pipeline
  -> Context Manager retrieval only after approval/scope rules permit
```

Phase 9 Learning Pipeline may consume La'Mont-originated runtime outcomes and transcript-derived signals only under the same rules as browser voice/text:

- learning may propose candidates;
- learning may not approve knowledge;
- private/journal material remains private unless selected by the BA;
- raw transcripts remain scoped to the authenticated member/session/agent;
- transcript text is not broadly copied into runtime events.

---

## 6. Production Topology

In production, La'Mont remains local on the user's Windows machine. Hosted MCS receives only authenticated transcript/turn payloads and returns agent response text for display and optional local speech.

```text
Windows machine
  La'Mont local STT/TTS
    -> hosted MCS V2 API/runtime
      -> Context Manager
      -> governed persistence / learning / knowledge ingestion
```

La'Mont is installed per workstation. It is not hosted like a website because microphone capture, keyboard input, and speaker output belong on the local machine.

---

## 7. Implementation Consequences

Future implementation should add:

1. A local La'Mont bridge contract for final transcripts and TTS requests.
2. Runtime provider metadata so MCS can distinguish `browser_voice` from `lamont_voice`.
3. `.team` UI controls that can use La'Mont when available and text fallback otherwise.
4. Runtime events for capability, connection, transcript, speech-started, speech-completed, fallback, and error.
5. QA checks proving La'Mont remains `.team`/authenticated only and cannot touch `.com`.
6. A production installer/taskbar path after La'Mont branding is complete.

---

## 8. Structured Record

```json
{
  "decision_id": "DECISION-lamont-local-voice-layer",
  "title": "La'Mont is the local voice layer for MCS V2",
  "status": "recorded",
  "risk_level": "medium_high",
  "change_type": "runtime-input-output-boundary",
  "recorded_at": "2026-07-01",
  "approved_by": "Kevin L. Gardner",
  "authorizes_store_write": false,
  "authorizes_prospect_facing_voice": false,
  "authorizes_hidden_capture": false,
  "provider_role": "local_stt_tts_companion",
  "mcs_role": "auth_scope_persistence_context_ingestion_governance"
}
```

