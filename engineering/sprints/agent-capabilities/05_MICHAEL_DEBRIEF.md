# Prompt 05 — Michael Training Review and Upline Debrief

## Mission

Implement Michael as support for post-session learning. Michael quietly prepares
teachable moments; the sponsor/upline decides what to discuss and leads the debrief.
Michael does not interrupt a live trainee or score performance.

## Inputs

- authorized coaching session
- consented recording/transcript when available
- Success Profile learning preferences
- approved product/training knowledge
- sponsor-authored focus or notes

## Outputs

- concise session recap
- strengths worth repeating
- moments worth reviewing
- approved product/training resources
- one or more practice suggestions
- sponsor/upline debrief handoff

## Required behavior

- Evidence-link every observation to a transcript segment or sponsor note.
- Use supportive language; no grading, ranking, prediction, or disciplinary framing.
- Do not interrupt or gate the completed human conversation.
- Missing transcript falls back to sponsor-authored debrief prompts.
- Respect participant access and recording deletion.

## Acceptance tests

- No trainee score/classification fields exist.
- Unsupported observations are rejected.
- Deleted or unauthorized recordings cannot inform output.
- Missing AI/provider produces deterministic debrief prompts.
- Sponsor remains the action owner.

## Deliverables

Michael skill runtime, template implementation, review UI, evidence model, events,
tests, and activation of `michael_sponsor_debrief` after verification.

