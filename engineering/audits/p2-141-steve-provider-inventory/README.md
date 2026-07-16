# P2-141 Steve provider inventory and terms review

Reviewed: 2026-07-16

Scope: source-backed review of the current Steve browser conversation path,
production hosting/storage topology, official provider terms, and deletion
capabilities. This is an engineering privacy review, not legal advice.

## Result

The named inventory is complete, but the ACR-0031 provider activation gate is
not satisfied.

Three private-content boundaries remain fail-closed release blockers:

1. The browser speech-recognition path does not request local-only processing,
   so raw microphone audio may leave the BA's device through a user-agent
   selected service.
2. The browser speech-synthesis path does not require a local voice and
   positively scores names containing `google`, `microsoft`, and `online`, so
   Steve response text may be sent to a remote voice service.
3. The source proves use of the Anthropic Messages API but cannot prove that
   the production Anthropic organization has Zero Data Retention enabled.
   Without account-level proof, the standard commercial API retention terms
   apply and a BA deletion cannot promise immediate deletion of Anthropic's
   retained request/response copy.

The managed storage providers publish processor terms and deletion controls,
but account-specific backup configuration and contractual acceptance are not
provable from this repository. Those confirmations must be captured before the
platform represents provider-side deletion as complete.

No production environment, provider console, BA record, provider API, or live
browser speech service was contacted during this review.

## Actual Steve data flow

| Boundary | Current code path | Data that crosses the boundary | Current disposition |
| --- | --- | --- | --- |
| BA browser microphone | `SpeechRecognition` / `webkitSpeechRecognition` in `apps/team/src/routes/steve-success-interview.tsx` | Raw microphone audio reaches the browser's speech implementation; recognized text returns to the page | **Blocked for a device-only claim.** The code does not set `processLocally`; the user agent may process locally or remotely. |
| BA browser TTS | `speechSynthesis` in `apps/team/src/routes/steve-success-interview.tsx` | Steve reply text is supplied to the selected speech voice | **Blocked for a device-only claim.** Voice selection ignores `localService` and can prefer an online/vendor voice. |
| MCS Express API | `POST /api/steve/discovery/converse` | Recognized or typed BA text, session identity, and returned Steve text | Private/no-store response. No general request-body logger was found. Application/system log retention remains an operations policy to document. |
| InterServer VPS | Production Express process and Nginx reverse proxy | Request bodies are processed in memory; source does not intentionally persist Steve bodies on the VPS filesystem | InterServer is the infrastructure processor. Whether VPS snapshots or remote backups are enabled is not proved by the repo or runbook. |
| Anthropic Messages API | `server/src/services/anthropic.ts` and `server/src/domain/steveConversationRuntime.ts` | BA first name in the system prompt; full conversation history on each turn; Steve outputs; full assembled transcript again for extraction, with one validation retry possible | Commercial API content is not used for training unless explicitly opted in, but standard retention is up to 30 days unless a ZDR arrangement applies. Organization-level ZDR is unverified. |
| Anthropic prompt cache | Explicit `cache_control: {type:"ephemeral"}` on the system block | Stable system prompt, including BA first name and any enabled context supplement; conversation messages are outside the explicit breakpoint | Default cache TTL is five minutes. Prompt caching is ZDR-eligible, but the production organization's ZDR status is unverified. |
| MongoDB Atlas Flex | `tmag_agent_steve_events` and `tmag_steve_success_interview` | In-flight turns, final transcript, structured answers, Success Profile, privacy state, and content-free audit facts | Canonical private store. New-record event bodies are compacted after canonical read-back. Atlas Flex backups are automatically enabled; exact project retention/configuration must be recorded before deletion guarantees include backups. |
| Neo4j Aura Free | Steve completion, lineage, and privacy projections | Content-free relationship, revision, consent, withdrawal, and audit facts; no transcript/profile text in the approved path | Relationship-only. Aura Free has no scheduled snapshots; any on-demand snapshot/configuration still requires console confirmation. |
| Chroma Cloud | `mcs_steve_success_interview` and the ACR-0011 why projection | Retrieval-ineligible content-free completion/privacy markers, plus the separately approved primary why statement | No transcript, raw answers, full profile, or audio. Chroma says it will not train on Customer Data without permission. Record deletion/read-back is required; backup expiration is not immediate under the published terms. |
| Legacy Steve worker ingest | `POST /api/steve/discovery/ingest` | Schema can accept legacy `callSid` and `audioUrl` values from a worker | Not used by the current internal browser conversation path. New browser-created canonical records write both fields as `null`; historical cleanup remains separately gated. |

The current Steve browser path does not call Telnyx, does not invoke the
Voicebox runtime, does not start provider recording, and does not create an
audio URL or call identifier.

## Official terms findings

### Browser speech recognition and synthesis

- MDN documents that `SpeechRecognition.processLocally=false` is the default
  and permits the user agent to choose local or remote processing:
  [SpeechRecognition.processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally).
- MDN exposes `SpeechSynthesisVoice.localService` specifically to distinguish
  local from remote voices:
  [SpeechSynthesisVoice.localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService).
- Microsoft states that Edge Web Speech sends captured audio over HTTPS to
  Azure Cognitive Services, does not store the recorded audio, and returns
  text to the website:
  [Microsoft Edge speech-recognition privacy](https://learn.microsoft.com/en-us/legal/microsoft-edge/privacy#speech-recognition).
- Microsoft also states that Edge online TTS voices are Azure Cognitive
  Services voices. Its privacy notice says text and generated audio are
  deleted after conversion:
  [Edge online TTS policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/configureonlinetexttospeech)
  and
  [Microsoft Edge read-aloud privacy](https://learn.microsoft.com/en-us/legal/microsoft-edge/privacy#read-aloud).

These Edge terms are evidence for Edge only. The application accepts whichever
supported browser the BA uses, so the source cannot identify one universal
speech processor, subprocessor list, retention rule, or deletion channel.

### Anthropic

- Anthropic's commercial API policy says inputs and outputs are automatically
  deleted within 30 days under standard retention, with exceptions for
  customer-controlled longer-retention features, ZDR agreements, Usage Policy
  enforcement, and legal requirements:
  [commercial retention policy](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data).
- Content flagged for Usage Policy enforcement can be retained longer than the
  standard window. Therefore a provider-side deletion promise must preserve
  the published exceptions.
- Anthropic says commercial/API chats are not used to train models unless the
  customer joins the Development Partner Program, explicitly opts in, or
  submits feedback:
  [commercial model-training policy](https://privacy.claude.com/en/articles/7996885-how-do-you-use-personal-data-in-model-training).
- Anthropic says ZDR is enabled per organization through an account
  arrangement; eligible Messages API requests are not stored at rest after the
  response:
  [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).
- The current explicit prompt-cache block uses the documented default
  five-minute TTL. Prompt caching is ZDR-eligible when the organization has
  ZDR:
  [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
- Anthropic states that its DPA and Standard Contractual Clauses are
  incorporated into its commercial terms:
  [Anthropic DPA guidance](https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa).

Source code cannot prove the production organization, workspace privacy
settings, contractual ZDR enablement, or whether any future model becomes a
covered model with mandatory retention.

### MongoDB Atlas Flex

- MongoDB's DPA makes MongoDB a processor for Customer Personal Data and says
  Atlas controls let the customer retrieve, correct, or delete uploaded data:
  [MongoDB DPA](https://www.mongodb.com/legal/data-processing-agreement).
- MongoDB says terminating an Atlas project erases each cluster node's volume
  encryption key for secure purging:
  [MongoDB Privacy Hub](https://www.mongodb.com/legal/privacy).
- Atlas documents that Flex backups are automatically enabled and daily
  snapshots cannot be disabled:
  [Atlas backup documentation](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).

The production runbook identifies an Atlas Flex cluster, but the repository
does not contain the live snapshot-retention configuration. Record-level
deletion is implementable; the backup-expiration statement still needs a
console/configuration evidence capture.

### Neo4j Aura Free

- Neo4j's DPA describes Neo4j as a processor and promises deletion as soon as
  reasonably practicable, no later than 180 days after termination or written
  request:
  [Neo4j DPA](https://neo4j.com/legal-terms/data-processing-addendum/).
- Aura documentation says Free instances have only on-demand snapshots, not
  scheduled snapshots:
  [Aura backup documentation](https://neo4j.com/docs/aura/managing-instances/backup-restore-export/).
- Deleting an Aura instance also removes its snapshots and is unrecoverable:
  [Aura instance deletion](https://neo4j.com/docs/aura/managing-instances/instance-actions/).

The current production topology is Aura Free. The app's approved Steve graph
projection is content-free, but any on-demand snapshot or exported backup
remains an account/operator inventory item.

### Chroma Cloud

- Chroma's terms say Customer Data is not used to train AI or ML models unless
  the customer expressly permits it:
  [Chroma Terms](https://www.trychroma.com/terms).
- Chroma's DPA says remaining Customer Personal Data is deleted within 180
  days after return following termination:
  [Chroma DPA](https://www.trychroma.com/dpa).
- The terms separately state that Customer Data may remain in standard backups
  despite an obligation to delete, subject to confidentiality restrictions.
- Chroma publishes daily snapshots and cross-region replication as security
  controls:
  [Chroma Cloud security](https://www.trychroma.com/security).

The current ACR-0031 design minimizes this boundary to one approved why
statement and content-free markers, but provider backup expiration is not
synchronous with an app-level delete.

### InterServer VPS

- InterServer's DPA identifies it as a processor, provides assistance for
  deletion requests, and says Customer Personal Data will be deleted or
  returned within 30 days after service termination unless law requires
  retention:
  [InterServer Terms and DPA](https://www.interserver.net/terms-of-service.html).
- The same terms say VPS products do not default to backups and customers are
  responsible for configuring them.
- InterServer separately documents optional/available VPS snapshots and remote
  backups, including automatic snapshot behavior and 45-day manual remote
  backup retention:
  [VPS backup availability](https://www.interserver.net/tips/kb/backup-availability-per-service/).

The production runbook does not state whether those snapshot/backup features
are enabled. Operational evidence must confirm the actual VPS configuration
and journald/Nginx retention before the host boundary is called complete.

## Required activation evidence

The following evidence is required before ACR-0031's provider gate can be
marked passed:

1. Anthropic organization/workspace evidence showing commercial terms, DPA
   coverage, ZDR status, and eligibility of the exact production model and
   Messages/prompt-cache features. If ZDR is not enabled, Kevin must explicitly
   approve the documented standard retention and provider-deletion lag.
2. A speech-recognition contract that either:
   - requires `processLocally=true` and fails closed to typed input when local
     recognition is unavailable; or
   - names each permitted remote browser/provider path, its terms, notice,
     retention, and deletion behavior.
3. A speech-synthesis contract that requires `voice.localService===true` and
   falls back to visible text, or explicitly approves a named remote TTS
   provider and its terms.
4. A user-facing privacy notice at the microphone control that accurately says
   whether audio can leave the device and identifies any approved remote
   processor.
5. Console/configuration evidence for Atlas Flex backup retention, Aura
   on-demand/exported snapshots, Chroma backup deletion behavior, InterServer
   snapshots/remote backups, and Nginx/journald retention.
6. A deletion runbook that distinguishes immediate active-record deletion from
   provider retention windows, legal/abuse exceptions, and backup expiry.

## Safe next implementation

The narrow code-safe next slice is to make voice fail closed:

- typed conversation remains the universal default;
- speech recognition requests local-only processing and becomes unavailable
  when the browser cannot guarantee it;
- TTS selects only `localService===true` voices and otherwise leaves Steve's
  reply as visible text; and
- the microphone control carries the approved privacy notice.

That slice would avoid choosing a remote browser speech provider without
separate provider approval. It would not change the Anthropic boundary,
production data, historical records, or the unresolved private-content
deletion/onboarding-gate decision.
