import { ReturnRepository } from '../repositories/return.repository';
import { AppError } from '../utils/appError';

export class ReturnService {
  private returnRepository: ReturnRepository;

  constructor() {
    this.returnRepository = new ReturnRepository();
  }

  public async createReturn(userId: string, data: any) {
    return await this.returnRepository.create({
      userId,
      orderId: data.orderId,
      reason: data.reason,
      description: data.description,
      items: data.items,
    });
  }

  public async getMyReturns(userId: string) {
    return await this.returnRepository.findByUserId(userId);
  }

  public async getAllReturns() {
    return await this.returnRepository.findAll();
  }

  public async updateReturnStatus(id: string, status: string, refundAmount: number) {
    const updated = await this.returnRepository.updateStatus(id, status, refundAmount);
    if (!updated) throw new AppError('Return request not found', 404);
    return updated;
  }
}
