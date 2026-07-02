/**
 * Review-before-H-server mocks for /live-ops. Every shape satisfies
 * the @momentum/shared admin-live-ops contract verbatim. When H-server
 * ships, the page swaps `USE_MOCKS = true` to false and nothing else changes.
 *
 * These are not exercised in production — the route only calls them
 * while `USE_MOCKS` is on.
 */

import type {
  McsAdminDashboardFilter,
  McsAdminFunnelKind,
  McsAdminFunnelResponse,
  McsAdminGrowthCardsResponse,
  McsAdminLiveGridResponse,
  McsAdminLiveGridSlot,
  McsAdminLiveUsageSample,
} from '@momentum/shared';

const NOW = () => new Date().toISOString();

/** H.1 — one usage sample, plausibly recent. Used as the initial render
 *  fallback when SSE hasn't delivered its first snapshot yet. */
export function mockUsageSample(): McsAdminLiveUsageSample {
  return {
    sampledAt: NOW(),
    activeDashboardViewers: 7,
    activeAdminSessions: 1,
    eventsPerMinute: 23,
    persistenceLatencyMsP50: 18,
    persistenceLatencyMsP95: 64,
  };
}

/** H.2 — growth cards across all three windows. Deltas are mixed
 *  (positive, negative, zero) so all rendering branches are visible. */
export function mockGrowthCards(filter: McsAdminDashboardFilter): McsAdminGrowthCardsResponse {
  return {
    appliedFilter: filter,
    generatedAt: NOW(),
    cards: [
      {
        window: '24h',
        basAdded: 3,
        prospectsPlaced: 21,
        enrollments: 2,
        basAddedDelta: 1,
        prospectsPlacedDelta: 4,
        enrollmentsDelta: 0,
      },
      {
        window: '7d',
        basAdded: 18,
        prospectsPlaced: 142,
        enrollments: 11,
        basAddedDelta: -3,
        prospectsPlacedDelta: 17,
        enrollmentsDelta: 2,
      },
      {
        window: '30d',
        basAdded: 64,
        prospectsPlaced: 538,
        enrollments: 41,
        basAddedDelta: 12,
        prospectsPlacedDelta: -22,
        enrollmentsDelta: 6,
      },
    ],
  };
}

/** H.3 — every age bucket represented so the color treatment is
 *  visible end-to-end. 24 slots is enough to exercise wrapping. */
export function mockLiveGrid(filter: McsAdminDashboardFilter): McsAdminLiveGridResponse {
  const FIRST_NAMES = [
    'Alice',
    'Brandon',
    'Camille',
    'David',
    'Eliana',
    'Felix',
    'Gabriela',
    'Hayden',
  ];
  const LAST_INITIALS = ['R', 'M', 'T', 'S', 'L', 'K'];
  const CITIES: Array<[string, string]> = [
    ['Atlanta', 'GA'],
    ['Phoenix', 'AZ'],
    ['Boise', 'ID'],
    ['Tampa', 'FL'],
    ['Reno', 'NV'],
    ['Tulsa', 'OK'],
    ['Akron', 'OH'],
    ['Mesa', 'AZ'],
  ];
  const SPONSORS: Array<[string, string]> = [
    ['TMAG-20251101-AB12CD', 'Kevin Gardner'],
    ['TMAG-20251104-EF34GH', 'Paul Mwangi'],
    ['TMAG-20260112-IJ56KL', 'Marisol Vega'],
    ['TMAG-20260118-MN78OP', 'Devon Chen'],
  ];
  const BUCKET_DAYS: Array<{
    bucket: McsAdminLiveGridSlot['ageBucket'];
    days: number;
  }> = [
    { bucket: 'fresh', days: 0 },
    { bucket: 'fresh', days: 3 },
    { bucket: 'fresh', days: 6 },
    { bucket: 'warming', days: 9 },
    { bucket: 'warming', days: 15 },
    { bucket: 'warming', days: 20 },
    { bucket: 'aging', days: 24 },
    { bucket: 'aging', days: 32 },
    { bucket: 'aging', days: 40 },
    { bucket: 'stale', days: 45 },
    { bucket: 'stale', days: 52 },
    { bucket: 'stale', days: 55 },
  ];

  const slots: McsAdminLiveGridSlot[] = [];
  for (let i = 0; i < 24; i += 1) {
    const bucketSeed = BUCKET_DAYS[i % BUCKET_DAYS.length]!;
    const placedAt = new Date(Date.now() - bucketSeed.days * 24 * 60 * 60 * 1000).toISOString();
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const lastInitial = LAST_INITIALS[i % LAST_INITIALS.length]!;
    const [city, region] = CITIES[i % CITIES.length]!;
    const [sponsorId, sponsorName] = SPONSORS[i % SPONSORS.length]!;
    slots.push({
      prospectId: `prospect_mock_${i.toString().padStart(3, '0')}`,
      positionNumber: 9_400 - i,
      prospectFirstName: firstName,
      prospectLastInitial: lastInitial,
      prospectCity: city,
      prospectStateOrRegion: region,
      sponsorTmagId: sponsorId,
      sponsorFullName: sponsorName,
      placedAt,
      ageDays: bucketSeed.days,
      ageBucket: bucketSeed.bucket,
    });
  }

  return {
    appliedFilter: filter,
    generatedAt: NOW(),
    totalActive: slots.length,
    slots,
  };
}

/** H.4 — both funnel shapes, both monotonically decreasing for clean visuals. */
export function mockFunnel(
  kind: McsAdminFunnelKind,
  filter: McsAdminDashboardFilter,
): McsAdminFunnelResponse {
  if (kind === 'prospect') {
    const counts = [842, 612, 489, 318, 41];
    return {
      kind: 'prospect',
      appliedFilter: filter,
      generatedAt: NOW(),
      stages: [
        { key: 'minted', label: 'Minted', count: counts[0]!, conversionFromStart: 1 },
        {
          key: 'clicked',
          label: 'Clicked',
          count: counts[1]!,
          conversionFromStart: counts[1]! / counts[0]!,
        },
        {
          key: 'video_started',
          label: 'Video started',
          count: counts[2]!,
          conversionFromStart: counts[2]! / counts[0]!,
        },
        {
          key: 'video_complete',
          label: 'Video complete',
          count: counts[3]!,
          conversionFromStart: counts[3]! / counts[0]!,
        },
        {
          key: 'enrolled',
          label: 'Enrolled',
          count: counts[4]!,
          conversionFromStart: counts[4]! / counts[0]!,
        },
      ],
    };
  }
  const counts = [214, 198, 176, 142, 121, 87];
  return {
    kind: 'ba_activation',
    appliedFilter: filter,
    generatedAt: NOW(),
    stages: [
      { key: 'signed_up', label: 'Signed up', count: counts[0]!, conversionFromStart: 1 },
      {
        key: 'welcomed',
        label: 'Welcomed',
        count: counts[1]!,
        conversionFromStart: counts[1]! / counts[0]!,
      },
      {
        key: 'steve_discovery_done',
        label: 'Steve discovery done',
        count: counts[2]!,
        conversionFromStart: counts[2]! / counts[0]!,
      },
      {
        key: 'first_invite_sent',
        label: 'First invite sent',
        count: counts[3]!,
        conversionFromStart: counts[3]! / counts[0]!,
      },
      {
        key: 'first_video_complete',
        label: 'First video complete',
        count: counts[4]!,
        conversionFromStart: counts[4]! / counts[0]!,
      },
      {
        key: 'first_enrollment',
        label: 'First enrollment',
        count: counts[5]!,
        conversionFromStart: counts[5]! / counts[0]!,
      },
    ],
  };
}
