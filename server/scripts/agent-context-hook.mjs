#!/usr/bin/env node

/**
 * ACR-0017 — automatic Context Agent lifecycle hook for Codex + Claude Code.
 *
 * SessionStart / SubagentStart inject the durable continuation foundation.
 * The first UserPromptSubmit in each session runs the existing ACR-0014 guard
 * against the actual user topic. The hook never writes or confirms knowledge.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

const MAX_CONTEXT_CHARS = 9_200;
const MAX_FOUNDATION_CHARS = 6_800;
const MAX_GUARD_CHARS = 8_500;
const STATE_DIR = process.env.MCS_AGENT_CONTEXT_STATE_DIR
  ?? join(tmpdir(), 'mcs-agent-context-hooks');

function readStdin() {
  return new Promise((resolveInput, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { raw += chunk; });
    process.stdin.on('end', () => {
      try {
        resolveInput(raw.trim() ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on('error', reject);
  });
}

function findRepoRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3_000,
    }).trim();
  } catch {
    let current = resolve(cwd || process.cwd());
    while (dirname(current) !== current) {
      if (existsSync(join(current, 'knowledge', 'CONTINUATION_CONTEXT.md'))) return current;
      current = dirname(current);
    }
    return resolve(cwd || process.cwd());
  }
}

function gitValue(root, args, fallback) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3_000,
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function statePath(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(STATE_DIR, `${safe}.json`);
}

function resetPromptGuard(sessionId) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(sessionId), JSON.stringify({ firstPromptGuarded: false }), 'utf8');
}

function claimFirstPrompt(sessionId, markGuarded = true) {
  mkdirSync(STATE_DIR, { recursive: true });
  const path = statePath(sessionId);
  if (existsSync(path)) {
    try {
      const state = JSON.parse(readFileSync(path, 'utf8'));
      if (state.firstPromptGuarded === true) return false;
    } catch {
      // A corrupt temp marker is safely replaced below.
    }
  }
  writeFileSync(path, JSON.stringify({ firstPromptGuarded: markGuarded }), 'utf8');
  return true;
}

function outputContext(eventName, additionalContext) {
  const bounded = additionalContext.length > MAX_CONTEXT_CHARS
    ? `${additionalContext.slice(0, MAX_CONTEXT_CHARS - 90)}\n\n[Automatic context truncated; read knowledge/CONTINUATION_CONTEXT.md.]`
    : additionalContext;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: bounded,
    },
  }));
}

function continuationText(root) {
  const path = join(root, 'knowledge', 'CONTINUATION_CONTEXT.md');
  if (!existsSync(path)) {
    return 'Continuation foundation missing: knowledge/CONTINUATION_CONTEXT.md was not found.';
  }
  const full = readFileSync(path, 'utf8').trim();
  if (full.length <= MAX_FOUNDATION_CHARS) return full;
  return `${full.slice(0, MAX_FOUNDATION_CHARS)}\n\n[Read the full continuation file before substantive work.]`;
}

function agentRecipients(model) {
  return String(model || '').toLowerCase().includes('claude')
    ? ['claude', 'claude-code', 'claude-orchestrator', 'all']
    : ['codex', 'all'];
}

async function unreadInbox(model) {
  if (process.env.MCS_AGENT_CONTEXT_HOOK_SKIP_REMOTE === '1') {
    return 'Intervector inbox check skipped by deterministic test mode.';
  }
  try {
    const response = await fetch('http://localhost:2526/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'mongodb',
        action: 'aggregate',
        params: {
          database: 'universal_gateway',
          collection: 'agent_message_board',
          pipeline: [
            { $match: { to_agent: { $in: agentRecipients(model) }, status: 'unread' } },
            { $sort: { priority: -1, created_at: 1 } },
            { $limit: 5 },
          ],
        },
      }),
      signal: AbortSignal.timeout(4_000),
    });
    const envelope = await response.json();
    if (!response.ok || envelope.success === false) throw new Error(envelope.error || `HTTP ${response.status}`);
    const rows = envelope.data?.results ?? [];
    if (rows.length === 0) return 'Intervector inbox: no unread messages for this agent.';
    const rendered = rows.map((row) => {
      const id = row._id ?? row.id ?? row.message_id ?? '(unidentified)';
      const from = row.from_agent ?? row.from ?? 'unknown';
      const priority = row.priority ?? 0;
      const body = String(row.content ?? row.message ?? row.body ?? row.subject ?? '').replace(/\s+/g, ' ').trim();
      return `- ${id} · from ${from} · priority ${priority}: ${body.slice(0, 900)}`;
    });
    return `Intervector inbox has ${rows.length} unread message(s). Process critical items before work:\n${rendered.join('\n')}`;
  } catch (error) {
    return `INTERVECTOR INBOX UNAVAILABLE: ${error instanceof Error ? error.message : String(error)}. Do not assume the inbox is empty; run the required manual query.`;
  }
}

function startupContext(root, input, inbox) {
  const branch = gitValue(root, ['branch', '--show-current'], '(detached or unavailable)');
  const commit = gitValue(root, ['log', '-1', '--format=%h %s'], '(git history unavailable)');
  return [
    'AUTOMATIC CONTEXT AGENT — SESSION FOUNDATION (ACR-0017)',
    `Event: ${input.hook_event_name ?? 'SessionStart'} · source: ${input.source ?? 'unknown'} · model: ${input.model ?? 'unknown'}`,
    `Workspace: ${root}`,
    `Git: ${branch} · ${commit}`,
    '',
    inbox,
    '',
    continuationText(root),
    '',
    'This context was injected automatically. Follow its front_of_line and authority rules. The first user prompt will receive a topic-specific memory guard automatically.',
  ].join('\n');
}

function isTrivialPrompt(prompt) {
  const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
  return !clean || /^(hi|hello|hey|ok|okay|continue|go ahead|start)[.! ]*$/i.test(clean);
}

function promptTopic(prompt, root) {
  const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (isTrivialPrompt(prompt)) {
    const continuation = continuationText(root);
    const front = continuation.match(/^>\s+(P2-\d+[^\r\n]*)/im)?.[1];
    return front ?? 'current continuation front_of_line';
  }
  return clean.slice(0, 700);
}

function cleanGuardOutput(raw) {
  const markers = ['Prior context exists', 'No prior context found', 'No hits for'];
  const starts = markers.map((marker) => raw.indexOf(marker)).filter((index) => index >= 0);
  const start = starts.length > 0 ? Math.min(...starts) : 0;
  return raw.slice(start).trim();
}

function runGuard(root, topic) {
  const fixture = process.env.MCS_AGENT_CONTEXT_HOOK_GUARD_FIXTURE;
  if (fixture !== undefined) return fixture;
  if (process.env.MCS_AGENT_CONTEXT_HOOK_SKIP_REMOTE === '1') {
    return 'MEMORY GUARD SKIPPED by deterministic test mode.';
  }

  const env = { ...process.env };
  for (const key of [
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'MONGODB_URI', 'MONGO_URI',
    'NEO4J_URI', 'NEO4J_URL', 'CHROMA_URL', 'CHROMADB_URL',
  ]) delete env[key];
  let tsxCli;
  try {
    tsxCli = require.resolve('tsx/cli');
  } catch (error) {
    return `MEMORY GUARD UNAVAILABLE: installed tsx runtime not found (${error instanceof Error ? error.message : String(error)}). Do not claim prior context is absent. Run pnpm memory:guard manually before substantive work.`;
  }
  const result = spawnSync(process.execPath, [
    tsxCli,
    join(root, 'server', 'scripts', 'context-guard.ts'),
    topic,
  ], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  const output = cleanGuardOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (result.error || (result.status !== 0 && output === '')) {
    const detail = result.error?.message ?? `exit ${result.status}`;
    return `MEMORY GUARD UNAVAILABLE: ${detail}. Do not claim prior context is absent. Run pnpm memory:guard manually before substantive work.`;
  }
  return output || 'Memory guard returned no readable report. Treat this as unavailable, not verified absence.';
}

async function main() {
  const input = await readStdin();
  const eventName = String(input.hook_event_name || 'SessionStart');
  const root = findRepoRoot(input.cwd || process.cwd());

  if (eventName === 'SessionStart') {
    resetPromptGuard(input.session_id);
    outputContext(eventName, startupContext(root, input, await unreadInbox(input.model)));
    return;
  }

  if (eventName === 'SubagentStart') {
    outputContext(eventName, [
      'AUTOMATIC CONTEXT AGENT — SUBAGENT FOUNDATION (ACR-0017)',
      `Agent type: ${input.agent_type ?? 'unknown'} · workspace: ${root}`,
      continuationText(root),
      'Run the memory guard for the assigned topic before proposing new work. Do not rediscover an existing concept.',
    ].join('\n\n'));
    return;
  }

  if (eventName === 'UserPromptSubmit') {
    const trivial = isTrivialPrompt(input.prompt);
    if (!claimFirstPrompt(input.session_id, !trivial)) return;
    const topic = promptTopic(input.prompt, root);
    const report = runGuard(root, topic);
    outputContext(eventName, [
      'AUTOMATIC CONTEXT AGENT — FIRST-PROMPT MEMORY GUARD (ACR-0017)',
      `Topic: ${topic}`,
      report.slice(0, MAX_GUARD_CHARS),
      'Use retrieved records as context with provenance. Kevin remains the authority; agent-authored material is not Kevin approval.',
    ].join('\n\n'));
  }
}

main().catch((error) => {
  outputContext('SessionStart', `AUTOMATIC CONTEXT AGENT FAILED: ${error instanceof Error ? error.message : String(error)}. Do not assume context is absent; run the continuation and memory guard manually.`);
});
