import { SavingsRepository } from '../repositories/savings.repository';
import { AppError } from '../utils/appError';

export class SavingsService {
  private savingsRepository: SavingsRepository;

  constructor() {
    this.savingsRepository = new SavingsRepository();
  }

  public async enroll(userId: string, data: any) {
    const bonusAmount = data.duration === 11 ? Number(data.monthlyAmount || 0) : 0;
    return await this.savingsRepository.create({
      user: userId,
      ...data,
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
