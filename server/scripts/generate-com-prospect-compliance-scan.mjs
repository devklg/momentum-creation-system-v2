#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Node, Project } from 'ts-morph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const sharedCompliancePath = path.join(repoRoot, 'packages/shared/src/compliance.ts');
const outDir = path.join(repoRoot, 'engineering/sprints/platform-audit-p1');
const jsonPath = path.join(outDir, 'com-prospect-compliance-scan.json');
const mdPath = path.join(outDir, 'COM_PROSPECT_COMPLIANCE_SCAN.md');
const check = process.argv.includes('--check');
const SOURCE_GLOBS = ['apps/com/src/**/*.ts', 'apps/com/src/**/*.tsx'];
const USER_VISIBLE_JSX_ATTRIBUTES = new Set([
  'alt',
  'aria-label',
  'aria-description',
  'label',
  'placeholder',
  'title',
]);
const TECHNICAL_LITERAL_KEYS = new Set([
  'className',
  'eventId',
  'fullPath',
  'href',
  'id',
  'key',
  'kind',
  'route',
  'src',
  'token',
  'type',
]);

const BLOCKING_RULES = [
  {
    id: 'income_or_compensation_claim',
    severity: 'blocker',
    description: 'No income, earnings, compensation, commission, rank, cycle, CV, bonus, or payout claims.',
    pattern: /\b(?:income|earnings?|compensation|commissions?|rank\s+advancement|cycle\s+math|CV|bonus(?:es)?|payouts?)\b/i,
  },
  {
    id: 'placement_or_spillover_promise',
    severity: 'blocker',
    description: 'No placement guarantees, spillover promises, binary-leg promises, or downline projections.',
    pattern:
      /\b(?:spillover|binary\s+leg|secured\s+a\s+leg|leg\s+position|placement\s+promise|placement\s+guarantee|guarantee[sd]?\s+(?:a\s+)?(?:final\s+)?placement|downline\s+projection)\b/i,
  },
  {
    id: 'ai_prospecting_or_qualification',
    severity: 'blocker',
    description: 'No AI prospecting, automated calling, AI lead qualification, scoring, or ranking language.',
    pattern:
      /\b(?:AI\s+prospecting|automated\s+prospecting|AI\s+calling|lead\s+qualification|lead\s+scor(?:e|ing)|prospect\s+scor(?:e|ing)|hot\s+lead|warm\s+lead|cold\s+lead)\b/i,
  },
  {
    id: 'current_team_headcount',
    severity: 'blocker',
    description: 'No current team head count; the 100,000 goal is allowed.',
    pattern:
      /\b(?:current\s+team\s+(?:count|head\s+count)|team\s+head\s+count|active\s+team\s+count|\d{2,6}\s+(?:active\s+)?(?:BAs|Brand\s+Ambassadors)\s+(?:already|currently|today|now|on\s+the\s+team))\b/i,
  },
  {
    id: 'three_company_branding',
    severity: 'blocker',
    description: 'No THREE International company branding, logo references, or promoter disclaimers.',
    pattern:
      /\b(?:THREE\s+International|independent\s+promoter|independent\s+brand\s+ambassador|THREE(?:'s)?\s+(?:logo|brand|branding|corporate|company))\b/i,
  },
  {
    id: 'programmatic_three_handoff',
    severity: 'blocker',
    description: 'No programmatic enrollment, registration, or company handoff route language.',
    pattern:
      /\b(?:register\s+(?:with|in)\s+THREE|enroll\s+(?:with|in)\s+THREE|registration\s+handoff|programmatic\s+handoff|complete\s+your\s+THREE\s+signup)\b/i,
  },
];

const ALLOWED_SIGNAL_RULES = [
  {
    id: 'glp_three_product_context',
    description: 'GLP-THREE product naming is allowed when it does not name THREE International.',
    pattern: /\bGLP-THREE\b/,
  },
  {
    id: 'public_market_or_cost_context',
    description: 'Public market figures and product-category cost context are allowed when not tied to earnings.',
    pattern: /(?:\$[\d,.]+|\b\d+(?:\.\d+)?\s*(?:billion|trillion|million|%)\b)/i,
  },
  {
    id: 'team_goal_context',
    description: 'The 100,000 team goal is allowed; current team head count is not.',
    pattern: /\b100,000\b|\bqualified\s+brand\s+ambassadors\b/i,
  },
  {
    id: 'pmv_language_context',
    description: 'Prospect-facing PMV language is People, Momentum, Volume, and Checks.',
    pattern: /\b(?:people|momentum|volume|checks)\b/i,
  },
  {
    id: 'placement_demo_context',
    description: 'Queue, placement, and beneath-you language is allowed only as team activity demonstration.',
    pattern: /\b(?:queue|position|placement|placed|beneath\s+you|holding\s+tank|team\s+line)\b/i,
  },
  {
    id: 'canonical_disclaimer',
    description: 'The canonical .com disclaimer is allowed only through packages/shared/src/compliance.ts.',
    pattern: /\b(?:do not guarantee any final placement|no income claims, placement promises, or guarantees)\b/i,
  },
];

function normalizePath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function literalValue(node) {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  return null;
}

function hasAncestor(node, predicate) {
  let current = node.getParent();
  while (current) {
    if (predicate(current)) return true;
    current = current.getParent();
  }
  return false;
}

function enclosingVariableName(node) {
  let current = node.getParent();
  while (current) {
    if (Node.isVariableDeclaration(current)) return current.getName();
    if (Node.isPropertyDeclaration(current)) return current.getName();
    current = current.getParent();
  }
  return '';
}

function propertyName(node) {
  const parent = node.getParent();
  if (Node.isPropertyAssignment(parent) && parent.getInitializer() === node) {
    return parent.getNameNode().getText().replace(/^['"]|['"]$/g, '');
  }
  return '';
}

function isCssTemplate(node) {
  return /(css|styles?)$/i.test(enclosingVariableName(node));
}

function isInsideImportOrExport(node) {
  return hasAncestor(
    node,
    (ancestor) => Node.isImportDeclaration(ancestor) || Node.isExportDeclaration(ancestor),
  );
}

function isTechnicalLiteral(value, key) {
  if (!/[A-Za-z]/.test(value)) return true;
  if (TECHNICAL_LITERAL_KEYS.has(key)) return true;
  if (/^(?:@|\.{1,2}\/|https?:\/\/|\/api\/|\/p\/|\/rvm\/|\/assets\/|#)/.test(value)) return true;
  if (/\.(?:png|jpe?g|webp|svg|pdf|css|ts|tsx|js|jsx)$/i.test(value)) return true;
  if (/^[a-z0-9_-]+$/i.test(value) && !/\b(?:GLP|Team|Magnificent|People|Momentum|Volume|Checks)\b/i.test(value)) {
    return true;
  }
  return false;
}

function addRow(rows, sourceFile, node, kind, text) {
  const normalized = normalizeText(text);
  if (!normalized) return;
  rows.push({
    file: normalizePath(sourceFile.getFilePath()),
    lineNumber: node.getStartLineNumber(),
    kind,
    text: normalized,
  });
}

function collectVisibleRows() {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(SOURCE_GLOBS);
  if (existsSync(sharedCompliancePath)) project.addSourceFileAtPath(sharedCompliancePath);

  const rows = [];
  const sourceFiles = project.getSourceFiles().sort((a, b) => a.getFilePath().localeCompare(b.getFilePath()));
  const filesScanned = sourceFiles.filter((sourceFile) => normalizePath(sourceFile.getFilePath()).startsWith('apps/com/src/')).length;

  for (const sourceFile of sourceFiles) {
    sourceFile.forEachDescendant((node) => {
      if (Node.isJsxText(node)) {
        addRow(rows, sourceFile, node, 'jsx_text', node.getText());
        return;
      }

      if (Node.isJsxAttribute(node)) {
        const name = node.getNameNode().getText();
        if (!USER_VISIBLE_JSX_ATTRIBUTES.has(name)) return;
        const initializer = node.getInitializer();
        if (initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))) {
          addRow(rows, sourceFile, initializer, `jsx_attribute:${name}`, initializer.getLiteralText());
        }
        return;
      }

      if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node)) return;
      if (isInsideImportOrExport(node)) return;
      if (hasAncestor(node, Node.isJsxAttribute)) return;
      if (isCssTemplate(node)) return;

      const value = literalValue(node);
      if (!value) return;
      const key = propertyName(node);
      if (isTechnicalLiteral(value, key)) return;
      addRow(rows, sourceFile, node, key ? `literal:${key}` : 'literal', value);
    });
  }

  return {
    filesScanned,
    rows: rows.sort((a, b) => a.file.localeCompare(b.file) || a.lineNumber - b.lineNumber || a.text.localeCompare(b.text)),
  };
}

function scanRules(rows, rules, options = {}) {
  return rules.flatMap((rule) =>
    rows
      .filter((row) => rule.pattern.test(row.text) && !(options.skipRuleSourceExemptions && isBlockingRuleSourceExemption(row)))
      .map((row) => ({
        ruleId: rule.id,
        severity: rule.severity ?? 'allowed',
        description: rule.description,
        file: row.file,
        line: row.lineNumber,
        text: row.text,
      })),
  );
}

function isBlockingRuleSourceExemption(row) {
  return row.file === 'packages/shared/src/compliance.ts';
}

function groupCountsBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function buildScan() {
  const collected = collectVisibleRows();
  const rows = collected.rows;
  const violations = scanRules(rows, BLOCKING_RULES, { skipRuleSourceExemptions: true });
  const allowedSignals = scanRules(rows, ALLOWED_SIGNAL_RULES);

  return {
    generatedAt: new Date().toISOString(),
    scope: 'apps/com/src visible strings plus shared compliance constants',
    summary: {
      filesScanned: collected.filesScanned,
      visibleStringsScanned: rows.length,
      blockingViolations: violations.length,
      allowedSignals: allowedSignals.length,
      status: violations.length === 0 ? 'pass' : 'fail',
      allowedSignalsByRule: groupCountsBy(allowedSignals, 'ruleId'),
    },
    blockingRules: BLOCKING_RULES.map(({ id, severity, description }) => ({ id, severity, description })),
    allowedSignalRules: ALLOWED_SIGNAL_RULES.map(({ id, description }) => ({ id, description })),
    violations,
    allowedSignals,
    scannedStrings: rows,
  };
}

function renderMarkdown(scan) {
  const lines = [];
  lines.push('# COM Prospect Compliance Scan');
  lines.push('');
  lines.push(`Generated: ${scan.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Scope: \`${scan.scope}\``);
  lines.push(`- Files scanned: ${scan.summary.filesScanned}`);
  lines.push(`- Visible strings scanned: ${scan.summary.visibleStringsScanned}`);
  lines.push(`- Blocking violations: ${scan.summary.blockingViolations}`);
  lines.push(`- Allowed signals: ${scan.summary.allowedSignals}`);
  lines.push(`- Status: ${scan.summary.status}`);
  lines.push('');
  lines.push('## Blocking Rules');
  lines.push('');
  lines.push('| Rule | Description |');
  lines.push('| --- | --- |');
  for (const rule of scan.blockingRules) {
    lines.push(`| \`${rule.id}\` | ${rule.description} |`);
  }
  lines.push('');
  lines.push('## Allowed Signal Counts');
  lines.push('');
  lines.push('| Signal | Count | Description |');
  lines.push('| --- | ---: | --- |');
  for (const rule of scan.allowedSignalRules) {
    lines.push(
      `| \`${rule.id}\` | ${scan.summary.allowedSignalsByRule[rule.id] ?? 0} | ${rule.description} |`,
    );
  }
  lines.push('');
  lines.push('## Violations');
  lines.push('');
  if (scan.violations.length === 0) {
    lines.push('None.');
  } else {
    lines.push('| Rule | Source | Text |');
    lines.push('| --- | --- | --- |');
    for (const violation of scan.violations) {
      lines.push(`| \`${violation.ruleId}\` | \`${violation.file}:${violation.line}\` | ${violation.text} |`);
    }
  }
  lines.push('');
  lines.push('## Allowed Signal Samples');
  lines.push('');
  lines.push('| Signal | Source | Text |');
  lines.push('| --- | --- | --- |');
  for (const signal of scan.allowedSignals.slice(0, 80)) {
    lines.push(`| \`${signal.ruleId}\` | \`${signal.file}:${signal.line}\` | ${signal.text} |`);
  }
  return `${lines.join('\n')}\n`;
}

function stableScan(scan, generatedAt) {
  return { ...scan, generatedAt };
}

function readExistingGeneratedAt() {
  if (!existsSync(jsonPath)) return null;
  try {
    const existing = JSON.parse(readFileSync(jsonPath, 'utf8'));
    return typeof existing.generatedAt === 'string' ? existing.generatedAt : null;
  } catch {
    return null;
  }
}

function main() {
  const generatedAt = check ? readExistingGeneratedAt() ?? new Date().toISOString() : new Date().toISOString();
  const scan = stableScan(buildScan(), generatedAt);
  const json = `${JSON.stringify(scan, null, 2)}\n`;
  const md = renderMarkdown(scan);

  if (check) {
    const currentJson = existsSync(jsonPath) ? readFileSync(jsonPath, 'utf8') : '';
    const currentMd = existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : '';
    const drift = currentJson !== json || currentMd !== md;
    if (drift) {
      console.error('COM prospect compliance scan is stale. Run pnpm compliance:com.');
      process.exit(1);
    }
    if (scan.summary.blockingViolations > 0) {
      console.error(`COM prospect compliance scan has ${scan.summary.blockingViolations} blocking violations.`);
      process.exit(1);
    }
    console.log(
      `COM prospect compliance scan is current (${scan.summary.filesScanned} files, ${scan.summary.blockingViolations} violations).`,
    );
    return;
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(mdPath, md);
  if (scan.summary.blockingViolations > 0) {
    console.error(`Wrote COM prospect compliance scan with ${scan.summary.blockingViolations} blocking violations.`);
    process.exit(1);
  }
  console.log(
    `Wrote COM prospect compliance scan (${scan.summary.filesScanned} files, ${scan.summary.blockingViolations} violations).`,
  );
}

main();
