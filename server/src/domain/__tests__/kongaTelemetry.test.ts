import { describe, expect, it } from 'vitest';
import {
  normalizedGeoKey,
  startOfKongaWeek,
  summarizeKongaWeek,
} from '../kongaTelemetry.js';

describe('Konga truthful weekly telemetry', () => {
  it('anchors the week at Monday 00:00 America/Los_Angeles', () => {
    expect(startOfKongaWeek(new Date('2026-07-17T18:00:00.000Z')).toISOString())
      .toBe('2026-07-13T07:00:00.000Z');
    expect(startOfKongaWeek(new Date('2026-01-08T18:00:00.000Z')).toISOString())
      .toBe('2026-01-05T08:00:00.000Z');
  });

  it('honors the exact boundary and counts distinct normalized city/state pairs', () => {
    const now = new Date('2026-07-17T18:00:00.000Z');
    const rows = [
      { positionNumber: 1, placedAt: '2026-07-13T06:59:59.999Z', city: 'LA', stateOrRegion: 'CA' },
      { positionNumber: 2, placedAt: '2026-07-13T07:00:00.000Z', city: ' Los  Angeles ', stateOrRegion: 'CA' },
      { positionNumber: 3, placedAt: '2026-07-14T12:00:00.000Z', city: 'los angeles', stateOrRegion: ' ca ' },
      { positionNumber: 4, placedAt: '2026-07-15T12:00:00.000Z', city: 'Pasadena', stateOrRegion: 'CA' },
      { positionNumber: 5, placedAt: '2026-07-18T00:00:00.000Z', city: 'Future', stateOrRegion: 'CA' },
    ];
    expect(summarizeKongaWeek(rows, now)).toEqual({
      placementsThisWeek: 3,
      geoSpreadCount: 2,
    });
    expect(normalizedGeoKey(' Los  Angeles ', ' CA ')).toBe('los angeles|ca');
  });
});
