# P7.15 — Agent Behavior Model: Template + Approved Knowledge + Gated LLM (all human-approved)

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.15 (architecture note — DOCS ONLY)
- Status: **DESIGN NOTE — nothing running.** The app has not launched; every agent surface and the LLM are **dormant** by design. This records *how* agents will behave once enabled, and why.
- Base: `feature/phase-07-outcomes-learning-graphrag`.
- Aligns to: `KNOWLEDGE_EVOLUTION_RUNTIME.md`, `AGENT_RUNTIME` / Michael runtime (Phase 6 response catalog + contract), `CONTEXT_MANAGER`, P7.5 (candidate approval), P7.6 (GraphRAG), P7.14 (learning measurement), compliance rules. Standing prohibitions: no `.com` compliance leakage; **no agent may approve knowledge**; no unconstrained LLM generation.

---

## 1. The model, in one line

> **Agent behavior = template/contract  +  approved knowledge (Context Packet)  +  a gated LLM — and every part is human-approved before it can affect a real interaction.**

The agent does not decide *what* to say or *which* questions to ask. A **template/contract** defines the allowed behavior; the **Context Manager** hands it human-**approved** knowledge; and where an **LLM** is used at all, it only phrases *within* those rails and **fails closed** on compliance. Nothing the agent says or asks was invented free-form at runtime.

---

## 2. The three layers

### 2.1 Template / contract layer — *what the agent is allowed to do and ask*
The agent's behavior is bounded by a curated **contract**, not open generation:
- **Michael** runs off a **response catalog + response contract** (Phase 6: `michaelResponseCatalog`, `michaelResponseContract`, `michaelRuntimeAdapterContract`) — curated, governance-bounded responses selected by contract, with static governance-boundary tests enforcing no persistence / no telephony / no free generation in that path.
- **Steve** runs a **structured discovery interview** — the "right questions" are the approved question set (Discovery & Success Interview → `steve_discoveries.successProfile`), not questions a model improvises.
- **Ivory / ScriptMaker** produces scripts, and where an LLM assists it is **compliance-gated** (ScriptMaker refuses noncompliant drafts; degrades to manual compose when no key).

The template is the guardrail: it makes behavior predictable, testable, and compliant **before** any knowledge or LLM is added.

### 2.2 Approved-knowledge layer — *what the agent knows*
The **Context Manager is the sole assembler** of the Context Packet. It fills the template with knowledge that is:
- retrieved via **GraphRAG** (P7.6) from the app's own stores,
- **active + `retrievalReady` + human-approved** only (candidates, superseded, and archived knowledge are excluded — P7.6 retrieval gate),
- scoped to Team Magnificent membership + language.

So the agent's *content* is human-approved organizational knowledge, not model memory.

### 2.3 Gated-LLM layer — *how it phrases, within the rails*
Where an LLM is used (ScriptMaker/Ivory; `ANTHROPIC_API_KEY`, **wired-dormant**), its job is narrow: phrase within the template using the approved Context Packet. It is bounded by:
- **compliance fail-closed** — noncompliant output is refused at script-time and render-time (income/comp/cycle/placement, AI-language on `.com`, THREE branding, etc.),
- **no free authority** — it cannot choose new questions, new claims, or new knowledge; it works inside the contract + packet.

Unconstrained generation is the risk the whole structure exists to prevent.

---

## 2a. Template taxonomy — the "roads" (Kevin, 2026-07-01)

**Templates are the road the agents operate on** — the structured track for an interaction; the agent travels back and forth along it (the conversational exchange) and cannot drive off-road. Three named roads, one per agent:

| Template (road) | The road *for* | Agent | Filled with (approved knowledge) | Compliance |
|---|---|---|---|---|
| **Learning template** | coaching/training a BA through development (Fast Start, ongoing) | **Michael** | approved training / coaching knowledge | BA-facing; no income/comp/cycle claims |
| **Interviewing template** | the structured discovery / success interview — asking the approved questions | **Steve** | approved question sets → `steve_discoveries.successProfile` | BA-facing |
| **Invitation template** | helping a BA craft a *compliant* invitation to a prospect | **Ivory / ScriptMaker** | approved, compliant invitation scripts (WDYK) | **HIGHEST** — nearest the prospect / `.com` edge; no income/placement/AI-language/THREE branding; ScriptMaker fails closed |

Every road obeys §1: the template bounds the back-and-forth, the Context Manager fills it with human-approved knowledge, the LLM (when enabled) only phrases within the lanes, and a *better road* (a better question or script) is a **candidate Kevin approves** before any agent drives it. The **invitation road carries the tightest guardrails** because it is closest to the prospect and the `.com` compliance boundary.

*(Agent↔template pairing to confirm with Kevin; the taxonomy itself — learning / interviewing / invitation — is set.)*

## 2b. The knowledge base is the operating system (Kevin, 2026-07-01)

Templates are an **open, extensible set**. New agent types get **new templates (roads)** in the future — and **every template, for every agent, pulls from the SAME governed knowledge base.** That single shared knowledge base is the **operating system of the operation**: the one substrate everything composes on.

The OS mapping:

| OS concept | MCS V2 |
|---|---|
| Kernel / OS | the one governed **knowledge base** (approved, versioned, measured) |
| Applications / roads | **templates** (learning · interviewing · invitation · …future) |
| Processes | **agents** (Michael · Steve · Ivory · …future) |
| Loader / scheduler | the **Context Manager** (assembles each agent's Context Packet) |
| Permission system | **Kevin's approval** (nothing runs unapproved) |
| Telemetry | the **learning-measurement layer** (P7.14) |

Why this is the beauty of it:
- **Add without forking.** A new agent + a new template plugs in and draws the same approved knowledge — no parallel knowledge silo, no re-governance.
- **One truth.** Every agent speaks from the same approved knowledge base, so they never contradict each other.
- **One gate.** Compliance and approval are governed **once**, at the knowledge base — not re-implemented per agent.
- **Compounding learning.** A single approved improvement to the knowledge base makes **every** agent that pulls from it better at once — learning compounds across the whole operation instead of per-agent.
- **Extensible by design.** The taxonomy (learning/interviewing/invitation) is the start, not the ceiling.

This is why the knowledge base — not any one agent — is the center of gravity: govern it, measure it, improve it, and the whole fleet of agents improves with it.

---

## 3. The approval gate covers BOTH knowledge AND templates/questions

This is the crux, and the answer to "where does approval come from" (P7.5):

- A better **question**, a better **script**, a better **template/response** is *itself* a **learning candidate**. It enters `detected`, and a **human (Kevin, TMAG-01 / founder-admin)** approves it — no agent, no timer, no automatic promotion.
- Only after approval → Knowledge Evolution → `retrievalReady` does it become behavior an agent can actually use.
- **The LLM never invents a new question and starts asking it.** The path is always: `proposed improvement → candidate → human approval → active → agents now ask the better question.`

So the same human gate that governs knowledge also governs how the agents *behave and ask* — there is no side door.

---

## 4. How the learning loop reaches agent behavior

```
outcomes → learning signals → candidates (new/better questions, scripts, knowledge)
   → HUMAN approval (Kevin)  → Knowledge Evolution → active + retrievalReady
   → Context Manager retrieves it → fills the agent's template
   → agent asks better questions / gives better guidance → better outcomes → (loop)
```

Templates are the **vehicle** through which learned, approved knowledge becomes what the agent actually does. P7.14 measures whether that loop is *working* (attribution/lift), never scoring a person.

---

## 5. Why this shape (the reasons, plainly)

1. **Compliance:** on a `.com`-adjacent, network-marketing-regulated surface, the wrong sentence is a real liability. Templates + fail-closed compliance make the safe path the only path.
2. **Governance:** "no agent may approve knowledge" and "Context Manager is sole assembler" are only enforceable if behavior comes from approved templates + approved knowledge, not free generation.
3. **No drift:** a learning system that could change what it says without human sign-off would drift away from what you sanctioned. The gate prevents that.
4. **Safe LLM use:** this is *how* you get the upside of an LLM (natural phrasing, scale) without handing it authority over claims, questions, or knowledge.

---

## 6. Dormant until launch (current reality)

Everything above is **wired-dormant** — the app has not started:
- LLM calls are **off** (standing prohibition this phase); `ANTHROPIC_API_KEY` is intentionally empty → ScriptMaker degrades to manual compose.
- Michael runs the catalog/contract, not generation.
- The persistence rungs (R0–R3) are canary-gated **off** by default.
- No `/api/runtime/*` routes are mounted.

Nothing behaves, persists, or generates until **Kevin** enables it, per surface, after the stores are provisioned and the templates/knowledge are approved. Enabling the LLM is its own gated step behind the compliance guarantees above.

---

## 7. Invariants

1. No agent decides what to say/ask outside its template/contract.
2. No agent uses knowledge that a human has not approved (`retrievalReady` + approval reference).
3. No LLM output reaches a user without passing compliance (fail-closed).
4. New questions/scripts/templates are learning candidates → **human-approved** before use.
5. The Context Manager is the sole Context Packet assembler.
6. No agent may approve knowledge — ever.
7. Nothing is enabled by default; every surface is Kevin-gated and currently dormant.

---

## 8. Bottom line

The agents are deliberately **not** free-generating chatbots. They are **template/contract-bounded**, fed **human-approved knowledge**, optionally phrased by a **compliance-gated LLM** — and *every* lever (the knowledge, the questions, the templates, the LLM itself) is behind your human approval. That is what lets the system *learn and improve what the agents ask* over time without ever drifting into saying something you didn't sanction. All of it stays dormant until you turn it on, surface by surface, after launch.
