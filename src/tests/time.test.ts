import { istDayKey, isSameIstDay, isIstSunday, msUntilNextDailyIST, financialYearCode } from '../utils/time';

describe('IST time helpers (#25)', () => {
  it('istDayKey rolls the day over at IST midnight, not UTC', () => {
    // 2026-06-15T20:00:00Z = 2026-06-16T01:30 IST → already the 16th in IST.
    expect(istDayKey(new Date('2026-06-15T20:00:00.000Z'))).toBe('2026-06-16');
    // 2026-06-15T18:00:00Z = 2026-06-15T23:30 IST → still the 15th in IST.
    expect(istDayKey(new Date('2026-06-15T18:00:00.000Z'))).toBe('2026-06-15');
  });

  it('isSameIstDay compares IST calendar days', () => {
    const ref = new Date('2026-06-16T05:00:00.000Z'); // 10:30 IST on the 16th
    expect(isSameIstDay(new Date('2026-06-15T19:00:00.000Z'), ref)).toBe(true); // 00:30 IST 16th
    expect(isSameIstDay(new Date('2026-06-15T17:00:00.000Z'), ref)).toBe(false); // 22:30 IST 15th
  });

  it('msUntilNextDailyIST is positive and within 24h', () => {
    const from = new Date('2026-06-16T05:00:00.000Z'); // 10:30 IST → 10:00 already passed
    const ms = msUntilNextDailyIST(10, 0, from);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    // 10:00 IST already passed at 10:30, so next run is ~23.5h away.
    expect(Math.round(ms / 60_000)).toBe(23 * 60 + 30);
  });

  it('msUntilNextDailyIST targets later-today when cutoff not yet passed', () => {
    const from = new Date('2026-06-16T03:00:00.000Z'); // 08:30 IST → 10:00 still ahead
    const ms = msUntilNextDailyIST(10, 0, from);
    expect(Math.round(ms / 60_000)).toBe(90); // 1h30m to 10:00 IST
  });

  it('isIstSunday is true for a Sunday IST instant', () => {
    // 2026-06-14T05:00:00Z = 2026-06-14T10:30 IST, a Sunday.
    expect(isIstSunday(new Date('2026-06-14T05:00:00.000Z'))).toBe(true);
  });

  it('isIstSunday is false for other days', () => {
    // 2026-06-15T05:00:00Z = 2026-06-15T10:30 IST, a Monday.
    expect(isIstSunday(new Date('2026-06-15T05:00:00.000Z'))).toBe(false);
  });

  it('isIstSunday rolls over at IST midnight, not UTC', () => {
    // 2026-06-13T20:00:00Z = 2026-06-14T01:30 IST → already Sunday in IST,
    // even though the UTC calendar date is still Saturday the 13th.
    expect(isIstSunday(new Date('2026-06-13T20:00:00.000Z'))).toBe(true);
  });

  it('financialYearCode covers Apr-Dec within the same FY as the calendar year', () => {
    // Jul 2026 (07-22T05:00Z = 10:30 IST) → FY2026-27.
    expect(financialYearCode(new Date('2026-07-22T05:00:00.000Z'))).toBe('2627');
  });

  it('financialYearCode covers Jan-Mar within the PRIOR calendar year\'s FY', () => {
    // Nov 2023 → FY2023-24 (matches the shop's paper ledger sample, CD 07-Nov-23).
    expect(financialYearCode(new Date('2023-11-07T05:00:00.000Z'))).toBe('2324');
    // Jan 2024 is still within FY2023-24.
    expect(financialYearCode(new Date('2024-01-15T05:00:00.000Z'))).toBe('2324');
  });

  it('financialYearCode rolls over on April 1 IST, not calendar-year Jan 1', () => {
    // 2026-03-31T19:00:00Z = 2026-04-01T00:30 IST → already April in IST → FY2026-27.
    expect(financialYearCode(new Date('2026-03-31T19:00:00.000Z'))).toBe('2627');
    // 2026-03-31T17:00:00Z = 2026-03-31T22:30 IST → still March in IST → FY2025-26.
    expect(financialYearCode(new Date('2026-03-31T17:00:00.000Z'))).toBe('2526');
  });
});
