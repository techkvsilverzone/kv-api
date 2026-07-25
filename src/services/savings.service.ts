import { SavingsRepository } from '../repositories/savings.repository';
import { UserRepository } from '../repositories/user.repository';
import { PricingService } from './pricing.service';
import { ISavings } from '../models/savings.model';
import { sendSavingsPaymentSuccess } from '../utils/whatsapp';
import { createRazorpayOrder, fetchRazorpayOrder, verifyRazorpaySignature } from '../utils/razorpay';
import { AppError } from '../utils/appError';
import Logger from '../utils/logger';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export class SavingsService {
  private savingsRepository: SavingsRepository;
  private userRepository: UserRepository;
  private pricingService: PricingService;

  constructor() {
    this.savingsRepository = new SavingsRepository();
    this.userRepository = new UserRepository();
    this.pricingService = new PricingService();
  }

  /** Enrollment alone creates a scheme record but no passbook — that's issued on first payment. */
  public async enroll(userId: string, data: any) {
    const monthlyAmount = Number(data.monthlyAmount);
    if (!Number.isInteger(monthlyAmount) || monthlyAmount < 1000) {
      throw new AppError('monthlyAmount must be a whole number and at least 1000', 400);
    }

    const duration = Number(data.duration);
    const allowedDurations = [6, 11, 12];
    if (!allowedDurations.includes(duration)) {
      throw new AppError('duration must be one of 6, 11, or 12', 400);
    }

    const bonusAmount = duration === 11 ? monthlyAmount : 0;
    return await this.savingsRepository.create({
      user: userId,
      ...data,
      monthlyAmount,
      duration,
      totalPaid: 0,
      bonusAmount,
    });
  }

  public async getMySchemes(userId: string) {
    return await this.savingsRepository.findByUserId(userId);
  }

  /**
   * Core ledger-entry logic shared by the customer (post-Razorpay-verify) and admin
   * (manual/offline collection) payment paths.
   *
   * - Resolves the material rate: an explicit override (admin only), else the live silver
   *   rate (`PricingService.getCurrentSilverRatePerGram`).
   * - Converts the collection to grams and mints the passbook on the very first payment
   *   (see SavingsRepository.recordPayment).
   * - Auto-credits the bonus/devident row and flips the scheme to Completed the moment an
   *   11-month scheme's 11th real installment lands (see SavingsRepository.creditBonusMonth).
   */
  private async applyPayment(
    schemeId: string,
    amount: number,
    materialRateOverride?: number,
  ): Promise<ISavings> {
    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);

    if (scheme.status !== 'Active') {
      throw new AppError(`This scheme is ${scheme.status.toLowerCase()} and can no longer accept payments`, 400);
    }
    const realPaymentsSoFar = scheme.payments.filter((p) => p.amount > 0).length;
    if (realPaymentsSoFar >= scheme.duration) {
      throw new AppError('This scheme has already collected all its installments', 400);
    }
    // Payment lowest cutoff: an installment can't undercut the scheme's own monthly
    // amount — mirrors the >=1000 floor enforced at enrollment.
    if (!Number.isFinite(amount) || amount < scheme.monthlyAmount) {
      throw new AppError(
        `Payment must be at least the scheme's monthly amount (₹${scheme.monthlyAmount})`,
        400,
      );
    }

    const rate = materialRateOverride ?? (await this.pricingService.getCurrentSilverRatePerGram());
    if (!rate || rate <= 0) {
      throw new AppError('No silver rate is available to record this collection — set one first', 400);
    }

    const month = scheme.payments.length + 1;
    const materialWeight = round3(amount / rate);
    // A real passbook is only minted once — on this scheme's first actual payment.
    const isFirstPayment = scheme.payments.length === 0 && !scheme.passbookNumber;

    const updated = await this.savingsRepository.recordPayment(
      schemeId,
      { month, amount, materialRate: rate, materialWeight },
      isFirstPayment,
    );
    if (!updated) throw new AppError('Savings scheme not found', 404);

    const realPaymentsNow = updated.payments.filter((p) => p.amount > 0).length;
    const alreadyHasDevident = updated.payments.some((p) => p.devidentAmount > 0);
    if (updated.duration === 11 && realPaymentsNow === 11 && !alreadyHasDevident) {
      const devidentAmount = updated.bonusAmount;
      const withBonus = await this.savingsRepository.creditBonusMonth(schemeId, {
        month: month + 1,
        devidentAmount,
        devidentMaterialRate: rate,
        devidentMaterialWeight: round3(devidentAmount / rate),
      });
      if (withBonus) return withBonus;
    }

    return updated;
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
   * Step 1 of customer self-pay: create a Razorpay order for this scheme's monthly
   * amount. The amount is always server-computed from the scheme — never client input.
   */
  public async createInstallmentOrder(userId: string, schemeId: string) {
    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);
    if (scheme.userId.toString() !== userId) throw new AppError('Not authorized', 403);
    if (scheme.status !== 'Active') {
      throw new AppError(`This scheme is ${scheme.status.toLowerCase()} and can no longer accept payments`, 400);
    }
    const realPayments = scheme.payments.filter((p) => p.amount > 0).length;
    if (realPayments >= scheme.duration) {
      throw new AppError('This scheme has already collected all its installments', 400);
    }

    const amountPaise = Math.round(scheme.monthlyAmount * 100);
    const order = await createRazorpayOrder(amountPaise, 'INR', `savings_${schemeId}_${Date.now()}`);
    return { id: order.id, amount: order.amount, currency: order.currency };
  }

  /**
   * Step 2: verify the Razorpay signature, re-confirm the amount actually captured
   * matches the scheme's monthly amount (closes the same tamper loop as product
   * checkout — see PaymentService.verifyAndCreateOrder), then apply the payment.
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

    const razorpayOrder = await fetchRazorpayOrder(razorpay.orderId);
    const expectedPaise = Math.round(scheme.monthlyAmount * 100);
    if (Number(razorpayOrder?.amount) !== expectedPaise) {
      throw new AppError("Payment amount does not match the scheme's monthly amount", 400);
    }

    const updated = await this.applyPayment(schemeId, scheme.monthlyAmount);
    const payments = await this.savingsRepository.getPayments(schemeId);
    await this.notifyPaymentSuccess(userId, updated, scheme.monthlyAmount);
    return { ...updated, payments };
  }

  /**
   * Admin-only manual/offline collection entry — e.g. a walk-in cash payment, or migrating
   * a legacy paper-ledger row. Not exposed to staff (see admin.routes.ts: `admin`, not
   * `adminOrStaff`). `materialRate` is an optional override of the live silver rate.
   */
  public async recordPaymentAsAdmin(schemeId: string, amount: number, materialRateOverride?: number) {
    const updated = await this.applyPayment(schemeId, amount, materialRateOverride);
    const payments = await this.savingsRepository.getPayments(schemeId);
    await this.notifyPaymentSuccess(updated.userId.toString(), updated, amount);
    return { ...updated, payments };
  }

  public async getAllSchemes() {
    return await this.savingsRepository.findAll();
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

    if (data.monthlyAmount !== undefined) {
      const monthlyAmount = Number(data.monthlyAmount);
      if (!Number.isInteger(monthlyAmount) || monthlyAmount < 1000) {
        throw new AppError('monthlyAmount must be a whole number and at least 1000', 400);
      }
      update.monthlyAmount = monthlyAmount;
    }

    if (data.duration !== undefined) {
      const duration = Number(data.duration);
      const allowedDurations = [6, 11, 12];
      if (!allowedDurations.includes(duration)) {
        throw new AppError('duration must be one of 6, 11, or 12', 400);
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
      const allowedStatuses = ['Active', 'Completed', 'Cancelled'];
      if (!allowedStatuses.includes(data.status)) {
        throw new AppError('status must be one of Active, Completed, or Cancelled', 400);
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
    return scheme;
  }
}
