/**
 * Admin chat transcript indexer + reader.
 *
 * This path is the codified "one-size-fits-all" transcript capture for tool chats
 * (Codex, Claude Desktop, Claude Code, and Codex CLI) so that Kevin can search
 * and reopen complete word-for-word role-by-role transcripts from a stable
 * index.
 *
 * Storage is written to universal_gateway through direct connector calls, with all
 * required planes (MongoDB, Neo4j, Chroma) in one write envelope.
 */

import { createHash } from 'node:crypto';
import type {
  McsAdminChatTranscriptDetail,
  McsAdminChatTranscriptHarvestResponse,
  McsAdminChatTranscriptSummary,
  McsIsoTimestamp,
} from '@momentum/shared';
import { callGateway, DEFAULT_GATEWAY_URL } from '../lib/gatewayClient.js';

const GATEWAY_URL = process.env.AGENT_MEMORY_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;
const MONGO_DATABASE = 'universal_gateway';
const MONGO_COLLECTION = 'chat_transcripts';
const CHROMA_COLLECTION = 'chat_transcripts';
const NEO4J_NODE_ID_LABEL = 'id';
const NEO4J_NODE_LABEL = 'AgentChatTranscript';
const NEO4J_MODEL_LABEL = 'AgentChatModel';
const CHROMA_SEARCH_TOP_K = 5;
const AUTO_HARVEST_FETCH_LIMIT = 300;
const AUTO_HARVEST_DEFAULT_MODEL_HINT = 'other';
const AUTO_MEMORY_DB = 'conversation_memory';
const AUTO_SESSION_SOURCE = 'agent_auto_harvester';
const AUTO_SESSIONS_COLLECTION = 'sessions';
const AUTO_HARVESTER_SESSION_COLLECTIONS = ['PerryAutoSession', 'perryautosessions'] as const;
const HARVEST_SOURCE_ENV = 'ALL';
const HARVEST_SOURCE_FILTER = asString(process.env.AUTO_TRANSCRIPT_HARVEST_SOURCES)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => value.toLowerCase());
const HARVEST_SOURCE_ALL = HARVEST_SOURCE_FILTER.some((value) => value === HARVEST_SOURCE_ENV.toLowerCase());
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'is',
  'are',
  'was',
  'were',
  'am',
  'i',
  'you',
  'we',
  'they',
  'he',
  'she',
  'it',
  'that',
  'this',
  'to',
  'of',
  'for',
  'in',
  'on',
  'with',
  'as',
  'at',
  'by',
  'from',
  'into',
  'about',
  'into',
  'like',
  'how',
  'what',
  'why',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'about',
  'my',
  'me',
  'your',
  'our',
  'their',
  'us',
]);

const MODEL_PREFIX_BY_CANONICAL: Record<McsChatModel, string> = {
  codex: '1',
  claude_desktop: '2',
  claude_code: '3',
  codex_cli: '4',
  other: '9',
};

export type McsChatModel =
  | 'codex'
  | 'claude_desktop'
  | 'claude_code'
  | 'codex_cli'
  | 'other';

export interface RawChatTurn {
  role?: unknown;
  speaker?: unknown;
  text?: unknown;
  content?: unknown;
  timestamp?: unknown;
  createdAt?: unknown;
  when?: unknown;
}

interface SessionMirrorRow {
  session_id?: unknown;
  _id?: unknown;
  source?: unknown;
  messageCount?: unknown;
  status?: unknown;
  processed?: unknown;
}

interface HarvesterSessionRow {
  session_id?: unknown;
  _id?: unknown;
  started_at?: unknown;
  last_activity?: unknown;
  message_count?: unknown;
  status?: unknown;
  messages?: unknown;
}

interface AutoHarvesterMirrorSession {
  _id?: unknown;
  session_id?: unknown;
  source?: unknown;
  semanticKeyword?: unknown;
  semantic_keyword?: unknown;
  keyword?: unknown;
  model?: unknown;
  status?: unknown;
  processed?: unknown;
  messageCount?: unknown;
  message_count?: unknown;
  messages?: unknown;
  toolsUsed?: unknown;
  tools_used?: unknown;
  sourceSessionId?: unknown;
  source_session_id?: unknown;
  sourceSession?: unknown;
  source_session?: unknown;
  chatNumber?: unknown;
  chat_number?: unknown;
  chatRegistryId?: unknown;
  chat_registry_id?: unknown;
  registryId?: unknown;
  startTime?: unknown;
  lastActivity?: unknown;
  last_activity?: unknown;
}

interface AutoHarvesterMessage {
  role?: unknown;
  speaker?: unknown;
  text?: unknown;
  content?: unknown;
  timestamp?: unknown;
  when?: unknown;
  createdAt?: unknown;
  tool?: unknown;
  action?: unknown;
  type?: unknown;
  raw_params?: unknown;
  metadata?: unknown;
  message?: unknown;
}

type GatewayHarvesterWindow = 'manual' | 'scheduled';

export interface AutoHarvestResult {
  source: string;
  requested: number;
  written: number;
  skipped: number;
  sourceSessionCount: number;
  sourceSessionIds: string[];
  errors: string[];
  initiatedBy: GatewayHarvesterWindow;
  runWindow: string | null;
}

export interface HarvesterTurnInput {
  source?: unknown;
  sourceSessionId?: unknown;
  sourceExternalId?: unknown;
  chatNumber?: unknown;
  chatRegistryId?: unknown;
  model?: unknown;
  semanticKeyword?: unknown;
  title?: unknown;
  capturedAt?: unknown;
  endedAt?: unknown;
  transcript?: unknown;
  turns?: unknown;
}

interface NormalizedChatTurn {
  sequence: number;
  role: string;
  speaker: string;
  text: string;
  timestamp: string | null;
}

interface StoredChatTranscript {
  transcriptId: string;
  chatIndex: string;
  model: McsChatModel | string;
  modelPrefix: string;
  indexSequence: number;
  title: string;
  semanticKeyword: string;
  source: string;
  sourceSessionId: string | null;
  sourceExternalId: string | null;
  chatNumber: number | null;
  chatRegistryId: string | null;
  capturedAt: McsIsoTimestamp;
  endedAt: McsIsoTimestamp | null;
  rawTranscript: string;
  turnCount: number;
  wordCount: number;
  turns: NormalizedChatTurn[];
  createdAt: McsIsoTimestamp;
}

type GatewayListResponse<T> = { documents?: T[]; count?: number };
type GatewayChromaResponse = {
  results?: {
    ids?: string[] | string[][];
    distances?: number[];
    documents?: string[];
    metadatas?: Record<string, unknown>[];
  };
};
function flattenChromaIds(value: string[] | string[][] | undefined): string[] {
  const raw = value ?? [];
  return raw.length === 0 ? [] : (Array.isArray(raw[0]) ? (raw as string[][]).flat() : (raw as string[]));
}

export class ChatTranscriptIndexError extends Error {
  constructor(message: string) {
    super(`chat transcript index failed: ${message}`);
    this.name = 'ChatTranscriptIndexError';
  }
}

function asString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text === '' ? null : text;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function asSafeDateIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'number') {
    const numericDate = new Date(value);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'bigint') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
}

function normalizeHarvestSource(raw: unknown): string {
  return asString(raw).toLowerCase().replace(/\\s+/g, ' ').trim();
}

function isAllowedHarvestSource(rawSource: unknown): boolean {
  const source = normalizeHarvestSource(rawSource);
  if (!source) return AUTO_HARVEST_SOURCE_ALL || HARVEST_SOURCE_FILTER.length === 0;
  if (AUTO_HARVEST_SOURCE_ALL) return true;
  if (HARVEST_SOURCE_FILTER.length === 0) return true;
  return HARVEST_SOURCE_FILTER.some((value) => source.includes(value));
}

function summarizeAutoParameters(params: unknown): string {
  if (params === undefined || params === null) return '';
  if (typeof params === 'string') return params;
  if (typeof params === 'number' || typeof params === 'boolean') return String(params);
  if (Array.isArray(params)) return `[${params.length} items]`;
  if (typeof params === 'object') {
    try {
      const keys = Object.keys(params as Record<string, unknown>);
      if (keys.length === 0) return '';
      return JSON.stringify(params).slice(0, 200);
    } catch {
      return '';
    }
  }
  return '';
}

function normalizeRole(raw: unknown): string {
  const role = asString(raw).toLowerCase();
  if (role === 'assistant' || role === 'system' || role === 'user' || role === 'tool') return role;
  if (role === 'assistant') return 'assistant';
  if (role === 'human' || role === 'me') return 'user';
  if (role === 'ai' || role === 'claude' || role === 'codex') return 'assistant';
  return role || 'participant';
}

function normalizeText(raw: unknown): string {
  const text = asString(raw);
  if (text === '') return '';
  return text.replace(/\\s+/g, ' ').trim();
}

function canonicalizeModel(raw: unknown): McsChatModel {
  const value = asString(raw).toLowerCase();
  if (value.includes('codex_cli') || value.includes('codex cli')) return 'codex_cli';
  if (value.includes('claude code') || value.includes('claude-code') || value.includes('claude_code')) return 'claude_code';
  if (value.includes('claude desktop') || value.includes('claude_desktop') || value.includes('claude desktop app')) {
    return 'claude_desktop';
  }
  if (value.includes('codex')) return 'codex';
  return 'other';
}

function pickHarvestSourceText(row: AutoHarvesterMirrorSession): string {
  return normalizeHarvestSource(row.source);
}

function inferModelFromSource(rawSource: unknown, hints: string[]): McsChatModel {
  const source = normalizeHarvestSource(rawSource);
  if (source.includes('claude_desktop') || source.includes('claude desktop')) return 'claude_desktop';
  if (source.includes('claude_code') || source.includes('claude code')) return 'claude_code';
  if (source.includes('codex_cli') || source.includes('codex cli')) return 'codex_cli';
  const normalizedFromHints = inferModelFromHints('other', [source, ...hints]);
  if (normalizedFromHints === 'other' && source === 'agent_auto_harvester') return 'other';
  return normalizedFromHints;
}

function hasMessagesInSession(row: AutoHarvesterMirrorSession): boolean {
  const count = asNullableNumber(row.messageCount);
  if (count !== null && count > 0) return true;
  const legacyCount = asNullableNumber(row.message_count);
  if (legacyCount !== null && legacyCount > 0) return true;
  if (Array.isArray(row.messages)) return row.messages.length > 0;
  return false;
}

function normalizeAutoSessionMetadata(row: AutoHarvesterMirrorSession): {
  sourceSessionId: string;
  sourceExternalId: string | null;
  model: McsChatModel;
  title: string;
  semanticKeyword: string;
  chatNumber: number | null;
  chatRegistryId: string | null;
  capturedAt: string;
  endedAt: string | null;
  toolHints: string[];
} {
  const sourceSessionId = normalizeAutoSessionId(row);
  if (!sourceSessionId) {
    throw new Error('auto-harvester session missing _id/session_id');
  }

  const capturedAt = asSafeDateIso(row.startTime || row.lastActivity || row.last_activity) ?? new Date().toISOString();
  const endedAt = asSafeDateIso(row.lastActivity || row.last_activity);
  const toolHints = asStringArray(row.toolsUsed || row.tools_used);
  const model = inferModelFromSource(row.source, toolHints);
  const sourceRow = row as Record<string, unknown>;
  const sourceTitle = asNullableString(sourceRow.title) ?? asNullableString(sourceRow.threadTitle);
  const title = sourceTitle ?? `Agent chat ${sourceSessionId}`;
  const sourceAlias = asNullableString(sourceRow.sourceSessionId) ?? asNullableString(sourceRow.source_session_id) ?? sourceSessionId;
  const sourceExternalId = asNullableString(sourceRow.sourceExternalId)
    ?? asNullableString(sourceRow.source_external_id)
    ?? asNullableString(sourceRow.source_session)
    ?? sourceAlias;
  const semanticFallback = asStringArray([row.source, row.status, sourceRow.model, sourceRow.semanticKeyword, sourceRow.semantic_keyword, sourceRow.keyword, sourceSessionId])
    .filter(Boolean)
    .join(' ');
  const chatKeyword = asNullableString(sourceRow.keyword) ?? asNullableString(sourceRow.semanticKeyword);
  const sourceHint = sourceAlias ? `agent:${sourceAlias}` : '';
  const semanticKeyword = deriveKeyword([], [chatKeyword ?? '', sourceHint, semanticFallback].filter(Boolean).join(' ')) || AUTO_HARVEST_DEFAULT_MODEL_HINT;
  const chatNumber = asNullableNumber((row as { chatNumber?: unknown }).chatNumber) ?? asNullableNumber((row as { chat_number?: unknown }).chat_number);
  const chatRegistryId = asNullableString((row as { chatRegistryId?: unknown }).chatRegistryId)
    ?? asNullableString((row as { chat_registry_id?: unknown }).chat_registry_id)
    ?? asNullableString((row as { registryId?: unknown }).registryId);

  return {
    sourceSessionId,
    sourceExternalId,
    model,
    title,
    semanticKeyword,
    chatNumber,
    chatRegistryId,
    capturedAt,
    endedAt,
    toolHints,
  };
}

function normalizeAutoTurns(rows: unknown[], inferRoleFromConversationLog = false): NormalizedChatTurn[] {
  const turns = rows
    .map((row, index) => {
      if (inferRoleFromConversationLog) {
        return normalizeConversationMemoryMessage(row as AutoHarvesterMessage, index);
      }
      return normalizeAutoMessageRow(row as AutoHarvesterMessage, index);
    })
    .filter((turn): turn is NormalizedChatTurn => Boolean(turn));

  return turns;
}

function chooseSourceName(value: unknown): string {
  const text = asString(value);
  if (text) return text.toLowerCase().replace(/\\s+/g, ' ').trim();
  return 'auto_harvester';
}

function deriveKeyword(transcript: NormalizedChatTurn[], fallback: string): string {
  const source = `${transcript.map((turn) => turn.text).join(' ')} ${fallback}`;
  const words = source
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, ' ')
    .split(/\\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  if (words.length > 0) return words.slice(0, 3).join('-');
  return asString(fallback).toLowerCase().replace(/\\s+/g, '-').slice(0, 40) || 'session';
}

function normalizeTurns(raw: unknown): NormalizedChatTurn[] {
  if (Array.isArray(raw) && raw.every((row) => typeof row === 'string')) {
    return raw
      .map((value) => asString(value))
      .filter(Boolean)
      .map((value, index) => ({
        sequence: index + 1,
        role: 'participant',
        speaker: 'participant',
        text: value,
        timestamp: null,
      }));
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => entry as RawChatTurn)
    .map((entry, index) => {
      const text = normalizeText(entry.text ?? entry.content ?? '');
      if (!text) return null;
      return {
        sequence: index + 1,
        role: normalizeRole(entry.role ?? entry.speaker),
        speaker: asString(entry.speaker) || normalizeRole(entry.role ?? entry.speaker),
        text,
        timestamp: asNullableString(entry.timestamp || entry.createdAt || entry.when),
      };
    })
    .filter((value): value is NormalizedChatTurn => value !== null);
}

function countWords(rows: NormalizedChatTurn[]): number {
  return rows.reduce((acc, row) => {
    const words = row.text.trim().split(/\\s+/).filter(Boolean);
    return acc + words.length;
  }, 0);
}

function buildTranscriptDocument(record: StoredChatTranscript): string {
  return [
    `chat_index: ${record.chatIndex}`,
    `keyword: ${record.semanticKeyword}`,
    `model: ${record.model}`,
    `title: ${record.title}`,
    ...record.turns.map((turn) => `${turn.role} ${turn.speaker}: ${turn.text}`),
  ].join('\\n');
}

function buildMetadata(record: StoredChatTranscript): Record<string, string | number | boolean | null> {
  return {
    transcriptId: record.transcriptId,
    chatIndex: record.chatIndex,
    modelPrefix: record.modelPrefix,
    indexSequence: record.indexSequence,
    model: record.model,
    title: record.title,
    semanticKeyword: record.semanticKeyword,
    sourceSessionId: record.sourceSessionId,
    sourceExternalId: record.sourceExternalId,
    chatNumber: record.chatNumber,
    chatRegistryId: record.chatRegistryId,
    source: record.source,
    capturedAt: record.capturedAt,
    turnCount: record.turnCount,
    wordCount: record.wordCount,
    kind: 'agent_chat_transcript',
  };
}

function normalizeAutoSessionId(row: AutoHarvesterMirrorSession): string | null {
  return (
    asNullableString(row.session_id)
    ?? asNullableString(row._id)
    ?? asNullableString(row.sourceSessionId)
    ?? asNullableString(row.source_session_id)
  );
}

function normalizeAutoMessageRow(row: AutoHarvesterMessage, index: number): NormalizedChatTurn | null {
  const roleValue = asString(row.role) || asString(row.type) || 'participant';
  const rawTool = row.type === 'tool_call' ? `${asString(row.tool)}.${asString(row.action)}` : '';
  const toolText = normalizeText(asString(row.text) || asString(row.content) || rawTool);
  const paramText = normalizeText(summarizeAutoParameters(row.raw_params) || summarizeAutoParameters(row.message));
  const messageText = [toolText, paramText].filter(Boolean).join(' | ').trim();
  const text = messageText || `session event #${index + 1}`;

  const role = normalizeRole(roleValue);
  const speaker = asString(row.speaker) || asString(row.role) || role;
  const timestamp = asNullableString(row.timestamp || row.when || row.createdAt);

  return {
    sequence: index + 1,
    role,
    speaker,
    text,
    timestamp,
  };
}

function normalizeConversationMemoryMessage(row: AutoHarvesterMessage, index: number): NormalizedChatTurn | null {
  const roleValue = asString(row.role) || asString(row.speaker) || asString((row.metadata as Record<string, unknown> | undefined)?.role);
  const text = normalizeText(
    asString(row.text)
      || asString(row.content)
      || asString(row.message)
      || summarizeAutoParameters((row.metadata as Record<string, unknown> | undefined)?.details),
  );
  if (!text) return null;
  const role = normalizeRole(roleValue || 'participant');
  return {
    sequence: index + 1,
    role,
    speaker: asString(row.speaker) || role,
    text,
    timestamp: asNullableString(row.timestamp || row.when || row.createdAt),
  };
}

function inferModelFromHints(rawModel: unknown, hints: string[]): McsChatModel {
  const joined = `${asString(rawModel)} ${hints.map((value) => asString(value)).join(' ')}`.toLowerCase();
  if (!joined.trim()) return AUTO_HARVEST_DEFAULT_MODEL_HINT;
  return canonicalizeModel(joined);
}

function parseConversationTextBlock(block: unknown): NormalizedChatTurn[] {
  if (typeof block !== 'string' || !block.trim()) return [];
  const lines = block
    .split('\\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !line.startsWith('Session:') &&
        !line.startsWith('Started:') &&
        !line.startsWith('Messages:') &&
        !line.startsWith('---') &&
        line !== ''
    );

  return lines
    .map((line, index) => {
      const match = /^(?:\\[[^\\]]+\\]\\s*)?\\(([^)]+)\\)\\s*(.+)$/.exec(line);
      if (match && match[1] && match[2]) {
        return {
          sequence: index + 1,
          role: normalizeRole(match[1]),
          speaker: asString(match[1]),
          text: normalizeText(match[2]),
          timestamp: null,
        };
      }
      return {
        sequence: index + 1,
        role: 'participant',
        speaker: 'participant',
        text: normalizeText(line),
        timestamp: null,
      };
    })
    .filter((turn): turn is NormalizedChatTurn => Boolean(turn.text));
}

function normalizeInput(item: HarvesterTurnInput, fallbackSource: string): {
  sourceSessionId: string | null;
  sourceExternalId: string | null;
  chatNumber: number | null;
  chatRegistryId: string | null;
  model: McsChatModel;
  source: string;
  title: string;
  semanticKeyword: string | null;
  capturedAt: McsIsoTimestamp;
  endedAt: McsIsoTimestamp | null;
  turns: NormalizedChatTurn[];
} {
  const turns = normalizeTurns(item.transcript ?? item.turns);
  const title = asString(item.title) || 'agent chat transcript';
  const model = canonicalizeModel(item.model);
  const created = new Date();
  const capturedAtValue = asNullableString(item.capturedAt) || asNullableString(item.endedAt) || created.toISOString();
  const capturedAt = new Date(capturedAtValue).toISOString() as McsIsoTimestamp;

  const semanticKeyword =
    asNullableString(item.semanticKeyword) || deriveKeyword(turns, title) || 'session';
  const source = chooseSourceName(item.source ?? fallbackSource);

  return {
    sourceSessionId: asNullableString(item.sourceSessionId),
    sourceExternalId: asNullableString(item.sourceExternalId),
    chatNumber: asNullableNumber(item.chatNumber),
    chatRegistryId: asNullableString(item.chatRegistryId),
    model,
    source,
    title,
    semanticKeyword: semanticKeyword,
    capturedAt,
    endedAt: asNullableString(item.endedAt) ? (new Date(item.endedAt as string).toISOString() as McsIsoTimestamp) : null,
    turns,
  };
}

async function listAutoHarvesterSessions(gatewayUrl = GATEWAY_URL): Promise<AutoHarvesterMirrorSession[]> {
  const filter = {
    $or: [
      { processed: true },
      { status: { $in: ['completed', 'closed', 'done', 'archived'] } },
      { messageCount: { $gt: 0 } },
      { message_count: { $gt: 0 } },
    ],
  };
  const result = await callGateway<GatewayListResponse<AutoHarvesterMirrorSession>>(gatewayUrl, 'mongodb', 'query', {
    database: AUTO_MEMORY_DB,
    collection: AUTO_SESSIONS_COLLECTION,
    filter,
    sort: { last_activity: -1, lastActivity: -1 },
    limit: AUTO_HARVEST_FETCH_LIMIT,
  });
  return (result.documents ?? [])
    .filter((row) => hasMessagesInSession(row))
    .filter((row) => AUTO_HARVEST_SOURCE_ALL || isAllowedHarvestSource(row.source));
}

async function loadHarvesterSessionDocument(
  sessionId: string,
  gatewayUrl = GATEWAY_URL,
): Promise<HarvesterSessionRow | null> {
  for (const collectionName of AUTO_HARVESTER_SESSION_COLLECTIONS) {
    const result = await callGateway<GatewayListResponse<HarvesterSessionRow>>(gatewayUrl, 'mongodb', 'query', {
      database: AUTO_MEMORY_DB,
      collection: collectionName,
      filter: { $or: [{ session_id: sessionId }, { _id: sessionId }] },
      limit: 1,
    });
    const row = result.documents?.[0];
    if (row) return row;
  }
  return null;
}

async function loadConversationMessages(
  sessionId: string,
  gatewayUrl = GATEWAY_URL,
): Promise<AutoHarvesterMessage[]> {
  const result = await callGateway<GatewayListResponse<AutoHarvesterMessage>>(gatewayUrl, 'mongodb', 'query', {
    database: AUTO_MEMORY_DB,
    collection: 'messages',
    filter: {
      $or: [
        { sessionId },
        { session_id: sessionId },
        { session: sessionId },
      ],
    },
    sort: { timestamp: 1 },
    limit: AUTO_HARVEST_FETCH_LIMIT,
  });
  return result.documents ?? [];
}

async function loadConversationQueueTranscript(
  sessionId: string,
  gatewayUrl = GATEWAY_URL,
): Promise<NormalizedChatTurn[]> {
  const result = await callGateway<GatewayListResponse<{ conversationText?: unknown }>>(gatewayUrl, 'mongodb', 'query', {
    database: AUTO_MEMORY_DB,
    collection: 'processing_queue',
    filter: { sessionId: sessionId },
    sort: { createdAt: -1 },
    limit: 10,
  });

  return (result.documents ?? [])
    .flatMap((doc) => parseConversationTextBlock((doc as { conversationText?: unknown }).conversationText))
    .filter((turn): turn is NormalizedChatTurn => turn.text.length > 0);
}

function harvestModelFromMessages(modelHint: McsChatModel, turns: NormalizedChatTurn[]): McsChatModel {
  if (modelHint === 'other' && turns.length > 0) {
    return inferModelFromHints(
      turns
        .flatMap((turn) => [turn.speaker, turn.role, turn.text])
        .map((entry) => String(entry))
        .join(' '),
      [],
    );
  }
  return modelHint;
}

function buildAutoHarvestInputFromSession(
  sessionRow: AutoHarvesterMirrorSession,
  turns: NormalizedChatTurn[],
): HarvesterTurnInput {
  const metadata = normalizeAutoSessionMetadata(sessionRow);
  return {
    source: pickHarvestSourceText(sessionRow) || AUTO_SESSION_SOURCE,
    sourceSessionId: metadata.sourceSessionId,
    sourceExternalId: metadata.sourceExternalId,
    model: metadata.model,
    chatNumber: metadata.chatNumber,
    chatRegistryId: metadata.chatRegistryId,
    title: metadata.title,
    semanticKeyword: metadata.semanticKeyword,
    capturedAt: metadata.capturedAt,
    endedAt: metadata.endedAt,
    transcript: turns,
    turns: turns,
  };
}

export async function harvestAutoHarvesterTranscripts(
  options: {
    initiatedBy: GatewayHarvesterWindow;
    runWindow: string | null;
    gatewayUrl?: string;
  },
): Promise<AutoHarvestResult> {
  const gatewayUrl = options.gatewayUrl ?? GATEWAY_URL;

  const mirrorSessions = await listAutoHarvesterSessions(gatewayUrl);
  const requested = mirrorSessions.length;
  const sourceSessionIds: string[] = [];
  const errors: string[] = [];
  const payload: HarvesterTurnInput[] = [];
  const seen = new Set<string>();

  for (const sessionRow of mirrorSessions) {
    try {
      const sourceSessionId = normalizeAutoSessionId(sessionRow);
      if (!sourceSessionId) {
        errors.push('session row missing id');
        continue;
      }
      const harvestSource = pickHarvestSourceText(sessionRow) || AUTO_SESSION_SOURCE;
      const dedupeKey = `${harvestSource}::${sourceSessionId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const sessionDoc = await loadHarvesterSessionDocument(sourceSessionId, gatewayUrl);
      const rawTurns = normalizeAutoTurns(
        Array.isArray(sessionDoc?.messages) ? (sessionDoc.messages as unknown[]) : [],
      );
      const legacyMessageTurns = rawTurns.length === 0
        ? normalizeAutoTurns(await loadConversationMessages(sourceSessionId, gatewayUrl), true)
        : [];
      const queueTurns = rawTurns.length === 0 && legacyMessageTurns.length === 0
        ? await loadConversationQueueTranscript(sourceSessionId, gatewayUrl)
        : [];
      const turns = rawTurns.length > 0 ? rawTurns : (legacyMessageTurns.length > 0 ? legacyMessageTurns : queueTurns);

      if (turns.length === 0) {
        errors.push(`session ${sourceSessionId}: no captured turns`);
        continue;
      }

      const sourceMetadata = normalizeAutoSessionMetadata(sessionRow);
      const modelFromHints = harvestModelFromMessages(sourceMetadata.model, turns);
      sourceSessionIds.push(sourceSessionId);
      payload.push({
        ...buildAutoHarvestInputFromSession(sessionRow, turns),
        model: modelFromHints,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const identifier = normalizeAutoSessionId(sessionRow) ?? 'unknown';
      errors.push(`session ${identifier}: ${message}`);
    }
  }

  const harvest = await ingestChatTranscripts({ source: AUTO_SESSION_SOURCE, transcripts: payload }, gatewayUrl);
  return {
    ...harvest,
    sourceSessionCount: requested,
    sourceSessionIds,
    initiatedBy: options.initiatedBy,
    runWindow: options.runWindow,
    errors: [...errors, ...harvest.errors],
  };
}

async function lastSequence(modelPrefix: string, gatewayUrl = GATEWAY_URL): Promise<number> {
  const result = await callGateway<GatewayListResponse<StoredChatTranscript>>(gatewayUrl, 'mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: MONGO_COLLECTION,
    filter: { modelPrefix },
    sort: { indexSequence: -1 },
    limit: 1,
  });
  const last = result.documents?.[0];
  if (!last) return 0;
  return Number(last.indexSequence ?? 0);
}

function checksumFromString(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

function buildId(input: {
  sourceSessionId: string | null;
  sourceExternalId: string | null;
  model: string;
  capturedAt: string;
  transcriptBody: string;
}): string {
  const seed = `${input.sourceSessionId ?? 'none'}|${input.sourceExternalId ?? 'none'}|${input.model}|${input.capturedAt}|${checksumFromString(
    input.transcriptBody,
  )}`;
  return `chat_transcript_${createHash('sha1').update(seed).digest('hex').slice(0, 24)}`;
}

function transcriptLookupFilter(item: {
  sourceSessionId: string | null;
  sourceExternalId: string | null;
}): Record<string, unknown> {
  const orFilters: Array<Record<string, unknown>> = [];
  if (item.sourceSessionId) orFilters.push({ sourceSessionId: item.sourceSessionId });
  if (item.sourceExternalId) orFilters.push({ sourceExternalId: item.sourceExternalId });
  if (orFilters.length === 2) {
    orFilters.push({ sourceSessionId: item.sourceSessionId, sourceExternalId: item.sourceExternalId });
  }
  if (orFilters.length === 0) return {};
  if (orFilters.length === 1) return orFilters[0];
  return { $or: orFilters };
}

function buildNeo4jQuery(record: StoredChatTranscript): { query: string; params: Record<string, unknown> } {
  return {
    query: `
      MERGE (t:${NEO4J_NODE_LABEL} {${NEO4J_NODE_ID_LABEL}: $transcriptId})
      SET t += {
        transcriptId: $transcriptId,
        chatIndex: $chatIndex,
        model: $model,
        modelPrefix: $modelPrefix,
        indexSequence: $indexSequence,
        title: $title,
        semanticKeyword: $semanticKeyword,
        source: $source,
        sourceSessionId: $sourceSessionId,
        sourceExternalId: $sourceExternalId,
        chatNumber: $chatNumber,
        chatRegistryId: $chatRegistryId,
        capturedAt: datetime($capturedAt),
        endedAt: CASE WHEN $endedAt IS NULL THEN NULL ELSE datetime($endedAt) END,
        turnCount: $turnCount,
        wordCount: $wordCount,
        createdAt: datetime($createdAt)
      }
      MERGE (m:${NEO4J_MODEL_LABEL} {key: $model})
      SET m.kind = $model,
          m.modelPrefix = $modelPrefix,
          m.updatedAt = datetime($createdAt)
      MERGE (t)-[:RECORDED_BY_MODEL]->(m)
      RETURN t.id AS transcriptId
    `,
    params: {
      transcriptId: record.transcriptId,
      chatIndex: record.chatIndex,
      model: record.model,
      modelPrefix: record.modelPrefix,
      indexSequence: record.indexSequence,
      title: record.title,
      semanticKeyword: record.semanticKeyword,
      source: record.source,
      sourceSessionId: record.sourceSessionId,
      sourceExternalId: record.sourceExternalId,
      chatNumber: record.chatNumber,
      chatRegistryId: record.chatRegistryId,
      capturedAt: record.capturedAt,
      endedAt: record.endedAt,
      turnCount: record.turnCount,
      wordCount: record.wordCount,
      createdAt: record.createdAt,
    },
  };
}

async function writeTranscriptRecord(record: StoredChatTranscript, gatewayUrl = GATEWAY_URL): Promise<void> {
  const neo4j = buildNeo4jQuery(record);
  await callGateway(gatewayUrl, 'quadstack', 'write', {
    mongo: {
      database: MONGO_DATABASE,
      collection: MONGO_COLLECTION,
      doc: { ...record, _id: record.transcriptId },
    },
    neo4j: {
      query: neo4j.query,
      params: neo4j.params,
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      ids: [record.transcriptId],
      documents: [buildTranscriptDocument(record)],
      metadatas: [buildMetadata(record)],
    },
    options: { require: ['mongo', 'neo4j', 'chroma'] },
  } satisfies Record<string, unknown>);

  const mongoCheck = await callGateway<GatewayListResponse<StoredChatTranscript>>(gatewayUrl, 'mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: MONGO_COLLECTION,
    filter: { _id: record.transcriptId },
    limit: 1,
  });
  if ((mongoCheck.documents?.length ?? 0) === 0) {
    throw new ChatTranscriptIndexError(`write verification failed for ${record.transcriptId} in Mongo`);
  }

  const chromaCheck = await callGateway<GatewayChromaResponse>(gatewayUrl, 'chromadb', 'query_with_filter', {
    collection: CHROMA_COLLECTION,
    query: record.chatIndex,
    where: { transcriptId: record.transcriptId },
    n_results: CHROMA_SEARCH_TOP_K,
  });
  if (!flattenChromaIds(chromaCheck.results?.ids).includes(record.transcriptId)) {
    throw new ChatTranscriptIndexError(`write verification failed for ${record.transcriptId} in Chroma`);
  }

  const neoCheck = await callGateway<{ records?: Array<{ n?: number }> }>(gatewayUrl, 'neo4j', 'cypher', {
    query: `MATCH (t:${NEO4J_NODE_LABEL} {id:$id}) RETURN count(t) AS n`,
    params: { id: record.transcriptId },
  });
  const count = Array.isArray(neoCheck.records) && neoCheck.records.length > 0 ? Number.parseInt(String((neoCheck.records[0] as { n?: number }).n ?? 0), 10) : 0;
  if (!Number.isFinite(count) || count <= 0) {
    throw new ChatTranscriptIndexError(`write verification failed for ${record.transcriptId} in Neo4j`);
  }
}

export interface ChatTranscriptListFilter {
  limit: number;
  model?: string;
  keyword?: string;
  cursor?: string;
}

export interface ChatTranscriptListResult {
  transcripts: McsAdminChatTranscriptSummary[];
  total: number;
  nextCursor: string | null;
}

export async function listChatTranscripts(
  filter: ChatTranscriptListFilter,
  gatewayUrl = GATEWAY_URL,
): Promise<ChatTranscriptListResult> {
  const now = new Date().toISOString();
  const query: Record<string, unknown> = {};
  if (filter.model) query.model = filter.model;
  if (filter.keyword) {
    query.$or = [
      { semanticKeyword: { $regex: filter.keyword, $options: 'i' } },
      { title: { $regex: filter.keyword, $options: 'i' } },
      { chatIndex: { $regex: filter.keyword, $options: 'i' } },
    ];
  }
  if (filter.cursor) query.capturedAt = { $lt: filter.cursor };

  const documents = await callGateway<GatewayListResponse<StoredChatTranscript>>(gatewayUrl, 'mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: MONGO_COLLECTION,
    filter: query,
    sort: { capturedAt: -1, createdAt: -1 },
    limit: filter.limit,
  });
  const rows = documents.documents ?? [];
  const summaries = rows.map((row) => ({
    transcriptId: row.transcriptId,
    chatIndex: row.chatIndex,
    title: row.title,
    model: row.model,
    semanticKeyword: row.semanticKeyword,
    capturedAt: row.capturedAt,
    createdAt: row.createdAt,
    chatNumber: row.chatNumber ?? null,
    chatRegistryId: row.chatRegistryId ?? null,
    source: row.source,
    sourceSessionId: row.sourceSessionId ?? null,
    sourceExternalId: row.sourceExternalId ?? null,
    turnCount: row.turnCount,
    wordCount: row.wordCount,
  }));
  const nextCursor = rows.length > 0 ? rows.at(-1)?.capturedAt ?? null : null;
  return {
    transcripts: summaries,
    total: documents.count ?? rows.length,
    nextCursor: nextCursor && nextCursor <= now ? nextCursor : null,
  };
}

export async function getChatTranscriptDetail(
  transcriptId: string,
  gatewayUrl = GATEWAY_URL,
): Promise<McsAdminChatTranscriptDetail | null> {
  const result = await callGateway<GatewayListResponse<StoredChatTranscript>>(gatewayUrl, 'mongodb', 'query', {
    database: MONGO_DATABASE,
    collection: MONGO_COLLECTION,
    filter: { transcriptId },
    limit: 1,
  });
  const row = result.documents?.[0];
  if (!row) return null;

  return {
    transcriptId: row.transcriptId,
    chatIndex: row.chatIndex,
    modelPrefix: row.modelPrefix,
    indexSequence: row.indexSequence,
    title: row.title,
    model: row.model,
    semanticKeyword: row.semanticKeyword,
    capturedAt: row.capturedAt,
    createdAt: row.createdAt,
    chatNumber: row.chatNumber ?? null,
    chatRegistryId: row.chatRegistryId ?? null,
    source: row.source,
    sourceSessionId: row.sourceSessionId ?? null,
    sourceExternalId: row.sourceExternalId ?? null,
    turnCount: row.turnCount,
    wordCount: row.wordCount,
    transcript: row.turns ?? [],
    rawTranscript: row.rawTranscript,
  };
}

export async function ingestChatTranscripts(
  payload: { source: string; transcripts: HarvesterTurnInput[] },
  gatewayUrl = GATEWAY_URL,
): Promise<McsAdminChatTranscriptHarvestResponse> {
  const source = chooseSourceName(payload.source);
  const requested = Array.isArray(payload.transcripts) ? payload.transcripts.length : 0;
  let written = 0;
  let skipped = 0;
  const errors: string[] = [];
  const nextSequenceByModelPrefix = new Map<string, number>();

  for (let i = 0; i < (payload.transcripts ?? []).length; i += 1) {
    const row = payload.transcripts[i] ?? null;
    if (!row || typeof row !== 'object') {
      skipped += 1;
      errors.push(`transcript_${i + 1}: invalid payload row`);
      continue;
    }

    const normalized = normalizeInput(row, source);
    if (!normalized.turns.length) {
      skipped += 1;
      errors.push(`transcript_${i + 1}: missing turns`);
      continue;
    }

    const modelPrefix = MODEL_PREFIX_BY_CANONICAL[normalized.model];
    let nextSequence = nextSequenceByModelPrefix.get(modelPrefix);
    if (nextSequence === undefined) {
      nextSequence = (await lastSequence(modelPrefix, gatewayUrl)) + 1;
    }
    nextSequenceByModelPrefix.set(modelPrefix, nextSequence);
    nextSequenceByModelPrefix.set(modelPrefix, nextSequence + 1);

    const rawTranscript = normalized.turns.map((turn) => `${turn.role}: ${turn.text}`).join('\\n');
    const chatIndex = `${modelPrefix}-${String(nextSequence).padStart(4, '0')}`;
    const transcript = {
      sourceSessionId: normalized.sourceSessionId,
      sourceExternalId: normalized.sourceExternalId,
    };
    const existingFilter = transcriptLookupFilter(transcript);
    const existingLookup = Object.keys(existingFilter).length === 0 ? [] : (await callGateway<GatewayListResponse<StoredChatTranscript>>(gatewayUrl, 'mongodb', 'query', {
      database: MONGO_DATABASE,
      collection: MONGO_COLLECTION,
      filter: existingFilter,
      limit: 5,
    })).documents ?? [];

    if ((existingLookup?.length ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    const record: StoredChatTranscript = {
      transcriptId: buildId({
        sourceSessionId: normalized.sourceSessionId,
        sourceExternalId: normalized.sourceExternalId,
        model: normalized.model,
        capturedAt: normalized.capturedAt,
        transcriptBody: rawTranscript,
      }),
      chatIndex,
      model: normalized.model,
      modelPrefix,
      indexSequence: nextSequence,
      title: normalized.title,
      semanticKeyword: normalized.semanticKeyword,
      source: normalized.source,
      sourceSessionId: normalized.sourceSessionId,
      sourceExternalId: normalized.sourceExternalId,
      chatNumber: normalized.chatNumber ?? nextSequence,
      chatRegistryId: normalized.chatRegistryId,
      capturedAt: normalized.capturedAt,
      endedAt: normalized.endedAt,
    rawTranscript,
    turnCount: normalized.turns.length,
    wordCount: countWords(normalized.turns),
    turns: normalized.turns,
    createdAt: new Date().toISOString() as McsIsoTimestamp,
  };

    try {
      await writeTranscriptRecord(record, gatewayUrl);
      written += 1;
    } catch (err) {
      skipped += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`transcript_${i + 1}: ${message}`);
    }
  }

  return {
    ok: true,
    source,
    requested,
    written,
    skipped,
    errors,
  };
}
