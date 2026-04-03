import { SavingsRepository } from '../repositories/savings.repository';
import { AppError } from '../utils/appError';

export class SavingsService {
  private savingsRepository: SavingsRepository;

  constructor() {
    this.savingsRepository = new SavingsRepository();
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

    const updated = await this.savingsRepository.recordPayment(schemeId, amount, month);
    const payments = await this.savingsRepository.getPayments(schemeId);
    return { ...updated, payments };
  }

  public async getAllSchemes() {
    return await this.savingsRepository.findAll();
  }
}
