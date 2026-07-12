import { runCrmCleanup } from '../src/domain/crmCleanup.js';

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 500;

interface CliOptions {
  dryRun: boolean;
  limit: number;
  nowMs?: number;
}

function usage(): string {
  return [
    'Usage: pnpm --filter @momentum/server cleanup:crm [options]',
    '',
    'Runs in dry-run mode unless --apply is explicitly supplied.',
    '',
    'Options:',
    `  --limit <n>   Maximum rows to inspect (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`,
    '  --now <iso>   Evaluate cleanup rules at this ISO-8601 timestamp',
    '  --dry-run     Inspect and report without writing (default)',
    '  --apply       Apply cleanup repairs',
    '  --help, -h    Show this help',
  ].join('\n');
}

function parseArgs(argv: string[]): CliOptions | null {
  const options: CliOptions = { dryRun: true, limit: DEFAULT_LIMIT };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return null;
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--apply') {
      options.dryRun = false;
      continue;
    }
    if (arg === '--limit') {
      const raw = argv[i + 1];
      i += 1;
      const value = Number(raw);
      if (!raw || !Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
        throw new Error(`--limit must be an integer from 1 to ${MAX_LIMIT}`);
      }
      options.limit = value;
      continue;
    }
    if (arg === '--now') {
      const raw = argv[i + 1];
      i += 1;
      if (!raw) throw new Error('--now requires an ISO-8601 timestamp');
      const nowMs = Date.parse(raw);
      if (!Number.isFinite(nowMs) || !/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        throw new Error('--now must be a valid ISO-8601 timestamp');
      }
      options.nowMs = nowMs;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    // eslint-disable-next-line no-console
    console.log(usage());
    return;
  }

  const result = await runCrmCleanup(options);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
