import { describe, expect, it } from 'vitest';
import { formatEventDate } from '../eventTime';

describe('P2-108 Event Center timezone display', () => {
  it('renders one instant in each BA timezone without changing the instant', () => {
    const instant = '2026-07-14T00:00:00.000Z';
    expect(formatEventDate(instant, { locale: 'en-US', timeZone: 'America/Los_Angeles' })).toEqual({
      day: 'Monday, July 13', time: '5:00 PM PDT',
    });
    expect(formatEventDate(instant, { locale: 'en-US', timeZone: 'America/New_York' })).toEqual({
      day: 'Monday, July 13', time: '8:00 PM EDT',
    });
    expect(formatEventDate(instant, { locale: 'en-US', timeZone: 'Europe/London' })).toEqual({
      day: 'Tuesday, July 14', time: '1:00 AM GMT+1',
    });
    expect(formatEventDate(instant, { locale: 'en-US', timeZone: 'Asia/Kolkata' })).toEqual({
      day: 'Tuesday, July 14', time: '5:30 AM GMT+5:30',
    });
  });

  it('uses the correct Pacific offset on both sides of the spring DST jump', () => {
    expect(formatEventDate('2026-03-08T09:30:00.000Z', { locale: 'en-US', timeZone: 'America/Los_Angeles' }).time)
      .toBe('1:30 AM PST');
    expect(formatEventDate('2026-03-08T10:30:00.000Z', { locale: 'en-US', timeZone: 'America/Los_Angeles' }).time)
      .toBe('3:30 AM PDT');
  });

  it('distinguishes both repeated 1:30 AM instants during the fall DST fold', () => {
    expect(formatEventDate('2026-11-01T08:30:00.000Z', { locale: 'en-US', timeZone: 'America/Los_Angeles' }).time)
      .toBe('1:30 AM PDT');
    expect(formatEventDate('2026-11-01T09:30:00.000Z', { locale: 'en-US', timeZone: 'America/Los_Angeles' }).time)
      .toBe('1:30 AM PST');
  });
});
