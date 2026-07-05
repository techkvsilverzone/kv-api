import { istDayKey, isSameIstDay, msUntilNextDailyIST } from '../utils/time';

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
});
