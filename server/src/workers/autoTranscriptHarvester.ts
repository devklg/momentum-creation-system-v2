import { pathToFileURL } from 'node:url';
import { harvestAutoHarvesterTranscripts, type AutoHarvestResult } from '../domain/adminChatTranscripts.js';

const AUTO_HARVEST_HOURS = [3, 15] as const;

export interface AutoTranscriptHarvesterStatus {
  started: boolean;
  inFlight: boolean;
  lastRequestedBy: 'manual' | 'scheduled' | null;
  lastRunWindow: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  lastError: string | null;
  lastResult: {
    requested: number;
    written: number;
    skipped: number;
    sourceSessionCount: number;
    runWindow: string | null;
  } | null;
}

let workerStarted = false;
let timer: NodeJS.Timeout | null = null;
let inFlight: boolean = false;
let inFlightRun: Promise<AutoHarvestResult> | null = null;
let lastStatus: AutoTranscriptHarvesterStatus = {
  started: false,
  inFlight: false,
  lastRequestedBy: null,
  lastRunWindow: null,
  lastRunAt: null,
  lastSuccessAt: null,
  nextRunAt: null,
  totalRuns: 0,
  lastError: null,
  lastResult: null,
};

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function computeNextRunWindow(from: Date = new Date()): { runAt: Date; label: string } {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  for (const hour of AUTO_HARVEST_HOURS) {
    const candidate = new Date(base.getTime());
    candidate.setHours(hour, 0, 0, 0);
    if (candidate.getTime() > from.getTime()) {
      return { runAt: candidate, label: formatHourLabel(hour) };
    }
  }
  const candidate = new Date(base.getTime());
  candidate.setDate(candidate.getDate() + 1);
  candidate.setHours(AUTO_HARVEST_HOURS[0], 0, 0, 0);
  return { runAt: candidate, label: formatHourLabel(AUTO_HARVEST_HOURS[0]) };
}

function scheduleNextRun(): void {
  if (!workerStarted) {
    return;
  }
  if (timer) clearTimeout(timer);
  const next = computeNextRunWindow();
  lastStatus = {
    ...lastStatus,
    nextRunAt: next.runAt.toISOString(),
  };
  const delay = Math.max(0, next.runAt.getTime() - Date.now());
  timer = setTimeout(() => {
    void runAutoHarvest('scheduled', next.label);
  }, delay);
}

function recordError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runAutoHarvest(
  initiatedBy: AutoTranscriptHarvesterStatus['lastRequestedBy'],
  runWindow: string | null,
): Promise<AutoHarvestResult> {
  if (inFlightRun) {
    return inFlightRun;
  }
  inFlight = true;
  lastStatus = {
    ...lastStatus,
    inFlight,
    started: true,
    lastRequestedBy: initiatedBy ?? null,
    lastRunWindow: runWindow,
    lastRunAt: new Date().toISOString(),
  };
  inFlightRun = harvestAutoHarvesterTranscripts({
    initiatedBy: initiatedBy ?? 'manual',
    runWindow,
  })
    .then((result) => {
      lastStatus = {
        ...lastStatus,
        inFlight: false,
        lastResult: {
          requested: result.requested,
          written: result.written,
          skipped: result.skipped,
          sourceSessionCount: result.sourceSessionCount,
          runWindow: result.runWindow,
        },
        totalRuns: lastStatus.totalRuns + 1,
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        lastRunAt: new Date().toISOString(),
      };
      return result;
    })
    .catch((error) => {
      const message = recordError(error);
      lastStatus = {
        ...lastStatus,
        lastError: message,
        lastRunAt: new Date().toISOString(),
      };
      throw error;
    })
    .finally(() => {
      inFlight = false;
      inFlightRun = null;
      lastStatus = {
        ...lastStatus,
        inFlight: false,
      };
      scheduleNextRun();
    });
  return inFlightRun;
}

export function getAutoTranscriptHarvesterStatus(): AutoTranscriptHarvesterStatus {
  return {
    ...lastStatus,
    started: workerStarted,
    inFlight,
  };
}

export function startAutoTranscriptHarvesterWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  scheduleNextRun();
  // eslint-disable-next-line no-console
  console.log('[autoTranscriptHarvester] started — windows 03:00 and 15:00 local');
}

export function stopAutoTranscriptHarvesterWorker(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  workerStarted = false;
  lastStatus = {
    ...lastStatus,
    started: false,
    nextRunAt: null,
  };
  // eslint-disable-next-line no-console
  console.log('[autoTranscriptHarvester] stopped');
}

export async function runAutoTranscriptHarvesterNow(): Promise<AutoHarvestResult> {
  return runAutoHarvest('manual', null);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runAutoHarvest('manual', null);
}
