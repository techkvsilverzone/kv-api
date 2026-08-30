import { SavingsService } from '../services/savings.service';
import { SavingsRepository } from '../repositories/savings.repository';
import { SchemePlanRepository } from '../repositories/schemePlan.repository';
import { IdProofRepository } from '../repositories/idProof.repository';
import { SavingsReminderService } from '../services/savingsReminder.service';
import { PricingService } from '../services/pricing.service';
import * as whatsapp from '../utils/whatsapp';
import { AppError } from '../utils/appError';

// PostgreSQL identities are numeric strings, not ObjectIds.
const ADMIN_ID = '42';
let nextPlanId = 100;
const newPlanId = (): string => String(nextPlanId++);

// Covers the multi-scheme-type rework: plan-driven enrollment, the early-exit forfeit (card
// rule 6), the Diwali gold price-band settlement, and the Diwali 3-consecutive-missed-months
// removal (card rule 2).
describe('SavingsService — enroll (plan-driven)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects a schemeType that is not yet open for enrollment (deposit schemes, phase 2)', async () => {
    await expect(new SavingsService().enroll('u1', { schemeType: 'GOLD_INCOME', monthlyAmount: 5000 })).rejects.toThrow(
      AppError,
    );
  });

  it('rejects when no plan is configured for the scheme type', async () => {
    jest.spyOn(SchemePlanRepository.prototype, 'findByType').mockResolvedValue(null);

    await expect(new SavingsService().enroll('u1', { schemeType: 'GOLD_11_1', monthlyAmount: 5000 })).rejects.toThrow(
      'not currently available',
    );
  });

  it('rejects an inactive plan', async () => {
    jest.spyOn(SchemePlanRepository.prototype, 'findByType').mockResolvedValue({ isActive: false } as never);

    await expect(new SavingsService().enroll('u1', { schemeType: 'GOLD_11_1', monthlyAmount: 5000 })).rejects.toThrow(
      'not currently available',
    );
  });

  it('rejects a monthlyAmount not offered by the plan', async () => {
    jest.spyOn(SchemePlanRepository.prototype, 'findByType').mockResolvedValue({
      isActive: true,
      monthlyAmounts: [3000, 5000],
    } as never);

    await expect(new SavingsService().enroll('u1', { schemeType: 'GOLD_11_1', monthlyAmount: 4000 })).rejects.toThrow(
      /monthlyAmount must be one of/,
    );
  });

  it('rejects enrollment when the customer has no ID proof on file (item 2)', async () => {
    jest.spyOn(SchemePlanRepository.prototype, 'findByType').mockResolvedValue({
      isActive: true,
      monthlyAmounts: [5000],
    } as never);
    jest.spyOn(IdProofRepository.prototype, 'findByUserId').mockResolvedValue(null);

    await expect(new SavingsService().enroll('u1', { schemeType: 'GOLD_11_1', monthlyAmount: 5000 })).rejects.toThrow(
      /Submit your ID proof/,
    );
  });

  it('creates the scheme stamped from the plan (type, metal, duration, bonus, planId)', async () => {
    const planId = newPlanId();
    jest.spyOn(SchemePlanRepository.prototype, 'findByType').mockResolvedValue({
      _id: planId,
      type: 'GOLD_11_1',
      isActive: true,
      metal: 'GOLD',
      name: 'Gold 11+1',
      durationMonths: 11,
      bonusMonths: 1,
      monthlyAmounts: [5000],
      hamper: undefined,
    } as never);
    const createSpy = jest.spyOn(SavingsRepository.prototype, 'create').mockResolvedValue({} as never);
    jest.spyOn(IdProofRepository.prototype, 'findByUserId').mockResolvedValue({ verificationStatus: 'Pending' } as never);

    await new SavingsService().enroll('u1', { schemeType: 'GOLD_11_1', monthlyAmount: 5000 });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'u1',
        schemeType: 'GOLD_11_1',
        planId,
        metal: 'GOLD',
        monthlyAmount: 5000,
        duration: 11,
        bonusAmount: 5000,
      }),
    );
  });

  it('snapshots the Diwali hamper into maturityBenefits at enrollment', async () => {
    jest.spyOn(SchemePlanRepository.prototype, 'findByType').mockResolvedValue({
      _id: newPlanId(),
      type: 'DIWALI',
      isActive: true,
      metal: undefined,
      name: 'Diwali Scheme',
      durationMonths: 11,
      bonusMonths: 0,
      monthlyAmounts: [3000],
      hamper: { goldCoinPurity: '916', silverCoinGrams: 30, giftsValue: 2500, gifts: ['Crackers Box', 'Sweets and Snacks'] },
    } as never);
    const createSpy = jest.spyOn(SavingsRepository.prototype, 'create').mockResolvedValue({} as never);
    jest.spyOn(IdProofRepository.prototype, 'findByUserId').mockResolvedValue({ verificationStatus: 'Pending' } as never);

    await new SavingsService().enroll('u1', { schemeType: 'DIWALI', monthlyAmount: 3000 });

    // Gold is a computed VALUE, only known at redemption (needs totalPaid) — not set here.
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bonusAmount: 0,
        maturityBenefits: {
          silverGrams: 30,
          giftsValue: 2500,
          gifts: ['Crackers Box', 'Sweets and Snacks'],
        },
      }),
    );
  });
});

describe('SavingsService — cancelScheme (card rule 6: early-exit forfeit)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('forfeits the default 10% (no plan attached) and floors redeemable at 0', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({
      status: 'Active',
      totalPaid: 10000,
      planId: undefined,
    } as never);
    const cancelSpy = jest.spyOn(SavingsRepository.prototype, 'cancelScheme').mockResolvedValue({ status: 'Cancelled' } as never);

    await new SavingsService().cancelScheme('s1', ADMIN_ID, {});

    expect(cancelSpy).toHaveBeenCalledWith('s1', {
      cancelledAt: expect.any(Date),
      amountPaidAtCancellation: 10000,
      penaltyPercent: 10,
      penaltyAmount: 1000,
      giftsValueDeducted: 0,
      netRedeemable: 9000,
      note: undefined,
      cancelledBy: ADMIN_ID,
    });
  });

  it('uses the plan penalty percent and deducts gift value', async () => {
    const planId = newPlanId();
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({
      status: 'Active',
      totalPaid: 10000,
      planId,
    } as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue({ earlyExitPenaltyPercent: 20 } as never);
    const cancelSpy = jest.spyOn(SavingsRepository.prototype, 'cancelScheme').mockResolvedValue({ status: 'Cancelled' } as never);

    await new SavingsService().cancelScheme('s1', ADMIN_ID, { giftsValueDeducted: 500, note: 'Received a gift coin' });

    expect(cancelSpy).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ penaltyPercent: 20, penaltyAmount: 2000, giftsValueDeducted: 500, netRedeemable: 7500 }),
    );
  });

  it('never lets netRedeemable go negative when gift value exceeds what remains', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({
      status: 'Active',
      totalPaid: 1000,
      planId: undefined,
    } as never);
    const cancelSpy = jest.spyOn(SavingsRepository.prototype, 'cancelScheme').mockResolvedValue({} as never);

    await new SavingsService().cancelScheme('s1', ADMIN_ID, { giftsValueDeducted: 5000 });

    expect(cancelSpy).toHaveBeenCalledWith('s1', expect.objectContaining({ netRedeemable: 0 }));
  });

  it('rejects cancelling a scheme that is not Active', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue({ status: 'Completed' } as never);

    await expect(new SavingsService().cancelScheme('s1', ADMIN_ID, {})).rejects.toThrow(/already completed/i);
  });
});

describe('SavingsService — Diwali redemption payout', () => {
  afterEach(() => jest.restoreAllMocks());

  const diwaliScheme = (overrides: Record<string, unknown> = {}) => ({
    schemeType: 'DIWALI',
    planId: newPlanId(),
    status: 'Completed',
    totalPaid: 33000,
    monthlyAmount: 3000,
    ...overrides,
  });

  it('rejects redemption compute for a non-Diwali scheme', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(diwaliScheme({ schemeType: 'GOLD_11_1' }) as never);

    await expect(new SavingsService().computeDiwaliRedemption('s1')).rejects.toThrow(/only applies to Diwali/);
  });

  it('rejects when the scheme has not completed all its installments', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(diwaliScheme({ status: 'Active' }) as never);

    await expect(new SavingsService().computeDiwaliRedemption('s1')).rejects.toThrow(/must complete all its installments/);
  });

  it('matches the owner-confirmed worked example: ₹3,000×11 paid → ₹32,000 gold + ₹2,500 gifts + 30g silver', async () => {
    // totalValue = 33000 (paid) + 3000 (1 bonus month) = 36000
    // silverValue = 30g × ₹50/g = 1500; goldValue = 36000 − 2500 (gifts) − 1500 (silver) = 32000
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(diwaliScheme() as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue({
      hamper: { goldCoinPurity: '916', silverCoinGrams: 30, giftsValue: 2500, gifts: ['Crackers Box'] },
    } as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockImplementation(async (metal: string) =>
      metal === 'GOLD' ? 8000 : 50,
    );
    const setSpy = jest.spyOn(SavingsRepository.prototype, 'setMaturityBenefits').mockResolvedValue({} as never);

    await new SavingsService().computeDiwaliRedemption('s1');

    expect(setSpy).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        goldCoinValue: 32000,
        goldGrams: 4, // 32000 / 8000
        goldRatePerGram: 8000,
        silverGrams: 30,
        silverValue: 1500,
        silverRatePerGram: 50,
        giftsValue: 2500,
        gifts: ['Crackers Box'],
      }),
    );
  });

  it('skips the silver-rate lookup entirely when the plan has no silver coin', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(diwaliScheme() as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue({
      hamper: { giftsValue: 2500, gifts: [] },
    } as never);
    const rateSpy = jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(8000);
    jest.spyOn(SavingsRepository.prototype, 'setMaturityBenefits').mockResolvedValue({} as never);

    await new SavingsService().computeDiwaliRedemption('s1');

    expect(rateSpy).toHaveBeenCalledWith('GOLD');
    expect(rateSpy).not.toHaveBeenCalledWith('SILVER');
  });

  it('rejects when giftsValue + silver value exceed the total payout value (plan misconfiguration)', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(diwaliScheme({ totalPaid: 1000, monthlyAmount: 100 }) as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue({
      hamper: { silverCoinGrams: 30, giftsValue: 5000, gifts: [] },
    } as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(50);

    await expect(new SavingsService().computeDiwaliRedemption('s1')).rejects.toThrow(/configuration error/);
  });

  it('rejects when no gold rate is available', async () => {
    jest.spyOn(SavingsRepository.prototype, 'findById').mockResolvedValue(diwaliScheme() as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findById').mockResolvedValue({ hamper: { giftsValue: 0, gifts: [] } } as never);
    jest.spyOn(PricingService.prototype, 'getCurrentRatePerGram').mockResolvedValue(null);

    await expect(new SavingsService().computeDiwaliRedemption('s1')).rejects.toThrow(/no gold rate/i);
  });
});

describe('SavingsReminderService — Diwali drop-out after consecutive missed months', () => {
  afterEach(() => jest.restoreAllMocks());

  const now = new Date('2025-06-15T00:00:00+05:30');

  it('drops a Diwali scheme once its unpaid gap reaches the plan threshold', async () => {
    const scheme = {
      _id: { toString: () => 's1' },
      schemeType: 'DIWALI',
      passbookNumber: 'DIW-2425-0000001',
      startDate: new Date('2025-01-15T00:00:00+05:30'), // 5 months before `now`
      duration: 11,
      payments: [], // zero real payments — 5 months missed
      userId: { phone: '9999999999' },
    };
    jest.spyOn(SavingsRepository.prototype, 'findActiveWithUserPhone').mockResolvedValue([scheme] as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findAll').mockResolvedValue([
      { type: 'DIWALI', maxConsecutiveMissedMonths: 3 },
    ] as never);
    const updateSpy = jest.spyOn(SavingsRepository.prototype, 'updateById').mockResolvedValue({} as never);
    const whatsappSpy = jest.spyOn(whatsapp, 'sendWhatsAppText').mockResolvedValue({} as never);

    const result = await new SavingsReminderService().runDailyReminders(now);

    expect(updateSpy).toHaveBeenCalledWith('s1', { status: 'Dropped' });
    expect(whatsappSpy).toHaveBeenCalled();
    expect(result.dropped).toBe(1);
  });

  it('does not drop a Diwali scheme before the threshold is reached', async () => {
    const scheme = {
      _id: { toString: () => 's1' },
      schemeType: 'DIWALI',
      passbookNumber: 'DIW-2425-0000001',
      startDate: new Date('2025-05-01T00:00:00+05:30'), // ~1.5 months before `now`
      duration: 11,
      payments: [],
      userId: { phone: '9999999999' },
    };
    jest.spyOn(SavingsRepository.prototype, 'findActiveWithUserPhone').mockResolvedValue([scheme] as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findAll').mockResolvedValue([
      { type: 'DIWALI', maxConsecutiveMissedMonths: 3 },
    ] as never);
    const updateSpy = jest.spyOn(SavingsRepository.prototype, 'updateById');
    jest.spyOn(whatsapp, 'sendSavingsReminder').mockResolvedValue({} as never);

    const result = await new SavingsReminderService().runDailyReminders(now);

    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.dropped).toBe(0);
  });

  it('does not apply the missed-months drop rule to non-Diwali schemes', async () => {
    const scheme = {
      _id: { toString: () => 's1' },
      schemeType: 'SILVER_11_1',
      passbookNumber: 'SLV-2425-0000001',
      startDate: new Date('2025-01-15T00:00:00+05:30'),
      duration: 11,
      payments: [],
      userId: { phone: '9999999999' },
    };
    jest.spyOn(SavingsRepository.prototype, 'findActiveWithUserPhone').mockResolvedValue([scheme] as never);
    jest.spyOn(SchemePlanRepository.prototype, 'findAll').mockResolvedValue([
      { type: 'DIWALI', maxConsecutiveMissedMonths: 3 },
    ] as never);
    const updateSpy = jest.spyOn(SavingsRepository.prototype, 'updateById');
    jest.spyOn(whatsapp, 'sendSavingsReminder').mockResolvedValue({} as never);

    const result = await new SavingsReminderService().runDailyReminders(now);

    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.dropped).toBe(0);
  });
});
