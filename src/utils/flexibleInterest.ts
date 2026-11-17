import { istDayKey } from './time';

/**
 * KV Smart (FLEXIBLE) monthly interest, owner's table (2026-11-17): a payment made in scheme
 * month N earns this % extra metal, credited on the row as devident and paid out only when the
 * scheme completes (forfeited on early exit). Month 1 = the month starting on the enrolment date.
 * shortcut: hard-coded for the one flexible plan; move to scheme_plans when admins need to edit it.
 */
export const FLEXIBLE_INTEREST_PERCENT = [7, 7, 6, 6, 5, 4, 4, 3, 3, 2, 1];

/** 1-based scheme month of `paidAt` counted from `startDate` (IST calendar days), clamped to the table. */
export const schemeMonthOf = (startDate: Date, paidAt: Date): number => {
  const [sy, sm, sd] = istDayKey(startDate).split('-').map(Number);
  const [py, pm, pd] = istDayKey(paidAt).split('-').map(Number);
  const elapsed = (py - sy) * 12 + (pm - sm) - (pd < sd ? 1 : 0);
  return Math.min(Math.max(elapsed + 1, 1), FLEXIBLE_INTEREST_PERCENT.length);
};

export const flexibleInterestPercent = (startDate: Date, paidAt: Date): number =>
  FLEXIBLE_INTEREST_PERCENT[schemeMonthOf(startDate, paidAt) - 1];
