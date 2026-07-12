# Prompt 04 — Consent-Based Training Recordings

## Mission

Add private recordings for sponsor-assisted training and development sessions so
participants can review and learn. This is not surveillance or prospect-call automation.

## Required model

- recording session ID and coaching-session link
- participant identities and explicit consent timestamps
- status: requested, consented, recording, processing, ready, deleted, failed
- storage reference, duration, transcript reference, retention/deletion timestamps
- access grants and append-only access/audit events

## Reuse

- existing recording/audio reference shapes in shared types
- current storage/provider adapters where available
- sponsor-assisted session from Prompt 03
- approved transcription service boundary; degrade without blocking coaching

## Required behavior

- Never start until every required participant has consented.
- Recording remains optional; coaching works without it.
- Short-lived/signed access only for authorized participants.
- Provide review, transcript when available, and deletion request.
- Do not score, rank, classify, or automatically publish recordings.

## Acceptance tests

- Missing/withdrawn consent prevents recording start.
- Unauthorized BA/sponsor access is denied.
- Deleted/expired recording references cannot be fetched.
- Provider/transcription failure yields a clear degraded state.
- Audit trail proves consent, access, and deletion.

## Deliverables

Schema, persistence, provider abstraction, routes, participant UI, tests,
retention documentation, and no live provider activation without configured keys.

