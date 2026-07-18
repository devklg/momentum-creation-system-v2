import type {
  McsHoldingTankSnapshot,
  McsKongaAddedBy,
  McsKongaHoldingTankSnapshot,
  McsKongaPlacementTickerEntry,
  McsWebinarEvent,
} from '@momentum/shared';
import { MCS_KONGA_CONTRACT_VERSION } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';

const TIME_ZONE = 'America/Los_Angeles';
const PLACEMENTS_COLLECTION = 'tmag_prospect_htank_placements';

interface PlacementTelemetryRow {
  positionNumber: number;
  placedAt: string;
  city?: string;
  stateOrRegion?: string;
  addedBy?: McsKongaAddedBy;
}

function zonedParts(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
}

function localMidnightToUtc(year: number, month: number, day: number): Date {
  const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = desired;
  for (let i = 0; i < 3; i += 1) {
    const p = zonedParts(new Date(guess));
    const represented = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
    guess += desired - represented;
  }
  return new Date(guess);
}

/** Monday 00:00 in America/Los_Angeles for the instant supplied. */
export function startOfKongaWeek(now: Date): Date {
  const p = zonedParts(now);
  const localDate = new Date(Date.UTC(p.year!, p.month! - 1, p.day!));
  const sundayZero = localDate.getUTCDay();
  const daysSinceMonday = (sundayZero + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return localMidnightToUtc(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth() + 1,
    localDate.getUTCDate(),
  );
}

export function normalizedGeoKey(city: string, stateOrRegion: string): string | null {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const normalizedCity = normalize(city);
  const normalizedState = normalize(stateOrRegion);
  return normalizedCity && normalizedState ? `${normalizedCity}|${normalizedState}` : null;
}

export function summarizeKongaWeek(
  rows: PlacementTelemetryRow[],
  now: Date,
): { placementsThisWeek: number; geoSpreadCount: number } {
  const start = startOfKongaWeek(now).getTime();
  const inWindow = rows.filter((row) => {
    const at = Date.parse(row.placedAt);
    return Number.isFinite(at) && at >= start && at <= now.getTime();
  });
  const geos = new Set(
    inWindow
      .map((row) => normalizedGeoKey(row.city ?? '', row.stateOrRegion ?? ''))
      .filter((key): key is string => key !== null),
  );
  return { placementsThisWeek: inWindow.length, geoSpreadCount: geos.size };
}

export async function readKongaTelemetry(
  now: Date = new Date(),
  persistence: typeof persistenceCall = persistenceCall,
): Promise<{ placementsThisWeek: number; geoSpreadCount: number }> {
  const result = await persistence<{ documents?: PlacementTelemetryRow[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: PLACEMENTS_COLLECTION,
    filter: { placedAt: { $gte: startOfKongaWeek(now).toISOString(), $lte: now.toISOString() } },
    limit: 100_000,
  });
  return summarizeKongaWeek(result.documents ?? [], now);
}

export async function addKongaAttributionToRecent(
  recent: McsHoldingTankSnapshot['recent'],
  persistence: typeof persistenceCall = persistenceCall,
): Promise<McsKongaPlacementTickerEntry[]> {
  if (recent.length === 0) return [];
  const positions = recent.map((entry) => entry.positionNumber);
  const placements = await persistence<{ documents?: PlacementTelemetryRow[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: PLACEMENTS_COLLECTION,
    filter: { positionNumber: { $in: positions } },
    limit: positions.length,
  });
  const byPosition = new Map(
    (placements.documents ?? []).map((placement) => [
      placement.positionNumber,
      placement.addedBy ?? null,
    ]),
  );
  return recent.map((entry) => ({
    ...entry,
    addedBy: byPosition.get(entry.positionNumber) ?? null,
  }));
}

export async function buildKongaSnapshot(input: {
  legacy: McsHoldingTankSnapshot;
  pageVisitId: string;
  sinceLastVisit: number | null;
  nextWebinar: McsWebinarEvent | null;
  now?: Date;
  persistence?: typeof persistenceCall;
}): Promise<McsKongaHoldingTankSnapshot> {
  const persistence = input.persistence ?? persistenceCall;
  const [telemetry, recent] = await Promise.all([
    readKongaTelemetry(input.now ?? new Date(), persistence),
    addKongaAttributionToRecent(input.legacy.recent, persistence),
  ]);
  return {
    contractVersion: MCS_KONGA_CONTRACT_VERSION,
    globalMaxPosition: input.legacy.globalMaxPosition,
    recent,
    placementsThisWeek: telemetry.placementsThisWeek,
    geoSpreadCount: telemetry.geoSpreadCount,
    nextWebinar: input.nextWebinar,
    sinceLastVisit: input.sinceLastVisit,
    pageVisitId: input.pageVisitId,
  };
}
