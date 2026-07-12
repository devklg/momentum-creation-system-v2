# Agent Skill and Template Registry

P1-60 adds executable governance metadata in
`packages/shared/src/agent-skills.ts`. Every platform agent has an explicit skill
set. Every skill declares its owner, version, implementation status, inputs,
outputs, forbidden outputs, behavior source, templates, tests, handoff, events,
and degradation behavior.

Templates add stable identity/version, ownership, source, input/output contract,
fallback source, tests, and approval/activation state. Active templates must be
approved. Planned templates remain visibly inactive.

This distinction is load-bearing: current ScriptMaker is evidence-backed as a
drafting skill, while the Kevin-defined Who Do You Know plus token flow is
registered as planned until its runtime is built. Sponsor-assisted recordings
and debriefing are likewise planned rather than falsely reported as active.

The platform registry uses `McsPlatformAgentKey`; it does not widen the narrower
Steve/Michael/Ivory runtime orchestration identity union.

P1-61 owns semantic output guardrail tests. P1-63 owns the mutable review,
approval, deployment, rollback, and audit workflow.
