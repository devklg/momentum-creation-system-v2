import { createHash } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';

type Persistence = typeof persistenceCall;

const MONGO_DB = 'momentum';
const PLACEMENTS_COLLECTION = 'tmag_prospect_htank_placements';
const COUNTERS_COLLECTION = 'tmag_prospect_htank_counters';
const TEAM_POOL_ID = 'tm_team_pool';
const DEFAULT_SAMPLE_LIMIT = 25;
const MAX_SAMPLE_LIMIT = 25;
const DEFAULT_SCAN_LIMIT = 50_000;
const MAX_SCAN_LIMIT = 50_000;
const MUTATION_PATTERN = /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|CALL)\b/i;

interface PlacementSnapshot {
  prospectId: string;
  sponsorTmagId: string;
  positionNumber: number;
  placedAt: string;
  flushedAt: string | null;
  flushReason: string | null;
}

interface GraphPlacementSnapshot {
  prospectId: string;
  poolId: string;
  sponsorTmagId: string;
  positionNumber: number;
  placedAt: string;
  flushedAt: string | null;
  flushReason: string | null;
}

export interface PoolPositioningQuerySpec {
  key: 'mongo_placements' | 'mongo_counter' | 'neo4j_placements' | 'neo4j_pools';
  tool: 'mongodb' | 'neo4j';
  action: 'aggregate' | 'query' | 'cypher';
  params: Record<string, unknown>;
}

export interface PoolPositioningVerificationResult {
  key: string;
  description: string;
  status: 'clear' | 'findings' | 'degraded' | 'truncated';
  exactCount: number | null;
  samples: string[];
  degradedReason: string | null;
}

export interface PoolPositioningVerificationReport {
  status: 'clear' | 'findings' | 'degraded' | 'truncated';
  policy: 'read_only_test';
  coverage: {
    expected: number;
    completed: number;
    degraded: number;
  };
  exactFindings: number;
  observations: {
    mongoPlacements: number | null;
    neo4jPlacements: number | null;
    poolCounter: number | null;
    scanLimit: number;
  };
  results: PoolPositioningVerificationResult[];
}

export interface PoolPositioningVerificationOptions {
  persistence?: Persistence;
  sampleLimit?: number;
  scanLimit?: number;
  specs?: readonly PoolPositioningQuerySpec[];
}

export const POOL_POSITIONING_QUERY_CATALOG: readonly PoolPositioningQuerySpec[] = [
  {
    key: 'mongo_placements',
    tool: 'mongodb',
    action: 'aggregate',
    params: {
      database: MONGO_DB,
      collection: PLACEMENTS_COLLECTION,
      pipeline: [
        {
          $project: {
            _id: 0,
            prospectId: 1,
            sponsorTmagId: 1,
            positionNumber: 1,
            placedAt: 1,
            flushedAt: 1,
            flushReason: 1,
          },
        },
        { $sort: { positionNumber: 1, prospectId: 1 } },
        { $limit: '$scanLimitPlusOne' },
      ],
    },
  },
  {
    key: 'mongo_counter',
    tool: 'mongodb',
    action: 'query',
    params: {
      database: MONGO_DB,
      collection: COUNTERS_COLLECTION,
      filter: { _id: TEAM_POOL_ID },
      projection: { _id: 0, current: 1 },
      limit: 1,
    },
  },
  {
    key: 'neo4j_placements',
    tool: 'neo4j',
    action: 'cypher',
    params: {
      query:
        'MATCH (prospect:TmagProspect)-[edge:IN_HOLDING_TANK]->(pool:TmagPool) ' +
        'RETURN prospect.prospectId AS prospectId, pool.id AS poolId, ' +
        'edge.sponsorTmagId AS sponsorTmagId, edge.position AS positionNumber, ' +
        'edge.placedAt AS placedAt, edge.flushedAt AS flushedAt, ' +
        'edge.flushReason AS flushReason ' +
        'ORDER BY edge.position, prospect.prospectId LIMIT toInteger($scanLimitPlusOne)',
      params: { scanLimitPlusOne: '$scanLimitPlusOne' },
    },
  },
  {
    key: 'neo4j_pools',
    tool: 'neo4j',
    action: 'cypher',
    params: {
      query:
        'MATCH (pool:TmagPool) ' +
        'WITH collect(toString(pool.id)) AS poolIds ' +
        'RETURN size(poolIds) AS total, poolIds[..$sampleLimit] AS samples',
      params: { sampleLimit: '$sampleLimit' },
    },
  },
] as const;

const INVARIANTS = [
  ['single_team_pool', 'Only the canonical team-wide pool may exist or receive placement edges.'],
  ['one_placement_per_prospect', 'Each prospect must have one canonical placement and one graph edge.'],
  ['unique_positive_position', 'Every placement position must be a unique positive safe integer.'],
  ['counter_covers_positions', 'The canonical counter must be nonnegative and cover the highest minted position.'],
  ['timestamp_position_order', 'Lower positions cannot have later placement timestamps than higher positions.'],
  ['flush_metadata_pair', 'Flush timestamp and governed reason must be both absent or both populated.'],
  ['mongo_neo4j_parity', 'Mongo placement identity and graph edge properties must match exactly.'],
] as const;

export function validatePoolPositioningQueryCatalog(
  specs: readonly PoolPositioningQuerySpec[] = POOL_POSITIONING_QUERY_CATALOG,
): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const spec of specs) {
    if (keys.has(spec.key)) errors.push(`duplicate_key:${spec.key}`);
    keys.add(spec.key);
    const serialized = JSON.stringify(spec.params);
    if (MUTATION_PATTERN.test(serialized)) errors.push(`unsafe_query:${spec.key}`);
    if (
      (spec.key === 'mongo_placements' || spec.key === 'neo4j_placements') &&
      !serialized.includes('scanLimitPlusOne')
    ) {
      errors.push(`unbounded_scan:${spec.key}`);
    }
    if (spec.key === 'neo4j_pools' && !serialized.includes('sampleLimit')) {
      errors.push(`unbounded_samples:${spec.key}`);
    }
  }
  for (const required of ['mongo_placements', 'mongo_counter', 'neo4j_placements', 'neo4j_pools']) {
    if (!keys.has(required)) errors.push(`missing_query:${required}`);
  }
  return errors;
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0
    ? Math.min(value!, maximum)
    : fallback;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const toNumber = (value as { toNumber?: unknown }).toNumber;
    if (typeof toNumber === 'function') {
      const converted = toNumber.call(value);
      if (Number.isSafeInteger(converted)) return converted;
    }
  }
  return null;
}

function isoValue(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function result(
  key: string,
  description: string,
  findings: string[],
  sampleLimit: number,
): PoolPositioningVerificationResult {
  const samples = findings.slice(0, sampleLimit).map(fingerprint);
  return {
    key,
    description,
    status: findings.length === 0 ? 'clear' : findings.length > samples.length ? 'truncated' : 'findings',
    exactCount: findings.length,
    samples,
    degradedReason: null,
  };
}

function degradedResults(reason: string): PoolPositioningVerificationResult[] {
  return INVARIANTS.map(([key, description]) => ({
    key,
    description,
    status: 'degraded',
    exactCount: null,
    samples: [],
    degradedReason: reason,
  }));
}

function parseMongoPlacement(row: Record<string, unknown>): PlacementSnapshot | null {
  const positionNumber = numberValue(row.positionNumber);
  const placedAt = isoValue(row.placedAt);
  if (
    typeof row.prospectId !== 'string' ||
    typeof row.sponsorTmagId !== 'string' ||
    positionNumber === null ||
    placedAt === null
  ) return null;
  return {
    prospectId: row.prospectId,
    sponsorTmagId: row.sponsorTmagId,
    positionNumber,
    placedAt,
    flushedAt: nullableString(row.flushedAt),
    flushReason: nullableString(row.flushReason),
  };
}

function parseGraphPlacement(row: Record<string, unknown>): GraphPlacementSnapshot | null {
  const placement = parseMongoPlacement(row);
  if (!placement || typeof row.poolId !== 'string') return null;
  return { ...placement, poolId: row.poolId };
}

function parityKey(row: PlacementSnapshot): string {
  return [
    row.prospectId,
    row.sponsorTmagId,
    row.positionNumber,
    row.placedAt,
    row.flushedAt ?? '',
    row.flushReason ?? '',
  ].join('|');
}

export async function verifyPoolPositioningGraph(
  options: PoolPositioningVerificationOptions = {},
): Promise<PoolPositioningVerificationReport> {
  const specs = options.specs ?? POOL_POSITIONING_QUERY_CATALOG;
  const validationErrors = validatePoolPositioningQueryCatalog(specs);
  const sampleLimit = bounded(options.sampleLimit, DEFAULT_SAMPLE_LIMIT, MAX_SAMPLE_LIMIT);
  const scanLimit = bounded(options.scanLimit, DEFAULT_SCAN_LIMIT, MAX_SCAN_LIMIT);
  const emptyObservations = {
    mongoPlacements: null,
    neo4jPlacements: null,
    poolCounter: null,
    scanLimit,
  };
  if (validationErrors.length > 0) {
    return {
      status: 'degraded',
      policy: 'read_only_test',
      coverage: { expected: INVARIANTS.length, completed: 0, degraded: INVARIANTS.length },
      exactFindings: 0,
      observations: emptyObservations,
      results: degradedResults(validationErrors.join(',')),
    };
  }

  const persistence = options.persistence ?? persistenceCall;
  const byKey = new Map(specs.map((spec) => [spec.key, spec]));
  try {
    const mongoSpec = byKey.get('mongo_placements')!;
    const mongoParams = structuredClone(mongoSpec.params);
    const pipeline = (mongoParams.pipeline as Array<Record<string, unknown>>).map((stage) =>
      '$limit' in stage ? { $limit: scanLimit + 1 } : stage,
    );
    mongoParams.pipeline = pipeline;
    const mongoResponse = await persistence<{ results?: Array<Record<string, unknown>> }>(
      mongoSpec.tool,
      mongoSpec.action,
      mongoParams,
    );

    const counterSpec = byKey.get('mongo_counter')!;
    const counterResponse = await persistence<{ documents?: Array<Record<string, unknown>> }>(
      counterSpec.tool,
      counterSpec.action,
      counterSpec.params,
    );

    const graphSpec = byKey.get('neo4j_placements')!;
    const graphParams = structuredClone(graphSpec.params);
    graphParams.params = { scanLimitPlusOne: scanLimit + 1 };
    const graphResponse = await persistence<{ records?: Array<Record<string, unknown>> }>(
      graphSpec.tool,
      graphSpec.action,
      graphParams,
    );

    const poolsSpec = byKey.get('neo4j_pools')!;
    const poolsParams = structuredClone(poolsSpec.params);
    poolsParams.params = { sampleLimit };
    const poolsResponse = await persistence<{ records?: Array<Record<string, unknown>> }>(
      poolsSpec.tool,
      poolsSpec.action,
      poolsParams,
    );

    const rawMongo = mongoResponse.results;
    const rawGraph = graphResponse.records;
    const rawPoolRecord = poolsResponse.records?.[0];
    if (!Array.isArray(rawMongo) || !Array.isArray(rawGraph) || !rawPoolRecord) {
      throw new Error('malformed_snapshot_response');
    }
    if (rawMongo.length > scanLimit || rawGraph.length > scanLimit) {
      const results = INVARIANTS.map(([key, description]) => ({
        key,
        description,
        status: 'truncated' as const,
        exactCount: null,
        samples: [],
        degradedReason: `scan_limit_exceeded:${scanLimit}`,
      }));
      return {
        status: 'truncated',
        policy: 'read_only_test',
        coverage: { expected: INVARIANTS.length, completed: 0, degraded: 0 },
        exactFindings: 0,
        observations: {
          mongoPlacements: rawMongo.length,
          neo4jPlacements: rawGraph.length,
          poolCounter: numberValue(counterResponse.documents?.[0]?.current) ?? 0,
          scanLimit,
        },
        results,
      };
    }

    const mongoRows = rawMongo.map(parseMongoPlacement);
    const graphRows = rawGraph.map(parseGraphPlacement);
    const malformedMongo = mongoRows.flatMap((row, index) => row ? [] : [`mongo:${index}`]);
    const malformedGraph = graphRows.flatMap((row, index) => row ? [] : [`neo4j:${index}`]);
    const mongo = mongoRows.filter((row): row is PlacementSnapshot => row !== null);
    const graph = graphRows.filter((row): row is GraphPlacementSnapshot => row !== null);
    const counterDocument = counterResponse.documents?.[0];
    const parsedCounter = numberValue(counterDocument?.current);
    if (counterDocument && parsedCounter === null) throw new Error('malformed_pool_counter');
    const counter = parsedCounter ?? 0;
    const poolTotal = numberValue(rawPoolRecord.total);
    const poolSamples = Array.isArray(rawPoolRecord.samples)
      ? rawPoolRecord.samples.filter((value): value is string => typeof value === 'string')
      : null;
    if (poolTotal === null || poolSamples === null) throw new Error('malformed_pool_count');

    const poolFindings = [
      ...(poolTotal === 0 && mongo.length === 0 ? [] : poolTotal === 1 && poolSamples[0] === TEAM_POOL_ID ? [] : [`pools:${poolTotal}:${poolSamples.join(',')}`]),
      ...graph.filter((row) => row.poolId !== TEAM_POOL_ID).map((row) => `edge:${row.prospectId}:${row.poolId}`),
    ];

    const prospectCounts = new Map<string, number>();
    for (const row of mongo) prospectCounts.set(`m:${row.prospectId}`, (prospectCounts.get(`m:${row.prospectId}`) ?? 0) + 1);
    for (const row of graph) prospectCounts.set(`g:${row.prospectId}`, (prospectCounts.get(`g:${row.prospectId}`) ?? 0) + 1);
    const cardinalityFindings = [...prospectCounts.entries()]
      .filter(([, count]) => count !== 1)
      .map(([key, count]) => `${key}:${count}`);

    const positionOwners = new Map<string, string[]>();
    for (const [prefix, rows] of [['m', mongo] as const, ['g', graph] as const]) {
      for (const row of rows) {
        const key = `${prefix}:${row.positionNumber}`;
        positionOwners.set(key, [...(positionOwners.get(key) ?? []), row.prospectId]);
      }
    }
    const positionFindings = [
      ...malformedMongo,
      ...malformedGraph,
      ...mongo.filter((row) => row.positionNumber < 1).map((row) => `m:${row.prospectId}:${row.positionNumber}`),
      ...graph.filter((row) => row.positionNumber < 1).map((row) => `g:${row.prospectId}:${row.positionNumber}`),
      ...[...positionOwners.entries()]
        .filter(([, owners]) => owners.length !== 1)
        .map(([key, owners]) => `${key}:${owners.join(',')}`),
    ];

    const highestPosition = Math.max(0, ...mongo.map((row) => row.positionNumber), ...graph.map((row) => row.positionNumber));
    const counterFindings = counter < 0 || counter < highestPosition
      ? [`counter:${counter}:highest:${highestPosition}`]
      : [];

    const ordered = [...mongo].sort((a, b) => a.positionNumber - b.positionNumber);
    const orderFindings: string[] = [];
    for (let index = 1; index < ordered.length; index += 1) {
      const prior = ordered[index - 1]!;
      const current = ordered[index]!;
      if (Date.parse(prior.placedAt) > Date.parse(current.placedAt)) {
        orderFindings.push(`${prior.prospectId}:${prior.positionNumber}>${current.prospectId}:${current.positionNumber}`);
      }
    }

    const validReasons = new Set(['enrolled', 'expired', 'archived']);
    const flushFindings = [...mongo, ...graph].filter((row) => {
      const hasAt = row.flushedAt !== null;
      const hasReason = row.flushReason !== null;
      return hasAt !== hasReason || (hasReason && !validReasons.has(row.flushReason!));
    }).map((row) => `${row.prospectId}:${row.flushedAt ?? ''}:${row.flushReason ?? ''}`);

    const mongoByProspect = new Map(mongo.map((row) => [row.prospectId, row]));
    const graphByProspect = new Map(graph.map((row) => [row.prospectId, row]));
    const parityFindings = new Set<string>();
    for (const [prospectId, mongoRow] of mongoByProspect) {
      const graphRow = graphByProspect.get(prospectId);
      if (!graphRow || parityKey(mongoRow) !== parityKey(graphRow)) parityFindings.add(`mongo:${prospectId}`);
    }
    for (const prospectId of graphByProspect.keys()) {
      if (!mongoByProspect.has(prospectId)) parityFindings.add(`neo4j:${prospectId}`);
    }

    const findingsByKey = new Map<string, string[]>([
      ['single_team_pool', poolFindings],
      ['one_placement_per_prospect', cardinalityFindings],
      ['unique_positive_position', positionFindings],
      ['counter_covers_positions', counterFindings],
      ['timestamp_position_order', orderFindings],
      ['flush_metadata_pair', flushFindings],
      ['mongo_neo4j_parity', [...parityFindings]],
    ]);
    const results = INVARIANTS.map(([key, description]) =>
      result(key, description, findingsByKey.get(key) ?? [], sampleLimit),
    );
    const exactFindings = results.reduce((sum, row) => sum + (row.exactCount ?? 0), 0);
    const truncated = results.some((row) => row.status === 'truncated');
    return {
      status: truncated ? 'truncated' : exactFindings > 0 ? 'findings' : 'clear',
      policy: 'read_only_test',
      coverage: { expected: INVARIANTS.length, completed: INVARIANTS.length, degraded: 0 },
      exactFindings,
      observations: {
        mongoPlacements: mongo.length,
        neo4jPlacements: graph.length,
        poolCounter: counter,
        scanLimit,
      },
      results,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      status: 'degraded',
      policy: 'read_only_test',
      coverage: { expected: INVARIANTS.length, completed: 0, degraded: INVARIANTS.length },
      exactFindings: 0,
      observations: emptyObservations,
      results: degradedResults(reason),
    };
  }
}
