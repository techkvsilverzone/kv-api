import { FLEXIBLE_INTEREST_PERCENT, flexibleInterestPercent, schemeMonthOf } from '../utils/flexibleInterest';
import { istMidnightUtc } from '../utils/time';

const d = (day: string) => istMidnightUtc(day);

describe('KV Smart monthly interest', () => {
  it("is the owner's table: 7,7,6,6,5,4,4,3,3,2,1", () => {
    expect(FLEXIBLE_INTEREST_PERCENT).toEqual([7, 7, 6, 6, 5, 4, 4, 3, 3, 2, 1]);
  });

  it('counts scheme months from the enrolment date', () => {
    const start = d('2026-10-03');
    expect(schemeMonthOf(start, d('2026-10-03'))).toBe(1);
    expect(schemeMonthOf(start, d('2026-11-02'))).toBe(1); // day before the month-2 anniversary
    expect(schemeMonthOf(start, d('2026-11-03'))).toBe(2);
    expect(schemeMonthOf(start, d('2027-01-15'))).toBe(4);
    expect(schemeMonthOf(start, d('2027-09-02'))).toBe(11);
    expect(schemeMonthOf(start, d('2028-01-01'))).toBe(11); // clamped
  });

  it('maps a payment to its month rate', () => {
    const start = d('2026-01-10');
    expect(flexibleInterestPercent(start, d('2026-01-10'))).toBe(7);
    expect(flexibleInterestPercent(start, d('2026-03-10'))).toBe(6);
    expect(flexibleInterestPercent(start, d('2026-05-10'))).toBe(5);
    expect(flexibleInterestPercent(start, d('2026-11-10'))).toBe(1);
  });
});
