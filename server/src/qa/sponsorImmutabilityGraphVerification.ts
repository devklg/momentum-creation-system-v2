import { persistenceCall } from '../services/persistence/dispatch.js';

type Persistence = typeof persistenceCall;

const DEFAULT_SAMPLE_LIMIT = 25;
const MAX_SAMPLE_LIMIT = 25;
const MUTATION_PATTERN = /\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|CALL)\b/i;

export interface SponsorGraphVerificationSpec {
  key: string;
  description: string;
  query: string;
}

export interface SponsorGraphVerificationResult {
  key: string;
  description: string;
  status: 'clear' | 'findings' | 'degraded' | 'truncated';
  exactCount: number | null;
  samples: string[];
  degradedReason: string | null;
}

export interface SponsorGraphVerificationReport {
  status: 'clear' | 'findings' | 'degraded' | 'truncated';
  policy: 'read_only_test';
  coverage: {
    expected: number;
    completed: number;
    degraded: number;
  };
  exactFindings: number;
  results: SponsorGraphVerificationResult[];
}

export interface SponsorGraphVerificationOptions {
  persistence?: Persistence;
  sampleLimit?: number;
  specs?: readonly SponsorGraphVerificationSpec[];
}

function collectQuery(lines: string[]): string {
  return [
    ...lines,
    'WITH collect(identity) AS findings',
    'RETURN size(findings) AS total, findings[..$sampleLimit] AS samples',
  ].join(' ');
}

export const SPONSOR_IMMUTABILITY_GRAPH_VERIFICATION_CATALOG:
readonly SponsorGraphVerificationSpec[] = [
  {
    key: 'member_ambiguous_current_sponsor',
    description: 'A member cannot have more than one non-superseded sponsor edge.',
    query: collectQuery([
      'MATCH (member:TeamMagnificentMember)-[edge:SPONSORED_BY]->(:TeamMagnificentMember)',
      'WHERE coalesce(edge.current, true) = true',
      'WITH member, count(edge) AS sponsorCount',
      'WHERE sponsorCount > 1',
      'WITH coalesce(toString(member.tmagId), toString(elementId(member))) AS identity',
    ]),
  },
  {
    key: 'member_self_sponsor',
    description: 'A member cannot sponsor itself.',
    query: collectQuery([
      'MATCH (member:TeamMagnificentMember)-[:SPONSORED_BY]->(member)',
      'WITH coalesce(toString(member.tmagId), toString(elementId(member))) AS identity',
    ]),
  },
  {
    key: 'override_missing_current_sponsor',
    description: 'Every audited sponsor override must leave exactly one current sponsor edge.',
    query: collectQuery([
      'MATCH (member:TeamMagnificentMember)-[:HAS_OVERRIDE]->(:TmagSponsorOverride)',
      'OPTIONAL MATCH (member)-[edge:SPONSORED_BY]->(:TeamMagnificentMember)',
      'WHERE coalesce(edge.current, true) = true',
      'WITH member, count(edge) AS sponsorCount',
      'WHERE sponsorCount <> 1',
      'WITH coalesce(toString(member.tmagId), toString(elementId(member))) AS identity',
    ]),
  },
  {
    key: 'override_missing_original_sponsor',
    description: 'Every audited sponsor override must preserve an original sponsor edge.',
    query: collectQuery([
      'MATCH (member:TeamMagnificentMember)-[:HAS_OVERRIDE]->(:TmagSponsorOverride)',
      'WHERE NOT (member)-[:HAS_ORIGINAL_SPONSOR]->(:TeamMagnificentMember)',
      'WITH coalesce(toString(member.tmagId), toString(elementId(member))) AS identity',
    ]),
  },
  {
    key: 'prospect_inviter_mismatch',
    description: 'A prospect sponsor property must match its one inviting member.',
    query: collectQuery([
      'MATCH (prospect:TmagProspect)',
      'OPTIONAL MATCH (inviter:TeamMagnificentMember)-[:INVITED]->(prospect)',
      'WITH prospect, collect(DISTINCT inviter.tmagId) AS inviterIds',
      'WHERE prospect.sponsorTmagId IS NULL',
      'OR size(inviterIds) <> 1',
      'OR inviterIds[0] <> prospect.sponsorTmagId',
      'WITH coalesce(toString(prospect.prospectId), toString(elementId(prospect))) AS identity',
    ]),
  },
  {
    key: 'invite_token_sponsor_mismatch',
    description: 'An invite token sponsor must match its prospect and the prospect inviter.',
    query: collectQuery([
      'MATCH (token:TmagInviteToken)-[:FOR_PROSPECT]->(prospect:TmagProspect)',
      'OPTIONAL MATCH (inviter:TeamMagnificentMember)-[:INVITED]->(prospect)',
      'WITH token, prospect, collect(DISTINCT inviter.tmagId) AS inviterIds',
      'WHERE token.sponsorTmagId IS NULL',
      'OR token.sponsorTmagId <> prospect.sponsorTmagId',
      'OR size(inviterIds) <> 1',
      'OR inviterIds[0] <> token.sponsorTmagId',
      'WITH coalesce(toString(token.token), toString(elementId(token))) AS identity',
    ]),
  },
  {
    key: 'prospect_account_sponsor_mismatch',
    description: 'A prospect account must stay bound to its original token and inviting member.',
    query: collectQuery([
      'MATCH (account:TmagProspectAccount)-[:KEYS]->(token:TmagInviteToken)',
      'OPTIONAL MATCH (account)-[:SPONSORED_BY]->(sponsor:TeamMagnificentMember)',
      'OPTIONAL MATCH (token)-[:FOR_PROSPECT]->(prospect:TmagProspect)',
      'OPTIONAL MATCH (inviter:TeamMagnificentMember)-[:INVITED]->(prospect)',
      'WITH account, token, prospect,',
      'collect(DISTINCT sponsor.tmagId) AS sponsorIds,',
      'collect(DISTINCT inviter.tmagId) AS inviterIds',
      'WHERE account.sponsorTmagId IS NULL',
      'OR token.sponsorTmagId IS NULL',
      'OR prospect.sponsorTmagId IS NULL',
      'OR account.sponsorTmagId <> token.sponsorTmagId',
      'OR account.sponsorTmagId <> prospect.sponsorTmagId',
      'OR size(sponsorIds) <> 1',
      'OR sponsorIds[0] <> account.sponsorTmagId',
      'OR size(inviterIds) <> 1',
      'OR inviterIds[0] <> account.sponsorTmagId',
      'WITH coalesce(toString(account.accountId), toString(elementId(account))) AS identity',
    ]),
  },
  {
    key: 'access_code_ambiguous_owner',
    description: 'An access code must have exactly one member owner across the governed owner edges.',
    query: collectQuery([
      'MATCH (code:TmagAccessCode)',
      'OPTIONAL MATCH (owner:TeamMagnificentMember)-[edge]->(code)',
      "WHERE type(edge) IN ['HOLDS_CODE', 'USES']",
      'WITH code, count(DISTINCT owner) AS ownerCount',
      'WHERE ownerCount <> 1',
      'WITH coalesce(toString(code.code), toString(elementId(code))) AS identity',
    ]),
  },
] as const;

export function validateSponsorGraphVerificationCatalog(
  specs: readonly SponsorGraphVerificationSpec[] =
    SPONSOR_IMMUTABILITY_GRAPH_VERIFICATION_CATALOG,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const spec of specs) {
    if (!spec.key || seen.has(spec.key)) errors.push(`duplicate_or_missing_key:${spec.key}`);
    seen.add(spec.key);
    if (!spec.description) errors.push(`missing_description:${spec.key}`);
    if (!spec.query.includes('$sampleLimit')) errors.push(`unbounded_samples:${spec.key}`);
    if (MUTATION_PATTERN.test(spec.query)) errors.push(`unsafe_query:${spec.key}`);
    if (!spec.query.includes('RETURN size(findings) AS total')) {
      errors.push(`missing_exact_count:${spec.key}`);
    }
  }
  return errors;
}

function boundedSampleLimit(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1) return DEFAULT_SAMPLE_LIMIT;
  return Math.min(value!, MAX_SAMPLE_LIMIT);
}

function parseCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (
    value &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
  ) {
    const converted = value.toNumber();
    if (Number.isSafeInteger(converted) && converted >= 0) return converted;
  }
  return null;
}

export async function verifySponsorImmutabilityGraph(
  options: SponsorGraphVerificationOptions = {},
): Promise<SponsorGraphVerificationReport> {
  const specs = options.specs ?? SPONSOR_IMMUTABILITY_GRAPH_VERIFICATION_CATALOG;
  const validationErrors = validateSponsorGraphVerificationCatalog(specs);
  if (validationErrors.length > 0) {
    return {
      status: 'degraded',
      policy: 'read_only_test',
      coverage: { expected: specs.length, completed: 0, degraded: specs.length },
      exactFindings: 0,
      results: specs.map((spec) => ({
        key: spec.key,
        description: spec.description,
        status: 'degraded',
        exactCount: null,
        samples: [],
        degradedReason: validationErrors.join(','),
      })),
    };
  }

  const persistence = options.persistence ?? persistenceCall;
  const sampleLimit = boundedSampleLimit(options.sampleLimit);
  const results: SponsorGraphVerificationResult[] = [];

  for (const spec of specs) {
    try {
      const response = await persistence<{
        records?: Array<Record<string, unknown>>;
      }>('neo4j', 'cypher', {
        query: spec.query,
        params: { sampleLimit },
      });
      const record = response.records?.[0];
      const exactCount = parseCount(record?.total);
      const samples = Array.isArray(record?.samples)
        ? record.samples.filter((value): value is string => typeof value === 'string')
        : null;
      if (exactCount === null || samples === null) {
        throw new Error('malformed_total_or_samples');
      }
      const truncated = exactCount > samples.length;
      results.push({
        key: spec.key,
        description: spec.description,
        status: exactCount === 0 ? 'clear' : truncated ? 'truncated' : 'findings',
        exactCount,
        samples,
        degradedReason: null,
      });
    } catch (error) {
      results.push({
        key: spec.key,
        description: spec.description,
        status: 'degraded',
        exactCount: null,
        samples: [],
        degradedReason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const degraded = results.filter((result) => result.status === 'degraded').length;
  const truncated = results.some((result) => result.status === 'truncated');
  const exactFindings = results.reduce(
    (sum, result) => sum + (result.exactCount ?? 0),
    0,
  );
  return {
    status:
      degraded > 0
        ? 'degraded'
        : truncated
          ? 'truncated'
          : exactFindings > 0
            ? 'findings'
            : 'clear',
    policy: 'read_only_test',
    coverage: {
      expected: specs.length,
      completed: specs.length - degraded,
      degraded,
    },
    exactFindings,
    results,
  };
}
