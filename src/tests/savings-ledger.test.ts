import { SavingsRepository } from '../repositories/savings.repository';
import * as pool from '../infrastructure/postgres/pool';
import { SavingsService } from '../services/savings.service';
import { SchemePlanRepository } from '../repositories/schemePlan.repository';
import { UserRepository } from '../repositories/user.repository';
import { PricingService } from '../services/pricing.service';
import { istMonthKey } from '../utils/time';
import * as razorpay from '../utils/razorpay';

// Business rules covered here (gram-based passbook ledger):
// - A passbook is only minted once a real payment has been made (enrollment alone doesn't).
// - Every collection is converted to grams (of the scheme's metal) at that day's rate (live
//   rate, or an admin-supplied override).
// - A scheme automatically credits a bonus "devident" ledger row — converted to grams — the
//   moment its Nth real installment lands (N = plan.durationMonths, bonus only when
//   plan.bonusMonths > 0), and completes the scheme.
// - Customer payments only ever happen through the Razorpay create-order/verify pair; staff and
//   admin can additionally record/correct collections directly (edit/delete stays admin-only).
const SCHEME_ID = '77';

/**
 * Stands in for the PostgreSQL layer: `withTransaction` runs the repository's
 * callback against a fake client that records every statement, so the tests can
 * assert on the SQL actually issued. Mocking here keeps the same
 * "no database required" contract the Mongoose-model mocks used to give.
 */
function mockDb(options: { ledgerRow?: { id: string; amount: number } | null; passbookCount?: number } = {}) {
  const { ledgerRow = { id: '5', amount: 2000 }, passbookCount = 4 } = options;
  const statements: Array<{ sql: string; params: readonly unknown[] }> = [];

  const respond = (sql: string) => {
    if (/FROM savings_payments[\s\S]*OFFSET/.test(sql)) {
      return ledgerRow ? { rowCount: 1, rows: [ledgerRow] } : { rowCount: 0, rows: [] };
    }
    if (/count\(\*\)::int AS count FROM savings_accounts/.test(sql)) {
      return { rowCount: 1, rows: [{ count: passbookCount }] };
    }
    if (/INSERT INTO savings_accounts/.test(sql)) {
      return { rowCount: 1, rows: [{ id: SCHEME_ID }] };
    }
    // Row locks and plain writes: report one affected row so the repository
    // treats the target as present.
    return { rowCount: 1, rows: [{ id: SCHEME_ID }] };
  };

  const client = {
    query: jest.fn(async (sql: string, params: readonly unknown[] = []) => {
      statements.push({ sql, params });
      return respond(sql);
    }),
  };

  jest
    .spyOn(pool, 'withTransaction')
    .mockImplementation(async (work: any) => work(client as never));
  jest
    .spyOn(pool, 'queryOne')
    .mockImplementation(async (sql: string, params: readonly unknown[] = []) => {
      statements.push({ sql, params });
      return respond(sql).rows[0] as never;
    });

  /** All statements whose SQL matches `pattern`. */
  const matching = (pattern: RegExp) => statements.filter((s) => pattern.test(s.sql));

  return { statements, matching };
}

describe('SavingsRepository — ledger row persistence', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('create (enrollment)', () => {
    it('does not set a passbookNumber at enrollment', async () => {
      const db = mockDb();
      jest
        .spyOn(SavingsRepository.prototype, 'findById')
        .mockResolvedValue({ passbookNumber: null } as never);

      const created = await new SavingsRepository().create({
        user: '9',
        schemeType: 'SILVER_11_1',
        metal: 'SILVER',
        planName: 'Silver 11+1',
        monthlyAmount: 2000,
        duration: 11,
      });

      const [insert] = db.matching(/INSERT INTO savings_accounts/);
      expect(insert).toBeDefined();
      expect(insert.sql).not.toMatch(/passbook_number/);
      expect(created.passbookNumber).toBeNull();
    });
  });

  describe('generatePassbookNumber', () => {
    it('counts only passbooks already issued under the same prefix', async () => {
      const db = mockDb({ passbookCount: 4 });

      const number = await new SavingsRepository().generatePassbookNumber('GLD');

      const [count] = db.matching(/count\(\*\)::int AS count FROM savings_accounts/);
      expect(count.sql).toMatch(/passbook_number LIKE \$1/);
      expect(count.params).toEqual(['GLD-%']);
      expect(number).toMatch(/^GLD-\d{4}-\d{7}$/);
      expect(number).toContain('-0000005');
    });
  });

  describe('recordPayment', () => {
    it('mints a passbook number under the given prefix when assignPassbook is true', async () => {
      const db = mockDb({ passbookCount: 4 });
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({} as never);

      await new SavingsRepository().recordPayment(
        SCHEME_ID,
        {
          month: 1,
          amount: 2000,
          materialRate: 95.5,
          materialWeight: 20.942,
          method: 'ONLINE',
          dueMonthKey: '2025-01',
        },
        true,
        'SLV',
      );

      const [insert] = db.matching(/INSERT INTO savings_payments/);
      expect(insert.params).toEqual(
        expect.arrayContaining([2000, 95.5, 20.942, 'ONLINE', '2025-01']),
      );

      const [passbook] = db.matching(/SET passbook_number/);
      expect(passbook.params[1]).toMatch(/^SLV-\d{4}-\d{7}$/);

      // The running total moves with the ledger row, in the same transaction.
      const [total] = db.matching(/total_paid = total_paid \+/);
      expect(total.params).toEqual([SCHEME_ID, 2000]);
    });

    it('does not touch passbookNumber on a later payment', async () => {
      const db = mockDb();
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({} as never);

      await new SavingsRepository().recordPayment(
        SCHEME_ID,
        {
          month: 2,
          amount: 2000,
          materialRate: 95.5,
          materialWeight: 20.942,
          method: 'CASH',
          dueMonthKey: '2025-02',
        },
        false,
        'SLV',
      );

      expect(db.matching(/passbook_number/)).toHaveLength(0);
      expect(db.matching(/INSERT INTO savings_payments/)).toHaveLength(1);
    });
  });

  describe('creditBonusMonth', () => {
    it('writes a zero-collection devident row and marks the scheme Completed', async () => {
      const db = mockDb();
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({} as never);

      await new SavingsRepository().creditBonusMonth(SCHEME_ID, {
        month: 12,
        devidentAmount: 6000,
        devidentMaterialRate: 100,
        devidentMaterialWeight: 60,
      });

      const [insert] = db.matching(/INSERT INTO savings_payments/);
      // amount / material_rate / material_weight are literal zeros in the
      // statement; only the devident figures are bound.
      expect(insert.sql).toMatch(/VALUES \(\$1,\$2,0,NOW\(\),0,0,\$3,\$4,\$5,'ONLINE'\)/);
      expect(insert.params).toEqual([SCHEME_ID, 12, 6000, 100, 60]);

      expect(db.matching(/status = 'Completed'/)).toHaveLength(1);
    });
  });

  describe('updatePaymentRow / deletePaymentRow', () => {
    it('adjusts totalPaid when a row amount is corrected', async () => {
      const db = mockDb({ ledgerRow: { id: '5', amount: 2000 } });
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({} as never);

      await new SavingsRepository().updatePaymentRow(SCHEME_ID, 0, { amount: 2500 });

      const [rowUpdate] = db.matching(/UPDATE savings_payments SET/);
      expect(rowUpdate.params).toEqual([2500, '5']);

      // 4000 - 2000 + 2500 = 4500, expressed as a relative adjustment so the
      // stored total cannot drift from a stale read.
      const [total] = db.matching(/total_paid = total_paid - \$2 \+ \$3/);
      expect(total.params).toEqual([SCHEME_ID, 2000, 2500]);
    });

    it('subtracts the row amount from totalPaid on delete', async () => {
      const db = mockDb({ ledgerRow: { id: '5', amount: 2000 } });
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({} as never);

      await new SavingsRepository().deletePaymentRow(SCHEME_ID, 0);

      const [remove] = db.matching(/DELETE FROM savings_payments WHERE id = \$1/);
      expect(remove.params).toEqual(['5']);

      const [total] = db.matching(/GREATEST\(0, total_paid - \$2\)/);
      expect(total.params).toEqual([SCHEME_ID, 2000]);
    });

    it('returns null for an out-of-range index', async () => {
      mockDb({ ledgerRow: null });

      expect(await new SavingsRepository().updatePaymentRow(SCHEME_ID, 5, { amount: 1 })).toBeNull();
    });
  });
});

// Fixed reference start date, used only for scheme bookkeeping (maturity-date calc) — the
// one-installment-per-month check itself is keyed off the REAL current calendar month, not
// this. `PAST_MONTH_KEY` is a placeholder for prior-payment fixtures that must never collide
// with "today" regardless of when the test suite runs.
const START_DATE = new Date('2025-01-15T00:00:00+05:30');
const PAST_MONTH_KEY = '2020-01';
const currentMonthKey = () => istMonthKey(new Date());

const baseScheme = (overrides: Record<string, unknown> = {}) => ({
  _id: 's1',
  userId: { toString: () => 'u1' },
  schemeType: 'SILVER_11_1',
  metal: 'SILVER',
  planId: undefined,
  monthlyAmount: 2000,
  duration: 11,
  bonusAmount: 2000,
  status: 'Active',
  passbookNumber: undefined,
  startDate: START_DATE,
  payments: [] as Array<{ amount: number; devidentAmount: number; dueMonthKey?: string }>,
  ...overrides,
});

describe('SavingsService — applyPayment (via recordPaymentAsAdmin)', () => {
  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(null);
    jest.spyOn(SavingsRepository.prototype, 'getPayments').mockResolvedValue([]);
  });

  it('mints a passbook and converts the collection to grams at the live metal rate on the first payment', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme() as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
    const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      passbookNumber: 'SLV-2627-0000001',
      totalPaid: 2000,
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 2000,
      payments: [{ amount: 2000, devidentAmount: 0 }],
    } as never);

    await new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1');

    expect(recordSpy).toHaveBeenCalledWith(
      's1',
      {
        month: 1,
        amount: 2000,
        materialRate: 100,
        materialWeight: 20,
        method: 'CASH',
        razorpayOrderId: undefined,
        razorpayPaymentId: undefined,
        recordedBy: 'admin1',
        dueMonthKey: currentMonthKey(),
      },
      true,
      'PB',
    );
  });

  it('uses an admin-supplied materialRate override instead of the live rate', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme() as never);
    const rateSpy = jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram');
    const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      passbookNumber: 'SLV-2627-0000001',
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 2000,
      payments: [{ amount: 2000, devidentAmount: 0 }],
    } as never);

    await new SavingsService().recordPaymentAsAdmin('s1', 2000, 80, 'admin1');

    expect(rateSpy).not.toHaveBeenCalled();
    expect(recordSpy).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ amount: 2000, materialRate: 80, materialWeight: 25 }),
      true,
      'PB',
    );
  });

  it('does not re-mint a passbook on a later payment', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
      baseScheme({
        passbookNumber: 'SLV-2627-0000001',
        payments: [{ amount: 2000, devidentAmount: 0, dueMonthKey: PAST_MONTH_KEY }],
      }) as never,
    );
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
    const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      passbookNumber: 'SLV-2627-0000001',
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 2000,
      payments: [{ amount: 2000, devidentAmount: 0 }, { amount: 2000, devidentAmount: 0 }],
    } as never);

    await new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1');

    expect(recordSpy).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ month: 2, dueMonthKey: currentMonthKey() }),
      false,
      'PB',
    );
  });

  it('rejects a second installment recorded for the same calendar month', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
      baseScheme({ payments: [{ amount: 2000, devidentAmount: 0, dueMonthKey: currentMonthKey() }] }) as never,
    );

    await expect(new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1')).rejects.toThrow(
      /already been recorded/i,
    );
  });

  it('auto-credits the devident bonus row and completes the scheme on the final payment of an 11-month scheme', async () => {
    const elevenPriorPayments = Array.from({ length: 10 }, () => ({
      amount: 2000,
      devidentAmount: 0,
      dueMonthKey: PAST_MONTH_KEY,
    }));
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
      baseScheme({ passbookNumber: 'SLV-2627-0000001', payments: elevenPriorPayments }) as never,
    );
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
    jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      passbookNumber: 'SLV-2627-0000001',
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 2000,
      payments: [...elevenPriorPayments, { amount: 2000, devidentAmount: 0 }],
    } as never);
    const bonusSpy = jest.spyOn(SavingsRepository.prototype, 'creditBonusMonth').mockResolvedValue({
      status: 'Completed',
      userId: { toString: () => 'u1' },
      payments: [...elevenPriorPayments, { amount: 2000, devidentAmount: 0 }, { amount: 0, devidentAmount: 2000 }],
    } as never);

    await new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1');

    expect(bonusSpy).toHaveBeenCalledWith('s1', {
      month: 12,
      devidentAmount: 2000,
      devidentMaterialRate: 100,
      devidentMaterialWeight: 20,
    });
  });

  it('completes (without a devident row) a scheme whose plan has no bonus months, e.g. Diwali', async () => {
    const tenPriorPayments = Array.from({ length: 10 }, () => ({
      amount: 3000,
      devidentAmount: 0,
      dueMonthKey: PAST_MONTH_KEY,
    }));
    const planId = '101';
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
      baseScheme({
        schemeType: 'DIWALI',
        metal: undefined,
        monthlyAmount: 3000,
        bonusAmount: 0,
        planId,
        passbookNumber: 'DIW-2627-0000001',
        payments: tenPriorPayments,
      }) as never,
    );
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue({ bonusMonths: 0, passbookPrefix: 'DIW' } as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
    jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      passbookNumber: 'DIW-2627-0000001',
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 0,
      payments: [...tenPriorPayments, { amount: 3000, devidentAmount: 0 }],
    } as never);
    const bonusSpy = jest.spyOn(SavingsRepository.prototype, 'creditBonusMonth');
    const updateSpy = jest
      .spyOn(SavingsRepository.prototype, 'updateById')
      .mockResolvedValue({ status: 'Completed', userId: { toString: () => 'u1' } } as never);

    await new SavingsService().recordPaymentAsAdmin('s1', 3000, undefined, 'admin1');

    expect(bonusSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith('s1', { status: 'Completed' });
  });

  it('does not re-trigger the devident row if one already exists (e.g. after an admin re-adds a corrected row)', async () => {
    const priorPayments = [
      ...Array.from({ length: 10 }, () => ({ amount: 2000, devidentAmount: 0, dueMonthKey: PAST_MONTH_KEY })),
      { amount: 0, devidentAmount: 2000, dueMonthKey: undefined },
    ];
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
      baseScheme({ passbookNumber: 'SLV-2627-0000001', payments: priorPayments }) as never,
    );
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
    jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      passbookNumber: 'SLV-2627-0000001',
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 2000,
      payments: [...priorPayments, { amount: 2000, devidentAmount: 0 }],
    } as never);
    const bonusSpy = jest.spyOn(SavingsRepository.prototype, 'creditBonusMonth');

    await new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1');

    expect(bonusSpy).not.toHaveBeenCalled();
  });

  it('rejects a payment below the scheme monthly amount', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme() as never);

    await expect(new SavingsService().recordPaymentAsAdmin('s1', 500, undefined, 'admin1')).rejects.toThrow(
      'Payment must be at least ₹',
    );
  });

  it('rejects when the scheme is not Active', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme({ status: 'Completed' }) as never);

    await expect(new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1')).rejects.toThrow(/completed/i);
  });

  it('rejects when the scheme has already collected all its installments', async () => {
    const elevenPayments = Array.from({ length: 11 }, () => ({
      amount: 2000,
      devidentAmount: 0,
      dueMonthKey: PAST_MONTH_KEY,
    }));
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme({ payments: elevenPayments }) as never);

    await expect(new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1')).rejects.toThrow(/already collected/i);
  });

  it('rejects when no rate is available for the scheme metal and no override is given', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme() as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(null);

    await expect(new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1')).rejects.toThrow(/no silver rate/i);
  });

  it('resolves the GOLD rate (not silver) for a gold-metal scheme', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme({ schemeType: 'GOLD_11_1', metal: 'GOLD' }) as never);
    const rateSpy = jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(8000);
    jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      passbookNumber: 'GLD-2627-0000001',
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 2000,
      payments: [{ amount: 2000, devidentAmount: 0 }],
    } as never);

    await new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1');

    expect(rateSpy).toHaveBeenCalledWith('GOLD');
  });

  it('mints the passbook under the scheme plan own prefix when a plan is attached', async () => {
    const planId = '101';
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme({ schemeType: 'GOLD_11_1', metal: 'GOLD', planId }) as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(8000);
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue({ passbookPrefix: 'GLD', bonusMonths: 1 } as never);
    const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      passbookNumber: 'GLD-2627-0000001',
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 2000,
      payments: [{ amount: 2000, devidentAmount: 0 }],
    } as never);

    await new SavingsService().recordPaymentAsAdmin('s1', 2000, undefined, 'admin1');

    expect(recordSpy).toHaveBeenCalledWith('s1', expect.anything(), true, 'GLD');
  });
});

describe('SavingsService — customer Razorpay pay flow', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('createInstallmentOrder', () => {
    it('creates a Razorpay order for the scheme monthly amount in paise', async () => {
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme() as never);
      const createSpy = jest
        .spyOn(razorpay, 'createRazorpayOrder')
        .mockResolvedValue({ id: 'order_1', amount: 200000, currency: 'INR' } as never);

      const order = await new SavingsService().createInstallmentOrder('u1', 's1');

      expect(createSpy).toHaveBeenCalledWith(200000, 'INR', expect.stringContaining('savings_s1_'));
      expect(order).toEqual({ id: 'order_1', amount: 200000, currency: 'INR' });
    });

    it('rejects a non-owner', async () => {
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme() as never);

      await expect(new SavingsService().createInstallmentOrder('someone-else', 's1')).rejects.toThrow('Not authorized');
    });
  });

  describe('verifyAndRecordInstallment', () => {
    beforeEach(() => {
      jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(null);
      jest.spyOn(SavingsRepository.prototype, 'getPayments').mockResolvedValue([]);
    });

    it('rejects on a signature mismatch without touching the ledger', async () => {
      jest.spyOn(razorpay, 'verifyRazorpaySignature').mockReturnValue(false);
      const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment');

      await expect(
        new SavingsService().verifyAndRecordInstallment('u1', 's1', {
          orderId: 'order_1',
          paymentId: 'pay_1',
          signature: 'bad',
        }),
      ).rejects.toThrow('signature mismatch');
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('rejects when the captured amount does not match the scheme monthly amount', async () => {
      jest.spyOn(razorpay, 'verifyRazorpaySignature').mockReturnValue(true);
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme() as never);
      jest.spyOn(razorpay, 'fetchRazorpayOrder').mockResolvedValue({ id: 'order_1', amount: 100, currency: 'INR' } as never);
      const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment');

      await expect(
        new SavingsService().verifyAndRecordInstallment('u1', 's1', {
          orderId: 'order_1',
          paymentId: 'pay_1',
          signature: 'good',
        }),
      ).rejects.toThrow("does not match the scheme's monthly amount");
      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('records the payment once signature and amount both check out', async () => {
      jest.spyOn(razorpay, 'verifyRazorpaySignature').mockReturnValue(true);
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(baseScheme() as never);
      jest.spyOn(razorpay, 'fetchRazorpayOrder').mockResolvedValue({ id: 'order_1', amount: 200000, currency: 'INR' } as never);
      jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
      const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
        passbookNumber: 'SLV-2627-0000001',
        userId: { toString: () => 'u1' },
        duration: 11,
        bonusAmount: 2000,
        totalPaid: 2000,
        payments: [{ amount: 2000, devidentAmount: 0 }],
      } as never);

      await new SavingsService().verifyAndRecordInstallment('u1', 's1', {
        orderId: 'order_1',
        paymentId: 'pay_1',
        signature: 'good',
      });

      expect(recordSpy).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ month: 1, amount: 2000, materialRate: 100, materialWeight: 20, method: 'ONLINE' }),
        true,
        'PB',
      );
    });
  });
});

describe('SavingsService — admin ledger row edit/delete', () => {
  afterEach(() => jest.restoreAllMocks());

  it('re-derives materialWeight when amount or materialRate is corrected', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({
      payments: [{ amount: 2000, materialRate: 100, materialWeight: 20, devidentAmount: 0, devidentMaterialRate: 0 }],
    } as never);
    const updateSpy = jest.spyOn(SavingsRepository.prototype, 'updatePaymentRow').mockResolvedValue({} as never);

    await new SavingsService().adminUpdatePaymentRow('s1', 0, { amount: 2500, materialRate: 100 });

    expect(updateSpy).toHaveBeenCalledWith('s1', 0, { amount: 2500, materialRate: 100, materialWeight: 25 });
  });

  it('rejects an out-of-range row index', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({ payments: [] } as never);

    await expect(new SavingsService().adminUpdatePaymentRow('s1', 3, { amount: 1000 })).rejects.toThrow('Ledger row not found');
  });

  it('deletes a row via the repository', async () => {
    const deleteSpy = jest.spyOn(SavingsRepository.prototype, 'deletePaymentRow').mockResolvedValue({} as never);

    await new SavingsService().adminDeletePaymentRow('s1', 0);

    expect(deleteSpy).toHaveBeenCalledWith('s1', 0);
  });
});

// Item 4 (2026-08-30 business requirement): "KV Smart Purchase Plan" — pay any amount, any
// number of times, any time within the plan's duration window. These tests lock in the three
// ways its behavior diverges from every FIXED-mode scheme (Gold/Silver 11+1, Diwali): no
// one-installment-per-calendar-month limit, a time-window cap instead of a payment-count cap,
// and no auto-completion on the Nth payment.
const flexiblePlan = (overrides: Record<string, unknown> = {}) => ({
  paymentMode: 'FLEXIBLE',
  passbookPrefix: 'SMT',
  bonusMonths: 0,
  ...overrides,
});
// A start date that's always within an 11-month window of "now", regardless of when the test
// suite actually runs — unlike the fixed `START_DATE` fixture (2025-01-15) most other tests use,
// which is deliberately stale so its window IS closed by the time these tests run.
const RECENT_START_DATE = new Date(Date.now() - 24 * 60 * 60 * 1000);

describe('SavingsService — FLEXIBLE payment mode (item 4, KV Smart Purchase Plan)', () => {
  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(null);
    jest.spyOn(SavingsRepository.prototype, 'getPayments').mockResolvedValue([]);
  });

  it('allows a second payment in the same calendar month (no one-per-month limit)', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
      baseScheme({
        schemeType: 'SILVER_SMART',
        metal: 'SILVER',
        monthlyAmount: 100,
        planId: 'planF',
        startDate: RECENT_START_DATE,
        payments: [{ amount: 500, devidentAmount: 0, dueMonthKey: currentMonthKey() }],
      }) as never,
    );
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue(flexiblePlan() as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
    const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 0,
      payments: [{ amount: 500, devidentAmount: 0 }, { amount: 300, devidentAmount: 0 }],
    } as never);

    await new SavingsService().recordPaymentAsAdmin('s1', 300, undefined, 'admin1');

    expect(recordSpy).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ month: 2, amount: 300, dueMonthKey: currentMonthKey() }),
      false,
      'SMT',
    );
  });

  it("rejects a payment once the scheme's 11-month window has closed, even with few payments made", async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
      baseScheme({
        schemeType: 'SILVER_SMART',
        metal: 'SILVER',
        monthlyAmount: 100,
        planId: 'planF',
        startDate: START_DATE, // 2025-01-15 — its +11-month window is long past "now" in tests
        payments: [{ amount: 500, devidentAmount: 0, dueMonthKey: PAST_MONTH_KEY }],
      }) as never,
    );
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue(flexiblePlan() as never);

    await expect(new SavingsService().recordPaymentAsAdmin('s1', 300, undefined, 'admin1')).rejects.toThrow(
      /payment window has closed/i,
    );
  });

  it('does not auto-complete or credit a bonus row after `duration` payments land', async () => {
    const priorPayments = Array.from({ length: 10 }, (_, i) => ({ amount: 200, devidentAmount: 0, dueMonthKey: `2026-0${(i % 8) + 1}` }));
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
      baseScheme({
        schemeType: 'SILVER_SMART',
        metal: 'SILVER',
        monthlyAmount: 100,
        planId: 'planF',
        startDate: RECENT_START_DATE,
        payments: priorPayments,
      }) as never,
    );
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue(flexiblePlan() as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
    jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
      status: 'Active',
      userId: { toString: () => 'u1' },
      duration: 11,
      bonusAmount: 0,
      payments: [...priorPayments, { amount: 200, devidentAmount: 0 }],
    } as never);
    const bonusSpy = jest.spyOn(SavingsRepository.prototype, 'creditBonusMonth');
    const updateSpy = jest.spyOn(SavingsRepository.prototype, 'updateById');

    const result = await new SavingsService().recordPaymentAsAdmin('s1', 200, undefined, 'admin1');

    expect(bonusSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.status).toBe('Active');
  });

  describe('createInstallmentOrder', () => {
    it("requires and validates the customer's chosen amount against the plan floor", async () => {
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
        baseScheme({ schemeType: 'SILVER_SMART', metal: 'SILVER', monthlyAmount: 100, planId: 'planF', startDate: RECENT_START_DATE }) as never,
      );
      jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue(flexiblePlan() as never);

      await expect(new SavingsService().createInstallmentOrder('u1', 's1')).rejects.toThrow('amount must be at least');
      await expect(new SavingsService().createInstallmentOrder('u1', 's1', 50)).rejects.toThrow('amount must be at least');
    });

    it("creates a Razorpay order for the customer's chosen amount, not a fixed scheme amount", async () => {
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
        baseScheme({ schemeType: 'SILVER_SMART', metal: 'SILVER', monthlyAmount: 100, planId: 'planF', startDate: RECENT_START_DATE }) as never,
      );
      jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue(flexiblePlan() as never);
      const createSpy = jest
        .spyOn(razorpay, 'createRazorpayOrder')
        .mockResolvedValue({ id: 'order_1', amount: 75000, currency: 'INR' } as never);

      const order = await new SavingsService().createInstallmentOrder('u1', 's1', 750);

      expect(createSpy).toHaveBeenCalledWith(75000, 'INR', expect.stringContaining('savings_s1_'));
      expect(order).toEqual({ id: 'order_1', amount: 75000, currency: 'INR' });
    });
  });

  describe('verifyAndRecordInstallment', () => {
    it('records the CAPTURED Razorpay amount, not a fixed scheme amount', async () => {
      jest.spyOn(razorpay, 'verifyRazorpaySignature').mockReturnValue(true);
      jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(
        baseScheme({ schemeType: 'SILVER_SMART', metal: 'SILVER', monthlyAmount: 100, planId: 'planF', startDate: RECENT_START_DATE }) as never,
      );
      jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue(flexiblePlan() as never);
      jest.spyOn(razorpay, 'fetchRazorpayOrder').mockResolvedValue({ id: 'order_1', amount: 75000, currency: 'INR' } as never);
      jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(100);
      jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue(null);
      jest.spyOn(SavingsRepository.prototype, 'getPayments').mockResolvedValue([]);
      const recordSpy = jest.spyOn(SavingsRepository.prototype, 'recordPayment').mockResolvedValue({
        userId: { toString: () => 'u1' },
        duration: 11,
        bonusAmount: 0,
        totalPaid: 750,
        payments: [{ amount: 750, devidentAmount: 0 }],
      } as never);

      await new SavingsService().verifyAndRecordInstallment('u1', 's1', {
        orderId: 'order_1',
        paymentId: 'pay_1',
        signature: 'good',
      });

      expect(recordSpy).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ amount: 750, materialRate: 100, materialWeight: 7.5, method: 'ONLINE' }),
        true,
        'SMT',
      );
    });
  });
});
