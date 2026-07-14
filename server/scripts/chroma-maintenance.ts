import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ChromaMaintenanceMode,
  ChromaMaintenanceOptions,
} from '../src/services/chromaMaintenance/engine.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function usage(): string {
  return [
    'Usage: pnpm chroma:maintain -- --mode <audit|reindex|age-out> --collection <exact-name> [options]',
    '',
    'Options:',
    '  --collection <name>       Exact manifest collection; repeat for more than one',
    '  --batch-size <1..100>     Read batch size (default: 50)',
    '  --max-records <n>         Per-collection safety ceiling (default: 10000)',
    '  --cursor <id>             Resume canonical scan after this cursor',
    '  --apply                   Enable mutations (dry-run is the default)',
    '  --confirm P2-133          Exact mutation confirmation',
    '  --approval-ref <dec_id>   Dedicated dec_p2_133_chroma_live_apply_* decision reference',
    '  --evidence-sha256 <hash>  Exact reviewed dry-run report SHA-256 required for apply',
    '',
    'Live apply is a separate authorization gate. ACR-0027 approval alone does not authorize it.',
  ].join('\n');
}

function requiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function parseMode(value: string): ChromaMaintenanceMode {
  if (value === 'audit' || value === 'reindex') return value;
  if (value === 'age-out' || value === 'age_out') return 'age_out';
  throw new Error(`unsupported --mode '${value}'`);
}

export function parseChromaMaintenanceArgs(argv: string[]): ChromaMaintenanceOptions {
  let mode: ChromaMaintenanceMode | null = null;
  const collections: string[] = [];
  const options: Partial<ChromaMaintenanceOptions> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--mode') {
      const value = requiredValue(argv, index, arg);
      mode = parseMode(value);
      index += 1;
      continue;
    }
    if (arg === '--collection') {
      collections.push(requiredValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === '--batch-size' || arg === '--max-records') {
      const value = Number(requiredValue(argv, index, arg));
      if (!Number.isInteger(value)) throw new Error(`${arg} must be an integer`);
      if (arg === '--batch-size') options.batchSize = value;
      else options.maxRecords = value;
      index += 1;
      continue;
    }
    if (arg === '--cursor' || arg === '--confirm' || arg === '--approval-ref'
      || arg === '--evidence-sha256') {
      const value = requiredValue(argv, index, arg);
      if (arg === '--cursor') options.cursor = value;
      else if (arg === '--confirm') options.confirm = value;
      else if (arg === '--approval-ref') options.approvalRef = value;
      else options.evidenceSha256 = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument '${arg}'`);
  }
  if (!mode) throw new Error('--mode is required');
  return { ...options, mode, collections };
}

function reportFileName(generatedAt: string, mode: ChromaMaintenanceMode, apply: boolean): string {
  const timestamp = generatedAt.replace(/[:.]/g, '-');
  return `${timestamp}-${mode}-${apply ? 'apply' : 'dry-run'}.json`;
}

async function main(): Promise<void> {
  let closeDirectPersistence: (() => Promise<void>) | null = null;
  try {
    const options = parseChromaMaintenanceArgs(process.argv.slice(2));
    const engine = await import('../src/services/chromaMaintenance/engine.js');
    engine.preflightChromaMaintenance(options);
    const runtime = await import('../src/services/chromaMaintenance/runtimePort.js');
    const persistence = await import('../src/services/persistence/index.js');
    closeDirectPersistence = persistence.closeDirectPersistence;
    await persistence.connectDirectPersistence();
    const report = await engine.runChromaMaintenance(
      options,
      runtime.createChromaMaintenanceRuntimePort(),
    );
    const reportDir = path.join(repoRoot, '.logs', 'chroma-maintenance');
    const reportPath = path.join(
      reportDir,
      reportFileName(report.generatedAt, report.mode, report.apply),
    );
    await fs.mkdir(reportDir, { recursive: true });
    const reportJson = `${JSON.stringify(report, null, 2)}\n`;
    const reportSha256 = createHash('sha256').update(reportJson).digest('hex');
    await fs.writeFile(reportPath, reportJson, 'utf8');
    await fs.writeFile(`${reportPath}.sha256`, `${reportSha256}  ${path.basename(reportPath)}\n`, 'utf8');
    console.log(
      `[chroma-maintenance] mode=${report.mode} apply=${report.apply} collections=${report.collections.length} `
      + `liveObserved=${report.summary.liveRecordsObserved} canonical=${report.summary.canonicalRecordsExamined} `
      + `reindex=${report.summary.reindexCandidates} ageOut=${report.summary.ageOutCandidates} `
      + `blocked=${report.summary.blockedCandidates}`,
    );
    console.log(`[chroma-maintenance] report=${reportPath}`);
    console.log(`[chroma-maintenance] reportSha256=${reportSha256}`);
  } finally {
    if (closeDirectPersistence) await closeDirectPersistence();
  }
}

main().catch((error) => {
  console.error(`[chroma-maintenance] ${error instanceof Error ? error.message : String(error)}`);
  console.error(usage());
  process.exitCode = 1;
});
