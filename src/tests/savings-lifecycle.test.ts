import { SavingsService } from '../services/savings.service';
import { SavingsRepository } from '../repositories/savings.repository';
import { SchemePlanRepository } from '../repositories/schemePlan.repository';
import { UserRepository } from '../repositories/user.repository';
import { PricingService } from '../services/pricing.service';
import * as timeUtils from '../utils/time';
import * as whatsapp from '../utils/whatsapp';

// Full-lifecycle integration-style tests for all three self-service schemes. Unlike the other
// savings-*.test.ts files (which unit-test one method at a time against hand-built fixtures),
// these drive the REAL SavingsService end to end — enroll -> pay every installment -> auto
// bonus/completion -> (Diwali) redemption -> cancellation — against an in-memory fake of
// SavingsRepository, so a bug that only shows up across multiple sequential calls (like the
// Diwali-payments-require-a-silver-rate bug this file was written to catch) can't hide behind
// an isolated single-call mock.

// PostgreSQL identities are numeric strings, not ObjectIds.
const ADMIN_ID = '42';

/** Minimal in-memory stand-in for the Mongo-backed SavingsRepository. Plain objects, not real
 * domain objects — good enough because SavingsService only ever reads plain fields off
 * what the repository returns, plus `.toObject()` for the maturityDate read-path. */
class FakeSavingsStore {
  private docs = new Map<string, any>();
  private counter = 0;

  private mintPassbook(prefix: string): string {
    const count = [...this.docs.values()].filter((d) => d.passbookNumber?.startsWith(`${prefix}-`)).length;
    return `${prefix}-TEST-${String(count + 1).padStart(3, '0')}`;
  }

  private withToObject(doc: any) {
    return { ...doc, toObject: () => ({ ...doc }) };
  }

  create(data: any) {
    const id = `scheme${++this.counter}`;
    const doc: any = {
      _id: id,
      userId: data.user,
      schemeType: data.schemeType,
      planId: data.planId,
      metal: data.metal,
      planName: data.planName,
      monthlyAmount: data.monthlyAmount,
      duration: data.duration,
      bonusAmount: data.bonusAmount,
      totalPaid: 0,
      status: 'Active',
      payments: [] as any[],
      maturityBenefits: data.maturityBenefits,
      startDate: data.startDate ? new Date(data.startDate) : new Date('2025-01-15T00:00:00+05:30'),
    };
    this.docs.set(id, doc);
    return this.withToObject(doc);
  }

  findById(id: string) {
    const doc = this.docs.get(id);
    return doc ? this.withToObject(doc) : null;
  }

  recordPayment(id: string, row: any, assignPassbook: boolean, prefix?: string) {
    const doc = this.docs.get(id);
    if (!doc) return null;
    doc.totalPaid += row.amount;
    doc.payments.push({ ...row, paidAt: new Date() });
    if (assignPassbook) doc.passbookNumber = this.mintPassbook(prefix || 'PB');
    return this.withToObject(doc);
  }

  creditBonusMonth(id: string, row: any) {
    const doc = this.docs.get(id);
    if (!doc) return null;
    doc.payments.push({
      month: row.month,
      amount: 0,
      materialRate: 0,
      materialWeight: 0,
      devidentAmount: row.devidentAmount,
      devidentMaterialRate: row.devidentMaterialRate,
      devidentMaterialWeight: row.devidentMaterialWeight,
      method: 'ONLINE',
      paidAt: new Date(),
    });
    doc.status = 'Completed';
    return this.withToObject(doc);
  }

  updateById(id: string, patch: any) {
    const doc = this.docs.get(id);
    if (!doc) return null;
    Object.assign(doc, patch);
    return this.withToObject(doc);
  }

  setMaturityBenefits(id: string, mb: any) {
    const doc = this.docs.get(id);
    if (!doc) return null;
    doc.maturityBenefits = mb;
    return this.withToObject(doc);
  }

  cancelScheme(id: string, cancellation: any) {
    const doc = this.docs.get(id);
    if (!doc) return null;
    doc.status = 'Cancelled';
    doc.cancellation = cancellation;
    return this.withToObject(doc);
  }

  getPayments(id: string) {
    return this.docs.get(id)?.payments ?? [];
  }
}

const PLANS: Record<string, any> = {
  GOLD_11_1: {
    _id: 'planGold',
    type: 'GOLD_11_1',
    isActive: true,
    metal: 'GOLD',
    durationMonths: 11,
    bonusMonths: 1,
    monthlyAmounts: [5000],
    passbookPrefix: 'GLD',
    earlyExitPenaltyPercent: 10,
  },
  SILVER_11_1: {
    _id: 'planSilver',
    type: 'SILVER_11_1',
    isActive: true,
    metal: 'SILVER',
    durationMonths: 11,
    bonusMonths: 1,
    monthlyAmounts: [3000],
    passbookPrefix: 'SLV',
    earlyExitPenaltyPercent: 10,
  },
  DIWALI: {
    _id: 'planDiwali',
    type: 'DIWALI',
    isActive: true,
    metal: undefined,
    durationMonths: 11,
    bonusMonths: 0,
    monthlyAmounts: [3000],
    passbookPrefix: 'DIW',
    earlyExitPenaltyPercent: 10,
    maxConsecutiveMissedMonths: 3,
    hamper: { goldCoinPurity: '916', silverCoinGrams: 30, giftsValue: 2500, gifts: ['Crackers Box', 'Sweets and Savories'] },
  },
};

describe('Savings — full lifecycle (enroll → pay every installment → completion)', () => {
  let store: FakeSavingsStore;
  let monthCounter: number;

  const nextMonthKey = () => {
    monthCounter++;
    const year = 2025 + Math.floor((monthCounter - 1) / 12);
    const month = ((monthCounter - 1) % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  beforeEach(() => {
    store = new FakeSavingsStore();
    monthCounter = 0;

    jest.spyOn(SavingsRepository.prototype, 'create').mockImplementation(async (data) => store.create(data) as never);
    jest.spyOn(SavingsRepository.prototype, 'findById').mockImplementation(async (id) => store.findById(id) as never);
    jest
      .spyOn(SavingsRepository.prototype, 'recordPayment')
      .mockImplementation(async (id, row, assign, prefix) => store.recordPayment(id, row, !!assign, prefix) as never);
    jest
      .spyOn(SavingsRepository.prototype, 'creditBonusMonth')
      .mockImplementation(async (id, row) => store.creditBonusMonth(id, row) as never);
    jest.spyOn(SavingsRepository.prototype, 'updateById').mockImplementation(async (id, patch) => store.updateById(id, patch) as never);
    jest
      .spyOn(SavingsRepository.prototype, 'setMaturityBenefits')
      .mockImplementation(async (id, mb) => store.setMaturityBenefits(id, mb) as never);
    jest
      .spyOn(SavingsRepository.prototype, 'cancelScheme')
      .mockImplementation(async (id, c) => store.cancelScheme(id, c) as never);
    jest.spyOn(SavingsRepository.prototype, 'getPayments').mockImplementation(async (id) => store.getPayments(id) as never);

    jest.spyOn(SchemePlanRepository.prototype, 'findByType').mockImplementation(async (type) => PLANS[type as string] as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockImplementation(async (id) => {
      const plan = Object.values(PLANS).find((p) => p._id === id);
      return (plan ?? null) as never;
    });

    jest.spyOn(UserRepository.prototype, 'findById').mockResolvedValue({ phone: '9999999999' } as never);

    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockImplementation(async (metal: unknown) => {
      if (metal === 'GOLD') return 8000;
      if (metal === 'SILVER') return 50;
      return null;
    });

    // One installment per calendar month is enforced against the REAL current month — advance
    // a fake "today" per call so 11 sequential payments in one test don't collide with each
    // other (that specific rejection is already covered in savings-ledger.test.ts).
    jest.spyOn(timeUtils, 'istMonthKey').mockImplementation(() => nextMonthKey());

    jest.spyOn(whatsapp, 'sendSavingsPaymentSuccess').mockResolvedValue({ sent: true } as never);
    jest.spyOn(whatsapp, 'sendDiwaliSchemeCompleted').mockResolvedValue({ sent: true } as never);
    jest.spyOn(whatsapp, 'sendDiwaliRedemptionReady').mockResolvedValue({ sent: true } as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('Gold 11+1: 11 installments auto-credit a 1-month gold bonus and complete the scheme', async () => {
    const service = new SavingsService();
    const scheme = await service.enroll('user1', { schemeType: 'GOLD_11_1', monthlyAmount: 5000, startDate: '2025-01-15' });

    let final;
    for (let i = 0; i < 11; i++) {
      final = await service.recordPaymentAsAdmin((scheme as any)._id, 5000, undefined, ADMIN_ID);
    }

    expect(final!.status).toBe('Completed');
    expect(final!.passbookNumber).toMatch(/^GLD-/);
    expect(final!.totalPaid).toBe(55000);
    expect(final!.payments).toHaveLength(12); // 11 real + 1 auto-credited bonus row
    const bonusRow = final!.payments[11];
    expect(bonusRow.amount).toBe(0);
    expect(bonusRow.devidentAmount).toBe(5000);
    expect(bonusRow.devidentMaterialRate).toBe(8000);
    expect(bonusRow.devidentMaterialWeight).toBeCloseTo(0.625, 3); // 5000 / 8000
  });

  it('Silver 11+1: 11 installments auto-credit a 1-month silver bonus and complete the scheme', async () => {
    const service = new SavingsService();
    const scheme = await service.enroll('user1', { schemeType: 'SILVER_11_1', monthlyAmount: 3000, startDate: '2025-01-15' });

    let final;
    for (let i = 0; i < 11; i++) {
      final = await service.recordPaymentAsAdmin((scheme as any)._id, 3000, undefined, ADMIN_ID);
    }

    expect(final!.status).toBe('Completed');
    expect(final!.passbookNumber).toMatch(/^SLV-/);
    expect(final!.totalPaid).toBe(33000);
    const bonusRow = final!.payments[11];
    expect(bonusRow.devidentAmount).toBe(3000);
    expect(bonusRow.devidentMaterialRate).toBe(50);
    expect(bonusRow.devidentMaterialWeight).toBe(60); // 3000 / 50
    // The Diwali-only "ready for redemption" ops alert must never fire for a gram-accumulation scheme.
    expect(whatsapp.sendDiwaliSchemeCompleted).not.toHaveBeenCalled();
  });

  it('Diwali: 11 installments never touch the silver rate, complete without a bonus row, alert the ops number, then compute a redemption matching the owner-confirmed example', async () => {
    const rateSpy = jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram');
    const service = new SavingsService();
    const scheme = await service.enroll('user1', { schemeType: 'DIWALI', monthlyAmount: 3000, startDate: '2025-01-15' });
    const schemeId = (scheme as any)._id;

    let final;
    for (let i = 0; i < 11; i++) {
      final = await service.recordPaymentAsAdmin(schemeId, 3000, undefined, ADMIN_ID);
    }

    // The bug this test guards against: Diwali has no metal, so recording its installments
    // must never need (or block on) a metal rate at all.
    expect(rateSpy).not.toHaveBeenCalled();

    expect(final!.status).toBe('Completed');
    expect(final!.passbookNumber).toMatch(/^DIW-/);
    expect(final!.totalPaid).toBe(33000);
    expect(final!.payments).toHaveLength(11); // no auto-credited bonus row for Diwali
    expect(final!.payments.every((p: any) => p.materialRate === 0 && p.materialWeight === 0)).toBe(true);
    expect(whatsapp.sendDiwaliSchemeCompleted).toHaveBeenCalledWith(final!.passbookNumber, 33000);

    // Owner-confirmed worked example: ₹3,000×11 paid → ₹32,000 gold + ₹2,500 gifts + 30g silver.
    const redeemed = await service.computeDiwaliRedemption(schemeId);
    const mb = (redeemed as any).maturityBenefits;
    expect(mb.goldCoinValue).toBe(32000);
    expect(mb.goldGrams).toBe(4); // 32000 / 8000
    expect(mb.silverGrams).toBe(30);
    expect(mb.silverValue).toBe(1500); // 30 * 50
    expect(mb.giftsValue).toBe(2500);
    expect(mb.computedAt).toBeInstanceOf(Date);
    expect(whatsapp.sendDiwaliRedemptionReady).toHaveBeenCalledWith('9999999999', {
      passbookNumber: final!.passbookNumber,
      goldGrams: 4,
      goldCoinValue: 32000,
      silverGrams: 30,
      giftsValue: 2500,
    });
  });

  it('cancelling mid-scheme (card rule 6) forfeits 10% and blocks further payments', async () => {
    const service = new SavingsService();
    const scheme = await service.enroll('user1', { schemeType: 'GOLD_11_1', monthlyAmount: 5000, startDate: '2025-01-15' });
    const schemeId = (scheme as any)._id;

    for (let i = 0; i < 3; i++) {
      await service.recordPaymentAsAdmin(schemeId, 5000, undefined, ADMIN_ID);
    }

    const cancelled = await service.cancelScheme(schemeId, ADMIN_ID, {});
    expect(cancelled.status).toBe('Cancelled');
    expect(cancelled.cancellation).toMatchObject({
      amountPaidAtCancellation: 15000,
      penaltyPercent: 10,
      penaltyAmount: 1500,
      netRedeemable: 13500,
    });

    await expect(service.recordPaymentAsAdmin(schemeId, 5000, undefined, ADMIN_ID)).rejects.toThrow(/cancelled/i);
  });

  it('Diwali redemption cannot be computed before the scheme has collected all installments', async () => {
    const service = new SavingsService();
    const scheme = await service.enroll('user1', { schemeType: 'DIWALI', monthlyAmount: 3000, startDate: '2025-01-15' });
    const schemeId = (scheme as any)._id;

    await service.recordPaymentAsAdmin(schemeId, 3000, undefined, ADMIN_ID); // only 1 of 11

    await expect(service.computeDiwaliRedemption(schemeId)).rejects.toThrow(/must complete all its installments/);
  });
});
