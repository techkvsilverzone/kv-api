import { SavingsRepository } from '../repositories/savings.repository';
import { UserRepository } from '../repositories/user.repository';
import { sendSavingsPaymentSuccess } from '../utils/whatsapp';
import { AppError } from '../utils/appError';
import Logger from '../utils/logger';

export class SavingsService {
  private savingsRepository: SavingsRepository;
  private userRepository: UserRepository;

  constructor() {
    this.savingsRepository = new SavingsRepository();
    this.userRepository = new UserRepository();
  }

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

  public async recordPayment(userId: string, schemeId: string, amount: number, month: number) {
    const scheme = await this.savingsRepository.findById(schemeId);
    if (!scheme) throw new AppError('Savings scheme not found', 404);
    if (scheme.userId.toString() !== userId) throw new AppError('Not authorized', 403);

    // Payment lowest cutoff: an installment can't undercut the scheme's own
    // monthly amount — mirrors the >=1000 floor enforced at enrollment.
    if (!Number.isFinite(amount) || amount < scheme.monthlyAmount) {
      throw new AppError(
        `Payment must be at least the scheme's monthly amount (₹${scheme.monthlyAmount})`,
        400,
      );
    }

    const updated = await this.savingsRepository.recordPayment(schemeId, amount, month);
    const payments = await this.savingsRepository.getPayments(schemeId);

    // WhatsApp payment-success confirmation (best-effort — never blocks the response).
    try {
      const user = await this.userRepository.findById(userId);
      if (user?.phone && updated) {
        await sendSavingsPaymentSuccess(user.phone, {
          passbookNumber: updated.passbookNumber,
          amount,
          totalPaid: updated.totalPaid,
        });
      }
    } catch (error) {
      Logger.error(`Savings payment WhatsApp dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { ...updated, payments };
  }

  public async getAllSchemes() {
    return await this.savingsRepository.findAll();
  }

  /**
   * Admin-only correction of a passbook record (planName/amount/duration/status/etc). The
   * passbook number itself is never editable here — it's the tracking key customers quote
   * over WhatsApp/support, so renaming it would break lookups already handed out.
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
