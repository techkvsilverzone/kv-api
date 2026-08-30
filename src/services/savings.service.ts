import { SavingsRepository } from '../repositories/savings.repository';
import { SchemePlanRepository } from '../repositories/schemePlan.repository';
import { UserRepository } from '../repositories/user.repository';
import { IdProofRepository } from '../repositories/idProof.repository';
import { PricingService } from './pricing.service';
import { ISavings, ISchemePlan, SchemeType } from '../domain/savings';
import { sendSavingsPaymentSuccess, sendDiwaliSchemeCompleted, sendDiwaliRedemptionReady } from '../utils/whatsapp';
import { createRazorpayOrder, fetchRazorpayOrder, verifyRazorpaySignature } from '../utils/razorpay';
import { AppError } from '../utils/appError';
import { addMonths, istMonthKey } from '../utils/time';
import Logger from '../utils/logger';

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Open for enrollment today — GOLD_INCOME/SILVER_DEPOSIT are lump-sum deposit schemes reserved
 * for a later phase. SILVER_SMART (item 4, "KV Smart Purchase Plan") is FLEXIBLE-mode: any
 * amount, any time, within the plan's duration window — see `applyPayment`/`createInstallmentOrder`. */
const ENROLLABLE_TYPES: SchemeType[] = ['GOLD_11_1', 'SILVER_11_1', 'DIWALI', 'SILVER_SMART'];
const ALL_SCHEME_TYPES: SchemeType[] = ['GOLD_11_1', 'SILVER_11_1', 'DIWALI', 'GOLD_INCOME', 'SILVER_DEPOSIT', 'SILVER_SMART'];

export class SavingsService {
  private savingsRepository: SavingsRepository;
  private schemePlanRepository: SchemePlanRepository;
  private userRepository: UserRepository;
  private idProofRepository: IdProofRepository;
  private pricingService: PricingService;

  constructor() {
    this.savingsRepository = new SavingsRepository();
    this.schemePlanRepository = new SchemePlanRepository();
    this.userRepository = new UserRepository();
    this.idProofRepository = new IdProofRepository();
    this.pricingService = new PricingService();
  }

  private async getPlanForScheme(scheme: ISavings): Promise<ISchemePlan | null> {
    if (!scheme.planId) return null;
    return this.schemePlanRepository.findById(scheme.planId.toString());
  }

  /**
   * Card rule 2: an installment is due by the plan's cutoff day each month, but a late payment
   * is still accepted — it just pushes maturity out by however many months it slipped. Computed
   * at read time from the ledger, never stored: whichever is LATER of (a) the originally
   * scheduled `start + duration months`, or (b) the last real payment's month + however many
   * installments are still outstanding.
   */
  public getMaturityDate(scheme: ISavings): Date {
    const scheduled = addMonths(scheme.startDate, scheme.duration);
    const realPayments = scheme.payments.filter((p) => p.amount > 0);
    if (realPayments.length === 0) return scheduled;
    const lastPaidAt = realPayments.reduce(
      (latest, p) => (p.paidAt > latest ? p.paidAt : latest),
      realPayments[0].paidAt,
    );
    const remainingInstallments = Math.max(0, scheme.duration - realPayments.length);
    const projectedFromLast = addMonths(lastPaidAt, remainingInstallments);
    return projectedFromLast > scheduled ? projectedFromLast : scheduled;
  }

  private withMaturityDate(scheme: ISavings) {
    return { ...scheme, maturityDate: this.getMaturityDate(scheme) };
  }

  /** Enrollment alone creates a scheme record but no passbook — that's issued on first payment. */
  public async enroll(userId: string, data: any) {
    const schemeType = String(data.schemeType || 'SILVER_11_1') as SchemeType;
    if (!ENROLLABLE_TYPES.includes(schemeType)) {
      throw new AppError(`schemeType must be one of ${ENROLLABLE_TYPES.join(', ')}`, 400);
    }

    const plan = await this.schemePlanRepository.findByType(schemeType);
    if (!plan || !plan.isActive) {
      throw new AppError('This scheme is not currently available for enrollment', 400);
    }

    // Item 4: FLEXIBLE plans (KV Smart Purchase Plan) have no customer-chosen denomination at
    // enrollment — every individual payment picks its own amount later (>= minPaymentAmount).
    // `monthlyAmount` is still stored (the column is NOT NULL) as that floor, purely so
    // `applyPayment`'s existing "amount >= scheme.monthlyAmount" floor check keeps working
    // unmodified for both payment modes.
    let monthlyAmount: number;
    if (plan.paymentMode === 'FLEXIBLE') {
      monthlyAmount = plan.minPaymentAmount ?? 100;
    } else {
      monthlyAmount = Number(data.monthlyAmount);
      if (!plan.monthlyAmounts.includes(monthlyAmount)) {
        throw new AppError(`monthlyAmount must be one of: ${plan.monthlyAmounts.join(', ')}`, 400);
      }
    }

    // Item 2: KYC is required once per customer (not per scheme) — any prior submission
    // unblocks enrollment regardless of its verification status, since review is async and
    // happens in the background (business decision: non-blocking). Checked last, after the
    // request itself is validated, so a bad request reports its own error first.
    const idProof = await this.idProofRepository.findByUserId(userId);
    if (!idProof) {
      throw new AppError('Submit your ID proof before enrolling in a savings scheme', 400);
    }

    const bonusAmount = plan.bonusMonths > 0 ? monthlyAmount * plan.bonusMonths : 0;
    // Diwali's gold portion is a VALUE, not a fixed weight — it's only known once
    // computeDiwaliRedemption runs (needs totalPaid, which doesn't exist yet at enrollment).
    // Snapshot just the fixed parts (gifts, silver coin weight) here for early display.
    const maturityBenefits = plan.hamper
      ? {
          silverGrams: plan.hamper.silverCoinGrams,
          giftsValue: plan.hamper.giftsValue,
          gifts: plan.hamper.gifts ?? [],
        }
      : undefined;

    return await this.savingsRepository.create({
      user: userId,
      schemeType: plan.type,
      planId: plan._id,
      metal: plan.metal,
      planName: plan.name,
      monthlyAmount,
      duration: plan.durationMonths,
      totalPaid: 0,
      bonusAmount,
      maturityBenefits,
      startDate: data.startDate,
    });
  }

  public async getMySchemes(userId: string) {
    const schemes = await this.savingsRepository.findByUserId(userId);
    return schemes.map((s) => this.withMaturityDate(s));
  }

  /**
   * Core ledger-entry logic shared by the customer (post-Razorpay-verify) and admin/staff
   * (manual/offline collection) payment paths.
   *
   * - Resolves the material rate for the scheme's metal: an explicit override (admin only),
   *   else the live rate for that metal (`PricingService.getCurrentRatePerGram`).
   * - Rejects a second installment for the same calendar month (card rule 3).
   * - Converts the collection to grams and mints the passbook (under this scheme's plan prefix)
   *   on the very first payment (see SavingsRepository.recordPayment).
   * - Auto-credits the bonus/devident row and flips the scheme to Completed the moment a
   *   scheme's Nth real installment lands, N = the plan's duration. Schemes with no bonus
   *   months (e.g. Diwali) complete on that same final installment instead.
   */
  private async applyPayment(
    schemeId: string,
    amount: number,
    opts: {
      materialRateOverride?: number;
      method: 'ONLINE' | 'CASH';
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      recordedBy?: string;
    },
  ): Promise<ISavings> {
    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);

    if (scheme.status !== 'Active') {
      throw new AppError(`This scheme is ${scheme.status.toLowerCase()} and can no longer accept payments`, 400);
    }

    const plan = await this.getPlanForScheme(scheme);
    const isFlexible = plan?.paymentMode === 'FLEXIBLE';

    // Item 4 (KV Smart Purchase Plan): a FLEXIBLE scheme's `duration` is a TIME WINDOW from
    // enrollment (pay any number of times within it), not a payment-count cap like every other
    // scheme — cap on the window instead. FIXED plans keep the original count-based cap.
    const realPaymentsSoFar = scheme.payments.filter((p) => p.amount > 0).length;
    if (isFlexible) {
      if (new Date() > addMonths(scheme.startDate, scheme.duration)) {
        throw new AppError('This scheme\'s payment window has closed', 400);
      }
    } else if (realPaymentsSoFar >= scheme.duration) {
      throw new AppError('This scheme has already collected all its installments', 400);
    }
    if (!Number.isFinite(amount) || amount < scheme.monthlyAmount) {
      throw new AppError(`Payment must be at least ₹${scheme.monthlyAmount}`, 400);
    }

    // Card rule 3: only one installment accepted per calendar month — keyed off the real
    // calendar month the collection is being made in (IST), not a scheduled slot, so a late
    // catch-up payment still only occupies the month it's actually paid in. Item 4: FLEXIBLE
    // plans are explicitly "pay anytime, any number of times" — this restriction doesn't apply.
    const collectionMonthKey = istMonthKey(new Date());
    if (!isFlexible && scheme.payments.some((p) => p.amount > 0 && p.dueMonthKey === collectionMonthKey)) {
      throw new AppError('An installment for this month has already been recorded', 400);
    }

    // Diwali has no `metal` — its collections aren't gram-accumulated (the redemption payout
    // is computed later, in bulk, from totalPaid — see computeDiwaliRedemption). Resolving a
    // rate here would be meaningless AND would wrongly block every Diwali collection behind
    // whatever the *silver* rate happens to be that day.
    const metal = scheme.metal;
    let rate = 0;
    if (metal) {
      const resolved = opts.materialRateOverride ?? (await this.pricingService.getCurrentRatePerGram(metal));
      if (!resolved || resolved <= 0) {
        throw new AppError(
          `No ${metal.toLowerCase()} rate is available to record this collection — set one first`,
          400,
        );
      }
      rate = resolved;
    }

    const passbookPrefix = plan?.passbookPrefix ?? 'PB';

    const month = scheme.payments.length + 1;
    const materialWeight = metal ? round3(amount / rate) : 0;
    const isFirstPayment = scheme.payments.length === 0 && !scheme.passbookNumber;

    const updated = await this.savingsRepository.recordPayment(
      schemeId,
      {
        month,
        amount,
        materialRate: rate,
        materialWeight,
        method: opts.method,
        razorpayOrderId: opts.razorpayOrderId,
        razorpayPaymentId: opts.razorpayPaymentId,
        recordedBy: opts.recordedBy,
        dueMonthKey: collectionMonthKey,
      },
      isFirstPayment,
      passbookPrefix,
    );
    if (!updated) throw new AppError('Savings scheme not found', 404);

    const realPaymentsNow = updated.payments.filter((p) => p.amount > 0).length;
    const alreadyHasDevident = updated.payments.some((p) => p.devidentAmount > 0);
    const bonusMonths = plan?.bonusMonths ?? (updated.duration === 11 ? 1 : 0);

    // Item 4: a FLEXIBLE scheme never auto-completes on a payment count — it stays Active for
    // its whole time window regardless of how many payments land, and is closed out manually
    // (redemption happens in-store) once the customer is done or the window has passed.
    if (!isFlexible && realPaymentsNow === updated.duration) {
      if (bonusMonths > 0 && !alreadyHasDevident) {
        const devidentAmount = updated.bonusAmount;
        const withBonus = await this.savingsRepository.creditBonusMonth(schemeId, {
          month: month + 1,
          devidentAmount,
          devidentMaterialRate: rate,
          devidentMaterialWeight: round3(devidentAmount / rate),
        });
        if (withBonus) return withBonus;
      } else if (bonusMonths === 0) {
        const completed = await this.savingsRepository.updateById(schemeId, { status: 'Completed' });
        if (completed) {
          if (completed.schemeType === 'DIWALI') {
            await this.notifyDiwaliCompleted(completed);
          }
          return completed;
        }
      }
    }

    return updated;
  }

  /** Alerts the ops number that a Diwali scheme is ready for the (manual, admin-triggered)
   * redemption payout compute — best-effort, never blocks the response. */
  private async notifyDiwaliCompleted(scheme: ISavings) {
    try {
      await sendDiwaliSchemeCompleted(scheme.passbookNumber, scheme.totalPaid);
    } catch (error) {
      Logger.error(`Diwali completion WhatsApp dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** WhatsApp payment-success confirmation — best-effort, never blocks the response. */
  private async notifyPaymentSuccess(userId: string, updated: ISavings, amount: number) {
    try {
      const user = await this.userRepository.findById(userId);
      if (user?.phone && updated.passbookNumber) {
        await sendSavingsPaymentSuccess(user.phone, {
          passbookNumber: updated.passbookNumber,
          amount,
          totalPaid: updated.totalPaid,
        });
      }
    } catch (error) {
      Logger.error(`Savings payment WhatsApp dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Step 1 of customer self-pay: create a Razorpay order for this installment. FIXED plans use
   * the scheme's monthly amount, server-computed — client input is never trusted. FLEXIBLE
   * plans (item 4) let the customer pick their own amount each time, so `amount` is REQUIRED
   * for those and validated against the plan's floor here — once accepted, it's baked into the
   * Razorpay order and re-derived from there (not from client input again) at verify time.
   */
  public async createInstallmentOrder(userId: string, schemeId: string, amount?: number) {
    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);
    if (scheme.userId.toString() !== userId) throw new AppError('Not authorized', 403);
    if (scheme.status !== 'Active') {
      throw new AppError(`This scheme is ${scheme.status.toLowerCase()} and can no longer accept payments`, 400);
    }

    const plan = await this.getPlanForScheme(scheme);
    const isFlexible = plan?.paymentMode === 'FLEXIBLE';

    const realPayments = scheme.payments.filter((p) => p.amount > 0).length;
    if (isFlexible) {
      if (new Date() > addMonths(scheme.startDate, scheme.duration)) {
        throw new AppError('This scheme\'s payment window has closed', 400);
      }
    } else if (realPayments >= scheme.duration) {
      throw new AppError('This scheme has already collected all its installments', 400);
    }

    const collectionMonthKey = istMonthKey(new Date());
    if (!isFlexible && scheme.payments.some((p) => p.amount > 0 && p.dueMonthKey === collectionMonthKey)) {
      throw new AppError('An installment for this month has already been recorded', 400);
    }

    let payAmount = scheme.monthlyAmount;
    if (isFlexible) {
      payAmount = Number(amount);
      if (!Number.isFinite(payAmount) || payAmount < scheme.monthlyAmount) {
        throw new AppError(`amount must be at least ₹${scheme.monthlyAmount}`, 400);
      }
    }

    const amountPaise = Math.round(payAmount * 100);
    const order = await createRazorpayOrder(amountPaise, 'INR', `savings_${schemeId}_${Date.now()}`);
    return { id: order.id, amount: order.amount, currency: order.currency };
  }

  /**
   * Step 2: verify the Razorpay signature, re-confirm the amount actually captured is valid,
   * then apply the payment. FIXED plans require an exact match on the scheme's monthly amount
   * (closes the same tamper loop as product checkout — see PaymentService.verifyAndCreateOrder).
   * FLEXIBLE plans (item 4) instead trust the CAPTURED order's own amount as the ground truth —
   * it was already server-validated (>= the plan floor) at create-order time and can't be
   * altered client-side without breaking the Razorpay signature check above.
   */
  public async verifyAndRecordInstallment(
    userId: string,
    schemeId: string,
    razorpay: { orderId: string; paymentId: string; signature: string },
  ) {
    if (!verifyRazorpaySignature(razorpay.orderId, razorpay.paymentId, razorpay.signature)) {
      throw new AppError('Payment verification failed — signature mismatch', 400);
    }

    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);
    if (scheme.userId.toString() !== userId) throw new AppError('Not authorized', 403);

    const plan = await this.getPlanForScheme(scheme);
    const isFlexible = plan?.paymentMode === 'FLEXIBLE';

    const razorpayOrder = await fetchRazorpayOrder(razorpay.orderId);
    const capturedPaise = Number(razorpayOrder?.amount);
    let payAmount = scheme.monthlyAmount;
    if (isFlexible) {
      payAmount = capturedPaise / 100;
      if (!Number.isFinite(payAmount) || payAmount < scheme.monthlyAmount) {
        throw new AppError('Captured payment amount is invalid for this scheme', 400);
      }
    } else if (capturedPaise !== Math.round(scheme.monthlyAmount * 100)) {
      throw new AppError("Payment amount does not match the scheme's monthly amount", 400);
    }

    const updated = await this.applyPayment(schemeId, payAmount, {
      method: 'ONLINE',
      razorpayOrderId: razorpay.orderId,
      razorpayPaymentId: razorpay.paymentId,
    });
    const payments = await this.savingsRepository.getPayments(schemeId);
    await this.notifyPaymentSuccess(userId, updated, payAmount);
    return { ...updated, payments };
  }

  /**
   * Manual/offline collection entry — e.g. a walk-in cash payment, or migrating a legacy
   * paper-ledger row. Staff and admin can both call this (see admin.routes.ts); editing or
   * deleting an existing ledger row afterward stays admin-only. `materialRate` is an optional
   * override of the live rate for the scheme's metal. `recordedBy` is the staff/admin user id.
   */
  public async recordPaymentAsAdmin(
    schemeId: string,
    amount: number,
    materialRateOverride: number | undefined,
    recordedBy: string,
  ) {
    const updated = await this.applyPayment(schemeId, amount, {
      materialRateOverride,
      method: 'CASH',
      recordedBy,
    });
    const payments = await this.savingsRepository.getPayments(schemeId);
    await this.notifyPaymentSuccess(updated.userId.toString(), updated, amount);
    return { ...updated, payments };
  }

  /**
   * Card rule 6 (early exit): stopping before completing the scheme forfeits
   * `plan.earlyExitPenaltyPercent` (default 10%) of the amount paid, plus the ₹ value of any
   * gifts already handed over (admin enters this — the app has no gift-inventory link). The
   * remainder is redeemable as goods only, never cash — this method just records the split;
   * staff complete the in-store exchange separately.
   */
  public async cancelScheme(schemeId: string, cancelledBy: string, data: { giftsValueDeducted?: number; note?: string }) {
    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);
    if (scheme.status !== 'Active') {
      throw new AppError(`This scheme is already ${scheme.status.toLowerCase()}`, 400);
    }

    const plan = await this.getPlanForScheme(scheme);
    const penaltyPercent = plan?.earlyExitPenaltyPercent ?? 10;
    const giftsValueDeducted = Math.max(0, Number(data.giftsValueDeducted) || 0);
    const amountPaidAtCancellation = scheme.totalPaid;
    const penaltyAmount = round2(amountPaidAtCancellation * (penaltyPercent / 100));
    const netRedeemable = Math.max(0, round2(amountPaidAtCancellation - penaltyAmount - giftsValueDeducted));

    const updated = await this.savingsRepository.cancelScheme(schemeId, {
      cancelledAt: new Date(),
      amountPaidAtCancellation,
      penaltyPercent,
      penaltyAmount,
      giftsValueDeducted,
      netRedeemable,
      note: data.note ? String(data.note).trim() : undefined,
      cancelledBy,
    });
    if (!updated) throw new AppError('Savings scheme not found', 404);
    return updated;
  }

  /**
   * Diwali redemption payout — business rule confirmed by the owner with a worked example
   * (₹3,000/mo × 11 = ₹33,000 paid → ₹32,000 gold + ₹2,500 gifts + a silver coin, i.e. total
   * VALUE handed back is ₹36,000 = paid + 1 bonus month, same "+1" pattern as Gold/Silver 11+1):
   *
   *   totalValue = totalPaid + monthlyAmount          (1 bonus month's worth, credited in kind)
   *   goldValue  = totalValue − plan.hamper.giftsValue − (plan.hamper.silverCoinGrams × silverRate)
   *   goldGrams  = goldValue / goldRate
   *
   * Gold is a fixed ₹ VALUE, not a fixed weight — it converts to however many grams that buys
   * at the rate on the day of redemption, so the payout is fair regardless of how gold moved
   * between enrollment and Diwali. No customer top-up or KV refund is ever needed. Admin
   * triggers this once the scheme has completed all its installments (ahead of the festival);
   * the result is stored on `maturityBenefits`, the same field 11+1 schemes use.
   */
  public async computeDiwaliRedemption(schemeId: string) {
    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);
    if (scheme.schemeType !== 'DIWALI') {
      throw new AppError('Redemption payout only applies to Diwali schemes', 400);
    }
    if (scheme.status !== 'Completed') {
      throw new AppError('This scheme must complete all its installments before the redemption payout can be computed', 400);
    }
    const plan = await this.getPlanForScheme(scheme);
    const giftsValue = plan?.hamper?.giftsValue ?? 0;
    const silverCoinGrams = plan?.hamper?.silverCoinGrams ?? 0;
    const gifts = plan?.hamper?.gifts ?? [];

    const [goldRate, silverRate] = await Promise.all([
      this.pricingService.getCurrentRatePerGram('GOLD'),
      silverCoinGrams > 0 ? this.pricingService.getCurrentRatePerGram('SILVER') : Promise.resolve(0),
    ]);
    if (!goldRate) throw new AppError('No gold rate is available to compute the redemption payout', 400);
    if (silverCoinGrams > 0 && !silverRate) {
      throw new AppError('No silver rate is available to compute the redemption payout', 400);
    }

    const totalValue = scheme.totalPaid + scheme.monthlyAmount;
    const silverValue = round2(silverCoinGrams * (silverRate ?? 0));
    const goldValue = round2(totalValue - giftsValue - silverValue);
    if (goldValue < 0) {
      throw new AppError(
        `Plan configuration error — giftsValue (₹${giftsValue}) + silver coin value (₹${silverValue}) exceed the total payout value (₹${totalValue})`,
        400,
      );
    }
    const goldGrams = round3(goldValue / goldRate);

    const updated = await this.savingsRepository.setMaturityBenefits(schemeId, {
      goldCoinValue: goldValue,
      goldGrams,
      goldRatePerGram: goldRate,
      silverGrams: silverCoinGrams,
      silverValue,
      silverRatePerGram: silverRate ?? undefined,
      giftsValue,
      gifts,
      computedAt: new Date(),
    });
    if (!updated) throw new AppError('Savings scheme not found', 404);
    await this.notifyDiwaliRedemptionReady(updated);
    return updated;
  }

  /** Best-effort customer notification once the redemption payout is computed. */
  private async notifyDiwaliRedemptionReady(scheme: ISavings) {
    try {
      if (!scheme.userId) return;
      const user = await this.userRepository.findById(scheme.userId.toString());
      const mb = scheme.maturityBenefits;
      if (user?.phone && scheme.passbookNumber && mb) {
        await sendDiwaliRedemptionReady(user.phone, {
          passbookNumber: scheme.passbookNumber,
          goldGrams: mb.goldGrams ?? 0,
          goldCoinValue: mb.goldCoinValue ?? 0,
          silverGrams: mb.silverGrams ?? 0,
          giftsValue: mb.giftsValue ?? 0,
        });
      }
    } catch (error) {
      Logger.error(`Diwali redemption WhatsApp dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async getAllSchemes() {
    const schemes = await this.savingsRepository.findAll();
    return schemes.map((s) => this.withMaturityDate(s));
  }

  /**
   * Admin-only correction of a passbook record (planName/amount/duration/status/maturity
   * benefits/etc). The passbook number itself is never editable here — it's the tracking
   * key customers quote over WhatsApp/support, so renaming it would break lookups already
   * handed out.
   */
  public async adminUpdateScheme(id: string, data: any) {
    const update: Record<string, unknown> = {};

    if (data.planName !== undefined) {
      const planName = String(data.planName).trim();
      if (!planName) throw new AppError('planName cannot be empty', 400);
      update.planName = planName;
    }

    if (data.schemeType !== undefined) {
      if (!ALL_SCHEME_TYPES.includes(data.schemeType)) {
        throw new AppError(`schemeType must be one of ${ALL_SCHEME_TYPES.join(', ')}`, 400);
      }
      update.schemeType = data.schemeType;
    }

    if (data.metal !== undefined) {
      if (data.metal !== null && !['GOLD', 'SILVER'].includes(data.metal)) {
        throw new AppError('metal must be GOLD or SILVER', 400);
      }
      update.metal = data.metal ?? undefined;
    }

    if (data.monthlyAmount !== undefined) {
      const monthlyAmount = Number(data.monthlyAmount);
      if (!Number.isInteger(monthlyAmount) || monthlyAmount < 1000) {
        throw new AppError('monthlyAmount must be a whole number and at least 1000', 400);
      }
      update.monthlyAmount = monthlyAmount;
    }

    if (data.duration !== undefined) {
      const duration = Number(data.duration);
      if (!Number.isInteger(duration) || duration < 1) {
        throw new AppError('duration must be a positive whole number', 400);
      }
      update.duration = duration;
    }

    if (data.bonusAmount !== undefined) {
      const bonusAmount = Number(data.bonusAmount);
      if (!Number.isFinite(bonusAmount) || bonusAmount < 0) {
        throw new AppError('bonusAmount must be a non-negative number', 400);
      }
      update.bonusAmount = bonusAmount;
    }

    if (data.totalPaid !== undefined) {
      const totalPaid = Number(data.totalPaid);
      if (!Number.isFinite(totalPaid) || totalPaid < 0) {
        throw new AppError('totalPaid must be a non-negative number', 400);
      }
      update.totalPaid = totalPaid;
    }

    if (data.status !== undefined) {
      const allowedStatuses = ['Active', 'Completed', 'Cancelled', 'Dropped'];
      if (!allowedStatuses.includes(data.status)) {
        throw new AppError('status must be one of Active, Completed, Cancelled, or Dropped', 400);
      }
      update.status = data.status;
    }

    if (data.startDate !== undefined) {
      const startDate = new Date(data.startDate);
      if (Number.isNaN(startDate.getTime())) throw new AppError('startDate is invalid', 400);
      update.startDate = startDate;
    }

    if (data.maturityBenefits !== undefined) {
      const mb = data.maturityBenefits ?? {};
      const goldCoinValue = mb.goldCoinValue !== undefined ? Number(mb.goldCoinValue) : undefined;
      const silverGrams = mb.silverGrams !== undefined ? Number(mb.silverGrams) : undefined;
      if (goldCoinValue !== undefined && (!Number.isFinite(goldCoinValue) || goldCoinValue < 0)) {
        throw new AppError('maturityBenefits.goldCoinValue must be a non-negative number', 400);
      }
      if (silverGrams !== undefined && (!Number.isFinite(silverGrams) || silverGrams < 0)) {
        throw new AppError('maturityBenefits.silverGrams must be a non-negative number', 400);
      }
      const gifts = Array.isArray(mb.gifts)
        ? mb.gifts.map((g: unknown) => String(g).trim()).filter(Boolean)
        : [];
      update.maturityBenefits = { goldCoinValue, silverGrams, gifts };
    }

    if (Object.keys(update).length === 0) {
      throw new AppError('No valid fields provided to update', 400);
    }

    const updated = await this.savingsRepository.updateById(id, update);
    if (!updated) throw new AppError('Savings scheme not found', 404);
    return updated;
  }

  public async adminDeleteScheme(id: string) {
    const deleted = await this.savingsRepository.deleteById(id);
    if (!deleted) throw new AppError('Savings scheme not found', 404);
    return deleted;
  }

  /**
   * Admin-only correction of a single ledger row. Any edited `amount`/`materialRate` (or
   * `devidentAmount`/`devidentMaterialRate`) re-derives the corresponding weight so the row
   * stays internally consistent — Total/Cumulative are computed at read time from these.
   */
  public async adminUpdatePaymentRow(schemeId: string, index: number, data: any) {
    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);
    const row = scheme.payments[index];
    if (!row) throw new AppError('Ledger row not found', 404);

    const patch: Record<string, unknown> = {};

    if (data.amount !== undefined || data.materialRate !== undefined) {
      const amount = data.amount !== undefined ? Number(data.amount) : row.amount;
      const materialRate = data.materialRate !== undefined ? Number(data.materialRate) : row.materialRate;
      if (!Number.isFinite(amount) || amount < 0) throw new AppError('amount must be a non-negative number', 400);
      if (!Number.isFinite(materialRate) || materialRate < 0) {
        throw new AppError('materialRate must be a non-negative number', 400);
      }
      patch.amount = amount;
      patch.materialRate = materialRate;
      patch.materialWeight = materialRate > 0 ? round3(amount / materialRate) : 0;
    }

    if (data.devidentAmount !== undefined || data.devidentMaterialRate !== undefined) {
      const devidentAmount = data.devidentAmount !== undefined ? Number(data.devidentAmount) : row.devidentAmount;
      const devidentMaterialRate =
        data.devidentMaterialRate !== undefined ? Number(data.devidentMaterialRate) : row.devidentMaterialRate;
      if (!Number.isFinite(devidentAmount) || devidentAmount < 0) {
        throw new AppError('devidentAmount must be a non-negative number', 400);
      }
      if (!Number.isFinite(devidentMaterialRate) || devidentMaterialRate < 0) {
        throw new AppError('devidentMaterialRate must be a non-negative number', 400);
      }
      patch.devidentAmount = devidentAmount;
      patch.devidentMaterialRate = devidentMaterialRate;
      patch.devidentMaterialWeight = devidentMaterialRate > 0 ? round3(devidentAmount / devidentMaterialRate) : 0;
    }

    if (data.paidAt !== undefined) {
      const paidAt = new Date(data.paidAt);
      if (Number.isNaN(paidAt.getTime())) throw new AppError('paidAt is invalid', 400);
      patch.paidAt = paidAt;
    }

    if (Object.keys(patch).length === 0) {
      throw new AppError('No valid fields provided to update', 400);
    }

    const updated = await this.savingsRepository.updatePaymentRow(schemeId, index, patch);
    if (!updated) throw new AppError('Savings scheme or ledger row not found', 404);
    return updated;
  }

  public async adminDeletePaymentRow(schemeId: string, index: number) {
    const updated = await this.savingsRepository.deletePaymentRow(schemeId, index);
    if (!updated) throw new AppError('Savings scheme or ledger row not found', 404);
    return updated;
  }

  /** Track a scheme by its passbook number — the customer-facing lookup key.
   * A customer may only look up their own passbook; admin/staff can look up any. */
  public async getByPassbookNumber(requesterUserId: string, isStaffOrAdmin: boolean, passbookNumber: string) {
    const scheme = await this.savingsRepository.findByPassbookNumber(passbookNumber);
    if (!scheme) throw new AppError('No savings scheme found for that passbook number', 404);
    if (!isStaffOrAdmin && scheme.userId.toString() !== requesterUserId) {
      throw new AppError('Not authorized', 403);
    }
    return this.withMaturityDate(scheme);
  }
}
