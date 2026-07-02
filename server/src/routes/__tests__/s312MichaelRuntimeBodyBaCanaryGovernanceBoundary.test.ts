import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 3 S3.12 — static governance boundary for the body-BA / client runtime
// input rejection canary. This reads production source from disk and scans for
// forbidden wiring patterns. It does not import or modify production code.
// ---------------------------------------------------------------------------

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const routeFilePath = 'server/src/routes/michael-runtime.ts';
const indexFilePath = 'server/src/index.ts';
const routesDirPath = 'server/src/routes';
const cardFilePath = 'apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx';

type SourceFile = {
  readonly relativePath: string;
  readonly text: string;
};

function readSourceFile(relativePath: string): SourceFile {
  const absolute = resolve(repoRoot, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`S3.12 body-BA canary boundary: required source not found at ${relativePath}`);
  }
  return { relativePath, text: readFileSync(absolute, 'utf8') };
}

function sourceWithoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+\/\/.*$/gm, '');
}

function sourceWithoutCommentsOrStrings(text: string): string {
  return sourceWithoutComments(text)
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function linesFromSource(
  files: readonly SourceFile[],
  stripStrings: boolean,
): Array<{ readonly relativePath: string; readonly line: string; readonly lineNumber: number }> {
  return files.flatMap((file) =>
    (stripStrings ? sourceWithoutCommentsOrStrings(file.text) : sourceWithoutComments(file.text))
      .split(/\r?\n/)
      .map((line, index) => ({ relativePath: file.relativePath, line, lineNumber: index + 1 }))
      .filter(({ line }) => line.trim().length > 0),
  );
}

function importLines(files: readonly SourceFile[]) {
  return linesFromSource(files, false).filter(({ line }) => /^\s*import\b/.test(line));
}

function matchingCodeTokenLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return linesFromSource(files, true)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

function matchingImportLines(files: readonly SourceFile[], pattern: RegExp): string[] {
  return importLines(files)
    .filter(({ line }) => pattern.test(line))
    .map(({ relativePath, line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
}

function routeFiles(): SourceFile[] {
  return [readSourceFile(routeFilePath)];
}

describe('S3.12 body-BA canary target sources exist', () => {
  it('route, index, and team card sources are found on disk', () => {
    for (const rel of [routeFilePath, indexFilePath, cardFilePath]) {
      expect(existsSync(resolve(repoRoot, rel)), `${rel} not found`).toBe(true);
    }
  });
});

describe('S3.12 michael-runtime body allowlist and rejection boundary', () => {
  it('1. route allowlists only language', () => {
    const route = sourceWithoutComments(readSourceFile(routeFilePath).text);
    expect(/ALLOWED_BODY_FIELDS\s*=\s*new Set\(\s*\[\s*['"]language['"]\s*\]\s*\)/.test(route)).toBe(
      true,
    );
    expect(route).not.toMatch(/ALLOWED_BODY_FIELDS\s*=\s*new Set\(\s*\[[^\]]*,[^\]]*\]\s*\)/);
  });

  it('2. route rejects unknown body keys before server-owned turn resolution', () => {
    const route = sourceWithoutComments(readSourceFile(routeFilePath).text);
    expect(/Object\.keys\(\s*body\s*\)/.test(route)).toBe(true);
    expect(/!ALLOWED_BODY_FIELDS\.has\(\s*key\s*\)/.test(route)).toBe(true);
    expect(route).toContain('CLIENT_RUNTIME_INPUT_NOT_ALLOWED');
  });

  it.each([
    ['turn'],
    ['runtimeTurn'],
    ['contextPacket'],
    ['tmagId'],
    ['sponsorTmagId'],
    ['targetTmagId'],
    ['downlineTmagId'],
    ['prospectId'],
    ['prospectToken'],
  ])('3. route does not trust body.%s', (field) => {
    const stripped = sourceWithoutCommentsOrStrings(readSourceFile(routeFilePath).text);
    const pattern = new RegExp(`\\b(?:req\\.body|body)\\.${field}\\b`);
    expect(pattern.test(stripped), `body.${field} must not be read`).toBe(false);
  });

  it('4. route still derives BA from req.session.tmagId only', () => {
    const route = sourceWithoutCommentsOrStrings(readSourceFile(routeFilePath).text);
    expect(route).toContain('req.session?.tmagId');
    expect(/\bcreateMichaelRuntimeTurnForAuthenticatedBa\s*\(\s*\{[\s\S]*?tmagId\s*:\s*sessionTmagId/.test(route)).toBe(
      true,
    );
  });

  it('5. route still imports and calls the server-owned turn source and facade', () => {
    const route = readSourceFile(routeFilePath).text;
    expect(route).toMatch(
      /import\s*\{[\s\S]*?\bcreateMichaelRuntimeTurnForAuthenticatedBa\b[\s\S]*?\bresolveMichaelRuntimeTurnResponse\b[\s\S]*?\}\s*from\s+['"]\.\.\/runtime\/orchestration\/index\.js['"]/,
    );
    const calls = matchingCodeTokenLines(
      routeFiles(),
      /\b(?:createMichaelRuntimeTurnForAuthenticatedBa|resolveMichaelRuntimeTurnResponse)\s*\(/,
    );
    expect(calls.filter((line) => line.includes('createMichaelRuntimeTurnForAuthenticatedBa')).length).toBeGreaterThan(
      0,
    );
    expect(calls.filter((line) => line.includes('resolveMichaelRuntimeTurnResponse')).length).toBeGreaterThan(
      0,
    );
  });

  it('6. route still uses requireAuth and requireSteveComplete on /resolve', () => {
    const route = sourceWithoutComments(readSourceFile(routeFilePath).text);
    expect(route).toMatch(/import\s*\{\s*requireAuth\s*\}\s*from\s+['"]\.\.\/middleware\/requireAuth\.js['"]/);
    expect(route).toMatch(
      /import\s*\{\s*requireSteveComplete\s*\}\s*from\s+['"]\.\.\/middleware\/requireSteveComplete\.js['"]/,
    );
    expect(route).toMatch(/\.post\(\s*['"`]\/resolve['"`]\s*,\s*requireAuth\s*,\s*requireSteveComplete\s*,/);
  });
});

describe('S3.12 michael-runtime forbidden dependency boundary', () => {
  it('7. route imports no stores / PERSISTENCE / GraphRAG / retrieval helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:mongoose|mongodb|neo4j|chromadb|chroma-client|graph-?rag|\/services\/PERSISTENCE|PERSISTENCEFallback|\/tripleStack|rawRetrieval|retrievalHelper|directRetrieval|approvedKnowledge|candidateKnowledge|\/retrieval\b)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('8. route imports no OpenAI / Anthropic / Claude helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:openai|anthropic|@anthropic-ai|claude|\/services\/anthropic|\/services\/openai|\/services\/claude)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('9. route imports no Telnyx / voice / call-control helpers', () => {
    const pattern =
      /\bfrom\s+['"][^'"]*(?:telnyx|voice|pstn|call-control|\/services\/telnyx|\/services\/voice)[^'"]*['"]/i;
    const matches = matchingImportLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('10. route performs no persistence writes', () => {
    const pattern =
      /\.(?:insert|update|save|create)\s*\(|\b(?:tripleStackWrite|persistenceCall|directStoreCall)\s*\(/i;
    const matches = matchingCodeTokenLines(routeFiles(), pattern);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('11. no /api/runtime route family is mounted or added', () => {
    const index = sourceWithoutComments(readSourceFile(indexFilePath).text);
    expect(/app\.use\(\s*['"`]\/api\/runtime\b/.test(index)).toBe(false);

    const routesDir = resolve(repoRoot, routesDirPath);
    const offenders = readdirSync(routesDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => !/\.(?:test|spec)\.tsx?$/.test(entry.name))
      .filter((entry) => !/(?:^|[\\/])__tests__([\\/]|$)/.test(String(entry.parentPath ?? '')))
      .map((entry) => String(entry.parentPath ? `${entry.parentPath}/${entry.name}` : entry.name))
      .filter((name) => /(?:^|[\\/])runtime\.(?:ts|tsx|js|jsx)$/i.test(name));
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

describe('S3.12 .team card request-body boundary', () => {
  it('12. support card sends no turn/runtimeTurn/contextPacket or BA/prospect/session authority', () => {
    const stripped = sourceWithoutCommentsOrStrings(readSourceFile(cardFilePath).text);
    const forbidden =
      /\b(?:turn|runtimeTurn|contextPacket|tmagId|sponsorTmagId|targetTmagId|downlineTmagId|prospectId|prospectToken|token|sessionId|turnId|correlationId|requestId|retrieval|PERSISTENCE|graph|approvedKnowledge|candidateKnowledge)\b/;
    expect(forbidden.test(stripped), 'forbidden body field token present in card code').toBe(false);
  });

  it('13. support card request body is only {} or { language }', () => {
    const cardWithoutStrings = sourceWithoutCommentsOrStrings(readSourceFile(cardFilePath).text);
    expect(/const\s+body\s*=\s*opts\?\.language\s*\?\s*\{\s*language\s*:\s*opts\.language\s*\}\s*:\s*\{\s*\}/.test(cardWithoutStrings)).toBe(
      true,
    );
    const cardWithStrings = sourceWithoutComments(readSourceFile(cardFilePath).text);
    expect(cardWithStrings).toContain("'/api/michael-runtime/resolve'");
  });
});
