/**
 * Kevin's edge assertions, chat 2026-07-11 — THE VERBS ARE THE OPERATORS.
 *
 * Writes typed, directional relationships on the MEMORY stack (`neo4j`
 * connector) between MemoryIndexEntry nodes, with edge-level provenance
 * (`asserted_by: kevin`, `asserted_at: 2026-07-11`, `source: chat`). Target
 * nodes are created if missing (ON CREATE only — existing nodes are never
 * mutated). These are Kevin's assertions, confirmed in conversation — this
 * script contains exactly those edges and invents none.
 *
 * Also mints the `member sms channel` handle Kevin named tonight:
 *   1. writeAnchor → universal_gateway.claude_learning_notes (memory stack)
 *   2. writeHandle → momentum.mcs_memory_context_index (app-stack projection,
 *      weight 8, audience dev_agents)
 *
 * Every write is read back; the edges are read back and PRINTED — an edge
 * that does not read back was not written.
 *
 * Idempotent (MERGE / envelope-update). Usage:
 *   pnpm --filter @momentum/server exec tsx scripts/write-edges-2026-07-11.ts
 */

import { callGateway, DEFAULT_GATEWAY_URL } from '../src/lib/gatewayClient.js';
import { writeAnchor } from '../src/lib/agentMemory.js';
import { writeHandle } from '../src/lib/memoryContextIndex.js';

const gatewayUrl = process.env.AGENT_MEMORY_GATEWAY_URL || DEFAULT_GATEWAY_URL;
const ASSERTED_AT = '2026-07-11';

/** Uppercase on the memory stack, matching the existing edge convention. */
const VERB_WHITELIST = [
  'REQUIRES_CONTEXT',
  'GROUNDS',
  'HANDS_OFF_TO',
  'PROTECTS',
  'EXCLUDES',
  'SUPERSEDES',
  'CONTRADICTS',
  'RELATES_TO',
] as const;
type Verb = (typeof VERB_WHITELIST)[number];

interface EdgeAssertion {
  from: string;
  verb: Verb;
  toId: string;
  toTitle: string;
  /** Kevin's qualifying words for this edge, verbatim from the brief. */
  note?: string;
}

const VMR = 'voicemail-dialer-reality-2026-07-11';
const MSC = 'member-sms-channel';

const EDGES: readonly EdgeAssertion[] = [
  // ---- voice mailer reality ----
  { from: VMR, verb: 'REQUIRES_CONTEXT', toId: 'apache-leads-callback-model', toTitle: 'Apache Leads callback model', note: '50k US mobile, AU available' },
  { from: VMR, verb: 'REQUIRES_CONTEXT', toId: 'lead-qualification-sorting-pipeline', toTitle: 'Lead qualification/sorting pipeline', note: 'validate→dedupe→suppression→normalize→token→CRM' },
  { from: VMR, verb: 'REQUIRES_CONTEXT', toId: 'phone-normalization-us-only', toTitle: 'Phone normalization (US-only)', note: 'US-only; silently corrupts AU mobiles into bogus +1' },
  { from: VMR, verb: 'REQUIRES_CONTEXT', toId: 'quiet-hours-region-windows', toTitle: 'Quiet hours / region windows', note: 'legacy localTimeWindow dropped from tmag_vm_campaigns' },
  { from: VMR, verb: 'REQUIRES_CONTEXT', toId: 'telnyx-connection-wiring', toTitle: 'Telnyx connection wiring', note: "TELNYX_CONNECTION_ID points at Michael's app, not mcs-vm-v2" },
  { from: VMR, verb: 'GROUNDS', toId: 'ba-someone-to-call', toTitle: 'It gives the BA someone to call who is interested' },
  { from: VMR, verb: 'GROUNDS', toId: 'chat-78-human-send-only', toTitle: 'Chat #78: prospect outreach is human-send only by the individual BA' },
  { from: VMR, verb: 'HANDS_OFF_TO', toId: 'pmv-raised-hand-flow', toTitle: 'PMV', note: 'raised hand → BA calls → BA sends the invite personally and tracks it' },
  { from: VMR, verb: 'HANDS_OFF_TO', toId: 'holding-tank-video-complete-gate', toTitle: 'Holding Tank', note: 'downstream, gated on video_complete' },
  { from: VMR, verb: 'PROTECTS', toId: 'dry-run-default', toTitle: 'Dry-run default' },
  { from: VMR, verb: 'PROTECTS', toId: 'per-campaign-admin-approval', toTitle: 'Per-campaign admin approval before any live drop' },
  { from: VMR, verb: 'PROTECTS', toId: 'ownership-from-session-only', toTitle: 'Ownership from session only' },
  { from: VMR, verb: 'PROTECTS', toId: 'suppression-consent-before-delivery', toTitle: 'Suppression/consent honored before any delivery job' },
  { from: VMR, verb: 'EXCLUDES', toId: 'system-never-texts-prospects', toTitle: 'The system NEVER texts a prospect' },
  { from: VMR, verb: 'EXCLUDES', toId: '10dlc-sms-not-in-this-chain', toTitle: '10DLC/SMS is NOT part of this chain' },
  { from: VMR, verb: 'EXCLUDES', toId: 'telnyx-never-into-steve-michael-ivory', toTitle: 'Telnyx never wires into Steve/Michael/Ivory' },
  { from: VMR, verb: 'SUPERSEDES', toId: 'press-1-auto-sms-link-design', toTitle: 'The earlier press-1 → auto-SMS-link design' },
  { from: VMR, verb: 'CONTRADICTS', toId: 'telnyx-is-ringless-claim', toTitle: "'Telnyx is ringless'", note: 'it dials + AMD; true RVM never places a call' },
  // ---- member sms channel ----
  { from: MSC, verb: 'REQUIRES_CONTEXT', toId: 'member-sms-consent-capture-at-signup', toTitle: 'Member SMS consent capture at signup', note: 'NOT BUILT — zero smsConsent/optIn fields on the member record' },
  { from: MSC, verb: 'REQUIRES_CONTEXT', toId: 'existing-member-consent-backfill', toTitle: 'Existing-member consent backfill', note: 'they joined before the requirement' },
  { from: MSC, verb: 'REQUIRES_CONTEXT', toId: 'stop-help-inbound-handler', toTitle: 'STOP/HELP inbound handler', note: 'NOT BUILT — message.received unhandled' },
  { from: MSC, verb: 'REQUIRES_CONTEXT', toId: 'g6-permanent-exclusion-list', toTitle: 'G.6 permanent exclusion list' },
  { from: MSC, verb: 'REQUIRES_CONTEXT', toId: '10dlc-brand-bfpj85q', toTitle: '10DLC brand BFPJ85Q', note: 'verified; ZERO campaigns exist' },
  { from: MSC, verb: 'PROTECTS', toId: 'permission-as-condition-of-entry', toTitle: 'Permission required as a condition of entry, disclosed plainly up front' },
  { from: MSC, verb: 'PROTECTS', toId: 'stop-honored-instantly-permanently', toTitle: 'STOP honored instantly and permanently' },
  { from: MSC, verb: 'PROTECTS', toId: 'membership-never-contingent-on-subscription', toTitle: 'Membership NEVER contingent on staying subscribed' },
  { from: MSC, verb: 'PROTECTS', toId: 'opt-out-consequences-disclosed-upfront', toTitle: 'Opt-out consequences disclosed at signup / in-app / email, never in the STOP reply' },
  { from: MSC, verb: 'EXCLUDES', toId: 'prospects-entirely', toTitle: 'Prospects entirely' },
  { from: MSC, verb: 'EXCLUDES', toId: 'consequences-in-stop-reply', toTitle: 'Consequences or dissuasion language in the STOP reply' },
  { from: MSC, verb: 'EXCLUDES', toId: 're-text-after-opt-out', toTitle: 'Any re-text after opt-out' },
  { from: MSC, verb: 'RELATES_TO', toId: VMR, toTitle: 'voice mailer reality', note: 'shared Telnyx account only' },
] as const;

const SOURCE_NODES: Array<{ id: string; title: string }> = [
  { id: VMR, title: 'voice mailer reality' },
  { id: MSC, title: 'member sms channel' },
];

async function cypher<T = { records?: Array<Record<string, unknown>> }>(query: string, params: Record<string, unknown>): Promise<T> {
  return callGateway<T>(gatewayUrl, 'neo4j', 'cypher', { query, params });
}

async function mintMemberSmsChannel(): Promise<void> {
  console.log("=== minting Kevin's handle 'member sms channel' ===");
  const meaning =
    'SMS is for MEMBERS ONLY — permission-given at entry, tracked first-party in our own system. Prospects are never texted by the system.';
  const anchor = await writeAnchor({
    note_id: MSC,
    subject: 'member sms channel — SMS is a members-only channel',
    note:
      `${meaning} Requires (none built yet): member SMS consent capture at signup (zero smsConsent/optIn fields on the member record), ` +
      'existing-member consent backfill (they joined before the requirement), a STOP/HELP inbound handler (message.received is unhandled), ' +
      'the G.6 permanent exclusion list, and 10DLC brand BFPJ85Q (verified; zero campaigns exist). ' +
      'Protects: permission required as a condition of entry, disclosed plainly up front; STOP honored instantly and permanently; ' +
      'membership NEVER contingent on staying subscribed; opt-out consequences disclosed at signup / in-app / email, never in the STOP reply. ' +
      'Excludes: prospects entirely; consequences or dissuasion language in the STOP reply; any re-text after opt-out. ' +
      'Relates to voice mailer reality through the shared Telnyx account only.',
    trigger: 'member sms channel members-only texting consent smsConsent optIn STOP HELP opt-out 10DLC BFPJ85Q permanent exclusion list first-party permission',
    anchor_phrase: 'member sms channel',
    priority_anchor: true,
    severity: 'high',
    tags: ['member-sms-channel', 'sms', 'consent', '10dlc', 'anchor'],
    project: 'momentum-creation-system-v2',
    audience: 'dev_agents',
    created_at: '2026-07-11T23:59:00.000Z',
  });
  console.log(`  anchor legs: mongo=${anchor.legs.mongo} chroma=${anchor.legs.chroma} neo4j=${anchor.legs.neo4j}`);

  const handle = await writeHandle(
    {
      entryId: MSC,
      human_handle: 'member sms channel',
      call_phrase: 'member sms channel',
      aliases: [],
      weight: 8,
      named_by: 'Kevin L. Gardner',
      title: 'Member SMS Channel — members only, permission at entry',
      category: 'agent_correction_anchor',
      tags: ['member-sms-channel', 'sms', 'consent', '10dlc', 'anchor', 'claude_learning_notes'],
      memory_id: MSC,
      source_store: 'universal_gateway.claude_learning_notes',
      source_stack: 'memory',
      meaning,
      content:
        `${meaning}\n\nRequires: member SMS consent capture at signup (NOT BUILT); existing-member consent backfill; STOP/HELP inbound handler (NOT BUILT); ` +
        'G.6 permanent exclusion list; 10DLC brand BFPJ85Q (verified, zero campaigns).\n\n' +
        'Protects: permission as a condition of entry, disclosed up front; STOP honored instantly and permanently; membership never contingent on staying subscribed; ' +
        'opt-out consequences disclosed at signup / in-app / email, never in the STOP reply.\n\n' +
        'Excludes: prospects entirely; consequences in the STOP reply; any re-text after opt-out.\n\n' +
        'Relates to voice mailer reality (shared Telnyx account only).',
      useWhen:
        'Use when Kevin says member sms channel, or when work touches member SMS consent, STOP/HELP handling, 10DLC campaigns, or any texting surface. Canonical note: universal_gateway.claude_learning_notes/member-sms-channel (memory stack).',
      nextAgentInstruction:
        'SMS is members-only. The system never texts a prospect. Do not build any texting surface without the consent capture, backfill, and STOP/HELP handler this handle requires.',
      audience: 'dev_agents',
      created_at: '2026-07-11T23:59:00.000Z',
    },
    { gatewayUrl },
  );
  for (const r of handle.retrieval) {
    console.log(
      `  handle retrieval '${r.phrase}' → ${r.topHitId} distance ${r.distance.toFixed(4)}` +
        (r.runnerUpDistance != null ? ` · runner-up ${r.runnerUpId} ${r.runnerUpDistance.toFixed(4)} · separation ${(r.separation ?? 0).toFixed(4)}` : ''),
    );
  }
}

async function writeEdges(): Promise<void> {
  console.log('\n=== writing typed edges on the MEMORY stack (asserted_by: kevin) ===');
  for (const node of SOURCE_NODES) {
    await cypher(
      `MERGE (n:MemoryIndexEntry {id: $id}) ` +
        `ON CREATE SET n.title = $title, n.type = 'memory_index_entry', n.created_at = $createdAt, ` +
        `n.created_by = 'claude-code (kevin assertion, chat 2026-07-11)', n.audience = 'dev_agents' RETURN n.id AS id`,
      { id: node.id, title: node.title, createdAt: `${ASSERTED_AT}T23:59:00.000Z` },
    );
  }

  for (const edge of EDGES) {
    if (!VERB_WHITELIST.includes(edge.verb)) throw new Error(`verb not whitelisted: ${edge.verb}`);
    await cypher(
      `MERGE (a:MemoryIndexEntry {id: $from}) ` +
        `MERGE (b:MemoryIndexEntry {id: $toId}) ` +
        `ON CREATE SET b.title = $toTitle, b.type = 'memory_index_entry', b.created_at = $createdAt, ` +
        `b.created_by = 'claude-code (kevin assertion, chat 2026-07-11)', b.audience = 'dev_agents' ` +
        `MERGE (a)-[r:${edge.verb}]->(b) ` +
        `ON CREATE SET r.asserted_by = 'kevin', r.asserted_at = $assertedAt, r.source = 'chat'` +
        (edge.note ? `, r.note = $note` : '') +
        ` RETURN type(r) AS verb`,
      {
        from: edge.from,
        toId: edge.toId,
        toTitle: edge.toTitle,
        createdAt: `${ASSERTED_AT}T23:59:00.000Z`,
        assertedAt: ASSERTED_AT,
        ...(edge.note ? { note: edge.note } : {}),
      },
    );
  }
  console.log(`  ${EDGES.length} edge assertions written (MERGE — idempotent).`);
}

async function readBackAndPrint(): Promise<void> {
  console.log('\n=== READ-BACK — an edge that does not read back was not written ===');
  let total = 0;
  for (const source of [VMR, MSC]) {
    const result = await cypher(
      `MATCH (a:MemoryIndexEntry {id: $id})-[r]->(b) ` +
        `RETURN type(r) AS verb, b.id AS toId, b.title AS toTitle, ` +
        `r.asserted_by AS assertedBy, r.asserted_at AS assertedAt, r.source AS source, r.note AS note ` +
        `ORDER BY verb, toId`,
      { id: source },
    );
    const rows = result.records ?? [];
    console.log(`\n  ${source} — ${rows.length} outgoing edge(s):`);
    for (const row of rows) {
      total += 1;
      console.log(
        `    -[${String(row.verb)}]-> ${String(row.toId)} (${String(row.toTitle ?? '')})` +
          ` · asserted_by=${String(row.assertedBy)} asserted_at=${String(row.assertedAt)} source=${String(row.source)}` +
          (row.note ? ` · note: ${String(row.note)}` : ''),
      );
      if (row.assertedBy !== 'kevin') throw new Error(`edge to ${String(row.toId)} read back without kevin provenance`);
    }
  }
  const expected = EDGES.length;
  if (total < expected) throw new Error(`read-back found ${total} edges, expected at least ${expected} — a missing edge was not written`);
  console.log(`\n  read-back total: ${total} edges (expected ≥ ${expected}). All carry asserted_by=kevin.`);
}

async function main() {
  await mintMemberSmsChannel();
  await writeEdges();
  await readBackAndPrint();
  console.log('\nDone. Tonight’s edges are relationships, not properties — typed, directional, with provenance.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
