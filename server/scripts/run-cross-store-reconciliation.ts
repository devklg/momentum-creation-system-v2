import fs from 'node:fs/promises';
import path from 'node:path';
import { runCrossStoreReconciliation } from '../src/domain/crossStoreReconciliation.js';

interface CliOptions {
  limitPerSpec?: number;
  specKeys?: string[];
  outFile?: string;
  failOnDrift: boolean;
}

function usage(): string {
  return [
    'Usage: pnpm --filter @momentum/server reconcile:stores [options]',
    '',
    'Options:',
    '  --limit <n>          Max Mongo rows sampled per reconciliation spec (default: 25)',
    '  --spec <key>         Run one spec; repeat or comma-separate for several',
    '  --out <file>         Write the JSON report to a file as well as stdout',
    '  --fail-on-drift      Exit 1 when missing/error legs or warnings are found',
  ].join('\n');
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { failOnDrift: false };
  const specs: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      // eslint-disable-next-line no-console
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--fail-on-drift') {
      options.failOnDrift = true;
      continue;
    }
    if (arg === '--limit') {
      const raw = argv[i + 1];
      i += 1;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 1) throw new Error('--limit must be a positive number');
      options.limitPerSpec = value;
      continue;
    }
    if (arg === '--spec') {
      const raw = argv[i + 1];
      i += 1;
      if (!raw) throw new Error('--spec requires a value');
      specs.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
      continue;
    }
    if (arg === '--out') {
      const raw = argv[i + 1];
      i += 1;
      if (!raw) throw new Error('--out requires a file path');
      options.outFile = raw;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }

  if (specs.length > 0) options.specKeys = specs;
  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await runCrossStoreReconciliation({
    limitPerSpec: options.limitPerSpec,
    specKeys: options.specKeys,
  });
  const json = JSON.stringify(report, null, 2);

  if (options.outFile) {
    const outPath = path.resolve(options.outFile);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${json}\n`, 'utf8');
  }

  // eslint-disable-next-line no-console
  console.log(json);
  if (options.failOnDrift && !report.ok) process.exitCode = 1;
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
