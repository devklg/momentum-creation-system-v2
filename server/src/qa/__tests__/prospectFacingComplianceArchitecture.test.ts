import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCS_COM_DISCLAIMER } from '@momentum/shared';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const comRoot = resolve(repoRoot, 'apps/com/src');
const matrixPath = resolve(repoRoot, 'engineering/sprints/platform-audit-p1/route-access-matrix.json');

interface SourceFile {
  relativePath: string;
  text: string;
  runtimeText: string;
}

interface RouteAccessMatrixRow {
  method: string;
  fullPath: string;
  accessClass: string;
  declared: {
    requireAuth: boolean;
    requireAdmin: boolean;
    requireAdminOrHealthSecret: boolean;
    requireRuntimeInternal: boolean;
    requireSteveComplete: boolean;
    requireVmDialerAccess: boolean;
  };
  findings: string[];
}

interface RouteAccessMatrix {
  routes: RouteAccessMatrixRow[];
}

interface ForbiddenPattern {
  rule: string;
  pattern: RegExp;
}

interface ExpectedComEndpoint {
  method: string;
  fullPath: string;
  accessClass: 'prospect_reentry' | 'prospect_token';
}

const FORBIDDEN_RUNTIME_PATTERNS: ForbiddenPattern[] = [
  {
    rule: 'income, earnings, commission, compensation, cycle math, CV, or rank math',
    pattern: /\b(?:income|earnings|commission|compensation|cycle\s+math|CV|rank\s+math)\b/i,
  },
  {
    rule: 'placement guarantee, spillover, or binary-leg promise',
    pattern:
      /\b(?:binary\s+leg|spillover|secured\s+a\s+leg|leg\s+position|placement\s+promise|placement\s+guarantee|guarantee[sd]?\s+(?:a\s+)?(?:final\s+)?placement|final\s+placement)\b/i,
  },
  {
    rule: 'AI prospecting or Michael language',
    pattern: /\b(?:AI\s+prospecting|automated\s+prospecting|AI\s+calling|lead\s+qualification|Michael)\b/i,
  },
  {
    rule: 'current team head count',
    pattern: /\b(?:current\s+team\s+(?:count|head\s+count)|team\s+head\s+count|active\s+team\s+count)\b/i,
  },
  {
    rule: 'product-company branding or promoter disclaimer',
    pattern:
      /\b(?:THREE\s+International|independent\s+promoter|THREE(?:'s)?\s+(?:logo|brand|branding|corporate|company))\b/i,
  },
];

const EXPECTED_COM_ENDPOINTS: ExpectedComEndpoint[] = [
  { method: 'GET', fullPath: '/api/p/:token', accessClass: 'prospect_token' },
  { method: 'POST', fullPath: '/api/p/:token/video-event', accessClass: 'prospect_token' },
  { method: 'POST', fullPath: '/api/p/:token/callback-request', accessClass: 'prospect_token' },
  { method: 'GET', fullPath: '/api/p/:token/stream', accessClass: 'prospect_token' },
  { method: 'POST', fullPath: '/api/p/:token/webinar-reserve', accessClass: 'prospect_token' },
  { method: 'GET', fullPath: '/api/p/:token/team-stats', accessClass: 'prospect_token' },
  { method: 'POST', fullPath: '/api/p/login/start', accessClass: 'prospect_reentry' },
  { method: 'POST', fullPath: '/api/p/login/redeem', accessClass: 'prospect_reentry' },
  { method: 'GET', fullPath: '/api/rvm/:token', accessClass: 'prospect_token' },
  { method: 'POST', fullPath: '/api/rvm/:token/video-event', accessClass: 'prospect_token' },
  { method: 'POST', fullPath: '/api/rvm/:token/callback-request', accessClass: 'prospect_token' },
  { method: 'GET', fullPath: '/api/rvm/:token/stream', accessClass: 'prospect_token' },
  { method: 'POST', fullPath: '/api/rvm/:token/webinar-reserve', accessClass: 'prospect_token' },
  { method: 'GET', fullPath: '/api/rvm/:token/team-stats', accessClass: 'prospect_token' },
];

const FOOTER_PATHS = new Set([
  'apps/com/src/routes/tm-video-presentation/sections/11-Footer.tsx',
  'apps/com/src/routes/tm-prospect-dashboard/sections/07-Footer.tsx',
]);

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\r\n]/g, ''))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectSourceFiles(root: string): SourceFile[] {
  const files: SourceFile[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === '__tests__') {
        continue;
      }

      const absolutePath = resolve(current, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry)) continue;

      const text = readFileSync(absolutePath, 'utf8');
      files.push({
        relativePath: normalizePath(relative(repoRoot, absolutePath)),
        text,
        runtimeText: stripComments(text),
      });
    }
  }

  walk(root);
  return files;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function matchingRuntimeLines(file: SourceFile, pattern: RegExp): string[] {
  return file.runtimeText
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`);
}

function routeAccessMatrix(): RouteAccessMatrix {
  return JSON.parse(readFileSync(matrixPath, 'utf8')) as RouteAccessMatrix;
}

function routeKey(route: { method: string; fullPath: string }): string {
  return `${route.method} ${route.fullPath}`;
}

function extractApiStringLiterals(file: SourceFile): string[] {
  const matches: string[] = [];
  const literalPattern = /(['"`])([^'"`]*\/api\/[^'"`]*)\1/g;
  for (const match of file.runtimeText.matchAll(literalPattern)) {
    const literal = match[2];
    if (literal) matches.push(literal);
  }
  return matches;
}

describe('P1 prospect-facing compliance architecture lint', () => {
  const comFiles = collectSourceFiles(comRoot);

  it('keeps high-risk forbidden compliance language out of .com runtime strings', () => {
    const violations = FORBIDDEN_RUNTIME_PATTERNS.flatMap((forbidden) =>
      comFiles
        .flatMap((file) => matchingRuntimeLines(file, forbidden.pattern))
        .map((match) => `${forbidden.rule}: ${match}`),
    );

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('renders the canonical shared .com disclaimer instead of hardcoded footer copies', () => {
    const normalizedDisclaimer = normalizeWhitespace(MCS_COM_DISCLAIMER);
    const hardcodedCopies = comFiles
      .filter((file) => normalizeWhitespace(file.runtimeText).includes(normalizedDisclaimer))
      .map((file) => file.relativePath);

    expect(hardcodedCopies).toEqual([]);

    for (const file of comFiles.filter((item) => FOOTER_PATHS.has(item.relativePath))) {
      expect(file.runtimeText, file.relativePath).toContain('MCS_COM_DISCLAIMER');
    }
  });

  it('keeps apps/com API literals in prospect token or prospect re-entry route families', () => {
    const apiLiterals = comFiles.flatMap((file) =>
      extractApiStringLiterals(file).map((literal) => `${file.relativePath}: ${literal}`),
    );
    const bad = apiLiterals.filter((entry) => !/:\s\/api\/(?:p(?:\/|$)|rvm(?:\/|$))/.test(entry));

    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('keeps every apps/com client endpoint mapped to prospect-only server access classes', () => {
    const byKey = new Map(routeAccessMatrix().routes.map((route) => [routeKey(route), route]));
    const issues: string[] = [];

    for (const expected of EXPECTED_COM_ENDPOINTS) {
      const key = routeKey(expected);
      const route = byKey.get(key);
      if (!route) {
        issues.push(`missing route: ${key}`);
        continue;
      }
      if (route.accessClass !== expected.accessClass) {
        issues.push(`wrong access class: ${key} expected ${expected.accessClass}, got ${route.accessClass}`);
      }
      if (
        route.declared.requireAuth ||
        route.declared.requireAdmin ||
        route.declared.requireAdminOrHealthSecret ||
        route.declared.requireRuntimeInternal ||
        route.declared.requireSteveComplete ||
        route.declared.requireVmDialerAccess
      ) {
        issues.push(`unexpected BA/admin/internal gate on prospect endpoint: ${key}`);
      }
      for (const finding of route.findings) {
        issues.push(`route matrix finding on ${key}: ${finding}`);
      }
    }

    expect(issues, issues.join('\n')).toEqual([]);
  });
});
