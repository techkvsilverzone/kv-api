// IST (Asia/Kolkata) time helpers for the daily price-update guard (#25).
// All "today" comparisons for rate freshness must use IST regardless of the
// server's own timezone, so these derive the IST calendar day explicitly.

const IST_TIMEZONE = 'Asia/Kolkata';
// IST is a fixed offset (UTC+5:30) with no DST, so a constant offset is safe.
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Returns the IST calendar day for a date as a 'YYYY-MM-DD' string.
 * Two dates are "the same IST day" iff their keys are equal.
 */
export function istDayKey(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the key we want.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** True when `date` falls on the same IST calendar day as `reference` (default: now). */
export function isSameIstDay(date: Date, reference: Date = new Date()): boolean {
  return istDayKey(date) === istDayKey(reference);
}

/** True when `date` falls on a Sunday in IST (regardless of the server's own timezone). */
export function isIstSunday(date: Date = new Date()): boolean {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: IST_TIMEZONE, weekday: 'short' }).format(date) ===
    'Sun'
  );
}

/**
 * The UTC instant corresponding to IST midnight of the given 'YYYY-MM-DD' day key.
 * Use this (not `new Date(key); d.setHours(0,0,0,0)`) whenever a calendar day needs
 * to be pinned to a stable instant — `setHours` mutates in the SERVER's local
 * timezone, which silently drifts the stored date whenever the server isn't
 * running in IST (or UTC, by luck). This is deterministic regardless of server TZ.
 */
export function istMidnightUtc(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+05:30`);
}

/**
 * Milliseconds from `from` until the next occurrence of `hour:minute` IST.
 * If that time has already passed today (IST), targets the same time tomorrow.
 */
export function msUntilNextDailyIST(
  hour: number,
  minute = 0,
  from: Date = new Date(),
): number {
  // Express `from` in IST wall-clock by shifting the UTC epoch by the IST offset.
  const istNow = new Date(from.getTime() + IST_OFFSET_MINUTES * 60_000);
  const target = new Date(istNow);
  target.setUTCHours(hour, minute, 0, 0);
  if (target.getTime() <= istNow.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - istNow.getTime();
}
