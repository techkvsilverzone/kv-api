import { GiftVoucherRepository } from '../repositories/giftVoucher.repository';
import { AppError } from '../utils/appError';

export class GiftVoucherService {
  private giftVoucherRepository: GiftVoucherRepository;

  constructor() {
    this.giftVoucherRepository = new GiftVoucherRepository();
  }

  /** Public storefront list — active denominations only. */
  public async getActiveVouchers() {
    return this.giftVoucherRepository.findActive();
  }

  /** Admin list — includes inactive. */
  public async getAllVouchers() {
    return this.giftVoucherRepository.findAll();
  }

  public async createVoucher(data: any) {
    const label = String(data?.label || '').trim();
    if (!label) throw new AppError('label is required', 400);

    const amount = Number(data?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('amount must be a positive number', 400);
    }

    return this.giftVoucherRepository.create({
      label,
      amount,
      description: data.description,
      imageBase64: data.imageBase64 || data.image,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : 1,
    });
  }

  public async updateVoucher(id: string, data: any) {
    if (data?.amount !== undefined) {
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError('amount must be a positive number', 400);
      }
    }
    if (data?.label !== undefined && !String(data.label).trim()) {
      throw new AppError('label must be a non-empty string', 400);
    }

    const voucher = await this.giftVoucherRepository.update(id, data);
    if (!voucher) throw new AppError('Gift voucher not found', 404);
    return voucher;
  }

  public async deleteVoucher(id: string) {
    const deleted = await this.giftVoucherRepository.delete(id);
    if (!deleted) throw new AppError('Gift voucher not found', 404);
  }
}
