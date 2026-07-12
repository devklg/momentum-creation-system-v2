#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/freshness-manifest.json');
const check = process.argv.includes('--check');

const coreDocs = [
  ['docs/READ-ME-FIRST.md', 'current_navigation'],
  ['docs/AGENT-BRIEFING.md', 'current_orientation'],
  ['docs/locked-spec.md', 'authoritative_state'],
  ['docs/project-wireframe.md', 'current_build_decomposition'],
  ['PLATFORM_AUDIT_PRIORITY_TASKLIST.md', 'current_execution_queue'],
];
const reviewedAt = '2026-07-12';

const generatedArtifacts = [
  ['docs/build-registry.md', 'server/scripts/generate-build-registry.mjs', ['docs/project-wireframe.md']],
  ['docs/build-checklist.html', 'server/scripts/build-checklist.mjs', ['docs/project-wireframe.md']],
  ['engineering/sprints/platform-audit-p1/api-route-map.json', 'server/scripts/generate-api-route-map.mjs', ['server/src/index.ts']],
  ['engineering/sprints/platform-audit-p1/route-access-matrix.json', 'server/scripts/generate-route-access-matrix.mjs', ['engineering/sprints/platform-audit-p1/api-route-map.json']],
  ['engineering/sprints/platform-audit-p1/persistence-write-catalog.json', 'server/scripts/generate-persistence-write-catalog.mjs', ['server/src']],
  ['engineering/sprints/platform-audit-p1/schema-catalog.json', 'server/scripts/generate-schema-catalog.mjs', ['packages/shared/src', 'server/src']],
  ['engineering/sprints/platform-audit-p1/mongo-ownership-map.json', 'server/scripts/generate-mongo-ownership-map.mjs', ['server/src']],
  ['engineering/sprints/platform-audit-p1/mongo-index-audit-plan.json', 'server/scripts/generate-mongo-index-audit.mjs', ['server/src']],
  ['engineering/sprints/platform-audit-p1/neo4j-catalog.json', 'server/scripts/generate-neo4j-catalog.mjs', ['server/src']],
  ['engineering/sprints/platform-audit-p1/chroma-collection-catalog.json', 'server/scripts/generate-chroma-catalog.mjs', ['server/src']],
  ['engineering/sprints/platform-audit-p1/com-prospect-compliance-scan.json', 'server/scripts/generate-com-prospect-compliance-scan.mjs', ['apps/com/src', 'packages/shared/src/compliance.ts']],
];
const historicalDocs = execFileSync('git', ['ls-files', 'docs'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter((file) => /(?:^docs\/chat-\d+-|AUDIT_|IMPLEMENTATION_PLAN_|APP_STATE_AUDIT)/i.test(file))
  .sort();

function sha256(relative) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return null;
  const hash = createHash('sha256');
  const addFile = (file) => {
    const bytes = readFileSync(file);
    const textLike = /\.(?:md|json|mjs|js|ts|tsx|html|css|yml|yaml|txt)$/i.test(file);
    hash.update(textLike ? bytes.toString('utf8').replace(/\r\n/g, '\n') : bytes);
  };
  if (statSync(absolute).isFile()) {
    addFile(absolute);
    return hash.digest('hex');
  }
  const files = execFileSync('git', ['ls-files', `${relative.replaceAll('\\', '/')}/*`], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  for (const file of files) {
    hash.update(file).update('\0');
    addFile(path.join(root, file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function embeddedGeneratedAt(relative) {
  if (!relative.endsWith('.json')) return null;
  try {
    const parsed = JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
    return typeof parsed.generatedAt === 'string' ? parsed.generatedAt : null;
  } catch {
    return null;
  }
}

const manifest = {
  schemaVersion: 2,
  freshnessBasis: 'content_sha256_and_declared_review_date',
  authorityRule: 'decision ledger > locked spec > design docs > generated mirrors > git log > agent registry > handoffs',
  instructions: 'Regenerate an artifact when any declared source hash changes. reviewedAt is freshness metadata. authorityStatus states how a document may be used.',
  coreDocs: coreDocs.map(([file, authorityStatus]) => ({ file, authorityStatus, contentSha256: sha256(file), reviewedAt })),
  generatedArtifacts: generatedArtifacts.map(([file, generator, sources]) => ({
    file,
    authorityStatus: 'generated_mirror',
    generator,
    sources: sources.map((source) => ({ path: source, contentSha256: sha256(source) })),
    contentSha256: sha256(file),
    lastVerifiedAt: reviewedAt,
    generatedAt: embeddedGeneratedAt(file),
  })),
  historicalDocs: historicalDocs.map((file) => ({
    file,
    authorityStatus: 'historical_reference_only',
    contentSha256: sha256(file),
    useConstraint: 'May explain prior decisions or implementation history; cannot override the decision ledger, locked spec, or current build decomposition.',
  })),
  designReferences: [{
    file: 'docs/dashboard-prototype.md',
    authorityStatus: 'design_reference',
    contentSha256: sha256('docs/dashboard-prototype.md'),
    useConstraint: 'Design authority within its named dashboard scope, subordinate to the decision ledger and locked spec.',
  }],
};

const rendered = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
  const current = existsSync(output) ? readFileSync(output, 'utf8') : '';
  if (current !== rendered) {
    console.error('docs/freshness-manifest.json is stale. Run: pnpm docs:freshness');
    process.exit(1);
  }
  console.log('docs/freshness-manifest.json is current.');
} else {
  writeFileSync(output, rendered, 'utf8');
  console.log('WROTE docs/freshness-manifest.json');
}
