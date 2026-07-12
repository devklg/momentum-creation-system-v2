/**
 * ACR-0013 — populate `momentum.mcs_memory_context_index` (app stack) with
 * Kevin's real handles, READ FROM THE SOURCE RECORDS — never invented:
 *
 *   1. Kevin's Real Turning Point  ← universal_gateway.kevin_milestone_chats
 *      (alias `krtp-mem` ← universal_gateway.memory_index)
 *   2. Digital Memory Discovery    ← universal_gateway.memory_index +
 *                                    universal_gateway.memory_decisions
 *   3. voice mailer reality        ← universal_gateway.claude_learning_notes
 *
 * Every entry goes through the full ACR-0012 envelope (Mongo → Chroma
 * delete-then-add → Neo4j → read back) and is retrieval-tested: each call
 * phrase and alias must return its entry as the TOP hit (ACR-0013 §5).
 *
 * Idempotent — safe to re-run; the envelope updates in place.
 *
 * Handles are Kevin's to mint. These three were named by Kevin in the source
 * records themselves (`chat_name_pinned_by_kevin`, `named_by`,
 * `anchor_phrase` + `priority_anchor`); this script projects them into the
 * context index, it does not name anything.
 *
 * Usage: pnpm --filter @momentum/server exec tsx scripts/populate-context-handles.ts
 */

import { callGateway, DEFAULT_GATEWAY_URL } from '../src/lib/gatewayClient.js';
import { writeHandle, type MemoryHandleInput } from '../src/lib/memoryContextIndex.js';

const gatewayUrl = process.env.AGENT_MEMORY_GATEWAY_URL || DEFAULT_GATEWAY_URL;

interface MongoQueryResult {
  documents?: Array<Record<string, unknown>>;
}

async function fetchOne(database: string, collection: string, filter: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await callGateway<MongoQueryResult>(gatewayUrl, 'mongodb', 'query', {
    database,
    collection,
    filter,
    limit: 1,
  });
  const doc = (result.documents ?? [])[0];
  if (!doc) {
    throw new Error(`source record not found: ${database}.${collection} ${JSON.stringify(filter)} — refusing to invent content`);
  }
  return doc;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`source field ${field} missing — refusing to invent content`);
  return value;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

async function buildKrtp(): Promise<MemoryHandleInput> {
  const milestone = await fetchOne('universal_gateway', 'kevin_milestone_chats', { _id: 'kevins_real_turning_point_2026_07_05' });
  const alias = await fetchOne('universal_gateway', 'memory_index', { _id: 'memory_alias_20260706_krtp_mem' });

  const handle = asString(milestone.chat_name_pinned_by_kevin, 'chat_name_pinned_by_kevin');
  const significance = asString(milestone.significance, 'significance');
  const keyDecisions = asStringArray(milestone.key_decisions);
  const deliverables = asStringArray(milestone.deliverables);

  return {
    entryId: 'kevins_real_turning_point_2026_07_05',
    human_handle: handle,
    call_phrase: handle,
    aliases: [asString(alias.alias, 'alias')],
    weight: 10, // pinned milestone, preserve_for_perpetuity — provisional until Kevin re-weights
    named_by: 'Kevin L. Gardner',
    title: asString(milestone.title, 'title'),
    category: 'milestone',
    tags: ['milestone', 'preserve_for_perpetuity', 'kevins-real-turning-point', 'krtp-mem', 'turning-point'],
    memory_id: 'kevins_real_turning_point_2026_07_05',
    source_store: 'universal_gateway.kevin_milestone_chats',
    source_stack: 'memory',
    meaning: significance,
    content: [
      significance,
      `Date: ${asString(milestone.date, 'date')}. Chat pinned by Kevin as "${handle}".`,
      keyDecisions.length > 0 ? `Key decisions:\n- ${keyDecisions.join('\n- ')}` : '',
      deliverables.length > 0 ? `Deliverables:\n- ${deliverables.join('\n- ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    useWhen: `Use when Kevin says krtp-mem or kevin's real turning point. Canonical milestone: universal_gateway.kevin_milestone_chats/kevins_real_turning_point_2026_07_05 (preserve_for_perpetuity).`,
    nextAgentInstruction:
      'This is a pinned, preserve-for-perpetuity milestone named by Kevin himself. Read the canonical milestone record before summarizing it. Do not flatten the lineage: Kevin authored the meaning.',
  };
}

async function buildDmd(): Promise<MemoryHandleInput> {
  const indexEntry = await fetchOne('universal_gateway', 'memory_index', { _id: 'memory_index_20260706_digital_memory_discovery' });
  const decision = await fetchOne('universal_gateway', 'memory_decisions', { _id: 'digital_memory_discovery_20260706' });

  return {
    entryId: 'digital_memory_discovery_20260706',
    human_handle: asString(indexEntry.human_handle, 'human_handle'),
    call_phrase: asString(indexEntry.call_phrase, 'call_phrase'),
    // cdx-001 already claims the aliases digital-memory-discovery / dmd-mem
    // for its projection; we do not duplicate them (no mutation, no ambiguity).
    aliases: [],
    weight: 10, // Kevin's named birth moment for this layer — provisional until Kevin re-weights
    named_by: asString(decision.named_by, 'named_by'),
    title: asString(indexEntry.title, 'title'),
    category: asString(indexEntry.category, 'category'),
    tags: asStringArray(indexEntry.tags),
    memory_id: 'digital_memory_discovery_20260706',
    source_store: 'universal_gateway.memory_decisions',
    source_stack: 'memory',
    meaning: asString(indexEntry.meaning, 'meaning'),
    content: asString(decision.content, 'content'),
    useWhen: 'Use when Kevin says Digital Memory Discovery. Canonical record: universal_gateway.memory_decisions/digital_memory_discovery_20260706; index handle: universal_gateway.memory_index/memory_index_20260706_digital_memory_discovery.',
    nextAgentInstruction:
      "Kevin's birth moment for the memory-index layer (2026-07-06). cdx-001 is the compiler projection of the same discovery — read cdx-001's implementationBriefs in order and do not rediscover the concept.",
  };
}

async function buildVoiceMailerReality(): Promise<MemoryHandleInput> {
  const note = await fetchOne('universal_gateway', 'claude_learning_notes', { noteId: 'voicemail-dialer-reality-2026-07-11' });
  if (note.priority_anchor !== true) throw new Error('source note is not a named anchor — refusing to project it as a handle');

  return {
    entryId: 'voicemail-dialer-reality-2026-07-11',
    human_handle: asString(note.anchor_phrase, 'anchor_phrase'),
    call_phrase: asString(note.anchor_phrase, 'anchor_phrase'),
    aliases: [],
    weight: 8, // provisional — Kevin has not weighted this one; severity on the note is 'high'
    named_by: 'Kevin L. Gardner',
    title: asString(note.topic, 'topic'),
    category: 'agent_correction_anchor',
    tags: ['voice-mailer-reality', 'vm-dialer', 'anchor', 'claude_learning_notes'],
    memory_id: 'voicemail-dialer-reality-2026-07-11',
    source_store: 'universal_gateway.claude_learning_notes',
    source_stack: 'memory',
    meaning: asString(note.topic, 'topic'),
    content: asString(note.learned, 'learned'),
    useWhen:
      'Use when Kevin says voice mailer reality, or when work touches the MCS v2 VM dialer, Telnyx/10DLC, the callback pivot, or AU phone coverage. Canonical note: universal_gateway.claude_learning_notes/voicemail-dialer-reality-2026-07-11 (memory stack).',
    nextAgentInstruction:
      'The canonical body lives on the MEMORY stack in claude_learning_notes. 10DLC is not on the critical path (callback pivot). Do not touch the VM dialer, Holding Tank, CRM dispositions, or the §9 migration without reading the full note.',
  };
}

async function main() {
  const inputs = await Promise.all([buildKrtp(), buildDmd(), buildVoiceMailerReality()]);
  for (const input of inputs) {
    console.log(`\n=== writing handle '${input.human_handle}' (${input.entryId}) ===`);
    const receipt = await writeHandle(input, { gatewayUrl });
    for (const r of receipt.retrieval) {
      console.log(
        `  '${r.phrase}' → ${r.topHitId} distance ${r.distance.toFixed(4)}` +
          (r.runnerUpDistance != null ? ` · runner-up ${r.runnerUpId} ${r.runnerUpDistance.toFixed(4)} · separation ${(r.separation ?? 0).toFixed(4)}` : ' · (no runner-up)'),
      );
    }
    console.log(`  legs: mongo=${receipt.legs.mongo} chroma=${receipt.legs.chroma} neo4j=${receipt.legs.neo4j}`);
  }
  console.log('\nAll handles written through the envelope and retrieval-tested.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
